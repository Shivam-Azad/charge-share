# ChargeShare

ChargeShare is a community-led EV charging platform designed to democratize access to electric vehicle power. It combines real-world public charging data with a peer-to-peer hosting model so drivers can find, book, and pay for charging sessions.

## Key Features

- Hybrid map discovery using Open Charge Map public data and private host listings
- Supabase-backed booking, wallet, session, notification, and rating flows
- Host dashboard for requests, active sessions, listings, and charger creation
- Driver session flow with navigation, completion, payment, and ratings
- Premium dark glass UI across the main app surfaces

## Tech Stack

- Frontend: Next.js App Router, TypeScript, Tailwind CSS
- Backend: Supabase PostgreSQL, Auth, Realtime, RPC
- Maps: Leaflet.js and OpenStreetMap
- Data: Open Charge Map API
- Deployment: Vercel

## Project Roadmap

See [ROADMAP.md](./ROADMAP.md) for completed phases, upcoming work, environment variables, schema notes, and the current priority order.

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase project
- Open Charge Map API key

### Installation

```bash
git clone https://github.com/Shivam-Azad/charge-share.git
cd charge-share
npm install
```

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_OCM_API_KEY=
```

Run the development server:

```bash
npm run dev
```
