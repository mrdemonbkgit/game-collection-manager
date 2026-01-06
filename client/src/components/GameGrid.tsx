import { useCallback, useRef, useEffect } from 'react';
import { FixedSizeList as List, ListChildComponentProps, ListOnItemsRenderedProps } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { Game } from '../types/game';
import GameCard from './GameCard';

interface GameGridProps {
  games: Game[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

// Card dimensions (Steam medium density)
const CARD_WIDTH = 184;
const CARD_HEIGHT = 260;
const GAP = 16;
const ROW_HEIGHT = CARD_HEIGHT + GAP;
const LOAD_THRESHOLD = 5; // Load more when within 5 rows of end

// Skeleton placeholder for loading cards
function SkeletonCard() {
  return (
    <div className="w-full h-full">
      <div className="w-full h-[calc(100%-28px)] bg-steam-bg-card rounded animate-pulse" />
      <div className="mt-1 h-4 bg-steam-bg-card rounded w-3/4 animate-pulse" />
    </div>
  );
}

export default function GameGrid({
  games,
  total,
  hasMore,
  loading,
  onLoadMore,
}: GameGridProps) {
  // All values that change frequently go in refs to avoid re-render cascades
  const columnCountRef = useRef(1);
  const loadingRef = useRef(loading);
  const hasMoreRef = useRef(hasMore);
  const gamesLengthRef = useRef(games.length);
  const onLoadMoreRef = useRef(onLoadMore);
  const lastLoadTriggerRef = useRef(0);

  // Keep refs in sync with props (runs after render, no cascade)
  useEffect(() => {
    loadingRef.current = loading;
    hasMoreRef.current = hasMore;
    gamesLengthRef.current = games.length;
    onLoadMoreRef.current = onLoadMore;
  });

  // Stable callback - uses refs so no dependency changes
  const handleItemsRendered = useCallback(
    ({ visibleStopIndex }: ListOnItemsRenderedProps) => {
      // Guard: don't load if already loading or no more data
      if (loadingRef.current || !hasMoreRef.current) {
        return;
      }

      // Throttle: prevent rapid-fire calls (200ms minimum)
      const now = Date.now();
      if (now - lastLoadTriggerRef.current < 200) {
        return;
      }

      const columnCount = columnCountRef.current;
      const loadedRowCount = Math.ceil(gamesLengthRef.current / columnCount);

      // Load more when visible stop row is within threshold of loaded data
      if (visibleStopIndex >= loadedRowCount - LOAD_THRESHOLD) {
        lastLoadTriggerRef.current = now;
        onLoadMoreRef.current();
      }
    },
    [] // Empty deps - all values from refs, callback never changes
  );

  // Row renderer - creates a flex row of GameCards
  const Row = useCallback(
    ({ index: rowIndex, style, data }: ListChildComponentProps<{
      games: Game[];
      columnCount: number;
      total: number;
    }>) => {
      const { games, columnCount, total } = data;
      const startIndex = rowIndex * columnCount;

      return (
        <div style={style} className="flex gap-4 px-4">
          {Array.from({ length: columnCount }).map((_, colIndex) => {
            const gameIndex = startIndex + colIndex;

            // Beyond total - empty space
            if (gameIndex >= total) {
              return <div key={colIndex} style={{ width: CARD_WIDTH }} />;
            }

            const game = games[gameIndex];

            // Game exists - render card
            if (game) {
              return (
                <div key={game.id} style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
                  <GameCard game={game} />
                </div>
              );
            }

            // Within total but not loaded - skeleton
            return (
              <div key={`skeleton-${gameIndex}`} style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
                <SkeletonCard />
              </div>
            );
          })}
        </div>
      );
    },
    []
  );

  // Memoized item data - only changes when games or total change
  const createItemData = useCallback(
    (columnCount: number) => ({ games, columnCount, total }),
    [games, total]
  );

  return (
    <div data-testid="game-grid" className="flex-1 w-full">
      <AutoSizer
        renderProp={({ height, width }) => {
          // Handle undefined during initial render
          if (height === undefined || width === undefined) {
            return null;
          }

          // Calculate columns based on available width (with padding)
          const availableWidth = width - 32; // 16px padding each side
          const columnCount = Math.max(1, Math.floor((availableWidth + GAP) / (CARD_WIDTH + GAP)));
          columnCountRef.current = columnCount;
          const rowCount = Math.ceil(total / columnCount);
          const itemData = createItemData(columnCount);

          return (
            <List
              key={columnCount} // Re-key on column count change
              height={height}
              width={width}
              itemCount={rowCount}
              itemSize={ROW_HEIGHT}
              itemData={itemData}
              overscanCount={5}
              onItemsRendered={handleItemsRendered}
            >
              {Row}
            </List>
          );
        }}
      />
    </div>
  );
}
