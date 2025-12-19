import React, { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode.react'

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function formatTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0)
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`
}

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const roomFromUrl = params.get('room')

  const [roomCode] = useState(roomFromUrl || generateRoomCode())
  const [isHost] = useState(!roomFromUrl)
  const [joined, setJoined] = useState(isHost)
  const [name, setName] = useState('')

  const [started, setStarted] = useState(false)

  const [minBid, setMinBid] = useState(50)
  const [minBidInput, setMinBidInput] = useState(50)
  const [currentBid, setCurrentBid] = useState(50)
  const [increment, setIncrement] = useState(10)

  const [customTime, setCustomTime] = useState(60)
  const [timeLeft, setTimeLeft] = useState(0)
  const [paused, setPaused] = useState(false)

  const [leadingBid, setLeadingBid] = useState(null)
  const [currentPriceHasBid, setCurrentPriceHasBid] = useState(false)
  const [revealedWinner, setRevealedWinner] = useState(null)
  const [playerPrivateNotice, setPlayerPrivateNotice] = useState('')

  useEffect(() => {
    if (!started || paused || timeLeft <= 0) return
    const t = setInterval(() => setTimeLeft(v => v - 1), 1000)
    return () => clearInterval(t)
  }, [started, paused, timeLeft])

  const didRevealRef = useRef(false)
  useEffect(() => {
    if (!started || timeLeft > 0 || didRevealRef.current) return
    didRevealRef.current = true
    setRevealedWinner(leadingBid || { name: 'No winner', amount: 0 })
  }, [started, timeLeft, leadingBid])

  const joinUrl = `${window.location.origin}?room=${roomCode}`

  const resetForNewPrice = (price) => {
    setCurrentBid(price)
    setCurrentPriceHasBid(false)
    setRevealedWinner(null)
  }

  const setMinAndReset = (val) => {
    const v = Math.max(0, Number(val) || 0)
    setMinBid(v)
    setMinBidInput(v)
    setLeadingBid(null)
    resetForNewPrice(v)
  }

  const handlePlayerBid = () => {
    if (!started || timeLeft <= 0) return
    if (!currentPriceHasBid) {
      setCurrentPriceHasBid(true)
      setLeadingBid({ name: name || 'Player', amount: currentBid })
      setPlayerPrivateNotice(`✅ You’re currently winning at $${currentBid}`)
    } else {
      setPlayerPrivateNotice(`❌ Too late — someone already bid first at $${currentBid}`)
    }
  }

  if (!joined) {
    return (
      <div className="app">
        <div className="card" style={{ maxWidth: 520 }}>
          <h1>Join Auction</h1>
          <p className="small">Enter your name to join room <b>{roomCode}</b></p>
          <input placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
          <button disabled={!name.trim()} onClick={() => setJoined(true)}>Join Room</button>
        </div>
      </div>
    )
  }

  if (!isHost) {
    return (
      <div className="app">
        <div className="card" style={{ maxWidth: 520 }}>
          <h1>Player</h1>
          {!started ? <p>Waiting for host…</p> : (
            <>
              <div className="bid">${currentBid}</div>
              <div className="chip">
                <span className={"dot " + (currentPriceHasBid ? 'ok' : 'warn')} />
                <span>{currentPriceHasBid ? 'Bid placed!' : `No bids at $${currentBid} yet`}</span>
              </div>
              <p className="small">Time left: <b>{formatTime(timeLeft)}</b></p>
              <button onClick={handlePlayerBid} style={{ width:'100%', fontSize:28 }}>TAP ${currentBid}</button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="card">
        <h1>Family Auction</h1>
        <h2>{roomCode}</h2>

        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
          <QRCode value={joinUrl} size={180} />
          {!started && <button onClick={() => setStarted(true)}>Start Game</button>}
        </div>

        {started && (
          <>
            <div className="hr" />
            <div className="bid">${currentBid}</div>
            <div className="hr" />

            <div className="controlsRow">
              <div className="controlBox">
                <div className="boxTitle">Timer</div>
                <input type="number" value={customTime} onChange={e=>setCustomTime(e.target.value)} />
                <button onClick={()=>{setTimeLeft(customTime);setPaused(false)}}>Start</button>
              </div>

              <div className="boxDivider" />

              <div className="controlBox">
                <div className="boxTitle">Bid Setup</div>
                <input type="number" value={minBidInput} onChange={e=>setMinBidInput(e.target.value)} />
                <div className="row">
                  <button onClick={()=>setMinAndReset(minBidInput)}>Set</button>
                  <button onClick={()=>resetForNewPrice(minBid)}>Reset</button>
                </div>
              </div>

              <div className="boxDivider" />

              <div className="controlBox">
                <div className="boxTitle">Raise Bid</div>
                {[5,10,15,20].map(v=>(
                  <button key={v} onClick={()=>{setIncrement(v);resetForNewPrice(currentBid+v)}}>+${v}</button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
