import { NativeModule, requireOptionalNativeModule } from 'expo';
import type { ThermalPrinterDevice, UsbThermalPrinterDevice } from './ThermalPrinter.types';

declare class ThermalPrinterModule extends NativeModule {
  isSupportedAsync(): Promise<boolean>;
  isBluetoothEnabledAsync(): Promise<boolean>;
  getPairedDevicesAsync(): Promise<ThermalPrinterDevice[]>;
  getUsbDevicesAsync(): Promise<UsbThermalPrinterDevice[]>;
  openBluetoothSettingsAsync(): Promise<void>;
  printBase64Async(address: string, base64Payload: string): Promise<boolean>;
  printUsbBase64Async(
    deviceId: number,
    vendorId: number,
    productId: number,
    base64Payload: string,
  ): Promise<boolean>;
  printNetworkBase64Async(host: string, port: number, base64Payload: string): Promise<boolean>;
}

export default requireOptionalNativeModule<ThermalPrinterModule>('ThermalPrinter');
