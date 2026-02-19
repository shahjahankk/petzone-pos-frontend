'use client'
import { useState, useEffect, useCallback } from 'react'
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
  alpha
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
  const { user } = useSelector((state) => state.auth)
  const { data: returns, total: totalReturnsCount, loading, error } = useSelector((state) => state.returns)
  const { warehouseSettings } = useSelector((state) => state.warehouses || { warehouseSettings: null })
  const { branchSettings } = useSelector((state) => state.branches || { branchSettings: null })
  
  // Toast state for permission/validation feedback
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' })
  const showToast = useCallback((message, severity = 'info') => {
    setToast({ open: true, message, severity })
  }, [])
  const handleToastClose = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }))
  }, [])

  // Check if user can manage returns based on role and settings
  const canManageReturns = user?.role === 'ADMIN' || 
    (user?.role === 'WAREHOUSE_KEEPER' && warehouseSettings?.allowWarehouseReturns) ||
    (user?.role === 'CASHIER' && branchSettings?.allowCashierReturns)
  
  
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
            params.value === 'approved' ? 'primary' :
            params.value === 'pending' ? 'warning' : 'error'
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
        const row = params.row;
        if (row.scope_type === 'BRANCH') {
          return row.branch_name || `Branch ${row.scope_id}`;
        } else if (row.scope_type === 'WAREHOUSE') {
          return row.warehouse_name || `Warehouse ${row.scope_id}`;
        }
        return row.branch_name || row.warehouse_name || 'Unknown';
      }
    },
  ]

  const validationSchema = yup.object({
    saleId: yup.number().required('Sale ID is required').min(1, 'Sale ID must be valid'),
    reason: yup.string().required('Reason is required').max(500, 'Reason cannot exceed 500 characters'),
    notes: yup.string().max(500, 'Notes cannot exceed 500 characters'),
    items: yup.array().min(1, 'At least one item is required').of(
      yup.object({
        productName: yup.string().required('Product name is required'),
        quantity: yup.number().required('Quantity is required').min(0.01, 'Quantity must be greater than 0'),
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
        { value: 'defective', label: 'Defective' },
        { value: 'changed_mind', label: 'Changed Mind' },
        { value: 'wrong_model', label: 'Wrong Model' },
        { value: 'damaged_shipping', label: 'Damaged in Shipping' },
        { value: 'other', label: 'Other' }
      ]
    },
    { name: 'notes', label: 'Notes', type: 'textarea', required: false },
  ]

  // Dialog state management
  const [openDialog, setOpenDialog] = useState(false)
  const [editingEntity, setEditingEntity] = useState(null)
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false)
  const [entityToDelete, setEntityToDelete] = useState(null)
  
  // View details dialog state
  const [viewDetailsDialog, setViewDetailsDialog] = useState(false)
  const [selectedReturn, setSelectedReturn] = useState(null)
  const [returnDetails, setReturnDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [reasonFilter, setReasonFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  
  // Pagination states
  const [page, setPage] = useState(1)
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
  const [invoiceItems, setInvoiceItems] = useState([])
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  
  // Restock functionality state
  const [restockDialog, setRestockDialog] = useState(false)
  const [selectedItemForRestock, setSelectedItemForRestock] = useState(null)
  const [restockQuantity, setRestockQuantity] = useState(0)
  const [restockLoading, setRestockLoading] = useState(false)

  const getScopeParams = useCallback(() => {
    const params = {}

    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      params.scopeType = 'WAREHOUSE'
      params.scopeId = user.warehouseId
    } else if (user?.role === 'CASHIER' && user?.branchId) {
      params.scopeType = 'BRANCH'
      params.scopeId = user.branchId
    }

    return params
  }, [user])

  const buildFetchParams = useCallback(() => {
    const params = {
      page,
      limit: rowsPerPage,
    }
    if (searchTerm) params.search = searchTerm
    if (reasonFilter && reasonFilter !== 'all') params.reason = reasonFilter
    Object.assign(params, getScopeParams())
    return params
  }, [page, rowsPerPage, searchTerm, reasonFilter, getScopeParams])

  // Load returns data on component mount or when scope/pagination/search changes
  useEffect(() => {
    dispatch(fetchReturns(buildFetchParams()))
    
    // Load warehouse settings for warehouse keepers
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
    }
    
    // Load branch settings for cashiers
    if (user?.role === 'CASHIER' && user?.branchId) {
      dispatch(fetchBranchSettings(user.branchId))
    }
  }, [dispatch, user, buildFetchParams])

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
      // Fetch detailed return information including items
      const response = await api.get(`/sales/returns/${returnItem.id}`)
      if (response.data.success) {
        setReturnDetails(response.data.data)
      } else {
        // Fallback to using the return item data if API fails
        setReturnDetails(returnItem)
      }
    } catch (error) {
      console.error('Error fetching return details:', error)
      // Fallback to using the return item data
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
          
          // Auto-calculate refund amount when quantity or product changes
          if (field === 'quantity' || field === 'productName') {
            // When product changes, we need to get unit price from selected product
            // When quantity changes, recalculate refund amount
            const quantity = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(item.quantity) || 0
            let unitPrice = 0
            
            // If product was selected from autocomplete, get unit price from search results
            if (field === 'productName' && typeof value === 'object' && value.sellingPrice) {
              unitPrice = parseFloat(value.sellingPrice) || 0
              updatedItem.productName = value.name
            } else if (field === 'productName' && productSearchResults[index]) {
              // Find product in search results
              const product = productSearchResults[index].find(p => p.name === value)
              if (product) {
                unitPrice = parseFloat(product.sellingPrice) || 0
              }
            } else {
              // Use existing unit price if available, or try to get from invoice item
              const invoiceItem = invoiceItems.find(inv => inv.itemName === updatedItem.productName || inv.name === updatedItem.productName)
              if (invoiceItem) {
                unitPrice = parseFloat(invoiceItem.unitPrice) || parseFloat(invoiceItem.price) || 0
              } else {
                // Keep existing refund amount divided by quantity as unit price
                const currentRefund = parseFloat(item.refundAmount) || 0
                const currentQty = parseFloat(item.quantity) || 1
                unitPrice = currentQty > 0 ? currentRefund / currentQty : 0
              }
            }
            
            // Calculate refund amount: quantity * unit_price
            updatedItem.refundAmount = (quantity * unitPrice).toFixed(2)
          }
          
          return updatedItem
        }
        return item
      })
      
      return {
        ...prev,
        items: updatedItems
      }
    })
  }

  // Restock functionality
  const handleRestockItem = (returnItem, item) => {
    const remainingQty = item.remainingQuantity !== undefined ? item.remainingQuantity : item.quantity
    setSelectedItemForRestock({
      returnId: returnItem.id,
      itemId: item.id,
      itemName: item.name || item.productName || item.itemName,
      sku: item.sku,
      totalQuantity: Math.max(0, parseFloat(item.quantity) || 0),
      remainingQuantity: Math.max(0, parseFloat(remainingQty) || 0)
    })
    setRestockQuantity(0)
    setRestockDialog(true)
  }

  const handleRestockConfirm = async () => {
    if (!selectedItemForRestock || restockQuantity <= 0) {
      return
    }

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
        // Refresh inventory to reflect stock increase
        dispatch(fetchInventory({ page: 1, limit: 25 })).catch(() => {})
        
        // Refresh selected return details if dialog is open
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
        
        // Close dialog and show success message
        setRestockDialog(false)
        setSelectedItemForRestock(null)
        setRestockQuantity(0)
        
        // You could add a success notification here
        console.log('Restock successful:', response.data.data)
      }
    } catch (error) {
      console.error('Error restocking item:', error)
      // You could add an error notification here
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
      
      
      const data = response.data;
      
      if (data.success && data.data && data.data.length > 0) {
        const sale = data.data[0] // Get the first matching sale
        
        setSelectedInvoice(sale)
        setInvoiceItems(sale.items || [])
        
        // Auto-populate the sale ID
        setReturnForm(prev => ({
          ...prev,
          saleId: sale.id
        }))
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
    const quantity = parseFloat(invoiceItem.quantity) || 1
    const unitPrice = parseFloat(invoiceItem.unitPrice) || parseFloat(invoiceItem.price) || 0
    // Calculate refund amount: quantity * unit_price
    const refundAmount = quantity * unitPrice
    
    const newItem = {
      productName: invoiceItem.itemName || invoiceItem.name,
      quantity: quantity,
      refundAmount: refundAmount.toFixed(2)
    }
    
    
    setReturnForm(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }))
  }

  // Add all items from invoice to return form
  const addAllInvoiceItems = (invoiceItems) => {
    const allItems = invoiceItems.map(invoiceItem => {
      const quantity = parseFloat(invoiceItem.quantity) || 1
      const unitPrice = parseFloat(invoiceItem.unitPrice) || parseFloat(invoiceItem.price) || 0
      // Calculate refund amount: quantity * unit_price
      const refundAmount = quantity * unitPrice
      
      return {
        productName: invoiceItem.itemName || invoiceItem.name,
        quantity: quantity,
        refundAmount: refundAmount.toFixed(2)
      }
    })
    
    setReturnForm(prev => ({
      ...prev,
      items: allItems
    }))
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
    
    // Validate form data
    if (!returnForm.saleId) {
      showToast('Please select an invoice first', 'warning')
      return
    }
    
    if (!returnForm.reason || returnForm.reason.trim() === '') {
      showToast('Please enter a return reason', 'warning')
      return
    }
    
    // Filter out empty items
    const validItems = returnForm.items.filter(item => 
      item.productName && item.productName.trim() !== '' &&
      item.quantity && parseFloat(item.quantity) > 0 &&
      item.refundAmount && parseFloat(item.refundAmount) > 0
    );
    
    if (validItems.length === 0) {
      showToast('Please add at least one item to return', 'warning')
      return
    }
    
    const returnData = {
      saleId: parseInt(returnForm.saleId),
      reason: returnForm.reason.trim(),
      notes: returnForm.notes || '',
      items: validItems.map(item => ({
        productName: item.productName.trim(),
        quantity: parseFloat(item.quantity),
        refundAmount: parseFloat(item.refundAmount)
      }))
    }
    
    const result = await dispatch(createReturn(returnData))
    if (createReturn.fulfilled.match(result)) {
      showToast('Return created successfully', 'success')
      setOpenDialog(false)
      setReturnForm({
        saleId: '',
        reason: '',
        notes: '',
        items: [{ productName: '', quantity: 1, refundAmount: 0 }]
      })
      dispatch(fetchReturns(buildFetchParams()))
    } else if (createReturn.rejected.match(result)) {
      const err = result.payload || result.error
      const message = err?.message || 'Failed to create return'
      const severity = err?.status === 403 ? 'warning' : 'error'
      showToast(message, severity)
    }
  }

  const handleUpdate = async () => {
    
    // Validate form data
    if (!returnForm.saleId) {
      showToast('Please select an invoice first', 'warning')
      return
    }
    
    if (!returnForm.reason || returnForm.reason.trim() === '') {
      showToast('Please enter a return reason', 'warning')
      return
    }
    
    // Filter out empty items
    const validItems = returnForm.items.filter(item => 
      item.productName && item.productName.trim() !== '' &&
      item.quantity && parseFloat(item.quantity) > 0 &&
      item.refundAmount && parseFloat(item.refundAmount) > 0
    );
    
    if (validItems.length === 0) {
      showToast('Please add at least one item to return', 'warning')
      return
    }
    
    const updateData = {
      saleId: parseInt(returnForm.saleId),
      reason: returnForm.reason.trim(),
      notes: returnForm.notes || '',
      items: validItems.map(item => ({
        productName: item.productName.trim(),
        quantity: parseFloat(item.quantity),
        refundAmount: parseFloat(item.refundAmount)
      }))
    }
    
    const result = await dispatch(updateReturn({ id: editingEntity.id, data: updateData }))
    if (updateReturn.fulfilled.match(result)) {
      showToast('Return updated successfully', 'success')
      setOpenDialog(false)
      setEditingEntity(null)
      setReturnForm({
        saleId: '',
        reason: '',
        notes: '',
        items: [{ productName: '', quantity: 1, refundAmount: 0 }]
      })
      dispatch(fetchReturns(buildFetchParams()))
    } else if (updateReturn.rejected.match(result)) {
      const err = result.payload || result.error
      const message = err?.message || 'Failed to update return'
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
      const err = result.payload || result.error
      const message = err?.message || 'Failed to delete return'
      const severity = err?.status === 403 ? 'warning' : 'error'
      showToast(message, severity)
    }
  }

  const handleRefresh = () => {
    dispatch(fetchReturns(buildFetchParams()))
    
    // Reload warehouse settings for warehouse keepers
    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
    }
    
    // Reload branch settings for cashiers
    if (user?.role === 'CASHIER' && user?.branchId) {
      dispatch(fetchBranchSettings(user.branchId))
    }
  }

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('')
    setReasonFilter('all')
    setSortBy('created_at')
    setSortOrder('desc')
    setPage(1) // Reset to first page when clearing filters
  }

  // Reset page when search/reason changes
  useEffect(() => {
    setPage(1)
  }, [searchTerm, reasonFilter])

  // Get filter summary
  const getFilterSummary = () => {
    const filters = []
    if (searchTerm) filters.push(`Search: "${searchTerm}"`)
    if (reasonFilter !== 'all') filters.push(`Reason: ${reasonFilter}`)
    return filters
  }

  // Filter and sort returns
  const getFilteredAndSortedReturns = () => {
    let filtered = (returns || []).filter(returnItem => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const saleIdMatch = (returnItem.original_sale_id || returnItem.sale_id)?.toString().includes(searchLower)
        const reasonMatch = returnItem.reason?.toLowerCase().includes(searchLower)
        const notesMatch = returnItem.notes?.toLowerCase().includes(searchLower)
        if (!saleIdMatch && !reasonMatch && !notesMatch) return false
      }

      // Reason filter
      if (reasonFilter !== 'all') {
        if (returnItem.reason !== reasonFilter) return false
      }

      return true
    })

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue
      
      switch (sortBy) {
        case 'sale_id':
          aValue = a.sale_id || 0
          bValue = b.sale_id || 0
          break
        case 'reason':
          aValue = a.reason || ''
          bValue = b.reason || ''
          break
        case 'total_refund':
          aValue = parseFloat(a.total_refund || 0)
          bValue = parseFloat(b.total_refund || 0)
          break
        case 'created_at':
        default:
          aValue = new Date(a.created_at || a.createdAt || 0)
          bValue = new Date(b.created_at || b.createdAt || 0)
          break
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }

  // Pagination logic (client-side slicing with server total fallback)
  const filteredReturns = getFilteredAndSortedReturns()
  const totalItems = totalReturnsCount || filteredReturns.length
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage))
  const startIndex = Math.max(0, (page - 1) * rowsPerPage)
  const endIndex = startIndex + rowsPerPage
  const paginatedReturns = filteredReturns.slice(startIndex, endIndex)

  // Ensure current page is within bounds when filters change
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  // Handle page change
  const handlePageChange = (event, newPage) => {
    setPage(newPage)
  }

  // Handle rows per page change
  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(1) // Reset to first page when changing page size
  }

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }


  const getReturnStats = () => {
    try {
      if (!returns || !Array.isArray(returns) || returns.length === undefined) {
        return { total: 0, totalAmount: 0 }
      }
      
      const total = returns.length
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

  return (
    <RouteGuard allowedRoles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
      <DashboardLayout>
        <Box>
         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
  <Typography variant="h4" fontWeight="bold">Returns Management</Typography>
  <Box sx={{ display: 'flex', gap: 1 }}>
    <Button variant="outlined" startIcon={<Refresh />} onClick={handleRefresh} disabled={loading}>
      Refresh
    </Button>
    {canManageReturns && (
      <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)}>
        Add Return
      </Button>
    )}
  </Box>
</Box>

        {/* Stats Cards */}
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

        {/* Filters Card — standalone, outside table card */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <FilterList sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6">Filters</Typography>
              {(searchTerm || reasonFilter !== 'all') && (
                <Chip label="Clear All" size="small" onDelete={clearFilters} sx={{ ml: 2 }} />
              )}
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth size="small" label="Search Returns"
                  placeholder="Search by sale ID, reason..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
                    endAdornment: searchTerm && (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setSearchTerm('')}><Clear fontSize="small" /></IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
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
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Sort By</InputLabel>
                  <Select value={sortBy} label="Sort By" onChange={(e) => setSortBy(e.target.value)}>
                    <MenuItem value="created_at">Date ↓</MenuItem>
                    <MenuItem value="created_at_asc">Date ↑</MenuItem>
                    <MenuItem value="original_sale_id">Sale ID</MenuItem>
                    <MenuItem value="reason">Reason</MenuItem>
                    <MenuItem value="total_refund">Amount</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button
                  fullWidth variant="outlined"
                  onClick={clearFilters}
                  disabled={!searchTerm && reasonFilter === 'all'}
                  sx={{ height: '40px' }}
                >
                  Clear
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Table Card — clean, no filters or duplicate button inside */}
        <Card>
          <CardContent>
            {/* Results summary */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Showing {startIndex + 1}–{Math.min(endIndex, totalItems)} of {totalItems} returns
              </Typography>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
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
                      <TableRow key={returnItem.id} hover>
                        <TableCell>{returnItem.id}</TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {returnItem.original_sale_id || returnItem.sale_id || 'N/A'}
                            </Typography>
                            {returnItem.invoice_no && (
                              <Typography variant="caption" color="text.secondary">
                                {returnItem.invoice_no}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={returnItem.reason?.replace('_', ' ').toUpperCase() || 'N/A'}
                            size="small" color="secondary"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="medium">
                            {parseFloat(returnItem.total_refund || 0).toFixed(2)}
                          </Typography>
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
                          <Typography variant="body2">
                            {new Date(returnItem.created_at || returnItem.createdAt).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{returnItem.notes || '—'}</Typography>
                        </TableCell>
                        {canManageReturns && (
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Tooltip title="View Details">
                                <IconButton size="small" onClick={() => handleViewDetails(returnItem)} color="primary">
                                  <ViewIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditingEntity(returnItem)
                                    setReturnForm({
                                      saleId: returnItem.original_sale_id || returnItem.sale_id || '',
                                      reason: returnItem.reason || '',
                                      notes: returnItem.notes || '',
                                      items: returnItem.items || [{ productName: '', quantity: 1, refundAmount: 0 }]
                                    })
                                    setOpenDialog(true)
                                  }}
                                  color="primary"
                                >
                                  <Edit />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() => { setEntityToDelete(returnItem); setOpenDeleteDialog(true) }}
                                  color="error"
                                >
                                  <Delete />
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

            {/* Pagination */}
            {totalPages > 1 && (
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
                  <Typography variant="body2" color="text.secondary">
                    Page {page} of {totalPages}
                  </Typography>
                  <Pagination
                    count={totalPages} page={page} onChange={handlePageChange}
                    color="primary" size="small" showFirstButton showLastButton
                  />
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Returns Table */}
            <Card>
              <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {canManageReturns && (
                 <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)}>
                   Add Return
                 </Button>
               )}
                  </Box>
                </Box>

  
{/* Filters Card */}
<Card sx={{ mb: 3 }}>
  <CardContent>
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
      <FilterList sx={{ mr: 1, color: 'primary.main' }} />
      <Typography variant="h6">Filters</Typography>
      {(searchTerm || reasonFilter !== 'all') && (
        <Chip label="Clear All" size="small" onDelete={clearFilters} sx={{ ml: 2 }} />
      )}
    </Box>
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <TextField
          fullWidth size="small" label="Search Returns"
          placeholder="Search by sale ID, reason..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchTerm('')}><Clear fontSize="small" /></IconButton>
              </InputAdornment>
            )
          }}
        />
      </Grid>
      <Grid item xs={12} md={3}>
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
      <Grid item xs={12} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Sort By</InputLabel>
          <Select value={sortBy} label="Sort By" onChange={(e) => setSortBy(e.target.value)}>
            <MenuItem value="created_at">Date ↓</MenuItem>
            <MenuItem value="created_at_asc">Date ↑</MenuItem>
            <MenuItem value="original_sale_id">Sale ID</MenuItem>
            <MenuItem value="reason">Reason</MenuItem>
            <MenuItem value="total_refund">Amount</MenuItem>
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} md={2}>
        <Button
          fullWidth variant="outlined"
          onClick={clearFilters}
          disabled={!searchTerm && reasonFilter === 'all'}
          sx={{ height: '40px' }}
        >
          Clear
        </Button>
      </Grid>
    </Grid>
  </CardContent>
