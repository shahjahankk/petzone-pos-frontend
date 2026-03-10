'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import api from '../../../utils/axios'
import { Box, Typography, Chip, Button, Grid, Card, CardContent, FormControl, InputLabel, Select, MenuItem, Paper, Drawer, List, ListItem, ListItemText, Divider, IconButton, Badge, TextField, Menu, ListItemIcon, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, CircularProgress, Tooltip, InputAdornment, Pagination, Dialog, DialogTitle, DialogContent, Accordion, AccordionSummary, AccordionDetails } from '@mui/material'
import { Close as CloseIcon, FilterList as FilterIcon, GetApp as ExportIcon, FileDownload as DownloadIcon, Delete as DeleteIcon, Search as SearchIcon, Clear as ClearIcon, Visibility as ViewIcon, Receipt as ReceiptIcon, Refresh as RefreshIcon, ExpandMore as ExpandMoreIcon, Print as PrintIcon } from '@mui/icons-material'
import { DataGrid } from '@mui/x-data-grid'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import withAuth from '../../../components/auth/withAuth'
import DashboardLayout from '../../../components/layout/DashboardLayout'
import RouteGuard from '../../../components/auth/RouteGuard'
import PermissionCheck from '../../../components/auth/PermissionCheck'
import ConfirmationDialog from '../../../components/crud/ConfirmationDialog'
import PollingStatusIndicator from '../../../components/polling/PollingStatusIndicator'
import { useSalesPolling } from '../../../hooks/usePolling'
import { fetchSales, deleteSale, fetchSalesReturns, createSalesReturn, getSale } from '../../store/slices/salesSlice'
import { fetchInventory } from '../../store/slices/inventorySlice'
import { fetchBranchSettings, fetchBranches } from '../../store/slices/branchesSlice'
import { fetchWarehouses, fetchWarehouseSettings } from '../../store/slices/warehousesSlice'
import { fetchCompanies } from '../../store/slices/companiesSlice'
import { fetchRetailers } from '../../store/slices/retailersSlice'
import usePermissions from '../../../hooks/usePermissions'
import pollingService from '../../../utils/pollingService'
import EditableInvoiceForm from '../../../components/sales/EditableInvoiceForm'
import PrintDialog from '../../../components/print/PrintDialog'
import buildPrintData from '../../../utils/buildPrintData'

// ─────────────────────────────────────────────────────────────────────────────
// ReadOnlyInvoiceView
// Uses buildPrintData so the printed bill is IDENTICAL to warehouse billing
// and EditableInvoiceForm — same fields, same layout, same company info.
// ─────────────────────────────────────────────────────────────────────────────
const ReadOnlyInvoiceView = ({ open, onClose, sale, user, branches = [], warehouses = [] }) => {
  const [showPrintDialog, setShowPrintDialog] = useState(false)

  // Resolve the branch / warehouse record so we get real name, phone, address.
  // NOTE: scope_id for WAREHOUSE sales is stored as the warehouse NAME string
  // (confirmed in warehouseSalesController). Match by name first, then numeric id.
  const companyInfo = useMemo(() => {
    if (!sale) return {}
    const scopeType = sale.scope_type || sale.scopeType || ''
    const scopeId   = sale.scope_id   || sale.scopeId

    if (scopeType === 'WAREHOUSE') {
      const wh = warehouses.find(w =>
        w.name === scopeId ||          // name-string match (primary for warehouse sales)
        w.id   === scopeId ||          // exact match
        w.id   === Number(scopeId)     // numeric id fallback
      )
      if (wh) return {
        name   : wh.name,
        address: wh.location || wh.address || '',
        phone  : wh.phone    || wh.managerPhone || '',
        email  : wh.email    || '',
        logoUrl: wh.logoUrl  || '/petzonelogo.png',
      }
    } else {
      const br = branches.find(b =>
        b.id === scopeId ||
        b.id === Number(scopeId)
      )
      if (br) return {
        name   : br.name,
        address: br.location || br.address || '',
        phone  : br.phone    || br.managerPhone || '',
        email  : br.email    || '',
        logoUrl: br.logoUrl  || '/petzonelogo.png',
      }
    }
    return {}
  }, [sale, branches, warehouses])

  // Single normalised printData — same shape as warehouse billing
  const printData = useMemo(() => {
    if (!sale) return null
    return buildPrintData({ sale, companyInfo, user })
  }, [sale, companyInfo, user])

  if (!sale) return null

  // ── On-screen display values (read from the normalised printData) ──────────
  const pd = printData || {}
  const items    = pd.items || []
  const subtotal = pd.subtotal || 0
  const tax      = pd.tax     || 0
  const discount = pd.discount || 0
  const invoiceTotal = pd.invoiceTotal || 0
  const oldBalance   = pd.oldBalance   || 0
  const paymentAmount  = pd.paymentAmount  || 0
  const creditAmount   = pd.creditAmount   || 0
  const remainingBalance = pd.remainingBalance || 0

  const methodColors = {
    CASH: 'success', CARD: 'primary', BANK_TRANSFER: 'info',
    MOBILE_PAYMENT: 'secondary', CHEQUE: 'warning', FULLY_CREDIT: 'error',
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Sale Invoice — {sale.invoice_no || sale.id}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={() => setShowPrintDialog(true)}
                size="small"
                disabled={!printData}
              >
                Print / Item Sheet
              </Button>
              <Button onClick={onClose} size="small">Close</Button>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent>
          {/* ── Header info ── */}
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">Invoice #</Typography>
                <Typography variant="h6" fontWeight="bold">{pd.receiptNumber}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">Date &amp; Time</Typography>
                <Typography variant="body1">{pd.date} {pd.time}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">Payment Status</Typography>
                <Chip
                  label={pd.paymentStatus || 'N/A'}
                  color={pd.paymentStatus === 'COMPLETED' ? 'success' : pd.paymentStatus === 'PENDING' ? 'error' : 'default'}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">Customer</Typography>
                <Typography variant="body1">{pd.customerName}</Typography>
                {pd.customerPhone && (
                  <Typography variant="caption" color="text.secondary">{pd.customerPhone}</Typography>
                )}
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">Payment Method</Typography>
                <Chip
                  label={(pd.paymentMethod || 'N/A').replace(/_/g, ' ')}
                  color={methodColors[pd.paymentMethod] || 'default'}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  {(sale.scope_type || sale.scopeType) === 'WAREHOUSE' ? 'W.Keeper' : 'Cashier'}
                </Typography>
                <Typography variant="body1">{pd.cashierName}</Typography>
              </Grid>
              {(pd.warehouseName || pd.branchName) && (
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {pd.warehouseName ? 'Warehouse' : 'Branch'}
                  </Typography>
                  <Typography variant="body1">{pd.warehouseName || pd.branchName}</Typography>
                  {pd.companyAddress && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {pd.companyAddress}
                    </Typography>
                  )}
                  {pd.companyPhone && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      📞 {pd.companyPhone}
                    </Typography>
                  )}
                </Grid>
              )}
            </Grid>
          </Paper>

          {/* ── Items Table ── */}
          <TableContainer component={Paper} sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Item</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="center">Qty</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Unit Price</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Discount</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 'bold' }} align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {item.name}
                      </Typography>
                      {item.sku && (
                        <Typography variant="caption" color="text.secondary">SKU: {item.sku}</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">{item.quantity}</TableCell>
                    <TableCell align="right">{item.unitPrice.toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ color: item.discount > 0 ? 'error.main' : 'text.secondary' }}>
                      {item.discount > 0 ? `-${item.discount.toLocaleString()}` : '—'}
                    </TableCell>
                    <TableCell align="right">{item.total.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* ── Totals ── */}
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Box sx={{ width: 260 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Subtotal:</Typography>
                  <Typography variant="body2">{subtotal.toLocaleString()}</Typography>
                </Box>
                {tax > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Tax:</Typography>
                    <Typography variant="body2">{tax.toLocaleString()}</Typography>
                  </Box>
                )}
                {discount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="error.main">Discount:</Typography>
                    <Typography variant="body2" color="error.main">-{discount.toLocaleString()}</Typography>
                  </Box>
                )}
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="subtitle1" fontWeight="bold">Invoice Total:</Typography>
                  <Typography variant="subtitle1" fontWeight="bold">{invoiceTotal.toLocaleString()}</Typography>
                </Box>
                {oldBalance > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Old Balance:</Typography>
                    <Typography variant="body2">{oldBalance.toLocaleString()}</Typography>
                  </Box>
                )}
                {(oldBalance > 0 || invoiceTotal !== (subtotal + tax - discount)) && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="h6" fontWeight="bold">Total Due:</Typography>
                    <Typography variant="h6" fontWeight="bold">
                      {(invoiceTotal + oldBalance).toLocaleString()}
                    </Typography>
                  </Box>
                )}
                <Divider sx={{ my: 1 }} />
                {paymentAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Paid:</Typography>
                    <Typography variant="body2" color="success.main">{paymentAmount.toLocaleString()}</Typography>
                  </Box>
                )}
                {creditAmount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Credit:</Typography>
                    <Typography variant="body2" color="error.main">{creditAmount.toLocaleString()}</Typography>
                  </Box>
                )}
                {remainingBalance > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="error.main">Remaining Balance:</Typography>
                    <Typography variant="body2" color="error.main">{remainingBalance.toLocaleString()}</Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Paper>
        </DialogContent>
      </Dialog>

      {/* PrintDialog uses the SAME normalised printData as warehouse billing */}
      {showPrintDialog && printData && (
        <PrintDialog
          open={showPrintDialog}
          onClose={() => setShowPrintDialog(false)}
          printData={printData}
          title="Print Sales Receipt"
          defaultLayout="color"
        />
      )}
    </>
  )
}


