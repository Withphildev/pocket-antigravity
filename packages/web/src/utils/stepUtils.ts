import type { TrajectoryStep, FilePermissionRequest } from "../types";

/** Extract file basename from a URI or path */
export function basename(uriOrPath: string): string {
  const cleaned = uriOrPath.replace(/^file:\/\//, "");
  return cleaned.split("/").pop() ?? cleaned;
}

/**
 * Extract a filePermissionRequest from any of the tool data fields
 * where the LS may embed it, or from the step's top-level field.
 *
 * The LS embeds filePermissionRequest in 6 step types:
 * CodeAction, ViewFile, ListDirectory, GrepSearch, ViewFileOutline, ViewCodeItem.
 */
export function getFilePermissionRequest(
  step: TrajectoryStep,
): FilePermissionRequest | undefined {
  return (
    step.filePermissionRequest ??
    step.viewFile?.filePermissionRequest ??
    step.listDirectory?.filePermissionRequest ??
    step.codeAction?.filePermissionRequest ??
    step.grepSearch?.filePermissionRequest ??
    step.viewFileOutline?.filePermissionRequest ??
    step.viewCodeItem?.filePermissionRequest
  );
}
