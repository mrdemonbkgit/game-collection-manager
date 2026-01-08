const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  // Handle empty or invalid JSON responses
  let data: T & { success?: boolean; error?: string };
  try {
    const text = await response.text();
    if (!text) {
      throw new ApiError('Empty response from server', response.status);
    }
    data = JSON.parse(text);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      `Invalid response: ${err instanceof Error ? err.message : 'Unknown error'}`,
      response.status
    );
  }

  if (!response.ok || !data.success) {
    throw new ApiError(
      data.error || 'API request failed',
      response.status,
      data
    );
  }

  return data;
}