</Card>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : error ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
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
                              <Typography variant="caption" color="text.secondary">
                                {returnItem.invoice_no}
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={returnItem.reason?.replace('_', ' ').toUpperCase() || 'N/A'} 
                            size="small"
                            color="secondary"
                          />
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
                        <TableCell>
                          {returnItem.notes || 'N/A'}
                        </TableCell>
                        {canManageReturns && (
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Tooltip title="View Details">
                                <IconButton
                                  size="small"
                                  onClick={() => handleViewDetails(returnItem)}
                                  color="info"
                                >
                                  <ViewIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditingEntity(returnItem)
                                    // Populate form with existing data
                                    setReturnForm({
                                      saleId: returnItem.original_sale_id || returnItem.sale_id || '',
                                      reason: returnItem.reason || '',
                                      notes: returnItem.notes || '',
                                      items: returnItem.items || [{ productName: '', quantity: 1, refundAmount: 0 }]
                                    })
            setOpenDialog(true)
                                  }}
                                  color="primary"
                                >
                                  <Edit />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEntityToDelete(returnItem)
            setOpenDeleteDialog(true)
                                  }}
                                  color="error"
                                >
                                  <Delete />
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
                  <Typography variant="body2" color="text.secondary">
                    Rows per page:
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 80 }}>
            <Select
                      value={rowsPerPage}
                      onChange={handleRowsPerPageChange}
                      displayEmpty
                    >
                      <MenuItem value={10}>10</MenuItem>
                      <MenuItem value={25}>25</MenuItem>
                      <MenuItem value={50}>50</MenuItem>
                      <MenuItem value={100}>100</MenuItem>
            </Select>
          </FormControl>
        </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Page {page} of {totalPages}
                  </Typography>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={handlePageChange}
                    color="primary"
                    size="small"
                    showFirstButton
                    showLastButton
                  />
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Return Form Dialog */}
<Dialog open={openDialog} maxWidth={false} fullWidth
  PaperProps={{ sx: { minHeight: '80vh', maxHeight: '90vh', width: '95vw', maxWidth: '1400px' } }}>
  <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider', pb: 2 }}>
    <Typography variant="h5" fontWeight="bold">
      {editingEntity ? 'Edit Return' : 'Create New Return'}
    </Typography>
    <IconButton onClick={() => { setOpenDialog(false); setEditingEntity(null); }} size="small">
      <Clear />
    </IconButton>
  </DialogTitle>

  <DialogContent sx={{ pt: 3 }}>
    {/* Header fields in Paper */}
    <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04), borderRadius: 2 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth size="small"
            label="Sale ID / Invoice Number"
            value={returnForm.saleId}
            onChange={(e) => {
              handleReturnFormChange('saleId', e.target.value)
              if (e.target.value.length >= 3) searchInvoice(e.target.value)
              else { setInvoiceItems([]); setSelectedInvoice(null) }
            }}
            placeholder="Enter Sale ID or Invoice Number"
            InputProps={{
              endAdornment: invoiceSearchLoading ? (
                <InputAdornment position="end"><CircularProgress size={20} /></InputAdornment>
              ) : null
            }}
            required
          />
        </Grid>
        <Grid item xs={12} md={5}>
          <FormControl fullWidth size="small" required>
            <InputLabel>Reason</InputLabel>
            <Select value={returnForm.reason} label="Reason"
              onChange={(e) => handleReturnFormChange('reason', e.target.value)}>
              <MenuItem value="defective">Defective</MenuItem>
              <MenuItem value="changed_mind">Changed Mind</MenuItem>
              <MenuItem value="wrong_model">Wrong Model</MenuItem>
              <MenuItem value="damaged_shipping">Damaged in Shipping</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField
            fullWidth size="small" label="Notes"
            value={returnForm.notes}
            onChange={(e) => handleReturnFormChange('notes', e.target.value)}
          />
        </Grid>
      </Grid>
    </Paper>

    {/* Invoice Items Section — unchanged */}
    {selectedInvoice && invoiceItems.length > 0 && (
      <Box sx={{ mb: 3, p: 2, bgcolor: 'primary.light', borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 2, color: 'white' }}>
          📋 Invoice Items — {selectedInvoice.invoice_no}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="body2" sx={{ color: 'white' }}>
            Click an item to add it to the return:
          </Typography>
          <Button size="small" startIcon={<Add />}
            onClick={() => addAllInvoiceItems(invoiceItems)}
            sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' } }}>
            Add All ({invoiceItems.length})
          </Button>
        </Box>
        <Grid container spacing={1}>
          {invoiceItems.map((item, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'grey.100' }, transition: 'background-color 0.2s' }}
                onClick={() => addInvoiceItem(item)}>
                <CardContent sx={{ p: 1.5 }}>
                  <Typography variant="body2" fontWeight="bold" noWrap>{item.itemName || item.name}</Typography>
                  <Typography variant="caption" color="text.secondary">SKU: {item.sku}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {item.quantity} × {(parseFloat(item.unitPrice) || 0).toFixed(2)} = ${(parseFloat(item.total) || 0).toFixed(2)}
                  </Typography>
                  <Typography variant="caption" color="primary" sx={{ display: 'block', mt: 0.5 }}>Click to add</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    )}

    {/* Return Items */}
    <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Return Items</Typography>

    {returnForm.items.map((item, index) => (
      <Card key={index} sx={{ mb: 2, border: index === returnForm.items.length - 1 ? '1px solid' : 'none', borderColor: 'primary.main' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%' }}>
            {/* # badge */}
            <Box sx={{ flexShrink: 0, width: 36 }}>
              <Typography variant="body2" fontWeight="bold" sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 28, height: 28, bgcolor: 'primary.main', color: 'white', borderRadius: '50%'
              }}>
                {index + 1}
              </Typography>
            </Box>

            {/* Product Name */}
            <Box sx={{ flex: 4, minWidth: 0 }}>
              <Autocomplete
                fullWidth freeSolo size="small"
                options={productSearchResults[index] || []}
                getOptionLabel={(option) => typeof option === 'string' ? option : `${option.name} (${option.sku})`}
                value={item.productName}
                onInputChange={(_, newValue) => {
                  handleItemChange(index, 'productName', newValue)
                  if (newValue?.length >= 2) searchProducts(newValue, index)
                }}
                onChange={(_, newValue) => {
                  if (newValue && typeof newValue === 'object') handleItemChange(index, 'productName', newValue)
                }}
                loading={productSearchLoading[index]}
                renderInput={(params) => (
                  <TextField {...params} label="Product Name *" size="small"
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {productSearchLoading[index] && <CircularProgress size={20} />}
                          {params.InputProps.endAdornment}
                        </>
                      )
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">{option.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        SKU: {option.sku} | Price: {option.sellingPrice} | Stock: {option.currentStock}
                      </Typography>
                    </Box>
                  </Box>
                )}
              />
            </Box>

            {/* Qty */}
            <Box sx={{ flexShrink: 0, width: 110 }}>
              <TextField fullWidth size="small" label="Qty *" type="number"
                value={item.quantity}
                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                inputProps={{ min: 0.01, step: 0.01 }}
              />
            </Box>

            {/* Refund Amount */}
            <Box sx={{ flexShrink: 0, width: 160 }}>
              <TextField fullWidth size="small" label="Refund Amount *" type="number"
                value={item.refundAmount}
                onChange={(e) => handleItemChange(index, 'refundAmount', e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
              />
            </Box>

            {/* Delete */}
            <Box sx={{ flexShrink: 0, width: 50, textAlign: 'center' }}>
              {returnForm.items.length > 1 && (
                <IconButton size="small" onClick={() => removeItem(index)} color="error">
                  <Delete />
                </IconButton>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    ))}

    {/* Total Summary */}
    <Paper elevation={0} sx={{ p: 2, mt: 2, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08), borderRadius: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
      <Typography variant="h5" fontWeight="bold">
        Total Refund: <Box component="span" color="error.main">
          ${returnForm.items.reduce((sum, item) => sum + (parseFloat(item.refundAmount) || 0), 0).toFixed(2)}
        </Box>
      </Typography>
    </Paper>
  </DialogContent>

  <DialogActions sx={{ p: 3, borderTop: 1, borderColor: 'divider', justifyContent: 'space-between' }}>
    <Button variant="outlined" startIcon={<Add />} onClick={addItem} size="large">
      Add Item
    </Button>
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button variant="outlined" size="large" onClick={() => {
        setOpenDialog(false); setEditingEntity(null);
        setReturnForm({ saleId: '', reason: '', notes: '', items: [{ productName: '', quantity: 1, refundAmount: 0 }] })
      }}>
        Cancel
      </Button>
      <Button variant="contained" size="large"
        onClick={editingEntity ? handleUpdate : handleCreateReturn}
        disabled={loading}
        sx={{ minWidth: 150 }}>
        {loading ? <CircularProgress size={20} /> : (editingEntity ? 'Update Return' : 'Create Return')}
      </Button>
    </Box>
  </DialogActions>
</Dialog>

        {/* Delete Confirmation Dialog */}
        <ConfirmationDialog
          open={openDeleteDialog}
          onClose={() => {
            setOpenDeleteDialog(false)
            setEntityToDelete(null)
          }}
          onConfirm={handleDelete}
          title="Delete Return"
          message={`Are you sure you want to delete return ${entityToDelete?.return_no}?`}
          loading={loading}
        />

        {/* View Return Details Dialog */}
        <Dialog 
          open={viewDetailsDialog} 
          onClose={handleCloseViewDetails}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { minHeight: '60vh' }
          }}
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                Return Details #{selectedReturn?.return_no || selectedReturn?.id}
              </Typography>
              <IconButton onClick={handleCloseViewDetails} size="small">
                <Clear />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent dividers>
            {loadingDetails ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : returnDetails ? (
              <Box>
                {/* Return Information */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Return Information
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Return Number:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {returnDetails.return_no || returnDetails.id}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Original Sale ID:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {returnDetails.original_sale_id || returnDetails.sale_id || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Reason:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {returnDetails.reason || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Status:
                        </Typography>
                        <Chip 
                          label={returnDetails.status || 'pending'} 
                          color={
                            returnDetails.status === 'completed' ? 'success' :
                            returnDetails.status === 'approved' ? 'primary' :
                            returnDetails.status === 'pending' ? 'warning' : 'error'
                          }
                          size="small"
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Total Refund:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium" color="error.main">
                          ${parseFloat(returnDetails.total_refund || 0).toFixed(2)}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Return Date:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {new Date(returnDetails.created_at || returnDetails.createdAt).toLocaleDateString()}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Processed By:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {returnDetails.username || returnDetails.processed_by || 'N/A'}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Location:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {returnDetails.scope_type === 'BRANCH' 
                            ? (returnDetails.branch_name || `Branch ${returnDetails.scope_id}`)
                            : returnDetails.scope_type === 'WAREHOUSE'
                            ? (returnDetails.warehouse_name || `Warehouse ${returnDetails.scope_id}`)
                            : 'N/A'
                          }
                        </Typography>
                      </Grid>
                      {returnDetails.notes && (
                        <Grid item xs={12}>
                          <Typography variant="body2" color="text.secondary">
                            Notes:
                          </Typography>
                          <Typography variant="body1" fontWeight="medium">
                            {returnDetails.notes}
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>

                {/* Returned Items */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Returned Items
                    </Typography>
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
                                    {item.category && (
                                      <Typography variant="caption" color="text.secondary">
                                        {item.category}
                                      </Typography>
                                    )}
                                    {item.barcode && (
                                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                        Barcode: {item.barcode}
                                      </Typography>
                                    )}
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" fontWeight="medium">
                                    {item.sku || 'N/A'}
                                  </Typography>
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
                                        size="small"
                                        onClick={() => handleRestockItem(returnDetails, item)}
                                        color="success"
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
                      <Alert severity="info">
                        No items found for this return.
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </Box>
            ) : (
              <Alert severity="error">
                Failed to load return details.
              </Alert>
            )}
          </DialogContent>

          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleCloseViewDetails} variant="outlined">
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Restock Dialog */}
        <Dialog 
          open={restockDialog} 
          onClose={handleRestockCancel}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Typography variant="h6">
              Restock Item
            </Typography>
          </DialogTitle>
          <DialogContent dividers>
            {selectedItemForRestock && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Item Details:
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {selectedItemForRestock.itemName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  SKU: {selectedItemForRestock.sku || 'N/A'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Available Quantity: {selectedItemForRestock.remainingQuantity}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Returned Quantity: {selectedItemForRestock.totalQuantity}
                </Typography>
                
                <Box sx={{ mt: 3 }}>
                  <TextField
                    fullWidth
                    label="Restock Quantity"
                    type="number"
                    value={restockQuantity}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value)
                      setRestockQuantity(Number.isFinite(value) && value > 0 ? value : 0)
                    }}
                    inputProps={{ 
                      min: 0, 
                      max: selectedItemForRestock.remainingQuantity 
                    }}
                    helperText={`Enter quantity to restock (max: ${selectedItemForRestock.remainingQuantity})`}
                  />
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleRestockCancel} variant="outlined">
              Cancel
            </Button>
            <Button 
              onClick={handleRestockConfirm} 
              variant="contained" 
              color="success"
              disabled={restockLoading || restockQuantity <= 0 || restockQuantity > selectedItemForRestock?.remainingQuantity}
            >
              {restockLoading ? 'Restocking...' : 'Restock Item'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Toast notifications */}
        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={handleToastClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={handleToastClose}
            severity={toast.severity || 'info'}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
        </Box>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default ReturnsPage
