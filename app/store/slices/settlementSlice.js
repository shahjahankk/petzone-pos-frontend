'use client'
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

export const fetchSettlements = createAsyncThunk('settlement/fetchSettlements', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/settlements', { params })
    return res.data?.data || { items: [], total: 0, page: 1, limit: 20 }
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || e.message || 'Failed to fetch settlements')
  }
})

export const createSettlement = createAsyncThunk('settlement/createSettlement', async (payload, { rejectWithValue }) => {
  try {
    const res = await api.post('/settlements', payload)
    return res.data?.data
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || e.message || 'Failed to create settlement')
  }
})

export const updateSettlement = createAsyncThunk('settlement/updateSettlement', async ({ id, data }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/settlements/${id}`, data)
    return res.data?.data
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || e.message || 'Failed to update settlement')
  }
})

export const deleteSettlement = createAsyncThunk('settlement/deleteSettlement', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/settlements/${id}`)
    return id
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || e.message || 'Failed to delete settlement')
  }
})

export const fetchBilties = createAsyncThunk('settlement/fetchBilties', async (params = {}, { rejectWithValue }) => {
  try {
    const res = await api.get('/bilty', { params })
    return res.data?.data || { items: [], total: 0, page: 1, limit: 20 }
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || e.message || 'Failed to fetch bilties')
  }
})

export const createBilty = createAsyncThunk('settlement/createBilty', async (payload, { rejectWithValue }) => {
  try {
    const res = await api.post('/bilty', payload)
    return res.data?.data
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || e.message || 'Failed to create bilty')
  }
})

export const updateBilty = createAsyncThunk('settlement/updateBilty', async ({ id, data }, { rejectWithValue }) => {
  try {
    const res = await api.put(`/bilty/${id}`, data)
    return res.data?.data
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || e.message || 'Failed to update bilty')
  }
})

export const deleteBilty = createAsyncThunk('settlement/deleteBilty', async (id, { rejectWithValue }) => {
  try {
    await api.delete(`/bilty/${id}`)
    return id
  } catch (e) {
    return rejectWithValue(e.response?.data?.message || e.message || 'Failed to delete bilty')
  }
})

const initialState = {
  settlements: { data: [], loading: false, error: null, pagination: {} },
  bilties: { data: [], loading: false, error: null, pagination: {} },
}

const settlementSlice = createSlice({
  name: 'settlement',
  initialState,
  reducers: {
    clearSettlementError: (state) => {
      state.settlements.error = null
      state.bilties.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettlements.pending, (state) => { state.settlements.loading = true; state.settlements.error = null })
      .addCase(fetchSettlements.fulfilled, (state, action) => {
        state.settlements.loading = false
        state.settlements.data = action.payload.items || []
        state.settlements.pagination = { total: action.payload.total, page: action.payload.page, limit: action.payload.limit }
      })
      .addCase(fetchSettlements.rejected, (state, action) => { state.settlements.loading = false; state.settlements.error = action.payload })
      .addCase(createSettlement.fulfilled, (state, action) => { if (action.payload) state.settlements.data.unshift(action.payload) })
      .addCase(updateSettlement.fulfilled, (state, action) => {
        const idx = state.settlements.data.findIndex((x) => x.id === action.payload?.id)
        if (idx !== -1) state.settlements.data[idx] = action.payload
      })
      .addCase(deleteSettlement.fulfilled, (state, action) => {
        state.settlements.data = state.settlements.data.filter((x) => x.id !== action.payload)
      })
      .addCase(fetchBilties.pending, (state) => { state.bilties.loading = true; state.bilties.error = null })
      .addCase(fetchBilties.fulfilled, (state, action) => {
        state.bilties.loading = false
        state.bilties.data = action.payload.items || []
        state.bilties.pagination = { total: action.payload.total, page: action.payload.page, limit: action.payload.limit }
      })
      .addCase(fetchBilties.rejected, (state, action) => { state.bilties.loading = false; state.bilties.error = action.payload })
      .addCase(createBilty.fulfilled, (state, action) => { if (action.payload) state.bilties.data.unshift(action.payload) })
      .addCase(updateBilty.fulfilled, (state, action) => {
        const idx = state.bilties.data.findIndex((x) => x.id === action.payload?.id)
        if (idx !== -1) state.bilties.data[idx] = action.payload
      })
      .addCase(deleteBilty.fulfilled, (state, action) => {
        state.bilties.data = state.bilties.data.filter((x) => x.id !== action.payload)
      })
  },
})

export const { clearSettlementError } = settlementSlice.actions
export default settlementSlice.reducer
