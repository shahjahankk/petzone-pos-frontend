'use client'

import { useEffect, useState, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box, Card, CardContent, Grid, Typography, Paper, Button,
  TextField, FormControl, InputLabel, Select, MenuItem,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, LinearProgress, Alert,
} from '@mui/material'
import {
  Refresh, Download, Schedule, AttachMoney, AccountBalanceWallet,
  PointOfSale, CheckCircle, Warning,
} from '@mui/icons-material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import AppDatePicker from '../../../../components/date/AppDatePicker'
import RouteGuard from '../../../../components/auth/RouteGuard'
import { fetchShiftSessionsReport } from '../../../store/slices/shiftsSlice'

const fmt = (v, d = 0) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtPKR = (v) => `PKR ${fmt(v)}`
const toStr = (d) => {
  if (!d) return null
  if (d instanceof Date) {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return d
}
const today = () => new Date()
const som = () => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d }
const fmtDate = (value) => {
  if (!value) return '-'
  const d = new Date(value)
  return isNaN(d.getTime()) ? '-' : d.toLocaleString()
}

function KpiCard({ label, value, sub, accent, icon }) {
  return (
    <Card elevation={0} sx={{
      border: '1px solid #f0f0f0', borderTop: `3px solid ${accent}`,
      borderRadius: 2.5, height: '100%', bgcolor: '#fff',
    }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, fontSize: '.65rem', mb: .8 }}>
              {label}
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.15, mb: .4 }}>
              {value}
            </Typography>
            {sub && <Typography sx={{ color: 'text.secondary', fontSize: '.75rem' }}>{sub}</Typography>}
          </Box>
          <Box sx={{ bgcolor: `${accent}14`, borderRadius: 2, p: 1.2, display: 'flex', flexShrink: 0, ml: 1.5 }}>
            <Box sx={{ color: accent, display: 'flex', fontSize: 20 }}>{icon}</Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export default function ShiftCashReportPage() {
  const dispatch = useDispatch()
  const { shiftSessionsReport, shiftSessionsReportTotals, shiftSessionsReportLoading, error } = useSelector((s) => s.shifts)
  const [filters, setFilters] = useState({ dateFrom: som(), dateTo: today(), status: 'all' })
  const [search, setSearch] = useState('')

  const load = () => {
    dispatch(fetchShiftSessionsReport({
      dateFrom: toStr(filters.dateFrom),
      dateTo: toStr(filters.dateTo),
      status: filters.status,
    }))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, filters.dateFrom, filters.dateTo, filters.status])

  const rows = useMemo(() => {
    const list = Array.isArray(shiftSessionsReport) ? shiftSessionsReport : []
    const term = search.trim().toLowerCase()
    if (!term) return list
    return list.filter((r) =>
      String(r.cashier_name || '').toLowerCase().includes(term) ||
      String(r.branch_name || '').toLowerCase().includes(term) ||
      String(r.warehouse_name || '').toLowerCase().includes(term) ||
      String(r.shift_name || '').toLowerCase().includes(term)
    )
  }, [shiftSessionsReport, search])

  const totals = shiftSessionsReportTotals || {
    sessions: 0, initial_cash: 0, cash_sales: 0, total_sales: 0,
    final_cash: 0, expected_cash: 0, cash_difference: 0,
  }

  const handleExportCSV = () => {
    const header = ['Start', 'End', 'Cashier', 'Shift', 'Location', 'Opening Cash', 'Cash Sales', 'Total Sales', 'Expected Cash', 'Closing Cash', 'Difference', 'Status']
    const data = rows.map((r) => [
      fmtDate(r.actual_start_time),
      fmtDate(r.actual_end_time),
      r.cashier_name || '',
      r.shift_name || '',
      r.branch_name || r.warehouse_name || '',
      r.initial_cash,
      r.cash_sales,
      r.total_sales,
      r.expected_cash,
      r.final_cash ?? '',
      r.cash_difference ?? '',
      r.status,
    ])
    const csv = [header, ...data].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `shift-cash-${toStr(filters.dateFrom)}-${toStr(filters.dateTo)}.csv`
    a.click()
  }

  return (
    <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER']}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={{ bgcolor: '#f7f8fa', minHeight: '100vh', width: '100%' }}>
          <Paper elevation={0} sx={{ p: 2, borderRadius: 0, borderBottom: '1px solid #e8e8e8', position: 'sticky', top: 0, zIndex: 10 }}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                <Schedule sx={{ color: 'primary.main' }} />
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: '1rem', lineHeight: 1.1 }}>Shift Cash Report</Typography>
                  <Typography sx={{ fontSize: '.7rem', color: 'text.secondary' }}>Opening / closing cash by cashier</Typography>
                </Box>
              </Box>

              <AppDatePicker
                label="From Date"
                value={filters.dateFrom}
                onChange={(d) => setFilters((p) => ({ ...p, dateFrom: d }))}
                slots={{ textField: TextField }}
                slotProps={{ textField: { size: 'small', sx: { minWidth: 150 } } }}
              />
              <AppDatePicker
                label="To Date"
                value={filters.dateTo}
                onChange={(d) => setFilters((p) => ({ ...p, dateTo: d }))}
                slots={{ textField: TextField }}
                slotProps={{ textField: { size: 'small', sx: { minWidth: 150 } } }}
              />

              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={filters.status}
                  onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="ENDED">Ended</MenuItem>
                </Select>
              </FormControl>

              <TextField
                size="small"
                label="Search cashier / branch"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ minWidth: 200 }}
              />

              <Box sx={{ flexGrow: 1 }} />

              <Button variant="outlined" startIcon={<Refresh />} onClick={load} disabled={shiftSessionsReportLoading}>
                Refresh
              </Button>
              <Button variant="contained" startIcon={<Download />} onClick={handleExportCSV} disabled={rows.length === 0}>
                Export CSV
              </Button>
            </Box>
          </Paper>

          <Box sx={{ px: { xs: 2, md: 4 }, py: 3, width: '100%', boxSizing: 'border-box' }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{typeof error === 'string' ? error : 'Failed to load shift cash report'}</Alert>}

            <Grid container spacing={2.5} sx={{ mb: 3 }} columns={12}>
              <Grid item xs={12} sm={6} md={2}>
                <KpiCard label="Sessions" value={fmt(totals.sessions)} sub={`${rows.length} shown`} accent="#1976d2" icon={<Schedule />} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <KpiCard label="Opening Cash" value={fmtPKR(totals.initial_cash)} sub="Total initial cash" accent="#6a1b9a" icon={<AccountBalanceWallet />} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <KpiCard label="Cash Sales" value={fmtPKR(totals.cash_sales)} sub="Collected in cash" accent="#2e7d32" icon={<PointOfSale />} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <KpiCard label="Expected Cash" value={fmtPKR(totals.expected_cash)} sub="Opening + cash sales" accent="#0277bd" icon={<AttachMoney />} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <KpiCard label="Closing Cash" value={fmtPKR(totals.final_cash)} sub="Entered at end" accent="#455a64" icon={<CheckCircle />} />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <KpiCard
                  label="Difference"
                  value={fmtPKR(totals.cash_difference)}
                  sub="Closing − expected"
                  accent={totals.cash_difference < 0 ? '#c62828' : '#2e7d32'}
                  icon={<Warning />}
                />
              </Grid>
            </Grid>

            {shiftSessionsReportLoading && <LinearProgress sx={{ mb: 2 }} />}

            <Paper elevation={0} sx={{ border: '1px solid #eee', borderRadius: 2, overflow: 'hidden' }}>
              <TableContainer sx={{ maxHeight: 'calc(100vh - 330px)' }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {['Start', 'End', 'Cashier', 'Shift', 'Location', 'Opening', 'Cash Sales', 'Total Sales', 'Expected', 'Closing', 'Difference', 'Status'].map((h) => (
                        <TableCell
                          key={h}
                          align={['Opening', 'Cash Sales', 'Total Sales', 'Expected', 'Closing', 'Difference'].includes(h) ? 'right' : 'left'}
                          sx={{ fontWeight: 800, fontSize: '.72rem', bgcolor: '#f5f7fa', whiteSpace: 'nowrap' }}
                        >
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!shiftSessionsReportLoading && rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                          No shift sessions found for this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((r) => {
                        const diff = r.cash_difference
                        return (
                          <TableRow key={r.id} hover>
                            <TableCell sx={{ fontSize: '.75rem', whiteSpace: 'nowrap' }}>{fmtDate(r.actual_start_time)}</TableCell>
                            <TableCell sx={{ fontSize: '.75rem', whiteSpace: 'nowrap' }}>{fmtDate(r.actual_end_time)}</TableCell>
                            <TableCell sx={{ fontSize: '.78rem', fontWeight: 600 }}>{r.cashier_name || '-'}</TableCell>
                            <TableCell sx={{ fontSize: '.75rem' }}>{r.shift_name || '-'}</TableCell>
                            <TableCell sx={{ fontSize: '.75rem' }}>{r.branch_name || r.warehouse_name || '-'}</TableCell>
                            <TableCell align="right" sx={{ fontSize: '.78rem' }}>{fmtPKR(r.initial_cash)}</TableCell>
                            <TableCell align="right" sx={{ fontSize: '.78rem' }}>{fmtPKR(r.cash_sales)}</TableCell>
                            <TableCell align="right" sx={{ fontSize: '.78rem' }}>{fmtPKR(r.total_sales)}</TableCell>
                            <TableCell align="right" sx={{ fontSize: '.78rem', fontWeight: 600 }}>{fmtPKR(r.expected_cash)}</TableCell>
                            <TableCell align="right" sx={{ fontSize: '.78rem' }}>{r.final_cash === null || r.final_cash === undefined ? '-' : fmtPKR(r.final_cash)}</TableCell>
                            <TableCell align="right" sx={{ fontSize: '.78rem', fontWeight: 700, color: diff === null || diff === undefined ? 'text.secondary' : diff < 0 ? '#c62828' : '#2e7d32' }}>
                              {diff === null || diff === undefined ? '-' : fmtPKR(diff)}
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={r.status === 'ACTIVE' ? 'Active' : 'Ended'}
                                color={r.status === 'ACTIVE' ? 'success' : 'default'}
                                sx={{ fontSize: '.68rem', height: 22 }}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>
        </Box>
      </LocalizationProvider>
    </RouteGuard>
  )
}
