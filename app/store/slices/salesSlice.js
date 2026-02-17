import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

// ============================
// FETCH SALES (FIXED)
// ============================
export const fetchSales = createAsyncThunk(
  'sales/fetchSales',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const stateScope = getState().scope || {}

      // fallback: take from params if redux scope not set
      const scopeType = params.scopeType || stateScope.scopeType
      const scopeId = params.scopeId || stateScope.scopeId

      if (!scopeType || !scopeId) {
        return rejectWithValue({
          message: 'Please select Branch or Warehouse scope first.'
        })
      }

      // remove scopeType/scopeId from query
      const { scopeType: _st, scopeId: _sid, ...restParams } = params

      const paramsWithScope = {
        ...restParams,
        branchId: scopeType === 'BRANCH' ? scopeId : undefined,
        warehouseId: scopeType === 'WAREHOUSE' ? scopeId : undefined
      }

      const cacheKey = JSON.stringify(paramsWithScope)
      const cached = getState().sales?.cache?.[cacheKey]

      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return { ...cached.payload, _fromCache: true }
      }

      console.log('[SalesSlice] fetchSales - Request params:', paramsWithScope)

      const response = await api.get('/sales', { params: paramsWithScope })

      return {
        ...response.data,
        _cacheKey: cacheKey
      }
    } catch (error) {
      console.error('[SalesSlice] fetchSales - Error:', error)

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

// ============================
// CREATE SALE (FIXED)
// ============================
export const createSale = createAsyncThunk(
  'sales/createSale',
  async (saleData, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId } = getState().scope || {}

      if (!scopeType || !scopeId) {
        return rejectWithValue({
          message: 'Please select Branch or Warehouse scope first.'
        })
      }

      const payload = {
        ...saleData,
        branchId: scopeType === 'BRANCH' ? scopeId : null,
        warehouseId: scopeType === 'WAREHOUSE' ? scopeId : null
      }

      const response = await api.post('/sales', payload)

      if (response.data?.success) {
        return response.data
      }

      return rejectWithValue({
        message: response.data?.message || 'Failed to create sale',
        status: response.status
      })
    } catch (error) {
      const status = error.response?.status
      const apiMessage = error.response?.data?.message || error.response?.data?.errors

      if (status === 403) {
        return rejectWithValue({
          message:
            apiMessage ||
            'Permission denied: please ask an admin to grant sales permissions for this scope.',
          status
        })
      }

      return rejectWithValue({
        message: apiMessage || error.message || 'Failed to create sale',
        status
      })
    }
  }
)

// ============================
// CREATE WAREHOUSE SALE (FIXED)
// ============================
export const createWarehouseSale = createAsyncThunk(
  'sales/createWarehouseSale',
  async (saleData, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId } = getState().scope || {}

      if (scopeType !== 'WAREHOUSE' || !scopeId) {
        return rejectWithValue({
          message: 'Warehouse scope is required to create warehouse sale.'
        })
      }

      const payload = {
        ...saleData,
        warehouseId: scopeId
      }

      const response = await api.post('/warehouse-sales', payload)

      if (response.data?.success) {
        return response.data
      }

      return rejectWithValue({
        message: response.data?.message || 'Failed to create warehouse sale',
        status: response.status
      })
    } catch (error) {
      const status = error.response?.status
      const apiMessage = error.response?.data?.message || error.response?.data?.errors

      if (status === 403) {
        return rejectWithValue({
          message:
            apiMessage ||
            'Permission denied: please ask an admin to grant warehouse sales permissions for this scope.',
          status
        })
      }

      return rejectWithValue({
        message: apiMessage || error.message || 'Failed to create warehouse sale',
        status
      })
    }
  }
)

// ============================
// UPDATE SALE (FIXED)
// ============================
export const updateSale = createAsyncThunk(
  'sales/updateSale',
  async ({ id, data }, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId } = getState().scope || {}

      if (!scopeType || !scopeId) {
        return rejectWithValue({
          message: 'Please select Branch or Warehouse scope first.'
        })
      }

      const payload = {
        ...data,
        branchId: scopeType === 'BRANCH' ? scopeId : null,
        warehouseId: scopeType === 'WAREHOUSE' ? scopeId : null
      }

      const response = await api.put(`/sales/${id}`, payload)
      return response.data
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.message || error.message || 'Failed to update sale'
      })
    }
  }
)

// ============================
// DELETE SALE
// ============================
export const deleteSale = createAsyncThunk(
  'sales/deleteSale',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/sales/${id}`)
      return id
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.message || error.message || 'Failed to delete sale'
      })
    }
  }
)

// ============================
// GET SINGLE SALE
// ============================
export const getSale = createAsyncThunk(
  'sales/getSale',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.get(`/sales/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.message || error.message || 'Failed to fetch sale'
      })
    }
  }
)

// ============================
// FETCH SALES RETURNS
// ============================
export const fetchSalesReturns = createAsyncThunk(
  'sales/fetchSalesReturns',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId } = getState().scope || {}

      if (!scopeType || !scopeId) {
        return rejectWithValue({
          message: 'Please select Branch or Warehouse scope first.'
        })
      }

      const paramsWithScope = {
        ...params,
        branchId: scopeType === 'BRANCH' ? scopeId : undefined,
        warehouseId: scopeType === 'WAREHOUSE' ? scopeId : undefined
      }

      const response = await api.get('/sales/returns', { params: paramsWithScope })
      return response.data
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.message || error.message || 'Failed to fetch sales returns'
      })
    }
  }
)

