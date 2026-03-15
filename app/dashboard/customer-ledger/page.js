'use client'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { 
  Box, Card, CardContent, Typography, TextField, Button, 
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Grid, Alert, CircularProgress,
  Pagination, Menu, ListItemIcon
} from '@mui/material'
import {
  Search as SearchIcon, Download as DownloadIcon, Visibility as ViewIcon,
  FilterList as FilterIcon, Refresh as RefreshIcon,
  ArrowUpward as ArrowUpIcon, ArrowDownward as ArrowDownIcon,
  Receipt as ReceiptIcon, GetApp as ExportIcon, Edit as EditIcon
} from '@mui/icons-material'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import api from '../../../utils/axios'
import { 
  fetchAllCustomersWithSummaries, fetchCustomerLedger, exportCustomerLedger,
  clearError, clearCurrentLedger, setCustomersPagination, setLedgerPagination
} from '../../store/slices/customerLedgerSlice'

function CustomerLedgerPage() {
  const dispatch = useDispatch()
  const { user: originalUser } = useSelector((state) => state.auth)

  // ── Admin simulation via URL params ──────────────────────────────────────
  // When admin navigates from AdminDashboard with ?role=...&scope=...&id=...
  // we create an effective user that behaves like that role/scope.
  // The axios interceptor already sends x-simulate-scope-type / x-simulate-scope-id
  // headers automatically from sessionStorage, so all API calls are scoped.
  const [urlParams,    setUrlParams]    = useState({})
  const [isAdminMode,  setIsAdminMode]  = useState(false)
  const [initialized,  setInitialized]  = useState(false) // wait for URL params before first fetch

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
      setInitialized(true) // ← mark ready after URL params are read
    }
  }, [originalUser])

  // Effective user: if in admin simulation mode, override role/scope fields
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
      scopeName: urlParams.scope === 'branch'
        ? `Branch ${urlParams.id}`
        : `Warehouse ${urlParams.id}`,
    }
  }, [isAdminMode, urlParams])

  // ── FIX: use useMemo so user/scopeInfo don't recalculate on every render ──
  const user      = useMemo(() => getEffectiveUser(originalUser), [getEffectiveUser, originalUser])
  const scopeInfo = useMemo(() => getScopeInfo(), [getScopeInfo])

  const { customers, currentCustomerLedger, loading, error, pagination } = useSelector((state) => state.customerLedger)

  const [searchTerm,        setSearchTerm]        = useState('')
  const [hasBalanceFilter,  setHasBalanceFilter]  = useState('all')
  const [customersPage,     setCustomersPage]     = useState(1)
  const [selectedCustomer,  setSelectedCustomer]  = useState(null)
  const [ledgerDialogOpen,  setLedgerDialogOpen]  = useState(false)
  const [ledgerFilters,     setLedgerFilters]     = useState({ startDate: '', endDate: '', transactionType: 'all', paymentMethod: 'all' })
  const [ledgerPage,        setLedgerPage]        = useState(1)
  const [sortField,         setSortField]         = useState('transaction_date')
  const [sortDirection,     setSortDirection]     = useState('asc')
  const [saleItemsDialogOpen, setSaleItemsDialogOpen] = useState(false)
  const [selectedSale,      setSelectedSale]      = useState(null)
  const [saleItems,         setSaleItems]         = useState([])
  const [loadingSaleItems,  setLoadingSaleItems]  = useState(false)
  const [exportAnchorEl,    setExportAnchorEl]    = useState(null)
  const [editDialogOpen,    setEditDialogOpen]    = useState(false)
  const [editingCustomer,   setEditingCustomer]   = useState(null)
  const [editForm,          setEditForm]          = useState({ name: '', phone: '' })
  const [editSaving,        setEditSaving]        = useState(false)
  const [editError,         setEditError]         = useState(null)
  const [canEditCustomer,   setCanEditCustomer]   = useState(false)
  const [canWhatsapp,       setCanWhatsapp]       = useState(false)
  const [whatsappLoading,   setWhatsappLoading]   = useState(false)

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getCustomerIdentifier = (customer) => {
    if (!customer) return ''
    return customer.customer_phone || customer.customer_name || ''
  }

  const getCustomerDisplayName = (customer) => {
    if (!customer) return ''
    return customer.customer_name || customer.customer_phone || 'Unknown Customer'
  }

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount || 0)

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const datePart = String(dateString).substring(0, 10)
    const parts = datePart.split('-')
    if (parts.length !== 3) return 'N/A'
    const [year, month, day] = parts
    return `${day}/${month}/${year}`
  }

  const getPaymentStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return 'success'
      case 'PARTIAL':   return 'warning'
      case 'PENDING':   return 'error'
      default:          return 'default'
    }
  }

  const getBalanceColor = (balance) => {
    if (balance > 0) return 'error'
    if (balance < 0) return 'success'
    return 'default'
  }

  // ── Load customers — includes scope params for simulation ─────────────────
  const loadCustomers = useCallback(() => {
    const params = {
      search:     searchTerm,
      hasBalance: hasBalanceFilter === 'all' ? undefined : hasBalanceFilter,
      limit:      20,
      offset:     (customersPage - 1) * 20,
      _t:         Date.now(),
    }
    // Scope params: admin simulation takes priority, then regular role
    if (isAdminMode && urlParams.scope && urlParams.id) {
      params.scopeType = urlParams.scope === 'branch' ? 'BRANCH' : 'WAREHOUSE'
      params.scopeId   = urlParams.id
    } else if (user?.role === 'CASHIER' && user?.branchId) {
      params.scopeType = 'BRANCH'
      params.scopeId   = String(user.branchId)
    } else if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      params.scopeType = 'WAREHOUSE'
      params.scopeId   = String(user.warehouseId)
    }
    dispatch(fetchAllCustomersWithSummaries(params))
  }, [dispatch, customersPage, searchTerm, hasBalanceFilter, user, isAdminMode, urlParams])

  // ── FIX: guard with initialized so we don't fetch before URL params are read
  useEffect(() => {
    if (!initialized) return
    loadCustomers()
  }, [loadCustomers, initialized])

  // ── Permission checks ──────────────────────────────────────────────────────
  useEffect(() => {
    const checkPermissions = async () => {
      if (!user) return
      // Admin (real or simulated) always has full permissions
      if (user.role === 'ADMIN' || originalUser?.role === 'ADMIN') {
        setCanEditCustomer(true)
        setCanWhatsapp(true)
        return
      }
      try {
        if (user.role === 'CASHIER' && user.branchId) {
          const res = await api.get(`/branches/${user.branchId}/settings`)
          const s = res.data?.data?.settings || {}
          setCanEditCustomer(!!s.allowCashierCustomerEdit)
          setCanWhatsapp(!!s.allowWhatsappLedger)
        } else if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId) {
          const res = await api.get(`/warehouses/${user.warehouseId}/settings`)
          const s = res.data?.data?.settings || {}
          setCanEditCustomer(!!s.allowRetailerCustomerEdit)
          setCanWhatsapp(!!s.allowWhatsappLedger)
        }
      } catch {
        setCanEditCustomer(false)
        setCanWhatsapp(false)
      }
    }
    checkPermissions()
  }, [user?.role, user?.branchId, user?.warehouseId, originalUser?.role])

  const loadCustomerLedger = useCallback((customerId) => {
    dispatch(fetchCustomerLedger({
      customerId,
      params: { ...ledgerFilters, limit: 50, offset: (ledgerPage - 1) * 50 }
    }))
  }, [dispatch, ledgerFilters, ledgerPage])

  const handleSearch = () => { setCustomersPage(1); loadCustomers() }

  const handleViewLedger = (customer) => {
    const identifier = getCustomerIdentifier(customer)
    setSelectedCustomer({ ...customer, id: identifier })
    setLedgerDialogOpen(true)
    setLedgerPage(1)
    loadCustomerLedger(identifier)
  }

  const handleViewAllLedger = () =>
    window.open('/dashboard/customer-ledger/all-ledger', '_blank', 'width=1400,height=900')

  const handleViewDetailedLedger = (customer) => {
    const identifier = getCustomerIdentifier(customer)
    if (!identifier) { alert('Detailed view is only available for individual customers.'); return }
    const displayName = encodeURIComponent(customer.customer_name || identifier)
    window.open(
      `/dashboard/customer-ledger/detailed/${encodeURIComponent(identifier)}?name=${displayName}`,
      '_blank'
    )
  }

  const handleExportLedger = (customerId, format = 'pdf', detailed = false) => {
    if (!customerId) return
    dispatch(exportCustomerLedger({
      customerId,
      params: { ...ledgerFilters, format, detailed: detailed.toString() }
    }))
  }

  const handleExportClick  = (event) => setExportAnchorEl(event.currentTarget)
  const handleExportClose  = () => setExportAnchorEl(null)

  const handleExportAction = (format, detailed = false) => {
    const customerId = getCustomerIdentifier(selectedCustomer)
    if (!customerId) { handleExportClose(); return }
    dispatch(exportCustomerLedger({
      customerId,
      params: { ...ledgerFilters, format, detailed: detailed.toString() }
    }))
    handleExportClose()
  }

  const handleOpenEditDialog = (customer) => {
    setEditingCustomer(customer)
    setEditForm({ name: customer.customer_name || '', phone: customer.customer_phone || '' })
    setEditError(null)
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingCustomer) return
    const customerId = getCustomerIdentifier(editingCustomer)
    if (!customerId) return
    setEditSaving(true)
    setEditError(null)
    try {
      await api.put(
        `/customer-ledger/${encodeURIComponent(customerId)}/update-info`,
        { name: editForm.name, phone: editForm.phone }
      )
      setEditDialogOpen(false)
      loadCustomers()
    } catch (err) {
      setEditError(err?.response?.data?.message || 'Failed to update customer info')
    } finally {
      setEditSaving(false)
    }
  }

  const handleManualRefresh = useCallback(() => {
    loadCustomers()
    if (selectedCustomer && ledgerDialogOpen) {
      const identifier = getCustomerIdentifier(selectedCustomer)
      if (identifier) loadCustomerLedger(identifier)
    }
  }, [loadCustomers, selectedCustomer, ledgerDialogOpen, loadCustomerLedger])

  // ── WhatsApp share ────────────────────────────────────────────────────────
  const handleWhatsappShare = async (customer, filtersOverride = null) => {
    const identifier = getCustomerIdentifier(customer)
    if (!identifier) return
    setWhatsappLoading(true)
    try {
      const activeFilters = filtersOverride || ledgerFilters

      const exportParams = new URLSearchParams({ format: 'pdf', detailed: 'true', limit: '1000' })
      if (activeFilters.startDate) exportParams.append('startDate', activeFilters.startDate)
      if (activeFilters.endDate)   exportParams.append('endDate',   activeFilters.endDate)
      if (activeFilters.transactionType && activeFilters.transactionType !== 'all')
        exportParams.append('transactionType', activeFilters.transactionType)
      if (activeFilters.paymentMethod && activeFilters.paymentMethod !== 'all')
        exportParams.append('paymentMethod', activeFilters.paymentMethod)

      const exportRes = await api.get(
        `/customer-ledger/${encodeURIComponent(identifier)}/export?${exportParams.toString()}`,
        { responseType: 'text' }
      )

      // Auto-download as HTML file
      const customerName  = customer.customer_name || customer.customer_phone || identifier
      const safeFileName  = customerName.replace(/[^a-zA-Z0-9]/g, '_')
      const dateStr       = new Date().toISOString().split('T')[0]
      const blob          = new Blob([exportRes.data], { type: 'text/html' })
      const downloadUrl   = URL.createObjectURL(blob)
      const link          = document.createElement('a')
      link.href           = downloadUrl
      link.download       = `Ledger_${safeFileName}_${dateStr}.html`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)

      // Short WhatsApp summary message
      const ledgerRes    = await api.get(`/customer-ledger/${encodeURIComponent(identifier)}?limit=1&offset=0`)
      const summary      = ledgerRes.data?.data?.summary    || {}
      const customerInfo = ledgerRes.data?.data?.customer   || {}
      const custName     = customerInfo.name  || customerInfo.customer_name  || customer.customer_name  || 'Customer'
      const custPhone    = customerInfo.phone || customerInfo.customer_phone || customer.customer_phone || ''
      const from         = activeFilters.startDate ? formatDate(activeFilters.startDate) : 'All Time'
      const to           = activeFilters.endDate   ? formatDate(activeFilters.endDate)   : 'Today'
      const period       = (activeFilters.startDate || activeFilters.endDate) ? `${from} - ${to}` : 'All Time'

      const message = [
        `*CUSTOMER LEDGER*`,
        `---------------------------`,
        `Customer: ${custName}`,
        custPhone ? `Phone: ${custPhone}` : null,
        `Period: ${period}`,
        `---------------------------`,
        `Total Amount:  ${formatCurrency(summary.totalAmount        || 0)}`,
        `Total Paid:    ${formatCurrency(summary.totalPaid          || 0)}`,
        `*Outstanding:  ${formatCurrency(summary.outstandingBalance || 0)}*`,
        `---------------------------`,
        `(Full detailed ledger attached)`,
        `Sent via POS System - ${new Date().toLocaleDateString()}`,
      ].filter(Boolean).join('\n')

      const encodedMsg = encodeURIComponent(message)
      setTimeout(() => {
        window.open(`https://web.whatsapp.com/send?text=${encodedMsg}`, '_blank')
      }, 500)
    } catch (err) {
      console.error('WhatsApp share error:', err)
      alert(err?.response?.data?.message || 'Failed to prepare WhatsApp share')
    } finally {
      setWhatsappLoading(false)
    }
  }

  // ── Ledger helpers ────────────────────────────────────────────────────────
  const calculateSummaryTotals = () => {
    if (!currentCustomerLedger?.transactions)
      return { totalTransactions: 0, totalAmount: 0, totalPaid: 0, totalCredit: 0, outstandingBalance: 0 }

    if (currentCustomerLedger.summary) {
      return {
        totalTransactions: currentCustomerLedger.summary.totalTransactions,
        totalAmount:        currentCustomerLedger.summary.totalAmount,
        totalPaid:          currentCustomerLedger.summary.totalPaid,
        totalRefunded:      currentCustomerLedger.summary.totalRefunded ?? 0,
        netPaid:            currentCustomerLedger.summary.netPaid ?? currentCustomerLedger.summary.totalPaid,
        totalCredit:        currentCustomerLedger.summary.totalCredit,
        outstandingBalance: currentCustomerLedger.summary.outstandingBalance,
      }
    }

    const transactions = currentCustomerLedger.transactions
    const totals = transactions.reduce((acc, t) => {
      const currentAmount = parseFloat(t.amount || 0)
      let correctedPaid = 0
      if (t.payment_method === 'FULLY_CREDIT' && t.payment_type !== 'OUTSTANDING_SETTLEMENT')
        correctedPaid = 0
      else if (t.payment_type === 'OUTSTANDING_SETTLEMENT' || t.transaction_type === 'SETTLEMENT')
        correctedPaid = parseFloat(t.payment_amount || t.paid_amount || 0) || 0
      else
        correctedPaid = parseFloat(t.paid_amount || t.payment_amount || 0) || 0
      return {
        totalTransactions: acc.totalTransactions + 1,
        totalAmount:        acc.totalAmount + currentAmount,
        totalPaid:          acc.totalPaid + Math.max(correctedPaid, 0),
        totalRefunded:      correctedPaid < 0 ? acc.totalRefunded + Math.abs(correctedPaid) : acc.totalRefunded,
        netPaid:            acc.netPaid + correctedPaid,
        totalCredit:        acc.totalCredit,
      }
    }, { totalTransactions: 0, totalAmount: 0, totalPaid: 0, totalRefunded: 0, netPaid: 0, totalCredit: 0 })

    const sorted = [...transactions].sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date))
    return {
      ...totals,
      outstandingBalance: sorted.length > 0 ? parseFloat(sorted[0].running_balance || 0) : 0,
    }
  }

  const handleSort = (field) => {
    if (field === 'transaction_date') {
      setSortField(field)
      setSortDirection('asc')
    } else {
      sortField === field
        ? setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
        : (setSortField(field), setSortDirection('asc'))
    }
  }

  const getSortIcon = (field) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? <ArrowUpIcon fontSize="small" /> : <ArrowDownIcon fontSize="small" />
  }

  const sortTransactions = (transactions) => {
    if (!transactions || transactions.length === 0) return transactions
    return [...transactions].sort((a, b) => {
      let aValue, bValue
      switch (sortField) {
        case 'transaction_date': aValue = new Date(a.transaction_date); bValue = new Date(b.transaction_date); break
        case 'invoice_no':       aValue = a.invoice_no      || ''; bValue = b.invoice_no      || ''; break
        case 'amount':           aValue = parseFloat(a.amount      || 0); bValue = parseFloat(b.amount      || 0); break
        case 'balance':          aValue = parseFloat(a.balance     || 0); bValue = parseFloat(b.balance     || 0); break
        case 'payment_method':   aValue = a.payment_method  || ''; bValue = b.payment_method  || ''; break
        case 'status':           aValue = a.payment_status  || ''; bValue = b.payment_status  || ''; break
        default: return 0
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ?  1 : -1
      return 0
    })
  }

  const handleLedgerFilterChange = () => {
    setLedgerPage(1)
    const identifier = getCustomerIdentifier(selectedCustomer)
    if (identifier) loadCustomerLedger(identifier)
  }

  const fetchSaleItems = async (transactionId, transaction = null) => {
    setLoadingSaleItems(true)
    try {
      const isReturn =
        transaction?.transaction_type === 'RETURN' ||
        transaction?.return_id ||
        (transaction?.invoice_no && transaction.invoice_no.startsWith('RET-'))

      const response = isReturn
        ? await api.get(`/sales/returns/${transaction?.return_id || transactionId}`)
        : await api.get(`/sales/${transactionId}`)

      if (response.data.success) {
        setSelectedSale(response.data.data)
        setSaleItems(response.data.data.items || [])
        setSaleItemsDialogOpen(true)
      } else {
        alert('Failed to load transaction details')
      }
    } catch (error) {
      console.error('Error loading transaction details:', error)
      alert('Failed to load transaction details')
    } finally {
      setLoadingSaleItems(false)
    }
  }

  const summaryTotals = calculateSummaryTotals()

  const renderCustomerLedger = () => {
    const transactions = currentCustomerLedger?.transactions || []
    const totalRecords = currentCustomerLedger?.pagination?.total || 0
    return (
      <>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                {[
                  ['transaction_date', 'Date'],
                  ['invoice_no',       'Invoice'],
                  ['amount',           'Amount'],
                  [null,               'Old Balance'],
                  ['total_amount',     'Total Amount'],
                  ['paid_amount',      'Payment'],
                  ['payment_method',   'Payment Method'],
                  ['status',           'Status'],
                  ['balance',          'Balance'],
                  [null,               'Actions'],
                ].map(([field, label], i) => (
                  <TableCell
                    key={i}
                    sx={field ? { cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' } } : {}}
                    onClick={field ? () => handleSort(field) : undefined}
                  >
                    {field
                      ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{label} {getSortIcon(field)}</Box>
                      : label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortTransactions(transactions)?.map((transaction, index) => {
                const currentAmount = parseFloat(transaction.subtotal || transaction.amount || transaction.total || 0)
                const oldBalance    = parseFloat(transaction.old_balance || transaction.previous_balance || 0)
                const totalAmount   = parseFloat(transaction.total_amount || transaction.total || 0)
                let correctedPaid = 0
                if (transaction.payment_method === 'FULLY_CREDIT' && transaction.payment_type !== 'OUTSTANDING_SETTLEMENT')
                  correctedPaid = 0
                else if (transaction.payment_type === 'OUTSTANDING_SETTLEMENT' || transaction.transaction_type === 'SETTLEMENT')
                  correctedPaid = parseFloat(transaction.payment_amount || transaction.paid_amount || 0) || 0
                else
                  correctedPaid = parseFloat(transaction.paid_amount || transaction.payment_amount || 0) || 0
                const balance = parseFloat(transaction.running_balance || transaction.balance || (totalAmount - correctedPaid))
                return (
                  <TableRow key={transaction.transaction_id || index}>
                    <TableCell>{formatDate(transaction.transaction_date)}</TableCell>
                    <TableCell>{transaction.invoice_no}</TableCell>
                    <TableCell>{formatCurrency(currentAmount)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="warning.main" fontWeight="medium">
                        {formatCurrency(oldBalance)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="primary.main" fontWeight="bold">
                        {formatCurrency(totalAmount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="success.main" fontWeight="medium">
                        {formatCurrency(correctedPaid)}
                      </Typography>
                    </TableCell>
                    <TableCell>{transaction.payment_method}</TableCell>
                    <TableCell>
                      <Chip
                        label={transaction.payment_status_display}
                        color={getPaymentStatusColor(transaction.payment_status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color={balance < 0 ? 'success.main' : 'error.main'} fontWeight="medium">
                        {formatCurrency(balance)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={transaction.transaction_type === 'RETURN' ? 'View Return Items' : 'View Sale Items'}>
                        <IconButton
                          size="small"
                          onClick={() => fetchSaleItems(transaction.transaction_id, transaction)}
                          color="primary"
                          disabled={loadingSaleItems}
                        >
                          <ReceiptIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {transactions.length > 0 && (
          <Box sx={{ mt: 2, mb: 2 }}>
            <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
              <Grid container spacing={2}>
                {[
                  ['Total Transactions', summaryTotals.totalTransactions,                    'primary'],
                  ['Total Amount',       formatCurrency(summaryTotals.totalAmount),           'text.primary'],
                  ['Total Paid',         formatCurrency(summaryTotals.totalPaid),             'success.main'],
                  ['Outstanding Balance',formatCurrency(summaryTotals.outstandingBalance),    'error.main'],
                ].map(([label, value, color], i) => (
                  <Grid item xs={12} sm={3} key={i}>
                    <Typography variant="subtitle2" color="text.secondary">{label}</Typography>
                    <Typography variant="h6" color={color}>{value}</Typography>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Box>
        )}

        {totalRecords > 50 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination
              count={Math.ceil(totalRecords / 50)}
              page={ledgerPage}
              color="primary"
              onChange={(event, page) => {
                setLedgerPage(page)
                const id = getCustomerIdentifier(selectedCustomer)
                if (id) loadCustomerLedger(id)
              }}
            />
          </Box>
        )}
      </>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <RouteGuard allowedRoles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
      <DashboardLayout>

        {/* Admin simulation banner */}
        {isAdminMode && scopeInfo && (
          <Box sx={{
            bgcolor: 'warning.light', color: 'warning.contrastText',
            p: 1, textAlign: 'center', borderBottom: 1, borderColor: 'warning.main', mb: 2,
          }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              🔧 ADMIN MODE: Operating as {scopeInfo.scopeType === 'BRANCH' ? 'Cashier' : 'Warehouse Keeper'} for {scopeInfo.scopeName}
            </Typography>
          </Box>
        )}

        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h4" component="h1">Customer Ledger</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button variant="contained" startIcon={<ViewIcon />} size="small" onClick={handleViewAllLedger}>
                  See All Ledger
                </Button>
                <Tooltip title="Refresh customer data">
                  <IconButton onClick={handleManualRefresh} size="small"><RefreshIcon /></IconButton>
                </Tooltip>
              </Box>
            </Box>
            <Typography variant="body1" color="text.secondary">
              {user?.role === 'ADMIN'
                ? 'View comprehensive customer transaction history across all branches and warehouses'
                : user?.role === 'CASHIER'
                ? 'View customer transaction history for your branch'
                : 'View retailer transaction history for your warehouse'}
            </Typography>
          </Box>

          {/* Filters */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth label="Search Customer" value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Name or phone number"
                    InputProps={{ endAdornment: (<IconButton onClick={handleSearch}><SearchIcon /></IconButton>) }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Balance Filter</InputLabel>
                    <Select
                      value={hasBalanceFilter}
                      onChange={(e) => { setHasBalanceFilter(e.target.value); setCustomersPage(1) }}
                      label="Balance Filter"
                    >
                      <MenuItem value="all">All Customers</MenuItem>
                      <MenuItem value="true">With Outstanding Balance</MenuItem>
                      <MenuItem value="false">No Outstanding Balance</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button fullWidth variant="outlined" startIcon={<RefreshIcon />}
                    onClick={loadCustomers} disabled={loading}>
                    Refresh
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => dispatch(clearError())}>
              {error}
            </Alert>
          )}

          {/* Customers Table */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Customers ({pagination.customers.total})
              </Typography>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
              ) : (
                <>
                  <TableContainer component={Paper} sx={{ mt: 2 }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Last Transaction</TableCell>
                          <TableCell>Customer Name</TableCell>
                          <TableCell>Phone</TableCell>
                          <TableCell>Total Transactions</TableCell>
                          <TableCell>Total Amount</TableCell>
                          <TableCell>Total Paid</TableCell>
                          <TableCell>Current Balance</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {customers && customers.length > 0
                          ? customers.map((customer, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                {customer.last_transaction_date ? formatDate(customer.last_transaction_date) : 'N/A'}
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">
                                  {customer.customer_name || 'N/A'}
                                </Typography>
                              </TableCell>
                              <TableCell>{customer.customer_phone || 'N/A'}</TableCell>
                              <TableCell>{customer.total_transactions}</TableCell>
                              <TableCell>{formatCurrency(customer.total_amount || 0)}</TableCell>
                              <TableCell>{formatCurrency(customer.total_paid   || 0)}</TableCell>
                              <TableCell>
                                <Chip
                                  label={formatCurrency(customer.current_balance || 0)}
                                  color={getBalanceColor(customer.current_balance || 0)}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Tooltip title="View Ledger">
                                  <IconButton size="small" onClick={() => handleViewLedger(customer)} color="primary">
                                    <ViewIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="View Detailed Ledger">
                                  <IconButton size="small" onClick={() => handleViewDetailedLedger(customer)} color="info">
                                    <ReceiptIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Export PDF">
                                  <IconButton size="small"
                                    onClick={() => handleExportLedger(getCustomerIdentifier(customer))}
                                    color="secondary">
                                    <DownloadIcon />
                                  </IconButton>
                                </Tooltip>
                                {canWhatsapp && (
                                  <Tooltip title="Share Full Ledger via WhatsApp">
                                    <IconButton
                                      size="small"
                                      onClick={() => handleWhatsappShare(customer, { startDate: '', endDate: '', transactionType: 'all' })}
                                      disabled={whatsappLoading}
                                      sx={{ color: '#25D366', '&:hover': { backgroundColor: 'rgba(37,211,102,0.08)' } }}
                                    >
                                      {whatsappLoading ? <CircularProgress size={16} /> : <WhatsAppIcon fontSize="small" />}
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {canEditCustomer && (
                                  <Tooltip title="Edit Customer Info">
                                    <IconButton size="small" onClick={() => handleOpenEditDialog(customer)} color="warning">
                                      <EditIcon />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                          : (
                            <TableRow>
                              <TableCell colSpan={8} align="center">
                                <Typography variant="body2" color="text.secondary">
                                  {loading ? 'Loading customers...' : 'No customers found'}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {pagination.customers.total > 20 && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                      <Pagination
                        count={Math.ceil(pagination.customers.total / 20)}
                        page={customersPage}
                        onChange={(event, page) => setCustomersPage(page)}
                        color="primary"
                      />
                    </Box>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Ledger Dialog ──────────────────────────────────────────────── */}
          <Dialog
            open={ledgerDialogOpen}
            onClose={() => { setLedgerDialogOpen(false); dispatch(clearCurrentLedger()) }}
            maxWidth="lg" fullWidth
          >
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  Customer Ledger: {getCustomerDisplayName(selectedCustomer)}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {canWhatsapp && (
                    <Tooltip title="Share Filtered Ledger via WhatsApp (includes all invoice items)">
                      <IconButton
                        onClick={() => handleWhatsappShare(selectedCustomer, ledgerFilters)}
                        disabled={whatsappLoading}
                        sx={{ color: '#25D366', '&:hover': { backgroundColor: 'rgba(37,211,102,0.08)' } }}
                      >
                        {whatsappLoading ? <CircularProgress size={20} /> : <WhatsAppIcon />}
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Refresh data">
                    <IconButton onClick={handleManualRefresh} size="small"><RefreshIcon /></IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              {currentCustomerLedger && (
                <>
                  <Box sx={{ mb: 3 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={3}>
                        <TextField fullWidth label="Start Date" type="date"
                          value={ledgerFilters.startDate}
                          onChange={(e) => setLedgerFilters({ ...ledgerFilters, startDate: e.target.value })}
                          InputLabelProps={{ shrink: true }} />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField fullWidth label="End Date" type="date"
                          value={ledgerFilters.endDate}
                          onChange={(e) => setLedgerFilters({ ...ledgerFilters, endDate: e.target.value })}
                          InputLabelProps={{ shrink: true }} />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <FormControl fullWidth>
                          <InputLabel>Transaction Type</InputLabel>
                          <Select
                            value={ledgerFilters.transactionType}
                            onChange={(e) => setLedgerFilters({ ...ledgerFilters, transactionType: e.target.value })}
                            label="Transaction Type"
                          >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="COMPLETED">Paid</MenuItem>
                            <MenuItem value="PARTIAL">Partial Payment</MenuItem>
                            <MenuItem value="PENDING">Credit</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <Button fullWidth variant="contained" startIcon={<FilterIcon />}
                          onClick={handleLedgerFilterChange}>
                          Apply Filters
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                  {renderCustomerLedger()}
                </>
              )}
            </DialogContent>
            <DialogActions>
              <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExportClick}
                sx={{ minWidth: 120 }} disabled={!selectedCustomer}>
                Export
              </Button>
              <Button onClick={() => setLedgerDialogOpen(false)}>Close</Button>
            </DialogActions>
          </Dialog>

          {/* ── Sale Items Dialog ──────────────────────────────────────────── */}
          <Dialog open={saleItemsDialogOpen} onClose={() => setSaleItemsDialogOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Sale Items - {selectedSale?.invoice_no || 'N/A'}</Typography>
                <Button onClick={() => setSaleItemsDialogOpen(false)}>Close</Button>
              </Box>
            </DialogTitle>
            <DialogContent>
              {loadingSaleItems ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
              ) : saleItems.length > 0 ? (
                <TableContainer component={Paper} sx={{ mt: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item Name</TableCell>
                        <TableCell>SKU</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Unit Price</TableCell>
                        <TableCell align="right">Discount</TableCell>
                        <TableCell align="right">Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {saleItems.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.itemName || item.name || 'N/A'}</TableCell>
                          <TableCell>{item.sku || 'N/A'}</TableCell>
                          <TableCell align="right">{item.quantity  || 0}</TableCell>
                          <TableCell align="right">{parseFloat(item.unitPrice || 0).toFixed(2)}</TableCell>
                          <TableCell align="right">{parseFloat(item.discount  || 0).toFixed(2)}</TableCell>
                          <TableCell align="right">{parseFloat(item.total     || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body1" color="text.secondary">No items found for this sale.</Typography>
                </Box>
              )}
            </DialogContent>
          </Dialog>

          {/* ── Export Menu ────────────────────────────────────────────────── */}
          <Menu
            anchorEl={exportAnchorEl} open={Boolean(exportAnchorEl)} onClose={handleExportClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top',    horizontal: 'right' }}
          >
            <MenuItem onClick={() => handleExportAction('pdf',   false)}><ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>Export as PDF</MenuItem>
            <MenuItem onClick={() => handleExportAction('pdf',   true)} ><ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>Detailed PDF</MenuItem>
            <MenuItem onClick={() => handleExportAction('excel', false)}><ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>Export as Excel</MenuItem>
            <MenuItem onClick={() => handleExportAction('excel', true)} ><ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>Detailed Excel</MenuItem>
          </Menu>

          {/* ── Edit Customer Dialog ───────────────────────────────────────── */}
          <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Edit Customer Info</DialogTitle>
            <DialogContent>
              {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
              <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Customer Name" fullWidth
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                />
                <TextField
                  label="Phone Number" fullWidth
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={handleSaveEdit} disabled={editSaving}>
                {editSaving ? <CircularProgress size={20} /> : 'Save'}
              </Button>
            </DialogActions>
          </Dialog>

        </Box>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default withAuth(CustomerLedgerPage)