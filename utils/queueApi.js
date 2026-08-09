/**
 * Standalone Queue Management API client (queue-management.petzone.pk)
 * Separate from main POS backend API.
 */
import { config } from '../config/environment'

const QMS_BASE = (
  config.QMS_API_URL || 'https://queue-management.petzone.pk/api'
).replace(/\/$/, '')

async function qmsRequest(path, options = {}) {
  const url = `${QMS_BASE}${path}`
  let res
  try {
    res = await fetch(url, {
      ...options,
      mode: 'cors',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
  } catch (error) {
    const err = new Error(
      `Queue server is unreachable (${QMS_BASE}). Check internet connection and reload the POS.`
    )
    err.cause = error
    throw err
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.message || 'Queue API request failed')
    err.response = { data }
    throw err
  }
  return data
}

export async function resolveQueueBranch(posBranchId) {
  const params = posBranchId ? `?posBranchId=${posBranchId}` : ''
  const json = await qmsRequest(`/queue/resolve${params}`)
  return json.data
}

export async function issueToken(orgSlug, branchSlug) {
  const json = await qmsRequest(`/queue/public/${orgSlug}/${branchSlug}/token`, { method: 'POST' })
  return json.data
}

/** @deprecated screen feature — later */
export async function getQueueStatus(orgSlug, branchSlug) {
  const json = await qmsRequest(`/queue/public/${orgSlug}/${branchSlug}/status`)
  return json.data
}
