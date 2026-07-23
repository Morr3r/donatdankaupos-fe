import { registerWebModule, NativeModule } from 'expo';
import type { ThermalPrinterDevice, UsbThermalPrinterDevice } from './ThermalPrinter.types';

// ThermalPrinterModule is not available on the web platform.
class ThermalPrinterModule extends NativeModule {
  async isSupportedAsync(): Promise<boolean> {
    return false;
  }

  async isBluetoothEnabledAsync(): Promise<boolean> {
    return false;
  }

  async getPairedDevicesAsync(): Promise<ThermalPrinterDevice[]> {
    return [];
  }

  async getUsbDevicesAsync(): Promise<UsbThermalPrinterDevice[]> {
    return [];
  }

  async openBluetoothSettingsAsync(): Promise<void> {
    throw new Error('Pengaturan printer thermal hanya tersedia di aplikasi Android.');
  }

  async printBase64Async(): Promise<boolean> {
    throw new Error('Printer thermal hanya tersedia di aplikasi Android.');
  }

  async printUsbBase64Async(): Promise<boolean> {
    throw new Error('Printer USB hanya tersedia di aplikasi Android.');
  }

  async printNetworkBase64Async(): Promise<boolean> {
    throw new Error('Printer jaringan hanya tersedia di aplikasi Android.');
  }
}

export default registerWebModule(ThermalPrinterModule, 'ThermalPrinterModule');
