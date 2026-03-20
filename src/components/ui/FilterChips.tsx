'use client';

export type FilterType = 'All' | 'Private' | 'Public' | 'Fast' | 'Available' | 'Free';

const FILTERS: { label: string; value: FilterType }[] = [
  { label: 'All',       value: 'All' },
  { label: '🟢 Private', value: 'Private' },
  { label: '🔵 Public',  value: 'Public' },
  { label: 'Fast ⚡',   value: 'Fast' },
  { label: 'Available', value: 'Available' },
  { label: 'Free',      value: 'Free' },
];

interface FilterChipsProps {
  onFilterChange?: (filter: FilterType) => void;
  activeFilter?: FilterType;
}

export default function FilterChips({ onFilterChange, activeFilter = 'All' }: FilterChipsProps) {
  return (
    <div className="w-full flex gap-2 overflow-x-auto py-4 no-scrollbar px-1">
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onFilterChange?.(filter.value)}
          className={`whitespace-nowrap px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 border ${
            activeFilter === filter.value
              ? 'bg-emerald-500 border-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]'
              : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}