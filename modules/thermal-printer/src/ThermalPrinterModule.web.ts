import { registerWebModule, NativeModule } from 'expo';
import type { ThermalPrinterDevice } from './ThermalPrinter.types';

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

  async openBluetoothSettingsAsync(): Promise<void> {
    throw new Error('Pengaturan printer thermal hanya tersedia di aplikasi Android.');
  }

  async printBase64Async(): Promise<boolean> {
    throw new Error('Printer thermal hanya tersedia di aplikasi Android.');
  }
}

export default registerWebModule(ThermalPrinterModule, 'ThermalPrinterModule');
