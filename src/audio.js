// Host-only countdown beeps (no music)
export function createCountdownBeeps() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  let volume = 0.6

  const beep = (freq = 880, duration = 0.12, gainMult = 1) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    gain.gain.setValueAtTime(Math.max(0, volume * gainMult), ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
  }

  const doorbell = () => {
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(Math.max(0, volume), ctx.currentTime)
    gain.connect(ctx.destination)

    const ding = (freq, start, dur = 0.22) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      osc.connect(gain)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur)
    }

    ding(880, 0)
    ding(660, 0.18, 0.26)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1)
  }

  return {
    setVolume(v) { volume = Math.max(0, Math.min(1, Number(v) || 0)) },
    async unlock() {
      if (ctx.state === 'suspended') await ctx.resume()
    },
    // option 1: beep each second; higher pitch and longer tone at 1 second
    beepFinal(secLeft) {
      const s = Number(secLeft) || 0
      const isFinal = s <= 1
      const freq = isFinal ? 1400 : 880
      const duration = isFinal ? 2 : 0.14
      const gainMult = isFinal ? 1.4 : 1
      beep(freq, duration, gainMult)
    },
    playDoorbell: doorbell,
  }
}
