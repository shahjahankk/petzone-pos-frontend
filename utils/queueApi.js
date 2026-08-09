/**
 * Standalone Queue Management API client (queue-management.petzone.pk)
 * Separate from main POS backend API.
 */
import { config } from '../config/environment'

const QMS_BASE = (
  config.QMS_API_URL || 'https://queue-management.petzone.pk/api'
).replace(/\/$/, '')
const QMS_ADMIN_TOKEN_KEY = 'qms_admin_token'

async function qmsRequest(path, options = {}) {
  const url = `${QMS_BASE}${path}`
  const adminToken =
    typeof window !== 'undefined' ? window.localStorage.getItem(QMS_ADMIN_TOKEN_KEY) : null
  let res
  try {
    res = await fetch(url, {
      ...options,
      mode: 'cors',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
        ...options.headers,
      },
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

/** Issue a token for a specific service (e.g. Grooming → G001). */
export async function issueServiceTicket(orgSlug, branchSlug, serviceTypeId, extras = {}) {
  const json = await qmsRequest(`/queue/public/${orgSlug}/${branchSlug}/tickets`, {
    method: 'POST',
    body: JSON.stringify({
      service_type_id: serviceTypeId,
      ...extras,
    }),
  })
  return json.data
}

export async function getQueueCounters(orgSlug, branchSlug) {
  const json = await qmsRequest(`/queue/public/${orgSlug}/${branchSlug}/counters`)
  return json.data
}

export function hasQueueAdminSession() {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.localStorage.getItem(QMS_ADMIN_TOKEN_KEY))
  )
}

export function clearQueueAdminSession() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(QMS_ADMIN_TOKEN_KEY)
  }
}

export async function queueAdminLogin(email, password) {
  const json = await qmsRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!json.token) throw new Error('Queue admin login did not return a token')
  window.localStorage.setItem(QMS_ADMIN_TOKEN_KEY, json.token)
  return json.user
}

export async function getQueueSequence(branchId) {
  const json = await qmsRequest(`/admin/branches/${branchId}/sequence`)
  return json.data
}

export async function setQueueNextNumber(branchId, nextNumber) {
  return qmsRequest(`/admin/branches/${branchId}/sequence`, {
    method: 'PATCH',
    body: JSON.stringify({ next_number: nextNumber }),
  })
}

export async function resetQueueToday(branchId) {
  return qmsRequest(`/admin/branches/${branchId}/sequence/today`, {
    method: 'DELETE',
  })
}

/** @deprecated screen feature — later */
export async function getQueueStatus(orgSlug, branchSlug) {
  const json = await qmsRequest(`/queue/public/${orgSlug}/${branchSlug}/status`)
  return json.data
}

export async function getQueueBranchInfo(orgSlug, branchSlug) {
  const json = await qmsRequest(`/queue/public/${orgSlug}/${branchSlug}`)
  return json.data
}

export async function getWaitingQueue(orgSlug, branchSlug, serviceTypeId) {
  const query = serviceTypeId ? `?service_type_id=${encodeURIComponent(serviceTypeId)}` : ''
  const json = await qmsRequest(`/queue/public/${orgSlug}/${branchSlug}/queue${query}`)
  return json.data
}

export async function callNextTicket(orgSlug, branchSlug, payload = {}) {
  return qmsRequest(`/queue/public/${orgSlug}/${branchSlug}/call-next`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateTicketStatus(ticketId, status) {
  const json = await qmsRequest(`/queue/public/tickets/${ticketId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return json.data
}

export async function recallTicket(ticketId) {
  const json = await qmsRequest(`/queue/public/tickets/${ticketId}/recall`, {
    method: 'POST',
  })
  return json.data
}
