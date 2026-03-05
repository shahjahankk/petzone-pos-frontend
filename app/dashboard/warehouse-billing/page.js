'use client'
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
  Add as AddIcon,
  DeleteSweep as DeleteSweepIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  AttachMoney as MoneyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material'
import PrintDialog from '../../../components/print/PrintDialog'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import PhysicalScanner from '../../../components/pos/PhysicalScanner'
import { fetchInventory } from '../../store/slices/inventorySlice'
import { createWarehouseSale, fetchSales } from '../../store/slices/salesSlice'
import { fetchRetailers } from '../../store/slices/retailersSlice'

// Tab management utilities
const generateTabId = () => `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
const generateTabName = (tabNumber) => `Sale ${tabNumber}`

const DEFAULT_COMPANY_INFO = {
  name: 'PetZone',
  address: 'Shop no 42 unit no 2 latifabad near musarrat banquet Hyderabad',
  phone: '03111100355',
  email: 'info@petzone.com',
  logoUrl: '/petzonelogo.png'
}

let cachedSerialPort = null
let cachedSerialPortInfo = null

const resetCachedSerialPort = () => {
  cachedSerialPort = null
  cachedSerialPortInfo = null
}

const acquireSerialPort = async () => {
  if (typeof navigator === 'undefined' || !navigator.serial) {
    throw new Error('Web Serial API not supported')
  }

  if (cachedSerialPort) {
    return cachedSerialPort
  }

  const grantedPorts = await navigator.serial.getPorts?.()

  if (grantedPorts && grantedPorts.length > 0) {
    if (cachedSerialPortInfo) {
      const matchedPort = grantedPorts.find(port => {
        if (typeof port.getInfo !== 'function') {
          return false
        }
        const info = port.getInfo()
        return info &&
          info.usbVendorId === cachedSerialPortInfo.usbVendorId &&
          info.usbProductId === cachedSerialPortInfo.usbProductId
      })

      if (matchedPort) {
        cachedSerialPort = matchedPort
        return cachedSerialPort
      }
    }

    cachedSerialPort = grantedPorts[0]
    if (cachedSerialPort && typeof cachedSerialPort.getInfo === 'function') {
      cachedSerialPortInfo = cachedSerialPort.getInfo()
    }
    return cachedSerialPort
  }

  const requestedPort = await navigator.serial.requestPort()
  if (!requestedPort) {
    throw new Error('No port selected by user')
  }

  cachedSerialPort = requestedPort
  if (typeof requestedPort.getInfo === 'function') {
    cachedSerialPortInfo = requestedPort.getInfo()
  }
  return cachedSerialPort
}

const createEmptyTabState = (overrides = {}) => ({
  cart: [],
  customerName: '',
  customerPhone: '',
  selectedRetailer: null,
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

function WarehouseBillingPage() {
  const theme = useTheme()
  const dispatch = useDispatch()
  const router = useRouter()
  
  const { user: originalUser } = useSelector((state) => state.auth)
  const [saleConfirmDialog, setSaleConfirmDialog] = useState(false)
  const [completedSaleData, setCompletedSaleData] = useState(null)

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
    if (!isAdminMode || !urlParams.role) {
      return originalUser
    }
    
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
    if (!isAdminMode || !urlParams.role) {
      return null
    }
    
    return {
      scopeType: urlParams.scope === 'branch' ? 'BRANCH' : 'WAREHOUSE',
      scopeId: urlParams.id,
      scopeName: urlParams.scope === 'branch' ? `Branch ${urlParams.id}` : `Warehouse ${urlParams.id}`
    }
  }, [isAdminMode, urlParams])
  
  const user = useMemo(() => getEffectiveUser(originalUser), [getEffectiveUser, originalUser])
  const scopeInfo = useMemo(() => getScopeInfo(), [getScopeInfo])
  
  const { data: inventoryItems, loading: inventoryLoading, error: inventoryError } = useSelector((state) => state.inventory)
  const salesData = useSelector((state) => state.sales.data) || []
  const {
    data: retailers = [],
    loading: retailersLoading = false,
    error: retailersError = null
  } = useSelector((state) => state.retailers || { data: [], loading: false, error: null })
  
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
  const [selectedRetailer, setSelectedRetailer] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [creditAmount, setCreditAmount] = useState('')
  const [isPartialPayment, setIsPartialPayment] = useState(false)
  const [isFullyCredit, setIsFullyCredit] = useState(false)
  const [isBalancePayment, setIsBalancePayment] = useState(false)
  const [selectedSalesperson, setSelectedSalesperson] = useState(null)
  const [salespeople, setSalespeople] = useState([])
  const [retailerSearchResults, setRetailerSearchResults] = useState([])
  const [showRetailerSearch, setShowRetailerSearch] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showPhysicalScanner, setShowPhysicalScanner] = useState(false)
  const [taxRate, setTaxRate] = useState(0)
  const [totalDiscount, setTotalDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [saleDate, setSaleDate] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showSettings, setShowSettings] = useState(false)
  const [showPrinterDialog, setShowPrinterDialog] = useState(false)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  
  // UI state for collapsible outstanding panel
  const [showOutstandingPanel, setShowOutstandingPanel] = useState(false)
  // Row selection for bulk delete
  const [selectedRows, setSelectedRows] = useState([])
  // Inline item search state per row
  const [rowSearchQuery, setRowSearchQuery] = useState({})
  const [rowSearchResults, setRowSearchResults] = useState({})
  const [activeRowSearch, setActiveRowSearch] = useState(null)

  const retailerDisplayName = useMemo(() => {
    if (selectedRetailer?.name) {
      return selectedRetailer.name
    }
    return (customerName || '').trim() || 'Walk-in Retailer'
  }, [customerName, selectedRetailer])

  const retailerDisplayPhone = useMemo(() => {
    if (selectedRetailer?.phone) {
      return selectedRetailer.phone
    }
    return (customerPhone || '').trim()
  }, [customerPhone, selectedRetailer])
  
  const [isProcessingSale, setIsProcessingSale] = useState(false)
  const [isProcessingSaleOnly, setIsProcessingSaleOnly] = useState(false)
  const [printData, setPrintData] = useState(null)
  const [selectedLayout, setSelectedLayout] = useState('color')
  const [availablePrinters, setAvailablePrinters] = useState([])
  const [scannerStatus, setScannerStatus] = useState({
    connected: false,
    lastScan: null,
    scanCount: 0,
    errors: []
  })
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
  const lastScanTimeRef = useRef(0)
  const hydratingTabIdRef = useRef(null)
  const isCompletingSaleRef = useRef(false)

  useEffect(() => {
    if (!user) {
      return
    }

    const fetchParams = {}

    if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId) {
      fetchParams.warehouseId = user.warehouseId
    } else if (scopeInfo?.scopeType === 'WAREHOUSE' && scopeInfo.scopeId) {
      fetchParams.warehouseId = scopeInfo.scopeId
    } else if (urlParams?.scope === 'warehouse' && urlParams.id) {
      fetchParams.warehouseId = urlParams.id
    }

    dispatch(fetchRetailers(fetchParams))
  }, [dispatch, scopeInfo, urlParams, user])

  useEffect(() => {
    if (retailersError) {
      console.error('[WAREHOUSE] Failed to load retailers:', retailersError)
    }
  }, [retailersError])

  const currentTab = useMemo(() => {
    return tabs.find(tab => tab.id === activeTabId) || null
  }, [tabs, activeTabId])  
  const currentCart = useMemo(() => {
    return currentTab?.cart || []
  }, [currentTab])

  const buildWarehouseSalePayload = useCallback(({
    billAmount: inputBillAmount,
    totalWithOutstanding,
    finalPaymentAmount,
    finalCreditAmount,
    finalPaymentStatus,
    paymentMethodValue,
    paymentTypeValue,
    includeOutstandingPayments = false,
    itemsOverride
  }) => {
    const safeNumber = (value, fallback = 0) => {
      const parsed = parseFloat(value)
      return Number.isNaN(parsed) ? fallback : parsed
    }

    const sourceItems = Array.isArray(itemsOverride) ? itemsOverride : currentCart

    const computedSubtotal = sourceItems.reduce((sum, item) => {
      const price = safeNumber(
        item.customPrice !== null && item.customPrice !== undefined
          ? item.customPrice
          : (item.unitPrice !== null && item.unitPrice !== undefined ? item.unitPrice : item.price)
      )
      const quantity = safeNumber(item.quantity)
      const discountValue = safeNumber(item.discount)
      return sum + Math.max(0, (price * quantity) - discountValue)
    }, 0)

    const computedTax = computedSubtotal * (taxRate / 100)
    const computedBillAmount = computedSubtotal + computedTax - totalDiscount

    const normalizedBillAmount = safeNumber(inputBillAmount, computedBillAmount)
    const normalizedTotalWithOutstanding = safeNumber(totalWithOutstanding, normalizedBillAmount)
    const normalizedPaymentAmount = safeNumber(finalPaymentAmount)
    const normalizedCreditAmount = safeNumber(finalCreditAmount)

    const normalizedRetailerId = selectedRetailer?.id !== undefined && selectedRetailer?.id !== null
      ? Number.isNaN(Number(selectedRetailer.id))
        ? selectedRetailer.id
        : Number(selectedRetailer.id)
      : null

    const retailerInfo = selectedRetailer
      ? {
          id: normalizedRetailerId,
          name: retailerDisplayName,
          phone: retailerDisplayPhone
        }
      : {
          id: null,
          name: retailerDisplayName,
          phone: retailerDisplayPhone
        }

    const salespersonInfo = selectedSalesperson
      ? {
          id: selectedSalesperson.id,
          name: selectedSalesperson.name,
          phone: selectedSalesperson.phone
        }
      : null

    const itemsPayload = sourceItems.map(item => {
      const inventoryId = item.id !== undefined && item.id !== null ? parseInt(item.id) : null
      const unitPrice = safeNumber(
        item.customPrice !== null && item.customPrice !== undefined
          ? item.customPrice
          : (item.unitPrice !== null && item.unitPrice !== undefined ? item.unitPrice : item.price)
      )
      const quantity = safeNumber(item.quantity)
      const discountValue = safeNumber(item.discount)
      const lineTotal = safeNumber((unitPrice * quantity) - discountValue)

      return {
        inventoryItemId: inventoryId,
        sku: item.sku || '',
        name: item.name || '',
        quantity,
        unitPrice,
        discount: discountValue,
        total: lineTotal
      }
    })

    const outstandingIds = includeOutstandingPayments
      ? selectedOutstandingPayments.map(id => {
          const parsed = parseInt(id, 10)
          return Number.isNaN(parsed) ? id : parsed
        })
      : []

    const payload = {
      retailerId: retailerInfo.id,
      salespersonId: salespersonInfo?.id,
      salespersonName: salespersonInfo?.name,
      salespersonPhone: salespersonInfo?.phone,
      items: itemsPayload,
      subtotal: safeNumber(computedSubtotal),
      taxAmount: safeNumber(computedTax),
      tax: safeNumber(computedTax),
      discountAmount: safeNumber(totalDiscount),
      discount: safeNumber(totalDiscount),
      billAmount: normalizedBillAmount,
      totalWithOutstanding: normalizedTotalWithOutstanding,
      totalAmount: normalizedBillAmount,
      finalAmount: normalizedTotalWithOutstanding,
      finalTotal: normalizedTotalWithOutstanding,
      paymentMethod: paymentMethodValue,
      paymentType: paymentTypeValue,
      paymentStatus: finalPaymentStatus,
      paymentAmount: normalizedPaymentAmount,
      creditAmount: normalizedCreditAmount,
      notes: notes || '',
      saleDate: saleDate || null,
      customerInfo: {
        id: retailerInfo.id,
        name: retailerInfo.name,
        phone: retailerInfo.phone
      },
      outstandingPayments: outstandingIds
    }

    return { payload, retailerInfo, salespersonInfo }
  }, [
    currentCart,
    notes,
    saleDate,
    retailerDisplayName,
    retailerDisplayPhone,
    selectedOutstandingPayments,
    selectedRetailer,
    selectedSalesperson,
    taxRate,
    totalDiscount
  ])

  const calculateWarehousePaymentDetails = ({
    billAmount,
    outstandingTotal,
    isFullyCredit,
    isPartialPayment,
    isBalancePayment,
    inputPaymentAmount
  }) => {
    const safeNumber = (value, fallback = 0) => {
      const parsed = parseFloat(value)
      return Number.isNaN(parsed) ? fallback : parsed
    }

    const normalizedBill = safeNumber(billAmount)
    const normalizedOutstanding = safeNumber(outstandingTotal)
    const rawTotal = normalizedBill + normalizedOutstanding
    const totalForLedger = isBalancePayment ? normalizedBill : rawTotal

    let finalPaymentAmount
    let finalCreditAmount

    if (isFullyCredit) {
      finalPaymentAmount = 0
      finalCreditAmount = totalForLedger
    } else if (isBalancePayment) {
      finalPaymentAmount = 0
      finalCreditAmount = normalizedBill
    } else if (isPartialPayment) {
      finalPaymentAmount = safeNumber(inputPaymentAmount)
      finalCreditAmount = totalForLedger - finalPaymentAmount
    } else {
      finalPaymentAmount = totalForLedger
      finalCreditAmount = 0
    }

    const finalPaymentStatus = (isFullyCredit || finalCreditAmount > 0) ? 'PENDING' : 'COMPLETED'
    const paymentTypeValue = isBalancePayment
      ? 'BALANCE_PAYMENT'
      : (isPartialPayment ? 'PARTIAL_PAYMENT' : (isFullyCredit ? 'FULLY_CREDIT' : 'FULL_PAYMENT'))

    return {
      totalWithOutstanding: totalForLedger,
      finalPaymentAmount,
      finalCreditAmount,
      finalPaymentStatus,
      paymentTypeValue
    }
  }

  const handleCompleteSale = async () => {
    if (isCompletingSaleRef.current) return
    isCompletingSaleRef.current = true

    try {
      if (user.role === 'ADMIN' && !isAdminMode) {
        alert('Please select a branch or warehouse from the Admin Dashboard to simulate a role before making sales.')
        return
      }
      if (!selectedRetailer || selectedRetailer.id === undefined || selectedRetailer.id === null) {
        alert('❌ Please select a retailer before completing this sale.')
        return
      }
      if ((isPartialPayment || isFullyCredit) && !selectedRetailer?.id) {
        alert('❌ Retailer selection is required for partial payments and credit sales.')
        return
      }
      if (!user) {
        alert('❌ User not authenticated. Please login again.')
        return
      }

      if (!currentCart || currentCart.length === 0) {
        if (selectedOutstandingPayments.length > 0) {
          const { paymentAmount: settlementPaymentValue, creditAmount: settlementCreditValue, baseOutstanding } = calculateSettlementValues()

          if (isSettlementPartial && settlementPaymentValue <= 0) {
            alert('❌ Please enter a payment amount greater than 0 for partial settlement.')
            return
          }

          const retailerNameDisplay = selectedRetailer?.name || customerName || 'Unknown'
          const retailerPhoneDisplay = selectedRetailer?.phone || customerPhone || 'N/A'
          const isCredit = baseOutstanding < 0

          const confirmOk = confirm(
            `${isCredit ? '💰 CREDIT REFUND' : '💰 OUTSTANDING PAYMENT SETTLEMENT'}\n\n` +
            `Retailer: ${retailerNameDisplay}\n` +
            `Phone: ${retailerPhoneDisplay}\n` +
            `Total ${isCredit ? 'Credit' : 'Outstanding'}: ${Math.abs(baseOutstanding).toFixed(2)}\n` +
            `${isCredit ? 'Refund' : 'Payment'} Amount: ${settlementPaymentValue.toFixed(2)}\n` +
            `Balance After: ${settlementCreditValue.toFixed(2)}\n\n` +
            `Do you want to proceed?`
          )
          if (!confirmOk) return

          try {
            const settlementResult = await settleOutstandingPayments()

            if (settlementResult?.data?.settlementSale) {
              const settlementSale = settlementResult.data.settlementSale
              const { paymentAmount: spv, creditAmount: scv, baseOutstanding: ba } = calculateSettlementValues()

              const spd = {
                type: 'receipt',
                title: isCredit ? 'CREDIT REFUND RECEIPT' : 'PAYMENT SETTLEMENT RECEIPT',
                companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
                companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
                companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
                companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
                logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
                receiptNumber: settlementSale.invoice_no || `SETTLE-${Date.now()}`,
                date: new Date(settlementSale.created_at).toLocaleDateString(),
                time: new Date(settlementSale.created_at).toLocaleTimeString(),
                cashierName: user?.name || user?.username || 'Warehouse Keeper',
                customerName: settlementSale.customer_name || retailerNameDisplay,
                customerPhone: settlementSale.customer_phone || retailerPhoneDisplay,
                items: [],
                subtotal: 0, tax: 0, discount: 0, invoiceTotal: 0,
                oldBalance: Math.round(Math.abs(ba)),
                total: Math.round(parseFloat(settlementSale.total || 0)),
                paymentMethod: settlementSale.payment_method || paymentMethod || 'CASH',
                paymentAmount: Math.round(spv),
                creditAmount: Math.round(scv),
                remainingBalance: Math.round(scv),
                change: 0,
                notes: '',
                footerMessage: isCredit ? 'Credit refund processed!' : 'Thank you for your payment!'
              }

              setCompletedSaleData({ sale: settlementSale, printData: spd, isSaved: true })
              setSaleConfirmDialog(true)
            }

            clearAllPOSState()
            setTimeout(() => refreshOutstandingPayments(), 2000)
          } catch (error) {
            alert(`❌ Error processing settlement: ${error.message}`)
          }
          return
        } else {
          alert('❌ Cart is empty and no outstanding payments selected.')
          return
        }
      }

      if (total <= 0 && currentCart.length === 0) {
        alert('❌ Cannot process a sale without items.')
        return
      }

      const {
        totalWithOutstanding: normalizedBillTotal,
        finalPaymentAmount,
        finalCreditAmount,
        finalPaymentStatus,
        paymentTypeValue
      } = calculateWarehousePaymentDetails({
        billAmount,
        outstandingTotal: 0,
        isFullyCredit,
        isPartialPayment,
        isBalancePayment,
        inputPaymentAmount: paymentAmount
      })

      if (isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
        if (finalPaymentAmount <= 0) {
          alert('❌ Payment amount must be greater than 0 for partial payments')
          return
        }
        const sum = finalPaymentAmount + finalCreditAmount
        if (Math.abs(sum - normalizedBillTotal) > 0.01) {
          alert(`❌ Payment amounts don't add up.\nPaid: ${finalPaymentAmount.toFixed(2)}\nCredit: ${finalCreditAmount.toFixed(2)}\nBill: ${normalizedBillTotal.toFixed(2)}`)
          return
        }
      }

      const paymentMethodValue = isFullyCredit ? 'FULLY_CREDIT' : (paymentMethod || 'CASH')
      const isSettlementOnly = selectedOutstandingPayments.length > 0 && currentCart.length === 0 && showSettlementOptions

      const salePayloadInfo = buildWarehouseSalePayload({
        billAmount,
        totalWithOutstanding: normalizedBillTotal,
        finalPaymentAmount,
        finalCreditAmount,
        finalPaymentStatus,
        paymentMethodValue,
        paymentTypeValue,
        includeOutstandingPayments: isSettlementOnly
      })

      if (!salePayloadInfo) return

      const { payload: saleData, retailerInfo } = salePayloadInfo

      const result = await dispatch(createWarehouseSale(saleData))

      if (createWarehouseSale.fulfilled.match(result)) {
        const sale = result.payload?.data || result.payload

        if (selectedOutstandingPayments.length > 0) {
          const shouldClear = (currentCart.length === 0 && showSettlementOptions) ||
            (paymentMethodValue === 'CASH' && selectedOutstandingPayments.length > 0 && finalPaymentAmount > 0)
          if (shouldClear) {
            try {
              await settleOutstandingPayments()
            } catch (error) {
              console.error('[WAREHOUSE] Error settling outstanding:', error)
            }
          }
        }

        const printableItems = currentCart.map(normalizeCartItemForPrint)
        const printableSubtotal = Math.round(Math.max(0, subtotal))
        const printableTax = Math.round(Math.max(0, tax))
        const printableDiscount = Math.round(Math.max(0, totalDiscount))
        const printableInvoiceTotal = Math.max(0, (printableSubtotal + printableTax) - printableDiscount)

        const pd = {
          type: 'warehouse',
          title: 'SALES RECEIPT',
          companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
          companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
          companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
          companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
          logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
          items: printableItems,
          subtotal: printableSubtotal,
          tax: printableTax,
          discount: printableDiscount,
          invoiceTotal: printableInvoiceTotal,
          oldBalance: Math.round(outstandingTotal || 0),
          total: Math.round(total),
          customerName: retailerInfo.name || 'Walk-in Retailer',
          customerPhone: retailerInfo.phone || '',
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString(),
          receiptNumber: sale.invoice_no || `POS-${Date.now()}`,
          warehouseName: user?.warehouseName || scopeInfo?.scopeName || '',
          cashierName: user?.name || user?.username || 'Cashier',
          paymentMethod: paymentMethodValue,
          paymentAmount: Math.round(finalPaymentAmount),
          creditAmount: Math.round(finalCreditAmount),
          remainingBalance: Math.round(finalCreditAmount),
          change: isPartialPayment ? 0 : Math.round(Math.max(0, (parseFloat(paymentAmount) || total) - total)),
          notes: isPartialPayment ? `Partial Payment - Credit: ${Math.round(finalCreditAmount)}` : '',
          footerMessage: 'Thank you for choosing PetZone!'
        }

        setCompletedSaleData({ sale, printData: pd, retailerInfo, isSaved: true })
        setSaleConfirmDialog(true)

        clearAllPOSState()
        setTimeout(() => refreshOutstandingPayments(), 2000)

      } else if (createWarehouseSale.rejected.match(result)) {
        const error = result.payload || result.error
        showToast(error?.message || 'Sale failed. Please try again.', 'error')
      }

    } catch (error) {
      alert(`❌ Sale failed: ${error.message || 'Unknown error'}`)
    } finally {
      setIsProcessingSaleOnly(false)
      isCompletingSaleRef.current = false
    }
  }

  const updateCurrentTab = useCallback((updates) => {
    setTabs(prev => prev.map(tab => 
      tab.id === activeTabId 
        ? { ...tab, ...updates, modifiedAt: new Date() }
        : tab
    ))
  }, [activeTabId])

  useEffect(() => {
    if (!currentTab) {
      return
    }

    if (hydratingTabIdRef.current === currentTab.id) {
      hydratingTabIdRef.current = null
      return
    }

    const updates = {
      customerName,
      customerPhone,
      selectedRetailer,
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
        if (currentValue === value) {
          return false
        }

        if (currentValue.length !== value.length) {
          return true
        }

        for (let i = 0; i < value.length; i += 1) {
          if (currentValue[i] !== value[i]) {
            return true
          }
        }

        return false
      }

      return currentValue !== value
    })

    if (hasChanges) {
      updateCurrentTab(updates)
    }
  }, [
    currentTab,
    customerName,
    customerPhone,
    selectedRetailer,
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
    updateCurrentTab
  ])

  const addToCart = useCallback((product) => {
    const existingItem = currentCart.find(item => item.id === product.id)
    let newCart
    if (existingItem) {
      const newQuantity = existingItem.quantity + 1
      newCart = currentCart.map(item => 
        item.id === product.id 
          ? { ...item, quantity: newQuantity }
          : item
      )
    } else {
      newCart = [...currentCart, { ...product, quantity: 1, discount: 0, customPrice: product.sellingPrice }]
    }
    updateCurrentTab({ cart: newCart })
  }, [currentCart, updateCurrentTab])

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

      setScannerStatus(prev => ({
        ...prev,
        connected: true,
        lastScan: now
      }))

      if (timeDiff < 50 && event.key !== 'Enter') {
        lastScanTimeRef.current = now
        return
      }

      if (event.key === 'Enter' && barcodeInput.trim().length > 0) {
        event.preventDefault()
        setScannerStatus(prev => ({
          ...prev,
          scanCount: prev.scanCount + 1,
          lastScan: now
        }))
        handleBarcodeScan(barcodeInput.trim())
        setBarcodeInput('')
        return
      }
    }

    document.addEventListener('keydown', handlePhysicalScanner)
    return () => {
      document.removeEventListener('keydown', handlePhysicalScanner)
    }
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

    setOutstandingPayments([])
    setSelectedOutstandingPayments([])
    setSettlementPaymentAmount('')
    setSettlementCreditAmount('')
    setIsSettlementPartial(false)
    setIsSettlementFullyCredit(false)
    setShowSettlementOptions(false)

    setCustomerName(newTab.customerName)
    setCustomerPhone(newTab.customerPhone)
    setSelectedRetailer(newTab.selectedRetailer)
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
    setSelectedRows([])
  }, [tabCounter])

  const loadAvailablePrinters = useCallback(async () => {
    try {
      if (navigator.serial) {
        const ports = await navigator.serial.getPorts()
        setAvailablePrinters(ports.map(port => {
          const info = port.getInfo()
          return {
            id: info.usbVendorId || info.usbProductId || 'unknown',
            name: `Serial Printer (${info.usbVendorId ? `Vendor: ${info.usbVendorId}` : 'Unknown'})`,
            type: 'thermal',
            port: port,
            info: info
          }
        }))
      }

      setAvailablePrinters(prev => [
        ...prev,
        { id: 'default', name: 'Default Printer', type: 'default' },
        { id: 'thermal-80mm', name: 'Thermal 80mm', type: 'thermal' },
        { id: 'thermal-58mm', name: 'Thermal 58mm', type: 'thermal' },
        { id: 'browser-print', name: 'Browser Print Dialog', type: 'browser' }
      ])
    } catch (error) {
      setAvailablePrinters([
        { id: 'default', name: 'Default Printer', type: 'default' },
        { id: 'thermal-80mm', name: 'Thermal 80mm', type: 'thermal' },
        { id: 'thermal-58mm', name: 'Thermal 58mm', type: 'thermal' },
        { id: 'browser-print', name: 'Browser Print Dialog', type: 'browser' }
      ])
    }
  }, [])

  useEffect(() => {
    if (tabs.length === 0) {
      createNewTab()
    }
  }, [tabs.length, createNewTab])

  useEffect(() => {
    if (user) {
      const params = {}
      params.limit = 'all';

      if (user.role === 'CASHIER') {
        params.scopeType = 'BRANCH'
        if (user.branchId) {
          params.scopeId = user.branchId
        }
      } else if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId) {
        params.scopeType = 'WAREHOUSE'
        params.scopeId = user.warehouseId
      } else if (user.role === 'ADMIN' && !isAdminMode) {
        // no scope
      }

      dispatch(fetchInventory(params))
    }

    dispatch(fetchSales())
    loadAvailablePrinters()
  }, [dispatch, user, loadAvailablePrinters, isAdminMode])

  const searchOutstandingPayments = useCallback(async (phoneNumber, customerName) => {
    if ((!phoneNumber || phoneNumber.trim().length < 3) && (!customerName || customerName.trim().length < 3)) {
      setOutstandingPayments([])
      setSelectedOutstandingPayments([])
      return
    }

    setIsSearchingOutstanding(true)

    try {
      const params = new URLSearchParams()
      if (phoneNumber && phoneNumber.trim().length >= 3) {
        params.append('phone', phoneNumber.trim())
      }
      if (customerName && customerName.trim().length >= 3) {
        params.append('customerName', customerName.trim())
      }

      const response = await api.get(`/sales/outstanding?${params.toString()}`)

      if (response.data.success) {
        const outstandingPayments = response.data.data.map(customer => {
          const actualBalance = customer.creditAmount || customer.finalAmount || customer.totalOutstanding;
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
            created_at: new Date().toISOString(),
          };
        });

        setOutstandingPayments(outstandingPayments)
        setIsSettlementPartial(false)
        setIsSettlementFullyCredit(false)
        setShowSettlementOptions(false)

        const autoSelectedIds = outstandingPayments.map(payment => payment.id)
        setSelectedOutstandingPayments(autoSelectedIds)
        setShowOutstandingPanel(true)
      } else {
        setOutstandingPayments([])
        setSelectedOutstandingPayments([])
      }
    } catch (error) {
      console.error('[WAREHOUSE] Error searching outstanding payments:', error)
      setOutstandingPayments([])
      setSelectedOutstandingPayments([])
    } finally {
      setIsSearchingOutstanding(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const retailerPhone = selectedRetailer?.phone?.trim()
      const retailerName = selectedRetailer?.name?.trim()
      if ((retailerPhone && retailerPhone.length >= 3) || (retailerName && retailerName.length >= 3)) {
        searchOutstandingPayments(retailerPhone || '', retailerName || '')
        return
      }

      if ((customerPhone && customerPhone.trim().length >= 3) || (customerName && customerName.trim().length >= 3)) {
        searchOutstandingPayments(customerPhone?.trim(), customerName?.trim())
      } else {
        setOutstandingPayments([])
        setSelectedOutstandingPayments([])
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [customerPhone, customerName, selectedRetailer, searchOutstandingPayments])

  useEffect(() => {
    if (barcodeInputRef.current && activeTabId) {
      barcodeInputRef.current.focus()
    }
  }, [activeTabId])

  const closeTab = (tabId) => {
    if (tabs.length <= 1) {
      return
    }

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
    setSelectedRows([])
  }

  const handleSearch = (query) => {
    setSearchQuery(query)
    const normalize = (value) => {
      if (value === null || value === undefined) return ''
      return value.toString().toLowerCase()
    }

    const normalizedQuery = normalize(query)

    if (query.length >= 2) {
      let matches = inventoryItems.filter(p => 
        normalize(p.name).includes(normalizedQuery) ||
        normalize(p.sku).includes(normalizedQuery) ||
        normalize(p.barcode).includes(normalizedQuery) ||
        normalize(p.category).includes(normalizedQuery) ||
        normalize(p.description).includes(normalizedQuery)
      )

      if (selectedCategory !== 'all') {
        matches = matches.filter(p => p.category === selectedCategory)
      }

      const searchResults = matches.map(item => ({
        id: item.id,
        name: item.name,
        price: item.sellingPrice,
        stock: item.currentStock,
        category: item.category,
        sku: item.sku,
        barcode: item.barcode,
        unit: item.unit,
        description: item.description
      }))
      setSearchResults(searchResults)
      setShowSearchResults(true)
    } else {
      setSearchResults([])
      setShowSearchResults(false)
    }
  }

  const handleManualSearch = (query) => {
    handleSearch(query)
  }

  const searchRetailers = useCallback((query) => {
    if (!query || query.length < 2) {
      setRetailerSearchResults([])
      setShowRetailerSearch(false)
      return
    }

    const normalizedQuery = query.toLowerCase()
    const matches = retailers.filter(retailer => {
      const nameMatch = retailer.name?.toLowerCase().includes(normalizedQuery)
      const phoneMatch = retailer.phone?.toLowerCase().includes(normalizedQuery)
      const codeMatch = retailer.code?.toString().toLowerCase().includes(normalizedQuery)
      return nameMatch || phoneMatch || codeMatch
    })

    const formattedResults = matches.map(retailer => ({
      id: retailer.id,
      name: retailer.name || 'Walk-in Retailer',
      phone: retailer.phone || '',
      address: retailer.address || '',
      code: retailer.code || '',
      city: retailer.city || ''
    }))

    setRetailerSearchResults(formattedResults)
    setShowRetailerSearch(formattedResults.length > 0)
  }, [retailers])

  const selectRetailer = useCallback((retailer) => {
    if (!retailer) {
      return
    }

    setSelectedRetailer(retailer)
    setCustomerName(retailer.name || '')
    setCustomerPhone(retailer.phone || '')
    setShowRetailerSearch(false)
    setRetailerSearchResults([])

    if (retailer.phone && retailer.phone.trim().length >= 3) {
      searchOutstandingPayments(retailer.phone.trim(), retailer.name?.trim())
    } else if (retailer.name && retailer.name.trim().length >= 3) {
      searchOutstandingPayments('', retailer.name.trim())
    }
  }, [searchOutstandingPayments])

  const getCategories = () => {
    const categories = [...new Set(inventoryItems.map(item => item.category).filter(Boolean))]
    return categories.sort()
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

    if (navigator.serial) {
      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: 9600 })
      const writer = port.writable.getWriter()
      const encoder = new TextEncoder()
      const data = encoder.encode(printContent)
      await writer.write(data)
      writer.releaseLock()
      await port.close()
    } else {
      const printWindow = window.open('', '_blank')
      printWindow.document.write(`<html><head><title>Receipt</title><style>@media print { body { font-family: monospace; font-size: 12px; } .receipt { width: 80mm; margin: 0 auto; } }</style></head><body><div class="receipt">${printContent.replace(/\n/g, '<br>')}</div></body></html>`)
      printWindow.document.close()
      printWindow.print()
      printWindow.close()
    }
  }

  const printDefaultBill = async (billData) => {
    const printWindow = window.open('', '_blank')
    printWindow.document.write(generatePrintContent(billData))
    printWindow.document.close()
    printWindow.print()
    printWindow.close()
  }

  const generateThermalPrintContent = (billData) => {
    const { cart, customerName, customerPhone, retailerName, retailerPhone, total, tax, subtotal, paymentMethod, paymentAmount, creditAmount, paymentStatus, change, notes } = billData
    const date = new Date().toLocaleString()
    const fmtNum = (v) => { const n = Number(v || 0); return Number.isFinite(n) && Number.isInteger(n) ? String(n) : n.toFixed(2) }
    const nameForPrint = retailerName || customerName || 'Walk-in Retailer'
    const phoneForPrint = retailerPhone || customerPhone || 'N/A'
    let content = `\n================================\n        RECEIPT\n================================\nDate: ${date}\nRetailer: ${nameForPrint}\nPhone: ${phoneForPrint}\n--------------------------------\n`
    cart.forEach(item => {
      content += `${item.name}\n${item.quantity} x ${item.price} = ${fmtNum(item.quantity * item.price)}\n`
    })
    content += `\n--------------------------------\nSubtotal: ${fmtNum(subtotal)}\nTax: ${fmtNum(tax)}\n--------------------------------\nTOTAL: ${fmtNum(total)}\n--------------------------------\nPayment Method: ${paymentMethod || 'Cash'}\nAmount Paid: ${fmtNum(paymentAmount || total)}\n`
    if (paymentStatus === 'PARTIAL') {
      content += `Credit Amount: ${fmtNum(creditAmount || 0)}\nPayment Status: PARTIAL PAYMENT\n`
    } else {
      content += `Change: ${fmtNum(change || 0)}\n`
    }
    if (notes) { content += `Notes: ${notes}\n` }
    content += `--------------------------------\nThank you for your business!\n================================\n`
    return content
  }

  const generatePrintContent = (billData) => {
    const { cart, customerName, customerPhone, retailerName, retailerPhone, total, tax, subtotal, paymentMethod, paymentAmount, creditAmount, paymentStatus, change, notes } = billData
    const date = new Date().toLocaleString()
    const nameForPrint = retailerName || customerName || 'Walk-in Retailer'
    const phoneForPrint = retailerPhone || customerPhone || 'N/A'
    return `<html><head><title>Receipt</title><style>body { font-family: Arial, sans-serif; margin: 20px; } .header { text-align: center; margin-bottom: 20px; } .item { display: flex; justify-content: space-between; margin: 5px 0; } .total { font-weight: bold; font-size: 18px; margin-top: 20px; } .payment-info { background-color: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 5px; } .line { border-bottom: 1px solid #000; margin: 10px 0; } .partial-payment { color: #ff6b35; font-weight: bold; }</style></head><body><div class="header"><h2>RECEIPT</h2><p>Date: ${date}</p><p>Retailer: ${nameForPrint}</p><p>Phone: ${phoneForPrint}</p></div><div class="line"></div>${cart.map(item => `<div class="item"><span>${item.name} (${item.quantity}x)</span><span>${(item.quantity * item.price).toFixed(2)}</span></div>`).join('')}<div class="line"></div><div class="item"><span>Subtotal:</span><span>${subtotal}</span></div><div class="item"><span>Tax:</span><span>${tax}</span></div><div class="item total"><span>TOTAL:</span><span>${total}</span></div><div class="line"></div><div class="payment-info"><div class="item"><span>Payment Method:</span><span>${paymentMethod || 'Cash'}</span></div><div class="item"><span>Amount Paid:</span><span>${paymentAmount || total}</span></div>${paymentStatus === 'PARTIAL' ? `<div class="item partial-payment"><span>Credit Amount:</span><span>${creditAmount || 0}</span></div>` : `<div class="item"><span>Change:</span><span>${change || 0}</span></div>`}${notes ? `<div class="item"><span>Notes:</span><span>${notes}</span></div>` : ''}</div><div class="line"></div><p style="text-align: center; margin-top: 30px;">Thank you for your business!</p></body></html>`
  }

  const removeFromCart = (productId) => {
    const newCart = currentCart.filter(item => item.id !== productId)
    updateCurrentTab({ cart: newCart })
    setSelectedRows(prev => prev.filter(id => id !== productId))
  }

  const removeSelectedRows = () => {
    const newCart = currentCart.filter(item => !selectedRows.includes(item.id))
    updateCurrentTab({ cart: newCart })
    setSelectedRows([])
  }

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
    } else {
      const newCart = currentCart.map(item => 
        item.id === productId ? { ...item, quantity: newQuantity } : item
      )
      updateCurrentTab({ cart: newCart })
    }
  }

  const updateItemDiscount = (productId, discount) => {
    const newCart = currentCart.map(item => 
      item.id === productId ? { ...item, discount: parseFloat(discount) || 0 } : item
    )
    updateCurrentTab({ cart: newCart })
  }

  const updateItemPrice = (productId, price) => {
    const newCart = currentCart.map(item => {
      if (item.id === productId) {
        let newCustomPrice
        if (price === '' || price === null || price === undefined) {
          newCustomPrice = 0
        } else {
          const parsedPrice = parseFloat(price)
          newCustomPrice = isNaN(parsedPrice) ? 0 : parsedPrice
        }
        return { ...item, customPrice: newCustomPrice }
      }
      return item
    })
    updateCurrentTab({ cart: newCart })
  }

  const resetItemPrice = (productId) => {
    const newCart = currentCart.map(item => 
      item.id === productId ? { ...item, customPrice: null } : item
    )
    updateCurrentTab({ cart: newCart })
  }

  const handleSettlementPaymentChange = (amount) => {
    const paymentAmount = parseFloat(amount);
    setSettlementPaymentAmount(amount);
    if (isSettlementPartial || isSettlementFullyCredit) {
      const safePayment = Number.isNaN(paymentAmount) ? 0 : Math.max(0, paymentAmount);
      const { baseOutstanding, isCredit } = calculateSettlementValues();
      let creditAmount;
      if (isSettlementFullyCredit) {
        creditAmount = isCredit ? baseOutstanding : -Math.abs(baseOutstanding - safePayment);
      } else {
        creditAmount = baseOutstanding - safePayment;
      }
      setSettlementCreditAmount(creditAmount.toFixed(2));
    }
  };

  const handleSettlementCreditChange = (amount) => {
    setSettlementCreditAmount(amount);
    if (isSettlementFullyCredit) {
      setSettlementPaymentAmount('0');
    }
  };

  const handleSettlementPaymentType = (type) => {
    const { baseOutstanding, isCredit } = calculateSettlementValues();
    switch (type) {
      case 'full':
        setIsSettlementPartial(false);
        setIsSettlementFullyCredit(false);
        setSettlementPaymentAmount(Math.abs(baseOutstanding).toFixed(2));
        setSettlementCreditAmount('0');
        setShowSettlementOptions(false);
        break;
      case 'partial':
        setIsSettlementPartial(true);
        setIsSettlementFullyCredit(false);
        setSettlementPaymentAmount('');
        setSettlementCreditAmount(isCredit ? baseOutstanding.toFixed(2) : Math.abs(baseOutstanding).toFixed(2));
        setShowSettlementOptions(true);
        break;
      case 'fullyCredit':
        setIsSettlementPartial(false);
        setIsSettlementFullyCredit(true);
        setSettlementPaymentAmount('0');
        setSettlementCreditAmount(Math.abs(baseOutstanding).toFixed(2));
        setShowSettlementOptions(true);
        break;
      case 'balance':
        setIsSettlementPartial(false);
        setIsSettlementFullyCredit(false);
        setSettlementPaymentAmount('0');
        setSettlementCreditAmount(baseOutstanding.toFixed(2));
        setShowSettlementOptions(true);
        break;
      default:
        break;
    }
  };

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
      const itemTotal = (itemPrice * item.quantity) - itemDiscount
      return sum + Math.max(0, itemTotal)
    }, 0)
  }, [currentCart])

  const tax = useMemo(() => {
    return subtotal * (taxRate / 100)
  }, [subtotal, taxRate])

  const settlementTotal = useMemo(() => {
    if (currentCart.length === 0 && selectedOutstandingPayments.length > 0) {
      return outstandingPayments
        .filter(payment => selectedOutstandingPayments.includes(payment.id))
        .reduce((total, payment) => {
          const amount = payment.creditAmount !== undefined && payment.creditAmount !== null
            ? parseFloat(payment.creditAmount)
            : (payment.total !== undefined && payment.total !== null
              ? parseFloat(payment.total)
              : parseFloat(payment.outstandingAmount || 0) * (payment.isCredit ? -1 : 1));
          return total + amount;
        }, 0);
    }
    return 0;
  }, [outstandingPayments, selectedOutstandingPayments, currentCart.length]);

  const outstandingTotal = useMemo(() => {
    if (currentCart.length === 0 && selectedOutstandingPayments.length > 0) {
      if (isSettlementPartial && settlementPaymentAmount && settlementPaymentAmount.trim() !== '') {
        const partialAmount = parseFloat(settlementPaymentAmount) || 0;
        const actualPartial = Math.min(partialAmount, Math.abs(settlementTotal));
        return settlementTotal > 0 ? actualPartial : settlementTotal;
      } else if (isSettlementFullyCredit) {
        return 0;
      } else {
        return settlementTotal;
      }
    }
    return outstandingPayments.reduce((total, payment) => {
      const amount = payment.creditAmount !== undefined && payment.creditAmount !== null
        ? parseFloat(payment.creditAmount)
        : (payment.total !== undefined && payment.total !== null
          ? parseFloat(payment.total)
          : parseFloat(payment.outstandingAmount || 0) * (payment.isCredit ? -1 : 1));
      return total + amount;
    }, 0);
  }, [outstandingPayments, selectedOutstandingPayments, currentCart.length, isSettlementPartial, settlementPaymentAmount, isSettlementFullyCredit, settlementTotal]);

  const billAmount = useMemo(() => {
    return subtotal + tax - totalDiscount
  }, [subtotal, tax, totalDiscount])

  const total = useMemo(() => {
    return billAmount + outstandingTotal
  }, [billAmount, outstandingTotal])

  const calculateSettlementValues = useCallback(() => {
    const baseOutstanding = currentCart.length === 0 ? settlementTotal : outstandingTotal;
    const isCredit = baseOutstanding < 0;
    const parsedPartialAmount = parseFloat(settlementPaymentAmount);

    let paymentValue;
    if (isSettlementFullyCredit) {
      paymentValue = 0;
    } else if (isSettlementPartial) {
      paymentValue = Number.isNaN(parsedPartialAmount) ? 0 : Math.max(0, parsedPartialAmount);
    } else {
      paymentValue = isCredit ? Math.abs(baseOutstanding) : Math.max(0, baseOutstanding);
    }

    if (!Number.isFinite(paymentValue)) { paymentValue = 0; }

    let creditValue;
    if (isSettlementFullyCredit) {
      const creditNoteAmount = parseFloat(settlementCreditAmount);
      creditValue = isCredit ? baseOutstanding : (Number.isNaN(creditNoteAmount) ? -Math.abs(baseOutstanding) : -Math.abs(creditNoteAmount));
    } else {
      creditValue = baseOutstanding - (isCredit ? -paymentValue : paymentValue);
    }

    if (!Number.isFinite(creditValue)) { creditValue = 0; }
    if (Math.abs(creditValue) < 0.01) { creditValue = 0; }

    const normalizedPayment = Number.parseFloat(paymentValue.toFixed(2));
    const normalizedCredit = Number.parseFloat(creditValue.toFixed(2));

    return {
      baseOutstanding,
      isCredit,
      paymentAmount: Number.isNaN(normalizedPayment) ? 0 : normalizedPayment,
      creditAmount: Number.isNaN(normalizedCredit) ? 0 : normalizedCredit
    };
  }, [
    currentCart.length,
    settlementTotal,
    outstandingTotal,
    isSettlementFullyCredit,
    isSettlementPartial,
    settlementPaymentAmount,
    settlementCreditAmount
  ]);

  const settlementSnapshot = useMemo(() => calculateSettlementValues(), [calculateSettlementValues]);
  const settlementPaymentValue = settlementSnapshot.paymentAmount;
  const settlementBalanceValue = settlementSnapshot.creditAmount;
  const settlementBaseAmount = settlementSnapshot.baseOutstanding;

  useEffect(() => {
    if (
      currentCart.length === 0 &&
      selectedOutstandingPayments.length > 0 &&
      !isSettlementPartial &&
      !isSettlementFullyCredit
    ) {
      const { paymentAmount, creditAmount } = calculateSettlementValues();
      const formattedPayment = paymentAmount.toFixed(2);
      const formattedCredit = creditAmount.toFixed(2);
      if (settlementPaymentAmount !== formattedPayment) setSettlementPaymentAmount(formattedPayment);
      if (settlementCreditAmount !== formattedCredit) setSettlementCreditAmount(formattedCredit);
    }
  }, [currentCart.length, selectedOutstandingPayments, isSettlementPartial, isSettlementFullyCredit, calculateSettlementValues, settlementPaymentAmount, settlementCreditAmount])

  const settleOutstandingPayments = useCallback(async () => {
    if (selectedOutstandingPayments.length === 0) { return null; }

    const referencePayment = outstandingPayments.find(payment => selectedOutstandingPayments.includes(payment.id));
    if (!referencePayment) { throw new Error('Unable to locate outstanding payment details for settlement'); }

    const { paymentAmount, creditAmount, isCredit } = calculateSettlementValues();
    const paymentAmountForBackend = isCredit ? Math.abs(creditAmount) : Math.max(0, paymentAmount);

    const payload = {
      customerName: referencePayment.customer_name,
      phone: referencePayment.customer_phone,
      paymentAmount: paymentAmountForBackend,
      paymentMethod: (paymentMethod || 'CASH').toUpperCase()
    };

    if (isCredit) {
      payload.isCreditUsage = true;
      payload.creditAmount = Math.abs(creditAmount);
    }

    if (paymentAmountForBackend === 0 && !isCredit) {
      payload.isCreditNote = true;
    }

    const clearResponse = await api.post('/sales/clear-outstanding', payload);
    if (!clearResponse.data?.success) { throw new Error(clearResponse.data?.message || 'Failed to clear outstanding payments'); }
    return clearResponse.data;
  }, [selectedOutstandingPayments, outstandingPayments, calculateSettlementValues, paymentMethod]);

  const normalizeCartItemForPrint = useCallback((item) => {
    const parseNumber = (value) => {
      if (value === null || value === undefined || value === '') return NaN;
      if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
      const normalized = String(value).replace(/[^\d.\-]/g, '').replace(/(\..*?)\./g, '$1');
      if (normalized === '' || normalized === '-' || normalized === '.') return NaN;
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : NaN;
    };

    const resolveNumber = (candidates, fallback = 0) => {
      for (const candidate of candidates) {
        const parsed = parseNumber(candidate);
        if (Number.isFinite(parsed)) return parsed;
      }
      return fallback;
    };

    const quantity = resolveNumber([item?.quantity, item?.qty, item?.count], 0);
    const rawUnitPrice = resolveNumber([item?.customPrice, item?.custom_price, item?.unitPrice, item?.price, item?.sellingPrice, item?.salePrice, item?.selling_price, item?.catalogPrice, item?.catalog_price, item?.unit_price, item?.originalPrice, item?.wholesalePrice, item?.retailPrice, item?.basePrice], NaN);
    const discount = resolveNumber([item?.discount, item?.discountAmount], 0);
    let total = resolveNumber([item?.total, item?.total_price, item?.lineTotal, item?.amount, item?.subtotal, item?.subTotal], NaN);

    let unitPrice = Number.isFinite(rawUnitPrice) ? rawUnitPrice : NaN;
    if (!Number.isFinite(unitPrice) || unitPrice === 0) {
      if (Number.isFinite(total) && quantity !== 0) { unitPrice = (total + discount) / quantity; }
    }
    if (!Number.isFinite(total)) {
      if (Number.isFinite(unitPrice)) { total = quantity * unitPrice - discount; } else { total = 0; }
    }

    unitPrice = Number.isFinite(unitPrice) ? Math.round(unitPrice) : 0;
    total = Number.isFinite(total) ? Math.round(total) : 0;

    return {
      name: item?.name || item?.productName || item?.itemName || 'Item',
      sku: item?.sku || item?.productSku || item?.barcode || '',
      quantity,
      unitPrice,
      price: unitPrice,
      discount: Math.round(discount),
      total: Number.isFinite(total) ? total : 0
    };
  }, []);

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
          if (response.data.success) { setSalespeople(response.data.data) }
        } catch (error) {
          console.error('Error loading salespeople:', error)
        }
      }
    }
    loadSalespeople()
  }, [user])

  useEffect(() => {
    const loadCompanyInfo = async () => {
      const fallbackInfo = { ...DEFAULT_COMPANY_INFO }
      if (!user) { setCompanyInfo(fallbackInfo); return; }

      const normalizedScopeType = typeof user.scopeType === 'string' ? user.scopeType.toUpperCase() : null
      const branchId = user.branchId || (normalizedScopeType === 'BRANCH' ? user.scopeId : null)
      const warehouseId = user.warehouseId || (normalizedScopeType === 'WAREHOUSE' ? user.scopeId : null)

      try {
        if (branchId) {
          const response = await api.get(`/branches/${branchId}`)
          if (response.data?.success && response.data?.data) {
            const branch = response.data.data
            setCompanyInfo({ name: branch.name || fallbackInfo.name, address: branch.location || branch.address || fallbackInfo.address, phone: branch.phone || branch.managerPhone || fallbackInfo.phone, email: branch.email || branch.managerEmail || fallbackInfo.email, logoUrl: branch.logoUrl || fallbackInfo.logoUrl })
            return
          }
        }
        if (warehouseId) {
          const response = await api.get(`/warehouses/${warehouseId}`)
          if (response.data?.success && response.data?.data) {
            const warehouse = response.data.data
            setCompanyInfo({ name: warehouse.name || fallbackInfo.name, address: warehouse.location || fallbackInfo.address, phone: warehouse.phone || warehouse.managerPhone || fallbackInfo.phone, email: warehouse.email || fallbackInfo.email, logoUrl: warehouse.logoUrl || fallbackInfo.logoUrl })
            return
          }
        }
        setCompanyInfo(fallbackInfo)
      } catch (error) {
        console.error('Error loading company info:', error)
        setCompanyInfo(fallbackInfo)
      }
    }
    loadCompanyInfo()
  }, [user])

  const clearAllPOSState = () => {
    if (!currentTab) return
    const clearedState = createEmptyTabState({ createdAt: currentTab.createdAt, modifiedAt: new Date() })
    updateCurrentTab({ cart: clearedState.cart, customerName: clearedState.customerName, customerPhone: clearedState.customerPhone, selectedRetailer: clearedState.selectedRetailer, paymentMethod: clearedState.paymentMethod, paymentAmount: clearedState.paymentAmount, creditAmount: clearedState.creditAmount, isPartialPayment: clearedState.isPartialPayment, isFullyCredit: clearedState.isFullyCredit, isBalancePayment: clearedState.isBalancePayment, outstandingPayments: clearedState.outstandingPayments, selectedOutstandingPayments: clearedState.selectedOutstandingPayments, settlementPaymentAmount: clearedState.settlementPaymentAmount, settlementCreditAmount: clearedState.settlementCreditAmount, isSettlementPartial: clearedState.isSettlementPartial, isSettlementFullyCredit: clearedState.isSettlementFullyCredit, showSettlementOptions: clearedState.showSettlementOptions, taxRate: clearedState.taxRate, totalDiscount: clearedState.totalDiscount, notes: clearedState.notes })
    setCustomerName(clearedState.customerName)
    setCustomerPhone(clearedState.customerPhone)
    setSelectedRetailer(clearedState.selectedRetailer)
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
    setRetailerSearchResults([])
    setShowRetailerSearch(false)
    setSearchResults([])
    setShowSearchResults(false)
    setManualInput('')
    setBarcodeInput('')
    setSearchQuery('')
    setSelectedCategory('all')
    setSelectedRows([])
    setShowOutstandingPanel(false)
  }

  const refreshOutstandingPayments = () => {
    setSettlementPaymentAmount('')
    setSettlementCreditAmount('')
    setIsSettlementPartial(false)
    setIsSettlementFullyCredit(false)
    setOutstandingPayments([])
    setSelectedOutstandingPayments([])
    if (currentTab) {
      updateCurrentTab({ outstandingPayments: [], selectedOutstandingPayments: [], settlementPaymentAmount: '', settlementCreditAmount: '', isSettlementPartial: false, isSettlementFullyCredit: false, showSettlementOptions: false })
    }
  }

  const handlePayment = async () => {
    try {
      if (!user) { alert('❌ User not authenticated. Please login again.'); return; }
      if (!currentCart || (currentCart.length === 0 && selectedOutstandingPayments.length === 0)) { alert('❌ Cart is empty and no outstanding payments selected.'); return; }
      if (total <= 0 && currentCart.length === 0) { alert('❌ Cannot process a sale without items.'); return; }
      if (selectedOutstandingPayments.length > 0) {
        const confirmOutstanding = confirm(`⚠️ You have selected ${selectedOutstandingPayments.length} outstanding payment(s) totaling ${outstandingTotal.toFixed(2)} to settle.\n\nDo you want to proceed?`)
        if (!confirmOutstanding) return
      }
      if (!currentTab) { alert('❌ No active tab found. Please refresh the page.'); return; }
      const billAmountCalc = subtotal + tax - totalDiscount
      const { totalWithOutstanding: normalizedTotalWithOutstanding, finalPaymentAmount, finalCreditAmount, finalPaymentStatus, paymentTypeValue } = calculateWarehousePaymentDetails({ billAmount: billAmountCalc, outstandingTotal, isFullyCredit, isPartialPayment, isBalancePayment, inputPaymentAmount: paymentAmount })
      if (isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
        if (finalPaymentAmount <= 0) { alert('❌ Payment amount must be greater than 0 for partial payments'); return; }
        const sum = finalPaymentAmount + finalCreditAmount
        if (Math.abs(sum - normalizedTotalWithOutstanding) > 0.01) { alert(`❌ Payment amounts don't add up.`); return; }
      }
      if (user.role === 'ADMIN' && !isAdminMode) { alert('Please select a branch or warehouse from the Admin Dashboard.'); return; }
      if (!selectedRetailer) { alert('❌ Please select a retailer before completing the sale.'); return; }
      if ((isPartialPayment || isFullyCredit) && (!selectedRetailer?.id)) { alert('❌ Retailer selection is required for partial or credit sales.'); return; }
      const paymentMethodValue = isFullyCredit ? 'FULLY_CREDIT' : (isBalancePayment ? 'CASH' : (paymentMethod || 'CASH'))
      const isSettlementOnly = selectedOutstandingPayments.length > 0 && currentCart.length === 0 && showSettlementOptions
      const salePayloadInfo = buildWarehouseSalePayload({ billAmount: billAmountCalc, totalWithOutstanding: normalizedTotalWithOutstanding, finalPaymentAmount, finalCreditAmount, finalPaymentStatus, paymentMethodValue, paymentTypeValue, includeOutstandingPayments: isSettlementOnly })
      if (!salePayloadInfo) return
      const { payload: saleData, retailerInfo } = salePayloadInfo
      const result = await dispatch(createWarehouseSale(saleData))
      if (createWarehouseSale.fulfilled.match(result)) {
        const sale = result.payload?.data || result.payload
        if (isSettlementOnly) {
          try { await settleOutstandingPayments() } catch (error) { alert(`❌ Error processing outstanding payments: ${error.message}`); }
        }
        try { await printReceipt(sale) } catch (error) { /* handled */ }
        alert(`✅ Payment successful!\n\nInvoice: ${sale.invoice_no}\nTotal: ${normalizedTotalWithOutstanding.toFixed(2)}\nRetailer: ${retailerInfo.name}`)
        clearAllPOSState()
        setTimeout(() => refreshOutstandingPayments(), 2000)
        if (barcodeInputRef.current) { barcodeInputRef.current.focus() }
      } else if (createWarehouseSale.rejected.match(result)) {
        const error = result.payload || result.error
        showToast(error?.message || 'Payment failed.', 'error')
      }
    } catch (error) {
      alert(`❌ Payment processing error: ${error.message}`)
    }
  }

  const handleSaleOnly = async () => {
    if (isProcessingSaleOnly) return
    setIsProcessingSaleOnly(true)
    try {
      if (user.role === 'ADMIN' && !isAdminMode) { alert('Please select a branch or warehouse.'); setIsProcessingSaleOnly(false); return; }
      if (!selectedRetailer || selectedRetailer.id === undefined || selectedRetailer.id === null) { alert('❌ Please select a retailer before completing this sale.'); setIsProcessingSaleOnly(false); return; }
      if ((isPartialPayment || isFullyCredit) && (!selectedRetailer?.id)) { alert('❌ Retailer selection is required for partial payments and credit sales.'); setIsProcessingSaleOnly(false); return; }
      if (!user) { alert('❌ User not authenticated.'); setIsProcessingSaleOnly(false); return; }
      if (!currentCart || currentCart.length === 0) {
        if (selectedOutstandingPayments.length > 0) {
          const { baseOutstanding, isCredit } = calculateSettlementValues();
          if (isCredit) { setShowSettlementOptions(true); setIsSettlementPartial(false); setIsSettlementFullyCredit(false); setSettlementPaymentAmount(Math.abs(baseOutstanding).toFixed(2)); setSettlementCreditAmount('0'); }
          else { if (!showSettlementOptions) { setShowSettlementOptions(true); } }
          const { paymentAmount: settlementPaymentValue, creditAmount: settlementCreditValue } = calculateSettlementValues();
          if (isSettlementPartial && settlementPaymentValue <= 0) { alert('❌ Please enter a payment amount greater than 0 for partial settlement.'); setIsProcessingSaleOnly(false); return; }
          const retailerNameDisplay = selectedRetailer?.name || customerName || 'Unknown'
          const retailerPhoneDisplay = selectedRetailer?.phone || customerPhone || 'N/A'
          const settlementTitle = baseOutstanding < 0 ? '💰 CREDIT REFUND' : '💰 OUTSTANDING PAYMENT SETTLEMENT';
          const confirmOutstandingOnly = confirm(`${settlementTitle}\n\nRetailer: ${retailerNameDisplay}\nPhone: ${retailerPhoneDisplay}\nTotal ${baseOutstanding < 0 ? 'Credit' : 'Outstanding'}: ${Math.abs(baseOutstanding).toFixed(2)}\n${baseOutstanding < 0 ? 'Refund' : 'Payment'} Amount: ${settlementPaymentValue.toFixed(2)}\nBalance After: ${settlementCreditValue.toFixed(2)}\n\nDo you want to proceed?`)
          if (!confirmOutstandingOnly) { setIsProcessingSaleOnly(false); return; }
          try {
            const settlementResult = await settleOutstandingPayments();
            if (settlementResult?.data?.settlementSale) {
              const settlementSale = settlementResult.data.settlementSale;
              const { paymentAmount: sv, creditAmount: scv, baseOutstanding: ba } = calculateSettlementValues();
              const printData = {
                type: 'receipt',
                title: ba < 0 ? 'CREDIT REFUND RECEIPT' : 'PAYMENT SETTLEMENT RECEIPT',
                companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
                companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
                companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
                companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
                logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
                receiptNumber: settlementSale.invoice_no || `SETTLE-${Date.now()}`,
                date: new Date(settlementSale.created_at).toLocaleDateString(),
                time: new Date(settlementSale.created_at).toLocaleTimeString(),
                cashierName: user?.name || user?.username || 'Warehouse Keeper',
                customerName: settlementSale.customer_name || retailerNameDisplay,
                customerPhone: settlementSale.customer_phone || retailerPhoneDisplay,
                items: [], subtotal: 0, tax: 0, discount: 0, invoiceTotal: 0,
                oldBalance: Math.round(Math.abs(ba)),
                total: Math.round(parseFloat(settlementSale.total || 0)),
                paymentMethod: settlementSale.payment_method || paymentMethod || 'CASH',
                paymentAmount: Math.round(sv),
                creditAmount: Math.round(scv),
                remainingBalance: Math.round(scv),
                change: 0, notes: '',
                footerMessage: ba < 0 ? 'Credit refund processed!' : 'Thank you for your payment!'
              };
              try {
                const { success, message, usedBrowserFallback } = await attemptReceiptPrint(printData, 'Settlement receipt')
                if (!success) { alert(`⚠️ Settlement completed but receipt could not be printed.\n\nReason: ${message || 'Unknown error'}`) }
              } catch (printError) {
                alert(`⚠️ Settlement completed but receipt could not be printed.\n\nReason: ${printError.message}`)
              }
            }
            alert(`✅ ${baseOutstanding < 0 ? 'Credit Refund' : 'Outstanding Settlement'} Completed!\n\nRetailer: ${retailerNameDisplay}\nAmount: ${settlementPaymentValue.toFixed(2)}\nBalance After: ${settlementCreditValue.toFixed(2)}`);
            clearAllPOSState()
            setTimeout(() => refreshOutstandingPayments(), 2000)
            setIsProcessingSaleOnly(false);
            return
          } catch (error) {
            alert(`❌ Error processing settlement: ${error.message}`)
            setIsProcessingSaleOnly(false);
            return
          }
        } else {
          alert('❌ Cart is empty and no outstanding payments selected.')
          setIsProcessingSaleOnly(false);
          return
        }
      }
      if (total <= 0 && currentCart.length === 0) { alert('❌ Cannot process a sale without items.'); setIsProcessingSaleOnly(false); return; }
      if (selectedOutstandingPayments.length > 0) {
        const confirmOutstanding = confirm(`⚠️ You have selected ${selectedOutstandingPayments.length} outstanding payment(s) totaling ${outstandingTotal.toFixed(2)} to settle.\n\nDo you want to proceed?`)
        if (!confirmOutstanding) { setIsProcessingSaleOnly(false); return; }
      }
      const { totalWithOutstanding: normalizedBillTotal, finalPaymentAmount, finalCreditAmount, finalPaymentStatus, paymentTypeValue } = calculateWarehousePaymentDetails({ billAmount, outstandingTotal: 0, isFullyCredit, isPartialPayment, isBalancePayment, inputPaymentAmount: paymentAmount })
      if (isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
        if (finalPaymentAmount <= 0) { alert('❌ Payment amount must be greater than 0 for partial payments'); setIsProcessingSaleOnly(false); return; }
        const sum = finalPaymentAmount + finalCreditAmount
        if (Math.abs(sum - normalizedBillTotal) > 0.01) { alert(`❌ Payment amounts don't add up.`); setIsProcessingSaleOnly(false); return; }
      }
      const paymentMethodValue = isFullyCredit ? 'FULLY_CREDIT' : (paymentMethod || 'CASH')
      const isSettlementOnly = selectedOutstandingPayments.length > 0 && currentCart.length === 0 && showSettlementOptions
      const salePayloadInfo = buildWarehouseSalePayload({ billAmount, totalWithOutstanding: normalizedBillTotal, finalPaymentAmount, finalCreditAmount, finalPaymentStatus, paymentMethodValue, paymentTypeValue, includeOutstandingPayments: isSettlementOnly })
      if (!salePayloadInfo) { setIsProcessingSaleOnly(false); return; }
      const { payload: saleData, retailerInfo } = salePayloadInfo
      const result = await dispatch(createWarehouseSale(saleData))
      if (createWarehouseSale.fulfilled.match(result)) {
        const sale = result.payload.data || result.payload
        if (selectedOutstandingPayments.length > 0) {
          const shouldClearOutstanding = (currentCart.length === 0 && showSettlementOptions) || (paymentMethodValue === 'CASH' && selectedOutstandingPayments.length > 0 && finalPaymentAmount > 0)
          if (shouldClearOutstanding) {
            try { await settleOutstandingPayments(); } catch (error) { alert(`❌ Error processing outstanding payments: ${error.message}`); }
          }
        }
        try {
          const printableItems = currentCart.map(normalizeCartItemForPrint)
          const printableSubtotal = Math.round(Math.max(0, subtotal))
          const printableTax = Math.round(Math.max(0, tax))
          const derivedDiscount = Math.max(0, Math.round((printableSubtotal + printableTax) - Math.max(0, billAmount || 0)))
          const printableDiscount = Math.max(0, Math.round(totalDiscount || derivedDiscount))
          const printableInvoiceTotal = Math.max(0, (printableSubtotal + printableTax) - printableDiscount)
          const pd = {
            type: 'warehouse', title: 'SALES RECEIPT',
            companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
            companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
            companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
            companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
            logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
            items: printableItems,
            subtotal: printableSubtotal, tax: printableTax, discount: printableDiscount,
            invoiceTotal: printableInvoiceTotal,
            oldBalance: Math.round(outstandingTotal || 0),
            total: Math.round(total),
            customerName: retailerInfo.name || 'Walk-in Retailer',
            customerPhone: retailerInfo.phone || '',
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            receiptNumber: sale.invoice_no || `POS-${Date.now()}`,
            branchName: user?.branchName || '',
            warehouseName: user?.warehouseName || scopeInfo?.scopeName || '',
            cashierName: user?.name || user?.username || 'Cashier',
            paymentMethod: paymentMethodValue,
            paymentAmount: Math.round(finalPaymentAmount),
            creditAmount: Math.round(finalCreditAmount),
            remainingBalance: Math.round(finalCreditAmount),
            change: isPartialPayment ? 0 : Math.round((parseFloat(paymentAmount) || total) - total),
            footerMessage: 'Thank you for choosing PetZone!'
          }
          const { success: printSuccess, message: printMessage, usedBrowserFallback } = await attemptReceiptPrint(pd, 'Sale receipt')
          const fmtNumAlert = (v) => { const n = Number(v || 0); return Number.isFinite(n) && Number.isInteger(n) ? String(n) : n.toFixed(2) }
          if (printSuccess) {
            alert(`✅ Sale completed & receipt printed!\n\nInvoice: ${sale.invoice_no}\nBill: ${fmtNumAlert(normalizedBillTotal)}\nOutstanding: ${fmtNumAlert(outstandingTotal)}\nTotal: ${fmtNumAlert(total)}\nRetailer: ${retailerInfo.name}`)
          } else {
            alert(`✅ Sale completed!\n❌ Print failed.\n\nInvoice: ${sale.invoice_no}\nRetailer: ${retailerInfo.name}\n\nReason: ${printMessage || 'Unknown error'}`)
          }
        } catch (printError) {
          alert(`✅ Sale completed!\n❌ Print failed.\n\nInvoice: ${sale.invoice_no}\nRetailer: ${retailerInfo.name}\n\nReason: ${printError.message}`)
        }
        clearAllPOSState()
        setTimeout(() => refreshOutstandingPayments(), 2000)
      } else if (createWarehouseSale.rejected.match(result)) {
        const error = result.payload || result.error
        alert(`❌ Sale failed: ${error.message || 'Unknown error'}`)
      }
    } catch (error) {
      alert(`❌ Sale failed: ${error.message || 'Unknown error'}`)
    } finally {
      setIsProcessingSaleOnly(false)
    }
  }

  const attemptReceiptPrint = async (printData, contextLabel = 'receipt') => {
    const contextTag = `[WAREHOUSE] ${contextLabel}`
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
        const thermalResult = await printToThermalPrinter(printData)
        success = !!thermalResult?.success
        message = thermalResult?.message || ''
      } catch (serialError) {
        const canFallbackToBrowser = typeof window !== 'undefined' && typeof window.print === 'function'
        if (canFallbackToBrowser) {
          usedBrowserFallback = true
          try {
            const browserResult = await printToBrowser(printData)
            success = !!browserResult?.success
            message = browserResult?.message || ''
          } catch (browserError) {
            message = browserError?.message || 'Browser print failed'
          }
        } else {
          message = serialError?.message || 'Thermal printer not available'
        }
      }
    }

    return { success, message, usedBrowserFallback }
  };

  const handleSaleWithoutPrint = async () => {
    if (isProcessingSale) return
    setIsProcessingSale(true)
    try {
      if (user.role === 'ADMIN' && !isAdminMode) { alert('Please select a branch or warehouse.'); setIsProcessingSale(false); return; }
      if (!selectedRetailer || selectedRetailer.id === undefined || selectedRetailer.id === null) { alert('❌ Please select a retailer.'); setIsProcessingSale(false); return; }
      if ((isPartialPayment || isFullyCredit) && (!selectedRetailer?.id)) { alert('❌ Retailer selection is required.'); setIsProcessingSale(false); return; }
      if (!user) { alert('❌ User not authenticated.'); setIsProcessingSale(false); return; }
      if (!currentCart || currentCart.length === 0) {
        if (selectedOutstandingPayments.length > 0) {
          const { paymentAmount: sv, creditAmount: scv, baseOutstanding } = calculateSettlementValues()
          if (isSettlementPartial && sv <= 0) { alert('❌ Please enter a payment amount.'); setIsProcessingSale(false); return; }
          const retailerNameDisplay = retailerDisplayName
          const retailerPhoneDisplay = retailerDisplayPhone || 'N/A'
          const confirmOutstandingOnly = confirm(`💰 Outstanding Payment Settlement\n\nRetailer: ${retailerNameDisplay}\nPhone: ${retailerPhoneDisplay}\nTotal Outstanding: ${baseOutstanding.toFixed(2)}\nPayment Amount: ${sv.toFixed(2)}\nBalance After: ${scv.toFixed(2)}\n\nDo you want to proceed?`)
          if (!confirmOutstandingOnly) { setIsProcessingSale(false); return; }
          try {
            const settlementResult = await settleOutstandingPayments()
            if (settlementResult?.data?.settlementSale) {
              const settlementSale = settlementResult.data.settlementSale;
              const { paymentAmount: svr, creditAmount: scvr, baseOutstanding: bo } = calculateSettlementValues();
              const pd = {
                type: 'receipt', title: 'PAYMENT SETTLEMENT RECEIPT',
                companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
                companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
                companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
                companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
                logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
                receiptNumber: settlementSale.invoice_no || `SETTLE-${Date.now()}`,
                date: new Date(settlementSale.created_at).toLocaleDateString(),
                time: new Date(settlementSale.created_at).toLocaleTimeString(),
                cashierName: user?.name || user?.username || 'Warehouse Keeper',
                customerName: settlementSale.customer_name || retailerNameDisplay,
                customerPhone: settlementSale.customer_phone || retailerPhoneDisplay,
                items: [], subtotal: 0, tax: 0, discount: 0, invoiceTotal: 0,
                oldBalance: Math.round(Number.isFinite(bo) ? Math.abs(bo) : 0),
                total: Math.round(parseFloat(settlementSale.total || 0)),
                paymentMethod: settlementSale.payment_method || paymentMethod || 'CASH',
                paymentAmount: Math.round(svr),
                creditAmount: Math.round(scvr),
                remainingBalance: Math.round(scvr),
                change: 0, notes: '', footerMessage: 'Thank you for your payment!'
              };
              try {
                const { success, message } = await attemptReceiptPrint(pd, 'Outstanding settlement receipt')
                if (!success) { alert(`⚠️ Settlement completed but receipt not printed.\n\nReason: ${message || 'Unknown error'}`) }
              } catch (printError) {
                alert(`⚠️ Settlement completed but receipt not printed.\n\nReason: ${printError.message}`)
              }
            }
            alert(`✅ Outstanding Settlement Completed!\n\nRetailer: ${retailerNameDisplay}\nPaid: ${sv.toFixed(2)}\nBalance After: ${scv.toFixed(2)}`);
            clearAllPOSState()
            setTimeout(() => refreshOutstandingPayments(), 2000)
            setIsProcessingSale(false)
            return
          } catch (error) {
            alert(`❌ Error processing settlement: ${error.message}`)
            setIsProcessingSale(false)
            return
          }
        } else {
          alert('❌ Cart is empty.')
          setIsProcessingSale(false)
          return
        }
      }
      if (total <= 0 && currentCart.length === 0) { alert('❌ Cannot process a sale without items.'); setIsProcessingSale(false); return; }
      if (selectedOutstandingPayments.length > 0) {
        const confirmOutstanding = confirm(`⚠️ You have selected ${selectedOutstandingPayments.length} outstanding payment(s) totaling ${outstandingTotal.toFixed(2)} to settle.\n\nDo you want to proceed?`)
        if (!confirmOutstanding) { setIsProcessingSale(false); return; }
      }
      const paymentMethodValue = isFullyCredit ? 'FULLY_CREDIT' : (paymentMethod || 'CASH')
      const isSettlementOnly = selectedOutstandingPayments.length > 0 && currentCart.length === 0 && showSettlementOptions
      const { totalWithOutstanding: normalizedBillTotal, finalPaymentAmount, finalCreditAmount, finalPaymentStatus, paymentTypeValue } = calculateWarehousePaymentDetails({ billAmount, outstandingTotal: 0, isFullyCredit, isPartialPayment, isBalancePayment, inputPaymentAmount: paymentAmount })
      if (isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
        if (finalPaymentAmount <= 0) { alert('❌ Payment amount must be greater than 0.'); setIsProcessingSale(false); return; }
        const sum = finalPaymentAmount + finalCreditAmount
        if (Math.abs(sum - normalizedBillTotal) > 0.01) { alert(`❌ Payment amounts don't add up.`); setIsProcessingSale(false); return; }
      }
      const salePayloadInfo = buildWarehouseSalePayload({ billAmount, totalWithOutstanding: normalizedBillTotal, finalPaymentAmount, finalCreditAmount, finalPaymentStatus, paymentMethodValue, paymentTypeValue, includeOutstandingPayments: isSettlementOnly })
      if (!salePayloadInfo) { setIsProcessingSale(false); return; }
      const { payload: saleData, retailerInfo } = salePayloadInfo
      const result = await dispatch(createWarehouseSale(saleData))
      if (createWarehouseSale.fulfilled.match(result)) {
        const sale = result.payload?.data || result.payload
        if (isSettlementOnly) {
          try { await settleOutstandingPayments() } catch (error) { alert(`❌ Error processing outstanding payments: ${error.message}`); setIsProcessingSale(false); return; }
        }
        alert(`✅ Sale completed successfully!\n\nInvoice: ${sale.invoice_no}\nBill: ${normalizedBillTotal.toFixed(2)}\nPaid: ${finalPaymentAmount.toFixed(2)}\nCredit: ${finalCreditAmount.toFixed(2)}\nRetailer: ${retailerInfo.name}\n\nReceipt was NOT printed.`)
        clearAllPOSState()
        setTimeout(() => refreshOutstandingPayments(), 2000)
      } else if (createWarehouseSale.rejected.match(result)) {
        const error = result.payload || result.error
        alert(`❌ Sale failed: ${error?.message || 'Unknown error'}`)
      }
    } catch (error) {
      alert(`❌ Sale failed: ${error.message || 'Unknown error'}`)
    } finally {
      setIsProcessingSale(false)
    }
  }

  const handleDirectPrint = async () => {
    try {
      if (!currentCart || currentCart.length === 0) { alert('❌ Cart is empty. Please add items before printing.'); return; }
      const draftOldBalance = outstandingTotal > 0 ? outstandingTotal : 0
      const printData = {
        type: 'receipt', title: 'DRAFT RECEIPT',
        companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
        companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
        companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
        companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
        logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
        receiptNumber: `DRAFT-${Date.now()}`,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        cashierName: user?.name || user?.username || 'Cashier',
        customerName: customerName || 'Walk-in Customer',
        customerPhone: customerPhone || '',
        items: currentCart.map(normalizeCartItemForPrint),
        subtotal: Math.round(subtotal), tax: Math.round(tax), discount: Math.round(totalDiscount),
        invoiceTotal: Math.round(total - totalDiscount),
        oldBalance: Math.round(draftOldBalance),
        total: Math.round(total),
        paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod,
        paymentAmount: Math.round(parseFloat(paymentAmount) || total),
        creditAmount: Math.round(parseFloat(creditAmount) || 0),
        remainingBalance: Math.round(Math.max(0, draftOldBalance + (parseFloat(creditAmount) || 0) - (parseFloat(paymentAmount) || 0))),
        change: 0, notes: 'DRAFT - Not a completed sale',
        footerMessage: 'Thank you for your business!'
      }
      const { success: printSuccess, message: printMessage } = await attemptReceiptPrint(printData, 'Direct draft receipt')
      if (printSuccess) { alert('✅ Receipt printed successfully!') } else { alert(`❌ Print failed.\n\nReason: ${printMessage || 'Unknown error'}`) }
    } catch (error) {
      alert(`❌ Print failed: ${error.message || 'Unknown error'}`)
    }
  }

  const printToThermalPrinter = async (printData) => {
    if (typeof navigator === 'undefined' || !navigator.serial) { throw new Error('Web Serial API not supported') }
    let port
    try {
      port = await acquireSerialPort()
      if (!port) { throw new Error('No port selected by user') }
      if (port.readable || port.writable) {
        try { await port.close() } catch (closeError) { console.warn('[WAREHOUSE] Unable to close port before reuse:', closeError) }
      }
      const baudRates = [9600, 19200, 38400, 57600, 115200]
      let connected = false
      for (const baudRate of baudRates) {
        try { await port.open({ baudRate }); connected = true; break; } catch (error) {
          if (port.readable || port.writable) { try { await port.close() } catch (closeError) {} }
        }
      }
      if (!connected) { throw new Error('Could not connect to printer at any baud rate') }
      const writer = port.writable.getWriter()
      const fmt = (v) => { const n = Number(v || 0); return String(Math.round(n)) }
      const commands = [
        0x1B, 0x40, 0x1B, 0x61, 0x01, 0x1B, 0x21, 0x30,
        ...new TextEncoder().encode(printData.companyName || DEFAULT_COMPANY_INFO.name.toUpperCase()), 0x0A,
        0x1B, 0x21, 0x00,
        ...new TextEncoder().encode((printData.companyAddress || DEFAULT_COMPANY_INFO.address).substring(0, 32)), 0x0A,
        ...new TextEncoder().encode(`Tel: ${printData.companyPhone || DEFAULT_COMPANY_INFO.phone}`), 0x0A,
        ...new TextEncoder().encode(`Email: ${printData.companyEmail || DEFAULT_COMPANY_INFO.email}`), 0x0A,
        0x1B, 0x61, 0x00, ...new TextEncoder().encode('================================'), 0x0A,
        0x1B, 0x61, 0x01, 0x1B, 0x21, 0x20, ...new TextEncoder().encode('SALES RECEIPT'), 0x0A,
        0x1B, 0x21, 0x00, 0x1B, 0x61, 0x00, ...new TextEncoder().encode('================================'), 0x0A,
        ...new TextEncoder().encode(`Receipt #: ${(printData.receiptNumber || 'N/A').substring(0, 20)}`), 0x0A,
        ...new TextEncoder().encode(`Date: ${printData.date}`), 0x0A,
        ...new TextEncoder().encode(`Time: ${printData.time || ''}`), 0x0A,
        ...new TextEncoder().encode(`Cashier: ${printData.cashierName}`), 0x0A,
        ...new TextEncoder().encode(`Retailer: ${printData.customerName || 'Walk-in Retailer'}`), 0x0A,
        ...new TextEncoder().encode('================================'), 0x0A,
        ...new TextEncoder().encode('Item            Qty Price Total'), 0x0A,
        ...new TextEncoder().encode('------------------------------'), 0x0A
      ]
      printData.items.forEach(item => {
        const itemName = item.name || 'Unknown Item'
        const quantity = Number.isFinite(item.quantity) ? item.quantity : 0
        const discountValue = Number.isFinite(item.discount) ? item.discount : 0
        const resolvedTotal = Number.isFinite(item.total) ? item.total : ((Number(item.unitPrice || item.price || 0) * quantity) - discountValue)
        const rawUnitPrice = Number.isFinite(item.unitPrice) && item.unitPrice !== 0 ? item.unitPrice : Number.isFinite(item.price) && item.price !== 0 ? item.price : (quantity !== 0 ? (resolvedTotal + discountValue) / quantity : 0)
        const unitPrice = Number.isFinite(rawUnitPrice) ? rawUnitPrice : 0
        const total = Number.isFinite(resolvedTotal) ? Number.parseFloat(resolvedTotal.toFixed(2)) : 0
        const formattedName = itemName.substring(0, 15).padEnd(15, ' ')
        const formattedQty = quantity.toString().padStart(3, ' ')
        const formattedPrice = fmt(unitPrice).padStart(7, ' ')
        const formattedTotal = fmt(total).padStart(7, ' ')
        commands.push(...new TextEncoder().encode(`${formattedName}${formattedQty}${formattedPrice}${formattedTotal}`), 0x0A)
      })
      commands.push(
        ...new TextEncoder().encode('================================'), 0x0A,
        ...new TextEncoder().encode(`Subtotal:                    ${fmt(printData.subtotal || 0)}`), 0x0A
      )
      if ((printData.discount || 0) > 0) { commands.push(...new TextEncoder().encode(`Discount:                    -${fmt(printData.discount || 0)}`), 0x0A) }
      commands.push(
        ...new TextEncoder().encode(`Tax:                         ${fmt(printData.tax || 0)}`), 0x0A,
        ...new TextEncoder().encode(`Invoice Total:               ${fmt(printData.invoiceTotal !== undefined ? printData.invoiceTotal : ((printData.subtotal || 0) + (printData.tax || 0) - (printData.discount || 0)))}`), 0x0A
      )
      const invoiceTotal = printData.invoiceTotal !== undefined ? printData.invoiceTotal : ((printData.subtotal || 0) + (printData.tax || 0) - (printData.discount || 0))
      const rawOldBalance = Number(printData.oldBalance ?? 0)
      const oldBalance = Number.isFinite(rawOldBalance) ? rawOldBalance : 0
      const oldBalancePositive = Math.max(0, oldBalance)
      const shouldShowOldBalance = (printData?.type === 'warehouse') || oldBalance !== 0
      if (shouldShowOldBalance) { commands.push(...new TextEncoder().encode(`Old Balance:                    ${fmt(oldBalance)}`), 0x0A) }
      const calculatedTotal = invoiceTotal + oldBalancePositive
      commands.push(
        ...new TextEncoder().encode('--------------------------------'), 0x0A,
        ...new TextEncoder().encode(`TOTAL:                       ${fmt(calculatedTotal)}`), 0x0A,
        ...new TextEncoder().encode(`Payment Method:      ${(printData.paymentMethod || 'CASH').substring(0, 12)}`), 0x0A
      )
      const paymentAmt = printData.paymentAmount || 0
      commands.push(...new TextEncoder().encode(`Payment Amount:      ${fmt(paymentAmt)}`), 0x0A)
      const creditAmt = printData.creditAmount || 0
      if (creditAmt > 0 || printData.paymentMethod === 'FULLY_CREDIT') { commands.push(...new TextEncoder().encode(`Credit Amount:       ${fmt(creditAmt || calculatedTotal || 0)}`), 0x0A) }
      const calculatedRemaining = Math.max(0, (oldBalancePositive + invoiceTotal) - paymentAmt)
      const shouldShowRemaining = calculatedRemaining > 0 || (oldBalancePositive > 0 && paymentAmt < calculatedTotal) || shouldShowOldBalance
      if (shouldShowRemaining) { commands.push(...new TextEncoder().encode(`Remaining Balance:       ${fmt(calculatedRemaining)}`), 0x0A) }
      const change = paymentAmt > calculatedTotal ? paymentAmt - calculatedTotal : 0
      if (change > 0) { commands.push(...new TextEncoder().encode(`Change:                  ${fmt(change)}`), 0x0A) }
      commands.push(
        ...new TextEncoder().encode('================================'), 0x0A,
        0x1B, 0x61, 0x01,
        ...new TextEncoder().encode(printData.footerMessage || 'Thank you for your business!'), 0x0A, 0x0A,
        ...new TextEncoder().encode('Return within 3 days'), 0x0A,
        ...new TextEncoder().encode('================================'), 0x0A,
        ...new TextEncoder().encode('Powered by Tychora'), 0x0A,
        ...new TextEncoder().encode('www.tychora.com'), 0x0A,
        0x0A, 0x0A, 0x1D, 0x56, 0x00
      )
      await writer.write(new Uint8Array(commands))
      writer.releaseLock()
      await port.close()
      return { success: true, message: 'Printed to thermal printer' }
    } catch (error) {
      if (port) {
        try { if (port.readable || port.writable) { await port.close() } } catch (closeError) {}
      }
      resetCachedSerialPort()
      throw error
    }
  }

  const checkPrinterStatus = async () => {
    try {
      if (navigator.serial) {
        const ports = await navigator.serial.getPorts()
        if (ports.length > 0) { return { hasSerialPorts: true, portCount: ports.length, message: `Found ${ports.length} serial port(s) - printer may be connected` } }
      }
      return { hasSerialPorts: false, portCount: 0, message: 'No serial ports detected - check printer connection' }
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
      const safeCompanyName = printData.companyName || DEFAULT_COMPANY_INFO.name
      const safeCompanyAddress = printData.companyAddress || DEFAULT_COMPANY_INFO.address
      const safeCompanyPhone = printData.companyPhone || DEFAULT_COMPANY_INFO.phone
      const safeCompanyEmail = printData.companyEmail || DEFAULT_COMPANY_INFO.email
      const displayOldBalance = Number(printData.oldBalance || 0)
      const paymentApplied = Number(printData.paymentAmount ?? printData.settlementPaymentAmount ?? 0) || 0
      const displayRemainingBalance = displayOldBalance > 0 ? Math.max(0, displayOldBalance - paymentApplied) : (printData.remainingBalance !== undefined && printData.remainingBalance !== null) ? Number(printData.remainingBalance) : (Number(printData.creditAmount) || 0)
      const isSettlementReceipt = printData.title === 'PAYMENT SETTLEMENT RECEIPT' || printData.outstandingCleared;
      const containerPadding = isSettlementReceipt ? '8px 16px 8px 16px' : '4px 16px 4px 16px';
      const printContent = `
        <div style="font-family: monospace; max-width: 280px; margin: 0 auto; padding: ${containerPadding}; font-size: 11px; line-height: 1.3; color: #000; background-color: #fff;">
          <div style="text-align: center; margin-bottom: ${isSettlementReceipt ? '12px' : '8px'};">
            <div style="margin-bottom: 4px;">
              <img src="${resolvedLogoPath}" alt="${safeCompanyName}" style="max-width: 100px; width: 100px; height: auto; filter: grayscale(100%); display: block; margin: 0 auto;" onerror="this.style.display='none';">
            </div>
            <div style="font-size: 9px; margin-bottom: 3px;">${safeCompanyAddress.substring(0, 32)}</div>
            <div style="font-size: 9px; margin-bottom: 3px;">Tel: ${safeCompanyPhone}</div>
            <div style="font-size: 9px; margin-bottom: ${isSettlementReceipt ? '12px' : '8px'};">Email: ${safeCompanyEmail}</div>
            <div style="border-top: 2px solid #000; margin: ${isSettlementReceipt ? '6px' : '4px'} 0;"></div>
            <div style="font-weight: bold; text-transform: uppercase; font-size: ${isSettlementReceipt ? '13px' : '12px'}; text-align: center; margin-bottom: ${isSettlementReceipt ? '6px' : '4px'};">${printData.title || 'SALES RECEIPT'}</div>
            <div style="border-top: 2px solid #000; margin: ${isSettlementReceipt ? '6px' : '4px'} 0;"></div>
          </div>
          <div style="margin-bottom: ${isSettlementReceipt ? '12px' : '8px'};">
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;"><span style="font-size: 10px; font-weight: bold;">Receipt #:</span><span style="font-weight: bold; font-size: 10px;">${(printData.receiptNumber || 'N/A').substring(0, 20)}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;"><span style="font-size: 10px; font-weight: bold;">Date:</span><span style="font-size: 10px;">${printData.date}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;"><span style="font-size: 10px; font-weight: bold;">Time:</span><span style="font-size: 10px;">${printData.time || ''}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;"><span style="font-size: 10px; font-weight: bold;">Cashier:</span><span style="font-size: 10px;">${printData.cashierName || 'N/A'}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 3px;"><span style="font-size: 10px; font-weight: bold;">Retailer:</span><span style="font-size: 10px;">${printData.customerName || 'Walk-in Retailer'}</span></div>
          </div>
          <div style="border-top: 2px solid #000; margin: ${isSettlementReceipt ? '6px' : '4px'} 0;"></div>
          <div style="margin-bottom: 8px;">
            <div style="display: flex; margin-bottom: 6px; font-weight: bold;">
              <div style="flex: 2; font-size: 10px;">Item</div>
              <div style="width: 30px; text-align: center; font-size: 10px;">Qty</div>
              <div style="width: 50px; text-align: right; font-size: 10px;">Price</div>
              <div style="width: 50px; text-align: right; font-size: 10px;">Total</div>
            </div>
            <div style="border-top: 2px solid #000; margin-bottom: 6px;"></div>
            ${printData.items.map(item => `
              <div style="margin-bottom: 6px;">
                <div style="font-weight: bold; margin-bottom: 2px; font-size: 10px;">${item.name || 'Unknown Item'}</div>
                <div style="display: flex; margin-top: 2px;">
                  <div style="flex: 2; font-size: 10px;"></div>
                  <div style="width: 30px; text-align: center; font-size: 10px; font-weight: bold;">${item.quantity || 0}</div>
                  <div style="width: 50px; text-align: right; font-size: 10px; font-weight: bold;">${Math.round(item.unitPrice || 0)}</div>
                  <div style="width: 50px; text-align: right; font-weight: bold; font-size: 10px;">${Math.round((item.unitPrice || 0) * (item.quantity || 0))}</div>
                </div>
              </div>
            `).join('')}
          </div>
          <div style="border-top: 2px solid #000; margin: 4px 0;"></div>
          <div style="margin-bottom: ${isSettlementReceipt ? '12px' : '8px'};">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span style="font-size: 10px; font-weight: bold;">Subtotal:</span><span style="font-size: 10px; font-weight: bold;">${Math.round(printData.subtotal || 0)}</span></div>
            ${(printData.discount || 0) > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span style="font-size: 10px; font-weight: bold; color: #d32f2f;">Discount:</span><span style="font-size: 10px; font-weight: bold; color: #d32f2f;">-${Math.round(printData.discount || 0)}</span></div>` : ''}
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span style="font-size: 10px; font-weight: bold;">Tax:</span><span style="font-size: 10px; font-weight: bold;">${Math.round(printData.tax || 0)}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px dashed #000; padding-bottom: 4px;"><span style="font-size: 10px; font-weight: bold;">Invoice Total:</span><span style="font-size: 10px; font-weight: bold;">${Math.round(printData.invoiceTotal !== undefined ? printData.invoiceTotal : ((printData.subtotal || 0) + (printData.tax || 0) - (printData.discount || 0)))}</span></div>
            ${(() => { const ob = Math.max(0, printData.oldBalance || 0); return ob > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span style="font-size: 10px; font-weight: bold;">Old Balance:</span><span style="font-size: 10px; font-weight: bold;">${Math.round(ob)}</span></div>` : ''; })()}
            <div style="border-top: 2px solid #000; margin: 8px 0;"></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><span style="font-weight: bold; font-size: 12px;">TOTAL:</span><span style="font-weight: bold; font-size: 12px;">${(() => { const it = printData.invoiceTotal !== undefined ? printData.invoiceTotal : ((printData.subtotal || 0) + (printData.tax || 0) - (printData.discount || 0)); const ob = Math.max(0, printData.oldBalance || 0); return Math.round(it + ob); })()}</span></div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span style="font-size: 10px; font-weight: bold;">Payment Method:</span><span style="font-size: 10px; font-weight: bold;">${printData.paymentMethod || 'CASH'}</span></div>
            ${(() => {
              const itd = printData.invoiceTotal !== undefined ? printData.invoiceTotal : ((printData.subtotal || 0) + (printData.tax || 0) - (printData.discount || 0));
              const obd = Math.max(0, printData.oldBalance || 0);
              const ctd = itd + obd;
              const pa = printData.paymentAmount || 0;
              const ca = printData.creditAmount || 0;
              const cr = Math.max(0, (obd + itd) - pa);
              const shouldShowRemaining = cr > 0 || (obd > 0 && pa < ctd);
              const chg = pa > ctd ? pa - ctd : 0;
              return `
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span style="font-size: 10px; font-weight: bold;">Payment Amount:</span><span style="font-size: 10px; font-weight: bold;">${Math.round(pa)}</span></div>
                ${(ca > 0 || printData.paymentMethod === 'FULLY_CREDIT') ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span style="font-size: 10px; font-weight: bold;">Credit Amount:</span><span style="font-size: 10px; font-weight: bold;">${Math.round(ca || ctd || 0)}</span></div>` : ''}
                ${shouldShowRemaining ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span style="font-size: 10px; font-weight: bold;">Remaining Balance:</span><span style="font-size: 10px; font-weight: bold;">${Math.round(cr)}</span></div>` : ''}
                ${chg > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span style="font-size: 10px; font-weight: bold; color: green;">Change:</span><span style="font-size: 10px; font-weight: bold; color: green;">${Math.round(chg)}</span></div>` : ''}
              `;
            })()}
            ${printData.notes && printData.notes.trim() ? `<div style="margin-top: 4px; font-size: 8px; line-height: 1.4; color: #333; white-space: pre-line;">${printData.notes}</div>` : ''}
          </div>
          <div style="text-align: center; margin-top: 8px;">
            <div style="border-top: 2px solid #000; margin-bottom: 6px;"></div>
            <div style="font-size: 9px; margin-bottom: 4px;">${printData.footerMessage || 'Thank you for your business!'}</div>
            <div style="border-top: 2px solid #000; margin-bottom: 6px;"></div>
            <div style="font-size: 9px; margin-bottom: 4px;">Return within 3 days</div>
            <div style="border-top: 2px solid #000; margin-bottom: 6px;"></div>
            <div style="font-size: 10px; margin-bottom: 2px;">Powered by Tychora</div>
            <div style="font-size: 9px; padding-bottom: 4px;">www.tychora.com</div>
          </div>
        </div>
      `
      const printWindow = window.open('', '_blank')
      printWindow.document.write(`<html><head><title>Receipt - ${printData.receiptNumber}</title><style>@media print { body { margin: 0; } @page { margin: 0; size: 80mm auto; } }</style></head><body>${printContent}</body></html>`)
      printWindow.document.close()
      printWindow.onload = () => {
        try {
          printWindow.print()
          printWindow.addEventListener('afterprint', () => { printWindow.close() })
          setTimeout(() => { if (!printWindow.closed) { printWindow.close() } }, 5000)
        } catch (printError) {
          printWindow.close()
          throw new Error('Failed to open print dialog')
        }
      }
      return { success: true, message: 'Opened browser print dialog' }
    } catch (error) {
      throw error
    }
  };

  const printReceipt = async () => {
    if (isProcessingSale) return
    setIsProcessingSale(true)
    try {
      if (user.role === 'ADMIN' && !isAdminMode) { alert('Please select a branch or warehouse.'); setIsProcessingSale(false); return; }
      if (!selectedRetailer || selectedRetailer.id === undefined || selectedRetailer.id === null) { alert('❌ Please select a retailer.'); setIsProcessingSale(false); return; }
      if (!user) { alert('❌ User not authenticated.'); setIsProcessingSale(false); return; }
      if (!currentCart || currentCart.length === 0) { alert('❌ Cart is empty.'); setIsProcessingSale(false); return; }
      const paymentMethodValue = isFullyCredit ? 'FULLY_CREDIT' : (isBalancePayment ? 'CASH' : (paymentMethod || 'CASH'))
      const { totalWithOutstanding: normalizedBillTotal, finalPaymentAmount, finalCreditAmount, finalPaymentStatus, paymentTypeValue } = calculateWarehousePaymentDetails({ billAmount, outstandingTotal: 0, isFullyCredit, isPartialPayment, isBalancePayment, inputPaymentAmount: paymentAmount })
      if (isPartialPayment && paymentMethod !== 'FULLY_CREDIT') {
        if (finalPaymentAmount <= 0) { alert('❌ Payment amount must be greater than 0.'); setIsProcessingSale(false); return; }
        const sum = finalPaymentAmount + finalCreditAmount
        if (Math.abs(sum - normalizedBillTotal) > 0.01) { alert(`❌ Payment amounts don't add up.`); setIsProcessingSale(false); return; }
      }
      const salePayloadInfo = buildWarehouseSalePayload({ billAmount, totalWithOutstanding: normalizedBillTotal, finalPaymentAmount, finalCreditAmount, finalPaymentStatus, paymentMethodValue, paymentTypeValue, includeOutstandingPayments: false, itemsOverride: currentCart })
      if (!salePayloadInfo) { setIsProcessingSale(false); return; }
      const { payload: saleData, retailerInfo } = salePayloadInfo
      const result = await dispatch(createWarehouseSale(saleData))
      if (createWarehouseSale.fulfilled.match(result)) {
        const sale = result.payload?.data || result.payload
        const displayOldBalance = outstandingTotal || 0
        const remainingBalance = finalCreditAmount
        const pd = {
          type: 'warehouse', title: 'SALES RECEIPT',
          companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name,
          companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address,
          companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone,
          companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email,
          logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl,
          receiptNumber: sale.invoice_no || `POS-${Date.now()}`,
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString(),
          cashierName: user?.name || user?.username || 'Cashier',
          branchName: user?.branchName || '',
          warehouseName: user?.warehouseName || scopeInfo?.scopeName || '',
          retailerName: retailerInfo.name, retailerPhone: retailerInfo.phone || '',
          customerName: retailerInfo.name, customerPhone: retailerInfo.phone || '',
          items: currentCart.map(normalizeCartItemForPrint),
          subtotal: Math.round(subtotal), tax: Math.round(tax), discount: Math.round(totalDiscount),
          invoiceTotal: Math.round(billAmount), total: Math.round(total),
          paymentMethod: paymentMethodValue,
          paymentAmount: Math.round(finalPaymentAmount),
          creditAmount: Math.round(finalCreditAmount),
          oldBalance: Math.round(displayOldBalance), remainingBalance: Math.round(remainingBalance),
          change: Math.round(isPartialPayment ? 0 : (parseFloat(paymentAmount) || total) - total),
          notes: isPartialPayment ? `Partial Payment - Credit Amount: ${Math.round(finalCreditAmount)}` : '',
          footerMessage: 'Thank you for choosing PetZone!'
        }
        try {
          const computedOld = Number(outstandingTotal || 0)
          const applied = Number(pd.paymentAmount ?? pd.settlementPaymentAmount ?? 0) || 0
          const computedRemaining = computedOld > 0 ? Math.max(0, computedOld - applied) : (pd.remainingBalance !== undefined && pd.remainingBalance !== null ? Number(pd.remainingBalance) : (Number(pd.creditAmount) || 0))
          pd.remainingBalance = computedRemaining
        } catch (e) {}
        setPrintData(pd)
        setShowPrintDialog(true)
        updateCurrentTab({ cart: [], customerName: '', customerPhone: '', selectedRetailer: null })
        setCustomerName('')
        setCustomerPhone('')
        setSelectedRetailer(null)
        setRetailerSearchResults([])
        setShowRetailerSearch(false)
        setPaymentAmount('')
        setCreditAmount('')
        setIsPartialPayment(false)
      } else if (createWarehouseSale.rejected.match(result)) {
        const error = result.payload || result.error
        alert(`❌ Print receipt failed!\n\nError: ${error?.message || 'Unknown error'}`)
      } else {
        alert('❌ Print receipt failed!\n\nUnexpected error occurred.')
      }
    } catch (error) {
      alert(`❌ Print receipt error: ${error.message}`)
    } finally {
      setIsProcessingSale(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (e.target === barcodeInputRef.current && barcodeInput.trim()) {
        handleBarcodeScan(barcodeInput.trim())
      } else if (e.target === manualInputRef.current && manualInput.trim()) {
        handleManualSearch(manualInput.trim())
      }
    }
    if (e.ctrlKey && e.key === 't') { e.preventDefault(); createNewTab(); }
    if (e.ctrlKey && e.key === 'w') { e.preventDefault(); if (activeTabId) { closeTab(activeTabId) } }
  }

  useEffect(() => {
    resetCachedSerialPort()
  }, [user?.id])

  useEffect(() => {
    return () => { resetCachedSerialPort() }
  }, [])

  // Row search handler for inline item search in cart table
  const handleRowSearch = (rowKey, query) => {
    setRowSearchQuery(prev => ({ ...prev, [rowKey]: query }))
    if (query.length >= 2) {
      const normalize = (value) => value == null ? '' : value.toString().toLowerCase()
      const matches = inventoryItems.filter(p =>
        normalize(p.name).includes(query.toLowerCase()) ||
        normalize(p.sku).includes(query.toLowerCase()) ||
        normalize(p.barcode).includes(query.toLowerCase())
      ).slice(0, 8).map(item => ({
        id: item.id,
        name: item.name,
        price: item.sellingPrice,
        stock: item.currentStock,
        category: item.category,
        sku: item.sku,
        barcode: item.barcode,
        unit: item.unit
      }))
      setRowSearchResults(prev => ({ ...prev, [rowKey]: matches }))
      setActiveRowSearch(rowKey)
    } else {
      setRowSearchResults(prev => ({ ...prev, [rowKey]: [] }))
      if (activeRowSearch === rowKey) setActiveRowSearch(null)
    }
  }

  const handleRowSelectProduct = (product) => {
    addToCart(product)
    const newKey = `new_${Date.now()}`
    setRowSearchQuery({})
    setRowSearchResults({})
    setActiveRowSearch(null)
  }

  // Toggle row selection
  const toggleRowSelection = (itemId) => {
    setSelectedRows(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    )
  }

  const toggleAllRows = () => {
    if (selectedRows.length === currentCart.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(currentCart.map(item => item.id))
    }
  }

  // Style constants for the redesigned layout
  const controlPanelHeight = '42vh'
  const orderGridHeight = 'calc(100vh - 42vh - 56px)'
  const inputSx = { 
    '& .MuiInputBase-root': { height: 36 },
    '& .MuiInputLabel-root': { fontSize: '0.78rem' },
    '& .MuiInputBase-input': { fontSize: '0.78rem', py: 0.5 }
  }

  return (
    <RouteGuard allowedRoles={['CASHIER', 'ADMIN', 'MANAGER']}>
      <DashboardLayout>
        {isAdminMode && scopeInfo && (
          <Box sx={{ 
            bgcolor: 'warning.light', 
            color: 'warning.contrastText', 
            py: 0.5,
            px: 2,
            textAlign: 'center',
            borderBottom: 1,
            borderColor: 'warning.main'
          }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
              🔧 ADMIN MODE: Operating as {scopeInfo.scopeType === 'BRANCH' ? 'Cashier' : 'Warehouse Keeper'} for {scopeInfo.scopeName}
            </Typography>
          </Box>
        )}

        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          height: isAdminMode && scopeInfo ? 'calc(100vh - 80px)' : 'calc(100vh - 48px)',
          bgcolor: 'grey.100',
          overflow: 'hidden'
        }}>

          {/* ═══════════════════════════════════════════════════════════════
              TOP SECTION — 30% — BILLING CONTROL PANEL
          ═══════════════════════════════════════════════════════════════ */}
          <Paper
            elevation={2}
            sx={{
              height: controlPanelHeight,
              minHeight: 220,
              maxHeight: 320,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 0,
              borderBottom: `2px solid ${theme.palette.divider}`,
              bgcolor: theme.palette.background.paper,
              flexShrink: 0,
              overflow: 'hidden'
            }}
          >
            {/* Tab Bar */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              pt: 0.5,
              pb: 0,
              bgcolor: theme.palette.grey[100],
              borderBottom: `1px solid ${theme.palette.divider}`,
              minHeight: 36,
              overflowX: 'auto',
              '&::-webkit-scrollbar': { height: 3 },
              '&::-webkit-scrollbar-thumb': { background: theme.palette.divider, borderRadius: 2 }
            }}>
              {tabs.map((tab) => {
                const itemCount = tab.cart?.reduce((sum, item) => sum + item.quantity, 0) || 0
                const isActive = tab.id === activeTabId
                return (
                  <Box
                    key={tab.id}
                    onClick={() => switchToTab(tab.id)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      px: 1.5,
                      py: 0.5,
                      cursor: 'pointer',
                      bgcolor: isActive ? theme.palette.background.paper : 'transparent',
                      borderRadius: '6px 6px 0 0',
                      border: isActive ? `1px solid ${theme.palette.divider}` : '1px solid transparent',
                      borderBottom: isActive ? `2px solid ${theme.palette.background.paper}` : `1px solid transparent`,
                      mb: isActive ? '-1px' : 0,
                      zIndex: isActive ? 2 : 1,
                      transition: 'all 0.15s',
                      '&:hover': { bgcolor: isActive ? theme.palette.background.paper : alpha(theme.palette.primary.main, 0.07) }
                    }}
                  >
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: isActive ? 700 : 400, fontSize: '0.72rem', whiteSpace: 'nowrap', color: isActive ? 'primary.main' : 'text.secondary' }}>
                      {tab.name}
                    </Typography>
                    {itemCount > 0 && (
                      <Chip label={itemCount} size="small" color="primary" sx={{ height: 16, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.5 } }} />
                    )}
                    {tabs.length > 1 && (
                      <IconButton size="small" sx={{ p: 0, ml: 0.25, width: 14, height: 14 }}
                        onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}>
                        <CloseIcon sx={{ fontSize: 11 }} />
                      </IconButton>
                    )}
                  </Box>
                )
              })}
              <Tooltip title="New Sale Tab (Ctrl+T)">
                <IconButton size="small" onClick={createNewTab}
                  sx={{ ml: 0.5, width: 26, height: 26, bgcolor: alpha(theme.palette.primary.main, 0.1), '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.2) } }}>
                  <AddIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Control Panel Body */}
            <Box sx={{ flex: 1, overflow: 'hidden', px: 1.5, py: 1 }}>
              <Grid container spacing={1} sx={{ height: '100%' }}>

                {/* ── Column 1: Customer Info ── */}
                <Grid item xs={12} md={3} lg={3}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, height: '100%' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                      <PersonIcon sx={{ fontSize: 11, mr: 0.5, verticalAlign: 'middle' }} />Customer
                    </Typography>

                    {/* Retailer Name with search */}
                    <Box sx={{ position: 'relative' }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Retailer Name"
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value)
                          setSelectedRetailer(null)
                          searchRetailers(e.target.value)
                        }}
                        placeholder="Search name, code, phone..."
                        disabled={retailersLoading}
                        sx={inputSx}
                        InputProps={{
                          startAdornment: <PersonIcon sx={{ fontSize: 14, mr: 0.5, color: 'action.active' }} />
                        }}
                      />
                      {showRetailerSearch && retailerSearchResults.length > 0 && (
                        <Paper sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1300, maxHeight: 200, overflowY: 'auto', boxShadow: 4, mt: 0.5, border: `1px solid ${theme.palette.divider}` }}>
                          {retailerSearchResults.map((retailer, index) => (
                            <Box key={`r-${retailer.id || index}`} sx={{ px: 1.5, py: 1, cursor: 'pointer', borderBottom: `1px solid ${theme.palette.divider}`, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }, '&:last-child': { borderBottom: 'none' } }} onClick={() => selectRetailer(retailer)}>
                              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.78rem' }}>{retailer.name}</Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                                {retailer.phone ? retailer.phone : 'No phone'}{retailer.code ? ` · ${retailer.code}` : ''}{retailer.city ? ` · ${retailer.city}` : ''}
                              </Typography>
                            </Box>
                          ))}
                        </Paper>
                      )}
                    </Box>

                    {/* Retailer Phone */}
                    <TextField
                      fullWidth
                      size="small"
                      label="Retailer Phone"
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(e.target.value)
                        setSelectedRetailer(null)
                        if (e.target.value && e.target.value.trim().length >= 2) { searchRetailers(e.target.value) }
                      }}
                      placeholder="Phone number"
                      type="tel"
                      disabled={retailersLoading}
                      sx={inputSx}
                      InputProps={{
                        startAdornment: <PhoneIcon sx={{ fontSize: 14, mr: 0.5, color: 'action.active' }} />,
                        endAdornment: isSearchingOutstanding ? <CircularProgress size={14} /> : null
                      }}
                    />

                    {/* Salesperson */}
                    {user?.role === 'WAREHOUSE_KEEPER' && salespeople.length > 0 && (
                      <TextField
                        fullWidth
                        size="small"
                        select
                        label="Salesperson"
                        value={selectedSalesperson?.id || ''}
                        onChange={(e) => {
                          const sp = salespeople.find(s => s.id === parseInt(e.target.value))
                          setSelectedSalesperson(sp)
                        }}
                        sx={inputSx}
                      >
                        <MenuItem value=""><em>Select Salesperson</em></MenuItem>
                        {salespeople.map((sp) => (
                          <MenuItem key={sp.id} value={sp.id} sx={{ fontSize: '0.78rem' }}>{sp.name} ({sp.phone})</MenuItem>
                        ))}
                      </TextField>
                    )}

                    {/* Outstanding badge */}
                    {outstandingPayments.length > 0 && (
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, py: 0.5, borderRadius: 1, bgcolor: outstandingTotal < 0 ? alpha(theme.palette.info.main, 0.1) : alpha(theme.palette.warning.main, 0.15), border: `1px solid ${outstandingTotal < 0 ? theme.palette.info.light : theme.palette.warning.light}`, cursor: 'pointer' }}
                        onClick={() => setShowOutstandingPanel(!showOutstandingPanel)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <OutstandingIcon sx={{ fontSize: 14, color: outstandingTotal < 0 ? 'info.main' : 'warning.main' }} />
                          <Typography variant="caption" sx={{ fontWeight: 700, color: outstandingTotal < 0 ? 'info.dark' : 'warning.dark', fontSize: '0.68rem' }}>
                            {outstandingTotal < 0 ? `Credit: ${Math.abs(outstandingTotal).toFixed(0)}` : `Outstanding: ${outstandingTotal.toFixed(0)}`}
                          </Typography>
                          <Chip label={`${selectedOutstandingPayments.length} sel.`} size="small" color={outstandingTotal < 0 ? 'info' : 'warning'} sx={{ height: 14, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }} />
                        </Box>
                        {showOutstandingPanel ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
                      </Box>
                    )}
                  </Box>
                </Grid>

                {/* ── Column 2: Payment Settings ── */}
                <Grid item xs={12} md={3} lg={3}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, height: '100%' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                      <MoneyIcon sx={{ fontSize: 11, mr: 0.5, verticalAlign: 'middle' }} />Payment
                    </Typography>

                    <TextField
                      fullWidth
                      size="small"
                      select
                      label="Payment Method"
                      value={paymentMethod}
                      disabled={isFullyCredit}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      sx={inputSx}
                    >
                      <MenuItem value="CASH">Cash</MenuItem>
                      <MenuItem value="CARD">Card</MenuItem>
                      <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>
                      <MenuItem value="MOBILE_PAYMENT">Mobile Payment</MenuItem>
                      <MenuItem value="CHEQUE">Cheque</MenuItem>
                      <MenuItem value="MOBILE_MONEY">Mobile Money</MenuItem>
                      <MenuItem value="FULLY_CREDIT">Fully Credit</MenuItem>
                    </TextField>

                    {/* Payment Type Buttons */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
                      {[
                        { label: 'Full Pay', value: 'full', active: !isPartialPayment && !isFullyCredit && !isBalancePayment },
                        { label: 'Partial', value: 'partial', active: isPartialPayment },
                        { label: 'Credit', value: 'credit', active: isFullyCredit },
                        { label: 'Balance', value: 'balance', active: isBalancePayment, disabled: outstandingTotal >= 0 }
                      ].map(btn => (
                        <Button
                          key={btn.value}
                          variant={btn.active ? 'contained' : 'outlined'}
                          size="small"
                          disabled={btn.disabled}
                          onClick={() => {
                            if (btn.value === 'full') {
                              setIsPartialPayment(false); setIsFullyCredit(false); setIsBalancePayment(false);
                              setPaymentAmount(''); setCreditAmount(''); setPaymentMethod('CASH');
                              handleSettlementPaymentType('full');
                            } else if (btn.value === 'partial') {
                              setIsPartialPayment(true); setIsFullyCredit(false); setIsBalancePayment(false);
                              if (!paymentAmount || paymentAmount === '') { setPaymentAmount(''); }
                              if (!creditAmount || creditAmount === '') { setCreditAmount(total.toFixed(2)); }
                              if (selectedOutstandingPayments.length > 0) { handleSettlementPaymentType('partial'); }
                            } else if (btn.value === 'credit') {
                              setIsPartialPayment(false); setIsFullyCredit(true); setIsBalancePayment(false);
                              setPaymentAmount(''); setCreditAmount(total.toString());
                              handleSettlementPaymentType('fullyCredit');
                            } else if (btn.value === 'balance') {
                              setIsPartialPayment(false); setIsFullyCredit(false); setIsBalancePayment(true);
                              setPaymentAmount('0'); setCreditAmount(billAmount.toString());
                              handleSettlementPaymentType('balance');
                            }
                          }}
                          sx={{ fontFamily: 'monospace', fontSize: '0.68rem', py: 0.5, px: 0.5, minWidth: 0 }}
                        >
                          {btn.label}
                        </Button>
                      ))}
                    </Box>

                    {/* Partial Payment Fields */}
                    {(isPartialPayment || isFullyCredit) && !(currentCart.length === 0 && showSettlementOptions) && (
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <TextField
                          size="small"
                          label="Paid"
                          value={isFullyCredit ? "0" : (paymentAmount || '')}
                          disabled={isFullyCredit}
                          type="number"
                          inputProps={{ min: 0, step: 0.01, style: { fontSize: '0.75rem' } }}
                          onChange={(e) => {
                            if (isFullyCredit) return;
                            const amount = Math.floor(parseFloat(e.target.value) || 0)
                            setPaymentAmount(amount.toString())
                            setCreditAmount((total - amount).toString())
                          }}
                          sx={{ flex: 1, '& .MuiInputBase-root': { height: 32 }, '& .MuiInputLabel-root': { fontSize: '0.72rem' }, '& input[type=number]': { MozAppearance: 'textfield' }, '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none' }, '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none' } }}
                        />
                        <TextField
                          size="small"
                          label="Credit"
                          value={creditAmount || ''}
                          disabled={isFullyCredit}
                          type="number"
                          inputProps={{ min: 0, step: 0.01, style: { fontSize: '0.75rem' } }}
                          onChange={(e) => {
                            if (isFullyCredit) return;
                            const amount = parseFloat(e.target.value) || 0
                            setCreditAmount(amount.toString())
                            setPaymentAmount((total - amount).toString())
                          }}
                          sx={{ flex: 1, '& .MuiInputBase-root': { height: 32 }, '& .MuiInputLabel-root': { fontSize: '0.72rem' }, '& input[type=number]': { MozAppearance: 'textfield' }, '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none' }, '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none' } }}
                        />
                      </Box>
                    )}
                  </Box>
                </Grid>

                {/* ── Column 3: Product Search / Barcode ── */}
                <Grid item xs={12} md={3} lg={3}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, height: '100%' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                      <ScannerIcon sx={{ fontSize: 11, mr: 0.5, verticalAlign: 'middle' }} />Product Search
                    </Typography>

                    {/* Product Search */}
                    <Box sx={{ position: 'relative' }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Search by name / category"
                        value={manualInput}
                        onChange={(e) => { setManualInput(e.target.value); handleManualSearch(e.target.value) }}
                        onKeyPress={handleKeyPress}
                        placeholder="Type to search..."
                        sx={inputSx}
                        InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: 14, mr: 0.5, color: 'action.active' }} /> }}
                      />
                      {showSearchResults && searchResults.length > 0 && (
                        <Paper sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1300, maxHeight: 200, overflowY: 'auto', boxShadow: 4, mt: 0.5, border: `1px solid ${theme.palette.divider}` }}>
                          {searchResults.map((product) => (
                            <Box key={product.id} sx={{ px: 1.5, py: 0.75, cursor: 'pointer', borderBottom: `1px solid ${theme.palette.divider}`, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }, '&:last-child': { borderBottom: 'none' } }}
                              onClick={() => { addToCart(product); setShowSearchResults(false); setManualInput(''); setSearchQuery(''); }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.78rem' }}>{product.name}</Typography>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Typography variant="caption" color="primary.main" sx={{ fontSize: '0.68rem', fontWeight: 700 }}>{product.price}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>Stock: {product.stock} {product.unit || 'units'}</Typography>
                              </Box>
                            </Box>
                          ))}
                        </Paper>
                      )}
                      {showSearchResults && searchResults.length === 0 && searchQuery.length >= 2 && (
                        <Paper sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1300, mt: 0.5, boxShadow: 3, p: 1.5, textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">No products found for &quot;{searchQuery}&quot;</Typography>
                        </Paper>
                      )}
                    </Box>

                    {/* Barcode Input */}
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <TextField
                        ref={barcodeInputRef}
                        size="small"
                        label="Scan / Barcode"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Scan or type..."
                        autoFocus
                        sx={{ flex: 1, ...inputSx }}
                        InputProps={{ startAdornment: <ScannerIcon sx={{ fontSize: 14, mr: 0.5, color: 'action.active' }} /> }}
                      />
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleBarcodeScan(barcodeInput)}
                        disabled={!barcodeInput.trim()}
                        sx={{ minWidth: 36, px: 1, fontSize: '0.65rem', height: 36 }}
                      >
                        ADD
                      </Button>
                    </Box>

                    {/* Category + Scanner Status row */}
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      <TextField
                        select
                        size="small"
                        label="Category"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        sx={{ flex: 1, ...inputSx }}
                      >
                        <MenuItem value="all" sx={{ fontSize: '0.75rem' }}>All Categories</MenuItem>
                        {getCategories().map(cat => (
                          <MenuItem key={cat} value={cat} sx={{ fontSize: '0.75rem' }}>{cat}</MenuItem>
                        ))}
                      </TextField>
                      <Chip
                        icon={scannerStatus.connected ? <CheckIcon sx={{ fontSize: '12px !important' }} /> : <ErrorIcon sx={{ fontSize: '12px !important' }} />}
                        label={scannerStatus.connected ? 'Scanner' : 'No Scanner'}
                        color={scannerStatus.connected ? 'success' : 'default'}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.6rem', height: 22, '& .MuiChip-label': { px: 0.5 } }}
                      />
                    </Box>
                  </Box>
                </Grid>

                {/* ── Column 4: Sale Summary + Actions ── */}
                <Grid item xs={12} md={3} lg={3}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, height: '100%' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                      <CartIcon sx={{ fontSize: 11, mr: 0.5, verticalAlign: 'middle' }} />Sale Summary
                    </Typography>

                    {/* Summary Stats */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0.5 }}>
                      {[
                        { label: 'Items', value: currentCart.length, color: 'primary.main' },
                        { label: 'Units', value: currentCart.reduce((s, i) => s + i.quantity, 0), color: 'secondary.main' },
                        { label: 'Products', value: inventoryItems.length, color: 'success.main' }
                      ].map(stat => (
                        <Box key={stat.label} sx={{ textAlign: 'center', py: 0.5, px: 0.5, bgcolor: alpha(theme.palette.primary.main, 0.05), borderRadius: 1, border: `1px solid ${theme.palette.divider}` }}>
                          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontSize: '0.6rem' }}>{stat.label}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.85rem', color: stat.color }}>{stat.value}</Typography>
                        </Box>
                      ))}
                    </Box>

                    {/* Running total */}
                    <Box sx={{ px: 1, py: 0.75, bgcolor: alpha(theme.palette.success.main, 0.08), borderRadius: 1, border: `1px solid ${alpha(theme.palette.success.main, 0.3)}` }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                          {currentTab?.name || 'Active Tab'}
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'success.dark', fontSize: '0.95rem' }}>
                          {total.toFixed(0)}
                        </Typography>
                      </Box>
                      {Math.abs(outstandingTotal) > 0.01 && (
                        <Typography variant="caption" sx={{ fontSize: '0.62rem', color: outstandingTotal < 0 ? 'info.main' : 'warning.main' }}>
                          {outstandingTotal < 0 ? `Credit: ${Math.abs(outstandingTotal).toFixed(0)}` : `Outstanding: +${outstandingTotal.toFixed(0)}`}
                        </Typography>
                      )}
                    </Box>

                    {/* Action buttons */}
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Button
                        variant="contained"
                        size="small"
                        color="success"
                        startIcon={isCompletingSaleRef.current ? <CircularProgress size={14} color="inherit" /> : <CheckIcon sx={{ fontSize: 14 }} />}
                        onClick={handleCompleteSale}
                        disabled={isCompletingSaleRef.current || isProcessingSale || (currentCart.length === 0 && selectedOutstandingPayments.length === 0)}
                        sx={{ flex: 1, fontFamily: 'monospace', fontSize: '0.68rem', py: 0.75, fontWeight: 700 }}
                      >
                        {currentCart.length === 0 && selectedOutstandingPayments.length > 0 ? 'SETTLE' : 'COMPLETE'}
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => router.push('/dashboard/inventory')}
                        sx={{ minWidth: 36, px: 1, fontSize: '0.65rem', py: 0.75 }}
                        title="Inventory"
                      >
                        <InventoryIcon sx={{ fontSize: 14 }} />
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setShowSettings(true)}
                        sx={{ minWidth: 36, px: 1, fontSize: '0.65rem', py: 0.75 }}
                        title="Settings"
                      >
                        <SettingsIcon sx={{ fontSize: 14 }} />
                      </Button>
                    </Box>

                    {/* Notes (compact) */}
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      rows={1}
                      placeholder="Notes (optional)..."
                      value={notes}
                      onChange={(e) => { if (e.target.value.length <= 500) { setNotes(e.target.value) } }}
                      sx={{ '& .MuiInputBase-root': { fontSize: '0.72rem', py: 0.5 }, '& .MuiInputLabel-root': { fontSize: '0.72rem' } }}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Paper>

          {/* Outstanding Payments Collapsible Panel */}
          {showOutstandingPanel && outstandingPayments.length > 0 && (
            <Paper elevation={1} sx={{ borderRadius: 0, borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.warning.main, 0.03), flexShrink: 0 }}>
              <Box sx={{ px: 2, py: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <OutstandingIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'warning.dark' }}>
                    Outstanding Payments
                  </Typography>
                  <Button size="small" variant="text" sx={{ fontSize: '0.65rem', py: 0, px: 0.5 }} onClick={() => { if (customerPhone && customerPhone.trim().length >= 3) { searchOutstandingPayments(customerPhone.trim(), customerName?.trim()) } }}>
                    <RefreshIcon sx={{ fontSize: 12, mr: 0.25 }} />Refresh
                  </Button>
                  <Box sx={{ ml: 'auto' }}>
                    <IconButton size="small" onClick={() => setShowOutstandingPanel(false)}><CloseIcon sx={{ fontSize: 14 }} /></IconButton>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  {outstandingPayments.map((payment) => (
                    <FormControlLabel
                      key={payment.id}
                      control={
                        <Checkbox
                          checked={selectedOutstandingPayments.includes(payment.id)}
                          onChange={() => handleOutstandingPaymentToggle(payment.id)}
                          size="small"
                          sx={{ py: 0, px: 0.5 }}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                            {payment.isCredit ? 'CREDIT' : 'OUTSTANDING'}
                          </Typography>
                          <Chip
                            label={payment.isCredit ? `-${parseFloat(payment.outstandingAmount || 0).toFixed(0)}` : `${parseFloat(payment.outstandingAmount || 0).toFixed(0)}`}
                            size="small"
                            color={payment.isCredit ? "error" : "warning"}
                            sx={{ height: 16, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.5 } }}
                          />
                        </Box>
                      }
                      sx={{ mr: 1 }}
                    />
                  ))}
                  {currentCart.length === 0 && selectedOutstandingPayments.length > 0 && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1, pl: 1, borderLeft: `1px solid ${theme.palette.divider}` }}>
                      {[
                        { label: 'Full', value: 'full', active: !isSettlementPartial && !isSettlementFullyCredit },
                        { label: 'Partial', value: 'partial', active: isSettlementPartial },
                        { label: 'Credit Note', value: 'fullyCredit', active: isSettlementFullyCredit, disabled: settlementSnapshot.isCredit }
                      ].map(btn => (
                        <Button key={btn.value} variant={btn.active ? 'contained' : 'outlined'} size="small" disabled={btn.disabled} onClick={() => handleSettlementPaymentType(btn.value)} sx={{ fontSize: '0.65rem', py: 0.25, px: 1, minWidth: 0 }}>
                          {btn.label}
                        </Button>
                      ))}
                      {isSettlementPartial && (
                        <TextField size="small" label="Amount" value={settlementPaymentAmount} onChange={(e) => handleSettlementPaymentChange(e.target.value)} type="number" sx={{ width: 90, '& .MuiInputBase-root': { height: 28 }, '& .MuiInputLabel-root': { fontSize: '0.7rem' } }} inputProps={{ min: 0, step: 0.01, style: { fontSize: '0.7rem' } }} />
                      )}
                    </Box>
                  )}
                </Box>
              </Box>
            </Paper>
          )}

          {/* Balance Payment Details - shown below control panel when active */}
          {isBalancePayment && (
            <Paper elevation={0} sx={{ borderRadius: 0, borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.success.main, 0.05), flexShrink: 0, px: 2, py: 0.75 }}>
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'success.main' }}>💰 Balance Payment:</Typography>
                <Typography variant="caption">Purchase: <strong>{parseFloat(billAmount).toFixed(0)}</strong></Typography>
                <Typography variant="caption">Available Credit: <strong>{Math.abs(outstandingTotal).toFixed(0)}</strong></Typography>
                <Typography variant="caption">Remaining After: <strong style={{ color: outstandingTotal + billAmount < 0 ? theme.palette.error.main : theme.palette.success.main }}>{(outstandingTotal + billAmount).toFixed(0)}</strong></Typography>
              </Box>
            </Paper>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              BOTTOM SECTION — 70% — ORDER GRID (Purchase Order style)
          ═══════════════════════════════════════════════════════════════ */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Grid Toolbar */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.5,
              bgcolor: theme.palette.background.paper,
              borderBottom: `1px solid ${theme.palette.divider}`,
              flexShrink: 0
            }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Order Lines · {currentCart.length} item{currentCart.length !== 1 ? 's' : ''}
              </Typography>

              <Box sx={{ flex: 1 }} />

              {selectedRows.length > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<DeleteSweepIcon sx={{ fontSize: 14 }} />}
                  onClick={removeSelectedRows}
                  sx={{ fontSize: '0.68rem', py: 0.25, px: 1, height: 28 }}
                >
                  Delete Selected ({selectedRows.length})
                </Button>
              )}

              {/* Inline Add Row search */}
              <Box sx={{ position: 'relative', width: 200 }}>
                <TextField
                  size="small"
                  placeholder="+ Add item..."
                  value={rowSearchQuery['new_row'] || ''}
                  onChange={(e) => handleRowSearch('new_row', e.target.value)}
                  onFocus={() => { if (rowSearchQuery['new_row']?.length >= 2) setActiveRowSearch('new_row') }}
                  onBlur={() => setTimeout(() => { if (activeRowSearch === 'new_row') setActiveRowSearch(null) }, 200)}
                  sx={{
                    width: '100%',
                    '& .MuiInputBase-root': { height: 28 },
                    '& .MuiInputBase-input': { fontSize: '0.72rem', py: 0 }
                  }}
                  InputProps={{ startAdornment: <AddIcon sx={{ fontSize: 13, mr: 0.25, color: 'primary.main' }} /> }}
                />
                {activeRowSearch === 'new_row' && (rowSearchResults['new_row'] || []).length > 0 && (
                  <Paper sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1400, maxHeight: 200, overflowY: 'auto', boxShadow: 4, mt: 0.25, border: `1px solid ${theme.palette.divider}` }}>
                    {(rowSearchResults['new_row'] || []).map((product) => (
                      <Box key={product.id} sx={{ px: 1.5, py: 0.75, cursor: 'pointer', borderBottom: `1px solid ${theme.palette.divider}`, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }, '&:last-child': { borderBottom: 'none' } }}
                        onMouseDown={() => { handleRowSelectProduct(product); setRowSearchQuery(prev => ({ ...prev, 'new_row': '' })); }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>{product.name}</Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Typography variant="caption" color="primary.main" sx={{ fontSize: '0.65rem', fontWeight: 700 }}>{product.price}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Stock: {product.stock}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Paper>
                )}
              </Box>

              <Tooltip title="Refresh Inventory">
                <IconButton size="small" onClick={() => dispatch(fetchInventory())} sx={{ width: 28, height: 28 }}>
                  <RefreshIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Order Table */}
            <TableContainer
              sx={{
                flex: 1,
                overflow: 'auto',
                '&::-webkit-scrollbar': { width: 6, height: 6 },
                '&::-webkit-scrollbar-track': { background: 'transparent' },
                '&::-webkit-scrollbar-thumb': { background: theme.palette.divider, borderRadius: 3 }
              }}
            >
              <Table
                stickyHeader
                size="small"
                sx={{
                  '& .MuiTableCell-stickyHeader': { bgcolor: theme.palette.grey[50] },
                  '& .MuiTableCell-root': { fontSize: '0.75rem', py: 0.5, px: 0.75 },
                  tableLayout: 'fixed'
                }}
              >
                <TableHead>
                  <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 700, color: 'text.secondary', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 0.3 } }}>
                    <TableCell padding="checkbox" sx={{ width: 36 }}>
                      <Checkbox
                        size="small"
                        indeterminate={selectedRows.length > 0 && selectedRows.length < currentCart.length}
                        checked={currentCart.length > 0 && selectedRows.length === currentCart.length}
                        onChange={toggleAllRows}
                        sx={{ p: 0 }}
                      />
                    </TableCell>
                    <TableCell sx={{ width: '28%' }}>#&nbsp;&nbsp;Item</TableCell>
                    <TableCell sx={{ width: '16%', textAlign: 'right' }}>Unit Price</TableCell>
                    <TableCell sx={{ width: '12%', textAlign: 'center' }}>Qty</TableCell>
                    <TableCell sx={{ width: '13%', textAlign: 'right' }}>Discount</TableCell>
                    <TableCell sx={{ width: '14%', textAlign: 'right' }}>Total</TableCell>
                    <TableCell sx={{ width: 36, textAlign: 'center' }}></TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {currentCart.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} sx={{ textAlign: 'center', py: 4 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, color: 'text.disabled' }}>
                          <CartIcon sx={{ fontSize: 36, opacity: 0.3 }} />
                          <Typography variant="body2" color="text.disabled">
                            No items added yet. Search for a product or scan a barcode to begin.
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentCart.map((item, index) => {
                      const itemPrice = parseFloat(item.customPrice !== null && item.customPrice !== undefined ? item.customPrice : item.price || 0)
                      const itemDiscount = parseFloat(item.discount || 0)
                      const itemTotal = Math.max(0, (itemPrice * item.quantity) - itemDiscount)
                      const isPriceCustom = item.customPrice !== null && item.customPrice !== undefined && item.customPrice !== item.price
                      return (
                        <TableRow
                          key={item.id}
                          selected={selectedRows.includes(item.id)}
                          sx={{
                            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) },
                            '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.07) },
                            '&.Mui-selected:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                          }}
                        >
                          {/* Checkbox */}
                          <TableCell padding="checkbox" sx={{ width: 36 }}>
                            <Checkbox
                              size="small"
                              checked={selectedRows.includes(item.id)}
                              onChange={() => toggleRowSelection(item.id)}
                              sx={{ p: 0 }}
                            />
                          </TableCell>

                          {/* Item Name */}
                          <TableCell sx={{ width: '28%' }}>
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                              <Typography variant="caption" sx={{ color: 'text.disabled', minWidth: 16, fontSize: '0.62rem' }}>{index + 1}.</Typography>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.78rem', lineHeight: 1.2 }}>{item.name}</Typography>
                                {item.sku && (
                                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.62rem' }}>{item.sku}</Typography>
                                )}
                              </Box>
                            </Box>
                          </TableCell>

                          {/* Price */}
                          <TableCell sx={{ width: '16%', textAlign: 'right' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.25 }}>
                              <TextField
                                size="small"
                                type="number"
                                value={itemPrice.toFixed(2).replace(/\.00$/, '')}
                                onChange={(e) => updateItemPrice(item.id, e.target.value)}
                                inputProps={{ min: 0, step: 0.01, style: { fontFamily: 'monospace', fontSize: '0.75rem', textAlign: 'right' }, inputMode: 'decimal' }}
                                sx={{
                                  width: 80,
                                  '& .MuiInputBase-root': { height: 28, bgcolor: isPriceCustom ? '#fff8e1' : 'transparent' },
                                  '& .MuiOutlinedInput-root': { border: isPriceCustom ? '1px solid #ffc107' : undefined },
                                  '& .MuiInputBase-input': { py: 0.25, fontSize: '0.75rem' },
                                  '& input[type=number]': { MozAppearance: 'textfield' },
                                  '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                                  '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none' }
                                }}
                              />
                              {isPriceCustom && (
                                <Tooltip title="Reset to original price">
                                  <IconButton size="small" onClick={() => resetItemPrice(item.id)} sx={{ p: 0.25, color: 'warning.main', width: 18, height: 18 }}>
                                    <Typography sx={{ fontSize: '0.65rem' }}>↶</Typography>
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>

                          {/* Qty */}
                          <TableCell sx={{ width: '12%', textAlign: 'center' }}>
                            <TextField
                              size="small"
                              type="number"
                              value={item.quantity}
                              onChange={(e) => { const v = e.target.value; if (v === '') return; const n = parseFloat(v); if (!isNaN(n) && n >= 0) updateQuantity(item.id, n) }}
                              onBlur={(e) => { if (e.target.value === '' || parseFloat(e.target.value) <= 0) { updateQuantity(item.id, 1) } }}
                              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                              inputProps={{ min: 0.01, step: 1, style: { fontFamily: 'monospace', fontSize: '0.75rem', textAlign: 'center' }, inputMode: 'decimal' }}
                              sx={{
                                width: 60,
                                '& .MuiInputBase-root': { height: 28 },
                                '& .MuiInputBase-input': { py: 0.25, fontSize: '0.75rem' },
                                '& input[type=number]': { MozAppearance: 'textfield' },
                                '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                                '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none' }
                              }}
                            />
                          </TableCell>

                          {/* Discount */}
                          <TableCell sx={{ width: '13%', textAlign: 'right' }}>
                            <TextField
                              size="small"
                              type="number"
                              value={parseFloat(item.discount || 0).toFixed(2).replace(/\.00$/, '')}
                              onChange={(e) => updateItemDiscount(item.id, e.target.value || '0')}
                              inputProps={{ min: 0, step: 0.01, style: { fontFamily: 'monospace', fontSize: '0.75rem', textAlign: 'right' }, inputMode: 'decimal' }}
                              sx={{
                                width: 75,
                                '& .MuiInputBase-root': { height: 28 },
                                '& .MuiInputBase-input': { py: 0.25, fontSize: '0.75rem' },
                                '& input[type=number]': { MozAppearance: 'textfield' },
                                '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                                '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none' }
                              }}
                            />
                          </TableCell>

                          {/* Total */}
                          <TableCell sx={{ width: '14%', textAlign: 'right' }}>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem' }}>
                              {itemTotal.toFixed(0)}
                            </Typography>
                          </TableCell>

                          {/* Delete */}
                          <TableCell sx={{ width: 36, textAlign: 'center' }}>
                            <Tooltip title="Remove item">
                              <IconButton
                                size="small"
                                onClick={() => removeFromCart(item.id)}
                                sx={{
                                  p: 0.25,
                                  width: 24,
                                  height: 24,
                                  color: 'error.light',
                                  '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.08) }
                                }}
                              >
                                <CloseIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* ═══ STICKY FOOTER — Summary + Complete ═══ */}
            <Paper
              elevation={4}
              sx={{
                flexShrink: 0,
                borderTop: `2px solid ${theme.palette.divider}`,
                borderRadius: 0,
                bgcolor: theme.palette.background.paper,
                px: 2,
                py: 0.75,
              }}
            >
              <Grid container spacing={1} alignItems="center">
                {/* Tax & Discount Controls */}
                <Grid item xs={12} md={4}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>Tax:</Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={taxRate}
                        onChange={(e) => setTaxRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
                        inputProps={{ min: 0, max: 100, step: 0.1, style: { fontSize: '0.72rem', textAlign: 'center', width: 32 } }}
                        sx={{ width: 50, '& .MuiInputBase-root': { height: 26 }, '& .MuiInputBase-input': { py: 0.25 } }}
                      />
                      <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>%</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>Discount:</Typography>
                      <TextField
                        size="small"
                        type="number"
                        value={parseFloat(totalDiscount || 0).toFixed(0)}
                        onChange={(e) => setTotalDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                        inputProps={{ min: 0, step: 0.01, style: { fontSize: '0.72rem', textAlign: 'right', width: 48 }, inputMode: 'decimal' }}
                        sx={{
                          width: 65,
                          '& .MuiInputBase-root': { height: 26 },
                          '& .MuiInputBase-input': { py: 0.25 },
                          '& input[type=number]': { MozAppearance: 'textfield' },
                          '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                          '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none' }
                        }}
                      />
                    </Box>
                  </Box>
                </Grid>

                {/* Summary Numbers */}
                <Grid item xs={12} md={5}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'center' }}>
                    {[
                      { label: 'Sub', value: subtotal },
                      { label: 'Tax', value: tax },
                      { label: 'Disc', value: -totalDiscount, color: totalDiscount > 0 ? 'error.main' : 'text.primary' },
                      ...(Math.abs(outstandingTotal) > 0.01 ? [{ label: outstandingTotal < 0 ? 'Credit' : 'Outstanding', value: outstandingTotal, color: outstandingTotal < 0 ? 'info.main' : 'warning.main' }] : [])
                    ].map((item) => (
                      <Box key={item.label} sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', fontSize: '0.6rem', lineHeight: 1.2 }}>{item.label}</Typography>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.72rem', color: item.color || 'text.primary' }}>
                          {item.value < 0 ? item.value.toFixed(0) : `+${item.value.toFixed(0)}`}
                        </Typography>
                      </Box>
                    ))}
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', fontSize: '0.6rem', lineHeight: 1.2 }}>TOTAL</Typography>
                      <Typography variant="subtitle1" sx={{ fontFamily: 'monospace', fontWeight: 800, color: 'success.dark', lineHeight: 1.2 }}>{total.toFixed(0)}</Typography>
                    </Box>
                  </Box>
                </Grid>

                {/* Complete Sale Button */}
                <Grid item xs={12} md={3}>
                  <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'flex-end' }}>
                    <Tooltip title="Print Only (No Save)">
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleDirectPrint}
                        disabled={currentCart.length === 0}
                        sx={{ minWidth: 36, px: 1, py: 0.75, fontSize: '0.65rem' }}
                      >
                        <PrintIcon sx={{ fontSize: 16 }} />
                      </Button>
                    </Tooltip>
                    <Button
                      variant="contained"
                      size="small"
                      color="success"
                      startIcon={isCompletingSaleRef.current ? <CircularProgress size={14} color="inherit" /> : <CheckIcon sx={{ fontSize: 16 }} />}
                      onClick={handleCompleteSale}
                      disabled={isCompletingSaleRef.current || isProcessingSale || (currentCart.length === 0 && selectedOutstandingPayments.length === 0)}
                      sx={{ fontFamily: 'monospace', fontSize: '0.75rem', py: 0.75, px: 2, fontWeight: 700, minWidth: 120 }}
                    >
                      {currentCart.length === 0 && selectedOutstandingPayments.length > 0 ? 'SETTLE' : 'COMPLETE SALE'}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Box>
        </Box>

        {/* ─────────────────────────────────────────────────────
            DIALOGS (unchanged functionality)
        ───────────────────────────────────────────────────── */}

        {/* Sale Confirmation Dialog */}
        <Dialog open={saleConfirmDialog} onClose={() => {}} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <CheckIcon sx={{ fontSize: 56, color: 'success.main' }} />
              <Typography variant="h5" fontWeight="bold" color="success.main">Sale Saved Successfully!</Typography>
              {completedSaleData?.sale?.invoice_no && (
                <Chip label={`Invoice: ${completedSaleData.sale.invoice_no}`} color="primary" variant="outlined" sx={{ fontWeight: 'bold', fontSize: '1rem', px: 1 }} />
              )}
            </Box>
          </DialogTitle>
          <DialogContent sx={{ textAlign: 'center', pt: 2 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>The sale has been recorded. Would you like to print a receipt?</Typography>
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle2" sx={{ mb: 2, color: 'primary.main' }}>Select Print Option:</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button variant="contained" size="large" startIcon={<PrintIcon />} color="primary" sx={{ py: 1.5, fontSize: '1rem', width: '100%' }}
                  onClick={() => { setSaleConfirmDialog(false); if (completedSaleData?.printData) { setPrintData(completedSaleData.printData); setSelectedLayout('thermal'); setShowPrintDialog(true); } setCompletedSaleData(null); }}>
                  Print Thermal Receipt (80mm)
                </Button>
                <Button variant="outlined" size="large" startIcon={<PrintIcon />} color="secondary" sx={{ py: 1.5, fontSize: '1rem', width: '100%' }}
                  onClick={() => { setSaleConfirmDialog(false); if (completedSaleData?.printData) { setPrintData(completedSaleData.printData); setSelectedLayout('color'); setShowPrintDialog(true); } setCompletedSaleData(null); }}>
                  Print Color Receipt (A4/Letter)
                </Button>
                <Button variant="outlined" size="large" startIcon={<PrintIcon />} color="info" sx={{ py: 1.5, fontSize: '1rem', width: '100%' }}
                  onClick={async () => {
                    setSaleConfirmDialog(false);
                    if (completedSaleData?.printData) {
                      try {
                        const { success, message } = await attemptReceiptPrint(completedSaleData.printData, 'Post-sale receipt')
                        if (success) { alert('✅ Receipt printed successfully!') } else { alert(`❌ Print failed: ${message || 'Unknown error'}`) }
                      } catch (error) { alert(`❌ Print failed: ${error.message}`) }
                    }
                    setCompletedSaleData(null);
                  }}>
                  Direct Print (Auto-detect Printer)
                </Button>
              </Box>
            </Box>
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
              <Button size="small" variant="text" onClick={async () => { const status = await checkPrinterStatus(); alert(`Printer Status:\n\n${status.message}\n\n${status.hasSerialPorts ? `✅ Found ${status.portCount} serial port(s)` : '❌ No serial printers detected.'}`); }}>
                Check Printer Status
              </Button>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button variant="text" color="inherit" onClick={() => { setSaleConfirmDialog(false); setCompletedSaleData(null); }}>Skip Printing</Button>
            </Box>
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'center', pb: 3, pt: 0 }}>
            <Typography variant="caption" color="text.secondary">✅ Sale is already saved regardless of your choice above</Typography>
          </DialogActions>
        </Dialog>

        {/* Physical Scanner Modal */}
        <PhysicalScanner
          open={showPhysicalScanner}
          onScan={(barcode) => { handleBarcodeScan(barcode); setShowPhysicalScanner(false); }}
          onClose={() => setShowPhysicalScanner(false)}
          inventoryItems={inventoryItems}
        />

        {/* Settings Dialog */}
        <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SettingsIcon />
              <Typography variant="h6">Warehouse Billing Settings</Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>Printer Settings</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Thermal printer is used by default for all receipts.</Typography>
              <Typography variant="h6" gutterBottom>Tax Settings</Typography>
              <TextField fullWidth label="Default Tax Rate (%)" type="number" value={taxRate} onChange={(e) => setTaxRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))} inputProps={{ min: 0, max: 100, step: 0.1 }} sx={{ mb: 3 }} />
              <Typography variant="h6" gutterBottom>Search Settings</Typography>
              <TextField fullWidth label="Default Category Filter" select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <MenuItem value="all">All Categories</MenuItem>
                {getCategories().map(category => (<MenuItem key={category} value={category}>{category}</MenuItem>))}
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
                    onClick={() => { setShowPrinterDialog(false); setSelectedLayout('thermal'); setPrintData({ type: 'receipt', title: 'SALES RECEIPT', companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name, companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address, companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone, companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email, logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl, receiptNumber: `TEST-${Date.now()}`, date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString(), cashierName: user?.name || user?.username || 'Cashier', customerName: customerName || 'Walk-in Customer', customerPhone: customerPhone || '', items: currentCart.map(normalizeCartItemForPrint), subtotal: Math.round(subtotal), tax: Math.round(tax), discount: Math.round(totalDiscount), invoiceTotal: Math.round(billAmount), total: Math.round(total), paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod, paymentAmount: Math.round(parseFloat(paymentAmount) || total), creditAmount: Math.round(parseFloat(creditAmount) || 0), oldBalance: Math.round(outstandingTotal || 0), notes: '', footerMessage: 'Thank you for your business!' }); setShowPrintDialog(true); }}>
                    <Typography variant="body1" fontWeight="bold">📄 Thermal Printer Layout</Typography>
                    <Typography variant="body2">Monospace font, compact design for thermal printers</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>Color Printer (A4/Letter)</Typography>
                  <Box sx={{ p: 2, bgcolor: 'success.light', borderRadius: 1, color: 'white', cursor: 'pointer' }}
                    onClick={() => { setShowPrinterDialog(false); setSelectedLayout('color'); setPrintData({ type: 'warehouse', title: 'SALES RECEIPT', companyName: companyInfo.name || DEFAULT_COMPANY_INFO.name, companyAddress: companyInfo.address || DEFAULT_COMPANY_INFO.address, companyPhone: companyInfo.phone || DEFAULT_COMPANY_INFO.phone, companyEmail: companyInfo.email || DEFAULT_COMPANY_INFO.email, logoUrl: companyInfo.logoUrl || DEFAULT_COMPANY_INFO.logoUrl, receiptNumber: `TEST-${Date.now()}`, date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString(), cashierName: user?.name || user?.username || 'Cashier', customerName: customerName || 'Walk-in Customer', customerPhone: customerPhone || '', items: currentCart.map(normalizeCartItemForPrint), subtotal: Math.round(subtotal), tax: Math.round(tax), discount: Math.round(totalDiscount), invoiceTotal: Math.round(billAmount), total: Math.round(total), paymentMethod: isFullyCredit ? 'FULLY_CREDIT' : paymentMethod, paymentAmount: Math.round(parseFloat(paymentAmount) || total), creditAmount: Math.round(parseFloat(creditAmount) || 0), oldBalance: Math.round(outstandingTotal || 0), notes: '', footerMessage: 'Thank you for your business!' }); setShowPrintDialog(true); }}>
                    <Typography variant="body1" fontWeight="bold">🖨️ Color Printer Layout</Typography>
                    <Typography variant="body2">Styled design with colors for A4/Letter printers</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>Test Print Options</Typography>
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Button variant="outlined" startIcon={<PrintIcon />} onClick={handleDirectPrint} disabled={currentCart.length === 0} sx={{ flex: 1 }}>Test Print Current Cart</Button>
                    <Button variant="outlined" onClick={async () => { const status = await checkPrinterStatus(); alert(`Printer Status Check:\n\n${status.message}\n\nSerial Ports: ${status.portCount}`) }} sx={{ flex: 1 }}>Check Printer Status</Button>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button variant="outlined" onClick={() => { setShowPrinterDialog(false); alert('✅ Printer settings saved!') }} sx={{ flex: 1 }}>Save Settings</Button>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>Choose a layout above to preview and print with the PrintDialog</Typography>
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
            if (currentTab) { updateCurrentTab({ ...currentTab, cart: [] }) }
            setSearchResults([])
            setShowSearchResults(false)
            setManualInput('')
            setSearchQuery('')
          }}
        />

        {/* Toast notifications */}
        <Snackbar open={toast.open} autoHideDuration={4000} onClose={handleToastClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert onClose={handleToastClose} severity={toast.severity || 'info'} variant="filled" sx={{ width: '100%' }}>
            {toast.message}
          </Alert>
        </Snackbar>

      </DashboardLayout>
    </RouteGuard>
  )
}

export default WarehouseBillingPage