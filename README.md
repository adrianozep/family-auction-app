# Auction Game (Vite + React + Firebase Firestore) + Themes & Music

This version adds:
- realtime syncing (Firestore)
- holiday/occasion themes
- generic, non-copyright background music (synth via Web Audio)

## Local run
1. `npm install`
2. Copy `.env.example` -> `.env.local` and paste Firebase web config values.
3. `npm run dev`

## Deploy (GitHub + Vercel)
1. Push to GitHub
2. Import to Vercel
3. Add env vars (`VITE_FIREBASE_*`) in Vercel Settings -> Environment Variables
4. Redeploy

## Firestore rules (simple, for family game)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if true;
      match /players/{playerId} { allow read, write: if true; }
      match /bids/{bidId} { allow read, write: if true; }
    }
  }
}
```


Music has been removed. This version is silent (visual-only experience).


🔔 This version includes a host-only 10-second countdown beep before bidding ends.
