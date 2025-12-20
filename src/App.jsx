import React, { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode.react'
import { db } from './firebase.js'
import { createCountdownBeeps } from './audio.js'
import {
  collection,
  doc,
  getDoc,
  getDocs,
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
  classic: { label:'Classic Night', vars:{ bg1:'#1d4ed8', bg2:'#0ea5e9', card:'rgba(11,18,32,.92)', card2:'rgba(255,255,255,.10)', btn:'#2563eb', btnActive:'#60a5fa' } },
  christmas:{ label:'Christmas', vars:{ bg1:'#0ea5e9', bg2:'#22c55e', card:'rgba(11,18,32,.92)', card2:'rgba(255,255,255,.10)', btn:'#16a34a', btnActive:'#f97316' } },
  halloween:{ label:'Halloween', vars:{ bg1:'#f97316', bg2:'#a855f7', card:'rgba(11,18,32,.92)', card2:'rgba(255,255,255,.10)', btn:'#a855f7', btnActive:'#fb7185' } },
  newyear:{ label:'New Year', vars:{ bg1:'#6366f1', bg2:'#22c55e', card:'rgba(11,18,32,.92)', card2:'rgba(255,255,255,.10)', btn:'#6366f1', btnActive:'#fbbf24' } },
  'game-night':{ label:'Game Night', vars:{ bg1:'#06b6d4', bg2:'#f43f5e', card:'rgba(11,18,32,.92)', card2:'rgba(255,255,255,.10)', btn:'#0ea5e9', btnActive:'#f43f5e' } },
}

function Icon({ children, size = 44, label, style = {} }) {
  return (
    <div title={label} aria-label={label} style={{ width:size, height:size, display:'inline-flex', alignItems:'center', justifyContent:'center', ...style }}>
      <svg width={size} height={size} viewBox="0 0 64 64" role="img">{children}</svg>
    </div>
  )
}

function ThemeClipArt({ themeKey }) {
  const baseSets = {
    christmas: [
      <Icon label="Tree"><polygon points="32,6 46,28 18,28" fill="#22c55e"/><polygon points="32,18 52,44 12,44" fill="#16a34a"/><rect x="28" y="44" width="8" height="12" rx="2" fill="#b45309"/><circle cx="24" cy="30" r="3" fill="#fbbf24"/><circle cx="40" cy="38" r="3" fill="#f87171"/><circle cx="32" cy="26" r="3" fill="#60a5fa"/><polygon points="32,4 35,10 42,10 36,14 38,20 32,16 26,20 28,14 22,10 29,10" fill="#fbbf24"/></Icon>,
      <Icon label="Snowflake"><g stroke="#e0f2fe" strokeWidth="4" strokeLinecap="round"><line x1="32" y1="10" x2="32" y2="54"/><line x1="10" y1="32" x2="54" y2="32"/><line x1="16" y1="16" x2="48" y2="48"/><line x1="48" y1="16" x2="16" y2="48"/></g><circle cx="32" cy="32" r="6" fill="#93c5fd" opacity="0.8"/></Icon>,
      <Icon label="Santa Hat"><path d="M14 40c10-16 22-24 36-20 4 1 6 4 6 8 0 8-10 16-22 16H14z" fill="#ef4444"/><path d="M14 40h38c0 8-6 14-14 14H28c-8 0-14-6-14-14z" fill="#ffffff"/><circle cx="56" cy="28" r="6" fill="#ffffff"/></Icon>,
      <Icon label="Reindeer"><circle cx="28" cy="34" r="14" fill="#a16207"/><circle cx="22" cy="30" r="3" fill="#111827"/><circle cx="34" cy="30" r="3" fill="#111827"/><circle cx="32" cy="40" r="4" fill="#ef4444"/></Icon>,
      <Icon label="Lights"><path d="M10 24c10-10 34-10 44 0" stroke="#fbbf24" strokeWidth="5" fill="none" strokeLinecap="round"/><circle cx="18" cy="24" r="5" fill="#22c55e"/><circle cx="28" cy="20" r="5" fill="#60a5fa"/><circle cx="38" cy="20" r="5" fill="#f97316"/><circle cx="48" cy="24" r="5" fill="#f87171"/></Icon>,
      <Icon label="Gift"><rect x="14" y="26" width="36" height="28" rx="6" fill="#60a5fa"/><rect x="30" y="26" width="4" height="28" fill="#fbbf24"/><rect x="14" y="36" width="36" height="4" fill="#fbbf24"/></Icon>,
    ],
    halloween: [
      <Icon label="Pumpkin"><ellipse cx="32" cy="36" rx="18" ry="16" fill="#f97316"/><rect x="29" y="16" width="6" height="10" rx="2" fill="#22c55e"/></Icon>,
      <Icon label="Ghost"><path d="M20 50V30c0-10 6-16 12-16s12 6 12 16v20l-6-4-6 4-6-4-6 4z" fill="#e5e7eb"/></Icon>,
      <Icon label="Bat"><path d="M12 36c8-12 16-12 20 0 4-12 12-12 20 0-8 8-16 12-20 12s-12-4-20-12z" fill="#111827"/></Icon>,
      <Icon label="Candy"><rect x="18" y="28" width="28" height="18" rx="9" fill="#fb7185"/><polygon points="18,37 10,30 10,44" fill="#a855f7"/><polygon points="46,37 54,30 54,44" fill="#a855f7"/></Icon>,
      <Icon label="Spider"><circle cx="32" cy="34" r="10" fill="#111827"/><g stroke="#111827" strokeWidth="4" strokeLinecap="round"><line x1="22" y1="34" x2="12" y2="28"/><line x1="42" y1="34" x2="52" y2="28"/></g></Icon>,
      <Icon label="Moon"><path d="M42 14c-10 2-16 14-10 24 4 8 14 12 22 8-8 10-24 8-32-4-10-14-2-34 20-28z" fill="#fbbf24"/></Icon>,
    ],
    newyear: [
      <Icon label="Firework"><circle cx="32" cy="32" r="6" fill="#fbbf24"/><g stroke="#fbbf24" strokeWidth="4" strokeLinecap="round"><line x1="32" y1="10" x2="32" y2="22"/><line x1="10" y1="32" x2="22" y2="32"/><line x1="16" y1="16" x2="24" y2="24"/></g></Icon>,
      <Icon label="Champagne"><path d="M28 12h8v10c0 6-2 10-4 12-2-2-4-6-4-12V12z" fill="#fbbf24"/></Icon>,
      <Icon label="Confetti"><circle cx="18" cy="20" r="4" fill="#60a5fa"/><circle cx="46" cy="18" r="4" fill="#22c55e"/><circle cx="40" cy="44" r="4" fill="#fb7185"/></Icon>,
      <Icon label="Star"><polygon points="32,8 38,24 55,24 41,34 46,50 32,40 18,50 23,34 9,24 26,24" fill="#fbbf24"/></Icon>,
      <Icon label="Clock"><circle cx="32" cy="32" r="18" fill="#e5e7eb"/><circle cx="32" cy="32" r="14" fill="#0b1220"/></Icon>,
      <Icon label="Party Hat"><polygon points="32,10 50,52 14,52" fill="#60a5fa"/></Icon>,
    ],
    'game-night': [
      <Icon label="Controller"><rect x="14" y="26" width="36" height="20" rx="10" fill="#0ea5e9"/><circle cx="26" cy="36" r="3" fill="#0b1220"/></Icon>,
      <Icon label="Dice"><rect x="18" y="18" width="28" height="28" rx="6" fill="#e5e7eb"/><circle cx="26" cy="26" r="3" fill="#0b1220"/></Icon>,
      <Icon label="Cards"><rect x="18" y="18" width="20" height="28" rx="4" fill="#60a5fa"/><rect x="26" y="22" width="20" height="28" rx="4" fill="#fb7185" opacity="0.95"/></Icon>,
      <Icon label="Trophy"><path d="M22 18h20v8c0 8-6 14-10 14s-10-6-10-14v-8z" fill="#fbbf24"/></Icon>,
      <Icon label="Coin"><circle cx="32" cy="32" r="18" fill="#fbbf24"/></Icon>,
      <Icon label="Megaphone"><path d="M18 34l18-10v20l-18-10z" fill="#f43f5e"/></Icon>,
    ],
    classic: [
      <Icon label="Music"><path d="M22 18h6v26c0 4-3 8-8 8s-8-3-8-8 3-8 8-8c1.4 0 2.8.3 4 .8V18z" fill="#60a5fa"/><path d="M42 14h6v26c0 4-3 8-8 8s-8-3-8-8 3-8 8-8c1.4 0 2.8.3 4 .8V14z" fill="#fbbf24"/></Icon>,
      <Icon label="Star"><polygon points="32,8 38,24 55,24 41,34 46,50 32,40 18,50 23,34 9,24 26,24" fill="#fbbf24"/></Icon>,
      <Icon label="Ticket"><rect x="14" y="22" width="36" height="20" rx="6" fill="#60a5fa"/><circle cx="20" cy="32" r="3" fill="#0b1220"/><circle cx="44" cy="32" r="3" fill="#0b1220"/></Icon>,
      <Icon label="Gavel"><rect x="20" y="24" width="8" height="16" rx="2" fill="#eab308"/><rect x="28" y="18" width="12" height="12" rx="2" fill="#f97316"/></Icon>,
    ],
  }

  const pool = baseSets[themeKey] || baseSets.classic
  const dense = useMemo(() => {
    const items = []
    const total = 160
    for (let i = 0; i < total; i += 1) {
      const base = pool[i % pool.length]
      const size = 26 + (i % 8) * 2
      const rotation = (i * 17) % 360
      items.push(React.cloneElement(base, { key: `${themeKey}-${i}`, size, style: { transform: `rotate(${rotation}deg)` } }))
    }
    return items
  }, [pool, themeKey])

  return <div className="row" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>{dense}</div>
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
  const isGameHost = (room?.hostId && room.hostId === playerId) || isHost

  const [timeLeft, setTimeLeft] = useState(0)
  const [players, setPlayers] = useState([])

  // Host inputs
  const [gameTitle, setGameTitle] = useState(titleFromUrl || 'Family Auction')
  const [bidInput, setBidInput] = useState(50)
  const [increment, setIncrement] = useState(10)
  const [customTime, setCustomTime] = useState(60)
  const [startingFunds, setStartingFunds] = useState(500)
  // Theme + countdown beeps
  const [themeKey, setThemeKey] = useState('classic')
  const beeperRef = useRef(null)
  const [beepsReady, setBeepsReady] = useState(false)
  const beep10Ref = useRef({ sec: null })
      
  // Player private notice
  const [privateNotice, setPrivateNotice] = useState('')

  // Create room if host (idempotent)
  useEffect(() => {
    if (!isHost) return
    ;(async () => {
      const snap = await getDoc(roomRef)
      if (snap.exists()) return
      await setDoc(roomRef, {
        hostId: playerId,
        title: gameTitle || 'Auction Game',
        theme: 'classic',
        started: false,
        currentBid: 50,
        baseBid: 50,
        increment: 10,
        currentPriceHasBid: false,
        leadingBid: null,
        revealedWinner: null,
        startingFunds: 500,
        roundNumber: 1,
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

  // Subscribe to players realtime (everyone sees arrivals live)
  useEffect(() => {
    const playersRef = collection(db, 'rooms', roomCode, 'players')
    const unsub = onSnapshot(playersRef, (snap) => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...(d.data() || {}) }))
        .filter(p => p.name)
        .sort((a,b) => String(a.name).localeCompare(String(b.name)))
      setPlayers(list)
    })
    return () => unsub()
  }, [roomCode])


  // Keep host inputs in sync (first load)
  useEffect(() => {
    if (!room) return
    setIncrement(room.increment ?? 10)
    setCustomTime(room.timer?.durationSec ?? 60)
    setBidInput(room.currentBid ?? 50)
    setStartingFunds(room.startingFunds ?? 500)
    if (!isHost && room.title) setGameTitle(room.title)
    if (room.theme) setThemeKey(room.theme)
  }, [room, isHost])

  // Apply theme vars to page
  useEffect(() => {
    applyThemeVars(themeKey)
  }, [themeKey])

  // Init beeper (host creates audio context)
  useEffect(() => {
    if (!isGameHost) return
    if (!beeperRef.current) beeperRef.current = createCountdownBeeps()
  }, [isGameHost])
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

  // Final 10-second countdown beeps (HOST ONLY) — option 1 (every second 10..1)
  useEffect(() => {
    if (!isGameHost) return
    if (!room?.started) return
    if (!beepsReady) return
    if (!beeperRef.current) return

    if (timeLeft > 10) {
      beep10Ref.current = { sec: null }
      return
    }

    if (timeLeft <= 10 && timeLeft >= 1 && beep10Ref.current.sec !== timeLeft) {
      beep10Ref.current.sec = timeLeft
      beeperRef.current.beepFinal(timeLeft)
    }
  }, [timeLeft, isGameHost, room?.started, beepsReady])

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
      let winner

      if (leading) {
        winner = { name: leading.name, amount: leading.amount, playerId: leading.playerId, ts: serverTimestamp() }
        if (leading.playerId) {
          const pRef = doc(db, 'rooms', roomCode, 'players', leading.playerId)
          const pSnap = await tx.get(pRef)
          const starting = Number(data.startingFunds ?? 0)
          const balance = pSnap.exists() && pSnap.data()?.balance != null ? Number(pSnap.data().balance) : starting
          const deduction = Number(leading.amount || 0)
          const newBalance = Math.max(0, balance - deduction)
          tx.set(pRef, { balance: newBalance }, { merge: true })
        }
      } else {
        winner = { name: 'No winner', amount: 0, ts: serverTimestamp() }
      }

      tx.update(roomRef, { revealedWinner: winner })
    }).catch(() => {})
  }, [room?.started, timeLeft, room?.revealedWinner, roomRef])

  const safeTitle = encodeURIComponent(gameTitle || 'Auction Game')
  const joinUrl = `${window.location.origin}?room=${roomCode}`

  const toggleFullscreen = async () => {
    try {
      const el = document.documentElement
      if (!document.fullscreenElement) {
        await el.requestFullscreen?.()
      } else {
        await document.exitFullscreen?.()
      }
    } catch {}
  }

  const sayBidPlaced = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const phrase = new SpeechSynthesisUtterance('bid placed')
    phrase.rate = 1
    phrase.pitch = 1
    phrase.volume = 0.9
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(phrase)
  }

  // Join player
  const joinRoom = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const pRef = doc(db, 'rooms', roomCode, 'players', playerId)
    const baseFunds = Math.max(0, Number(room?.startingFunds ?? startingFunds ?? 500))
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(pRef)
      const existing = snap.exists() ? snap.data() : {}
      tx.set(
        pRef,
        {
          name: trimmed,
          joinedAt: serverTimestamp(),
          balance: existing?.balance ?? baseFunds,
        },
        { merge: true }
      )
    })
    setJoined(true)
  }

    // Host actions
  const hostSaveMeta = async () => {
    if (!isGameHost) return
    await updateDoc(roomRef, {
      title: gameTitle || 'Auction Game',
      theme: themeKey,
      startingFunds: Math.max(0, Number(startingFunds) || 0),
    })
  }

  const hostApplyStartingFunds = async () => {
    if (!isGameHost) return
    const base = Math.max(0, Number(startingFunds) || 0)
    setStartingFunds(base)
    await updateDoc(roomRef, { startingFunds: base })
    const playersRef = collection(db, 'rooms', roomCode, 'players')
    const snap = await getDocs(playersRef)
    await Promise.all(snap.docs.map((p) => setDoc(p.ref, { balance: base }, { merge: true })))
  }

  const hostStartGame = async () => {
    if (!isGameHost) return
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef)
      if (!snap.exists()) return
      const data = snap.data()
      tx.update(roomRef, {
        title: gameTitle || data.title || 'Auction Game',
        theme: themeKey,
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
    if (!isGameHost) return
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
    if (!isGameHost) return
    const base = Number(room?.baseBid ?? 50)
    await updateDoc(roomRef, { currentBid: base, currentPriceHasBid: false, revealedWinner: null })
  }

  const hostPickIncrement = async (v) => {
    if (!isGameHost) return
    setIncrement(v)
    await updateDoc(roomRef, { increment: v })
  }

  const hostRaiseBid = async () => {
    if (!isGameHost) return
    const inc = Number(room?.increment ?? increment ?? 10)
    const base = Number(room?.baseBid ?? 0)
    const next = Math.max(base, Number(room?.currentBid ?? 0) + inc)
    await updateDoc(roomRef, { currentBid: next, currentPriceHasBid: false, revealedWinner: null })
    if (beeperRef.current && beepsReady) {
      try {
        beeperRef.current.playDoorbell?.()
      } catch {}
    }
  }

  // Timer
  const hostTimerStart = async () => {
    if (!isGameHost) return
    const duration = Math.max(1, Math.floor(Number(customTime) || 60))
    const end = nowMs() + duration * 1000
    await updateDoc(roomRef, {
      timer: { durationSec: duration, endAtMs: end, paused: false, pausedRemainingSec: 0, updatedAt: serverTimestamp() },
      currentPriceHasBid: false,
      leadingBid: null,
      revealedWinner: null,
    })
  }

  const hostTimerPause = async () => {
    if (!isGameHost) return
    const remaining = Math.max(0, Math.floor(timeLeft))
    await updateDoc(roomRef, {
      timer: { durationSec: Number(room?.timer?.durationSec ?? customTime ?? 60), endAtMs: 0, paused: true, pausedRemainingSec: remaining, updatedAt: serverTimestamp() },
    })
  }

  const hostTimerResume = async () => {
    if (!isGameHost) return
    const remaining = Math.max(0, Math.floor(room?.timer?.pausedRemainingSec ?? timeLeft ?? 0))
    const end = nowMs() + remaining * 1000
    await updateDoc(roomRef, {
      timer: { durationSec: Number(room?.timer?.durationSec ?? customTime ?? 60), endAtMs: end, paused: false, pausedRemainingSec: 0, updatedAt: serverTimestamp() },
    })
  }

  const hostTimerEnd = async () => {
    if (!isGameHost) return
    await updateDoc(roomRef, {
      timer: { durationSec: Number(room?.timer?.durationSec ?? customTime ?? 60), endAtMs: 0, paused: false, pausedRemainingSec: 0, updatedAt: serverTimestamp() },
    })
  }

  const hostAddFunds = async (targetPlayerId, delta) => {
    if (!isGameHost || !targetPlayerId || !room?.revealedWinner) return
    const pRef = doc(db, 'rooms', roomCode, 'players', targetPlayerId)
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(pRef)
      if (!snap.exists()) return
      const current = Number(snap.data()?.balance ?? room?.startingFunds ?? 0)
      const next = Math.max(0, current + delta)
      tx.update(pRef, { balance: next })
    })
  }

  const hostNextRound = async () => {
    if (!isGameHost) return
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef)
      if (!snap.exists()) return
      const data = snap.data()
      const nextRound = Number(data.roundNumber ?? 1) + 1
      const base = Number(data.baseBid ?? 50)
      tx.update(roomRef, {
        roundNumber: nextRound,
        revealedWinner: null,
        leadingBid: null,
        currentPriceHasBid: false,
        currentBid: base,
        timer: { durationSec: Number(data.timer?.durationSec ?? customTime ?? 60), endAtMs: 0, paused: false, pausedRemainingSec: 0, updatedAt: serverTimestamp() },
      })
    })
    setPrivateNotice('')
  }

  const hostEndGame = async () => {
    if (!isGameHost) return
    await updateDoc(roomRef, {
      started: false,
      timer: { durationSec: Number(room?.timer?.durationSec ?? customTime ?? 60), endAtMs: 0, paused: false, pausedRemainingSec: 0, updatedAt: serverTimestamp() },
      currentPriceHasBid: false,
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
        sayBidPlaced()
      } else {
        setPrivateNotice(`❌ Too late — someone already bid first at $${result.amount ?? (room?.currentBid ?? '')}`)
      }
      } catch {
        setPrivateNotice('⚠️ Bid failed. Try again.')
      }
    }

    const currentBid = Number(room?.currentBid ?? 0)
    const statusText = room?.currentPriceHasBid
      ? 'First bid locked — winner reveals when the timer ends'
      : 'Waiting for first bid'
    const showWinner = !!room?.revealedWinner
    const activeThemeKey = room?.theme || themeKey
    const roundNumber = Number(room?.roundNumber ?? 1)

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
            <p className="small">Enter your name to join the room.</p>
            <div className="row" style={{ marginTop: 10 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              <button onClick={joinRoom}>Join Room</button>
            </div>
          </div>
        </div>
      )
    }

    if (showWinner) {
      const playersWithBalance = players
        .map((p) => ({ ...p, balance: Number(p.balance ?? room?.startingFunds ?? 0) }))
        .sort((a, b) => b.balance - a.balance)

      return (
        <div className="app scorePage">
          <div className="card scoreCard" style={{ width: 'min(1100px, 100%)' }}>
            <div className="themeBackdrop" aria-hidden="true">
              <ThemeClipArt themeKey={activeThemeKey} />
            </div>
            <div className="pill">Round {roundNumber}</div>
            <h1>{room?.title || gameTitle || 'Auction Game'}</h1>
            <p className="small">Timer hit zero — here are the standings.</p>

            <div className="scoreboard" style={{ marginTop: 10 }}>
              <div className="boxTitle">Round Results</div>
              <div className="scoreboardRow">
                <div>
                  <p className="small">Winner</p>
                  <h2>{room.revealedWinner?.name}</h2>
                </div>
                <div className="scoreboardAmount">${room.revealedWinner?.amount}</div>
              </div>
              <p className="small">Only the winning bidder is deducted automatically.</p>
            </div>

            <div className="scoreList" aria-live="polite">
              {playersWithBalance.map((p) => (
                <div key={p.id} className="scoreboardRow playerRow">
                  <div>
                    <p className="small">{p.name}</p>
                    {room?.revealedWinner?.playerId === p.id && <span className="pill">Round winner</span>}
                  </div>
                  <div className="scoreboardAmount">${Math.max(0, Math.round(p.balance))}</div>
                  {isGameHost && (
                    <div className="row fundButtons">
                      {[10, 25, 50].map((v) => (
                        <button key={v} onClick={() => hostAddFunds(p.id, v)}>+${v}</button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              {isGameHost && (
                <>
                  <button onClick={hostNextRound}>Next Round</button>
                  <button onClick={toggleFullscreen}>Full Screen</button>
                </>
              )}
              {!isGameHost && <button onClick={toggleFullscreen}>Full Screen</button>}
            </div>
            {isGameHost && <p className="small">Add funds to players after a round, then start the next timer.</p>}
          </div>
        </div>
      )
    }

    return (
      <div className="app">
        <div className="card" style={{ width: 'min(1200px, 100%)' }}>
          <div className="themeBackdrop" aria-hidden="true">
            <ThemeClipArt themeKey={activeThemeKey} />
          </div>
          <h1>{room?.title || gameTitle || 'Auction Game'}</h1>

          {isGameHost && (
            <div className="card" style={{ background: 'var(--card2)' }}>
              <div className="row" style={{ gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <p className="small">Game Title</p>
                  <input value={gameTitle} onChange={(e) => setGameTitle(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <p className="small">Theme</p>
                  <select value={themeKey} onChange={(e) => setThemeKey(e.target.value)}>
                    {Object.entries(THEMES).map(([key, meta]) => (
                      <option key={key} value={key}>{meta.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <p className="small">Starting funds per player</p>
                  <input type="number" min={0} value={startingFunds} onChange={(e) => setStartingFunds(Number(e.target.value))} />
                  <p className="small">Applied to new arrivals. Use the button to refill everyone.</p>
                </div>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button onClick={hostSaveMeta}>Save Settings</button>
                <button onClick={hostApplyStartingFunds}>Give everyone ${Math.max(0, Math.round(startingFunds))}</button>
              </div>
            </div>
          )}

          <div className="controlBox" style={{ width: '100%', alignItems: 'flex-start', background: 'var(--card2)' }}>
            <div className="boxTitle">Live Players ({players.length})</div>
            {players.length === 0 && <p className="small">Waiting for players to register…</p>}
            {players.length > 0 && (
              <div className="playerGrid" aria-live="polite">
                {players.map((p) => (
                  <div key={p.id} className="playerChip">{p.name}</div>
                ))}
              </div>
            )}
          </div>

          <div className="row" style={{ alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <p className="small">Room Code</p>
              <h2>{roomCode}</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <QRCode value={joinUrl} size={160} />
              <p className="small">Scan to join (or enter room code)</p>
            </div>

            <div className="row" style={{ gap: 8 }}>
              {isGameHost && !beepsReady && (
                <button
                  onClick={async () => {
                    try {
                      if (!beeperRef.current) beeperRef.current = createCountdownBeeps()
                      await beeperRef.current.unlock()
                      setBeepsReady(true)
                    } catch {}
                  }}
                >
                  Enable Game Sounds
                </button>
              )}
              {isGameHost && !room?.started && <button onClick={hostStartGame}>Start Game</button>}
              {isGameHost && (
                <button disabled={!room?.started} onClick={hostEndGame}>
                  End Game
                </button>
              )}
              <button onClick={toggleFullscreen}>Full Screen</button>
            </div>
          </div>

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

            <div className={"barWrap" + (timeLeft > 0 && timeLeft <= 5 ? ' flash' : '')}>
              <div className="barTrack">
                <div
                  className="barFill"
                  style={{
                    width: `${Math.max(0, Math.min(100, Math.round(((timeLeft || 0) / Math.max(1, (room?.timer?.durationSec || 1))) * 100)))}%`,
                  }}
                />
              </div>
              <div className="barMeta small">
                <span>{formatTime(timeLeft)}</span>
                <span>{room?.timer?.durationSec ? `${room.timer.durationSec}s` : ''}</span>
              </div>
            </div>

            {privateNotice && !isGameHost && (
              <p className="small" aria-live="polite" style={{ marginTop: 8 }}>
                {privateNotice}
              </p>
            )}

          </div>

          {!isGameHost && room?.started && (
            <>
              <div className="hr" />
              <div className="controlsRow">
                <div className="controlBox" style={{ width: '100%', alignItems: 'flex-start' }}>
                  <div className="boxTitle">Your Move</div>
                  <button onClick={playerBid} disabled={timeLeft <= 0}>Bid ${currentBid}</button>
                </div>
              </div>
            </>
          )}

          {isGameHost && (
            <>
              <div className="hr" />

              <div className="controlsRow">
                <div className="controlBox">
                  <div className="boxTitle">Timer</div>
                  <input type="number" min={1} max={600} value={customTime} onChange={e => setCustomTime(Number(e.target.value))} />
                  <div className="row">
                    <button onClick={hostTimerStart}>Start</button>
                    <button disabled={!room?.started || timeLeft <= 0} onClick={hostTimerPause}>Pause</button>
                    <button disabled={!room?.started || timeLeft <= 0} onClick={hostTimerResume}>Resume</button>
                    <button disabled={!room?.started || timeLeft <= 0} onClick={hostTimerEnd}>End</button>
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
                  <p className="small">Leader hidden until the round ends.</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }
