'use client'
import AppDateField from '../date/AppDateField'
import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, TextField, Typography } from '@mui/material'
import api from '../../utils/axios'

const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'CHEQUE']

export default function SettlementFormDialog({ open, onClose, onSave, settlement, scopeType, scopeId, userRole, prefilledCustomer = null }) {
  const isEdit = Boolean(settlement?.id)
  const [options, setOptions] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [outstanding, setOutstanding] = useState(0)
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    retailerId: null,
    customerId: null,
    paymentAmount: '',
    paymentMethod: 'CASH',
    settlementDate: '',
    notes: '',
    scopeType: scopeType || '',
    scopeId: scopeId || '',
  })

  useEffect(() => {
    if (!open) return
    if (isEdit) {
      setForm({
        customerName: settlement.customer_name || '',
        customerPhone: settlement.customer_phone || '',
        retailerId: settlement.retailer_id || null,
        customerId: settlement.customer_id || null,
        paymentAmount: settlement.payment_amount || '',
        paymentMethod: settlement.payment_method || 'CASH',
        settlementDate: settlement.sale_date ? String(settlement.sale_date).substring(0, 10) : '',
        notes: settlement.notes || '',
        scopeType: settlement.scope_type || scopeType,
        scopeId: scopeId || '',
      })
      setOutstanding(parseFloat(settlement.old_balance || 0))
    } else {
      setForm((prev) => ({ ...prev, scopeType: scopeType || '', scopeId: scopeId || '' }))
      setOutstanding(0)
    }
    setError('')
  }, [open, isEdit, settlement, scopeType, scopeId])

  useEffect(() => {
    if (!open || isEdit || !prefilledCustomer) return
    setForm((prev) => ({
      ...prev,
      customerName: prefilledCustomer.name || '',
      customerPhone: prefilledCustomer.phone || '',
      retailerId: prefilledCustomer.retailerId || null,
      customerId: prev.customerId || null,
    }))
  }, [open, isEdit, prefilledCustomer])

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
    if (!open || !prefilledCustomer || !options.length) return
    const matched = options.find((opt) =>
      (prefilledCustomer.retailerId && opt.id === prefilledCustomer.retailerId) ||
      ((prefilledCustomer.phone || '').trim() && (opt.phone || '').trim() === (prefilledCustomer.phone || '').trim()) ||
      ((prefilledCustomer.name || '').trim() && (opt.name || '').trim().toLowerCase() === (prefilledCustomer.name || '').trim().toLowerCase())
    )
    if (matched) setSelected(matched)
  }, [open, prefilledCustomer, options])

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

  const preview = useMemo(() => {
    const pay = parseFloat(form.paymentAmount || 0)
    return { oldBalance: outstanding, payment: pay, newBalance: outstanding - pay }
  }, [form.paymentAmount, outstanding])

  const handleSubmit = async () => {
    try {
      setLoading(true)
      setError('')
      const payload = {
        ...form,
        paymentAmount: parseFloat(form.paymentAmount || 0),
        scopeType: form.scopeType || scopeType,
        scopeId: form.scopeId || scopeId,
      }
      if (payload.paymentAmount <= 0) throw new Error('Payment amount must be greater than 0')
      await onSave(payload)
      onClose()
    } catch (e) {
      setError(e.message || 'Failed to save settlement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{isEdit ? 'Edit Settlement' : 'Create Settlement'}</DialogTitle>
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
            <TextField fullWidth type="number" label="Payment Amount" value={form.paymentAmount} onChange={(e) => setForm({ ...form, paymentAmount: e.target.value })} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField select fullWidth label="Payment Method" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
              {PAYMENT_METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <AppDateField label="Settlement Date" value={form.settlementDate} onChange={(v) => setForm({ ...form, settlementDate: v })} />
          </Grid>
          <Grid item xs={12} md={8}>
            <TextField fullWidth multiline minRows={2} label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Grid>
        </Grid>
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="body2">Old Balance: {preview.oldBalance}</Typography>
          <Typography variant="body2">Payment Amount: {preview.payment}</Typography>
          <Typography variant="body2" fontWeight={600}>New Balance: {preview.newBalance}</Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  )
}
