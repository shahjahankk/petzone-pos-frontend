/**
 * Queue call/recall announcements for display screens.
 * Smart TVs usually lack speechSynthesis, so we play free MP3 speech
 * from the QMS same-origin TTS proxy (falls back to Google Translate TTS).
 */

let activeAudio = null

export function playQueueChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const context = new AudioContextClass()
    const gain = context.createGain()
    gain.connect(context.destination)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.65)
    ;[660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      oscillator.frequency.value = frequency
      oscillator.connect(gain)
      oscillator.start(context.currentTime + index * 0.18)
      oscillator.stop(context.currentTime + 0.35 + index * 0.18)
    })
    setTimeout(() => context.close().catch(() => {}), 900)
  } catch {
    /* ignore */
  }
}

function stopActiveAudio() {
  if (activeAudio) {
    try {
      activeAudio.pause()
      activeAudio.src = ''
    } catch {
      /* ignore */
    }
    activeAudio = null
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}

function playAudioUrl(url) {
  return new Promise((resolve) => {
    stopActiveAudio()
    const audio = new Audio(url)
    activeAudio = audio
    audio.preload = 'auto'
    audio.onended = () => resolve(true)
    audio.onerror = () => resolve(false)
    const playPromise = audio.play()
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.catch(() => resolve(false))
    }
  })
}

function speakWithBrowser(text) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve(false)
      return
    }
    try {
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

/**
 * Speak text on Smart TVs / kiosks using free MP3 speech.
 * @param {string} text
 * @param {{ ttsBaseUrl?: string }} options - QMS API base ending with /api
 */
export async function speakQueueText(text, options = {}) {
  const phrase = String(text || '').trim().slice(0, 160)
  if (!phrase) return false

  const base = String(options.ttsBaseUrl || '').replace(/\/$/, '')
  const encoded = encodeURIComponent(phrase)

  // Prefer same-origin QMS proxy (best for Smart TV browsers)
  if (base) {
    const ok = await playAudioUrl(`${base}/queue/public/announce-tts?text=${encoded}`)
    if (ok) return true
  }

  // Direct free Google Translate TTS (works when TV allows external media)
  const googleOk = await playAudioUrl(
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encoded}`
  )
  if (googleOk) return true

  // Laptop/desktop browsers with voices installed
  return speakWithBrowser(phrase)
}

export function buildCallAnnouncement({ ticketCode, counterLabel, isRecall = false }) {
  const number = ticketCode || 'unknown'
  const counter = counterLabel || 'the counter'
  const prefix = isRecall ? 'Recall. ' : ''
  return `${prefix}Token number ${number}, please proceed to ${counter}.`
}

export async function announceQueueCall(row, { isRecall = false, ttsBaseUrl } = {}) {
  const number = row?.ticket_code
    ? String(row.ticket_code).replace(/^[A-Za-z]+/, '') || row.ticket_code
    : null
  if (!number) return false

  playQueueChime()
  await new Promise((r) => setTimeout(r, 450))

  const text = buildCallAnnouncement({
    ticketCode: number,
    counterLabel: row.counter_label || row.counter_name,
    isRecall,
  })
  return speakQueueText(text, { ttsBaseUrl })
}
