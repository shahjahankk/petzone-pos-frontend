'use client'

import React, { useState, useRef } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, ToggleButton, ToggleButtonGroup,
  Tooltip, IconButton, FormControl, InputLabel, Select, MenuItem,
  TextField, Grid, Switch, FormControlLabel, Divider, Alert, Checkbox
} from '@mui/material'
import {
  Print as PrintIcon,
  Close as CloseIcon,
  ViewList as ItemSheetIcon,
  Receipt as ThermalIcon,
  Article as ColorIcon,
  Preview as PreviewIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material'
import PrintLayout from './PrintLayout'
import {
  hasDirectPrinterPaired,
  acquirePrinter,
  writeToThermalPrinter,
  setPrinterMode,
  PRINTER_MODE_DIRECT,
  resetCachedPrinter,
} from '../../utils/thermalPrinter'
import { buildReceiptEscPos } from '../../utils/receiptEscPos'

/**
 * PrintDialog — full version with Item Sheet toggle
 *
 * Props
 * ─────
 * open            boolean
 * onClose         () => void
 * onPrintComplete () => void
 * onPrint         (printData, settings) => void   — optional override
 * printData       object  — all fields forwarded to PrintLayout
 * title           string  — dialog heading
 * defaultLayout   'thermal' | 'color'             — initial tab
 * showPreview     boolean (default true)
 * showSettings    boolean (default true)
 */
export default function PrintDialog({
  open,
  onClose,
  onPrint,
  onPrintComplete,
  printData,
  title = 'Print Receipt',
  defaultLayout = 'thermal',
  showPreview = true,
  showSettings = true,
}) {
  const [layout, setLayout]           = useState(defaultLayout || 'thermal')
  const [isItemSheet, setIsItemSheet] = useState(false)

  const [printSettings, setPrintSettings] = useState({
    width: defaultLayout === 'thermal' ? 280 : 800,
    showCompanyInfo: true,
    showFooter: true,
    fontSize: '12px',
    paperSize: defaultLayout === 'thermal' ? '80mm' : 'A4',
    copies: 1,
    orientation: 'portrait',
  })

  const [dontAskAgain, setDontAskAgain] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem('autoDirectPrint') === '1'
    } catch (e) {
      return false
    }
  })

  const printRef        = useRef(null)
  const printContentRef = useRef(null)

  if (!printData) return null

  // ── Layout toggle ─────────────────────────────────────────────────────────
  const handleLayoutChange = (_, newLayout) => {
    if (!newLayout) return
    setLayout(newLayout)
    setIsItemSheet(false)   // reset item-sheet when switching layout
    setPrintSettings(prev => ({
      ...prev,
      paperSize: newLayout === 'thermal' ? '80mm' : 'A4',
      width:     newLayout === 'thermal' ? 280    : 800,
    }))
  }

  const handleItemSheetToggle = () => setIsItemSheet(prev => !prev)

  const handleSettingChange = (key, value) => {
    setPrintSettings(prev => ({ ...prev, [key]: value }))
  }

  // ── Print: silent USB/Serial first, browser dialog only as fallback ────────
  const handlePrint = async () => {
    try {
      if (typeof window !== 'undefined') {
        if (dontAskAgain) window.localStorage.setItem('autoDirectPrint', '1')
        else window.localStorage.removeItem('autoDirectPrint')
      }
    } catch (e) { /* ignore */ }

    if (onPrint) {
      onPrint(printData, { layout, isItemSheet, ...printSettings })
      return
    }

    // Prefer silent thermal ESC/POS (logo + aligned) — no Chrome modal
    if (layout === 'thermal' && !isItemSheet) {
      try {
        if (await hasDirectPrinterPaired()) {
          setPrinterMode(PRINTER_MODE_DIRECT)
          await acquirePrinter({ allowRequest: false })
          const payload = await buildReceiptEscPos(printData, {
            includeLogo: true,
            logoWidth: 448,
            logoHeight: 120,
            width: 56,
          })
          await writeToThermalPrinter(payload)
          if (onPrintComplete) onPrintComplete()
          if (typeof onClose === 'function') onClose()
          return
        }
      } catch (err) {
        resetCachedPrinter()
        console.warn('Silent thermal print failed, opening browser dialog:', err)
      }
    }

    const content = printContentRef.current?.innerHTML || printRef.current?.innerHTML || ''
    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      alert('Please allow pop-ups to print')
      return
    }

    const isThermal   = layout === 'thermal'
    const isLandscape = printSettings.orientation === 'landscape'

    let pageSize = isThermal ? '80mm auto' : printSettings.paperSize === 'Letter' ? 'Letter' : 'A4'
    if (!isThermal && isLandscape) pageSize += ' landscape'
    const pageMargin = isThermal ? '1mm 1mm' : '10mm 12mm'
    const fontFamily = isThermal ? 'monospace' : 'Arial, Helvetica, sans-serif'
    const fontSize   = isThermal ? '11px' : (printSettings.fontSize || '12px')
    const lineHeight = isThermal ? '1.1' : '1.4'
    const wrapWidth  = isThermal ? '76mm' : '100%'

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Print — ${printData?.receiptNumber || printData?.invoiceNo || 'Invoice'}</title>
  <meta charset="UTF-8">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    @page { size: ${pageSize}; margin: ${pageMargin}; }

    body {
      font-family: ${fontFamily};
      font-size: ${fontSize};
      line-height: ${lineHeight};
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-wrapper {
      width: ${wrapWidth};
      max-width: ${isThermal ? '76mm' : '100%'};
      margin: 0 ${isThermal ? 'auto' : '0'};
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; vertical-align: top; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  </style>
</head>
<body>
  <div class="print-wrapper">${content}</div>
  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 300); };
    window.onafterprint = function() { window.close(); };
    setTimeout(function() { if (!window.closed) window.close(); }, 5000);
  <\/script>
