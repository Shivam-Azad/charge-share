# ChargeShare - Project Roadmap and Documentation

Last updated: May 2026  
Developer: Shivam Azad  
Stack: Next.js 15 App Router, TypeScript, Supabase, Tailwind CSS, Leaflet.js  
Repos: `Shivam-Azad/charge-share` (Vercel), `Charge-Share-team/charge-share`  
Live URL: `charge-share-cjc7.vercel.app`

## Project Overview

ChargeShare is a peer-to-peer EV charging sharing platform. Any EV owner with a home charger can list it, and any driver can find, book, and pay for a charging session end to end on real data.

## Completed Work

### Phase 1 - Foundation

- Next.js 15 App Router, TypeScript, and Tailwind setup
- Supabase Auth with OTP login
- Middleware for ghost user redirect from incomplete profile to onboarding
- Multi-step onboarding flow
- AuthProvider and VehicleContext
- Vercel deployment with both remotes

### Phase 2 - Map and Discovery

- Leaflet/OpenStreetMap with Open Charge Map API: 500 results, 500 km, India
- Private charger listings from Supabase
- Public OCM chargers with blue GO button
- Directions modal with turn-by-turn navigation using Leaflet Routing Machine
- Custom EV pin markers and marker clustering
- SSR isolation for Leaflet through dynamic import with `ssr: false`
- Charger filter chips: All, Private, Public, Fast, Available, Free
- Profile page with Personal info, Garage, History, and Host settings tabs

### Phase 3 - Core Charging Flow

Database tables:

- `session_requests` - full booking lifecycle
- `wallets` - balance and pre-auth hold
- `wallet_transactions` - transaction history
- `ratings` - driver and host ratings
- `notifications` - realtime alerts
- `profiles.auto_approve`
- `cancel_stale_sessions` RPC to cancel pending sessions older than 10 minutes

Features:

- Wallet page with balance, held amount, mock top-up, mock withdrawal, and transaction history
- Booking flow with wallet balance check, pre-auth hold, `session_requests` row, and host notification
- Host dashboard with Requests, Active, Dashboard, Listings, and Add Charger tabs
- Auto-approve toggle persisted to the database and respected during booking
- Host force-stop flow that triggers driver payment and host wallet credit
- Session screen at `/session/[id]` with NavigationMap, ActiveScreen, and CompletedScreen
- Post-session rating for driver-to-host and host-to-driver ratings
- Platform fee removed so hosts receive 100% of earnings
- Realtime subscriptions on `session_requests` and `notifications`

### Phase 4 - UI/UX Overhaul

Design system:

- Outfit from Google Fonts replacing Geist
- Premium dark theme with `#050508` background throughout
- Glassmorphism using `rgba(255,255,255,0.04)`, `backdrop-filter: blur(16px)`, and subtle borders
- Electric blue and emerald accent colors
- Inline styles used to avoid Tailwind dark class conflicts
- CSS variables in `globals.css` for future light/dark tokens

Pages upgraded:

- `src/app/page.tsx` - glass station cards, glass booking modal, glass bottom nav, header with date and status badge
- `src/app/wallet/page.tsx` - hero balance card with emerald glow, glass tabs, transaction list, and modals
- `src/app/profile/page.tsx` - glass hero card, tabs, input fields, and add-car modal
- `src/app/host/page.tsx` - glass tabs, request cards, listings, and add charger form
- `src/app/session/[id]/page.tsx` - glass active screen, completed modal, and cleaner navigation map

### Phase 5 - Always On

Implementation status: app scaffolding complete. Firebase project credentials, Vercel env vars, Supabase Edge Function deployment, and the database webhook still need to be configured outside the repo.

- Firebase messaging service worker at `public/firebase-messaging-sw.js`
- Firebase client config route at `src/app/api/firebase-config/route.ts`
- FCM token registration hook at `src/hooks/useFCMToken.ts`
- In-app notification bell at `src/components/NotificationBell.tsx`
- Notification center at `src/app/notifications/page.tsx`
- Supabase Edge Function scaffold at `supabase/functions/send-notification/index.ts`
- Migration additions in `supabase/migrations/202605240001_phase5_7.sql`

