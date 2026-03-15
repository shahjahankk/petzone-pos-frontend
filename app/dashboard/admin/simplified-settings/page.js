'use client'

import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Switch, FormControlLabel,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, Alert, CircularProgress, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, Tabs, Tab,
  IconButton, Tooltip, AlertTitle, TextField, Divider
} from '@mui/material';
import { Business, Warehouse, Edit, Settings, Refresh, CheckCircle, Info, Close as CloseIcon } from '@mui/icons-material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import api from '../../../../utils/axios';
import RouteGuard from '../../../../components/auth/RouteGuard';
import DashboardLayout from '../../../../components/layout/DashboardLayout';
import withAuth from '../../../../components/auth/withAuth';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// ── Reusable: renders a section of settings cards ─────────────────────────────
function SettingsSection({ title, settings, editingSettings, onToggle, onNumber }) {
  return (
    <Box sx={{ mb: 3 }}>
      {/* Section header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, fontSize: '0.72rem', letterSpacing: 1.2, color: 'text.secondary' }}
        >
          {title}
        </Typography>
        <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
      </Box>

      {/* Cards grid — always starts fresh, no bleed from previous section */}
      <Grid container spacing={2}>
        {settings.map((setting) => (
          <Grid item xs={12} sm={6} key={setting.key}>
            <Card
              variant="outlined"
              sx={{
                height: '100%',
                borderColor: setting.icon === 'whatsapp' ? '#25D366' : 'divider',
                borderWidth: setting.icon === 'whatsapp' ? 2 : 1,
                borderRadius: 2,
                transition: 'box-shadow .15s',
                '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                {setting.type === 'switch' ? (
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
                        {setting.icon === 'whatsapp' && (
                          <WhatsAppIcon sx={{ fontSize: 15, color: '#25D366' }} />
                        )}
                        <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                          {setting.label}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4, display: 'block' }}>
                        {setting.description}
                      </Typography>
                    </Box>
                    <Switch
                      checked={Boolean(editingSettings[setting.key])}
                      onChange={onToggle(setting.key)}
                      color={setting.icon === 'whatsapp' ? 'success' : 'primary'}
                      size="small"
                      sx={{ flexShrink: 0, mt: 0.3 }}
                    />
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>{setting.label}</Typography>
                    <TextField
                      type="number"
                      value={editingSettings[setting.key] || ''}
                      onChange={onNumber(setting.key)}
                      size="small"
                      fullWidth
                      helperText={setting.description}
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

// ── Build grouped sections from a flat settingsConfig array ──────────────────
function groupSettings(config) {
  const groups = []
  let current = null
  config.forEach((item) => {
    if (item.type === 'section') {
      current = { title: item.section, settings: [] }
      groups.push(current)
    } else if (current) {
      current.settings.push(item)
    }
  })
  return groups
}

// ==================== BRANCH SETTINGS ====================
const SimplifiedBranchSettings = ({ branches, onBranchesChange }) => {
  const [error, setError] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState({});
  const [changedSettings, setChangedSettings] = useState({});
  const [saving, setSaving] = useState(false);

  const loadBranchSettings = async (branchId) => {
    const response = await api.get(`/branches/${branchId}/settings`);
    return response.data.data.settings;
  };

  const handleEditSettings = async (branch) => {
    setSelectedBranch(branch);
    setChangedSettings({});
    try {
      const settings = await loadBranchSettings(branch.id);
      setEditingSettings(settings);
      setSettingsDialogOpen(true);
    } catch (err) {
      setError('Failed to load branch settings. Please try again.');
    }
  };

  const handleSettingChange = (key) => (event) => {
    const newValue = event.target.checked;
    setEditingSettings(prev => ({ ...prev, [key]: newValue }));
    setChangedSettings(prev => ({ ...prev, [key]: newValue }));
  };

  const handleNumberChange = (key) => (event) => {
    const value = parseFloat(event.target.value) || 0;
    setEditingSettings(prev => ({ ...prev, [key]: value }));
    setChangedSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    if (!selectedBranch) return;
    if (Object.keys(changedSettings).length === 0) { setSettingsDialogOpen(false); return; }
    setSaving(true);
    try {
      await api.put(`/branches/${selectedBranch.id}/settings`, { settings: editingSettings });
      const refreshResponse = await api.get('/branches');
      onBranchesChange(refreshResponse.data.data || []);
      setChangedSettings({});
      setSettingsDialogOpen(false);
      setError(null);
    } catch (err) {
      setError('Failed to save branch settings');
    } finally {
      setSaving(false);
    }
  };

  const getSettingsSummary = (branch) => {
    const settings = branch.settings || {};
    const enabled = Object.values(settings).filter(Boolean).length;
    const total = Object.keys(settings).length;
    const percentage = total > 0 ? Math.round((enabled / total) * 100) : 0;
    return { enabled, total, percentage };
  };

  const settingsConfig = [
    { type: 'section', section: 'Cashier Permissions' },
    { key: 'allowCashierInventoryAdd',  label: 'Allow Inventory Add',  description: 'Cashiers can add NEW inventory items',                      type: 'switch' },
    { key: 'allowCashierInventoryEdit', label: 'Allow Inventory Edit', description: 'Cashiers can EDIT existing inventory items',                 type: 'switch' },
    { key: 'allowCashierReturns',       label: 'Allow Returns',        description: 'Cashiers can process returns',                              type: 'switch' },
    { key: 'allowCashierCustomers',     label: 'Allow Customers',      description: 'Cashiers can manage customers',                             type: 'switch' },
    { key: 'allowCashierPOS',           label: 'Allow POS',            description: 'Cashiers can use the POS system',                           type: 'switch' },
    { key: 'allowCashierLedger',        label: 'Allow Ledger',         description: 'Cashiers can access the ledger',                            type: 'switch' },
    { key: 'openAccountSystem',         label: 'Open Account System',  description: 'Enable open account functionality',                         type: 'switch' },

    { type: 'section', section: 'Sales Permissions' },
    { key: 'allowCashierSalesEdit',   label: 'Allow Sales Edit',   description: 'Cashiers can edit invoices — when OFF, view only',           type: 'switch' },
    { key: 'allowCashierSalesDelete', label: 'Allow Sales Delete', description: 'Cashiers can delete sales — when OFF, delete button hidden',  type: 'switch' },

    { type: 'section', section: 'Customer Management' },
    { key: 'allowCashierCustomerEdit', label: 'Allow Customer Edit',         description: 'Cashiers can edit customer name and phone number',                                    type: 'switch' },
    { key: 'allowWhatsappLedger',      label: 'Allow WhatsApp Ledger Share', description: 'Cashiers can share full detailed customer ledger via WhatsApp', type: 'switch', icon: 'whatsapp' },

    { type: 'section', section: 'Company Management' },
    { key: 'allowCompanyCreate', label: 'Allow Company Creation', description: 'Branch users can add new companies',      type: 'switch' },
    { key: 'allowCompanyEdit',   label: 'Allow Company Edit',     description: 'Branch users can edit existing companies', type: 'switch' },
    { key: 'allowCompanyDelete', label: 'Allow Company Delete',   description: 'Branch users can delete companies',        type: 'switch' },

    { type: 'section', section: 'Transfer Settings' },
    { key: 'allowBranchTransfers',               label: 'Allow Branch Transfers',              description: 'Allow transfers from this branch',                      type: 'switch' },
    { key: 'allowBranchToBranchTransfers',        label: 'Branch → Branch Transfers',           description: 'Allow transfers from branch to other branches',         type: 'switch' },
    { key: 'allowBranchToWarehouseTransfers',     label: 'Branch → Warehouse Transfers',        description: 'Allow transfers from branch to warehouse',              type: 'switch' },
    { key: 'requireApprovalForBranchTransfers',   label: 'Require Approval',                    description: 'Require admin approval for branch transfers',           type: 'switch' },
    { key: 'maxTransferAmount',                   label: 'Maximum Transfer Amount',             description: 'Maximum amount allowed for a single transfer',          type: 'number' },
  ];

  const sections = groupSettings(settingsConfig);
  const changedCount = Object.keys(changedSettings).length;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Business sx={{ fontSize: 26, color: 'primary.main' }} />
          <Typography variant="h5" fontWeight={700}>Branch Settings</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Configure cashier permissions for each branch.{' '}
          <strong>View (👁) is always visible</strong> — Edit and Delete are toggled separately.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 700 }}>Branch</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Settings Enabled</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {branches.map((branch) => {
              const summary = getSettingsSummary(branch);
              return (
                <TableRow key={branch.id} hover>
                  <TableCell><Typography fontWeight={600}>{branch.name}</Typography></TableCell>
                  <TableCell><Chip label={branch.code} size="small" variant="outlined" /></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ flex: 1, maxWidth: 120, height: 6, bgcolor: 'grey.200', borderRadius: 3, overflow: 'hidden' }}>
                        <Box sx={{ width: `${summary.percentage}%`, height: '100%', bgcolor: 'primary.main', borderRadius: 3 }} />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {summary.enabled}/{summary.total}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Button variant="outlined" size="small" startIcon={<Edit />} onClick={() => handleEditSettings(branch)}>
                      Edit Settings
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Settings Dialog ── */}
      <Dialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, maxHeight: '90vh' } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ bgcolor: 'primary.main', borderRadius: 1.5, p: 0.8, display: 'flex' }}>
                <Settings sx={{ fontSize: 20, color: 'white' }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700}>{selectedBranch?.name}</Typography>
                <Typography variant="caption" color="text.secondary">Branch Settings</Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={() => setSettingsDialogOpen(false)}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>

        <Divider />

        {/* Changed count banner */}
        {changedCount > 0 && (
          <Box sx={{ px: 3, pt: 1.5 }}>
            <Alert severity="warning" sx={{ py: 0.5 }}>
              {changedCount} unsaved change{changedCount !== 1 ? 's' : ''} — click Save Settings to apply.
            </Alert>
          </Box>
        )}

        <Box sx={{ px: 3, pt: 1.5 }}>
          <Alert severity="info" sx={{ py: 0.5, fontSize: '0.8rem' }}>
            👁 <strong>View</strong> — always visible &nbsp;|&nbsp;
            ✏️ <strong>Edit</strong> — controlled by &quot;Allow Sales Edit&quot; &nbsp;|&nbsp;
            🗑 <strong>Delete</strong> — controlled by &quot;Allow Sales Delete&quot;
          </Alert>
        </Box>

        <DialogContent sx={{ pt: 2 }}>
          {sections.map((section) => (
            <SettingsSection
              key={section.title}
              title={section.title}
              settings={section.settings}
              editingSettings={editingSettings}
              onToggle={handleSettingChange}
              onNumber={handleNumberChange}
            />
          ))}
        </DialogContent>

        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setSettingsDialogOpen(false)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveSettings}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <CheckCircle />}
            sx={{ minWidth: 140 }}
          >
            {saving ? 'Saving…' : `Save Settings${changedCount > 0 ? ` (${changedCount})` : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ==================== WAREHOUSE SETTINGS ====================
const SimplifiedWarehouseSettings = ({ warehouses, onWarehousesChange }) => {
  const [error, setError] = useState(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState({});
  const [changedSettings, setChangedSettings] = useState({});
  const [saving, setSaving] = useState(false);

  const loadWarehouseSettings = async (warehouseId) => {
    const response = await api.get(`/warehouses/${warehouseId}/settings`);
    return response.data.data.settings;
  };

  const handleEditSettings = async (warehouse) => {
    setSelectedWarehouse(warehouse);
    setChangedSettings({});
    try {
      const settings = await loadWarehouseSettings(warehouse.id);
      setEditingSettings(settings);
      setSettingsDialogOpen(true);
    } catch (err) {
      setError('Failed to load warehouse settings. Please try again.');
    }
  };

  const handleSettingChange = (key) => (event) => {
    const newValue = event.target.checked;
    setEditingSettings(prev => ({ ...prev, [key]: newValue }));
    setChangedSettings(prev => ({ ...prev, [key]: newValue }));
  };

  const handleNumberChange = (key) => (event) => {
    const value = parseFloat(event.target.value) || 0;
    setEditingSettings(prev => ({ ...prev, [key]: value }));
    setChangedSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    if (!selectedWarehouse) return;
    if (Object.keys(changedSettings).length === 0) { setSettingsDialogOpen(false); return; }
    setSaving(true);
    try {
      const { allowWarehouseCompanyCRUD, allowWarehouseRetailerCRUD, ...settingsToSave } = editingSettings;
      await api.put(`/warehouses/${selectedWarehouse.id}/settings`, { settings: settingsToSave });
      const refreshResponse = await api.get('/warehouses');
      onWarehousesChange(refreshResponse.data.data || []);
      setChangedSettings({});
      setSettingsDialogOpen(false);
      setError(null);
    } catch (err) {
      setError('Failed to save warehouse settings');
    } finally {
      setSaving(false);
    }
  };

  const getSettingsSummary = (warehouse) => {
    const settings = warehouse.settings || {};
    const enabled = Object.values(settings).filter(Boolean).length;
    const total = Object.keys(settings).length;
    const percentage = total > 0 ? Math.round((enabled / total) * 100) : 0;
    return { enabled, total, percentage };
  };

  const settingsConfig = [
    { type: 'section', section: 'Basic Warehouse Operations' },
    { key: 'allowWarehouseInventoryAdd',  label: 'Allow Inventory Add',  description: 'Warehouse keepers can add NEW inventory items',      type: 'switch' },
    { key: 'allowWarehouseInventoryEdit', label: 'Allow Inventory Edit', description: 'Warehouse keepers can EDIT existing inventory items', type: 'switch' },
    { key: 'allowWarehouseReturns',       label: 'Allow Returns',        description: 'Warehouse keepers can process returns',              type: 'switch' },
    { key: 'allowWarehouseLedgerEdit',    label: 'Allow Ledger Edit',    description: 'Enable warehouse keeper to edit ledger accounts',    type: 'switch' },
    { key: 'requireApprovalForTransfers', label: 'Require Approval for Transfers', description: 'Transfers need approval before processing', type: 'switch' },
    { key: 'autoStockAlerts',             label: 'Auto Stock Alerts',    description: 'Enable automatic stock level alerts',                type: 'switch' },

    { type: 'section', section: 'Sales Permissions' },
    { key: 'allowWarehouseSalesEdit',   label: 'Allow Sales Edit',   description: 'Warehouse keepers can edit invoices — when OFF, view only',          type: 'switch' },
    { key: 'allowWarehouseSalesDelete', label: 'Allow Sales Delete', description: 'Warehouse keepers can delete sales — when OFF, delete button hidden', type: 'switch' },

    { type: 'section', section: 'Company Management' },
    { key: 'allowCompanyCreate', label: 'Allow Company Creation', description: 'Warehouse keepers can add new companies',            type: 'switch' },
    { key: 'allowCompanyEdit',   label: 'Allow Company Edit',     description: 'Warehouse keepers can edit existing companies',       type: 'switch' },
    { key: 'allowCompanyDelete', label: 'Allow Company Delete',   description: 'Warehouse keepers can delete companies',              type: 'switch' },

    { type: 'section', section: 'Retailer Management' },
    { key: 'allowRetailerCreate',       label: 'Allow Retailer Creation',      description: 'Warehouse keepers can add new retailers',                    type: 'switch' },
    { key: 'allowRetailerEdit',         label: 'Allow Retailer Edit',          description: 'Warehouse keepers can edit existing retailers',               type: 'switch' },
    { key: 'allowRetailerDelete',       label: 'Allow Retailer Delete',        description: 'Warehouse keepers can delete retailers',                      type: 'switch' },
    { key: 'allowRetailerCustomerEdit', label: 'Allow Retailer/Customer Edit', description: 'Warehouse keepers can edit retailer and customer name/phone', type: 'switch' },
    { key: 'allowWhatsappLedger',       label: 'Allow WhatsApp Ledger Share',  description: 'Warehouse keepers can share full customer ledger via WhatsApp', type: 'switch', icon: 'whatsapp' },

    { type: 'section', section: 'Transfer Settings' },
    { key: 'allowWarehouseTransfers',              label: 'Allow Warehouse Transfers',         description: 'Allow transfers from this warehouse',                type: 'switch' },
    { key: 'allowWarehouseToWarehouseTransfers',   label: 'Warehouse → Warehouse Transfers',   description: 'Allow transfers from warehouse to other warehouses', type: 'switch' },
    { key: 'allowWarehouseToBranchTransfers',      label: 'Warehouse → Branch Transfers',      description: 'Allow transfers from warehouse to branch',           type: 'switch' },
    { key: 'requireApprovalForWarehouseTransfers', label: 'Require Approval',                  description: 'Require admin approval for warehouse transfers',     type: 'switch' },
    { key: 'autoApproveSmallTransfers',            label: 'Auto-Approve Small Transfers',      description: 'Auto-approve transfers under the threshold amount',  type: 'switch' },
    { key: 'maxTransferAmount',        label: 'Maximum Transfer Amount',   description: 'Maximum amount allowed for a single transfer', type: 'number' },
    { key: 'smallTransferThreshold',   label: 'Small Transfer Threshold',  description: 'Amount threshold for auto-approval',           type: 'number' },
  ];

  const sections = groupSettings(settingsConfig);
  const changedCount = Object.keys(changedSettings).length;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Warehouse sx={{ fontSize: 26, color: 'primary.main' }} />
          <Typography variant="h5" fontWeight={700}>Warehouse Settings</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Configure granular permissions for warehouse keepers.{' '}
          <strong>View (👁) is always visible</strong> — Edit and Delete are toggled separately.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 700 }}>Warehouse</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Settings Enabled</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {warehouses.map((warehouse) => {
              const summary = getSettingsSummary(warehouse);
              return (
                <TableRow key={warehouse.id} hover>
                  <TableCell><Typography fontWeight={600}>{warehouse.name}</Typography></TableCell>
                  <TableCell><Chip label={warehouse.code} size="small" variant="outlined" /></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ flex: 1, maxWidth: 120, height: 6, bgcolor: 'grey.200', borderRadius: 3, overflow: 'hidden' }}>
                        <Box sx={{ width: `${summary.percentage}%`, height: '100%', bgcolor: 'primary.main', borderRadius: 3 }} />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {summary.enabled}/{summary.total}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Button variant="outlined" size="small" startIcon={<Edit />} onClick={() => handleEditSettings(warehouse)}>
                      Edit Settings
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Settings Dialog ── */}
      <Dialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        maxWidth="md" fullWidth
        PaperProps={{ sx: { borderRadius: 3, maxHeight: '90vh' } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ bgcolor: 'secondary.main', borderRadius: 1.5, p: 0.8, display: 'flex' }}>
                <Settings sx={{ fontSize: 20, color: 'white' }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700}>{selectedWarehouse?.name}</Typography>
                <Typography variant="caption" color="text.secondary">Warehouse Settings</Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={() => setSettingsDialogOpen(false)}><CloseIcon /></IconButton>
          </Box>
        </DialogTitle>

        <Divider />

        {changedCount > 0 && (
          <Box sx={{ px: 3, pt: 1.5 }}>
            <Alert severity="warning" sx={{ py: 0.5 }}>
              {changedCount} unsaved change{changedCount !== 1 ? 's' : ''} — click Save Settings to apply.
            </Alert>
          </Box>
        )}

        <Box sx={{ px: 3, pt: 1.5 }}>
          <Alert severity="info" sx={{ py: 0.5, fontSize: '0.8rem' }}>
            👁 <strong>View</strong> — always visible &nbsp;|&nbsp;
            ✏️ <strong>Edit</strong> — controlled by &quot;Allow Sales Edit&quot; &nbsp;|&nbsp;
            🗑 <strong>Delete</strong> — controlled by &quot;Allow Sales Delete&quot;
          </Alert>
        </Box>

        <DialogContent sx={{ pt: 2 }}>
          {sections.map((section) => (
            <SettingsSection
              key={section.title}
              title={section.title}
              settings={section.settings}
              editingSettings={editingSettings}
              onToggle={handleSettingChange}
              onNumber={handleNumberChange}
            />
          ))}
        </DialogContent>

        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setSettingsDialogOpen(false)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveSettings}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <CheckCircle />}
            sx={{ minWidth: 140 }}
          >
            {saving ? 'Saving…' : `Save Settings${changedCount > 0 ? ` (${changedCount})` : ''}`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ==================== MAIN PAGE ====================
const SimplifiedSettingsPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [branches, setBranches] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const [branchesRes, warehousesRes] = await Promise.all([
        api.get('/branches'),
        api.get('/warehouses')
      ]);
      setBranches(branchesRes.data.data || []);
      setWarehouses(warehousesRes.data.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { handleRefresh(); }, []);

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <Box sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ bgcolor: 'primary.main', borderRadius: 2, p: 1, display: 'flex' }}>
                  <Settings sx={{ fontSize: 26, color: 'white' }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight={800}>System Settings</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Configure granular permissions for branches and warehouses
                  </Typography>
                </Box>
              </Box>
              <Tooltip title="Refresh">
                <IconButton onClick={handleRefresh} disabled={loading} sx={{ border: '1px solid', borderColor: 'divider' }}>
                  {loading ? <CircularProgress size={20} /> : <Refresh />}
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip icon={<CheckCircle />} label="Granular Permissions" color="success" variant="outlined" size="small" />
              <Chip icon={<Info />} label={`${branches.length} Branches · ${warehouses.length} Warehouses`} color="info" variant="outlined" size="small" />
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              <AlertTitle>Error</AlertTitle>{error}
            </Alert>
          )}

          <Paper sx={{ width: '100%', borderRadius: 2 }} variant="outlined">
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ px: 2 }}>
                <Tab icon={<Business />} iconPosition="start" label="Branch Settings" />
                <Tab icon={<Warehouse />} iconPosition="start" label="Warehouse Settings" />
              </Tabs>
            </Box>
            <TabPanel value={activeTab} index={0}>
              <SimplifiedBranchSettings branches={branches} onBranchesChange={setBranches} />
            </TabPanel>
            <TabPanel value={activeTab} index={1}>
              <SimplifiedWarehouseSettings warehouses={warehouses} onWarehousesChange={setWarehouses} />
            </TabPanel>
          </Paper>
        </Box>
      </DashboardLayout>
    </RouteGuard>
  );
};

export default withAuth(SimplifiedSettingsPage);