import { useState, useEffect } from 'react';
import { Collection, CreateCollectionInput, FilterCriteria } from '../types/collection';
import { FilterState } from '../hooks/useFilterParams';

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: CreateCollectionInput) => void;
  collection?: Collection; // For edit mode
  currentFilters?: FilterState; // For "Save as Smart Filter"
}

export default function CollectionModal({
  isOpen,
  onClose,
  onSave,
  collection,
  currentFilters,
}: CollectionModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saveAsSmartFilter, setSaveAsSmartFilter] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes or collection changes
  useEffect(() => {
    if (isOpen) {
      if (collection) {
        // Edit mode
        setName(collection.name);
        setDescription(collection.description || '');
        setSaveAsSmartFilter(collection.isSmartFilter);
      } else {
        // Create mode
        setName('');
        setDescription('');
        setSaveAsSmartFilter(false);
      }
      setError(null);
    }
  }, [isOpen, collection]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Collection name is required');
      return;
    }

    const input: CreateCollectionInput = {
      name: trimmedName,
      description: description.trim() || undefined,
      isSmartFilter: saveAsSmartFilter,
    };

    // If saving as smart filter, capture current filters
    if (saveAsSmartFilter && currentFilters) {
      const filterCriteria: FilterCriteria = {};

      if (currentFilters.search) {
        filterCriteria.search = currentFilters.search;
      }
      if (currentFilters.platforms.length > 0) {
        filterCriteria.platforms = currentFilters.platforms;
      }
      if (currentFilters.genres.length > 0) {
        filterCriteria.genres = currentFilters.genres;
      }
      if (currentFilters.sortBy !== 'title') {
        filterCriteria.sortBy = currentFilters.sortBy;
      }
      if (currentFilters.sortOrder !== 'asc') {
        filterCriteria.sortOrder = currentFilters.sortOrder;
      }

      input.filterCriteria = filterCriteria;
    }

    onSave(input);
  };

  if (!isOpen) return null;

  const isEditing = !!collection;
  const hasActiveFilters = currentFilters && (
    currentFilters.search ||
    currentFilters.platforms.length > 0 ||
    currentFilters.genres.length > 0 ||
    currentFilters.sortBy !== 'title' ||
    currentFilters.sortOrder !== 'asc'
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      data-testid="collection-modal-overlay"
    >
      <div
        className="bg-steam-bg-card rounded-lg shadow-xl w-full max-w-md mx-4 border border-steam-border"
        onClick={(e) => e.stopPropagation()}
        data-testid="collection-modal"
      >
        <div className="px-6 py-4 border-b border-steam-border">
          <h2 className="text-lg font-semibold text-steam-text">
            {isEditing ? 'Edit Collection' : 'Create Collection'}
          </h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Name Input */}
            <div>
              <label
                htmlFor="collection-name"
                className="block text-sm font-medium text-steam-text mb-1"
              >
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="collection-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                className="w-full px-3 py-2 bg-steam-bg-dark border border-steam-border rounded-md text-steam-text placeholder-steam-text-muted focus:outline-none focus:ring-2 focus:ring-steam-accent focus:border-transparent"
                placeholder="e.g., Favorites, Cozy Games"
                autoFocus
                data-testid="collection-name-input"
              />
            </div>

            {/* Description Input */}
            <div>
              <label
                htmlFor="collection-description"
                className="block text-sm font-medium text-steam-text mb-1"
              >
                Description
              </label>
              <textarea
                id="collection-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-steam-bg-dark border border-steam-border rounded-md text-steam-text placeholder-steam-text-muted focus:outline-none focus:ring-2 focus:ring-steam-accent focus:border-transparent resize-none"
                placeholder="Optional description"
                data-testid="collection-description-input"
              />
            </div>

            {/* Smart Filter Checkbox */}
            {!isEditing && hasActiveFilters && (
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="save-as-smart-filter"
                  checked={saveAsSmartFilter}
                  onChange={(e) => setSaveAsSmartFilter(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-steam-border bg-steam-bg-dark text-steam-accent focus:ring-steam-accent focus:ring-offset-0 cursor-pointer"
                  data-testid="smart-filter-checkbox"
                />
                <label
                  htmlFor="save-as-smart-filter"
                  className="text-sm text-steam-text-muted cursor-pointer"
                >
                  <span className="text-steam-text font-medium">
                    Save current filters as Smart Filter
                  </span>
                  <br />
                  <span className="text-xs">
                    Smart filters dynamically show games matching the saved
                    criteria
                  </span>
                </label>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <p className="text-red-500 text-sm" data-testid="collection-error">
                {error}
              </p>
            )}
          </div>

          <div className="px-6 py-4 border-t border-steam-border flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-steam-text-muted hover:text-steam-text transition-colors"
              data-testid="collection-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-steam-accent text-white rounded-md hover:bg-steam-accent/80 transition-colors"
              data-testid="collection-save"
            >
              {isEditing ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
