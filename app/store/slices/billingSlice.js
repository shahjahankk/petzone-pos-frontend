import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// ============================
// ASYNC THUNKS
// ============================

export const fetchBilling = createAsyncThunk(
  'billing/fetchBilling',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId } = getState().scope

      if (!scopeType || !scopeId) {
        return rejectWithValue('Please select Branch or Warehouse scope first.')
      }

      const queryParams = new URLSearchParams()

      if (params.status) queryParams.append('status', params.status)
      if (params.clientName) queryParams.append('clientName', params.clientName)
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      if (params.page) queryParams.append('page', params.page)
      if (params.limit) queryParams.append('limit', params.limit)

      if (scopeType === 'BRANCH') queryParams.append('branchId', scopeId)
      if (scopeType === 'WAREHOUSE') queryParams.append('warehouseId', scopeId)

      const response = await api.get(`/billing?${queryParams.toString()}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch billing records')
    }
  }
)

export const createBillingRecord = createAsyncThunk(
  'billing/createBillingRecord',
  async (billingData, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId } = getState().scope

      if (!scopeType || !scopeId) {
        return rejectWithValue('Please select Branch or Warehouse scope first.')
      }

      const payload = {
        ...billingData,
        branchId: scopeType === 'BRANCH' ? scopeId : null,
        warehouseId: scopeType === 'WAREHOUSE' ? scopeId : null
      }

      const response = await api.post('/billing', payload)
      return response.data
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to create billing record'
      )
    }
  }
)

export const updateBillingRecord = createAsyncThunk(
  'billing/updateBillingRecord',
  async ({ id, data }, { rejectWithValue, getState }) => {
    try {
      const { scopeType, scopeId } = getState().scope

      if (!scopeType || !scopeId) {
        return rejectWithValue('Please select Branch or Warehouse scope first.')
      }

      const payload = {
        ...data,
        branchId: scopeType === 'BRANCH' ? scopeId : null,
        warehouseId: scopeType === 'WAREHOUSE' ? scopeId : null
      }

      const response = await api.put(`/billing/${id}`, payload)
      return { id, data: response.data }
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to update billing record'
      )
    }
  }
)

export const deleteBillingRecord = createAsyncThunk(
  'billing/deleteBillingRecord',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/billing/${id}`)
      return id
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || 'Failed to delete billing record'
      )
    }
  }
)

// ============================
// SLICE
// ============================
const initialState = {
  data: [],
  loading: false,
  error: null
}

const billingSlice = createSlice({
  name: 'billing',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    }
  },
  extraReducers: (builder) => {
    builder
      // FETCH
      .addCase(fetchBilling.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchBilling.fulfilled, (state, action) => {
        state.loading = false
        state.data = action.payload.data || action.payload
        state.error = null
      })
      .addCase(fetchBilling.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // CREATE
      .addCase(createBillingRecord.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createBillingRecord.fulfilled, (state, action) => {
        state.loading = false
        state.data.push(action.payload.data || action.payload)
        state.error = null
      })
      .addCase(createBillingRecord.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // UPDATE
      .addCase(updateBillingRecord.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateBillingRecord.fulfilled, (state, action) => {
        state.loading = false
        const index = state.data.findIndex((b) => b.id === action.payload.id)
        if (index !== -1) state.data[index] = action.payload.data
        state.error = null
      })
      .addCase(updateBillingRecord.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // DELETE
      .addCase(deleteBillingRecord.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteBillingRecord.fulfilled, (state, action) => {
        state.loading = false
        state.data = state.data.filter((b) => b.id !== action.payload)
        state.error = null
      })
      .addCase(deleteBillingRecord.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  }
})

export const { clearError } = billingSlice.actions
export default billingSlice.reducer
