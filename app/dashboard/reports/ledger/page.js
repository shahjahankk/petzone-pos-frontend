'use client'

import { useEffect, useState, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Paper,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  LinearProgress,
} from '@mui/material'
import { Refresh, AccountBalance, TrendingDown, TrendingUp } from '@mui/icons-material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { fetchLedgerReports } from '../../../store/slices/reportsSlice'
import RouteGuard from '../../../../components/auth/RouteGuard'

const fmtMoney = (v) =>
  Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export default function LedgerReportsPage() {
  const dispatch = useDispatch()
  const { ledgerReports, isLoading, error } = useSelector((s) => s.reports)

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d
  })
  const [dateTo, setDateTo] = useState(() => new Date())

  const queryArgs = useMemo(
    () => ({
      dateFrom: dateFrom instanceof Date ? dateFrom.toISOString().split('T')[0] : dateFrom,
      dateTo: dateTo instanceof Date ? dateTo.toISOString().split('T')[0] : dateTo,
    }),
    [dateFrom, dateTo]
  )

  useEffect(() => {
    dispatch(fetchLedgerReports(queryArgs))
  }, [dispatch, queryArgs])

  const recent = Array.isArray(ledgerReports?.recentTransactions)
    ? ledgerReports.recentTransactions
    : []
  const trendData = Array.isArray(ledgerReports?.trendData) ? ledgerReports.trendData : []
  const accountSummary = Array.isArray(ledgerReports?.accountSummary)
    ? ledgerReports.accountSummary
    : []

  return (
    <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER']}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', p: 3 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              mb: 3,
              borderLeft: 4,
              borderColor: 'primary.main',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="caption" color="primary" fontWeight={700} letterSpacing={1.2}>
                Reports / Ledger
              </Typography>
              <Typography variant="h4" fontWeight={700}>
                Ledger Reports
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Debits, credits, and balances from the ledger export (legacy table).
              </Typography>
            </Box>
            <Button
              startIcon={<Refresh />}
              variant="outlined"
              onClick={() => dispatch(fetchLedgerReports(queryArgs))}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </Paper>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Alert severity="info" sx={{ mb: 2 }}>
            Data comes from <code>GET /api/reports/ledger</code>. If this stays empty, the legacy{' '}
            <code>ledger</code> table may have no rows — operational balances may live in{' '}
            <code>ledgers</code> / ledger entries instead.
          </Alert>

          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={4}>
                <DatePicker
                  label="From"
                  value={dateFrom}
                  onChange={(d) => d && setDateFrom(d)}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <DatePicker
                  label="To"
                  value={dateTo}
                  onChange={(d) => d && setDateTo(d)}
                  slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                />
              </Grid>
            </Grid>
          </Paper>

          {isLoading && <LinearProgress sx={{ mb: 2 }} />}

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              {
                label: 'Total debit',
                value: fmtMoney(ledgerReports?.totalDebit),
                icon: <TrendingDown color="error" />,
                accent: 'error.main',
              },
              {
                label: 'Total credit',
                value: fmtMoney(ledgerReports?.totalCredit),
                icon: <TrendingUp color="success" />,
                accent: 'success.main',
              },
              {
                label: 'Balance (credit − debit)',
                value: fmtMoney(ledgerReports?.balance),
                icon: <AccountBalance color="primary" />,
                accent: 'primary.main',
              },
              {
                label: 'Entries in range',
                value: String(ledgerReports?.totalEntries ?? ledgerReports?.totalTransactions ?? 0),
                icon: <AccountBalance color="action" />,
                accent: 'text.primary',
              },
            ].map((c) => (
              <Grid item xs={12} sm={6} md={3} key={c.label}>
                <Card variant="outlined" sx={{ borderLeft: 4, borderColor: c.accent }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {c.label}
                        </Typography>
                        <Typography variant="h5" fontWeight={800} sx={{ color: c.accent }}>
                          {c.value}
                        </Typography>
                      </Box>
                      {c.icon}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {trendData.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
              <Typography fontWeight={600} sx={{ mb: 2 }}>
                Debit / credit trend
              </Typography>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="debit" name="Debit" stroke="#d32f2f" dot={false} />
                  <Line type="monotone" dataKey="credit" name="Credit" stroke="#2e7d32" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} lg={7}>
              <Typography fontWeight={600} sx={{ mb: 1 }}>
                Recent transactions
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Account</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Debit</TableCell>
                      <TableCell align="right">Credit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recent.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.disabled' }}>
                          No transactions in this range
                        </TableCell>
                      </TableRow>
                    ) : (
                      recent.map((row, i) => (
                        <TableRow key={row.id ?? i} hover>
                          <TableCell>
                            {row.created_at
                              ? new Date(row.created_at).toLocaleString()
                              : '—'}
                          </TableCell>
                          <TableCell>{row.account_type || row.accountType || '—'}</TableCell>
                          <TableCell>{row.transaction_type || row.transactionType || '—'}</TableCell>
                          <TableCell align="right">
                            {fmtMoney(row.debit_amount ?? row.debitAmount)}
                          </TableCell>
                          <TableCell align="right">
                            {fmtMoney(row.credit_amount ?? row.creditAmount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item xs={12} lg={5}>
              <Typography fontWeight={600} sx={{ mb: 1 }}>
                By account
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Account</TableCell>
                      <TableCell align="right">Debit</TableCell>
                      <TableCell align="right">Credit</TableCell>
                      <TableCell align="right">Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {accountSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.disabled' }}>
                          No accounts
                        </TableCell>
                      </TableRow>
                    ) : (
                      accountSummary.map((a, i) => (
                        <TableRow key={a.account ?? i} hover>
                          <TableCell>{a.account}</TableCell>
                          <TableCell align="right">{fmtMoney(a.debit)}</TableCell>
                          <TableCell align="right">{fmtMoney(a.credit)}</TableCell>
                          <TableCell align="right">{fmtMoney(a.balance)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </Box>
      </LocalizationProvider>
    </RouteGuard>
  )
}
