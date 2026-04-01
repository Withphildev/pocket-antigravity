import { useState, useCallback, useEffect, useRef } from "react";
import {
  Routes,
  Route,
  useParams,
  useNavigate,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { ChatHeader } from "./components/ChatHeader";
import { ChatPanel } from "./components/ChatPanel";
import { ChatInput } from "./components/ChatInput";
import { SettingsPanel } from "./components/SettingsPanel";
import { WorkspaceSelector } from "./components/WorkspaceSelector";
import { IconFolder, IconLock } from "./components/Icons";
import { useConversations } from "./hooks/useConversations";
import { usePolling } from "./hooks/usePolling";
import { useWorkspaces, slugFromUri } from "./hooks/useWorkspaces";
import { useDraftText } from "./hooks/useDraftText";
import { useChatActions } from "./hooks/useChatActions";
import { useClientSettings } from "./hooks/useClientSettings";
import { api, setSessionApiKey } from "./api/client";
import { isUnconfirmedOptimisticMessage } from "./utils/optimisticMessages";
import type { HealthResponse, MediaAttachment } from "./types";
import type { PlannerType } from "./components/ChatInput";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/:projectSlug/settings" element={<ChatView />} />
      <Route path="/:projectSlug" element={<ChatView />} />
      <Route path="/:projectSlug/:chatId" element={<ChatView />} />
    </Routes>
  );
}

// ── Root redirect: go to the first workspace's new-chat page ──

function RootRedirect() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    api
      .getWorkspaces()
      .then((data) => {
        const first = data.workspaceInfos?.[0];
        if (first) {
          setTarget(`/${slugFromUri(first.workspaceUri)}`);
        } else {
          setTarget("/unknown");
        }
      })
      .catch(() => {
        // If the API fails, stay put — ChatView will handle empty state
        // We still need to bounce the user to ChatView, though.
        setTarget("/unknown");
      });
  }, []);

  if (target) return <Navigate to={target} replace />;
  return null; // Loading…
}

// ── Main Chat View ──

