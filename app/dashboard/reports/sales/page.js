'use client'

import { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  Box, Card, CardContent, Grid, Typography, Paper, Button,
  Alert, FormControl, InputLabel, Select, MenuItem, TextField,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Menu, Divider, CircularProgress, LinearProgress,
} from '@mui/material'
import {
  Refresh, FilterList, Download, TrendingUp, TrendingDown,
  AttachMoney, Receipt, Assessment, CalendarToday,
  BarChart as BarIcon, PieChart as PieIcon, Person, ShoppingCart,
  AccountBalance, CreditCard, Warning, CheckCircle,
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

const ML = { CASH:'Cash', CARD:'Card', CREDIT_CARD:'Card', FULLY_CREDIT:'Full Credit', PARTIAL:'Partial', FULL_PAYMENT:'Full Payment' }
const MC = { CASH:'#2e7d32', CARD:'#1565c0', CREDIT_CARD:'#1565c0', FULLY_CREDIT:'#c62828', PARTIAL:'#e65100', FULL_PAYMENT:'#2e7d32' }
const TT = { contentStyle: { background:'#fff', border:'1px solid #e0e0e0', borderRadius:8, color:'#333', fontSize:12, boxShadow:'0 4px 20px rgba(0,0,0,0.1)' } }

function KpiCard({ label, value, sub, accent, icon, chip }) {
  return (
    <Card elevation={0} sx={{ border:'1px solid', borderColor:'divider', borderLeft:`4px solid ${accent}`, borderRadius:2, height:'100%', transition:'box-shadow .2s', '&:hover':{ boxShadow:'0 4px 20px rgba(0,0,0,0.08)' } }}>
      <CardContent sx={{ p:2.5 }}>
        <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <Box sx={{ flex:1, minWidth:0 }}>
            <Typography variant="caption" sx={{ color:'text.secondary', textTransform:'uppercase', letterSpacing:.8, fontWeight:600, display:'block' }}>{label}</Typography>
            <Typography variant="h5" sx={{ fontWeight:800, mt:.5, color:'text.primary', lineHeight:1.2 }}>{value}</Typography>
            {sub  && <Typography variant="caption" sx={{ color:'text.secondary', display:'block', mt:.3 }}>{sub}</Typography>}
            {chip && <Chip label={chip.label} size="small" sx={{ mt:.8, fontSize:'0.65rem', height:18, bgcolor:chip.bg, color:chip.color, fontWeight:700 }} />}
          </Box>
          <Box sx={{ bgcolor:`${accent}18`, borderRadius:'50%', p:1.2, display:'flex', flexShrink:0, ml:1 }}>
            <Box sx={{ color:accent, display:'flex', fontSize:22 }}>{icon}</Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

function SecTitle({ title, icon }) {
  return (
    <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
      <Box sx={{ color:'primary.main', display:'flex' }}>{icon}</Box>
      <Typography variant="subtitle1" sx={{ fontWeight:700 }}>{title}</Typography>
    </Box>
  )
}

function PayBadge({ method }) {
  const c = MC[method] || '#757575'
  return <Chip label={ML[method]||method} size="small" sx={{ fontSize:'0.65rem', height:20, fontWeight:700, bgcolor:`${c}18`, color:c }} />
}

function StatBadge({ status }) {
  const m = { COMPLETED:{label:'Paid',bg:'#e8f5e9',color:'#2e7d32'}, PENDING:{label:'Pending',bg:'#fff3e0',color:'#e65100'} }
  const s = m[status] || { label: status||'N/A', bg:'#f5f5f5', color:'#757575' }
  return <Chip label={s.label} size="small" sx={{ fontSize:'0.65rem', height:20, fontWeight:700, bgcolor:s.bg, color:s.color }} />
}

export default function SalesReportPage() {
  const dispatch = useDispatch()
  const { user } = useSelector(s => s.auth)
  const { salesReports, financialReports, isLoading } = useSelector(s => s.reports)
  const [exportAnchor, setExportAnchor] = useState(null)
  const [activePreset, setActivePreset] = useState('this_month')
  const [filters, setFilters] = useState({ dateFrom: som(), dateTo: today(), branch:'all', cashier:'all' })

  const buildSP = useCallback(() => ({
    dateRange: { start: toStr(filters.dateFrom), end: toStr(filters.dateTo) },
    ...(filters.branch  !== 'all' && { branch:  filters.branch }),
    ...(filters.cashier !== 'all' && { cashier: filters.cashier }),
  }), [filters])

  const buildFP = useCallback(() => ({ dateFrom: toStr(filters.dateFrom), dateTo: toStr(filters.dateTo) }), [filters])

  const loadAll = useCallback(() => {
    dispatch(fetchSalesReports(buildSP()))
    dispatch(fetchFinancialReports(buildFP()))
  }, [dispatch, buildSP, buildFP])

  useEffect(() => { loadAll() }, [loadAll])

  const applyPreset = (key) => {
    if (key === 'custom') { setActivePreset('custom'); return }
    const p = PRESETS[key]
    setActivePreset(key)
    setFilters(prev => ({ ...prev, dateFrom: p.from(), dateTo: p.to() }))
  }

  const sr = salesReports   || {}
  const fr = financialReports || {}

  const totalRevenue      = Number(sr.totalRevenue      || 0)
  const totalTransactions = Number(sr.totalTransactions || 0)
  const avgTicket         = Number(sr.averageTicket     || 0)
  const cashSalesAmt      = Number(sr.cashSalesAmount   || sr.cashSales || 0)
  const cardSalesAmt      = Number(sr.cardSalesAmount   || sr.cardSales || 0)
  const fullyCreditTotal  = Number(sr.fullyCreditTotal  || 0)
  const partialTotal      = Number(sr.partialTotal      || 0)
  const partialCollected  = Number(sr.partialCollected  || 0)
  const partialCredit     = Number(sr.partialCredit     || 0)
  const totalCashReceived = Number(sr.totalCashReceived || 0)
  const totalOutstanding  = Number(sr.totalOutstanding  || sr.totalCreditGiven || 0)
  const fullyPaidCount    = Number(sr.fullyPaidCount    || 0)
  const fullyCreditCount  = Number(sr.fullyCreditCount  || 0)
  const partialCount      = Number(sr.partialCount      || 0)
  const discounts         = Number(sr.discounts         || 0)
  const taxCollected      = Number(sr.taxCollected      || 0)
  const totalExpenses     = Number(fr.totalExpenses     || 0)
  const netProfit         = totalCashReceived - totalExpenses
  const profitMargin      = totalCashReceived > 0 ? (netProfit / totalCashReceived) * 100 : 0
  const collectionRate    = totalRevenue > 0 ? (totalCashReceived / totalRevenue) * 100 : 0

  const salesByDate    = Array.isArray(sr.salesByDate)            ? sr.salesByDate            : []
  const recentSales    = Array.isArray(sr.recentSales)            ? sr.recentSales            : []
  const cashierList    = Array.isArray(sr.salesByCashierList)     ? sr.salesByCashierList     : Object.values(sr.salesByCashier  || {})
  const branchList     = Array.isArray(sr.salesByBranchList)      ? sr.salesByBranchList      : Object.values(sr.salesByBranch   || {})
  const pmBreakdown    = Array.isArray(sr.paymentMethodBreakdown) ? sr.paymentMethodBreakdown : []
  const expBreakdown   = Array.isArray(fr.expenseBreakdown)       ? fr.expenseBreakdown       : []
  const revByPeriod    = Array.isArray(fr.revenueByPeriod)        ? fr.revenueByPeriod        : []
  const topProducts    = Array.isArray(sr.topProducts)            ? sr.topProducts            : []

  const piePM = pmBreakdown.filter(m => m.total > 0).map(m => ({ name: ML[m.method]||m.method, value: m.total, color: MC[m.method]||'#9e9e9e' }))
  const cfChart = salesByDate.map(d => ({ date: d.date.slice(5), collected: d.collected||0, credit: d.credit||0, total: d.total||0 }))

  const handleExportCSV = () => {
    const rows = [
      ['Sales Report', `${toStr(filters.dateFrom)} to ${toStr(filters.dateTo)}`],[],
      ['=== SUMMARY ==='],
      ['Total Invoice Value', totalRevenue],['Cash Collected', totalCashReceived],
      ['Total Outstanding', totalOutstanding],['Net Profit', netProfit],
      ['Profit Margin', `${profitMargin.toFixed(1)}%`],['Collection Rate', `${collectionRate.toFixed(1)}%`],
      ['Total Transactions', totalTransactions],['Avg Ticket', avgTicket.toFixed(0)],[],
      ['=== PAYMENT BREAKDOWN ==='],
      ['Cash Sales', cashSalesAmt, `${fullyPaidCount} txns`],['Card Sales', cardSalesAmt, ''],
      ['Full Credit', fullyCreditTotal, `${fullyCreditCount} txns`],
      ['Partial Collected', partialCollected, `${partialCount} txns`],['Partial Outstanding', partialCredit, ''],
      ['Discounts', discounts],[],
      ['=== DAILY SALES ==='],['Date','Total','Collected','Credit','Txns'],
      ...salesByDate.map(r => [r.date, r.total, r.collected, r.credit, r.transactions]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }))
    a.download = `sales-report-${toStr(filters.dateFrom)}-to-${toStr(filters.dateTo)}.csv`
    a.click(); setExportAnchor(null)
  }

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
    </style></head><body>
    <h1>Sales Report</h1>
    <p><strong>Period:</strong> ${toStr(filters.dateFrom)} → ${toStr(filters.dateTo)} | <strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    <div class="g">
      <div class="c"><div class="cv">PKR ${fmt(totalRevenue)}</div><div class="cl">Total Invoiced</div></div>
      <div class="c"><div class="cv" style="color:#2e7d32">PKR ${fmt(totalCashReceived)}</div><div class="cl">Collected</div></div>
      <div class="c"><div class="cv" style="color:#c62828">PKR ${fmt(totalOutstanding)}</div><div class="cl">Outstanding</div></div>
      <div class="c"><div class="cv" style="color:${netProfit>=0?'#2e7d32':'#c62828'}">PKR ${fmt(Math.abs(netProfit))}</div><div class="cl">Net ${netProfit>=0?'Profit':'Loss'}</div></div>
    </div>
    <h2>Payment Breakdown</h2>
    <table><tr><th>Method</th><th>Invoiced</th><th>Collected</th><th>Outstanding</th><th>Count</th></tr>
      ${pmBreakdown.map(m=>`<tr><td>${ML[m.method]||m.method}</td><td>PKR ${fmt(m.total)}</td><td>PKR ${fmt(m.collected)}</td><td>PKR ${fmt(m.credit)}</td><td>${m.count}</td></tr>`).join('')}
      <tr style="font-weight:bold;background:#e3f2fd"><td>TOTAL</td><td>PKR ${fmt(totalRevenue)}</td><td>PKR ${fmt(totalCashReceived)}</td><td>PKR ${fmt(totalOutstanding)}</td><td>${totalTransactions}</td></tr>
    </table>
    <h2>Cashier Performance</h2>
    <table><tr><th>Cashier</th><th>Invoiced</th><th>Collected</th><th>Outstanding</th><th>Txns</th></tr>
      ${cashierList.map(r=>`<tr><td>${r.cashier}</td><td>PKR ${fmt(r.total)}</td><td>PKR ${fmt(r.collected)}</td><td>PKR ${fmt(r.credit)}</td><td>${r.transactions}</td></tr>`).join('')}
    </table>
    <h2>Recent Transactions (last 20)</h2>
    <table><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Total</th><th>Collected</th><th>Credit</th><th>Method</th></tr>
      ${recentSales.slice(0,20).map(r=>`<tr><td>${r.date}</td><td>${r.invoice_no}</td><td>${r.customer_name}</td><td>PKR ${fmt(r.total)}</td><td>PKR ${fmt(r.payment_amount)}</td><td>PKR ${fmt(r.credit_amount)}</td><td>${ML[r.payment_method]||r.payment_method}</td></tr>`).join('')}
    </table>
    </body></html>`)
    w.document.close(); setTimeout(() => w.print(), 400); setExportAnchor(null)
  }

  return (
    <RouteGuard allowedRoles={['ADMIN','CASHIER','WAREHOUSE_KEEPER']}>
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={{ p:{ xs:2, md:3 }, bgcolor:'grey.50', minHeight:'100vh' }}>

          {/* Header */}
          <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', mb:3, flexWrap:'wrap', gap:2 }}>
            <Box>
              <Typography variant="caption" sx={{ color:'primary.main', textTransform:'uppercase', letterSpacing:1.5, fontWeight:600 }}>Reports / Sales</Typography>
              <Typography variant="h4" sx={{ fontWeight:800, color:'text.primary', mt:.5, letterSpacing:'-.5px' }}>Sales Report</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt:.5 }}>Revenue · Cash collected · Credit · Partial · Profit</Typography>
            </Box>
            <Box sx={{ display:'flex', gap:1.5, flexWrap:'wrap' }}>
              <Button onClick={loadAll} disabled={isLoading} startIcon={isLoading ? <CircularProgress size={14}/> : <Refresh/>} variant="outlined" size="small">
                {isLoading ? 'Loading…' : 'Refresh'}
              </Button>
              <Button onClick={e => setExportAnchor(e.currentTarget)} startIcon={<Download/>} variant="contained" size="small">Export</Button>
              <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
                <MenuItem onClick={handleExportCSV}>Export CSV</MenuItem>
                <MenuItem onClick={handleExportPDF}>Export PDF</MenuItem>
              </Menu>
            </Box>
          </Box>

          {/* Presets */}
          <Paper elevation={0} sx={{ border:'1px solid', borderColor:'divider', borderRadius:2, p:2, mb:2 }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, flexWrap:'wrap' }}>
              <CalendarToday sx={{ fontSize:15, color:'text.secondary' }}/>
              <Typography variant="body2" sx={{ fontWeight:600, color:'text.secondary', mr:1 }}>Period:</Typography>
              {Object.entries(PRESETS).map(([key,p]) => (
                <Chip key={key} label={p.label} size="small" onClick={() => applyPreset(key)}
                  color={activePreset===key?'primary':'default'} variant={activePreset===key?'filled':'outlined'}
                  sx={{ fontWeight: activePreset===key?700:400 }}/>
              ))}
            </Box>
          </Paper>

          {/* Filters */}
          <Paper elevation={0} sx={{ border:'1px solid', borderColor:'divider', borderRadius:2, p:2.5, mb:3 }}>
            <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:2 }}>
              <FilterList sx={{ color:'primary.main', fontSize:18 }}/>
              <Typography sx={{ fontWeight:600, fontSize:'.875rem' }}>Filters</Typography>
            </Box>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker enableAccessibleFieldDOMStructure={false} label="From Date" value={filters.dateFrom}
                  onChange={d => { setActivePreset('custom'); setFilters(p => ({ ...p, dateFrom:d })) }}
                  slots={{ textField:TextField }} slotProps={{ textField:{ fullWidth:true, size:'small' } }}/>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker enableAccessibleFieldDOMStructure={false} label="To Date" value={filters.dateTo}
                  onChange={d => { setActivePreset('custom'); setFilters(p => ({ ...p, dateTo:d })) }}
                  slots={{ textField:TextField }} slotProps={{ textField:{ fullWidth:true, size:'small' } }}/>
              </Grid>
              {user?.role === 'ADMIN' && (
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Branch / Scope</InputLabel>
                    <Select value={filters.branch} onChange={e => setFilters(p => ({ ...p, branch:e.target.value }))} label="Branch / Scope">
                      <MenuItem value="all">All</MenuItem>
                      {branchList.map(b => <MenuItem key={b.branch} value={b.branch}>{b.branch}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12} sm={6} md={user?.role==='ADMIN'?3:6}>
                <Button variant="contained" fullWidth onClick={loadAll} disabled={isLoading}>Apply Filters</Button>
              </Grid>
            </Grid>
          </Paper>

          {/* KPI Row 1 — main 4 */}
          <Grid container spacing={2} sx={{ mb:2 }}>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Total Revenue" value={fmtPKR(totalRevenue)} sub={`${fmt(totalTransactions)} transactions`} accent="#1976d2" icon={<AttachMoney/>}/>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Cash Collected" value={fmtPKR(totalCashReceived)} sub={`${collectionRate.toFixed(1)}% collection rate`} accent="#2e7d32" icon={<CheckCircle/>}
                chip={{ label:`${fullyPaidCount} fully paid`, bg:'#e8f5e9', color:'#2e7d32' }}/>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Total Outstanding" value={fmtPKR(totalOutstanding)} sub={`${fullyCreditCount} credit + ${partialCount} partial`} accent="#c62828" icon={<Warning/>}
                chip={{ label:`${fullyCreditCount+partialCount} unpaid`, bg:'#ffebee', color:'#c62828' }}/>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label={netProfit>=0?'Net Profit':'Net Loss'} value={fmtPKR(Math.abs(netProfit))}
                sub={`${profitMargin.toFixed(1)}% margin · Avg PKR ${fmt(avgTicket)}`}
                accent={netProfit>=0?'#2e7d32':'#c62828'} icon={netProfit>=0?<TrendingUp/>:<TrendingDown/>}/>
            </Grid>
          </Grid>

          {/* KPI Row 2 — payment breakdown */}
          <Grid container spacing={2} sx={{ mb:3 }}>
            <Grid item xs={6} sm={3}>
              <KpiCard label="Cash Sales" value={fmtPKR(cashSalesAmt)} sub="Fully collected" accent="#388e3c" icon={<AttachMoney/>}/>
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard label="Card Sales" value={fmtPKR(cardSalesAmt)} sub="Fully collected" accent="#1565c0" icon={<CreditCard/>}/>
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard label="Full Credit" value={fmtPKR(fullyCreditTotal)} sub={`${fullyCreditCount} invoices · ₀ collected`} accent="#c62828" icon={<AccountBalance/>}/>
            </Grid>
            <Grid item xs={6} sm={3}>
              <KpiCard label="Partial Sales" value={fmtPKR(partialTotal)} sub={`Collected ${fmtPKR(partialCollected)} · Due ${fmtPKR(partialCredit)}`} accent="#e65100" icon={<Receipt/>}/>
            </Grid>
          </Grid>

          {/* Charts Row 1 */}
          <Grid container spacing={2.5} sx={{ mb:3 }}>
            <Grid item xs={12} md={8}>
              <Paper elevation={0} sx={{ border:'1px solid', borderColor:'divider', borderRadius:2, p:2.5 }}>
                <SecTitle title="Daily: Collected vs Credit" icon={<BarIcon/>}/>
                {cfChart.length === 0 ? (
                  <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:260, color:'text.disabled' }}><Typography>No data</Typography></Box>
                ) : (
                  <ResponsiveContainer width="100%" height={270}>
                    <BarChart data={cfChart} margin={{ top:5, right:20, left:0, bottom:5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                      <XAxis dataKey="date" tick={{ fill:'#9e9e9e', fontSize:10 }}/>
                      <YAxis tick={{ fill:'#9e9e9e', fontSize:10 }} tickFormatter={v => `${Math.round(v/1000)}k`}/>
                      <Tooltip {...TT} formatter={v => [`PKR ${fmt(v)}`, '']}/>
                      <Legend iconSize={10} wrapperStyle={{ fontSize:12 }}/>
                      <Bar name="Collected"   dataKey="collected" fill="#2e7d32" radius={[4,4,0,0]} maxBarSize={28}/>
                      <Bar name="Credit Given" dataKey="credit"   fill="#ef5350" radius={[4,4,0,0]} maxBarSize={28}/>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper elevation={0} sx={{ border:'1px solid', borderColor:'divider', borderRadius:2, p:2.5, height:'100%' }}>
                <SecTitle title="Payment Methods" icon={<PieIcon/>}/>
                {piePM.length === 0 ? (
                  <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:160, color:'text.disabled' }}><Typography variant="body2">No data</Typography></Box>
                ) : (
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={piePM} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={3} labelLine={false}>
                        {piePM.map((e,i) => <Cell key={i} fill={e.color}/>)}
                      </Pie>
                      <Tooltip {...TT} formatter={v => [`PKR ${fmt(v)}`, '']}/>
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <Divider sx={{ my:1.5 }}/>
                <Box sx={{ display:'flex', flexDirection:'column', gap:.7 }}>
                  {pmBreakdown.map((m,i) => (
                    <Box key={i} sx={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <Box sx={{ display:'flex', alignItems:'center', gap:.7 }}>
                        <Box sx={{ width:8, height:8, borderRadius:'50%', bgcolor:MC[m.method]||'#9e9e9e', flexShrink:0 }}/>
                        <Typography variant="caption" color="text.secondary">{ML[m.method]||m.method}</Typography>
                        <Typography variant="caption" sx={{ color:'text.disabled' }}>({m.count})</Typography>
                      </Box>
                      <Box sx={{ textAlign:'right' }}>
                        <Typography variant="caption" sx={{ fontWeight:700, display:'block' }}>PKR {fmt(m.total)}</Typography>
                        {m.credit > 0 && <Typography variant="caption" sx={{ color:'error.main', fontSize:'.65rem' }}>Due: PKR {fmt(m.credit)}</Typography>}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Grid>
          </Grid>

          {/* Charts Row 2 */}
          <Grid container spacing={2.5} sx={{ mb:3 }}>
            <Grid item xs={12} md={7}>
              <Paper elevation={0} sx={{ border:'1px solid', borderColor:'divider', borderRadius:2, p:2.5 }}>
                <SecTitle title="Revenue vs Expenses (Monthly)" icon={<TrendingUp/>}/>
                {revByPeriod.length === 0 ? (
                  <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:250, color:'text.disabled' }}><Typography>No monthly data</Typography></Box>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={revByPeriod} margin={{ top:5, right:20, left:0, bottom:5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                      <XAxis dataKey="month" tick={{ fill:'#9e9e9e', fontSize:10 }}/>
                      <YAxis tick={{ fill:'#9e9e9e', fontSize:10 }} tickFormatter={v => `${Math.round(v/1000)}k`}/>
                      <Tooltip {...TT} formatter={v => [`PKR ${fmt(v)}`, '']}/>
                      <Legend iconSize={10} wrapperStyle={{ fontSize:12 }}/>
                      <Bar name="Revenue"  dataKey="revenue"  fill="#1976d2" radius={[4,4,0,0]} maxBarSize={26}/>
                      <Bar name="Expenses" dataKey="expenses" fill="#ef5350" radius={[4,4,0,0]} maxBarSize={26}/>
                      <Bar name="Profit"   dataKey="profit"   fill="#2e7d32" radius={[4,4,0,0]} maxBarSize={26}/>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper elevation={0} sx={{ border:'1px solid', borderColor:'divider', borderRadius:2, p:2.5, height:'100%' }}>
                <SecTitle title="Expense Breakdown" icon={<Receipt/>}/>
                {expBreakdown.length === 0 ? (
                  <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:220, gap:1 }}>
                    <Receipt sx={{ fontSize:40, color:'text.disabled' }}/>
                    <Typography color="text.disabled" variant="body2">No expense vouchers in period</Typography>
                  </Box>
                ) : (
                  <Box sx={{ display:'flex', flexDirection:'column', gap:0 }}>
                    {expBreakdown.slice(0,8).map((item,i) => (
                      <Box key={i} sx={{ py:1.2, borderBottom: i<expBreakdown.length-1?'1px solid':'none', borderColor:'divider' }}>
                        <Box sx={{ display:'flex', justifyContent:'space-between', mb:.4 }}>
                          <Typography variant="body2" sx={{ color:'text.secondary', fontSize:'.8rem' }}>{item.category}</Typography>
                          <Typography variant="body2" sx={{ fontWeight:700, fontSize:'.8rem' }}>PKR {fmt(item.amount)}</Typography>
                        </Box>
                        <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                          <LinearProgress variant="determinate" value={item.percentage} sx={{ flex:1, height:4, borderRadius:2, bgcolor:'grey.200', '& .MuiLinearProgress-bar':{ bgcolor:item.color||'#1976d2', borderRadius:2 } }}/>
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

          {/* P&L Banner */}
          <Paper elevation={0} sx={{ border:'2px solid', borderRadius:2, p:3, mb:3, borderColor:netProfit>=0?'success.light':'error.light', bgcolor:netProfit>=0?'#f1f8f2':'#fdf2f2' }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={4}>
                <Box sx={{ display:'flex', alignItems:'center', gap:2 }}>
                  <Box sx={{ bgcolor:netProfit>=0?'success.main':'error.main', borderRadius:'50%', p:1.5, display:'flex' }}>
                    {netProfit>=0 ? <TrendingUp sx={{ color:'#fff', fontSize:28 }}/> : <TrendingDown sx={{ color:'#fff', fontSize:28 }}/>}
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color:'text.secondary', textTransform:'uppercase', letterSpacing:1, fontWeight:600 }}>Net {netProfit>=0?'Profit':'Loss'}</Typography>
                    <Typography variant="h3" sx={{ fontWeight:800, color:netProfit>=0?'success.dark':'error.dark', lineHeight:1 }}>PKR {fmt(Math.abs(netProfit))}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt:.5 }}>{profitMargin.toFixed(1)}% margin · {collectionRate.toFixed(1)}% collected</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={8}>
                <Grid container spacing={2}>
                  {[
                    { label:'Total Invoiced',    value:fmtPKR(totalRevenue),      color:'primary.main' },
                    { label:'Cash Collected',    value:fmtPKR(totalCashReceived), color:'success.dark' },
                    { label:'Total Outstanding', value:fmtPKR(totalOutstanding),  color:'error.main'   },
                    { label:'Total Expenses',    value:fmtPKR(totalExpenses),     color:'error.main'   },
                    { label:'Discounts Given',   value:fmtPKR(discounts),         color:'text.secondary' },
                    { label:'Tax Collected',     value:fmtPKR(taxCollected),      color:'text.secondary' },
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

          {/* Trend + Cashier */}
          <Grid container spacing={2.5} sx={{ mb:3 }}>
            <Grid item xs={12} md={7}>
              <Paper elevation={0} sx={{ border:'1px solid', borderColor:'divider', borderRadius:2, p:2.5 }}>
                <SecTitle title="Daily Sales Trend" icon={<BarIcon/>}/>
                {salesByDate.length === 0 ? (
                  <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:240, color:'text.disabled' }}><Typography>No data</Typography></Box>
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={salesByDate} margin={{ top:5, right:20, left:0, bottom:5 }}>
                      <defs>
                        <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#1976d2" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#1976d2" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                      <XAxis dataKey="date" tick={{ fill:'#9e9e9e', fontSize:10 }}/>
                      <YAxis tick={{ fill:'#9e9e9e', fontSize:10 }} tickFormatter={v => `${Math.round(v/1000)}k`}/>
                      <Tooltip {...TT} formatter={v => [`PKR ${fmt(v)}`, '']}/>
                      <Legend iconSize={10} wrapperStyle={{ fontSize:12 }}/>
                      <Area  name="Total"     type="monotone" dataKey="total"     stroke="#1976d2" strokeWidth={2} fill="url(#gTotal)" dot={false} activeDot={{ r:4 }}/>
                      <Line  name="Collected" type="monotone" dataKey="collected" stroke="#2e7d32" strokeWidth={1.5} dot={false} strokeDasharray="4 2"/>
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper elevation={0} sx={{ border:'1px solid', borderColor:'divider', borderRadius:2, p:2.5 }}>
                <SecTitle title="Cashier Performance" icon={<Person/>}/>
                <TableContainer sx={{ maxHeight:300 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Cashier','Invoiced','Collected','Outstanding','Txns'].map(h => (
                          <TableCell key={h} align={h==='Cashier'?'left':'right'} sx={{ bgcolor:'primary.50', color:'primary.dark', fontWeight:700, fontSize:'.68rem', textTransform:'uppercase', letterSpacing:.5 }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cashierList.length === 0 ? (
                        <TableRow><TableCell colSpan={5} align="center" sx={{ py:4, color:'text.disabled' }}>No data</TableCell></TableRow>
                      ) : cashierList.map((row,i) => (
                        <TableRow key={i} sx={{ '&:hover':{ bgcolor:'action.hover' } }}>
                          <TableCell sx={{ fontSize:'.82rem' }}>
                            <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                              <Box sx={{ width:26, height:26, borderRadius:'50%', bgcolor:'primary.100', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.7rem', fontWeight:700, color:'primary.dark', flexShrink:0 }}>
                                {(row.cashier||'?').charAt(0).toUpperCase()}
                              </Box>
                              {row.cashier}
                            </Box>
                          </TableCell>
                          <TableCell align="right" sx={{ fontSize:'.78rem', fontWeight:700, color:'primary.main' }}>{fmt(row.total)}</TableCell>
                          <TableCell align="right" sx={{ fontSize:'.78rem', color:'success.dark', fontWeight:600 }}>{fmt(row.collected)}</TableCell>
                          <TableCell align="right" sx={{ fontSize:'.78rem', color:row.credit>0?'error.main':'text.disabled', fontWeight:row.credit>0?700:400 }}>{fmt(row.credit)}</TableCell>
                          <TableCell align="right" sx={{ fontSize:'.78rem', color:'text.secondary' }}>{row.transactions}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Grid>
          </Grid>

          {/* Recent Transactions */}
          <Paper elevation={0} sx={{ border:'1px solid', borderColor:'divider', borderRadius:2, p:2.5, mb:3 }}>
            <SecTitle title="Recent Transactions" icon={<ShoppingCart/>}/>
            <TableContainer sx={{ maxHeight:420 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {['Date','Invoice','Customer','Cashier','Total','Collected','Outstanding','Method','Status'].map(h => (
                      <TableCell key={h} sx={{ bgcolor:'primary.50', color:'primary.dark', fontWeight:700, fontSize:'.68rem', textTransform:'uppercase', letterSpacing:.5, whiteSpace:'nowrap' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentSales.length === 0 ? (
                    <TableRow><TableCell colSpan={9} align="center" sx={{ py:5, color:'text.disabled' }}>No transactions</TableCell></TableRow>
                  ) : recentSales.map((row,i) => (
                    <TableRow key={i} sx={{ '&:hover':{ bgcolor:'action.hover' }, bgcolor: row.credit_amount>0 && row.payment_amount===0 ? '#fff8f8' : 'inherit' }}>
                      <TableCell sx={{ fontSize:'.75rem', color:'text.secondary', whiteSpace:'nowrap' }}>{row.date}</TableCell>
                      <TableCell sx={{ fontSize:'.75rem', fontWeight:600, whiteSpace:'nowrap', color:'primary.main' }}>{row.invoice_no}</TableCell>
                      <TableCell sx={{ fontSize:'.78rem', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontSize:'.78rem', fontWeight:500 }}>{row.customer_name}</Typography>
                          {row.customer_phone && <Typography variant="caption" color="text.disabled">{row.customer_phone}</Typography>}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize:'.75rem', color:'text.secondary' }}>{row.cashier_name}</TableCell>
                      <TableCell sx={{ fontSize:'.8rem', fontWeight:700, whiteSpace:'nowrap' }}>PKR {fmt(row.total)}</TableCell>
                      <TableCell sx={{ fontSize:'.8rem', fontWeight:600, color:'success.dark', whiteSpace:'nowrap' }}>PKR {fmt(row.payment_amount)}</TableCell>
                      <TableCell sx={{ fontSize:'.8rem', fontWeight:row.credit_amount>0?700:400, color:row.credit_amount>0?'error.main':'text.disabled', whiteSpace:'nowrap' }}>
                        {row.credit_amount > 0 ? `PKR ${fmt(row.credit_amount)}` : '—'}
                      </TableCell>
                      <TableCell><PayBadge method={row.payment_method}/></TableCell>
                      <TableCell><StatBadge status={row.payment_status}/></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Branch Breakdown */}
          {branchList.length > 1 && (
            <Paper elevation={0} sx={{ border:'1px solid', borderColor:'divider', borderRadius:2, p:2.5, mb:3 }}>
              <SecTitle title="Branch Breakdown" icon={<Assessment/>}/>
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
                    {branchList.map((row,i) => {
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
                              <LinearProgress variant="determinate" value={parseFloat(rate)} sx={{ width:60, height:6, borderRadius:3, bgcolor:'grey.200', '& .MuiLinearProgress-bar':{ bgcolor:parseFloat(rate)>=80?'#2e7d32':parseFloat(rate)>=50?'#e65100':'#c62828', borderRadius:3 } }}/>
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

          {/* Top Products */}
          {topProducts.length > 0 && (
            <Paper elevation={0} sx={{ border:'1px solid', borderColor:'divider', borderRadius:2, p:2.5 }}>
              <SecTitle title="Top Products" icon={<ShoppingCart/>}/>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['#','Product','Units Sold','Revenue'].map(h => (
                        <TableCell key={h} sx={{ bgcolor:'primary.50', color:'primary.dark', fontWeight:700, fontSize:'.7rem', textTransform:'uppercase' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topProducts.map((row,i) => (
                      <TableRow key={i} sx={{ '&:hover':{ bgcolor:'action.hover' } }}>
                        <TableCell sx={{ color:'text.disabled', fontSize:'.78rem', width:40 }}>{i+1}</TableCell>
                        <TableCell sx={{ fontWeight:600, fontSize:'.82rem' }}>{row.name}</TableCell>
                        <TableCell sx={{ fontSize:'.82rem', color:'text.secondary' }}>{fmt(row.sold)}</TableCell>
                        <TableCell sx={{ fontWeight:700, color:'primary.main', fontSize:'.82rem' }}>PKR {fmt(row.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

        </Box>
      </LocalizationProvider>
    </RouteGuard>
  )
}