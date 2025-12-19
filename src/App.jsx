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
  const titleFromUrl = params.get('title')

  const [roomCode] = useState(roomFromUrl || generateRoomCode())
  const [isHost] = useState(!roomFromUrl)

  // Game title (host sets; sent via QR link as ?title=)
  const [gameTitle, setGameTitle] = useState(titleFromUrl || 'Family Auction')

  // Join flow
  const [joined, setJoined] = useState(isHost)
  const [name, setName] = useState('')

  // Game state (local-only for now; Firebase later)
  const [started, setStarted] = useState(false)

  // Bid state (host-controlled)
  const [minBid, setMinBid] = useState(50)
  const [minBidInput, setMinBidInput] = useState(50)
  const [currentBid, setCurrentBid] = useState(50)
  const [increment, setIncrement] = useState(10)

  // Timer state (host-controlled)
  const [customTime, setCustomTime] = useState(60) // seconds
  const [timeLeft, setTimeLeft] = useState(0)
  const [paused, setPaused] = useState(false)

  // Local demo bid tracking (Firebase later)
  const [leadingBid, setLeadingBid] = useState(null) // { name, amount }
  const [currentPriceHasBid, setCurrentPriceHasBid] = useState(false)

  // Winner reveal when round ends
  const [revealedWinner, setRevealedWinner] = useState(null) // { name, amount } | null

  // Player private message
  const [playerPrivateNotice, setPlayerPrivateNotice] = useState('')

  // countdown
  useEffect(() => {
    if (!started) return
    if (timeLeft <= 0) return
    if (paused) return
    const t = setInterval(() => setTimeLeft(v => v - 1), 1000)
    return () => clearInterval(t)
  }, [started, timeLeft, paused])

  // reveal winner on end (once)
  const didRevealRef = useRef(false)
  useEffect(() => {
    if (!started) return
    if (timeLeft > 0) { didRevealRef.current = false; return }
    if (didRevealRef.current) return
    didRevealRef.current = true
    setRevealedWinner(leadingBid || { name: 'No winner', amount: 0 })
  }, [started, timeLeft, leadingBid])

  const safeTitle = encodeURIComponent(gameTitle || 'Auction Game')
  const joinUrl = `${window.location.origin}?room=${roomCode}&title=${safeTitle}`

  const resetForNewPrice = (newPrice) => {
    setCurrentBid(newPrice)
    setCurrentPriceHasBid(false)
    setRevealedWinner(null)
    // Keep leadingBid so last bidder can still win if nobody bids at new price
  }

  const setMinAndReset = (val) => {
    const v = Math.max(0, Number(val) || 0)
    setMinBid(v)
    setMinBidInput(v)
    setLeadingBid(null)
    setCurrentPriceHasBid(false)
    setRevealedWinner(null)
    setCurrentBid(v)
  }

  const handlePlayerBid = () => {
    // Local-only behavior: first click in THIS browser tab "wins" the current price.
    // Firebase will make this real across devices later.
    if (!started) return
    if (timeLeft <= 0) return

    if (!currentPriceHasBid) {
      setCurrentPriceHasBid(true)
      const bid = { name: name || 'Player', amount: currentBid }
      setLeadingBid(bid)
      setPlayerPrivateNotice(`✅ You’re currently winning at $${currentBid}`)
    } else {
      setPlayerPrivateNotice(`❌ Too late — someone already bid first at $${currentBid}`)
    }
  }

  if (!joined) {
    return (
      <div className="app">
        <div className="card" style={{ maxWidth: 520 }}>
          <h1>{gameTitle || 'Auction Game'}</h1>
          <p className="small">Enter your name to join room <b>{roomCode}</b></p>
          <input placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
          <button disabled={!name.trim()} onClick={() => setJoined(true)}>Join Room</button>
        </div>
      </div>
    )
  }

  // PLAYER VIEW: bid + timer + status
  if (!isHost) {
    const statusText = currentPriceHasBid ? 'Bid placed!' : `No bids at $${currentBid} yet`
    const showWinner = started && timeLeft <= 0 && revealedWinner
    return (
      <div className="app">
        <div className="card" style={{ maxWidth: 520 }}>
          <h1>{gameTitle || 'Auction Game'}</h1>

          {!started ? (
            <p>Waiting for host to start…</p>
          ) : (
            <>
              <div>
                <p className="small">Current Bid</p>
                <div className="bid">${currentBid}</div>
              </div>

              <div className="chip" aria-live="polite">
                <span className={"dot " + (currentPriceHasBid ? 'ok' : 'warn')} />
                <span>{statusText}</span>
              </div>

              <p className="small">Time left: <b>{formatTime(timeLeft)}</b> {paused && timeLeft > 0 ? '(paused)' : ''}</p>

              <button onClick={handlePlayerBid} style={{ width: '100%', fontSize: 28, padding: 18 }}>
                TAP ${currentBid}
              </button>

              {playerPrivateNotice && (
                <p className="small" style={{ marginTop: 6 }}>{playerPrivateNotice}</p>
              )}

              {showWinner && (
                <>
                  <div className="hr" />
                  <p className="small">Round over</p>
                  <h2>Winner: {revealedWinner?.name}</h2>
                  <p className="small">Winning bid: <b>${revealedWinner?.amount}</b></p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // HOST VIEW
  return (
    <div className="app">
      <div className="card">
        <h1>{gameTitle || 'Auction Game'}</h1>

        {/* Host-only: customize game title (sent via QR link) */}
        {!started && (
          <div style={{ width: '100%', maxWidth: 520 }}>
            <p className="small">Game Title (shows for everyone)</p>
            <input
              value={gameTitle}
              onChange={e => setGameTitle(e.target.value)}
              placeholder="Type your game name…"
            />
          </div>
        )}

        <div>
          <p className="small">Room Code</p>
          <h2>{roomCode}</h2>
        </div>

        {/* QR + Start Game stacked vertically (locked-in layout) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <QRCode value={joinUrl} size={180} />
          <p className="small" style={{ maxWidth: 520, wordBreak: 'break-word' }}>{joinUrl}</p>
          {!started && (
            <button onClick={() => setStarted(true)}>
              Start Game
            </button>
          )}
        </div>

        {started && (
          <>
            <div className="hr" />

            <div>
              <p className="small">Current Bid</p>
              <div className="bid">${currentBid}</div>

              <div className="chip" style={{ marginTop: 8 }} aria-live="polite">
                <span className={"dot " + (currentPriceHasBid ? 'ok' : 'warn')} />
                <span>{currentPriceHasBid ? 'Bid placed!' : `No bids at $${currentBid} yet`}</span>
              </div>

              <p className="small" style={{ marginTop: 8 }}>
                Time left: <b>{formatTime(timeLeft)}</b> {paused && timeLeft > 0 ? '(paused)' : ''}
              </p>

              {revealedWinner && timeLeft <= 0 && (
                <>
                  <div className="hr" />
                  <h2>Winner: {revealedWinner?.name}</h2>
                  <p className="small">Winning bid: <b>${revealedWinner?.amount}</b></p>
                </>
              )}
            </div>

            <div className="hr" />

            {/* Host controls aligned horizontally in separate containers */}
            <div className="controlsRow">
              {/* TIMER (restored full controls) */}
              <div className="controlBox">
                <div className="boxTitle">Timer</div>
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={customTime}
                  onChange={e => setCustomTime(Number(e.target.value))}
                  placeholder="Seconds"
                />
                <div className="row">
                  <button onClick={() => { setTimeLeft(customTime); setPaused(false); setRevealedWinner(null) }}>Start</button>
                  <button disabled={timeLeft <= 0} onClick={() => setPaused(true)}>Pause</button>
                  <button disabled={timeLeft <= 0} onClick={() => setPaused(false)}>Resume</button>
                  <button disabled={timeLeft <= 0} onClick={() => { setTimeLeft(0); setPaused(false) }}>End</button>
                </div>
                <p className="small">Remaining: <b>{formatTime(timeLeft)}</b></p>
              </div>

              <div className="boxDivider" />

              {/* BID SETUP (only text simplification; keep title) */}
              <div className="controlBox">
                <div className="boxTitle">Bid Setup</div>
                <input
                  type="number"
                  min={0}
                  value={minBidInput}
                  onChange={e => setMinBidInput(Number(e.target.value))}
                />
                <div className="row" style={{ marginTop: 6 }}>
                  <button onClick={() => setMinAndReset(minBidInput)}>Set</button>
                  <button onClick={() => resetForNewPrice(minBid)}>Reset (${minBid})</button>
                </div>
                <p className="small">Saved base: <b>${minBid}</b></p>
              </div>

              <div className="boxDivider" />

              {/* RAISE BID (restored previous behavior) */}
              <div className="controlBox">
                <div className="boxTitle">Raise Bid</div>
                <div className="row">
                  {[5, 10, 15, 20].map(v => (
                    <button
                      key={v}
                      onClick={() => setIncrement(v)}
                      style={{ background: increment === v ? '#64748b' : undefined }}
                    >
                      +${v}
                    </button>
                  ))}
                </div>
                <button onClick={() => resetForNewPrice(Math.max(minBid, currentBid + increment))}>
                  Raise +${increment}
                </button>
                <p className="small">Leader (hidden): <b>{leadingBid ? leadingBid.name : '—'}</b></p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
