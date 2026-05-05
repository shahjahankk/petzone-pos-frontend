import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'
import { normalizeInvoiceDetailsData } from '../../../utils/ledgerFinance'

// Async thunk to fetch invoice details
export const fetchInvoiceDetails = createAsyncThunk(
  'invoiceDetails/fetchInvoiceDetails',
  async (invoiceId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/sales/invoice/${invoiceId}`)
      const body = response.data
      if (body?.success && body.data) {
        return { ...body, data: normalizeInvoiceDetailsData(body.data) }
      }
      return body
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to fetch invoice details')
    }
  }
)

// Async thunk to update invoice
export const updateInvoice = createAsyncThunk(
  'invoiceDetails/updateInvoice',
  async ({ invoiceId, updateData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/sales/${invoiceId}`, updateData)
      const body = response.data
      if (body?.success && body.data) {
        return { ...body, data: normalizeInvoiceDetailsData(body.data) }
      }
      return body
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || error.message || 'Failed to update invoice')
    }
  }
)

const initialState = {
  data: null,
  loading: false,
  updating: false,
  error: null
}

const invoiceDetailsSlice = createSlice({
  name: 'invoiceDetails',
  initialState,
  reducers: {
    clearInvoiceDetails: (state) => {
      state.data = null
      state.error = null
    },
    clearError: (state) => {
      state.error = null
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch invoice details
      .addCase(fetchInvoiceDetails.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchInvoiceDetails.fulfilled, (state, action) => {
        state.loading = false
        state.data = action.payload.data
        state.error = null
      })
      .addCase(fetchInvoiceDetails.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
        state.data = null
      })
      // Update invoice
      .addCase(updateInvoice.pending, (state) => {
        state.updating = true
        state.error = null
      })
      .addCase(updateInvoice.fulfilled, (state, action) => {
        state.updating = false
        state.data = action.payload.data
        state.error = null
      })
      .addCase(updateInvoice.rejected, (state, action) => {
        state.updating = false
        state.error = action.payload
      })
  }
})

export const { clearInvoiceDetails, clearError } = invoiceDetailsSlice.actions
export default invoiceDetailsSlice.reducer





