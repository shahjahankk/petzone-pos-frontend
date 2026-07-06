/** @deprecated Use thermalPrinter.js — re-exports for backward compatibility */
export {
  BAUD_RATES,
  SERIAL_OPEN_BASE,
  acquireSerialPort,
  closeSerialPortIfOpen,
  connectSerialPrinter,
  getGrantedSerialPortCount,
  isWebSerialSupported,
  openSerialPort,
  resetCachedSerialPort,
  restoreCachedSerialPort,
  writeToSerialPort,
} from './thermalPrinter'