### Phase 6 - Trust and Verify

Implementation status: app scaffolding complete. API Setu credentials and production RLS/admin policies still need to be configured in Supabase.

- Vehicle verification API route at `src/app/api/verify-vehicle/route.ts`
- Vehicle registration and verification controls in `src/app/profile/page.tsx`
- Admin dashboard at `src/app/admin/page.tsx`
- Admin user moderation at `src/app/admin/users/page.tsx`
- Admin charger approval at `src/app/admin/chargers/page.tsx`
- Admin middleware protection through `ADMIN_USER_IDS`
- Rating trust-flag trigger in the Phase 5-7 migration

### Phase 7 - Know Your Numbers

Implementation status: complete in-app analytics surface.

- Analytics dashboard at `src/app/analytics/page.tsx`
- Driver and host view toggle
- Driver spend, sessions, kWh, CO2 saved, monthly trend, and favorite chargers
- Host earnings, sessions, kWh, peak-hours heatmap, monthly trend, and charger breakdown
- Lightweight chart components in `src/components/charts/`
- Stats nav entry added to primary app surfaces

## Implementation Details and Future Phases

### Phase 5 - Always On

Goal: push notifications even when the app is closed or backgrounded.  
Priority: external Firebase and Supabase setup.

#### 5.1 Firebase Project Setup

