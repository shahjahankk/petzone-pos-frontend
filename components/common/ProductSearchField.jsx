'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { alpha, Box, Chip, CircularProgress, Paper, TextField, Typography, useTheme } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import InventoryIcon from '@mui/icons-material/Inventory'

const normalize = (value) => {
  if (value === null || value === undefined) return ''
  return String(value).toLowerCase()
}

const ProductSearchField = ({
  items = [],
  value = '',
  onChange,
  onSelect,
  selectedId = null,
  label = 'Search products',
  placeholder = 'Type product name, SKU, barcode, or category...',
  minQueryLength = 2,
  maxResults = 25,
  disabled = false,
  loading = false,
  helperText,
  noResultsText,
  sx
}) => {
  const theme = useTheme()
  const containerRef = useRef(null)
  const dropdownRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const selectedItem = useMemo(() => {
    if (selectedId === null || selectedId === undefined || selectedId === '') return null
    return items.find((item) => String(item.id) === String(selectedId)) || null
  }, [items, selectedId])

  const results = useMemo(() => {
    const trimmed = String(value || '').trim()
    if (trimmed.length < minQueryLength) return []
    const needle = normalize(trimmed)

    return items
      .filter((item) =>
        normalize(item.name).includes(needle) ||
        normalize(item.sku).includes(needle) ||
        normalize(item.barcode).includes(needle) ||
        normalize(item.category).includes(needle) ||
        normalize(item.description).includes(needle)
      )
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .slice(0, maxResults)
  }, [items, value, minQueryLength, maxResults])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  useEffect(() => {
    setHighlightedIndex(-1)
  }, [value])

  const selectResult = (item) => {
    if (onSelect) onSelect(item)
    setOpen(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (event) => {
    if (!open || results.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((previous) => {
        const next = previous < results.length - 1 ? previous + 1 : 0
        setTimeout(() => {
          const nodes = dropdownRef.current?.querySelectorAll('[data-search-item]')
          if (nodes && nodes[next]) nodes[next].scrollIntoView({ block: 'nearest' })
        }, 0)
        return next
      })
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((previous) => {
        const next = previous <= 0 ? results.length - 1 : previous - 1
        setTimeout(() => {
          const nodes = dropdownRef.current?.querySelectorAll('[data-search-item]')
          if (nodes && nodes[next]) nodes[next].scrollIntoView({ block: 'nearest' })
        }, 0)
        return next
      })
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      selectResult(results[highlightedIndex >= 0 ? highlightedIndex : 0])
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      setHighlightedIndex(-1)
    }
  }

  const displayValue = value || (selectedItem ? selectedItem.name : '')
  const trimmedValue = String(value || '').trim()

  return (
    <Box ref={containerRef} sx={{ position: 'relative', minWidth: 260, ...sx }}>
      <TextField
        fullWidth
        size="small"
        label={label}
        value={displayValue}
        disabled={disabled}
        onFocus={() => {
          if (!value && selectedItem && onChange) onChange('')
          setOpen(true)
        }}
        onChange={(event) => {
          if (onChange) onChange(event.target.value)
          setOpen(true)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        helperText={helperText}
        InputProps={{
          startAdornment: <SearchIcon sx={{ mr: 1, color: 'primary.main', fontSize: 18 }} />,
          endAdornment: loading ? <CircularProgress color="primary" size={18} /> : null,
          sx: { fontFamily: 'monospace', fontSize: '0.9rem' }
        }}
      />

      {open && results.length > 0 && (
        <Paper
          ref={dropdownRef}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1400,
            maxHeight: 300,
            overflowY: 'auto',
            mt: 1,
            boxShadow: 3,
            border: `1px solid ${theme.palette.divider}`
          }}
        >
          {results.map((item, index) => {
            const stock = item.currentStock ?? item.current_stock ?? item.stock ?? 0
            const price = item.sellingPrice ?? item.selling_price ?? item.price ?? item.defaultPrice ?? 0

            return (
              <Box
                key={item.id}
                data-search-item
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectResult(item)}
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  bgcolor: index === highlightedIndex ? alpha(theme.palette.primary.main, 0.15) : 'transparent',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
                  '&:last-child': { borderBottom: 'none' }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {item.name} — {price}
                  </Typography>
                  <Chip
                    size="small"
                    icon={<InventoryIcon sx={{ fontSize: '14px !important' }} />}
                    label="Product"
                    sx={{ height: 22, fontSize: '0.7rem' }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {`${item.category || 'Uncategorized'} · Stock: ${stock} ${item.unit || 'units'}`}
                </Typography>
              </Box>
            )
          })}
        </Paper>
      )}

      {open && trimmedValue.length >= minQueryLength && !loading && results.length === 0 && (
        <Paper
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1400,
            mt: 1,
            boxShadow: 3,
            border: `1px solid ${theme.palette.divider}`,
            p: 2,
            textAlign: 'center'
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {noResultsText || `No products found for "${trimmedValue}"`}
          </Typography>
        </Paper>
      )}
    </Box>
  )
}

export default ProductSearchField
