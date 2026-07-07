'use client'

import React from 'react'
import { Box, Typography, Card, CardContent, Button } from '@mui/material'
import { ConfirmationNumber, Print } from '@mui/icons-material'
import withAuth from '../../../components/auth/withAuth'
import RouteGuard from '../../../components/auth/RouteGuard'
import DashboardLayout from '../../../components/layout/DashboardLayout'

function QueueDashboardPage() {
  return (
    <DashboardLayout>
      <Box sx={{ p: 3, maxWidth: 480 }}>
        <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
          Clinic Queue
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Print queue tokens with plain numbers (28, 29, 30…). TV display will be added later.
        </Typography>
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <ConfirmationNumber sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>Print Queue Token</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              PetZone logo + number on thermal slip
            </Typography>
            <Button variant="contained" size="large" href="/queue/kiosk" startIcon={<Print />}>
              Open Token Printer
            </Button>
          </CardContent>
        </Card>
      </Box>
    </DashboardLayout>
  )
}

export default withAuth(() => (
  <RouteGuard allowedRoles={['ADMIN', 'CASHIER']}>
    <QueueDashboardPage />
  </RouteGuard>
))
