'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import EntityFormDialog from '../../../components/crud/EntityFormDialog'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import { usePermissions } from '../../../hooks/usePermissions'
import { fetchReturns, createReturn, updateReturn, deleteReturn } from '../../store/slices/returnsSlice'
import { fetchInventory } from '../../store/slices/inventorySlice'
import { fetchWarehouseSettings } from '../../store/slices/warehousesSlice'
import { fetchBranchSettings } from '../../store/slices/branchesSlice'
import api from '../../../utils/axios'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  InputAdornment,
  Pagination,
  Paper,
  Autocomplete,
} from '@mui/material'
import {
  Add,
  Refresh,
  Receipt,
  TrendingDown,
  Delete,
  Edit,
  Search,
  Clear,
  FilterList,
  Visibility as ViewIcon,
  Inventory as RestockIcon,
} from '@mui/icons-material'
import * as yup from 'yup'

const ReturnsPage = () => {
  const dispatch = useDispatch()

  // ── Auth: original Redux user ─────────────────────────────────────────────
  const { user: originalUser } = useSelector((state) => state.auth)
  const { data: returns, total: totalReturnsCount, loading, error } = useSelector((state) => state.returns)
  const { warehouseSettings } = useSelector((state) => state.warehouses || { warehouseSettings: null })
  const { branchSettings }    = useSelector((state) => state.branches  || { branchSettings: null })

  // ── Admin simulation via URL params ──────────────────────────────────────
  // When admin navigates from AdminDashboard with ?role=...&scope=...&id=...
  // we create an effective user that behaves like that role/scope.
  // The axios interceptor already injects simulation headers from sessionStorage.
  const [urlParams,   setUrlParams]   = useState({})
  const [isAdminMode, setIsAdminMode] = useState(false)
  const [initialized, setInitialized] = useState(false) // wait before first fetch

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

  // Effective user: if in admin simulation mode, override role/scope fields
  const user = useMemo(() => {
    if (!isAdminMode || !urlParams.role) return originalUser
    return {
      ...originalUser,
      role:          urlParams.role.toUpperCase(),
      branchId:      urlParams.scope === 'branch'    ? parseInt(urlParams.id) : null,
      warehouseId:   urlParams.scope === 'warehouse' ? parseInt(urlParams.id) : null,
      branchName:    urlParams.scope === 'branch'    ? `Branch ${urlParams.id}`    : null,
      warehouseName: urlParams.scope === 'warehouse' ? `Warehouse ${urlParams.id}` : null,
      isAdminMode:   true,
      originalRole:  originalUser.role,
      originalUser:  originalUser,
    }
  }, [isAdminMode, urlParams, originalUser])

  // Scope info for display banner
  const scopeInfo = useMemo(() => {
    if (!isAdminMode || !urlParams.role) return null
    return {
      scopeType: urlParams.scope === 'branch' ? 'BRANCH' : 'WAREHOUSE',
      scopeId:   urlParams.id,
      scopeName: urlParams.scope === 'branch'
        ? `Branch ${urlParams.id}`
        : `Warehouse ${urlParams.id}`,
    }
  }, [isAdminMode, urlParams])

  // isActualAdmin — use originalUser so permissions work correctly during simulation
  const isActualAdmin = originalUser?.role === 'ADMIN'

  // Toast state for permission/validation feedback
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' })
  const showToast = useCallback((message, severity = 'info') => {
    setToast({ open: true, message, severity })
  }, [])
  const handleToastClose = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }))
  }, [])

  // Check if user can manage returns based on role and settings
  // isActualAdmin always has full access even during simulation
  const canManageReturns = isActualAdmin || user?.role === 'ADMIN' ||
    (user?.role === 'WAREHOUSE_KEEPER' && warehouseSettings?.allowWarehouseReturns) ||
    (user?.role === 'CASHIER'          && branchSettings?.allowCashierReturns)

  const [filters, setFilters] = useState({
    status: 'all',
    dateRange: '7days',
    search: ''
  })

  const columns = [
    { field: 'return_no', headerName: 'Return #', width: 120 },
    { field: 'invoice_no', headerName: 'Original Invoice', width: 150 },
    { field: 'reason', headerName: 'Reason', width: 150 },
    { field: 'total_refund', headerName: 'Refund Amount', width: 120, renderCell: (params) => `${params.value || 0}` },
    { 
      field: 'restock_status',
      headerName: 'Restock',
      width: 80,
      renderCell: (params) => {
        const pending = (parseFloat(params.row.remaining_total) || 0) > 0
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: pending ? 'warning.main' : 'success.main' }} />
            <Typography variant="caption" color="text.secondary">
              {pending ? 'Pending' : 'Done'}
            </Typography>
          </Box>
        )
      }
    },
    { 
      field: 'status', 
      headerName: 'Status', 
      width: 120,
      renderCell: (params) => (
        <Chip 
          label={params.value || 'pending'} 
          color={
            params.value === 'completed' ? 'success' :
            params.value === 'approved'  ? 'primary' :
            params.value === 'pending'   ? 'warning' : 'error'
          }
          size="small"
        />
      )
    },
    { field: 'created_at', headerName: 'Return Date', width: 120, renderCell: (params) => new Date(params.value).toLocaleDateString() },
    { field: 'username', headerName: 'Processed By', width: 150 },
    { 
      field: 'scope_type', 
      headerName: 'Location', 
      width: 120,
      renderCell: (params) => {
        const row = params.row
        if (row.scope_type === 'BRANCH')    return row.branch_name    || `Branch ${row.scope_id}`
        if (row.scope_type === 'WAREHOUSE') return row.warehouse_name || `Warehouse ${row.scope_id}`
        return row.branch_name || row.warehouse_name || 'Unknown'
      }
    },
  ]

  const validationSchema = yup.object({
    saleId: yup.number().required('Sale ID is required').min(1, 'Sale ID must be valid'),
    reason: yup.string().required('Reason is required').max(500, 'Reason cannot exceed 500 characters'),
    notes: yup.string().max(500, 'Notes cannot exceed 500 characters'),
    items: yup.array().min(1, 'At least one item is required').of(
      yup.object({
        productName:  yup.string().required('Product name is required'),
        quantity:     yup.number().required('Quantity is required').min(0.01, 'Quantity must be greater than 0'),
        refundAmount: yup.number().required('Refund amount is required').min(0, 'Refund amount must be positive'),
      })
    ),
  })

  const formFields = [
    { name: 'saleId', label: 'Sale ID', type: 'number', required: true },
    { 
      name: 'reason', 
      label: 'Reason', 
      type: 'select', 
      required: true,
      options: [
        { value: 'defective',        label: 'Defective' },
        { value: 'changed_mind',     label: 'Changed Mind' },
        { value: 'wrong_model',      label: 'Wrong Model' },
        { value: 'damaged_shipping', label: 'Damaged in Shipping' },
        { value: 'other',            label: 'Other' }
      ]
    },
    { name: 'notes', label: 'Notes', type: 'textarea', required: false },
  ]

  // Dialog state management
  const [openDialog,       setOpenDialog]       = useState(false)
  const [editingEntity,    setEditingEntity]    = useState(null)
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false)
  const [entityToDelete,   setEntityToDelete]   = useState(null)

  // View details dialog state
  const [viewDetailsDialog, setViewDetailsDialog] = useState(false)
  const [selectedReturn,    setSelectedReturn]    = useState(null)
  const [returnDetails,     setReturnDetails]     = useState(null)
  const [loadingDetails,    setLoadingDetails]    = useState(false)

  // Filter states
  const [searchTerm,   setSearchTerm]   = useState('')
  const [reasonFilter, setReasonFilter] = useState('all')
  const [sortBy,       setSortBy]       = useState('created_at')
  const [sortOrder,    setSortOrder]    = useState('desc')

  // Pagination states
  const [page,        setPage]        = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  // Return form state
  const [returnForm, setReturnForm] = useState({
    saleId: '',
    reason: '',
    notes: '',
    items: [{ productName: '', quantity: 1, refundAmount: 0 }]
  })

  // Product search state
  const [productSearchResults, setProductSearchResults] = useState({})
  const [productSearchLoading, setProductSearchLoading] = useState({})

  // Invoice search state
  const [invoiceSearchLoading, setInvoiceSearchLoading] = useState(false)
  const [invoiceItems,         setInvoiceItems]         = useState([])
  const [selectedInvoice,      setSelectedInvoice]      = useState(null)

  // Restock functionality state
  const [restockDialog,           setRestockDialog]           = useState(false)
  const [selectedItemForRestock,  setSelectedItemForRestock]  = useState(null)
  const [restockQuantity,         setRestockQuantity]         = useState(0)
  const [restockLoading,          setRestockLoading]          = useState(false)

  // ── Scope params — uses effective user (simulation-aware) ─────────────────
  const getScopeParams = useCallback(() => {
    const params = {}
    // When in admin simulation mode, use the simulated scope
    if (isAdminMode && urlParams.scope && urlParams.id) {
      params.scopeType = urlParams.scope === 'branch' ? 'BRANCH' : 'WAREHOUSE'
      params.scopeId   = parseInt(urlParams.id)
      return params
    }
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      params.scopeType = 'WAREHOUSE'
      params.scopeId   = user.warehouseId
    } else if (user?.role === 'CASHIER' && user?.branchId) {
      params.scopeType = 'BRANCH'
      params.scopeId   = user.branchId
    }
    return params
  }, [user, isAdminMode, urlParams])

  const buildFetchParams = useCallback(() => {
    const params = { page, limit: rowsPerPage }
    if (searchTerm)                        params.search = searchTerm
    if (reasonFilter && reasonFilter !== 'all') params.reason = reasonFilter
    Object.assign(params, getScopeParams())
    return params
  }, [page, rowsPerPage, searchTerm, reasonFilter, getScopeParams])

  // ── Load returns — guarded with initialized ───────────────────────────────
  useEffect(() => {
    if (!initialized) return // wait for URL params to be read first

    dispatch(fetchReturns(buildFetchParams()))

    // Load warehouse settings for warehouse keepers (real or simulated)
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
    }
    // Load branch settings for cashiers (real or simulated)
    if (user?.role === 'CASHIER' && user?.branchId) {
      dispatch(fetchBranchSettings(user.branchId))
    }
  }, [dispatch, user, buildFetchParams, initialized])

  const handleCreate = (data) => {
    dispatch(createReturn(data))
    setOpenDialog(false)
  }

  // Handle view return details
  const handleViewDetails = async (returnItem) => {
    setSelectedReturn(returnItem)
    setLoadingDetails(true)
    setViewDetailsDialog(true)
    try {
      const response = await api.get(`/sales/returns/${returnItem.id}`)
      if (response.data.success) {
        setReturnDetails(response.data.data)
      } else {
        setReturnDetails(returnItem)
      }
    } catch (error) {
      console.error('Error fetching return details:', error)
      setReturnDetails(returnItem)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleCloseViewDetails = () => {
    setViewDetailsDialog(false)
    setSelectedReturn(null)
    setReturnDetails(null)
  }

  const handleReturnFormChange = (field, value) => {
    setReturnForm(prev => ({ ...prev, [field]: value }))
  }

  const handleItemChange = (index, field, value) => {
    setReturnForm(prev => {
      const updatedItems = prev.items.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value }

          if (field === 'quantity' || field === 'productName') {
            const quantity = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(item.quantity) || 0
            let unitPrice = 0

            if (field === 'productName' && typeof value === 'object' && value.sellingPrice) {
              unitPrice = parseFloat(value.sellingPrice) || 0
              updatedItem.productName = value.name
            } else if (field === 'productName' && productSearchResults[index]) {
              const product = productSearchResults[index].find(p => p.name === value)
              if (product) unitPrice = parseFloat(product.sellingPrice) || 0
            } else {
              const invoiceItem = invoiceItems.find(inv => inv.itemName === updatedItem.productName || inv.name === updatedItem.productName)
              if (invoiceItem) {
                unitPrice = parseFloat(invoiceItem.unitPrice) || parseFloat(invoiceItem.price) || 0
              } else {
                const currentRefund = parseFloat(item.refundAmount) || 0
                const currentQty    = parseFloat(item.quantity)     || 1
                unitPrice = currentQty > 0 ? currentRefund / currentQty : 0
              }
            }

            updatedItem.refundAmount = (quantity * unitPrice).toFixed(2)
          }

          return updatedItem
        }
        return item
      })
      return { ...prev, items: updatedItems }
    })
  }

  // Restock functionality
  const handleRestockItem = (returnItem, item) => {
    const remainingQty = item.remainingQuantity !== undefined ? item.remainingQuantity : item.quantity
    setSelectedItemForRestock({
      returnId:          returnItem.id,
      itemId:            item.id,
      itemName:          item.name || item.productName || item.itemName,
      sku:               item.sku,
      totalQuantity:     Math.max(0, parseFloat(item.quantity)    || 0),
      remainingQuantity: Math.max(0, parseFloat(remainingQty)     || 0),
    })
    setRestockQuantity(0)
    setRestockDialog(true)
  }

  const handleRestockConfirm = async () => {
    if (!selectedItemForRestock || restockQuantity <= 0) return
    const { returnId } = selectedItemForRestock
    setRestockLoading(true)
    try {
      const response = await api.post(
        `/returns/${selectedItemForRestock.returnId}/items/${selectedItemForRestock.itemId}/restock`,
        { qty: restockQuantity }
      )
      if (response.data.success) {
        const scopeParams = getScopeParams()
        await dispatch(fetchReturns(scopeParams))
        dispatch(fetchInventory({ page: 1, limit: 25 })).catch(() => {})

        if (viewDetailsDialog || returnDetails) {
          try {
            const detailsResponse = await api.get(`/sales/returns/${returnId}`)
            if (detailsResponse.data.success) {
              setReturnDetails(detailsResponse.data.data)
              setSelectedReturn(detailsResponse.data.data)
            }
          } catch (detailsError) {
            console.error('Error refreshing return details:', detailsError)
          }
        }

        setRestockDialog(false)
        setSelectedItemForRestock(null)
        setRestockQuantity(0)
        console.log('Restock successful:', response.data.data)
      }
    } catch (error) {
      console.error('Error restocking item:', error)
    } finally {
      setRestockLoading(false)
    }
  }

  const handleRestockCancel = () => {
    setRestockDialog(false)
    setSelectedItemForRestock(null)
    setRestockQuantity(0)
  }

  // Search products function
  const searchProducts = async (query, itemIndex) => {
    if (!query || query.length < 2) {
      setProductSearchResults(prev => ({ ...prev, [itemIndex]: [] }))
      return
    }
    setProductSearchLoading(prev => ({ ...prev, [itemIndex]: true }))
    try {
      const response = await api.get(`/sales/products/search?q=${encodeURIComponent(query)}&limit=10`)
      setProductSearchResults(prev => ({ ...prev, [itemIndex]: response.data.data || [] }))
    } catch (error) {
      console.error('Error searching products:', error)
      setProductSearchResults(prev => ({ ...prev, [itemIndex]: [] }))
    } finally {
      setProductSearchLoading(prev => ({ ...prev, [itemIndex]: false }))
    }
  }

  // Search invoice by invoice number
  const searchInvoice = async (invoiceNumber) => {
    if (!invoiceNumber || invoiceNumber.trim().length < 3) {
      setInvoiceItems([])
      setSelectedInvoice(null)
      return
    }
    setInvoiceSearchLoading(true)
    try {
      const response = await api.get(`/sales/search?invoiceNumber=${encodeURIComponent(invoiceNumber.trim())}`)
      const data = response.data
      if (data.success && data.data && data.data.length > 0) {
        const sale = data.data[0]
        setSelectedInvoice(sale)
        setInvoiceItems(sale.items || [])
        setReturnForm(prev => ({ ...prev, saleId: sale.id }))
      } else {
        setInvoiceItems([])
        setSelectedInvoice(null)
        showToast('Invoice not found. Please check the invoice number.', 'warning')
      }
    } catch (error) {
      console.error('Error searching invoice:', error)
      setInvoiceItems([])
      setSelectedInvoice(null)
      showToast('Error searching for invoice. Please try again.', 'error')
    } finally {
      setInvoiceSearchLoading(false)
    }
  }

  // Add item from invoice to return form
  const addInvoiceItem = (invoiceItem) => {
    const quantity    = parseFloat(invoiceItem.quantity) || 1
    const unitPrice   = parseFloat(invoiceItem.unitPrice) || parseFloat(invoiceItem.price) || 0
    const refundAmount = quantity * unitPrice
    const newItem = {
      productName:  invoiceItem.itemName || invoiceItem.name,
      quantity:     quantity,
      refundAmount: refundAmount.toFixed(2)
    }
    setReturnForm(prev => ({ ...prev, items: [...prev.items, newItem] }))
  }

  // Add all items from invoice to return form
  const addAllInvoiceItems = (invoiceItems) => {
    const allItems = invoiceItems.map(invoiceItem => {
      const quantity    = parseFloat(invoiceItem.quantity) || 1
      const unitPrice   = parseFloat(invoiceItem.unitPrice) || parseFloat(invoiceItem.price) || 0
      const refundAmount = quantity * unitPrice
      return {
        productName:  invoiceItem.itemName || invoiceItem.name,
        quantity:     quantity,
        refundAmount: refundAmount.toFixed(2)
      }
    })
    setReturnForm(prev => ({ ...prev, items: allItems }))
  }

  const addItem = () => {
    setReturnForm(prev => ({
      ...prev,
      items: [...prev.items, { productName: '', quantity: 1, refundAmount: 0 }]
    }))
  }

  const removeItem = (index) => {
    if (returnForm.items.length > 1) {
      setReturnForm(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }))
    }
  }

  const handleCreateReturn = async () => {
    if (!returnForm.saleId) { showToast('Please select an invoice first', 'warning'); return }
    if (!returnForm.reason || returnForm.reason.trim() === '') { showToast('Please enter a return reason', 'warning'); return }

    const validItems = returnForm.items.filter(item =>
      item.productName && item.productName.trim() !== '' &&
      item.quantity    && parseFloat(item.quantity)    > 0 &&
      item.refundAmount && parseFloat(item.refundAmount) > 0
    )
    if (validItems.length === 0) { showToast('Please add at least one item to return', 'warning'); return }

    const returnData = {
      saleId: parseInt(returnForm.saleId),
      reason: returnForm.reason.trim(),
      notes:  returnForm.notes || '',
      items:  validItems.map(item => ({
        productName:  item.productName.trim(),
        quantity:     parseFloat(item.quantity),
        refundAmount: parseFloat(item.refundAmount)
      }))
    }

    const result = await dispatch(createReturn(returnData))
    if (createReturn.fulfilled.match(result)) {
      showToast('Return created successfully', 'success')
      setOpenDialog(false)
      setReturnForm({ saleId: '', reason: '', notes: '', items: [{ productName: '', quantity: 1, refundAmount: 0 }] })
      dispatch(fetchReturns(buildFetchParams()))
    } else if (createReturn.rejected.match(result)) {
      const err      = result.payload || result.error
      const message  = err?.message  || 'Failed to create return'
      const severity = err?.status === 403 ? 'warning' : 'error'
      showToast(message, severity)
    }
  }

  const handleUpdate = async () => {
    const updateData = {
      notes: returnForm.notes || '',
      status: editingEntity?.status || 'COMPLETED',
    }

    const result = await dispatch(updateReturn({ id: editingEntity.id, data: updateData }))
    if (updateReturn.fulfilled.match(result)) {
      showToast('Return updated successfully', 'success')
      setOpenDialog(false)
      setEditingEntity(null)
      setReturnForm({ saleId: '', reason: '', notes: '', items: [{ productName: '', quantity: 1, refundAmount: 0 }] })
      dispatch(fetchReturns(buildFetchParams()))
    } else if (updateReturn.rejected.match(result)) {
      const err      = result.payload || result.error
      const message  = err?.message  || 'Failed to update return'
      const severity = err?.status === 403 ? 'warning' : 'error'
      showToast(message, severity)
    }
  }

  const handleDelete = async () => {
    const result = await dispatch(deleteReturn(entityToDelete.id))
    if (deleteReturn.fulfilled.match(result)) {
      showToast('Return deleted', 'success')
      setOpenDeleteDialog(false)
      setEntityToDelete(null)
      dispatch(fetchReturns(buildFetchParams()))
    } else if (deleteReturn.rejected.match(result)) {
      const err      = result.payload || result.error
      const message  = err?.message  || 'Failed to delete return'
      const severity = err?.status === 403 ? 'warning' : 'error'
      showToast(message, severity)
    }
  }

  const handleRefresh = () => {
    dispatch(fetchReturns(buildFetchParams()))
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) dispatch(fetchWarehouseSettings(user.warehouseId))
    if (user?.role === 'CASHIER'          && user?.branchId)    dispatch(fetchBranchSettings(user.branchId))
  }

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('')
    setReasonFilter('all')
    setSortBy('created_at')
    setSortOrder('desc')
    setPage(1)
  }

  // Reset page when search/reason changes
  useEffect(() => { setPage(1) }, [searchTerm, reasonFilter])

  // Get filter summary
  const getFilterSummary = () => {
    const active = []
    if (searchTerm)          active.push(`Search: "${searchTerm}"`)
    if (reasonFilter !== 'all') active.push(`Reason: ${reasonFilter}`)
    return active
  }

  // Server returns paginated rows; sort current page only (search/reason sent to API)
  const paginatedReturns = [...(returns || [])].sort((a, b) => {
    let aValue, bValue
    switch (sortBy) {
      case 'sale_id':
        aValue = a.original_sale_id || a.sale_id || 0
        bValue = b.original_sale_id || b.sale_id || 0
        break
      case 'reason':
        aValue = a.reason || ''
        bValue = b.reason || ''
        break
      case 'total_refund':
        aValue = parseFloat(a.total_refund || 0)
        bValue = parseFloat(b.total_refund || 0)
        break
      default:
        aValue = new Date(a.created_at || a.createdAt || 0)
        bValue = new Date(b.created_at || b.createdAt || 0)
    }
    return sortOrder === 'asc' ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1)
  })

  const totalItems = totalReturnsCount || paginatedReturns.length
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage))

  // Ensure current page is within bounds when filters change
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const handlePageChange        = (event, newPage) => setPage(newPage)
  const handleRowsPerPageChange = (event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(1) }
  const handleFilterChange      = (field, value) => setFilters(prev => ({ ...prev, [field]: value }))

  const getReturnStats = () => {
    try {
      if (!returns || !Array.isArray(returns) || returns.length === undefined) return { total: 0, totalAmount: 0 }
      const total       = returns.length
      const totalAmount = returns.reduce((sum, r) => {
        const refund = r && r.total_refund ? parseFloat(r.total_refund) : 0
        return sum + (isNaN(refund) ? 0 : refund)
      }, 0)
      return { total, totalAmount }
    } catch (error) {
      console.error('Error calculating return stats:', error)
      return { total: 0, totalAmount: 0 }
    }
  }

  const stats = getReturnStats()

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <RouteGuard allowedRoles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
      <DashboardLayout>

        {/* Admin simulation banner */}
        {isAdminMode && scopeInfo && (
          <Box sx={{
            bgcolor: 'warning.light', color: 'warning.contrastText',
            p: 1, textAlign: 'center', borderBottom: 1, borderColor: 'warning.main',
          }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              🔧 ADMIN MODE: Operating as {scopeInfo.scopeType === 'BRANCH' ? 'Cashier' : 'Warehouse Keeper'} for {scopeInfo.scopeName}
            </Typography>
          </Box>
        )}

        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" gutterBottom>Returns Management</Typography>
              <Typography variant="subtitle1" color="textSecondary">Process and manage product returns</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" startIcon={<Refresh />} onClick={handleRefresh} disabled={loading}>
                Refresh
              </Button>
            </Box>
          </Box>

          {/* Stats Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={6}>
              <Card sx={{
                height: '100%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)',
                transition: 'transform 0.2s ease-in-out',
                '&:hover': { transform: 'translateY(-2px)' }
              }}>
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500 }}>Total Returns</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 0.5 }}>{stats.total}</Typography>
                    </Box>
                    <Receipt sx={{ fontSize: 32, opacity: 0.8 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
              <Card sx={{
                height: '100%',
                background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                color: 'white',
                boxShadow: '0 4px 20px rgba(250, 112, 154, 0.3)',
                transition: 'transform 0.2s ease-in-out',
                '&:hover': { transform: 'translateY(-2px)' }
              }}>
                <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body1" sx={{ opacity: 0.9, fontWeight: 500 }}>Total Amount</Typography>
                      <Typography variant="h4" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                        {(parseFloat(stats.totalAmount) || 0).toFixed(2)}
                      </Typography>
                    </Box>
                    <TrendingDown sx={{ fontSize: 32, opacity: 0.8 }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Returns Table */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {canManageReturns && (
                    <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)} size="small">
                      Add Return
                    </Button>
                  )}
                </Box>
              </Box>

              {/* Search and Filter Section */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <FilterList sx={{ mr: 1, fontSize: 20 }} />
                  <Typography variant="subtitle2">Search &amp; Filters</Typography>
                </Box>

                <Grid container spacing={2} sx={{ mb: 1 }} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth size="small" label="Search Returns"
                      placeholder="Search by sale ID, reason..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      InputProps={{
                        startAdornment: <InputAdornment position="start"><Search /></InputAdornment>,
                        endAdornment: searchTerm && (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setSearchTerm('')} edge="end"><Clear /></IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Reason</InputLabel>
                      <Select value={reasonFilter} label="Reason" onChange={(e) => setReasonFilter(e.target.value)}>
                        <MenuItem value="all">All Reasons</MenuItem>
                        <MenuItem value="defective">Defective</MenuItem>
                        <MenuItem value="changed_mind">Changed Mind</MenuItem>
                        <MenuItem value="wrong_model">Wrong Model</MenuItem>
                        <MenuItem value="damaged_shipping">Damaged Shipping</MenuItem>
                        <MenuItem value="other">Other</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={2}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Sort By</InputLabel>
                      <Select value={sortBy} label="Sort By" onChange={(e) => setSortBy(e.target.value)}>
                        <MenuItem value="created_at">Date</MenuItem>
                        <MenuItem value="original_sale_id">Sale ID</MenuItem>
                        <MenuItem value="reason">Reason</MenuItem>
                        <MenuItem value="total_refund">Amount</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={2}>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                      <Tooltip title="Clear all filters">
                        <IconButton size="small" onClick={clearFilters} disabled={getFilterSummary().length === 0}>
                          <Clear />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={sortOrder === 'asc' ? 'Sort Descending' : 'Sort Ascending'}>
                        <IconButton size="small" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                          {sortOrder === 'asc' ? '↑' : '↓'}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Grid>
                </Grid>

                {/* Filter Summary */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {getFilterSummary().length > 0 ? (
                    <>
                      <Typography variant="body2" color="text.secondary">Active filters:</Typography>
                      {getFilterSummary().map((filter, index) => (
                        <Chip key={index} label={filter} size="small" color="primary" variant="outlined" />
                      ))}
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No filters applied - showing all items</Typography>
                  )}
                </Box>

                <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} returns
                  </Typography>
                </Box>
              </Box>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
              ) : error ? (
                <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>Sale ID</TableCell>
                        <TableCell>Reason</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell>Processed By</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Notes</TableCell>
                        {canManageReturns && <TableCell>Actions</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedReturns.map((returnItem) => (
                        <TableRow key={returnItem.id}>
                          <TableCell>{returnItem.id}</TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight="bold">
                                {returnItem.original_sale_id || returnItem.sale_id || 'N/A'}
                              </Typography>
                              {returnItem.invoice_no && (
                                <Typography variant="caption" color="text.secondary">{returnItem.invoice_no}</Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip label={returnItem.reason?.replace('_', ' ').toUpperCase() || 'N/A'} size="small" color="secondary" />
                          </TableCell>
                          <TableCell align="right">
                            {parseFloat(returnItem.total_refund || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2" fontWeight="bold">
                                {returnItem.processed_by_name || returnItem.processed_by_username || 'N/A'}
                              </Typography>
                              {returnItem.user_name && returnItem.user_name !== returnItem.processed_by_name && (
                                <Typography variant="caption" color="text.secondary">
                                  Created by: {returnItem.user_name}
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {new Date(returnItem.created_at || returnItem.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{returnItem.notes || 'N/A'}</TableCell>
                          {canManageReturns && (
                            <TableCell>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Tooltip title="View Details">
                                  <IconButton size="small" onClick={() => handleViewDetails(returnItem)} color="info">
                                    <ViewIcon />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => {
                                      setEditingEntity(returnItem)
                                      setReturnForm({
                                        saleId: returnItem.original_sale_id || returnItem.sale_id || '',
                                        reason: returnItem.reason || '',
                                        notes:  returnItem.notes  || '',
                                        items:  returnItem.items  || [{ productName: '', quantity: 1, refundAmount: 0 }]
                                      })
                                      setOpenDialog(true)
                                    }}
                                  >
                                    <Edit />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">Rows per page:</Typography>
                    <FormControl size="small" sx={{ minWidth: 80 }}>
                      <Select value={rowsPerPage} onChange={handleRowsPerPageChange} displayEmpty>
                        <MenuItem value={10}>10</MenuItem>
                        <MenuItem value={25}>25</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">Page {page} of {totalPages}</Typography>
                    <Pagination count={totalPages} page={page} onChange={handlePageChange} color="primary" size="small" showFirstButton showLastButton />
                  </Box>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* ── Return Form Dialog ─────────────────────────────────────────── */}
          <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="lg" fullWidth
            PaperProps={{ sx: { minWidth: { xs: 'auto', sm: '60vw' } } }}>
            <DialogTitle>{editingEntity ? 'Edit Return' : 'Create New Return'}</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth label="Sale ID / Invoice Number" type="text"
                      value={returnForm.saleId}
                      onChange={(e) => {
                        handleReturnFormChange('saleId', e.target.value)
                        if (e.target.value.length >= 3) {
                          searchInvoice(e.target.value)
                        } else {
                          setInvoiceItems([])
                          setSelectedInvoice(null)
                        }
                      }}
                      placeholder="Enter Sale ID or Invoice Number"
                      InputProps={{
                        endAdornment: invoiceSearchLoading
                          ? <InputAdornment position="end"><CircularProgress size={20} /></InputAdornment>
                          : null
                      }}
                      required
                    />
                  </Grid>
                  <Grid item xs={12} sm={8}>
                    <FormControl fullWidth required>
                      <InputLabel sx={{ whiteSpace: 'nowrap', overflow: 'visible' }}>Reason</InputLabel>
                      <Select
                        value={returnForm.reason}
                        onChange={(e) => handleReturnFormChange('reason', e.target.value)}
                        label="Reason"
                        sx={{
                          width: '100%', fontSize: '1rem',
                          '& .MuiSelect-select': { padding: '14px', minHeight: '56px', display: 'flex', alignItems: 'center', minWidth: '150px' },
                          '& .MuiOutlinedInput-notchedOutline': { borderWidth: '2px' }
                        }}
                        MenuProps={{
                          PaperProps: { sx: { minWidth: '400px', maxHeight: '400px' } },
                          anchorOrigin:    { vertical: 'bottom', horizontal: 'left' },
                          transformOrigin: { vertical: 'top',    horizontal: 'left' }
                        }}
                      >
                        <MenuItem value="defective"        sx={{ fontSize: '1rem', py: 1.5 }}>Defective</MenuItem>
                        <MenuItem value="changed_mind"     sx={{ fontSize: '1rem', py: 1.5 }}>Changed Mind</MenuItem>
                        <MenuItem value="wrong_model"      sx={{ fontSize: '1rem', py: 1.5 }}>Wrong Model</MenuItem>
                        <MenuItem value="damaged_shipping" sx={{ fontSize: '1rem', py: 1.5 }}>Damaged in Shipping</MenuItem>
                        <MenuItem value="other"            sx={{ fontSize: '1rem', py: 1.5 }}>Other</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth label="Notes" multiline rows={3}
                      value={returnForm.notes}
                      onChange={(e) => handleReturnFormChange('notes', e.target.value)}
                    />
                  </Grid>

                  {/* Invoice Items Section */}
                  {selectedInvoice && invoiceItems.length > 0 && (
                    <Grid item xs={12}>
                      <Box sx={{ mt: 2, p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
                        <Typography variant="h6" sx={{ mb: 2, color: 'white' }}>
                          📋 Invoice Items - {selectedInvoice.invoice_no}
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                          <Typography variant="body2" sx={{ color: 'white' }}>
                            Select items to return (click to add to return form):
                          </Typography>
                          <Button
                            variant="contained" color="secondary" size="small" startIcon={<Add />}
                            onClick={() => addAllInvoiceItems(invoiceItems)}
                            sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' } }}
                          >
                            Add All Items ({invoiceItems.length})
                          </Button>
                        </Box>
                        <Grid container spacing={1}>
                          {invoiceItems.map((item, index) => (
                            <Grid item xs={12} sm={6} md={4} key={index}>
                              <Card
                                sx={{ cursor: 'pointer', bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' }, transition: 'background-color 0.2s' }}
                                onClick={() => addInvoiceItem(item)}
                              >
                                <CardContent sx={{ p: 1.5 }}>
                                  <Typography variant="body2" fontWeight="bold" noWrap>{item.itemName || item.name}</Typography>
                                  <Typography variant="caption" color="text.secondary">SKU: {item.sku}</Typography>
                                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                                    Qty: {item.quantity} × {(parseFloat(item.unitPrice) || 0).toFixed(2).replace(/\.00$/, '')} = ${(parseFloat(item.total) || 0).toFixed(2).replace(/\.00$/, '')}
                                  </Typography>
                                  <Typography variant="caption" color="primary" sx={{ mt: 0.5, display: 'block' }}>
                                    Click to add to return
                                  </Typography>
                                </CardContent>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    </Grid>
                  )}
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Return Items</Typography>
                  <Button startIcon={<Add />} onClick={addItem} variant="outlined">Add Item</Button>
                </Box>

                {returnForm.items.map((item, index) => (
                  <Card key={index} sx={{ mb: 2 }}>
                    <CardContent>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={9} md={9}>
                          <Autocomplete
                            sx={{ '& .MuiInputBase-root': { minWidth: 240 } }}
                            freeSolo
                            options={productSearchResults[index] || []}
                            getOptionLabel={(option) => {
                              if (typeof option === 'string') return option
                              return `${option.name} (${option.sku}) - ${option.sellingPrice}`
                            }}
                            value={item.productName}
                            onInputChange={(event, newValue) => {
                              handleItemChange(index, 'productName', newValue)
                              if (newValue && newValue.length >= 2) searchProducts(newValue, index)
                            }}
                            onChange={(event, newValue) => {
                              if (newValue && typeof newValue === 'object') handleItemChange(index, 'productName', newValue)
                            }}
                            loading={productSearchLoading[index]}
                            renderInput={(params) => (
                              <TextField
                                {...params} label="Product Name" placeholder="Enter product name or SKU" required fullWidth
                                InputProps={{
                                  ...params.InputProps,
                                  endAdornment: (
                                    <>
                                      {productSearchLoading[index] ? <CircularProgress color="inherit" size={20} /> : null}
                                      {params.InputProps.endAdornment}
                                    </>
                                  ),
                                }}
                              />
                            )}
                            renderOption={(props, option) => (
                              <Box component="li" {...props}>
                                <Box>
                                  <Typography variant="body1" fontWeight="bold">{option.name}</Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    SKU: {option.sku} | Price: {option.sellingPrice} | Stock: {option.currentStock}
                                  </Typography>
                                </Box>
                              </Box>
                            )}
                          />
                        </Grid>
                        <Grid item xs={12} sm={1} md={1}>
                          <TextField
                            fullWidth label="Quantity" type="number" value={item.quantity} required
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={1} md={1}>
                          <TextField
                            fullWidth label="Refund Amount" type="number" value={item.refundAmount} required
                            onChange={(e) => handleItemChange(index, 'refundAmount', e.target.value)}
                          />
                        </Grid>
                        <Grid item xs={12} sm={1}>
                          <IconButton onClick={() => removeItem(index)} disabled={returnForm.items.length === 1} color="error" size="small">
                            <Delete />
                          </IconButton>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                ))}
              </Box>

              {/* Total Refund Summary */}
              <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={8}>
                    <Typography variant="body1" color="text.secondary">Total Refund Amount:</Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="h6" fontWeight="bold" color="error.main" sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
                      ${returnForm.items.reduce((sum, item) => {
                        const refund = parseFloat(item.refundAmount) || 0
                        return sum + (isNaN(refund) ? 0 : refund)
                      }, 0).toFixed(2)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: { xs: 'left', sm: 'right' } }}>
                      ({returnForm.items.length} item{returnForm.items.length !== 1 ? 's' : ''})
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => {
                setOpenDialog(false)
                setEditingEntity(null)
                setReturnForm({ saleId: '', reason: '', notes: '', items: [{ productName: '', quantity: 1, refundAmount: 0 }] })
              }}>
                Cancel
              </Button>
              <Button onClick={editingEntity ? handleUpdate : handleCreateReturn} variant="contained" disabled={loading}>
                {editingEntity ? 'Update Return' : 'Create Return'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* ── Delete Confirmation Dialog ─────────────────────────────────── */}
          <ConfirmationDialog
            open={openDeleteDialog}
            onClose={() => { setOpenDeleteDialog(false); setEntityToDelete(null) }}
            onConfirm={handleDelete}
            title="Delete Return"
            message={`Are you sure you want to delete return ${entityToDelete?.return_no}?`}
            loading={loading}
          />

          {/* ── View Return Details Dialog ─────────────────────────────────── */}
          <Dialog open={viewDetailsDialog} onClose={handleCloseViewDetails} maxWidth="md" fullWidth
            PaperProps={{ sx: { minHeight: '60vh' } }}>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Return Details #{selectedReturn?.return_no || selectedReturn?.id}</Typography>
                <IconButton onClick={handleCloseViewDetails} size="small"><Clear /></IconButton>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              {loadingDetails ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
              ) : returnDetails ? (
                <Box>
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Return Information</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">Return Number:</Typography>
                          <Typography variant="body1" fontWeight="medium">{returnDetails.return_no || returnDetails.id}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">Original Sale ID:</Typography>
                          <Typography variant="body1" fontWeight="medium">{returnDetails.original_sale_id || returnDetails.sale_id || 'N/A'}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">Reason:</Typography>
                          <Typography variant="body1" fontWeight="medium">{returnDetails.reason || 'N/A'}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">Status:</Typography>
                          <Chip
                            label={returnDetails.status || 'pending'}
                            color={
                              returnDetails.status === 'completed' ? 'success' :
                              returnDetails.status === 'approved'  ? 'primary' :
                              returnDetails.status === 'pending'   ? 'warning' : 'error'
                            }
                            size="small"
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">Total Refund:</Typography>
                          <Typography variant="body1" fontWeight="medium" color="error.main">
                            ${parseFloat(returnDetails.total_refund || 0).toFixed(2)}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">Return Date:</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {new Date(returnDetails.created_at || returnDetails.createdAt).toLocaleDateString()}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">Processed By:</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {returnDetails.username || returnDetails.processed_by || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography variant="body2" color="text.secondary">Location:</Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {returnDetails.scope_type === 'BRANCH'
                              ? (returnDetails.branch_name    || `Branch ${returnDetails.scope_id}`)
                              : returnDetails.scope_type === 'WAREHOUSE'
                              ? (returnDetails.warehouse_name || `Warehouse ${returnDetails.scope_id}`)
                              : 'N/A'}
                          </Typography>
                        </Grid>
                        {returnDetails.notes && (
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary">Notes:</Typography>
                            <Typography variant="body1" fontWeight="medium">{returnDetails.notes}</Typography>
                          </Grid>
                        )}
                      </Grid>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Returned Items</Typography>
                      {returnDetails.items && returnDetails.items.length > 0 ? (
                        <TableContainer component={Paper} variant="outlined">
                          <Table>
                            <TableHead>
                              <TableRow>
                                <TableCell>Item Name</TableCell>
                                <TableCell>SKU</TableCell>
                                <TableCell align="right">Quantity</TableCell>
                                <TableCell align="right">Unit Price</TableCell>
                                <TableCell align="right">Refund Amount</TableCell>
                                <TableCell align="center">Actions</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {returnDetails.items.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell>
                                    <Box>
                                      <Typography variant="body2" fontWeight="medium">
                                        {item.name || item.productName || item.itemName || 'N/A'}
                                      </Typography>
                                      {item.category && <Typography variant="caption" color="text.secondary">{item.category}</Typography>}
                                      {item.barcode  && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Barcode: {item.barcode}</Typography>}
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" fontWeight="medium">{item.sku || 'N/A'}</Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Box>
                                      <Typography variant="body2" fontWeight="medium">
                                        Qty: {parseFloat(item.quantity || 0).toFixed(2)}
                                      </Typography>
                                      {item.originalQuantity && item.originalQuantity !== item.quantity && (
                                        <Typography variant="caption" color="text.secondary">
                                          (of {parseFloat(item.originalQuantity).toFixed(2)} purchased)
                                        </Typography>
                                      )}
                                      {item.remainingQuantity !== undefined && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.remainingQuantity > 0 ? 'success.main' : 'grey.400' }} />
                                          <Typography variant="caption" color="text.secondary">
                                            {parseFloat(item.remainingQuantity).toFixed(2)} remaining
                                          </Typography>
                                        </Box>
                                      )}
                                    </Box>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2" fontWeight="medium">
                                      ${parseFloat(item.unit_price || item.unitPrice || 0).toFixed(2)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2" fontWeight="medium" color="error.main">
                                      ${parseFloat(item.refund_amount || item.refundAmount || 0).toFixed(2)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="center">
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                                      <Tooltip title="Restock Item">
                                        <IconButton
                                          size="small" color="success"
                                          onClick={() => handleRestockItem(returnDetails, item)}
                                          disabled={restockLoading || (item.remainingQuantity !== undefined && item.remainingQuantity <= 0)}
                                        >
                                          <RestockIcon />
                                        </IconButton>
                                      </Tooltip>
                                      {item.remainingQuantity !== undefined && (
                                        <Typography variant="caption" color="text.secondary">
                                          {parseFloat(item.remainingQuantity).toFixed(2)} remaining
                                        </Typography>
                                      )}
                                    </Box>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <Alert severity="info">No items found for this return.</Alert>
                      )}
                    </CardContent>
                  </Card>
                </Box>
              ) : (
                <Alert severity="error">Failed to load return details.</Alert>
              )}
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={handleCloseViewDetails} variant="outlined">Close</Button>
            </DialogActions>
          </Dialog>

          {/* ── Restock Dialog ─────────────────────────────────────────────── */}
          <Dialog open={restockDialog} onClose={handleRestockCancel} maxWidth="sm" fullWidth>
            <DialogTitle><Typography variant="h6">Restock Item</Typography></DialogTitle>
            <DialogContent dividers>
              {selectedItemForRestock && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>Item Details:</Typography>
                  <Typography variant="body1" fontWeight="medium">{selectedItemForRestock.itemName}</Typography>
                  <Typography variant="body2" color="text.secondary">SKU: {selectedItemForRestock.sku || 'N/A'}</Typography>
                  <Typography variant="body2" color="text.secondary">Available Quantity: {selectedItemForRestock.remainingQuantity}</Typography>
                  <Typography variant="body2" color="text.secondary">Returned Quantity: {selectedItemForRestock.totalQuantity}</Typography>
                  <Box sx={{ mt: 3 }}>
                    <TextField
                      fullWidth label="Restock Quantity" type="number"
                      value={restockQuantity}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value)
                        setRestockQuantity(Number.isFinite(value) && value > 0 ? value : 0)
                      }}
                      inputProps={{ min: 0, max: selectedItemForRestock.remainingQuantity }}
                      helperText={`Enter quantity to restock (max: ${selectedItemForRestock.remainingQuantity})`}
                    />
                  </Box>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={handleRestockCancel} variant="outlined">Cancel</Button>
              <Button
                onClick={handleRestockConfirm} variant="contained" color="success"
                disabled={restockLoading || restockQuantity <= 0 || restockQuantity > selectedItemForRestock?.remainingQuantity}
              >
                {restockLoading ? 'Restocking...' : 'Restock Item'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* ── Toast notifications ────────────────────────────────────────── */}
          <Snackbar
            open={toast.open} autoHideDuration={4000} onClose={handleToastClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert onClose={handleToastClose} severity={toast.severity || 'info'} variant="filled" sx={{ width: '100%' }}>
              {toast.message}
            </Alert>
          </Snackbar>
        </Box>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default ReturnsPage