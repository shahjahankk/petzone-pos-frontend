'use client'

import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, Grid, InputLabel, MenuItem, Select, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography
} from '@mui/material'
import { AccountBalance, Payment, Refresh } from '@mui/icons-material'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import withAuth from '../../../components/auth/withAuth'
import api from '../../../utils/axios'

const money = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function CompanyLedgerPage() {
  const { user } = useSelector((state) => state.auth)
  const [companies, setCompanies] = useState([])
  const [companyId, setCompanyId] = useState('')
  const [ledger, setLedger] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [settlementOpen, setSettlementOpen] = useState(false)
  const [settlement, setSettlement] = useState({ amount: '', paymentMethod: 'CASH', description: '' })

  const loadCompanies = async () => {
    const response = await api.get('/companies?limit=all')
    const data = response.data?.data || response.data || []
    setCompanies(Array.isArray(data) ? data : [])
  }

  const loadLedger = async (id = companyId) => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/company-ledger/${id}`)
      setLedger(response.data?.data || null)
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load company ledger')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role !== 'ADMIN') return
    loadCompanies().catch((err) => setError(err.response?.data?.message || 'Unable to load companies'))
  }, [user?.role])

  const postSettlement = async () => {
    try {
      await api.post('/company-ledger/settlements', {
        companyId: Number(companyId),
        amount: Number(settlement.amount),
        paymentMethod: settlement.paymentMethod,
        description: settlement.description || undefined
      })
      setSettlementOpen(false)
      setSettlement({ amount: '', paymentMethod: 'CASH', description: '' })
      await loadLedger()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to record settlement')
    }
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Company Ledger</Typography>
            <Typography color="text.secondary">Supplier purchases, payments, outstanding balances, and settlement history</Typography>
          </Box>
          <Button variant="outlined" startIcon={<Refresh />} onClick={() => loadLedger()} disabled={!companyId || loading}>Refresh</Button>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Company / Supplier</InputLabel>
                  <Select value={companyId} label="Company / Supplier" onChange={(e) => { setCompanyId(e.target.value); setLedger(null); loadLedger(e.target.value) }}>
                    <MenuItem value="">Select a company</MenuItem>
                    {companies.map((company) => <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <Button variant="contained" startIcon={<Payment />} disabled={!companyId || !ledger} onClick={() => setSettlementOpen(true)}>Record Supplier Payment</Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box> : ledger && (
          <>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} md={4}><Card><CardContent><Typography color="text.secondary">Total Purchases</Typography><Typography variant="h5" color="primary">{money(ledger.summary.purchases)}</Typography></CardContent></Card></Grid>
              <Grid item xs={12} md={4}><Card><CardContent><Typography color="text.secondary">Total Paid</Typography><Typography variant="h5" color="success.main">{money(ledger.summary.paid)}</Typography></CardContent></Card></Grid>
              <Grid item xs={12} md={4}><Card><CardContent><Typography color="text.secondary">Outstanding Payable</Typography><Typography variant="h5" color={ledger.summary.balance > 0 ? 'warning.main' : 'success.main'}>{money(ledger.summary.balance)}</Typography></CardContent></Card></Grid>
            </Grid>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}><AccountBalance sx={{ mr: 1, verticalAlign: 'middle' }} />{ledger.company.name} Ledger</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Type</TableCell><TableCell>Description</TableCell><TableCell>Payment</TableCell><TableCell align="right">Debit</TableCell><TableCell align="right">Credit</TableCell><TableCell>Created By</TableCell></TableRow></TableHead>
                    <TableBody>
                      {(ledger.entries || []).map((entry) => <TableRow key={entry.id}><TableCell>{entry.entry_date ? new Date(entry.entry_date).toLocaleDateString() : '-'}</TableCell><TableCell><Chip size="small" label={entry.entry_type} color={entry.entry_type === 'PAYMENT' ? 'success' : 'primary'} /></TableCell><TableCell>{entry.description}</TableCell><TableCell>{entry.payment_method || '-'}</TableCell><TableCell align="right">{money(entry.debit_amount)}</TableCell><TableCell align="right">{money(entry.credit_amount)}</TableCell><TableCell>{entry.created_by_name || '-'}</TableCell></TableRow>)}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </>
        )}
        <Dialog open={settlementOpen} onClose={() => setSettlementOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Record Supplier Payment</DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}><TextField fullWidth type="number" label="Amount" value={settlement.amount} onChange={(e) => setSettlement((p) => ({ ...p, amount: e.target.value }))} inputProps={{ min: 0.01, step: 0.01 }} /></Grid>
              <Grid item xs={12}><FormControl fullWidth><InputLabel>Payment Method</InputLabel><Select value={settlement.paymentMethod} label="Payment Method" onChange={(e) => setSettlement((p) => ({ ...p, paymentMethod: e.target.value }))}><MenuItem value="CASH">Cash</MenuItem><MenuItem value="CARD">Card</MenuItem><MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem><MenuItem value="CHEQUE">Cheque</MenuItem></Select></FormControl></Grid>
              <Grid item xs={12}><TextField fullWidth label="Description" value={settlement.description} onChange={(e) => setSettlement((p) => ({ ...p, description: e.target.value }))} /></Grid>
            </Grid>
          </DialogContent>
          <DialogActions><Button onClick={() => setSettlementOpen(false)}>Cancel</Button><Button variant="contained" onClick={postSettlement} disabled={!Number(settlement.amount) || Number(settlement.amount) <= 0}>Save Payment</Button></DialogActions>
        </Dialog>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default withAuth(CompanyLedgerPage)
