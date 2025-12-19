export function createHostAudioPlayer() {
  const el = document.createElement('audio')
  el.loop = true
  el.preload = 'auto'
  el.crossOrigin = 'anonymous'
  el.volume = 0.6
  let currentUrl = null

  const setTrack = (url) => {
    currentUrl = url
    if (!url) {
      try { el.pause() } catch {}
      el.removeAttribute('src')
      el.load()
      return
    }
    if (el.getAttribute('src') !== url) {
      el.src = url
      el.load()
    }
  }

  const play = async () => {
    if (!currentUrl) return
    await el.play()
  }

  const pause = () => { try { el.pause() } catch {} }
  const stop = () => { pause(); try { el.currentTime = 0 } catch {} }
  const setVolume = (v) => { el.volume = Math.max(0, Math.min(1, Number(v) || 0)) }

  return { setTrack, play, pause, stop, setVolume, el }
}
