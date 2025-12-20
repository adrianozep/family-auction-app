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

const BID_WHISTLE_DATA_URL =
  'data:audio/wav;base64,UklGRjg2AQBXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRQ2AQAAAGsRVSI/MrFAQE2PV09fgGeKYZaZY3eaf3SHegDcQTsOhkuUN5Lj82Hc8HMuf7ASQzoyYU0Ncl4V2nUDhI+MDfX+bvhssU8uUtcx983+hXwLGk0JgrDdjk64tnprV/a22v3f7C5sVxI63mBLAA3x5I4oBObAcOgh9kAhthxbqhIq2B1OQvtn/rFGA2pPTkC/lyDy4jvuF0+nD6Hx27CPSaXMXpnM4GrkPpUDm3iOCLGI1u21GF2ksPd3w5rMhQt3gSwC+N3xoB06IgSyiH2ZQuNGh5shLq3gyOQgpcTBVdER+BfoMeZPTpDv5wq1RvGlntd+vk/r3wXoooGwFJojTlKZhEc2WcoFhir4E7+i/g8M07CX+S+z2ceIWtlomHsxw+s7okXLbVE4EtMmzgmDbRmm92OoK6mOvn3Et5K3OjK1h2KyqnK2yXNjbjAJmYYeiv1F7XeZCqeNfJiRqS3sY3qmz1h3+RfZ/PmJSdzpS15djcTOaw+YOHjjlqvWlZD42xgTUe6hfGYPDrkHaas6VtX4e9iPBAfJFcIvcl6p20c0t4axpEWtJ4leWUOs8DH1/pXRbtWp1ZO9rnx7wllxu5IJnOpJKtk4/v6UAZIkJrE/'+
  'mCg6ksG3TwYp9A9tlt9btnowVSkPB+cSDRkTnTR874RlvAk1ZMdUEt56j8frur1O9LuvcOBx+boPaQfqEwjK98DCGowNfclV76+r7sP3bzPOF8I6dybcq2pc/N+4B5rjCjdz4lOWM0A733E1Dy9QzVb/1X+pmWqjR1tVZtpgFtLzG2DZKQQjd7+JUEgZRMzdArK+bCpKDq/tuXIYLUeIMc/R4DBKIXyiH2YUYOBHeMAzZcPfXgZP0hhoEf7c2IikOGaA54NjX3nN1zNueC+oS4bd2F0ekyEe59FVE02JgKTdnPsUb6XueJjFtZdi4zU++OARw9+NBjYuPfeB5AAMohPmAlDgIba8C3bUVzrf+/Bc51aI7An2vw1HCkPTcDQcx6RHYwf07yM112InOD6CjlMChWsPB0jk2Lktfus/I7by0m+/shXwUGk8JDre3dnB02hnhHRoxJrQf5fTBKZ5weSj8E28ZBNpI=' // Generated in-tool sine-sweep whistle

// Web-audio whistle for bid raises (no external samples)
export function createBidWhistle() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  let volume = 0.85

  const playWebSynthesis = () => {
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

  const play = async () => {
    const vol = Math.max(0, Math.min(1, volume))
    try {
      await ctx.resume()
    } catch {}

    try {
      const el = new Audio(BID_WHISTLE_DATA_URL)
      el.volume = vol
      const htmlPlay = el.play()
      playWebSynthesis()
      if (htmlPlay?.catch) htmlPlay.catch(() => playWebSynthesis())
    } catch {
      playWebSynthesis()
    }
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
