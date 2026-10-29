import { Capacitor, registerPlugin } from '@capacitor/core';

const ReceiptPrinter = registerPlugin('ReceiptPrinter');

window.KasirPrinter = {
  isNative: Capacitor.isNativePlatform(),
  getPairedDevices: () => ReceiptPrinter.getPairedDevices(),
  openBluetoothSettings: () => ReceiptPrinter.openBluetoothSettings(),
  connect: (address) => ReceiptPrinter.connect({ address }),
  disconnect: () => ReceiptPrinter.disconnect(),
  print: (text) => ReceiptPrinter.print({ text })
};