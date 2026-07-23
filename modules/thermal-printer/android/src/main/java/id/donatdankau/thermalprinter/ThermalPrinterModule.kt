package id.donatdankau.thermalprinter

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.IOException
import java.util.UUID

private val SERIAL_PORT_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
private const val WRITE_CHUNK_SIZE = 512

private class BluetoothPermissionException :
  CodedException("Izin perangkat Bluetooth belum diberikan.")

private class BluetoothUnavailableException :
  CodedException("Bluetooth tidak tersedia pada perangkat ini.")

private class BluetoothDisabledException :
  CodedException("Bluetooth belum aktif.")

private class InvalidPrinterAddressException :
  CodedException("Alamat printer Bluetooth tidak valid.")

private class PrinterConnectionException(cause: Throwable) :
  CodedException("Tidak dapat terhubung ke printer. Pastikan Iware C58BT aktif dan sudah dipasangkan.", cause)

private class PrinterWriteException(cause: Throwable) :
  CodedException("Koneksi printer terputus saat mencetak. Periksa kertas dan daya printer.", cause)

class ThermalPrinterModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val bluetoothAdapter: BluetoothAdapter?
    get() {
      val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
      return manager?.adapter
    }

  override fun definition() = ModuleDefinition {
    Name("ThermalPrinter")

    AsyncFunction("isSupportedAsync") {
      bluetoothAdapter != null
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

      val payload = try {
        Base64.decode(base64Payload, Base64.DEFAULT)
      } catch (error: IllegalArgumentException) {
        throw PrinterWriteException(error)
      }
      val device = adapter.getRemoteDevice(address)
      val socket = connect(device.createRfcommSocketToServiceRecord(SERIAL_PORT_UUID)) {
        device.createInsecureRfcommSocketToServiceRecord(SERIAL_PORT_UUID)
      }

      socket.use {
        try {
          val output = it.outputStream
          var offset = 0
          while (offset < payload.size) {
            val length = minOf(WRITE_CHUNK_SIZE, payload.size - offset)
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

  private fun connect(
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
}
