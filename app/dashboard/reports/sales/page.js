'use client'

import { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box, Card, CardContent, Grid, Typography, Paper, Button,
  FormControl, InputLabel, Select, MenuItem, TextField,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Menu, Divider, CircularProgress, LinearProgress, Tabs, Tab,
} from '@mui/material'
import {
  Refresh, FilterList, Download, TrendingUp, TrendingDown,
  AttachMoney, Receipt, Assessment, CalendarToday,
  BarChart as BarIcon, PieChart as PieIcon, Person, ShoppingCart,
  AccountBalance, CreditCard, Warning, CheckCircle, SwapHoriz,
} from '@mui/icons-material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line,
} from 'recharts'
import { fetchSalesReports, fetchFinancialReports } from '../../../store/slices/reportsSlice'
import RouteGuard from '../../../../components/auth/RouteGuard'

// ─── Formatters ────────────────────────────────────────────────────────────────
const fmt    = (v, d = 0) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const fmtPKR = (v) => `PKR ${fmt(v)}`
const toStr  = (d) => { if (!d) return null; if (d instanceof Date) return d.toISOString().split('T')[0]; return d }
const today  = () => new Date()
const som    = () => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d }
const ago    = (n) => new Date(Date.now() - n * 86400000)

const PRESETS = {
  today:      { label: 'Today',         from: today,       to: today },
  this_month: { label: 'This Month',    from: som,         to: today },
  last_7:     { label: 'Last 7 Days',   from: ()=>ago(7),  to: today },
  last_30:    { label: 'Last 30 Days',  from: ()=>ago(30), to: today },
  last_90:    { label: 'Last 3 Months', from: ()=>ago(90), to: today },
  custom:     { label: 'Custom',        from: null,        to: null  },
}

const ML = {
  CASH: 'Cash', CARD: 'Card', CREDIT_CARD: 'Card', FULLY_CREDIT: 'Full Credit',
  PARTIAL: 'Partial', FULL_PAYMENT: 'Full Payment', OUTSTANDING_SETTLEMENT: 'Settlement',
}
const MC = {
  CASH: '#2e7d32', CARD: '#1565c0', CREDIT_CARD: '#1565c0', FULLY_CREDIT: '#c62828',
  PARTIAL: '#e65100', FULL_PAYMENT: '#2e7d32', OUTSTANDING_SETTLEMENT: '#6a1b9a',
}
const TT = { contentStyle: { background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, color: '#333', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' } }

// ─── Sub-components ────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent, icon, chip }) {
  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderLeft: `4px solid ${accent}`, borderRadius: 2, height: '100%', transition: 'box-shadow .2s', '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.08)' } }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: .8, fontWeight: 600, display: 'block' }}>{label}</Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: .5, color: 'text.primary', lineHeight: 1.2 }}>{value}</Typography>
            {sub  && <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: .3 }}>{sub}</Typography>}
            {chip && <Chip label={chip.label} size="small" sx={{ mt: .8, fontSize: '0.65rem', height: 18, bgcolor: chip.bg, color: chip.color, fontWeight: 700 }} />}
          </Box>
          <Box sx={{ bgcolor: `${accent}18`, borderRadius: '50%', p: 1.2, display: 'flex', flexShrink: 0, ml: 1 }}>
            <Box sx={{ color: accent, display: 'flex', fontSize: 22 }}>{icon}</Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

function SecTitle({ title, icon }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
    </Box>
  )
}

function PayBadge({ method, paymentType }) {
  const key = paymentType === 'OUTSTANDING_SETTLEMENT' ? 'OUTSTANDING_SETTLEMENT' : method
  const c = MC[key] || '#757575'; const lbl = ML[key] || method
  return <Chip label={lbl} size="small" sx={{ fontSize: '0.65rem', height: 20, fontWeight: 700, bgcolor: `${c}18`, color: c }} />
}

function StatBadge({ status, isSettlement }) {
  if (isSettlement) return <Chip label="Settlement" size="small" sx={{ fontSize: '0.65rem', height: 20, fontWeight: 700, bgcolor: '#f3e5f5', color: '#6a1b9a' }} />
  const m = { COMPLETED: { label: 'Paid', bg: '#e8f5e9', color: '#2e7d32' }, PENDING: { label: 'Pending', bg: '#fff3e0', color: '#e65100' }, PARTIAL: { label: 'Partial', bg: '#fff3e0', color: '#e65100' } }
  const s = m[status] || { label: status || 'N/A', bg: '#f5f5f5', color: '#757575' }
  return <Chip label={s.label} size="small" sx={{ fontSize: '0.65rem', height: 20, fontWeight: 700, bgcolor: s.bg, color: s.color }} />
}

