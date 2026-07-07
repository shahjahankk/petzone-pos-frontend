/**
 * Standalone Queue Management API client (queue-management.petzone.pk)
 * Separate from main POS backend API.
 */
import { config } from '../config/environment'

const QMS_BASE = (config.QMS_API_URL || 'http://localhost:4050/api').replace(/\/$/, '')

async function qmsRequest(path, options = {}) {
  const res = await fetch(`${QMS_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
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
