import api from './axios'

export async function resolveQueueBranch() {
  const res = await api.get('/queue/resolve-branch')
  return res.data?.data
}

export async function getQueueBranchInfo(orgSlug, branchSlug) {
  const res = await api.get(`/queue/public/${orgSlug}/${branchSlug}`)
  return res.data?.data
}

export async function issueTicket(orgSlug, branchSlug, payload) {
  const res = await api.post(`/queue/public/${orgSlug}/${branchSlug}/tickets`, payload)
  return res.data?.data
}

export async function getQueueStatus(orgSlug, branchSlug) {
  const res = await api.get(`/queue/public/${orgSlug}/${branchSlug}/status`)
  return res.data?.data
}

export async function getWaitingQueue(orgSlug, branchSlug, serviceTypeId) {
  let url = `/queue/public/${orgSlug}/${branchSlug}/queue`
  if (serviceTypeId) url += `?service_type_id=${serviceTypeId}`
  const res = await api.get(url)
  return res.data?.data
}

export async function callNextTicket(orgSlug, branchSlug, payload = {}) {
  const res = await api.post(`/queue/public/${orgSlug}/${branchSlug}/call-next`, payload)
  return res.data
}

export async function updateTicketStatus(ticketId, status) {
  const res = await api.patch(`/queue/public/tickets/${ticketId}`, { status })
  return res.data?.data
}

export async function recallTicket(ticketId) {
  const res = await api.post(`/queue/public/tickets/${ticketId}/recall`)
  return res.data?.data
}

export async function getQueueStats(branchId) {
  const res = await api.get(`/queue/stats/${branchId}`)
  return res.data?.data
}

export async function listQueueBranches() {
  const res = await api.get('/queue/branches')
  return res.data?.data
}

export async function linkPosBranch(qmsBranchId, posBranchId) {
  const res = await api.patch(`/queue/branches/${qmsBranchId}/link-pos`, { pos_branch_id: posBranchId })
  return res.data
}
