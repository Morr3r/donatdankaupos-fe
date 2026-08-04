export interface ThermalPrinterDevice {
  name: string;
  address: string;
}

export interface UsbThermalPrinterDevice {
  name: string;
  deviceId: number;
  vendorId: number;
  productId: number;
}
