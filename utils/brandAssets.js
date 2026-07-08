/** Same branding assets as petzone-pos-frontend (login, receipts, invoices). */
export const PETZONE_LOGO_PNG = '/petzonelogo.png'
export const PETZONE_LOGO_SVG = '/petzonelogo.svg'

export function resolvePetzoneLogoUrl(origin = '') {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '')
  return base ? `${base}${PETZONE_LOGO_PNG}` : PETZONE_LOGO_PNG
}
