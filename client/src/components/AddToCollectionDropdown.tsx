import { useRef, useEffect } from 'react';
import { Collection } from '../types/collection';

interface AddToCollectionDropdownProps {
  gameId: number;
  collections: Collection[];
  gameCollectionIds: number[];
  onToggle: (collectionId: number, gameId: number) => void;
  onClose: () => void;
}

export default function AddToCollectionDropdown({
  gameId,
  collections,
  gameCollectionIds,
  onToggle,
  onClose,
}: AddToCollectionDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Filter out smart filters - you can only add games to regular collections
  const regularCollections = collections.filter((c) => !c.isSmartFilter);

  return (
    <div
      ref={dropdownRef}
      className="absolute top-8 right-0 z-20 bg-steam-bg-card border border-steam-border rounded-md shadow-lg min-w-[200px] py-1"
      onClick={(e) => e.stopPropagation()}
      data-testid="add-to-collection-dropdown"
    >
      {regularCollections.length === 0 ? (
        <div className="px-3 py-2 text-sm text-steam-text-muted">
          No collections yet
        </div>
      ) : (
        <>
          <div className="px-3 py-1 text-xs text-steam-text-muted uppercase tracking-wider">
            Add to Collection
          </div>
          {regularCollections.map((collection) => {
            const isInCollection = gameCollectionIds.includes(collection.id);
            return (
              <button
                key={collection.id}
                onClick={() => onToggle(collection.id, gameId)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-steam-bg-dark flex items-center gap-2 transition-colors"
                data-testid={`add-to-collection-${collection.id}`}
              >
                <span
                  className={`w-4 h-4 flex items-center justify-center rounded border ${
                    isInCollection
                      ? 'bg-steam-accent border-steam-accent text-white'
                      : 'border-steam-border'
                  }`}
                >
                  {isInCollection && (
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </span>
                <span className="text-steam-text flex-1">{collection.name}</span>
                <span className="text-xs text-steam-text-muted">
                  {collection.gameCount}
                </span>
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}