function ChatView() {
  const { projectSlug, chatId } = useParams<{
    projectSlug: string;
    chatId: string;
  }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isSettingsPage = location.pathname.endsWith("/settings");
  const activeId = chatId ?? null;
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 480);
  const isMobile = () => window.innerWidth <= 480;
  const { conversations, loading, refresh, error: convError } = useConversations(15_000);
  const { data: health } = usePolling<HealthResponse>(api.health, 30_000);
  
  const [isLocked, setIsLocked] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  
  useEffect(() => {
    const errorIsAuth = convError?.includes("401") || convError?.toLowerCase().includes("unauthorized");
    if (errorIsAuth && !isLocked) {
      // Re-locking on error can be annoying if they dismissed it once.
      // We'll only auto-lock if they haven't explicitly dismissed it or if it's the first time.
      setIsLocked(true);
    }
  }, [convError]); // Removed isLocked from dependencies to break the immediate flip-loop

  // ── Hooks ──
  const { workspaces, currentWorkspaceUri } = useWorkspaces(
    conversations,
    projectSlug,
  );
  const { draftText, handleDraftChange } = useDraftText(activeId);
  const { settings, updateSettings } = useClientSettings();

  const activeConv = conversations.find((c) => c.id === activeId);
  const isRunning = activeConv?.summary.status === "CASCADE_RUN_STATUS_RUNNING";
  const connected = !!health && health.languageServers.length > 0;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light-mode", "dark-mode");
    if (settings.theme === "light") {
      root.classList.add("light-mode");
    } else if (settings.theme === "dark") {
      root.classList.add("dark-mode");
    }
    // If "system", no classes added and CSS uses @media (prefers-color-scheme)
  }, [settings.theme]);

  const {
    optimisticMessages,
    setOptimisticMessages,
    confirmOptimisticMessages,
    stepsRefreshKey,
    hardRefreshKey,
    handleSend: doSend,
    handleStop,

    handleRevert: rawHandleRevert,
    handleDelete,
    chatUrl,
    triggerSoftRefresh,
  } = useChatActions({
    activeId,
    currentWorkspaceUri,
    projectSlug,
    refresh,
    conversations,
  });

  // Wire handleRevert to also update draft text
  const handleRevert = useCallback(
    async (stepIndex: number, draftContent?: string) => {
      await rawHandleRevert(stepIndex, draftContent);
      if (draftContent) {
        handleDraftChange(draftContent);
      }
    },
    [rawHandleRevert, handleDraftChange],
  );

  // ── Send: always grant file access ──
  const handleSend = useCallback(
    async (
      text: string,
      model: string | null,
      media?: MediaAttachment[],
      plannerType?: PlannerType,
    ) => {
      doSend(text, model, media, plannerType, true);
    },
    [doSend],
  );

  // ── Per-file permission response ──
  const handleFilePermission = useCallback(
    async (
      trajectoryId: string,
      stepIndex: number,
      allow: boolean,
      scope: number,
      absolutePathUri: string,
    ) => {
      if (!activeId) return;
      try {
        await api.filePermission(
          activeId,
          trajectoryId,
          stepIndex,
          allow,
          scope,
          absolutePathUri,
        );
        // WS activate signal (emitted by proxy) handles real-time push.
        // Soft refresh as insurance — non-destructive merge, no screen blank.
        triggerSoftRefresh();
        refresh();
      } catch (err) {
        console.error("Failed to respond to file permission:", err);
      }
    },
    [activeId, refresh, triggerSoftRefresh],
  );

  // ── Command action (approve/reject proposed command) ──
  const handleCommandAction = useCallback(
    async (
      trajectoryId: string,
      stepIndex: number,
      approved: boolean,
    ) => {
      if (!activeId) return;
      try {
        await api.commandAction(
          activeId,
          trajectoryId,
          stepIndex,
          approved,
        );
        triggerSoftRefresh();
        refresh();
      } catch (err) {
        console.error("Failed to respond to command action:", err);
        throw err; // Propagate so CommandCard can restore buttons
      }
    },
    [activeId, refresh, triggerSoftRefresh],
  );

  // ── Code action (approve/reject proposed file edit) ──
  const handleCodeAction = useCallback(
    async (
      trajectoryId: string,
      stepIndex: number,
      approved: boolean,
    ) => {
      if (!activeId) return;
      try {
        await api.codeAction(
          activeId,
          trajectoryId,
          stepIndex,
          approved,
        );
        triggerSoftRefresh();
        refresh();
      } catch (err) {
        console.error("Failed to respond to code action:", err);
        throw err; // Propagate so CodeActionCard can restore buttons
      }
    },
    [activeId, refresh, triggerSoftRefresh],
  );
  // ── Navigate helpers ──
  const handleNew = useCallback(() => {
    navigate(`/${projectSlug ?? "unknown"}`);
    setOptimisticMessages([]);
    if (isMobile()) setSidebarOpen(false);
  }, [navigate, projectSlug, setOptimisticMessages]);

  // Header info
  const headerTitle = activeId
    ? (activeConv?.summary.summary ?? "Session")
    : "New Chat";

  // ── Mobile Swipe Gestures ──
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobile()) return;
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const dx = touchEndX - touchStartX.current;
      const dy = touchEndY - touchStartY.current;

      // Must be primarily horizontal
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
        if (dx > 0 && touchStartX.current < 30) {
          // Swipe right from the far left edge → open
          setSidebarOpen(true);
        } else if (dx < 0 && sidebarOpen) {
          // Swipe left anywhere → close
          setSidebarOpen(false);
        }
      }
    },
    [sidebarOpen],
  );

  return (
    <div
      className="app-layout"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => {
          setOptimisticMessages([]);
          navigate(chatUrl(id));
          if (isMobile()) setSidebarOpen(false);
        }}
        onNew={handleNew}
        onDelete={handleDelete}
        onSettings={() => {
          navigate(`/${projectSlug ?? "unknown"}/settings`);
          if (isMobile()) setSidebarOpen(false);
        }}
        loading={loading}
        connected={connected}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        openUnlock={showUnlockModal}
        onUnlockOpenChange={setShowUnlockModal}
        workspaces={workspaces}
        onSelectWorkspace={(slug) => {
          navigate(`/${slug}`);
          setOptimisticMessages([]);
          if (isMobile()) setSidebarOpen(false);
        }}
      />
      {/* Mobile backdrop: tap to close sidebar */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="main-panel">
        <ChatHeader
          title={headerTitle}
          projectName={projectSlug ?? undefined}
          isBusy={isRunning}
          path={currentWorkspaceUri?.split("/").pop() ?? undefined}
          onMenuToggle={() => setSidebarOpen(true)}
          workspaces={workspaces}
          onSelectWorkspace={(slug) => {
            navigate(`/${slug}`);
            setOptimisticMessages([]);
          }}
          currentWorkspaceUri={currentWorkspaceUri}
        />
        {isSettingsPage ? (
          <SettingsPanel
            settings={settings}
            onUpdate={updateSettings}
            onBack={() => navigate(`/${projectSlug ?? "unknown"}`)}
          />
        ) : activeId ? (
          <ChatPanel
            key={activeId}
            cascadeId={activeId}
            onRevert={handleRevert}
            onFilePermission={handleFilePermission}
            onCommandAction={handleCommandAction}
            onCodeAction={handleCodeAction}
            onConfirmOptimistic={confirmOptimisticMessages}
            optimisticMessages={optimisticMessages}
            refreshKey={stepsRefreshKey}
            hardRefreshKey={hardRefreshKey}
            totalStepCount={activeConv?.summary.stepCount}
            isConversationRunning={isRunning}
            onSidebarRefresh={refresh}
          />
        ) : (
          <div
            className="chat-area"
            onTouchMove={() => {
              const el = document.activeElement;
              if (
                el instanceof HTMLTextAreaElement ||
                el instanceof HTMLInputElement
              ) {
                el.blur();
              }
            }}
          >
            <div className="chat-area-inner">
              {optimisticMessages.map((msg, i) => (
                <div
                  key={msg.optimisticId ?? i}
                  className={`message ${msg.role}${isUnconfirmedOptimisticMessage(msg) ? " unconfirmed" : ""}`}
                >
                  <div className="chat-block message-body">
                    <p>{msg.content}</p>
                  </div>
                </div>
              ))}
              {optimisticMessages.some(isUnconfirmedOptimisticMessage) && (
                <div className="message assistant">
                  <div className="chat-block message-body">
                    <div className="typing-indicator">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}
            </div>
            {optimisticMessages.length === 0 && (
              <div className="chat-empty">
                <div className="chat-empty-icon">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <linearGradient
                        id="chatGrad"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="var(--accent)" />
                        <stop offset="50%" stopColor="#a78bfa" />
                        <stop offset="100%" stopColor="#f472b6" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M12 2C6.48 2 2 5.92 2 10.67c0 2.72 1.47 5.15 3.78 6.73L4.5 21.5l4.33-2.17c1.02.28 2.09.43 3.17.43 5.52 0 10-3.92 10-8.76S17.52 2 12 2z"
                      fill="url(#chatGrad)"
                      opacity="0.25"
                    />
                    <path
                      d="M12 2C6.48 2 2 5.92 2 10.67c0 2.72 1.47 5.15 3.78 6.73L4.5 21.5l4.33-2.17c1.02.28 2.09.43 3.17.43 5.52 0 10-3.92 10-8.76S17.52 2 12 2z"
                      stroke="url(#chatGrad)"
                      strokeWidth="1.5"
                      fill="none"
                    />
                  </svg>
                </div>
                <div className="chat-empty-text">What can I help you build?</div>
                <div className="chat-empty-suggestions">
                  {[
                    "Research a technical topic",
                    "Write a feature proposal",
                    "Analyze a code bug",
                    "Plan a project architecture",
                  ].map((p) => (
                    <button
                      key={p}
                      className="chat-empty-suggestion-chip"
                      onClick={() => handleSend(p, settings.defaultModel)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                {workspaces.length > 0 && currentWorkspaceUri ? (
                  <WorkspaceSelector
                    workspaces={workspaces}
                    selected={currentWorkspaceUri}
                    onSelect={(uri) => {
                      const slug = slugFromUri(uri);
                      navigate(`/${slug}`);
                    }}
                  />
                ) : (
                  <div className="chat-empty-project">
                    <IconFolder size={13} /> {projectSlug ?? "Others"}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {!isSettingsPage && (
          <ChatInput
            onSend={handleSend}
            onStop={handleStop}
            isRunning={isRunning}
            disabled={!connected || isLocked}
            draft={draftText}
            onDraftChange={handleDraftChange}
            defaultModel={settings.defaultModel}
            defaultPlannerType={settings.defaultPlannerType}
            workspacePath={currentWorkspaceUri?.split("/").pop() ?? undefined}
          />
        )}
      </div>

      {isLocked && (
        <div className="auth-overlay">
          <div className="auth-modal">
            <div className="auth-header">
              <div className="auth-icon">
                <IconLock />
              </div>
              <h1 className="auth-title">Connection Locked</h1>
              <p className="auth-desc">
                Your mobile device is not authorized to access this Porta bridge.
                Please enter the API key configured on your local machine.
              </p>
            </div>
            
            <div className="auth-input-group">
              <div className="auth-label">API Key</div>
              <input
                className="auth-input"
                type="password"
                placeholder="Paste pk-xxxx here..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) {
                      setSessionApiKey(val);
                      setIsLocked(false);
                      triggerSoftRefresh();
                    }
                  }
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", marginTop: "12px" }}>
              <button 
                className="auth-submit"
                onClick={(e) => {
                  const input = (e.currentTarget.parentElement?.previousElementSibling?.querySelector("input") as HTMLInputElement);
                  const val = input?.value.trim();
                  if (val) {
                    setSessionApiKey(val);
                    setIsLocked(false);
                    triggerSoftRefresh();
                  }
                }}
              >
                Authorize Connection
              </button>
              
              <button 
                className="settings-reset-btn"
                style={{ padding: "12px", marginTop: "0", width: "100%" }}
                onClick={() => setIsLocked(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
