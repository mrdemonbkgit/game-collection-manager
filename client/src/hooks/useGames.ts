import { useState, useEffect, useRef } from 'react';
import { Game } from '../types/game';
import { fetchGames, FetchGamesParams } from '../services/gamesService';

interface UseGamesResult {
  games: Game[];
  total: number;
  loading: boolean;
  error: string | null;
  totalPages: number;
}

export const PAGE_SIZE = 48; // 48 is divisible by 2,3,4,6,8 for nice grid layouts

export function useGames(
  params: Omit<FetchGamesParams, 'pageSize'> = {}
): UseGamesResult {
  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stabilize params by comparing JSON - prevents infinite loop when caller
  // passes inline object like { sortBy: 'title' } which creates new ref each render
  const paramsJson = JSON.stringify(params);
  const prevParamsJson = useRef(paramsJson);
  const paramsRef = useRef(params);

  if (paramsJson !== prevParamsJson.current) {
    paramsRef.current = params;
    prevParamsJson.current = paramsJson;
  }

  // Load games when params (including page) change
  useEffect(() => {
    let cancelled = false;

    const loadGames = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchGames({
          ...paramsRef.current,
          pageSize: PAGE_SIZE,
        });

        if (!cancelled) {
          setGames(result.items);
          setTotal(result.total);
        }
      } catch (err) {
        if (!cancelled) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to load games';
          setError(errorMsg);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadGames();

    return () => {
      cancelled = true;
    };
  }, [paramsJson]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return { games, total, loading, error, totalPages };
}
