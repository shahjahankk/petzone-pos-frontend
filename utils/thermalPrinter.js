/**
 * Unified thermal printer transport: WebUSB (Epson/native USB) + Web Serial (COM/virtual serial).
 * Epson TM-series usually needs WebUSB — they rarely show in the serial port picker.
 */

const SERIAL_STORAGE_KEY = 'thermalSerialPortInfo'
const USB_STORAGE_KEY = 'thermalUsbDeviceInfo'
const USB_VERIFIED_KEY = 'thermalUsbVerified'
const PERMISSION_KEY = 'printerPermissionGranted'
const TRANSPORT_KEY = 'thermalPrinterTransport'
const PRINTER_MODE_KEY = 'posPrinterMode'

const USB_BLOCKED_WINDOWS =
  'USB printer is blocked by the Windows driver. For silent print: download Zadig (zadig.akeo.ie), select Epson TM-T88V, install WinUSB, unplug/replug USB, then click USB again in POS. Until then use System Print (shows a print dialog).'

export const PRINTER_MODE_DIRECT = 'direct'
export const PRINTER_MODE_SYSTEM = 'system'

export const BAUD_RATES = [9600, 19200, 38400, 57600, 115200]

export const SERIAL_OPEN_BASE = {
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
}

/** Seiko Epson Corp — TM-T20, TM-T82, TM-T88, etc. */
export const THERMAL_USB_FILTERS = [
  { vendorId: 0x04b8 }, // Epson
  { vendorId: 0x0519 }, // Star Micronics
  { vendorId: 0x1504 }, // Bixolon
  { vendorId: 0x0fe6 }, // Common generic thermal (e.g. some 80mm)
]

const USB_CHUNK_SIZE = 4096

let cachedTransport = null // 'usb' | 'serial'
let cachedUsbDevice = null
let cachedSerialPort = null
let cachedSerialPortInfo = null

export function isWebSerialSupported() {
  return typeof navigator !== 'undefined' && !!navigator.serial
}

export function isWebUsbSupported() {
  return typeof navigator !== 'undefined' && !!navigator.usb
}

export function isThermalPrintingSupported() {
  return isWebUsbSupported() || isWebSerialSupported()
}

function setUsbVerified(ok) {
  try {
    if (ok) sessionStorage.setItem(USB_VERIFIED_KEY, '1')
    else sessionStorage.removeItem(USB_VERIFIED_KEY)
  } catch (e) {
    /* ignore */
  }
}

function isUsbVerified() {
  try {
    return sessionStorage.getItem(USB_VERIFIED_KEY) === '1'
  } catch (e) {
    return false
  }
}

function clearUsbPersistence() {
  try {
    sessionStorage.removeItem(USB_STORAGE_KEY)
    sessionStorage.removeItem(USB_VERIFIED_KEY)
    if (sessionStorage.getItem(TRANSPORT_KEY) === 'usb') {
      sessionStorage.removeItem(TRANSPORT_KEY)
      sessionStorage.removeItem(PERMISSION_KEY)
    }
  } catch (e) {
    /* ignore */
  }
  if (cachedTransport === 'usb') {
    cachedTransport = null
    cachedUsbDevice = null
  }
}

export function resetCachedPrinter() {
  cachedTransport = null
  cachedUsbDevice = null
  cachedSerialPort = null
  cachedSerialPortInfo = null
  setUsbVerified(false)
}

export const resetCachedSerialPort = resetCachedPrinter

function persistPermission(transport) {
  try {
    sessionStorage.setItem(PERMISSION_KEY, '1')
    if (transport) sessionStorage.setItem(TRANSPORT_KEY, transport)
  } catch (e) {
    /* ignore */
  }
}

function persistUsbInfo(device) {
  if (!device) return
  try {
    sessionStorage.setItem(
      USB_STORAGE_KEY,
      JSON.stringify({ vendorId: device.vendorId, productId: device.productId })
    )
    persistPermission('usb')
  } catch (e) {
    /* ignore */
  }
}

