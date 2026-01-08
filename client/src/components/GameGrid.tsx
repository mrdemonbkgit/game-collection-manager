import { Game } from '../types/game';
import { Collection } from '../types/collection';
import GameCard from './GameCard';

interface GameGridProps {
  games: Game[];
  loading: boolean;
  collections?: Collection[];
  gameCollectionMap?: Map<number, number[]>;
  onAddToCollection?: (collectionId: number, gameId: number) => void;
}

export default function GameGrid({
  games,
  loading,
  collections = [],
  gameCollectionMap,
  onAddToCollection,
}: GameGridProps) {
  if (loading && games.length === 0) {
    return (
      <div data-testid="game-grid" className="px-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 24 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="game-grid" className="px-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {games.map((game) => {
          const gameCollectionIds = gameCollectionMap?.get(game.id) || [];
          return (
            <GameCard
              key={game.id}
              game={game}
              collections={collections}
              gameCollectionIds={gameCollectionIds}
              onAddToCollection={onAddToCollection}
            />
          );
        })}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="w-full aspect-[3/4]">
      <div className="w-full h-[calc(100%-28px)] bg-steam-bg-card rounded animate-pulse" />
      <div className="mt-1 h-4 bg-steam-bg-card rounded w-3/4 animate-pulse" />
    </div>
  );
}
