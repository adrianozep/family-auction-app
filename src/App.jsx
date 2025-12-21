import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode.react'
import { db } from './firebase.js'
import { createBidWhistle, createCountdownBeeps, createHostRaiseTriplet, createHostRaiseWhistle } from './audio.js'
import {
  collection,
  doc,
  deleteDoc,
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

function createEmojiBackground({ gradientFrom, gradientTo, emojis, palette = [], emojiCount = 0 }) {
  if (!emojiCount || !emojis?.length) {
    return `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`
  }

  const width = 1600
  const height = 1600
  let swarm = ''

  for (let i = 0; i < emojiCount; i += 1) {
    const emoji = emojis[i % emojis.length]
    const x = Math.random() * width
    const y = Math.random() * height
    const size = 18 + Math.random() * 26
    const rotation = Math.floor(Math.random() * 360)
    const opacity = 0.45 + Math.random() * 0.35

    const color = palette.length > 0 ? palette[i % palette.length] : '#f8fafc'

    swarm += `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${size.toFixed(2)}" transform="rotate(${rotation} ${x.toFixed(2)} ${y.toFixed(2)})" opacity="${opacity.toFixed(2)}" fill="${color}">${emoji}</text>`
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${gradientFrom}"/><stop offset="100%" stop-color="${gradientTo}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><g font-family="'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif" text-anchor="middle" dominant-baseline="central">${swarm}</g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

const THEMES = {
  classic: {
    label: 'Classic Night',
    vars: {
      bg1: '#0b1b44',
      bg2: '#2b1b63',
      card: 'rgba(10,14,26,.92)',
      card2: 'rgba(255,255,255,.10)',
      btn: '#4338ca',
      btnActive: '#7c3aed',
      bgImage: createEmojiBackground({
        gradientFrom: '#0b1b44',
        gradientTo: '#2b1b63',
        emojis: ['✦', '✸', '✷', '✺', '✧'],
        palette: ['#c7d2fe', '#bfdbfe', '#fde68a', '#f97316'],
      }),
    },
  },
  christmas: {
    label: 'Christmas',
    vars: {
      bg1: '#5a0b0b',
      bg2: '#d11d1d',
      card: 'rgba(24,10,10,.92)',
      card2: 'rgba(255,255,255,.12)',
      btn: '#b91c1c',
      btnActive: '#16a34a',
      bgImage: createEmojiBackground({
        gradientFrom: '#440707',
        gradientTo: '#d11d1d',
        emojis: ['✶', '✴', '✵', '✷', '✦', '✺'],
        palette: ['#fecdd3', '#fef08a', '#bbf7d0', '#bfdbfe'],
      }),
    },
  },
  halloween: {
    label: 'Halloween',
    vars: {
      bg1: '#0f5132',
      bg2: '#4c1d95',
      card: 'rgba(13,15,23,.94)',
      card2: 'rgba(255,255,255,.10)',
      btn: '#22c55e',
      btnActive: '#a855f7',
      bgImage: createEmojiBackground({
        gradientFrom: '#0f5132',
        gradientTo: '#4c1d95',
        emojis: ['⬣', '◆', '◇', '⬢', '⬡', '✦', '✧', '✩'],
        palette: ['#fcd34d', '#f472b6', '#a78bfa', '#34d399'],
      }),
    },
  },
  newyear: {
    label: 'New Year',
    vars: {
      bg1: '#0f172a',
      bg2: '#fbbf24',
      card: 'rgba(10,14,26,.92)',
      card2: 'rgba(255,255,255,.10)',
      btn: '#6366f1',
      btnActive: '#fbbf24',
      bgImage: createEmojiBackground({
        gradientFrom: '#0b1220',
        gradientTo: '#f59e0b',
        emojis: ['✦', '✸', '✹', '✺', '✼', '✻', '✳', '✴'],
        palette: ['#fde68a', '#fca5a5', '#93c5fd', '#c4b5fd'],
      }),
    },
  },
  'game-night': {
    label: 'Game Night',
    vars: {
      bg1: '#0ea5e9',
      bg2: '#a855f7',
      card: 'rgba(11,18,32,.92)',
      card2: 'rgba(255,255,255,.10)',
      btn: '#0ea5e9',
      btnActive: '#f43f5e',
      bgImage: createEmojiBackground({
        gradientFrom: '#0ea5e9',
        gradientTo: '#a855f7',
        emojis: ['✦', '✴', '✹', '✷', '✼', '✵', '✸', '✧'],
        palette: ['#c7d2fe', '#bae6fd', '#fecdd3', '#bbf7d0'],
      }),
    },
  },
}

function Icon({ children, size = 44, label, style = {} }) {
  return (
    <div title={label} aria-label={label} style={{ width:size, height:size, display:'inline-flex', alignItems:'center', justifyContent:'center', ...style }}>
      <svg width={size} height={size} viewBox="0 0 64 64" role="img">{children}</svg>
    </div>
  )
}

const CLIPART_SETS = {
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

const ThemeClipArt = React.memo(function ThemeClipArt({ themeKey }) {
  const pool = CLIPART_SETS[themeKey] || CLIPART_SETS.classic
  const dense = useMemo(() => {
    const items = []
    const total = 260
    for (let i = 0; i < total; i += 1) {
      const base = pool[i % pool.length]
      const size = 18 + (i % 12) * 2
      const rotation = Math.floor(Math.random() * 360)
      const column = i % 3
      const xSpread = column === 0 ? Math.random() * 28 : column === 1 ? 36 + Math.random() * 28 : 72 + Math.random() * 24
      const ySpread = Math.random() * 100
      const jitter = (i % 5) * 0.07
      items.push(React.cloneElement(base, {
        key: `${themeKey}-${i}`,
        size,
        style: {
          position: 'absolute',
          left: `${Math.min(98, xSpread)}%`,
          top: `${Math.min(98, ySpread)}%`,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          opacity: 0.18 + jitter,
        },
      }))
    }
    return items
  }, [pool, themeKey])

  return <div className="clipLayer">{dense}</div>
})


function applyThemeVars(themeKey) {
  const t = THEMES[themeKey] || THEMES.classic
  const root = document.documentElement
  Object.entries(t.vars).forEach(([k,v]) => {
    if (k === 'bgImage') {
      root.style.setProperty('--bg-image', v)
    } else {
      root.style.setProperty(`--${k}`, v)
    }
  })
}

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const pathParts = useMemo(() => window.location.pathname.split('/').filter(Boolean), [])
  const roomFromPath = useMemo(() => {
    if (pathParts[0] === 'r' && pathParts[1]) return pathParts[1]
    if (pathParts[0] && pathParts[0].length === 6) return pathParts[0]
    return null
  }, [pathParts])
  const roomFromUrl = params.get('room') || roomFromPath
  const titleFromUrl = params.get('title') ? decodeURIComponent(params.get('title')) : null
  const joinLanding = useMemo(
    () => pathParts[0] === 'join' || pathParts[0] === 'r' || !!roomFromPath || params.get('join') === '1',
    [params, pathParts, roomFromPath]
  )

  const [roomCode, setRoomCode] = useState(() => {
    const storedRoomCode = typeof localStorage !== 'undefined' ? localStorage.getItem('auction_last_room') : null
    if (roomFromUrl) return roomFromUrl
    if (storedRoomCode) return storedRoomCode
    if (joinLanding) return ''
    return generateRoomCode()
  })
  const [isHost] = useState(!roomFromUrl && !joinLanding)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 820px)').matches)

  useEffect(() => {
    const updateScale = () => {
      const widthScale = window.innerWidth / 1280
      const heightScale = window.innerHeight / 900
      const scale = Math.max(0.65, Math.min(1, widthScale, heightScale))
      document.documentElement.style.setProperty('--ui-scale', scale.toFixed(3))
      document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`)
    }

    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  const playerId = useMemo(() => getPlayerId(roomCode), [roomCode])

  const [joined, setJoined] = useState(isHost)
  const [landingRoomInput, setLandingRoomInput] = useState('')
  const [name, setName] = useState(() => (typeof localStorage !== 'undefined' ? localStorage.getItem('auction_player_name') : '') || '')

  const [room, setRoom] = useState(null)
  const [loadingRoom, setLoadingRoom] = useState(true)
  const roomRef = useMemo(() => (roomCode ? doc(db, 'rooms', roomCode) : null), [roomCode])
  const isGameHost = (room?.hostId && room.hostId === playerId) || isHost

  useEffect(() => {
    if (!roomRef) setLoadingRoom(false)
  }, [roomRef])

  useEffect(() => {
    setTimerHydrated(false)
  }, [roomRef])

  const [timeLeft, setTimeLeft] = useState(0)
  const [timerHydrated, setTimerHydrated] = useState(false)
  const [players, setPlayers] = useState([])

  // Host inputs
  const [gameTitle, setGameTitle] = useState(titleFromUrl || 'Family Auction')
  const [bidInput, setBidInput] = useState(20)
  const [increment, setIncrement] = useState(10)
  const [customTime, setCustomTime] = useState(60)
  const [startingFunds, setStartingFunds] = useState(400)
  const [customFundInputs, setCustomFundInputs] = useState({})
  // Theme + countdown beeps
  const [themeKey, setThemeKey] = useState('classic')
  const beeperRef = useRef(null)
  const whistleRef = useRef(null)
  const raiseWhistleRef = useRef(null)
  const raiseTripletRef = useRef(null)
  const sparkleRef = useRef(null)
  const [soundsEnabled, setSoundsEnabled] = useState(false)
  const beep10Ref = useRef({ sec: null })
  const initialRoomSyncRef = useRef(false)
  const previousBidRef = useRef(null)
  const lastBidSoundRef = useRef(null)
  const handledLockedBidRef = useRef(null)
  const lastLockedSoundRef = useRef(null)
  const lastWinningBidRef = useRef({ round: null, leaderId: null, amount: null })

  // Host + player notices
  const [hostWinningBidMessage, setHostWinningBidMessage] = useState('')
  
  // Player private notice
  const [privateNotice, setPrivateNotice] = useState('')
  const [mobileWinningNotice, setMobileWinningNotice] = useState('')
  const autoJoinAttemptedRef = useRef(null)

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    if (roomCode) localStorage.setItem('auction_last_room', roomCode)
  }, [roomCode])

  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    if (name) localStorage.setItem('auction_player_name', name)
  }, [name])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px)')
    const handleMobileChange = (event) => setIsMobile(event.matches)
    if (mq.addEventListener) {
      mq.addEventListener('change', handleMobileChange)
    } else {
      mq.addListener(handleMobileChange)
    }
    setIsMobile(mq.matches)
    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', handleMobileChange)
      } else {
        mq.removeListener(handleMobileChange)
      }
    }
  }, [])

  // Create room if host (idempotent)
  useEffect(() => {
    if (!isHost) return
    if (!roomRef) return
    ;(async () => {
      const snap = await getDoc(roomRef)
      if (snap.exists()) return
      await setDoc(roomRef, {
        hostId: playerId,
        title: gameTitle || 'Auction Game',
        theme: 'classic',
        started: false,
        roundReady: false,
        currentBid: 20,
        baseBid: 20,
        increment: 10,
        currentPriceHasBid: false,
        leadingBid: null,
        revealedWinner: null,
        startingFunds: 400,
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
    if (!roomRef) return undefined
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
    if (!roomCode) return undefined
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

  useEffect(() => {
    if (isHost) return
    const me = players.find((p) => p.id === playerId)
    if (me) {
      if (!joined) setJoined(true)
      if (me.name && me.name !== name) setName(me.name)
    }
  }, [players, playerId, isHost, joined, name])


  // Keep host inputs in sync (first load)
  useEffect(() => {
    initialRoomSyncRef.current = false
  }, [roomCode])

  useEffect(() => {
    if (!room) return

    if (!initialRoomSyncRef.current) {
      setIncrement(room.increment ?? 10)
      setCustomTime(room.timer?.durationSec ?? 60)
      setBidInput(room.currentBid ?? 20)
      setStartingFunds(room.startingFunds ?? 400)
      if (room.title) setGameTitle(room.title)
      if (room.theme) setThemeKey(room.theme)
      initialRoomSyncRef.current = true
      return
    }

    if (!isHost) {
      if (room.title) setGameTitle(room.title)
      if (room.theme && room.theme !== themeKey) setThemeKey(room.theme)
    }
  }, [room, isHost, themeKey])

  // Apply theme vars to page
  useEffect(() => {
    applyThemeVars(themeKey)
  }, [themeKey])

  useEffect(() => {
    if (!isGameHost) return
    if (!roomRef) return
    if (!room) return
    if (room.theme === themeKey) return
    updateDoc(roomRef, { theme: themeKey }).catch(() => {})
  }, [isGameHost, room, roomRef, themeKey])

  // Init beeper (host creates audio context)
  useEffect(() => {
    if (!isGameHost) return
    if (!beeperRef.current) beeperRef.current = createCountdownBeeps()
  }, [isGameHost])
  // Timer computed locally from room.timer
  const hasTimer = !!room?.timer
  const endAtMs = room?.timer?.endAtMs || 0
  const paused = !!room?.timer?.paused
  const pausedRemainingSec = room?.timer?.pausedRemainingSec || 0

  useEffect(() => {
    if (!room?.started) {
      const pending = Math.max(0, Math.floor(Number(room?.timer?.pausedRemainingSec ?? room?.timer?.durationSec ?? 0)))
      setTimeLeft(pending)
      setTimerHydrated(true)
      return
    }
    if (paused) {
      setTimeLeft(pausedRemainingSec)
      setTimerHydrated(true)
      return
    }
    if (!endAtMs || endAtMs <= 0) {
      setTimeLeft(0)
      setTimerHydrated(hasTimer || !!endAtMs)
      return
    }
    const tick = () => {
      const msLeft = Math.max(0, endAtMs - nowMs())
      setTimeLeft(Math.ceil(msLeft / 1000))
      setTimerHydrated(true)
    }
    tick()
    const t = setInterval(tick, 250)
    return () => clearInterval(t)
  }, [room?.started, paused, pausedRemainingSec, endAtMs, hasTimer])

  // Final 10-second countdown beeps (HOST ONLY) — option 1 (every second 10..1)
  useEffect(() => {
    if (!isGameHost) return
    if (!room?.started) return
    if (!roomRef) return
    if (!soundsEnabled) return
    if (!beeperRef.current) return

    if (timeLeft > 10) {
      beep10Ref.current = { sec: null }
      return
    }

    if (timeLeft <= 10 && timeLeft >= 1 && beep10Ref.current.sec !== timeLeft) {
      beep10Ref.current.sec = timeLeft
      beeperRef.current.beepFinal(timeLeft)
    }
  }, [timeLeft, isGameHost, room?.started, soundsEnabled])

  const revealWinner = useCallback(async () => {
    if (!roomRef) return
    if (!timerHydrated) return
    await runTransaction(db, async (tx) => {
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
  }, [roomCode, roomRef, timerHydrated])

  // Auto reveal winner at 0
  const didAutoRevealRef = useRef(false)
  useEffect(() => {
    if (!room?.started) return
    if (room?.revealedWinner) return
    if (!timerHydrated) return
    if (timeLeft > 0) {
      didAutoRevealRef.current = false
      return
    }
    if (didAutoRevealRef.current) return
    didAutoRevealRef.current = true
    revealWinner()
  }, [room?.started, room?.revealedWinner, timeLeft, revealWinner, timerHydrated])

  const joinUrl = useMemo(() => {
    const url = new URL('/', window.location.origin)
    url.searchParams.set('join', '1')
    if (roomCode) url.searchParams.set('room', roomCode)
    return url.toString()
  }, [roomCode])

  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('isFullscreen', isFullscreen)
  }, [isFullscreen])

  const scrollPageByViewport = useCallback((direction = 1) => {
    const height = window.innerHeight || document.documentElement?.clientHeight || 0
    if (!height) return
    window.scrollBy({ top: height * direction, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const handleWheel = (event) => {
      if (event.ctrlKey || event.metaKey) return
      if (Math.abs(event.deltaY) < 30) return
      event.preventDefault()
      scrollPageByViewport(event.deltaY > 0 ? 1 : -1)
    }

    const handlePageKey = (event) => {
      if (event.key === 'PageDown' || event.key === 'PageUp') {
        event.preventDefault()
        scrollPageByViewport(event.key === 'PageDown' ? 1 : -1)
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('keydown', handlePageKey)
    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handlePageKey)
    }
  }, [scrollPageByViewport])

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

  const playSparkleSound = useCallback(async () => {
    if (typeof window === 'undefined') return
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    if (!sparkleRef.current) {
      sparkleRef.current = { ctx: new AudioContext() }
    }
    const { ctx } = sparkleRef.current
    if (ctx.state === 'suspended') {
      try { await ctx.resume() } catch {}
    }

    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.setValueAtTime(1.25, now)
    master.gain.exponentialRampToValueAtTime(0.0001, now + 3)

    const shimmer = ctx.createBiquadFilter()
    shimmer.type = 'highpass'
    shimmer.frequency.value = 900
    shimmer.Q.value = 1.1
    shimmer.connect(master)

    master.connect(ctx.destination)

    const chime = (start, freq, duration = 1.5, detune = 0) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + start)
      if (detune) osc.detune.setValueAtTime(detune, now + start)

      const g = ctx.createGain()
      g.gain.setValueAtTime(1.2, now + start)
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + duration)

      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null
      if (panner) panner.pan.setValueAtTime(Math.random() * 1.2 - 0.6, now + start)

      if (panner) {
        osc.connect(g)
        g.connect(panner)
        panner.connect(shimmer)
      } else {
        osc.connect(g)
        g.connect(shimmer)
      }

      osc.start(now + start)
      osc.stop(now + start + duration)
    }

    const airy = ctx.createOscillator()
    airy.type = 'triangle'
    airy.frequency.setValueAtTime(420, now)
    airy.frequency.exponentialRampToValueAtTime(260, now + 1.4)
    const airyGain = ctx.createGain()
    airyGain.gain.setValueAtTime(0.18, now)
    airyGain.linearRampToValueAtTime(0.01, now + 1.6)
    airy.connect(airyGain)
    airyGain.connect(shimmer)
    airy.start(now)
    airy.stop(now + 1.6)

    chime(0, 1568, 1.6, 6)
    chime(0.08, 1175, 1.4, -4)
    chime(0.18, 2093, 1.25, 9)
    chime(0.32, 880, 1.7, -3)
    chime(0.5, 1318, 1.5, -6)
    chime(0.62, 1760, 1.3, 5)
  }, [])

  const playBidWhistle = useCallback(
    async (force = false) => {
      const tryBackupWhistle = () => {
        try {
          if (!whistleRef.current) whistleRef.current = createCountdownBeeps()
          whistleRef.current.setVolume?.(1)
          whistleRef.current.playWhistle?.()
        } catch {
          playSparkleSound()
        }
      }

      try {
        if (!whistleRef.current) whistleRef.current = createBidWhistle()
        if (isGameHost && !soundsEnabled && !force) return
        await whistleRef.current.unlock?.()
        whistleRef.current.setVolume?.(1)
        whistleRef.current.play?.()
      } catch {
        tryBackupWhistle()
      }
    },
    [isGameHost, soundsEnabled, playSparkleSound]
  )

  const playHostRaiseWhistle = useCallback(async () => {
    const fallback = () => playBidWhistle(true)

    try {
      if (!raiseWhistleRef.current) raiseWhistleRef.current = createHostRaiseWhistle()
      await raiseWhistleRef.current.unlock?.()
      raiseWhistleRef.current.setVolume?.(1)
      raiseWhistleRef.current.stop?.()
      raiseWhistleRef.current.play?.()
    } catch {
      try {
        fallback()
      } catch {}
    }
  }, [playBidWhistle])

  const playHostRaiseTriplet = useCallback(async () => {
    const fallback = () => playHostRaiseWhistle()

    try {
      if (!raiseTripletRef.current) raiseTripletRef.current = createHostRaiseTriplet()
      await raiseTripletRef.current.unlock?.()
      raiseTripletRef.current.setVolume?.(1)
      raiseTripletRef.current.stop?.()
      await raiseTripletRef.current.play?.()
    } catch {
      try {
        fallback()
      } catch {}
    }
  }, [playHostRaiseWhistle])

  const playClapCelebration = useCallback(async () => {
    try {
      if (!beeperRef.current) beeperRef.current = createCountdownBeeps()
      if (isGameHost && !soundsEnabled) return
      await beeperRef.current.unlock?.()
      beeperRef.current.playClaps?.()
    } catch {
      playSparkleSound()
    }
  }, [isGameHost, soundsEnabled])

  // Join player
  const joinRoom = async () => {
    const trimmedName = name.trim()
    const trimmedRoomCode = roomCode.trim().toUpperCase()
    if (!trimmedName) return
    if (!trimmedRoomCode) return
    if (trimmedRoomCode !== roomCode) setRoomCode(trimmedRoomCode)

    const targetRoomRef = doc(db, 'rooms', trimmedRoomCode, 'players', playerId)
    const roomDocRef = doc(db, 'rooms', trimmedRoomCode)
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomDocRef)
      if (!snap.exists()) return
      const playerSnap = await tx.get(targetRoomRef)
      const roomData = snap.exists() ? snap.data() : {}
      const existing = playerSnap.exists() ? playerSnap.data() : {}
      const baseFunds = Math.max(0, Number(roomData?.startingFunds ?? room?.startingFunds ?? startingFunds ?? 400))
      tx.set(
        targetRoomRef,
        {
          name: trimmedName,
          joinedAt: serverTimestamp(),
          balance: existing?.balance ?? baseFunds,
        },
        { merge: true }
      )
    })
    setJoined(true)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('auction_last_room', trimmedRoomCode)
      localStorage.setItem('auction_player_name', trimmedName)
    }
  }

  useEffect(() => {
    if (isGameHost) return
    if (!joinLanding) return
    if (joined) return
    if (!roomCode || !name) return
    if (autoJoinAttemptedRef.current === roomCode) return
    autoJoinAttemptedRef.current = roomCode
    joinRoom()
  }, [isGameHost, joinLanding, joined, roomCode, name])

  // Host actions
  const buildTimerState = (durationSec) => {
    const duration = Math.max(1, Math.floor(Number(durationSec) || 60))
    const end = nowMs() + duration * 1000
    return { durationSec: duration, endAtMs: end, paused: false, pausedRemainingSec: 0, updatedAt: serverTimestamp() }
  }

  const buildPausedTimerState = (durationSec) => {
    const duration = Math.max(1, Math.floor(Number(durationSec) || 60))
    return { durationSec: duration, endAtMs: 0, paused: true, pausedRemainingSec: duration, updatedAt: serverTimestamp() }
  }

  const hostSaveMeta = async () => {
    if (!isGameHost) return
    if (!roomRef) return
    await updateDoc(roomRef, {
      title: gameTitle || 'Auction Game',
      theme: themeKey,
      startingFunds: Math.max(0, Number(startingFunds) || 0),
    })
  }

  const hostApplyStartingFunds = async () => {
    if (!isGameHost) return
    if (!roomRef) return
    const base = Math.max(0, Number(startingFunds) || 0)
    setStartingFunds(base)
    await updateDoc(roomRef, { startingFunds: base })
    const playersRef = collection(db, 'rooms', roomCode, 'players')
    const snap = await getDocs(playersRef)
    await Promise.all(snap.docs.map((p) => setDoc(p.ref, { balance: base }, { merge: true })))
  }

  const hostStartGame = async () => {
    if (!isGameHost) return
    if (!roomRef) return
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef)
      if (!snap.exists()) return
      const data = snap.data()
      const timerState = buildPausedTimerState(customTime || data?.timer?.durationSec || 60)
      const base = Math.max(0, Number(data.baseBid ?? bidInput ?? 20))
      tx.update(roomRef, {
        title: gameTitle || data.title || 'Auction Game',
        theme: themeKey,
        started: false,
        roundReady: true,
        revealedWinner: null,
        currentPriceHasBid: false,
        leadingBid: null,
        currentBid: base,
        timer: timerState,
        roundNumber: 1,
      })
    })
  }

  const hostSetBidBase = async () => {
    if (!isGameHost) return
    if (!roomRef) return
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
    if (!roomRef) return
    const base = Number(room?.baseBid ?? 20)
    await updateDoc(roomRef, { currentBid: base, currentPriceHasBid: false, revealedWinner: null })
  }

  const hostPickIncrement = async (v) => {
    if (!isGameHost) return
    if (!roomRef) return
    setIncrement(v)
    await updateDoc(roomRef, { increment: v })
    await playBidWhistle(true)
  }

  const hostRaiseBid = async () => {
    if (!isGameHost) return
    if (!roomRef) return
    const inc = Number(room?.increment ?? increment ?? 10)
    const base = Number(room?.baseBid ?? 0)
    const next = Math.max(base, Number(room?.currentBid ?? 0) + inc)
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef)
      if (!snap.exists()) return
      const data = snap.data()
      tx.update(roomRef, {
        currentBid: next,
        currentPriceHasBid: false,
        revealedWinner: null,
        leadingBid: data.leadingBid || null,
      })
    })
    await playHostRaiseTriplet()
  }

  // Timer
  const hostSetTimerDuration = async () => {
    if (!isGameHost) return
    if (!roomRef) return
    const timerState = buildPausedTimerState(customTime)
    await updateDoc(roomRef, { timer: timerState })
    setCustomTime(timerState.durationSec)
  }

  const hostTimerStart = async () => {
    if (!isGameHost) return
    if (!roomRef) return
    const timerState = buildTimerState(customTime)
    await updateDoc(roomRef, {
      timer: timerState,
      currentPriceHasBid: false,
      leadingBid: null,
      revealedWinner: null,
    })
  }

  const hostTimerPause = async () => {
    if (!isGameHost) return
    if (!roomRef) return
    const remaining = Math.max(0, Math.floor(timeLeft))
    await updateDoc(roomRef, {
      timer: { durationSec: Number(room?.timer?.durationSec ?? customTime ?? 60), endAtMs: 0, paused: true, pausedRemainingSec: remaining, updatedAt: serverTimestamp() },
    })
  }

  const hostTimerResume = async () => {
    if (!isGameHost) return
    if (!roomRef) return
    const remaining = Math.max(0, Math.floor(room?.timer?.pausedRemainingSec ?? timeLeft ?? 0))
    const end = nowMs() + remaining * 1000
    await updateDoc(roomRef, {
      timer: { durationSec: Number(room?.timer?.durationSec ?? customTime ?? 60), endAtMs: end, paused: false, pausedRemainingSec: 0, updatedAt: serverTimestamp() },
    })
  }

  const hostTimerEnd = async () => {
    if (!isGameHost) return
    if (!roomRef) return
    await updateDoc(roomRef, {
      timer: { durationSec: Number(room?.timer?.durationSec ?? customTime ?? 60), endAtMs: 0, paused: false, pausedRemainingSec: 0, updatedAt: serverTimestamp() },
    })
  }

  const hostAddFunds = async (targetPlayerId, delta) => {
    if (!isGameHost || !targetPlayerId) return
    if (!roomRef) return
    const change = Number(delta)
    if (!Number.isFinite(change)) return
    const pRef = doc(db, 'rooms', roomCode, 'players', targetPlayerId)
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(pRef)
      if (!snap.exists()) return
      const current = Number(snap.data()?.balance ?? room?.startingFunds ?? 0)
      const next = Math.max(0, current + change)
      tx.update(pRef, { balance: next })
    })
  }

  const hostAddCustomFunds = async (targetPlayerId) => {
    const raw = customFundInputs?.[targetPlayerId]
    const delta = Number(raw)
    if (!Number.isFinite(delta)) return
    await hostAddFunds(targetPlayerId, delta)
    setCustomFundInputs((prev) => ({ ...prev, [targetPlayerId]: '' }))
  }

  const hostRemovePlayer = async (targetPlayerId) => {
    if (!isGameHost || !targetPlayerId) return
    if (!roomCode) return
    const pRef = doc(db, 'rooms', roomCode, 'players', targetPlayerId)
    await deleteDoc(pRef)
  }

  const hostNextRound = async () => {
    if (!isGameHost) return
    if (!roomRef) return
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef)
      if (!snap.exists()) return
      const data = snap.data()
      const nextRound = Number(data.roundNumber ?? 1) + 1
      const base = Number(data.baseBid ?? 20)
      const timerDuration = Number(customTime || data.timer?.durationSec || 60)
      const timerState = buildPausedTimerState(timerDuration)
      tx.update(roomRef, {
        roundNumber: nextRound,
        revealedWinner: null,
        leadingBid: null,
        currentPriceHasBid: false,
        currentBid: base,
        timer: timerState,
        started: false,
        roundReady: true,
      })
    })
    setPrivateNotice('')
  }

  const hostStartRound = async () => {
    if (!isGameHost) return
    if (!roomRef) return
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef)
      if (!snap.exists()) return
      const data = snap.data()
      const duration = Number(data.timer?.pausedRemainingSec || data.timer?.durationSec || customTime || 60)
      const timerState = buildTimerState(duration)
      tx.update(roomRef, { started: true, roundReady: false, revealedWinner: null, timer: timerState, currentPriceHasBid: false })
    })
    setPrivateNotice('')
    if (soundsEnabled) {
      if (!beeperRef.current) beeperRef.current = createCountdownBeeps()
      try {
        await beeperRef.current.unlock?.()
        beeperRef.current.playGunshot?.()
      } catch {}
    }
  }

  const hostStartRoundFromReady = async () => {
    if (room?.started) return
    if (!room?.roundReady) {
      await hostStartGame()
    }
    await hostStartRound()
  }

  const hostEndGame = async () => {
    if (!isGameHost) return
    if (!roomRef) return
    const playersRef = collection(db, 'rooms', roomCode, 'players')
    const bidsRef = collection(db, 'rooms', roomCode, 'bids')

    try {
      const [playerSnap, bidsSnap] = await Promise.all([getDocs(playersRef), getDocs(bidsRef)])
      await Promise.all([
        ...playerSnap.docs.map((d) => deleteDoc(d.ref)),
        ...bidsSnap.docs.map((d) => deleteDoc(d.ref)),
      ])
      await deleteDoc(roomRef)
    } catch {}

    const newCode = generateRoomCode()
    setGameTitle('Family Auction')
    setThemeKey('classic')
    setStartingFunds(400)
    setBidInput(20)
    setIncrement(10)
    setCustomTime(60)
    setRoom(null)
    setPlayers([])
    setCustomFundInputs({})
    setTimeLeft(0)
    setTimerHydrated(false)
    setLoadingRoom(true)
    setJoined(isHost)
    setPrivateNotice('')
    setMobileWinningNotice('')
    initialRoomSyncRef.current = false
    setRoomCode(newCode)
  }

  // Player bid (first tap wins at current price)
  const playerBid = async () => {
    if (!room?.started) return
    if (!roomRef) return
    if (timeLeft <= 0) return

    const isCurrentLeader = room?.leadingBid?.playerId === playerId && room?.currentPriceHasBid
    const preserveWinningNotice = isMobile && isCurrentLeader

    if (!preserveWinningNotice) {
      setPrivateNotice('')
    }

    const pRef = doc(db, 'rooms', roomCode, 'players', playerId)
    const bidsCol = collection(db, 'rooms', roomCode, 'bids')
    const bidMoment = nowMs()

    try {
      const result = await runTransaction(db, async (tx) => {
        const snap = await tx.get(roomRef)
        if (!snap.exists()) return { ok:false, reason:'no-room' }
        const data = snap.data()
        const current = Number(data.currentBid ?? 0)

        const pSnap = await tx.get(pRef)
        const pName = (pSnap.exists() && pSnap.data().name) ? pSnap.data().name : 'Player'
        const starting = Number(data.startingFunds ?? startingFunds ?? 0)
        const balance = pSnap.exists() && pSnap.data()?.balance != null ? Number(pSnap.data().balance) : starting
        if (balance < current) return { ok:false, reason:'insufficient', amount: current, balance }

        const alreadyClaimed = data.currentPriceHasBid && Number(data.leadingBid?.amount ?? 0) === current
        if (alreadyClaimed) return { ok:false, reason:'already-claimed', amount: current, name: data.leadingBid?.name }

        const previousBidTs = Number(data.leadingBid?.tsMs ?? 0)
        const tsMs = Math.max(bidMoment, previousBidTs + 1)
        const leading = { playerId, name: pName, amount: current, ts: serverTimestamp(), tsMs }
        tx.update(roomRef, { currentPriceHasBid: true, leadingBid: leading, revealedWinner: null })
        return { ok:true, name:pName, amount: current, balance }
      })

      if (result.ok) {
        await addDoc(bidsCol, { playerId, name: result.name, amount: result.amount, ts: serverTimestamp() })
        const winningMessage = `✅ You’re currently winning at $${result.amount}`
        setPrivateNotice(winningMessage)
        if (isMobile && !isGameHost) {
          setMobileWinningNotice(winningMessage)
        }
        sayBidPlaced()
        playSparkleSound()
      } else if (result.reason === 'already-claimed') {
        if (preserveWinningNotice) return
        setPrivateNotice('Current bid is locked in. Wait for the next raise to bid again.')
      } else if (result.reason === 'insufficient') {
        setPrivateNotice(`❌ Not enough funds for $${result.amount}. Balance: $${Math.max(0, Math.round(result.balance ?? 0))}`)
      } else if (result.reason === 'no-room') {
        setPrivateNotice('⚠️ Room missing. Refresh and try again.')
      } else {
        setPrivateNotice('❌ Another bid was placed first. Try again!')
      }
    } catch {
      setPrivateNotice('⚠️ Bid failed. Try again.')
    }
  }

    const currentBid = Number(room?.currentBid ?? 0)
    const showWinner = !!room?.revealedWinner && timerHydrated && timeLeft <= 0
    const stagedStatusText = isGameHost || !isMobile
      ? 'Round is staged. Update settings and tap Start Round when ready.'
      : 'Waiting for the next round to start'
    const statusText = showWinner
      ? room?.revealedWinner?.name
        ? `${room.revealedWinner.name} won this round at $${room.revealedWinner.amount}`
        : 'Round finished.'
      : room?.roundReady && !room?.started
        ? stagedStatusText
        : room?.currentPriceHasBid
          ? 'Current bid is locked in. Wait for the next raise to bid again.'
          : 'Waiting for bids'
    const statusKind = showWinner || room?.currentPriceHasBid ? 'ok' : 'warn'
    const activeThemeKey = room?.theme || themeKey
    const roundNumber = Number(room?.roundNumber ?? 1)
    const you = players.find((p) => p.id === playerId)
    const myBalance = Math.max(0, Math.round(Number(you?.balance ?? room?.startingFunds ?? startingFunds ?? 0)))
    const MAX_PLAYERS_PER_RAIL = 20
    const livePlayerColumns = useMemo(() => {
      const left = players.slice(0, MAX_PLAYERS_PER_RAIL)
      const right = players.slice(MAX_PLAYERS_PER_RAIL)
      return { left, right }
    }, [players])
    const renderPlayerRail = (columnPlayers, position) => (
      <div className={`playerRail ${position}Rail`} aria-label={`Live players ${position} rail`}>
        <div className="boxTitle">Live Players</div>
        <div className="playerRailList" aria-live="polite">
          {columnPlayers.length === 0 && <p className="small">Waiting for players…</p>}
          {columnPlayers.length > 0 &&
            columnPlayers.map((p) => (
              <div key={p.id} className="playerRailChip">
                <div className="playerRailHeader">
                  <div className="playerRailName">{p.name || 'Player'}</div>
                  <div className="playerRailBalance">${Math.max(0, Math.round(Number(p.balance ?? room?.startingFunds ?? startingFunds ?? 0)))}</div>
                </div>
                {isGameHost && (
                  <div className="playerRailActions">
                    <input
                      type="number"
                      min={0}
                      placeholder="Custom"
                      value={customFundInputs[p.id] ?? ''}
                      onChange={(e) => setCustomFundInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    />
                    <button onClick={() => hostAddCustomFunds(p.id)}>Add</button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Remove ${p.name || 'player'} from the room?`)) hostRemovePlayer(p.id)
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    )
    const showLivePlayers = !isGameHost && !isMobile
    const isLockedOutNotice =
      !!privateNotice && privateNotice.toLowerCase().includes('another player locked in the winning bid')
    const showMobileTopNotice = isMobile && !isGameHost && isLockedOutNotice
    const shouldShowBottomNotice =
      privateNotice &&
      !isGameHost &&
      (!isMobile || (privateNotice !== mobileWinningNotice && !showMobileTopNotice))

  useEffect(() => {
    if (!room) return
    const current = Number(room.currentBid ?? 0)
    const hasStarted = room.started || room.roundReady

    if (previousBidRef.current !== null && current !== previousBidRef.current && hasStarted) {
      if (!isGameHost) {
        setPrivateNotice(`📢 New bid alert! Current price is $${current}.`)
        playHostRaiseTriplet()
      }
    }
    previousBidRef.current = current
  }, [room?.currentBid, room?.started, room?.roundReady, isGameHost, playHostRaiseTriplet])

  useEffect(() => {
    if (!room) return
    const current = Number(room.currentBid ?? 0)
    const hasStarted = room.started || room.roundReady
    if (lastBidSoundRef.current !== null && current > lastBidSoundRef.current && hasStarted) {
      playHostRaiseTriplet()
    }
    lastBidSoundRef.current = current
  }, [room?.currentBid, room?.started, room?.roundReady, playHostRaiseTriplet])

  useEffect(() => {
    if (!room) return

    const roundNumber = Number(room.roundNumber ?? 1)
    const hasLockedLeader = room.currentPriceHasBid && room.leadingBid?.playerId

    if (!hasLockedLeader || room.revealedWinner) {
      if (lastWinningBidRef.current.round !== roundNumber || room.revealedWinner) {
        setHostWinningBidMessage('')
        if (!isGameHost && isMobile) setMobileWinningNotice('')
        lastWinningBidRef.current = { round: roundNumber, leaderId: null, amount: null }
      }
      return
    }

    const leaderId = room.leadingBid.playerId
    const amount = Number(room.leadingBid.amount ?? room.currentBid ?? 0)
    const last = lastWinningBidRef.current
    const changed = last.round !== roundNumber || last.leaderId !== leaderId || last.amount !== amount

    if (changed) {
      lastWinningBidRef.current = { round: roundNumber, leaderId, amount }
      setHostWinningBidMessage(`Current winning bid: $${amount}`)

      if (!isGameHost && isMobile) {
        const message = leaderId === playerId
          ? `✅ You’re currently winning at $${amount}`
          : `Winning bid locked at $${amount}`
        setMobileWinningNotice(message)
      }
      return
    }

    if (!isGameHost && isMobile && leaderId === playerId && !mobileWinningNotice) {
      setMobileWinningNotice(`✅ You’re currently winning at $${amount}`)
    }
  }, [
    room?.currentPriceHasBid,
    room?.leadingBid?.playerId,
    room?.leadingBid?.amount,
    room?.currentBid,
    room?.roundNumber,
    room?.revealedWinner,
    isMobile,
    isGameHost,
    playerId,
    mobileWinningNotice,
  ])

    useEffect(() => {
      if (!room) return
      if (isGameHost) return
      if (!isMobile) return

      if (!room.currentPriceHasBid) {
        handledLockedBidRef.current = null
        return
      }

      const lockKey = `${room.leadingBid?.playerId ?? 'none'}-${room.leadingBid?.tsMs ?? '0'}-${room.leadingBid?.amount ?? '0'}`
      if (handledLockedBidRef.current === lockKey) return
      handledLockedBidRef.current = lockKey

      if (room.leadingBid?.playerId === playerId) {
        const amount = Number(room.leadingBid?.amount ?? room.currentBid ?? 0)
        setPrivateNotice(`🎉 You won this bid at $${amount}!`)
        setMobileWinningNotice(`✅ You’re currently winning at $${amount}`)
      } else {
        setPrivateNotice('⏱️ Too slow! Another player locked in the winning bid.')
      }
    }, [room?.currentPriceHasBid, room?.leadingBid?.playerId, room?.leadingBid?.tsMs, room?.leadingBid?.amount, room?.currentBid, isGameHost, isMobile, playerId])

    useEffect(() => {
      if (!room) return
      if (!room.currentPriceHasBid) {
        lastLockedSoundRef.current = null
        return
      }

      const lockKey = `${room.leadingBid?.playerId ?? 'none'}-${room.leadingBid?.tsMs ?? room.currentBid ?? '0'}`
      if (lastLockedSoundRef.current === lockKey) return
      lastLockedSoundRef.current = lockKey
      playClapCelebration()
    }, [room?.currentPriceHasBid, room?.leadingBid?.playerId, room?.leadingBid?.tsMs, room?.currentBid, playClapCelebration])

    if (joinLanding && !roomCode) {
      return (
        <div className="app">
          <div className="card" style={{ maxWidth: 520 }}>
            <h1>Join a Room</h1>
            <p className="small">Enter the room code from your host to jump in.</p>
            <div className="row" style={{ marginTop: 10 }}>
              <input
                value={landingRoomInput}
                onChange={(e) => setLandingRoomInput(e.target.value.toUpperCase())}
                placeholder="Room code"
                maxLength={8}
              />
              <button
                onClick={() => {
                  const trimmed = landingRoomInput.trim().toUpperCase()
                  if (!trimmed) return
                  setRoomCode(trimmed)
                  setRoom(null)
                  setPlayers([])
                  setLoadingRoom(true)
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )
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
            <p className="small">Enter your room code first, then add your name to join.</p>
            <div className="row" style={{ marginTop: 10 }}>
              <input
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Room code"
                maxLength={8}
              />
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              <button onClick={joinRoom}>Join Room</button>
            </div>
          </div>
        </div>
      )
    }

    if (showWinner) {
      const winnerPlayer = players.find((p) => p.id === room?.revealedWinner?.playerId)
      const winnerBalance = Math.max(0, Math.round(Number(winnerPlayer?.balance ?? room?.startingFunds ?? startingFunds ?? 0)))
      return (
        <div className={`app scorePage${isFullscreen ? ' isFullscreen' : ''}`}>
          {renderPlayerRail(livePlayerColumns.left, 'left')}

          <div className="card scoreCard" style={{ width: 'min(1100px, 100%)' }}>
            <div className="themeBackdrop" aria-hidden="true" />
            <div className="pill">Round {roundNumber}</div>
            <h1>{room?.title || gameTitle || 'Auction Game'}</h1>
            <p className="small">Timer hit zero — here are the winning results.</p>

            <div className="scoreboard" style={{ marginTop: 10 }}>
              <div className="boxTitle">Winning Results</div>
              <div className="scoreboardRow">
                <div>
                  <p className="small">Winner</p>
                  <h2>{room.revealedWinner?.name}</h2>
                </div>
                <div className="scoreboardMeta">
                  <p className="small">Winning Bid</p>
                  <div className="scoreboardAmount">${room.revealedWinner?.amount}</div>
                </div>
              </div>
              <div className="scoreboardRow">
                <div />
                <div className="scoreboardMeta">
                  <p className="small">Remaining Balance</p>
                  <div className="scoreboardAmount">${winnerBalance}</div>
                </div>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              {isGameHost && (
                <>
                  <button onClick={hostNextRound}>Next Round</button>
                  <button onClick={toggleFullscreen}>Full Screen</button>
                  <button onClick={hostEndGame}>End Game</button>
                </>
              )}
              {!isGameHost && !isMobile && <button onClick={toggleFullscreen}>Full Screen</button>}
            </div>
            {isGameHost && <p className="small">Add funds to players after a round, then start the next timer.</p>}
          </div>

          {renderPlayerRail(livePlayerColumns.right, 'right')}
        </div>
      )
    }

    const cardContent = (
      <div className="card" style={{ width: 'min(1200px, 100%)' }}>
        <div className="themeBackdrop" aria-hidden="true" />
        <h1>{room?.title || gameTitle || 'Auction Game'}</h1>

        {!isGameHost && (you?.name || name) && (
          <div className="chip selfNameChip" aria-label="Your player name">
            <span>You’re playing as</span>
            <strong>{you?.name || name}</strong>
          </div>
        )}

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

        {showLivePlayers && (
          <div className="controlBox" style={{ width: '100%', alignItems: 'flex-start', background: 'var(--card2)' }}>
            <div className="boxTitle">Live Players ({players.length})</div>
            {players.length === 0 && <p className="small">Waiting for players to register…</p>}
            {players.length > 0 && (
              <div className="playerGrid" aria-live="polite">
                {players.map((p) => (
                  <div key={p.id} className="playerChip">
                    <div className="playerChipName">{p.name}</div>
                    <div className="playerChipBalance">${Math.max(0, Math.round(Number(p.balance ?? room?.startingFunds ?? startingFunds ?? 0)))}</div>
                    {isGameHost && (
                      <div className="row fundButtons" style={{ marginTop: 6 }}>
                        <input
                          type="number"
                          min={0}
                          placeholder="Custom"
                          value={customFundInputs[p.id] ?? ''}
                          onChange={(e) => setCustomFundInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          style={{ width: 80 }}
                        />
                        <button onClick={() => hostAddCustomFunds(p.id)}>Add</button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Remove ${p.name || 'player'} from the room?`)) hostRemovePlayer(p.id)
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="joinSection" style={{ width: '100%' }}>
          <div className="qrWrap">
            <QRCode value={joinUrl} size={140} />
            <p className="small">Scan to open the join page.</p>
            <div className="roomCodeDisplay" aria-label="Room code">{roomCode}</div>
          </div>
        </div>

        <div className="row" style={{ gap: 8, justifyContent: 'center', width: '100%' }}>
          {isGameHost && !soundsEnabled && (
            <button
              onClick={async () => {
                try {
                  if (!beeperRef.current) beeperRef.current = createCountdownBeeps()
                  await beeperRef.current.unlock()
                  setSoundsEnabled(true)
                } catch {}
              }}
            >
              Enable Game Sounds
            </button>
          )}
          {isGameHost && soundsEnabled && (
            <button
              onClick={() => {
                setSoundsEnabled(false)
              }}
            >
              Disable Game Sounds
            </button>
          )}
          {isGameHost && !room?.started && <button onClick={hostStartRoundFromReady}>Start Round</button>}
          {isGameHost && (
            <button
              onClick={async () => {
                if (!room?.started) return
                await hostTimerEnd()
                setTimeLeft(0)
                await revealWinner()
              }}
              disabled={!room?.started}
              title="End the current round and show the winner results"
            >
              End Round
            </button>
          )}
          {isGameHost && <button onClick={hostEndGame}>End Game</button>}
          {(isGameHost || !isMobile) && <button onClick={toggleFullscreen}>Full Screen</button>}
        </div>

        <div className="hr" />

        <div>
          <p className="small">Current Bid</p>
          <div className="bid">${currentBid}</div>

          <div className="chip" style={{ marginTop: 8 }} aria-live="polite">
            <span className={"dot " + statusKind} />
            <span>{statusText}</span>
          </div>
          {isGameHost && hostWinningBidMessage && (
            <div className="chip winningChip" aria-live="polite" style={{ marginTop: 6 }}>
              <span>{hostWinningBidMessage}</span>
            </div>
          )}
          {!isGameHost && (
            <div className="chip balanceChip" aria-live="polite">
              <span>Remaining funds:</span>
              <strong>${myBalance}</strong>
            </div>
          )}
          {isMobile && mobileWinningNotice && (
            <div className="chip winningChip" aria-live="polite" style={{ marginTop: 6 }}>
              <span>{mobileWinningNotice}</span>
            </div>
          )}
          {showMobileTopNotice && (
            <div className="chip alertChip" aria-live="assertive" style={{ marginTop: 6 }}>
              <span className="alertGlow">{privateNotice}</span>
            </div>
          )}

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

          {shouldShowBottomNotice && (
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
                <button className="primaryBidButton" onClick={playerBid} disabled={timeLeft <= 0}>Bid ${currentBid}</button>
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
                <div className="row" style={{ gap: 8 }}>
                  <input
                    type="number"
                    min={1}
                    max={600}
                    value={customTime}
                    onChange={e => setCustomTime(Number(e.target.value))}
                  />
                  <button onClick={hostSetTimerDuration} disabled={!!room?.started}>Set</button>
                </div>
                <div className="row">
                  <button disabled={!room?.started || timeLeft <= 0} onClick={hostTimerPause}>Pause</button>
                  <button disabled={!room?.started || timeLeft <= 0} onClick={hostTimerResume}>Resume</button>
                  <button disabled={!room?.started || timeLeft > 0} onClick={hostTimerEnd}>End</button>
                </div>
                <p className="small">Remaining: <b>{formatTime(timeLeft)}</b> — rounds finish when the timer hits 0.</p>
              </div>

              <div className="boxDivider" />

              <div className="controlBox">
                <div className="boxTitle">Bid Setup</div>
                <input type="number" min={0} value={bidInput} onChange={e => setBidInput(Number(e.target.value))} />
                <div className="row" style={{ marginTop: 6 }}>
                  <button onClick={hostSetBidBase}>Set</button>
                  <button onClick={hostResetToBase}>Reset (${Number(room?.baseBid ?? 20)})</button>
                </div>
                <p className="small">Saved base: <b>${Number(room?.baseBid ?? 20)}</b></p>
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
    )

    return (
      <div className={`app${isFullscreen ? ' isFullscreen' : ''}`}>
        {isGameHost ? (
          <div className="hostStage">
            {renderPlayerRail(livePlayerColumns.left, 'left')}

            {cardContent}

            {renderPlayerRail(livePlayerColumns.right, 'right')}
          </div>
        ) : (
          cardContent
        )}
        {!isGameHost && room?.started && !isMobile && (
          <div className="mobileBidBar" aria-live="polite">
            <div className="mobileBidText">
              <p className="small">Tap to claim the current bid</p>
              <strong>${currentBid}</strong>
            </div>
            <button className="primaryBidButton mobileBidButton" onClick={playerBid} disabled={timeLeft <= 0}>
              Bid now
            </button>
          </div>
        )}
      </div>
    )
  }
