// Host-only countdown beeps (no music)
export function createCountdownBeeps() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  let volume = 0.6

  const whistle = () => {
    const start = ctx.currentTime

    const master = ctx.createGain()
    master.gain.setValueAtTime(Math.max(0, volume * 1.6), start)
    master.gain.exponentialRampToValueAtTime(0.0001, start + 1.4)
    master.connect(ctx.destination)

    const body = ctx.createOscillator()
    body.type = 'square'
    body.frequency.setValueAtTime(900, start)
    body.frequency.exponentialRampToValueAtTime(1800, start + 0.6)
    const bodyGain = ctx.createGain()
    bodyGain.gain.setValueAtTime(1.1, start)
    bodyGain.exponentialRampToValueAtTime(0.001, start + 1.1)
    body.connect(bodyGain)
    bodyGain.connect(master)
    body.start(start)
    body.stop(start + 1.2)

    const overtone = ctx.createOscillator()
    overtone.type = 'sine'
    overtone.frequency.setValueAtTime(2400, start + 0.05)
    overtone.frequency.exponentialRampToValueAtTime(3200, start + 0.6)
    const overtoneGain = ctx.createGain()
    overtoneGain.gain.setValueAtTime(0.7, start + 0.05)
    overtoneGain.exponentialRampToValueAtTime(0.001, start + 1.2)
    overtone.connect(overtoneGain)
    overtoneGain.connect(master)
    overtone.start(start + 0.05)
    overtone.stop(start + 1.3)
  }

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
    playWhistle: whistle,
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

// Web-audio whistle for bid raises (no samples / royalty-free)
export function createBidWhistle() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  let volume = 0.85

  const play = () => {
    const start = ctx.currentTime

    const master = ctx.createGain()
    master.gain.setValueAtTime(Math.max(0, volume * 1.2), start)
    master.gain.exponentialRampToValueAtTime(0.0001, start + 1.1)
    master.connect(ctx.destination)

    const body = ctx.createOscillator()
    body.type = 'sawtooth'
    body.frequency.setValueAtTime(820, start)
    body.frequency.exponentialRampToValueAtTime(1800, start + 0.5)
    const bodyGain = ctx.createGain()
    bodyGain.gain.setValueAtTime(0.9, start)
    bodyGain.exponentialRampToValueAtTime(0.001, start + 1.05)
    body.connect(bodyGain)
    bodyGain.connect(master)
    body.start(start)
    body.stop(start + 1.08)

    const overtone = ctx.createOscillator()
    overtone.type = 'triangle'
    overtone.frequency.setValueAtTime(1600, start + 0.04)
    overtone.frequency.exponentialRampToValueAtTime(2600, start + 0.55)
    const overtoneGain = ctx.createGain()
    overtoneGain.gain.setValueAtTime(0.65, start + 0.04)
    overtoneGain.exponentialRampToValueAtTime(0.001, start + 1.12)
    overtone.connect(overtoneGain)
    overtoneGain.connect(master)
    overtone.start(start + 0.04)
    overtone.stop(start + 1.14)
  }

  return {
    async unlock() {
      if (ctx.state === 'suspended') await ctx.resume()
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, Number(v) || 0))
    },
    play,
  }
}
