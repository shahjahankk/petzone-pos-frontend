import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// Async thunks
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

      // ✅ scope append
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
      if (error.response?.status === 500) {
        return rejectWithValue('Server error occurred. Please try again or contact support.')
      } else if (error.response?.status === 400) {
        return rejectWithValue(error.response?.data?.message || 'Invalid data provided.')
      } else if (error.response?.status === 404) {
        return rejectWithValue('Billing record not found.')
      } else if (error.response?.status === 403) {
        return rejectWithValue('Access denied for this scope.')
      } else {
        return rejectWithValue(error.response?.data?.message || 'Failed to create billing record')
      }
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
      return response.data
    } catch (error) {
      if (error.response?.status === 500) {
        return rejectWithValue('Server error occurred. Please try again or contact support.')
      } else if (error.response?.status === 400) {
        return rejectWithValue(error.response?.data?.message || 'Invalid data provided.')
      } else if (error.response?.status === 404) {
        return rejectWithValue('Billing record not found.')
      } else if (error.response?.status === 403) {
        return rejectWithValue('Access denied for this scope.')
      } else {
        return rejectWithValue(error.response?.data?.message || 'Failed to update billing record')
      }
    }
  }
)

export const deleteBillingRecord = createAsyncThunk(
  'billing/deleteBillingRecord',
  async (id, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/billing/${id}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete billing record')
    }
  }
)

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

      .addCase(createBillingRecord.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(createBillingRecord.fulfilled, (state, action) => {
        state.loading = false
        const newBillingRecord = action.payload.data || action.payload
        state.data.push(newBillingRecord)
        state.error = null
      })
      .addCase(createBillingRecord.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      .addCase(updateBillingRecord.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateBillingRecord.fulfilled, (state, action) => {
        state.loading = false

        const updated = action.payload.data || action.payload
        const index = state.data.findIndex((billing) => billing.id === updated.id)

        if (index !== -1) {
          state.data[index] = updated
        }

        state.error = null
      })
      .addCase(updateBillingRecord.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      .addCase(deleteBillingRecord.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteBillingRecord.fulfilled, (state, action) => {
        state.loading = false
        state.data = state.data.filter((billing) => billing.id !== action.payload)
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
