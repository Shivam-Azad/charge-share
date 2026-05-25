import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

const glass = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.08)',
};

function getAdminIds() {
  return (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');
  if (!getAdminIds().includes(user.id)) redirect('/');

  const [
    { count: usersCount },
    { count: chargersCount },
    { count: sessionsCount },
    { data: completedSessions },
    { data: pendingChargers },
    { data: flaggedUsers },
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('chargers').select('id', { count: 'exact', head: true }),
    supabase.from('session_requests').select('id', { count: 'exact', head: true }),
    supabase.from('session_requests').select('amount_charged, kwh_delivered').eq('status', 'completed'),
    supabase.from('chargers').select('id').eq('is_verified', false),
    supabase.from('profiles').select('id').eq('flagged', true),
  ]);

  const revenue = (completedSessions ?? []).reduce((sum, row: any) => sum + Number(row.amount_charged ?? 0), 0);
  const kwh = (completedSessions ?? []).reduce((sum, row: any) => sum + Number(row.kwh_delivered ?? 0), 0);

  return (
    <main className="min-h-screen pb-28" style={{ background: '#050508' }}>
      <div className="w-full max-w-md mx-auto px-5 pt-12">
        <div className="mb-7">
          <p className="text-[9px] font-black uppercase tracking-[0.3em]" style={{ color: 'rgba(255,255,255,0.3)' }}>Protected</p>
          <h1 className="text-2xl font-black text-white tracking-tight">Admin Dashboard</h1>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            ['Users', usersCount ?? 0, 'Total profiles'],
            ['Chargers', chargersCount ?? 0, `${pendingChargers?.length ?? 0} pending`],
            ['Sessions', sessionsCount ?? 0, 'All time'],
            ['Flagged', flaggedUsers?.length ?? 0, 'Need review'],
          ].map(([label, value, sub]) => (
            <div key={label} className="rounded-[24px] p-5" style={glass}>
              <p className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
              <p className="text-2xl font-black text-white">{value}</p>
              <p className="text-[8px] font-bold mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>{sub}</p>
            </div>
          ))}
        </div>

        <div className="rounded-[24px] p-5 mb-5" style={glass}>
          <p className="text-[9px] font-black uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>Platform Stats</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Total kWh</p>
              <p className="text-xl font-black text-white">{kwh.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.25)' }}>Gross GMV</p>
              <p className="text-xl font-black" style={{ color: '#10b981' }}>Rs. {revenue.toFixed(0)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {[
            ['/admin/users', 'Users', 'Search users, ban or unban, and review trust flags.'],
            ['/admin/chargers', 'Chargers', 'Approve pending private charger listings.'],
          ].map(([href, title, body]) => (
            <Link key={href} href={href} className="block rounded-[24px] p-5 active:scale-[0.99] transition-all" style={glass}>
              <p className="text-white text-sm font-black">{title}</p>
              <p className="text-[10px] font-bold mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{body}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
