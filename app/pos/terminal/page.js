'use client'
import { formatDisplayDate } from '../../../utils/displayDates'
import AppDateField from '../../../components/date/AppDateField'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import api from '../../../utils/axios'
import { useRouter } from 'next/navigation'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  useTheme,
  alpha,
  Tabs,
  Tab,
  Badge,
  Tooltip,
  Fade,
  Slide,
  MenuItem,
  Checkbox,
  FormControl,
  FormGroup,
  FormControlLabel,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material'
import {
  QrCodeScanner as ScannerIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Search as SearchIcon,
  Keyboard as KeyboardIcon,
  Close as CloseIcon,
  AddBox as NewTabIcon,
  Tab as TabIcon,
  ShoppingCart as CartIcon,
  Print as PrintIcon,
  Settings as SettingsIcon,
  FilterList as FilterIcon,
  Category as CategoryIcon,
  LocalOffer as OfferIcon,
  TrendingUp as TrendingIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  AccountBalance as OutstandingIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  Inventory as InventoryIcon,
  OpenInNew as OpenInNewIcon,
  MedicalServices as ClinicIcon
} from '@mui/icons-material'
import PrintDialog from '../../../components/print/PrintDialog'
import RouteGuard from '../../../components/auth/RouteGuard'
import PhysicalScanner from '../../../components/pos/PhysicalScanner'
import { fetchInventory } from '../../store/slices/inventorySlice'
import { createSale, fetchSales } from '../../store/slices/salesSlice'
import {
  acquirePrinter,
  connectSystemPrinter,
  connectThermalPrinter,
  connectUsbPrinter,
  connectSerialPrinter,
  getGrantedPrinterCount,
  getActivePrinterTransport,
  getPrinterBlockedHelp,
  getPrinterSupportMessage,
  hasDirectPrinterPaired,
  isSystemPrinterMode,
  isThermalPrintingSupported,
  isWebUsbSupported,
  isWebSerialSupported,
  resetCachedPrinter,
  restoreCachedPrinter,
  setPrinterMode,
  PRINTER_MODE_DIRECT,
  testPrinterConnection,
  writeToThermalPrinter,
} from '../../../utils/thermalPrinter'
import { buildReceiptEscPos } from '../../../utils/receiptEscPos'
import { getPrintLogoSizes } from '../../../utils/brandAssets'

