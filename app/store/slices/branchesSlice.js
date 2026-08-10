import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

export const fetchBranchSettings = createAsyncThunk(
  'branches/fetchSettings',
  async (branchId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/branches/${branchId}/settings`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch branch settings')
    }
  }
)

export const updateBranchSettings = createAsyncThunk(
  'branches/updateSettings',
  async ({ branchId, settings }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/branches/${branchId}/settings`, { settings })
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to update branch settings')
    }
  }
)

export const fetchAllBranches = createAsyncThunk(
  'branches/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/branches')
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to fetch branches')
    }
  }
)

export const fetchBranches = fetchAllBranches

export const createBranch = createAsyncThunk(
  'branches/create',
  async (branchData, { rejectWithValue }) => {
    try {
      const response = await api.post('/branches', branchData)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to create branch')
    }
  }
)

export const updateBranch = createAsyncThunk(
  'branches/update',
  async ({ branchId, branchData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/branches/${branchId}`, branchData)
      if (response.data?.success === false) {
        return rejectWithValue(response.data.message || 'Failed to update branch')
      }
      return response.data
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to update branch'
      return rejectWithValue(message)
    }
  }
)

export const deleteBranch = createAsyncThunk(
  'branches/delete',
  async (branchId, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/branches/${branchId}`)
      return response.data
    } catch (error) {
      return rejectWithValue(error.message || 'Failed to delete branch')
    }
  }
)

const initialState = {
  branches: [],
  data: [],
  currentBranch: null,
  branchSettings: null,
  isLoading: false,
  loading: false,
  error: null,
}

const branchesSlice = createSlice({
  name: 'branches',
  initialState,
  reducers: {
    setCurrentBranch: (state, action) => {
      state.currentBranch = action.payload
    },
    setBranchSettings: (state, action) => {
      state.branchSettings = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
    clearBranches: (state) => {
      state.branches = []
      state.currentBranch = null
      state.branchSettings = null
    },
  },
  extraReducers: (builder) => {
    builder
      // ── Fetch branch settings ──────────────────────────────────────
      .addCase(fetchBranchSettings.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchBranchSettings.fulfilled, (state, action) => {
        state.isLoading = false
        const branchData = action.payload.data || action.payload
        // Controller returns { id, name, code, settings: { allowCashierInventoryAdd, ... } }
        // Extract .settings so usePermissions can read flat keys directly
        state.branchSettings = branchData.settings || branchData
        state.currentBranch = branchData
      })
      .addCase(fetchBranchSettings.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // ── Update branch settings ─────────────────────────────────────
      .addCase(updateBranchSettings.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateBranchSettings.fulfilled, (state, action) => {
        state.isLoading = false
        const updatedBranch = action.payload.data || action.payload
        // Update branch in list
        const branchIndex = state.branches.findIndex(b => b.id === updatedBranch.id)
        if (branchIndex !== -1) {
          state.branches[branchIndex] = updatedBranch
          state.data[branchIndex] = updatedBranch
        }
        // Extract .settings so usePermissions can read flat keys directly
        state.branchSettings = updatedBranch.settings || updatedBranch
        state.currentBranch = updatedBranch
        state.error = null
      })
      .addCase(updateBranchSettings.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // ── Fetch all branches ─────────────────────────────────────────
      .addCase(fetchAllBranches.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchAllBranches.fulfilled, (state, action) => {
        state.isLoading = false
        state.loading = false
        state.branches = action.payload.data || action.payload
        state.data = action.payload.data || action.payload
      })
      .addCase(fetchAllBranches.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // ── Create branch ──────────────────────────────────────────────
      .addCase(createBranch.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createBranch.fulfilled, (state, action) => {
        state.isLoading = false
        state.loading = false
        const newBranch = action.payload.data || action.payload
        state.branches.push(newBranch)
        state.data.push(newBranch)
        state.error = null
      })
      .addCase(createBranch.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // ── Update branch ──────────────────────────────────────────────
      .addCase(updateBranch.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateBranch.fulfilled, (state, action) => {
        state.isLoading = false
        state.loading = false
        const updatedBranch = action.payload.data || action.payload
        const updatedId = Number(updatedBranch?.id)
        const index = state.branches.findIndex(b => Number(b.id) === updatedId)
        if (index !== -1) {
          state.branches[index] = { ...state.branches[index], ...updatedBranch }
          state.data[index] = { ...state.data[index], ...updatedBranch }
        }
        state.error = null
      })
      .addCase(updateBranch.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // ── Delete branch ──────────────────────────────────────────────
      .addCase(deleteBranch.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(deleteBranch.fulfilled, (state, action) => {
        state.isLoading = false
        state.loading = false
        state.branches = state.branches.filter(b => b.id !== action.payload)
        state.data = state.data.filter(b => b.id !== action.payload)
        state.error = null
      })
      .addCase(deleteBranch.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
  },
})

export const { setCurrentBranch, setBranchSettings, clearError, clearBranches } = branchesSlice.actions
export default branchesSlice.reducer