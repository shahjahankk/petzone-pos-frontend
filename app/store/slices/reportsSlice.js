import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'

// ── Helper: normalize a date value to YYYY-MM-DD string ──────────────────────
// Accepts: Date object, ISO string, or already-formatted string
const toDateStr = (val) => {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().split('T')[0]
  if (typeof val === 'string') {
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
    // ISO string like "2024-01-01T00:00:00.000Z"
    return new Date(val).toISOString().split('T')[0]
  }
  return null
}

// Async thunks for reports API calls
export const fetchSalesReports = createAsyncThunk(
  'reports/fetchSales',
  async (args = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams()

      // Support both flat shape { dateFrom, dateTo } and nested { dateRange: { start, end } }
      const startDate = toDateStr(args.dateFrom || args.dateRange?.start)
      const endDate   = toDateStr(args.dateTo   || args.dateRange?.end)

      if (args.branch && args.branch !== 'all') params.append('branch', args.branch)
      if (args.cashier && args.cashier !== 'all') params.append('cashier', args.cashier)
      if (startDate) params.append('startDate', startDate)
      if (endDate)   params.append('endDate',   endDate)

      const response = await api.get(`/reports/sales?${params.toString()}`)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch sales reports')
    }
  }
)

export const fetchClinicSalesReports = createAsyncThunk(
  'reports/fetchClinicSales',
  async (args = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams()

      const startDate = toDateStr(args.dateFrom || args.dateRange?.start)
      const endDate   = toDateStr(args.dateTo   || args.dateRange?.end)

      if (args.branch && args.branch !== 'all') params.append('branch', args.branch)
      if (args.cashier && args.cashier !== 'all') params.append('cashier', args.cashier)
      if (args.category && args.category !== 'all') params.append('category', args.category)
      if (startDate) params.append('startDate', startDate)
      if (endDate)   params.append('endDate',   endDate)

      const response = await api.get(`/reports/clinic?${params.toString()}`)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch clinic sales reports')
    }
  }
)

export const fetchInventoryReports = createAsyncThunk(
  'reports/fetchInventory',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams()

      if (filters.searchTerm)      params.append('searchTerm',      filters.searchTerm)
      if (filters.scopeType)       params.append('scopeType',        filters.scopeType)
      if (filters.scopeId)         params.append('scopeId',          filters.scopeId)
      if (filters.transactionType) params.append('transactionType',  filters.transactionType)
      if (filters.itemCategory || filters.category)
        params.append('itemCategory', filters.itemCategory || filters.category)
      if (filters.userRole)        params.append('userRole',         filters.userRole)
      if (filters.page)            params.append('page',             filters.page)
      if (filters.limit)           params.append('limit',            filters.limit)

      // Support both startDate/endDate and dateFrom/dateTo
      const startDate = toDateStr(filters.startDate || filters.dateFrom)
      const endDate   = toDateStr(filters.endDate   || filters.dateTo)
      if (startDate) params.append('startDate', startDate)
      if (endDate)   params.append('endDate',   endDate)

      const response = await api.get(`/stock-reports?${params.toString()}`)
      return {
        data: response.data.data,
        pagination: response.data.pagination,
      }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch inventory reports')
    }
  }
)

export const fetchStockSummary = createAsyncThunk(
  'reports/fetchStockSummary',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams()

      if (filters.searchTerm)  params.append('searchTerm',  filters.searchTerm)
      if (filters.scopeType)   params.append('scopeType',   filters.scopeType)
      if (filters.scopeId)     params.append('scopeId',     filters.scopeId)
      if (filters.itemCategory || filters.category)
        params.append('itemCategory', filters.itemCategory || filters.category)
      if (filters.page)  params.append('page',  filters.page)
      if (filters.limit) params.append('limit', filters.limit)

      const startDate = toDateStr(filters.startDate || filters.dateFrom)
      const endDate   = toDateStr(filters.endDate   || filters.dateTo)
      if (startDate) params.append('startDate', startDate)
      if (endDate)   params.append('endDate',   endDate)

      const response = await api.get(`/stock-reports/summary?${params.toString()}`)
      return {
        data: response.data.data,
        pagination: response.data.pagination,
      }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch stock summary')
    }
  }
)