// Table columns configuration
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'created_at', headerName: 'Date', width: 120, renderCell: (params) => {
    if (!params || !params.value) {
      return 'N/A';
    }
    try {
      const date = new Date(params.value);
      return (
        <Tooltip title={date.toLocaleString()}>
          <span>{date.toLocaleDateString()}</span>
        </Tooltip>
      );
    } catch (e) {
      return 'Invalid Date';
    }
  }},
  { field: 'created_time', headerName: 'Time', width: 100, renderCell: (params) => {
    if (!params || !params.row || !params.row.created_at) {
      return 'N/A';
    }
    try {
      const date = new Date(params.row.created_at);
      const timeString = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return (
        <Tooltip title={date.toLocaleString()}>
          <span>{timeString}</span>
        </Tooltip>
      );
    } catch (e) {
      return 'Invalid Time';
    }
  }},
  { field: 'invoice_no', headerName: 'Invoice #', width: 120 },
  { 
   field: 'scope_type', 
  headerName: 'Type', 
  width: 100,
  renderCell: (params) => {
    const scopeType = params.row.scope_type || params.row.scopeType
    return (
      <Chip 
        label={scopeType === 'WAREHOUSE' ? 'Warehouse' : 'Branch'} 
        color={scopeType === 'WAREHOUSE' ? 'error' : 'primary'}
        size="small"
      />
      )
    }
  },
  { 
    field: 'customerName', 
    headerName: 'Customer', 
    width: 150,
    renderCell: (params) => {
      if (!params || !params.row) {
        return 'No Data';
      }
      
      if (params.row.customerInfo && params.row.customerInfo.name) {
        return params.row.customerInfo.name;
      }
      
      if (params.row.customer_info) {
        try {
          const customerInfo = JSON.parse(params.row.customer_info);
          return customerInfo.name || 'No Customer';
        } catch (e) {
          return 'No Customer';
        }
      }
      
      return 'No Customer';
    }
  },
  { 
    field: 'salesperson', 
    headerName: 'Salesperson', 
    width: 150,
    renderCell: (params) => {
      if (!params || !params.row) {
        return null;
      }
      
      const scopeType = params.row.scope_type || params.row.scopeType;
      if (scopeType !== 'WAREHOUSE') {
        return null;
      }
      
      if (params.row.customerInfo && params.row.customerInfo.salesperson) {
        const sp = params.row.customerInfo.salesperson;
        return sp.name || (sp.id ? `Salesperson ${sp.id}` : null);
      }
      
      if (params.row.customer_info) {
        try {
          const customerInfo = JSON.parse(params.row.customer_info);
          if (customerInfo.salesperson) {
            const sp = customerInfo.salesperson;
            return sp.name || (sp.id ? `Salesperson ${sp.id}` : null);
          }
        } catch (e) {
          // silent
        }
      }
      
      return null;
    }
  },
  { field: 'subtotal', headerName: 'Subtotal', width: 120, type: 'number', renderCell: (params) => {
    if (!params || params.value === undefined || params.value === null) {
      return '0.00';
    }
    return `${parseFloat(params.value).toFixed(2)}`;
  }},
  { field: 'tax', headerName: 'Tax', width: 100, type: 'number', renderCell: (params) => {
    if (!params || params.value === undefined || params.value === null) {
      return '0.00';
    }
    return `${parseFloat(params.value).toFixed(2)}`;
  }},
  { field: 'discount', headerName: 'Discount', width: 100, type: 'number', renderCell: (params) => {
    if (!params || params.value === undefined || params.value === null) {
      return '0.00';
    }
    return `${parseFloat(params.value).toFixed(2)}`;
  }},
  { field: 'total', headerName: 'Total', width: 120, type: 'number', renderCell: (params) => {
    if (!params || params.value === undefined || params.value === null) {
      return '0.00';
    }
    return `${parseFloat(params.value).toFixed(2)}`;
  }},
  { field: 'payment_amount', headerName: 'Payment', width: 120, type: 'number', renderCell: (params) => {
    if (!params || params.value === undefined || params.value === null) {
      return '0.00';
    }
    return (
      <Typography 
        variant="body2"
        color="success.main"
        fontWeight="medium"
      >
        {parseFloat(params.value).toFixed(2)}
      </Typography>
    );
  }},
  { field: 'credit_amount', headerName: 'Credit', width: 120, type: 'number', renderCell: (params) => {
    const creditAmount = params.row.creditAmount || params.row.credit_amount || 0;
    const isPositive = parseFloat(creditAmount) >= 0;
    return (
      <Typography 
        variant="body2"
        color={isPositive ? 'error.main' : 'success.main'}
        fontWeight="medium"
      >
        {parseFloat(creditAmount).toFixed(2)}
      </Typography>
    );
  }},
  { field: 'running_balance', headerName: 'Balance', width: 120, type: 'number', renderCell: (params) => {
    const balance = params.row.runningBalance || params.row.running_balance || 0;
    const balanceValue = parseFloat(balance);
    const isPositive = balanceValue >= 0;
    return (
      <Typography 
        variant="body2"
        color={isPositive ? 'error.main' : 'success.main'}
        fontWeight="bold"
      >
        {balanceValue.toFixed(2)}
      </Typography>
    );
  }},
  { 
    field: 'paymentMethod', 
    headerName: 'Payment Method', 
    width: 150, 
    renderCell: (params) => {
      let paymentMethod = params.row.paymentMethod || params.row.payment_method;
      
      if (!paymentMethod && params.row.customer_info) {
        try {
          const customerInfo = typeof params.row.customer_info === 'string' 
            ? JSON.parse(params.row.customer_info) 
            : params.row.customer_info;
          paymentMethod = customerInfo.paymentMethod;
        } catch (e) {
          // silent
        }
      }
      
      if (!paymentMethod) {
        const creditAmount = params.row.creditAmount || 0;
        if (creditAmount > 0) {
          return <Chip label="FULLY CREDIT" color="error" size="small" />;
        }
        return <Chip label="N/A" color="default" size="small" />;
      }
      
      const methodColors = {
        'CASH': 'success',
        'CARD': 'primary',
        'BANK_TRANSFER': 'info',
        'MOBILE_PAYMENT': 'secondary',
        'CHEQUE': 'warning',
        'MOBILE_MONEY': 'secondary'
      };
      
      return (
        <Chip 
          label={paymentMethod.replace('_', ' ').toUpperCase()} 
          color={methodColors[paymentMethod] || 'default'}
          size="small"
        />
      );
    }
  },
  { 
    field: 'paymentType', 
    headerName: 'Payment Type', 
    width: 150, 
    renderCell: (params) => {
      let paymentType = params.row.payment_type || params.row.paymentType;
      
      if (!paymentType) {
        const creditAmount = params.row.creditAmount || params.row.credit_amount || 0;
        const paymentAmount = params.row.paymentAmount || params.row.payment_amount || 0;
        
        if (creditAmount > 0 && paymentAmount > 0) {
          paymentType = 'PARTIAL_PAYMENT';
        } else if (creditAmount > 0 && paymentAmount === 0) {
          paymentType = 'FULLY_CREDIT';
        } else {
          paymentType = 'FULL_PAYMENT';
        }
      }
      
      const typeColors = {
        'FULL_PAYMENT': 'success',
        'PARTIAL_PAYMENT': 'warning',
        'FULLY_CREDIT': 'error'
      }
      
      return (
        <Chip 
          label={paymentType.replace('_', ' ').toUpperCase()} 
          color={typeColors[paymentType] || 'default'}
          size="small"
        />
      );
    }
  },
  { 
    field: 'payment_terms', 
    headerName: 'Payment Terms', 
    width: 150,
    renderCell: (params) => {
      let paymentMethod = params.row.paymentMethod || params.row.payment_method;
      
      if (!paymentMethod && params.row.customer_info) {
        try {
          const customerInfo = typeof params.row.customer_info === 'string' 
            ? JSON.parse(params.row.customer_info) 
            : params.row.customer_info;
          paymentMethod = customerInfo.paymentMethod;
        } catch (e) {
          // silent
        }
      }
      
      if (paymentMethod === 'CREDIT') {
        let customerInfo = params.row.customerInfo;
        
        if (!customerInfo && params.row.customer_info) {
          try {
            customerInfo = typeof params.row.customer_info === 'string' 
              ? JSON.parse(params.row.customer_info) 
              : params.row.customer_info;
          } catch (e) {
            // silent
          }
        }
        
        if (customerInfo && customerInfo.paymentTerms) {
          return customerInfo.paymentTerms;
        }
        
        return 'N/A';
      }
      
      return '-';
    }
  },
  { field: 'paymentStatus', headerName: 'Payment Status', width: 130, renderCell: (params) => {
    const paymentStatus = params.row.paymentStatus || params.row.payment_status;
    if (!paymentStatus) {
      return <Chip label="N/A" color="default" size="small" />;
    }
    
    const statusColors = {
      'COMPLETED': 'success',
      'PENDING': 'error',
      'FAILED': 'error',
      'REFUNDED': 'info',
      'PARTIAL': 'warning'
    };
    
    return (
      <Chip 
        label={paymentStatus.replace('_', ' ').toUpperCase()} 
        color={statusColors[paymentStatus] || 'default'}
        size="small"
      />
    );
  }},
  { field: 'branch_name', headerName: 'Branch', width: 120 },
  { 
    field: 'return_quantity', 
    headerName: 'Returns', 
    width: 100,
    renderCell: (params) => {
      const saleId = params.row.id;
      const returns = salesReturns?.filter(returnItem => returnItem.sale_id === saleId) || [];
      
      if (returns.length === 0) {
        return <Chip label="0" color="default" size="small" />;
      }
      
      const totalReturnedQty = returns.reduce((sum, returnItem) => {
        return sum + (returnItem.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0);
      }, 0);
      
      return (
        <Chip 
          label={totalReturnedQty} 
          color="warning" 
          size="small"
          title={`${returns.length} return(s) - ${totalReturnedQty} items`}
        />
      );
    }
  },
  { 
    field: 'notes', 
    headerName: 'Notes', 
    width: 200,
    renderCell: (params) => {
      const notes = params.row.notes || '';
      if (!notes) {
        return <Chip label="No Notes" color="default" size="small" />;
      }
      
      const truncatedNotes = notes.length > 50 ? notes.substring(0, 50) + '...' : notes;
      
      return (
        <Tooltip title={notes} arrow>
          <Typography 
            variant="body2" 
            sx={{ 
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {truncatedNotes}
          </Typography>
        </Tooltip>
      );
    }
  },
]

// Sales returns columns
const returnsColumns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'originalSaleId', headerName: 'Original Sale', width: 120 },
  { field: 'reason', headerName: 'Reason', width: 200 },
  { field: 'refundAmount', headerName: 'Refund', width: 120, type: 'number', renderCell: (params) => {
    if (!params || params.value === undefined || params.value === null) {
      return '0.00';
    }
    return `${parseFloat(params.value).toFixed(2)}`;
  }},
  { field: 'status', headerName: 'Payment Type', width: 120, renderCell: (params) => {
    let paymentType = params.row.payment_type || params.row.paymentType;
    
    if (!paymentType) {
      const creditAmount = params.row.creditAmount || params.row.credit_amount || 0;
      const paymentAmount = params.row.paymentAmount || params.row.payment_amount || 0;
      
      if (creditAmount > 0 && paymentAmount > 0) {
        paymentType = 'PARTIAL_PAYMENT';
      } else if (creditAmount > 0 && paymentAmount === 0) {
        paymentType = 'FULLY_CREDIT';
      } else {
        paymentType = 'FULL_PAYMENT';
      }
    }
    
    const typeColors = {
      'FULL_PAYMENT': 'success',
      'PARTIAL_PAYMENT': 'warning',
      'FULLY_CREDIT': 'error'
    }
    
    return (
      <Chip 
        label={paymentType.replace('_', ' ').toUpperCase()} 
        color={typeColors[paymentType] || 'default'}
        size="small"
      />
    );
  }},
  { field: 'created_at', headerName: 'Date', width: 120, renderCell: (params) => {
    if (!params || !params.value) {
      return 'N/A';
    }
    try {
      const date = new Date(params.value);
      return (
        <Tooltip title={date.toLocaleString()}>
          <span>{date.toLocaleDateString()}</span>
        </Tooltip>
      );
    } catch (e) {
      return 'Invalid Date';
    }
  }},
  { field: 'created_time', headerName: 'Time', width: 100, renderCell: (params) => {
    if (!params || !params.row || !params.row.created_at) {
      return 'N/A';
    }
    try {
      const date = new Date(params.row.created_at);
      const timeString = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return (
        <Tooltip title={date.toLocaleString()}>
          <span>{timeString}</span>
        </Tooltip>
      );
    } catch (e) {
      return 'Invalid Time';
    }
  }}
]


