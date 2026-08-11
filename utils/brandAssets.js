/** Same branding assets as petzone-pos-frontend (login, receipts, invoices). */
export const PETZONE_LOGO_PNG = '/petzonelogo.png'
export const PETFAMILY_LOGO_PNG = '/petfamilylogo.png'

export const BRAND_LOGOS = {
  petzone: PETZONE_LOGO_PNG,
  petfamily: PETFAMILY_LOGO_PNG,
}

export const BRAND_OPTIONS = [
  { value: 'petzone', label: 'PetZone Logo' },
  { value: 'petfamily', label: 'PetFamily Logo' },
]

export function normalizeBrand(brand) {
  const key = String(brand || 'petzone').toLowerCase().trim()
  return BRAND_LOGOS[key] ? key : 'petzone'
}

/** Prefer PNG brand mark for print + UI. */
export function resolvePetzoneLogoUrl(origin = '') {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '')
  return base ? `${base}${PETZONE_LOGO_PNG}` : PETZONE_LOGO_PNG
}

export function resolveBrandLogoUrl(brand, origin = '') {
  const path = BRAND_LOGOS[normalizeBrand(brand)] || PETZONE_LOGO_PNG
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '')
  return base ? `${base}${path}` : path
}

export function resolveLogoPathFromEntity(entity) {
  if (!entity) return PETZONE_LOGO_PNG
  if (entity.logoUrl) return entity.logoUrl
  const brand = entity.brand || entity.settings?.brand
  return BRAND_LOGOS[normalizeBrand(brand)] || PETZONE_LOGO_PNG
}
