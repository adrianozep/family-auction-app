export function createThemeSynth(themeKey = 'classic') {
  // Returns an object with start(), stop(), setVolume(v 0..1)
  // Uses simple oscillators/noise for generic "vibes" (no copyrighted audio).
  const AudioContext = window.AudioContext || window.webkitAudioContext
  const ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.value = 0.12
  master.connect(ctx.destination)

  let nodes = []
  let intervalId = null

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    nodes.forEach(n => {
      try { n.stop?.() } catch {}
      try { n.disconnect?.() } catch {}
    })
    nodes = []
  }

  const setVolume = (v) => {
    master.gain.value = Math.max(0, Math.min(1, Number(v) || 0)) * 0.25
  }

  // Small helper to play a short tone "ping"
  const ping = (freq, dur = 0.08, type = 'sine', vol = 0.25) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = freq
    g.gain.value = 0
    o.connect(g)
    g.connect(master)
    const t = ctx.currentTime
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.start(t)
    o.stop(t + dur + 0.02)
    nodes.push(o, g)
  }

  const start = async () => {
    // must be called from a user gesture in most browsers
    if (ctx.state !== 'running') await ctx.resume()
    stop()

    const preset = themeKey || 'classic'

    if (preset === 'christmas') {
      // gentle pad + occasional bell pings
      const pad = ctx.createOscillator()
      pad.type = 'triangle'
      pad.frequency.value = 220
      const lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 0.18
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 18
      lfo.connect(lfoGain)
      lfoGain.connect(pad.frequency)

      const padGain = ctx.createGain()
      padGain.gain.value = 0.07
      pad.connect(padGain)
      padGain.connect(master)

      pad.start()
      lfo.start()
      nodes.push(pad, lfo, lfoGain, padGain)

      intervalId = setInterval(() => {
        const freqs = [784, 988, 1175, 1319] // bell-ish
        ping(freqs[Math.floor(Math.random() * freqs.length)], 0.10, 'sine', 0.18)
      }, 1200)
    } else if (preset === 'halloween') {
      // spooky drone + occasional low thumps
      const drone = ctx.createOscillator()
      drone.type = 'sawtooth'
      drone.frequency.value = 90
      const g = ctx.createGain()
      g.gain.value = 0.06
      drone.connect(g)
      g.connect(master)
      drone.start()
      nodes.push(drone, g)

      intervalId = setInterval(() => {
        const freqs = [110, 98, 123]
        ping(freqs[Math.floor(Math.random() * freqs.length)], 0.14, 'square', 0.12)
      }, 1400)
    } else if (preset === 'newyear') {
      // upbeat arpeggio blips
      intervalId = setInterval(() => {
        const freqs = [440, 554, 659, 880, 988]
        ping(freqs[Math.floor(Math.random() * freqs.length)], 0.06, 'sine', 0.16)
      }, 240)
    } else if (preset === 'game-night') {
      // subtle pulse + chirps
      const pulse = ctx.createOscillator()
      pulse.type = 'sine'
      pulse.frequency.value = 160
      const pg = ctx.createGain()
      pg.gain.value = 0.05
      pulse.connect(pg); pg.connect(master)
      pulse.start()
      nodes.push(pulse, pg)
      intervalId = setInterval(() => {
        const freqs = [523, 659, 784]
        ping(freqs[Math.floor(Math.random() * freqs.length)], 0.05, 'triangle', 0.12)
      }, 900)
    } else {
      // classic: calm pad
      const pad = ctx.createOscillator()
      pad.type = 'sine'
      pad.frequency.value = 196
      const g = ctx.createGain()
      g.gain.value = 0.06
      pad.connect(g); g.connect(master)
      pad.start()
      nodes.push(pad, g)
    }
  }

  return { start, stop, setVolume, ctx }
}


export function createCountdownBeeps() {
  // lightweight beeper for final 5 seconds + end chime
  const AudioContext = window.AudioContext || window.webkitAudioContext
  const ctx = new AudioContext()
  const master = ctx.createGain()
  master.gain.value = 0.25
  master.connect(ctx.destination)

  const setVolume = (v) => {
    master.gain.value = Math.max(0, Math.min(1, Number(v) || 0)) * 0.35
  }

  const beep = async (freq = 880, dur = 0.08, vol = 0.5) => {
    if (ctx.state !== 'running') await ctx.resume()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    o.connect(g); g.connect(master)
    const t = ctx.currentTime
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  const endChime = async () => {
    // quick 3-note chime
    await beep(784, 0.08, 0.45)
    setTimeout(() => { beep(988, 0.08, 0.45) }, 110)
    setTimeout(() => { beep(1175, 0.10, 0.45) }, 220)
  }

  return { beep, endChime, setVolume, ctx }
}
