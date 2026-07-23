import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { ThermalPrinterDevice } from './ThermalPrinter.types';

declare class ThermalPrinterModule extends NativeModule {
  isSupportedAsync(): Promise<boolean>;
  isBluetoothEnabledAsync(): Promise<boolean>;
  getPairedDevicesAsync(): Promise<ThermalPrinterDevice[]>;
  openBluetoothSettingsAsync(): Promise<void>;
  printBase64Async(address: string, base64Payload: string): Promise<boolean>;
}

export default requireOptionalNativeModule<ThermalPrinterModule>('ThermalPrinter');
