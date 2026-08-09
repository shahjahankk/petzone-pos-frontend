import { Suspense } from 'react'
import { Cormorant_Garamond, Manrope, Outfit } from 'next/font/google'
import QueueDisplayInner from './QueueDisplayInner'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  display: 'swap',
})

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
})

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
})

export default function QueueDisplayPage() {
  return (
    <div className={`${manrope.className} ${outfit.variable} ${display.variable}`}>
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Loading display...</div>}>
        <QueueDisplayInner />
      </Suspense>
    </div>
  )
}
