/**
 * Queue call/recall announcements for Smart TV displays.
 *
 * Smart TVs usually:
 * - Have no speechSynthesis voices
 * - Block NEW <audio> after the first click
 * - Still allow Web Audio after one unlock click (that's why the chime works)
 *
 * So we fetch free MP3 speech and play it through an unlocked AudioContext.
 * Concurrent OPD calls are played FIFO (one after another).
 */

let sharedContext = null
let unlockGain = null

const announcementFifo = []
let fifoRunning = false

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null
  if (!sharedContext || sharedContext.state === 'closed') {
    sharedContext = new AudioContextClass()
  }
  return sharedContext
}

/** Must be called from a user tap/click on the TV (Enable Sound). */
export async function unlockQueueAudio() {
  const context = getAudioContext()
  if (!context) return false
  try {
    if (context.state === 'suspended') await context.resume()
    // Silent buffer keeps the TV audio pipeline unlocked for later calls
    const buffer = context.createBuffer(1, 1, context.sampleRate || 22050)
    const source = context.createBufferSource()
    source.buffer = buffer
    unlockGain = context.createGain()
    unlockGain.gain.value = 0.001
    source.connect(unlockGain)
    unlockGain.connect(context.destination)
    source.start(0)
    return true
  } catch {
    return false
  }
}

export function playQueueChime() {
  try {
    const context = getAudioContext()
    if (!context) return
    if (context.state === 'suspended') context.resume().catch(() => {})
    const gain = context.createGain()
    gain.connect(context.destination)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.7)
    ;[660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      oscillator.frequency.value = frequency
      oscillator.connect(gain)
      oscillator.start(context.currentTime + index * 0.18)
      oscillator.stop(context.currentTime + 0.38 + index * 0.18)
    })
  } catch {
    /* ignore */
  }
}

async function fetchSpeechBuffer(text, ttsBaseUrl) {
  const phrase = String(text || '').trim().slice(0, 160)
  if (!phrase) return null
  const encoded = encodeURIComponent(phrase)
  const base = String(ttsBaseUrl || '').replace(/\/$/, '')

  const candidates = []
  if (base) candidates.push(`${base}/queue/public/announce-tts?text=${encoded}`)
  candidates.push(
    `https://api.streamelements.com/kappa/v2/speech?voice=Brian&text=${encoded}`
  )
  candidates.push(
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encoded}`
  )

  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: 'no-store', mode: 'cors' })
      if (!res.ok) continue
      const contentType = String(res.headers.get('content-type') || '')
      if (contentType.includes('json') || contentType.includes('text/html')) continue
      const data = await res.arrayBuffer()
      if (!data || data.byteLength < 200) continue
      return data
    } catch {
      /* try next */
    }
  }
  return null
}

async function playArrayBuffer(arrayBuffer) {
  const context = getAudioContext()
  if (!context || !arrayBuffer) return false
  try {
    if (context.state === 'suspended') await context.resume()
    const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0))
    const source = context.createBufferSource()
    const gain = context.createGain()
    gain.gain.value = 1
    source.buffer = audioBuffer
    source.connect(gain)
    gain.connect(context.destination)
    source.start(0)
    await new Promise((resolve) => {
      source.onended = resolve
      setTimeout(resolve, Math.ceil((audioBuffer.duration || 4) * 1000) + 400)
    })
    return true
  } catch {
    return false
  }
}

function speakWithBrowser(text) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve(false)
      return
    }
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.88
      utterance.pitch = 1
      utterance.volume = 1
      utterance.onend = () => resolve(true)
      utterance.onerror = () => resolve(false)
      window.speechSynthesis.speak(utterance)
    } catch {
      resolve(false)
    }
  })
}

async function speakQueueTextNow(text, options = {}) {
  const phrase = String(text || '').trim().slice(0, 160)
  if (!phrase) return false

  await unlockQueueAudio()

  const buffer = await fetchSpeechBuffer(phrase, options.ttsBaseUrl)
  if (buffer) {
    const ok = await playArrayBuffer(buffer)
    if (ok) return true
  }

  return speakWithBrowser(phrase)
}

/**
 * Speak immediately (used by Enable Sound test). Prefer enqueue for calls.
 */
export async function speakQueueText(text, options = {}) {
  return speakQueueTextNow(text, options)
}

export function buildCallAnnouncement({ ticketCode, counterLabel, isRecall = false }) {
  const number = ticketCode || 'unknown'
  const counter = counterLabel || 'the counter'
  const prefix = isRecall ? 'Recall. ' : ''
  return `${prefix}Token number ${number}, please proceed to ${counter}.`
}

async function runFifo() {
  if (fifoRunning) return
  fifoRunning = true
  while (announcementFifo.length > 0) {
    const job = announcementFifo.shift()
    try {
      playQueueChime()
      await new Promise((r) => setTimeout(r, 550))
      await speakQueueTextNow(job.text, { ttsBaseUrl: job.ttsBaseUrl })
      // Short gap so next station announcement is clear
      await new Promise((r) => setTimeout(r, 350))
    } catch {
      /* keep draining queue */
    }
  }
  fifoRunning = false
}

/**
 * Enqueue Call/Recall announcement (FIFO). Multiple stations never overlap.
 */
export function announceQueueCall(row, { isRecall = false, ttsBaseUrl } = {}) {
  const number = row?.ticket_code
    ? String(row.ticket_code).replace(/^[A-Za-z]+/, '') || row.ticket_code
    : null
  if (!number) return Promise.resolve(false)

  const text = buildCallAnnouncement({
    ticketCode: number,
    counterLabel: row.counter_label || row.counter_name || row.service_name,
    isRecall,
  })

  // Deduplicate exact same announcement already waiting at the end
  const last = announcementFifo[announcementFifo.length - 1]
  if (last && last.text === text) {
    return Promise.resolve(true)
  }

  announcementFifo.push({ text, ttsBaseUrl })
  return runFifo().then(() => true)
}
