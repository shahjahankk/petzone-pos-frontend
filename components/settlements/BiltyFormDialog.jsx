'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, IconButton, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { Add, Delete } from '@mui/icons-material'
import api from '../../utils/axios'

export default function BiltyFormDialog({ open, onClose, onSave, bilty, scopeType, scopeId, userRole }) {
  const isEdit = Boolean(bilty?.id)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [outstanding, setOutstanding] = useState(0)
  const [options, setOptions] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    retailerId: null,
    customerId: null,
    biltyDate: '',
    notes: '',
    scopeType: scopeType || '',
    scopeId: scopeId || '',
    items: [{ description: '', amount: '', quantity: 1, vehicleNumber: '' }],
  })

  useEffect(() => {
    if (!open) return
    setError('')
    if (isEdit) {
      setForm({
        customerName: bilty.customer_name || '',
        customerPhone: bilty.customer_phone || '',
        retailerId: bilty.retailer_id || null,
        customerId: bilty.customer_id || null,
        biltyDate: bilty.sale_date ? String(bilty.sale_date).substring(0, 10) : '',
        notes: bilty.notes || '',
        scopeType: bilty.scope_type || scopeType,
        scopeId: scopeId || '',
        items: (bilty.items || []).map((x) => ({ description: x.description, amount: x.amount, quantity: x.quantity, vehicleNumber: x.vehicle_number })) || [{ description: '', amount: '', quantity: 1, vehicleNumber: '' }],
      })
      setOutstanding(parseFloat(bilty.old_balance || 0))
    }
  }, [open, isEdit, bilty, scopeType, scopeId])

  useEffect(() => {
    if (!open) return
    const run = async () => {
      try {
        if (userRole === 'WAREHOUSE_KEEPER') {
          const res = await api.get('/retailers', { params: { warehouseId: scopeId } })
          setOptions((res.data?.data || []).map((x) => ({ ...x, type: 'retailer' })))
        } else {
          const res = await api.get('/customers', { params: { branchId: scopeId, limit: 100 } })
          setOptions((res.data?.data || []).map((x) => ({ ...x, type: 'customer' })))
        }
      } catch (_) {
        setOptions([])
      }
    }
    run()
  }, [open, userRole, scopeId])

  useEffect(() => {
    const run = async () => {
      if (!form.customerName && !form.customerPhone) return
      try {
        const params = { phone: form.customerPhone || '', customerName: form.customerName || '' }
        if (form.retailerId) params.retailerId = form.retailerId
        const res = await api.get('/sales/outstanding', { params })
        const row = res.data?.data?.[0]
        const amount = parseFloat(row?.creditAmount ?? row?.finalAmount ?? row?.totalOutstanding ?? 0)
        setOutstanding(Number.isFinite(amount) ? amount : 0)
      } catch (_) {
        setOutstanding(0)
      }
    }
    run()
  }, [form.customerName, form.customerPhone, form.retailerId])

  const total = useMemo(() => form.items.reduce((sum, x) => sum + (parseFloat(x.amount || 0) * parseFloat(x.quantity || 1)), 0), [form.items])

  const setItem = (idx, key, value) => {
    const items = [...form.items]
    items[idx] = { ...items[idx], [key]: value }
    setForm({ ...form, items })
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      setError('')
      if (!form.items.length) throw new Error('At least one item is required')
      const payload = {
        ...form,
        scopeType: form.scopeType || scopeType,
        scopeId: form.scopeId || scopeId,
        items: form.items.map((x) => ({
          description: x.description,
          amount: parseFloat(x.amount || 0),
          quantity: parseFloat(x.quantity || 1),
          vehicleNumber: x.vehicleNumber || '',
        })),
      }
      await onSave(payload)
      onClose()
    } catch (e) {
      setError(e.message || 'Failed to save bilty')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{isEdit ? 'Edit Bilty / Transport' : 'Create Bilty / Transport'}</DialogTitle>
      <DialogContent>
        {!!error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid item xs={12}>
            <Autocomplete
              options={options}
              value={selected}
              onChange={(e, value) => {
                setSelected(value)
                setForm((f) => ({
                  ...f,
                  customerName: value?.name || '',
                  customerPhone: value?.phone || '',
                  retailerId: value?.type === 'retailer' ? value.id : null,
                  customerId: value?.type === 'customer' ? value.id : null,
                }))
              }}
              getOptionLabel={(o) => `${o?.name || ''}${o?.phone ? ` (${o.phone})` : ''}`}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Retailer / Customer Search"
                  placeholder="Search by retailer/customer name or phone"
                  fullWidth
                  sx={{
                    minWidth: { xs: '100%', md: 560 },
                    '& .MuiInputBase-root': { minHeight: 44 }
                  }}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="Customer Name" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="Customer Phone" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth type="date" label="Bilty Date" InputLabelProps={{ shrink: true }} value={form.biltyDate} onChange={(e) => setForm({ ...form, biltyDate: e.target.value })} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth multiline minRows={2} label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Grid>
        </Grid>
        <Box sx={{ mt: 2 }}>
          <Button startIcon={<Add />} onClick={() => setForm({ ...form, items: [...form.items, { description: '', amount: '', quantity: 1, vehicleNumber: '' }] })}>
            Add Item
          </Button>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Description</TableCell><TableCell>Amount</TableCell><TableCell>Qty</TableCell><TableCell>Vehicle #</TableCell><TableCell>Total</TableCell><TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {form.items.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell><TextField size="small" fullWidth value={item.description} onChange={(e) => setItem(idx, 'description', e.target.value)} /></TableCell>
                  <TableCell><TextField size="small" type="number" value={item.amount} onChange={(e) => setItem(idx, 'amount', e.target.value)} /></TableCell>
                  <TableCell><TextField size="small" type="number" value={item.quantity} onChange={(e) => setItem(idx, 'quantity', e.target.value)} /></TableCell>
                  <TableCell><TextField size="small" value={item.vehicleNumber} onChange={(e) => setItem(idx, 'vehicleNumber', e.target.value)} /></TableCell>
                  <TableCell>{(parseFloat(item.amount || 0) * parseFloat(item.quantity || 1)).toFixed(2)}</TableCell>
                  <TableCell><IconButton onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}><Delete /></IconButton></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="body2">Old Balance: {outstanding}</Typography>
          <Typography variant="body2">Total Bilty Amount: {total}</Typography>
          <Typography variant="body2" fontWeight={600}>New Balance: {outstanding + total}</Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  )
}
