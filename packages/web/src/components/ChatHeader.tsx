import { IconMenu, IconFolder } from "./Icons";
import { WorkspaceSelector } from "./WorkspaceSelector";
import { slugFromUri } from "../hooks/useWorkspaces";

interface Props {
  title: string;
  projectName?: string;
  path?: string;
  isBusy?: boolean;
  onMenuToggle?: () => void;
  workspaces?: { uri: string; name: string }[];
  onSelectWorkspace?: (slug: string) => void;
  currentWorkspaceUri?: string;
}

export function ChatHeader({
  title,
  projectName,
  path,
  isBusy,
  onMenuToggle,
  workspaces = [],
  onSelectWorkspace,
  currentWorkspaceUri,
}: Props) {
  return (
    <div className={`main-header ${isBusy ? "is-busy" : ""}`}>
      {onMenuToggle && (
        <button
          className="mobile-menu-btn"
          onClick={onMenuToggle}
          title="Open menu"
        >
          <IconMenu size={18} />
        </button>
      )}
      <div className="main-header-content">
        {workspaces.length > 0 && (currentWorkspaceUri || projectName) ? (
          <div className="header-workspace-select">
            <WorkspaceSelector
              workspaces={workspaces}
              selected={currentWorkspaceUri || ""}
              placeholderName={projectName}
              onSelect={(uri) => {
                if (onSelectWorkspace) onSelectWorkspace(slugFromUri(uri));
              }}
            />
            <span className="breadcrumb-sep">/</span>
          </div>
        ) : null}
        <span
          className="breadcrumb-leaf"
          onClick={() => {
            document
              .querySelector(".chat-area")
              ?.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          {title}
        </span>
      </div>
      <div className="main-header-actions">
        {path && (
          <span className="main-header-project">
            <IconFolder size={11} /> {path}
          </span>
        )}
      </div>
    </div>
  );
}