- Create Firebase project at `console.firebase.google.com`
- Enable Cloud Messaging
- Download Firebase credentials or obtain FCM server credentials
- Add Vercel environment variables:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`

#### 5.2 Service Worker

Create `public/firebase-messaging-sw.js`:

```js
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  // Firebase web config
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icon.png',
  });
});
```

#### 5.3 FCM Token Registration

Create `src/hooks/useFCMToken.ts`:

- On login, request notification permission
- Get FCM token
- Store token in `profiles.fcm_token`

Supabase:

```sql
ALTER TABLE profiles ADD COLUMN fcm_token TEXT;
```

#### 5.4 Supabase Edge Function

Create `supabase/functions/send-notification/index.ts`:

- Triggered by a database webhook on `notifications` insert
- Reads `fcm_token` from `profiles` for the target user
- Sends FCM push through Firebase Admin SDK

#### 5.5 Notification Types

| Event | Recipient | Title |
| --- | --- | --- |
| New session request | Host | New Charging Request |
| Session approved | Driver | Session Approved! |
| Session denied | Driver | Request Declined |
| Session started | Host | Driver has arrived |
| Session ended by host | Driver | Session Ended |
| Session ending soon, 5 min | Driver | Session ending in 5 min |

#### 5.6 In-App Notification Center

- Bell icon in header with unread count badge
- `/notifications` page or slide-in drawer
- Mark as read on tap
- Link notifications to the relevant session

Files to create or modify:

- `public/firebase-messaging-sw.js`
- `src/hooks/useFCMToken.ts`
- `src/components/NotificationBell.tsx`
- `src/app/notifications/page.tsx`
- `supabase/functions/send-notification/index.ts`
- Supabase migration for `profiles.fcm_token`

### Phase 6 - Trust and Verify

Goal: vehicle verification, platform trust layer, and basic admin.  
Priority: external API Setu and production policy hardening.

#### 6.1 Vehicle Registration Verification

Preferred option: API Setu.

- Register at `api.setu.co`
- Use RC (Registration Certificate) API
- Driver enters registration number
- API returns owner name and vehicle model
- If name matches profile, show a verified badge

Fallback option: Vahan API.

Implementation:

- `src/app/api/verify-vehicle/route.ts` calls API Setu or fallback provider
- Add Verify button in onboarding Step 1 and profile garage
- Store result in `profiles.vehicle_verified` and `profiles.vehicle_reg_number`
- Show verified vehicle info on charger booking cards

Supabase:

```sql
ALTER TABLE profiles ADD COLUMN vehicle_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN vehicle_reg_number TEXT;
```

#### 6.2 Automated Fraud Flagging

- After each rating is saved, check average rating
- If 3 or more ratings are 2 stars or below, insert a warning notification
- If 5 or more ratings are 2 stars or below, set `profiles.flagged = true`
- Flagged users cannot book sessions or list chargers

Supabase:

```sql
ALTER TABLE profiles ADD COLUMN flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN flag_reason TEXT;
```

#### 6.3 Basic Admin Dashboard

Route: `/admin`, protected by admin user IDs.

Sections:

- Users: search, view profile, ban or unban, see flag status
- Chargers: pending verification queue, approve or reject listings
- Sessions: all sessions, filter by status, dispute resolution notes
- Platform stats: total users, sessions this month, total kWh, active chargers

Files to create:

- `src/app/admin/page.tsx`
- `src/app/admin/users/page.tsx`
- `src/app/admin/chargers/page.tsx`

Modify:

- `src/middleware.ts` for admin route protection

Example admin check:

```ts
const ADMIN_IDS = ['your-user-id-here'];
if (!ADMIN_IDS.includes(user.id)) redirect('/');
```

### Phase 7 - Know Your Numbers

Goal: analytics for drivers and hosts.  
Priority: implemented, then refine as real data grows.

#### Driver Analytics

- Total kWh charged
- Total amount spent
- Session count
- CO2 saved vs petrol equivalent: `kWh * 0.82 kg CO2/kWh`
- Monthly spending trend
- Favourite chargers, top 3 by session count

#### Host Analytics

- Total earnings all time and this month
- Sessions hosted
- Peak hours heatmap
- Charger utilization percentage
- Per-charger breakdown
- Weekly earnings graph

#### Implementation

Library: Recharts, if available in the project.  
New route: `/analytics`.  
Views: Driver and Host tabs.

Files to create:

- `src/app/analytics/page.tsx`
- `src/components/charts/EarningsChart.tsx`
- `src/components/charts/UsageHeatmap.tsx`
- `src/components/charts/CO2Card.tsx`

Navigation:

- Add or replace a bottom nav tab with Analytics

### Phase 8 - Everywhere

Goal: React Native app for iOS and Android.  
Priority: later.

Recommended stack:

- Expo managed workflow
- Same Supabase backend
- Shared TypeScript types between web and native

Setup:

```bash
npx create-expo-app charge-share-native --template
cd charge-share-native
npx expo install @supabase/supabase-js
npx expo install expo-location expo-notifications
```

Feature parity checklist:

- Auth with Supabase OTP
- Map through `react-native-maps`
- Home page with station list and booking
- Host dashboard
- Wallet
- Session screen
- Profile
- FCM push with native OS integration
- Camera for RC photo upload
- Background GPS tracking during navigation

Store requirements:

- Apple Developer Account
- Google Play Console
- EAS Build for production builds

### Phase 9 - Real Money

Goal: replace mock payments with Cashfree.  
Priority: market-ready stage.

Why Cashfree:

- Free sandbox
- Full UPI, cards, and netbanking support
- Good fit for Indian payment flows

#### 9.1 Wallet Top-Up

- Cashfree Payment Link API redirects to payment page
- On success, Cashfree webhook triggers wallet credit
- Environment variables: `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`

#### 9.2 Host Payout

- Cashfree Payouts API to host UPI or bank
- Triggered manually by host withdrawal or by weekly batch
- Minimum payout: Rs. 100

#### 9.3 Webhook Handler

Create `src/app/api/cashfree-webhook/route.ts`:

```ts
// Verify Cashfree signature.
// On payment.captured, credit wallet.
// On payout.success, update transaction record.
```

#### 9.4 Files to Create or Modify

- `src/app/api/cashfree-webhook/route.ts`
- `src/app/api/create-payment/route.ts`
- `src/app/api/create-payout/route.ts`
- `src/app/wallet/page.tsx`
- `supabase/functions/process-payment/index.ts`

### Phase 10 - Go Global

Goal: multi-language support.  
Priority: when user base grows.

Library: `next-intl`.

Language order:

1. English
2. Hindi
3. Punjabi
4. Tamil
5. Telugu

Implementation:

```bash
npm install next-intl
```

- Add `messages/en.json`, `messages/hi.json`, and other language files
- Wrap the app in `NextIntlClientProvider`
- Add language toggle in Profile settings

## Small Fixes and Polish

### UI Fixes

- Explore page at `/explore`: upgrade to the same glass style as other pages
- Login page at `/login`: upgrade to glass style
- Onboarding page at `/onboarding`: upgrade to glass style and add vehicle registration number field
- Theme toggle: wire up in Profile with `localStorage` persistence and `<html>` class swap
- Light theme: convert pages away from hardcoded dark styles page by page

### Functional Fixes

- Session ending soon alert at 5 minutes
- Driver cancel flow for approved sessions
- Host edit functionality for listed chargers
- Charger image upload when listing a charger
- Explore page map pins: EV plug SVG style, pulse animation on available chargers, better cluster badges
- Public directions UI: clean bottom sheet instead of Leaflet default routing panel

### Database and Backend

- `session_ending_soon` notification through an Edge Function or cron
- Charger approval flow with admin approval for `is_verified = false`
- Session dispute resolution
- Rate limiting on booking API

## Key File Structure

```text
src/
|-- app/
|   |-- page.tsx
|   |-- layout.tsx
|   |-- globals.css
|   |-- host/page.tsx
|   |-- wallet/page.tsx
|   |-- profile/page.tsx
|   |-- session/[id]/page.tsx
|   |-- explore/page.tsx
|   |-- login/page.tsx
|   |-- onboarding/page.tsx
|   |-- api/
|   |   `-- chargers/route.ts
|   `-- charging/
|-- components/
|   |-- AuthProvider.tsx
|   `-- ui/
|       |-- BatteryCard.tsx
|       |-- FilterChips.tsx
|       |-- PublicDirectionsModal.tsx
|       `-- RoutingControl.tsx
|-- hooks/
|   `-- useSessionRequest.ts
|-- context/
|   `-- VehicleContext.tsx
|-- data/
|   `-- ev-database.ts
`-- utils/
    `-- supabase/
        `-- client.ts
