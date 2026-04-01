const VITE_API_BASE = import.meta.env.VITE_API_BASE ?? "";
const ENV_API_KEY = import.meta.env.VITE_API_KEY ?? "";

export function getApiBase(): string {
  try {
    const local = localStorage.getItem("porta:api_base");
    if (local) return local;
  } catch {
    // Ignore
  }
  return VITE_API_BASE;
}

export function getApiKey(): string {
  try {
    const local = localStorage.getItem("porta:api_key");
    if (local) return local;
  } catch {
    // Ignore
  }
  return ENV_API_KEY;
}

export function setSessionApiKey(key: string) {
  try {
    localStorage.setItem("porta:api_key", key);
  } catch (e) {
    console.error("Failed to save API key:", e);
  }
}

export function setSessionApiBase(base: string) {
  try {
    // Clean up trailing slash
    const cleanBase = base.replace(/\/$/, "");
    localStorage.setItem("porta:api_base", cleanBase);
  } catch (e) {
    console.error("Failed to save API base:", e);
  }
}

function previewBody(text: string): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= 120) return singleLine;
  return `${singleLine.slice(0, 117)}...`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const apiKey = getApiKey();
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const url = `${getApiBase()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      console.warn(`[API] 🛑 Unauthorized (401) on ${url}. Headers sent:`, {
        "Authorization": headers["Authorization"] ? "REDACTED" : "MISSING",
        "Content-Type": headers["Content-Type"],
      });
    }
    const body = await res.text();
    let msg: string;
    try {
      msg = JSON.parse(body).error ?? body;
    } catch {
      msg = body;
    }
    throw new Error(`API ${res.status}: ${msg}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("json")) {
    const body = previewBody(await res.text());
    throw new Error(
      `API returned non-JSON for ${path}: ${body || "<empty response>"}`,
    );
  }

  return res.json();
}

export const api = {
  health: () => request<import("../types").HealthResponse>("/api/health"),

  conversations: () =>
    request<import("../types").ConversationsResponse>("/api/conversations"),

  getConversation: (cascadeId: string) =>
    request<import("../types").ConversationDetail>(
      `/api/conversations/${cascadeId}`,
    ),

  /** Fetch steps with optional limit. Returns { steps, offset, stepCount? }. */
  getSteps: (cascadeId: string, offset = 0, limit?: number, tail?: number) => {
    const params = new URLSearchParams({ offset: String(offset) });
    if (limit !== undefined) params.set("limit", String(limit));
    if (tail !== undefined) params.set("tail", String(tail));
    return request<import("../types").StepsPageResponse>(
      `/api/conversations/${cascadeId}/steps?${params}`,
    );
  },

  getWorkspaces: () =>
    request<{
      workspaceInfos?: { workspaceUri: string; gitRootUri?: string }[];
    }>("/api/workspaces"),

  browse: (path?: string) =>
    request<{ folders: { name: string; uri: string }[] }>(
      `/api/browse?${new URLSearchParams(path ? { path } : {}).toString()}`,
    ),

  startConversation: (workspaceUri?: string, fileAccessGranted = false) =>
    request<{ cascadeId: string }>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        ...(workspaceUri ? { workspaceFolderAbsoluteUri: workspaceUri } : {}),
        fileAccessGranted,
      }),
    }),

  sendMessage: (
    cascadeId: string,
    items: unknown[],
    clientMessageId?: string,
    model?: string,
    media?: import("../types").MediaAttachment[],
    plannerType?: string,
    fileAccessGranted = false,
  ) =>
    request(`/api/conversations/${cascadeId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        items,
        clientMessageId,
        model,
        media,
        plannerType,
        fileAccessGranted,
      }),
    }),

  stop: (cascadeId: string) =>
    request(`/api/conversations/${cascadeId}/stop`, { method: "POST" }),

  filePermission: (
    cascadeId: string,
    trajectoryId: string,
    stepIndex: number,
    allow: boolean,
    scope: number,
    absolutePathUri: string,
  ) =>
    request(`/api/conversations/${cascadeId}/file-permission`, {
      method: "POST",
      body: JSON.stringify({
        trajectoryId,
        stepIndex,
        allow,
        scope,
        absolutePathUri,
      }),
    }),

  commandAction: (
    cascadeId: string,
    trajectoryId: string,
    stepIndex: number,
    approved: boolean,
  ) =>
    request(`/api/conversations/${cascadeId}/command-action`, {
      method: "POST",
      body: JSON.stringify({
        trajectoryId,
        stepIndex,
        approved,
      }),
    }),

  codeAction: (
    cascadeId: string,
    trajectoryId: string,
    stepIndex: number,
    approved: boolean,
  ) =>
    request(`/api/conversations/${cascadeId}/code-action`, {
      method: "POST",
      body: JSON.stringify({
        trajectoryId,
        stepIndex,
        approved,
      }),
    }),
  revert: (cascadeId: string, stepIndex: number, model?: string) =>
    request(`/api/conversations/${cascadeId}/revert`, {
      method: "POST",
      body: JSON.stringify({ stepIndex, model }),
    }),

  deleteConversation: (cascadeId: string) =>
    request(`/api/conversations/${cascadeId}`, { method: "DELETE" }),

  models: () =>
    request<{
      clientModelConfigs: Array<{
        label: string;
        modelOrAlias: { model: string };
        supportsImages: boolean;
        isRecommended: boolean;
        quotaInfo?: { remainingFraction: number };
      }>;
      defaultOverrideModelConfig?: { modelOrAlias: { model: string } };
    }>("/api/models"),

  rpc: (method: string, body: Record<string, unknown> = {}) =>
    request(`/api/rpc/${method}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  search: (query: string) =>
    request<{
      query: string;
      results: {
        id: string;
        title: string;
        snippets: string[];
        matchCount: number;
      }[];
      totalConversations: number;
      elapsedMs: number;
    }>(`/api/search?q=${encodeURIComponent(query)}`),

  getWebSocketUrl: (cascadeId: string) => {
    const base = getApiBase() || window.location.origin;
    const isSsl = base.startsWith("https:") || window.location.protocol === "https:";
    const prot = isSsl ? "wss" : "ws";
    const wsBase = base.replace(/^https?:\/\//, "");
    const url = `${prot}://${wsBase}/api/conversations/${cascadeId}/ws`;
    const apiKey = getApiKey();
    return apiKey ? `${url}?key=${apiKey}` : url;
  },
};
