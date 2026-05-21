'use client'

import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import {
  Box, Typography, Card, CardContent, Grid, FormControl, InputLabel,
  Select, MenuItem, Alert, Paper, Avatar, Button, Chip,
} from '@mui/material'
import {
  Store as StoreIcon,
  Warehouse as WarehouseIcon,
  PointOfSale as POSIcon,
  Receipt as ReceiptIcon,
  Inventory as InventoryIcon,
  Assessment as ReportsIcon,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Clear as ClearIcon,
  PlayArrow as SimulateIcon,
  AccountBalance as LedgerIcon,
  ShoppingCart as POOrderIcon,
  PeopleAlt as RetailersIcon,
  LocalShipping as SuppliersIcon,
  SwapHoriz as TransfersIcon,
  BarChart as SalesReportIcon,
  Category as CategoriesIcon,
  MonetizationOn as VouchersIcon,
  ManageAccounts as UsersIcon,
  AssignmentReturn as ReturnsIcon,
} from '@mui/icons-material'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import PermissionCheck from '../../../components/auth/PermissionCheck'
import { fetchBranches } from '../../store/slices/branchesSlice'
import { fetchWarehouses } from '../../store/slices/warehousesSlice'

// ─── Module definitions ────────────────────────────────────────────────────────
// path         → navigated to WITH ?role=...&scope=...&id=... (simulation-aware)
// action       → special handler (POS terminal, warehouse billing)
// scopeTypes: null  → Admin Only — always visible, navigates WITHOUT scope params
// scopeTypes: [...] → scoped item — only visible when scopeType matches, needs simulation
const MODULES = [
  {
    group: 'Sales & Billing',
    items: [
      {
        label: 'POS Terminal',
        icon: <POSIcon sx={{ fontSize: 36 }} />,
        color: '#1976d2',
        scopeTypes: ['BRANCH'],
        description: 'Open branch cash register',
        action: 'pos',
      },
      {
        label: 'Warehouse Billing',
        icon: <ReceiptIcon sx={{ fontSize: 36 }} />,
        color: '#7b1fa2',
        scopeTypes: ['WAREHOUSE'],
        description: 'Create warehouse sales invoices',
        action: 'warehouse_billing',
      },
      {
        label: 'Sales Management',
        icon: <SalesReportIcon sx={{ fontSize: 36 }} />,
        color: '#0288d1',
        scopeTypes: ['BRANCH', 'WAREHOUSE'],
        description: 'View, edit & export sales',
        path: '/dashboard/sales',
      },
      {
        label: 'Returns',
        icon: <ReturnsIcon sx={{ fontSize: 36 }} />,
        color: '#d32f2f',
        scopeTypes: ['BRANCH', 'WAREHOUSE'],
        description: 'Process & manage returns',
        path: '/dashboard/returns',
      },
    ],
  },
  {
    group: 'Inventory & Stock',
    items: [
      {
        label: 'Inventory',
        icon: <InventoryIcon sx={{ fontSize: 36 }} />,
        color: '#00897b',
        scopeTypes: ['BRANCH', 'WAREHOUSE'],
        description: 'View & manage stock items',
        path: '/dashboard/inventory',
      },
      {
        label: 'Purchase Orders',
        icon: <POOrderIcon sx={{ fontSize: 36 }} />,
        color: '#e65100',
        scopeTypes: ['BRANCH', 'WAREHOUSE'],
        description: 'Create & complete POs',
        path: '/dashboard/purchase-orders',
      },
      {
        label: 'Transfers',
        icon: <TransfersIcon sx={{ fontSize: 36 }} />,
        color: '#5c6bc0',
        scopeTypes: ['BRANCH', 'WAREHOUSE'],
        description: 'Stock transfers between locations',
        path: '/dashboard/transfers',
      },
      {
        label: 'Categories',
        icon: <CategoriesIcon sx={{ fontSize: 36 }} />,
        color: '#558b2f',
        scopeTypes: ['BRANCH', 'WAREHOUSE'],
        description: 'Manage product categories',
        path: '/dashboard/categories',
      },
    ],
  },
  {
    group: 'People & Accounts',
    items: [
      {
        label: 'Retailers / Customers',
        icon: <RetailersIcon sx={{ fontSize: 36 }} />,
        color: '#2e7d32',
        scopeTypes: ['WAREHOUSE'],
        description: 'Manage retailer accounts',
        path: '/dashboard/retailers',
      },
      {
        // FIX: was /dashboard/ledger — correct path is /dashboard/customer-ledger
        label: 'Customer Ledger',
        icon: <LedgerIcon sx={{ fontSize: 36 }} />,
        color: '#c62828',
        scopeTypes: ['BRANCH', 'WAREHOUSE'],
        description: 'Outstanding balances & history',
        path: '/dashboard/customer-ledger',
      },
      {
        label: 'Suppliers / Companies',
        icon: <SuppliersIcon sx={{ fontSize: 36 }} />,
        color: '#6a1b9a',
        scopeTypes: ['BRANCH', 'WAREHOUSE'],
        description: 'Supplier & company records',
        path: '/dashboard/companies',
      },
    ],
  },
  {
    group: 'Finance',
    items: [
      {
        label: 'Financial Vouchers',
        icon: <VouchersIcon sx={{ fontSize: 36 }} />,
        color: '#f57c00',
        scopeTypes: ['BRANCH', 'WAREHOUSE'],
        description: 'Expenses, income & vouchers',
        path: '/dashboard/financial-vouchers',
      },
      {
        label: 'Reports',
        icon: <ReportsIcon sx={{ fontSize: 36 }} />,
        color: '#1565c0',
        scopeTypes: ['BRANCH', 'WAREHOUSE'],
        description: 'Full financial & inventory reports',
        path: '/dashboard/reports',
      },
    ],
  },
]

