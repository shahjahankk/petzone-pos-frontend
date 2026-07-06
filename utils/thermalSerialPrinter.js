const STORAGE_KEY = 'thermalSerialPortInfo'
const PERMISSION_KEY = 'printerPermissionGranted'

export const BAUD_RATES = [9600, 19200, 38400, 57600, 115200]

export const SERIAL_OPEN_BASE = {
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
}

let cachedSerialPort = null
let cachedSerialPortInfo = null

export function isWebSerialSupported() {
  return typeof navigator !== 'undefined' && !!navigator.serial
}

export function resetCachedSerialPort() {
  cachedSerialPort = null
  cachedSerialPortInfo = null
}

function persistPortInfo(info) {
  if (!info) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(info))
    sessionStorage.setItem(PERMISSION_KEY, '1')
  } catch (e) {
    /* ignore */
  }
}

function loadPersistedPortInfo() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

function matchPortByInfo(ports, info) {
  if (!info || !ports?.length) return null
  return ports.find((port) => {
    if (typeof port.getInfo !== 'function') return false
    const portInfo = port.getInfo()
    return (
      portInfo &&
      portInfo.usbVendorId === info.usbVendorId &&
      portInfo.usbProductId === info.usbProductId
    )
  }) || null
}

function cachePort(port) {
  cachedSerialPort = port
  if (port && typeof port.getInfo === 'function') {
    cachedSerialPortInfo = port.getInfo()
    persistPortInfo(cachedSerialPortInfo)
  }
  return cachedSerialPort
}

export async function restoreCachedSerialPort() {
  if (!isWebSerialSupported()) return null
  if (cachedSerialPort) return cachedSerialPort

  const grantedPorts = await navigator.serial.getPorts()
  if (!grantedPorts?.length) return null

  const persisted = cachedSerialPortInfo || loadPersistedPortInfo()
  return cachePort(matchPortByInfo(grantedPorts, persisted) || grantedPorts[0])
}

export async function getGrantedSerialPortCount() {
  if (!isWebSerialSupported()) return 0
  const ports = await navigator.serial.getPorts()
  return ports?.length || 0
}

/**
 * @param {{ allowRequest?: boolean }} options
 * allowRequest=false avoids requestPort() (required for auto-print without user gesture).
 */
export async function acquireSerialPort(options = {}) {
  const { allowRequest = true } = options

  if (!isWebSerialSupported()) {
    throw new Error('Web Serial is not supported. Use Chrome or Edge on desktop for USB thermal printing.')
  }

  const restored = await restoreCachedSerialPort()
  if (restored) return restored

  const grantedPorts = await navigator.serial.getPorts()
  if (grantedPorts?.length) {
    const persisted = loadPersistedPortInfo()
    return cachePort(matchPortByInfo(grantedPorts, persisted) || grantedPorts[0])
  }

  if (!allowRequest) {
    throw new Error(
      'Printer not connected. Click "Connect Printer" at the top of POS, select your USB thermal printer, then try again.'
    )
  }

  const requestedPort = await navigator.serial.requestPort()
  if (!requestedPort) throw new Error('No printer port selected')

  return cachePort(requestedPort)
}

/** Must be called from a user click — opens the browser port picker. */
export async function connectSerialPrinter() {
  resetCachedSerialPort()
  return acquireSerialPort({ allowRequest: true })
}

export async function closeSerialPortIfOpen(port) {
  if (!port) return
  try {
    if (port.readable || port.writable) {
      await port.close()
    }
  } catch (e) {
    /* ignore */
  }
}

export async function openSerialPort(port, baudRates = BAUD_RATES) {
  await closeSerialPortIfOpen(port)

  let lastError
  for (const baudRate of baudRates) {
    try {
      await port.open({ ...SERIAL_OPEN_BASE, baudRate })
      return baudRate
    } catch (error) {
      lastError = error
      await closeSerialPortIfOpen(port)
    }
  }

  throw new Error(
    lastError?.message ||
      'Could not open printer port. Check the USB cable and close any other app using the printer.'
  )
}

export async function writeToSerialPort(port, data) {
  const writer = port.writable.getWriter()
  try {
    await writer.write(data instanceof Uint8Array ? data : new Uint8Array(data))
  } finally {
    writer.releaseLock()
  }
}
