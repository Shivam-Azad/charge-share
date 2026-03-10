'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/utils/supabase/client';

type Tab = 'overview' | 'topup' | 'history';

interface Transaction {
  id: string;
  type: 'charge' | 'earn' | 'topup' | 'payout';
  amount: number;
  label: string;
  date: string;
  status: 'success' | 'pending' | 'failed';
}

// ─── FAKE STRIPE PAYMENT MODAL ─────────────────────────────────────────────
function FakeStripeModal({ amount, onSuccess, onClose }: { amount: number; onSuccess: () => void; onClose: () => void }) {
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatCard = (val: string) => val.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const formatExpiry = (val: string) => {
    const d = val.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (card.number.replace(/\s/g, '').length < 16) e.number = 'Invalid card number';
    if (card.expiry.length < 5) e.expiry = 'Invalid expiry';
    if (card.cvv.length < 3) e.cvv = 'Invalid CVV';
    if (!card.name.trim()) e.name = 'Name required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePay = () => {
    if (!validate()) return;
    setStep('processing');
    setTimeout(() => { setStep('success'); setTimeout(onSuccess, 1500); }, 2800);
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-5">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[36px] overflow-hidden shadow-2xl">

        {/* Stripe Header */}
        <div className="bg-[#635BFF] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center">
              <span className="text-[#635BFF] font-black text-xs">S</span>
            </div>
            <span className="text-white font-bold text-sm tracking-wide">Stripe</span>
            <span className="text-white/50 text-[10px] font-bold ml-1">· Secure Checkout</span>
          </div>
          <span className="text-white font-black text-lg">₹{amount.toFixed(2)}</span>
        </div>

        <div className="p-6">
          {step === 'form' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">Card Number</label>
                <div className="relative">
                  <input
                    value={card.number}
                    onChange={e => setCard(c => ({ ...c, number: formatCard(e.target.value) }))}
                    placeholder="4242 4242 4242 4242"
                    className={`w-full bg-zinc-800 border rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none placeholder:text-zinc-600 ${errors.number ? 'border-red-500' : 'border-zinc-700 focus:border-[#635BFF]'}`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                    {['💳'].map((i, k) => <span key={k} className="text-base">{i}</span>)}
                  </div>
                </div>
                {errors.number && <p className="text-red-400 text-[8px] font-bold mt-1">{errors.number}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">Expiry</label>
                  <input
                    value={card.expiry}
                    onChange={e => setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                    placeholder="MM/YY"
                    className={`w-full bg-zinc-800 border rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none placeholder:text-zinc-600 ${errors.expiry ? 'border-red-500' : 'border-zinc-700 focus:border-[#635BFF]'}`}
                  />
                  {errors.expiry && <p className="text-red-400 text-[8px] font-bold mt-1">{errors.expiry}</p>}
                </div>
                <div>
                  <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">CVV</label>
                  <input
                    value={card.cvv}
                    onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    placeholder="•••"
                    type="password"
                    className={`w-full bg-zinc-800 border rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none placeholder:text-zinc-600 ${errors.cvv ? 'border-red-500' : 'border-zinc-700 focus:border-[#635BFF]'}`}
                  />
                  {errors.cvv && <p className="text-red-400 text-[8px] font-bold mt-1">{errors.cvv}</p>}
                </div>
              </div>

              <div>
                <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">Name on Card</label>
                <input
                  value={card.name}
                  onChange={e => setCard(c => ({ ...c, name: e.target.value }))}
                  placeholder="SHIVAM AZAD"
                  className={`w-full bg-zinc-800 border rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none placeholder:text-zinc-600 uppercase ${errors.name ? 'border-red-500' : 'border-zinc-700 focus:border-[#635BFF]'}`}
                />
                {errors.name && <p className="text-red-400 text-[8px] font-bold mt-1">{errors.name}</p>}
              </div>

              <div className="bg-zinc-800/50 p-3 rounded-xl flex items-center gap-2 border border-zinc-700">
                <span className="text-emerald-400 text-xs">🔒</span>
                <p className="text-zinc-500 text-[8px] font-bold">256-bit SSL encryption · PCI DSS compliant</p>
              </div>

              <button
                onClick={handlePay}
                className="w-full py-4 bg-[#635BFF] text-white font-black uppercase text-xs tracking-widest rounded-xl active:scale-95 transition-all shadow-[0_0_20px_rgba(99,91,255,0.3)]"
              >
                Pay ₹{amount.toFixed(2)}
              </button>
              <button onClick={onClose} className="w-full text-zinc-600 text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors">Cancel</button>
            </div>
          )}

          {step === 'processing' && (
            <div className="py-10 text-center">
              <div className="w-16 h-16 border-4 border-[#635BFF]/20 border-t-[#635BFF] rounded-full animate-spin mx-auto mb-6" />
              <p className="text-white font-black italic uppercase text-xs tracking-widest animate-pulse">Authorising Payment...</p>
              <p className="text-zinc-600 text-[9px] font-bold mt-2">Please do not close this window</p>
            </div>
          )}

          {step === 'success' && (
            <div className="py-8 text-center animate-in zoom-in duration-500">
              <div className="w-20 h-20 bg-emerald-500 text-black rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-black shadow-[0_0_40px_rgba(16,185,129,0.3)]">✓</div>
              <h3 className="text-white font-black italic uppercase text-xl tracking-tighter">Payment Successful</h3>
              <p className="text-zinc-500 text-[9px] font-bold mt-2 uppercase tracking-widest">₹{amount.toFixed(2)} added to wallet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PAYOUT MODAL ──────────────────────────────────────────────────────────
function PayoutModal({ amount, onSuccess, onClose }: { amount: number; onSuccess: () => void; onClose: () => void }) {
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  const [upi, setUpi] = useState('');

  const handlePayout = () => {
    if (!upi.includes('@')) return;
    setStep('processing');
    setTimeout(() => { setStep('success'); setTimeout(onSuccess, 1500); }, 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center p-5">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-[36px] p-6 shadow-2xl">
        {step === 'form' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="text-center mb-2">
              <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Withdraw Earnings</p>
              <p className="text-4xl font-black text-emerald-400 italic mt-2">₹{amount.toFixed(0)}</p>
            </div>
            <div>
              <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">UPI ID</label>
              <input
                value={upi}
                onChange={e => setUpi(e.target.value)}
                placeholder="yourname@upi"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm font-bold focus:outline-none focus:border-emerald-500/50 placeholder:text-zinc-600"
              />
            </div>
            <p className="text-zinc-600 text-[8px] font-bold text-center">Funds arrive in 1-2 business days · Minimum ₹100</p>
            <button onClick={handlePayout} className="w-full py-4 bg-emerald-500 text-black font-black uppercase text-xs tracking-widest rounded-xl active:scale-95 transition-all">
              Withdraw to UPI →
            </button>
            <button onClick={onClose} className="w-full text-zinc-600 text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors">Cancel</button>
          </div>
        )}
        {step === 'processing' && (
          <div className="py-10 text-center">
            <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6" />
            <p className="text-white font-black italic uppercase text-xs tracking-widest animate-pulse">Initiating Transfer...</p>
          </div>
        )}
        {step === 'success' && (
          <div className="py-8 text-center animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl font-black">₹</div>
            <h3 className="text-white font-black italic uppercase text-xl">Transfer Initiated</h3>
            <p className="text-zinc-500 text-[9px] font-bold mt-2 uppercase tracking-widest">Arrives in 1–2 business days</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN WALLET PAGE ──────────────────────────────────────────────────────
export default function WalletPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('overview');
  const [balance, setBalance] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showStripe, setShowStripe] = useState(false);
  const [showPayout, setShowPayout] = useState(false);
  const [topupAmount, setTopupAmount] = useState(500);
  const [loading, setLoading] = useState(true);

  // Mock data for demo (replace with real Supabase queries)
  useEffect(() => {
    const savedBalance = parseFloat(localStorage.getItem('wallet_balance') || '0');
    const savedEarnings = parseFloat(localStorage.getItem('wallet_earnings') || '0');
    setBalance(savedBalance);
    setEarnings(savedEarnings);

    // Mock transaction history
    setTransactions([
      { id: '1', type: 'topup', amount: 500, label: 'Wallet Top-up via Stripe', date: '10 Mar 2026', status: 'success' },
      { id: '2', type: 'charge', amount: -83, label: "Sarah's Driveway · 7.5 kWh", date: '9 Mar 2026', status: 'success' },
      { id: '3', type: 'earn', amount: 124, label: 'Session Payout · Raj charged', date: '8 Mar 2026', status: 'success' },
      { id: '4', type: 'charge', amount: -55, label: 'Statiq Hub · 3.8 kWh', date: '7 Mar 2026', status: 'success' },
      { id: '5', type: 'payout', amount: -400, label: 'Withdrawal to UPI', date: '6 Mar 2026', status: 'success' },
      { id: '6', type: 'earn', amount: 200, label: 'Session Payout · Meena charged', date: '5 Mar 2026', status: 'pending' },
    ]);
    setLoading(false);
  }, []);

  const handleTopupSuccess = () => {
    const newBalance = balance + topupAmount;
    setBalance(newBalance);
    localStorage.setItem('wallet_balance', newBalance.toString());
    setShowStripe(false);
    setTransactions(prev => [{
      id: Date.now().toString(), type: 'topup', amount: topupAmount,
      label: 'Wallet Top-up via Stripe', date: 'Just now', status: 'success'
    }, ...prev]);
    setTab('history');
  };

  const handlePayoutSuccess = () => {
    const newEarnings = 0;
    setEarnings(newEarnings);
    localStorage.setItem('wallet_earnings', newEarnings.toString());
    setShowPayout(false);
    setTransactions(prev => [{
      id: Date.now().toString(), type: 'payout', amount: -earnings,
      label: 'Withdrawal to UPI', date: 'Just now', status: 'pending'
    }, ...prev]);
  };

  const txIcon = (type: Transaction['type']) => ({ charge: '⚡', earn: '💰', topup: '➕', payout: '🏦' }[type]);
  const txColor = (type: Transaction['type']) => ({
    charge: 'text-white', earn: 'text-emerald-400', topup: 'text-blue-400', payout: 'text-amber-400'
  }[type]);

  return (
    <main className="min-h-screen bg-black pb-40">

      {showStripe && <FakeStripeModal amount={topupAmount} onSuccess={handleTopupSuccess} onClose={() => setShowStripe(false)} />}
      {showPayout && <PayoutModal amount={earnings} onSuccess={handlePayoutSuccess} onClose={() => setShowPayout(false)} />}

      <div className="w-full max-w-md mx-auto px-5 pt-14">

        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="text-emerald-500 text-[9px] font-black uppercase tracking-[0.3em] mb-1">Payments</p>
            <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Wallet</h1>
          </div>
          <div className="text-right">
            <p className="text-zinc-500 text-[8px] font-bold uppercase">Secured by</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="w-5 h-5 bg-[#635BFF] rounded flex items-center justify-center"><span className="text-white font-black text-[8px]">S</span></div>
              <span className="text-white font-bold text-xs">Stripe</span>
            </div>
          </div>
        </div>

        {/* Balance cards */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-[28px]">
            <p className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mb-1">Charging Balance</p>
            <p className="text-3xl font-black text-white italic">₹{balance.toFixed(0)}</p>
            <button
              onClick={() => { setTab('topup'); }}
              className="mt-3 w-full py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-[8px] font-black uppercase tracking-widest hover:bg-blue-500/20 transition-all"
            >
              + Add Funds
            </button>
          </div>
          <div className="bg-zinc-900 border border-emerald-500/20 p-5 rounded-[28px] relative overflow-hidden">
            <div className="absolute inset-0 bg-emerald-500/3 pointer-events-none" />
            <p className="text-emerald-500 text-[8px] font-black uppercase tracking-widest mb-1">Host Earnings</p>
            <p className="text-3xl font-black text-emerald-400 italic">₹{earnings.toFixed(0)}</p>
            <button
              onClick={() => earnings > 100 ? setShowPayout(true) : null}
              className={`mt-3 w-full py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${earnings > 100 ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-zinc-800/50 border border-zinc-700 text-zinc-600 cursor-not-allowed'}`}
            >
              {earnings > 100 ? 'Withdraw' : 'Min ₹100'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-zinc-900/50 p-1 rounded-2xl border border-zinc-800">
          {(['overview', 'topup', 'history'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                tab === t ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-[28px]">
              <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest mb-4">This Month</p>
              <div className="space-y-3">
                {[
                  { label: 'Sessions Paid', val: '₹138', sub: '3 charges' },
                  { label: 'Host Earnings', val: '+₹324', sub: '4 sessions' },
                  { label: 'Net Balance', val: '+₹186', sub: 'Profit this month' },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                    <div>
                      <p className="text-white text-sm font-black italic uppercase">{r.label}</p>
                      <p className="text-zinc-600 text-[8px] font-bold">{r.sub}</p>
                    </div>
                    <p className={`font-black text-lg italic ${r.val.startsWith('+') ? 'text-emerald-400' : 'text-white'}`}>{r.val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent transactions preview */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-[28px]">
              <div className="flex justify-between items-center mb-4">
                <p className="text-zinc-500 text-[9px] font-black uppercase tracking-widest">Recent</p>
                <button onClick={() => setTab('history')} className="text-emerald-400 text-[8px] font-black uppercase">View All →</button>
              </div>
              {transactions.slice(0, 3).map(tx => (
                <div key={tx.id} className="flex justify-between items-center py-2.5 border-b border-zinc-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-800 rounded-xl flex items-center justify-center text-sm">{txIcon(tx.type)}</div>
                    <div>
                      <p className="text-white text-[10px] font-black italic">{tx.label}</p>
                      <p className="text-zinc-600 text-[8px] font-bold">{tx.date}</p>
                    </div>
                  </div>
                  <p className={`font-black text-sm italic ${txColor(tx.type)}`}>
                    {tx.amount > 0 ? '+' : ''}₹{Math.abs(tx.amount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TOP UP */}
        {tab === 'topup' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[28px]">
              <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest mb-4">Select Amount</p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[200, 500, 1000, 1500, 2000, 5000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setTopupAmount(amt)}
                    className={`py-3 rounded-xl text-sm font-black italic uppercase transition-all border ${
                      topupAmount === amt
                        ? 'bg-emerald-500 border-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-1.5">Or enter amount</label>
                <input
                  type="number"
                  value={topupAmount}
                  onChange={e => setTopupAmount(parseInt(e.target.value) || 0)}
                  min={100}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white text-xl font-black italic focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            {/* Payment method */}
            <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-[28px]">
              <p className="text-zinc-400 text-[9px] font-black uppercase tracking-widest mb-4">Pay Via</p>
              <button
                onClick={() => setShowStripe(true)}
                className="w-full flex items-center gap-4 p-4 bg-zinc-800/50 border border-[#635BFF]/30 rounded-2xl hover:border-[#635BFF]/60 transition-all group"
              >
                <div className="w-10 h-10 bg-[#635BFF] rounded-xl flex items-center justify-center">
                  <span className="text-white font-black text-sm">S</span>
                </div>
                <div className="text-left">
                  <p className="text-white text-sm font-black italic uppercase">Credit / Debit Card</p>
                  <p className="text-zinc-500 text-[8px] font-bold">Powered by Stripe · SSL Secured</p>
                </div>
                <span className="text-zinc-600 ml-auto group-hover:text-white transition-colors">→</span>
              </button>

              <button className="w-full flex items-center gap-4 p-4 bg-zinc-800/50 border border-zinc-700 rounded-2xl mt-3 opacity-50 cursor-not-allowed">
                <div className="w-10 h-10 bg-zinc-700 rounded-xl flex items-center justify-center">
                  <span className="text-white font-black text-sm">U</span>
                </div>
                <div className="text-left">
                  <p className="text-white text-sm font-black italic uppercase">UPI / GPay / PhonePe</p>
                  <p className="text-zinc-500 text-[8px] font-bold">Coming soon</p>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowStripe(true)}
              className="w-full py-5 bg-[#635BFF] text-white font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all shadow-[0_0_20px_rgba(99,91,255,0.2)]"
            >
              Pay ₹{topupAmount} via Stripe →
            </button>
          </div>
        )}

        {/* HISTORY */}
        {tab === 'history' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {transactions.map(tx => (
              <div key={tx.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-[24px] flex items-center gap-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base flex-shrink-0 ${
                  tx.type === 'earn' ? 'bg-emerald-500/10' :
                  tx.type === 'topup' ? 'bg-blue-500/10' :
                  tx.type === 'payout' ? 'bg-amber-500/10' : 'bg-zinc-800'
                }`}>
                  {txIcon(tx.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[10px] font-black italic truncate">{tx.label}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-zinc-600 text-[8px] font-bold">{tx.date}</p>
                    <span className={`text-[7px] font-black uppercase px-2 py-0.5 rounded-full ${
                      tx.status === 'success' ? 'text-emerald-400 bg-emerald-500/10' :
                      tx.status === 'pending' ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10'
                    }`}>{tx.status}</span>
                  </div>
                </div>
                <p className={`font-black text-sm italic flex-shrink-0 ${txColor(tx.type)}`}>
                  {tx.amount > 0 ? '+' : ''}₹{Math.abs(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-sm h-16 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/50 rounded-3xl flex items-center justify-around z-50">
        <Link href="/" className="flex flex-col items-center text-zinc-500 gap-1 hover:text-white transition-colors"><span className="text-lg">○</span><span className="text-[9px] font-bold uppercase">Home</span></Link>
        <Link href="/explore" className="flex flex-col items-center text-zinc-500 gap-1 hover:text-white transition-colors"><span className="text-lg">◎</span><span className="text-[9px] font-bold uppercase">Explore</span></Link>
        <Link href="/host" className="flex flex-col items-center text-zinc-500 gap-1 hover:text-white transition-colors"><span className="text-lg">◇</span><span className="text-[9px] font-bold uppercase">Host</span></Link>
        <Link href="/wallet" className="flex flex-col items-center text-emerald-400 gap-1"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full mb-1"></div><span className="text-[9px] font-bold uppercase">Wallet</span></Link>
        <Link href="/profile" className="flex flex-col items-center text-zinc-500 gap-1 hover:text-white transition-colors"><span className="text-lg">◇</span><span className="text-[9px] font-bold uppercase">Profile</span></Link>
      </nav>
    </main>
  );
}