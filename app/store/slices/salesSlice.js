import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

// Helper to get scope from multiple sources
const getScopeInfo = (getState) => {
  const state = getState()
  const { scopeType, scopeId } = state.scope
  const { user } = state.auth

  // Priority 1: Redux scope (set by admin simulation)
  if (scopeType && scopeId) {
    return { scopeType, scopeId, source: 'redux' }
  }

  // Priority 2: User's assigned branch/warehouse (for cashiers/warehouse keepers)
  if (user) {
    if (user.branchId) {
      return { scopeType: 'BRANCH', scopeId: user.branchId, source: 'user' }
    }
    if (user.warehouseId) {
      return { scopeType: 'WAREHOUSE', scopeId: user.warehouseId, source: 'user' }
    }
  }

  // Priority 3: Session storage (for admin simulation persistence)
  if (typeof window !== 'undefined') {
    const sessionScopeType = sessionStorage.getItem('scopeType')
    const sessionScopeId = sessionStorage.getItem('scopeId')
    if (sessionScopeType && sessionScopeId) {
      return { 
        scopeType: sessionScopeType, 
        scopeId: Number(sessionScopeId), 
        source: 'session' 
      }
    }
  }

  return { scopeType: null, scopeId: null, source: null }
}

// Async thunks
export const fetchSales = createAsyncThunk(
  'sales/fetchSales',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId, source } = getScopeInfo(getState)

      if (!scopeType || !scopeId) {
        // For cashiers/warehouse keepers, this should not happen as they have assigned scope
        // But if it does, provide helpful message
        const { user } = getState().auth
        if (user?.role === 'CASHIER' || user?.role === 'WAREHOUSE_KEEPER') {
          return rejectWithValue({
            message: 'Your account is not assigned to any branch or warehouse. Please contact admin.',
            requiresAssignment: true
          })
        }
        return rejectWithValue({
          message: 'Please select a Branch or Warehouse scope first.'
        })
      }

      console.log(`[SalesSlice] Using scope from ${source}:`, { scopeType, scopeId })

      const paramsWithScope = {
        ...params,
        ...(scopeType === 'BRANCH' ? { branchId: scopeId } : {}),
        ...(scopeType === 'WAREHOUSE' ? { warehouseId: scopeId } : {})
      }

      const cacheKey = JSON.stringify({ ...paramsWithScope, source })
      const { cache } = getState().sales || {}
      const cached = cache?.[cacheKey]

      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return { ...cached.payload, _fromCache: true }
      }

      console.log('[SalesSlice] fetchSales - Request params:', paramsWithScope)

      const response = await api.get('/sales', { params: paramsWithScope })

      console.log('[SalesSlice] fetchSales - Response:', {
        success: response.data?.success,
        count: response.data?.count,
        dataLength: response.data?.data?.length,
        hasData: !!response.data?.data
      })

      return response.data
    } catch (error) {
      console.error('[SalesSlice] fetchSales - Error:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        params
      })

      const status = error.response?.status
      const serverMsg = error.response?.data?.message || error.response?.data || null

      return rejectWithValue({
        message: error.message || 'Failed to fetch sales',
        status,
        serverMsg
      })
    }
  }
)

export const createSale = createAsyncThunk(
  'sales/createSale',
  async (saleData, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId, source } = getScopeInfo(getState)
      const { user } = getState().auth

      if (!scopeType || !scopeId) {
        if (user?.role === 'CASHIER' || user?.role === 'WAREHOUSE_KEEPER') {
          return rejectWithValue({
            message: 'Your account is not assigned to any branch or warehouse. Please contact admin.',
            requiresAssignment: true
          })
        }
        return rejectWithValue({
          message: 'Please select Branch or Warehouse scope first.'
        })
      }

      console.log(`[SalesSlice] Creating sale with scope from ${source}:`, { scopeType, scopeId })

      const payload = {
        ...saleData,
        ...(scopeType === 'BRANCH' ? { branchId: scopeId } : {}),
        ...(scopeType === 'WAREHOUSE' ? { warehouseId: scopeId } : {}),
        // Add audit fields
        createdBy: user?.id,
        createdByRole: user?.role,
        ...(user?.role === 'ADMIN' && source !== 'user' ? { simulatedBy: user.id } : {})
      }

      const response = await api.post('/sales', payload)

      if (response.data.success) {
        return response.data
      } else {
        const message = response.data.message || 'Failed to create sale'
        return rejectWithValue({ message, status: response.status })
      }
    } catch (error) {
      const status = error.response?.status
      const apiMessage = error.response?.data?.message || error.response?.data?.errors
      const defaultMessage = 'Failed to create sale'

      if (status === 403) {
        const { user } = getState().auth
        const isSimulation = user?.role === 'ADMIN' && sessionStorage.getItem('simulation_mode') === 'true'
        
        let permissionMessage = apiMessage
        if (isSimulation) {
          permissionMessage = permissionMessage || 
            'Permission denied in simulation mode. You may not have the required permissions as a simulated user.'
        } else {
          permissionMessage = permissionMessage || 
            'Permission denied: please ask an admin to grant sales permissions for this scope.'
        }
        
        return rejectWithValue({ message: permissionMessage, status })
      }

      console.error('[SalesSlice] createSale error:', error)

      const errorMessage = apiMessage || error.message || defaultMessage
      return rejectWithValue({ message: errorMessage, status })
    }
  }
)

