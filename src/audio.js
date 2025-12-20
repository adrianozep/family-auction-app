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

// Web-audio trumpet + snare hit for bid raises (no external samples)
export function createBidWhistle() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  let volume = 0.85

  const createNoiseBuffer = () => {
    const duration = 0.35
    const bufferSize = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i += 1) {
      const decay = Math.pow(1 - i / bufferSize, 2)
      data[i] = (Math.random() * 2 - 1) * decay
    }
    return buffer
  }

  const playBrassAndSnare = () => {
    const start = ctx.currentTime
    const master = ctx.createGain()
    master.gain.setValueAtTime(Math.max(0, volume * 1.1), start)
    master.gain.exponentialRampToValueAtTime(0.0001, start + 1.2)
    master.connect(ctx.destination)

    const brass = ctx.createOscillator()
    brass.type = 'sawtooth'
    brass.frequency.setValueAtTime(520, start)
    brass.frequency.exponentialRampToValueAtTime(880, start + 0.35)
    const brassGain = ctx.createGain()
    brassGain.gain.setValueAtTime(0.95, start)
    brassGain.exponentialRampToValueAtTime(0.001, start + 1.15)

    const brassFilter = ctx.createBiquadFilter()
    brassFilter.type = 'bandpass'
    brassFilter.frequency.setValueAtTime(820, start)
    brassFilter.Q.value = 1.4

    brass.connect(brassFilter)
    brassFilter.connect(brassGain)
    brassGain.connect(master)
    brass.start(start)
    brass.stop(start + 1.18)

    const harmony = ctx.createOscillator()
    harmony.type = 'triangle'
    harmony.frequency.setValueAtTime(780, start + 0.02)
    harmony.frequency.exponentialRampToValueAtTime(1160, start + 0.42)
    const harmonyGain = ctx.createGain()
    harmonyGain.gain.setValueAtTime(0.6, start + 0.02)
    harmonyGain.exponentialRampToValueAtTime(0.001, start + 1.05)
    harmony.connect(harmonyGain)
    harmonyGain.connect(master)
    harmony.start(start + 0.02)
    harmony.stop(start + 1.08)

    const noise = ctx.createBufferSource()
    noise.buffer = createNoiseBuffer()
    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'highpass'
    noiseFilter.frequency.value = 1200
    noiseFilter.Q.value = 0.9
    const noiseGain = ctx.createGain()
    noiseGain.gain.setValueAtTime(Math.max(0, volume * 0.85), start + 0.01)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4)
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(master)
    noise.start(start + 0.01)
    noise.stop(start + 0.42)
  }

  const play = async () => {
    try {
      await ctx.resume()
    } catch {}

    try {
      playBrassAndSnare()
    } catch {}
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

// Host raise sound: a focused, commercial-free whistle hit
export function createHostRaiseWhistle() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  let volume = 0.9
  let activeSources = []

  const track = (node) => {
    activeSources.push(node)
  }

  const stop = () => {
    activeSources.forEach((node) => {
      try {
        node.stop?.(0)
      } catch {}
      try {
        node.disconnect?.()
      } catch {}
    })
    activeSources = []
  }

  const createNoiseBuffer = () => {
    const duration = 0.22
    const bufferSize = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i += 1) {
      const decay = Math.pow(1 - i / bufferSize, 2.4)
      data[i] = (Math.random() * 2 - 1) * decay
    }
    return buffer
  }

  const play = async () => {
    try {
      await ctx.resume()
    } catch {}

    stop()

    const start = ctx.currentTime
    const master = ctx.createGain()
    master.gain.setValueAtTime(Math.max(0, volume * 1.25), start)
    master.gain.exponentialRampToValueAtTime(0.0001, start + 1.1)
    master.connect(ctx.destination)

    const whistle = ctx.createOscillator()
    whistle.type = 'square'
    whistle.frequency.setValueAtTime(740, start)
    whistle.frequency.exponentialRampToValueAtTime(2200, start + 0.48)
    const whistleGain = ctx.createGain()
    whistleGain.gain.setValueAtTime(1.05, start)
    whistleGain.exponentialRampToValueAtTime(0.001, start + 1.02)
    whistle.connect(whistleGain)
    whistleGain.connect(master)
    whistle.start(start)
    whistle.stop(start + 1.04)
    track(whistle)

    const overtone = ctx.createOscillator()
    overtone.type = 'sine'
    overtone.frequency.setValueAtTime(1800, start + 0.05)
    overtone.frequency.exponentialRampToValueAtTime(3200, start + 0.35)
    const overtoneGain = ctx.createGain()
    overtoneGain.gain.setValueAtTime(0.55, start + 0.05)
    overtoneGain.exponentialRampToValueAtTime(0.001, start + 0.9)
    overtone.connect(overtoneGain)
    overtoneGain.connect(master)
    overtone.start(start + 0.05)
    overtone.stop(start + 0.92)
    track(overtone)

    const hiss = ctx.createBufferSource()
    hiss.buffer = createNoiseBuffer()
    const hissFilter = ctx.createBiquadFilter()
    hissFilter.type = 'highpass'
    hissFilter.frequency.value = 1400
    hissFilter.Q.value = 0.9
    const hissGain = ctx.createGain()
    hissGain.gain.setValueAtTime(Math.max(0, volume * 0.65), start + 0.02)
    hissGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4)
    hiss.connect(hissFilter)
    hissFilter.connect(hissGain)
    hissGain.connect(master)
    hiss.start(start + 0.02)
    hiss.stop(start + 0.42)
    track(hiss)
  }

  return {
    async unlock() {
      if (ctx.state === 'suspended') await ctx.resume()
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, Number(v) || 0))
    },
    play,
    stop,
  }
}

// Fast triplet beeps for every host raise (commercial-free)
export function createHostRaiseTriplet() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  let volume = 0.9
  let active = []

  const clear = () => {
    active.forEach((node) => {
      try { node.stop?.(0) } catch {}
      try { node.disconnect?.() } catch {}
    })
    active = []
  }

  const beep = (start, freq, duration = 0.12, gainMult = 1) => {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.08, ctx.currentTime + start + duration)

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(Math.max(0, volume * gainMult), ctx.currentTime + start)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime + start)
    osc.stop(ctx.currentTime + start + duration + 0.02)
    active.push(osc)
  }

  const play = async () => {
    try { await ctx.resume() } catch {}
    clear()

    beep(0, 1260, 0.12, 1.15)
    beep(0.16, 1360, 0.12, 1.1)
    beep(0.32, 1480, 0.14, 1.05)
  }

  return {
    async unlock() {
      if (ctx.state === 'suspended') await ctx.resume()
    },
    setVolume(v) {
      volume = Math.max(0, Math.min(1, Number(v) || 0))
    },
    play,
    stop: clear,
  }
}
