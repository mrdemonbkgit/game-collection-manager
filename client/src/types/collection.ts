// Raw API response (snake_case from server)
export interface CollectionApiResponse {
  id: number;
  name: string;
  description: string | null;
  is_smart_filter: number; // SQLite stores as 0/1
  filter_criteria: string | null; // JSON string
  game_count: number;
  created_at: string;
  updated_at: string;
}

// Client-side type (camelCase)
export interface Collection {
  id: number;
  name: string;
  description: string | null;
  isSmartFilter: boolean;
  filterCriteria: FilterCriteria | null;
  gameCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FilterCriteria {
  search?: string;
  platforms?: string[];
  genres?: string[];
  sortBy?: string;
  sortOrder?: string;
}

export interface CreateCollectionInput {
  name: string;
  description?: string;
  isSmartFilter?: boolean;
  filterCriteria?: FilterCriteria;
}

// Transform function (like transformGame in game.ts)
export function transformCollection(raw: CollectionApiResponse): Collection {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    isSmartFilter: Boolean(raw.is_smart_filter), // Convert 0/1 to boolean
    filterCriteria: raw.filter_criteria ? JSON.parse(raw.filter_criteria) : null,
    gameCount: raw.game_count,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}
