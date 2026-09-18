'use client'

import { formatDisplayDate } from '../../../utils/displayDates'
import AppDateField from '../../../components/date/AppDateField'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useSelector } from 'react-redux'
import {
  Box, Card, CardContent, Typography, TextField, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Grid, Alert, CircularProgress,
  Menu, ListItemIcon
} from '@mui/material'
import {
  Search as SearchIcon, Download as DownloadIcon, Visibility as ViewIcon,
  Refresh as RefreshIcon, ArrowUpward as ArrowUpIcon, ArrowDownward as ArrowDownIcon,
  Receipt as ReceiptIcon, GetApp as ExportIcon, Payment as PaymentIcon
} from '@mui/icons-material'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import api from '../../../utils/axios'

const money = (value) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value) || 0)

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const getEntryTypeChip = (entryType) => {
  switch (entryType) {
    case 'PAYMENT':
      return <Chip label="Payment" color="success" size="small" />
    case 'PURCHASE':
      return <Chip label="Purchase" color="primary" size="small" />
    default:
      return <Chip label={entryType || 'Entry'} color="default" size="small" />
  }
}

function CompanyLedgerPage() {
  const { user } = useSelector((state) => state.auth)

  const [companies, setCompanies] = useState([])
  const [companySearch, setCompanySearch] = useState('')
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [error, setError] = useState('')

  const [selectedCompany, setSelectedCompany] = useState(null)
  const [ledger, setLedger] = useState(null)
  const [loading, setLoading] = useState(false)
  const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false)
  const [ledgerFilters, setLedgerFilters] = useState({ startDate: '', endDate: '' })
  const [sortField, setSortField] = useState('entry_date')
  const [sortDirection, setSortDirection] = useState('desc')

  const [settlementOpen, setSettlementOpen] = useState(false)
  const [settlement, setSettlement] = useState({ amount: '', paymentMethod: 'CASH', description: '' })
  const [savingSettlement, setSavingSettlement] = useState(false)

  const [exportAnchorEl, setExportAnchorEl] = useState(null)

  // ── Load companies ─────────────────────────────────────────────────────────
  const loadCompanies = useCallback(async () => {
    setLoadingCompanies(true)
    setError('')
    try {
      const response = await api.get('/companies?limit=all')
      const data = response.data?.data || response.data || []
      setCompanies(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load companies')
    } finally {
      setLoadingCompanies(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role !== 'ADMIN') return
    loadCompanies()
  }, [user?.role, loadCompanies])

  // ── Load a company ledger ──────────────────────────────────────────────────
  const loadLedger = useCallback(async (company, filters = ledgerFilters) => {
    if (!company?.id) return
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (filters.startDate) params.startDate = filters.startDate
      if (filters.endDate) params.endDate = filters.endDate
      const response = await api.get(`/company-ledger/${company.id}`, { params })
      setLedger(response.data?.data || null)
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load company ledger')
    } finally {
      setLoading(false)
    }
  }, [ledgerFilters])

  const handleViewLedger = (company) => {
    setSelectedCompany(company)
    setLedger(null)
    setLedgerDialogOpen(true)
    setLedgerFilters({ startDate: '', endDate: '' })
    loadLedger(company, { startDate: '', endDate: '' })
  }

  const handleApplyFilters = () => {
    if (selectedCompany) loadLedger(selectedCompany, ledgerFilters)
  }

  const handleManualRefresh = useCallback(() => {
    loadCompanies()
    if (selectedCompany && ledgerDialogOpen) loadLedger(selectedCompany, ledgerFilters)
  }, [loadCompanies, selectedCompany, ledgerDialogOpen, loadLedger, ledgerFilters])

  // ── Running balance (computed oldest → newest) ─────────────────────────────
  const entriesWithBalance = useMemo(() => {
    const list = ledger?.entries || []
    const ascending = [...list].sort((a, b) => {
      const da = new Date(a.entry_date || 0).getTime()
      const db = new Date(b.entry_date || 0).getTime()
      if (da !== db) return da - db
      return (a.id || 0) - (b.id || 0)
    })
    let running = 0
    const balanceById = new Map()
    ascending.forEach((entry) => {
      running += Number(entry.debit_amount || 0) - Number(entry.credit_amount || 0)
      balanceById.set(entry.id, running)
    })
    return list.map((entry) => ({ ...entry, running_balance: balanceById.get(entry.id) ?? 0 }))
  }, [ledger])

  const sortedEntries = useMemo(() => {
    const list = [...entriesWithBalance]
    const dir = sortDirection === 'asc' ? 1 : -1
    list.sort((a, b) => {
      let aValue
      let bValue
      switch (sortField) {
        case 'entry_type':
          aValue = a.entry_type || ''
          bValue = b.entry_type || ''
          break
        case 'debit_amount':
          aValue = Number(a.debit_amount || 0)
          bValue = Number(b.debit_amount || 0)
          break
        case 'credit_amount':
          aValue = Number(a.credit_amount || 0)
          bValue = Number(b.credit_amount || 0)
          break
        case 'running_balance':
          aValue = Number(a.running_balance || 0)
          bValue = Number(b.running_balance || 0)
          break
        case 'entry_date':
        default:
          aValue = new Date(a.entry_date || 0).getTime()
          bValue = new Date(b.entry_date || 0).getTime()
          if (aValue === bValue) {
            return ((a.id || 0) - (b.id || 0)) * dir
          }
          break
      }
      if (aValue < bValue) return -1 * dir
      if (aValue > bValue) return 1 * dir
      return 0
    })
    return list
  }, [entriesWithBalance, sortField, sortDirection])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (field) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? <ArrowUpIcon fontSize="small" /> : <ArrowDownIcon fontSize="small" />
  }

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase()
    if (!query) return companies
    return companies.filter((company) =>
      [company.name, company.code, company.contactPerson, company.phone, company.email]
        .some((value) => String(value || '').toLowerCase().includes(query))
    )
  }, [companies, companySearch])

  // ── Settlement ─────────────────────────────────────────────────────────────
  const openSettlement = () => {
    setSettlement({ amount: '', paymentMethod: 'CASH', description: '' })
    setSettlementOpen(true)
  }

  const postSettlement = async () => {
    if (!selectedCompany) return
    setSavingSettlement(true)
    setError('')
    try {
      await api.post('/company-ledger/settlements', {
        companyId: Number(selectedCompany.id),
        amount: Number(settlement.amount),
        paymentMethod: settlement.paymentMethod,
        description: settlement.description || undefined
      })
      setSettlementOpen(false)
      setSettlement({ amount: '', paymentMethod: 'CASH', description: '' })
      await loadLedger(selectedCompany, ledgerFilters)
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to record settlement')
    } finally {
      setSavingSettlement(false)
    }
  }

  // ── Export (client-side PDF + Excel) ───────────────────────────────────────
  const handleExportClick = (event) => setExportAnchorEl(event.currentTarget)
  const handleExportClose = () => setExportAnchorEl(null)

  const buildExportRows = () =>
    sortedEntries.map((entry) => ({
      Date: formatDisplayDate(entry.entry_date),
      Type: entry.entry_type || '',
      Description: entry.description || '',
      Reference: entry.reference_id ? `${entry.reference_type || ''} ${entry.reference_id}`.trim() : '',
      'Payment Method': entry.payment_method || '',
      Debit: Number(entry.debit_amount || 0),
      Credit: Number(entry.credit_amount || 0),
      Balance: Number(entry.running_balance || 0),
      'Created By': entry.created_by_name || ''
    }))

  const exportToExcel = async () => {
    const XLSX = await import('xlsx')
    const companyName = ledger?.company?.name || selectedCompany?.name || 'Company'
    const summary = ledger?.summary || { purchases: 0, paid: 0, balance: 0 }
    const rows = buildExportRows()

    const workbook = XLSX.utils.book_new()
    const ledgerSheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Notice: 'No entries available' }])
    XLSX.utils.book_append_sheet(workbook, ledgerSheet, 'Company Ledger')

    const summarySheet = XLSX.utils.json_to_sheet([
      { Metric: 'Company', Value: companyName },
      { Metric: 'Period From', Value: ledgerFilters.startDate || 'All Time' },
      { Metric: 'Period To', Value: ledgerFilters.endDate || 'Today' },
      { Metric: 'Total Purchases', Value: summary.purchases || 0 },
      { Metric: 'Total Paid', Value: summary.paid || 0 },
      { Metric: 'Outstanding Payable', Value: summary.balance || 0 }
    ])
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    const safeName = companyName.replace(/[^a-zA-Z0-9]/g, '_')
    link.href = url
    link.download = `company-ledger-${safeName}-${new Date().toISOString().split('T')[0]}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const exportToPdf = () => {
    const companyName = ledger?.company?.name || selectedCompany?.name || 'Company'
    const summary = ledger?.summary || { purchases: 0, paid: 0, balance: 0 }
    const rows = buildExportRows()
    const period =
      ledgerFilters.startDate || ledgerFilters.endDate
        ? `${ledgerFilters.startDate ? formatDisplayDate(ledgerFilters.startDate) : 'Beginning'} - ${ledgerFilters.endDate ? formatDisplayDate(ledgerFilters.endDate) : 'Today'}`
        : 'All Time'

    const tableRows = rows
      .map(
        (row) => `<tr>
          <td>${escapeHtml(row.Date)}</td>
          <td>${escapeHtml(row.Type)}</td>
          <td>${escapeHtml(row.Description)}</td>
          <td>${escapeHtml(row['Payment Method'])}</td>
          <td class="num">${money(row.Debit)}</td>
          <td class="num">${money(row.Credit)}</td>
          <td class="num">${money(row.Balance)}</td>
        </tr>`
      )
      .join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <title>Company Ledger - ${escapeHtml(companyName)}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #222; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .muted { color: #666; font-size: 12px; margin-bottom: 16px; }
        .cards { display: flex; gap: 16px; margin-bottom: 16px; }
        .card { flex: 1; border: 1px solid #ddd; border-radius: 6px; padding: 10px 12px; }
        .card .label { font-size: 11px; color: #666; text-transform: uppercase; }
        .card .value { font-size: 18px; font-weight: bold; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; }
        td.num { text-align: right; }
      </style></head><body>
      <h1>Company Ledger: ${escapeHtml(companyName)}</h1>
      <div class="muted">Period: ${escapeHtml(period)} &middot; Generated ${escapeHtml(formatDisplayDate(new Date()))}</div>
      <div class="cards">
        <div class="card"><div class="label">Total Purchases</div><div class="value">${money(summary.purchases)}</div></div>
        <div class="card"><div class="label">Total Paid</div><div class="value">${money(summary.paid)}</div></div>
        <div class="card"><div class="label">Outstanding Payable</div><div class="value">${money(summary.balance)}</div></div>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Payment Method</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Balance</th></tr></thead>
        <tbody>${tableRows || '<tr><td colspan="7">No entries available</td></tr>'}</tbody>
      </table>
      </body></html>`

    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 250)
  }

  const handleExportAction = (format) => {
    handleExportClose()
    if (format === 'excel') {
      exportToExcel().catch(() => setError('Failed to export company ledger'))
    } else {
      exportToPdf()
    }
  }

  const renderLedger = () => {
    const companyName = ledger?.company?.name || selectedCompany?.name || 'Company'
    const summary = ledger?.summary || { purchases: 0, paid: 0, balance: 0 }

    return (
      <>
        <Paper sx={{ p: 2, mb: 3, backgroundColor: 'grey.50' }}>
          <Grid container spacing={2}>
            {[
              ['Total Purchases', money(summary.purchases), 'primary'],
              ['Total Paid', money(summary.paid), 'success.main'],
              ['Outstanding Payable', money(summary.balance), summary.balance > 0 ? 'error.main' : 'success.main'],
              ['Total Entries', sortedEntries.length, 'text.primary'],
            ].map(([label, value, color], i) => (
              <Grid item xs={12} sm={3} key={i}>
                <Typography variant="subtitle2" color="text.secondary">{label}</Typography>
                <Typography variant="h6" color={color}>{value}</Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>

        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {[
                  ['entry_date', 'Date'],
                  ['entry_type', 'Type'],
                  [null, 'Description'],
                  [null, 'Payment Method'],
                  ['debit_amount', 'Debit'],
                  ['credit_amount', 'Credit'],
                  ['running_balance', 'Balance'],
                  [null, 'Created By'],
                ].map(([field, label], i) => (
                  <TableCell
                    key={i}
                    align={field === 'debit_amount' || field === 'credit_amount' || field === 'running_balance' ? 'right' : 'left'}
                    sx={field ? { cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0,0,0,0.04)' } } : {}}
                    onClick={field ? () => handleSort(field) : undefined}
                  >
                    {field
                      ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>{label} {getSortIcon(field)}</Box>
                      : label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedEntries.length > 0 ? (
                sortedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDisplayDate(entry.entry_date)}</TableCell>
                    <TableCell>{getEntryTypeChip(entry.entry_type)}</TableCell>
                    <TableCell>{entry.description || '-'}</TableCell>
                    <TableCell>{entry.payment_method || '-'}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="error.main" fontWeight="medium">
                        {money(entry.debit_amount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="success.main" fontWeight="medium">
                        {money(entry.credit_amount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color={entry.running_balance > 0 ? 'error.main' : 'success.main'} fontWeight="bold">
                        {money(entry.running_balance)}
                      </Typography>
                    </TableCell>
                    <TableCell>{entry.created_by_name || '-'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    <Typography variant="body2" color="text.secondary">
                      {loading ? 'Loading entries...' : `No ledger entries for ${companyName}`}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </>
    )
  }

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h4" component="h1">Company Ledger</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button variant="contained" startIcon={<PaymentIcon />} size="small"
                  disabled={!selectedCompany || !ledger} onClick={openSettlement}>
                  Record Supplier Payment
                </Button>
                <Tooltip title="Refresh companies">
                  <IconButton onClick={handleManualRefresh} size="small"><RefreshIcon /></IconButton>
                </Tooltip>
              </Box>
            </Box>
            <Typography variant="body1" color="text.secondary">
              Supplier purchases, payments, outstanding payables, and settlement history
            </Typography>
          </Box>

          {/* Filters */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth label="Search Company / Supplier" value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    placeholder="Name, code, contact or phone"
                    InputProps={{ endAdornment: (<SearchIcon color="action" />) }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button fullWidth variant="outlined" startIcon={<RefreshIcon />}
                    onClick={loadCompanies} disabled={loadingCompanies}>
                    Refresh
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* Companies Table */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Suppliers ({filteredCompanies.length})
              </Typography>
              {loadingCompanies ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
              ) : (
                <TableContainer component={Paper} sx={{ mt: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Company Name</TableCell>
                        <TableCell>Code</TableCell>
                        <TableCell>Contact Person</TableCell>
                        <TableCell>Phone</TableCell>
                        <TableCell align="right">Purchase Orders</TableCell>
                        <TableCell align="right">Total Purchases</TableCell>
                        <TableCell>Last Purchase</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredCompanies.length > 0 ? (
                        filteredCompanies.map((company) => (
                          <TableRow key={company.id}>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">{company.name || 'N/A'}</Typography>
                            </TableCell>
                            <TableCell>{company.code || 'N/A'}</TableCell>
                            <TableCell>{company.contactPerson || 'N/A'}</TableCell>
                            <TableCell>{company.phone || 'N/A'}</TableCell>
                            <TableCell align="right">{company.metrics?.purchaseOrderCount || 0}</TableCell>
                            <TableCell align="right">{money(company.metrics?.totalPurchaseAmount || 0)}</TableCell>
                            <TableCell>{company.metrics?.lastPurchaseDate ? formatDisplayDate(company.metrics.lastPurchaseDate) : 'N/A'}</TableCell>
                            <TableCell>
                              <Tooltip title="View Ledger">
                                <IconButton size="small" onClick={() => handleViewLedger(company)} color="primary">
                                  <ViewIcon />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} align="center">
                            <Typography variant="body2" color="text.secondary">
                              {loadingCompanies ? 'Loading suppliers...' : 'No suppliers found'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          {/* ── Ledger Dialog ─────────────────────────────────────────────── */}
          <Dialog
            open={ledgerDialogOpen}
            onClose={() => setLedgerDialogOpen(false)}
            maxWidth="lg" fullWidth
          >
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  Company Ledger: {ledger?.company?.name || selectedCompany?.name || 'N/A'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button variant="outlined" size="small" startIcon={<PaymentIcon />}
                    disabled={!ledger} onClick={openSettlement}>
                    Record Payment
                  </Button>
                  <Tooltip title="Refresh data">
                    <IconButton onClick={() => selectedCompany && loadLedger(selectedCompany, ledgerFilters)} size="small">
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={3}>
                    <AppDateField label="Start Date"
                      value={ledgerFilters.startDate}
                      onChange={(v) => setLedgerFilters({ ...ledgerFilters, startDate: v })} />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <AppDateField label="End Date"
                      value={ledgerFilters.endDate}
                      onChange={(v) => setLedgerFilters({ ...ledgerFilters, endDate: v })} />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Button fullWidth variant="contained" startIcon={<SearchIcon />}
                      onClick={handleApplyFilters} disabled={loading}>
                      Apply Filters
                    </Button>
                  </Grid>
                </Grid>
              </Box>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
              ) : ledger ? (
                renderLedger()
              ) : (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No ledger data available.</Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExportClick}
                disabled={!ledger || sortedEntries.length === 0}>
                Export
              </Button>
              <Button onClick={() => setLedgerDialogOpen(false)}>Close</Button>
            </DialogActions>
          </Dialog>

          {/* ── Export Menu ───────────────────────────────────────────────── */}
          <Menu
            anchorEl={exportAnchorEl} open={Boolean(exportAnchorEl)} onClose={handleExportClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={() => handleExportAction('pdf')}>
              <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>Export as PDF
            </MenuItem>
            <MenuItem onClick={() => handleExportAction('excel')}>
              <ListItemIcon><ReceiptIcon fontSize="small" /></ListItemIcon>Export as Excel
            </MenuItem>
          </Menu>

          {/* ── Settlement Dialog ─────────────────────────────────────────── */}
          <Dialog open={settlementOpen} onClose={() => setSettlementOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Record Supplier Payment</DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              {selectedCompany && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Company: {ledger?.company?.name || selectedCompany.name}
                  {ledger?.summary ? ` · Outstanding: ${money(ledger.summary.balance)}` : ''}
                </Typography>
              )}
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth type="number" label="Amount" value={settlement.amount}
                    onChange={(e) => setSettlement((p) => ({ ...p, amount: e.target.value }))}
                    inputProps={{ min: 0.01, step: 0.01 }} />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Payment Method</InputLabel>
                    <Select value={settlement.paymentMethod} label="Payment Method"
                      onChange={(e) => setSettlement((p) => ({ ...p, paymentMethod: e.target.value }))}>
                      <MenuItem value="CASH">Cash</MenuItem>
                      <MenuItem value="CARD">Card</MenuItem>
                      <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>
                      <MenuItem value="CHEQUE">Cheque</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Description" value={settlement.description}
                    onChange={(e) => setSettlement((p) => ({ ...p, description: e.target.value }))} />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSettlementOpen(false)}>Cancel</Button>
              <Button variant="contained" onClick={postSettlement}
                disabled={savingSettlement || !Number(settlement.amount) || Number(settlement.amount) <= 0}>
                {savingSettlement ? <CircularProgress size={20} /> : 'Save Payment'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </DashboardLayout>
    </RouteGuard>
  )
}

export default withAuth(CompanyLedgerPage)
