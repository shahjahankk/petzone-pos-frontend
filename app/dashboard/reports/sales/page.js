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

  // ─── Formatters ───────────────────────────────────────────────────────────────
  const fmt    = (v, d = 0) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
  const fmtPKR = (v) => `PKR ${fmt(v)}`
  const toStr  = (d) => { if (!d) return null; if (d instanceof Date) return d.toISOString().split('T')[0]; return d }
  const today  = () => new Date()
  const som    = () => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d }
  const ago    = (n) => new Date(Date.now() - n * 86400000)

  const PRESETS = {
    today:      { label: 'Today',        from: today,        to: today },
    this_month: { label: 'This Month',   from: som,          to: today },
    last_7:     { label: 'Last 7 Days',  from: () => ago(7), to: today },
    last_30:    { label: 'Last 30 Days', from: () => ago(30),to: today },
    last_90:    { label: '3 Months',     from: () => ago(90),to: today },
    custom:     { label: 'Custom',       from: null,         to: null  },
  }

  const ML = { CASH:'Cash', CARD:'Card', CREDIT_CARD:'Card', FULLY_CREDIT:'Full Credit', PARTIAL:'Partial', FULL_PAYMENT:'Full Payment', OUTSTANDING_SETTLEMENT:'Settlement' }
  const MC = { CASH:'#2e7d32', CARD:'#1565c0', CREDIT_CARD:'#1565c0', FULLY_CREDIT:'#c62828', PARTIAL:'#e65100', FULL_PAYMENT:'#2e7d32', OUTSTANDING_SETTLEMENT:'#6a1b9a' }

  const TT = {
    contentStyle: { background:'#fff', border:'1px solid #e8e8e8', borderRadius:10, color:'#333', fontSize:13, boxShadow:'0 8px 32px rgba(0,0,0,0.12)', padding:'10px 14px' },
    labelStyle: { fontWeight:700, marginBottom:4 },
  }

  const yFmt = (v) => { if (v >= 1_000_000) return `${(v/1_000_000).toFixed(1)}M`; if (v >= 1_000) return `${(v/1_000).toFixed(0)}k`; return v }

  // ─── KPI Card ─────────────────────────────────────────────────────────────────
  function KpiCard({ label, value, sub, accent, icon, chip }) {
    return (
      <Card elevation={0} sx={{
        border: '1px solid #f0f0f0',
        borderTop: `3px solid ${accent}`,
        borderRadius: 2.5,
        height: '100%',
        bgcolor: '#fff',
        transition: 'all .2s',
        '&:hover': { boxShadow: '0 6px 24px rgba(0,0,0,0.09)', transform: 'translateY(-1px)' },
      }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, fontSize: '.65rem', display: 'block', mb: .8 }}>
                {label}
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.45rem', color: 'text.primary', lineHeight: 1.15, mb: .4 }}>
                {value}
              </Typography>
              {sub && <Typography sx={{ color: 'text.secondary', fontSize: '.75rem', display: 'block', mt: .3, lineHeight: 1.4 }}>{sub}</Typography>}
              {chip && <Chip label={chip.label} size="small" sx={{ mt: 1, fontSize: '0.62rem', height: 20, bgcolor: chip.bg, color: chip.color, fontWeight: 700, borderRadius: 1 }} />}
            </Box>
            <Box sx={{ bgcolor: `${accent}14`, borderRadius: 2, p: 1.2, display: 'flex', flexShrink: 0, ml: 1.5 }}>
              <Box sx={{ color: accent, display: 'flex', fontSize: 20 }}>{icon}</Box>
            </Box>
          </Box>
        </CardContent>
      </Card>
    )
  }

  function SectionTitle({ title, icon }) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 2.5 }}>
        <Box sx={{ color: 'primary.main', display: 'flex', fontSize: 20 }}>{icon}</Box>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}>{title}</Typography>
      </Box>
    )
  }

  function PayBadge({ method, paymentType }) {
    const key = paymentType === 'OUTSTANDING_SETTLEMENT' ? 'OUTSTANDING_SETTLEMENT' : method
    const c = MC[key] || '#757575'
    return <Chip label={ML[key] || method} size="small" sx={{ fontSize: '0.62rem', height: 20, fontWeight: 700, bgcolor: `${c}18`, color: c, borderRadius: 1 }} />
  }

  function StatBadge({ status, isSettlement }) {
    if (isSettlement) return <Chip label="Settlement" size="small" sx={{ fontSize: '0.62rem', height: 20, fontWeight: 700, bgcolor: '#f3e5f5', color: '#6a1b9a', borderRadius: 1 }} />
    const m = { COMPLETED: { label:'Paid', bg:'#e8f5e9', color:'#2e7d32' }, PENDING: { label:'Pending', bg:'#fff3e0', color:'#e65100' }, PARTIAL: { label:'Partial', bg:'#fff3e0', color:'#e65100' } }
    const s = m[status] || { label: status || 'N/A', bg: '#f5f5f5', color: '#757575' }
    return <Chip label={s.label} size="small" sx={{ fontSize: '0.62rem', height: 20, fontWeight: 700, bgcolor: s.bg, color: s.color, borderRadius: 1 }} />
  }

  // ─── Zakat Tab ────────────────────────────────────────────────────────────────
  function ZakatTab({ netProfit, grossProfit, totalRevenue, totalCostOfGoods, totalExpenses, costPriceWarning, period }) {
    const zakatDue   = netProfit > 0 ? netProfit * 0.025 : 0
    const meetsNisab = netProfit >= 100000
    const rows = [
      { label: 'Total Revenue (Sales)',     value: fmtPKR(totalRevenue),                    color: '#1976d2' },
      { label: 'Cost of Goods Sold (COGS)', value: `− ${fmtPKR(totalCostOfGoods)}`,         color: '#c62828' },
      { label: 'Gross Profit',              value: fmtPKR(grossProfit),                     color: grossProfit >= 0 ? '#2e7d32' : '#c62828', bold: true },
      { label: 'Operating Expenses',        value: `− ${fmtPKR(totalExpenses)}`,            color: '#c62828' },
      { label: 'Net Profit',                value: fmtPKR(netProfit),                       color: netProfit >= 0 ? '#2e7d32' : '#c62828', bold: true, divider: true },
      { label: 'Zakat Rate',                value: '2.5%',                                  color: '#b8860b' },
      { label: 'Zakat Due on Net Profit',   value: fmtPKR(zakatDue),                       color: '#b8860b', bold: true },
    ]
    return (
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Paper elevation={0} sx={{ background: 'linear-gradient(135deg, #1a472a 0%, #2d6a4f 60%, #40916c 100%)', borderRadius: 3, p: { xs: 3, md: 4 }, mb: 4, color: '#fff', overflow: 'hidden', position: 'relative' }}>
          <Box sx={{ position:'absolute', top:-30, right:-30, width:160, height:160, borderRadius:'50%', bgcolor:'rgba(255,255,255,0.05)' }} />
          <Box sx={{ position:'absolute', bottom:-20, right:80, width:80, height:80, borderRadius:'50%', bgcolor:'rgba(255,255,255,0.07)' }} />
          <Box sx={{ display:'flex', alignItems:'center', gap:2, mb:3 }}>
            <Box sx={{ bgcolor:'rgba(255,255,255,0.15)', borderRadius:2, p:1.5, fontSize:28 }}>☪</Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight:800 }}>Zakat Calculator</Typography>
              <Typography variant="body2" sx={{ opacity:.8 }}>2.5% of net profit · {period}</Typography>
            </Box>
          </Box>
          <Grid container spacing={3}>
            {[
              { label:'Net Profit', value:fmtPKR(netProfit), color:'#fff' },
              { label:'Zakat Due (2.5%)', value:fmtPKR(zakatDue), color:'#ffd700' },
              { label:'Nisab Status', chip: netProfit<=0?'No Profit':meetsNisab?'Zakat Applicable':'Below Nisab', chipColor: meetsNisab&&netProfit>0?'#ffd700':'rgba(255,255,255,0.3)', chipText: meetsNisab&&netProfit>0?'#1a472a':'#fff' },
            ].map((item, i) => (
              <Grid item xs={12} sm={4} key={i}>
                <Typography sx={{ opacity:.7, textTransform:'uppercase', letterSpacing:1, fontSize:'.65rem', display:'block', mb:.5 }}>{item.label}</Typography>
                {item.chip
                  ? <Chip label={item.chip} sx={{ fontWeight:700, fontSize:'.8rem', bgcolor:item.chipColor, color:item.chipText, mt:.5 }} />
                  : <Typography variant="h4" sx={{ fontWeight:800, color:item.color }}>{item.value}</Typography>}
              </Grid>
            ))}
          </Grid>
        </Paper>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ border:'1px solid #f0f0f0', borderRadius:2.5, p:3 }}>
              <SectionTitle title="Profit & Zakat Breakdown" icon={<Receipt />} />
              {costPriceWarning && (
                <Box sx={{ bgcolor:'#fff8e1', border:'1px solid #ffd54f', borderRadius:1.5, p:1.5, mb:2.5, display:'flex', gap:1 }}>
                  <Warning sx={{ color:'#f57c00', fontSize:18, flexShrink:0, mt:.1 }} />
                  <Typography variant="caption" sx={{ color:'#e65100' }}>Some items have no cost price. Complete purchase orders for accurate figures.</Typography>
                </Box>
              )}
              {rows.map((row, i) => (
                <Box key={i}>
                  {row.divider && <Divider sx={{ my:1.5, borderStyle:'dashed' }} />}
                  <Box sx={{ display:'flex', justifyContent:'space-between', py:1.3, borderBottom: !row.divider&&i<rows.length-1?'1px solid #f5f5f5':'none' }}>
                    <Typography sx={{ color:'text.secondary', fontSize:'.85rem' }}>{row.label}</Typography>
                    <Typography sx={{ fontWeight:row.bold?800:600, color:row.color, fontSize:row.bold?'.95rem':'.85rem' }}>{row.value}</Typography>
                  </Box>
                </Box>
              ))}
              <Box sx={{ mt:2.5, p:2.5, borderRadius:2, bgcolor:zakatDue>0?'#f0fdf4':'#f9f9f9', border:'2px solid', borderColor:zakatDue>0?'#4ade80':'#e0e0e0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <Box>
                  <Typography sx={{ fontWeight:700, color:zakatDue>0?'#166534':'text.secondary' }}>Total Zakat Due</Typography>
                  <Typography variant="caption" color="text.disabled">{netProfit>0?`${fmtPKR(netProfit)} × 2.5%`:'No profit — Zakat not applicable'}</Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight:800, color:zakatDue>0?'#166534':'text.disabled' }}>{fmtPKR(zakatDue)}</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ border:'1px solid #f0f0f0', borderRadius:2.5, p:3, height:'100%' }}>
              <SectionTitle title="How It's Calculated" icon={<Assessment />} />
              <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>
                {[
                  { step:'1', title:'Revenue', desc:'(unit_price × qty) − discount per item', color:'#1976d2' },
                  { step:'2', title:'Subtract COGS', desc:'cost_price × quantity = what you paid supplier', color:'#c62828' },
                  { step:'3', title:'Gross Profit = Revenue − COGS', desc:'e.g. PKR 2,500×5 − PKR 1,800×5 = PKR 3,500', color:'#2e7d32' },
                  { step:'4', title:'Net Profit = Gross − Expenses', desc:'Subtract rent, salaries, utilities from vouchers', color:'#e65100' },
                  { step:'5', title:'Zakat = Net Profit × 2.5%', desc:'Applicable after Hawl (1 lunar year) if above Nisab', color:'#b8860b' },
                ].map(item => (
                  <Box key={item.step} sx={{ display:'flex', gap:2 }}>
                    <Box sx={{ width:28, height:28, borderRadius:'50%', bgcolor:item.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Typography sx={{ color:'#fff', fontSize:'.72rem', fontWeight:800 }}>{item.step}</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight:700, color:item.color, fontSize:'.88rem' }}>{item.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
              <Box sx={{ mt:3, p:2, bgcolor:'#fff8e1', borderRadius:1.5, border:'1px solid #ffe082' }}>
                <Typography variant="caption" sx={{ color:'#795548', fontWeight:600, display:'block', mb:.5 }}>⚠ Important</Typography>
                <Typography variant="caption" sx={{ color:'#795548', lineHeight:1.7, display:'block' }}>
                  Zakat requires one full lunar year (Hawl). Nisab changes with gold/silver price. Consult a scholar for your situation.
                </Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Grid container spacing={2}>
              {[
                { label:'Revenue',      value:fmtPKR(totalRevenue),     sub:'Total invoiced',          accent:'#1976d2' },
                { label:'COGS',         value:fmtPKR(totalCostOfGoods), sub:'Cost of goods sold',      accent:'#c62828' },
                { label:'Gross Profit', value:fmtPKR(grossProfit),      sub:`${totalRevenue>0?((grossProfit/totalRevenue)*100).toFixed(1):0}% margin`, accent:'#2e7d32' },
                { label:'Expenses',     value:fmtPKR(totalExpenses),    sub:'Operating expenses',      accent:'#e65100' },
                { label:'Net Profit',   value:fmtPKR(netProfit),        sub:'Gross − expenses',        accent:'#0288d1' },
                { label:'Zakat Due',    value:fmtPKR(zakatDue),        sub:'Net profit × 2.5%',        accent:'#b8860b' },
              ].map((c,i) => (
                <Grid item xs={6} sm={4} md={2} key={i}>
                  <Paper elevation={0} sx={{ border:'1px solid #f0f0f0', borderTop:`3px solid ${c.accent}`, borderRadius:2, p:2, textAlign:'center' }}>
                    <Typography sx={{ color:'text.disabled', textTransform:'uppercase', letterSpacing:.8, fontSize:'.62rem', display:'block', mb:.5 }}>{c.label}</Typography>
                    <Typography sx={{ fontWeight:800, color:c.accent, fontSize:'.95rem' }}>{c.value}</Typography>
                    <Typography sx={{ color:'text.disabled', fontSize:'.65rem', mt:.3 }}>{c.sub}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Box>
    )
  }

  // ─── Main Page ────────────────────────────────────────────────────────────────
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
    const buildFP   = useCallback(() => ({ dateFrom: toStr(filters.dateFrom), dateTo: toStr(filters.dateTo) }), [filters])
    const loadAll   = useCallback(() => { dispatch(fetchSalesReports(buildSP())); dispatch(fetchFinancialReports(buildFP())) }, [dispatch, buildSP, buildFP])
    useEffect(() => { loadAll() }, [loadAll])

    const applyPreset = (key) => {
      if (key === 'custom') { setActivePreset('custom'); return }
      const p = PRESETS[key]; setActivePreset(key)
      setFilters(prev => ({ ...prev, dateFrom: p.from(), dateTo: p.to() }))
    }

    const sr = salesReports     || {}
    const fr = financialReports || {}

    const totalRevenue           = Number(sr.totalRevenue           || 0)
    const totalTransactions      = Number(sr.totalTransactions      || 0)
    const avgTicket              = Number(sr.averageTicket          || 0)
    const cashSalesAmt           = Number(sr.cashSalesAmount        || sr.cashSales || 0)
    const cardSalesAmt           = Number(sr.cardSalesAmount        || sr.cardSales || 0)
    const fullyCreditTotal       = Number(sr.fullyCreditTotal       || 0)
    const partialTotal           = Number(sr.partialTotal           || 0)
    const partialCollected       = Number(sr.partialCollected       || 0)
    const partialCredit          = Number(sr.partialCredit          || 0)
    const totalCashReceived      = Number(sr.totalCashReceived      || 0)
    const totalOutstanding       = Number(sr.totalOutstanding       || sr.totalCreditGiven || 0)
    const fullyPaidCount         = Number(sr.fullyPaidCount         || 0)
    const fullyCreditCount       = Number(sr.fullyCreditCount       || 0)
    const partialCount           = Number(sr.partialCount           || 0)
    const discounts              = Number(sr.discounts              || 0)
    const outstandingSettled     = Number(sr.outstandingSettled     || 0)
    const outstandingSettlementCount = Number(sr.outstandingSettlementCount || 0)
    const refundTotal            = Number(sr.refundTotal            || sr.refunds || 0)
    const refundCount            = Number(sr.refundCount            || 0)
    const costPriceWarning       = Boolean(sr.costPriceWarning)

    const grossProfit       = Number(fr.grossProfit       || sr.grossProfit       || 0)
    const totalCostOfGoods  = Number(fr.totalCostOfGoods  || sr.totalCostOfGoods  || 0)
    const grossProfitMargin = Number(fr.grossProfitMargin || sr.grossProfitMargin || 0)
    const totalExpenses     = Number(fr.totalExpenses     || 0)
    const netProfit         = Number(fr.netProfit !== undefined ? fr.netProfit : (grossProfit - totalExpenses))
    const netProfitMargin   = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    const zakatDue          = netProfit > 0 ? netProfit * 0.025 : 0
    const collectionRate    = totalRevenue > 0 ? (totalCashReceived / totalRevenue) * 100 : 0

    const salesByDate  = Array.isArray(sr.salesByDate)            ? sr.salesByDate            : []
    const recentSales  = Array.isArray(sr.recentSales)            ? sr.recentSales            : []
    const cashierList  = Array.isArray(sr.salesByCashierList)     ? sr.salesByCashierList     : Object.values(sr.salesByCashier  || {})
    const branchList   = Array.isArray(sr.salesByBranchList)      ? sr.salesByBranchList      : Object.values(sr.salesByBranch   || {})
    const pmBreakdown  = Array.isArray(sr.paymentMethodBreakdown) ? sr.paymentMethodBreakdown : []
    const expBreakdown = Array.isArray(fr.expenseBreakdown)       ? fr.expenseBreakdown       : []
    const revByPeriod  = Array.isArray(fr.revenueByPeriod)        ? fr.revenueByPeriod        : []
    const topProducts  = Array.isArray(sr.topProducts)            ? sr.topProducts            : []

    const piePM   = pmBreakdown.filter(m => m.total > 0).map(m => ({ name: ML[m.method]||m.method, value: m.total, color: MC[m.method]||'#9e9e9e' }))
    const cfChart = salesByDate.map(d => ({ date: d.date?.slice(5)||'', collected: Number(d.collected||0), credit: Number(d.credit||0), total: Number(d.total||0) }))
    const periodStr = `${toStr(filters.dateFrom)||'—'} to ${toStr(filters.dateTo)||'—'}`

    const handleExportCSV = () => {
      const rows = [
        ['Sales Report', periodStr],[],
        ['Total Revenue',totalRevenue],['COGS',totalCostOfGoods],['Gross Profit',grossProfit],['Expenses',totalExpenses],['Net Profit',netProfit],['Zakat Due',zakatDue],[],
        ['Cash Collected',totalCashReceived],['Outstanding',totalOutstanding],['Credit Recovered',outstandingSettled],['Refunds',refundTotal],[],
        ['Date','Total','Collected','Credit','Txns'],
        ...salesByDate.map(r=>[r.date,r.total,r.collected,r.credit,r.transactions]),
      ]
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'}))
      a.download = `sales-${toStr(filters.dateFrom)}-${toStr(filters.dateTo)}.csv`
      a.click(); setExportAnchor(null)
    }

    const handleExportPDF = () => {
      const w = window.open('','_blank')
      w.document.write(`<html><head><title>Sales Report</title><style>body{font-family:Arial;padding:32px;color:#333;font-size:13px}h1{color:#1976d2;border-bottom:2px solid #1976d2;pb:8px}h2{color:#1565c0;margin-top:20px;font-size:14px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}th,td{border:1px solid #e0e0e0;padding:7px 10px}th{background:#e3f2fd;font-weight:700}tr:nth-child(even){background:#fafafa}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0}.card{border:1px solid #e0e0e0;border-radius:8px;padding:14px;text-align:center;background:#f8f9ff}.val{font-size:1.1rem;font-weight:800;color:#1976d2}.lbl{font-size:.7rem;color:#888;text-transform:uppercase}</style></head><body>
      <h1>Sales Report — ${periodStr}</h1>
      <div class="grid">
        <div class="card"><div class="val">PKR ${fmt(totalRevenue)}</div><div class="lbl">Revenue</div></div>
        <div class="card"><div class="val" style="color:#2e7d32">PKR ${fmt(totalCashReceived)}</div><div class="lbl">Collected</div></div>
        <div class="card"><div class="val" style="color:#c62828">PKR ${fmt(totalOutstanding)}</div><div class="lbl">Outstanding</div></div>
        <div class="card"><div class="val" style="color:${netProfit>=0?'#2e7d32':'#c62828'}">PKR ${fmt(Math.abs(netProfit))}</div><div class="lbl">Net ${netProfit>=0?'Profit':'Loss'}</div></div>
      </div>
      <p style="background:#f0fdf4;border:2px solid #4ade80;border-radius:8px;padding:14px;font-weight:700;color:#166534">☪ Zakat Due = PKR ${fmt(zakatDue)}</p>
      <h2>Payment Breakdown</h2>
      <table><tr><th>Method</th><th>Invoiced</th><th>Collected</th><th>Outstanding</th><th>Count</th></tr>
      ${pmBreakdown.map(m=>`<tr><td>${ML[m.method]||m.method}</td><td>PKR ${fmt(m.total)}</td><td>PKR ${fmt(m.collected)}</td><td>PKR ${fmt(m.credit)}</td><td>${m.count}</td></tr>`).join('')}
      </table>
      <h2>Recent Transactions</h2>
      <table><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Total</th><th>Collected</th><th>Credit</th><th>Method</th></tr>
      ${recentSales.slice(0,20).map(r=>`<tr><td>${r.date}</td><td>${r.invoice_no}</td><td>${r.customer_name}</td><td>PKR ${fmt(r.total)}</td><td>PKR ${fmt(r.payment_amount)}</td><td>PKR ${fmt(r.credit_amount)}</td><td>${ML[r.payment_method]||r.payment_method}</td></tr>`).join('')}
      </table></body></html>`)
      w.document.close(); setTimeout(()=>w.print(),400); setExportAnchor(null)
    }

    // ─── Shared toolbar / filters ─────────────────────────────────────────────
    const Toolbar = () => (
      <Box sx={{ bgcolor:'#fff', borderBottom:'1px solid #f0f0f0', px:{ xs:2, md:4 }, pt:3, pb:0 }}>
        {/* Header */}
        <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', mb:2.5, flexWrap:'wrap', gap:2 }}>
          <Box>
            <Typography sx={{ color:'primary.main', textTransform:'uppercase', letterSpacing:2, fontWeight:700, fontSize:'.65rem' }}>Reports / Sales</Typography>
            <Typography variant="h4" sx={{ fontWeight:800, mt:.4, letterSpacing:'-.5px' }}>Sales Report</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt:.4 }}>Revenue · COGS · Gross Profit · Net Profit · Zakat</Typography>
          </Box>
          <Box sx={{ display:'flex', gap:1.5, flexWrap:'wrap', alignItems:'center' }}>
            <Button onClick={loadAll} disabled={isLoading} startIcon={isLoading?<CircularProgress size={14}/>:<Refresh/>} variant="outlined" size="small" sx={{ borderRadius:2 }}>
              {isLoading?'Loading…':'Refresh'}
            </Button>
            <Button onClick={e=>setExportAnchor(e.currentTarget)} startIcon={<Download/>} variant="contained" size="small" sx={{ borderRadius:2 }}>Export</Button>
             <Menu
               anchorEl={exportAnchor}
               open={Boolean(exportAnchor)}
               onClose={() => setExportAnchor(null)}
               anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
               transformOrigin={{ vertical: 'top', horizontal: 'right' }}
               PaperProps={{
                 elevation: 3,
                 sx: { borderRadius: 2, minWidth: 160, mt: 0.5 }
               }}
             >
               <MenuItem onClick={handleExportCSV}>Export CSV</MenuItem>
               <MenuItem onClick={handleExportPDF}>Export PDF</MenuItem>
             </Menu>             
          </Box>
        </Box>

        {/* Presets */}
        <Box sx={{ display:'flex', alignItems:'center', gap:.8, flexWrap:'wrap', mb:2 }}>
          <CalendarToday sx={{ fontSize:14, color:'text.disabled' }}/>
          {Object.entries(PRESETS).map(([key,p]) => (
            <Chip key={key} label={p.label} size="small" onClick={()=>applyPreset(key)}
              color={activePreset===key?'primary':'default'} variant={activePreset===key?'filled':'outlined'}
              sx={{ fontWeight:activePreset===key?700:500, borderRadius:1.5, fontSize:'.72rem' }} />
          ))}
        </Box>

        {/* Filters row */}
        <Box sx={{ display:'flex', gap:2, alignItems:'center', flexWrap:'wrap', pb:2 }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker enableAccessibleFieldDOMStructure={false} label="From Date" value={filters.dateFrom}
              onChange={d=>{ setActivePreset('custom'); setFilters(p=>({...p,dateFrom:d})) }}
              slots={{ textField: TextField }}
              slotProps={{ textField:{ size:'small', sx:{ minWidth:150 } } }} />
            <DatePicker enableAccessibleFieldDOMStructure={false} label="To Date" value={filters.dateTo}
              onChange={d=>{ setActivePreset('custom'); setFilters(p=>({...p,dateTo:d})) }}
              slots={{ textField: TextField }}
              slotProps={{ textField:{ size:'small', sx:{ minWidth:150 } } }} />
          </LocalizationProvider>
          {user?.role==='ADMIN' && (
            <FormControl size="small" sx={{ minWidth:160 }}>
              <InputLabel>Branch</InputLabel>
              <Select value={filters.branch} onChange={e=>setFilters(p=>({...p,branch:e.target.value}))} label="Branch">
                <MenuItem value="all">All Branches</MenuItem>
                {branchList.map(b=><MenuItem key={b.branch} value={b.branch}>{b.branch}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          <Button variant="contained" onClick={loadAll} disabled={isLoading} sx={{ borderRadius:2, px:3 }}>Apply</Button>
        </Box>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(_,v)=>setActiveTab(v)}
          sx={{ '& .MuiTab-root':{ fontWeight:600, fontSize:'.8rem', minHeight:44, textTransform:'none' }, '& .MuiTabs-indicator':{ height:3, borderRadius:'3px 3px 0 0' } }}>
          <Tab label="Sales Overview" icon={<BarIcon sx={{ fontSize:16 }}/>} iconPosition="start"/>
          <Tab label="Profit & Loss"  icon={<TrendingUp sx={{ fontSize:16 }}/>} iconPosition="start"/>
          <Tab label={zakatDue>0?`Zakat · PKR ${fmt(zakatDue)}`:'Zakat'}
            icon={<Typography sx={{ fontSize:14,lineHeight:1 }}>☪</Typography>} iconPosition="start"
            sx={{ color:zakatDue>0?'#b8860b !important':undefined }}/>
        </Tabs>
      </Box>
    )

    // ─────────────────────────────────────────────────────────────────────────
    return (
      <RouteGuard allowedRoles={['ADMIN','CASHIER','WAREHOUSE_KEEPER']}>
        <Box sx={{ bgcolor:'#f7f8fa', minHeight:'100vh', width:'100%' }}>
          <Toolbar/>

          {/* ── TAB 0: Sales Overview ─────────────────────────────────────── */}
          {activeTab===0 && (
            <Box sx={{ px:{ xs:2, md:4 }, py:3, width:'100%', boxSizing:'border-box' }}>

              {/* Cost price warning */}
              {costPriceWarning && (
                <Box sx={{ bgcolor:'#fff8e1', border:'1px solid #ffd54f', borderRadius:2, p:2, mb:3, display:'flex', gap:1.5, alignItems:'flex-start' }}>
                  <Warning sx={{ color:'#f57c00', fontSize:20, flexShrink:0, mt:.1 }}/>
                  <Typography sx={{ color:'#e65100', fontSize:'.82rem' }}>
                    Some inventory items have no cost price. Profit may be understated. Complete purchase orders to fix this.
                  </Typography>
                </Box>
              )}

              {/* ── Row 1: Core 4 KPIs ─────────────────────────────────────── */}
              <Grid container spacing={2.5} sx={{ mb:2.5 }} columns={12}>
                <Grid item xs={12} sm={6} md={3}>
                  <KpiCard label="Total Invoiced" value={fmtPKR(totalRevenue)} sub={`${fmt(totalTransactions)} real sales`} accent="#1976d2" icon={<AttachMoney/>}/>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <KpiCard label="Cash Collected" value={fmtPKR(totalCashReceived)} sub={`${collectionRate.toFixed(1)}% of invoiced`} accent="#2e7d32" icon={<CheckCircle/>}
                    chip={{ label:`${fullyPaidCount} fully paid`, bg:'#e8f5e9', color:'#2e7d32' }}/>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <KpiCard label="Total Outstanding" value={fmtPKR(totalOutstanding)} sub={`${fullyCreditCount} credit · ${partialCount} partial`} accent="#c62828" icon={<Warning/>}
                    chip={{ label:`${fullyCreditCount+partialCount} unpaid`, bg:'#ffebee', color:'#c62828' }}/>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <KpiCard
                    label="Gross Profit (Rev − COGS)"
                    value={fmtPKR(grossProfit)}
                    sub={costPriceWarning
                      ? `⚠ ${grossProfitMargin.toFixed(1)}% margin — cost prices missing`
                      : totalCostOfGoods>0
                        ? `${grossProfitMargin.toFixed(1)}% margin · COGS PKR ${fmt(totalCostOfGoods)}`
                        : 'No cost prices set'}
                    accent={grossProfit>=0?'#2e7d32':'#c62828'}
                    icon={grossProfit>=0?<TrendingUp/>:<TrendingDown/>}/>
                </Grid>
              </Grid>

              {/* ── Row 2: Payment method KPIs ─────────────────────────────── */}
              <Grid container spacing={2.5} sx={{ mb:2.5 }} columns={12}>
                <Grid item xs={6} sm={6} md={3}><KpiCard label="Cash Sales"    value={fmtPKR(cashSalesAmt)}     sub="Fully collected"                             accent="#388e3c" icon={<AttachMoney/>}/></Grid>
                <Grid item xs={6} sm={6} md={3}><KpiCard label="Card Sales"    value={fmtPKR(cardSalesAmt)}     sub="Fully collected"                             accent="#1565c0" icon={<CreditCard/>}/></Grid>
                <Grid item xs={6} sm={6} md={3}><KpiCard label="Full Credit"   value={fmtPKR(fullyCreditTotal)} sub={`${fullyCreditCount} invoices · 0 collected`} accent="#c62828" icon={<AccountBalance/>}/></Grid>
                <Grid item xs={6} sm={6} md={3}><KpiCard label="Partial Sales" value={fmtPKR(partialTotal)}     sub={partialCount>0?`Collected ${fmtPKR(partialCollected)} · Due ${fmtPKR(partialCredit)}`:`${partialCount} partial`} accent="#e65100" icon={<Receipt/>}/></Grid>
              </Grid>

              {/* ── Row 3: Recovery / misc KPIs ────────────────────────────── */}
              <Grid container spacing={2.5} sx={{ mb:3.5 }} columns={12}>
                <Grid item xs={6} sm={6} md={3}><KpiCard label="Credit Recovered" value={fmtPKR(outstandingSettled)} sub={`${outstandingSettlementCount} settlement${outstandingSettlementCount!==1?'s':''}`} accent="#6a1b9a" icon={<SwapHoriz/>}/></Grid>
                <Grid item xs={6} sm={6} md={3}><KpiCard label="Refunds Issued"   value={fmtPKR(refundTotal)}        sub={`${refundCount} refund${refundCount!==1?'s':''}`}                                   accent="#b71c1c" icon={<TrendingDown/>}/></Grid>
                <Grid item xs={6} sm={6} md={3}><KpiCard label="Discounts Given"  value={fmtPKR(discounts)}          sub="Total discount on sales"                                                            accent="#f57c00" icon={<Receipt/>}/></Grid>
                <Grid item xs={6} sm={6} md={3}><KpiCard label="Avg Ticket"       value={fmtPKR(avgTicket)}           sub="Per real sale"                                                                     accent="#0288d1" icon={<ShoppingCart/>}/></Grid>
              </Grid>

              {/* ── Chart 1: Daily Collected vs Credit — FULL WIDTH ─────────── */}
              <Paper elevation={0} sx={{ border:'1px solid #f0f0f0', borderRadius:2.5, p:3.5, mb:3, bgcolor:'#fff' }}>
                <SectionTitle title="Daily: Cash Collected vs Credit Given" icon={<BarIcon/>}/>
                {cfChart.length===0
                  ? <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:320, color:'text.disabled' }}><Typography>No data in selected period</Typography></Box>
                  : <ResponsiveContainer width="100%" height={360}>
                      <BarChart data={cfChart} margin={{ top:10, right:24, left:0, bottom:cfChart.length>15?40:20 }} barGap={4} barCategoryGap="35%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                        <XAxis dataKey="date" tick={{ fill:'#aaa', fontSize:12 }} tickLine={false} axisLine={{ stroke:'#ececec' }}
                          interval={cfChart.length>25?Math.ceil(cfChart.length/12):cfChart.length>15?1:0}
                          angle={cfChart.length>15?-40:0} textAnchor={cfChart.length>15?'end':'middle'}
                          height={cfChart.length>15?52:28}/>
                        <YAxis tick={{ fill:'#aaa', fontSize:12 }} tickFormatter={yFmt} width={62} tickLine={false} axisLine={false}/>
                        <Tooltip {...TT} formatter={(v,name)=>[`PKR ${fmt(v)}`,name]} cursor={{ fill:'rgba(0,0,0,0.03)', radius:4 }}/>
                        <Legend iconSize={12} wrapperStyle={{ fontSize:13, paddingTop:14 }} iconType="circle"/>
                        <Bar name="Collected"    dataKey="collected" fill="#2e7d32" radius={[5,5,0,0]} maxBarSize={56}/>
                        <Bar name="Credit Given" dataKey="credit"    fill="#ef5350" radius={[5,5,0,0]} maxBarSize={56}/>
                      </BarChart>
                    </ResponsiveContainer>}
              </Paper>

              {/* ── Chart 2: Payment Methods — FULL WIDTH ───────────────────── */}
              <Paper elevation={0} sx={{ border:'1px solid #f0f0f0', borderRadius:2.5, p:3.5, mb:3, bgcolor:'#fff' }}>
                <SectionTitle title="Payment Methods Breakdown" icon={<PieIcon/>}/>
                <Grid container spacing={4} alignItems="center">
                  {/* Donut left */}
                  <Grid item xs={12} md={4}>
                    {piePM.length===0
                      ? <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:260, color:'text.disabled' }}><Typography>No data</Typography></Box>
                      : <ResponsiveContainer width="100%" height={280}>
                          <PieChart>
                            <Pie data={piePM} cx="50%" cy="50%" innerRadius={72} outerRadius={110} dataKey="value" paddingAngle={3} labelLine={false}>
                              {piePM.map((e,i)=><Cell key={i} fill={e.color}/>)}
                            </Pie>
                            <Tooltip {...TT} formatter={v=>[`PKR ${fmt(v)}`,'']}/>
                            <Legend iconSize={11} wrapperStyle={{ fontSize:13 }} iconType="circle"/>
                          </PieChart>
                        </ResponsiveContainer>}
                  </Grid>
                  {/* Cards right */}
                  <Grid item xs={12} md={8}>
                    <Grid container spacing={2}>
                      {pmBreakdown.map((m,i)=>{
                        const pct = totalRevenue>0?((m.total/totalRevenue)*100).toFixed(1):'0.0'
                        const c   = MC[m.method]||'#9e9e9e'
                        return (
                          <Grid item xs={12} sm={6} key={i}>
                            <Paper elevation={0} sx={{ p:2.5, borderRadius:2, border:'1px solid #f0f0f0', borderLeft:`4px solid ${c}`, bgcolor:'#fafafa' }}>
                              <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:.8 }}>
                                <Typography sx={{ fontWeight:700, color:c, fontSize:'.88rem' }}>{ML[m.method]||m.method}</Typography>
                                <Chip label={`${m.count} txn`} size="small" sx={{ fontSize:'.62rem', height:20, bgcolor:`${c}18`, color:c, fontWeight:700, borderRadius:1 }}/>
                              </Box>
                              <Typography sx={{ fontWeight:800, fontSize:'1.1rem' }}>PKR {fmt(m.total)}</Typography>
                              <Box sx={{ display:'flex', justifyContent:'space-between', mt:.8, mb:.6 }}>
                                <Typography variant="caption" color="text.disabled">{pct}% of total revenue</Typography>
                                {m.credit>0&&<Typography variant="caption" sx={{ color:'error.main', fontWeight:600 }}>Due: PKR {fmt(m.credit)}</Typography>}
                              </Box>
                              <LinearProgress variant="determinate" value={Math.min(parseFloat(pct),100)}
                                sx={{ height:5, borderRadius:3, bgcolor:'#ececec', '& .MuiLinearProgress-bar':{ bgcolor:c, borderRadius:3 } }}/>
                            </Paper>
                          </Grid>
                        )
                      })}
                    </Grid>
                  </Grid>
                </Grid>
              </Paper>

              {/* ── Chart 3: Daily Sales Trend — FULL WIDTH ─────────────────── */}
              <Paper elevation={0} sx={{ border:'1px solid #f0f0f0', borderRadius:2.5, p:3.5, mb:3, bgcolor:'#fff' }}>
                <SectionTitle title="Daily Sales Trend" icon={<TrendingUp/>}/>
                {salesByDate.length===0
                  ? <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, color:'text.disabled' }}><Typography>No data</Typography></Box>
                  : <ResponsiveContainer width="100%" height={340}>
                      <AreaChart data={salesByDate} margin={{ top:10, right:24, left:0, bottom:salesByDate.length>15?44:20 }}>
                        <defs>
                          <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#1976d2" stopOpacity={0.13}/><stop offset="95%" stopColor="#1976d2" stopOpacity={0}/></linearGradient>
                          <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2e7d32" stopOpacity={0.10}/><stop offset="95%" stopColor="#2e7d32" stopOpacity={0}/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                        <XAxis dataKey="date" tick={{ fill:'#aaa', fontSize:12 }} tickLine={false} axisLine={{ stroke:'#ececec' }}
                          interval={salesByDate.length>25?Math.ceil(salesByDate.length/12):salesByDate.length>15?1:0}
                          angle={salesByDate.length>15?-40:0} textAnchor={salesByDate.length>15?'end':'middle'}
                          height={salesByDate.length>15?52:28}/>
                        <YAxis tick={{ fill:'#aaa', fontSize:12 }} tickFormatter={yFmt} width={62} tickLine={false} axisLine={false}/>
                        <Tooltip {...TT} formatter={(v,name)=>[`PKR ${fmt(v)}`,name]}/>
                        <Legend iconSize={12} wrapperStyle={{ fontSize:13, paddingTop:14 }} iconType="circle"/>
                        <Area name="Total"     type="monotone" dataKey="total"     stroke="#1976d2" strokeWidth={2.5} fill="url(#gT)" dot={false} activeDot={{ r:5, strokeWidth:0 }}/>
                        <Area name="Collected" type="monotone" dataKey="collected" stroke="#2e7d32" strokeWidth={2}   fill="url(#gC)" dot={false} activeDot={{ r:5, strokeWidth:0 }} strokeDasharray="5 3"/>
                      </AreaChart>
                    </ResponsiveContainer>}
              </Paper>

              {/* ── Cashier Performance — FULL WIDTH ───────────────────────── */}
              <Paper elevation={0} sx={{ border:'1px solid #f0f0f0', borderRadius:2.5, p:3.5, mb:3, bgcolor:'#fff' }}>
                <SectionTitle title="Cashier Performance" icon={<Person/>}/>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor:'#fafafa' }}>
                        {['Cashier','Invoiced','Collected','Outstanding','Txns','Collection %'].map(h=>(
                          <TableCell key={h} align={h==='Cashier'?'left':'right'}
                            sx={{ color:'text.secondary', fontWeight:700, fontSize:'.7rem', textTransform:'uppercase', letterSpacing:.6, py:1.8, borderBottom:'2px solid #f0f0f0' }}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cashierList.length===0
                        ? <TableRow><TableCell colSpan={6} align="center" sx={{ py:6, color:'text.disabled' }}>No cashier data</TableCell></TableRow>
                        : cashierList.map((row,i)=>{
                            const cr = row.total>0?(row.collected/row.total)*100:0
                            return (
                              <TableRow key={i} sx={{ '&:hover':{ bgcolor:'#fafafa' }, borderBottom:'1px solid #f5f5f5' }}>
                                <TableCell sx={{ py:2 }}>
                                  <Box sx={{ display:'flex', alignItems:'center', gap:1.5 }}>
                                    <Box sx={{ width:38, height:38, borderRadius:'50%', bgcolor:'primary.main', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, color:'#fff', fontSize:'.9rem', flexShrink:0 }}>
                                      {(row.cashier||'?').charAt(0).toUpperCase()}
                                    </Box>
                                    <Typography sx={{ fontWeight:600, fontSize:'.9rem' }}>{row.cashier}</Typography>
                                  </Box>
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight:700, color:'primary.main' }}>PKR {fmt(row.total)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight:600, color:'success.dark' }}>PKR {fmt(row.collected)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight:row.credit>0?700:400, color:row.credit>0?'error.main':'text.disabled' }}>
                                  {row.credit>0?`PKR ${fmt(row.credit)}`:'—'}
                                </TableCell>
                                <TableCell align="right" sx={{ color:'text.secondary' }}>{row.transactions}</TableCell>
                                <TableCell align="right">
                                  <Box sx={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:1.5 }}>
                                    <LinearProgress variant="determinate" value={Math.min(cr,100)}
                                      sx={{ width:100, height:7, borderRadius:4, bgcolor:'grey.100',
                                        '& .MuiLinearProgress-bar':{ bgcolor:cr>=80?'#2e7d32':cr>=50?'#e65100':'#c62828', borderRadius:4 } }}/>
                                    <Typography sx={{ fontWeight:700, minWidth:44, fontSize:'.82rem' }}>{cr.toFixed(1)}%</Typography>
                                  </Box>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {/* ── Recent Transactions ─────────────────────────────────────── */}
              <Paper elevation={0} sx={{ border:'1px solid #f0f0f0', borderRadius:2.5, p:3.5, mb:3, bgcolor:'#fff' }}>
                <SectionTitle title="Recent Transactions" icon={<ShoppingCart/>}/>
                <TableContainer sx={{ maxHeight:480 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['Date','Invoice','Customer','Cashier','Total','Collected','Outstanding','Method','Status'].map(h=>(
                          <TableCell key={h} sx={{ bgcolor:'#fafafa', color:'text.secondary', fontWeight:700, fontSize:'.65rem', textTransform:'uppercase', letterSpacing:.6, whiteSpace:'nowrap', borderBottom:'2px solid #f0f0f0' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recentSales.length===0
                        ? <TableRow><TableCell colSpan={9} align="center" sx={{ py:6, color:'text.disabled' }}>No transactions</TableCell></TableRow>
                        : recentSales.map((row,i)=>(
                            <TableRow key={i} sx={{
                              '&:hover':{ bgcolor:'#fafafa' },
                              bgcolor: row.is_settlement?'#fdf4ff':row.credit_amount>0&&row.payment_amount===0?'#fff9f9':'inherit',
                              borderBottom:'1px solid #f5f5f5'
                            }}>
                              <TableCell sx={{ fontSize:'.74rem', color:'text.secondary', whiteSpace:'nowrap' }}>{row.date}</TableCell>
                              <TableCell sx={{ fontSize:'.74rem', fontWeight:700, whiteSpace:'nowrap', color:row.is_settlement?'#6a1b9a':'primary.main' }}>{row.invoice_no}</TableCell>
                              <TableCell sx={{ fontSize:'.78rem', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                <Typography sx={{ fontSize:'.78rem', fontWeight:500 }}>{row.customer_name}</Typography>
                                {row.customer_phone&&<Typography variant="caption" color="text.disabled" sx={{ display:'block' }}>{row.customer_phone}</Typography>}
                              </TableCell>
                              <TableCell sx={{ fontSize:'.74rem', color:'text.secondary' }}>{row.cashier_name}</TableCell>
                              <TableCell sx={{ fontSize:'.8rem', fontWeight:700, whiteSpace:'nowrap' }}>{row.is_settlement?'—':`PKR ${fmt(row.total)}`}</TableCell>
                              <TableCell sx={{ fontSize:'.8rem', fontWeight:600, color:'success.dark', whiteSpace:'nowrap' }}>PKR {fmt(row.payment_amount)}</TableCell>
                              <TableCell sx={{ fontSize:'.8rem', fontWeight:row.credit_amount>0?700:400, color:row.credit_amount>0?'error.main':'text.disabled', whiteSpace:'nowrap' }}>
                                {row.credit_amount>0?`PKR ${fmt(row.credit_amount)}`:'—'}
                              </TableCell>
                              <TableCell><PayBadge method={row.payment_method} paymentType={row.payment_type}/></TableCell>
                              <TableCell><StatBadge status={row.payment_status} isSettlement={row.is_settlement}/></TableCell>
                            </TableRow>
                          ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {/* ── Branch Breakdown ───────────────────────────────────────── */}
              {branchList.length>1 && (
                <Paper elevation={0} sx={{ border:'1px solid #f0f0f0', borderRadius:2.5, p:3.5, mb:3, bgcolor:'#fff' }}>
                  <SectionTitle title="Branch Breakdown" icon={<Assessment/>}/>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow sx={{ bgcolor:'#fafafa' }}>
                          {['Branch','Invoiced','Collected','Outstanding','Txns','Collection %'].map(h=>(
                            <TableCell key={h} align={h==='Branch'?'left':'right'}
                              sx={{ fontWeight:700, fontSize:'.7rem', textTransform:'uppercase', letterSpacing:.6, color:'text.secondary', py:1.8, borderBottom:'2px solid #f0f0f0' }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {branchList.map((row,i)=>{
                          const rate = row.total>0?((row.collected/row.total)*100).toFixed(1):'0.0'
                          return (
                            <TableRow key={i} sx={{ '&:hover':{ bgcolor:'#fafafa' }, borderBottom:'1px solid #f5f5f5' }}>
                              <TableCell sx={{ fontWeight:700 }}>{row.branch}</TableCell>
                              <TableCell align="right" sx={{ fontWeight:700, color:'primary.main' }}>PKR {fmt(row.total)}</TableCell>
                              <TableCell align="right" sx={{ color:'success.dark', fontWeight:600 }}>PKR {fmt(row.collected)}</TableCell>
                              <TableCell align="right" sx={{ color:row.credit>0?'error.main':'text.disabled', fontWeight:row.credit>0?700:400 }}>PKR {fmt(row.credit)}</TableCell>
                              <TableCell align="right" sx={{ color:'text.secondary' }}>{row.transactions}</TableCell>
                              <TableCell align="right">
                                <Box sx={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:1.5 }}>
                                  <LinearProgress variant="determinate" value={Math.min(parseFloat(rate),100)}
                                    sx={{ width:90, height:6, borderRadius:3, bgcolor:'grey.100', '& .MuiLinearProgress-bar':{ bgcolor:parseFloat(rate)>=80?'#2e7d32':parseFloat(rate)>=50?'#e65100':'#c62828', borderRadius:3 } }}/>
                                  <Typography sx={{ fontWeight:700, minWidth:40, fontSize:'.82rem' }}>{rate}%</Typography>
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

              {/* ── Top Products ───────────────────────────────────────────── */}
              {topProducts.length>0 && (
                <Paper elevation={0} sx={{ border:'1px solid #f0f0f0', borderRadius:2.5, p:3.5, bgcolor:'#fff' }}>
                  <SectionTitle title="Top Products" icon={<ShoppingCart/>}/>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow sx={{ bgcolor:'#fafafa' }}>
                          {['#','Product','Units Sold','Revenue','COGS','Gross Profit'].map(h=>(
                            <TableCell key={h} sx={{ fontWeight:700, fontSize:'.7rem', textTransform:'uppercase', letterSpacing:.6, color:'text.secondary', py:1.8, borderBottom:'2px solid #f0f0f0' }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {topProducts.map((row,i)=>(
                          <TableRow key={i} sx={{ '&:hover':{ bgcolor:'#fafafa' }, borderBottom:'1px solid #f5f5f5' }}>
                            <TableCell sx={{ color:'text.disabled', width:40, fontWeight:600 }}>{i+1}</TableCell>
                            <TableCell sx={{ fontWeight:700 }}>{row.name}</TableCell>
                            <TableCell sx={{ color:'text.secondary' }}>{fmt(row.sold)}</TableCell>
                            <TableCell sx={{ fontWeight:700, color:'primary.main' }}>PKR {fmt(row.revenue)}</TableCell>
                            <TableCell sx={{ color:'error.main' }}>PKR {fmt(row.cost||0)}</TableCell>
                            <TableCell sx={{ fontWeight:700, color:(row.grossProfit||0)>=0?'success.dark':'error.main' }}>PKR {fmt(row.grossProfit||0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}
            </Box>
          )}

          {/* ── TAB 1: Profit & Loss ──────────────────────────────────────── */}
          {activeTab===1 && (
            <Box sx={{ px:{ xs:2, md:4 }, py:3 }}>
              {/* P&L Banner */}
              <Paper elevation={0} sx={{ border:'none', borderRadius:2.5, p:{ xs:3, md:4 }, mb:3.5,
                background: netProfit>=0
                  ? 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 60%, #388e3c 100%)'
                  : 'linear-gradient(135deg, #b71c1c 0%, #c62828 60%, #d32f2f 100%)',
                color:'#fff' }}>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} md={4}>
                    <Box sx={{ display:'flex', alignItems:'center', gap:2.5 }}>
                      <Box sx={{ bgcolor:'rgba(255,255,255,0.2)', borderRadius:2.5, p:2, display:'flex' }}>
                        {netProfit>=0?<TrendingUp sx={{ fontSize:32 }}/>:<TrendingDown sx={{ fontSize:32 }}/>}
                      </Box>
                      <Box>
                        <Typography sx={{ opacity:.8, textTransform:'uppercase', letterSpacing:1.5, fontSize:'.65rem', fontWeight:700 }}>
                          Net {netProfit>=0?'Profit':'Loss'}{totalExpenses===0?' (Gross)':''}
                        </Typography>
                        <Typography variant="h3" sx={{ fontWeight:800, lineHeight:1.1, mt:.3 }}>PKR {fmt(Math.abs(netProfit))}</Typography>
                        <Typography sx={{ opacity:.8, mt:.6, fontSize:'.82rem' }}>{netProfitMargin.toFixed(1)}% margin · {collectionRate.toFixed(1)}% collected</Typography>
                        {zakatDue>0&&<Typography sx={{ color:'#ffd700', fontSize:'.8rem', fontWeight:700, mt:.5 }}>☪ Zakat: PKR {fmt(zakatDue)}</Typography>}
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Grid container spacing={2}>
                      {[
                        { label:'Revenue',       value:fmtPKR(totalRevenue) },
                        { label:'COGS',          value:`− ${fmtPKR(totalCostOfGoods)}` },
                        { label:'Gross Profit',  value:fmtPKR(grossProfit) },
                        { label:'Expenses',      value:`− ${fmtPKR(totalExpenses)}` },
                        { label:'Cash Collected',value:fmtPKR(totalCashReceived) },
                        { label:'Outstanding',   value:fmtPKR(totalOutstanding) },
                      ].map(item=>(
                        <Grid item xs={6} sm={4} key={item.label}>
                          <Typography sx={{ opacity:.7, fontSize:'.7rem', textTransform:'uppercase', letterSpacing:.8 }}>{item.label}</Typography>
                          <Typography sx={{ fontWeight:700, fontSize:'1rem', mt:.2 }}>{item.value}</Typography>
                        </Grid>
                      ))}
                    </Grid>
                  </Grid>
                </Grid>
              </Paper>

              {/* ── Revenue vs COGS vs Expenses vs Net Profit (Monthly) ─────── */}
              <Paper elevation={0} sx={{ border:'1px solid #f0f0f0', borderRadius:2.5, p:3.5, mb:3, bgcolor:'#fff' }}>
                <SectionTitle title="Monthly P&L — Revenue · COGS · Expenses · Net Profit" icon={<TrendingUp/>}/>
                {revByPeriod.length===0
                  ? <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:320, color:'text.disabled' }}><Typography>No monthly data yet</Typography></Box>
                  : <>
                      {/* Mini legend explaining the bars */}
                      <Box sx={{ display:'flex', gap:3, mb:2, flexWrap:'wrap' }}>
                        {[
                          { color:'#1976d2', label:'Revenue',    desc:'Total invoiced' },
                          { color:'#c62828', label:'COGS',       desc:'Cost of goods sold' },
                          { color:'#ef5350', label:'Expenses',   desc:'Operating expenses' },
                          { color:'#2e7d32', label:'Net Profit', desc:'Revenue − COGS − Expenses' },
                        ].map(item => (
                          <Box key={item.label} sx={{ display:'flex', alignItems:'center', gap:.8 }}>
                            <Box sx={{ width:10, height:10, borderRadius:2, bgcolor:item.color, flexShrink:0 }}/>
                            <Box>
                              <Typography sx={{ fontSize:'.75rem', fontWeight:700, color:item.color, lineHeight:1.2 }}>{item.label}</Typography>
                              <Typography sx={{ fontSize:'.62rem', color:'text.disabled', lineHeight:1.2 }}>{item.desc}</Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                      <ResponsiveContainer width="100%" height={380}>
                        <BarChart data={revByPeriod} margin={{ top:10, right:24, left:0, bottom:20 }} barGap={4} barCategoryGap="28%">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                          <XAxis dataKey="month" tick={{ fill:'#aaa', fontSize:13 }} tickLine={false} axisLine={{ stroke:'#ececec' }}/>
                          <YAxis tick={{ fill:'#aaa', fontSize:13 }} tickFormatter={yFmt} width={68} tickLine={false} axisLine={false}/>
                          <Tooltip {...TT}
                            formatter={(v, name) => [`PKR ${fmt(v)}`, name]}
                            cursor={{ fill:'rgba(0,0,0,0.03)' }}/>
                          <Legend iconSize={12} wrapperStyle={{ fontSize:13, paddingTop:14 }} iconType="circle"/>
                          <Bar name="Revenue"    dataKey="revenue"  fill="#1976d2" radius={[5,5,0,0]} maxBarSize={40}/>
                          <Bar name="COGS"       dataKey="cogs"     fill="#c62828" radius={[5,5,0,0]} maxBarSize={40}/>
                          <Bar name="Expenses"   dataKey="expenses" fill="#ef5350" radius={[5,5,0,0]} maxBarSize={40}/>
                          <Bar name="Net Profit" dataKey="profit"   fill="#2e7d32" radius={[5,5,0,0]} maxBarSize={40}/>
                        </BarChart>
                      </ResponsiveContainer>
                    </>}
              </Paper>

              {/* ── Expense Breakdown — FULL WIDTH ───────────────────────────── */}
              <Paper elevation={0} sx={{ border:'1px solid #f0f0f0', borderRadius:2.5, p:3.5, bgcolor:'#fff' }}>
                <SectionTitle title="Expense Breakdown by Category" icon={<Receipt/>}/>
                {expBreakdown.length===0
                  ? <Box sx={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:200, gap:2 }}>
                      <Receipt sx={{ fontSize:52, color:'text.disabled' }}/>
                      <Typography color="text.disabled" sx={{ fontWeight:500 }}>No expense vouchers recorded in this period</Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ textAlign:'center', maxWidth:300 }}>
                        Add expense vouchers (rent, salaries, utilities) to see accurate net profit
                      </Typography>
                    </Box>
                  : <Grid container spacing={3}>
                      {/* Progress bars left */}
                      <Grid item xs={12} md={6}>
                        {expBreakdown.slice(0,8).map((item,i)=>(
                          <Box key={i} sx={{ py:1.6, borderBottom:i<Math.min(expBreakdown.length,8)-1?'1px solid #f5f5f5':'none' }}>
                            <Box sx={{ display:'flex', justifyContent:'space-between', mb:.8 }}>
                              <Typography sx={{ color:'text.secondary', fontSize:'.88rem', fontWeight:500 }}>{item.category}</Typography>
                              <Typography sx={{ fontWeight:700, fontSize:'.88rem' }}>PKR {fmt(item.amount)}</Typography>
                            </Box>
                            <Box sx={{ display:'flex', alignItems:'center', gap:1.5 }}>
                              <LinearProgress variant="determinate" value={item.percentage}
                                sx={{ flex:1, height:6, borderRadius:3, bgcolor:'#ececec', '& .MuiLinearProgress-bar':{ bgcolor:item.color||'#1976d2', borderRadius:3 } }}/>
                              <Typography sx={{ color:'text.disabled', minWidth:38, fontSize:'.82rem', fontWeight:600 }}>{item.percentage}%</Typography>
                            </Box>
                          </Box>
                        ))}
                        <Box sx={{ display:'flex', justifyContent:'space-between', pt:2, mt:1, borderTop:'2px solid #ef5350' }}>
                          <Typography sx={{ fontWeight:700, fontSize:'.95rem' }}>Total Expenses</Typography>
                          <Typography sx={{ fontWeight:800, color:'error.main', fontSize:'.95rem' }}>PKR {fmt(totalExpenses)}</Typography>
                        </Box>
                      </Grid>
                      {/* Donut chart right */}
                      <Grid item xs={12} md={6}>
                        <ResponsiveContainer width="100%" height={320}>
                          <PieChart>
                            <Pie
                              data={expBreakdown.slice(0,8).map(e=>({ name:e.category, value:e.amount, color:e.color||'#9e9e9e' }))}
                              cx="50%" cy="50%" innerRadius={80} outerRadius={130}
                              dataKey="value" paddingAngle={3} labelLine={false}>
                              {expBreakdown.slice(0,8).map((e,i)=><Cell key={i} fill={e.color||'#9e9e9e'}/>)}
                            </Pie>
                            <Tooltip {...TT} formatter={v=>[`PKR ${fmt(v)}`,'']}/>
                            <Legend iconSize={12} wrapperStyle={{ fontSize:13 }} iconType="circle"/>
                          </PieChart>
                        </ResponsiveContainer>
                      </Grid>
                    </Grid>}
              </Paper>
            </Box>
          )}

          {/* ── TAB 2: Zakat ─────────────────────────────────────────────── */}
          {activeTab===2 && (
            <ZakatTab netProfit={netProfit} grossProfit={grossProfit} totalRevenue={totalRevenue}
              totalCostOfGoods={totalCostOfGoods} totalExpenses={totalExpenses}
              costPriceWarning={costPriceWarning} period={periodStr}/>
          )}
        </Box>
      </RouteGuard>
    )
  }