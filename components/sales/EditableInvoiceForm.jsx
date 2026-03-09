'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
  Card,
  CardContent,
  Autocomplete
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Inventory as InventoryIcon,
  Print as PrintIcon
} from '@mui/icons-material'
import { updateSale } from '../../app/store/slices/salesSlice'
import { fetchInventory } from '../../app/store/slices/inventorySlice'
import api from '../../utils/axios'
import PrintDialog from '../print/PrintDialog'
import buildPrintData from '../../utils/buildPrintData'

const EditableInvoiceForm = ({ open, onClose, sale, onSave, branches = [], warehouses = [] }) => {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const { data: inventoryItems } = useSelector((state) => state.inventory)

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    paymentMethod: 'CASH',
    paymentStatus: 'COMPLETED',
    notes: '',
    items: [],
    tax: 0,
    hasTax: false
  })

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showPrintDialog, setShowPrintDialog] = useState(false)

  const [inventoryChanges, setInventoryChanges] = useState({
    added: [],
    removed: [],
    modified: []
  })

  const [availableItems, setAvailableItems] = useState([])

  // ── Resolve companyInfo from the sale's scope (branch or warehouse) ────────
  // Priority: 1) already-loaded Redux arrays  2) direct API fetch  3) empty {}
  const [companyInfo, setCompanyInfo] = useState({})

  useEffect(() => {
    if (!sale) return

    const scopeType = sale.scope_type || sale.scopeType || ''
    const scopeId   = sale.scope_id   || sale.scopeId

    const mapWarehouse = (w) => ({
      name   : w.name,
      address: w.location || w.address || '',
      phone  : w.phone    || w.managerPhone || '',
      email  : w.email    || '',
      logoUrl: w.logoUrl  || '/petzonelogo.png',
    })

    const mapBranch = (b) => ({
      name   : b.name,
      address: b.location || b.address || '',
      phone  : b.phone    || b.managerPhone || '',
      email  : b.email    || '',
      logoUrl: b.logoUrl  || '/petzonelogo.png',
    })

    if (scopeType === 'WAREHOUSE') {
      // 1) try Redux store first (fast, no request)
      const wh = warehouses.find(w => w.id === scopeId || w.id === Number(scopeId))
      if (wh) { setCompanyInfo(mapWarehouse(wh)); return }

      // 2) fallback: fetch directly from API
      if (scopeId) {
        api.get(`/warehouses/${scopeId}`)
          .then(res => {
            if (res.data?.success && res.data?.data) setCompanyInfo(mapWarehouse(res.data.data))
          })
          .catch(() => {})
      }
    } else {
      // 1) try Redux store first
      const br = branches.find(b => b.id === scopeId || b.id === Number(scopeId))
      if (br) { setCompanyInfo(mapBranch(br)); return }

      // 2) fallback: fetch directly from API
      if (scopeId) {
        api.get(`/branches/${scopeId}`)
          .then(res => {
            if (res.data?.success && res.data?.data) setCompanyInfo(mapBranch(res.data.data))
          })
          .catch(() => {})
      }
    }
  }, [sale, branches, warehouses])

  // ── Build normalised printData from live form state ────────────────────────
  // This passes formData as the live override so printed values match what the
  // user currently sees in the form, not stale sale data.
  const printData = React.useMemo(() => {
    if (!sale) return null
    return buildPrintData({
      sale,
      companyInfo,
      user,
      formData: {
        items        : formData.items.map(item => ({
          // map EditableInvoiceForm field names → buildPrintData field names
          name     : item.itemName || item.name || '',
          sku      : item.sku || '',
          quantity : item.quantity,
          unitPrice: item.unitPrice,
          discount : item.discount || 0,
          total    : (item.quantity * item.unitPrice) - (item.discount || 0),
        })),
        customerName : formData.customerName,
        customerPhone: formData.customerPhone,
        paymentMethod: formData.paymentMethod,
        paymentStatus: formData.paymentStatus,
        notes        : formData.notes,
        tax          : formData.tax,
        hasTax       : formData.hasTax,
      },
    })
  }, [sale, companyInfo, user, formData])

  useEffect(() => {
    if (sale) {
      const originalTax = parseFloat(sale.tax) || 0
      const hasTax = originalTax > 0

      let paymentMethod = sale.paymentMethod;
      if (!paymentMethod && sale.creditAmount > 0) {
        paymentMethod = 'FULLY_CREDIT';
      } else if (!paymentMethod) {
        paymentMethod = 'CASH';
      }

      if (paymentMethod && typeof paymentMethod === 'string') {
        paymentMethod = paymentMethod.toUpperCase();
      }

      const normalizedItems = (sale.items || []).map(item => ({
        ...item,
        itemName: item.itemName || item.name || item.item_name || item.sku || 'Unknown Item',
        name: item.itemName || item.name || item.item_name || item.sku || 'Unknown Item',
        sku: item.sku || '',
        category: item.category || '',
        unitPrice: parseFloat(item.unitPrice || item.unit_price || 0),
        originalPrice: parseFloat(item.originalPrice || item.original_price || item.unitPrice || item.unit_price || 0),
        discount: parseFloat(item.discount || 0),
        quantity: parseFloat(item.quantity || 0),
        total: parseFloat(item.total || 0)
      }));

      setFormData({
        customerName: sale.customerInfo?.name || sale.customerName || 'Walk-in Customer',
        customerPhone: sale.customerInfo?.phone || sale.customerPhone || '',
        paymentMethod: paymentMethod,
        paymentStatus: sale.paymentStatus || (sale.creditAmount > 0 ? 'PARTIAL' : 'COMPLETED'),
        notes: sale.notes || '',
        items: normalizedItems,
        tax: originalTax,
        hasTax: hasTax
      });

      setInventoryChanges({ added: [], removed: [], modified: [] })
    }
  }, [sale])

  useEffect(() => {
    if (!open) return

    const params = { limit: 'all' }

    if (user?.role === 'CASHIER' && user?.branchId) {
      params.scopeType = 'BRANCH'
      params.scopeId = user.branchId
    } else if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      params.scopeType = 'WAREHOUSE'
      params.scopeId = user.warehouseId
    } else if (user?.role === 'ADMIN') {
      const urlParams = new URLSearchParams(window.location.search)
      const simScope = urlParams.get('scope')
      const simId = urlParams.get('id')

      if (simScope && simId) {
        params.scopeType = simScope.toUpperCase() === 'WAREHOUSE' ? 'WAREHOUSE' : 'BRANCH'
        params.scopeId = simId
      } else {
        try {
          const sim = JSON.parse(sessionStorage.getItem('adminSimulation') || '{}')
          if (sim.scopeType && sim.scopeId) {
            params.scopeType = sim.scopeType
            params.scopeId = sim.scopeId
          }
        } catch (e) {}
      }
    }

    dispatch(fetchInventory(params))
  }, [open, dispatch, user])

  useEffect(() => {
    if (open && inventoryItems) {
      setAvailableItems(inventoryItems)
    }
  }, [open, inventoryItems])

  const calculateTotals = useCallback(() => {
    const subtotal = formData.items.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity) * parseFloat(item.unitPrice))
    }, 0)

    const totalDiscount = formData.items.reduce((sum, item) => {
      return sum + (parseFloat(item.discount) || 0)
    }, 0)

    const tax = formData.hasTax ? parseFloat(formData.tax) : 0
    const total = subtotal + tax - totalDiscount

    return { subtotal, tax, totalDiscount, total }
  }, [formData.items, formData.tax, formData.hasTax])

  const totals = calculateTotals()

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleItemQuantityChange = (itemId, newQuantity) => {
    const quantity = Math.round(parseFloat(newQuantity) || 1)

    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId
          ? { ...item, quantity, total: quantity * parseFloat(item.unitPrice) }
          : item
      )
    }))

    const item = formData.items.find(i => i.id === itemId)
    if (item) {
      const quantityChange = quantity - Math.round(parseFloat(item.quantity) || 1)
      if (quantityChange !== 0) {
        trackInventoryChange(item, quantityChange, 'MODIFY')
      }
    }
  }

  const handleItemNameChange = (itemId, newName) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId
          ? {
              ...item,
              itemName: newName,
              sku: newName ? `MANUAL-${Date.now()}` : '',
              category: newName ? 'Manual Entry' : ''
            }
          : item
      )
    }))
  }

  const handleItemSelection = (itemId, selectedItem) => {
    if (selectedItem) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(item =>
          item.id === itemId
            ? {
                ...item,
                inventoryItemId: selectedItem.id,
                itemName: selectedItem.name,
                name: selectedItem.name,
                sku: selectedItem.sku,
                category: selectedItem.category,
                unitPrice: parseFloat(selectedItem.sellingPrice) || 0,
                quantity: 1,
                total: parseFloat(selectedItem.sellingPrice) || 0
              }
            : item
        )
      }))

      trackInventoryChange({
        inventoryItemId: selectedItem.id,
        itemName: selectedItem.name,
        quantity: 1
      }, 1, 'ADD')
    }
  }

  const handleItemPriceChange = (itemId, newPrice) => {
    const price = parseFloat(newPrice) || 0

    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId
          ? { ...item, unitPrice: price, total: parseFloat(item.quantity) * price }
          : item
      )
    }))
  }

  const handleItemDiscountChange = (itemId, newDiscount) => {
    const discount = parseFloat(newDiscount) || 0

    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === itemId ? { ...item, discount } : item
      )
    }))
  }

  const handleRemoveItem = (itemId) => {
    const item = formData.items.find(i => i.id === itemId)

    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }))

    if (item) {
      trackInventoryChange(item, parseFloat(item.quantity), 'REMOVE')
    }
  }

  const handleAddEmptyRow = () => {
    const emptyItem = {
      id: `temp_${Date.now()}`,
      inventoryItemId: null,
      itemName: '',
      name: '',
      sku: '',
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      total: 0,
      category: '',
      isNew: true
    }

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, emptyItem]
    }))

    setSuccess('Empty row added - you can now search and select an item')
    setTimeout(() => setSuccess(null), 2000)
  }

  const trackInventoryChange = (item, quantityChange, type) => {
    if (!item.inventoryItemId) return

    setInventoryChanges(prev => {
      const change = {
        inventoryItemId: item.inventoryItemId,
        itemName: item.itemName,
        quantityChange,
        type
      }

      switch (type) {
        case 'ADD':
          return { ...prev, added: [...prev.added.filter(c => c.inventoryItemId !== item.inventoryItemId), change] }
        case 'REMOVE':
          return { ...prev, removed: [...prev.removed.filter(c => c.inventoryItemId !== item.inventoryItemId), change] }
        case 'MODIFY':
          return { ...prev, modified: [...prev.modified.filter(c => c.inventoryItemId !== item.inventoryItemId), change] }
        default:
          return prev
      }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const updateData = {
        ...formData,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.totalDiscount,
        total: totals.total,
        inventoryChanges
      }

      const response = await api.put(`/sales/${sale.id}`, updateData)
      if (response.data.success) {
        setSuccess('Sale updated successfully!')
        dispatch(fetchInventory({ limit: 'all' }))
        if (onSave) {
          onSave(response.data.data)
        }
        setTimeout(() => { onClose() }, 1500)
      } else {
        setError(response.data.message || 'Failed to update sale')
      }
    } catch (err) {
      if (err.response?.data?.errors) {
        const validationErrors = err.response.data.errors.map(error => error.msg).join(', ')
        setError(`Validation errors: ${validationErrors}`)
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to update sale')
      }
    } finally {
      setSaving(false)
    }
  }

  const getInventoryChangeSummary = () => {
    const totalAdded = inventoryChanges.added.reduce((sum, change) => sum + Math.abs(change.quantityChange), 0)
    const totalRemoved = inventoryChanges.removed.reduce((sum, change) => sum + change.quantityChange, 0)
    const totalModified = inventoryChanges.modified.reduce((sum, change) => sum + Math.abs(change.quantityChange), 0)

    return { totalAdded, totalRemoved, totalModified }
  }

  const changeSummary = getInventoryChangeSummary()

  if (!sale) return null

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { minHeight: '70vh', maxHeight: '90vh' } }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h5" fontWeight="bold" color="primary">
                Invoice #{sale.invoice_no || sale.id}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Edit Invoice Details
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Reprint Invoice">
                <IconButton onClick={() => setShowPrintDialog(true)} size="small" color="primary">
                  <PrintIcon />
                </IconButton>
              </Tooltip>
              <IconButton onClick={onClose} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ pb: 2 }}>
              <Typography variant="h6" gutterBottom>Invoice Details</Typography>

              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Customer Name"
                    value={formData.customerName}
                    onChange={(e) => handleFieldChange('customerName', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Customer Phone"
                    value={formData.customerPhone}
                    onChange={(e) => handleFieldChange('customerPhone', e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Payment Method</InputLabel>
                    <Select
                      value={formData.paymentMethod}
                      onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
                    >
                      <MenuItem value="CASH">Cash</MenuItem>
                      <MenuItem value="CARD">Card</MenuItem>
                      <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>
                      <MenuItem value="MOBILE_PAYMENT">Mobile Payment</MenuItem>
                      <MenuItem value="FULLY_CREDIT">Fully Credit</MenuItem>
                      <MenuItem value="PARTIAL_PAYMENT">Partial Payment</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Payment Status</InputLabel>
                    <Select
                      value={formData.paymentStatus}
                      onChange={(e) => handleFieldChange('paymentStatus', e.target.value)}
                    >
                      <MenuItem value="PENDING">Pending</MenuItem>
                      <MenuItem value="COMPLETED">Completed</MenuItem>
                      <MenuItem value="PARTIAL">Partial Payment</MenuItem>
                      <MenuItem value="FAILED">Failed</MenuItem>
                      <MenuItem value="REFUNDED">Refunded</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {formData.hasTax && (
                  <Grid item xs={12} sm={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Tax Amount"
                      type="number"
                      value={parseFloat(formData.tax || 0).toFixed(2).replace(/\.00$/, '')}
                      onChange={(e) => handleFieldChange('tax', parseFloat(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.01, inputMode: 'decimal' }}
                      sx={{
                        '& input[type=number]': { MozAppearance: 'textfield' },
                        '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
                        '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 }
                      }}
                    />
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ pb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Invoice Items ({formData.items.length})
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" sx={{ '& .MuiTableCell-root': { py: 1 } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', minWidth: 200 }}>Item</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: 100 }} align="right">Unit Price</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: 80 }} align="center">Qty</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: 100 }} align="right">Discount</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: 100 }} align="right">Total</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', width: 60 }} align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {formData.items.map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell sx={{ py: 1 }}>
                          {item.isNew ? (
                            <Autocomplete
                              size="small"
                              options={availableItems}
                              getOptionLabel={(option) => option.name || ''}
                              value={availableItems.find(option => option.name === item.itemName) || null}
                              onChange={(event, newValue) => {
                                if (newValue) {
                                  handleItemSelection(item.id, newValue)
                                } else {
                                  handleItemNameChange(item.id, '')
                                }
                              }}
                              onInputChange={(event, newInputValue) => {
                                handleItemNameChange(item.id, newInputValue)
                              }}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  placeholder="Search items..."
                                  sx={{ '& .MuiInputBase-input': { py: 0.5, fontSize: '0.875rem' } }}
                                />
                              )}
                              renderOption={(props, option) => (
                                <Box component="li" {...props}>
                                  <Box>
                                    <Typography variant="body2" fontWeight="medium">{option.name}</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {option.sku} • {option.category} • Stock: {option.currentStock} • Price: {parseFloat(option.sellingPrice || 0).toFixed(0)}
                                    </Typography>
                                  </Box>
                                </Box>
                              )}
                              filterOptions={(options, { inputValue }) => {
                                return options.filter(option =>
                                  option.name.toLowerCase().includes(inputValue.toLowerCase()) ||
                                  option.sku.toLowerCase().includes(inputValue.toLowerCase()) ||
                                  option.category.toLowerCase().includes(inputValue.toLowerCase())
                                )
                              }}
                              noOptionsText="No items found"
                              clearOnEscape
                              selectOnFocus
                              handleHomeEndKeys
                              fullWidth
                            />
                          ) : (
                            <>
                              <Typography variant="body2" fontWeight="medium" sx={{ lineHeight: 1.2 }}>
                                {item.itemName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                                {item.sku} • {item.category}
                              </Typography>
                            </>
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1 }}>
                          <Box>
                            {item.originalPrice && item.originalPrice !== item.unitPrice && (
                              <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through', display: 'block' }}>
                                {parseFloat(item.originalPrice || 0).toFixed(0)}
                              </Typography>
                            )}
                            <TextField
                              size="small"
                              type="number"
                              value={parseFloat(item.unitPrice || 0).toFixed(2).replace(/\.00$/, '')}
                              onChange={(e) => handleItemPriceChange(item.id, e.target.value || '0')}
                              inputProps={{ min: 0, step: 0.01, inputMode: 'decimal', style: { textAlign: 'right' } }}
                              sx={{
                                width: 90,
                                '& .MuiInputBase-input': { textAlign: 'right', py: 0.5 },
                                '& input[type=number]': { MozAppearance: 'textfield' },
                                '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
                                '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 }
                              }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            size="small"
                            type="number"
                            value={Math.round(parseFloat(item.quantity || 0))}
                            onChange={(e) => handleItemQuantityChange(item.id, e.target.value || '0')}
                            inputProps={{ min: 1, step: 1, inputMode: 'numeric', style: { textAlign: 'center' } }}
                            sx={{
                              width: 70,
                              '& .MuiInputBase-input': { textAlign: 'center', py: 0.5 },
                              '& input[type=number]': { MozAppearance: 'textfield' },
                              '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
                              '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 }
                            }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1 }}>
                          <Box>
                            <TextField
                              size="small"
                              type="number"
                              value={parseFloat(item.discount || 0).toFixed(2).replace(/\.00$/, '')}
                              onChange={(e) => handleItemDiscountChange(item.id, e.target.value || '0')}
                              inputProps={{ min: 0, step: 0.01, inputMode: 'decimal', style: { textAlign: 'right' } }}
                              sx={{
                                width: 80,
                                '& .MuiInputBase-input': { textAlign: 'right', py: 0.5 },
                                '& input[type=number]': { MozAppearance: 'textfield' },
                                '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
                                '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 }
                              }}
                            />
                            {item.discount > 0 && (
                              <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
                                {((item.discount / (item.unitPrice * item.quantity)) * 100).toFixed(1)}% off
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1 }}>
                          <Typography variant="body2" fontWeight="medium" sx={{ lineHeight: 1.2 }}>
                            {((parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)) - (parseFloat(item.discount) || 0)).toFixed(0)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center" sx={{ py: 1 }}>
                          <Tooltip title="Remove Item">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveItem(item.id)}
                              sx={{ py: 0.5 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddEmptyRow}
                  sx={{ minWidth: '100px', borderRadius: '20px', textTransform: 'none', fontSize: '0.875rem' }}
                >
                  + Add Item
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent sx={{ pb: 2 }}>
              <Grid container spacing={2}>
                {(changeSummary.totalAdded > 0 || changeSummary.totalRemoved > 0 || changeSummary.totalModified > 0) && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="subtitle1" gutterBottom color="primary">
                      <InventoryIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
                      Inventory Changes
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {changeSummary.totalAdded > 0 && (
                        <Chip label={`${changeSummary.totalAdded} added`} color="success" size="small" variant="outlined" />
                      )}
                      {changeSummary.totalRemoved > 0 && (
                        <Chip label={`${changeSummary.totalRemoved} removed`} color="error" size="small" variant="outlined" />
                      )}
                      {changeSummary.totalModified > 0 && (
                        <Chip label={`${changeSummary.totalModified} modified`} color="warning" size="small" variant="outlined" />
                      )}
                    </Box>
                  </Grid>
                )}

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom>Invoice Totals</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Subtotal:</Typography>
                    <Typography variant="body2">{totals.subtotal.toFixed(0)}</Typography>
                  </Box>
                  {totals.tax > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">Tax:</Typography>
                      <Typography variant="body2">{totals.tax.toFixed(0)}</Typography>
                    </Box>
                  )}
                  {totals.totalDiscount > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">Discount:</Typography>
                      <Typography variant="body2" color="error">-{totals.totalDiscount.toFixed(0)}</Typography>
                    </Box>
                  )}
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h6" fontWeight="bold">Total:</Typography>
                    <Typography variant="h6" fontWeight="bold" color="primary">
                      {totals.total.toFixed(0)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || formData.items.length === 0}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* PrintDialog uses buildPrintData — same layout as warehouse billing */}
      {showPrintDialog && printData && (
        <PrintDialog
          open={showPrintDialog}
          onClose={() => setShowPrintDialog(false)}
          printData={printData}
          title="Print Invoice"
          defaultLayout="color"
        />
      )}
    </>
  )
}

export default EditableInvoiceForm