</body>
</html>`)
    printWindow.document.close()

    if (onPrintComplete) onPrintComplete()
  }

  // ── Shared props forwarded to PrintLayout ─────────────────────────────────
  const layoutProps = {
    ...printData,
    layout,
    isItemSheet,
    showCompanyInfo: printSettings.showCompanyInfo,
    fontSize: printSettings.fontSize,
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{ sx: { minHeight: '600px', maxHeight: '95vh' } }}
    >
      {/* ── Title bar with all 3 toggles ── */}
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PrintIcon />
            <Typography variant="h6">{title}</Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {/* Thermal / Color/A4 toggle */}
            <ToggleButtonGroup
              value={layout}
              exclusive
              onChange={handleLayoutChange}
              size="small"
              sx={{ mr: 0.5 }}
            >
              <ToggleButton value="thermal" sx={{ px: 1.5, gap: 0.5 }}>
                <ThermalIcon fontSize="small" />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Thermal</Typography>
              </ToggleButton>
              <ToggleButton value="color" sx={{ px: 1.5, gap: 0.5 }}>
                <ColorIcon fontSize="small" />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Color / A4</Typography>
              </ToggleButton>
            </ToggleButtonGroup>

            {/* Item Sheet toggle */}
            <Tooltip title={isItemSheet ? 'Switch to full invoice' : 'Switch to item sheet (no prices)'}>
              <ToggleButton
                value="itemSheet"
                selected={isItemSheet}
                onChange={handleItemSheetToggle}
                size="small"
                sx={{
                  px: 1.5, gap: 0.5,
                  border: '1px solid',
                  borderColor: isItemSheet ? 'primary.main' : 'divider',
                  bgcolor: isItemSheet ? 'primary.light' : 'transparent',
                  '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.main' },
                }}
              >
                <ItemSheetIcon fontSize="small" />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>Item Sheet</Typography>
              </ToggleButton>
            </Tooltip>

            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 2 }}>
        <Grid container spacing={3}>

          {/* ── Settings panel ── */}
          {showSettings && (
            <Grid item xs={12} md={4}>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon fontSize="small" />
                Print Settings
              </Typography>

              {/* Paper size (disabled for thermal — fixed 80mm) */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Paper Size</InputLabel>
                <Select
                  value={printSettings.paperSize}
                  label="Paper Size"
                  disabled={layout === 'thermal'}
                  onChange={(e) => handleSettingChange('paperSize', e.target.value)}
                >
                  <MenuItem value="80mm">80mm (Thermal)</MenuItem>
                  <MenuItem value="A4">A4</MenuItem>
                  <MenuItem value="Letter">Letter</MenuItem>
                </Select>
              </FormControl>

              {/* Orientation — only relevant for color/A4 */}
              {layout === 'color' && (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Orientation</InputLabel>
                  <Select
                    value={printSettings.orientation}
                    label="Orientation"
                    onChange={(e) => handleSettingChange('orientation', e.target.value)}
                  >
                    <MenuItem value="portrait">Portrait</MenuItem>
                    <MenuItem value="landscape">Landscape</MenuItem>
                  </Select>
                </FormControl>
              )}

              {/* Font size */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Font Size</InputLabel>
                <Select
                  value={printSettings.fontSize}
                  label="Font Size"
                  onChange={(e) => handleSettingChange('fontSize', e.target.value)}
                >
                  <MenuItem value="10px">Small (10px)</MenuItem>
                  <MenuItem value="11px">Medium (11px)</MenuItem>
                  <MenuItem value="12px">Large (12px)</MenuItem>
                  <MenuItem value="14px">Extra Large (14px)</MenuItem>
                  <MenuItem value="16px">XXL (16px)</MenuItem>
                </Select>
              </FormControl>

              {/* Receipt width */}
              <TextField
                fullWidth
                label="Receipt Width (px)"
                type="number"
                value={printSettings.width}
                onChange={(e) => handleSettingChange('width', parseInt(e.target.value))}
                sx={{ mb: 2 }}
                inputProps={{
                  min: layout === 'thermal' ? 200 : 600,
                  max: layout === 'thermal' ? 400 : 1200,
                }}
              />

              {/* Copies */}
              <TextField
                fullWidth
                label="Copies"
                type="number"
                value={printSettings.copies}
                onChange={(e) => handleSettingChange('copies', parseInt(e.target.value))}
                sx={{ mb: 2 }}
                inputProps={{ min: 1, max: 10 }}
              />

              <Divider sx={{ my: 2 }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={printSettings.showCompanyInfo}
                    onChange={(e) => handleSettingChange('showCompanyInfo', e.target.checked)}
                  />
                }
                label="Show Company Info"
              />
            </Grid>
          )}

          {/* ── Preview panel ── */}
          {showPreview && (
            <Grid item xs={12} md={showSettings ? 8 : 12}>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PreviewIcon fontSize="small" />
                Print Preview
              </Typography>

              <Box
                sx={{
                  border: '1px solid #ddd',
                  borderRadius: 1,
                  p: 2,
                  bgcolor: '#f9f9f9',
                  maxHeight: '460px',
                  overflow: 'auto',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <Box
                  ref={printContentRef}
                  sx={{
                    width: layout === 'thermal' ? '280px' : '100%',
                    maxWidth: layout === 'thermal' ? '280px' : '100%',
                    transform: layout === 'thermal' ? 'none' : 'scale(0.9)',
                    transformOrigin: 'top center',
                    bgcolor: '#fff',
                    boxShadow: 1,
                  }}
                >
                  <div ref={printRef}>
                    <PrintLayout {...layoutProps} />
                  </div>
                </Box>
              </Box>
            </Grid>
          )}
        </Grid>

        {/* Print tips */}
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Print Tips:</strong><br />
            • <strong>Thermal</strong> — 80mm roll paper receipt<br />
            • <strong>Color / A4</strong> — full colour invoice on A4/Letter<br />
            • <strong>Item Sheet</strong> — quantities only, prices hidden (works with both layouts)
          </Typography>
        </Alert>
      </DialogContent>

      {/* ── Footer ── */}
      <DialogActions sx={{ px: 2, py: 1.5, gap: 1 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              size="small"
            />
          }
          label={
            <Typography variant="caption">Direct print (Don&apos;t show this dialog again)</Typography>
          }
          sx={{ mr: 'auto' }}
        />
        <Typography variant="caption" color="text.secondary">
          {isItemSheet
            ? '📋 Item sheet — prices hidden'
            : layout === 'thermal'
              ? '🖨️ Thermal 80mm'
              : '🖨️ Color / A4'}
        </Typography>
        <Button onClick={onClose} variant="outlined" size="small">Cancel</Button>
        <Button
          variant="contained"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
          size="small"
          sx={{ minWidth: 130 }}
        >
          Print Receipt
        </Button>
      </DialogActions>
    </Dialog>
  )
}