// ─── Admin-only shortcuts (always visible, no simulation needed) ──────────────
const ADMIN_SHORTCUTS = [
  { label: 'Users',      icon: <UsersIcon sx={{ fontSize: 36 }} />,    color: '#37474f', path: '/dashboard/users',      description: 'Manage staff accounts & roles' },
  { label: 'Branches',   icon: <StoreIcon sx={{ fontSize: 36 }} />,    color: '#1976d2', path: '/dashboard/branches',   description: 'Branch configuration' },
  { label: 'Warehouses', icon: <WarehouseIcon sx={{ fontSize: 36 }} />,color: '#7b1fa2', path: '/dashboard/warehouses', description: 'Warehouse configuration' },
]

// ─── Module Card ──────────────────────────────────────────────────────────────
function ModuleCard({ item, scopeType, scopeId, scopeData, isSimulationActive, onNavigate }) {
  const isAdminOnly  = item.scopeTypes === null
  const matchesScope = isAdminOnly || !scopeType || item.scopeTypes.includes(scopeType)

  if (!matchesScope) return null

  const disabled = !isAdminOnly && !isSimulationActive

  return (
    <Grid item xs={6} sm={4} md={3} lg={2}>
      <Card
        elevation={0}
        onClick={() => !disabled && onNavigate(item, scopeType, scopeId, scopeData)}
        sx={{
          border: '1px solid',
          borderColor: disabled ? '#e0e0e0' : `${item.color}40`,
          borderTop: `3px solid ${disabled ? '#e0e0e0' : item.color}`,
          borderRadius: 2,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'all .18s',
          height: '100%',
          bgcolor: '#fff',
          '&:hover': disabled ? {} : {
            boxShadow: `0 6px 20px ${item.color}25`,
            transform: 'translateY(-2px)',
            borderColor: item.color,
          },
        }}
      >
        <CardContent sx={{ p: 2.5, textAlign: 'center', '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ color: disabled ? '#bbb' : item.color, mb: 1 }}>{item.icon}</Box>
          <Typography sx={{ fontWeight: 700, fontSize: '.88rem', mb: .4 }}>{item.label}</Typography>
          <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1.4, display: 'block' }}>
            {item.description}
          </Typography>
          {disabled && (
            <Chip label="Activate first" size="small"
              sx={{ mt: 1, fontSize: '.6rem', height: 18, bgcolor: '#f5f5f5', color: 'text.disabled' }} />
          )}
        </CardContent>
      </Card>
    </Grid>
  )
}

