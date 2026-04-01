import { useState, useEffect, useRef } from "react";
import { IconFolder, IconSpinner } from "./Icons";
import { api } from "../api/client";

interface Props {
  workspaces: { uri: string; name: string }[];
  selected: string;
  placeholderName?: string;
  onSelect: (uri: string) => void;
}

export function WorkspaceSelector({
  workspaces,
  selected,
  placeholderName,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const [browsing, setBrowsing] = useState<{ name: string; uri: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setBrowsing(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const activeLabel =
    workspaces.find((w) => w.uri === selected)?.name ??
    placeholderName ??
    "Project";

  const handleBrowse = async () => {
    setLoading(true);
    try {
      const data = await api.browse();
      setBrowsing(data.folders);
    } catch (err) {
      console.error("Failed to browse NovaSDK:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="model-selector" ref={ref}>
      <button
        className="model-selector-btn"
        onClick={() => {
          setOpen((v) => !v);
          setBrowsing(null);
        }}
        title="Select workspace"
      >
        <span className="model-selector-label">
          <IconFolder size={12} /> {activeLabel}
        </span>
        <span className="model-selector-caret">▾</span>
      </button>
      {open && (
        <div
          className="model-selector-dropdown"
          style={{ bottom: "auto", top: "100%", marginTop: 4, marginBottom: 0 }}
        >
          {browsing ? (
            <>
              <div className="dropdown-section-header">NovaSDK Folders</div>
              {browsing.map((f) => (
                <button
                  key={f.uri}
                  className="model-option"
                  onClick={() => {
                    onSelect(f.uri);
                    setOpen(false);
                    setBrowsing(null);
                  }}
                >
                  <span className="model-option-label">{f.name}</span>
                </button>
              ))}
              <button
                className="model-option back-action"
                onClick={() => setBrowsing(null)}
              >
                <span className="model-option-label">← Back to Workspace</span>
              </button>
            </>
          ) : (
            <>
              {workspaces.map((ws) => {
                const isActive = ws.uri === selected;
                return (
                  <button
                    key={ws.uri}
                    className={`model-option ${isActive ? "active" : ""}`}
                    onClick={() => {
                      onSelect(ws.uri);
                      setOpen(false);
                    }}
                  >
                    <span className="model-option-label">{ws.name}</span>
                  </button>
                );
              })}
              <div className="dropdown-divider" />
              <button
                className="model-option browse-action"
                onClick={handleBrowse}
                disabled={loading}
              >
                {loading ? (
                  <IconSpinner size={12} />
                ) : (
                  <IconFolder size={12} />
                )}
                <span className="model-option-label">Browse NovaSDK...</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