const SalesManagement = () => {
  const dispatch = useDispatch()
  const { user: originalUser } = useSelector((state) => state.auth)

  const [urlParams, setUrlParams] = useState({})
  const [isAdminMode, setIsAdminMode] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const role = params.get('role')
      const scope = params.get('scope')
      const id = params.get('id')

      if (role && scope && id && originalUser?.role === 'ADMIN') {
        setUrlParams({ role, scope, id })
        setIsAdminMode(true)
      } else {
        setUrlParams({})
        setIsAdminMode(false)
      }
    }
  }, [originalUser])

  const getEffectiveUser = useCallback((originalUser) => {
    if (!isAdminMode || !urlParams.role) {
      return originalUser
    }

    return {
      ...originalUser,
      role: urlParams.role.toUpperCase(),
      branchId: urlParams.scope === 'branch' ? parseInt(urlParams.id) : null,
      warehouseId: urlParams.scope === 'warehouse' ? parseInt(urlParams.id) : null,
      branchName: urlParams.scope === 'branch' ? `Branch ${urlParams.id}` : null,
      warehouseName: urlParams.scope === 'warehouse' ? `Warehouse ${urlParams.id}` : null,
      isAdminMode: true,
      originalRole: originalUser.role,
      originalUser: originalUser
    }
  }, [isAdminMode, urlParams])

  const getScopeInfo = useCallback(() => {
    if (!isAdminMode || !urlParams.role) {
      return null
    }

    return {
      scopeType: urlParams.scope === 'branch' ? 'BRANCH' : 'WAREHOUSE',
      scopeId: urlParams.id,
      scopeName: urlParams.scope === 'branch' ? `Branch ${urlParams.id}` : `Warehouse ${urlParams.id}`
    }
  }, [isAdminMode, urlParams])

  const user = useMemo(() => getEffectiveUser(originalUser), [getEffectiveUser, originalUser])
  const scopeInfo = useMemo(() => getScopeInfo(), [getScopeInfo])

  const baseScopeParams = useMemo(() => {
    if (!user) return {}

    if (scopeInfo?.scopeType && scopeInfo?.scopeId) {
      const parsedId = Number(scopeInfo.scopeId)
      return {
        scopeType: scopeInfo.scopeType,
        scopeId: Number.isNaN(parsedId) ? scopeInfo.scopeId : parsedId
      }
    }

    if (user.role === 'CASHIER' && user.branchId) {
      return {
        scopeType: 'BRANCH',
        scopeId: Number(user.branchId)
      }
    }

    if (user.role === 'WAREHOUSE_KEEPER' && user.warehouseId) {
      return {
        scopeType: 'WAREHOUSE',
        scopeId: Number(user.warehouseId)
      }
    }

    return {}
  }, [user, scopeInfo])

  const { data: inventoryItems } = useSelector((state) => state.inventory)
  const { branchSettings, data: branches } = useSelector((state) => state.branches)
  const { data: warehouses, warehouseSettings } = useSelector((state) => state.warehouses)
  const { data: companies } = useSelector((state) => state.companies)
  const { data: retailers } = useSelector((state) => state.retailers)
  const { data: sales = [], loading: salesLoading, error: salesError, returns: salesReturns = [], pagination: salesPagination = {}, summary: salesSummary = {} } = useSelector((state) => state.sales || {})

  const [filters, setFilters] = useState({
    scopeType: 'all',
    scopeId: 'all',
    companyId: 'all',
    retailerId: 'all',
    startDate: '',
    endDate: ''
  })

  const [searchTerm, setSearchTerm] = useState('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [scopeTypeFilter, setScopeTypeFilter] = useState('all')
  const [scopeSearch, setScopeSearch] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)
  const [filteredSales, setFilteredSales] = useState([])
  const [exportAnchorEl, setExportAnchorEl] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedSale, setSelectedSale] = useState(null)
  const [saleItems, setSaleItems] = useState([])
  const [showItemsDialog, setShowItemsDialog] = useState(false)
  const [viewingSale, setViewingSale] = useState(null)
  const [editingSale, setEditingSale] = useState(null)
  const [showEditableInvoice, setShowEditableInvoice] = useState(false)
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false)
  const [entityToDelete, setEntityToDelete] = useState(null)

  // View — always true (eye icon always visible)
  const canView = true

  // Edit — admin always; cashier needs allowCashierSalesEdit; warehouse keeper needs allowWarehouseSalesEdit
  const canEdit = (() => {
    if (user?.role === 'ADMIN') return true
    if (user?.role === 'CASHIER') return Boolean(branchSettings?.allowCashierSalesEdit)
    if (user?.role === 'WAREHOUSE_KEEPER') return Boolean(warehouseSettings?.allowWarehouseSalesEdit)
    return false
  })()

  // Delete — admin always; cashier needs allowCashierSalesDelete; warehouse keeper needs allowWarehouseSalesDelete
  const canDelete = (() => {
    if (user?.role === 'ADMIN') return true
    if (user?.role === 'CASHIER') return Boolean(branchSettings?.allowCashierSalesDelete)
    if (user?.role === 'WAREHOUSE_KEEPER') return Boolean(warehouseSettings?.allowWarehouseSalesDelete)
    return false
  })()

  const handleManualRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
    const timestamp = Date.now()
    const paramsWithTimestamp = {
      ...baseScopeParams,
      page,
      limit: rowsPerPage,
      _t: timestamp
    }
    if (user?.role === 'ADMIN' && scopeSearch) {
      paramsWithTimestamp.scopeSearch = scopeSearch
    }
    dispatch(fetchSales(paramsWithTimestamp))
    dispatch(fetchSalesReturns(paramsWithTimestamp))
  }, [dispatch, baseScopeParams, page, rowsPerPage, user, scopeSearch])

  const handleDataUpdate = useCallback(() => {
    const timestamp = Date.now()
    const paramsWithTimestamp = {
      ...baseScopeParams,
      page,
      limit: rowsPerPage,
      _t: timestamp
    }
    if (user?.role === 'ADMIN' && scopeSearch) {
      paramsWithTimestamp.scopeSearch = scopeSearch
    }
    dispatch(fetchSales(paramsWithTimestamp))
    dispatch(fetchSalesReturns(paramsWithTimestamp))
  }, [dispatch, baseScopeParams, page, rowsPerPage, user, scopeSearch])

  const { isPolling, lastUpdate, refreshData } = useSalesPolling({
    enabled: false,
    interval: 60000,
    onDataUpdate: handleDataUpdate
  })

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const salesParams = { ...baseScopeParams }

      if (user?.role === 'ADMIN') {
        if (filters.scopeType !== 'all') {
          salesParams.scopeType = filters.scopeType
          if (filters.scopeId !== 'all') {
            const parsedScopeId = Number(filters.scopeId)
            salesParams.scopeId = Number.isNaN(parsedScopeId) ? filters.scopeId : parsedScopeId
          } else {
            delete salesParams.scopeId
          }
        } else if (!scopeInfo) {
          delete salesParams.scopeType
          delete salesParams.scopeId
        }

        if (filters.companyId !== 'all') {
          salesParams.companyId = filters.companyId
        }
      }

      if (user?.role === 'WAREHOUSE_KEEPER' && filters.retailerId !== 'all') {
        salesParams.retailerId = filters.retailerId
      }

      if (startDate) {
        salesParams.startDate = startDate.toISOString().split('T')[0]
      }
      if (endDate) {
        salesParams.endDate = endDate.toISOString().split('T')[0]
      }

      if (user?.role === 'ADMIN' && scopeSearch) {
        salesParams.scopeSearch = scopeSearch
      }

      salesParams.page = page
      salesParams.limit = rowsPerPage

      dispatch(fetchSales(salesParams))
      dispatch(fetchSalesReturns(salesParams))
    }, 500)

    if (user?.role === 'ADMIN') {
      dispatch(fetchBranches())
      dispatch(fetchWarehouses())
    }

    if (user?.role === 'CASHIER' && user?.branchId) {
      dispatch(fetchBranchSettings(user.branchId))
    }

    if (user?.role === 'WAREHOUSE_KEEPER' && user?.warehouseId) {
      dispatch(fetchWarehouseSettings(user.warehouseId))
      dispatch(fetchRetailers({ warehouseId: user.warehouseId }))
    }

    if (user) {
      const inventoryParams = { ...baseScopeParams }
      dispatch(fetchInventory(inventoryParams))
    }

    return () => clearTimeout(timeoutId)
  }, [dispatch, user, filters, startDate, endDate, baseScopeParams, scopeInfo, page, rowsPerPage, scopeSearch])

  const handleFilterChange = (field, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [field]: value }
      if (field === 'scopeType') {
        newFilters.scopeId = 'all'
      }
      return newFilters
    })
  }

  const clearFilters = () => {
    setSearchTerm('')
    setPaymentMethodFilter('all')
    setStatusFilter('all')
    setScopeTypeFilter('all')
    setScopeSearch('')
    setSortBy('created_at')
    setSortOrder('desc')
    setPage(1)
  }

  const getFilterSummary = () => {
    const filters = []
    if (searchTerm) filters.push(`Search: "${searchTerm}"`)
    if (scopeSearch && user?.role === 'ADMIN') filters.push(`Scope: "${scopeSearch}"`)
    if (paymentMethodFilter !== 'all') filters.push(`Payment: ${paymentMethodFilter}`)
    if (statusFilter !== 'all') filters.push(`Status: ${statusFilter}`)
    if (scopeTypeFilter !== 'all') filters.push(`Scope: ${scopeTypeFilter}`)
    return filters
  }

  const getFilteredAndSortedSales = () => {
    let filtered = (sales || []).filter(sale => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const invoiceMatch = sale.invoice_no?.toLowerCase().includes(searchLower)
        const customerMatch = sale.customerName?.toLowerCase().includes(searchLower)
        if (!invoiceMatch && !customerMatch) return false
      }

      if (paymentMethodFilter !== 'all') {
        const paymentMethod = sale.paymentMethod || sale.payment_method
        const paymentStatus = sale.paymentStatus || sale.payment_status
        const creditAmount = sale.creditAmount || 0

        if (paymentMethodFilter === 'partial_payment') {
          if (paymentStatus !== 'PARTIAL' && creditAmount <= 0) return false
        } else {
          if (paymentMethod?.toLowerCase() !== paymentMethodFilter.toLowerCase()) return false
        }
      }

      if (statusFilter !== 'all') {
        const status = sale.status?.toLowerCase()
        if (status !== statusFilter.toLowerCase()) return false
      }

      if (scopeTypeFilter !== 'all') {
        const scopeType = sale.scope_type || sale.scopeType
        if (scopeType !== scopeTypeFilter) return false
      }

      if (startDate || endDate) {
        const saleDate = new Date(sale.created_at || sale.createdAt || 0)
        if (isNaN(saleDate.getTime())) return false

        if (startDate) {
          const start = new Date(startDate)
          start.setHours(0, 0, 0, 0)
          const saleDateStart = new Date(saleDate)
          saleDateStart.setHours(0, 0, 0, 0)
          if (saleDateStart < start) return false
        }

        if (endDate) {
          const end = new Date(endDate)
          end.setHours(23, 59, 59, 999)
          const saleDateEnd = new Date(saleDate)
          saleDateEnd.setHours(23, 59, 59, 999)
          if (saleDateEnd > end) return false
        }
      }

      return true
    })

    filtered.sort((a, b) => {
      let aValue, bValue

      switch (sortBy) {
        case 'total':
          aValue = parseFloat(a.total || 0)
          bValue = parseFloat(b.total || 0)
          break
        case 'invoice_no':
          aValue = a.invoice_no || ''
          bValue = b.invoice_no || ''
          break
        case 'customerName':
          aValue = a.customerName || ''
          bValue = b.customerName || ''
          break
        case 'created_at':
        default:
          aValue = new Date(a.created_at || a.createdAt || 0)
          bValue = new Date(b.created_at || b.createdAt || 0)
          break
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }

  const allFilteredSales = getFilteredAndSortedSales()
  const totalItems = salesPagination?.total ?? allFilteredSales.length
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage))
  const startIndex = (page - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const paginatedSales = allFilteredSales

  const handlePageChange = (event, newPage) => {
    setPage(newPage)
  }

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(1)
  }

  const applyFilters = () => {
    if (filters.scopeType === 'all' && filters.scopeId === 'all' && !filters.startDate && !filters.endDate) {
      setFilteredSales(sales || [])
    } else {
      const filtered = (sales || []).filter(sale => {
        const saleScopeType = sale.scope_type || sale.scopeType
        const saleScopeId = sale.scope_id || sale.scopeId
        const saleDate = new Date(sale.createdAt || sale.date)

        let matchesScopeType = true
        let matchesScopeId = true
        let matchesDateRange = true

        if (filters.scopeType !== 'all') {
          matchesScopeType = saleScopeType === filters.scopeType
        }

        if (filters.scopeId !== 'all') {
          matchesScopeId = parseInt(saleScopeId) === parseInt(filters.scopeId)
        }

        if (filters.startDate) {
          const startDate = new Date(filters.startDate)
          startDate.setHours(0, 0, 0, 0)
          matchesDateRange = matchesDateRange && saleDate >= startDate
        }

        if (filters.endDate) {
          const endDate = new Date(filters.endDate)
          endDate.setHours(23, 59, 59, 999)
          matchesDateRange = matchesDateRange && saleDate <= endDate
        }

        return matchesScopeType && matchesScopeId && matchesDateRange
      })

      setFilteredSales(filtered)
    }
    setFilterDrawerOpen(true)
  }

  const clearOldFilters = () => {
    setFilters({
      scopeType: 'all',
      scopeId: 'all',
      companyId: 'all',
      retailerId: 'all',
      startDate: '',
      endDate: ''
    })
    setFilteredSales([])
    setFilterDrawerOpen(false)
  }

  const hasActiveFilters = filters.scopeType !== 'all' || filters.scopeId !== 'all' || filters.companyId !== 'all' || filters.retailerId !== 'all' || filters.startDate || filters.endDate

  const fetchSaleForEdit = async (saleId) => {
    try {
      const result = await dispatch(getSale(saleId));
      if (getSale.fulfilled.match(result)) {
        const saleData = result.payload.data || result.payload;
        setSelectedSale(saleData);
        setSaleItems(saleData.items || []);
        return saleData;
      } else {
        return null;
      }
    } catch (error) {
      return null;
    }
  };

  const handleDeleteSale = async () => {
    try {
      const result = await dispatch(deleteSale(entityToDelete.id))

      if (deleteSale.fulfilled.match(result)) {
        setOpenDeleteDialog(false)
        setEntityToDelete(null)
        dispatch(fetchSales({ ...baseScopeParams, page, limit: rowsPerPage }))
      } else if (deleteSale.rejected.match(result)) {
        alert(`Failed to delete sale: ${result.payload || 'Unknown error'}`)
      }
    } catch (error) {
      alert(`Failed to delete sale: ${error.message || 'Unknown error'}`)
    }
  }

  const handleCreateReturn = (returnData) => {
    dispatch(createSalesReturn(returnData))
    setOpenDialog(false)
  }

  const handleEditInvoice = async (sale) => {
    try {
      const response = await api.get(`/sales/${sale.id}`)
      if (response.data.success) {
        setEditingSale(response.data.data)
        setShowEditableInvoice(true)
      } else {
        alert('Failed to load sale details')
      }
    } catch (error) {
      alert('Failed to load sale details')
    }
  }

  const handleCloseEditableInvoice = () => {
    setShowEditableInvoice(false)
    setEditingSale(null)
  }

  const handleSaveEditableInvoice = (updatedSale) => {
    dispatch(fetchSales({ ...baseScopeParams, page, limit: rowsPerPage }))
    dispatch(fetchInventory(baseScopeParams))
    setShowEditableInvoice(false)
    setEditingSale(null)
  }

  const handleExportClick = (event) => {
    setExportAnchorEl(event.currentTarget)
  }

  const handleExportClose = () => {
    setExportAnchorEl(null)
  }

  const buildItemSummary = (salesData) => {
    const summaryMap = new Map()

    salesData.forEach((sale) => {
      if (!sale?.items || !Array.isArray(sale.items)) return

      sale.items.forEach((item) => {
        const name = item?.itemName || item?.name || item?.productName || 'Unknown Item'
        const sku = item?.sku || 'N/A'
        const quantity = Number(item?.quantity) || 0
        const lineTotal = Number(item?.total ?? (item?.unitPrice || 0) * quantity) || 0

        const key = `${name}|||${sku}`
        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            name,
            sku,
            totalQuantity: 0,
            totalSales: 0
          })
        }

        const entry = summaryMap.get(key)
        entry.totalQuantity += quantity
        entry.totalSales += lineTotal
      })
    })

    return Array.from(summaryMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity)
  }

  const exportToCSV = () => {
    const salesToExport = getFilteredAndSortedSales()
    const csvContent = generateCSV(salesToExport)
    downloadFile(csvContent, 'sales-data.csv', 'text/csv')
    handleExportClose()
  }

  const exportToExcel = async () => {
    const salesToExport = getFilteredAndSortedSales()
    const excelData = await generateExcel(salesToExport)

    const isBuffer = excelData instanceof ArrayBuffer || excelData instanceof Uint8Array
    const mimeType = isBuffer 
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv'
    const fileExtension = isBuffer ? 'xlsx' : 'csv'

    const blob = new Blob([excelData], { type: mimeType })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sales-data-${new Date().toISOString().split('T')[0]}.${fileExtension}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    handleExportClose()
  }

  const exportToPDF = () => {
    const salesToExport = getFilteredAndSortedSales()
    const pdfContent = generatePDF(salesToExport)
    downloadFile(pdfContent, 'sales-data.pdf', 'application/pdf')
    handleExportClose()
  }

  const generateCSV = (salesData) => {
    const totalRevenue = salesData.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0)
    const totalSubtotal = salesData.reduce((sum, sale) => sum + parseFloat(sale.subtotal || 0), 0)
    const totalTax = salesData.reduce((sum, sale) => sum + parseFloat(sale.tax || 0), 0)
    const totalDiscount = salesData.reduce((sum, sale) => sum + parseFloat(sale.discount || 0), 0)
    const totalPayment = salesData.reduce((sum, sale) => sum + parseFloat(sale.payment_amount || 0), 0)
    const transactionCount = salesData.length

    const itemSummary = buildItemSummary(salesData)

    const summary = [
      ['Sales Report Summary'],
      ['Report Date Range', `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`],
      ['Total Transactions', transactionCount],
      ['Total Subtotal', totalSubtotal.toFixed(2)],
      ['Total Tax', totalTax.toFixed(2)],
      ['Total Discount', totalDiscount.toFixed(2)],
      ['Total Revenue', totalRevenue.toFixed(2)],
      ['Total Payments Received', totalPayment.toFixed(2)],
      ['']
    ]

    if (itemSummary.length > 0) {
      summary.push(['Product Summary'])
      summary.push(['Product', 'SKU', 'Total Quantity', 'Total Sales'])
      itemSummary.forEach((item) => {
        summary.push([
          item.name,
          item.sku,
          item.totalQuantity,
          item.totalSales.toFixed(2)
        ])
      })
      summary.push([''])
    }

    const hasWarehouseSalesInExport = salesData.some(sale => (sale.scope_type || sale.scopeType) === 'WAREHOUSE')
    const headers = hasWarehouseSalesInExport
      ? ['ID', 'Date', 'Time', 'Invoice #', 'Customer', 'Salesperson', 'Subtotal', 'Tax', 'Discount', 'Total', 'Payment', 'Credit', 'Balance', 'Payment Method', 'Payment Type', 'Payment Status', 'Returns', 'Notes', 'Created By']
      : ['ID', 'Date', 'Time', 'Invoice #', 'Customer', 'Subtotal', 'Tax', 'Discount', 'Total', 'Payment', 'Credit', 'Balance', 'Payment Method', 'Payment Type', 'Payment Status', 'Returns', 'Notes', 'Created By']

    const rows = salesData.map(sale => {
      const returns = salesReturns?.filter(returnItem => returnItem.sale_id === sale.id) || [];
      const totalReturnedQty = returns.reduce((sum, returnItem) => {
        return sum + (returnItem.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0);
      }, 0);

      const saleDate = new Date(sale.created_at);

      return [
        sale.id,
        saleDate.toLocaleDateString(),
        saleDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        sale.invoice_no || 'N/A',
        (() => {
          if (sale.customerInfo && sale.customerInfo.name) return sale.customerInfo.name;
          if (sale.customer_info) {
            try {
              const ci = typeof sale.customer_info === 'string' ? JSON.parse(sale.customer_info) : sale.customer_info;
              return ci.name || 'Walk-in Customer';
            } catch (e) { return 'Walk-in Customer'; }
          }
          return sale.customer_name || 'Walk-in Customer';
        })(),
        ...(hasWarehouseSalesInExport ? [(() => {
          if (sale.scope_type !== 'WAREHOUSE' && sale.scopeType !== 'WAREHOUSE') return 'N/A';
          if (sale.customerInfo && sale.customerInfo.salesperson) {
            return sale.customerInfo.salesperson.name || (sale.customerInfo.salesperson.id ? `Salesperson ${sale.customerInfo.salesperson.id}` : 'N/A');
          }
          if (sale.customer_info) {
            try {
              const ci = typeof sale.customer_info === 'string' ? JSON.parse(sale.customer_info) : sale.customer_info;
              if (ci.salesperson) {
                return ci.salesperson.name || (ci.salesperson.id ? `Salesperson ${ci.salesperson.id}` : 'N/A');
              }
            } catch (e) {}
          }
          return 'N/A';
        })()] : []),
        parseFloat(sale.subtotal || 0).toFixed(2),
        parseFloat(sale.tax || 0).toFixed(2),
        parseFloat(sale.discount || 0).toFixed(2),
        parseFloat(sale.total || 0).toFixed(2),
        parseFloat(sale.payment_amount || 0).toFixed(2),
        parseFloat(sale.credit_amount || sale.creditAmount || 0).toFixed(2),
        parseFloat(sale.running_balance || sale.runningBalance || 0).toFixed(2),
        sale.paymentMethod || sale.payment_method || 'N/A',
        sale.paymentType || sale.payment_type || 'N/A',
        sale.paymentStatus || sale.payment_status || 'N/A',
        totalReturnedQty,
        sale.notes || 'No Notes',
        sale.created_by || sale.username || sale.user_name || 'Unknown'
      ]
    })

    return [...summary, headers, ...rows].map(row => Array.isArray(row) ? row.join(',') : `${row}`).join('\n')
  }

  const generateExcel = async (salesData) => {
    try {
      const XLSX = await import('xlsx')

      const excelData = salesData.map(sale => {
        const returns = salesReturns?.filter(returnItem => returnItem.sale_id === sale.id) || [];
        const totalReturnedQty = returns.reduce((sum, returnItem) => {
          return sum + (returnItem.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0);
        }, 0);

        const saleDate = new Date(sale.created_at);

        return {
          'ID': sale.id,
          'Date': saleDate.toLocaleDateString(),
          'Time': saleDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          'Invoice #': sale.invoice_no || 'N/A',
          'Customer': (() => {
            if (sale.customerInfo && sale.customerInfo.name) return sale.customerInfo.name;
            if (sale.customer_info) {
              try {
                const ci = typeof sale.customer_info === 'string' ? JSON.parse(sale.customer_info) : sale.customer_info;
                return ci.name || 'Walk-in Customer';
              } catch (e) { return 'Walk-in Customer'; }
            }
            return sale.customer_name || 'Walk-in Customer';
          })(),
          ...(salesData.some(s => (s.scope_type || s.scopeType) === 'WAREHOUSE') ? {
            'Salesperson': (() => {
              if (sale.scope_type !== 'WAREHOUSE' && sale.scopeType !== 'WAREHOUSE') return 'N/A';
              if (sale.customerInfo && sale.customerInfo.salesperson) {
                return sale.customerInfo.salesperson.name || (sale.customerInfo.salesperson.id ? `Salesperson ${sale.customerInfo.salesperson.id}` : 'N/A');
              }
              if (sale.customer_info) {
                try {
                  const ci = typeof sale.customer_info === 'string' ? JSON.parse(sale.customer_info) : sale.customer_info;
                  if (ci.salesperson) {
                    return ci.salesperson.name || (ci.salesperson.id ? `Salesperson ${ci.salesperson.id}` : 'N/A');
                  }
                } catch (e) {}
              }
              return 'N/A';
            })()
          } : {}),
          'Subtotal': parseFloat(sale.subtotal || 0).toFixed(2),
          'Tax': parseFloat(sale.tax || 0).toFixed(2),
          'Discount': parseFloat(sale.discount || 0).toFixed(2),
          'Total': parseFloat(sale.total || 0).toFixed(2),
          'Payment': parseFloat(sale.payment_amount || 0).toFixed(2),
          'Credit': parseFloat(sale.credit_amount || sale.creditAmount || 0).toFixed(2),
          'Balance': parseFloat(sale.running_balance || sale.runningBalance || 0).toFixed(2),
          'Payment Method': sale.paymentMethod || sale.payment_method || 'N/A',
          'Payment Type': sale.paymentType || sale.payment_type || 'N/A',
          'Payment Status': sale.paymentStatus || sale.payment_status || 'N/A',
          'Returns': totalReturnedQty,
          'Notes': sale.notes || 'No Notes',
          'Created By': sale.created_by || sale.username || sale.user_name || 'Unknown'
        };
      })

      const itemSummary = buildItemSummary(salesData)

      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Data')

      const itemSummarySheetData = itemSummary.length > 0
        ? itemSummary.map(item => ({
            'Product': item.name,
            'SKU': item.sku === 'N/A' ? '' : item.sku,
            'Total Quantity': item.totalQuantity,
            'Total Sales': item.totalSales.toFixed(2)
          }))
        : [{
            'Product': 'No item data for selected filters',
            'SKU': '',
            'Total Quantity': 0,
            'Total Sales': '0.00'
          }]

      const itemSummarySheet = XLSX.utils.json_to_sheet(itemSummarySheetData)
      XLSX.utils.book_append_sheet(workbook, itemSummarySheet, 'Item Summary')

      const excelBuffer = XLSX.write(workbook, { 
        type: 'array', 
        bookType: 'xlsx' 
      })

      return excelBuffer
    } catch (error) {
      return generateCSV(salesData)
    }
  }

  const generatePDF = (salesData) => {
    const itemSummary = buildItemSummary(salesData)

    const itemSummaryHtml = itemSummary.length > 0 ? `
      <div class="summary">
        <h3>Item Summary</h3>
        <table class="item-summary-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Total Quantity</th>
              <th>Total Sales</th>
            </tr>
          </thead>
          <tbody>
            ${itemSummary.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.sku}</td>
                <td>${item.totalQuantity}</td>
                <td>${item.totalSales.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Sales Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .total-row { font-weight: bold; background-color: #e6f3ff; }
            .status-completed { color: #28a745; }
            .status-pending { color: #ffc107; }
            .status-cancelled { color: #dc3545; }
            .item-summary-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .item-summary-table th, .item-summary-table td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            .item-summary-table th { background-color: #e9f5ff; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Sales Report</h1>
            <p>Generated on: ${new Date().toLocaleDateString()}</p>
            <p>Date Range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}</p>
            <p>Total Records: ${salesData.length}</p>
          </div>

          <div class="summary">
            <h3>Summary Statistics</h3>
            <p><strong>Total Transactions:</strong> ${salesData.length}</p>
            <p><strong>Total Subtotal:</strong> ${salesData.reduce((sum, sale) => sum + parseFloat(sale.subtotal || 0), 0).toFixed(2)}</p>
            <p><strong>Total Tax:</strong> ${salesData.reduce((sum, sale) => sum + parseFloat(sale.tax || 0), 0).toFixed(2)}</p>
            <p><strong>Total Discount:</strong> ${salesData.reduce((sum, sale) => sum + parseFloat(sale.discount || 0), 0).toFixed(2)}</p>
            <p><strong>Total Revenue:</strong> ${salesData.reduce((sum, sale) => sum + parseFloat(sale.total || 0), 0).toFixed(2)}</p>
            <p><strong>Total Payments Received:</strong> ${salesData.reduce((sum, sale) => sum + parseFloat(sale.payment_amount || 0), 0).toFixed(2)}</p>
            <p><strong>Completed Payments:</strong> ${salesData.filter(sale => (sale.paymentStatus || sale.payment_status) === 'COMPLETED').length}</p>
            <p><strong>Pending Payments:</strong> ${salesData.filter(sale => (sale.paymentStatus || sale.payment_status) === 'PENDING').length}</p>
          </div>
          ${itemSummaryHtml}

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Invoice #</th>
                <th>Customer</th>
                ${salesData.some(s => (s.scope_type || s.scopeType) === 'WAREHOUSE') ? '<th>Salesperson</th>' : ''}
                <th>Subtotal</th>
                <th>Tax</th>
                <th>Discount</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Credit</th>
                <th>Balance</th>
                <th>Payment Method</th>
                <th>Payment Type</th>
                <th>Payment Status</th>
                <th>Returns</th>
                <th>Notes</th>
                <th>Created By</th>
              </tr>
            </thead>
            <tbody>
              ${salesData.map(sale => {
                const returns = salesReturns?.filter(returnItem => returnItem.sale_id === sale.id) || [];
                const totalReturnedQty = returns.reduce((sum, returnItem) => {
                  return sum + (returnItem.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0);
                }, 0);

                const saleDate = new Date(sale.created_at);

                return `
                <tr>
                  <td>${saleDate.toLocaleDateString()}</td>
                  <td>${saleDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                  <td>${sale.invoice_no || 'N/A'}</td>
                  <td>${(() => {
                    if (sale.customerInfo && sale.customerInfo.name) return sale.customerInfo.name;
                    if (sale.customer_info) {
                      try {
                        const ci = typeof sale.customer_info === 'string' ? JSON.parse(sale.customer_info) : sale.customer_info;
                        return ci.name || 'Walk-in Customer';
                      } catch (e) { return 'Walk-in Customer'; }
                    }
                    return sale.customer_name || 'Walk-in Customer';
                  })()}</td>
                  ${salesData.some(s => (s.scope_type || s.scopeType) === 'WAREHOUSE') ? `<td>${
                    (() => {
                      if (sale.scope_type !== 'WAREHOUSE' && sale.scopeType !== 'WAREHOUSE') return 'N/A';
                      if (sale.customerInfo && sale.customerInfo.salesperson) {
                        return sale.customerInfo.salesperson.name || (sale.customerInfo.salesperson.id ? `Salesperson ${sale.customerInfo.salesperson.id}` : 'N/A');
                      }
                      if (sale.customer_info) {
                        try {
                          const ci = typeof sale.customer_info === 'string' ? JSON.parse(sale.customer_info) : sale.customer_info;
                          if (ci.salesperson) {
                            return ci.salesperson.name || (ci.salesperson.id ? `Salesperson ${ci.salesperson.id}` : 'N/A');
                          }
                        } catch (e) {}
                      }
                      return 'N/A';
                    })()
                  }</td>` : ''}
                  <td>${parseFloat(sale.subtotal || 0).toFixed(2)}</td>
                  <td>${parseFloat(sale.tax || 0).toFixed(2)}</td>
                  <td>${parseFloat(sale.discount || 0).toFixed(2)}</td>
                  <td>${parseFloat(sale.total || 0).toFixed(2)}</td>
                  <td>${parseFloat(sale.payment_amount || 0).toFixed(2)}</td>
                  <td>${parseFloat(sale.credit_amount || sale.creditAmount || 0).toFixed(2)}</td>
                  <td>${parseFloat(sale.running_balance || sale.runningBalance || 0).toFixed(2)}</td>
                  <td>${sale.paymentMethod || sale.payment_method || 'N/A'}</td>
                  <td>${sale.paymentType || sale.payment_type || 'N/A'}</td>
                  <td class="status-${(sale.paymentStatus || sale.payment_status)?.toLowerCase() || 'unknown'}">${sale.paymentStatus || sale.payment_status || 'N/A'}</td>
                  <td>${totalReturnedQty}</td>
                  <td>${sale.notes || 'No Notes'}</td>
                  <td>${sale.created_by || sale.username || sale.user_name || 'Unknown'}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `

    return htmlContent
  }

  const downloadFile = (content, filename, mimeType) => {
    if (mimeType === 'application/pdf') {
      const printWindow = window.open('', '_blank')
      printWindow.document.write(content)
      printWindow.document.close()

      printWindow.onload = () => {
        printWindow.print()
        printWindow.close()
      }
    } else {
      const blob = new Blob([content], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }
  }

  const salesStats = useMemo(() => ({
    totalSales: Number(salesSummary.totalSales || 0),
    totalTransactions: Number(salesSummary.totalTransactions || 0),
    averageOrderValue: Number(salesSummary.averageOrderValue || 0),
    completedSales: Number(salesSummary.completedSales || 0)
  }), [salesSummary])

  const hasWarehouseSales = useMemo(() => {
    if (!sales || sales.length === 0) return false
    return sales.some(sale => (sale.scope_type || sale.scopeType) === 'WAREHOUSE')
  }, [sales])

  const visibleColumns = useMemo(() => {
    return hasWarehouseSales 
      ? columns
      : columns.filter(col => col.field !== 'salesperson')
  }, [hasWarehouseSales])

  return (
    <DashboardLayout>
      <RouteGuard allowedRoles={['ADMIN', 'WAREHOUSE_KEEPER', 'CASHIER']}>
        <PermissionCheck roles={['ADMIN', 'MANAGER', 'CASHIER', 'WAREHOUSE_KEEPER']}>
          <Box sx={{ p: 3 }}>
            {isAdminMode && scopeInfo && (
              <Box sx={{ 
                bgcolor: 'warning.light', 
                color: 'warning.contrastText', 
                p: 1, 
                textAlign: 'center',
                borderBottom: 1,
                borderColor: 'warning.main',
                mb: 2
              }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                  🔧 ADMIN MODE: Operating as {scopeInfo.scopeType === 'BRANCH' ? 'Cashier' : 'Warehouse Keeper'} for {scopeInfo.scopeName}
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" component="h1">
                Sales Management
              </Typography>
            </Box>

            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>Total Sales</Typography>
                    <Typography variant="h5" component="div">{salesStats.totalSales.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>Total Transactions</Typography>
                    <Typography variant="h5" component="div">{salesStats.totalTransactions}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>Average Order Value</Typography>
                    <Typography variant="h5" component="div">{salesStats.averageOrderValue.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card>
                  <CardContent>
                    <Typography color="textSecondary" gutterBottom>Completed Sales</Typography>
                    <Typography variant="h5" component="div">{salesStats.completedSales}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Sales Transactions</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleManualRefresh}
                    disabled={salesLoading}
                    sx={{ minWidth: 120 }}
                  >
                    Refresh
                  </Button>
                  <Button 
                    variant="outlined" 
                    startIcon={<ExportIcon />}
                    onClick={handleExportClick}
                    sx={{ minWidth: 120 }}
                  >
                    Export
                  </Button>
                </Box>
              </Box>

              <Card>
                <CardContent>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <FilterIcon sx={{ mr: 1, fontSize: 20 }} />
                      <Typography variant="subtitle2">Search & Filters</Typography>
                    </Box>

                    <Grid container spacing={2} sx={{ mb: 1 }} alignItems="center">
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Search Sales"
                          placeholder="Search by invoice, customer..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon />
                              </InputAdornment>
                            ),
                            endAdornment: searchTerm && (
                              <InputAdornment position="end">
                                <IconButton
                                  size="small"
                                  onClick={() => setSearchTerm('')}
                                  edge="end"
                                >
                                  <ClearIcon />
                                </IconButton>
                              </InputAdornment>
                            )
                          }}
                        />
                      </Grid>

                      <Grid item xs={12} md={2}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DatePicker
                            label="Start Date"
                            value={startDate}
                            onChange={(newValue) => setStartDate(newValue)}
                            slotProps={{ textField: { size: 'small', fullWidth: true } }}
                          />
                        </LocalizationProvider>
                      </Grid>

                      <Grid item xs={12} md={2}>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                          <DatePicker
                            label="End Date"
                            value={endDate}
                            onChange={(newValue) => setEndDate(newValue)}
                            slotProps={{ textField: { size: 'small', fullWidth: true } }}
                          />
                        </LocalizationProvider>
                      </Grid>

                      <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Payment Method</InputLabel>
                          <Select
                            value={paymentMethodFilter}
                            label="Payment Method"
                            onChange={(e) => setPaymentMethodFilter(e.target.value)}
                          >
                            <MenuItem value="all">All Methods</MenuItem>
                            <MenuItem value="cash">Cash</MenuItem>
                            <MenuItem value="card">Card</MenuItem>
                            <MenuItem value="upi">UPI</MenuItem>
                            <MenuItem value="netbanking">Net Banking</MenuItem>
                            <MenuItem value="partial_payment">Partial Payment</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Status</InputLabel>
                          <Select
                            value={statusFilter}
                            label="Status"
                            onChange={(e) => setStatusFilter(e.target.value)}
                          >
                            <MenuItem value="all">All Status</MenuItem>
                            <MenuItem value="completed">Completed</MenuItem>
                            <MenuItem value="pending">Pending</MenuItem>
                            <MenuItem value="cancelled">Cancelled</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Scope</InputLabel>
                          <Select
                            value={scopeTypeFilter}
                            label="Scope"
                            onChange={(e) => setScopeTypeFilter(e.target.value)}
                          >
                            <MenuItem value="all">All Scopes</MenuItem>
                            <MenuItem value="BRANCH">Branch</MenuItem>
                            <MenuItem value="WAREHOUSE">Warehouse</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      {user?.role === 'ADMIN' && (
                        <Grid item xs={12} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Search Branch/Warehouse"
                            placeholder="Name or ID"
                            value={scopeSearch}
                            onChange={(e) => {
                              setScopeSearch(e.target.value)
                              setPage(1)
                            }}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <SearchIcon fontSize="small" />
                                </InputAdornment>
                              ),
                              endAdornment: scopeSearch && (
                                <InputAdornment position="end">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setScopeSearch('')
                                      setPage(1)
                                    }}
                                    edge="end"
                                  >
                                    <ClearIcon fontSize="small" />
                                  </IconButton>
                                </InputAdornment>
                              )
                            }}
                          />
                        </Grid>
                      )}

                      <Grid item xs={12} md={1}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Sort By</InputLabel>
                          <Select
                            value={sortBy}
                            label="Sort By"
                            onChange={(e) => setSortBy(e.target.value)}
                          >
                            <MenuItem value="created_at">Date</MenuItem>
                            <MenuItem value="total">Total</MenuItem>
                            <MenuItem value="invoice_no">Invoice</MenuItem>
                            <MenuItem value="customerName">Customer</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12} md={1}>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <Tooltip title="Clear all filters">
                            <IconButton
                              size="small"
                              onClick={clearFilters}
                              disabled={getFilterSummary().length === 0}
                            >
                              <ClearIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={sortOrder === 'asc' ? 'Sort Descending' : 'Sort Ascending'}>
                            <IconButton
                              size="small"
                              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            >
                              {sortOrder === 'asc' ? '↑' : '↓'}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Grid>
                    </Grid>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      {getFilterSummary().length > 0 ? (
                        <>
                          <Typography variant="body2" color="text.secondary">Active filters:</Typography>
                          {getFilterSummary().map((filter, index) => (
                            <Chip key={index} label={filter} size="small" color="primary" variant="outlined" />
                          ))}
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No filters applied - showing all items
                        </Typography>
                      )}
                    </Box>

                    <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} sales
                      </Typography>
                    </Box>
                  </Box>

                  {salesLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                      <CircularProgress />
                    </Box>
                  ) : salesError ? (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {typeof salesError === 'string' ? salesError : salesError.message || 'Failed to load sales data'}
                    </Alert>
                  ) : (
                    <TableContainer component={Paper}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Time</TableCell>
                            <TableCell>Invoice #</TableCell>
                            <TableCell>Location</TableCell>
                            <TableCell>Customer</TableCell>
                            {paginatedSales.some(s => (s.scope_type || s.scopeType) === 'WAREHOUSE') && (
                              <TableCell>Salesperson</TableCell>
                            )}
                            <TableCell align="right">Subtotal</TableCell>
                            <TableCell align="right">Tax</TableCell>
                            <TableCell align="right">Discount</TableCell>
                            <TableCell align="right">Total</TableCell>
                            <TableCell>Payment Method</TableCell>
                            <TableCell>Payment Type</TableCell>
                            <TableCell>Payment Terms</TableCell>
                            <TableCell>Payment Status</TableCell>
                            <TableCell>Created By</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {paginatedSales.map((sale) => (
                            <TableRow key={sale.id}>
                              <TableCell>{sale.id}</TableCell>
                              <TableCell>
                                {(() => {
                                  try {
                                    const date = new Date(sale.created_at);
                                    if (isNaN(date.getTime())) return 'N/A';
                                    return date.toLocaleDateString();
                                  } catch (e) {
                                    return 'N/A';
                                  }
                                })()}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  try {
                                    const date = new Date(sale.created_at);
                                    return date.toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true
                                    });
                                  } catch (e) {
                                    return 'N/A';
                                  }
                                })()}
                              </TableCell>
                              <TableCell>{sale.invoice_no || 'N/A'}</TableCell>
                              <TableCell>
                                {(() => {
                                  const scopeType = sale.scope_type || sale.scopeType
                                  const scopeId = sale.scope_id || sale.scopeId
                                  if (scopeType === 'WAREHOUSE') {
                                    const warehouse = (warehouses || []).find(w => w.id === scopeId || w.id === Number(scopeId))
                                    return warehouse?.name || `Warehouse ${scopeId}`
                                  } else {
                                    const branch = (branches || []).find(b => b.id === scopeId || b.id === Number(scopeId))
                                    return branch?.name || `Branch ${scopeId}`
                                  }
                                })()}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  if (sale.customerInfo && sale.customerInfo.name) return sale.customerInfo.name;
                                  if (sale.customer_info) {
                                    try {
                                      const customerInfo = JSON.parse(sale.customer_info);
                                      return customerInfo.name || 'No Customer';
                                    } catch (e) {
                                      return 'No Customer';
                                    }
                                  }
                                  return 'No Customer';
                                })()}
                              </TableCell>
                              {paginatedSales.some(s => (s.scope_type || s.scopeType) === 'WAREHOUSE') && (
                                <TableCell>
                                  {(() => {
                                    if (sale.scope_type !== 'WAREHOUSE' && sale.scopeType !== 'WAREHOUSE') return null;
                                    if (sale.customerInfo && sale.customerInfo.salesperson) {
                                      const sp = sale.customerInfo.salesperson;
                                      return sp.name || (sp.id ? `Salesperson ${sp.id}` : null);
                                    }
                                    if (sale.customer_info) {
                                      try {
                                        const customerInfo = JSON.parse(sale.customer_info);
                                        if (customerInfo.salesperson) {
                                          const sp = customerInfo.salesperson;
                                          return sp.name || (sp.id ? `Salesperson ${sp.id}` : null);
                                        }
                                      } catch (e) {
                                        // silent
                                      }
                                    }
                                    return null;
                                  })()}
                                </TableCell>
                              )}
                              <TableCell align="right">{parseFloat(sale.subtotal || 0).toFixed(2)}</TableCell>
                              <TableCell align="right">{parseFloat(sale.tax || 0).toFixed(2)}</TableCell>
                              <TableCell align="right">{parseFloat(sale.discount || 0).toFixed(2)}</TableCell>
                              <TableCell align="right">{parseFloat(sale.total || 0).toFixed(2)}</TableCell>
                              <TableCell>
                                {(() => {
                                  let paymentMethod = sale.paymentMethod || sale.payment_method;
                                  if (!paymentMethod && sale.customer_info) {
                                    try {
                                      const customerInfo = typeof sale.customer_info === 'string' 
                                        ? JSON.parse(sale.customer_info) 
                                        : sale.customer_info;
                                      paymentMethod = customerInfo.paymentMethod;
                                    } catch (e) {
                                      // silent
                                    }
                                  }

                                  if (paymentMethod === 'FULLY_CREDIT') {
                                    return <Chip label="FULLY CREDIT" color="error" size="small" />;
                                  }
                                  if (paymentMethod === 'PARTIAL_PAYMENT') {
                                    return <Chip label="PARTIAL PAYMENT" color="warning" size="small" />;
                                  }

                                  const methodColors = {
                                    'CASH': 'success',
                                    'CARD': 'primary',
                                    'BANK_TRANSFER': 'info',
                                    'MOBILE_PAYMENT': 'secondary',
                                    'CHEQUE': 'warning'
                                  };

                                  return (
                                    <Chip 
                                      label={paymentMethod?.replace('_', ' ').toUpperCase() || 'N/A'} 
                                      color={methodColors[paymentMethod] || 'default'}
                                      size="small"
                                    />
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  let paymentType = sale.paymentType || sale.payment_type;
                                  if (!paymentType && sale.customer_info) {
                                    try {
                                      const customerInfo = typeof sale.customer_info === 'string' 
                                        ? JSON.parse(sale.customer_info) 
                                        : sale.customer_info;
                                      paymentType = customerInfo.paymentType;
                                    } catch (e) {
                                      // silent
                                    }
                                  }

                                  const typeColors = {
                                    'FULL_PAYMENT': 'success',
                                    'PARTIAL_PAYMENT': 'warning',
                                    'FULLY_CREDIT': 'error',
                                    'CASH': 'success',
                                    'CARD': 'primary',
                                    'BANK_TRANSFER': 'info',
                                    'CHEQUE': 'warning'
                                  };

                                  const typeLabels = {
                                    'FULL_PAYMENT': 'Full Payment',
                                    'PARTIAL_PAYMENT': 'Partial Payment',
                                    'FULLY_CREDIT': 'Fully Credit',
                                    'CASH': 'Cash',
                                    'CARD': 'Card',
                                    'BANK_TRANSFER': 'Bank Transfer',
                                    'CHEQUE': 'Cheque'
                                  };

                                  return (
                                    <Chip 
                                      label={typeLabels[paymentType] || paymentType || 'N/A'} 
                                      color={typeColors[paymentType] || 'default'}
                                      size="small"
                                    />
                                  );
                                })()}
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  let paymentMethod = sale.paymentMethod || sale.payment_method;
                                  if (!paymentMethod && sale.customer_info) {
                                    try {
                                      const customerInfo = typeof sale.customer_info === 'string' 
                                        ? JSON.parse(sale.customer_info) 
                                        : sale.customer_info;
                                      paymentMethod = customerInfo.paymentMethod;
                                    } catch (e) {
                                      // silent
                                    }
                                  }

                                  if (paymentMethod === 'CREDIT') {
                                    let customerInfo = sale.customerInfo;
                                    if (!customerInfo && sale.customer_info) {
                                      try {
                                        customerInfo = typeof sale.customer_info === 'string' 
                                          ? JSON.parse(sale.customer_info) 
                                          : sale.customer_info;
                                      } catch (e) {
                                        // silent
                                      }
                                    }
                                    if (customerInfo && customerInfo.paymentTerms) return customerInfo.paymentTerms;
                                    return 'N/A';
                                  }
                                  return '-';
                                })()}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={sale.paymentStatus || sale.payment_status || 'N/A'} 
                                  color={(sale.paymentStatus || sale.payment_status) === 'COMPLETED' ? 'success' : (sale.paymentStatus || sale.payment_status) === 'PENDING' ? 'error' : 'default'}
                                  size="small"
                                />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight="medium">
                                  {sale.created_by || sale.username || sale.user_name || 'Unknown'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  {/* Eye — always visible to everyone */}
                                  <Tooltip title="View Invoice">
                                    <IconButton
                                      size="small"
                                      onClick={async () => {
                                        const fullSale = await fetchSaleForEdit(sale.id)
                                        setViewingSale(fullSale || sale)
                                        setShowItemsDialog(true)
                                      }}
                                      color="info"
                                    >
                                      <ViewIcon />
                                    </IconButton>
                                  </Tooltip>
                                  {/* Edit — only when canEdit toggle is ON */}
                                  {canEdit && (
                                    <Tooltip title="Edit Invoice">
                                      <IconButton
                                        size="small"
                                        onClick={() => handleEditInvoice(sale)}
                                        color="secondary"
                                      >
                                        <ReceiptIcon />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                  {/* Delete — only when canDelete toggle is ON */}
                                  {canDelete && (
                                    <Tooltip title="Delete">
                                      <IconButton
                                        size="small"
                                        onClick={() => {
                                          setEntityToDelete(sale)
                                          setOpenDeleteDialog(true)
                                        }}
                                        color="error"
                                      >
                                        <DeleteIcon />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {totalItems > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">Rows per page:</Typography>
                        <FormControl size="small" sx={{ minWidth: 80 }}>
                          <Select value={rowsPerPage} onChange={handleRowsPerPageChange} displayEmpty>
                            <MenuItem value={10}>10</MenuItem>
                            <MenuItem value={25}>25</MenuItem>
                            <MenuItem value={50}>50</MenuItem>
                            <MenuItem value={100}>100</MenuItem>
                          </Select>
                        </FormControl>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Page {page} of {totalPages}
                        </Typography>
                        <Pagination
                          count={totalPages}
                          page={page}
                          onChange={handlePageChange}
                          color="primary"
                          size="small"
                          showFirstButton
                          showLastButton
                          disabled={totalPages <= 1}
                        />
                      </Box>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Box>
          </Box>
        </PermissionCheck>
      </RouteGuard>

      <ConfirmationDialog
        open={openDeleteDialog}
        onClose={() => {
          setOpenDeleteDialog(false)
          setEntityToDelete(null)
        }}
        onConfirm={handleDeleteSale}
        title="Delete Sale"
        message="Are you sure you want to delete this sale? This action cannot be undone."
      />

      {/* Pass branches + warehouses so ReadOnlyInvoiceView can resolve real names/phones */}
      <ReadOnlyInvoiceView
        open={showItemsDialog}
        onClose={() => setShowItemsDialog(false)}
        sale={viewingSale}
        user={user}
        branches={branches || []}
        warehouses={warehouses || []}
      />

      <Drawer
        anchor="bottom"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            height: '70vh',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Filtered Sales Results
              <Badge badgeContent={filteredSales.length} color="primary" sx={{ ml: 2 }} />
            </Typography>
            <IconButton onClick={() => setFilterDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {filteredSales.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No sales found matching the selected filters.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ height: 'calc(70vh - 120px)', overflow: 'auto' }}>
              <List>
                {filteredSales.map((sale, index) => (
                  <React.Fragment key={sale.id || index}>
                    <ListItem sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          Sale #{sale.receiptNumber || sale.id}
                        </Typography>
                        {(() => {
                          const scopeType = sale.scope_type || sale.scopeType
                          const scopeId = sale.scope_id || sale.scopeId
                          if (scopeType === 'WAREHOUSE') {
                            const warehouse = (warehouses || []).find(w => w.id === scopeId || w.id === Number(scopeId))
                            return <Typography variant="body2" fontWeight="bold">{warehouse?.name || `Warehouse ${scopeId}`}</Typography>
                          } else {
                            const branch = (branches || []).find(b => b.id === scopeId || b.id === Number(scopeId))
                            return <Typography variant="body2" fontWeight="bold">{branch?.name || `Branch ${scopeId}`}</Typography>
                          }
                        })()}
                      </Box>

                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', width: '100%' }}>
                        <ListItemText primary="Date" secondary={new Date(sale.createdAt || sale.date).toLocaleDateString()} sx={{ minWidth: 100 }} />
                        <ListItemText primary="Time" secondary={new Date(sale.createdAt || sale.date).toLocaleTimeString()} sx={{ minWidth: 100 }} />
                        <ListItemText primary="Customer" secondary={sale.customerName || 'Walk-in'} sx={{ minWidth: 120 }} />
                        <ListItemText primary="Total" secondary={`${parseFloat(sale.total || 0).toFixed(2)}`} sx={{ minWidth: 100 }} />
                        <ListItemText primary="Payment" secondary={sale.paymentMethod || 'Cash'} sx={{ minWidth: 100 }} />
                        <ListItemText
                          primary="Location"
                          secondary={
                            sale.scope_type === 'BRANCH' || sale.scopeType === 'BRANCH'
                              ? (branches || []).find(b => b.id === (sale.scope_id || sale.scopeId))?.name || `Branch ${sale.scope_id || sale.scopeId}`
                              : (warehouses || []).find(w => w.id === (sale.scope_id || sale.scopeId))?.name || `Warehouse ${sale.scope_id || sale.scopeId}`
                          }
                          sx={{ minWidth: 150 }}
                        />
                      </Box>

                      {sale.items && sale.items.length > 0 && (
                        <Box sx={{ mt: 1, width: '100%' }}>
                          <Typography variant="caption" color="text.secondary">
                            Items: {sale.items.map(item => `${item.name} (${item.quantity})`).join(', ')}
                          </Typography>
                        </Box>
                      )}
                    </ListItem>
                    {index < filteredSales.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </Box>
          )}
        </Box>
      </Drawer>

      <Menu
        anchorEl={exportAnchorEl}
        open={Boolean(exportAnchorEl)}
        onClose={handleExportClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <MenuItem onClick={exportToCSV}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          Export as CSV
        </MenuItem>
        <MenuItem onClick={exportToExcel}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          Export as Excel
        </MenuItem>
        <MenuItem onClick={exportToPDF}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          Export as PDF
        </MenuItem>
      </Menu>

      <EditableInvoiceForm
        open={showEditableInvoice}
        onClose={handleCloseEditableInvoice}
        sale={editingSale}
        onSave={handleSaveEditableInvoice}
        branches={branches || []}
        warehouses={warehouses || []}
      />
    </DashboardLayout>
  )
}

export default withAuth(SalesManagement)