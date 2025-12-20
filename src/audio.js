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

  const gunshot = () => {
    const duration = 0.6
    const bufferSize = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < bufferSize; i += 1) {
      const decay = Math.pow(1 - i / bufferSize, 2)
      data[i] = (Math.random() * 2 - 1) * decay
    }

    const noise = ctx.createBufferSource()
    noise.buffer = buffer

    const bandpass = ctx.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.value = 1600
    bandpass.Q.value = 0.8

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(Math.max(0, volume * 1.2), ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)

    noise.connect(bandpass)
    bandpass.connect(gain)
    gain.connect(ctx.destination)

    const thump = ctx.createOscillator()
    thump.type = 'triangle'
    thump.frequency.setValueAtTime(90, ctx.currentTime)
    thump.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.18)
    const thumpGain = ctx.createGain()
    thumpGain.gain.setValueAtTime(volume, ctx.currentTime)
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.24)
    thump.connect(thumpGain)
    thumpGain.connect(ctx.destination)

    noise.start()
    noise.stop(ctx.currentTime + duration)
    thump.start()
    thump.stop(ctx.currentTime + 0.24)
  }

  const claps = () => {
    const makeClap = (start) => {
      const duration = 0.28
      const bufferSize = Math.floor(ctx.sampleRate * duration)
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)

      for (let i = 0; i < bufferSize; i += 1) {
        const decay = Math.pow(1 - i / bufferSize, 3)
        data[i] = (Math.random() * 2 - 1) * decay
      }

      const noise = ctx.createBufferSource()
      noise.buffer = buffer

      const bandpass = ctx.createBiquadFilter()
      bandpass.type = 'bandpass'
      bandpass.frequency.value = 1900
      bandpass.Q.value = 0.9

      const highpass = ctx.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = 600

      const gain = ctx.createGain()
      gain.gain.setValueAtTime(Math.max(0, volume * 1.3), ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration)

      noise.connect(bandpass)
      bandpass.connect(highpass)
      highpass.connect(gain)
      gain.connect(ctx.destination)

      noise.start(ctx.currentTime + start)
      noise.stop(ctx.currentTime + start + duration)
    }

    makeClap(0)
    makeClap(0.2)
    makeClap(0.4)
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
    playClaps: claps,
    playGunshot: gunshot,
  }
}
