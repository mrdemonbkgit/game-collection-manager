import SearchInput from './SearchInput';
import SortDropdown from './SortDropdown';
import { SortOption } from '../services/gamesService';

interface HeaderProps {
  // Total count (unfiltered)
  totalCount: number;
  // Filtered count
  filteredCount: number;
  // Search
  searchValue: string;
  onSearchChange: (value: string) => void;
  // Sort
  sortOptions: SortOption[];
  currentSortId: string;
  onSortChange: (sortId: string) => void;
  // Loading state
  loading?: boolean;
}

export default function Header({
  totalCount,
  filteredCount,
  searchValue,
  onSearchChange,
  sortOptions,
  currentSortId,
  onSortChange,
  loading = false,
}: HeaderProps) {
  const showFilteredCount = filteredCount !== totalCount;

  return (
    <header data-testid="header" className="sticky top-0 z-10 bg-steam-bg-dark border-b border-steam-border">
      <div className="max-w-[1920px] mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Title and count */}
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-steam-text">
              Game Collection
            </h1>
            <span data-testid="game-count" className="text-sm text-steam-text-muted">
              {showFilteredCount ? (
                <>
                  Showing {filteredCount.toLocaleString()} of {totalCount.toLocaleString()} games
                </>
              ) : (
                <>{totalCount.toLocaleString()} games</>
              )}
            </span>
          </div>

          {/* Right: Search and Sort */}
          <div className="flex items-center gap-4">
            <div className="w-64">
              <SearchInput
                value={searchValue}
                onChange={onSearchChange}
              />
            </div>
            <SortDropdown
              sortOptions={sortOptions}
              value={currentSortId}
              onChange={onSortChange}
              loading={loading}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