export const createWarehouseSale = createAsyncThunk(
  'sales/createWarehouseSale',
  async (saleData, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId, source } = getScopeInfo(getState)
      const { user } = getState().auth

      if (scopeType !== 'WAREHOUSE') {
        return rejectWithValue({
          message: 'Warehouse scope is required to create warehouse sale.'
        })
      }

      if (!scopeId) {
        return rejectWithValue({
          message: 'No warehouse assigned. Please contact admin.'
        })
      }

      console.log(`[SalesSlice] Creating warehouse sale with scope from ${source}:`, { scopeId })

      const payload = {
        ...saleData,
        warehouseId: scopeId,
        createdBy: user?.id,
        createdByRole: user?.role,
        ...(user?.role === 'ADMIN' && source !== 'user' ? { simulatedBy: user.id } : {})
      }

      const response = await api.post('/warehouse-sales', payload)
      return response.data
    } catch (error) {
      const status = error.response?.status
      const apiMessage = error.response?.data?.message || error.response?.data?.errors
      const defaultMessage = 'Failed to create warehouse sale'

      if (status === 403) {
        const { user } = getState().auth
        const isSimulation = user?.role === 'ADMIN' && sessionStorage.getItem('simulation_mode') === 'true'
        
        const permissionMessage = isSimulation
          ? (apiMessage || 'Permission denied in simulation mode.')
          : (apiMessage || 'Permission denied: please ask an admin to grant warehouse sales permissions.')
          
        return rejectWithValue({ message: permissionMessage, status })
      }

      return rejectWithValue({
        message: apiMessage || error.message || defaultMessage,
        status
      })
    }
  }
)

export const updateSale = createAsyncThunk(
  'sales/updateSale',
  async ({ id, data }, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId } = getScopeInfo(getState)
      const { user } = getState().auth

      if (!scopeType || !scopeId) {
        return rejectWithValue({
          message: 'Please select Branch or Warehouse scope first.'
        })
      }

      const payload = {
        ...data,
        ...(scopeType === 'BRANCH' ? { branchId: scopeId } : {}),
        ...(scopeType === 'WAREHOUSE' ? { warehouseId: scopeId } : {}),
        updatedBy: user?.id,
        updatedByRole: user?.role
      }

      const response = await api.put(`/sales/${id}`, payload)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update sale')
    }
  }
)

export const deleteSale = createAsyncThunk(
  'sales/deleteSale',
  async (id, { rejectWithValue, getState }) => {
    try {
      const { user } = getState().auth
      await api.delete(`/sales/${id}`, {
        data: { 
          deletedBy: user?.id,
          deletedByRole: user?.role 
        }
      })
      return id
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete sale')
    }
  }
)

export const getSale = createAsyncThunk(
  'sales/getSale',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/sales/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch sale')
    }
  }
)

export const fetchSalesReturns = createAsyncThunk(
  'sales/fetchSalesReturns',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId } = getScopeInfo(getState)

      if (!scopeType || !scopeId) {
        return rejectWithValue({
          message: 'Please select Branch or Warehouse scope first.'
        })
      }

      const paramsWithScope = {
        ...params,
        ...(scopeType === 'BRANCH' ? { branchId: scopeId } : {}),
        ...(scopeType === 'WAREHOUSE' ? { warehouseId: scopeId } : {})
      }

      const response = await api.get('/sales/returns', { params: paramsWithScope })
      return response.data
    } catch (error) {
      const status = error.response?.status
      const serverMsg = error.response?.data?.message || error.response?.data || null

      return rejectWithValue({
        message: error.message || 'Failed to fetch sales returns',
        status,
        serverMsg
      })
    }
  }
)

export const createSalesReturn = createAsyncThunk(
  'sales/createSalesReturn',
  async (returnData, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId } = getScopeInfo(getState)
      const { user } = getState().auth

      if (!scopeType || !scopeId) {
        return rejectWithValue({
          message: 'Please select Branch or Warehouse scope first.'
        })
      }

      const payload = {
        ...returnData,
        ...(scopeType === 'BRANCH' ? { branchId: scopeId } : {}),
        ...(scopeType === 'WAREHOUSE' ? { warehouseId: scopeId } : {}),
        createdBy: user?.id,
        createdByRole: user?.role
      }

      const response = await api.post('/sales/returns', payload)
      return response.data
    } catch (error) {
      const status = error.response?.status
      const serverMsg = error.response?.data?.message || error.response?.data || null

      return rejectWithValue({
        message: error.message || 'Failed to create sales return',
        status,
        serverMsg
      })
    }
  }
)