const yFmt = (v) => { if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}M`; if (v >= 1_000) return `${Math.round(v/1_000)}k`; return v }

// ─── Zakat Tab ─────────────────────────────────────────────────────────────────
function ZakatTab({ netProfit, grossProfit, totalRevenue, totalCostOfGoods, totalExpenses, costPriceWarning, period }) {
  const zakatDue   = netProfit > 0 ? netProfit * 0.025 : 0
  const nisabPKR   = 100000
  const meetsNisab = netProfit >= nisabPKR

  const rows = [
    { label: 'Total Revenue (Sales)',     value: fmtPKR(totalRevenue),             color: '#1976d2' },
    { label: 'Cost of Goods Sold (COGS)', value: `\u2212 ${fmtPKR(totalCostOfGoods)}`, color: '#c62828' },
    { label: 'Gross Profit',              value: fmtPKR(grossProfit),              color: grossProfit >= 0 ? '#2e7d32' : '#c62828', bold: true },
    { label: 'Operating Expenses',        value: `\u2212 ${fmtPKR(totalExpenses)}`,    color: '#c62828' },
    { label: 'Net Profit',                value: fmtPKR(netProfit),               color: netProfit >= 0 ? '#2e7d32' : '#c62828', bold: true, divider: true },
    { label: 'Zakat Rate',                value: '2.5%',                           color: '#b8860b' },
    { label: 'Zakat Due on Net Profit',   value: fmtPKR(zakatDue),               color: '#b8860b', bold: true },
  ]

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Paper elevation={0} sx={{ background: 'linear-gradient(135deg, #1a472a 0%, #2d6a4f 50%, #40916c 100%)', borderRadius: 3, p: 4, mb: 3, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)' }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box sx={{ bgcolor: 'rgba(255,255,255,0.15)', borderRadius: '50%', p: 1.5, display: 'flex' }}>
            <Typography sx={{ fontSize: 24 }}>☪</Typography>
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Zakat Calculator</Typography>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>Islamic obligation — 2.5% of net profit · Period: {period}</Typography>
          </Box>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" sx={{ opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1, display: 'block' }}>Net Profit</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1 }}>{fmtPKR(netProfit)}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" sx={{ opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1, display: 'block' }}>Zakat Due (2.5%)</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.1, color: '#ffd700' }}>{fmtPKR(zakatDue)}</Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" sx={{ opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1, display: 'block' }}>Nisab Status</Typography>
            <Chip label={netProfit <= 0 ? 'No Profit' : meetsNisab ? 'Zakat Applicable' : 'Below Nisab Threshold'}
              sx={{ mt: .5, fontWeight: 700, fontSize: '.8rem', bgcolor: netProfit <= 0 ? 'rgba(255,255,255,0.15)' : meetsNisab ? '#ffd700' : 'rgba(255,255,255,0.15)', color: netProfit <= 0 ? '#fff' : meetsNisab ? '#1a472a' : '#fff' }} />
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* Calculation breakdown */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
            <SecTitle title="Profit & Zakat Calculation" icon={<Receipt />} />
            {costPriceWarning && (
              <Box sx={{ bgcolor: '#fff8e1', border: '1px solid #ffd54f', borderRadius: 1.5, p: 1.5, mb: 2, display: 'flex', gap: 1 }}>
                <Warning sx={{ color: '#f57c00', fontSize: 18, mt: .1, flexShrink: 0 }} />
                <Typography variant="caption" sx={{ color: '#e65100' }}>
                  Some items have no cost price set. Complete purchase orders for accurate COGS & profit figures.
                </Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {rows.map((row, i) => (
                <Box key={i}>
                  {row.divider && <Divider sx={{ my: 1, borderStyle: 'dashed' }} />}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.2, borderBottom: i < rows.length - 1 && !row.divider ? '1px solid' : 'none', borderColor: 'divider' }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '.85rem' }}>{row.label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: row.bold ? 800 : 600, color: row.color, fontSize: row.bold ? '.95rem' : '.85rem' }}>{row.value}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
            <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: zakatDue > 0 ? '#f0fdf4' : '#f5f5f5', border: '2px solid', borderColor: zakatDue > 0 ? '#4ade80' : 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, color: zakatDue > 0 ? '#166534' : 'text.secondary' }}>Total Zakat Due</Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {netProfit > 0 ? `${fmtPKR(netProfit)} \u00d7 2.5%` : 'No profit \u2014 Zakat not applicable'}
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: zakatDue > 0 ? '#166534' : 'text.disabled' }}>{fmtPKR(zakatDue)}</Typography>
            </Box>
          </Paper>
        </Grid>

        {/* How it works */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, height: '100%' }}>
            <SecTitle title="How Zakat is Calculated" icon={<Assessment />} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { step: '1', title: 'Calculate Revenue', desc: 'Sum of all sale_items.total = (unit_price \u00d7 quantity) \u2212 discount. This is what customers paid you.', color: '#1976d2' },
                { step: '2', title: 'Subtract COGS', desc: 'COGS = inventory_items.cost_price \u00d7 quantity. What you paid the supplier (set when purchase orders are completed).', color: '#c62828' },
                { step: '3', title: 'Gross Profit = Revenue \u2212 COGS', desc: 'Example: Royal Canin sold at PKR 2,500 \u00d7 5 = 12,500. Cost PKR 1,800 \u00d7 5 = 9,000. Gross Profit = 3,500.', color: '#2e7d32' },
                { step: '4', title: 'Net Profit = Gross Profit \u2212 Expenses', desc: 'Subtract operating expenses (rent, salaries, utilities) entered as expense vouchers.', color: '#e65100' },
                { step: '5', title: 'Zakat = Net Profit \u00d7 2.5%', desc: 'Zakat is due on net profit if it meets the Nisab threshold and has been held for one lunar year (Hawl).', color: '#b8860b' },
              ].map(item => (
                <Box key={item.step} sx={{ display: 'flex', gap: 2 }}>
                  <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: .2 }}>
                    <Typography sx={{ color: '#fff', fontSize: '.75rem', fontWeight: 800 }}>{item.step}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: item.color }}>{item.title}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.5 }}>{item.desc}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
            <Box sx={{ mt: 3, p: 2, bgcolor: '#fff8e1', borderRadius: 1.5, border: '1px solid #ffe082' }}>
              <Typography variant="caption" sx={{ color: '#795548', fontWeight: 600, display: 'block', mb: .5 }}>⚠ Important Notes</Typography>
              <Typography variant="caption" sx={{ color: '#795548', display: 'block', lineHeight: 1.6 }}>
                • Zakat is due only after one full lunar year (Hawl) has passed on the wealth.<br />
                • The Nisab threshold changes with gold/silver prices — consult a scholar for current value.<br />
                • This is an estimate based on recorded profit. Consult an Islamic scholar for your specific situation.
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Zakat summary cards */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            {[
              { label: 'Revenue',      value: fmtPKR(totalRevenue),      sub: 'Total invoiced',          accent: '#1976d2' },
              { label: 'COGS',         value: fmtPKR(totalCostOfGoods),  sub: 'Cost of goods sold',      accent: '#c62828' },
              { label: 'Gross Profit', value: fmtPKR(grossProfit),       sub: `${totalRevenue > 0 ? ((grossProfit/totalRevenue)*100).toFixed(1) : 0}% margin`, accent: '#2e7d32' },
              { label: 'Expenses',     value: fmtPKR(totalExpenses),     sub: 'Operating expenses',      accent: '#e65100' },
              { label: 'Net Profit',   value: fmtPKR(netProfit),         sub: 'Gross profit \u2212 expenses', accent: '#0288d1' },
              { label: 'Zakat Due',    value: fmtPKR(zakatDue),         sub: 'Net profit \u00d7 2.5%',       accent: '#b8860b' },
            ].map((c, i) => (
              <Grid item xs={6} sm={4} md={2} key={i}>
                <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderTop: `3px solid ${c.accent}`, borderRadius: 2, p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: .8, fontSize: '.65rem', display: 'block' }}>{c.label}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: c.accent, fontSize: '.95rem', mt: .5 }}>{c.value}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '.65rem' }}>{c.sub}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>
    </Box>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function SalesReportPage() {
  const dispatch = useDispatch()
  const { user } = useSelector(s => s.auth)
  const { salesReports, financialReports, isLoading } = useSelector(s => s.reports)
  const [exportAnchor, setExportAnchor] = useState(null)
  const [activePreset, setActivePreset] = useState('this_month')
  const [filters, setFilters] = useState({ dateFrom: som(), dateTo: today(), branch: 'all', cashier: 'all' })
  const [activeTab, setActiveTab] = useState(0)

  const buildSP = useCallback(() => ({
    dateRange: { start: toStr(filters.dateFrom), end: toStr(filters.dateTo) },
    ...(filters.branch  !== 'all' && { branch:  filters.branch }),
    ...(filters.cashier !== 'all' && { cashier: filters.cashier }),
  }), [filters])

  const buildFP = useCallback(() => ({ dateFrom: toStr(filters.dateFrom), dateTo: toStr(filters.dateTo) }), [filters])
  const loadAll = useCallback(() => { dispatch(fetchSalesReports(buildSP())); dispatch(fetchFinancialReports(buildFP())) }, [dispatch, buildSP, buildFP])
  useEffect(() => { loadAll() }, [loadAll])

  const applyPreset = (key) => {
    if (key === 'custom') { setActivePreset('custom'); return }
    const p = PRESETS[key]; setActivePreset(key)
    setFilters(prev => ({ ...prev, dateFrom: p.from(), dateTo: p.to() }))
  }

  // ── Extract data ─────────────────────────────────────────────────────────────
  const sr = salesReports || {}; const fr = financialReports || {}

  const totalRevenue       = Number(sr.totalRevenue       || 0)
  const totalTransactions  = Number(sr.totalTransactions  || 0)
  const avgTicket          = Number(sr.averageTicket      || 0)
  const cashSalesAmt       = Number(sr.cashSalesAmount    || sr.cashSales || 0)
  const cardSalesAmt       = Number(sr.cardSalesAmount    || sr.cardSales || 0)
  const fullyCreditTotal   = Number(sr.fullyCreditTotal   || 0)
  const partialTotal       = Number(sr.partialTotal       || 0)
  const partialCollected   = Number(sr.partialCollected   || 0)
  const partialCredit      = Number(sr.partialCredit      || 0)
  const totalCashReceived  = Number(sr.totalCashReceived  || 0)
  const totalOutstanding   = Number(sr.totalOutstanding   || sr.totalCreditGiven || 0)
  const fullyPaidCount     = Number(sr.fullyPaidCount     || 0)
  const fullyCreditCount   = Number(sr.fullyCreditCount   || 0)
  const partialCount       = Number(sr.partialCount       || 0)
  const discounts          = Number(sr.discounts          || 0)
  const outstandingSettled = Number(sr.outstandingSettled || 0)
  const outstandingSettlementCount = Number(sr.outstandingSettlementCount || 0)
  const refundTotal        = Number(sr.refundTotal        || sr.refunds || 0)
  const refundCount        = Number(sr.refundCount        || 0)
  const costPriceWarning   = Boolean(sr.costPriceWarning)

  // ── Profit chain ─────────────────────────────────────────────────────────────
  // Step 1: grossProfit = Revenue − COGS  (from sale_items JOIN inventory_items)
  // Step 2: netProfit   = grossProfit − expenses  (from financial_vouchers)
  // Step 3: zakatDue    = netProfit × 2.5%
  const grossProfit       = Number(fr.grossProfit       || sr.grossProfit       || 0)
  const totalCostOfGoods  = Number(fr.totalCostOfGoods  || sr.totalCostOfGoods  || 0)
  const grossProfitMargin = Number(fr.grossProfitMargin || sr.grossProfitMargin || 0)
  const totalExpenses     = Number(fr.totalExpenses     || 0)
  const netProfit         = Number(fr.netProfit         !== undefined ? fr.netProfit : (grossProfit - totalExpenses))
  const netProfitMargin   = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
  const zakatDue          = netProfit > 0 ? netProfit * 0.025 : 0
  const collectionRate    = totalRevenue > 0 ? (totalCashReceived / totalRevenue) * 100 : 0

  const salesByDate  = Array.isArray(sr.salesByDate)            ? sr.salesByDate            : []
  const recentSales  = Array.isArray(sr.recentSales)            ? sr.recentSales            : []
  const cashierList  = Array.isArray(sr.salesByCashierList)     ? sr.salesByCashierList     : Object.values(sr.salesByCashier || {})
  const branchList   = Array.isArray(sr.salesByBranchList)      ? sr.salesByBranchList      : Object.values(sr.salesByBranch  || {})
  const pmBreakdown  = Array.isArray(sr.paymentMethodBreakdown) ? sr.paymentMethodBreakdown : []
  const expBreakdown = Array.isArray(fr.expenseBreakdown)       ? fr.expenseBreakdown       : []
  const revByPeriod  = Array.isArray(fr.revenueByPeriod)        ? fr.revenueByPeriod        : []
  const topProducts  = Array.isArray(sr.topProducts)            ? sr.topProducts            : []

  const piePM   = pmBreakdown.filter(m => m.total > 0).map(m => ({ name: ML[m.method] || m.method, value: m.total, color: MC[m.method] || '#9e9e9e' }))
  const cfChart = salesByDate.map(d => ({ date: d.date ? d.date.slice(5) : '', collected: Number(d.collected || 0), credit: Number(d.credit || 0), total: Number(d.total || 0) }))
  const periodStr = `${toStr(filters.dateFrom) || '—'} to ${toStr(filters.dateTo) || '—'}`

  // ── Export CSV ───────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const csvRows = [
      ['Sales Report', periodStr], [],
      ['=== PROFIT SUMMARY ==='],
      ['Total Revenue', totalRevenue], ['COGS', totalCostOfGoods], ['Gross Profit', grossProfit],
      ['Gross Margin', `${grossProfitMargin.toFixed(1)}%`], ['Expenses', totalExpenses],
      ['Net Profit', netProfit], ['Net Margin', `${netProfitMargin.toFixed(1)}%`], ['Zakat Due (2.5%)', zakatDue], [],
      ['=== CASH FLOW ==='],
      ['Cash Collected', totalCashReceived], ['Outstanding', totalOutstanding],
      ['Credit Recovered', outstandingSettled], ['Refunds', refundTotal],
      ['Collection Rate', `${collectionRate.toFixed(1)}%`], [],
      ['=== PAYMENT BREAKDOWN ==='],
      ['Cash Sales', cashSalesAmt], ['Card Sales', cardSalesAmt],
      ['Full Credit', fullyCreditTotal, `${fullyCreditCount} txns`],
      ['Partial Collected', partialCollected, `${partialCount} txns`],
      ['Partial Outstanding', partialCredit], ['Discounts', discounts], [],
      ['=== DAILY SALES ==='], ['Date', 'Total', 'Collected', 'Credit', 'Txns'],
      ...salesByDate.map(r => [r.date, r.total, r.collected, r.credit, r.transactions]),
    ]
    const csv = csvRows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `sales-report-${toStr(filters.dateFrom)}-to-${toStr(filters.dateTo)}.csv`
    a.click(); setExportAnchor(null)
  }

  // ── Export PDF ───────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    const w = window.open('', '_blank')
    w.document.write(`<html><head><title>Sales Report</title><style>
      body{font-family:Arial;padding:30px;color:#333;font-size:13px}
      h1{color:#1976d2;border-bottom:3px solid #1976d2;padding-bottom:8px}
      h2{color:#1565c0;margin-top:20px;font-size:14px;border-left:4px solid #1976d2;padding-left:8px}
      .g{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}
      .c{border:1px solid #e0e0e0;border-radius:8px;padding:12px;text-align:center;background:#f8f9ff}
      .cv{font-size:1.2rem;font-weight:800;color:#1976d2}.cl{font-size:.7rem;color:#666;text-transform:uppercase}
      table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px}
      th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}
      th{background:#e3f2fd;color:#1565c0;font-weight:700;font-size:11px}
      tr:nth-child(even){background:#fafafa}
      .zakat{background:#f0fdf4;border:2px solid #4ade80;border-radius:8px;padding:16px;margin:12px 0}
    </style></head><body>
    <h1>Sales Report</h1>
    <p><strong>Period:</strong> ${periodStr} | <strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    <h2>P&amp;L Summary</h2>
    <div class="g">
      <div class="c"><div class="cv">PKR ${fmt(totalRevenue)}</div><div class="cl">Revenue</div></div>
      <div class="c"><div class="cv" style="color:#c62828">PKR ${fmt(totalCostOfGoods)}</div><div class="cl">COGS</div></div>
      <div class="c"><div class="cv" style="color:#2e7d32">PKR ${fmt(grossProfit)}</div><div class="cl">Gross Profit</div></div>
      <div class="c"><div class="cv" style="color:${netProfit>=0?'#2e7d32':'#c62828'}">PKR ${fmt(Math.abs(netProfit))}</div><div class="cl">Net ${netProfit>=0?'Profit':'Loss'}</div></div>
    </div>
    <div class="zakat"><strong style="color:#166534">Zakat Due (Net Profit x 2.5%) = PKR ${fmt(zakatDue)}</strong>${netProfit <= 0 ? '<br/><em style="color:#666">No profit - Zakat not applicable</em>' : ''}</div>
    <h2>Payment Breakdown</h2>
    <table><tr><th>Method</th><th>Invoiced</th><th>Collected</th><th>Outstanding</th><th>Count</th></tr>
      ${pmBreakdown.map(m=>`<tr><td>${ML[m.method]||m.method}</td><td>PKR ${fmt(m.total)}</td><td>PKR ${fmt(m.collected)}</td><td>PKR ${fmt(m.credit)}</td><td>${m.count}</td></tr>`).join('')}
    </table>
    <h2>Recent Transactions</h2>
    <table><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Total</th><th>Collected</th><th>Credit</th><th>Method</th></tr>
      ${recentSales.slice(0,20).map(r=>`<tr><td>${r.date}</td><td>${r.invoice_no}</td><td>${r.customer_name}</td><td>PKR ${fmt(r.total)}</td><td>PKR ${fmt(r.payment_amount)}</td><td>PKR ${fmt(r.credit_amount)}</td><td>${ML[r.payment_method]||r.payment_method}</td></tr>`).join('')}
    </table>
    </body></html>`)
    w.document.close(); setTimeout(() => w.print(), 400); setExportAnchor(null)
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <RouteGuard allowedRoles={['ADMIN', 'CASHIER', 'WAREHOUSE_KEEPER']}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={{ bgcolor: 'grey.50', minHeight: '100vh' }}>

          {/* Header + filters */}
          <Box sx={{ p: { xs: 2, md: 3 }, pb: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ color: 'primary.main', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600 }}>Reports / Sales</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mt: .5, letterSpacing: '-.5px' }}>Sales Report</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>Revenue · COGS · Gross Profit · Net Profit · Zakat</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button onClick={loadAll} disabled={isLoading} startIcon={isLoading ? <CircularProgress size={14} /> : <Refresh />} variant="outlined" size="small">{isLoading ? 'Loading…' : 'Refresh'}</Button>
                <Button onClick={e => setExportAnchor(e.currentTarget)} startIcon={<Download />} variant="contained" size="small">Export</Button>
                <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
                  <MenuItem onClick={handleExportCSV}>Export CSV</MenuItem>
                  <MenuItem onClick={handleExportPDF}>Export PDF</MenuItem>
                </Menu>
              </Box>
            </Box>

            {/* Presets */}
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <CalendarToday sx={{ fontSize: 15, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary', mr: 1 }}>Period:</Typography>
                {Object.entries(PRESETS).map(([key, p]) => (
                  <Chip key={key} label={p.label} size="small" onClick={() => applyPreset(key)}
                    color={activePreset === key ? 'primary' : 'default'} variant={activePreset === key ? 'filled' : 'outlined'}
                    sx={{ fontWeight: activePreset === key ? 700 : 400 }} />
                ))}
              </Box>
            </Paper>

            {/* Filters */}
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <FilterList sx={{ color: 'primary.main', fontSize: 18 }} />
                <Typography sx={{ fontWeight: 600, fontSize: '.875rem' }}>Filters</Typography>
              </Box>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6} md={3}>
                  <DatePicker enableAccessibleFieldDOMStructure={false} label="From Date" value={filters.dateFrom}
                    onChange={d => { setActivePreset('custom'); setFilters(p => ({ ...p, dateFrom: d })) }}
                    slots={{ textField: TextField }} slotProps={{ textField: { fullWidth: true, size: 'small' } }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <DatePicker enableAccessibleFieldDOMStructure={false} label="To Date" value={filters.dateTo}
                    onChange={d => { setActivePreset('custom'); setFilters(p => ({ ...p, dateTo: d })) }}
                    slots={{ textField: TextField }} slotProps={{ textField: { fullWidth: true, size: 'small' } }} />
                </Grid>
                {user?.role === 'ADMIN' && (
                  <Grid item xs={12} sm={6} md={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Branch / Scope</InputLabel>
                      <Select value={filters.branch} onChange={e => setFilters(p => ({ ...p, branch: e.target.value }))} label="Branch / Scope">
                        <MenuItem value="all">All</MenuItem>
                        {branchList.map(b => <MenuItem key={b.branch} value={b.branch}>{b.branch}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                <Grid item xs={12} sm={6} md={user?.role === 'ADMIN' ? 3 : 6}>
                  <Button variant="contained" fullWidth onClick={loadAll} disabled={isLoading}>Apply Filters</Button>
                </Grid>
              </Grid>
            </Paper>

            {/* Tabs */}
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, mb: 0 }}>
              <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}
                sx={{ px: 2, '& .MuiTab-root': { fontWeight: 600, fontSize: '.82rem', minHeight: 48 } }}>
                <Tab label="Sales Overview" icon={<BarIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
                <Tab label="Profit & Loss"  icon={<TrendingUp sx={{ fontSize: 16 }} />} iconPosition="start" />
                <Tab label={`Zakat${zakatDue > 0 ? ` · PKR ${fmt(zakatDue)}` : ''}`}
                  icon={<Typography sx={{ fontSize: 14 }}>☪</Typography>} iconPosition="start"
                  sx={{ color: zakatDue > 0 ? '#b8860b !important' : undefined }} />
              </Tabs>
            </Paper>
          </Box>

          {/* ── TAB 0: Sales Overview ──────────────────────────────────────── */}
          {activeTab === 0 && (
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              {costPriceWarning && (
                <Box sx={{ bgcolor: '#fff8e1', border: '1px solid #ffd54f', borderRadius: 1.5, p: 1.5, mb: 2, display: 'flex', gap: 1 }}>
                  <Warning sx={{ color: '#f57c00', fontSize: 18, flexShrink: 0, mt: .1 }} />
                  <Typography variant="caption" sx={{ color: '#e65100' }}>
                    Some inventory items have no cost price. Profit may be understated. Complete purchase orders to fix this.
                  </Typography>
                </Box>
              )}

              {/* KPI Row 1 */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <KpiCard label="Total Invoiced" value={fmtPKR(totalRevenue)} sub={`${fmt(totalTransactions)} real sales`} accent="#1976d2" icon={<AttachMoney />} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <KpiCard label="Cash Collected" value={fmtPKR(totalCashReceived)} sub={`${collectionRate.toFixed(1)}% of invoiced`} accent="#2e7d32" icon={<CheckCircle />}
                    chip={{ label: `${fullyPaidCount} fully paid`, bg: '#e8f5e9', color: '#2e7d32' }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <KpiCard label="Total Outstanding" value={fmtPKR(totalOutstanding)} sub={`${fullyCreditCount} credit · ${partialCount} partial`} accent="#c62828" icon={<Warning />}
                    chip={{ label: `${fullyCreditCount + partialCount} unpaid`, bg: '#ffebee', color: '#c62828' }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  {/* FIXED: shows Gross Profit (Revenue - COGS), not Revenue - 0 */}
                  <KpiCard
                    label="Gross Profit (Revenue − COGS)"
                    value={fmtPKR(grossProfit)}
                    sub={costPriceWarning
                      ? `⚠ ${grossProfitMargin.toFixed(1)}% margin — some cost prices missing`
                      : totalCostOfGoods > 0
                        ? `${grossProfitMargin.toFixed(1)}% margin · COGS PKR ${fmt(totalCostOfGoods)}`
                        : `No cost prices set — complete purchase orders`}
                    accent={grossProfit >= 0 ? '#2e7d32' : '#c62828'}
                    icon={grossProfit >= 0 ? <TrendingUp /> : <TrendingDown />}
                  />
                </Grid>
              </Grid>

              {/* KPI Row 2 */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6} sm={3}><KpiCard label="Cash Sales"    value={fmtPKR(cashSalesAmt)}    sub="Fully collected"                   accent="#388e3c" icon={<AttachMoney />} /></Grid>
                <Grid item xs={6} sm={3}><KpiCard label="Card Sales"    value={fmtPKR(cardSalesAmt)}    sub="Fully collected"                   accent="#1565c0" icon={<CreditCard />} /></Grid>
                <Grid item xs={6} sm={3}><KpiCard label="Full Credit"   value={fmtPKR(fullyCreditTotal)} sub={`${fullyCreditCount} invoices · 0 collected`} accent="#c62828" icon={<AccountBalance />} /></Grid>
                <Grid item xs={6} sm={3}><KpiCard label="Partial Sales" value={fmtPKR(partialTotal)}    sub={partialCount > 0 ? `Collected ${fmtPKR(partialCollected)} · Due ${fmtPKR(partialCredit)}` : `${partialCount} partial sales`} accent="#e65100" icon={<Receipt />} /></Grid>
              </Grid>

              {/* KPI Row 3 */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={3}><KpiCard label="Credit Recovered" value={fmtPKR(outstandingSettled)} sub={`${outstandingSettlementCount} settlement${outstandingSettlementCount !== 1 ? 's' : ''}`} accent="#6a1b9a" icon={<SwapHoriz />} /></Grid>
                <Grid item xs={6} sm={3}><KpiCard label="Refunds Issued"   value={fmtPKR(refundTotal)}        sub={`${refundCount} refund${refundCount !== 1 ? 's' : ''}`}                                   accent="#b71c1c" icon={<TrendingDown />} /></Grid>
                <Grid item xs={6} sm={3}><KpiCard label="Discounts Given"  value={fmtPKR(discounts)}          sub="Total discount on sales"                                                                    accent="#f57c00" icon={<Receipt />} /></Grid>
                <Grid item xs={6} sm={3}><KpiCard label="Avg Ticket"       value={fmtPKR(avgTicket)}           sub="Per real sale"                                                                              accent="#0288d1" icon={<ShoppingCart />} /></Grid>
              </Grid>

              {/* Charts Row 1 — Daily bar chart full width */}
              <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                <Grid item xs={12}>
                  <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
                    <SecTitle title="Daily: Collected vs Credit Given" icon={<BarIcon />} />
                    {cfChart.length === 0 ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'text.disabled' }}>
                        <Typography>No data in period</Typography>
                      </Box>
                    ) : (
                      <ResponsiveContainer width="100%" height={340}>
                        <BarChart data={cfChart} margin={{ top: 10, right: 30, left: 10, bottom: 20 }} barGap={6} barCategoryGap="30%">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: '#9e9e9e', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }}
                            interval={cfChart.length > 20 ? Math.floor(cfChart.length / 10) : 0}
                            angle={cfChart.length > 15 ? -35 : 0}
                            textAnchor={cfChart.length > 15 ? 'end' : 'middle'}
                            height={cfChart.length > 15 ? 50 : 30} />
                          <YAxis tick={{ fill: '#9e9e9e', fontSize: 12 }} tickFormatter={yFmt} width={62} tickLine={false} axisLine={false} />
                          <Tooltip {...TT} formatter={(v, name) => [`PKR ${fmt(v)}`, name]} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                          <Legend iconSize={12} wrapperStyle={{ fontSize: 13, paddingTop: 12 }} iconType="circle" />
                          <Bar name="Collected"    dataKey="collected" fill="#2e7d32" radius={[5,5,0,0]} maxBarSize={52} />
                          <Bar name="Credit Given" dataKey="credit"    fill="#ef5350" radius={[5,5,0,0]} maxBarSize={52} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Paper>
                </Grid>
              </Grid>

              {/* Charts Row 2 — Payment Methods horizontal */}
              <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
                <Grid item xs={12}>
                  <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
                    <SecTitle title="Payment Methods Breakdown" icon={<PieIcon />} />
                    <Grid container spacing={3} alignItems="center">
                      <Grid item xs={12} md={4}>
                        {piePM.length === 0 ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, color: 'text.disabled' }}>
                            <Typography variant="body2">No data</Typography>
                          </Box>
                        ) : (
                          <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                              <Pie data={piePM} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3} labelLine={false}>
                                {piePM.map((e, i) => <Cell key={i} fill={e.color} />)}
                              </Pie>
                              <Tooltip {...TT} formatter={v => [`PKR ${fmt(v)}`, '']} />
                              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} iconType="circle" />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </Grid>
                      <Grid item xs={12} md={8}>
                        <Grid container spacing={1.5}>
                          {pmBreakdown.map((m, i) => {
                            const pct = totalRevenue > 0 ? ((m.total / totalRevenue) * 100).toFixed(1) : '0.0'
                            const c   = MC[m.method] || '#9e9e9e'
                            return (
                              <Grid item xs={12} sm={6} key={i}>
                                <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', borderLeft: `4px solid ${c}` }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700, color: c }}>{ML[m.method] || m.method}</Typography>
                                    <Chip label={`${m.count} txn${m.count !== 1 ? 's' : ''}`} size="small" sx={{ fontSize: '.65rem', height: 18, bgcolor: `${c}15`, color: c, fontWeight: 700 }} />
                                  </Box>
                                  <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '1rem' }}>PKR {fmt(m.total)}</Typography>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                    <Typography variant="caption" color="text.disabled">{pct}% of total</Typography>
                                    {m.credit > 0 && <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 600 }}>Due: PKR {fmt(m.credit)}</Typography>}
                                  </Box>
                                  <LinearProgress variant="determinate" value={Math.min(parseFloat(pct), 100)}
                                    sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: 'grey.100', '& .MuiLinearProgress-bar': { bgcolor: c, borderRadius: 2 } }} />
                                </Paper>
                              </Grid>
                            )
                          })}
                        </Grid>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              </Grid>

              {/* Charts Row 3 — Daily Trend + Cashier full width */}
              <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid item xs={12}>
                  <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
                    <SecTitle title="Daily Sales Trend" icon={<BarIcon />} />
                    {salesByDate.length === 0 ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: 'text.disabled' }}>
                        <Typography>No data</Typography>
                      </Box>
                    ) : (
                      <ResponsiveContainer width="100%" height={320}>
                        <AreaChart data={salesByDate} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                          <defs>
                            <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#1976d2" stopOpacity={0.12} />
                              <stop offset="95%" stopColor="#1976d2" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gCollected" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#2e7d32" stopOpacity={0.10} />
                              <stop offset="95%" stopColor="#2e7d32" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: '#9e9e9e', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#e0e0e0' }}
                            interval={salesByDate.length > 20 ? Math.floor(salesByDate.length / 10) : 0}
                            angle={salesByDate.length > 15 ? -35 : 0}
                            textAnchor={salesByDate.length > 15 ? 'end' : 'middle'}
                            height={salesByDate.length > 15 ? 50 : 30} />
                          <YAxis tick={{ fill: '#9e9e9e', fontSize: 12 }} tickFormatter={yFmt} width={62} tickLine={false} axisLine={false} />
                          <Tooltip {...TT} formatter={(v, name) => [`PKR ${fmt(v)}`, name]} />
                          <Legend iconSize={12} wrapperStyle={{ fontSize: 13, paddingTop: 12 }} iconType="circle" />
                          <Area name="Total"     type="monotone" dataKey="total"     stroke="#1976d2" strokeWidth={2.5} fill="url(#gTotal)"     dot={false} activeDot={{ r: 5 }} />
                          <Area name="Collected" type="monotone" dataKey="collected" stroke="#2e7d32" strokeWidth={2}   fill="url(#gCollected)" dot={false} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
                    <SecTitle title="Cashier Performance" icon={<Person />} />
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'grey.50' }}>
                            {['Cashier', 'Invoiced', 'Collected', 'Outstanding', 'Txns', 'Collection %'].map(h => (
                              <TableCell key={h} align={h === 'Cashier' ? 'left' : 'right'}
                                sx={{ color: 'primary.dark', fontWeight: 700, fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: .5, py: 1.5, borderBottom: '2px solid', borderColor: 'primary.100' }}>
                                {h}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {cashierList.length === 0 ? (
                            <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.disabled' }}>No data</TableCell></TableRow>
                          ) : cashierList.map((row, i) => {
                            const colRate = row.total > 0 ? (row.collected / row.total) * 100 : 0
                            return (
                              <TableRow key={i} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                                <TableCell sx={{ py: 1.8 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.85rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                                      {(row.cashier || '?').charAt(0).toUpperCase()}
                                    </Box>
                                    <Typography sx={{ fontWeight: 600, fontSize: '.9rem' }}>{row.cashier}</Typography>
                                  </Box>
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, color: 'primary.main', fontSize: '.9rem' }}>PKR {fmt(row.total)}</TableCell>
                                <TableCell align="right" sx={{ color: 'success.dark', fontWeight: 600, fontSize: '.9rem' }}>PKR {fmt(row.collected)}</TableCell>
                                <TableCell align="right" sx={{ color: row.credit > 0 ? 'error.main' : 'text.disabled', fontWeight: row.credit > 0 ? 700 : 400, fontSize: '.9rem' }}>
                                  {row.credit > 0 ? `PKR ${fmt(row.credit)}` : '—'}
                                </TableCell>
                                <TableCell align="right" sx={{ color: 'text.secondary', fontSize: '.9rem' }}>{row.transactions}</TableCell>
                                <TableCell align="right">
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1.5 }}>
                                    <LinearProgress variant="determinate" value={Math.min(colRate, 100)}
                                      sx={{ width: 90, height: 7, borderRadius: 4, bgcolor: 'grey.200',
                                        '& .MuiLinearProgress-bar': { bgcolor: colRate >= 80 ? '#2e7d32' : colRate >= 50 ? '#e65100' : '#c62828', borderRadius: 4 } }} />
                                    <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 44, fontSize: '.82rem' }}>{colRate.toFixed(1)}%</Typography>
                                  </Box>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                </Grid>
              </Grid>
              {/* Recent Transactions */}
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5, mb: 3 }}>
                <SecTitle title="Recent Transactions" icon={<ShoppingCart />} />
                <TableContainer sx={{ maxHeight: 440 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Date','Invoice','Customer','Cashier','Total','Collected','Outstanding','Method','Status'].map(h => (
                          <TableCell key={h} sx={{ bgcolor:'primary.50', color:'primary.dark', fontWeight:700, fontSize:'.68rem', textTransform:'uppercase', letterSpacing:.5, whiteSpace:'nowrap' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentSales.length === 0
                        ? <TableRow><TableCell colSpan={9} align="center" sx={{ py:5, color:'text.disabled' }}>No transactions</TableCell></TableRow>
                        : recentSales.map((row, i) => (
                          <TableRow key={i} sx={{ '&:hover':{ bgcolor:'action.hover' }, bgcolor: row.is_settlement ? '#f8f0ff' : row.credit_amount>0&&row.payment_amount===0 ? '#fff8f8' : 'inherit' }}>
                            <TableCell sx={{ fontSize:'.75rem', color:'text.secondary', whiteSpace:'nowrap' }}>{row.date}</TableCell>
                            <TableCell sx={{ fontSize:'.75rem', fontWeight:600, whiteSpace:'nowrap', color:row.is_settlement?'#6a1b9a':'primary.main' }}>{row.invoice_no}</TableCell>
                            <TableCell sx={{ fontSize:'.78rem', maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              <Box>
                                <Typography variant="body2" sx={{ fontSize:'.78rem', fontWeight:500 }}>{row.customer_name}</Typography>
                                {row.customer_phone && <Typography variant="caption" color="text.disabled">{row.customer_phone}</Typography>}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ fontSize:'.75rem', color:'text.secondary' }}>{row.cashier_name}</TableCell>
                            <TableCell sx={{ fontSize:'.8rem', fontWeight:700, whiteSpace:'nowrap' }}>{row.is_settlement ? '—' : `PKR ${fmt(row.total)}`}</TableCell>
                            <TableCell sx={{ fontSize:'.8rem', fontWeight:600, color:'success.dark', whiteSpace:'nowrap' }}>PKR {fmt(row.payment_amount)}</TableCell>
                            <TableCell sx={{ fontSize:'.8rem', fontWeight:row.credit_amount>0?700:400, color:row.credit_amount>0?'error.main':'text.disabled', whiteSpace:'nowrap' }}>
                              {row.credit_amount > 0 ? `PKR ${fmt(row.credit_amount)}` : '—'}
                            </TableCell>
                            <TableCell><PayBadge method={row.payment_method} paymentType={row.payment_type} /></TableCell>
                            <TableCell><StatBadge status={row.payment_status} isSettlement={row.is_settlement} /></TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {/* Branch Breakdown */}
              {branchList.length > 1 && (
                <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5, mb: 3 }}>
                  <SecTitle title="Branch Breakdown" icon={<Assessment />} />
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {['Branch','Invoiced','Collected','Outstanding','Txns','Collection %'].map(h => (
                            <TableCell key={h} align={h==='Branch'?'left':'right'} sx={{ bgcolor:'primary.50', color:'primary.dark', fontWeight:700, fontSize:'.7rem', textTransform:'uppercase' }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {branchList.map((row, i) => {
                          const rate = row.total > 0 ? ((row.collected/row.total)*100).toFixed(1) : '0.0'
                          return (
                            <TableRow key={i} sx={{ '&:hover':{ bgcolor:'action.hover' } }}>
                              <TableCell sx={{ fontWeight:600, fontSize:'.82rem' }}>{row.branch}</TableCell>
                              <TableCell align="right" sx={{ fontWeight:700, color:'primary.main', fontSize:'.82rem' }}>PKR {fmt(row.total)}</TableCell>
                              <TableCell align="right" sx={{ color:'success.dark', fontWeight:600, fontSize:'.82rem' }}>PKR {fmt(row.collected)}</TableCell>
                              <TableCell align="right" sx={{ color:row.credit>0?'error.main':'text.disabled', fontWeight:row.credit>0?700:400, fontSize:'.82rem' }}>PKR {fmt(row.credit)}</TableCell>
                              <TableCell align="right" sx={{ fontSize:'.82rem', color:'text.secondary' }}>{row.transactions}</TableCell>
                              <TableCell align="right">
                                <Box sx={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:1 }}>
                                  <LinearProgress variant="determinate" value={Math.min(parseFloat(rate),100)} sx={{ width:60, height:6, borderRadius:3, bgcolor:'grey.200', '& .MuiLinearProgress-bar':{ bgcolor:parseFloat(rate)>=80?'#2e7d32':parseFloat(rate)>=50?'#e65100':'#c62828', borderRadius:3 } }} />
                                  <Typography variant="caption" sx={{ fontWeight:700, minWidth:36 }}>{rate}%</Typography>
                                </Box>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}

              {/* Top Products — now includes COGS and Gross Profit columns */}
              {topProducts.length > 0 && (
                <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5 }}>
                  <SecTitle title="Top Products" icon={<ShoppingCart />} />
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          {['#','Product','Units Sold','Revenue','COGS','Gross Profit'].map(h => (
                            <TableCell key={h} sx={{ bgcolor:'primary.50', color:'primary.dark', fontWeight:700, fontSize:'.7rem', textTransform:'uppercase' }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {topProducts.map((row, i) => (
                          <TableRow key={i} sx={{ '&:hover':{ bgcolor:'action.hover' } }}>
                            <TableCell sx={{ color:'text.disabled', fontSize:'.78rem', width:40 }}>{i+1}</TableCell>
                            <TableCell sx={{ fontWeight:600, fontSize:'.82rem' }}>{row.name}</TableCell>
                            <TableCell sx={{ fontSize:'.82rem', color:'text.secondary' }}>{fmt(row.sold)}</TableCell>
                            <TableCell sx={{ fontWeight:700, color:'primary.main', fontSize:'.82rem' }}>PKR {fmt(row.revenue)}</TableCell>
                            <TableCell sx={{ fontSize:'.82rem', color:'error.main' }}>PKR {fmt(row.cost || 0)}</TableCell>
                            <TableCell sx={{ fontWeight:700, color:(row.grossProfit||0)>=0?'success.dark':'error.main', fontSize:'.82rem' }}>PKR {fmt(row.grossProfit || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}
            </Box>
          )}

          {/* ── TAB 1: Profit & Loss ───────────────────────────────────────── */}
          {activeTab === 1 && (
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              {/* P&L Banner */}
              <Paper elevation={0} sx={{ border:'2px solid', borderRadius:2, p:3, mb:3, borderColor:netProfit>=0?'success.light':'error.light', bgcolor:netProfit>=0?'#f1f8f2':'#fdf2f2' }}>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <Box sx={{ display:'flex', alignItems:'center', gap:2 }}>
                      <Box sx={{ bgcolor:netProfit>=0?'success.main':'error.main', borderRadius:'50%', p:1.5, display:'flex' }}>
                        {netProfit>=0 ? <TrendingUp sx={{ color:'#fff', fontSize:28 }} /> : <TrendingDown sx={{ color:'#fff', fontSize:28 }} />}
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color:'text.secondary', textTransform:'uppercase', letterSpacing:1, fontWeight:600 }}>
                          Net {netProfit>=0?'Profit':'Loss'}{totalExpenses===0?' (No expenses recorded)':''}
                        </Typography>
                        <Typography variant="h3" sx={{ fontWeight:800, color:netProfit>=0?'success.dark':'error.dark', lineHeight:1 }}>PKR {fmt(Math.abs(netProfit))}</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt:.5 }}>{netProfitMargin.toFixed(1)}% net margin · {collectionRate.toFixed(1)}% collected</Typography>
                        {zakatDue > 0 && <Typography variant="caption" sx={{ color:'#b8860b', display:'block', mt:.5, fontWeight:600 }}>☪ Zakat due: PKR {fmt(zakatDue)}</Typography>}
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Grid container spacing={2}>
                      {[
                        { label:'Revenue',       value:fmtPKR(totalRevenue),      color:'primary.main' },
                        { label:'COGS',          value:fmtPKR(totalCostOfGoods),  color:'error.main'   },
                        { label:'Gross Profit',  value:fmtPKR(grossProfit),       color:'success.dark' },
                        { label:'Expenses',      value:fmtPKR(totalExpenses),     color:'error.main'   },
                        { label:'Cash Collected',value:fmtPKR(totalCashReceived), color:'success.dark' },
                        { label:'Outstanding',   value:fmtPKR(totalOutstanding),  color:'error.main'   },
                      ].map(item => (
                        <Grid item xs={6} sm={4} key={item.label}>
                          <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                          <Typography variant="body2" sx={{ fontWeight:700, color:item.color }}>{item.value}</Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                </Grid>
              </Paper>

              {/* Charts */}
              <Grid container spacing={2.5} sx={{ mb: 3 }}>
                <Grid item xs={12} md={7}>
                  <Paper elevation={0} sx={{ border:'1px solid', borderColor:'divider', borderRadius:2, p:2.5 }}>
                    <SecTitle title="Revenue vs Expenses (Monthly)" icon={<TrendingUp />} />
                    {revByPeriod.length === 0 ? <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:260, color:'text.disabled' }}><Typography>No monthly data</Typography></Box> : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={revByPeriod} margin={{ top:10, right:20, left:10, bottom:5 }} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="month" tick={{ fill:'#9e9e9e', fontSize:11 }} />
                          <YAxis tick={{ fill:'#9e9e9e', fontSize:11 }} tickFormatter={yFmt} width={55} />
                          <Tooltip {...TT} formatter={(v, name) => [`PKR ${fmt(v)}`, name]} />
                          <Legend iconSize={10} wrapperStyle={{ fontSize:12 }} />
                          <Bar name="Revenue"  dataKey="revenue"  fill="#1976d2" radius={[4,4,0,0]} maxBarSize={30} />
                          <Bar name="Expenses" dataKey="expenses" fill="#ef5350" radius={[4,4,0,0]} maxBarSize={30} />
                          <Bar name="Profit"   dataKey="profit"   fill="#2e7d32" radius={[4,4,0,0]} maxBarSize={30} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </Paper>
                </Grid>
                <Grid item xs={12} md={5}>
                  <Paper elevation={0} sx={{ border:'1px solid', borderColor:'divider', borderRadius:2, p:2.5, height:'100%' }}>
                    <SecTitle title="Expense Breakdown" icon={<Receipt />} />
                    {expBreakdown.length === 0 ? (
                      <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:230, gap:1 }}>
                        <Receipt sx={{ fontSize:40, color:'text.disabled' }} />
                        <Typography color="text.disabled" variant="body2">No expense vouchers in period</Typography>
                        <Typography color="text.disabled" variant="caption" sx={{ textAlign:'center', maxWidth:240 }}>Add expense vouchers (rent, salaries, utilities) to see accurate net profit</Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display:'flex', flexDirection:'column', gap:0 }}>
                        {expBreakdown.slice(0,8).map((item, i) => (
                          <Box key={i} sx={{ py:1.2, borderBottom:i<expBreakdown.length-1?'1px solid':'none', borderColor:'divider' }}>
                            <Box sx={{ display:'flex', justifyContent:'space-between', mb:.4 }}>
                              <Typography variant="body2" sx={{ color:'text.secondary', fontSize:'.8rem' }}>{item.category}</Typography>
                              <Typography variant="body2" sx={{ fontWeight:700, fontSize:'.8rem' }}>PKR {fmt(item.amount)}</Typography>
                            </Box>
                            <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                              <LinearProgress variant="determinate" value={item.percentage} sx={{ flex:1, height:4, borderRadius:2, bgcolor:'grey.200', '& .MuiLinearProgress-bar':{ bgcolor:item.color||'#1976d2', borderRadius:2 } }} />
                              <Typography variant="caption" sx={{ color:'text.disabled', minWidth:32 }}>{item.percentage}%</Typography>
                            </Box>
                          </Box>
                        ))}
                        <Box sx={{ display:'flex', justifyContent:'space-between', pt:1.5, mt:.5, borderTop:'2px solid', borderColor:'error.main' }}>
                          <Typography variant="body2" sx={{ fontWeight:700 }}>Total Expenses</Typography>
                          <Typography variant="body2" sx={{ fontWeight:700, color:'error.main' }}>PKR {fmt(totalExpenses)}</Typography>
                        </Box>
                      </Box>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* ── TAB 2: Zakat ──────────────────────────────────────────────── */}
          {activeTab === 2 && (
            <ZakatTab
              netProfit={netProfit}
              grossProfit={grossProfit}
              totalRevenue={totalRevenue}
              totalCostOfGoods={totalCostOfGoods}
              totalExpenses={totalExpenses}
              costPriceWarning={costPriceWarning}
              period={periodStr}
            />
          )}

        </Box>
      </LocalizationProvider>
    </RouteGuard>
  )
}