import { useCallback, useRef } from 'react';
import { FixedSizeList as List, ListChildComponentProps, ListOnItemsRenderedProps } from 'react-window';
import { useInfiniteLoader } from 'react-window-infinite-loader';
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
  onLoadMore,
}: GameGridProps) {
  const columnCountRef = useRef(1);

  // Check if a row is loaded
  const isRowLoaded = useCallback(
    (rowIndex: number) => {
      const columnCount = columnCountRef.current;
      const startIndex = rowIndex * columnCount;
      return startIndex < games.length || startIndex >= total;
    },
    [games.length, total]
  );

  // Load more rows - called by infinite loader, not during render
  const loadMoreRows = useCallback(() => {
    if (hasMore) {
      onLoadMore();
    }
    return Promise.resolve();
  }, [hasMore, onLoadMore]);

  // Use the infinite loader hook
  const rowCount = Math.ceil(total / Math.max(1, columnCountRef.current));
  const onRowsRendered = useInfiniteLoader({
    isRowLoaded,
    loadMoreRows,
    rowCount,
    threshold: 5,
  });

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

  // Memoized item data creator
  const createItemData = useCallback(
    (columnCount: number) => ({ games, columnCount, total }),
    [games, total]
  );

  // Convert onRowsRendered to onItemsRendered format
  const handleItemsRendered = useCallback(
    ({ visibleStartIndex, visibleStopIndex }: ListOnItemsRenderedProps) => {
      onRowsRendered({ startIndex: visibleStartIndex, stopIndex: visibleStopIndex });
    },
    [onRowsRendered]
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
          const currentRowCount = Math.ceil(total / columnCount);
          const itemData = createItemData(columnCount);

          return (
            <List
              key={columnCount}
              height={height}
              width={width}
              itemCount={currentRowCount}
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
