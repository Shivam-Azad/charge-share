'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { createClient } from '@/utils/supabase/client';

type Tab = 'overview' | 'topup' | 'history';

interface WalletData { id: string; balance: number; held: number; }
interface Transaction {
  id: string; type: 'charge' | 'earn' | 'topup' | 'payout' | 'hold' | 'release';
  amount: number; description: string; created_at: string;
}

const glass = { background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)' };
const glassStrong = { background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)' };

// ─── TOPUP MODAL ─────────────────────────────────────────────────────────────
function TopupModal({ amount, onSuccess, onClose }: { amount: number; onSuccess: () => void; onClose: () => void }) {
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
  const formatExpiry = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0,2)}/${d.slice(2)}` : d; };

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
    setTimeout(() => { setStep('success'); setTimeout(onSuccess, 1200); }, 2800);
  };

  const inputStyle = (hasError: boolean) => ({
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${hasError ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 14, padding: '12px 16px', color: 'white',
    fontSize: 14, fontWeight: 700, outline: 'none',
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)' }}>
      <div className="w-full max-w-sm rounded-[32px] overflow-hidden animate-in slide-in-from-bottom-8 duration-300"
        style={{ background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 -8px 60px rgba(0,0,0,0.8)' }}>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'rgba(99,91,255,0.9)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
              <span className="font-black text-xs" style={{ color: '#635BFF' }}>S</span>
            </div>
            <span className="text-white font-bold text-sm">Stripe</span>
            <span className="text-white/50 text-[9px] font-bold">· Secure Checkout</span>
          </div>
          <span className="text-white font-black text-lg">₹{amount}</span>
        </div>

        <div className="p-6">
          {step === 'form' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Card Number</label>
                <input value={card.number} onChange={e => setCard(c => ({ ...c, number: formatCard(e.target.value) }))}
                  placeholder="4242 4242 4242 4242" style={inputStyle(!!errors.number)} />
                {errors.number && <p className="text-red-400 text-[8px] font-bold mt-1">{errors.number}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[8px] font-black uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Expiry</label>
                  <input value={card.expiry} onChange={e => setCard(c => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                    placeholder="MM/YY" style={inputStyle(!!errors.expiry)} />
                  {errors.expiry && <p className="text-red-400 text-[8px] font-bold mt-1">{errors.expiry}</p>}
                </div>
                <div>
                  <label className="text-[8px] font-black uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>CVV</label>
                  <input value={card.cvv} onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g,'').slice(0,4) }))}
                    placeholder="•••" type="password" style={inputStyle(!!errors.cvv)} />
                  {errors.cvv && <p className="text-red-400 text-[8px] font-bold mt-1">{errors.cvv}</p>}
                </div>
              </div>
              <div>
                <label className="text-[8px] font-black uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>Name on Card</label>
                <input value={card.name} onChange={e => setCard(c => ({ ...c, name: e.target.value }))}
                  placeholder="SHIVAM AZAD" style={{ ...inputStyle(!!errors.name), textTransform: 'uppercase' }} />
                {errors.name && <p className="text-red-400 text-[8px] font-bold mt-1">{errors.name}</p>}
              </div>
              <div className="rounded-xl p-3 flex items-center gap-2"
                style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <span className="text-emerald-400 text-xs">🔒</span>
                <p className="text-[8px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>256-bit SSL · PCI DSS compliant</p>
              </div>
              <button onClick={handlePay}
                className="w-full py-4 font-black uppercase text-xs tracking-widest rounded-2xl transition-all active:scale-95"
                style={{ background: '#635BFF', color: 'white', boxShadow: '0 0 24px rgba(99,91,255,0.4)' }}>
                Pay ₹{amount}
              </button>
              <button onClick={onClose} className="w-full text-[9px] font-black uppercase tracking-widest transition-colors"
                style={{ color: 'rgba(255,255,255,0.2)' }}>Cancel</button>
            </div>
          )}
          {step === 'processing' && (
            <div className="py-10 text-center">
              <div className="w-14 h-14 rounded-full border-4 border-t-violet-500 animate-spin mx-auto mb-5"
                style={{ borderColor: 'rgba(99,91,255,0.15)', borderTopColor: '#635BFF' }} />
              <p className="text-white font-black uppercase text-xs tracking-widest animate-pulse">Authorising...</p>
            </div>
          )}
          {step === 'success' && (
            <div className="py-8 text-center animate-in zoom-in duration-500">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl font-black"
                style={{ background: '#10b981', color: '#000', boxShadow: '0 0 40px rgba(16,185,129,0.4)' }}>✓</div>
              <h3 className="text-white font-black text-xl">Payment Successful</h3>
              <p className="text-[9px] font-bold mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>₹{amount} added to wallet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PAYOUT MODAL ─────────────────────────────────────────────────────────────
function PayoutModal({ amount, onSuccess, onClose }: { amount: number; onSuccess: () => void; onClose: () => void }) {
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  const [upi, setUpi] = useState('');

  const handlePayout = () => {
    if (!upi.includes('@')) return;
    setStep('processing');
    setTimeout(() => { setStep('success'); setTimeout(onSuccess, 1200); }, 2500);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)' }}>
      <div className="w-full max-w-sm rounded-[32px] p-6 animate-in slide-in-from-bottom-8 duration-300"
        style={{ background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)' }}>
        {step === 'form' && (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Withdraw Earnings</p>
              <p className="text-4xl font-black" style={{ color: '#10b981' }}>₹{amount.toFixed(0)}</p>
            </div>
            <div>
              <label className="text-[8px] font-black uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>UPI ID</label>
              <input value={upi} onChange={e => setUpi(e.target.value)} placeholder="yourname@upi"
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '12px 16px', color: 'white', fontSize: 14, fontWeight: 700, outline: 'none' }} />
            </div>
            <p className="text-center text-[8px] font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>Arrives in 1–2 days · Minimum ₹100</p>
            <button onClick={handlePayout}
              className="w-full py-4 font-black uppercase text-xs tracking-widest rounded-2xl active:scale-95 transition-all"
              style={{ background: '#10b981', color: '#000', boxShadow: '0 0 24px rgba(16,185,129,0.3)' }}>
              Withdraw to UPI →
            </button>
            <button onClick={onClose} className="w-full text-[9px] font-black uppercase tracking-widest"
              style={{ color: 'rgba(255,255,255,0.2)' }}>Cancel</button>
          </div>
        )}
        {step === 'processing' && (
          <div className="py-10 text-center">
            <div className="w-14 h-14 rounded-full border-4 border-t-emerald-500 animate-spin mx-auto mb-5"
              style={{ borderColor: 'rgba(16,185,129,0.15)', borderTopColor: '#10b981' }} />
            <p className="text-white font-black uppercase text-xs tracking-widest animate-pulse">Initiating Transfer...</p>
          </div>
        )}
        {step === 'success' && (
          <div className="py-8 text-center animate-in zoom-in duration-500">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl"
              style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>₹</div>
            <h3 className="text-white font-black text-xl">Transfer Initiated</h3>
            <p className="text-[9px] font-bold mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Arrives in 1–2 business days</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function WalletPage() {
  const { user } = useAuth();
  const supabase = useRef(createClient()).current;

  const [tab, setTab] = useState<Tab>('overview');
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showTopup, setShowTopup] = useState(false);
  const [showPayout, setShowPayout] = useState(false);
  const [topupAmount, setTopupAmount] = useState(500);
  const [loading, setLoading] = useState(true);

  const fetchWallet = async (uid: string) => {
    setLoading(true);
    let { data: walletData, error } = await supabase.from('wallets').select('id, balance, held').eq('user_id', uid).single();
    if (error && error.code === 'PGRST116') {
      const { data: created } = await supabase.from('wallets').insert({ user_id: uid, balance: 0, held: 0 }).select('id, balance, held').single();
      walletData = created;
    }
    if (walletData) setWallet(walletData as WalletData);
    const { data: txData } = await supabase.from('wallet_transactions').select('id, type, amount, description, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(30);
    if (txData) setTransactions(txData as Transaction[]);
    setLoading(false);
  };

  useEffect(() => { if (user?.id) fetchWallet(user.id); }, [user?.id]);

  const handleTopupSuccess = async () => {
    if (!user?.id) return;
    setShowTopup(false);
    const { data: fresh } = await supabase.from('wallets').select('balance').eq('user_id', user.id).single();
    const newBalance = (fresh?.balance ?? 0) + topupAmount;
    await supabase.from('wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    await supabase.from('wallet_transactions').insert({ user_id: user.id, type: 'topup', amount: topupAmount, description: 'Wallet top-up' });
    await fetchWallet(user.id);
    setTab('history');
  };

  const handlePayoutSuccess = async () => {
    if (!user?.id || !wallet) return;
    setShowPayout(false);
    const payoutAmt = wallet.balance;
    await supabase.from('wallets').update({ balance: 0, updated_at: new Date().toISOString() }).eq('user_id', user.id);
    await supabase.from('wallet_transactions').insert({ user_id: user.id, type: 'payout', amount: -payoutAmt, description: 'Withdrawal to UPI' });
    await fetchWallet(user.id);
  };

  const available = wallet ? Math.max(0, wallet.balance - wallet.held) : 0;
  const held = wallet?.held ?? 0;
  const balance = wallet?.balance ?? 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthTx = transactions.filter(tx => tx.created_at >= monthStart);
  const monthPaid = monthTx.filter(t => t.type === 'charge').reduce((s, t) => s + Math.abs(t.amount), 0);
  const monthEarned = monthTx.filter(t => t.type === 'earn').reduce((s, t) => s + t.amount, 0);
  const monthSessions = monthTx.filter(t => t.type === 'charge').length;
  const monthHostSessions = monthTx.filter(t => t.type === 'earn').length;

  const txIcon = (type: Transaction['type']) =>
    ({ charge: '⚡', earn: '💰', topup: '➕', payout: '🏦', hold: '🔒', release: '🔓' }[type]);
  const txColor = (type: Transaction['type']) =>
    ({ charge: 'rgba(255,255,255,0.9)', earn: '#10b981', topup: '#60a5fa', payout: '#fbbf24', hold: '#fb923c', release: 'rgba(255,255,255,0.4)' }[type]);
  const txBg = (type: Transaction['type']) =>
    ({ charge: 'rgba(255,255,255,0.05)', earn: 'rgba(16,185,129,0.1)', topup: 'rgba(96,165,250,0.1)', payout: 'rgba(251,191,36,0.1)', hold: 'rgba(251,146,60,0.1)', release: 'rgba(255,255,255,0.05)' }[type]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <main className="min-h-screen pb-40" style={{ background: '#050508' }}>

      {showTopup && <TopupModal amount={topupAmount} onSuccess={handleTopupSuccess} onClose={() => setShowTopup(false)} />}
      {showPayout && wallet && <PayoutModal amount={balance} onSuccess={handlePayoutSuccess} onClose={() => setShowPayout(false)} />}

      <div className="w-full max-w-md mx-auto px-5 pt-14">

        {/* Header */}
        <div className="flex justify-between items-center mb-7">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Payments</p>
            <h1 className="text-2xl font-black text-white tracking-tight">Wallet</h1>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ background: 'rgba(99,91,255,0.1)', border: '1px solid rgba(99,91,255,0.2)' }}>
            <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: '#635BFF' }}>
              <span className="text-white font-black text-[8px]">S</span>
            </div>
            <span className="text-white font-bold text-xs">Stripe</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-t-emerald-500 animate-spin"
              style={{ borderColor: 'rgba(16,185,129,0.15)', borderTopColor: '#10b981' }} />
          </div>
        ) : (
          <>
            {/* ── BALANCE HERO ── */}
            <div className="rounded-[28px] p-6 mb-3 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(255,255,255,0.04) 100%)', border: '1px solid rgba(16,185,129,0.2)', backdropFilter: 'blur(16px)' }}>
              {/* Glow */}
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)' }} />

              <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>Available Balance</p>
              <p className="text-5xl font-black text-white mb-1">₹{available.toFixed(0)}</p>
              {held > 0 && (
                <p className="text-[9px] font-bold mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  + ₹{held.toFixed(0)} on hold
                </p>
              )}

              <div className="flex gap-2 mt-4">
                <button onClick={() => { setTab('topup'); setShowTopup(true); }}
                  className="flex-1 py-3 font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all active:scale-95"
                  style={{ background: '#10b981', color: '#000', boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}>
                  + Add Money
                </button>
                <button
                  onClick={() => balance > 100 ? setShowPayout(true) : undefined}
                  className="flex-1 py-3 font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all active:scale-95"
                  style={{
                    background: balance > 100 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: balance > 100 ? 'white' : 'rgba(255,255,255,0.2)',
                    cursor: balance > 100 ? 'pointer' : 'not-allowed',
                  }}>
                  Withdraw
                </button>
              </div>
            </div>

            {/* Hold banner */}
            {held > 0 && (
              <div className="rounded-2xl p-3.5 flex items-center gap-3 mb-3"
                style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)' }}>
                <span className="text-lg">🔒</span>
                <div className="flex-1">
                  <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#fb923c' }}>Pre-Auth Hold Active</p>
                  <p className="text-[8px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>₹{held.toFixed(0)} reserved · released when session ends</p>
                </div>
                <p className="font-black" style={{ color: '#fb923c' }}>₹{held.toFixed(0)}</p>
              </div>
            )}

            {/* Host earnings strip */}
            <div className="rounded-2xl p-4 flex justify-between items-center mb-6"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Host Earnings this month</p>
                <p className="text-xl font-black" style={{ color: '#10b981' }}>₹{monthEarned.toFixed(0)}</p>
              </div>
              <span className="text-[8px] font-black uppercase px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}>
                {monthHostSessions} sessions
              </span>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-5 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {(['overview', 'topup', 'history'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className="flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                  style={{
                    background: tab === t ? '#10b981' : 'transparent',
                    color: tab === t ? '#000' : 'rgba(255,255,255,0.3)',
                    boxShadow: tab === t ? '0 0 16px rgba(16,185,129,0.25)' : 'none',
                  }}>
                  {t}
                </button>
              ))}
            </div>

            {/* OVERVIEW */}
            {tab === 'overview' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="rounded-[24px] p-5" style={glass}>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>This Month</p>
                  <div className="space-y-3">
                    {[
                      { label: 'Sessions Paid', val: `₹${monthPaid.toFixed(0)}`, sub: `${monthSessions} charges`, positive: false },
                      { label: 'Host Earnings', val: `+₹${monthEarned.toFixed(0)}`, sub: `${monthHostSessions} sessions`, positive: true },
                      { label: 'Net', val: `${monthEarned - monthPaid >= 0 ? '+' : ''}₹${(monthEarned - monthPaid).toFixed(0)}`, sub: monthEarned - monthPaid >= 0 ? 'Profit' : 'Net spend', positive: monthEarned >= monthPaid },
                    ].map((r, i) => (
                      <div key={i} className="flex justify-between items-center py-2.5" style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                        <div>
                          <p className="text-white text-sm font-black">{r.label}</p>
                          <p className="text-[8px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>{r.sub}</p>
                        </div>
                        <p className="font-black text-lg" style={{ color: r.positive ? '#10b981' : 'rgba(255,255,255,0.9)' }}>{r.val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent transactions */}
                <div className="rounded-[24px] overflow-hidden" style={glass}>
                  <div className="px-5 pt-4 pb-3 flex justify-between items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>Recent</p>
                    <button onClick={() => setTab('history')} className="text-[8px] font-black uppercase tracking-widest" style={{ color: '#10b981' }}>View All →</button>
                  </div>
                  {transactions.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>No transactions yet</p>
                    </div>
                  ) : (
                    transactions.slice(0, 4).map((tx, i) => (
                      <div key={tx.id} className="px-5 py-3 flex items-center gap-3"
                        style={{ borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                          style={{ background: txBg(tx.type) }}>
                          {txIcon(tx.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-[10px] font-black truncate">{tx.description}</p>
                          <p className="text-[8px] font-bold" style={{ color: 'rgba(255,255,255,0.25)' }}>{formatDate(tx.created_at)}</p>
                        </div>
                        <p className="font-black text-sm flex-shrink-0" style={{ color: txColor(tx.type) }}>
                          {tx.amount > 0 ? '+' : ''}₹{Math.abs(tx.amount)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TOPUP */}
            {tab === 'topup' && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="rounded-[24px] p-5" style={glass}>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Select Amount</p>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {[200, 500, 1000, 1500, 2000, 5000].map(amt => (
                      <button key={amt} onClick={() => setTopupAmount(amt)}
                        className="py-3 rounded-xl text-sm font-black transition-all active:scale-95"
                        style={{
                          background: topupAmount === amt ? '#10b981' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${topupAmount === amt ? '#10b981' : 'rgba(255,255,255,0.08)'}`,
                          color: topupAmount === amt ? '#000' : 'rgba(255,255,255,0.6)',
                          boxShadow: topupAmount === amt ? '0 0 16px rgba(16,185,129,0.3)' : 'none',
                        }}>
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="text-[8px] font-black uppercase tracking-widest block mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Custom amount</label>
                    <input type="number" value={topupAmount} onChange={e => setTopupAmount(parseInt(e.target.value) || 0)} min={100}
                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '12px 16px', color: 'white', fontSize: 20, fontWeight: 900, outline: 'none' }} />
                  </div>
                </div>

                <div className="rounded-[24px] p-5" style={glass}>
                  <p className="text-[9px] font-black uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Pay Via</p>
                  <button onClick={() => setShowTopup(true)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98] mb-2"
                    style={{ background: 'rgba(99,91,255,0.08)', border: '1px solid rgba(99,91,255,0.25)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#635BFF' }}>
                      <span className="text-white font-black text-sm">S</span>
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-white text-sm font-black">Credit / Debit Card</p>
                      <p className="text-[8px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>Powered by Stripe · SSL Secured</p>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
                  </button>
                  <div className="flex items-center gap-4 p-4 rounded-2xl opacity-40 cursor-not-allowed"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <span className="text-white font-black text-sm">U</span>
                    </div>
                    <div className="text-left">
                      <p className="text-white text-sm font-black">UPI / GPay / PhonePe</p>
                      <p className="text-[8px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>Coming soon</p>
                    </div>
                  </div>
                </div>

                <button onClick={() => setShowTopup(true)}
                  className="w-full py-4 font-black uppercase text-xs tracking-widest rounded-2xl transition-all active:scale-95"
                  style={{ background: '#635BFF', color: 'white', boxShadow: '0 0 24px rgba(99,91,255,0.3)' }}>
                  Pay ₹{topupAmount} →
                </button>
              </div>
            )}

            {/* HISTORY */}
            {tab === 'history' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {transactions.length === 0 ? (
                  <div className="py-16 text-center rounded-[28px]" style={{ border: '1px dashed rgba(255,255,255,0.06)' }}>
                    <p className="text-4xl mb-3">📭</p>
                    <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>No transactions yet</p>
                  </div>
                ) : (
                  transactions.map(tx => (
                    <div key={tx.id} className="rounded-[20px] p-4 flex items-center gap-3" style={glass}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: txBg(tx.type) }}>
                        {txIcon(tx.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-[10px] font-black truncate">{tx.description}</p>
                        <p className="text-[8px] font-bold mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{formatDate(tx.created_at)}</p>
                      </div>
                      <p className="font-black text-sm flex-shrink-0" style={{ color: txColor(tx.type) }}>
                        {tx.amount > 0 ? '+' : ''}₹{Math.abs(tx.amount)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[88%] max-w-sm h-16 rounded-3xl flex items-center justify-around z-50"
        style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
        <Link href="/" className="flex flex-col items-center gap-1">
          <span className="text-base" style={{ color: 'rgba(255,255,255,0.25)' }}>○</span>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>Home</span>
        </Link>
        <Link href="/explore" className="flex flex-col items-center gap-1">
          <span className="text-base" style={{ color: 'rgba(255,255,255,0.25)' }}>◎</span>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>Explore</span>
        </Link>
        <Link href="/host" className="flex flex-col items-center gap-1">
          <span className="text-base" style={{ color: 'rgba(255,255,255,0.25)' }}>◇</span>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>Host</span>
        </Link>
        <Link href="/wallet" className="flex flex-col items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />
          <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#10b981' }}>Wallet</span>
        </Link>
        <Link href="/profile" className="flex flex-col items-center gap-1">
          <span className="text-base" style={{ color: 'rgba(255,255,255,0.25)' }}>○</span>
          <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>Profile</span>
        </Link>
      </nav>
    </main>
  );
}