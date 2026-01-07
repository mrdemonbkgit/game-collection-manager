import { useSearchParams } from 'react-router-dom';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

export type SortByType = 'title' | 'release_date' | 'metacritic_score' | 'created_at';
export type SortOrderType = 'asc' | 'desc';

export interface FilterState {
  search: string;
  platforms: string[];
  genres: string[];
  sortBy: SortByType;
  sortOrder: SortOrderType;
}

interface UseFilterParamsResult {
  filters: FilterState;
  setSearch: (value: string) => void;
  setPlatforms: (platforms: string[]) => void;
  togglePlatform: (platform: string) => void;
  setGenres: (genres: string[]) => void;
  toggleGenre: (genre: string) => void;
  setSort: (sortBy: SortByType, sortOrder: SortOrderType) => void;
  setSortById: (sortId: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

const DEFAULT_SORT_BY: SortByType = 'title';
const DEFAULT_SORT_ORDER: SortOrderType = 'asc';
const SEARCH_DEBOUNCE_MS = 300;

// Valid values for validation
const VALID_SORT_BY: SortByType[] = ['title', 'release_date', 'metacritic_score', 'created_at'];
const VALID_SORT_ORDER: SortOrderType[] = ['asc', 'desc'];

function parseArrayParam(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
}

function validateSortBy(value: string | null): SortByType {
  if (value && VALID_SORT_BY.includes(value as SortByType)) {
    return value as SortByType;
  }
  return DEFAULT_SORT_BY;
}

function validateSortOrder(value: string | null): SortOrderType {
  if (value && VALID_SORT_ORDER.includes(value as SortOrderType)) {
    return value as SortOrderType;
  }
  return DEFAULT_SORT_ORDER;
}

export function useFilterParams(): UseFilterParamsResult {
  const [searchParams, setSearchParams] = useSearchParams();

  // Local state for debounced search
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Parse current URL state
  const filters = useMemo((): FilterState => ({
    search: searchParams.get('search') || '',
    platforms: parseArrayParam(searchParams.get('platforms')),
    genres: parseArrayParam(searchParams.get('genres')),
    sortBy: validateSortBy(searchParams.get('sortBy')),
    sortOrder: validateSortOrder(searchParams.get('sortOrder')),
  }), [searchParams]);

  // Check if any filters are active (not including default sort)
  const hasActiveFilters = useMemo(() => {
    return filters.search !== '' ||
      filters.platforms.length > 0 ||
      filters.genres.length > 0 ||
      filters.sortBy !== DEFAULT_SORT_BY ||
      filters.sortOrder !== DEFAULT_SORT_ORDER;
  }, [filters]);

  // Helper to update params (preserves unknown params)
  const updateParams = useCallback((
    updates: Partial<Record<string, string | null>>,
    options: { replace?: boolean } = {}
  ) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '' || value === undefined) {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      }

      return newParams;
    }, { replace: options.replace });
  }, [setSearchParams]);

  // Debounced search - uses replace to avoid history spam
  const setSearch = useCallback((value: string) => {
    setSearchInput(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      updateParams({ search: value || null }, { replace: true });
    }, SEARCH_DEBOUNCE_MS);
  }, [updateParams]);

  // Sync searchInput when URL changes externally
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch !== searchInput) {
      setSearchInput(urlSearch);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Platform setters - use push for discrete changes
  const setPlatforms = useCallback((platforms: string[]) => {
    updateParams({
      platforms: platforms.length > 0 ? platforms.join(',') : null,
    });
  }, [updateParams]);

  const togglePlatform = useCallback((platform: string) => {
    const current = parseArrayParam(searchParams.get('platforms'));
    const newPlatforms = current.includes(platform)
      ? current.filter(p => p !== platform)
      : [...current, platform];
    setPlatforms(newPlatforms);
  }, [searchParams, setPlatforms]);

  // Genre setters
  const setGenres = useCallback((genres: string[]) => {
    updateParams({
      genres: genres.length > 0 ? genres.join(',') : null,
    });
  }, [updateParams]);

  const toggleGenre = useCallback((genre: string) => {
    const current = parseArrayParam(searchParams.get('genres'));
    const newGenres = current.includes(genre)
      ? current.filter(g => g !== genre)
      : [...current, genre];
    setGenres(newGenres);
  }, [searchParams, setGenres]);

  // Sort setters
  const setSort = useCallback((sortBy: SortByType, sortOrder: SortOrderType) => {
    const updates: Partial<Record<string, string | null>> = {};

    // Only include if not default
    updates.sortBy = sortBy !== DEFAULT_SORT_BY ? sortBy : null;
    updates.sortOrder = sortOrder !== DEFAULT_SORT_ORDER ? sortOrder : null;

    // If sortBy is set but sortOrder is default, still need to set sortOrder
    // to maintain clarity in the URL
    if (sortBy !== DEFAULT_SORT_BY) {
      updates.sortOrder = sortOrder;
    }

    updateParams(updates);
  }, [updateParams]);

  // Set sort by combined ID (e.g., "title-asc")
  const setSortById = useCallback((sortId: string) => {
    const parts = sortId.split('-');
    const sortOrder = parts.pop() as SortOrderType;
    const sortBy = parts.join('-') as SortByType; // Handle "release-desc" etc.

    // Map the sort IDs to actual field names
    const sortByMap: Record<string, SortByType> = {
      'title': 'title',
      'release': 'release_date',
      'metacritic': 'metacritic_score',
      'added': 'created_at',
    };

    const actualSortBy = sortByMap[sortBy] || sortBy as SortByType;

    if (VALID_SORT_BY.includes(actualSortBy) && VALID_SORT_ORDER.includes(sortOrder)) {
      setSort(actualSortBy, sortOrder);
    }
  }, [setSort]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchInput('');
    updateParams({
      search: null,
      platforms: null,
      genres: null,
      sortBy: null,
      sortOrder: null,
    });
  }, [updateParams]);

  return {
    filters: {
      ...filters,
      search: searchInput, // Use local state for immediate UI updates
    },
    setSearch,
    setPlatforms,
    togglePlatform,
    setGenres,
    toggleGenre,
    setSort,
    setSortById,
    clearFilters,
    hasActiveFilters,
  };
}
