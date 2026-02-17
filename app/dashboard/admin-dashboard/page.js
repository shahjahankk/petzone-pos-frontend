'use client'

import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Button
} from '@mui/material'
import {
  Store as StoreIcon,
  Warehouse as WarehouseIcon,
  PointOfSale as POSIcon,
  Receipt as ReceiptIcon,
  Inventory as InventoryIcon,
  Assessment as ReportsIcon,
  AdminPanelSettings as AdminIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Warning as WarningIcon
} from '@mui/icons-material'

import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import PermissionCheck from '../../../components/auth/PermissionCheck'

import { fetchBranches } from '../../store/slices/branchesSlice'
import { fetchWarehouses } from '../../store/slices/warehousesSlice'
import { setScope, clearScope } from '../../store/slices/scopeSlice'
import { authAPI } from '../../../utils/axios' // ✅ IMPORT authAPI

const AdminDashboardPage = () => {
  const dispatch = useDispatch()
  const router = useRouter()

  const { data: branches, loading: branchesLoading } = useSelector(state => state.branches)
  const { data: warehouses, loading: warehousesLoading } = useSelector(state => state.warehouses)
  const { scopeType, scopeId } = useSelector(state => state.scope)
  const { user } = useSelector(state => state.auth)

  const [selectedScope, setSelectedScope] = useState('')
  const [selectedScopeType, setSelectedScopeType] = useState('')
  const [selectedScopeData, setSelectedScopeData] = useState(null)
  const [error, setError] = useState(null) // ✅ ADD missing error state
  const [showSimulationAlert, setShowSimulationAlert] = useState(false)

  // Load branches/warehouses on page load
  useEffect(() => {
    dispatch(fetchBranches())
    dispatch(fetchWarehouses())
  }, [dispatch])

  // If scope exists in redux, reflect it in UI state
  useEffect(() => {
    if (!scopeType || !scopeId) return

    setSelectedScopeType(scopeType)
    setSelectedScope(scopeId.toString())
    setShowSimulationAlert(true)

    if (scopeType === 'BRANCH') {
      const branch = branches?.find(b => b.id === scopeId)
      setSelectedScopeData(branch || null)
    }

    if (scopeType === 'WAREHOUSE') {
      const warehouse = warehouses?.find(w => w.id === scopeId)
      setSelectedScopeData(warehouse || null)
    }
  }, [scopeType, scopeId, branches, warehouses])

  // Handle scope selection
  const handleScopeChange = (newScopeType, newScopeId) => {
    setSelectedScopeType(newScopeType)
    setSelectedScope(newScopeId)
    setError(null)

    const numericId = Number(newScopeId)
    const simulatedRole = newScopeType === 'BRANCH' ? 'CASHIER' : 'WAREHOUSE_KEEPER'

    // STORE IN REDUX
    dispatch(setScope({ scopeType: newScopeType, scopeId: numericId }))
    
    // USE THE HELPER METHOD
    authAPI.setSimulationMode(newScopeType, numericId, simulatedRole)

    if (newScopeType === 'BRANCH') {
      const branch = branches.find(b => b.id === numericId)
      setSelectedScopeData(branch)
    }

    if (newScopeType === 'WAREHOUSE') {
      const warehouse = warehouses.find(w => w.id === numericId)
      setSelectedScopeData(warehouse)
    }
  }

  // ✅ ADD clear scope handler
  const handleClearScope = () => {
    dispatch(clearScope())
    setSelectedScope('')
    setSelectedScopeType('')
    setSelectedScopeData(null)
    setShowSimulationAlert(false)
    authAPI.clearSimulationMode()
  }

  const handlePOSAccess = () => {
    if (!selectedScope || selectedScopeType !== 'BRANCH') {
      setError('Please select a branch first')
      return
    }

    router.push(`/dashboard/pos/terminal`)
  }

  const handleWarehouseBillingAccess = () => {
    if (!selectedScope || selectedScopeType !== 'WAREHOUSE') {
      setError('Please select a warehouse first')
      return
    }

    router.push(`/dashboard/warehouse-billing`)
  }

  const handleInventoryAccess = () => {
    if (!selectedScope || !selectedScopeType) {
      setError('Please select a branch or warehouse first')
      return
    }

    router.push(`/dashboard/inventory`)
  }

  const handleReportsAccess = () => {
    if (!selectedScope || !selectedScopeType) {
      setError('Please select a branch or warehouse first')
      return
    }

    router.push(`/dashboard/reports`)
  }

  const getScopeIcon = (type) => {
    return type === 'BRANCH' ? <StoreIcon /> : <WarehouseIcon />
  }

  const getScopeColor = (type) => {
    return type === 'BRANCH' ? 'primary' : 'secondary'
  }

  const getScopeLabel = (type) => {
    return type === 'BRANCH' ? 'Branch' : 'Warehouse'
  }

  const getSimulatedRole = () => {
    return selectedScopeType === 'BRANCH' ? 'CASHIER' : 'WAREHOUSE_KEEPER'
  }

  return (
    <DashboardLayout>
      <RouteGuard allowedRoles={['ADMIN']} />
      <PermissionCheck permission="admin_dashboard" />

      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AdminIcon color="primary" />
            Admin Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Select a branch or warehouse to simulate as {selectedScopeType === 'BRANCH' ? 'CASHIER' : 'WAREHOUSE_KEEPER'}
          </Typography>
        </Box>

        {/* Error Snackbar - ✅ ADDED */}
        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          message={error}
        />

        {/* Simulation Alert - ✅ ADDED */}
        {showSimulationAlert && selectedScopeType && (
          <Alert 
            severity="warning" 
            sx={{ mb: 3 }}
            icon={<WarningIcon />}
            action={
              <Button color="inherit" size="small" onClick={handleClearScope}>
                Exit Simulation
              </Button>
            }
          >
            <strong>Simulation Mode Active:</strong> You are now acting as{' '}
            <strong>{getSimulatedRole()}</strong> at <strong>{selectedScopeData?.name}</strong>
          </Alert>
        )}

        {/* Scope Selection */}
        <Grid container spacing={3}>
          {/* Branch Selection */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StoreIcon color="primary" />
                  Branch Access (Simulate as Cashier)
                </Typography>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Select Branch</InputLabel>
                  <Select
                    value={selectedScopeType === 'BRANCH' ? selectedScope : ''}
                    onChange={(e) => handleScopeChange('BRANCH', e.target.value)}
                    disabled={branchesLoading}
                  >
                    {branches.map((branch) => (
                      <MenuItem key={branch.id} value={branch.id.toString()}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <StoreIcon fontSize="small" />
                          {branch.name}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {selectedScopeType === 'BRANCH' && selectedScopeData && (
                  <Paper sx={{ p: 2, bgcolor: 'primary.50' }}>
                    <Typography variant="subtitle2">
                      Selected Branch: {selectedScopeData.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Location: {selectedScopeData.location}
                    </Typography>
                    <Chip 
                      size="small" 
                      label="Simulating as CASHIER" 
                      color="primary" 
                      sx={{ mt: 1 }}
                    />
                  </Paper>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Warehouse Selection */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <WarehouseIcon color="secondary" />
                  Warehouse Access (Simulate as Warehouse Keeper)
                </Typography>

                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Select Warehouse</InputLabel>
                  <Select
                    value={selectedScopeType === 'WAREHOUSE' ? selectedScope : ''}
                    onChange={(e) => handleScopeChange('WAREHOUSE', e.target.value)}
                    disabled={warehousesLoading}
                  >
                    {warehouses.map((warehouse) => (
                      <MenuItem key={warehouse.id} value={warehouse.id.toString()}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <WarehouseIcon fontSize="small" />
                          {warehouse.name}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {selectedScopeType === 'WAREHOUSE' && selectedScopeData && (
                  <Paper sx={{ p: 2, bgcolor: 'secondary.50' }}>
                    <Typography variant="subtitle2">
                      Selected Warehouse: {selectedScopeData.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Location: {selectedScopeData.location}
                    </Typography>
                    <Chip 
                      size="small" 
                      label="Simulating as WAREHOUSE_KEEPER" 
                      color="secondary" 
                      sx={{ mt: 1 }}
                    />
                  </Paper>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Current Selection Status */}
        {selectedScope && selectedScopeType && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar sx={{ bgcolor: getScopeColor(selectedScopeType) + '.main' }}>
                  {getScopeIcon(selectedScopeType)}
                </Avatar>

                <Box>
                  <Typography variant="h6">
                    Simulating as {getSimulatedRole()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedScopeData?.name} - {selectedScopeData?.location}
                  </Typography>
                </Box>

                <Chip
                  label={`Scope: ${getScopeLabel(selectedScopeType)}`}
                  color={getScopeColor(selectedScopeType)}
                  variant="outlined"
                />
                
                <Chip
                  icon={<WarningIcon />}
                  label="Simulation Mode"
                  color="warning"
                  variant="filled"
                />
              </Box>

              <Alert severity="warning" icon={<SecurityIcon />}>
                <strong>You are in simulation mode.</strong> All operations will be performed as{' '}
                <strong>{getSimulatedRole()}</strong>. Your admin privileges are temporarily suspended.
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Functions */}
        {selectedScope && selectedScopeType && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Available Functions (Simulation Mode)
              </Typography>

              <Grid container spacing={2}>
                {selectedScopeType === 'BRANCH' && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Card
                      sx={{ 
                        cursor: 'pointer', 
                        '&:hover': { bgcolor: 'action.hover' }, 
                        border: 2, 
                        borderColor: 'primary.main' 
                      }}
                      onClick={handlePOSAccess}
                    >
                      <CardContent sx={{ textAlign: 'center', p: 2 }}>
                        <POSIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="h6">POS Terminal</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Simulating as Cashier
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {selectedScopeType === 'WAREHOUSE' && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Card
                      sx={{ 
                        cursor: 'pointer', 
                        '&:hover': { bgcolor: 'action.hover' }, 
                        border: 2, 
                        borderColor: 'secondary.main' 
                      }}
                      onClick={handleWarehouseBillingAccess}
                    >
                      <CardContent sx={{ textAlign: 'center', p: 2 }}>
                        <ReceiptIcon color="secondary" sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="h6">Warehouse Billing</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Simulating as Warehouse Keeper
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                <Grid item xs={12} sm={6} md={4}>
                  <Card
                    sx={{ 
                      cursor: 'pointer', 
                      '&:hover': { bgcolor: 'action.hover' }, 
                      border: 2, 
                      borderColor: 'info.main' 
                    }}
                    onClick={handleInventoryAccess}
                  >
                    <CardContent sx={{ textAlign: 'center', p: 2 }}>
                      <InventoryIcon color="info" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="h6">Inventory</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Simulating as {getSimulatedRole()}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card
                    sx={{ 
                      cursor: 'pointer', 
                      '&:hover': { bgcolor: 'action.hover' }, 
                      border: 2, 
                      borderColor: 'warning.main' 
                    }}
                    onClick={handleReportsAccess}
                  >
                    <CardContent sx={{ textAlign: 'center', p: 2 }}>
                      <ReportsIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="h6">Reports</Typography>
                      <Typography variant="caption" color="text.secondary">
                        View only
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              How Simulation Mode Works
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <SecurityIcon color="warning" />
                </ListItemIcon>
                <ListItemText 
                  primary="Temporary Role Change" 
                  secondary="You're temporarily acting as a Cashier or Warehouse Keeper" 
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <PersonIcon color="warning" />
                </ListItemIcon>
                <ListItemText 
                  primary="Limited Permissions" 
                  secondary="You can only perform actions allowed for that role" 
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <BusinessIcon color="warning" />
                </ListItemIcon>
                <ListItemText 
                  primary="Scope Locked" 
                  secondary="All operations are restricted to selected branch/warehouse" 
                />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <LocationIcon color="warning" />
                </ListItemIcon>
                <ListItemText 
                  primary="Exit Anytime" 
                  secondary="Click 'Exit Simulation' to return to admin mode" 
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Box>
    </DashboardLayout>
  )
}

export default AdminDashboardPage