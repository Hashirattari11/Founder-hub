let audioContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext
  if (!Ctor) return null
  if (!audioContext) audioContext = new Ctor()
  if (audioContext.state === 'suspended') void audioContext.resume()
  return audioContext
}

/** A short WhatsApp-style two-tone pop. Returns nothing; failures are silent. */
export function playMessageSound(): void {
  try {
    const ctx = getContext()
    if (!ctx) return
    const now = ctx.currentTime
    const envelope = ctx.createGain()
    envelope.gain.setValueAtTime(0.0001, now)
    envelope.gain.exponentialRampToValueAtTime(0.25, now + 0.02)
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)
    envelope.connect(ctx.destination)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(660, now)
    osc.frequency.setValueAtTime(880, now + 0.12)
    osc.connect(envelope)
    osc.start(now)
    osc.stop(now + 0.6)
  } catch {
    /* audio unavailable */
  }
}
