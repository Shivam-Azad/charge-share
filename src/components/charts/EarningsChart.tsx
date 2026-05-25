'use client';

interface ChartPoint {
  label: string;
  value: number;
}

export default function EarningsChart({ data, color = '#10b981' }: { data: ChartPoint[]; color?: string }) {
  const max = Math.max(1, ...data.map(point => point.value));

  return (
    <div className="rounded-[24px] p-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(16px)' }}>
      <p className="text-[9px] font-black uppercase tracking-widest mb-5" style={{ color: 'rgba(255,255,255,0.3)' }}>Monthly Trend</p>
      <div className="h-40 flex items-end gap-2">
        {data.map(point => (
          <div key={point.label} className="flex-1 min-w-0 flex flex-col items-center gap-2">
            <div className="w-full rounded-t-xl transition-all" style={{ height: `${Math.max(8, (point.value / max) * 128)}px`, background: color, boxShadow: `0 0 18px ${color}33` }} />
            <span className="text-[8px] font-black uppercase truncate w-full text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
