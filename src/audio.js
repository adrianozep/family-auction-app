
// Simple countdown beeper (host-only)
export function createCountdownBeeps() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  let volume = 0.5

  function beep(freq = 880, duration = 0.12) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    gain.gain.value = volume
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
  }

  return {
    setVolume(v) { volume = Math.max(0, Math.min(1, v)) },
    beepFinal(secondsLeft) {
      // Higher pitch for final second
      beep(secondsLeft <= 1 ? 1200 : 880, 0.12)
    },
    unlock: async () => {
      if (ctx.state === 'suspended') await ctx.resume()
    }
  }
}