export const fetchStockStatistics = createAsyncThunk(
  'reports/fetchStockStatistics',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams()

      if (filters.scopeType) params.append('scopeType', filters.scopeType)
      if (filters.scopeId)   params.append('scopeId',   filters.scopeId)
      if (filters.category)  params.append('category',  filters.category)

      const startDate = toDateStr(filters.startDate || filters.dateFrom)
      const endDate   = toDateStr(filters.endDate   || filters.dateTo)
      if (startDate) params.append('startDate', startDate)
      if (endDate)   params.append('endDate',   endDate)

      const response = await api.get(`/stock-reports/statistics?${params.toString()}`)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch stock statistics')
    }
  }
)

export const fetchLedgerReports = createAsyncThunk(
  'reports/fetchLedger',
  async (args = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams()

      // Support both flat { dateFrom, dateTo } and nested { dateRange: { start, end } }
      const startDate = toDateStr(args.dateFrom || args.dateRange?.start)
      const endDate   = toDateStr(args.dateTo   || args.dateRange?.end)

      if (startDate) params.append('startDate', startDate)
      if (endDate)   params.append('endDate',   endDate)

      // Extra filters the ledger page may pass
      if (args.account && args.account !== 'all')
        params.append('account', args.account)
      if (args.transactionType && args.transactionType !== 'all')
        params.append('transactionType', args.transactionType)

      const response = await api.get(`/reports/ledger?${params.toString()}`)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch ledger reports')
    }
  }
)

export const fetchFinancialReports = createAsyncThunk(
  'reports/fetchFinancial',
  async (args = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams()

      if (args.period)  params.append('period',  args.period)
      if (args.year)    params.append('year',    args.year)
      if (args.quarter) params.append('quarter', args.quarter)
      if (args.branch && args.branch !== 'all') params.append('branch', args.branch)

      // Normalize dates — accept Date objects or strings
      const dateFrom = toDateStr(args.dateFrom)
      const dateTo   = toDateStr(args.dateTo)
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo)   params.append('dateTo',   dateTo)

      const response = await api.get(`/reports/financial?${params.toString()}`)
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch financial reports')
    }
  }
)

export const fetchReportsSummary = createAsyncThunk(
  'reports/fetchSummary',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/reports/summary')
      return response.data.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch reports summary')
    }
  }
)

const initialState = {
  salesReports: null,
  clinicSalesReports: null,
  inventoryReports: null,
  stockSummary: null,
  stockStatistics: null,
  ledgerReports: null,
  financialReports: null,
  reportsSummary: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
}

const reportsSlice = createSlice({
  name: 'reports',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setLastUpdated: (state) => {
      state.lastUpdated = new Date().toISOString()
    },
  },
  extraReducers: (builder) => {
    builder
      // Sales reports
      .addCase(fetchSalesReports.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchSalesReports.fulfilled, (state, action) => {
        state.isLoading = false
        state.salesReports = action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchSalesReports.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Clinic sales reports
      .addCase(fetchClinicSalesReports.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchClinicSalesReports.fulfilled, (state, action) => {
        state.isLoading = false
        state.clinicSalesReports = action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchClinicSalesReports.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Inventory reports
      .addCase(fetchInventoryReports.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchInventoryReports.fulfilled, (state, action) => {
        state.isLoading = false
        state.inventoryReports = action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchInventoryReports.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Stock summary
      .addCase(fetchStockSummary.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchStockSummary.fulfilled, (state, action) => {
        state.isLoading = false
        state.stockSummary = action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchStockSummary.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Stock statistics
      .addCase(fetchStockStatistics.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchStockStatistics.fulfilled, (state, action) => {
        state.isLoading = false
        state.stockStatistics = action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchStockStatistics.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Ledger reports
      .addCase(fetchLedgerReports.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchLedgerReports.fulfilled, (state, action) => {
        state.isLoading = false
        state.ledgerReports = action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchLedgerReports.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Financial reports
      .addCase(fetchFinancialReports.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchFinancialReports.fulfilled, (state, action) => {
        state.isLoading = false
        state.financialReports = action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchFinancialReports.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })

      // Reports summary
      .addCase(fetchReportsSummary.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(fetchReportsSummary.fulfilled, (state, action) => {
        state.isLoading = false
        state.reportsSummary = action.payload
        state.lastUpdated = new Date().toISOString()
        state.error = null
      })
      .addCase(fetchReportsSummary.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload
      })
  },
})

export const { clearError, setLastUpdated } = reportsSlice.actions
export default reportsSlice.reducer