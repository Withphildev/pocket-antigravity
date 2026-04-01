import { useMemo } from "react";
import { api } from "../api/client";
import { usePolling } from "./usePolling";
import type { ConversationSummary, ConversationsResponse } from "../types";

export interface ConversationEntry {
  id: string;
  summary: ConversationSummary;
}

export function useConversations(intervalMs = 15_000) {
  const { data, error, loading, refresh } = usePolling<ConversationsResponse>(
    api.conversations,
    intervalMs,
  );

  const conversations = useMemo<ConversationEntry[]>(() => {
    if (!data?.trajectorySummaries) return [];

    return Object.entries(data.trajectorySummaries)
      .map(([id, summary]) => ({ id, summary }))
      .sort(
        (a, b) =>
          new Date(b.summary.lastModifiedTime).getTime() -
          new Date(a.summary.lastModifiedTime).getTime(),
      );
  }, [data]);

  return { conversations, error, loading, refresh };
}