// ============================
// CREATE SALES RETURN
// ============================
export const createSalesReturn = createAsyncThunk(
  'sales/createSalesReturn',
  async (returnData, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId } = getState().scope || {}

      if (!scopeType || !scopeId) {
        return rejectWithValue({
          message: 'Please select Branch or Warehouse scope first.'
        })
      }

      const payload = {
        ...returnData,
        branchId: scopeType === 'BRANCH' ? scopeId : null,
        warehouseId: scopeType === 'WAREHOUSE' ? scopeId : null
      }

      const response = await api.post('/sales/returns', payload)
      return response.data
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.message || error.message || 'Failed to create sales return'
      })
    }
  }
)

// ============================
// FETCH LATEST SALES
// ============================
export const fetchLatestSales = createAsyncThunk(
  'sales/fetchLatestSales',
  async (_, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId } = getState().scope || {}

      if (!scopeType || !scopeId) {
        return rejectWithValue({
          message: 'Please select Branch or Warehouse scope first.'
        })
      }

      const paramsWithScope = {
        branchId: scopeType === 'BRANCH' ? scopeId : undefined,
        warehouseId: scopeType === 'WAREHOUSE' ? scopeId : undefined
      }

      const response = await api.get('/sales/latest', { params: paramsWithScope })
      return response.data
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.message || error.message || 'Failed to fetch latest sales'
      })
    }
  }
)

// ============================
// FETCH SALES SUMMARY
// ============================
export const fetchSalesSummary = createAsyncThunk(
  'sales/fetchSalesSummary',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId } = getState().scope || {}

      if (!scopeType || !scopeId) {
        return rejectWithValue({
          message: 'Please select Branch or Warehouse scope first.'
        })
      }

      const paramsWithScope = {
        ...params,
        branchId: scopeType === 'BRANCH' ? scopeId : undefined,
        warehouseId: scopeType === 'WAREHOUSE' ? scopeId : undefined
      }

      const response = await api.get('/sales/summary', { params: paramsWithScope })
      return response.data
    } catch (error) {
      return rejectWithValue({
        message: error.response?.data?.message || error.message || 'Failed to fetch sales summary'
      })
    }
  }
)

// ============================
// INITIAL STATE
// ============================
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
  error: null
}

// ============================
// SLICE
// ============================
const salesSlice = createSlice({
  name: 'sales',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    clearSalesCache: (state) => {
      state.cache = {}
    }
  },
  extraReducers: (builder) => {
    builder
      // FETCH SALES
      .addCase(fetchSales.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSales.fulfilled, (state, action) => {
        state.loading = false

        const payload = action.payload || {}
        const data = payload.data || []

        state.data = data
        state.error = null

        state.pagination = {
          page: payload.page || action.meta?.arg?.page || 1,
          limit: payload.limit || action.meta?.arg?.limit || 50,
          total: payload.count ?? payload.total ?? data.length ?? 0,
          totalPages:
            payload.totalPages ||
            Math.max(1, Math.ceil((payload.count ?? payload.total ?? data.length ?? 0) / (payload.limit || 50)))
        }

        // cache save (FIXED)
        const cacheKey = payload._cacheKey || JSON.stringify(action.meta?.arg || {})
        state.cache[cacheKey] = {
          timestamp: Date.now(),
          payload
        }
      })
      .addCase(fetchSales.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || action.error
      })

      // CREATE SALE
      .addCase(createSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createSale.fulfilled, (state, action) => {
        state.loading = false
        const newSale = action.payload?.data || action.payload
        if (newSale) state.data.unshift(newSale)
      })
      .addCase(createSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || action.error
      })

      // CREATE WAREHOUSE SALE
      .addCase(createWarehouseSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createWarehouseSale.fulfilled, (state) => {
        state.loading = false
        state.error = null
      })
      .addCase(createWarehouseSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || action.error
      })

      // UPDATE SALE
      .addCase(updateSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateSale.fulfilled, (state, action) => {
        state.loading = false
        const updatedSale = action.payload?.data || action.payload

        const index = state.data.findIndex((sale) => sale._id === updatedSale._id || sale.id === updatedSale.id)

        if (index !== -1) {
          state.data[index] = updatedSale
        }
      })
      .addCase(updateSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || action.error
      })

      // DELETE SALE
      .addCase(deleteSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteSale.fulfilled, (state, action) => {
        state.loading = false
        state.data = state.data.filter((sale) => sale._id !== action.payload && sale.id !== action.payload)
      })
      .addCase(deleteSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || action.error
      })

      // GET SINGLE SALE
      .addCase(getSale.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(getSale.fulfilled, (state, action) => {
        state.loading = false
        const saleData = action.payload?.data || action.payload

        const index = state.data.findIndex((sale) => sale._id === saleData._id || sale.id === saleData.id)

        if (index !== -1) {
          state.data[index] = saleData
        } else {
          state.data.unshift(saleData)
        }
      })
      .addCase(getSale.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload || action.error
      })

      // RETURNS
      .addCase(fetchSalesReturns.fulfilled, (state, action) => {
        state.loading = false
        state.returns = action.payload?.data || action.payload || []
      })
      .addCase(createSalesReturn.fulfilled, (state, action) => {
        state.loading = false
        const newReturn = action.payload?.data || action.payload
        if (newReturn) state.returns.unshift(newReturn)
      })

      // LATEST SALES
      .addCase(fetchLatestSales.fulfilled, (state, action) => {
        state.loading = false
        state.latestSales = action.payload?.sales || action.payload?.data || action.payload || []
      })

      // SUMMARY
      .addCase(fetchSalesSummary.fulfilled, (state, action) => {
        state.loading = false
        state.summary = action.payload?.data || action.payload || state.summary
      })
  }
})

export const { clearError, clearSalesCache } = salesSlice.actions
export default salesSlice.reducer
