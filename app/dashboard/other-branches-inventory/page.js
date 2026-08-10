'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RoleGuard from '../../../components/auth/RoleGuard'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Autocomplete,
  TextField,
  InputAdornment,
  Skeleton,
  Fade,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import {
  Store,
  Inventory,
  Warning,
  TrendingUp,
  Category,
  Search,
  LocationOn,
  Business,
  Clear,
} from '@mui/icons-material'
import { fetchCrossBranchInventory } from '../../store/slices/inventorySlice'
import { fetchBranches } from '../../store/slices/branchesSlice'

function OtherBranchesInventoryPage() {
  const dispatch = useDispatch()
  const { user } = useSelector((state) => state.auth)
  const {
    crossBranchData = [],
    crossBranchLoading,
    crossBranchError
  } = useSelector((state) => state.inventory)
  const { data: branches, loading: branchesLoading } = useSelector((state) => state.branches)

  const [selectedBranch, setSelectedBranch] = useState(null)

  useEffect(() => {
    dispatch(fetchBranches())
    dispatch(fetchCrossBranchInventory())
  }, [dispatch])

  const ownBranchId = user?.branchId != null ? Number(user.branchId) : null

  // Other branches only (exclude caller's branch); coerce ids for string/number mismatch
  const otherBranches = useMemo(() => {
    const list = Array.isArray(branches) ? branches : []
    return list.filter((branch) => {
      if (ownBranchId == null || Number.isNaN(ownBranchId)) return true
      return Number(branch.id) !== ownBranchId
    })
  }, [branches, ownBranchId])

  const selectedBranchId = selectedBranch?.id != null ? Number(selectedBranch.id) : null

  const filteredInventory = useMemo(() => {
    if (selectedBranchId == null || !Array.isArray(crossBranchData)) return []
    return crossBranchData.filter((item) => {
      const itemScopeType = (item.scopeType || item.scope_type || '').toUpperCase()
      const itemScopeId = Number(item.scopeId ?? item.scope_id)
      return itemScopeType === 'BRANCH' && itemScopeId === selectedBranchId
    }).map((item) => {
      const qty = Number(item.quantity ?? item.currentStock ?? item.current_stock ?? 0)
      return {
        ...item,
        quantity: qty,
        currentStock: qty,
        minStockLevel: Number(item.minStockLevel ?? item.min_stock_level ?? 0),
        costPrice: Number(item.costPrice ?? item.cost_price ?? 0),
        sellingPrice: Number(item.sellingPrice ?? item.selling_price ?? 0),
        category: item.category || 'Uncategorized',
        totalSold: Number(item.totalSold || 0),
        totalReturned: Number(item.totalReturned || 0),
        totalPurchased: Number(item.totalPurchased || 0),
      }
    })
  }, [selectedBranchId, crossBranchData])

  const totalItems = filteredInventory.length
  const lowStockItems = filteredInventory.filter((item) =>
    item.quantity <= (item.minStockLevel || 10)
  ).length
  const totalValue = filteredInventory.reduce((sum, item) =>
    sum + (item.quantity * (item.costPrice || 0)), 0
  )
  const categories = [...new Set(filteredInventory.map((item) => item.category))].length

  const handleBranchChange = (_event, newValue) => {
    setSelectedBranch(newValue || null)
  }

  const handleClearSelection = (event) => {
    event?.stopPropagation?.()
    setSelectedBranch(null)
  }

  const errorMessage = typeof crossBranchError === 'string'
    ? crossBranchError
    : (crossBranchError?.message || null)

  return (
    <RoleGuard allowedRoles={['CASHIER']}>
      <DashboardLayout>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box>
              <Typography variant="h4" gutterBottom>
                Other Branches Inventory
              </Typography>
              <Typography variant="subtitle1" color="textSecondary">
                View inventory from other branches (Read Only)
              </Typography>
            </Box>
            <Chip
              label="CASHIER"
              color="primary"
              variant="outlined"
            />
          </Box>

          {/* Branch Selection — full-width searchable dropdown */}
          <Card sx={{ mb: 3, boxShadow: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Business sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" color="primary">
                  Branch Selection
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  gap: 2,
                  alignItems: { xs: 'stretch', md: 'flex-start' },
                }}
              >
                <Box sx={{ flex: '1 1 auto', width: '100%', minWidth: 0 }}>
                  {branchesLoading ? (
                    <Skeleton variant="rectangular" height={64} sx={{ borderRadius: 1, width: '100%' }} />
                  ) : (
                    <Autocomplete
                      fullWidth
                      value={selectedBranch}
                      onChange={handleBranchChange}
                      options={otherBranches}
                      getOptionLabel={(option) =>
                        option ? `${option.name || ''} (${option.code || ''})` : ''
                      }
                      isOptionEqualToValue={(option, value) =>
                        Number(option?.id) === Number(value?.id)
                      }
                      filterOptions={(options, state) => {
                        const q = (state.inputValue || '').trim().toLowerCase()
                        if (!q) return options
                        return options.filter((branch) => {
                          const name = (branch.name || '').toLowerCase()
                          const code = (branch.code || '').toLowerCase()
                          const loc = (branch.location || branch.address || '').toLowerCase()
                          return name.includes(q) || code.includes(q) || loc.includes(q)
                        })
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Search and Select Branch"
                          placeholder="Type branch name or code..."
                          fullWidth
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <>
                                <InputAdornment position="start">
                                  <Search color="action" />
                                </InputAdornment>
                                {params.InputProps.startAdornment}
                              </>
                            ),
                            endAdornment: (
                              <>
                                {selectedBranch && (
                                  <InputAdornment position="end">
                                    <Clear
                                      onClick={handleClearSelection}
                                      sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                                    />
                                  </InputAdornment>
                                )}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          }}
                          sx={{
                            width: '100%',
                            '& .MuiOutlinedInput-root': {
                              minHeight: 64,
                              fontSize: '1.05rem',
                            },
                          }}
                        />
                      )}
                      renderOption={(props, option) => (
                        <Box component="li" {...props} key={option.id} sx={{ display: 'flex', alignItems: 'center', py: 1.5, px: 2 }}>
                          <LocationOn sx={{ mr: 2, color: 'text.secondary', fontSize: 24 }} />
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="body1" fontWeight="medium" sx={{ mb: 0.5 }}>
                              {option.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {option.code}
                              {(option.location || option.address) ? ` • ${option.location || option.address}` : ''}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                      noOptionsText={
                        <Box sx={{ textAlign: 'center', py: 2 }}>
                          <Store sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                          <Typography variant="body2" color="text.secondary">
                            {otherBranches.length === 0
                              ? 'No other branches available'
                              : 'No branches found matching your search'}
                          </Typography>
                        </Box>
                      }
                      slotProps={{
                        paper: {
                          sx: {
                            boxShadow: 3,
                            borderRadius: 2,
                            minWidth: { xs: '100%', sm: 480 },
                          },
                        },
                      }}
                    />
                  )}
                </Box>

                <Box sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0 }}>
                  <Fade in={!!selectedBranch}>
                    <Card
                      variant="outlined"
                      sx={{
                        p: 2,
                        bgcolor: selectedBranch ? 'primary.50' : 'grey.50',
                        border: selectedBranch ? '1px solid' : '1px dashed',
                        borderColor: selectedBranch ? 'primary.main' : 'grey.300',
                        minHeight: 64,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Store sx={{ mr: 1, color: selectedBranch ? 'primary.main' : 'text.secondary' }} />
                        <Typography variant="subtitle2" color={selectedBranch ? 'primary.main' : 'text.secondary'}>
                          {selectedBranch ? 'Selected Branch' : 'No Branch Selected'}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {selectedBranch
                          ? `Viewing inventory for: ${selectedBranch.name}`
                          : 'Please select a branch to view its inventory'}
                      </Typography>
                      {selectedBranch && (
                        <Box sx={{ mt: 1 }}>
                          <Chip
                            label={`${filteredInventory.length} items`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      )}
                    </Card>
                  </Fade>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {errorMessage && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {errorMessage}
            </Alert>
          )}

          {selectedBranchId != null && (
            <Fade in>
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography color="textSecondary" gutterBottom variant="h6">
                            Total Items
                          </Typography>
                          <Typography variant="h4">
                            {totalItems.toLocaleString()}
                          </Typography>
                        </Box>
                        <Inventory sx={{ fontSize: 40, color: 'primary.main' }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography color="textSecondary" gutterBottom variant="h6">
                            Low Stock Items
                          </Typography>
                          <Typography variant="h4" color="warning.main">
                            {lowStockItems.toLocaleString()}
                          </Typography>
                        </Box>
                        <Warning sx={{ fontSize: 40, color: 'warning.main' }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography color="textSecondary" gutterBottom variant="h6">
                            Total Value
                          </Typography>
                          <Typography variant="h4" color="success.main">
                            {totalValue.toLocaleString()}
                          </Typography>
                        </Box>
                        <TrendingUp sx={{ fontSize: 40, color: 'success.main' }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography color="textSecondary" gutterBottom variant="h6">
                            Categories
                          </Typography>
                          <Typography variant="h4" color="info.main">
                            {categories.toLocaleString()}
                          </Typography>
                        </Box>
                        <Category sx={{ fontSize: 40, color: 'info.main' }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Fade>
          )}

          {selectedBranchId != null ? (
            <Fade in>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {selectedBranch?.name} Inventory (View Only) ({filteredInventory.length})
                  </Typography>

                  {crossBranchLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                      <CircularProgress />
                    </Box>
                  ) : filteredInventory.length === 0 ? (
                    <Alert severity="info">
                      No inventory items found for this branch.
                    </Alert>
                  ) : (
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Item Name</TableCell>
                            <TableCell>Category</TableCell>
                            <TableCell align="right">Quantity</TableCell>
                            <TableCell align="right">Min Stock</TableCell>
                            <TableCell align="right">Cost Price</TableCell>
                            <TableCell align="right">Selling Price</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredInventory.map((item) => {
                            const isOutOfStock = item.quantity <= 0
                            const isLowStock = item.quantity <= (item.minStockLevel || 10)

                            let statusColor = 'success'
                            let statusLabel = 'In Stock'
                            if (isOutOfStock) {
                              statusColor = 'error'
                              statusLabel = 'Out of Stock'
                            } else if (isLowStock) {
                              statusColor = 'warning'
                              statusLabel = 'Low Stock'
                            }

                            return (
                              <TableRow key={item.id}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>
                                  <Chip label={item.category} size="small" />
                                </TableCell>
                                <TableCell align="right">
                                  <Chip
                                    label={item.quantity || 0}
                                    size="small"
                                    color={
                                      item.quantity === 0 ? 'error'
                                        : item.quantity <= item.minStockLevel ? 'warning'
                                          : 'success'
                                    }
                                    variant="outlined"
                                  />
                                </TableCell>
                                <TableCell align="right">{item.minStockLevel || 0}</TableCell>
                                <TableCell align="right">{(item.costPrice || 0).toFixed(2)}</TableCell>
                                <TableCell align="right">{(item.sellingPrice || 0).toFixed(2)}</TableCell>
                                <TableCell>
                                  <Chip
                                    label={statusLabel}
                                    color={statusColor}
                                    size="small"
                                  />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Fade>
          ) : (
            <Card sx={{ boxShadow: 1 }}>
              <CardContent>
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Store sx={{ fontSize: 80, color: 'text.secondary', mb: 3, opacity: 0.6 }} />
                  <Typography variant="h5" color="textSecondary" gutterBottom fontWeight="medium">
                    Select a Branch
                  </Typography>
                  <Typography variant="body1" color="textSecondary" sx={{ maxWidth: 400, mx: 'auto', mb: 3 }}>
                    Choose a branch from the searchable dropdown above to view its inventory details
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Chip
                      icon={<Search />}
                      label="Search by name or code"
                      variant="outlined"
                      color="primary"
                    />
                    <Chip
                      icon={<LocationOn />}
                      label="View branch details"
                      variant="outlined"
                      color="secondary"
                    />
                    <Chip
                      icon={<Inventory />}
                      label="Read-only access"
                      variant="outlined"
                      color="info"
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>
      </DashboardLayout>
    </RoleGuard>
  )
}

export default OtherBranchesInventoryPage
