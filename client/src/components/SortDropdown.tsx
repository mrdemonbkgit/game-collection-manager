import { SortOption } from '../services/gamesService';

interface SortDropdownProps {
  sortOptions: SortOption[];
  value: string; // Combined ID like "title-asc"
  onChange: (sortId: string) => void;
  loading?: boolean;
}

export default function SortDropdown({
  sortOptions,
  value,
  onChange,
  loading = false,
}: SortDropdownProps) {
  // Convert current sortBy/sortOrder to sortId
  const getCurrentSortId = (): string => {
    // The value is already the combined sortId
    return value;
  };

  return (
    <div className="relative">
      <select
        value={getCurrentSortId()}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="appearance-none bg-steam-bg-card border border-steam-border rounded px-3 py-2 pr-8 text-steam-text focus:outline-none focus:border-steam-accent focus:ring-1 focus:ring-steam-accent disabled:opacity-50 cursor-pointer"
        data-testid="sort-dropdown"
      >
        {sortOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Dropdown arrow */}
      <svg
        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-steam-text-muted pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </div>
  );
}
