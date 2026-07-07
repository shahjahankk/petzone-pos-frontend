import { Suspense } from 'react'
import QueueDisplayInner from './QueueDisplayInner'

export default function QueueDisplayPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading display...</div>}>
      <QueueDisplayInner />
    </Suspense>
  )
}
