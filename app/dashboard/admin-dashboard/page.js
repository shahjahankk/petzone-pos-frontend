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
  Security as SecurityIcon
} from '@mui/icons-material'

import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import PermissionCheck from '../../../components/auth/PermissionCheck'
import { fetchBranches } from '../../store/slices/branchesSlice'
import { fetchWarehouses } from '../../store/slices/warehousesSlice'

const AdminDashboardPage = () => {
  const dispatch = useDispatch()
  const router = useRouter()

  const { data: branches, loading: branchesLoading } = useSelector(state => state.branches)
  const { data: warehouses, loading: warehousesLoading } = useSelector(state => state.warehouses)

  const { scopeType, scopeId } = useSelector(state => state.scope)

  const [selectedScope, setSelectedScope] = useState('')
  const [selectedScopeType, setSelectedScopeType] = useState('')
  const [selectedScopeData, setSelectedScopeData] = useState(null)

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
  
  // USE THE NEW HELPER METHOD
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

  const handlePOSAccess = () => {
    if (!selectedScope || selectedScopeType !== 'BRANCH') {
      alert('Please select a branch first')
      return
    }

    router.push(`/dashboard/pos/terminal`)
  }

  const handleWarehouseBillingAccess = () => {
    if (!selectedScope || selectedScopeType !== 'WAREHOUSE') {
      alert('Please select a warehouse first')
      return
    }

    router.push(`/dashboard/warehouse-billing`)
  }

  const handleInventoryAccess = () => {
    if (!selectedScope || !selectedScopeType) {
      alert('Please select a branch or warehouse first')
      return
    }

    router.push(`/dashboard/inventory`)
  }

  const handleReportsAccess = () => {
    if (!selectedScope || !selectedScopeType) {
      alert('Please select a branch or warehouse first')
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
            Select a branch or warehouse to work under that scope.
          </Typography>
        </Box>

        {/* Scope Selection */}
        <Grid container spacing={3}>
          {/* Branch Selection */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <StoreIcon color="primary" />
                  Branch Access
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
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2">
                      Selected Branch: {selectedScopeData.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Location: {selectedScopeData.location}
                    </Typography>
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
                  Warehouse Access
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
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2">
                      Selected Warehouse: {selectedScopeData.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Location: {selectedScopeData.location}
                    </Typography>
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
                    Working as {getScopeLabel(selectedScopeType)} User
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
              </Box>

              <Alert severity="info">
                All operations will now be saved under <b>{selectedScopeData?.name}</b>.
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Functions */}
        {selectedScope && selectedScopeType && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Available Functions
              </Typography>

              <Grid container spacing={2}>
                {selectedScopeType === 'BRANCH' && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Card
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, border: 1, borderColor: 'primary.main' }}
                      onClick={handlePOSAccess}
                    >
                      <CardContent sx={{ textAlign: 'center', p: 2 }}>
                        <POSIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="h6">POS Terminal</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {selectedScopeType === 'WAREHOUSE' && (
                  <Grid item xs={12} sm={6} md={4}>
                    <Card
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, border: 1, borderColor: 'secondary.main' }}
                      onClick={handleWarehouseBillingAccess}
                    >
                      <CardContent sx={{ textAlign: 'center', p: 2 }}>
                        <ReceiptIcon color="secondary" sx={{ fontSize: 40, mb: 1 }} />
                        <Typography variant="h6">Warehouse Billing</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                <Grid item xs={12} sm={6} md={4}>
                  <Card
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, border: 1, borderColor: 'info.main' }}
                    onClick={handleInventoryAccess}
                  >
                    <CardContent sx={{ textAlign: 'center', p: 2 }}>
                      <InventoryIcon color="info" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="h6">Inventory</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, border: 1, borderColor: 'warning.main' }}
                    onClick={handleReportsAccess}
                  >
                    <CardContent sx={{ textAlign: 'center', p: 2 }}>
                      <ReportsIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
                      <Typography variant="h6">Reports</Typography>
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
              How to Use Admin Dashboard
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <SecurityIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary="Select Scope" secondary="Choose branch or warehouse first" />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <PersonIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary="Scope Mode" secondary="All actions will save inside selected scope" />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <BusinessIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary="Data Filter" secondary="Inventory, sales, billing will be filtered automatically" />
              </ListItem>

              <ListItem>
                <ListItemIcon>
                  <LocationIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary="Switch Anytime" secondary="Admin can switch branch/warehouse anytime" />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Box>
    </DashboardLayout>
  )
}

export default AdminDashboardPage
