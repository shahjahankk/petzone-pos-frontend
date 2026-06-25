import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

// Async thunks - REMOVED all scope validation
export const fetchSales = createAsyncThunk(
  'sales/fetchSales',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      // ❌ REMOVED scope validation - now handled by axios headers

      const response = await api.get('/sales', { params })


      return response.data
    } catch (error) {

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
      // ❌ REMOVED scope validation - now handled by axios headers
      const { __idempotencyKey, ...body } = saleData || {}

      const headers = {}
      if (__idempotencyKey && typeof __idempotencyKey === 'string') {
        headers['Idempotency-Key'] = __idempotencyKey
      }

      const response = await api.post('/sales', body, { headers })

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
        const permissionMessage =
          apiMessage || 'Permission denied. You may not have access to this scope.'
        return rejectWithValue({ message: permissionMessage, status })
      }


      const errorMessage = apiMessage || error.message || defaultMessage
      return rejectWithValue({ message: errorMessage, status })
    }
  }
)

export const createWarehouseSale = createAsyncThunk(
  'sales/createWarehouseSale',
  async (saleData, { rejectWithValue, getState }) => {
    try {
      // ❌ REMOVED scope validation - now handled by axios headers
      const { __idempotencyKey, ...body } = saleData || {}

      const headers = {}
      if (__idempotencyKey && typeof __idempotencyKey === 'string') {
        headers['Idempotency-Key'] = __idempotencyKey
      }

      const response = await api.post('/warehouse-sales', body, { headers })
      return response.data
    } catch (error) {
      const status = error.response?.status
      const data = error.response?.data
      let apiMessage = data?.message || error.message || 'Failed to create warehouse sale'
      if (Array.isArray(data?.errors) && data.errors.length > 0) {
        const detail = data.errors.map((e) => e.msg || e.message).filter(Boolean).join('; ')
        if (detail) apiMessage = `${apiMessage}: ${detail}`
      } else if (data?.errors && typeof data.errors === 'object' && !Array.isArray(data.errors)) {
        apiMessage = JSON.stringify(data.errors)
      }

      if (status === 403) {
        return rejectWithValue({ message: apiMessage || 'Permission denied. You may not have access to this warehouse.', status })
      }

      return rejectWithValue({
        message: apiMessage,
        status
      })
    }
  }
)

export const updateSale = createAsyncThunk(
  'sales/updateSale',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/sales/${id}`, data)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update sale')
    }
  }
)

export const deleteSale = createAsyncThunk(
  'sales/deleteSale',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/sales/${id}`)
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
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/sales/returns', { params })
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
  async (returnData, { rejectWithValue }) => {
    try {
      const response = await api.post('/sales/returns', returnData)
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
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/sales/latest')
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch latest sales')
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
  error: null
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

      // fetchSalesReturns — do not toggle global loading/error; runs alongside fetchSales
      .addCase(fetchSalesReturns.pending, (state) => {})
      .addCase(fetchSalesReturns.fulfilled, (state, action) => {
        state.returns = action.payload.data || action.payload
      })
      .addCase(fetchSalesReturns.rejected, (state) => {})

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
  }
})

export const { clearError, clearCache } = salesSlice.actions
export default salesSlice.reducer