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

/** Detect brand from a logo URL / path. */
export function brandFromLogoUrl(logoUrl) {
  const u = String(logoUrl || '').toLowerCase()
  if (u.includes('petfamily')) return 'petfamily'
  if (u.includes('petzone')) return 'petzone'
  return 'petzone'
}

/**
 * Print logo sizes — PetFamily mark reads smaller at PetZone defaults, so enlarge it.
 * CSS sizes for browser / PrintLayout; dots for ESC/POS thermal.
 */
export function getPrintLogoSizes(logoUrlOrBrand) {
  const brand =
    logoUrlOrBrand === 'petfamily' || logoUrlOrBrand === 'petzone'
      ? logoUrlOrBrand
      : brandFromLogoUrl(logoUrlOrBrand)

  if (brand === 'petfamily') {
    return {
      brand,
      // Browser / HTML thermal receipt
      cssMaxWidth: '260px',
      cssWidth: '92%',
      // Color invoice layout
      colorMaxHeight: '110px',
      colorMaxWidth: '260px',
      // Thermal PrintLayout
      thermalMaxHeight: '100px',
      thermalMaxWidth: '220px',
      // ESC/POS raster (dots @ ~203dpi, 80mm ≈ 512)
      escPosWidth: 512,
      escPosHeight: 200,
    }
  }

  return {
    brand: 'petzone',
    cssMaxWidth: '200px',
    cssWidth: '70%',
    colorMaxHeight: '70px',
    colorMaxWidth: '160px',
    thermalMaxHeight: '60px',
    thermalMaxWidth: '120px',
    escPosWidth: 448,
    escPosHeight: 120,
  }
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