const generateTabId = () => `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
const generateTabName = (tabNumber) => `Sale ${tabNumber}`

const DEFAULT_COMPANY_INFO = {
  name: 'PetZone',
  address: 'Shop no 42 unit no 2 latifabad near musarrat banquet Hyderabad',
  phone: '03111100355',
  email: 'info@petzone.com',
  logoUrl: '/petzonelogo.png'
}

const createEmptyTabState = (overrides = {}) => ({
  cart: [],
  customerName: '',
  customerPhone: '',
  paymentMethod: 'CASH',
  paymentAmount: '',
  creditAmount: '',
  isPartialPayment: false,
  isFullyCredit: false,
  isBalancePayment: false,
  outstandingPayments: [],
  selectedOutstandingPayments: [],
  settlementPaymentAmount: '',
  settlementCreditAmount: '',
  isSettlementPartial: false,
  isSettlementFullyCredit: false,
  showSettlementOptions: false,
  taxRate: 0,
  totalDiscount: 0,
  notes: '',
  saleDate: '',
  ...overrides
})

/** Effective unit price shown/edited in the cart Price column. */
const getCartLineUnitPrice = (item) => {
  const raw =
    item?.customPrice !== null && item?.customPrice !== undefined
      ? item.customPrice
      : item?.price
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

/** Price must be > 0; free lines use Disc (or cart discount), not a zero price. */
const getZeroPriceCartItems = (cart) =>
  (cart || []).filter((item) => getCartLineUnitPrice(item) <= 0)

/** Map cart row → sale API line (inventory or clinic service). */
const mapCartLineForSale = (item) => {
  const unitPrice = getCartLineUnitPrice(item)
  const qty = parseFloat(item.quantity)
  const discount = parseFloat(item.discount || 0)

  const clinicFromFlag = item.isService || item.is_service
  const clinicIdRaw =
    item.clinicServiceId ||
    item.clinic_service_id ||
    (typeof item.id === 'string' && String(item.id).startsWith('service-')
      ? String(item.id).replace(/^service-/i, '')
      : null) ||
    (item.sku && /^CLINIC-(\d+)$/i.test(String(item.sku))
      ? String(item.sku).match(/^CLINIC-(\d+)$/i)[1]
      : null)
  const clinicServiceId = clinicFromFlag || clinicIdRaw
    ? parseInt(clinicIdRaw, 10)
    : null
  const isClinic = Boolean(clinicFromFlag || (clinicServiceId && clinicServiceId > 0))

  if (isClinic) {
    const id = Number.isFinite(clinicServiceId) && clinicServiceId > 0 ? clinicServiceId : null
    return {
      inventoryItemId: null,
      clinicServiceId: id,
      isService: true,
      sku: item.sku || (id ? `CLINIC-${id}` : 'CLINIC'),
      name: item.name,
      quantity: qty,
      unitPrice,
      originalPrice: parseFloat(item.price ?? item.defaultPrice ?? unitPrice),
      discount,
      total: unitPrice * qty - discount,
    }
  }

  const inventoryItemId = parseInt(item.inventoryItemId ?? item.id, 10)
  return {
    inventoryItemId: Number.isFinite(inventoryItemId) && inventoryItemId > 0 ? inventoryItemId : null,
    clinicServiceId: null,
    isService: false,
    name: item.name,
    quantity: qty,
    unitPrice,
    originalPrice: parseFloat(item.price || unitPrice),
    discount,
    total: unitPrice * qty - discount,
  }
}

function POSTerminal() {
  const theme = useTheme()
  const dispatch = useDispatch()
  const router = useRouter()

  const { user: originalUser } = useSelector((state) => state.auth)

  const [urlParams, setUrlParams] = useState({})
  const [isAdminMode, setIsAdminMode] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const role = params.get('role')
      const scope = params.get('scope')
      const id = params.get('id')

      if (role && scope && id && originalUser?.role === 'ADMIN') {
        setUrlParams({ role, scope, id })
        setIsAdminMode(true)
      } else {
        setUrlParams({})
        setIsAdminMode(false)
      }
    }
  }, [originalUser])

  const getEffectiveUser = useCallback((originalUser) => {
    if (!isAdminMode || !urlParams.role) return originalUser
    return {
      ...originalUser,
      role: urlParams.role.toUpperCase(),
      branchId: urlParams.scope === 'branch' ? parseInt(urlParams.id) : null,
      warehouseId: urlParams.scope === 'warehouse' ? parseInt(urlParams.id) : null,
      branchName: urlParams.scope === 'branch' ? `Branch ${urlParams.id}` : null,
      warehouseName: urlParams.scope === 'warehouse' ? `Warehouse ${urlParams.id}` : null,
      isAdminMode: true,
      originalRole: originalUser.role,
      originalUser: originalUser
    }
  }, [isAdminMode, urlParams])

  const getScopeInfo = useCallback(() => {
    if (!isAdminMode || !urlParams.role) return null
    return {
      scopeType: urlParams.scope === 'branch' ? 'BRANCH' : 'WAREHOUSE',
      scopeId: urlParams.id,
      scopeName: urlParams.scope === 'branch' ? `Branch ${urlParams.id}` : `Warehouse ${urlParams.id}`
    }
  }, [isAdminMode, urlParams])

  const user = useMemo(() => getEffectiveUser(originalUser), [getEffectiveUser, originalUser])
  const scopeInfo = useMemo(() => getScopeInfo(), [getScopeInfo])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const permissionFlag = (() => {
      try { return sessionStorage.getItem('printerPermissionGranted') } catch (e) { return null }
    })()

    if (user && permissionFlag === '1' && isThermalPrintingSupported()) {
      restoreCachedPrinter().catch(() => {})
    }

    if (!user) {
      resetCachedPrinter()
      try { sessionStorage.removeItem('printerPermissionGranted') } catch (e) { /* ignore */ }
    }
  }, [user])

  const { data: inventoryItems, loading: inventoryLoading, error: inventoryError } = useSelector((state) => state.inventory)

  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' })
  const showToast = useCallback((message, severity = 'info') => {
    setToast({ open: true, message, severity })
  }, [])
  const handleToastClose = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }))
  }, [])

  const [tabs, setTabs] = useState([])
  const [activeTabId, setActiveTabId] = useState(null)
  const [tabCounter, setTabCounter] = useState(1)

  const [barcodeInput, setBarcodeInput] = useState('')
  const [manualInput, setManualInput] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [creditAmount, setCreditAmount] = useState('')
  const [isPartialPayment, setIsPartialPayment] = useState(false)
  const [isFullyCredit, setIsFullyCredit] = useState(false)
  const [isBalancePayment, setIsBalancePayment] = useState(false)
  const [selectedSalesperson, setSelectedSalesperson] = useState(null)
  const [salespeople, setSalespeople] = useState([])
  const [customerSearchResults, setCustomerSearchResults] = useState([])
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)
  const [customerHighlightedIndex, setCustomerHighlightedIndex] = useState(-1)
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showPhysicalScanner, setShowPhysicalScanner] = useState(false)
  const [taxRate, setTaxRate] = useState(0)
  const [totalDiscount, setTotalDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [saleDate, setSaleDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHighlightedIndex, setSearchHighlightedIndex] = useState(-1)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [clinicServices, setClinicServices] = useState([])
  const [clinicCategories, setClinicCategories] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [showPrinterDialog, setShowPrinterDialog] = useState(false)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [isProcessingSale, setIsProcessingSale] = useState(false)
  const [isProcessingSaleOnly, setIsProcessingSaleOnly] = useState(false)
  const [printData, setPrintData] = useState(null)
  const [saleConfirmDialog, setSaleConfirmDialog] = useState(false)
  const [pendingSaleData, setPendingSaleData] = useState(null)
  const [selectedLayout, setSelectedLayout] = useState('thermal')
  const [availablePrinters, setAvailablePrinters] = useState([])
  const [scannerStatus, setScannerStatus] = useState({
    connected: false,
    lastScan: null,
    scanCount: 0,
    errors: []
  })
  const [printerStatus, setPrinterStatus] = useState({
    connected: false,
    supported: false,
    portCount: 0,
    message: 'Checking printer...',
    connecting: false,
    mode: 'direct',
    transport: null,
  })
  const [showPrinterHelpDialog, setShowPrinterHelpDialog] = useState(false)
  const [printerHelpMessage, setPrinterHelpMessage] = useState('')
  const [outstandingPayments, setOutstandingPayments] = useState([])
  const [selectedOutstandingPayments, setSelectedOutstandingPayments] = useState([])
  const [isSearchingOutstanding, setIsSearchingOutstanding] = useState(false)
  const [settlementPaymentAmount, setSettlementPaymentAmount] = useState('')
  const [settlementCreditAmount, setSettlementCreditAmount] = useState('')
  const [isSettlementPartial, setIsSettlementPartial] = useState(false)
  const [isSettlementFullyCredit, setIsSettlementFullyCredit] = useState(false)
  const [showSettlementOptions, setShowSettlementOptions] = useState(false)
  const [companyInfo, setCompanyInfo] = useState(() => ({ ...DEFAULT_COMPANY_INFO }))

  const barcodeInputRef = useRef(null)
  const manualInputRef = useRef(null)
  const searchDropdownRef = useRef(null)
  const customerDropdownRef = useRef(null)
  const customerSearchTimerRef = useRef(null)
  const lastScanTimeRef = useRef(0)
  const hydratingTabIdRef = useRef(null)
  const isCompletingSaleRef = useRef(false)
  const makeSaleIdempotencyKey = () =>
    typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`

  const currentTab = useMemo(() => {
    return tabs.find(tab => tab.id === activeTabId) || null
  }, [tabs, activeTabId])

  const currentCart = useMemo(() => {
    return currentTab?.cart || []
  }, [currentTab])

  const updateCurrentTab = useCallback((updates) => {
    setTabs(prev => prev.map(tab =>
      tab.id === activeTabId
        ? { ...tab, ...updates, modifiedAt: new Date() }
        : tab
    ))
  }, [activeTabId])

  useEffect(() => {
    if (!currentTab) return

    if (hydratingTabIdRef.current === currentTab.id) {
      hydratingTabIdRef.current = null
      return
    }

    const updates = {
      customerName,
      customerPhone,
      paymentMethod,
      paymentAmount,
      creditAmount,
      isPartialPayment,
      isFullyCredit,
      isBalancePayment,
      outstandingPayments,
      selectedOutstandingPayments,
      settlementPaymentAmount,
      settlementCreditAmount,
      isSettlementPartial,
      isSettlementFullyCredit,
      showSettlementOptions,
      taxRate,
      totalDiscount,
      notes,
      saleDate
    }

    const hasChanges = Object.entries(updates).some(([key, value]) => {
      const currentValue = currentTab[key]
      if (Array.isArray(value) && Array.isArray(currentValue)) {
        if (currentValue === value) return false
        if (currentValue.length !== value.length) return true
        for (let i = 0; i < value.length; i += 1) {
          if (currentValue[i] !== value[i]) return true
        }
        return false
      }
      return currentValue !== value
    })

    if (hasChanges) updateCurrentTab(updates)
  }, [
    currentTab,
    customerName, customerPhone, paymentMethod, paymentAmount, creditAmount,
    isPartialPayment, isFullyCredit, isBalancePayment,
    outstandingPayments, selectedOutstandingPayments,
    settlementPaymentAmount, settlementCreditAmount,
    isSettlementPartial, isSettlementFullyCredit, showSettlementOptions,
    taxRate, totalDiscount, notes, saleDate, updateCurrentTab
  ])

  const refreshPrinterStatus = useCallback(async () => {
    if (!isThermalPrintingSupported() && !isSystemPrinterMode()) {
      setPrinterStatus({
        connected: false,
        supported: false,
        portCount: 0,
        message: getPrinterSupportMessage(),
        connecting: false,
        mode: 'direct',
        transport: null,
      })
      return
    }

    try {
      const directPaired = await hasDirectPrinterPaired()
      if (directPaired) {
        await restoreCachedPrinter()
        const transport = getActivePrinterTransport()
        setPrinterStatus({
          connected: true,
          supported: true,
          portCount: 1,
          message: transport === 'serial'
            ? 'Serial/COM thermal printer connected — silent print on sale'
            : 'USB thermal printer connected — silent print on sale',
          connecting: false,
          mode: 'direct',
          transport,
        })
        return
      }

      if (isSystemPrinterMode()) {
        setPrinterStatus({
          connected: true,
          supported: true,
          portCount: 1,
          message: 'System printer mode — OS print dialog will open on sale',
          connecting: false,
          mode: 'system',
          transport: 'system',
        })
        return
      }

      setPrinterStatus({
        connected: false,
        supported: isThermalPrintingSupported(),
        portCount: 0,
        message: getPrinterSupportMessage(),
        connecting: false,
        mode: 'direct',
        transport: null,
      })
    } catch (error) {
      setPrinterStatus({
        connected: false,
        supported: true,
        portCount: 0,
        message: error?.message || 'Could not detect printer',
        connecting: false,
        mode: 'direct',
        transport: null,
      })
    }
  }, [])

  const handleUseSystemPrinter = useCallback(async () => {
    const result = connectSystemPrinter()
    await refreshPrinterStatus()
    showToast(
      'System Print mode: Chrome will show a print dialog. For silent print (no dialog), use USB or Serial/COM instead.',
      'info'
    )
  }, [refreshPrinterStatus, showToast])

  const handleConnectUsb = useCallback(async () => {
    if (!isWebUsbSupported()) {
      showToast('WebUSB not supported. Use Chrome/Edge, or try Serial/COM.', 'warning')
      return
    }
    setPrinterStatus((prev) => ({ ...prev, connecting: true }))
    try {
      await connectUsbPrinter()
      await testPrinterConnection().catch(() => null)
      await refreshPrinterStatus()
      showToast('USB thermal connected — sales will print silently', 'success')
    } catch (error) {
      if (error?.name === 'NotFoundError' || error?.name === 'PrinterBlockedError') {
        setPrinterHelpMessage(error.message || getPrinterBlockedHelp())
        setShowPrinterHelpDialog(true)
      }
      showToast(
        error?.message ||
          'USB blocked by Windows. Use Zadig (WinUSB) for silent print, or System Print (dialog).',
        'warning'
      )
      await refreshPrinterStatus()
    }
  }, [refreshPrinterStatus, showToast])

  const handleConnectSerial = useCallback(async () => {
    if (!isWebSerialSupported()) {
      showToast('Web Serial not supported. Use Chrome/Edge on desktop.', 'warning')
      return
    }
    setPrinterStatus((prev) => ({ ...prev, connecting: true }))
    try {
      await connectSerialPrinter()
      await testPrinterConnection().catch(() => null)
      await refreshPrinterStatus()
      showToast('Serial/COM thermal connected — sales will print silently', 'success')
    } catch (error) {
      showToast(error?.message || 'Serial/COM connect failed', 'warning')
      await refreshPrinterStatus()
    }
  }, [refreshPrinterStatus, showToast])

  const handleConnectPrinter = useCallback(async () => {
    if (!isThermalPrintingSupported()) {
      showToast(getPrinterSupportMessage(), 'warning')
      return
    }

    setPrinterStatus((prev) => ({ ...prev, connecting: true }))
    try {
      await connectThermalPrinter()
      const testResult = await testPrinterConnection()
      await refreshPrinterStatus()
      showToast(testResult?.message || 'Printer connected — sales will print silently', 'success')
    } catch (error) {
      if (error?.name === 'NotFoundError') {
        setPrinterHelpMessage(getPrinterBlockedHelp())
        setShowPrinterHelpDialog(true)
        showToast('Epson not found — try Serial/COM or see help', 'warning')
      } else if (error?.name === 'PrinterBlockedError') {
        setPrinterHelpMessage(error.message || getPrinterBlockedHelp())
        setShowPrinterHelpDialog(true)
        showToast('USB blocked — try Serial/COM instead', 'warning')
      } else {
        showToast(error?.message || 'Failed to connect printer', 'error')
      }
      await refreshPrinterStatus()
    }
  }, [refreshPrinterStatus, showToast])

  const addToCart = useCallback((product) => {
    const cartId = product.isService ? `service-${product.clinicServiceId || product.id}` : product.id
    const existingItem = currentCart.find(item => item.id === cartId)
    const listPrice = parseFloat(product.price ?? product.sellingPrice ?? product.defaultPrice ?? 0)
    let newCart
    if (existingItem) {
      newCart = currentCart.map(item =>
        item.id === cartId
          ? { ...item, quantity: existingItem.quantity + 1 }
          : item
      )
    } else {
      newCart = [...currentCart, {
        ...product,
        id: cartId,
        quantity: 1,
        discount: 0,
        price: listPrice,
        customPrice: listPrice,
        isService: !!product.isService,
      }]
    }
    updateCurrentTab({ cart: newCart })
  }, [currentCart, updateCurrentTab])

  const selectSearchResult = useCallback((product) => {
    addToCart(product)
    setShowSearchResults(false)
    setManualInput('')
    setSearchQuery('')
    setSearchHighlightedIndex(-1)
  }, [addToCart])

  const handleBarcodeScan = useCallback((barcode) => {
    const product = inventoryItems.find(p => {
      const skuMatch = p.sku && p.sku.toString().toLowerCase() === barcode.toLowerCase()
      const barcodeMatch = p.barcode && p.barcode.toString().toLowerCase() === barcode.toLowerCase()
      const nameMatch = p.name && p.name.toLowerCase().includes(barcode.toLowerCase())
      return skuMatch || barcodeMatch || nameMatch
    })

    if (product) {
      const cartProduct = {
        id: product.id,
        name: product.name,
        price: product.sellingPrice,
        stock: product.currentStock,
        category: product.category,
        sku: product.sku,
        barcode: product.barcode,
        unit: product.unit
      }
      addToCart(cartProduct)
      setBarcodeInput('')
      setShowSearchResults(false)
    } else {
      const matches = inventoryItems.filter(p => {
        const skuMatch = p.sku && p.sku.toString().toLowerCase().includes(barcode.toLowerCase())
        const barcodeMatch = p.barcode && p.barcode.toString().toLowerCase().includes(barcode.toLowerCase())
        const nameMatch = p.name && p.name.toLowerCase().includes(barcode.toLowerCase())
        return skuMatch || barcodeMatch || nameMatch
      }).map(item => ({
        id: item.id,
        name: item.name,
        price: item.sellingPrice,
        stock: item.currentStock,
        category: item.category,
        sku: item.sku,
        barcode: item.barcode,
        unit: item.unit
      }))
      setSearchResults(matches)
      setShowSearchResults(true)
    }
  }, [inventoryItems, addToCart])

  useEffect(() => {
    const handlePhysicalScanner = (event) => {
      const now = Date.now()
      const timeDiff = now - (lastScanTimeRef.current || 0)

      setScannerStatus(prev => ({ ...prev, connected: true, lastScan: now }))

      if (timeDiff < 50 && event.key !== 'Enter') {
        lastScanTimeRef.current = now
        return
      }

      if (event.key === 'Enter' && barcodeInput.trim().length > 0) {
        event.preventDefault()
        setScannerStatus(prev => ({ ...prev, scanCount: prev.scanCount + 1, lastScan: now }))
        handleBarcodeScan(barcodeInput.trim())
        setBarcodeInput('')
      }
    }

    document.addEventListener('keydown', handlePhysicalScanner)
    return () => document.removeEventListener('keydown', handlePhysicalScanner)
  }, [barcodeInput, handleBarcodeScan])

  const createNewTab = useCallback(() => {
    const newTab = {
      id: generateTabId(),
      name: generateTabName(tabCounter),
      createdAt: new Date(),
      modifiedAt: new Date(),
      ...createEmptyTabState()
    }

    hydratingTabIdRef.current = newTab.id
    setTabs(prev => [...prev, newTab])
    setActiveTabId(newTab.id)
    setTabCounter(prev => prev + 1)

    setCustomerName(newTab.customerName)
    setCustomerPhone(newTab.customerPhone)
    setPaymentMethod(newTab.paymentMethod)
    setPaymentAmount(newTab.paymentAmount)
    setCreditAmount(newTab.creditAmount)
    setIsPartialPayment(newTab.isPartialPayment)
    setIsFullyCredit(newTab.isFullyCredit)
    setIsBalancePayment(newTab.isBalancePayment)
    setOutstandingPayments(newTab.outstandingPayments)
    setSelectedOutstandingPayments(newTab.selectedOutstandingPayments)
    setSettlementPaymentAmount(newTab.settlementPaymentAmount)
    setSettlementCreditAmount(newTab.settlementCreditAmount)
    setIsSettlementPartial(newTab.isSettlementPartial)
    setIsSettlementFullyCredit(newTab.isSettlementFullyCredit)
    setShowSettlementOptions(newTab.showSettlementOptions)
    setTaxRate(newTab.taxRate)
    setTotalDiscount(newTab.totalDiscount)
    setNotes(newTab.notes)
    setSaleDate(newTab.saleDate || '')
  }, [tabCounter])

  const loadAvailablePrinters = useCallback(async () => {
    const defaultPrinters = [
      { id: 'default', name: 'Default Printer', type: 'default' },
      { id: 'thermal-80mm', name: 'Thermal 80mm', type: 'thermal' },
      { id: 'thermal-58mm', name: 'Thermal 58mm', type: 'thermal' },
      { id: 'browser-print', name: 'Browser Print Dialog', type: 'browser' },
    ]

    try {
      const detected = []
      if (isThermalPrintingSupported()) {
        try {
          const usbDevices = await navigator.usb?.getDevices?.() || []
          usbDevices.forEach((device) => {
            detected.push({
              id: `usb-${device.vendorId}-${device.productId}`,
              name: `USB Thermal (Epson/vendor ${device.vendorId})`,
              type: 'thermal',
              transport: 'usb',
              device,
            })
          })
        } catch (e) {
          /* ignore */
        }
        try {
          const ports = await navigator.serial?.getPorts?.() || []
          ports.forEach((port) => {
            const info = port.getInfo?.() || {}
            detected.push({
              id: `${info.usbVendorId || 'unknown'}-${info.usbProductId || 'unknown'}`,
              name: `Serial Thermal (${info.usbVendorId ? `Vendor ${info.usbVendorId}` : 'COM'})`,
              type: 'thermal',
              transport: 'serial',
              port,
              info,
            })
          })
        } catch (e) {
          /* ignore */
        }
      }
      setAvailablePrinters([...detected, ...defaultPrinters])
      return
    } catch (error) {
      /* fall through to defaults */
    }

    setAvailablePrinters(defaultPrinters)
  }, [])

  useEffect(() => {
    if (tabs.length === 0) createNewTab()
  }, [tabs.length, createNewTab])

  useEffect(() => {
    if (user) {
      const params = { limit: 'all' }
      if (user.role === 'CASHIER') {
        params.scopeType = 'BRANCH'
        if (user.branchId) params.scopeId = user.branchId
      } else if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId) {
        params.scopeType = 'WAREHOUSE'
        params.scopeId = user.warehouseId
      }
      dispatch(fetchInventory(params))
    }
    dispatch(fetchSales())
    loadAvailablePrinters()
    refreshPrinterStatus()
    api.get('/clinic-services/billing')
      .then((res) => {
        const data = res.data?.data || {}
        setClinicServices(data.services || [])
        setClinicCategories(data.categories || [])
      })
      .catch(() => {
        setClinicServices([])
        setClinicCategories([])
      })
  }, [dispatch, user, loadAvailablePrinters, refreshPrinterStatus, isAdminMode])

  const buildPosScopeParams = useCallback(() => {
    if (scopeInfo?.scopeType && scopeInfo?.scopeId != null) {
      return { scopeType: scopeInfo.scopeType, scopeId: scopeInfo.scopeId }
    }
    if (user?.role === 'CASHIER' && user.branchId) {
      return { scopeType: 'BRANCH', scopeId: user.branchId }
    }
    if (user?.role === 'WAREHOUSE_KEEPER' && user.warehouseId) {
      return { scopeType: 'WAREHOUSE', scopeId: user.warehouseId }
    }
    return {}
  }, [user, scopeInfo])

  const searchOutstandingPayments = useCallback(async (phoneNumber, customerName) => {
    if ((!phoneNumber || phoneNumber.trim().length < 3) && (!customerName || customerName.trim().length < 3)) {
      setOutstandingPayments([])
      setSelectedOutstandingPayments([])
      return
    }

    setIsSearchingOutstanding(true)

    try {
      const params = new URLSearchParams()
      const scopeParams = buildPosScopeParams()
      if (scopeParams.scopeType) params.append('scopeType', scopeParams.scopeType)
      if (scopeParams.scopeId != null) params.append('scopeId', String(scopeParams.scopeId))
      if (phoneNumber && phoneNumber.trim().length >= 3) params.append('phone', phoneNumber.trim())
      if (customerName && customerName.trim().length >= 3) params.append('customerName', customerName.trim())

      const response = await api.get(`/sales/outstanding?${params.toString()}`)

      if (response.data.success) {
        const payments = response.data.data.map(customer => {
          const actualBalance = customer.creditAmount || customer.finalAmount || customer.totalOutstanding
          return {
            id: `customer_${customer.customerName}_${customer.phone}`,
            invoice_no: customer.isCredit ? `CREDIT_${customer.customerName}` : `OUTSTANDING_${customer.customerName}`,
            customer_name: customer.customerName,
            customer_phone: customer.phone,
            total: actualBalance,
            outstandingAmount: Math.abs(actualBalance),
            paymentStatus: customer.isCredit ? 'CREDIT' : 'PENDING',
            paymentMethod: 'OUTSTANDING',
            creditStatus: customer.isCredit ? 'CREDIT' : 'PENDING',
            creditAmount: actualBalance,
            paymentAmount: 0,
            pendingSalesCount: customer.pendingSalesCount,
            isCredit: customer.isCredit || false,
            created_at: new Date().toISOString()
          }
        })

        setOutstandingPayments(payments)
        setIsSettlementPartial(false)
        setIsSettlementFullyCredit(false)
        setShowSettlementOptions(false)
        setSelectedOutstandingPayments(payments.map(p => p.id))
      } else {
        setOutstandingPayments([])
        setSelectedOutstandingPayments([])
      }
    } catch (error) {
      setOutstandingPayments([])
      setSelectedOutstandingPayments([])
    } finally {
      setIsSearchingOutstanding(false)
    }
  }, [buildPosScopeParams])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if ((customerPhone && customerPhone.trim().length >= 3) || (customerName && customerName.trim().length >= 3)) {
        searchOutstandingPayments(customerPhone?.trim(), customerName?.trim())
      } else {
        setOutstandingPayments([])
        setSelectedOutstandingPayments([])
      }
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [customerPhone, customerName, searchOutstandingPayments])

  useEffect(() => {
    if (barcodeInputRef.current && activeTabId) {
      barcodeInputRef.current.focus()
    }
  }, [activeTabId])

  const closeTab = (tabId) => {
    if (tabs.length <= 1) return
    const tabIndex = tabs.findIndex(tab => tab.id === tabId)
    const newTabs = tabs.filter(tab => tab.id !== tabId)
    setTabs(newTabs)
    if (tabId === activeTabId) {
      const newActiveIndex = tabIndex >= newTabs.length ? newTabs.length - 1 : tabIndex
      setActiveTabId(newTabs[newActiveIndex]?.id)
    }
  }

  const switchToTab = (tabId) => {
    setActiveTabId(tabId)
    setBarcodeInput('')
    setManualInput('')
    setShowSearchResults(false)
    setSearchHighlightedIndex(-1)
  }

  const handleSearch = (query) => {
    setSearchQuery(query)
    const normalize = (value) => {
      if (value === null || value === undefined) return ''
      return value.toString().toLowerCase()
    }
    const normalizedQuery = normalize(query)
    if (query.length >= 2) {
      let productMatches = inventoryItems.filter((p) =>
        normalize(p.name).includes(normalizedQuery) ||
        normalize(p.sku).includes(normalizedQuery) ||
        normalize(p.barcode).includes(normalizedQuery) ||
        normalize(p.category).includes(normalizedQuery) ||
        normalize(p.description).includes(normalizedQuery)
      )
      let clinicMatches = clinicServices.filter((s) =>
        normalize(s.name).includes(normalizedQuery) ||
        normalize(s.categoryName).includes(normalizedQuery) ||
        normalize(s.code).includes(normalizedQuery)
      )

      if (selectedCategory !== 'all') {
        if (selectedCategory.startsWith('product:')) {
          const categoryName = selectedCategory.slice('product:'.length)
          productMatches = productMatches.filter((p) => p.category === categoryName)
          clinicMatches = []
        } else if (selectedCategory.startsWith('clinic:')) {
          const categoryId = selectedCategory.slice('clinic:'.length)
          productMatches = []
          clinicMatches = clinicMatches.filter((s) => String(s.categoryId) === categoryId)
        }
      }

      const productResults = productMatches.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.sellingPrice,
        stock: item.currentStock,
        category: item.category,
        sku: item.sku,
        barcode: item.barcode,
        unit: item.unit,
        description: item.description,
        isService: false,
      }))

      const clinicResults = clinicMatches.map((s) => ({
        isService: true,
        clinicServiceId: s.id,
        id: `service-${s.id}`,
        name: s.name,
        price: s.defaultPrice,
        defaultPrice: s.defaultPrice,
        category: s.categoryName || 'Clinic',
        sku: s.code || `CLINIC-${s.id}`,
        stock: null,
      }))

      const combined = [...productResults, ...clinicResults]
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 25)

      setSearchResults(combined)
      setShowSearchResults(true)
      setSearchHighlightedIndex(-1)
    } else {
      setSearchResults([])
      setShowSearchResults(false)
      setSearchHighlightedIndex(-1)
    }
  }

  const handleManualSearch = (query) => handleSearch(query)

  const handleManualSearchKeyDown = (e) => {
    if (showSearchResults && searchResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSearchHighlightedIndex((prev) => {
          const next = prev < searchResults.length - 1 ? prev + 1 : 0
          setTimeout(() => {
            if (searchDropdownRef.current) {
              const items = searchDropdownRef.current.querySelectorAll('[data-search-item]')
              if (items[next]) items[next].scrollIntoView({ block: 'nearest' })
            }
          }, 0)
          return next
        })
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSearchHighlightedIndex((prev) => {
          const next = prev <= 0 ? searchResults.length - 1 : prev - 1
          setTimeout(() => {
            if (searchDropdownRef.current) {
              const items = searchDropdownRef.current.querySelectorAll('[data-search-item]')
              if (items[next]) items[next].scrollIntoView({ block: 'nearest' })
            }
          }, 0)
          return next
        })
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const index = searchHighlightedIndex >= 0 ? searchHighlightedIndex : 0
        selectSearchResult(searchResults[index])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowSearchResults(false)
        setSearchHighlightedIndex(-1)
        return
      }
    }
  }

  const searchCustomers = useCallback(async (query) => {
    const trimmed = (query || '').trim()
    if (trimmed.length < 2) {
      setCustomerSearchResults([])
      setShowCustomerSearch(false)
      setCustomerHighlightedIndex(-1)
      return
    }

    setCustomerSearchLoading(true)
    try {
      const scopeParams = buildPosScopeParams()
      const sharedParams = { search: trimmed, limit: 20, ...scopeParams }
      const [ledgerRes, customersRes] = await Promise.all([
        api.get('/customer-ledger/customers', { params: sharedParams }),
        api.get('/customers', { params: sharedParams }).catch(() => ({ data: { data: [] } })),
      ])

      const ledgerCustomers = (ledgerRes.data?.data?.customers || []).map((c) => ({
        id: `ledger-${c.customer_name}-${c.customer_phone}`,
        name: c.customer_name || 'Walk-in Customer',
        phone: c.customer_phone || '',
        balance: parseFloat(c.current_balance ?? c.outstanding_balance ?? 0),
        totalSales: parseInt(c.total_transactions || 0, 10),
        lastSale: c.last_transaction_date,
      }))

      const tableCustomers = (customersRes.data?.data || []).map((c) => ({
        id: `customer-${c.id}`,
        name: c.name || 'Walk-in Customer',
        phone: c.phone || '',
        customerId: c.id,
        balance: parseFloat(c.currentBalance ?? c.current_balance ?? c.balance ?? 0),
        totalSales: 0,
        lastSale: null,
      }))

      const seen = new Set()
      const merged = []
      for (const customer of [...ledgerCustomers, ...tableCustomers]) {
        const key = `${(customer.name || '').toLowerCase()}|${(customer.phone || '').trim()}`
        if (!customer.name && !customer.phone) continue
        if (seen.has(key)) continue
        seen.add(key)
        merged.push(customer)
      }

      setCustomerSearchResults(merged.slice(0, 20))
      setShowCustomerSearch(merged.length > 0)
      setCustomerHighlightedIndex(-1)
    } catch {
      setCustomerSearchResults([])
      setShowCustomerSearch(false)
      setCustomerHighlightedIndex(-1)
    } finally {
      setCustomerSearchLoading(false)
    }
  }, [buildPosScopeParams])

  const triggerCustomerSearch = useCallback((value) => {
    if (customerSearchTimerRef.current) clearTimeout(customerSearchTimerRef.current)
    customerSearchTimerRef.current = setTimeout(() => {
      searchCustomers(value)
    }, 300)
  }, [searchCustomers])

  useEffect(() => () => {
    if (customerSearchTimerRef.current) clearTimeout(customerSearchTimerRef.current)
  }, [])

  const selectCustomer = useCallback((customer) => {
    setCustomerName(customer.name || '')
    setCustomerPhone(customer.phone || '')
    setShowCustomerSearch(false)
    setCustomerSearchResults([])
    setCustomerHighlightedIndex(-1)
    if ((customer.phone && customer.phone.trim().length >= 3) || (customer.name && customer.name.trim().length >= 3)) {
      searchOutstandingPayments(customer.phone?.trim(), customer.name?.trim())
    }
  }, [searchOutstandingPayments])

  const getCategories = () => {
    const productCategories = [...new Set(inventoryItems.map((item) => item.category).filter(Boolean))]
      .sort()
      .map((name) => ({ id: `product:${name}`, label: name }))
    const clinicCategoryOptions = clinicCategories
      .map((c) => ({ id: `clinic:${c.id}`, label: `${c.name} (Clinic)` }))
      .sort((a, b) => a.label.localeCompare(b.label))
    return [...productCategories, ...clinicCategoryOptions]
  }

  const printBill = async (billData) => {
    try {
      await printThermalBill(billData, { type: 'thermal', name: 'Thermal Printer' })
    } catch (error) {
      alert('Failed to print bill. Please try again.')
    }
  }

  const printThermalBill = async (billData, printer) => {
    const printContent = generateThermalPrintContent(billData)

    if (isThermalPrintingSupported()) {
      try {
        await acquirePrinter({ allowRequest: true })
        const encoder = new TextEncoder()
        await writeToThermalPrinter(encoder.encode(printContent))
        return
      } catch (serialError) {
        resetCachedPrinter()
      }
    }

    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            @media print {
              body { font-family: monospace; font-size: 12px; }
              .receipt { width: 80mm; margin: 0 auto; }
              .center { text-align: center; }
              .right { text-align: right; }
              .line { border-bottom: 1px dashed #000; margin: 5px 0; }
            }
          </style>
        </head>
        <body>
          <div class="receipt">${printContent.replace(/\n/g, '<br>')}</div>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
    printWindow.close()
  }

  const printDefaultBill = async (billData) => {
    const printWindow = window.open('', '_blank')
    printWindow.document.write(generatePrintContent(billData))
    printWindow.document.close()
    printWindow.print()
    printWindow.close()
  }

  const generateThermalPrintContent = (billData) => {
    const { cart, customerName, customerPhone, total, tax, subtotal, paymentMethod, paymentAmount, creditAmount, paymentStatus, change, notes } = billData
    const date = new Date().toLocaleString()
    const fmtNum = (v) => {
      const n = Number(v || 0)
      return Number.isFinite(n) && Number.isInteger(n) ? String(n) : n.toFixed(2)
    }

    let content = `
================================
        RECEIPT
================================
Date: ${date}
Customer: ${customerName || 'Walk-in'}
Phone: ${customerPhone || 'N/A'}
--------------------------------
`
    cart.forEach(item => {
      content += `${item.name}\n`
      content += `${item.quantity} x ${item.price} = ${fmtNum(item.quantity * item.price)}\n`
    })

    content += `
--------------------------------
Subtotal: ${fmtNum(subtotal)}
Tax: ${fmtNum(tax)}
--------------------------------
TOTAL: ${fmtNum(total)}
--------------------------------
Payment Method: ${paymentMethod || 'Cash'}
Amount Paid: ${fmtNum(paymentAmount || total)}
`
    if (paymentStatus === 'PARTIAL') {
      content += `Credit Amount: ${fmtNum(creditAmount || 0)}\nPayment Status: PARTIAL PAYMENT\n`
    } else {
      content += `Change: ${fmtNum(change || 0)}\n`
    }

    if (notes) content += `Notes: ${notes}\n`

    content += `--------------------------------\nThank you for your business!\n================================\n`
    return content
  }

  const generatePrintContent = (billData) => {
    const { cart, customerName, customerPhone, total, tax, subtotal, paymentMethod, paymentAmount, creditAmount, paymentStatus, change, notes } = billData
    const date = new Date().toLocaleString()
    return `
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .item { display: flex; justify-content: space-between; margin: 5px 0; }
            .total { font-weight: bold; font-size: 18px; margin-top: 20px; }
            .payment-info { background-color: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 5px; }
            .line { border-bottom: 1px solid #000; margin: 10px 0; }
            .partial-payment { color: #ff6b35; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>RECEIPT</h2>
            <p>Date: ${date}</p>
            <p>Customer: ${customerName || 'Walk-in'}</p>
            <p>Phone: ${customerPhone || 'N/A'}</p>
          </div>
          <div class="line"></div>
          ${cart.map(item => `
            <div class="item">
              <span>${item.name} (${item.quantity}x)</span>
              <span>${(item.quantity * item.price).toFixed(2)}</span>
            </div>
          `).join('')}
          <div class="line"></div>
          <div class="item"><span>Subtotal:</span><span>${Number(subtotal || 0).toFixed(2)}</span></div>
          <div class="item"><span>Tax:</span><span>${Number(tax || 0).toFixed(2)}</span></div>
          <div class="item total"><span>TOTAL:</span><span>${Number(total || 0).toFixed(2)}</span></div>
          <div class="line"></div>
          <div class="payment-info">
            <div class="item"><span>Payment Method:</span><span>${paymentMethod || 'Cash'}</span></div>
            <div class="item"><span>Amount Paid:</span><span>${Number(paymentAmount || total || 0).toFixed(2)}</span></div>
            ${paymentStatus === 'PARTIAL' ? `
              <div class="item partial-payment"><span>Credit Amount:</span><span>${Number(creditAmount || 0).toFixed(2)}</span></div>
              <div class="item partial-payment"><span>Payment Status:</span><span>PARTIAL PAYMENT</span></div>
            ` : `
              <div class="item"><span>Change:</span><span>${Number(change || 0).toFixed(2)}</span></div>
            `}
            ${notes ? `<div class="item"><span>Notes:</span><span>${notes}</span></div>` : ''}
          </div>
          <div class="line"></div>
          <p style="text-align: center; margin-top: 30px;">Thank you for your business!</p>
        </body>
      </html>
    `
  }

  const removeFromCart = (productId) => {
    updateCurrentTab({ cart: currentCart.filter(item => item.id !== productId) })
  }

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
    } else {
      updateCurrentTab({
        cart: currentCart.map(item =>
          item.id === productId ? { ...item, quantity: newQuantity } : item
        )
      })
    }
  }

  const updateItemDiscount = (productId, discount) => {
    updateCurrentTab({
      cart: currentCart.map(item =>
        item.id === productId ? { ...item, discount: parseFloat(discount) || 0 } : item
      )
    })
  }

  const updateItemPrice = (productId, price) => {
    updateCurrentTab({
      cart: currentCart.map(item => {
        if (item.id !== productId) return item
        let newCustomPrice
        if (price === '' || price === null || price === undefined) {
          newCustomPrice = 0
        } else {
          const parsedPrice = parseFloat(price)
          newCustomPrice = isNaN(parsedPrice) ? 0 : parsedPrice
        }
        return { ...item, customPrice: newCustomPrice }
      })
    })
  }

  const resetItemPrice = (productId) => {
    updateCurrentTab({
      cart: currentCart.map(item =>
        item.id === productId ? { ...item, customPrice: null } : item
      )
    })
  }

  const handleSettlementPaymentChange = (amount) => {
    const paymentAmount = parseFloat(amount)
    setSettlementPaymentAmount(amount)
    if (isSettlementPartial || isSettlementFullyCredit) {
      const safePayment = Number.isNaN(paymentAmount) ? 0 : paymentAmount
      const baseOutstanding = currentCart.length === 0 ? settlementTotal : outstandingTotal
      setSettlementCreditAmount((baseOutstanding - safePayment).toFixed(2))
    }
  }

  const handleSettlementCreditChange = (amount) => {
    setSettlementCreditAmount(amount)
    if (isSettlementFullyCredit) {
      const creditValue = parseFloat(amount)
      const baseOutstanding = currentCart.length === 0 ? settlementTotal : outstandingTotal
      if (!Number.isNaN(creditValue)) {
        setSettlementPaymentAmount((baseOutstanding - creditValue).toFixed(2))
      }
    }
  }

  const handleSettlementPaymentType = (type) => {
    switch (type) {
      case 'full':
        setIsSettlementPartial(false)
        setIsSettlementFullyCredit(false)
        setSettlementPaymentAmount(settlementTotal.toFixed(2))
        setSettlementCreditAmount('0')
        setShowSettlementOptions(false)
        break
      case 'partial':
        setIsSettlementPartial(true)
        setIsSettlementFullyCredit(false)
        setSettlementPaymentAmount('')
        setSettlementCreditAmount(settlementTotal.toFixed(2))
        setShowSettlementOptions(true)
        break
      case 'fullyCredit':
        setIsSettlementPartial(false)
        setIsSettlementFullyCredit(true)
        setSettlementPaymentAmount('0')
        setSettlementCreditAmount(settlementTotal.toFixed(2))
        setShowSettlementOptions(true)
        break
      case 'balance':
        setIsSettlementPartial(false)
        setIsSettlementFullyCredit(false)
        setSettlementPaymentAmount('0')
        setSettlementCreditAmount(settlementTotal.toFixed(2))
        setShowSettlementOptions(true)
        break
      default:
        break
    }
  }

  const handleOutstandingPaymentToggle = (paymentId) => {
    setSelectedOutstandingPayments(prev => {
      const newSelection = prev.includes(paymentId)
        ? prev.filter(id => id !== paymentId)
        : [...prev, paymentId]
      if (newSelection.length === 0) {
        setShowSettlementOptions(false)
        setIsSettlementPartial(false)
        setIsSettlementFullyCredit(false)
      }
      return newSelection
    })
  }

  const subtotal = useMemo(() => {
    return currentCart.reduce((sum, item) => {
      const itemPrice = parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0)
      const itemDiscount = parseFloat(item.discount || 0)
      return sum + Math.max(0, (itemPrice * item.quantity) - itemDiscount)
    }, 0)
  }, [currentCart])

  const tax = useMemo(() => subtotal * (taxRate / 100), [subtotal, taxRate])

  const settlementTotal = useMemo(() => {
    if (currentCart.length === 0 && selectedOutstandingPayments.length > 0) {
      return outstandingPayments
        .filter(payment => selectedOutstandingPayments.includes(payment.id))
        .reduce((total, payment) => {
          const amount = parseFloat(payment.outstandingAmount || 0)
          return total + (payment.isCredit ? -amount : amount)
        }, 0)
    }
    return 0
  }, [outstandingPayments, selectedOutstandingPayments, currentCart.length])

  const outstandingTotal = useMemo(() => {
    if (currentCart.length === 0 && selectedOutstandingPayments.length > 0) {
      if (isSettlementPartial && settlementPaymentAmount && settlementPaymentAmount.trim() !== '') {
        const partialAmount = parseFloat(settlementPaymentAmount) || 0
        const actualPartial = Math.min(partialAmount, Math.abs(settlementTotal))
        return settlementTotal > 0 ? actualPartial : settlementTotal
      } else if (isSettlementFullyCredit) {
        return 0
      } else {
        return settlementTotal
      }
    }
    return outstandingPayments
      .filter(payment => selectedOutstandingPayments.includes(payment.id))
      .reduce((total, payment) => {
        const amount = parseFloat(payment.outstandingAmount || 0)
        return total + (payment.isCredit ? -amount : amount)
      }, 0)
  }, [outstandingPayments, selectedOutstandingPayments, currentCart.length, isSettlementPartial, settlementPaymentAmount, isSettlementFullyCredit, settlementTotal])

  const billAmount = useMemo(() => subtotal + tax - totalDiscount, [subtotal, tax, totalDiscount])

  const total = useMemo(() => billAmount + outstandingTotal, [billAmount, outstandingTotal])

  const calculateSettlementValues = useCallback(() => {
    const baseOutstanding = outstandingPayments
      .filter(payment => selectedOutstandingPayments.includes(payment.id))
      .reduce((total, payment) => {
        const amount = payment.creditAmount !== undefined && payment.creditAmount !== null
          ? parseFloat(payment.creditAmount)
          : (payment.total !== undefined && payment.total !== null
            ? parseFloat(payment.total)
            : parseFloat(payment.outstandingAmount || 0) * (payment.isCredit ? -1 : 1))
        return total + (Number.isFinite(amount) ? amount : 0)
      }, 0)

    const isCredit = baseOutstanding < 0
    const absoluteOutstanding = Math.abs(baseOutstanding)

    let paymentValue, creditValue

    if (isSettlementFullyCredit) {
      if (isCredit) {
        paymentValue = 0
        creditValue = baseOutstanding
      } else {
        const creditNoteAmount = parseFloat(settlementCreditAmount)
        paymentValue = 0
        creditValue = Number.isNaN(creditNoteAmount) ? -absoluteOutstanding : -Math.abs(creditNoteAmount)
      }
    } else if (isSettlementPartial) {
      const parsedPartialAmount = parseFloat(settlementPaymentAmount)
      paymentValue = Number.isNaN(parsedPartialAmount) ? 0 : Math.abs(parsedPartialAmount)
      if (isCredit) {
        paymentValue = 0
        creditValue = baseOutstanding + paymentValue
      } else {
        creditValue = baseOutstanding - paymentValue
      }
    } else {
      if (isCredit) {
        paymentValue = 0
        creditValue = 0
      } else {
        paymentValue = absoluteOutstanding
        creditValue = 0
      }
    }

    const normalizedPayment = Number.parseFloat(paymentValue.toFixed(2))
    const normalizedCredit = Number.parseFloat(creditValue.toFixed(2))

    return {
      baseOutstanding,
      paymentAmount: Number.isNaN(normalizedPayment) ? 0 : normalizedPayment,
      creditAmount: Number.isNaN(normalizedCredit) ? 0 : normalizedCredit,
      isCredit
    }
  }, [
    outstandingPayments, selectedOutstandingPayments,
    isSettlementFullyCredit, isSettlementPartial,
    settlementPaymentAmount, settlementCreditAmount
  ])

  const settlementSnapshot = useMemo(() => calculateSettlementValues(), [calculateSettlementValues])
  const settlementPaymentValue = settlementSnapshot.paymentAmount
  const settlementBalanceValue = settlementSnapshot.creditAmount
  const settlementBaseAmount = settlementSnapshot.baseOutstanding

  useEffect(() => {
    if (
      currentCart.length === 0 &&
      selectedOutstandingPayments.length > 0 &&
      !isSettlementPartial &&
      !isSettlementFullyCredit
    ) {
      const { paymentAmount, creditAmount } = calculateSettlementValues()
      const formattedPayment = paymentAmount.toFixed(2)
      const formattedCredit = creditAmount.toFixed(2)
      if (settlementPaymentAmount !== formattedPayment) setSettlementPaymentAmount(formattedPayment)
      if (settlementCreditAmount !== formattedCredit) setSettlementCreditAmount(formattedCredit)
    }
  }, [
    currentCart.length, selectedOutstandingPayments, isSettlementPartial,
    isSettlementFullyCredit, calculateSettlementValues, settlementPaymentAmount, settlementCreditAmount
  ])

  const settleOutstandingPayments = useCallback(async () => {
    if (selectedOutstandingPayments.length === 0) return null

    const referencePayment = outstandingPayments.find(payment =>
      selectedOutstandingPayments.includes(payment.id)
    )
    if (!referencePayment) throw new Error('Unable to locate outstanding payment details for settlement')

    const settlementValues = calculateSettlementValues()
    const isCreditSettlement = settlementValues.isCredit
    const creditAmountToUse = Math.abs(settlementValues.creditAmount)
    const paymentAmountForBackend = isCreditSettlement ? creditAmountToUse : settlementValues.paymentAmount

    const payload = {
      customerName: referencePayment.customer_name,
      phone: referencePayment.customer_phone,
      paymentAmount: paymentAmountForBackend,
      paymentMethod: (paymentMethod || 'CASH').toUpperCase()
    }

    if (isCreditSettlement) {
      payload.isCreditUsage = true
      payload.creditAmount = creditAmountToUse
    }

    const clearResponse = await api.post('/sales/clear-outstanding', payload)
    if (!clearResponse.data?.success) {
      throw new Error(clearResponse.data?.message || 'Failed to clear outstanding payments')
    }
    return clearResponse.data
  }, [selectedOutstandingPayments, outstandingPayments, calculateSettlementValues, paymentMethod])

  const normalizeCartItemForPrint = useCallback((item) => {
    const parseNumber = (value) => {
      if (value === null || value === undefined || value === '') return NaN
      if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
      const normalized = String(value)
        .replace(/[^\d.\-]/g, '')
        .replace(/(\..*?)\./g, '$1')
      if (normalized === '' || normalized === '-' || normalized === '.') return NaN
      const parsed = Number.parseFloat(normalized)
      return Number.isFinite(parsed) ? parsed : NaN
    }

    const resolveNumber = (candidates, fallback = 0) => {
      for (const candidate of candidates) {
        const parsed = parseNumber(candidate)
        if (Number.isFinite(parsed)) return parsed
      }
      return fallback
    }

    const quantity = resolveNumber([item?.quantity, item?.qty, item?.count], 0)
    const rawUnitPrice = resolveNumber([
      item?.customPrice, item?.unitPrice, item?.price, item?.sellingPrice,
      item?.salePrice, item?.unit_price, item?.originalPrice,
      item?.wholesalePrice, item?.retailPrice, item?.basePrice
    ], NaN)
    const discount = resolveNumber([item?.discount, item?.discountAmount], 0)
    let total = resolveNumber([item?.total, item?.lineTotal, item?.amount], NaN)
    let unitPrice = Number.isFinite(rawUnitPrice) ? rawUnitPrice : NaN

    if (!Number.isFinite(unitPrice) || unitPrice === 0) {
      if (Number.isFinite(total) && quantity !== 0) {
        unitPrice = (total + discount) / quantity
      }
    }

    if (!Number.isFinite(total)) {
      total = Number.isFinite(unitPrice) ? quantity * unitPrice - discount : 0
    }

    unitPrice = Number.isFinite(unitPrice) ? Math.round(unitPrice) : 0
    total = Number.isFinite(total) ? Math.round(total) : 0

    return {
      name: item?.name || item?.productName || item?.itemName || 'Item',
      sku: item?.sku || item?.productSku || item?.barcode || '',
      quantity,
      unitPrice,
      price: unitPrice,
      discount: Math.round(discount),
      total: Number.isFinite(total) ? total : 0
    }
  }, [])

  useEffect(() => {
    if (paymentMethod === 'FULLY_CREDIT') {
      setPaymentAmount('0')
      setCreditAmount(total.toFixed(2))
      setIsPartialPayment(false)
    } else if (paymentMethod !== 'FULLY_CREDIT' && paymentAmount === '0' && !isPartialPayment) {
      setPaymentAmount('')
      setCreditAmount('')
    }
  }, [paymentMethod, total, isPartialPayment, paymentAmount])

  useEffect(() => {
    if (currentCart.length > 0 && outstandingTotal < 0 && !isPartialPayment && paymentAmount === '') {
      const cartTotal = subtotal + tax - totalDiscount
      const netAmount = cartTotal + outstandingTotal
      if (netAmount > 0) {
        setPaymentAmount(netAmount.toString())
        setCreditAmount('0')
      } else {
        setPaymentAmount('0')
        setCreditAmount(Math.abs(netAmount).toString())
      }
    }
  }, [currentCart.length, outstandingTotal, subtotal, tax, totalDiscount, isPartialPayment, paymentAmount])

  useEffect(() => {
    if (!isPartialPayment && paymentMethod === 'FULLY_CREDIT') {
      setPaymentAmount('0')
      setCreditAmount(total.toFixed(2))
    } else if (!isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
      setPaymentAmount('')
      setCreditAmount('')
    }
  }, [isPartialPayment, total, paymentMethod, paymentAmount])

  useEffect(() => {
    const loadSalespeople = async () => {
      if (user?.role === 'WAREHOUSE_KEEPER') {
        try {
          const response = await api.get('/salespeople/warehouse-billing')
          if (response.data.success) setSalespeople(response.data.data)
        } catch (error) {}
      }
    }
    loadSalespeople()
  }, [user])

  useEffect(() => {
    const loadCompanyInfo = async () => {
      const fallbackInfo = { ...DEFAULT_COMPANY_INFO }
      if (!user) { setCompanyInfo(fallbackInfo); return }

      const normalizedScopeType = typeof user.scopeType === 'string' ? user.scopeType.toUpperCase() : null
      const branchId = user.branchId || (normalizedScopeType === 'BRANCH' ? user.scopeId : null)
      const warehouseId = user.warehouseId || (normalizedScopeType === 'WAREHOUSE' ? user.scopeId : null)

      try {
        if (branchId) {
          const response = await api.get(`/branches/${branchId}`)
          if (response.data?.success && response.data?.data) {
            const branch = response.data.data
            setCompanyInfo({
              name: branch.name || fallbackInfo.name,
              address: branch.location || branch.address || fallbackInfo.address,
              phone: branch.phone || branch.managerPhone || fallbackInfo.phone,
              email: branch.email || branch.managerEmail || fallbackInfo.email,
              logoUrl: branch.logoUrl || fallbackInfo.logoUrl
            })
            return
          }
        }
        if (warehouseId) {
          const response = await api.get(`/warehouses/${warehouseId}`)
          if (response.data?.success && response.data?.data) {
            const warehouse = response.data.data
            setCompanyInfo({
              name: warehouse.name || fallbackInfo.name,
              address: warehouse.location || fallbackInfo.address,
              phone: warehouse.phone || warehouse.managerPhone || warehouse.manager || fallbackInfo.phone,
              email: warehouse.email || fallbackInfo.email,
              logoUrl: warehouse.logoUrl || fallbackInfo.logoUrl
            })
            return
          }
        }
        setCompanyInfo(fallbackInfo)
      } catch (error) {
        setCompanyInfo(fallbackInfo)
      }
    }
    loadCompanyInfo()
  }, [user])

  const clearAllPOSState = () => {
    if (!currentTab) return

    const clearedState = createEmptyTabState({
      createdAt: currentTab.createdAt,
      modifiedAt: new Date()
    })

    updateCurrentTab({
      cart: clearedState.cart,
      customerName: clearedState.customerName,
      customerPhone: clearedState.customerPhone,
      paymentMethod: clearedState.paymentMethod,
      paymentAmount: clearedState.paymentAmount,
      creditAmount: clearedState.creditAmount,
      isPartialPayment: clearedState.isPartialPayment,
      isFullyCredit: clearedState.isFullyCredit,
      isBalancePayment: clearedState.isBalancePayment,
      outstandingPayments: clearedState.outstandingPayments,
      selectedOutstandingPayments: clearedState.selectedOutstandingPayments,
      settlementPaymentAmount: clearedState.settlementPaymentAmount,
      settlementCreditAmount: clearedState.settlementCreditAmount,
      isSettlementPartial: clearedState.isSettlementPartial,
      isSettlementFullyCredit: clearedState.isSettlementFullyCredit,
      showSettlementOptions: clearedState.showSettlementOptions,
      taxRate: clearedState.taxRate,
      totalDiscount: clearedState.totalDiscount,
      notes: clearedState.notes
    })

    setCustomerName(clearedState.customerName)
    setCustomerPhone(clearedState.customerPhone)
    setPaymentMethod(clearedState.paymentMethod)
    setPaymentAmount(clearedState.paymentAmount)
    setCreditAmount(clearedState.creditAmount)
    setIsPartialPayment(clearedState.isPartialPayment)
    setIsFullyCredit(clearedState.isFullyCredit)
    setIsBalancePayment(clearedState.isBalancePayment)
    setOutstandingPayments(clearedState.outstandingPayments)
    setSelectedOutstandingPayments(clearedState.selectedOutstandingPayments)
    setSettlementPaymentAmount(clearedState.settlementPaymentAmount)
    setSettlementCreditAmount(clearedState.settlementCreditAmount)
    setIsSettlementPartial(clearedState.isSettlementPartial)
    setIsSettlementFullyCredit(clearedState.isSettlementFullyCredit)
    setShowSettlementOptions(clearedState.showSettlementOptions)
    setTaxRate(clearedState.taxRate)
    setTotalDiscount(clearedState.totalDiscount)
    setNotes(clearedState.notes)
    setCustomerSearchResults([])
    setShowCustomerSearch(false)
    setSearchResults([])
    setShowSearchResults(false)
    setManualInput('')
    setBarcodeInput('')
    setSearchQuery('')
    setSelectedCategory('all')
  }

  const refreshOutstandingPayments = () => {
    setSettlementPaymentAmount('')
    setSettlementCreditAmount('')
    setIsSettlementPartial(false)
    setIsSettlementFullyCredit(false)
    setOutstandingPayments([])
    setSelectedOutstandingPayments([])
    if (currentTab) {
      updateCurrentTab({
        outstandingPayments: [],
        selectedOutstandingPayments: [],
        settlementPaymentAmount: '',
        settlementCreditAmount: '',
        isSettlementPartial: false,
        isSettlementFullyCredit: false,
        showSettlementOptions: false
      })
    }
  }

  const handlePayment = async () => {
    if (isProcessingSaleOnly || isCompletingSaleRef.current) return
    isCompletingSaleRef.current = true
    setIsProcessingSaleOnly(true)
    try {
      if (!user) { alert('❌ User not authenticated. Please login again.'); return }

      if (!currentCart || (currentCart.length === 0 && selectedOutstandingPayments.length === 0)) {
        alert('❌ Cart is empty and no outstanding payments selected.')
        return
      }

      if (total <= 0 && currentCart.length === 0) {
        alert('❌ Cannot process a sale without items.')
        return
      }

      if (selectedOutstandingPayments.length > 0) {
        const confirmOutstanding = confirm(
          `⚠️ You have selected ${selectedOutstandingPayments.length} outstanding payment(s) totaling ${outstandingTotal.toFixed(2)} to settle.\n\nThis will mark the selected outstanding payments as COMPLETED.\n\nDo you want to proceed?`
        )
        if (!confirmOutstanding) return
      }

      if (!currentTab) { alert('❌ No active tab found. Please refresh the page.'); return }

      if (user.role === 'ADMIN' && !isAdminMode) {
        alert('Please select a branch or warehouse from the Admin Dashboard to simulate a role before making sales.')
        return
      }

      if ((isPartialPayment || isFullyCredit) && (!customerName || !customerPhone)) {
        alert('❌ Customer name and phone number are required for partial payments and credit sales.')
        return
      }

      const billAmountCalc = subtotal + tax - totalDiscount
      const totalWithOutstanding = billAmountCalc + outstandingTotal

      let finalPaymentAmount, finalCreditAmount

      if (isFullyCredit) {
        finalPaymentAmount = 0
        finalCreditAmount = totalWithOutstanding
      } else if (isBalancePayment) {
        finalPaymentAmount = 0
        finalCreditAmount = billAmountCalc
      } else if (isPartialPayment) {
        finalPaymentAmount = parseFloat(paymentAmount) || 0
        finalCreditAmount = totalWithOutstanding - finalPaymentAmount
      } else {
        finalPaymentAmount = totalWithOutstanding
        finalCreditAmount = 0
      }

      const finalPaymentStatus = (isFullyCredit || finalCreditAmount > 0) ? 'PENDING' : 'COMPLETED'

      if (isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
        if (finalPaymentAmount <= 0) {
          alert('❌ Payment amount must be greater than 0 for partial payments')
          return
        }
        const sum = finalPaymentAmount + finalCreditAmount
        if (Math.abs(sum - totalWithOutstanding) > 0.01) {
          alert(`❌ Payment amounts don't add up to total.\nPaid: ${finalPaymentAmount.toFixed(2)}\nCredit: ${finalCreditAmount.toFixed(2)}\nTotal: ${totalWithOutstanding.toFixed(2)}`)
          return
        }
      }

      const saleData = {
        items: currentCart.map(mapCartLineForSale),
        scopeType: scopeInfo?.scopeType || (user.role === 'CASHIER' ? 'BRANCH' : 'WAREHOUSE'),
        scopeId: scopeInfo?.scopeId || (user.role === 'CASHIER' ? String(user.branchId) : String(user.warehouseId)),
        subtotal: parseFloat(subtotal),
        tax: parseFloat(tax),
        discount: parseFloat(totalDiscount),
        total: isBalancePayment ? parseFloat(billAmountCalc) : parseFloat(totalWithOutstanding),
        paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : (isBalancePayment ? 'CASH' : (paymentMethod || 'CASH')),
        paymentType: isBalancePayment ? 'BALANCE_PAYMENT' : (isPartialPayment ? 'PARTIAL_PAYMENT' : (isFullyCredit ? 'FULLY_CREDIT' : 'FULL_PAYMENT')),
        paymentStatus: finalPaymentStatus,
        paymentAmount: finalPaymentAmount,
        creditAmount: finalCreditAmount,
        customerInfo: { name: customerName || 'Walk-in Customer', phone: customerPhone || '' },
        notes: notes || 'Sale completed without printing',
        saleDate: saleDate || null
      }

      const result = await dispatch(createSale({ ...saleData, __idempotencyKey: makeSaleIdempotencyKey() }))

      if (createSale.fulfilled.match(result)) {
        const sale = result.payload?.data ?? result.payload
        // Outstanding included in sale total is settled inside createSale — skip client clear-outstanding.

        try {
          await printReceipt(sale)
        } catch (error) {}

        const outstandingMessage = selectedOutstandingPayments.length > 0
          ? `\n\nOutstanding Payments Settled: ${selectedOutstandingPayments.length} (${outstandingTotal.toFixed(2)})`
          : ''

        const paymentMessage = isPartialPayment
          ? `✅ Payment successful!\n\nInvoice: ${sale.invoice_no}\nTotal: ${total.toFixed(2)}\nPaid: ${finalPaymentAmount.toFixed(2)}\nCredit: ${finalCreditAmount.toFixed(2)}\nPayment: ${paymentMethod.toUpperCase()}\nCustomer: ${customerName}\nPhone: ${customerPhone}${outstandingMessage}`
          : `✅ Payment successful!\n\nInvoice: ${sale.invoice_no}\nTotal: ${total.toFixed(2)}\nPayment: ${paymentMethod.toUpperCase()}\nCustomer: ${customerName}\nPhone: ${customerPhone}${outstandingMessage}`

        alert(paymentMessage)
        clearAllPOSState()
        setTimeout(() => refreshOutstandingPayments(), 2000)
        if (barcodeInputRef.current) barcodeInputRef.current.focus()

      } else if (createSale.rejected.match(result)) {
        const error = result.payload || result.error
        let errorMessage = 'Payment failed. Please try again.'
        if (error && typeof error === 'string') errorMessage = error
        else if (error?.message) errorMessage = error.message
        else if (error?.response?.data?.message) errorMessage = error.response.data.message
        alert(`❌ Payment failed!\n\nError: ${errorMessage}`)
      } else {
        alert('❌ Payment failed!\n\nUnexpected error occurred. Please try again.')
      }
    } catch (error) {
      alert(`❌ Payment processing error: ${error.message}`)
    } finally {
      setIsProcessingSaleOnly(false)
      isCompletingSaleRef.current = false
    }
  }

  const handleSaleOnly = async () => {
    if (isProcessingSaleOnly) return

    try {
      if (user.role === 'ADMIN' && !isAdminMode) {
        alert('Please select a branch or warehouse from the Admin Dashboard to simulate a role before making sales.')
        return
      }
      if (!user) { alert('❌ User not authenticated. Please login again.'); return }
      if ((isPartialPayment || isFullyCredit) && (!customerName || !customerPhone)) {
        alert('❌ Customer name and phone number are required for partial payments and credit sales.')
        return
      }

      if (!currentCart || currentCart.length === 0) {
        if (selectedOutstandingPayments.length > 0) {
          const { paymentAmount: settlementPaymentValue, creditAmount: settlementCreditValue, baseOutstanding } = calculateSettlementValues()
          if (isSettlementPartial && settlementPaymentValue < 0) {
            alert('❌ Payment amount cannot be negative.')
            return
          }
          setPendingSaleData({
            type: 'settlement-only',
            settlementPaymentValue,
            settlementCreditValue,
            baseOutstanding,
            customerName: customerName || 'Unknown',
            customerPhone: customerPhone || 'N/A',
            paymentMethod,
            selectedOutstandingPayments: [...selectedOutstandingPayments],
            outstandingPayments: [...outstandingPayments]
          })
          setSaleConfirmDialog(true)
          return
        } else {
          alert('❌ Cart is empty. Please add items before processing sale.')
          return
        }
      }

      if (total <= 0 && currentCart.length === 0) {
        alert('❌ Cannot process a sale without items.')
        return
      }

      const zeroPriceItems = getZeroPriceCartItems(currentCart)
      if (zeroPriceItems.length > 0) {
        const names = zeroPriceItems.map((item) => item.name || 'Item').join(', ')
        showToast(
          `${names} has price 0. Enter a price in the Price field — use Disc for free/zero total.`,
          'warning'
        )
        return
      }

      const selectedOutstandingTotal = outstandingPayments
        .filter(payment => selectedOutstandingPayments.includes(payment.id))
        .reduce((total, payment) => {
          const amount = payment.creditAmount !== undefined && payment.creditAmount !== null
            ? parseFloat(payment.creditAmount)
            : (payment.total !== undefined && payment.total !== null
              ? parseFloat(payment.total)
              : parseFloat(payment.outstandingAmount || 0) * (payment.isCredit ? -1 : 1))
          return total + (Number.isFinite(amount) ? amount : 0)
        }, 0)

      const totalWithOutstanding = billAmount + selectedOutstandingTotal

      let finalPaymentAmount, finalCreditAmount
      if (isFullyCredit) {
        finalPaymentAmount = 0; finalCreditAmount = totalWithOutstanding
      } else if (isBalancePayment) {
        finalPaymentAmount = 0; finalCreditAmount = totalWithOutstanding
      } else if (isPartialPayment) {
        finalPaymentAmount = parseFloat(paymentAmount) || 0
        finalCreditAmount = totalWithOutstanding - finalPaymentAmount
      } else {
        finalPaymentAmount = totalWithOutstanding; finalCreditAmount = 0
      }

      const finalPaymentStatus = (isFullyCredit || finalCreditAmount > 0) ? 'PENDING' : 'COMPLETED'

      if (isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
        if (finalPaymentAmount <= 0) { alert('❌ Payment amount must be greater than 0 for partial payments'); return }
        const sum = finalPaymentAmount + finalCreditAmount
        if (Math.abs(sum - totalWithOutstanding) > 0.01) {
          alert(`❌ Payment amounts don't add up to total.\nPaid: ${finalPaymentAmount.toFixed(2)}\nCredit: ${finalCreditAmount.toFixed(2)}\nTotal: ${totalWithOutstanding.toFixed(2)}`)
          return
        }
      }

      const saleData = {
        items: currentCart.map(mapCartLineForSale),
        scopeType: scopeInfo?.scopeType || (user.role === 'CASHIER' ? 'BRANCH' : 'WAREHOUSE'),
        scopeId: scopeInfo?.scopeId || (user.role === 'CASHIER' ? String(user.branchId) : String(user.warehouseId)),
        subtotal: parseFloat(subtotal),
        tax: parseFloat(tax),
        discount: parseFloat(totalDiscount),
        total: parseFloat(totalWithOutstanding),
        paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : (paymentMethod || 'CASH'),
        paymentType: isPartialPayment ? 'PARTIAL_PAYMENT' : (isFullyCredit ? 'FULLY_CREDIT' : 'FULL_PAYMENT'),
        paymentStatus: finalPaymentStatus,
        paymentAmount: finalPaymentAmount,
        creditAmount: finalCreditAmount,
        customerInfo: { name: customerName || 'Walk-in Customer', phone: customerPhone || '' },
        notes: notes || 'Sale completed via POS terminal'
      }

      const printDataPreview = {
        type: 'receipt',
        title: 'SALES RECEIPT',
        companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
        branchName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
        companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
        companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
        companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
        logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
        receiptNumber: '',
        date: formatDisplayDate(new Date()),
        time: new Date().toLocaleTimeString(),
        cashierName: user?.name || user?.username || 'Cashier',
        customerName: customerName || 'Walk-in Customer',
        customerPhone: customerPhone || '',
        items: currentCart.map(normalizeCartItemForPrint),
        subtotal: Math.round(subtotal),
        tax: Math.round(tax),
        discount: Math.round(totalDiscount),
        invoiceTotal: Math.round(billAmount),
        oldBalance: Math.round(selectedOutstandingTotal || 0),
        total: Math.round(totalWithOutstanding),
        paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : (paymentMethod || 'CASH'),
        paymentAmount: Math.round(finalPaymentAmount),
        creditAmount: Math.round(finalCreditAmount),
        remainingBalance: Math.round(Math.max(0, totalWithOutstanding - finalPaymentAmount)),
        change: isPartialPayment ? 0 : Math.round((parseFloat(paymentAmount) || finalPaymentAmount) - totalWithOutstanding),
        customerLabel: 'Customer',
        footerMessage: 'Thank you for choosing us!'
      }

      setPendingSaleData({
        type: 'sale',
        saleData,
        printDataPreview,
        finalPaymentAmount,
        finalCreditAmount,
        totalWithOutstanding,
        selectedOutstandingTotal,
        billAmount,
        selectedOutstandingPayments: [...selectedOutstandingPayments],
        showSettlementOptions
      })
      setSaleConfirmDialog(true)

    } catch (error) {
      showToast(error?.message || 'Validation failed', 'error')
    }
  }

  const handleCompleteSale = async () => {
    if (isCompletingSaleRef.current) return
    isCompletingSaleRef.current = true
    setIsProcessingSaleOnly(true)

    setSaleConfirmDialog(false)

    try {
      if (!pendingSaleData) throw new Error('No pending sale data found.')

      if (pendingSaleData.type === 'settlement-only') {
        const { settlementPaymentValue, settlementCreditValue, baseOutstanding } = pendingSaleData

        try {
          const settlementResult = await settleOutstandingPayments()

          if (settlementResult?.data?.settlementSale) {
            const settlementSale = settlementResult.data.settlementSale
            const dbPaymentAmountRaw = parseFloat(settlementSale.payment_amount)
            const dbCreditAmountRaw = parseFloat(settlementSale.credit_amount)
            const dbTotal = parseFloat(settlementSale.total || 0) || 0

            let finalPaymentAmountPrint = Number.isFinite(dbPaymentAmountRaw) ? dbPaymentAmountRaw : parseFloat(settlementPaymentValue || 0) || 0
            if (finalPaymentAmountPrint === 0 && dbTotal > 0 && Number.isFinite(dbCreditAmountRaw) && dbCreditAmountRaw > 0) {
              finalPaymentAmountPrint = dbTotal - dbCreditAmountRaw
            }
            if (finalPaymentAmountPrint === 0) {
              finalPaymentAmountPrint = parseFloat(settlementPaymentValue || 0) || 0
            }

            let finalCreditAmountPrint = Number.isFinite(dbCreditAmountRaw) ? dbCreditAmountRaw : parseFloat(settlementCreditValue || 0) || 0
            const finalTotal = parseFloat((finalPaymentAmountPrint + finalCreditAmountPrint).toFixed(2))

            const settlementPrintData = {
              type: 'receipt',
              title: 'PAYMENT SETTLEMENT RECEIPT',
              companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
              companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
              companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
              companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
              logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
              receiptNumber: settlementSale.invoice_no || `SETTLE-${Date.now()}`,
              date: formatDisplayDate(settlementSale.created_at),
              time: new Date(settlementSale.created_at).toLocaleTimeString(),
              cashierName: user?.name || user?.username || 'Cashier',
              customerName: settlementSale.customer_name || customerName || 'Unknown',
              customerPhone: settlementSale.customer_phone || customerPhone || '',
              customerLabel: 'Retailer',
              items: [],
              subtotal: 0,
              tax: 0,
              discount: 0,
              invoiceTotal: 0,
              oldBalance: Math.round(Number.isFinite(baseOutstanding) ? Math.abs(baseOutstanding) : 0),
              total: Math.round(finalTotal),
              paymentMethod: settlementSale.payment_method || paymentMethod || 'CASH',
              paymentAmount: Math.round(finalPaymentAmountPrint),
              creditAmount: Math.round(finalCreditAmountPrint),
              remainingBalance: Math.round(finalCreditAmountPrint),
              change: 0,
              notes: '',
              footerMessage: 'Thank you for your payment!'
            }

            clearAllPOSState()
            setTimeout(() => refreshOutstandingPayments(), 2000)
            showToast(`Settlement recorded. Invoice: ${settlementSale.invoice_no}`, 'success')
            await printThermalReceiptDirect(settlementPrintData, 'Settlement receipt')
            if (barcodeInputRef.current) barcodeInputRef.current.focus()
          }
        } catch (error) {
          alert(`❌ Error processing outstanding payment settlement: ${error.message}`)
        }
        return
      }

      const {
        saleData,
        printDataPreview,
      } = pendingSaleData

      const result = await dispatch(createSale({ ...saleData, __idempotencyKey: makeSaleIdempotencyKey() }))

      if (createSale.fulfilled.match(result)) {
        const sale = result.payload.data || result.payload

        // Outstanding cash settlement is handled inside backend createSale when total includes
        // old balance — do not call clear-outstanding again after a successful sale.

        const finalPrintData = {
          ...printDataPreview,
          receiptNumber: sale.invoice_no || `POS-${Date.now()}`
        }

        clearAllPOSState()
        setTimeout(() => refreshOutstandingPayments(), 2000)
        showToast(`Sale saved. Invoice: ${sale.invoice_no}`, 'success')
        await printThermalReceiptDirect(finalPrintData, 'Post-sale receipt')
        if (barcodeInputRef.current) barcodeInputRef.current.focus()

      } else if (createSale.rejected.match(result)) {
        const error = result.payload || result.error
        const message = error?.message || 'Sale failed'
        const severity = error?.status === 403 ? 'warning' : 'error'
        console.error('[POS] createSale failed:', error)
        showToast(message, severity)
      }

    } catch (error) {
      showToast(error?.message || 'Sale failed', 'error')
    } finally {
      setIsProcessingSaleOnly(false)
      isCompletingSaleRef.current = false
      setPendingSaleData(null)
    }
  }

  const handleSaleWithoutPrint = async () => {
    if (isProcessingSale) return

    try {
      if (user.role === 'ADMIN' && !isAdminMode) {
        alert('Please select a branch or warehouse from the Admin Dashboard to simulate a role before making sales.')
        return
      }
      if (!user) { alert('❌ User not authenticated. Please login again.'); return }
      if ((isPartialPayment || isFullyCredit) && (!customerName || !customerPhone)) {
        alert('❌ Customer name and phone number are required for partial payments and credit sales.')
        return
      }

      if (!currentCart || currentCart.length === 0) {
        if (selectedOutstandingPayments.length > 0) {
          const { paymentAmount: settlementPaymentValue, creditAmount: settlementCreditValue, baseOutstanding } = calculateSettlementValues()
          if (isSettlementPartial && settlementPaymentValue < 0) {
            alert('❌ Payment amount cannot be negative.')
            return
          }
          setPendingSaleData({
            type: 'settlement-only',
            source: 'sale-only',
            settlementPaymentValue,
            settlementCreditValue,
            baseOutstanding,
            customerName: customerName || 'Unknown',
            customerPhone: customerPhone || 'N/A',
            paymentMethod,
            selectedOutstandingPayments: [...selectedOutstandingPayments],
            outstandingPayments: [...outstandingPayments]
          })
          setSaleConfirmDialog(true)
          return
        } else {
          alert('❌ Cart is empty. Please add items before processing sale.')
          return
        }
      }

      if (total <= 0 && currentCart.length === 0) {
        alert('❌ Cannot process a sale without items.')
        return
      }

      const zeroPriceItems = getZeroPriceCartItems(currentCart)
      if (zeroPriceItems.length > 0) {
        const names = zeroPriceItems.map((item) => item.name || 'Item').join(', ')
        showToast(
          `${names} has price 0. Enter a price in the Price field — use Disc for free/zero total.`,
          'warning'
        )
        return
      }

      const selectedOutstandingTotal = outstandingPayments
        .filter(payment => selectedOutstandingPayments.includes(payment.id))
        .reduce((total, payment) => {
          const amount = payment.creditAmount !== undefined && payment.creditAmount !== null
            ? parseFloat(payment.creditAmount)
            : (payment.total !== undefined && payment.total !== null
              ? parseFloat(payment.total)
              : parseFloat(payment.outstandingAmount || 0) * (payment.isCredit ? -1 : 1))
          return total + (Number.isFinite(amount) ? amount : 0)
        }, 0)

      const totalWithOutstanding = billAmount + selectedOutstandingTotal

      let finalPaymentAmount, finalCreditAmount
      if (isFullyCredit) {
        finalPaymentAmount = 0; finalCreditAmount = totalWithOutstanding
      } else if (isBalancePayment) {
        finalPaymentAmount = 0; finalCreditAmount = totalWithOutstanding
      } else if (isPartialPayment) {
        finalPaymentAmount = parseFloat(paymentAmount) || 0
        finalCreditAmount = totalWithOutstanding - finalPaymentAmount
      } else {
        finalPaymentAmount = totalWithOutstanding; finalCreditAmount = 0
      }

      const finalPaymentStatus = (isFullyCredit || finalCreditAmount > 0) ? 'PENDING' : 'COMPLETED'

      if (isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
        if (finalPaymentAmount <= 0) { alert('❌ Payment amount must be greater than 0 for partial payments'); return }
        const sum = finalPaymentAmount + finalCreditAmount
        if (Math.abs(sum - totalWithOutstanding) > 0.01) {
          alert(`❌ Payment amounts don't add up to total.\nPaid: ${finalPaymentAmount.toFixed(2)}\nCredit: ${finalCreditAmount.toFixed(2)}\nTotal: ${totalWithOutstanding.toFixed(2)}`)
          return
        }
      }

      const saleData = {
        items: currentCart.map(mapCartLineForSale),
        scopeType: scopeInfo?.scopeType || (user.role === 'CASHIER' ? 'BRANCH' : 'WAREHOUSE'),
        scopeId: scopeInfo?.scopeId || (user.role === 'CASHIER' ? String(user.branchId) : String(user.warehouseId)),
        subtotal: parseFloat(subtotal),
        tax: parseFloat(tax),
        discount: parseFloat(totalDiscount),
        total: parseFloat(totalWithOutstanding),
        paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : (paymentMethod || 'CASH'),
        paymentType: isPartialPayment ? 'PARTIAL_PAYMENT' : (isFullyCredit ? 'FULLY_CREDIT' : 'FULL_PAYMENT'),
        paymentStatus: finalPaymentStatus,
        paymentAmount: finalPaymentAmount,
        creditAmount: finalCreditAmount,
        customerInfo: { name: customerName || 'Walk-in Customer', phone: customerPhone || '' },
        notes: notes || 'Sale completed without printing'
      }

      const printDataPreview = {
        type: 'receipt',
        title: 'SALES RECEIPT',
        companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
        branchName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
        companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
        companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
        companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
        logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
        receiptNumber: '',
        date: formatDisplayDate(new Date()),
        time: new Date().toLocaleTimeString(),
        cashierName: user?.name || user?.username || 'Cashier',
        customerName: customerName || 'Walk-in Customer',
        customerPhone: customerPhone || '',
        items: currentCart.map(normalizeCartItemForPrint),
        subtotal: Math.round(subtotal),
        tax: Math.round(tax),
        discount: Math.round(totalDiscount),
        invoiceTotal: Math.round(billAmount),
        oldBalance: Math.round(selectedOutstandingTotal || 0),
        total: Math.round(totalWithOutstanding),
        paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : (paymentMethod || 'CASH'),
        paymentAmount: Math.round(finalPaymentAmount),
        creditAmount: Math.round(finalCreditAmount),
        remainingBalance: Math.round(Math.max(0, totalWithOutstanding - finalPaymentAmount)),
        change: isPartialPayment ? 0 : Math.round((parseFloat(paymentAmount) || finalPaymentAmount) - totalWithOutstanding),
        customerLabel: 'Customer',
        footerMessage: 'Thank you for choosing us!'
      }

      setPendingSaleData({
        type: 'sale',
        source: 'sale-only',
        saleData,
        printDataPreview,
        finalPaymentAmount,
        finalCreditAmount,
        totalWithOutstanding,
        selectedOutstandingTotal,
        billAmount,
        selectedOutstandingPayments: [...selectedOutstandingPayments],
        showSettlementOptions
      })
      setSaleConfirmDialog(true)

    } catch (error) {
      showToast(error?.message || 'Validation failed', 'error')
    }
  }

  const handleDirectPrint = async () => {
    try {
      if (!currentCart?.length) { alert('❌ Cart is empty. Please add items before printing.'); return }

      const cartSubtotal = subtotal || 0
      const cartTax = tax || 0
      const cartDiscount = totalDiscount || 0
      const cartTotal = total || 0
      const oldBalanceAmount = outstandingTotal > 0 ? outstandingTotal : 0
      const paymentAmountValue = parseFloat(paymentAmount) || 0
      const creditAmountValue = parseFloat(creditAmount) || 0

      const draftPrintData = {
        type: 'receipt',
        title: 'DRAFT RECEIPT',
        companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
        branchName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
        companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
        companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
        companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
        logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
        receiptNumber: `DRAFT-${Date.now()}`,
        date: formatDisplayDate(new Date()),
        time: new Date().toLocaleTimeString(),
        cashierName: user?.name || user?.username || 'Cashier',
        customerName: customerName || 'Walk-in Customer',
        customerPhone: customerPhone || '',
        customerLabel: 'Customer',
        items: currentCart.map(normalizeCartItemForPrint),
        subtotal: Math.round(cartSubtotal),
        tax: Math.round(cartTax),
        discount: Math.round(cartDiscount),
        invoiceTotal: Math.round(cartTotal - cartDiscount),
        oldBalance: Math.round(oldBalanceAmount),
        total: Math.round(cartTotal),
        paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod,
        paymentAmount: Math.round(paymentAmountValue),
        creditAmount: Math.round(creditAmountValue),
        remainingBalance: Math.round(Math.max(0, oldBalanceAmount + creditAmountValue - paymentAmountValue)),
        change: 0,
        notes: 'DRAFT - Not a completed sale',
        footerMessage: 'Thank you for your business!'
      }

      const { success, message, usedBrowserFallback } = await attemptReceiptPrint(draftPrintData, 'Direct draft receipt')

      if (success) {
        alert('✅ Receipt printed successfully!')
      } else {
        const printerStatus = await checkPrinterStatus()
        let errorMessage = `❌ Print failed. Please check printer connection.\n\nReason: ${message || 'Unknown error'}\nPrinter Status: ${printerStatus.message}\n\nTroubleshooting:\n1. Check printer is powered on\n2. Verify USB cable\n3. Check Device Manager\n4. Restart the printer`
        alert(errorMessage)
      }
    } catch (error) {
      alert(`❌ Print failed: ${error.message || 'Unknown error'}`)
    }
  }

  const printToThermalPrinter = async (printData, { allowPortRequest = false } = {}) => {
    if (!isThermalPrintingSupported()) {
      throw new Error(getPrinterSupportMessage())
    }

    try {
      setPrinterMode(PRINTER_MODE_DIRECT)
      await acquirePrinter({ allowRequest: allowPortRequest })

      const logoUrl = printData.logoUrl || companyInfo?.logoUrl || DEFAULT_COMPANY_INFO.logoUrl
      const logoSizes = getPrintLogoSizes(logoUrl)

      const payload = await buildReceiptEscPos(
        {
          ...printData,
          companyName: printData.companyName || printData.branchName || DEFAULT_COMPANY_INFO.name,
          branchName: printData.branchName || companyInfo?.name || DEFAULT_COMPANY_INFO.name,
          companyAddress: printData.companyAddress || DEFAULT_COMPANY_INFO.address,
          companyPhone: printData.companyPhone || DEFAULT_COMPANY_INFO.phone,
          companyEmail: printData.companyEmail || DEFAULT_COMPANY_INFO.email,
          logoUrl,
        },
        {
          includeLogo: true,
          logoWidth: logoSizes.escPosWidth,
          logoHeight: logoSizes.escPosHeight,
          width: 42,
        }
      )

      await writeToThermalPrinter(payload)
      const via = getActivePrinterTransport() === 'serial' ? 'Serial/COM' : 'USB'
      return { success: true, message: `Printed silently via ${via}` }
    } catch (error) {
      resetCachedPrinter()
      throw error
    }
  }

  const checkPrinterStatus = async () => {
    try {
      if (isSystemPrinterMode()) {
        return { hasSerialPorts: true, portCount: 1, message: 'System printer mode — Epson via Mac/Windows print dialog' }
      }
      if (!isThermalPrintingSupported()) {
        return { hasSerialPorts: false, portCount: 0, message: getPrinterSupportMessage() }
      }
      const count = await getGrantedPrinterCount()
      if (count > 0) {
        return { hasSerialPorts: true, portCount: count, message: `Found ${count} paired USB printer device(s)` }
      }
      return { hasSerialPorts: false, portCount: 0, message: 'No printer paired. Click Connect Printer and select your Epson from the USB list.' }
    } catch (error) {
      return { hasSerialPorts: false, portCount: 0, message: 'Error checking printer status' }
    }
  }

  const printToBrowser = async (printData) => {
    try {
      const baseOrigin = typeof window !== 'undefined' ? window.location.origin : ''
      const rawLogo = printData.logoUrl || DEFAULT_COMPANY_INFO.logoUrl
      const resolvedLogoPath = (() => {
        if (!rawLogo) return baseOrigin ? `${baseOrigin}${DEFAULT_COMPANY_INFO.logoUrl}` : DEFAULT_COMPANY_INFO.logoUrl
        if (/^(https?:|data:)/i.test(rawLogo)) return rawLogo
        const normalizedLogo = rawLogo.startsWith('/') ? rawLogo : `/${rawLogo}`
        return baseOrigin ? `${baseOrigin}${normalizedLogo}` : normalizedLogo
      })()
      const logoSizes = getPrintLogoSizes(rawLogo)

      const safeCompanyName = printData.companyName || DEFAULT_COMPANY_INFO.name
      const safeCompanyAddress = printData.companyAddress || DEFAULT_COMPANY_INFO.address
      const safeCompanyPhone = printData.companyPhone || DEFAULT_COMPANY_INFO.phone
      const safeCompanyEmail = printData.companyEmail || DEFAULT_COMPANY_INFO.email

      const isSettlementReceipt = printData.title === 'PAYMENT SETTLEMENT RECEIPT' || printData.outstandingCleared
      const containerPadding = isSettlementReceipt ? '2px 1px 4px 1px' : '2px 1px 2px 1px'

      const printContent = `
        <div style="font-family: 'Courier New', Courier, monospace; width: 80mm; max-width: 80mm; margin: 0; padding: ${containerPadding}; box-sizing: border-box; font-size: 12px; line-height: 1.28; color: #000; background: #fff;">
          <div style="text-align: center; margin-bottom: 6px;">
            <img src="${resolvedLogoPath}" alt="${safeCompanyName}" style="max-width: 100%; width: ${logoSizes.cssWidth}; height: auto; filter: grayscale(100%); display: block; margin: 0 auto 4px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
            <div style="font-size: 15px; font-weight: 900; display: none; text-align: center; border: 2px solid #000; padding: 6px;">${safeCompanyName}</div>
            <div style="font-weight: 900; font-size: 16px; letter-spacing: 0.2px; margin-top: 2px; word-break: break-word; line-height: 1.2;">${printData.branchName || safeCompanyName}</div>
            <div style="font-size: 10px; margin-top: 2px;">${safeCompanyAddress.substring(0, 56)}</div>
            <div style="font-size: 10px;">Tel: ${safeCompanyPhone}</div>
            <div style="font-size: 10px; margin-bottom: 4px;">${safeCompanyEmail}</div>
            <div style="border-top: 1px dashed #000; margin: 4px 0 2px;"></div>
            <div style="font-weight: 900; text-transform: uppercase; font-size: 12px; margin: 2px 0; letter-spacing: 0.8px;">${printData.title || 'SALES RECEIPT'}</div>
            <div style="border-top: 1px dashed #000; margin: 2px 0 6px;"></div>
          </div>
          <div style="margin-bottom: 6px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="font-size: 11px; font-weight: 700;">Receipt #</span><span style="font-weight: 900; font-size: 11px;">${(printData.receiptNumber || 'N/A').substring(0, 22)}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="font-size: 11px; font-weight: 700;">Date/Time</span><span style="font-size: 11px;">${printData.date} ${printData.time || ''}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="font-size: 11px; font-weight: 700;">Cashier</span><span style="font-size: 11px;">${printData.cashierName || 'N/A'}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="font-size: 11px; font-weight: 700;">${printData.customerLabel || 'Customer'}</span><span style="font-size: 11px;">${printData.customerName || 'Walk-in Customer'}</span></div>
            ${printData.customerPhone ? `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="font-size: 11px; font-weight: 700;">Phone</span><span style="font-size: 11px;">${printData.customerPhone}</span></div>` : ''}
          </div>
          <div style="border-top: 2px solid #000; margin: 4px 0;"></div>
          <div style="margin-bottom: 4px;">
            <div style="display: flex; margin-bottom: 4px; font-weight: 900; border-bottom: 1px dashed #000; padding-bottom: 3px;">
              <div style="flex: 1; font-size: 11px; min-width: 0;">ITEM</div>
              <div style="width: 32px; flex-shrink: 0; text-align: right; font-size: 11px;">QTY</div>
              <div style="width: 52px; flex-shrink: 0; text-align: right; font-size: 11px;">PRICE</div>
              <div style="width: 52px; flex-shrink: 0; text-align: right; font-size: 11px;">TOTAL</div>
            </div>
            ${printData.items.map(item => {
              const qty = Number(item.quantity || 0)
              const unit = Number(item.unitPrice || item.price || 0)
              const disc = Number(item.discount || 0)
              const lineTotal = Number.isFinite(Number(item.total))
                ? Number(item.total)
                : Math.max(0, unit * qty - disc)
              return `
              <div style="margin-bottom: 5px; padding-bottom: 3px; border-bottom: 1px dotted #ccc;">
                <div style="font-weight: 800; margin-bottom: 1px; font-size: 11px;">${item.name || 'Unknown Item'}</div>
                <div style="display: flex;">
                  <div style="flex: 1; min-width: 0;"></div>
                  <div style="width: 32px; flex-shrink: 0; text-align: right; font-size: 11px; font-weight: 700;">${qty}</div>
                  <div style="width: 52px; flex-shrink: 0; text-align: right; font-size: 11px; font-weight: 700;">${Math.round(unit)}</div>
                  <div style="width: 52px; flex-shrink: 0; text-align: right; font-weight: 900; font-size: 11px;">${Math.round(lineTotal)}</div>
                </div>
                ${disc > 0 ? `<div style="font-size: 10px; color: #d32f2f; text-align: right; font-weight: 700;">Disc: -${Math.round(disc)}</div>` : ''}
              </div>
            `}).join('')}
          </div>
          <div style="border-top: 2px solid #000; margin: 4px 0;"></div>
          <div style="margin-bottom: 4px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="font-size: 11px; font-weight: 700;">Subtotal</span><span style="font-size: 11px; font-weight: 800;">${Math.round(printData.subtotal || 0)}</span></div>
            ${(() => {
              const itemDiscSum = (printData.items || []).reduce((s, it) => s + Number(it.discount || 0), 0)
              const cartDisc = Number(printData.discount || 0)
              let html = ''
              if (itemDiscSum > 0) {
                html += `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="font-size: 11px; font-weight: 700; color: #d32f2f;">Item Disc</span><span style="font-size: 11px; font-weight: 800; color: #d32f2f;">-${Math.round(itemDiscSum)}</span></div>`
              }
              if (cartDisc > 0) {
                html += `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="font-size: 11px; font-weight: 700; color: #d32f2f;">Discount</span><span style="font-size: 11px; font-weight: 800; color: #d32f2f;">-${Math.round(cartDisc)}</span></div>`
              }
              return html
            })()}
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="font-size: 11px; font-weight: 700;">Tax</span><span style="font-size: 11px; font-weight: 800;">${Math.round(printData.tax || 0)}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px; border-bottom: 1px dashed #000; padding-bottom: 3px;"><span style="font-size: 11px; font-weight: 700;">Invoice</span><span style="font-size: 11px; font-weight: 800;">${Math.round(printData.invoiceTotal !== undefined ? printData.invoiceTotal : ((printData.subtotal || 0) + (printData.tax || 0) - (printData.discount || 0)))}</span></div>
            ${(() => { const ob = Math.max(0, printData.oldBalance || 0); return ob > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="font-size: 11px; font-weight: 700;">Old Balance</span><span style="font-size: 11px; font-weight: 800;">${Math.round(ob)}</span></div>` : '' })()}
            <div style="border: 2px solid #000; margin: 6px 0; padding: 6px 4px; text-align: center;">
              <div style="font-weight: 900; font-size: 16px; letter-spacing: 0.5px;">TOTAL  ${(() => { const it = printData.invoiceTotal !== undefined ? printData.invoiceTotal : ((printData.subtotal || 0) + (printData.tax || 0) - (printData.discount || 0)); const ob = Math.max(0, printData.oldBalance || 0); return Math.round(it + ob) })()}</div>
            </div>
            <div style="border-top: 1px dashed #000; margin: 4px 0; padding-top: 4px;">
              <div style="font-weight: 900; font-size: 11px; margin-bottom: 3px;">PAYMENT</div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="font-size: 11px; font-weight: 700;">Method</span><span style="font-size: 11px; font-weight: 800;">${printData.paymentMethod || 'CASH'}</span></div>
            ${(() => {
              const it = printData.invoiceTotal !== undefined ? printData.invoiceTotal : ((printData.subtotal || 0) + (printData.tax || 0) - (printData.discount || 0))
              const ob = Math.max(0, printData.oldBalance || 0)
              const calcTotal = it + ob
              const pa = printData.paymentAmount || 0
              const ca = printData.creditAmount || 0
              const remaining = Math.max(0, (ob + it) - pa)
              const showRemaining = remaining > 0 || (ob > 0 && pa < calcTotal)
              const change = pa > calcTotal ? pa - calcTotal : 0
              return `
              <div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="font-size: 11px; font-weight: 700;">Paid</span><span style="font-size: 11px; font-weight: 800;">${Math.round(pa)}</span></div>
              ${(ca > 0 || printData.paymentMethod === 'FULLY_CREDIT') ? `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="font-size: 11px; font-weight: 700;">Credit</span><span style="font-size: 11px; font-weight: 800;">${Math.round(ca || calcTotal || 0)}</span></div>` : ''}
              ${showRemaining ? `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="font-size: 11px; font-weight: 900;">Remaining</span><span style="font-size: 11px; font-weight: 900;">${Math.round(remaining)}</span></div>` : ''}
              ${change > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;"><span style="font-size: 11px; font-weight: 700;">Change</span><span style="font-size: 11px; font-weight: 800;">${Math.round(change)}</span></div>` : ''}
              `
            })()}
            </div>
            ${printData.notes && printData.notes.trim() ? `<div style="margin-top: 4px; font-size: 10px; white-space: pre-line;"><strong>Notes:</strong> ${printData.notes}</div>` : ''}
          </div>
          <div style="text-align: center; margin-top: 6px;">
            <div style="border-top: 2px solid #000; margin-bottom: 4px;"></div>
            <div style="font-size: 11px; font-weight: 800; margin-bottom: 2px;">${printData.footerMessage || 'Thank you for choosing us!'}</div>
            <div style="font-size: 10px; margin-bottom: 3px;">Return within 3 days with receipt</div>
            <div style="border-top: 1px dashed #000; margin: 4px 0;"></div>
            <div style="font-size: 11px; font-weight: 700;">Powered by Tychora</div>
            <div style="font-size: 10px;">www.tychora.com</div>
          </div>
        </div>
      `

      const printWindow = window.open('', '_blank', 'width=400,height=600')
      if (!printWindow) throw new Error('Popup blocked. Please allow popups for this site to print receipts.')

      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt - ${printData.receiptNumber}</title>
            <style>@media print { body { margin: 0; } @page { margin: 0; size: 80mm auto; } }</style>
          </head>
          <body>${printContent}</body>
        </html>
      `)
      printWindow.document.close()

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Print window failed to load')), 3000)
        printWindow.onload = () => {
          clearTimeout(timeout)
          setTimeout(() => {
            try {
              printWindow.print()
              const afterPrintHandler = () => { printWindow.close(); resolve() }
              printWindow.addEventListener('afterprint', afterPrintHandler)
              setTimeout(() => {
                if (!printWindow.closed) {
                  printWindow.removeEventListener('afterprint', afterPrintHandler)
                  printWindow.close()
                }
                resolve()
              }, 5000)
            } catch (printError) {
              printWindow.close()
              reject(new Error(`Failed to open print dialog: ${printError.message}`))
            }
          }, 100)
        }
        setTimeout(() => {
          if (printWindow.document.readyState === 'complete') {
            clearTimeout(timeout)
            try {
              printWindow.print()
              setTimeout(() => { if (!printWindow.closed) printWindow.close(); resolve() }, 5000)
            } catch (error) {
              printWindow.close()
              reject(new Error(`Failed to print: ${error.message}`))
            }
          }
        }, 500)
      })

      return { success: true, message: 'Opened browser print dialog' }
    } catch (error) {
      return { success: false, message: error.message || 'Failed to open print dialog' }
    }
  }

  const attemptReceiptPrint = async (printData, contextLabel = 'receipt') => {
    let success = false
    let message = ''
    let usedBrowserFallback = false

    if (window.electronAPI?.printReceipt) {
      try {
        const electronResult = await window.electronAPI.printReceipt(printData)
        success = !!electronResult?.success
        message = electronResult?.message || ''
      } catch (electronError) {
        message = electronError?.message || 'Electron print error'
      }
    } else {
      try {
        setPrinterMode(PRINTER_MODE_DIRECT)
        const thermalResult = await printToThermalPrinter(printData, { allowPortRequest: true })
        success = !!thermalResult?.success
        message = thermalResult?.message || ''
      } catch (serialError) {
        // Do NOT open Chrome print dialog — that is what the user wants to avoid.
        message =
          serialError?.message ||
          'Silent thermal print failed. Connect USB or Serial/COM first.'
      }
    }

    return { success, message, usedBrowserFallback }
  }

  /**
   * Silent thermal print only — never opens the Chrome/OS print modal on sale confirm.
   * System Print (browser dialog) is NOT used here; connect USB/Serial for silent printing.
   */
  const printThermalReceiptDirect = async (printData, contextLabel = 'receipt') => {
    try {
      if (window.electronAPI?.printReceipt) {
        const electronResult = await window.electronAPI.printReceipt(printData)
        if (electronResult?.success) {
          showToast('Receipt printed successfully', 'success')
          return true
        }
      }

      // Always prefer silent USB/Serial ESC/POS (logo + aligned layout)
      setPrinterMode(PRINTER_MODE_DIRECT)
      const directReady = await hasDirectPrinterPaired()
      const thermalResult = await printToThermalPrinter(printData, {
        allowPortRequest: !directReady,
      })
      if (thermalResult?.success) {
        showToast(thermalResult.message || 'Receipt printed (no dialog)', 'success')
        await refreshPrinterStatus()
        return true
      }

      showToast(
        thermalResult?.message ||
          'Silent print failed. Click USB or Serial/COM to connect the Epson (System Print always shows the Chrome dialog).',
        'warning'
      )
      return false
    } catch (error) {
      if (error?.name === 'PrinterBlockedError' || /not in USB list|blocked/i.test(error?.message || '')) {
        setPrinterHelpMessage(error.message || getPrinterBlockedHelp())
        setShowPrinterHelpDialog(true)
      }
      showToast(
        error?.message ||
          'Could not silent-print. Connect USB (or Serial/COM). Chrome System Print cannot print without a dialog.',
        'warning'
      )
      return false
    }
  }

  const printReceipt = async () => {
    if (isProcessingSale) return
    setIsProcessingSale(true)

    try {
      if (user.role === 'ADMIN' && !isAdminMode) {
        alert('Please select a branch or warehouse from the Admin Dashboard to simulate a role before making sales.')
        return
      }
      if ((isPartialPayment || isFullyCredit) && (!customerName || !customerPhone)) {
        alert('❌ Customer name and phone number are required for partial payments and credit sales.')
        return
      }
      if (!user) { alert('❌ User not authenticated. Please login again.'); return }
      if (!currentCart || currentCart.length === 0) {
        alert('❌ Cart is empty. Please add items before printing receipt.')
        return
      }

      const selectedOutstandingTotal = outstandingPayments
        .filter(payment => selectedOutstandingPayments.includes(payment.id))
        .reduce((total, payment) => {
          const amount = payment.creditAmount !== undefined && payment.creditAmount !== null
            ? parseFloat(payment.creditAmount)
            : (payment.total !== undefined && payment.total !== null
              ? parseFloat(payment.total)
              : parseFloat(payment.outstandingAmount || 0) * (payment.isCredit ? -1 : 1))
          return total + (Number.isFinite(amount) ? amount : 0)
        }, 0)

      const totalWithOutstanding = billAmount + selectedOutstandingTotal

      let finalPaymentAmount, finalCreditAmount
      if (isFullyCredit) {
        finalPaymentAmount = 0; finalCreditAmount = totalWithOutstanding
      } else if (isBalancePayment) {
        finalPaymentAmount = 0; finalCreditAmount = totalWithOutstanding
      } else if (isPartialPayment) {
        finalPaymentAmount = parseFloat(paymentAmount) || 0
        finalCreditAmount = totalWithOutstanding - finalPaymentAmount
      } else {
        finalPaymentAmount = totalWithOutstanding; finalCreditAmount = 0
      }

      const finalPaymentStatus = (isFullyCredit || finalCreditAmount > 0) ? 'PENDING' : 'COMPLETED'

      const saleData = {
        scopeType: user.role === 'CASHIER' ? 'BRANCH' : 'WAREHOUSE',
        scopeId: user.role === 'CASHIER' ? String(user.branchId) : String(user.warehouseId),
        subtotal, tax, discount: totalDiscount,
        total: parseFloat(totalWithOutstanding),
        paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod.toUpperCase(),
        paymentType: isPartialPayment ? 'PARTIAL_PAYMENT' : (isFullyCredit ? 'FULLY_CREDIT' : 'FULL_PAYMENT'),
        paymentAmount: finalPaymentAmount,
        creditAmount: finalCreditAmount,
        paymentStatus: finalPaymentStatus,
        status: 'COMPLETED',
        customerInfo: { name: customerName || '', email: '', phone: customerPhone || '', address: '' },
        notes: notes || `POS Terminal Print Receipt - Tab: ${currentTab?.name || 'Unknown'}`,
        items: currentCart.map(mapCartLineForSale)
      }

      const result = await dispatch(createSale({ ...saleData, __idempotencyKey: makeSaleIdempotencyKey() }))

      if (createSale.fulfilled.match(result)) {
        const sale = result.payload.data || result.payload
        const printableItems = currentCart.map((cartItem) =>
          normalizeCartItemForPrint({ ...cartItem, customPrice: cartItem?.customPrice ?? cartItem?.price ?? cartItem?.sellingPrice })
        )

        const receiptPrintData = {
          type: 'receipt',
          title: 'SALES RECEIPT',
          companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
          companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
          companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
          companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
          logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
          receiptNumber: sale.invoice_no || `POS-${Date.now()}`,
          date: formatDisplayDate(new Date()),
          time: new Date().toLocaleTimeString(),
          cashierName: user?.name || user?.username || 'Cashier',
          customerName: customerName || 'Walk-in Customer',
          customerPhone: customerPhone || '',
          items: printableItems,
          subtotal: Math.round(subtotal),
          tax: Math.round(tax),
          discount: Math.round(totalDiscount),
          invoiceTotal: Math.round(billAmount),
          total: Math.round(totalWithOutstanding),
          paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod,
          paymentAmount: Math.round(finalPaymentAmount),
          creditAmount: Math.round(finalCreditAmount),
          oldBalance: Math.round(selectedOutstandingTotal || 0),
          remainingBalance: Math.round(Math.max(0, totalWithOutstanding - finalPaymentAmount)),
          change: isPartialPayment ? 0 : Math.round((parseFloat(paymentAmount) || finalPaymentAmount) - totalWithOutstanding),
          notes: isPartialPayment ? `Partial Payment - Credit Amount: ${finalCreditAmount.toFixed(2)}` : '',
          footerMessage: 'Thank you for choosing us!'
        }

        setPrintData(receiptPrintData)
        await printThermalReceiptDirect(receiptPrintData, 'POS receipt')
        updateCurrentTab({ cart: [], customerName: '', customerPhone: '' })
        setCustomerName('')
        setCustomerPhone('')
        setPaymentAmount('')
        setCreditAmount('')
        setIsPartialPayment(false)

      } else if (createSale.rejected.match(result)) {
        const error = result.payload || result.error
        let errorMessage = 'Sale creation failed. Please try again.'
        if (typeof error === 'string') errorMessage = error
        else if (error?.message) errorMessage = error.message
        alert(`❌ Print receipt failed!\n\nError: ${errorMessage}`)
      } else {
        alert('❌ Print receipt failed!\n\nUnexpected error occurred. Please try again.')
      }
    } catch (error) {
      alert(`❌ Print receipt error: ${error.message}`)
    } finally {
      setIsProcessingSale(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (e.target === barcodeInputRef.current && barcodeInput.trim()) handleBarcodeScan(barcodeInput.trim())
    }
    if (e.ctrlKey && e.key === 't') { e.preventDefault(); createNewTab() }
    if (e.ctrlKey && e.key === 'w') { e.preventDefault(); if (activeTabId) closeTab(activeTabId) }
  }

  const TabComponent = ({ tab, isActive, onClose, onClick }) => {
    const itemCount = tab.cart.reduce((sum, item) => sum + item.quantity, 0)
    const hasItems = itemCount > 0

    return (
      <Paper
        sx={{
          display: 'flex',
          alignItems: 'center',
          minWidth: 150,
          maxWidth: 200,
          cursor: 'pointer',
          bgcolor: isActive ? theme.palette.primary.main : theme.palette.background.paper,
          color: isActive ? theme.palette.primary.contrastText : theme.palette.text.primary,
          border: `1px solid ${isActive ? theme.palette.primary.main : theme.palette.divider}`,
          borderBottom: isActive ? 'none' : `1px solid ${theme.palette.divider}`,
          borderRadius: '8px 8px 0 0',
          position: 'relative',
          zIndex: isActive ? 2 : 1,
          transition: 'all 0.2s ease-in-out',
          '&:hover': { bgcolor: isActive ? theme.palette.primary.dark : alpha(theme.palette.primary.main, 0.1) }
        }}
        onClick={onClick}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, p: 1 }}>
          <TabIcon sx={{ mr: 1, fontSize: 14 }} />
          <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {tab.name}
          </Typography>
          {hasItems && (
            <Badge badgeContent={itemCount} color="secondary" sx={{ mr: 1 }}>
              <CartIcon sx={{ fontSize: 16 }} />
            </Badge>
          )}
        </Box>
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onClose() }}
          sx={{
            color: isActive ? theme.palette.primary.contrastText : theme.palette.text.secondary,
            '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2), color: theme.palette.error.main }
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Paper>
    )
  }

  return (
    <RouteGuard allowedRoles={['CASHIER', 'ADMIN', 'MANAGER']}>
      {isAdminMode && scopeInfo && (
        <Box sx={{ bgcolor: 'warning.light', color: 'warning.contrastText', p: 1, textAlign: 'center', borderBottom: 1, borderColor: 'warning.main' }}>
          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
            🔧 ADMIN MODE: Operating as {scopeInfo.scopeType === 'BRANCH' ? 'Cashier' : 'Warehouse Keeper'} for {scopeInfo.scopeName}
          </Typography>
        </Box>
      )}

      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'grey.50', overflow: 'auto' }}>

        {/* Search Bar — products + clinic services in one bill */}
        <Paper sx={{ mb: 1, p: 1, bgcolor: theme.palette.background.default, position: 'relative' }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <TextField
                ref={manualInputRef}
                fullWidth
                size="small"
                label="Search products & clinic services"
                value={manualInput}
                onChange={(e) => { setManualInput(e.target.value); handleManualSearch(e.target.value) }}
                onKeyDown={handleManualSearchKeyDown}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'primary.main', fontSize: 18 }} />,
                  sx: { fontFamily: 'monospace', fontSize: '0.9rem' }
                }}
                placeholder="Type product name, SKU, barcode, or service..."
              />
              {showSearchResults && searchResults.length > 0 && (
                <Paper ref={searchDropdownRef} sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, maxHeight: 300, overflowY: 'auto', mt: 1, boxShadow: 3, border: `1px solid ${theme.palette.divider}` }}>
                  {searchResults.map((product, index) => (
                    <Box
                      key={product.id}
                      data-search-item
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setSearchHighlightedIndex(index)}
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        bgcolor: index === searchHighlightedIndex ? alpha(theme.palette.primary.main, 0.15) : 'transparent',
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
                        '&:last-child': { borderBottom: 'none' },
                      }}
                      onClick={() => selectSearchResult(product)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {product.name} — {product.price}
                        </Typography>
                        <Chip
                          size="small"
                          icon={product.isService ? <ClinicIcon sx={{ fontSize: '14px !important' }} /> : <InventoryIcon sx={{ fontSize: '14px !important' }} />}
                          label={product.isService ? 'Clinic' : 'Product'}
                          color={product.isService ? 'info' : 'default'}
                          sx={{ height: 22, fontSize: '0.7rem' }}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {product.isService
                          ? `${product.category || 'Clinic'} · Default: ${product.defaultPrice ?? product.price}`
                          : `${product.category || 'Uncategorized'} · Stock: ${product.stock} ${product.unit || 'units'}`}
                      </Typography>
                    </Box>
                  ))}
                </Paper>
              )}
              {showSearchResults && searchResults.length === 0 && searchQuery.length >= 2 && (
                <Paper sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, mt: 1, boxShadow: 3, border: `1px solid ${theme.palette.divider}`, p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No products or services found for &quot;{searchQuery}&quot;</Typography>
                </Paper>
              )}
            </Box>
            <TextField
              select
              size="small"
              label="Category"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value)
                if (manualInput.length >= 2) handleManualSearch(manualInput)
              }}
              SelectProps={{ startAdornment: <CategoryIcon sx={{ mr: 1, color: 'primary.main', fontSize: 18 }} /> }}
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="all">All Categories</MenuItem>
              {getCategories().map((category) => (
                <MenuItem key={category.id} value={category.id}>{category.label}</MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              ref={barcodeInputRef}
              fullWidth
              size="small"
              label="Scan Barcode or Enter Code"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyPress={handleKeyPress}
              InputProps={{ startAdornment: <ScannerIcon sx={{ mr: 1, color: 'primary.main', fontSize: 18 }} />, sx: { fontFamily: 'monospace', fontSize: '0.9rem' } }}
              placeholder="Scan or type barcode..."
              sx={{ flex: 1 }}
              autoFocus
            />
            <Tooltip title={`Scanner Status: ${scannerStatus.connected ? 'Connected' : 'Not Detected'} | Scans: ${scannerStatus.scanCount}`}>
              <Chip
                icon={scannerStatus.connected ? <CheckIcon /> : <ErrorIcon />}
                label={scannerStatus.connected ? 'Scanner OK' : 'No Scanner'}
                color={scannerStatus.connected ? 'success' : 'error'}
                size="small"
                variant="outlined"
              />
            </Tooltip>
            <Tooltip title={printerStatus.message}>
              <Chip
                icon={printerStatus.connected ? <CheckIcon /> : <ErrorIcon />}
                label={
                  printerStatus.transport === 'serial'
                    ? 'Serial OK'
                    : printerStatus.transport === 'usb'
                      ? 'USB OK'
                      : printerStatus.mode === 'system'
                        ? 'System Print'
                        : printerStatus.connected
                          ? 'Printer OK'
                          : 'No Printer'
                }
                color={printerStatus.connected ? 'success' : 'warning'}
                size="small"
                variant="outlined"
              />
            </Tooltip>
            {isWebUsbSupported() && (
              <Button
                variant="outlined"
                size="small"
                startIcon={printerStatus.connecting ? <CircularProgress size={14} /> : <PrintIcon />}
                onClick={handleConnectUsb}
                disabled={printerStatus.connecting}
                sx={{ fontFamily: 'monospace', minWidth: 100, height: 40, whiteSpace: 'nowrap' }}
              >
                {printerStatus.connecting ? '...' : 'USB'}
              </Button>
            )}
            {isWebSerialSupported() && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<PrintIcon />}
                onClick={handleConnectSerial}
                disabled={printerStatus.connecting}
                sx={{ fontFamily: 'monospace', minWidth: 110, height: 40, whiteSpace: 'nowrap' }}
              >
                Serial/COM
              </Button>
            )}
            <Button
              variant="outlined"
              size="small"
              startIcon={printerStatus.connecting ? <CircularProgress size={14} /> : <PrintIcon />}
              onClick={handleConnectPrinter}
              disabled={printerStatus.connecting}
              sx={{ fontFamily: 'monospace', minWidth: 100, height: 40, whiteSpace: 'nowrap' }}
            >
              {printerStatus.connecting ? '...' : 'Auto'}
            </Button>
            <Button
              variant="contained"
              color="secondary"
              size="small"
              startIcon={<PrintIcon />}
              onClick={handleUseSystemPrinter}
              sx={{ fontFamily: 'monospace', minWidth: 120, height: 40, whiteSpace: 'nowrap' }}
              title="Opens Chrome print dialog (cannot be silent). Prefer USB/Serial for no-dialog print."
            >
              System Print
            </Button>
            <Button variant="contained" size="small" onClick={() => handleBarcodeScan(barcodeInput)} disabled={!barcodeInput.trim()} sx={{ fontFamily: 'monospace', minWidth: 100, height: 40 }}>
              ADD PRODUCT
            </Button>
            <Button variant="outlined" size="small" onClick={() => router.push('/dashboard/inventory')} sx={{ fontFamily: 'monospace', minWidth: 100, height: 40 }}>
              <InventoryIcon sx={{ mr: 1, fontSize: 18 }} />INVENTORY
            </Button>
          </Box>
        </Paper>

        {/* Tab Bar */}
        <Paper sx={{ mb: 2, p: 1, bgcolor: theme.palette.background.default, position: 'relative', zIndex: 10 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 50 }}>
            <Box sx={{ display: 'flex', gap: 0.5, flex: 1, overflowX: 'auto', overflowY: 'hidden', '&::-webkit-scrollbar': { height: 4 }, '&::-webkit-scrollbar-track': { background: 'transparent' }, '&::-webkit-scrollbar-thumb': { background: theme.palette.divider, borderRadius: 2 } }}>
              {tabs.map((tab) => (
                <TabComponent key={tab.id} tab={tab} isActive={tab.id === activeTabId} onClick={() => switchToTab(tab.id)} onClose={() => closeTab(tab.id)} />
              ))}
            </Box>
            <Tooltip title="New Tab (Ctrl+T)">
              <IconButton onClick={createNewTab} sx={{ bgcolor: theme.palette.primary.main, color: theme.palette.primary.contrastText, minWidth: 32, minHeight: 32, '&:hover': { bgcolor: theme.palette.primary.dark } }}>
                <NewTabIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>

        <Box sx={{ display: 'flex', gap: 1, flex: 1, minHeight: '500px', position: 'relative', zIndex: 1 }}>
          {/* Left Panel */}
          <Paper sx={{ p: 1, width: '30%', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, minHeight: '500px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle1" gutterBottom sx={{ fontFamily: 'monospace' }}>PRODUCT SEARCH</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Settings">
                  <IconButton onClick={() => setShowSettings(true)} size="small"><SettingsIcon /></IconButton>
                </Tooltip>
                <Tooltip title="Refresh Inventory">
                  <IconButton onClick={() => dispatch(fetchInventory())} size="small"><RefreshIcon /></IconButton>
                </Tooltip>
              </Box>
            </Box>

            <Box sx={{ position: 'relative', mb: 1 }}>
              <TextField
                fullWidth
                size="small"
                label="Customer Name (Optional)"
                value={customerName}
                placeholder="Type name to search customers..."
                onChange={(e) => {
                  const value = e.target.value
                  setCustomerName(value)
                  triggerCustomerSearch(value)
                }}
                onFocus={() => {
                  if (customerName.trim().length >= 2) triggerCustomerSearch(customerName)
                }}
                onBlur={() => {
                  setTimeout(() => {
                    setShowCustomerSearch(false)
                    setCustomerHighlightedIndex(-1)
                  }, 150)
                }}
                onKeyDown={(e) => {
                  if (!showCustomerSearch || customerSearchResults.length === 0) return
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setCustomerHighlightedIndex((prev) => {
                      const next = (prev + 1) % customerSearchResults.length
                      setTimeout(() => {
                        if (customerDropdownRef.current) {
                          const items = customerDropdownRef.current.querySelectorAll('[data-customer-item]')
                          if (items[next]) items[next].scrollIntoView({ block: 'nearest' })
                        }
                      }, 0)
                      return next
                    })
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setCustomerHighlightedIndex((prev) => {
                      const next = prev <= 0 ? customerSearchResults.length - 1 : prev - 1
                      setTimeout(() => {
                        if (customerDropdownRef.current) {
                          const items = customerDropdownRef.current.querySelectorAll('[data-customer-item]')
                          if (items[next]) items[next].scrollIntoView({ block: 'nearest' })
                        }
                      }, 0)
                      return next
                    })
                  } else if (e.key === 'Enter' && customerHighlightedIndex >= 0) {
                    e.preventDefault()
                    selectCustomer(customerSearchResults[customerHighlightedIndex])
                  } else if (e.key === 'Escape') {
                    setShowCustomerSearch(false)
                    setCustomerHighlightedIndex(-1)
                  }
                }}
                InputProps={{
                  endAdornment: customerSearchLoading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null,
                }}
              />
              {(showCustomerSearch || customerSearchLoading) && customerName.trim().length >= 2 && (
                <Paper
                  ref={customerDropdownRef}
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1400,
                    maxHeight: 220,
                    overflowY: 'auto',
                    boxShadow: 4,
                    border: '1px solid',
                    borderColor: 'primary.main',
                    borderRadius: '0 0 8px 8px',
                  }}
                >
                  {customerSearchLoading && customerSearchResults.length === 0 ? (
                    <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CircularProgress size={14} />
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>Searching customers...</Typography>
                    </Box>
                  ) : customerSearchResults.length === 0 ? (
                    <Typography variant="caption" sx={{ p: 1.5, display: 'block', fontFamily: 'monospace', color: 'text.secondary' }}>
                      No matching customers
                    </Typography>
                  ) : (
                    customerSearchResults.map((customer, index) => (
                      <Box
                        key={customer.id || index}
                        data-customer-item
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectCustomer(customer)}
                        onMouseEnter={() => setCustomerHighlightedIndex(index)}
                        sx={{
                          p: 1,
                          cursor: 'pointer',
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          bgcolor: index === customerHighlightedIndex ? 'action.selected' : 'transparent',
                          '&:hover': { bgcolor: 'action.hover' },
                          '&:last-child': { borderBottom: 'none' },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {customer.name}
                        </Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', display: 'block' }}>
                          Phone: {customer.phone || 'N/A'}
                          {customer.totalSales > 0 ? ` | Sales: ${customer.totalSales}` : ''}
                          {customer.lastSale ? ` | Last: ${formatDisplayDate(customer.lastSale)}` : ''}
                          {Number.isFinite(customer.balance) ? ` | Bal: ${customer.balance.toFixed(0)}` : ''}
                        </Typography>
                      </Box>
                    ))
                  )}
                </Paper>
              )}
            </Box>

            <TextField
              fullWidth
              size="small"
              label="Customer Phone (Optional)"
              value={customerPhone}
              onChange={(e) => {
                setCustomerPhone(e.target.value)
                if (e.target.value.trim().length >= 2) triggerCustomerSearch(e.target.value)
              }}
              sx={{ mb: 1, fontFamily: 'monospace' }}
              placeholder="Enter customer phone number..."
              type="tel"
            />

            {((customerPhone && customerPhone.trim().length >= 3) || (customerName && customerName.trim().length >= 3)) && (
              <Card sx={{ mb: 2, border: '1px solid', borderColor: 'warning.main' }}>
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <OutstandingIcon sx={{ mr: 1, color: 'warning.main' }} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'warning.main' }}>Outstanding Payments</Typography>
                      {isSearchingOutstanding && <CircularProgress size={16} sx={{ ml: 1 }} />}
                    </Box>
                    <IconButton size="small" onClick={() => { if ((customerPhone?.trim().length >= 3) || (customerName?.trim().length >= 3)) searchOutstandingPayments(customerPhone?.trim(), customerName?.trim()) }} disabled={isSearchingOutstanding} sx={{ color: 'warning.main' }}>
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  {outstandingPayments.length > 0 ? (
                    <>
                      {selectedOutstandingPayments.length > 0 ? (
                        <Box sx={{ mb: 2, p: 1, bgcolor: 'success.light', borderRadius: 1, border: '1px solid', borderColor: 'success.main' }}>
                          <Typography variant="body2" sx={{ color: 'success.dark', fontWeight: 'bold' }}>
                            ✓ {selectedOutstandingPayments.length} Outstanding Payment{selectedOutstandingPayments.length > 1 ? 's' : ''} Selected
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'success.dark' }}>
                            Total: {outstandingTotal.toFixed(2)} - Will be settled with this transaction
                            {outstandingTotal < 0 && <span style={{ fontWeight: 'bold' }}> (Customer has {Math.abs(outstandingTotal).toFixed(2)} credit)</span>}
                          </Typography>
                          {currentCart.length === 0 && (
                            <Typography variant="caption" sx={{ color: 'info.dark', display: 'block', mt: 0.5 }}>
                              💡 No items in cart - Click &quot;SETTLE&quot; to process outstanding payments only
                            </Typography>
                          )}
                          {currentCart.length > 0 && (
                            <Typography variant="caption" sx={{ color: 'info.dark', display: 'block', mt: 0.5 }}>
                              💡 Selected outstanding payments will be applied with this sale
                            </Typography>
                          )}
                          {currentCart.length === 0 && !showSettlementOptions && (
                            <Box sx={{ mt: 1 }}>
                              <Button size="small" variant="outlined" onClick={() => { setShowSettlementOptions(true); setIsSettlementPartial(false); setIsSettlementFullyCredit(false); setSettlementPaymentAmount(settlementTotal.toFixed(2)); setSettlementCreditAmount('0') }}>
                                Manage Settlement
                              </Button>
                            </Box>
                          )}
                        </Box>
                      ) : (
                        <Box sx={{ mb: 2, p: 1, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 1, border: '1px dashed', borderColor: 'warning.main' }}>
                          <Typography variant="body2" sx={{ color: 'warning.dark', fontWeight: 'bold' }}>Select outstanding payments to include in this transaction</Typography>
                          <Typography variant="caption" sx={{ color: 'warning.dark' }}>Use the checkboxes below to choose which balances you want to settle.</Typography>
                        </Box>
                      )}
                      <List dense>
                        {outstandingPayments.map((payment) => (
                          <ListItem key={payment.id} sx={{ px: 0 }}>
                            <FormControlLabel
                              control={<Checkbox checked={selectedOutstandingPayments.includes(payment.id)} onChange={() => handleOutstandingPaymentToggle(payment.id)} size="small" />}
                              label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body2">{payment.isCredit ? 'CREDIT' : 'OUTSTANDING'}: {payment.invoice_no}</Typography>
                                  <Chip
                                    label={payment.isCredit ? `-${parseFloat(payment.outstandingAmount || 0).toFixed(2)}` : `${parseFloat(payment.outstandingAmount || 0).toFixed(2)}`}
                                    size="small"
                                    color={payment.isCredit ? "error" : "warning"}
                                    variant="filled"
                                    sx={{ bgcolor: payment.isCredit ? 'error.light' : 'warning.light', color: payment.isCredit ? 'error.dark' : 'warning.dark', fontWeight: 'bold' }}
                                  />
                                  <Typography variant="caption" color="text.secondary">{payment.isCredit ? 'Credit Balance' : 'Amount Due'}</Typography>
                                </Box>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </>
                  ) : !isSearchingOutstanding ? (
                    <Typography variant="body2" color="text.secondary">No outstanding balance found for this customer.</Typography>
                  ) : null}
                </CardContent>
              </Card>
            )}

            <TextField fullWidth size="small" select label="Payment Method" value={paymentMethod} disabled={isFullyCredit} onChange={(e) => setPaymentMethod(e.target.value)} sx={{ mb: 1, fontFamily: 'monospace' }}>
              <MenuItem value="CASH">Cash</MenuItem>
              <MenuItem value="CARD">Card</MenuItem>
              <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>
              <MenuItem value="MOBILE_PAYMENT">Mobile Payment</MenuItem>
              <MenuItem value="CHEQUE">Cheque</MenuItem>
              <MenuItem value="MOBILE_MONEY">Mobile Money</MenuItem>
              <MenuItem value="FULLY_CREDIT">Fully Credit</MenuItem>
            </TextField>

            {user?.role === 'WAREHOUSE_KEEPER' && salespeople.length > 0 && (
              <TextField fullWidth size="small" select label="Salesperson (Who brought this sale)" value={selectedSalesperson?.id || ''} onChange={(e) => setSelectedSalesperson(salespeople.find(sp => sp.id === parseInt(e.target.value)))} sx={{ mb: 1, fontFamily: 'monospace' }}>
                <MenuItem value=""><em>Select Salesperson</em></MenuItem>
                {salespeople.map((sp) => <MenuItem key={sp.id} value={sp.id}>{sp.name} ({sp.phone})</MenuItem>)}
              </TextField>
            )}

            {/* Payment Type Selection */}
            <Box sx={{ mb: 2, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, fontFamily: 'monospace', fontWeight: 'bold', color: 'primary.main' }}>Payment Type Selection</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant={!isPartialPayment && !isFullyCredit && !isBalancePayment ? 'contained' : 'outlined'} size="small" onClick={() => { setIsPartialPayment(false); setIsFullyCredit(false); setIsBalancePayment(false); setPaymentAmount(''); setCreditAmount(''); setPaymentMethod('CASH'); handleSettlementPaymentType('full') }} sx={{ fontFamily: 'monospace', flex: 1 }}>Full Payment</Button>
                <Button variant={isPartialPayment ? 'contained' : 'outlined'} size="small" onClick={() => { setIsPartialPayment(true); setIsFullyCredit(false); setIsBalancePayment(false); if (!paymentAmount) setPaymentAmount(''); if (!creditAmount) setCreditAmount(total.toFixed(2)); if (selectedOutstandingPayments.length > 0) handleSettlementPaymentType('partial') }} sx={{ fontFamily: 'monospace', flex: 1 }}>Partial Payment</Button>
                <Button variant={isFullyCredit ? 'contained' : 'outlined'} size="small" onClick={() => {
                  setIsPartialPayment(false)
                  setIsFullyCredit(true)
                  setIsBalancePayment(false)
                  setPaymentMethod('FULLY_CREDIT')
                  setPaymentAmount('0')
                  setCreditAmount(total.toString())
                  // With cart items, old outstanding is rolled into this credit sale — do not open settlement-only flow.
                  if (currentCart.length === 0 && selectedOutstandingPayments.length > 0) {
                    handleSettlementPaymentType('fullyCredit')
                  } else {
                    setShowSettlementOptions(false)
                    setIsSettlementFullyCredit(false)
                    setIsSettlementPartial(false)
                  }
                }} sx={{ fontFamily: 'monospace', flex: 1 }}>Fully Credit</Button>
                <Button variant={isBalancePayment ? 'contained' : 'outlined'} size="small" disabled={outstandingTotal >= 0} onClick={() => { setIsPartialPayment(false); setIsFullyCredit(false); setIsBalancePayment(true); setPaymentAmount('0'); setCreditAmount(billAmount.toString()); handleSettlementPaymentType('balance') }} sx={{ fontFamily: 'monospace', flex: 1 }}>Balance</Button>
              </Box>
            </Box>

            {isBalancePayment && (
              <Box sx={{ mb: 2, p: 3, bgcolor: alpha(theme.palette.success.main, 0.15), borderRadius: 2, border: '2px solid', borderColor: 'success.main' }}>
                <Typography variant="h6" sx={{ mb: 2, color: 'success.main', fontWeight: 'bold' }}>💰 Using Balance Payment</Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>Current Purchase Amount</Typography>
                  <Typography variant="h6" color="primary.main" fontWeight="bold">{parseFloat(billAmount).toFixed(2)}</Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>Available Credit Balance</Typography>
                  <Typography variant="h6" color="success.main" fontWeight="bold">{Math.abs(outstandingTotal).toFixed(2)}</Typography>
                </Box>
                <Box sx={{ mb: 2, p: 2, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>Remaining Balance After This Purchase</Typography>
                  <Typography variant="h6" color={outstandingTotal + billAmount < 0 ? 'error.main' : 'success.main'} fontWeight="bold">{(outstandingTotal + billAmount).toFixed(2)}</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">Payment Amount: 0 (using balance) | Credit: {parseFloat(billAmount).toFixed(2)}</Typography>
              </Box>
            )}

            {currentCart.length === 0 && selectedOutstandingPayments.length > 0 && showSettlementOptions && (
              <Box sx={{ mb: 2, p: 3, bgcolor: alpha(theme.palette.info.main, 0.15), borderRadius: 2, border: '2px solid', borderColor: 'info.main' }}>
                <Typography variant="h6" sx={{ mb: 2, color: 'info.main', fontWeight: 'bold' }}>
                  {settlementSnapshot.isCredit ? '💰 Customer Credit Refund' : '💰 Settlement Payment'}
                </Typography>
                <Box sx={{ mb: 2, p: 2, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {settlementSnapshot.isCredit ? 'Available Credit Balance' : 'Total Outstanding Amount'}
                  </Typography>
                  <Typography variant="h5" color={settlementSnapshot.isCredit ? 'success.main' : 'warning.main'} fontWeight="bold">
                    {settlementSnapshot.isCredit ? `-${Math.abs(settlementSnapshot.baseOutstanding).toFixed(2)}` : `${settlementSnapshot.baseOutstanding.toFixed(2)}`}
                  </Typography>
                  {settlementSnapshot.isCredit && <Typography variant="caption" color="success.dark">Customer will receive cash back when refunded</Typography>}
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {settlementSnapshot.isCredit ? 'Refund Options:' : 'Settlement Type:'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button variant={!isSettlementPartial && !isSettlementFullyCredit ? 'contained' : 'outlined'} size="small" onClick={() => handleSettlementPaymentType('full')} sx={{ fontFamily: 'monospace' }} color={settlementSnapshot.isCredit ? "success" : "primary"}>
                      {settlementSnapshot.isCredit ? 'Full Refund' : 'Full Settlement'}
                    </Button>
                    <Button variant={isSettlementPartial ? 'contained' : 'outlined'} size="small" onClick={() => handleSettlementPaymentType('partial')} sx={{ fontFamily: 'monospace' }}>
                      {settlementSnapshot.isCredit ? 'Partial Refund' : 'Partial Settlement'}
                    </Button>
                    <Button variant={isSettlementFullyCredit ? 'contained' : 'outlined'} size="small" onClick={() => handleSettlementPaymentType('fullyCredit')} disabled={settlementSnapshot.isCredit} sx={{ fontFamily: 'monospace' }}>
                      Credit Note
                    </Button>
                    <Tooltip title="Open full settlement page with this customer pre-filled">
                      <Button
                        variant="text"
                        size="small"
                        startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                        onClick={() => {
                          const phone = customerPhone || ''
                          const name = customerName || ''
                          const params = new URLSearchParams()
                          if (phone) params.append('phone', phone)
                          if (name) params.append('name', name)
                          router.push(`/dashboard/settlements?${params.toString()}`)
                        }}
                        sx={{ fontSize: '0.72rem', color: 'text.secondary', whiteSpace: 'nowrap' }}
                      >
                        Open Settlement Page
                      </Button>
                    </Tooltip>
                  </Box>
                </Box>
                {(isSettlementPartial || isSettlementFullyCredit) && (
                  <Box sx={{ mb: 2 }}>
                    <TextField fullWidth size="small" label={isSettlementFullyCredit ? "Payment Amount" : (settlementSnapshot.isCredit ? "Refund Amount" : "Payment Amount (Paid Now)")} value={settlementPaymentAmount} onChange={(e) => handleSettlementPaymentChange(e.target.value)} sx={{ mb: 1 }} type="number" inputProps={{ min: 0, step: 0.01 }} />
                    <TextField fullWidth size="small" label={isSettlementFullyCredit ? "Credit Note Amount" : (settlementSnapshot.isCredit ? "Remaining Credit" : "Remaining Balance")} value={isSettlementFullyCredit ? settlementCreditAmount : settlementBalanceValue.toFixed(2)} disabled={!isSettlementFullyCredit} onChange={(e) => handleSettlementCreditChange(e.target.value)} sx={{ mb: 1 }} />
                    <Box sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'info.main' }}>
                        {settlementSnapshot.isCredit
                          ? `💰 Credit Before: ${Math.abs(settlementBaseAmount).toFixed(2)} | 💵 Refund: ${settlementPaymentValue.toFixed(2)} | 🧾 Remaining Credit: ${Math.abs(settlementBalanceValue).toFixed(2)}`
                          : `💰 Outstanding Before: ${settlementBaseAmount.toFixed(2)} | 💵 Paid: ${settlementPaymentValue.toFixed(2)} | 🧾 Balance After: ${settlementBalanceValue.toFixed(2)}`}
                      </Typography>
                    </Box>
                  </Box>
                )}
                <Box sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, 0.1), borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                    {settlementSnapshot.isCredit ? `Refund Amount: ${Math.abs(settlementSnapshot.paymentAmount).toFixed(2)}` : `Final Settlement Amount: ${settlementSnapshot.paymentAmount.toFixed(2)}`}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'success.dark' }}>
                    {settlementSnapshot.isCredit
                      ? `Remaining Credit After: ${(settlementSnapshot.baseOutstanding + settlementSnapshot.paymentAmount).toFixed(2)}`
                      : `Balance After Settlement: ${settlementSnapshot.creditAmount.toFixed(2)}`}
                  </Typography>
                </Box>
              </Box>
            )}

            {(isPartialPayment || isFullyCredit) && !(currentCart.length === 0 && showSettlementOptions) && (
              <Box sx={{ mb: 2, p: 3, bgcolor: alpha(theme.palette.warning.main, 0.15), borderRadius: 2, border: '2px solid', borderColor: 'warning.main' }}>
                <Typography variant="h6" sx={{ mb: 2, color: 'warning.main', fontWeight: 'bold' }}>
                  {isFullyCredit ? '💳 Fully Credit Details' : '💰 Partial Payment Details'}
                </Typography>
                <TextField
                  fullWidth size="small"
                  label={isFullyCredit ? "Payment Amount (Not Applicable)" : "Payment Amount (Paid Now)"}
                  value={isFullyCredit ? "0.00" : (paymentAmount || '')}
                  placeholder="0"
                  type="number"
                  color="warning"
                  disabled={isFullyCredit}
                  inputProps={{ min: 0, step: 0.01 }}
                  onChange={(e) => {
                    if (isFullyCredit) return
                    const inputValue = e.target.value
                    if (inputValue === '') { setPaymentAmount(''); setCreditAmount(total.toString()); return }
                    const amount = Math.floor(parseFloat(inputValue) || 0)
                    setPaymentAmount(amount.toString())
                    setCreditAmount(Math.floor(total - amount).toString())
                  }}
                  onWheel={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onKeyDown={(e) => { if (['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); e.stopPropagation() } }}
                  sx={{ mb: 1, fontFamily: 'monospace', '& input[type=number]': { MozAppearance: 'textfield', WebkitAppearance: 'none' }, '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 }, '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 } }}
                />
                <TextField
                  fullWidth size="small"
                  label={isFullyCredit ? "Credit Amount (Full Amount)" : "Credit Amount (Remaining)"}
                  value={creditAmount || ''}
                  disabled={isFullyCredit}
                  onChange={(e) => {
                    if (isFullyCredit) return
                    const amount = parseFloat(e.target.value) || 0
                    setCreditAmount(amount.toString())
                    setPaymentAmount((total - amount).toString())
                  }}
                  onWheel={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onKeyDown={(e) => { if (['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); e.stopPropagation() } }}
                  sx={{ mb: 1, fontFamily: 'monospace', '& input[type=number]': { MozAppearance: 'textfield', WebkitAppearance: 'none' }, '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 }, '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 } }}
                  placeholder="Amount to be paid later"
                  type="number"
                  inputProps={{ min: 0, max: total, step: 0.01 }}
                  color="warning"
                />
                <Box sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 1 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'info.main', fontWeight: 'bold' }}>
                    💰 Total: {total.toFixed(2)} | 💵 Paid: {(parseFloat(paymentAmount) || 0).toFixed(2)} | 📝 Credit: {(parseFloat(creditAmount) || 0).toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            )}

            {currentTab && (
              <Box sx={{ mb: 2, p: 1, bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 1 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                  Active Tab: {currentTab.name} | Items: {currentCart.length} | Total: {total.toFixed(2).replace(/\.00$/, '')}
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                  Inventory: {inventoryItems.length} products available
                </Typography>
              </Box>
            )}

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Sale Date <Typography component="span" variant="caption" color="text.secondary">(optional – leave blank for today)</Typography>
              </Typography>
              <AppDateField
                value={saleDate}
                onChange={setSaleDate}
                maxDate={new Date()}
                slotProps={{
                  textField: {
                    helperText: saleDate ? `Backdated to ${formatDisplayDate(saleDate)}` : "Using today's date",
                  },
                }}
              />
            </Box>

            <Box sx={{ mt: 'auto' }}>
              <Typography variant="subtitle2" gutterBottom>Notes:</Typography>
              <TextField fullWidth multiline rows={3} placeholder="Add notes for this sale (max 500 characters)..." value={notes} onChange={(e) => { if (e.target.value.length <= 500) setNotes(e.target.value) }} sx={{ fontFamily: 'monospace', '& .MuiInputBase-input': { fontSize: '0.8rem', lineHeight: 1.2 } }} helperText={`${notes.length}/500 characters`} inputProps={{ maxLength: 500 }} />
            </Box>
          </Paper>

          {/* Right Panel */}
          <Paper sx={{ p: 1, width: '70%', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, minHeight: '500px' }}>
            <Typography variant="subtitle1" gutterBottom sx={{ fontFamily: 'monospace' }}>
              SHOPPING CART - {currentTab?.name || 'No Tab'}
            </Typography>

            <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
              <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { fontSize: '0.8rem', py: 0.5 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 120, width: '30%' }}>Item</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 60, width: '15%' }}>Price</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 50, width: '10%' }}>Qty</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 50, width: '10%' }}>Disc</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 60, width: '15%' }}>Total</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold', minWidth: 50, width: '10%' }}>Act</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentCart.map((item) => (
                    <TableRow key={item.id} sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) } }}>
                      <TableCell sx={{ fontFamily: 'monospace', minWidth: 120, width: '30%' }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 'medium', wordBreak: 'break-word' }}>
                            {item.name}
                            {item.isService && (
                              <Chip label="Clinic" size="small" color="info" sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }} />
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {item.isService
                              ? (item.category || 'Clinic service')
                              : `Stock: ${item.stock} ${item.unit || 'units'}`}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', minWidth: 60, width: '15%', textAlign: 'right' }}>
                        <Tooltip title="Click to edit price" placement="top">
                          <TextField
                            size="small" type="number" label="Price"
                            value={parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0).toFixed(2).replace(/\.00$/, '')}
                            onChange={(e) => updateItemPrice(item.id, e.target.value)}
                            inputProps={{ min: 0, step: 0.01, style: { fontFamily: 'monospace', fontSize: '0.8rem', textAlign: 'right' }, inputMode: 'decimal' }}
                            sx={{ width: '90px', '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.5 }, '& .MuiInputLabel-root': { fontSize: '0.7rem', transform: 'translate(14px, -9px) scale(0.75)' }, '& .MuiOutlinedInput-root': { backgroundColor: item.customPrice && item.customPrice !== item.price ? '#fff3cd' : 'transparent', border: item.customPrice && item.customPrice !== item.price ? '2px solid #ffc107' : '1px solid rgba(0,0,0,0.23)' }, '& input[type=number]': { MozAppearance: 'textfield' }, '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 }, '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 } }}
                          />
                        </Tooltip>
                        {item.price != null && item.customPrice != null && Math.abs(parseFloat(item.customPrice) - parseFloat(item.price)) > 0.009 && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem', mt: 0.25 }}>
                            Default: {parseFloat(item.price).toFixed(2)}
                          </Typography>
                        )}
                        {item.customPrice && item.customPrice !== item.price && (
                          <IconButton size="small" onClick={() => resetItemPrice(item.id)} sx={{ p: 0.5, fontSize: '0.7rem', color: '#ffc107', '&:hover': { backgroundColor: '#fff3cd' } }} title="Reset to default price">↶</IconButton>
                        )}
                      </TableCell>
                      <TableCell sx={{ minWidth: 50, width: '10%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                          <IconButton size="small" onClick={() => updateQuantity(item.id, item.quantity - 1)} sx={{ bgcolor: theme.palette.error.light, color: 'white', '&:hover': { bgcolor: theme.palette.error.main } }}><RemoveIcon fontSize="small" /></IconButton>
                          <Typography sx={{ fontFamily: 'monospace', minWidth: 25, textAlign: 'center', fontWeight: 'bold', bgcolor: alpha(theme.palette.primary.main, 0.1), px: 0.5, py: 0.25, borderRadius: 1, fontSize: '0.8rem' }}>{item.quantity}</Typography>
                          <IconButton size="small" onClick={() => updateQuantity(item.id, item.quantity + 1)} sx={{ bgcolor: theme.palette.success.light, color: 'white', '&:hover': { bgcolor: theme.palette.success.main } }}><AddIcon fontSize="small" /></IconButton>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', minWidth: 50, width: '10%', textAlign: 'right' }}>
                        <TextField
                          size="small" type="number"
                          value={parseFloat(item.discount || 0).toFixed(2).replace(/\.00$/, '')}
                          onChange={(e) => updateItemDiscount(item.id, e.target.value || '0')}
                          inputProps={{ min: 0, step: 0.01, style: { fontFamily: 'monospace', fontSize: '0.8rem', textAlign: 'right' }, inputMode: 'decimal' }}
                          sx={{ width: '80px', '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.5 }, '& input[type=number]': { MozAppearance: 'textfield' }, '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 }, '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 } }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', minWidth: 60, width: '15%', textAlign: 'right', fontWeight: 'bold' }}>
                        {((parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0) * item.quantity) - parseFloat(item.discount || 0)).toFixed(2).replace(/\.00$/, '')}
                      </TableCell>
                      <TableCell sx={{ minWidth: 50, width: '10%', textAlign: 'center' }}>
                        <IconButton size="small" color="error" onClick={() => removeFromCart(item.id)} sx={{ bgcolor: alpha(theme.palette.error.main, 0.1), '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.2) } }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Totals */}
            <Box sx={{ mt: 1, p: 0.5, bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>Subtotal:</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{subtotal.toFixed(2).replace(/\.00$/, '')}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>Tax:</Typography>
                  <TextField size="small" type="number" value={taxRate} onChange={(e) => setTaxRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} inputProps={{ min: 0, max: 100, step: 0.1, style: { fontFamily: 'monospace', width: '40px', textAlign: 'center', fontSize: '0.8rem' } }} sx={{ width: '50px', '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.5 } }} />
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>%</Typography>
                </Box>
                <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{tax.toFixed(2).replace(/\.00$/, '')}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>Total Discount:</Typography>
                  <TextField size="small" type="number" value={parseFloat(totalDiscount || 0).toFixed(2).replace(/\.00$/, '')} onChange={(e) => setTotalDiscount(Math.max(0, parseFloat(e.target.value) || 0))} inputProps={{ min: 0, step: 0.01, style: { fontFamily: 'monospace', width: '60px', textAlign: 'center', fontSize: '0.8rem' }, inputMode: 'decimal' }} sx={{ width: '80px', '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.5 }, '& input[type=number]': { MozAppearance: 'textfield' }, '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 }, '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 } }} />
                </Box>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'error.main' }}>-{totalDiscount.toFixed(2).replace(/\.00$/, '')}</Typography>
              </Box>
              {Math.abs(outstandingTotal) > 0.01 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: outstandingTotal < 0 ? 'info.main' : 'warning.main' }}>
                    {outstandingTotal < 0 ? 'Customer Credit:' : 'Outstanding Payments:'}
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: outstandingTotal < 0 ? 'success.main' : 'warning.main', fontWeight: 'bold' }}>
                    {outstandingTotal.toFixed(2).replace(/\.00$/, '')}
                  </Typography>
                </Box>
              )}
              <Divider sx={{ my: 0.5 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>TOTAL:</Typography>
                <Typography variant="subtitle1" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{total.toFixed(2).replace(/\.00$/, '')}</Typography>
              </Box>
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button
                variant="contained" size="small" color="success"
                startIcon={isProcessingSaleOnly ? <CircularProgress size={18} color="inherit" /> : <CartIcon sx={{ fontSize: 18 }} />}
                onClick={handleSaleOnly}
                disabled={isProcessingSaleOnly || isProcessingSale || (currentCart.length === 0 && selectedOutstandingPayments.length === 0)}
                sx={{ fontFamily: 'monospace', py: 1, flex: 1 }}
              >
                {isProcessingSaleOnly ? 'PROCESSING...' : (currentCart.length === 0 && selectedOutstandingPayments.length > 0 ? 'SETTLE' : 'COMPLETE SALE')}
              </Button>
            </Box>
          </Paper>
        </Box>

        <PhysicalScanner open={showPhysicalScanner} onScan={(barcode) => { handleBarcodeScan(barcode); setShowPhysicalScanner(false) }} onClose={() => setShowPhysicalScanner(false)} inventoryItems={inventoryItems} />

        {/* Settings Dialog */}
        <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon />
              <Typography variant="h6">POS Settings</Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>Tax Settings</Typography>
              <TextField fullWidth label="Default Tax Rate (%)" type="number" value={taxRate} onChange={(e) => setTaxRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} inputProps={{ min: 0, max: 100, step: 0.1 }} sx={{ mb: 3 }} />
              <Typography variant="h6" gutterBottom>Search Settings</Typography>
              <TextField fullWidth label="Default Category Filter" select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <MenuItem value="all">All Categories</MenuItem>
                {getCategories().map((category) => (
                  <MenuItem key={category.id} value={category.id}>{category.label}</MenuItem>
                ))}
              </TextField>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowSettings(false)}>Close</Button>
            <Button variant="contained" onClick={() => setShowSettings(false)}>Save Settings</Button>
          </DialogActions>
        </Dialog>

        {/* Printer Settings Dialog */}
        <Dialog open={showPrinterDialog} onClose={() => setShowPrinterDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PrintIcon />
              <Typography variant="h6">Printer Settings & Layout</Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>Choose Print Layout</Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>Thermal Printer (80mm)</Typography>
                  <Box sx={{ p: 2, bgcolor: 'primary.light', borderRadius: 1, color: 'white', cursor: 'pointer' }}
                    onClick={() => {
                      const selOustandingTotal = outstandingPayments.filter(p => selectedOutstandingPayments.includes(p.id)).reduce((sum, p) => {
                        const amount = p.creditAmount !== undefined && p.creditAmount !== null ? parseFloat(p.creditAmount) : (p.total !== undefined && p.total !== null ? parseFloat(p.total) : parseFloat(p.outstandingAmount || 0) * (p.isCredit ? -1 : 1))
                        return sum + (Number.isFinite(amount) ? amount : 0)
                      }, 0)
                      const twO = billAmount + selOustandingTotal
                      const previewPayment = isFullyCredit || isBalancePayment ? 0 : isPartialPayment ? parseFloat(paymentAmount) || 0 : twO
                      const previewCredit = isFullyCredit || isBalancePayment ? twO : isPartialPayment ? twO - previewPayment : 0
                      setShowPrinterDialog(false); setSelectedLayout('thermal')
                      setPrintData({ type: 'receipt', title: 'SALES RECEIPT', companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name, companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address, companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone, companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email, logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl, receiptNumber: `TEST-${Date.now()}`, date: formatDisplayDate(new Date()), time: new Date().toLocaleTimeString(), cashierName: user?.name || user?.username || 'Cashier', customerName: customerName || 'Walk-in Customer', customerPhone: customerPhone || '', items: currentCart.map(normalizeCartItemForPrint), subtotal, tax, discount: totalDiscount, invoiceTotal: billAmount, oldBalance: selOustandingTotal, total: twO, paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod, paymentAmount: previewPayment, creditAmount: previewCredit, remainingBalance: Math.max(0, twO - previewPayment), notes: '', footerMessage: 'Thank you for your business!' })
                      setShowPrintDialog(true)
                    }}>
                    <Typography variant="body1" fontWeight="bold">📄 Thermal Printer Layout</Typography>
                    <Typography variant="body2">Monospace font, compact design for thermal printers</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>Color Printer (A4/Letter)</Typography>
                  <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1, color: 'white', cursor: 'pointer' }}
                    onClick={() => {
                      const selOustandingTotal = outstandingPayments.filter(p => selectedOutstandingPayments.includes(p.id)).reduce((sum, p) => {
                        const amount = p.creditAmount !== undefined && p.creditAmount !== null ? parseFloat(p.creditAmount) : (p.total !== undefined && p.total !== null ? parseFloat(p.total) : parseFloat(p.outstandingAmount || 0) * (p.isCredit ? -1 : 1))
                        return sum + (Number.isFinite(amount) ? amount : 0)
                      }, 0)
                      const twO = billAmount + selOustandingTotal
                      const previewPayment = isFullyCredit || isBalancePayment ? 0 : isPartialPayment ? parseFloat(paymentAmount) || 0 : twO
                      const previewCredit = isFullyCredit || isBalancePayment ? twO : isPartialPayment ? twO - previewPayment : 0
                      setShowPrinterDialog(false); setSelectedLayout('color')
                      setPrintData({ type: 'receipt', title: 'SALES RECEIPT', companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name, companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address, companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone, companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email, logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl, receiptNumber: `TEST-${Date.now()}`, date: formatDisplayDate(new Date()), time: new Date().toLocaleTimeString(), cashierName: user?.name || user?.username || 'Cashier', customerName: customerName || 'Walk-in Customer', customerPhone: customerPhone || '', items: currentCart.map(normalizeCartItemForPrint), subtotal, tax, discount: totalDiscount, invoiceTotal: billAmount, oldBalance: selOustandingTotal, total: twO, paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod, paymentAmount: previewPayment, creditAmount: previewCredit, remainingBalance: Math.max(0, twO - previewPayment), notes: '', footerMessage: 'Thank you for your business!' })
                      setShowPrintDialog(true)
                    }}>
                    <Typography variant="body1" fontWeight="bold">🖨️ Color Printer Layout</Typography>
                    <Typography variant="body2">Styled design with colors for A4/Letter printers</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>Test Print Options</Typography>
                  <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                    <Button variant="outlined" startIcon={<PrintIcon />} onClick={handleConnectPrinter} disabled={printerStatus.connecting} sx={{ flex: 1 }}>
                      {printerStatus.connecting ? 'Connecting...' : 'Connect USB Printer'}
                    </Button>
                    <Button variant="contained" color="secondary" startIcon={<PrintIcon />} onClick={handleUseSystemPrinter} sx={{ flex: 1 }}>
                      Use System Printer (Mac/Windows)
                    </Button>
                    <Button variant="outlined" startIcon={<PrintIcon />} onClick={handleDirectPrint} disabled={currentCart.length === 0} sx={{ flex: 1 }}>Test Print Current Cart</Button>
                    <Button variant="outlined" onClick={async () => { const status = await checkPrinterStatus(); alert(`Printer Status Check:\n\n${status.message}\n\nDevices: ${status.portCount}`) }} sx={{ flex: 1 }}>Check Printer Status</Button>
                  </Box>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    If Epson does not appear in the USB popup, click <strong>Use System Printer</strong> — add Epson in laptop Settings → Printers first, then print via the normal print dialog.
                  </Alert>
                  <Button variant="outlined" onClick={() => { setShowPrinterDialog(false); alert('✅ Printer settings saved!') }} sx={{ width: '100%' }}>Save Settings</Button>
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPrinterDialog(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>

        {/* Print Dialog */}
        <PrintDialog
          open={showPrintDialog}
          onClose={() => setShowPrintDialog(false)}
          printData={printData}
          title="Print Sales Receipt"
          defaultLayout={selectedLayout}
          onPrintComplete={() => {
            setShowPrintDialog(false)
            setPrintData(null)
            setCustomerName('')
            setCustomerPhone('')
            if (currentTab) updateCurrentTab({ ...currentTab, cart: [] })
            setSearchResults([])
            setShowSearchResults(false)
            setManualInput('')
            setSearchQuery('')
          }}
        />

        <Snackbar open={toast.open} autoHideDuration={4000} onClose={handleToastClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert onClose={handleToastClose} severity={toast.severity || 'info'} variant="filled" sx={{ width: '100%' }}>{toast.message}</Alert>
        </Snackbar>

        <Dialog open={showPrinterHelpDialog} onClose={() => setShowPrinterHelpDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Epson not showing in USB list</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Windows/Mac printer drivers often hide Epson from Chrome USB. Silent printing (no dialog) needs USB or Serial/COM access.
            </Alert>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>{printerHelpMessage || getPrinterBlockedHelp()}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              <strong>For silent print (no Chrome dialog):</strong> click <strong>USB</strong> or <strong>Serial/COM</strong> and select the Epson. Confirm sale will then print directly.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>System Print</strong> always opens the Chrome print dialog (like Save as PDF) — browsers cannot skip that dialog.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowPrinterHelpDialog(false)}>Close</Button>
            <Button variant="outlined" onClick={() => { setShowPrinterHelpDialog(false); handleConnectSerial() }}>
              Try Serial/COM
            </Button>
            <Button variant="contained" onClick={() => { setShowPrinterHelpDialog(false); handleConnectUsb() }}>
              Try USB
            </Button>
          </DialogActions>
        </Dialog>

        {/* Sale Confirmation Dialog */}
        <Dialog open={saleConfirmDialog} onClose={() => { setSaleConfirmDialog(false); setPendingSaleData(null) }} maxWidth="sm" fullWidth sx={{ zIndex: 1400 }}>
          <DialogTitle sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckIcon />
              <Typography variant="h6">Confirm Sale</Typography>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            {pendingSaleData && (
              <Box>
                {pendingSaleData.type === 'settlement-only' ? (
                  <>
                    <Alert severity="info" sx={{ mb: 2 }}>Outstanding Payment Settlement</Alert>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Customer:</Typography><Typography variant="body2" fontWeight="bold">{pendingSaleData.customerName}</Typography></Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Phone:</Typography><Typography variant="body2">{pendingSaleData.customerPhone}</Typography></Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Total Outstanding:</Typography><Typography variant="body2" fontWeight="bold" color="warning.main">{pendingSaleData.baseOutstanding.toFixed(2)}</Typography></Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Payment Amount:</Typography><Typography variant="body2" fontWeight="bold" color="success.main">{pendingSaleData.settlementPaymentValue.toFixed(2)}</Typography></Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Balance After:</Typography><Typography variant="body2" fontWeight="bold">{pendingSaleData.settlementCreditValue.toFixed(2)}</Typography></Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Payment Method:</Typography><Typography variant="body2">{pendingSaleData.paymentMethod}</Typography></Box>
                    </Box>
                  </>
                ) : (
                  <>
                    <Alert severity="info" sx={{ mb: 2 }}>Review the sale details before confirming. The sale will be created in the system once you confirm.</Alert>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Customer:</Typography><Typography variant="body2" fontWeight="bold">{pendingSaleData.saleData.customerInfo.name}</Typography></Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Phone:</Typography><Typography variant="body2">{pendingSaleData.saleData.customerInfo.phone || 'N/A'}</Typography></Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Items:</Typography><Typography variant="body2">{pendingSaleData.saleData.items.length} item(s)</Typography></Box>
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Subtotal:</Typography><Typography variant="body2">{pendingSaleData.saleData.subtotal.toFixed(2)}</Typography></Box>
                      {pendingSaleData.saleData.tax > 0 && <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Tax:</Typography><Typography variant="body2">{pendingSaleData.saleData.tax.toFixed(2)}</Typography></Box>}
                      {pendingSaleData.saleData.discount > 0 && <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Discount:</Typography><Typography variant="body2" color="error.main">-{pendingSaleData.saleData.discount.toFixed(2)}</Typography></Box>}
                      {Math.abs(pendingSaleData.selectedOutstandingTotal) > 0.01 && <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Outstanding:</Typography><Typography variant="body2" color="warning.main">{pendingSaleData.selectedOutstandingTotal.toFixed(2)}</Typography></Box>}
                      <Divider />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body1" fontWeight="bold">Total:</Typography><Typography variant="body1" fontWeight="bold" color="primary.main">{pendingSaleData.totalWithOutstanding.toFixed(2)}</Typography></Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Payment:</Typography><Typography variant="body2">{pendingSaleData.saleData.paymentMethod}</Typography></Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Amount Paid:</Typography><Typography variant="body2" color="success.main">{pendingSaleData.finalPaymentAmount.toFixed(2)}</Typography></Box>
                      {pendingSaleData.finalCreditAmount > 0 && <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography variant="body2" color="text.secondary">Credit/Remaining:</Typography><Typography variant="body2" color="warning.main">{pendingSaleData.finalCreditAmount.toFixed(2)}</Typography></Box>}
                    </Box>
                  </>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button variant="outlined" color="error" onClick={() => { setSaleConfirmDialog(false); setPendingSaleData(null) }}>Cancel</Button>
            <Button variant="contained" color="primary" startIcon={isProcessingSaleOnly ? <CircularProgress size={18} color="inherit" /> : <CheckIcon />} onClick={handleCompleteSale} disabled={isProcessingSaleOnly}>
              {isProcessingSaleOnly ? 'Creating Sale...' : 'Confirm & Create Sale'}
            </Button>
          </DialogActions>
        </Dialog>

      </Box>
    </RouteGuard>
  )
}

export default POSTerminal