# ChargeShare · Phase 2 Deliverables

## Files Built

| File | Place in your project at |
|------|--------------------------|
| `home-page-v2.tsx` | `src/app/page.tsx` (replace existing) |
| `host-page.tsx` | `src/app/host/page.tsx` (new file) |
| `wallet-page.tsx` | `src/app/wallet/page.tsx` (new file) |
| `profile-page.tsx` | `src/app/profile/page.tsx` (new file) |
| `phase2-migration.sql` | Run in Supabase SQL Editor |

---

## What's New in Phase 2

### 🏠 Home Page (`page.tsx`)
- **Personalized greeting** — reads `full_name` from `profiles` table (or auth metadata)
- **Working filters** — Fast / Available / Free / Top Rated actually filter the list
- **OTP Booking Flow** — Book → Stripe Deposit → 4-digit OTP → Start Charging
- **Stripe Deposit Modal** — full card form with validation (dummy, ready for real Stripe)
- **Final Payment with Stripe** — Stop & Pay triggers another Stripe modal for remainder

### ⚡ Host Mode (`/host`)
- **Dashboard** — earnings, sessions, active listings stats
- **Listings** — view all your chargers, toggle availability on/off live
- **Add Charger** — full form: name, address, GPS (with "use my location"), plug types, power, price, description

### 💳 Wallet (`/wallet`)
- **Balance card** — Charging Balance + Host Earnings side by side
- **Top-Up via Stripe** — preset amounts + custom input, full card form, processing animation
- **Payout via UPI** — withdraw earnings to UPI ID
- **Transaction History** — full history with type icons, status badges

### 👤 Profile (`/profile`)
- **Personal Info** — full name, phone, city, UPI ID saved to `profiles` table
- **Garage** — add/switch vehicles using existing EV database, active vehicle indicator
- **Session History** — driver vs host sessions with P&L
- **Host Details** — KYC fields (DL, Aadhaar last 4), payout UPI, host agreement toggle

---

## Stripe Integration (Dummy → Real)

The app uses a **complete dummy Stripe UI** right now. To switch to real Stripe:

### 1. Install Stripe
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js stripe
```

### 2. Add env vars
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
```

### 3. Create a PaymentIntent API route
```ts
// src/app/api/stripe/create-intent/route.ts
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const { amount } = await req.json();
  const intent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // paise
    currency: 'inr',
    automatic_payment_methods: { enabled: true },
  });
  return Response.json({ clientSecret: intent.client_secret });
}
```

### 4. Replace FakeStripeModal
Swap `FakeStripeModal` in `wallet-page.tsx` and `home-page-v2.tsx` with Stripe's `<PaymentElement>` wrapped in `<Elements>`:

```tsx
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Wrap payment form with:
<Elements stripe={stripePromise} options={{ clientSecret }}>
  <PaymentForm />
</Elements>
```

### 5. Store PaymentIntent ID
Save `payment_intent_id` to `charging_sessions` and `wallet_transactions` for reconciliation.

---

## Database Setup

Run `phase2-migration.sql` in your Supabase SQL Editor. It creates:
- `profiles` — user personal/host data
- `charging_sessions` — session records with OTP, cost, rating
- `wallets` — per-user balance + earnings
- `wallet_transactions` — full ledger
- Auto-triggers to create profile + wallet on signup

---

## Phase 3 Ideas
- Push notifications for booking requests (host gets notified)
- Real-time session monitoring via Supabase Realtime
- Smart pricing (surge based on demand)
- Referral system
- Host verification badge flow
- QR code generation for physical charger stickers