function loadUsbInfo() {
  try {
    const raw = sessionStorage.getItem(USB_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

function persistSerialInfo(info) {
  if (!info) return
  try {
    sessionStorage.setItem(SERIAL_STORAGE_KEY, JSON.stringify(info))
    persistPermission('serial')
  } catch (e) {
    /* ignore */
  }
}

function loadSerialInfo() {
  try {
    const raw = sessionStorage.getItem(SERIAL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

function matchUsbDevice(devices, info) {
  if (!devices?.length) return null
  if (!info) return devices[0]
  return (
    devices.find(
      (d) => d.vendorId === info.vendorId && d.productId === info.productId
    ) || devices[0]
  )
}

function matchSerialPort(ports, info) {
  if (!ports?.length) return null
  if (!info) return ports[0]
  return (
    ports.find((port) => {
      if (typeof port.getInfo !== 'function') return false
      const portInfo = port.getInfo()
      return (
        portInfo &&
        portInfo.usbVendorId === info.usbVendorId &&
        portInfo.usbProductId === info.usbProductId
      )
    }) || ports[0]
  )
}

function cacheSerialPort(port) {
  cachedTransport = 'serial'
  cachedSerialPort = port
  cachedUsbDevice = null
  if (port && typeof port.getInfo === 'function') {
    cachedSerialPortInfo = port.getInfo()
    persistSerialInfo(cachedSerialPortInfo)
  }
  return port
}

function cacheUsbDevice(device, { verified = false } = {}) {
  cachedTransport = 'usb'
  cachedUsbDevice = device
  cachedSerialPort = null
  cachedSerialPortInfo = null
  persistUsbInfo(device)
  if (verified) setUsbVerified(true)
  return device
}

function findBulkOutEndpoint(device) {
  const configuration = device.configuration
  if (!configuration?.interfaces?.length) {
    throw new Error('Printer USB configuration not found')
  }

  for (const iface of configuration.interfaces) {
    for (const alternate of iface.alternates) {
      const outEndpoint = alternate.endpoints.find(
        (endpoint) => endpoint.direction === 'out' && endpoint.type === 'bulk'
      )
      if (outEndpoint) {
        return {
          interfaceNumber: iface.interfaceNumber,
          alternateSetting: alternate.alternateSetting,
          endpointNumber: outEndpoint.endpointNumber,
        }
      }
    }
  }

  throw new Error('Printer USB bulk output endpoint not found')
}

async function openUsbDevice(device) {
  if (!device.opened) {
    await device.open()
  }

  if (device.configuration == null) {
    await device.selectConfiguration(1)
  }

  return findBulkOutEndpoint(device)
}

export async function restoreCachedPrinter() {
  if (cachedTransport === 'usb' && cachedUsbDevice && isUsbVerified()) return cachedUsbDevice
  if (cachedTransport === 'serial' && cachedSerialPort) return cachedSerialPort

  if (isWebSerialSupported()) {
    try {
      const ports = await navigator.serial.getPorts()
      const persisted = cachedSerialPortInfo || loadSerialInfo()
      const port = matchSerialPort(ports, persisted)
      if (port) return cacheSerialPort(port)
    } catch (e) {
      /* ignore */
    }
  }

  // Only restore USB if we previously verified claim (Windows may list device but block it)
  if (isWebUsbSupported() && isUsbVerified()) {
    try {
      const devices = await navigator.usb.getDevices()
      const persisted = loadUsbInfo()
      const device = matchUsbDevice(devices, persisted)
      if (device) return cacheUsbDevice(device, { verified: true })
    } catch (e) {
      /* ignore */
    }
  }

  return null
}

export const restoreCachedSerialPort = restoreCachedPrinter

export async function getGrantedPrinterCount() {
  if (isSystemPrinterMode()) return 1

  let count = 0
  if (isWebUsbSupported()) {
    try {
      const devices = await navigator.usb.getDevices()
      count += devices?.length || 0
    } catch (e) {
      /* ignore */
    }
  }
  if (isWebSerialSupported()) {
    try {
      const ports = await navigator.serial.getPorts()
      count += ports?.length || 0
    } catch (e) {
      /* ignore */
    }
  }
  return count
}

export const getGrantedSerialPortCount = getGrantedPrinterCount

export function getPrinterMode() {
  try {
    return sessionStorage.getItem(PRINTER_MODE_KEY) || PRINTER_MODE_DIRECT
  } catch (e) {
    return PRINTER_MODE_DIRECT
  }
}

export function isSystemPrinterMode() {
  return getPrinterMode() === PRINTER_MODE_SYSTEM
}

export function setPrinterMode(mode) {
  try {
    sessionStorage.setItem(PRINTER_MODE_KEY, mode)
    if (mode === PRINTER_MODE_SYSTEM) {
      persistPermission('system')
    }
  } catch (e) {
    /* ignore */
  }
}

export function getPrinterBlockedHelp() {
  return (
    'Windows USB Print driver is blocking Chrome from the Epson TM-T88V. ' +
    'For silent print: install WinUSB with Zadig (zadig.akeo.ie) on the Epson interface, unplug/replug USB, then click USB again. ' +
    'Until then use System Print (Chrome will show a print dialog). Serial/COM stays empty for this printer — that is normal.'
  )
}

/** Use when direct USB is blocked — prints via Mac/Windows print dialog. */
export function connectSystemPrinter() {
  resetCachedPrinter()
  setPrinterMode(PRINTER_MODE_SYSTEM)
  persistPermission('system')
  return {
    transport: 'system',
    message:
      'System printer mode enabled. Chrome will show a print dialog (cannot be silent). Prefer USB or Serial/COM for silent thermal printing.',
  }
}

export function getActivePrinterTransport() {
  if (isSystemPrinterMode()) return 'system'
  return cachedTransport
}

async function requestUsbPrinter() {
  if (!isWebUsbSupported()) {
    throw new Error('WebUSB is not supported in this browser. Use Chrome or Edge on desktop.')
  }

  setPrinterMode(PRINTER_MODE_DIRECT)

  let device
  try {
    // Single dialog — list every USB device Chrome can access.
    device = await navigator.usb.requestDevice({ filters: [] })
  } catch (error) {
    if (error?.name === 'NotFoundError') {
      const blocked = new Error(getPrinterBlockedHelp())
      blocked.name = 'PrinterBlockedError'
      blocked.cause = error
      throw blocked
    }
    throw error
  }

  if (!device) {
    const blocked = new Error(getPrinterBlockedHelp())
    blocked.name = 'PrinterBlockedError'
    throw blocked
  }

  try {
    // Claim + short transfer — open-only can succeed while Windows still blocks printing
    const endpointInfo = await openUsbDevice(device)
    await device.claimInterface(endpointInfo.interfaceNumber)
    try {
      const test = new Uint8Array([0x1b, 0x40]) // ESC @
      const result = await device.transferOut(endpointInfo.endpointNumber, test)
      if (result.status !== 'ok') {
        throw new Error(`USB transfer failed: ${result.status}`)
      }
    } finally {
      try {
        await device.releaseInterface(endpointInfo.interfaceNumber)
      } catch (e) {
        /* ignore */
      }
      try {
        if (device.opened) await device.close()
      } catch (e) {
        /* ignore */
      }
    }
  } catch (error) {
    try {
      if (device.opened) await device.close()
    } catch (e) {
      /* ignore */
    }
    clearUsbPersistence()
    try {
      if (typeof device.forget === 'function') await device.forget()
    } catch (e) {
      /* ignore */
    }

    if (
      error?.name === 'SecurityError' ||
      error?.name === 'NetworkError' ||
      /access|denied|claim|transfer|protected/i.test(error?.message || '')
    ) {
      const blocked = new Error(USB_BLOCKED_WINDOWS)
      blocked.name = 'PrinterBlockedError'
      blocked.cause = error
      throw blocked
    }
    throw error
  }

  return cacheUsbDevice(device, { verified: true })
}

async function requestSerialPrinter() {
  if (!isWebSerialSupported()) {
    throw new Error('Web Serial is not supported in this browser.')
  }

  setPrinterMode(PRINTER_MODE_DIRECT)

  // Show ALL serial/COM ports first (unfiltered) so Windows virtual COM
  // and USB-serial adapters appear. Fall back to thermal-vendor filters only
  // if the user cancels an empty list (rare).
  let port
  try {
    port = await navigator.serial.requestPort()
  } catch (error) {
    if (error?.name === 'NotFoundError') {
      try {
        port = await navigator.serial.requestPort({
          filters: THERMAL_USB_FILTERS.map((f) => ({
            usbVendorId: f.vendorId,
          })),
        })
      } catch (e2) {
        throw new Error(
          'No Serial/COM port found. On Windows Epson often only appears under USB (not Serial). Use Connect USB, or install a USB-Serial driver if your printer uses a COM port.'
        )
      }
    } else if (error?.name === 'NotAllowedError') {
      throw new Error('Serial permission denied. Click Serial/COM again and allow access.')
    } else {
      throw error
    }
  }

  if (!port) throw new Error('No serial printer port selected')
  return cacheSerialPort(port)
}

/**
 * Connect via WebUSB (direct Epson/Star/Bixolon USB).
 * Must be called from a user click.
 */
export async function connectUsbPrinter() {
  resetCachedPrinter()
  setPrinterMode(PRINTER_MODE_DIRECT)
  const device = await requestUsbPrinter()
  return { transport: 'usb', device }
}

/**
 * Connect via Web Serial (COM port / virtual serial / USB-serial adapters).
 * Must be called from a user click.
 */
export async function connectSerialPrinter() {
  resetCachedPrinter()
  setPrinterMode(PRINTER_MODE_DIRECT)
  const port = await requestSerialPrinter()
  return { transport: 'serial', port }
}

/**
 * Connect printer — tries WebUSB first (Epson), then Web Serial.
 * Must be called from a user click.
 */
export async function connectThermalPrinter() {
  resetCachedPrinter()
  setPrinterMode(PRINTER_MODE_DIRECT)

  const errors = []

  if (isWebUsbSupported()) {
    try {
      return await connectUsbPrinter()
    } catch (error) {
      if (error?.name === 'NotFoundError' || error?.name === 'PrinterBlockedError') {
        // USB picker cancelled / blocked — still allow serial attempt below unless user cancelled
        if (error?.name === 'PrinterBlockedError') {
          errors.push(error.message)
        } else {
          errors.push('No USB printer selected.')
        }
      } else if (error?.name === 'NotAllowedError') {
        errors.push('USB permission denied.')
      } else {
        errors.push(error?.message || 'USB connection failed.')
      }
    }
  } else {
    errors.push('WebUSB not available in this browser.')
  }

  if (isWebSerialSupported()) {
    try {
      return await connectSerialPrinter()
    } catch (error) {
      if (error?.name === 'NotFoundError') {
        errors.push('No serial/COM port found.')
      } else if (error?.name === 'NotAllowedError') {
        errors.push('Serial permission denied.')
      } else {
        throw error
      }
    }
  } else {
    errors.push('Web Serial not available in this browser.')
  }

  const blocked = new Error(`${errors.join(' ')} ${getPrinterBlockedHelp()}`)
  blocked.name = 'PrinterBlockedError'
  throw blocked
}

export async function acquirePrinter(options = {}) {
  const { allowRequest = true } = options

  if (!isThermalPrintingSupported()) {
    throw new Error('Thermal printing is not supported. Use Chrome or Edge on a desktop/laptop (not Safari, not iPhone/iPad).')
  }

  const restored = await restoreCachedPrinter()
  if (restored) return restored

  if (!allowRequest) {
    throw new Error(
      'Printer not connected. Click "Connect Printer" at the top of POS, select your Epson USB device, then try again.'
    )
  }

  const result = await connectThermalPrinter()
  return result.device || result.port
}

export const acquireSerialPort = acquirePrinter

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

  // Prefer last successful baud if stored
  let preferred = []
  try {
    const raw = sessionStorage.getItem('thermalSerialBaud')
    if (raw) preferred = [parseInt(raw, 10)].filter((n) => Number.isFinite(n))
  } catch (e) {
    /* ignore */
  }
  const rates = [...new Set([...preferred, ...baudRates])]

  let lastError
  for (const baudRate of rates) {
    try {
      await port.open({ ...SERIAL_OPEN_BASE, baudRate })
      try {
        sessionStorage.setItem('thermalSerialBaud', String(baudRate))
      } catch (e) {
        /* ignore */
      }
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

async function writeToUsbDevice(device, data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const endpointInfo = await openUsbDevice(device)

  try {
    await device.claimInterface(endpointInfo.interfaceNumber)
    if (endpointInfo.alternateSetting != null) {
      try {
        await device.selectAlternateInterface(
          endpointInfo.interfaceNumber,
          endpointInfo.alternateSetting
        )
      } catch (e) {
        /* some devices ignore alternate selection */
      }
    }

    for (let offset = 0; offset < bytes.length; offset += USB_CHUNK_SIZE) {
      const chunk = bytes.slice(offset, offset + USB_CHUNK_SIZE)
      const result = await device.transferOut(endpointInfo.endpointNumber, chunk)
      if (result.status !== 'ok') {
        throw new Error(`USB print transfer failed: ${result.status}`)
      }
    }
  } finally {
    try {
      await device.releaseInterface(endpointInfo.interfaceNumber)
    } catch (e) {
      /* ignore */
    }
    try {
      if (device.opened) await device.close()
    } catch (e) {
      /* ignore */
    }
  }
}

/** Send raw ESC/POS bytes using whichever transport is connected. */
export async function writeToThermalPrinter(data) {
  // If a USB/serial device is paired, always prefer silent direct print
  // even if the user previously chose system-print mode.
  const restored = await restoreCachedPrinter()
  if (!restored) {
    if (isSystemPrinterMode()) {
      throw new Error('System printer mode — use browser print instead of direct USB.')
    }
    throw new Error(
      'Printer not connected. Click "Connect USB" or "Serial/COM" and select your Epson, then try again.'
    )
  }

  // Switch back to direct mode so confirm-sale stays silent
  setPrinterMode(PRINTER_MODE_DIRECT)

  if (cachedTransport === 'usb' && cachedUsbDevice) {
    await writeToUsbDevice(cachedUsbDevice, data)
    return
  }

  if (cachedTransport === 'serial' && cachedSerialPort) {
    const port = cachedSerialPort
    await openSerialPort(port)
    try {
      await writeToSerialPort(port, data)
    } finally {
      await closeSerialPortIfOpen(port)
    }
    return
  }

  throw new Error(
    'Printer not connected. Click "Connect USB" or "Serial/COM" and select your Epson from the list.'
  )
}

/** True when a WebUSB or Web Serial printer is already paired in this browser. */
export async function hasDirectPrinterPaired() {
  if (!isThermalPrintingSupported()) return false

  // USB device may appear in getDevices() even when Windows blocks claim — require verified claim
  if (cachedTransport === 'serial' && cachedSerialPort) return true
  if (cachedTransport === 'usb' && cachedUsbDevice && isUsbVerified()) return true

  if (isWebSerialSupported()) {
    try {
      const ports = await navigator.serial.getPorts()
      const persisted = cachedSerialPortInfo || loadSerialInfo()
      const port = matchSerialPort(ports, persisted)
      if (port) {
        cacheSerialPort(port)
        return true
      }
    } catch (e) {
      /* ignore */
    }
  }

  if (isWebUsbSupported() && isUsbVerified()) {
    try {
      const devices = await navigator.usb.getDevices()
      const persisted = loadUsbInfo()
      const device = matchUsbDevice(devices, persisted)
      if (device) {
        cacheUsbDevice(device, { verified: true })
        return true
      }
    } catch (e) {
      /* ignore */
    }
  }

  // getGrantedPrinterCount returns 1 for system mode — only count real serial (USB needs verified)
  if (isSystemPrinterMode()) {
    let real = 0
    if (isWebSerialSupported()) {
      try {
        real += (await navigator.serial.getPorts())?.length || 0
      } catch (e) {
        /* ignore */
      }
    }
    if (isWebUsbSupported() && isUsbVerified()) {
      try {
        real += (await navigator.usb.getDevices())?.length || 0
      } catch (e) {
        /* ignore */
      }
    }
    return real > 0
  }

  return false
}

export async function testPrinterConnection() {
  const restored = await restoreCachedPrinter()
  if (!restored) {
    throw new Error('No printer paired yet')
  }

  if (cachedTransport === 'usb' && cachedUsbDevice) {
    const endpointInfo = await openUsbDevice(cachedUsbDevice)
    await deviceClaimRelease(cachedUsbDevice, endpointInfo.interfaceNumber)
    return { transport: 'usb', message: 'Epson USB printer connected' }
  }

  if (cachedTransport === 'serial' && cachedSerialPort) {
    await openSerialPort(cachedSerialPort)
    await closeSerialPortIfOpen(cachedSerialPort)
    return { transport: 'serial', message: 'Serial printer port connected' }
  }

  throw new Error('Printer connection could not be verified')
}

async function deviceClaimRelease(device, interfaceNumber) {
  try {
    await device.claimInterface(interfaceNumber)
  } finally {
    try {
      await device.releaseInterface(interfaceNumber)
    } catch (e) {
      /* ignore */
    }
    try {
      if (device.opened) await device.close()
    } catch (e) {
      /* ignore */
    }
  }
}

export function getPrinterSupportMessage() {
  if (isSystemPrinterMode()) {
    return 'System printer mode — Chrome will show a Windows print dialog (choose Epson). Not silent.'
  }
  if (!isThermalPrintingSupported()) {
    return 'Use Chrome or Edge on Windows. Mobile browsers cannot connect USB thermal printers.'
  }
  return 'USB = silent Epson print (needs WinUSB/Zadig). Serial/COM = usually empty for TM-T88V. System Print = Windows dialog.'
}