export const fetchLatestSales = createAsyncThunk(
  'sales/fetchLatestSales',
  async (_, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId } = getScopeInfo(getState)

      if (!scopeType || !scopeId) {
        return rejectWithValue({
          message: 'Please select Branch or Warehouse scope first.'
        })
      }

      const paramsWithScope = {
        ...(scopeType === 'BRANCH' ? { branchId: scopeId } : {}),
        ...(scopeType === 'WAREHOUSE' ? { warehouseId: scopeId } : {})
      }

      const response = await api.get('/sales/latest', { params: paramsWithScope })
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch latest sales')
    }
  }
)

export const fetchSalesSummary = createAsyncThunk(
  'sales/fetchSalesSummary',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId } = getScopeInfo(getState)

      if (!scopeType || !scopeId) {
        return rejectWithValue({
          message: 'Please select Branch or Warehouse scope first.'
        })
      }

      const paramsWithScope = {
        ...params,
        ...(scopeType === 'BRANCH' ? { branchId: scopeId } : {}),
        ...(scopeType === 'WAREHOUSE' ? { warehouseId: scopeId } : {})
      }

      const response = await api.get('/sales/summary', { params: paramsWithScope })
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch sales summary')
    }
  }
)

const initialState = {
  data: [],
  returns: [],
  latestSales: [],
  summary: {
    totalSales: 0,
    totalTransactions: 0,
    averageOrderValue: 0,
    completedSales: 0
  },
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1
  },
  cache: {},
  loading: false,
  error: null,
  scopeSource: null // Track where scope came from (redux/user/session)
}

const salesSlice = createSlice({
  name: 'sales',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    clearCache: (state) => {
      state.cache = {}
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchSales
      .addCase(fetchSales.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSales.fulfilled, (state, action) => {
        state.loading = false

        const payload = action.payload || {}
        const data = payload.data || payload

        state.data = data
        state.error = null

        // Track scope source from meta
        state.scopeSource = action.meta?.arg?.source || null

        state.pagination = {
          page: payload.page || action.meta?.arg?.page || 1,
          limit: payload.limit || action.meta?.arg?.limit || data?.length || 50,
          total: payload.count ?? payload.total ?? data?.length ?? 0,
          totalPages:
            payload.totalPages ||
            Math.max(1, Math.ceil((payload.count ?? data?.length ?? 0) / (payload.limit || data?.length || 50)))
        }

        state.summary = payload.summary || state.summary

        const cacheKey = JSON.stringify(action.meta?.arg || {})
        state.cache[cacheKey] = {
          timestamp: Date.now(),
          payload
        }
      })
      .addCase(fetchSales.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // createSale
      .addCase(createSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createSale.fulfilled, (state, action) => {
        state.loading = false
        const newSale = action.payload.data || action.payload
        state.data = [newSale, ...state.data] // Add to beginning for better UX
        state.error = null
      })
      .addCase(createSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // createWarehouseSale
      .addCase(createWarehouseSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createWarehouseSale.fulfilled, (state, action) => {
        state.loading = false
        const newSale = action.payload.data || action.payload
        state.data = [newSale, ...state.data]
        state.error = null
      })
      .addCase(createWarehouseSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // updateSale
      .addCase(updateSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateSale.fulfilled, (state, action) => {
        state.loading = false
        const updatedSale = action.payload.data || action.payload
        const index = state.data.findIndex((sale) => sale.id === updatedSale.id)

        if (index !== -1) {
          state.data[index] = updatedSale
        }

        state.error = null
      })
      .addCase(updateSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // deleteSale
      .addCase(deleteSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteSale.fulfilled, (state, action) => {
        state.loading = false
        state.data = state.data.filter((sale) => sale.id !== action.payload)
        state.error = null
      })
      .addCase(deleteSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // getSale
      .addCase(getSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getSale.fulfilled, (state, action) => {
        state.loading = false
        state.error = null

        const saleData = action.payload.data || action.payload
        const index = state.data.findIndex((sale) => sale.id === saleData.id)

        if (index !== -1) {
          state.data[index] = saleData
        } else {
          state.data.push(saleData)
        }
      })
      .addCase(getSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // fetchSalesReturns
      .addCase(fetchSalesReturns.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSalesReturns.fulfilled, (state, action) => {
        state.loading = false
        state.returns = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchSalesReturns.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // createSalesReturn
      .addCase(createSalesReturn.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createSalesReturn.fulfilled, (state, action) => {
        state.loading = false
        const newReturn = action.payload.data || action.payload
        state.returns = [newReturn, ...state.returns]
        state.error = null
      })
      .addCase(createSalesReturn.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // fetchLatestSales
      .addCase(fetchLatestSales.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchLatestSales.fulfilled, (state, action) => {
        state.loading = false
        state.latestSales = action.payload.sales || action.payload
        state.error = null
      })
      .addCase(fetchLatestSales.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // fetchSalesSummary
      .addCase(fetchSalesSummary.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSalesSummary.fulfilled, (state, action) => {
        state.loading = false
        state.summary = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchSalesSummary.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  }
})

export const { clearError, clearCache } = salesSlice.actions
export default salesSlice.reducer