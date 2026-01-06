interface HeaderProps {
  gameCount: number;
}

export default function Header({ gameCount }: HeaderProps) {
  return (
    <header data-testid="header" className="sticky top-0 z-10 bg-steam-bg-dark border-b border-steam-border">
      <div className="max-w-[1920px] mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-steam-text">
            Game Collection
          </h1>
          <span data-testid="game-count" className="text-sm text-steam-text-muted">
            {gameCount.toLocaleString()} games
          </span>
        </div>
        {/* Future: Search bar, filters */}
      </div>
    </header>
  );
}
