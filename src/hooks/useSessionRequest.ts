'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';

export type SessionStatus =
  | 'pending'
  | 'approved'
  | 'denied'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface SessionRequest {
  id: string;
  charger_id: number;
  driver_id: string;
  host_id: string;
  status: SessionStatus;
  requested_at: string;
  approved_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  kwh_delivered: number;
  amount_charged: number;
  hold_amount: number;
  rate_per_kwh: number;
  time_limit_mins: number;
}

interface UseSessionRequestReturn {
  session: SessionRequest | null;
  loading: boolean;
  error: string | null;
  createRequest: (params: {
    chargerId: number;
    hostId: string;
    ratePerkWh: number;
    powerkW: number;
    timeLimitMins?: number;
  }) => Promise<{ id: string } | null>;
  cancelRequest: (sessionId: string) => Promise<void>;
}

export function useSessionRequest(userId: string | null): UseSessionRequestReturn {
  const supabase = createClient();
  const [session, setSession] = useState<SessionRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Subscribe to realtime status changes on active session ──
  useEffect(() => {
    if (!session?.id) return;

    const channel = supabase
      .channel(`session-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'session_requests',
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          setSession(prev =>
            prev ? { ...prev, ...(payload.new as SessionRequest) } : null
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.id]);

  // ── Create a new session_request + wallet hold ──
  const createRequest = useCallback(async ({
    chargerId,
    hostId,
    ratePerkWh,
    powerkW,
    timeLimitMins = 120,
  }: {
    chargerId: number;
    hostId: string;
    ratePerkWh: number;
    powerkW: number;
    timeLimitMins?: number;
  }): Promise<{ id: string } | null> => {
    if (!userId) return null;
    setLoading(true);
    setError(null);

    try {
      // 1. Check wallet balance
      const { data: wallet, error: walletErr } = await supabase
        .from('wallets')
        .select('id, balance, held')
        .eq('user_id', userId)
        .single();

      if (walletErr || !wallet) {
        setError('Could not load wallet. Please top up first.');
        setLoading(false);
        return null;
      }

      const holdAmount = +(ratePerkWh * powerkW * (timeLimitMins / 60)).toFixed(2);
      const available = wallet.balance - wallet.held;

      if (available < holdAmount) {
        setError(`Insufficient balance. Need ₹${holdAmount}, available ₹${available.toFixed(0)}.`);
        setLoading(false);
        return null;
      }

      // 2. Write session_request
      const { data: newSession, error: sessionErr } = await supabase
        .from('session_requests')
        .insert({
          charger_id: chargerId,
          driver_id: userId,
          host_id: hostId,
          status: 'pending',
          rate_per_kwh: ratePerkWh,
          hold_amount: holdAmount,
          time_limit_mins: timeLimitMins,
        })
        .select('*')
        .single();

      if (sessionErr || !newSession) {
        setError('Failed to create session. Please try again.');
        setLoading(false);
        return null;
      }

      // 3. Apply wallet hold (move from available into held)
      await supabase
        .from('wallets')
        .update({
          held: wallet.held + holdAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      // 4. Write hold transaction
      await supabase.from('wallet_transactions').insert({
        user_id: userId,
        type: 'hold',
        amount: -holdAmount,
        description: `Pre-auth hold for session`,
        session_id: newSession.id,
      });

      // 5. Write notification for host
      await supabase.from('notifications').insert({
        user_id: hostId,
        type: 'session_request',
        title: 'New Charging Request',
        body: `A driver wants to charge at your station.`,
        data: {
          session_id: newSession.id,
          charger_id: chargerId,
          driver_id: userId,
          hold_amount: holdAmount,
          rate_per_kwh: ratePerkWh,
        },
        read: false,
      });

      setSession(newSession as SessionRequest);
      setLoading(false);
      return { id: newSession.id };

    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
      setLoading(false);
      return null;
    }
  }, [userId]);

  // ── Cancel a pending request + release hold ──
  const cancelRequest = useCallback(async (sessionId: string) => {
    if (!userId) return;

    const { data: existing } = await supabase
      .from('session_requests')
      .select('hold_amount, status')
      .eq('id', sessionId)
      .single();

    // Only cancel if still pending
    if (!existing || existing.status !== 'pending') return;

    await supabase
      .from('session_requests')
      .update({ status: 'cancelled' })
      .eq('id', sessionId);

    // Release the hold
    const { data: wallet } = await supabase
      .from('wallets')
      .select('held')
      .eq('user_id', userId)
      .single();

    if (wallet) {
      await supabase
        .from('wallets')
        .update({
          held: Math.max(0, wallet.held - existing.hold_amount),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      await supabase.from('wallet_transactions').insert({
        user_id: userId,
        type: 'release',
        amount: existing.hold_amount,
        description: 'Hold released — session cancelled',
        session_id: sessionId,
      });
    }

    setSession(null);
  }, [userId]);

  return { session, loading, error, createRequest, cancelRequest };
}