// ─── Admin Shortcut Card (no simulation needed) ───────────────────────────────
function AdminShortcutCard({ item, onNavigate }) {
  return (
    <Grid item xs={6} sm={4} md={3} lg={2}>
      <Card
        elevation={0}
        onClick={() => onNavigate(item, null, null, null)}
        sx={{
          border: '1px solid',
          borderColor: `${item.color}40`,
          borderTop: `3px solid ${item.color}`,
          borderRadius: 2,
          cursor: 'pointer',
          transition: 'all .18s',
          height: '100%',
          bgcolor: '#fff',
          '&:hover': {
            boxShadow: `0 6px 20px ${item.color}25`,
            transform: 'translateY(-2px)',
            borderColor: item.color,
          },
        }}
      >
        <CardContent sx={{ p: 2.5, textAlign: 'center', '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ color: item.color, mb: 1 }}>{item.icon}</Box>
          <Typography sx={{ fontWeight: 700, fontSize: '.88rem', mb: .4 }}>{item.label}</Typography>
          <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1.4, display: 'block' }}>
            {item.description}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const AdminDashboardPage = () => {
  const dispatch = useDispatch()
  const router   = useRouter()

  const { data: branches,   loading: branchesLoading }   = useSelector(s => s.branches)
  const { data: warehouses, loading: warehousesLoading } = useSelector(s => s.warehouses)

  const [selectedScope,      setSelectedScope]      = useState('')
  const [selectedScopeType,  setSelectedScopeType]  = useState('')
  const [selectedScopeData,  setSelectedScopeData]  = useState(null)
  const [isSimulationActive, setIsSimulationActive] = useState(false)
  const [initialized,        setInitialized]        = useState(false)

  // On mount: load branches/warehouses + restore any saved simulation from sessionStorage
  useEffect(() => {
    dispatch(fetchBranches())
    dispatch(fetchWarehouses())
    try {
      const existing = sessionStorage.getItem('adminSimulation')
      if (existing) {
        const { scopeType, scopeId } = JSON.parse(existing)
        setSelectedScopeType(scopeType)
        setSelectedScope(String(scopeId))
        setIsSimulationActive(true)
      }
    } catch {
      sessionStorage.removeItem('adminSimulation')
    }
    setInitialized(true)
  }, [dispatch])

  // Once branches/warehouses load, resolve selectedScopeData from persisted scope
  useEffect(() => {
    if (!selectedScope || !selectedScopeType) return
    const id = Number(selectedScope)
    if (selectedScopeType === 'BRANCH' && branches.length > 0) {
      const b = branches.find(b => b.id === id)
      if (b) setSelectedScopeData(b)
    }
    if (selectedScopeType === 'WAREHOUSE' && warehouses.length > 0) {
      const w = warehouses.find(w => w.id === id)
      if (w) setSelectedScopeData(w)
    }
  }, [branches, warehouses, selectedScope, selectedScopeType])

  const handleScopeChange = (type, id) => {
    setSelectedScopeType(type)
    setSelectedScope(id)
    setIsSimulationActive(false)
    const num = Number(id)
    if (type === 'BRANCH')    setSelectedScopeData(branches.find(b => b.id === num) || null)
    if (type === 'WAREHOUSE') setSelectedScopeData(warehouses.find(w => w.id === num) || null)
  }

  const handleActivateSimulation = () => {
    if (!selectedScope || !selectedScopeType) return
    try {
      sessionStorage.setItem('adminSimulation', JSON.stringify({
        scopeType: selectedScopeType,
        scopeId:   selectedScope,
      }))
      setIsSimulationActive(true)
    } catch (e) {}
  }

  return (
    <DashboardLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Admin Simulation Panel</Typography>
            <Typography variant="body2" color="text.secondary">
              Simulate and manage scope access for branches and warehouses
            </Typography>
          </Box>
        </Box>

        {/* ── Active simulation banner ────────────────────────────────────── */}
        {isSimulationActive && (
          <Alert severity="warning" sx={{ mb: 3 }}
            action={
              <Button color="inherit" size="small" onClick={handleClearSimulation} startIcon={<ClearIcon />}>
                Clear
              </Button>
            }>
            <strong>Simulation Active:</strong> All API calls are scoped to{' '}
            <strong>{selectedScopeData?.name}</strong>. You are acting as Admin within this{' '}
            {selectedScopeType === 'BRANCH' ? 'branch' : 'warehouse'}&apos;s scope.
          </Alert>
        )}

        {/* ── Scope selectors ─────────────────────────────────────────────── */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ border: '1px solid #f0f0f0', borderRadius: 2, p: 2.5, bgcolor: '#fff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <StoreIcon color="primary" />
                <Typography sx={{ fontWeight: 700 }}>Branch Access</Typography>
              </Box>
              <FormControl fullWidth size="small">
                <InputLabel>Select Branch</InputLabel>
                <Select
                  value={selectedScopeType === 'BRANCH' ? selectedScope : ''}
                  onChange={e => handleScopeChange('BRANCH', e.target.value)}
                  disabled={branchesLoading}
                  label="Select Branch"
                >
                  {(branches || []).map(b => (
                    <MenuItem key={b.id} value={b.id.toString()}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StoreIcon fontSize="small" color="primary" />{b.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {selectedScopeType === 'BRANCH' && selectedScopeData && (
                <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#f0f7ff', borderRadius: 1.5 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '.88rem' }}>{selectedScopeData.name}</Typography>
                  {selectedScopeData.location && (
                    <Typography variant="caption" color="text.secondary">{selectedScopeData.location}</Typography>
                  )}
                </Box>
              )}
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ border: '1px solid #f0f0f0', borderRadius: 2, p: 2.5, bgcolor: '#fff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <WarehouseIcon color="secondary" />
                <Typography sx={{ fontWeight: 700 }}>Warehouse Access</Typography>
              </Box>
              <FormControl fullWidth size="small">
                <InputLabel>Select Warehouse</InputLabel>
                <Select
                  value={selectedScopeType === 'WAREHOUSE' ? selectedScope : ''}
                  onChange={e => handleScopeChange('WAREHOUSE', e.target.value)}
                  disabled={warehousesLoading}
                  label="Select Warehouse"
                >
                  {(warehouses || []).map(w => (
                    <MenuItem key={w.id} value={w.id.toString()}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WarehouseIcon fontSize="small" color="secondary" />{w.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {selectedScopeType === 'WAREHOUSE' && selectedScopeData && (
                <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#f5f0ff', borderRadius: 1.5 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '.88rem' }}>{selectedScopeData.name}</Typography>
                  {selectedScopeData.location && (
                    <Typography variant="caption" color="text.secondary">{selectedScopeData.location}</Typography>
                  )}
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* ── Simulation activate / status ────────────────────────────────── */}
        {selectedScope && selectedScopeType && (
          <Paper elevation={0} sx={{ border: '1px solid #f0f0f0', borderRadius: 2, p: 2.5, mb: 3, bgcolor: '#fff' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Avatar sx={{ bgcolor: isSimulationActive ? (selectedScopeType === 'BRANCH' ? '#1976d2' : '#7b1fa2') : '#bdbdbd' }}>
                {selectedScopeType === 'BRANCH' ? <StoreIcon /> : <WarehouseIcon />}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {isSimulationActive ? '🟢 Simulation Active' : '⚪ Ready to Simulate'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedScopeData?.name}{selectedScopeData?.location ? ` — ${selectedScopeData.location}` : ''}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {!isSimulationActive && (
                  <Button
                    variant="contained"
                    color={selectedScopeType === 'BRANCH' ? 'primary' : 'secondary'}
                    startIcon={<SimulateIcon />}
                    onClick={handleActivateSimulation}
                    sx={{ borderRadius: 2 }}
                  >
                    Activate Simulation
                  </Button>
                )}
                <Button variant="outlined" color="error" startIcon={<ClearIcon />}
                  onClick={handleClearSimulation} sx={{ borderRadius: 2 }}>
                  Clear
                </Button>
              </Box>
            </Box>
            <Box sx={{ mt: 1.5 }}>
              {!isSimulationActive
                ? <Alert severity="info" sx={{ borderRadius: 1.5 }}>
                    Click <strong>Activate Simulation</strong> to scope all API calls to{' '}
                    <strong>{selectedScopeData?.name}</strong>. Module cards will unlock once active.
                  </Alert>
                : <Alert severity="success" sx={{ borderRadius: 1.5 }}>
                    ✅ Simulation active for <strong>{selectedScopeData?.name}</strong>.
                    All modules are accessible. Records will be saved with your admin identity.
                  </Alert>
              }
            </Box>
          </Paper>
        )}

        {/* ── Scoped module groups ─────────────────────────────────────────── */}
        {MODULES.map((group, gi) => {
          // Only show items whose scopeType matches the selected scope.
          // If no scope selected yet, show all items so admin can see what exists.
          const visibleItems = group.items.filter(item => {
            if (!selectedScopeType) return true                        // No scope chosen — show all
            return item.scopeTypes.includes(selectedScopeType)        // Filter to matching scope
          })

          if (visibleItems.length === 0) return null

          return (
            <Box key={gi} sx={{ mb: 3.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: 1.2, color: 'text.secondary' }}>
                  {group.group}
                </Typography>
                <Box sx={{ flex: 1, height: '1px', bgcolor: '#f0f0f0' }} />
              </Box>
              <Grid container spacing={2}>
                {visibleItems.map((item, ii) => (
                  <ModuleCard
                    key={ii}
                    item={item}
                    scopeType={selectedScopeType}
                    scopeId={selectedScope}
                    scopeData={selectedScopeData}
                    isSimulationActive={isSimulationActive}
                    onNavigate={handleNavigate}
                  />
                ))}
              </Grid>
            </Box>
          )
        })}

        {/* ── Admin-only shortcuts (always accessible, no simulation) ─────── */}
        <Box sx={{ mb: 3.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '.78rem', textTransform: 'uppercase', letterSpacing: 1.2, color: 'text.secondary' }}>
              Admin Only
            </Typography>
            <Box sx={{ flex: 1, height: '1px', bgcolor: '#f0f0f0' }} />
          </Box>
          <Grid container spacing={2}>
            {ADMIN_SHORTCUTS.map((item, ii) => (
              <AdminShortcutCard key={ii} item={item} onNavigate={handleNavigate} />
            ))}
          </Grid>
        </Box>

        {/* ── How to use ───────────────────────────────────────────────────── */}
        <Paper elevation={0} sx={{ border: '1px solid #f0f0f0', borderRadius: 2, p: 3, bgcolor: '#fff', mt: 1 }}>
          <Typography sx={{ fontWeight: 700, mb: 2 }}>How to Use</Typography>
          <Grid container spacing={2}>
            {[
              { icon: <SecurityIcon color="primary" />, step: '1', title: 'Select Scope',        desc: 'Choose a branch or warehouse from the dropdowns above' },
              { icon: <SimulateIcon  color="success" />, step: '2', title: 'Activate Simulation', desc: 'Click Activate to scope all API calls to the selected location' },
              { icon: <PersonIcon    color="primary" />, step: '3', title: 'Work Normally',        desc: 'Access POS, billing, inventory, ledger, PO — everything scoped' },
              { icon: <ClearIcon     color="error"   />, step: '4', title: 'Clear When Done',      desc: 'Click Clear to stop simulation and return to normal admin mode' },
            ].map((s, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Box sx={{ bgcolor: '#f5f5f5', borderRadius: '50%', p: 1, display: 'flex', flexShrink: 0 }}>
                    {s.icon}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '.88rem' }}>{s.step}. {s.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.desc}</Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>

      </Box>
    </DashboardLayout>
  )
}

export default AdminDashboardPage