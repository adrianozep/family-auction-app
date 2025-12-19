import React, { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode.react'
import { db } from './firebase.js'
import { createThemeSynth, createCountdownBeeps } from './audio.js'
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  addDoc,
  updateDoc,
} from 'firebase/firestore'

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`
}

function nowMs() {
  return Date.now()
}

function getPlayerId(roomCode) {
  const key = `auction_player_${roomCode}`
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const id = crypto?.randomUUID?.() || `${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`
  localStorage.setItem(key, id)
  return id
}

const THEMES = {
  classic: {
    label: 'Classic Night',
    vars: { bg1:'#0f172a', bg2:'#111827', card:'#111827', card2:'rgba(15,23,42,.35)', btn:'#475569', btnActive:'#64748b' }
  },
  christmas: {
    label: 'Christmas',
    vars: { bg1:'#0b1f14', bg2:'#111827', card:'#0f1b17', card2:'rgba(12,35,24,.45)', btn:'#2f6f55', btnActive:'#3a8a6a' }
  },
  halloween: {
    label: 'Halloween',
    vars: { bg1:'#0b0b13', bg2:'#111827', card:'#131322', card2:'rgba(25,17,36,.45)', btn:'#5b2d8a', btnActive:'#6a35a0' }
  },
  newyear: {
    label: 'New Year',
    vars: { bg1:'#081226', bg2:'#111827', card:'#0b1730', card2:'rgba(10,26,55,.45)', btn:'#1f4f8a', btnActive:'#2560a6' }
  },
  'game-night': {
    label: 'Game Night',
    vars: { bg1:'#0a1020', bg2:'#111827', card:'#0e1730', card2:'rgba(14,32,70,.40)', btn:'#334155', btnActive:'#475569' }
  },
}

function applyThemeVars(themeKey) {
  const t = THEMES[themeKey] || THEMES.classic
  const root = document.documentElement
  Object.entries(t.vars).forEach(([k,v]) => root.style.setProperty(`--${k}`, v))
}

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const roomFromUrl = params.get('room')
  const titleFromUrl = params.get('title') ? decodeURIComponent(params.get('title')) : null

  const [roomCode] = useState(roomFromUrl || generateRoomCode())
  const [isHost] = useState(!roomFromUrl)

  const playerId = useMemo(() => getPlayerId(roomCode), [roomCode])

  const [joined, setJoined] = useState(isHost)
  const [name, setName] = useState('')

  const [room, setRoom] = useState(null)
  const [loadingRoom, setLoadingRoom] = useState(true)
  const roomRef = useMemo(() => doc(db, 'rooms', roomCode), [roomCode])

  const [timeLeft, setTimeLeft] = useState(0)

  // Host inputs
  const [gameTitle, setGameTitle] = useState(titleFromUrl || 'Family Auction')
  const [bidInput, setBidInput] = useState(50)
  const [increment, setIncrement] = useState(10)
  const [customTime, setCustomTime] = useState(60)

  // Theme + music
  const [themeKey, setThemeKey] = useState('classic')
  const [musicEnabled, setMusicEnabled] = useState(false)
  const [musicVolume, setMusicVolume] = useState(0.6)
  const synthRef = useRef(null)
  const beeperRef = useRef(null)
  const [musicReady, setMusicReady] = useState(false) // user gesture done

  // Player private notice
  const [privateNotice, setPrivateNotice] = useState('')

  // Create room if host (idempotent)
  useEffect(() => {
    if (!isHost) return
    ;(async () => {
      const snap = await getDoc(roomRef)
      if (snap.exists()) return
      await setDoc(roomRef, {
        title: gameTitle || 'Auction Game',
        theme: 'classic',
        music: { enabled: false, volume: 0.6 },
        started: false,
        currentBid: 50,
        baseBid: 50,
        increment: 10,
        currentPriceHasBid: false,
        leadingBid: null,
        revealedWinner: null,
        timer: {
          durationSec: 60,
          endAtMs: 0,
          paused: false,
          pausedRemainingSec: 0,
          updatedAt: serverTimestamp(),
        },
        createdAt: serverTimestamp(),
      })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, roomRef])

  // Subscribe to room realtime
  useEffect(() => {
    setLoadingRoom(true)
    const unsub = onSnapshot(
      roomRef,
      (snap) => {
        setLoadingRoom(false)
        if (!snap.exists()) {
          setRoom(null)
          return
        }
        setRoom({ id: snap.id, ...snap.data() })
      },
      () => setLoadingRoom(false)
    )
    return () => unsub()
  }, [roomRef])

  // Keep host inputs in sync (first load)
  useEffect(() => {
    if (!room) return
    setIncrement(room.increment ?? 10)
    setCustomTime(room.timer?.durationSec ?? 60)
    setBidInput(room.currentBid ?? 50)
    if (!isHost && room.title) setGameTitle(room.title)
    if (room.theme) setThemeKey(room.theme)
    if (room.music) {
      setMusicEnabled(!!room.music.enabled)
      setMusicVolume(typeof room.music.volume === 'number' ? room.music.volume : 0.6)
    }
  }, [room, isHost])

  // Apply theme vars to page
  useEffect(() => {
    applyThemeVars(themeKey)
  }, [themeKey])

  // Prepare synth + beeper
  useEffect(() => {
    if (!synthRef.current) {
      synthRef.current = createThemeSynth(themeKey)
      synthRef.current.setVolume(musicVolume)
    }
    if (!beeperRef.current) {
      beeperRef.current = createCountdownBeeps()
      beeperRef.current.setVolume(musicVolume)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When theme changes, restart synth if playing
  useEffect(() => {
    const s = synthRef.current
    if (!s) return
    s.setVolume(musicVolume)
    // Re-create synth with new theme for different vibe
    const wasOn = musicEnabled && musicReady
    if (wasOn) {
      try { s.stop() } catch {}
      try { s.ctx?.close?.() } catch {}
      synthRef.current = createThemeSynth(themeKey)
      synthRef.current.setVolume(musicVolume)
      synthRef.current.start().catch(()=>{})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeKey])

  // Volume changes
  useEffect(() => {
    const s = synthRef.current
    if (!s) return
    s.setVolume(musicVolume)
  }, [musicVolume])

  // Follow room music settings (HOST DEVICE ONLY)
  useEffect(() => {
    if (!isHost) return
    const s = synthRef.current
    if (!s) return
    if (!musicReady) return
    if (musicEnabled) {
      s.start().catch(()=>{})
    } else {
      s.stop()
    }
  }, [musicEnabled, musicReady, isHost])

  // Timer computed locally from room.timer
  const endAtMs = room?.timer?.endAtMs || 0
  const paused = !!room?.timer?.paused
  const pausedRemainingSec = room?.timer?.pausedRemainingSec || 0

  useEffect(() => {
    if (!room?.started) {
      setTimeLeft(0)
      return
    }
    if (paused) {
      setTimeLeft(pausedRemainingSec)
      return
    }
    if (!endAtMs || endAtMs <= 0) {
      setTimeLeft(0)
      return
    }
    const tick = () => {
      const msLeft = Math.max(0, endAtMs - nowMs())
      setTimeLeft(Math.ceil(msLeft / 1000))
    }
    tick()
    const t = setInterval(tick, 250)
    return () => clearInterval(t)
  }, [room?.started, paused, pausedRemainingSec, endAtMs])

  // Final 5-second alert (beeps + flash) — HOST DEVICE ONLY
  const lastBeepRef = useRef({ sec: null, ended: false })
  useEffect(() => {
    if (!isHost) return
    if (!room?.started) return
    if (!musicReady) return // require a user gesture at least once on this device
    if (!beeperRef.current) return

    // reset per round
    if (timeLeft > 5) {
      lastBeepRef.current = { sec: null, ended: false }
      return
    }

    // beep each second 5..1 once
    if (timeLeft <= 5 && timeLeft >= 1 && lastBeepRef.current.sec !== timeLeft) {
      lastBeepRef.current.sec = timeLeft
      // slightly rising pitch toward 1
      const pitch = 660 + (5 - timeLeft) * 110
      beeperRef.current.beep(pitch, 0.08, 0.5).catch?.(() => {})
    }

    // end chime at 0 once
    if (timeLeft === 0 && !lastBeepRef.current.ended) {
      lastBeepRef.current.ended = true
      beeperRef.current.endChime().catch?.(() => {})
    }
  }, [room?.started, timeLeft, musicReady, isHost])

  // Auto reveal winner at 0
  const didAutoRevealRef = useRef(false)
  useEffect(() => {
    if (!room?.started) return
    if (timeLeft > 0) {
      didAutoRevealRef.current = false
      return
    }
    if (didAutoRevealRef.current) return
    didAutoRevealRef.current = true
    if (room?.revealedWinner) return

    runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef)
      if (!snap.exists()) return
      const data = snap.data()
      if (data.revealedWinner) return

      const leading = data.leadingBid || null
      const winner = leading
        ? { name: leading.name, amount: leading.amount, ts: serverTimestamp() }
        : { name: 'No winner', amount: 0, ts: serverTimestamp() }

      tx.update(roomRef, { revealedWinner: winner })
    }).catch(() => {})
  }, [room?.started, timeLeft, room?.revealedWinner, roomRef])

  const safeTitle = encodeURIComponent(gameTitle || 'Auction Game')
  const joinUrl = `${window.location.origin}?room=${roomCode}&title=${safeTitle}`

  // Join player
  const joinRoom = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const pRef = doc(db, 'rooms', roomCode, 'players', playerId)
    await setDoc(pRef, { name: trimmed, joinedAt: serverTimestamp() }, { merge: true })
    setJoined(true)
  }

  // Music: requires user gesture
  const enableMusic = async () => {
    try {
      const s = synthRef.current
      if (!s) return
      await s.start()
      setMusicReady(true)
      // reflect current setting (if room says disabled, stop)
      if (!musicEnabled) s.stop()
    } catch {}
  }

  // Host actions
  const hostSaveMeta = async () => {
    await updateDoc(roomRef, {
      title: gameTitle || 'Auction Game',
      theme: themeKey,
      music: { enabled: !!musicEnabled, volume: Number(musicVolume) || 0.6 },
    })
  }

  const hostStartGame = async () => {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef)
      if (!snap.exists()) return
      const data = snap.data()
      tx.update(roomRef, {
        title: gameTitle || data.title || 'Auction Game',
        theme: themeKey,
        music: { enabled: !!musicEnabled, volume: Number(musicVolume) || 0.6 },
        started: true,
        revealedWinner: null,
        currentPriceHasBid: false,
        timer: {
          ...(data.timer || {}),
          durationSec: Number(customTime) || 60,
          endAtMs: 0,
          paused: false,
          pausedRemainingSec: 0,
          updatedAt: serverTimestamp(),
        },
      })
    })
  }

  const hostSetBidBase = async () => {
    const v = Math.max(0, Number(bidInput) || 0)
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef)
      if (!snap.exists()) return
      const data = snap.data()
      tx.update(roomRef, {
        baseBid: v,
        currentBid: v,
        currentPriceHasBid: false,
        revealedWinner: null,
        increment: Number(increment) || (data.increment ?? 10),
      })
    })
  }

  const hostResetToBase = async () => {
    const base = Number(room?.baseBid ?? 50)
    await updateDoc(roomRef, { currentBid: base, currentPriceHasBid: false, revealedWinner: null })
  }

  const hostPickIncrement = async (v) => {
    setIncrement(v)
    await updateDoc(roomRef, { increment: v })
  }

  const hostRaiseBid = async () => {
    const inc = Number(room?.increment ?? increment ?? 10)
    const base = Number(room?.baseBid ?? 0)
    const next = Math.max(base, Number(room?.currentBid ?? 0) + inc)
    await updateDoc(roomRef, { currentBid: next, currentPriceHasBid: false, revealedWinner: null })
  }

  // Timer
  const hostTimerStart = async () => {
    const duration = Math.max(1, Math.floor(Number(customTime) || 60))
    const end = nowMs() + duration * 1000
    await updateDoc(roomRef, {
      timer: { durationSec: duration, endAtMs: end, paused: false, pausedRemainingSec: 0, updatedAt: serverTimestamp() },
      revealedWinner: null,
    })
  }

  const hostTimerPause = async () => {
    const remaining = Math.max(0, Math.floor(timeLeft))
    await updateDoc(roomRef, {
      timer: { durationSec: Number(room?.timer?.durationSec ?? customTime ?? 60), endAtMs: 0, paused: true, pausedRemainingSec: remaining, updatedAt: serverTimestamp() },
    })
  }

  const hostTimerResume = async () => {
    const remaining = Math.max(0, Math.floor(room?.timer?.pausedRemainingSec ?? timeLeft ?? 0))
    const end = nowMs() + remaining * 1000
    await updateDoc(roomRef, {
      timer: { durationSec: Number(room?.timer?.durationSec ?? customTime ?? 60), endAtMs: end, paused: false, pausedRemainingSec: 0, updatedAt: serverTimestamp() },
    })
  }

  const hostTimerEnd = async () => {
    await updateDoc(roomRef, {
      timer: { durationSec: Number(room?.timer?.durationSec ?? customTime ?? 60), endAtMs: 0, paused: false, pausedRemainingSec: 0, updatedAt: serverTimestamp() },
    })
  }

  // Player bid (first tap wins at current price)
  const playerBid = async () => {
    if (!room?.started) return
    if (timeLeft <= 0) return
    setPrivateNotice('')

    const pRef = doc(db, 'rooms', roomCode, 'players', playerId)
    const bidsCol = collection(db, 'rooms', roomCode, 'bids')

    try {
      const result = await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef)
        if (!snap.exists()) return { ok:false, reason:'no-room' }
        const data = snap.data()
        const current = Number(data.currentBid ?? 0)
        if (data.currentPriceHasBid === true) return { ok:false, reason:'late', amount: current }

        const pSnap = await tx.get(pRef)
        const pName = (pSnap.exists() && pSnap.data().name) ? pSnap.data().name : 'Player'

        const leading = { playerId, name: pName, amount: current, ts: serverTimestamp() }
        tx.update(roomRef, { currentPriceHasBid: true, leadingBid: leading, revealedWinner: null })
        return { ok:true, name:pName, amount: current }
      })

      if (result.ok) {
        await addDoc(bidsCol, { playerId, name: result.name, amount: result.amount, ts: serverTimestamp() })
        setPrivateNotice(`✅ You’re currently winning at $${result.amount}`)
      } else {
        setPrivateNotice(`❌ Too late — someone already bid first at $${result.amount ?? (room?.currentBid ?? '')}`)
      }
    } catch {
      setPrivateNotice('⚠️ Bid failed. Try again.')
    }
  }

  if (loadingRoom) {
    return (
      <div className="app">
        <div className="card" style={{ maxWidth: 520 }}>
          <h1>Loading…</h1>
          <p className="small">Connecting to the room.</p>
        </div>
      </div>
    )
  }

  if (!room && !isHost) {
    return (
      <div className="app">
        <div className="card" style={{ maxWidth: 520 }}>
          <h1>Room not found</h1>
          <p className="small">Ask the host for the correct QR / room code.</p>
        </div>
      </div>
    )
  }

  if (!joined) {
    return (
      <div className="app">
        <div className="card" style={{ maxWidth: 520 }}>
          <h1>{room?.title || gameTitle || 'Auction Game'}</h1>
          <p className="small">Enter your name to join room <b>{roomCode}</b></p>
          <input placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
          <button disabled={!name.trim()} onClick={joinRoom}>Join Room</button>

          
        </div>
      </div>
    )
  }

  const title = room?.title || gameTitle || 'Auction Game'
  const currentBid = Number(room?.currentBid ?? 0)
  const statusText = room?.currentPriceHasBid ? 'Bid placed!' : `No bids at $${currentBid} yet`
  const showWinner = room?.started && timeLeft <= 0 && room?.revealedWinner

  // Player view
  if (!isHost) {
    const isWinning = room?.leadingBid?.playerId === playerId
    return (
      <div className="app">
        <div className="card" style={{ maxWidth: 520 }}>
          <h1>{title}</h1>

          {!room?.started ? (
            <p>Waiting for host to start…</p>
          ) : (
            <>
              <div>
                <p className="small">Current Bid</p>
                <div className="bid">${currentBid}</div>
              </div>

              <div className="chip" aria-live="polite">
                <span className={"dot " + (room?.currentPriceHasBid ? 'ok' : 'warn')} />
                <span>{statusText}</span>
              </div>

              <p className="small">
                Time left: <b>{formatTime(timeLeft)}</b> {paused && timeLeft > 0 ? '(paused)' : ''}
              </p>

              <div className={"barWrap" + (timeLeft > 0 && timeLeft <= 5 ? " flash" : "")}>
                <div className="barTrack">
                  <div
                    className="barFill"
                    style={{
                      width: `${Math.max(0, Math.min(100, Math.round(((timeLeft || 0) / Math.max(1, (room?.timer?.durationSec || 1))) * 100)))}%`
                    }}
                  />
                </div>
                <div className="barMeta small">
                  <span>{formatTime(timeLeft)}</span>
                  <span>{room?.timer?.durationSec ? `${room.timer.durationSec}s` : ''}</span>
                </div>
              </div>


              <button onClick={playerBid} disabled={timeLeft <= 0} style={{ width: '100%', fontSize: 28, padding: 18 }}>
                TAP ${currentBid}
              </button>

              

              {(privateNotice || isWinning) && (
                <p className="small" style={{ marginTop: 6 }}>
                  {privateNotice || `✅ You’re currently winning at $${currentBid}`}
                </p>
              )}

              {showWinner && (
                <>
                  <div className="hr" />
                  <p className="small">Round over</p>
                  <h2>Winner: {room.revealedWinner?.name}</h2>
                  <p className="small">Winning bid: <b>${room.revealedWinner?.amount}</b></p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // Host view
  return (
    <div className="app">
      <div className="card">
        <h1>{title}</h1>

        {!room?.started && (
          <div style={{ width: '100%', maxWidth: 720 }}>
            <div className="controlsRow" style={{ gap: 14 }}>
              <div className="controlBox" style={{ minWidth: 0 }}>
                <div className="boxTitle">Game Title</div>
                <input value={gameTitle} onChange={e => setGameTitle(e.target.value)} placeholder="Type your game name…" />
              </div>
              <div className="boxDivider" />
              <div className="controlBox" style={{ minWidth: 0 }}>
                <div className="boxTitle">Theme</div>
                <select value={themeKey} onChange={e => setThemeKey(e.target.value)}>
                  {Object.entries(THEMES).map(([k,v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <div className="pill">
                  <span>Music</span>
                  <span style={{ opacity: .8 }}>{musicEnabled ? 'On' : 'Off'}</span>
                </div>
                <div className="row">
                  <button onClick={() => setMusicEnabled(v => !v)}>{musicEnabled ? 'Disable Music' : 'Enable Music'}</button>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={musicVolume}
                  onChange={e => setMusicVolume(Number(e.target.value))}
                />
                <p className="small">Volume</p>
                {!musicReady && musicEnabled && (
                  <>
                    <button onClick={enableMusic}>Enable Audio on Host</button>
                    <p className="small">Click once to allow audio playback on this laptop/TV.</p>
                  </>
                )}
              </div>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button onClick={hostSaveMeta}>Save Settings</button>
            </div>
          </div>
        )}

        <div>
          <p className="small">Room Code</p>
          <h2>{roomCode}</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <QRCode value={joinUrl} size={180} />
          <p className="small" style={{ maxWidth: 720, wordBreak: 'break-word' }}>{joinUrl}</p>
          {!room?.started && <button onClick={hostStartGame}>Start Game</button>}
        </div>

        {room?.started && (
          <>
            <div className="hr" />
            <div>
              <p className="small">Current Bid</p>
              <div className="bid">${currentBid}</div>

              <div className="chip" style={{ marginTop: 8 }} aria-live="polite">
                <span className={"dot " + (room?.currentPriceHasBid ? 'ok' : 'warn')} />
                <span>{statusText}</span>
              </div>

              <p className="small" style={{ marginTop: 8 }}>
                Time left: <b>{formatTime(timeLeft)}</b> {paused && timeLeft > 0 ? '(paused)' : ''}
              </p>

              <div className={"barWrap" + (timeLeft > 0 && timeLeft <= 5 ? " flash" : "")}>
                <div className="barTrack">
                  <div
                    className="barFill"
                    style={{
                      width: `${Math.max(0, Math.min(100, Math.round(((timeLeft || 0) / Math.max(1, (room?.timer?.durationSec || 1))) * 100)))}%`
                    }}
                  />
                </div>
                <div className="barMeta small">
                  <span>{formatTime(timeLeft)}</span>
                  <span>{room?.timer?.durationSec ? `${room.timer.durationSec}s` : ''}</span>
                </div>
              </div>


              {showWinner && (
                <>
                  <div className="hr" />
                  <h2>Winner: {room.revealedWinner?.name}</h2>
                  <p className="small">Winning bid: <b>${room.revealedWinner?.amount}</b></p>
                </>
              )}
            </div>

            <div className="hr" />

            <div className="controlsRow">
              <div className="controlBox">
                <div className="boxTitle">Timer</div>
                <input type="number" min={1} max={600} value={customTime} onChange={e => setCustomTime(Number(e.target.value))} />
                <div className="row">
                  <button onClick={hostTimerStart}>Start</button>
                  <button disabled={timeLeft <= 0} onClick={hostTimerPause}>Pause</button>
                  <button disabled={timeLeft <= 0} onClick={hostTimerResume}>Resume</button>
                  <button disabled={timeLeft <= 0} onClick={hostTimerEnd}>End</button>
                </div>
                <p className="small">Remaining: <b>{formatTime(timeLeft)}</b></p>
              </div>

              <div className="boxDivider" />

              <div className="controlBox">
                <div className="boxTitle">Bid Setup</div>
                <input type="number" min={0} value={bidInput} onChange={e => setBidInput(Number(e.target.value))} />
                <div className="row" style={{ marginTop: 6 }}>
                  <button onClick={hostSetBidBase}>Set</button>
                  <button onClick={hostResetToBase}>Reset (${Number(room?.baseBid ?? 50)})</button>
                </div>
                <p className="small">Saved base: <b>${Number(room?.baseBid ?? 50)}</b></p>
              </div>

              <div className="boxDivider" />

              <div className="controlBox">
                <div className="boxTitle">Raise Bid</div>
                <div className="row">
                  {[5, 10, 15, 20].map(v => (
                    <button
                      key={v}
                      onClick={() => hostPickIncrement(v)}
                      style={{ background: (room?.increment ?? increment) === v ? 'var(--btnActive)' : undefined }}
                    >
                      +${v}
                    </button>
                  ))}
                </div>
                <button onClick={hostRaiseBid}>Raise +${Number(room?.increment ?? increment ?? 10)}</button>
                <p className="small">Leader (hidden): <b>{room?.leadingBid?.name || '—'}</b></p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
