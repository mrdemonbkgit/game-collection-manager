import { fetchApi } from './api';
import {
  Collection,
  CollectionApiResponse,
  transformCollection,
  CreateCollectionInput,
} from '../types/collection';

interface CollectionsApiResponse {
  success: boolean;
  data: CollectionApiResponse[];
}

interface CollectionApiResponseSingle {
  success: boolean;
  data: CollectionApiResponse;
}

export async function fetchCollections(): Promise<Collection[]> {
  const response = await fetchApi<CollectionsApiResponse>('/collections');
  return response.data.map(transformCollection);
}

export async function fetchCollection(id: number): Promise<Collection> {
  const response = await fetchApi<CollectionApiResponseSingle>(
    `/collections/${id}`
  );
  return transformCollection(response.data);
}

export async function createCollection(
  input: CreateCollectionInput
): Promise<Collection> {
  // Transform to snake_case for server
  const body = {
    name: input.name,
    description: input.description,
    is_smart_filter: input.isSmartFilter ? 1 : 0,
    filter_criteria: input.filterCriteria
      ? JSON.stringify(input.filterCriteria)
      : null,
  };

  const response = await fetchApi<CollectionApiResponseSingle>('/collections', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return transformCollection(response.data);
}

export async function updateCollection(
  id: number,
  input: Partial<CreateCollectionInput>
): Promise<Collection> {
  // Transform to snake_case for server
  const body: Record<string, unknown> = {};

  if (input.name !== undefined) {
    body.name = input.name;
  }
  if (input.description !== undefined) {
    body.description = input.description;
  }
  if (input.isSmartFilter !== undefined) {
    body.is_smart_filter = input.isSmartFilter ? 1 : 0;
  }
  if (input.filterCriteria !== undefined) {
    body.filter_criteria = input.filterCriteria
      ? JSON.stringify(input.filterCriteria)
      : null;
  }

  const response = await fetchApi<CollectionApiResponseSingle>(
    `/collections/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    }
  );

  return transformCollection(response.data);
}

export async function deleteCollection(id: number): Promise<void> {
  await fetchApi<{ success: boolean }>(`/collections/${id}`, {
    method: 'DELETE',
  });
}

export async function addGameToCollection(
  collectionId: number,
  gameId: number
): Promise<void> {
  await fetchApi<{ success: boolean }>(
    `/collections/${collectionId}/games/${gameId}`,
    {
      method: 'POST',
    }
  );
}

export async function removeGameFromCollection(
  collectionId: number,
  gameId: number
): Promise<void> {
  await fetchApi<{ success: boolean }>(
    `/collections/${collectionId}/games/${gameId}`,
    {
      method: 'DELETE',
    }
  );
}

export async function fetchCollectionsForGame(
  _gameId: number
): Promise<number[]> {
  // This would need a new endpoint, but for now we can fetch all collections
  // and check membership client-side, or add endpoint later
  // For simplicity, we'll add a dedicated endpoint later if needed
  const collections = await fetchCollections();
  // Note: This doesn't actually give us which games are in which collections
  // We may need to add a dedicated endpoint for this
  return collections.map((c) => c.id);
}
