import { formatDisplayDate } from '../../../utils/displayDates'
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../../../utils/axios'
import { pickTransactionBalance, pickTransactionOldBalance } from '../../../utils/ledgerFinance'

function isLedgerRow(transaction) {
  return transaction?.ledger_entry_id != null || transaction?.ledgerEntryId != null
}

/** Excel / PDF-friendly: ledger nulls stay blank; legacy keeps numeric fallbacks. */
function excelOldBalanceCell(transaction) {
  const o = pickTransactionOldBalance(transaction)
  if (o !== null) return o.toFixed(2)
  if (isLedgerRow(transaction)) return ''
  return parseFloat(transaction.old_balance ?? 0).toFixed(2)
}

function excelBalanceCell(transaction) {
  const b = pickTransactionBalance(transaction)
  if (b !== null) return b.toFixed(2)
  if (isLedgerRow(transaction)) return ''
  return parseFloat(transaction.balance ?? transaction.running_balance ?? transaction.credit_amount ?? 0).toFixed(2)
}

/** `'false'` is truthy in JS — only treat explicit true / 'true' as detailed export. */
function isDetailedExport(params) {
  return params?.detailed === true || params?.detailed === 'true'
}

// Async thunks
export const fetchCustomerLedger = createAsyncThunk(
  'customerLedger/fetchCustomerLedger',
  async ({ customerId, params = {} }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/customer-ledger/${customerId}`, { params })
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch customer ledger')
    }
  }
)

export const fetchAllCustomersWithSummaries = createAsyncThunk(
  'customerLedger/fetchAllCustomersWithSummaries',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await api.get('/customer-ledger/customers', { params })
      return response.data
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch customers')
    }
  }
)

export const exportCustomerLedger = createAsyncThunk(
  'customerLedger/exportCustomerLedger',
  async ({ customerId, params = {} }, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams()
      if (params.startDate) queryParams.append('startDate', params.startDate)
      if (params.endDate) queryParams.append('endDate', params.endDate)
      if (params.format) queryParams.append('format', params.format)
      if (isDetailedExport(params)) queryParams.append('detailed', 'true')
      
      const url = `/customer-ledger/${customerId}/export?${queryParams.toString()}`
      const response = await api.get(url)
      
      // Handle HTML content for PDF generation
      if (params.format === 'pdf') {
        const printWindow = window.open('', '_blank')
        printWindow.document.write(response.data)
        printWindow.document.close()
        setTimeout(() => {
          printWindow.print()
        }, 250)
      } else if (params.format === 'excel') {
        const XLSX = await import('xlsx')
        
        let excelData = []
        const payload = response.data.data

        if (payload?.groupedLedgers) {
          const workbook = XLSX.utils.book_new()

          const sanitizeSheetName = (name, index) => {
            const cleaned = (name || 'Customer').replace(/[\\/?*\[\]:]/g, '').trim() || 'Customer'
            const base = cleaned.length > 25 ? cleaned.slice(0, 25) : cleaned
            const suffix = `-${index + 1}`
            const combined = `${base}${suffix}`
            return combined.length > 31 ? combined.slice(0, 31) : combined
          }

          const summaryRows = payload.groupedLedgers.map((group) => ({
            'Customer Name': group.customer?.name || 'Unknown Customer',
            'Customer Phone': group.customer?.phone || '',
            'Transactions': group.summary?.totalTransactions || 0,
            'Total Amount': Number.parseFloat(group.summary?.totalAmount || 0).toFixed(2),
            'Total Paid': Number.parseFloat(group.summary?.totalPaid || 0).toFixed(2),
            'Total Credit': Number.parseFloat(group.summary?.totalCredit || 0).toFixed(2),
            'Outstanding': Number.parseFloat(group.summary?.outstandingBalance || 0).toFixed(2)
          }))

          if (summaryRows.length > 0) {
            const summarySheet = XLSX.utils.json_to_sheet(summaryRows)
            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')
          }

          payload.groupedLedgers.forEach((group, index) => {
            const transactions = group.transactions || []
            const customerName = group.customer?.name || 'Customer'

            let rows = []

            if (isDetailedExport(params)) {
              transactions.forEach((transaction) => {
                const amount = parseFloat(transaction.amount ?? transaction.subtotal ?? transaction.total ?? 0)
                const oldPick = pickTransactionOldBalance(transaction)
                const oldBalanceNum = oldPick !== null ? oldPick : parseFloat(transaction.old_balance ?? 0)
                const totalAmountDue = parseFloat(
                  transaction.total_amount ?? (Number.isFinite(oldBalanceNum) ? oldBalanceNum + amount : amount)
                )
                const payment = parseFloat(transaction.corrected_paid ?? transaction.paid_amount ?? transaction.payment_amount ?? 0)
                const balanceStr = excelBalanceCell(transaction)

                if (transaction.items && transaction.items.length > 0) {
                  transaction.items.forEach((item) => {
                    rows.push({
                      'Customer Name': customerName,
                      'Date': formatDisplayDate(transaction.transaction_date || transaction.created_at),
                      'Invoice #': transaction.invoice_no || 'N/A',
                      'Item Name': item.item_name || item.name || 'N/A',
                      'SKU': item.sku || 'N/A',
                      'Quantity': item.quantity || 0,
                      'Unit Price': parseFloat(item.unit_price || item.unitPrice || 0).toFixed(2),
                      'Discount': parseFloat(item.discount || 0).toFixed(2),
                      'Item Total': parseFloat(item.item_total || item.total || 0).toFixed(2),
                      'Amount': amount.toFixed(2),
                      'Old Balance': excelOldBalanceCell(transaction),
                      'Total Amount Due': totalAmountDue.toFixed(2),
                      'Payment': payment.toFixed(2),
                      'Payment Method': transaction.payment_method || 'N/A',
                      'Payment Status': transaction.payment_status || 'N/A',
                      'Balance': balanceStr
                    })
                  })
                } else {
                  rows.push({
                    'Customer Name': customerName,
                    'Date': formatDisplayDate(transaction.transaction_date || transaction.created_at),
                    'Invoice #': transaction.invoice_no || 'N/A',
                    'Item Name': 'No items',
                    'SKU': 'N/A',
                    'Quantity': 0,
                    'Unit Price': '0.00',
                    'Discount': '0.00',
                    'Item Total': '0.00',
                    'Amount': amount.toFixed(2),
                    'Old Balance': excelOldBalanceCell(transaction),
                    'Total Amount Due': totalAmountDue.toFixed(2),
                    'Payment': payment.toFixed(2),
                    'Payment Method': transaction.payment_method || 'N/A',
                    'Payment Status': transaction.payment_status || 'N/A',
                    'Balance': balanceStr
                  })
                }
              })
            } else {
              rows = transactions.map((transaction) => ({
                'Customer Name': customerName,
                'Date': formatDisplayDate(transaction.transaction_date || transaction.created_at),
                'Invoice #': transaction.invoice_no || 'N/A',
                'Amount': parseFloat(transaction.amount ?? transaction.subtotal ?? transaction.total ?? 0).toFixed(2),
                'Old Balance': excelOldBalanceCell(transaction),
                'Total Amount': parseFloat(transaction.total_amount ?? transaction.total ?? 0).toFixed(2),
                'Payment': parseFloat(transaction.corrected_paid ?? transaction.paid_amount ?? transaction.payment_amount ?? 0).toFixed(2),
                'Payment Method': transaction.payment_method || 'N/A',
                'Payment Status': transaction.payment_status || 'N/A',
                'Balance': excelBalanceCell(transaction)
              }))
            }

            const sheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ Notice: 'No transactions available' }])
            XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(customerName, index))
          })

          if (Array.isArray(payload.transactions) && payload.transactions.length > 0) {
            const allRows = payload.transactions.map((transaction) => ({
              'Customer Name': transaction.customer_name || 'Unknown Customer',
              'Customer Phone': transaction.customer_phone || '',
              'Date': formatDisplayDate(transaction.transaction_date || transaction.created_at),
              'Invoice #': transaction.invoice_no || 'N/A',
              'Amount': parseFloat(transaction.amount ?? transaction.subtotal ?? transaction.total ?? 0).toFixed(2),
              'Old Balance': excelOldBalanceCell(transaction),
              'Total Amount': parseFloat(transaction.total_amount ?? transaction.total ?? 0).toFixed(2),
              'Payment': parseFloat(transaction.corrected_paid ?? transaction.paid_amount ?? transaction.payment_amount ?? 0).toFixed(2),
              'Payment Method': transaction.payment_method || 'N/A',
              'Payment Status': transaction.payment_status || 'N/A',
              'Balance': excelBalanceCell(transaction)
            }))

            const allSheet = XLSX.utils.json_to_sheet(allRows)
            XLSX.utils.book_append_sheet(workbook, allSheet, 'All Transactions')
          }

          const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
          const blob = new Blob([excelBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          })
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          const filePrefix = isDetailedExport(params) ? 'detailed-all-customers-ledger' : 'all-customers-ledger'
          link.download = `${filePrefix}-${new Date().toISOString().split('T')[0]}.xlsx`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          window.URL.revokeObjectURL(url)

          return { success: true }
        }
        
        if (isDetailedExport(params) && payload) {
          const detailedTransactions = Array.isArray(payload) ? payload : (payload.transactions || [])
          const sortedTransactions = [...detailedTransactions].sort((a, b) =>
            new Date(a.transaction_date || a.created_at) - new Date(b.transaction_date || b.created_at)
          )
          
          sortedTransactions.forEach(transaction => {
            const amount = parseFloat(transaction.amount ?? transaction.subtotal ?? transaction.total ?? 0)
            const oldPick = pickTransactionOldBalance(transaction)
            const oldBalanceNum = oldPick !== null ? oldPick : parseFloat(transaction.old_balance ?? 0)
            const totalAmountDue = parseFloat(
              transaction.total_amount ?? (Number.isFinite(oldBalanceNum) ? oldBalanceNum + amount : amount)
            )
            const payment = parseFloat(transaction.corrected_paid ?? transaction.paid_amount ?? transaction.payment_amount ?? 0)
            const balanceStr = excelBalanceCell(transaction)

            if (transaction.items && transaction.items.length > 0) {
              transaction.items.forEach(item => {
                excelData.push({
                  'Date': formatDisplayDate(transaction.transaction_date || transaction.created_at),
                  'Invoice #': transaction.invoice_no || 'N/A',
                  'Item Name': item.item_name || item.name || 'N/A',
                  'SKU': item.sku || 'N/A',
                  'Quantity': item.quantity || 0,
                  'Unit Price': parseFloat(item.unit_price || 0).toFixed(2),
                  'Discount': parseFloat(item.discount || 0).toFixed(2),
                  'Item Total': parseFloat(item.item_total || item.total || 0).toFixed(2),
                  'Amount': amount.toFixed(2),
                  'Old Balance': excelOldBalanceCell(transaction),
                  'Total Amount Due': totalAmountDue.toFixed(2),
                  'Payment': payment.toFixed(2),
                  'Payment Method': transaction.payment_method || 'N/A',
                  'Payment Status': transaction.payment_status || 'N/A',
                  'Balance': balanceStr
                })
              })
            } else {
              excelData.push({
                'Date': formatDisplayDate(transaction.transaction_date || transaction.created_at),
                'Invoice #': transaction.invoice_no || 'N/A',
                'Item Name': 'No items',
                'SKU': 'N/A',
                'Quantity': 0,
                'Unit Price': '0.00',
                'Discount': '0.00',
                'Item Total': '0.00',
                'Amount': amount.toFixed(2),
                'Old Balance': excelOldBalanceCell(transaction),
                'Total Amount Due': totalAmountDue.toFixed(2),
                'Payment': payment.toFixed(2),
                'Payment Method': transaction.payment_method || 'N/A',
                'Payment Status': transaction.payment_status || 'N/A',
                'Balance': balanceStr
              })
            }
          })
        } else {
          const summaryTransactions = Array.isArray(payload) ? payload : (payload.transactions || [])
          const sortedTransactions = [...summaryTransactions].sort((a, b) =>
            new Date(a.transaction_date || a.created_at) - new Date(b.transaction_date || b.created_at)
          )
          
          excelData = sortedTransactions.map(transaction => {
            const amount = parseFloat(transaction.amount ?? transaction.subtotal ?? transaction.total ?? 0)
            const oldPick = pickTransactionOldBalance(transaction)
            const oldNum = oldPick !== null ? oldPick : parseFloat(transaction.old_balance ?? 0)
            const totalDue = parseFloat(
              transaction.total_amount ?? (Number.isFinite(oldNum) ? oldNum + amount : amount)
            )
            return {
              'Date': formatDisplayDate(transaction.transaction_date || transaction.created_at),
              'Invoice #': transaction.invoice_no || 'N/A',
              'Amount': amount.toFixed(2),
              'Old Balance': excelOldBalanceCell(transaction),
              'Total Amount Due': totalDue.toFixed(2),
              'Payment': parseFloat(transaction.corrected_paid ?? transaction.paid_amount ?? transaction.payment_amount ?? 0).toFixed(2),
              'Payment Method': transaction.payment_method || 'N/A',
              'Payment Status': transaction.payment_status || 'N/A',
              'Status': transaction.status || transaction.payment_status_display || 'N/A',
              'Balance': excelBalanceCell(transaction)
            }
          })
        }
        
        const workbook = XLSX.utils.book_new()
        const worksheet = XLSX.utils.json_to_sheet(excelData)
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer Ledger')
        const excelBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
        const blob = new Blob([excelBuffer], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        const filePrefix = isDetailedExport(params) ? 'detailed-customer-ledger' : 'customer-ledger'
        link.download = `${filePrefix}-${customerId}-${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      } else {
        const blob = new Blob([response.data], { type: 'text/plain' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `customer-ledger-${customerId}-${new Date().toISOString().split('T')[0]}.txt`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }
      
      return { success: true }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to export customer ledger')
    }
  }
)

const initialState = {
  customers: [],
  currentCustomerLedger: null,
  loading: false,
  error: null,
  pagination: {
    customers: { total: 0, limit: 50, offset: 0, hasMore: false },
    ledger: { total: 0, limit: 100, offset: 0, hasMore: false }
  }
}

// ─── Helper: enrich a single transaction without touching backend-calculated fields ───
// ONLY adds display helpers; never overwrites old_balance, total_amount, balance,
// running_balance, corrected_paid, or items that the backend already computed.
const enrichTransaction = (transaction) => ({
  ...transaction,
  // items MUST be preserved exactly as received from backend
  items: transaction.items ?? [],
  // Only fill subtotal/paid_amount if truly absent (don't overwrite backend values)
  subtotal: transaction.subtotal ?? transaction.amount ?? 0,
  paid_amount: transaction.paid_amount ?? transaction.payment_amount ?? 0,
  // Display helper — safe to derive
  payment_status_display: transaction.payment_status_display ?? (
    transaction.payment_status === 'COMPLETED' ? 'Paid' :
    transaction.payment_status === 'PARTIAL'    ? 'Partial' : 'Credit'
  )
})

const customerLedgerSlice = createSlice({
  name: 'customerLedger',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    clearCurrentLedger: (state) => {
      state.currentCustomerLedger = null
    },
    setCustomersPagination: (state, action) => {
      state.pagination.customers = { ...state.pagination.customers, ...action.payload }
    },
    setLedgerPagination: (state, action) => {
      state.pagination.ledger = { ...state.pagination.ledger, ...action.payload }
    },
    debugState: (state) => {
    }
  },
  extraReducers: (builder) => {
    builder
      // ── Fetch customer ledger ──────────────────────────────────────────────
      .addCase(fetchCustomerLedger.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCustomerLedger.fulfilled, (state, action) => {
        state.loading = false

        const responseData = action.payload.data || action.payload

        // Single-customer path — enrich transactions but NEVER recalculate balances
        if (responseData.transactions) {
          responseData.transactions = responseData.transactions.map(enrichTransaction)
        }

        // All-customers path — enrich each group's transactions the same way
        if (responseData.groupedLedgers && Array.isArray(responseData.groupedLedgers)) {
          responseData.groupedLedgers = responseData.groupedLedgers.map(group => ({
            ...group,
            transactions: Array.isArray(group.transactions)
              ? group.transactions.map(enrichTransaction)
              : []
          }))
        }

        state.currentCustomerLedger = responseData

        if (responseData.pagination) {
          state.pagination.ledger = {
            ...state.pagination.ledger,
            ...responseData.pagination
          }
        }

        state.error = null
      })
      .addCase(fetchCustomerLedger.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // ── Fetch all customers with summaries ────────────────────────────────
      .addCase(fetchAllCustomersWithSummaries.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchAllCustomersWithSummaries.fulfilled, (state, action) => {
        state.loading = false

        const responseData = action.payload.data || action.payload

        if (responseData.customers) {
          state.customers = responseData.customers.map(customer => ({
            ...customer,
            customer_name: customer.customer_name || customer.name || 'N/A',
            customer_phone: customer.customer_phone || customer.phone || 'N/A',
            total_transactions: customer.total_transactions || 0,
            total_amount: customer.total_amount || customer.total_purchases || 0,
            total_paid: customer.total_paid || customer.total_payments || 0,
            current_balance: customer.current_balance || customer.outstanding_balance || 0,
            last_transaction_date: customer.last_transaction_date || customer.last_purchase_date
          }))
        } else {
          state.customers = responseData || []
        }

        if (responseData.pagination) {
          state.pagination.customers = {
            ...state.pagination.customers,
            ...responseData.pagination
          }
        } else if (action.payload.pagination) {
          state.pagination.customers = {
            ...state.pagination.customers,
            ...action.payload.pagination
          }
        }

        state.error = null
      })
      .addCase(fetchAllCustomersWithSummaries.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })

      // ── Export customer ledger ────────────────────────────────────────────
      .addCase(exportCustomerLedger.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(exportCustomerLedger.fulfilled, (state) => {
        state.loading = false
        state.error = null
      })
      .addCase(exportCustomerLedger.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  }
})

export const {
  clearError,
  clearCurrentLedger,
  setCustomersPagination,
  setLedgerPagination,
  debugState
} = customerLedgerSlice.actions

export default customerLedgerSlice.reducer