```

## Environment Variables

Currently required:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_OCM_API_KEY=
```

Phase 5, FCM:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Phase 9, Cashfree:

```env
CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
CASHFREE_WEBHOOK_SECRET=
```

## Supabase Schema

| Table | Purpose | Status |
| --- | --- | --- |
| `profiles` | User data, KYC, host settings | Done |
| `chargers` | Charger listings | Done |
| `session_requests` | Full booking lifecycle | Done |
| `wallets` | Balance and held amount | Done |
| `wallet_transactions` | Transaction history | Done |
| `ratings` | Driver and host ratings | Done |
| `notifications` | In-app and push alerts | Done |

Future columns:

```sql
-- Phase 5
ALTER TABLE profiles ADD COLUMN fcm_token TEXT;

-- Phase 6
ALTER TABLE profiles ADD COLUMN vehicle_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN vehicle_reg_number TEXT;
ALTER TABLE profiles ADD COLUMN flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN flag_reason TEXT;

-- Phase 9
ALTER TABLE wallet_transactions ADD COLUMN cashfree_order_id TEXT;
ALTER TABLE wallet_transactions ADD COLUMN cashfree_payment_id TEXT;
```

## Priority Order

| # | Task | Phase | Effort |
| --- | --- | --- | --- |
| 1 | Explore page glass upgrade | Polish | 1 chat |
| 2 | Login and Onboarding glass upgrade | Polish | 1 chat |
| 3 | Vehicle registration number field in onboarding | Polish | 30 min |
| 4 | Session ending soon notification | Polish | 1 chat |
| 5 | Host charger edit functionality | Polish | 1 chat |
| 6 | Deploy FCM Edge Function and webhook | Phase 5 | External setup |
| 7 | Add Firebase and API Setu credentials | Phase 5/6 | External setup |
| 8 | Harden admin RLS policies | Phase 6 | 1 chat |
| 9 | React Native app | Phase 8 | Many chats |
| 10 | Cashfree real payments | Phase 9 | 3-4 chats |
| 11 | Multi-language i18n | Phase 10 | 2 chats |
