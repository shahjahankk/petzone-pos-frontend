'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import api from '../../../utils/axios'
import {
  Box, Typography, Chip, Button, Grid, Card, CardContent,
  FormControl, InputLabel, Select, MenuItem, Paper, Drawer,
  List, ListItem, ListItemText, Divider, IconButton, Badge,
  TextField, Menu, ListItemIcon, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Alert, CircularProgress,
  Tooltip, InputAdornment, Pagination, Dialog, DialogTitle, DialogContent
} from '@mui/material'
import {
  Close as CloseIcon, FilterList as FilterIcon,
  GetApp as ExportIcon, FileDownload as DownloadIcon,
  Delete as DeleteIcon, Search as SearchIcon, Clear as ClearIcon,
  Visibility as ViewIcon, Receipt as ReceiptIcon, Refresh as RefreshIcon,
  Print as PrintIcon
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import PermissionCheck from '../../../components/auth/PermissionCheck'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import { useSalesPolling } from '../../../hooks/usePolling'
import { fetchSales, deleteSale, fetchSalesReturns, createSalesReturn, getSale } from '../../store/slices/salesSlice'
import { fetchInventory } from '../../store/slices/inventorySlice'
import { fetchBranchSettings, fetchBranches } from '../../store/slices/branchesSlice'
import { fetchWarehouses, fetchWarehouseSettings } from '../../store/slices/warehousesSlice'
import { fetchRetailers } from '../../store/slices/retailersSlice'
import usePermissions from '../../../hooks/usePermissions'
import EditableInvoiceForm from '../../../components/sales/EditableInvoiceForm'
import PrintDialog from '../../../components/print/PrintDialog'
import buildPrintData from '../../../utils/buildPrintData'
import { formatSaleBalanceForReport } from '../../../utils/ledgerFinance'

// ─────────────────────────────────────────────────────────────────────────────
// ReadOnlyInvoiceView
// Uses buildPrintData so the printed bill is IDENTICAL to warehouse billing
// ─────────────────────────────────────────────────────────────────────────────
const ReadOnlyInvoiceView = ({ open, onClose, sale, user, branches = [], warehouses = [] }) => {
  const [showPrintDialog, setShowPrintDialog] = useState(false)

  const companyInfo = useMemo(() => {
    if (!sale) return {}
    const scopeType = sale.scope_type || sale.scopeType || ''
    const scopeId   = sale.scope_id   || sale.scopeId

    if (scopeType === 'WAREHOUSE') {
      const wh = warehouses.find(w =>
        w.name === scopeId || w.id === scopeId || w.id === Number(scopeId)
      )
      if (wh) return {
        name:    wh.name,
        address: wh.location || wh.address || '',
        phone:   wh.phone    || wh.managerPhone || '',
        email:   wh.email    || '',
        logoUrl: wh.logoUrl  || '/petzonelogo.png',
      }
    } else {
      const br = branches.find(b => b.id === scopeId || b.id === Number(scopeId))
      if (br) return {
        name:    br.name,
        address: br.location || br.address || '',
        phone:   br.phone    || br.managerPhone || '',
        email:   br.email    || '',
        logoUrl: br.logoUrl  || '/petzonelogo.png',
      }
    }
    return {}
  }, [sale, branches, warehouses])

  const printData = useMemo(() => {
    if (!sale) return null
    return buildPrintData({ sale, companyInfo, user })
  }, [sale, companyInfo, user])

  if (!sale) return null

  const pd = printData || {}
  const items          = pd.items          || []
  const subtotal       = pd.subtotal       || 0
  const tax            = pd.tax            || 0
  const discount       = pd.discount       || 0
  const invoiceTotal   = pd.invoiceTotal   || 0
  const oldBalance     = pd.oldBalance     || 0
  const paymentAmount  = pd.paymentAmount  || 0
  const creditAmount   = pd.creditAmount   || 0
  const remainingBalance = pd.remainingBalance || 0

  const methodColors = {
    CASH: 'success', CARD: 'primary', BANK_TRANSFER: 'info',
    MOBILE_PAYMENT: 'secondary', CHEQUE: 'warning', FULLY_CREDIT: 'error',
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Sale Invoice — {sale.invoice_no || sale.id}</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={() => setShowPrintDialog(true)}
                size="small"
                disabled={!printData}
              >
                Print / Item Sheet
              </Button>
              <Button onClick={onClose} size="small">Close</Button>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent>
          {/* Header info */}
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">Invoice #</Typography>
                <Typography variant="h6" fontWeight="bold">{pd.receiptNumber}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">Date &amp; Time</Typography>
                <Typography variant="body1">{pd.date} {pd.time}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">Payment Status</Typography>
                <Chip
                  label={pd.paymentStatus || 'N/A'}
                  color={pd.paymentStatus === 'COMPLETED' ? 'success' : pd.paymentStatus === 'PENDING' ? 'error' : 'default'}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">Customer</Typography>
                <Typography variant="body1">{pd.customerName}</Typography>
                {pd.customerPhone && (
                  <Typography variant="caption" color="text.secondary">{pd.customerPhone}</Typography>
                )}
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">Payment Method</Typography>
                <Chip
                  label={(pd.paymentMethod || 'N/A').replace(/_/g, ' ')}
                  color={methodColors[pd.paymentMethod] || 'default'}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  {(sale.scope_type || sale.scopeType) === 'WAREHOUSE' ? 'W.Keeper' : 'Cashier'}
                </Typography>
                <Typography variant="body1">{pd.cashierName}</Typography>
              </Grid>
              {(pd.warehouseName || pd.branchName) && (
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {pd.warehouseName ? 'Warehouse' : 'Branch'}
                  </Typography>
                  <Typography variant="body1">{pd.warehouseName || pd.branchName}</Typography>
                  {pd.companyAddress && (
                    <Typography variant="caption" color="text.secondary" display="block">{pd.companyAddress}</Typography>
                  )}
                  {pd.companyPhone && (
                    <Typography variant="caption" color="text.secondary" display="block">📞 {pd.companyPhone}</Typography>
                  )}
                </Grid>
              )}
            </Grid>
          </Paper>

          {/* Items Table */}
          <TableContainer component={Paper} sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Item</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Qty</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Unit Price</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Discount</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">{item.name}</Typography>
                      {item.sku && <Typography variant="caption" color="text.secondary">SKU: {item.sku}</Typography>}
                    </TableCell>
                    <TableCell align="center">{item.quantity}</TableCell>
                    <TableCell align="right">{item.unitPrice.toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ color: item.discount > 0 ? 'error.main' : 'text.secondary' }}>
                      {item.discount > 0 ? `-${item.discount.toLocaleString()}` : '—'}
                    </TableCell>
                    <TableCell align="right">{item.total.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Totals */}
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Box sx={{ width: 260 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Subtotal:</Typography>
                  <Typography variant="body2">{subtotal.toLocaleString()}</Typography>
                </Box>
                {tax > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Tax:</Typography>
                    <Typography variant="body2">{tax.toLocaleString()}</Typography>
                  </Box>
                )}
                {discount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="error.main">Discount:</Typography>
                    <Typography variant="body2" color="error.main">-{discount.toLocaleString()}</Typography>
                  </Box>
                )}
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="subtitle1" fontWeight="bold">Invoice Total:</Typography>
                  <Typography variant="subtitle1" fontWeight="bold">{invoiceTotal.toLocaleString()}</Typography>
                </Box>
                {oldBalance > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Old Balance:</Typography>
                    <Typography variant="body2">{oldBalance.toLocaleString()}</Typography>
                  </Box>
                )}
                {(oldBalance > 0 || invoiceTotal !== (subtotal + tax - discount)) && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="h6" fontWeight="bold">Total Due:</Typography>
                    <Typography variant="h6" fontWeight="bold">{(invoiceTotal + oldBalance).toLocaleString()}</Typography>
                  </Box>
                )}
                <Divider sx={{ my: 1 }} />
                {paymentAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Paid:</Typography>
                    <Typography variant="body2" color="success.main">{paymentAmount.toLocaleString()}</Typography>
                  </Box>
                )}
                {creditAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Credit:</Typography>
                    <Typography variant="body2" color="error.main">{creditAmount.toLocaleString()}</Typography>
                  </Box>
                )}
                {remainingBalance > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="error.main">Remaining Balance:</Typography>
                    <Typography variant="body2" color="error.main">{remainingBalance.toLocaleString()}</Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Paper>
        </DialogContent>
      </Dialog>

      {showPrintDialog && printData && (
        <PrintDialog
          open={showPrintDialog}
          onClose={() => setShowPrintDialog(false)}
          printData={printData}
          title="Print Sales Receipt"
          defaultLayout="color"
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const resolveCustomerName = (sale) => {
  if (sale.customerInfo?.name) return sale.customerInfo.name
  if (sale.customer_info) {
    try {
      const ci = typeof sale.customer_info === 'string'
        ? JSON.parse(sale.customer_info)
        : sale.customer_info
      return ci.name || 'Walk-in Customer'
    } catch (e) { return 'Walk-in Customer' }
  }
  return sale.customer_name || 'Walk-in Customer'
}

const resolvePaymentMethod = (sale) => {
  let pm = sale.paymentMethod || sale.payment_method
  if (!pm && sale.customer_info) {
    try {
      const ci = typeof sale.customer_info === 'string'
        ? JSON.parse(sale.customer_info)
        : sale.customer_info
      pm = ci.paymentMethod
    } catch (e) {}
  }
  return pm || null
}

const resolveSalesperson = (sale) => {
  if (sale.scope_type !== 'WAREHOUSE' && sale.scopeType !== 'WAREHOUSE') return null
  const sp = sale.customerInfo?.salesperson
  if (sp) return sp.name || (sp.id ? `Salesperson ${sp.id}` : null)
  if (sale.customer_info) {
    try {
      const ci = typeof sale.customer_info === 'string'
        ? JSON.parse(sale.customer_info)
        : sale.customer_info
      if (ci.salesperson) return ci.salesperson.name || (ci.salesperson.id ? `Salesperson ${ci.salesperson.id}` : null)
    } catch (e) {}
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
const SalesManagement = () => {
  const dispatch = useDispatch()
  const { user: originalUser } = useSelector((state) => state.auth)

  // ── Admin simulation via URL params ──────────────────────────────────────
  // FIX 1: Added initialized flag so fetch waits for URL params to be read
  const [urlParams,    setUrlParams]    = useState({})
  const [isAdminMode,  setIsAdminMode]  = useState(false)
  const [initialized,  setInitialized]  = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const role  = params.get('role')
      const scope = params.get('scope')
      const id    = params.get('id')
      if (role && scope && id && originalUser?.role === 'ADMIN') {
        setUrlParams({ role, scope, id })
        setIsAdminMode(true)
      } else {
        setUrlParams({})
        setIsAdminMode(false)
      }
      setInitialized(true) // mark ready after URL params are read
    }
  }, [originalUser])

  const getEffectiveUser = useCallback((orig) => {
    if (!isAdminMode || !urlParams.role) return orig
    return {
      ...orig,
      role:          urlParams.role.toUpperCase(),
      branchId:      urlParams.scope === 'branch'    ? parseInt(urlParams.id) : null,
      warehouseId:   urlParams.scope === 'warehouse' ? parseInt(urlParams.id) : null,
      branchName:    urlParams.scope === 'branch'    ? `Branch ${urlParams.id}`    : null,
      warehouseName: urlParams.scope === 'warehouse' ? `Warehouse ${urlParams.id}` : null,
      isAdminMode:   true,
      originalRole:  orig.role,
      originalUser:  orig,
    }
  }, [isAdminMode, urlParams])

  const getScopeInfo = useCallback(() => {
    if (!isAdminMode || !urlParams.role) return null
    return {
      scopeType: urlParams.scope === 'branch' ? 'BRANCH' : 'WAREHOUSE',
      scopeId:   urlParams.id,
      scopeName: urlParams.scope === 'branch' ? `Branch ${urlParams.id}` : `Warehouse ${urlParams.id}`,
    }
  }, [isAdminMode, urlParams])

  const user      = useMemo(() => getEffectiveUser(originalUser), [getEffectiveUser, originalUser])
  const scopeInfo = useMemo(() => getScopeInfo(), [getScopeInfo])

  // FIX 2: isActualAdmin — use originalUser so permissions work correctly during simulation
  const isActualAdmin = originalUser?.role === 'ADMIN'

  const baseScopeParams = useMemo(() => {
    if (!user) return {}
    if (scopeInfo?.scopeType && scopeInfo?.scopeId) {
      const parsedId = Number(scopeInfo.scopeId)
      return { scopeType: scopeInfo.scopeType, scopeId: Number.isNaN(parsedId) ? scopeInfo.scopeId : parsedId }
    }
    if (user.role === 'CASHIER' && user.branchId) return { scopeType: 'BRANCH', scopeId: Number(user.branchId) }
    if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId) return { scopeType: 'WAREHOUSE', scopeId: Number(user.warehouseId) }
    return {}
  }, [user, scopeInfo])

  // Redux state
  const { branchSettings, data: branches }           = useSelector((state) => state.branches)
  const { data: warehouses, warehouseSettings }       = useSelector((state) => state.warehouses)
  const { data: retailers }                           = useSelector((state) => state.retailers)
  const {
    data: sales = [], loading: salesLoading, error: salesError,
    returns: salesReturns = [], pagination: salesPagination = {}, summary: salesSummary = {}
  } = useSelector((state) => state.sales || {})

  // Filter/sort state
  const [filters, setFilters] = useState({
    scopeType: 'all', scopeId: 'all', companyId: 'all', retailerId: 'all', startDate: '', endDate: ''
  })
  const [searchTerm,          setSearchTerm]          = useState('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all')
  const [statusFilter,        setStatusFilter]        = useState('all')
  const [scopeTypeFilter,     setScopeTypeFilter]     = useState('all')
  const [scopeSearch,         setScopeSearch]         = useState('')
  const [sortBy,              setSortBy]              = useState('created_at')
  const [sortOrder,           setSortOrder]           = useState('desc')
  const [startDate,           setStartDate]           = useState(null)
  const [endDate,             setEndDate]             = useState(null)
  const [page,                setPage]                = useState(1)
  const [rowsPerPage,         setRowsPerPage]         = useState(25)

  // Drawer / dialog state
  const [filterDrawerOpen,    setFilterDrawerOpen]    = useState(false)
  const [filteredSales,       setFilteredSales]       = useState([])
  const [exportAnchorEl,      setExportAnchorEl]      = useState(null)
  const [selectedSale,        setSelectedSale]        = useState(null)
  const [saleItems,           setSaleItems]           = useState([])
  const [showItemsDialog,     setShowItemsDialog]     = useState(false)
  const [viewingSale,         setViewingSale]         = useState(null)
  const [editingSale,         setEditingSale]         = useState(null)
  const [showEditableInvoice, setShowEditableInvoice] = useState(false)
  const [openDeleteDialog,    setOpenDeleteDialog]    = useState(false)
  const [entityToDelete,      setEntityToDelete]      = useState(null)

  // FIX 3: Permissions — use isActualAdmin so admin always has full access even during simulation
  const canView = true
  const canEdit = (() => {
    if (isActualAdmin || user?.role === 'ADMIN') return true
    if (user?.role === 'CASHIER') return Boolean(branchSettings?.allowCashierSalesEdit)
    if (user?.role === 'WAREHOUSE_KEEPER') return Boolean(warehouseSettings?.allowWarehouseSalesEdit)
    return false
  })()
  const canDelete = (() => {
    if (isActualAdmin || user?.role === 'ADMIN') return true
    if (user?.role === 'CASHIER') return Boolean(branchSettings?.allowCashierSalesDelete)
    if (user?.role === 'WAREHOUSE_KEEPER') return Boolean(warehouseSettings?.allowWarehouseSalesDelete)
    return false
  })()

  // ── Data fetching ──────────────────────────────────────────────────────────
  const handleManualRefresh = useCallback(() => {
    const params = { ...baseScopeParams, page, limit: rowsPerPage, _t: Date.now() }
    if (isActualAdmin && !isAdminMode && scopeSearch) params.scopeSearch = scopeSearch
    dispatch(fetchSales(params))
    dispatch(fetchSalesReturns(params))
  }, [dispatch, baseScopeParams, page, rowsPerPage, isActualAdmin, isAdminMode, scopeSearch])

  const handleDataUpdate = useCallback(() => {
    const params = { ...baseScopeParams, page, limit: rowsPerPage, _t: Date.now() }
    if (isActualAdmin && !isAdminMode && scopeSearch) params.scopeSearch = scopeSearch
    dispatch(fetchSales(params))
    dispatch(fetchSalesReturns(params))
  }, [dispatch, baseScopeParams, page, rowsPerPage, isActualAdmin, isAdminMode, scopeSearch])

  const { isPolling, lastUpdate, refreshData } = useSalesPolling({
    enabled: false,
    interval: 60000,
    onDataUpdate: handleDataUpdate
  })

  // FIX 4: Guard with initialized + fix scope logic for simulation mode
  useEffect(() => {
    if (!initialized) return // wait for URL params to be read first

    const timeoutId = setTimeout(() => {
      const salesParams = { ...baseScopeParams }

      // Only apply extra scope/company filters when admin is NOT in simulation mode.
      // When in simulation mode, baseScopeParams already has the correct scope.
      if (isActualAdmin && !isAdminMode) {
        if (filters.scopeType !== 'all') {
          salesParams.scopeType = filters.scopeType
          if (filters.scopeId !== 'all') {
            const parsed = Number(filters.scopeId)
            salesParams.scopeId = Number.isNaN(parsed) ? filters.scopeId : parsed
          } else {
            delete salesParams.scopeId
          }
        } else if (!scopeInfo) {
          delete salesParams.scopeType
          delete salesParams.scopeId
        }
        if (filters.companyId !== 'all') salesParams.companyId = filters.companyId
        if (scopeSearch) salesParams.scopeSearch = scopeSearch
      }

      if (user?.role === 'WAREHOUSE_KEEPER' && filters.retailerId !== 'all') {
        salesParams.retailerId = filters.retailerId
      }

      if (startDate) salesParams.startDate = startDate.toISOString().split('T')[0]
      if (endDate)   salesParams.endDate   = endDate.toISOString().split('T')[0]

      salesParams.page  = page
      salesParams.limit = rowsPerPage

      dispatch(fetchSales(salesParams))
      dispatch(fetchSalesReturns(salesParams))
    }, 500)

    // Only fetch branches/warehouses for unscoped admin (global view)
    if (isActualAdmin && !isAdminMode) {
      dispatch(fetchBranches())
      dispatch(fetchWarehouses())
    }
    if (user?.role === 'CASHIER' && user?.branchId) {
      dispatch(fetchBranchSettings(user.branchId))
    }
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
      dispatch(fetchRetailers({ warehouseId: user.warehouseId }))
    }
    if (user) dispatch(fetchInventory({ ...baseScopeParams }))

    return () => clearTimeout(timeoutId)
  }, [dispatch, user, filters, startDate, endDate, baseScopeParams, scopeInfo, page, rowsPerPage, scopeSearch, initialized, isActualAdmin, isAdminMode])

  // ── Filter helpers ─────────────────────────────────────────────────────────
  const handleFilterChange = (field, value) => {
    setFilters(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'scopeType') next.scopeId = 'all'
      return next
    })
  }

  const clearFilters = () => {
    setSearchTerm('')
    setPaymentMethodFilter('all')
    setStatusFilter('all')
    setScopeTypeFilter('all')
    setScopeSearch('')
    setSortBy('created_at')
    setSortOrder('desc')
    setPage(1)
  }

  const getFilterSummary = () => {
    const active = []
    if (searchTerm) active.push(`Search: "${searchTerm}"`)
    if (scopeSearch && isActualAdmin && !isAdminMode) active.push(`Scope: "${scopeSearch}"`)
    if (paymentMethodFilter !== 'all') active.push(`Payment: ${paymentMethodFilter}`)
    if (statusFilter !== 'all') active.push(`Status: ${statusFilter}`)
    if (scopeTypeFilter !== 'all') active.push(`Scope: ${scopeTypeFilter}`)
    return active
  }

  const getFilteredAndSortedSales = () => {
    let filtered = (sales || []).filter(sale => {
      if (searchTerm) {
        const lower = searchTerm.toLowerCase()
        const invoiceMatch  = sale.invoice_no?.toLowerCase().includes(lower)
        const customerMatch = resolveCustomerName(sale).toLowerCase().includes(lower)
        if (!invoiceMatch && !customerMatch) return false
      }

      if (paymentMethodFilter !== 'all') {
        const pm          = sale.paymentMethod || sale.payment_method
        const ps          = sale.paymentStatus || sale.payment_status
        const creditAmt   = sale.creditAmount  || 0
        if (paymentMethodFilter === 'partial_payment') {
          if (ps !== 'PARTIAL' && creditAmt <= 0) return false
        } else {
          if (pm?.toLowerCase() !== paymentMethodFilter.toLowerCase()) return false
        }
      }

      if (statusFilter !== 'all') {
        const ps = (sale.payment_status || sale.paymentStatus || sale.status || '').toLowerCase()
        if (ps !== statusFilter.toLowerCase()) return false
      }

      if (scopeTypeFilter !== 'all') {
        if ((sale.scope_type || sale.scopeType) !== scopeTypeFilter) return false
      }

      if (startDate || endDate) {
        const saleDate = new Date(sale.created_at || sale.createdAt || 0)
        if (isNaN(saleDate.getTime())) return false
        if (startDate) {
          const s = new Date(startDate); s.setHours(0, 0, 0, 0)
          const d = new Date(saleDate);  d.setHours(0, 0, 0, 0)
          if (d < s) return false
        }
        if (endDate) {
          const e = new Date(endDate);  e.setHours(23, 59, 59, 999)
          const d = new Date(saleDate); d.setHours(23, 59, 59, 999)
          if (d > e) return false
        }
      }

      return true
    })

    filtered.sort((a, b) => {
      let aVal, bVal
      switch (sortBy) {
        case 'total':        aVal = parseFloat(a.total || 0);     bVal = parseFloat(b.total || 0);     break
        case 'invoice_no':   aVal = a.invoice_no || '';           bVal = b.invoice_no || '';           break
        case 'customerName': aVal = resolveCustomerName(a);       bVal = resolveCustomerName(b);       break
        case 'created_at':
        default:             aVal = new Date(a.created_at || 0);  bVal = new Date(b.created_at || 0);  break
      }
      return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })

    return filtered
  }

  // Pagination is server-driven (page/limit sent on every fetch).
  // Client-side filter/sort operates only on the current server page.
  // Do NOT re-slice here — that would hide rows on page 2+ since the server already
  // returned only `rowsPerPage` rows.
  const allFilteredSales = getFilteredAndSortedSales()
  const totalItems  = salesPagination?.total ?? allFilteredSales.length
  const totalPages  = Math.max(1, Math.ceil(totalItems / rowsPerPage))
  const paginatedSales = allFilteredSales
  const startIndex = totalItems === 0 ? 0 : (page - 1) * rowsPerPage
  const endIndex = startIndex + paginatedSales.length

  const handlePageChange       = (event, newPage) => setPage(newPage)
  const handleRowsPerPageChange = (event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(1) }

  // ── Sale actions ───────────────────────────────────────────────────────────
  const fetchSaleForEdit = async (saleId) => {
    try {
      const result = await dispatch(getSale(saleId))
      if (getSale.fulfilled.match(result)) {
        const saleData = result.payload.data || result.payload
        setSelectedSale(saleData)
        setSaleItems(saleData.items || [])
        return saleData
      }
      return null
    } catch (error) {
      return null
    }
  }

  const handleDeleteSale = async () => {
    try {
      const result = await dispatch(deleteSale(entityToDelete.id))
      if (deleteSale.fulfilled.match(result)) {
        setOpenDeleteDialog(false)
        setEntityToDelete(null)
        dispatch(fetchSales({ ...baseScopeParams, page, limit: rowsPerPage }))
      } else if (deleteSale.rejected.match(result)) {
        alert(`Failed to delete sale: ${result.payload || 'Unknown error'}`)
      }
    } catch (error) {
      alert(`Failed to delete sale: ${error.message || 'Unknown error'}`)
    }
  }

  const handleEditInvoice = async (sale) => {
    try {
      const response = await api.get(`/sales/${sale.id}`)
      if (response.data.success) {
        setEditingSale(response.data.data)
        setShowEditableInvoice(true)
      } else {
        alert('Failed to load sale details')
      }
    } catch (error) {
      alert('Failed to load sale details')
    }
  }

  const handleCloseEditableInvoice = () => {
    setShowEditableInvoice(false)
    setEditingSale(null)
  }

  const handleSaveEditableInvoice = () => {
    dispatch(fetchSales({ ...baseScopeParams, page, limit: rowsPerPage }))
    dispatch(fetchInventory(baseScopeParams))
    setShowEditableInvoice(false)
    setEditingSale(null)
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExportClick = (event) => setExportAnchorEl(event.currentTarget)
  const handleExportClose = () => setExportAnchorEl(null)

  const buildItemSummary = (salesData) => {
    const map = new Map()
    salesData.forEach((sale) => {
      if (!sale?.items || !Array.isArray(sale.items)) return
      sale.items.forEach((item) => {
        const name     = item?.itemName || item?.name || item?.productName || 'Unknown Item'
        const sku      = item?.sku      || 'N/A'
        const quantity = Number(item?.quantity) || 0
        const total    = Number(item?.total ?? (item?.unitPrice || 0) * quantity) || 0
        const key = `${name}|||${sku}`
        if (!map.has(key)) map.set(key, { name, sku, totalQuantity: 0, totalSales: 0 })
        const entry = map.get(key)
        entry.totalQuantity += quantity
        entry.totalSales    += total
      })
    })
    return Array.from(map.values()).sort((a, b) => b.totalQuantity - a.totalQuantity)
  }

  const safeDate = (d) => d ? d.toLocaleDateString() : 'N/A'

  const getSalespersonCell = (sale, hasWarehouse) => {
    if (!hasWarehouse) return []
    return [resolveSalesperson(sale) || 'N/A']
  }

  const generateCSV = (salesData) => {
    const totalRevenue  = salesData.reduce((s, x) => s + parseFloat(x.total          || 0), 0)
    const totalSubtotal = salesData.reduce((s, x) => s + parseFloat(x.subtotal       || 0), 0)
    const totalTax      = salesData.reduce((s, x) => s + parseFloat(x.tax            || 0), 0)
    const totalDiscount = salesData.reduce((s, x) => s + parseFloat(x.discount       || 0), 0)
    const totalPayment  = salesData.reduce((s, x) => s + parseFloat(x.payment_amount || 0), 0)
    const itemSummary   = buildItemSummary(salesData)
    const hasWarehouse  = salesData.some(s => (s.scope_type || s.scopeType) === 'WAREHOUSE')

    const summary = [
      ['Sales Report Summary'],
      ['Report Date Range', `${safeDate(startDate)} - ${safeDate(endDate)}`],
      ['Total Transactions', salesData.length],
      ['Total Subtotal', totalSubtotal.toFixed(2)],
      ['Total Tax', totalTax.toFixed(2)],
      ['Total Discount', totalDiscount.toFixed(2)],
      ['Total Revenue', totalRevenue.toFixed(2)],
      ['Total Payments Received', totalPayment.toFixed(2)],
      ['']
    ]

    if (itemSummary.length > 0) {
      summary.push(['Product Summary'], ['Product', 'SKU', 'Total Quantity', 'Total Sales'])
      itemSummary.forEach(i => summary.push([i.name, i.sku, i.totalQuantity, i.totalSales.toFixed(2)]))
      summary.push([''])
    }

    const headers = hasWarehouse
      ? ['ID', 'Date', 'Time', 'Invoice #', 'Customer', 'Salesperson', 'Subtotal', 'Tax', 'Discount', 'Total', 'Payment', 'Credit', 'Balance', 'Payment Method', 'Payment Type', 'Payment Status', 'Returns', 'Notes', 'Created By']
      : ['ID', 'Date', 'Time', 'Invoice #', 'Customer', 'Subtotal', 'Tax', 'Discount', 'Total', 'Payment', 'Credit', 'Balance', 'Payment Method', 'Payment Type', 'Payment Status', 'Returns', 'Notes', 'Created By']

    const rows = salesData.map(sale => {
      const returns = salesReturns?.filter(r =>
        (r.original_sale_id ?? r.sale_id) === sale.id
      ) || []
      const totalReturnedQty = returns.reduce((s, r) => s + (r.items?.reduce((is, i) => is + (i.quantity || 0), 0) || 0), 0)
      const d = new Date(sale.created_at)
      return [
        sale.id,
        d.toLocaleDateString(),
        d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        sale.invoice_no || 'N/A',
        resolveCustomerName(sale),
        ...getSalespersonCell(sale, hasWarehouse),
        parseFloat(sale.subtotal       || 0).toFixed(2),
        parseFloat(sale.tax            || 0).toFixed(2),
        parseFloat(sale.discount       || 0).toFixed(2),
        parseFloat(sale.total          || 0).toFixed(2),
        parseFloat(sale.payment_amount || 0).toFixed(2),
        parseFloat(sale.credit_amount  || sale.creditAmount  || 0).toFixed(2),
        formatSaleBalanceForReport(sale, { empty: '' }),
        sale.paymentMethod || sale.payment_method || 'N/A',
        sale.paymentType   || sale.payment_type   || 'N/A',
        sale.paymentStatus || sale.payment_status || 'N/A',
        totalReturnedQty,
        sale.notes || 'No Notes',
        sale.created_by || sale.username || sale.user_name || 'Unknown'
      ]
    })

    return [...summary, headers, ...rows]
      .map(row => Array.isArray(row) ? row.join(',') : `${row}`)
      .join('\n')
  }

  const generateExcel = async (salesData) => {
    try {
      const XLSX        = await import('xlsx')
      const hasWarehouse = salesData.some(s => (s.scope_type || s.scopeType) === 'WAREHOUSE')

      const excelData = salesData.map(sale => {
        const returns = salesReturns?.filter(r =>
        (r.original_sale_id ?? r.sale_id) === sale.id
      ) || []
        const totalReturnedQty = returns.reduce((s, r) => s + (r.items?.reduce((is, i) => is + (i.quantity || 0), 0) || 0), 0)
        const d = new Date(sale.created_at)
        return {
          'ID':             sale.id,
          'Date':           d.toLocaleDateString(),
          'Time':           d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          'Invoice #':      sale.invoice_no || 'N/A',
          'Customer':       resolveCustomerName(sale),
          ...(hasWarehouse ? { 'Salesperson': resolveSalesperson(sale) || 'N/A' } : {}),
          'Subtotal':       parseFloat(sale.subtotal        || 0).toFixed(2),
          'Tax':            parseFloat(sale.tax             || 0).toFixed(2),
          'Discount':       parseFloat(sale.discount        || 0).toFixed(2),
          'Total':          parseFloat(sale.total           || 0).toFixed(2),
          'Payment':        parseFloat(sale.payment_amount  || 0).toFixed(2),
          'Credit':         parseFloat(sale.credit_amount   || sale.creditAmount   || 0).toFixed(2),
          'Balance':        formatSaleBalanceForReport(sale, { empty: '' }),
          'Payment Method': sale.paymentMethod || sale.payment_method || 'N/A',
          'Payment Type':   sale.paymentType   || sale.payment_type   || 'N/A',
          'Payment Status': sale.paymentStatus || sale.payment_status || 'N/A',
          'Returns':        totalReturnedQty,
          'Notes':          sale.notes || 'No Notes',
          'Created By':     sale.created_by || sale.username || sale.user_name || 'Unknown'
        }
      })

      const itemSummary = buildItemSummary(salesData)
      const workbook    = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(excelData), 'Sales Data')

      const summarySheet = itemSummary.length > 0
        ? itemSummary.map(i => ({ 'Product': i.name, 'SKU': i.sku === 'N/A' ? '' : i.sku, 'Total Quantity': i.totalQuantity, 'Total Sales': i.totalSales.toFixed(2) }))
        : [{ 'Product': 'No item data for selected filters', 'SKU': '', 'Total Quantity': 0, 'Total Sales': '0.00' }]
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summarySheet), 'Item Summary')

      return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    } catch (error) {
      return generateCSV(salesData)
    }
  }

  const generatePDF = (salesData) => {
    const itemSummary  = buildItemSummary(salesData)
    const hasWarehouse = salesData.some(s => (s.scope_type || s.scopeType) === 'WAREHOUSE')

    const itemSummaryHtml = itemSummary.length > 0 ? `
      <div class="summary">
        <h3>Item Summary</h3>
        <table class="item-summary-table">
          <thead><tr><th>Product</th><th>SKU</th><th>Total Quantity</th><th>Total Sales</th></tr></thead>
          <tbody>
            ${itemSummary.map(i => `<tr><td>${i.name}</td><td>${i.sku}</td><td>${i.totalQuantity}</td><td>${i.totalSales.toFixed(2)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sales Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .item-summary-table th { background-color: #e9f5ff; }
            .status-completed { color: #28a745; }
            .status-pending   { color: #ffc107; }
            .status-cancelled { color: #dc3545; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Sales Report</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <p>Date Range: ${safeDate(startDate)} to ${safeDate(endDate)}</p>
            <p>Total Records: ${salesData.length}</p>
          </div>
          <div class="summary">
            <h3>Summary Statistics</h3>
            <p><strong>Total Transactions:</strong> ${salesData.length}</p>
            <p><strong>Total Subtotal:</strong>  ${salesData.reduce((s, x) => s + parseFloat(x.subtotal       || 0), 0).toFixed(2)}</p>
            <p><strong>Total Tax:</strong>        ${salesData.reduce((s, x) => s + parseFloat(x.tax            || 0), 0).toFixed(2)}</p>
            <p><strong>Total Discount:</strong>   ${salesData.reduce((s, x) => s + parseFloat(x.discount       || 0), 0).toFixed(2)}</p>
            <p><strong>Total Revenue:</strong>    ${salesData.reduce((s, x) => s + parseFloat(x.total          || 0), 0).toFixed(2)}</p>
            <p><strong>Total Payments Received:</strong> ${salesData.reduce((s, x) => s + parseFloat(x.payment_amount || 0), 0).toFixed(2)}</p>
            <p><strong>Completed Payments:</strong> ${salesData.filter(x => (x.paymentStatus || x.payment_status) === 'COMPLETED').length}</p>
            <p><strong>Pending Payments:</strong>   ${salesData.filter(x => (x.paymentStatus || x.payment_status) === 'PENDING').length}</p>
          </div>
          ${itemSummaryHtml}
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Time</th><th>Invoice #</th><th>Customer</th>
                ${hasWarehouse ? '<th>Salesperson</th>' : ''}
                <th>Subtotal</th><th>Tax</th><th>Discount</th><th>Total</th>
                <th>Payment</th><th>Credit</th><th>Balance</th>
                <th>Payment Method</th><th>Payment Type</th><th>Payment Status</th>
                <th>Returns</th><th>Notes</th><th>Created By</th>
              </tr>
            </thead>
            <tbody>
              ${salesData.map(sale => {
                const returns = salesReturns?.filter(r =>
        (r.original_sale_id ?? r.sale_id) === sale.id
      ) || []
                const totalReturnedQty = returns.reduce((s, r) => s + (r.items?.reduce((is, i) => is + (i.quantity || 0), 0) || 0), 0)
                const d = new Date(sale.created_at)
                return `
                  <tr>
                    <td>${d.toLocaleDateString()}</td>
                    <td>${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                    <td>${sale.invoice_no || 'N/A'}</td>
                    <td>${resolveCustomerName(sale)}</td>
                    ${hasWarehouse ? `<td>${resolveSalesperson(sale) || 'N/A'}</td>` : ''}
                    <td>${parseFloat(sale.subtotal        || 0).toFixed(2)}</td>
                    <td>${parseFloat(sale.tax             || 0).toFixed(2)}</td>
                    <td>${parseFloat(sale.discount        || 0).toFixed(2)}</td>
                    <td>${parseFloat(sale.total           || 0).toFixed(2)}</td>
                    <td>${parseFloat(sale.payment_amount  || 0).toFixed(2)}</td>
                    <td>${parseFloat(sale.credit_amount   || sale.creditAmount   || 0).toFixed(2)}</td>
                    <td>${formatSaleBalanceForReport(sale, { empty: '—' })}</td>
                    <td>${sale.paymentMethod || sale.payment_method || 'N/A'}</td>
                    <td>${sale.paymentType   || sale.payment_type   || 'N/A'}</td>
                    <td class="status-${(sale.paymentStatus || sale.payment_status)?.toLowerCase() || 'unknown'}">
                      ${sale.paymentStatus || sale.payment_status || 'N/A'}
                    </td>
                    <td>${totalReturnedQty}</td>
                    <td>${sale.notes || 'No Notes'}</td>
                    <td>${sale.created_by || sale.username || sale.user_name || 'Unknown'}</td>
                  </tr>`
              }).join('')}
            </tbody>
          </table>
        </body>
      </html>`
  }

  const downloadFile = (content, filename, mimeType) => {
    if (mimeType === 'application/pdf') {
      const w = window.open('', '_blank')
      w.document.write(content)
      w.document.close()
      w.onload = () => { w.print(); w.close() }
    } else {
      const blob = new Blob([content], { type: mimeType })
      const url  = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = filename
      document.body.appendChild(link); link.click()
      document.body.removeChild(link); window.URL.revokeObjectURL(url)
    }
  }

  const exportToCSV = () => {
    downloadFile(generateCSV(getFilteredAndSortedSales()), 'sales-data.csv', 'text/csv')
    handleExportClose()
  }

  const exportToExcel = async () => {
    const data = await generateExcel(getFilteredAndSortedSales())
    const isBuffer = data instanceof ArrayBuffer || data instanceof Uint8Array
    const mime = isBuffer ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv'
    const ext  = isBuffer ? 'xlsx' : 'csv'
    const blob = new Blob([data], { type: mime })
    const url  = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `sales-data-${new Date().toISOString().split('T')[0]}.${ext}`
    document.body.appendChild(link); link.click()
    document.body.removeChild(link); window.URL.revokeObjectURL(url)
    handleExportClose()
  }

  const exportToPDF = () => {
    downloadFile(generatePDF(getFilteredAndSortedSales()), 'sales-data.pdf', 'application/pdf')
    handleExportClose()
  }

  // ── Computed values ────────────────────────────────────────────────────────
  const salesStats = useMemo(() => ({
    totalSales:        Number(salesSummary.totalSales        || 0),
    totalTransactions: Number(salesSummary.totalTransactions || 0),
    averageOrderValue: Number(salesSummary.averageOrderValue || 0),
    completedSales:    Number(salesSummary.completedSales    || 0)
  }), [salesSummary])

  const hasWarehouseSales = useMemo(() =>
    (sales || []).some(s => (s.scope_type || s.scopeType) === 'WAREHOUSE'),
    [sales]
  )

  const methodColors = { CASH: 'success', CARD: 'primary', BANK_TRANSFER: 'info', MOBILE_PAYMENT: 'secondary', CHEQUE: 'warning' }
  const typeColors   = { FULL_PAYMENT: 'success', PARTIAL_PAYMENT: 'warning', FULLY_CREDIT: 'error', CASH: 'success', CARD: 'primary', BANK_TRANSFER: 'info', CHEQUE: 'warning' }
  const typeLabels   = { FULL_PAYMENT: 'Full Payment', PARTIAL_PAYMENT: 'Partial Payment', FULLY_CREDIT: 'Fully Credit', CASH: 'Cash', CARD: 'Card', BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque' }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']}>
        <PermissionCheck roles={['ADMIN', 'MANAGER', 'CASHIER', 'WAREHOUSE_KEEPER']}>
          <Box sx={{ p: 3 }}>
            {/* FIX 5: Admin simulation banner */}
            {isAdminMode && scopeInfo && (
              <Box sx={{ bgcolor: 'warning.light', color: 'warning.contrastText', p: 1, textAlign: 'center', borderBottom: 1, borderColor: 'warning.main', mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  🔧 ADMIN MODE: Operating as {scopeInfo.scopeType === 'BRANCH' ? 'Cashier' : 'Warehouse Keeper'} for {scopeInfo.scopeName}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" component="h1">Sales Management</Typography>
            </Box>

            {/* Stats */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              {[
                { label: 'Total Sales',        value: salesStats.totalSales.toFixed(2) },
                { label: 'Total Transactions', value: salesStats.totalTransactions },
                { label: 'Average Order Value',value: salesStats.averageOrderValue.toFixed(2) },
                { label: 'Completed Sales',    value: salesStats.completedSales },
              ].map(({ label, value }) => (
                <Grid item xs={12} sm={6} md={3} key={label}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>{label}</Typography>
                      <Typography variant="h5" component="div">{value}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Table */}
            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Sales Transactions</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleManualRefresh} disabled={salesLoading} sx={{ minWidth: 120 }}>
                    Refresh
                  </Button>
                  <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExportClick} sx={{ minWidth: 120 }}>
                    Export
                  </Button>
                </Box>
              </Box>

              <Card>
                <CardContent>
                  {/* Filters */}
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <FilterIcon sx={{ mr: 1, fontSize: 20 }} />
                      <Typography variant="subtitle2">Search &amp; Filters</Typography>
                    </Box>

                    <Grid container spacing={2} sx={{ mb: 1 }} alignItems="center">
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth size="small" label="Search Sales"
                          placeholder="Search by invoice, customer..."
                          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                          InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                            endAdornment: searchTerm && (
                              <InputAdornment position="end">
                                <IconButton size="small" onClick={() => setSearchTerm('')} edge="end"><ClearIcon /></IconButton>
                              </InputAdornment>
                            )
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DatePicker label="Start Date" value={startDate} onChange={setStartDate}
                            slotProps={{ textField: { size: 'small', fullWidth: true } }} />
                        </LocalizationProvider>
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DatePicker label="End Date" value={endDate} onChange={setEndDate}
                            slotProps={{ textField: { size: 'small', fullWidth: true } }} />
                        </LocalizationProvider>
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Payment Method</InputLabel>
                          <Select value={paymentMethodFilter} label="Payment Method" onChange={(e) => setPaymentMethodFilter(e.target.value)}>
                            <MenuItem value="all">All Methods</MenuItem>
                            <MenuItem value="cash">Cash</MenuItem>
                            <MenuItem value="card">Card</MenuItem>
                            <MenuItem value="upi">UPI</MenuItem>
                            <MenuItem value="netbanking">Net Banking</MenuItem>
                            <MenuItem value="partial_payment">Partial Payment</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Status</InputLabel>
                          <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
                            <MenuItem value="all">All Status</MenuItem>
                            <MenuItem value="completed">Completed</MenuItem>
                            <MenuItem value="pending">Pending</MenuItem>
                            <MenuItem value="cancelled">Cancelled</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Scope</InputLabel>
                          <Select value={scopeTypeFilter} label="Scope" onChange={(e) => setScopeTypeFilter(e.target.value)}>
                            <MenuItem value="all">All Scopes</MenuItem>
                            <MenuItem value="BRANCH">Branch</MenuItem>
                            <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      {/* FIX 6: Only show scope search for unscoped admin (not in simulation) */}
                      {isActualAdmin && !isAdminMode && (
                        <Grid item xs={12} md={3}>
                          <TextField
                            fullWidth size="small" label="Search Branch/Warehouse" placeholder="Name or ID"
                            value={scopeSearch}
                            onChange={(e) => { setScopeSearch(e.target.value); setPage(1) }}
                            InputProps={{
                              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                              endAdornment: scopeSearch && (
                                <InputAdornment position="end">
                                  <IconButton size="small" onClick={() => { setScopeSearch(''); setPage(1) }} edge="end"><ClearIcon fontSize="small" /></IconButton>
                                </InputAdornment>
                              )
                            }}
                          />
                        </Grid>
                      )}
                      <Grid item xs={12} md={1}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Sort By</InputLabel>
                          <Select value={sortBy} label="Sort By" onChange={(e) => setSortBy(e.target.value)}>
                            <MenuItem value="created_at">Date</MenuItem>
                            <MenuItem value="total">Total</MenuItem>
                            <MenuItem value="invoice_no">Invoice</MenuItem>
                            <MenuItem value="customerName">Customer</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={1}>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <Tooltip title="Clear all filters">
                            <IconButton size="small" onClick={clearFilters} disabled={getFilterSummary().length === 0}><ClearIcon /></IconButton>
                          </Tooltip>
                          <Tooltip title={sortOrder === 'asc' ? 'Sort Descending' : 'Sort Ascending'}>
                            <IconButton size="small" onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}>
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Grid>
                    </Grid>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      {getFilterSummary().length > 0 ? (
                        <>
                          <Typography variant="body2" color="text.secondary">Active filters:</Typography>
                          {getFilterSummary().map((f, i) => (
                            <Chip key={i} label={f} size="small" color="primary" variant="outlined" />
                          ))}
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">No filters applied — showing all items</Typography>
                      )}
                    </Box>
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        Showing {startIndex + 1}–{Math.min(endIndex, totalItems)} of {totalItems} sales
                      </Typography>
                    </Box>
                  </Box>

                  {/* Table content */}
                  {salesLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
                  ) : salesError ? (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {typeof salesError === 'string' ? salesError : salesError.message || 'Failed to load sales data'}
                    </Alert>
                  ) : (
                    <TableContainer component={Paper}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Time</TableCell>
                            <TableCell>Invoice #</TableCell>
                            <TableCell>Location</TableCell>
                            <TableCell>Customer</TableCell>
                            {hasWarehouseSales && <TableCell>Salesperson</TableCell>}
                            <TableCell align="right">Subtotal</TableCell>
                            <TableCell align="right">Tax</TableCell>
                            <TableCell align="right">Discount</TableCell>
                            <TableCell align="right">Total</TableCell>
                            <TableCell>Payment Method</TableCell>
                            <TableCell>Payment Type</TableCell>
                            <TableCell>Payment Terms</TableCell>
                            <TableCell>Payment Status</TableCell>
                            <TableCell>Created By</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {paginatedSales.map((sale) => {
                            const scopeType = sale.scope_type || sale.scopeType
                            const scopeId   = sale.scope_id   || sale.scopeId
                            const pm        = resolvePaymentMethod(sale)
                            const pt        = sale.paymentType || sale.payment_type
                            const ps        = sale.paymentStatus || sale.payment_status

                            return (
                              <TableRow key={sale.id}>
                                <TableCell>{sale.id}</TableCell>
                                <TableCell>
                                  {(() => {
                                    try { const d = new Date(sale.created_at); return isNaN(d) ? 'N/A' : d.toLocaleDateString() }
                                    catch { return 'N/A' }
                                  })()}
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    try { return new Date(sale.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) }
                                    catch { return 'N/A' }
                                  })()}
                                </TableCell>
                                <TableCell>{sale.invoice_no || 'N/A'}</TableCell>
                                <TableCell>
                                  {scopeType === 'WAREHOUSE'
                                    ? (warehouses || []).find(w => w.id === scopeId || w.id === Number(scopeId))?.name || `Warehouse ${scopeId}`
                                    : (branches  || []).find(b => b.id === scopeId || b.id === Number(scopeId))?.name  || `Branch ${scopeId}`
                                  }
                                </TableCell>
                                <TableCell>{resolveCustomerName(sale)}</TableCell>
                                {hasWarehouseSales && <TableCell>{resolveSalesperson(sale) || '—'}</TableCell>}
                                <TableCell align="right">{parseFloat(sale.subtotal || 0).toFixed(2)}</TableCell>
                                <TableCell align="right">{parseFloat(sale.tax      || 0).toFixed(2)}</TableCell>
                                <TableCell align="right">{parseFloat(sale.discount || 0).toFixed(2)}</TableCell>
                                <TableCell align="right">{parseFloat(sale.total    || 0).toFixed(2)}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={pm === 'FULLY_CREDIT' ? 'FULLY CREDIT' : pm === 'PARTIAL_PAYMENT' ? 'PARTIAL PAYMENT' : (pm?.replace('_', ' ').toUpperCase() || 'N/A')}
                                    color={methodColors[pm] || (pm === 'FULLY_CREDIT' ? 'error' : pm === 'PARTIAL_PAYMENT' ? 'warning' : 'default')}
                                    size="small"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Chip label={typeLabels[pt] || pt || 'N/A'} color={typeColors[pt] || 'default'} size="small" />
                                </TableCell>
                                <TableCell>
                                  {pm === 'CREDIT'
                                    ? (() => {
                                        const ci = sale.customerInfo || (() => {
                                          try { return typeof sale.customer_info === 'string' ? JSON.parse(sale.customer_info) : sale.customer_info } catch { return null }
                                        })()
                                        return ci?.paymentTerms || 'N/A'
                                      })()
                                    : '—'
                                  }
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={ps || 'N/A'}
                                    color={ps === 'COMPLETED' ? 'success' : ps === 'PENDING' ? 'error' : 'default'}
                                    size="small"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" fontWeight="medium">
                                    {sale.created_by || sale.username || sale.user_name || 'Unknown'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Tooltip title="View Invoice">
                                      <IconButton size="small" color="info"
                                        onClick={async () => {
                                          const full = await fetchSaleForEdit(sale.id)
                                          setViewingSale(full || sale)
                                          setShowItemsDialog(true)
                                        }}>
                                        <ViewIcon />
                                      </IconButton>
                                    </Tooltip>
                                    {canEdit && (
                                      <Tooltip title="Edit Invoice">
                                        <IconButton size="small" color="secondary" onClick={() => handleEditInvoice(sale)}>
                                          <ReceiptIcon />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    {canDelete && (
                                      <Tooltip title="Delete">
                                        <IconButton size="small" color="error"
                                          onClick={() => { setEntityToDelete(sale); setOpenDeleteDialog(true) }}>
                                          <DeleteIcon />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                  </Box>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {/* Pagination */}
                  {totalItems > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">Rows per page:</Typography>
                        <FormControl size="small" sx={{ minWidth: 80 }}>
                          <Select value={rowsPerPage} onChange={handleRowsPerPageChange}>
                            <MenuItem value={10}>10</MenuItem>
                            <MenuItem value={25}>25</MenuItem>
                            <MenuItem value={50}>50</MenuItem>
                            <MenuItem value={100}>100</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">Page {page} of {totalPages}</Typography>
                        <Pagination count={totalPages} page={page} onChange={handlePageChange} color="primary" size="small" showFirstButton showLastButton disabled={totalPages <= 1} />
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Box>
        </PermissionCheck>
      </RouteGuard>

      <ConfirmationDialog
        open={openDeleteDialog}
        onClose={() => { setOpenDeleteDialog(false); setEntityToDelete(null) }}
        onConfirm={handleDeleteSale}
        title="Delete Sale"
        message="Are you sure you want to delete this sale? This action cannot be undone."
      />

      <ReadOnlyInvoiceView
        open={showItemsDialog}
        onClose={() => setShowItemsDialog(false)}
        sale={viewingSale}
        user={user}
        branches={branches || []}
        warehouses={warehouses || []}
      />

      {/* Legacy filter drawer — kept for filtered sales drawer view */}
      <Drawer
        anchor="bottom"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        sx={{ '& .MuiDrawer-paper': { height: '70vh', borderTopLeftRadius: 16, borderTopRightRadius: 16 } }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Filtered Sales Results
              <Badge badgeContent={filteredSales.length} color="primary" sx={{ ml: 2 }} />
            </Typography>
            <IconButton onClick={() => setFilterDrawerOpen(false)}><CloseIcon /></IconButton>
          </Box>
          <Divider sx={{ mb: 2 }} />
          {filteredSales.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">No sales found matching the selected filters.</Typography>
            </Box>
          ) : (
            <Box sx={{ height: 'calc(70vh - 120px)', overflow: 'auto' }}>
              <List>
                {filteredSales.map((sale, index) => {
                  const scopeType = sale.scope_type || sale.scopeType
                  const scopeId   = sale.scope_id   || sale.scopeId
                  const locName   = scopeType === 'WAREHOUSE'
                    ? (warehouses || []).find(w => w.id === scopeId || w.id === Number(scopeId))?.name || `Warehouse ${scopeId}`
                    : (branches   || []).find(b => b.id === scopeId || b.id === Number(scopeId))?.name  || `Branch ${scopeId}`
                  return (
                    <React.Fragment key={sale.id || index}>
                      <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                          <Typography variant="subtitle1" fontWeight="bold">Sale #{sale.receiptNumber || sale.id}</Typography>
                          <Typography variant="body2" fontWeight="bold">{locName}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', width: '100%' }}>
                          <ListItemText primary="Date"     secondary={new Date(sale.createdAt || sale.date).toLocaleDateString()} sx={{ minWidth: 100 }} />
                          <ListItemText primary="Time"     secondary={new Date(sale.createdAt || sale.date).toLocaleTimeString()}  sx={{ minWidth: 100 }} />
                          <ListItemText primary="Customer" secondary={resolveCustomerName(sale)} sx={{ minWidth: 120 }} />
                          <ListItemText primary="Total"    secondary={parseFloat(sale.total || 0).toFixed(2)} sx={{ minWidth: 100 }} />
                          <ListItemText primary="Payment"  secondary={sale.paymentMethod || 'Cash'} sx={{ minWidth: 100 }} />
                          <ListItemText primary="Location" secondary={locName} sx={{ minWidth: 150 }} />
                        </Box>
                        {sale.items && sale.items.length > 0 && (
                          <Box sx={{ mt: 1, width: '100%' }}>
                            <Typography variant="caption" color="text.secondary">
                              Items: {sale.items.map(i => `${i.name} (${i.quantity})`).join(', ')}
                            </Typography>
                          </Box>
                        )}
                      </ListItem>
                      {index < filteredSales.length - 1 && <Divider />}
                    </React.Fragment>
                  )
                })}
              </List>
            </Box>
          )}
        </Box>
      </Drawer>

      <Menu anchorEl={exportAnchorEl} open={Boolean(exportAnchorEl)} onClose={handleExportClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={exportToCSV}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>Export as CSV
        </MenuItem>
        <MenuItem onClick={exportToExcel}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>Export as Excel
        </MenuItem>
        <MenuItem onClick={exportToPDF}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>Export as PDF
        </MenuItem>
      </Menu>

      <EditableInvoiceForm
        open={showEditableInvoice}
        onClose={handleCloseEditableInvoice}
        sale={editingSale}
        onSave={handleSaveEditableInvoice}
        branches={branches || []}
        warehouses={warehouses || []}
      />
    </DashboardLayout>
  )
}

export default withAuth(SalesManagement)