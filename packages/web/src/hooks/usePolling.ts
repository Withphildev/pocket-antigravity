import { useCallback, useEffect, useRef, useState } from "react";
import { useAppResume } from "./useAppResume";

/**
 * Generic polling hook with configurable interval.
 * Pauses when the tab is hidden.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  enabled = true,
): {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const prevDataRef = useRef<string>("");

  const doFetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      if (mountedRef.current) {
        // Skip re-render if data is structurally identical
        const serialized = JSON.stringify(result);
        if (serialized !== prevDataRef.current) {
          prevDataRef.current = serialized;
          setData(result);
        }
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    return doFetch();
  }, [doFetch]);

  useAppResume(doFetch);

  useEffect(() => {
    mountedRef.current = true;

    // Always fetch on mount / when deps change
    doFetch();

    if (!enabled) {
      return () => {
        mountedRef.current = false;
      };
    }

    const id = setInterval(() => {
      if (!document.hidden) doFetch();
    }, intervalMs);

    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [doFetch, intervalMs, enabled]);

  return { data, error, loading, refresh };
}
