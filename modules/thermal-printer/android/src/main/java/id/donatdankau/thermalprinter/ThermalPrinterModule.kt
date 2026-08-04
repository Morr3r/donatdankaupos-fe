package id.donatdankau.thermalprinter

import android.Manifest
import android.app.PendingIntent
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import android.provider.Settings
import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

private val SERIAL_PORT_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
private const val BLUETOOTH_WRITE_CHUNK_SIZE = 512
private const val USB_WRITE_CHUNK_SIZE = 16 * 1024
private const val NETWORK_CONNECT_TIMEOUT_MS = 7_000
private const val USB_PERMISSION_TIMEOUT_SECONDS = 20L

private class BluetoothPermissionException :
  CodedException("Izin perangkat Bluetooth belum diberikan.")

private class BluetoothUnavailableException :
  CodedException("Bluetooth tidak tersedia pada perangkat ini.")

private class BluetoothDisabledException :
  CodedException("Bluetooth belum aktif.")

private class InvalidPrinterAddressException :
  CodedException("Alamat printer Bluetooth tidak valid.")

private class PrinterConnectionException(cause: Throwable) :
  CodedException(
    "Tidak dapat terhubung ke printer Bluetooth. Pastikan printer aktif, sudah dipasangkan, dan mendukung Bluetooth Classic SPP.",
    cause
  )

private class PrinterWriteException(cause: Throwable) :
  CodedException("Koneksi printer terputus saat mencetak. Periksa kertas, kabel, jaringan, dan daya printer.", cause)

private class UsbPrinterNotFoundException :
  CodedException("Printer USB tidak ditemukan. Sambungkan ulang kabel USB lalu muat ulang daftar printer.")

private class UsbPermissionException :
  CodedException("Izin printer USB tidak diberikan.")

private class UsbInterfaceException :
  CodedException("Perangkat USB tidak menyediakan endpoint keluaran yang kompatibel dengan pencetakan ESC/POS.")

private class InvalidNetworkPrinterException :
  CodedException("Alamat atau port printer jaringan tidak valid.")

private class NetworkPrinterConnectionException(cause: Throwable) :
  CodedException("Tidak dapat terhubung ke printer jaringan. Periksa alamat IP, port, Wi-Fi/LAN, dan daya printer.", cause)

private data class UsbOutputTarget(
  val usbInterface: UsbInterface,
  val endpoint: UsbEndpoint
)

class ThermalPrinterModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val bluetoothAdapter: BluetoothAdapter?
    get() {
      val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
      return manager?.adapter
    }

  private val usbManager: UsbManager
    get() = context.getSystemService(Context.USB_SERVICE) as UsbManager

  override fun definition() = ModuleDefinition {
    Name("ThermalPrinter")

    AsyncFunction("isSupportedAsync") {
      true
    }

    AsyncFunction("isBluetoothEnabledAsync") {
      requireBluetoothPermission()
      bluetoothAdapter?.isEnabled ?: false
    }

    AsyncFunction("getPairedDevicesAsync") {
      requireBluetoothPermission()
      val adapter = requireBluetoothAdapter()
      if (!adapter.isEnabled) throw BluetoothDisabledException()

      adapter.bondedDevices
        .map { device ->
          mapOf(
            "name" to (device.name ?: "Perangkat Bluetooth"),
            "address" to device.address
          )
        }
        .sortedWith(compareBy({ it["name"]?.lowercase() }, { it["address"] }))
    }

    AsyncFunction("getUsbDevicesAsync") {
      usbManager.deviceList.values
        .map { device ->
          mapOf(
            "name" to usbDeviceName(device),
            "deviceId" to device.deviceId,
            "vendorId" to device.vendorId,
            "productId" to device.productId
          )
        }
        .sortedWith(compareBy({ it["name"]?.toString()?.lowercase() }, { it["deviceId"] as? Int }))
    }

    AsyncFunction("openBluetoothSettingsAsync") {
      val intent = Intent(Settings.ACTION_BLUETOOTH_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
    }

    AsyncFunction("printBase64Async") { address: String, base64Payload: String ->
      requireBluetoothPermission()
      val adapter = requireBluetoothAdapter()
      if (!adapter.isEnabled) throw BluetoothDisabledException()
      if (!BluetoothAdapter.checkBluetoothAddress(address)) throw InvalidPrinterAddressException()

      val payload = decodePayload(base64Payload)
      val device = adapter.getRemoteDevice(address)
      val socket = connectBluetooth(device.createRfcommSocketToServiceRecord(SERIAL_PORT_UUID)) {
        device.createInsecureRfcommSocketToServiceRecord(SERIAL_PORT_UUID)
      }

      socket.use {
        try {
          val output = it.outputStream
          var offset = 0
          while (offset < payload.size) {
            val length = minOf(BLUETOOTH_WRITE_CHUNK_SIZE, payload.size - offset)
            output.write(payload, offset, length)
            output.flush()
            offset += length
            if (offset < payload.size) Thread.sleep(12)
          }
        } catch (error: Exception) {
          throw PrinterWriteException(error)
        }
      }
      true
    }

    AsyncFunction("printUsbBase64Async") {
        deviceId: Int,
        vendorId: Int,
        productId: Int,
        base64Payload: String ->
      val payload = decodePayload(base64Payload)
      val manager = usbManager
      val devices = manager.deviceList.values
      val device = devices.firstOrNull { it.deviceId == deviceId }
        ?: devices.firstOrNull { it.vendorId == vendorId && it.productId == productId }
        ?: throw UsbPrinterNotFoundException()

      ensureUsbPermission(manager, device)
      val target = findUsbOutputTarget(device) ?: throw UsbInterfaceException()
      val connection = manager.openDevice(device) ?: throw UsbPermissionException()

      var claimed = false
      try {
        claimed = connection.claimInterface(target.usbInterface, true)
        if (!claimed) throw UsbInterfaceException()
        var offset = 0
        while (offset < payload.size) {
          val length = minOf(USB_WRITE_CHUNK_SIZE, payload.size - offset)
          val written = connection.bulkTransfer(target.endpoint, payload, offset, length, 7_000)
          if (written <= 0) throw IOException("USB bulk transfer gagal pada offset $offset.")
          offset += written
        }
      } catch (error: CodedException) {
        throw error
      } catch (error: Exception) {
        throw PrinterWriteException(error)
      } finally {
        if (claimed) connection.releaseInterface(target.usbInterface)
        connection.close()
      }
      true
    }

    AsyncFunction("printNetworkBase64Async") { host: String, port: Int, base64Payload: String ->
      val normalizedHost = host.trim()
      if (normalizedHost.isEmpty() || normalizedHost.any { it.isWhitespace() } || port !in 1..65535) {
        throw InvalidNetworkPrinterException()
      }

      val payload = decodePayload(base64Payload)
      try {
        Socket().use { socket ->
          socket.tcpNoDelay = true
          socket.connect(InetSocketAddress(normalizedHost, port), NETWORK_CONNECT_TIMEOUT_MS)
          socket.getOutputStream().use { output ->
            output.write(payload)
            output.flush()
          }
        }
      } catch (error: Exception) {
        throw NetworkPrinterConnectionException(error)
      }
      true
    }
  }

  private fun decodePayload(base64Payload: String): ByteArray =
    try {
      Base64.decode(base64Payload, Base64.DEFAULT)
    } catch (error: IllegalArgumentException) {
      throw PrinterWriteException(error)
    }

  private fun requireBluetoothPermission() {
    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
      context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED
    ) {
      throw BluetoothPermissionException()
    }
  }

  private fun requireBluetoothAdapter(): BluetoothAdapter =
    bluetoothAdapter ?: throw BluetoothUnavailableException()

  private fun connectBluetooth(
    secureSocket: BluetoothSocket,
    insecureSocketFactory: () -> BluetoothSocket
  ): BluetoothSocket {
    try {
      secureSocket.connect()
      return secureSocket
    } catch (secureError: IOException) {
      try {
        secureSocket.close()
      } catch (_: IOException) {
        // Ignore close errors and attempt the common insecure RFCOMM fallback.
      }

      val insecureSocket = insecureSocketFactory()
      try {
        insecureSocket.connect()
        return insecureSocket
      } catch (insecureError: Exception) {
        try {
          insecureSocket.close()
        } catch (_: IOException) {
          // Preserve the connection error below.
        }
        insecureError.addSuppressed(secureError)
        throw PrinterConnectionException(insecureError)
      }
    } catch (error: Exception) {
      try {
        secureSocket.close()
      } catch (_: IOException) {
        // Preserve the connection error below.
      }
      throw PrinterConnectionException(error)
    }
  }

  private fun usbDeviceName(device: UsbDevice): String {
    val product = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) device.productName else null
    return product?.takeIf { it.isNotBlank() }
      ?: "USB ${device.vendorId.toString(16).uppercase().padStart(4, '0')}:${device.productId.toString(16).uppercase().padStart(4, '0')}"
  }

  private fun findUsbOutputTarget(device: UsbDevice): UsbOutputTarget? {
    var fallback: UsbOutputTarget? = null
    for (interfaceIndex in 0 until device.interfaceCount) {
      val usbInterface = device.getInterface(interfaceIndex)
      for (endpointIndex in 0 until usbInterface.endpointCount) {
        val endpoint = usbInterface.getEndpoint(endpointIndex)
        if (endpoint.direction != UsbConstants.USB_DIR_OUT) continue
        val target = UsbOutputTarget(usbInterface, endpoint)
        if (endpoint.type == UsbConstants.USB_ENDPOINT_XFER_BULK) return target
        if (endpoint.type == UsbConstants.USB_ENDPOINT_XFER_INT && fallback == null) fallback = target
      }
    }
    return fallback
  }

  private fun ensureUsbPermission(manager: UsbManager, device: UsbDevice) {
    if (manager.hasPermission(device)) return

    val action = "${context.packageName}.THERMAL_PRINTER_USB_PERMISSION.${device.deviceId}"
    val latch = CountDownLatch(1)
    var granted = false
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(receiveContext: Context?, intent: Intent?) {
        if (intent?.action != action) return
        val receivedDevice = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
        } else {
          @Suppress("DEPRECATION")
          intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
        }
        if (receivedDevice?.deviceId == device.deviceId) {
          granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
          latch.countDown()
        }
      }
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, IntentFilter(action), Context.RECEIVER_NOT_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      context.registerReceiver(receiver, IntentFilter(action))
    }

    try {
      val pendingIntent = PendingIntent.getBroadcast(
        context,
        device.deviceId,
        Intent(action).setPackage(context.packageName),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      manager.requestPermission(device, pendingIntent)
      if (!latch.await(USB_PERMISSION_TIMEOUT_SECONDS, TimeUnit.SECONDS) || !granted) {
        throw UsbPermissionException()
      }
    } finally {
      try {
        context.unregisterReceiver(receiver)
      } catch (_: IllegalArgumentException) {
        // Receiver may already be gone if Android stopped the permission flow.
      }
    }
  }
}
