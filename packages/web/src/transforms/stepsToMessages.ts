import type { ChatMessage, TrajectoryStep } from "../types";
import { getFilePermissionRequest } from "../utils/stepUtils";

/** Extract displayable messages from raw trajectory steps */
export function stepsToMessages(steps: TrajectoryStep[]): ChatMessage[] {
  const messages: ChatMessage[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const type = step.type;

    // File permission request: emit as a dedicated message type
    const fpr = getFilePermissionRequest(step);
    if (fpr) {
      messages.push({
        role: "system",
        content: "",
        stepIndex: i,
        type: "CORTEX_STEP_TYPE_FILE_PERMISSION",
        step,
      });
      continue;
    }

    if (type === "CORTEX_STEP_TYPE_USER_INPUT" && step.userInput?.items) {
      const texts = step.userInput.items
        .filter((item) => item.text?.trim())
        .map((item) => item.text!.trim());
      const media = step.userInput.media;
      if (texts.length > 0 || (media && media.length > 0)) {
        messages.push({
          role: "user",
          content: texts.join("\n\n"),
          stepIndex: i,
          type,
          optimisticId: step.clientMessageId,
          media,
        });
      }
    } else if (type === "CORTEX_STEP_TYPE_PLANNER_RESPONSE") {
      const pr = step.plannerResponse;
      if (!pr) continue;

      const text = pr.modifiedResponse ?? "";
      const thinking = pr.thinking ?? "";
      const thinkingDuration = pr.thinkingDuration ?? "";

      // Extract media from items if present
      const media = pr.items
        ?.filter((item) => item.media)
        .map((item) => item.media!);

      if (text.trim() || thinking.trim() || (media && media.length > 0)) {
        messages.push({
          role: "assistant",
          content: text,
          stepIndex: i,
          type,
          thinking: thinking || undefined,
          thinkingDuration: thinkingDuration || undefined,
          media,
        });
      }
    } else if (type === "CORTEX_STEP_TYPE_RUN_COMMAND" && step.runCommand) {
      const cmd =
        step.runCommand.commandLine ??
        step.runCommand.command ??
        step.runCommand.proposedCommandLine ??
        "";
      if (cmd) {
        messages.push({
          role: "system",
          content: "",
          stepIndex: i,
          type,
          step,
        });
      }
    } else if (type === "CORTEX_STEP_TYPE_CODE_ACTION" && step.codeAction) {
      messages.push({
        role: "system",
        content: "",
        stepIndex: i,
        type,
        step,
      });
    } else if (
      type === "CORTEX_STEP_TYPE_COMMAND_STATUS" &&
      step.commandStatus
    ) {
      const cs = step.commandStatus;
      const cmdId = cs.commandId;
      const status = cs.status;
      const combined = cs.combined ?? "";
      for (let j = messages.length - 1; j >= 0; j--) {
        const m = messages[j];
        if (m.step?.runCommand && m.step.runCommand.commandId === cmdId) {
          if (status === "CORTEX_STEP_STATUS_DONE" && combined) {
            m.step.runCommand.combinedOutput = { full: combined };
          }
          break;
        }
      }
    } else if (
      type === "CORTEX_STEP_TYPE_SEND_COMMAND_INPUT" &&
      step.sendCommandInput
    ) {
      if (step.sendCommandInput.terminate) {
        messages.push({
          role: "system",
          content: `⏹ Sending termination to command`,
          stepIndex: i,
          type,
        });
      }
    } else if (type === "CORTEX_STEP_TYPE_GREP_SEARCH" && step.grepSearch) {
      const gs = step.grepSearch;
      const query = gs.query ?? "";
      const results = gs.results ?? [];
      const searchPath = (gs.searchPathUri ?? "").replace("file://", "");
      const pathLabel = searchPath.split("/").pop() ?? searchPath;
      messages.push({
        role: "system",
        content: `Searched \`${query}\` in **${pathLabel}** — ${results.length} result${results.length !== 1 ? "s" : ""}`,
        stepIndex: i,
        type,
        icon: "search",
      });
    } else if (type === "CORTEX_STEP_TYPE_VIEW_FILE" && step.viewFile) {
      const vf = step.viewFile;
      const uri = (vf.absolutePathUri ?? "").replace("file://", "");
      const name = uri.split("/").pop() ?? uri;
      const range =
        vf.startLine && vf.endLine ? ` #L${vf.startLine}-${vf.endLine}` : "";
      messages.push({
        role: "system",
        content: `Viewed **${name}**${range}`,
        stepIndex: i,
        type,
        icon: "eye",
      });
    } else if (
      type === "CORTEX_STEP_TYPE_VIEW_FILE_OUTLINE" &&
      step.viewFileOutline
    ) {
      const uri = (step.viewFileOutline.absolutePathUri ?? "").replace(
        "file://",
        "",
      );
      const name = uri.split("/").pop() ?? uri;
      messages.push({
        role: "system",
        content: `Outlined **${name}**`,
        stepIndex: i,
        type,
        icon: "list",
      });
    } else if (
      type === "CORTEX_STEP_TYPE_VIEW_CODE_ITEM" &&
      step.viewCodeItem
    ) {
      const vci = step.viewCodeItem;
      const uri = (vci.absoluteUri ?? "").replace("file://", "");
      const name = uri.split("/").pop() ?? uri;
      const nodes = vci.nodePaths ?? [];
      messages.push({
        role: "system",
        content: `Analyzed **${name}**${nodes.length ? ` → ${nodes.join(", ")}` : ""}`,
        stepIndex: i,
        type,
        icon: "file-search",
      });
    } else if (
      type === "CORTEX_STEP_TYPE_LIST_DIRECTORY" &&
      step.listDirectory
    ) {
      const ld = step.listDirectory;
      const uri = (ld.directoryPathUri ?? "").replace("file://", "");
      const name = uri.split("/").pop() ?? uri;
      const results = ld.results ?? [];
      messages.push({
        role: "system",
        content: `Listed **${name}/** — ${results.length} items`,
        stepIndex: i,
        type,
        icon: "folder",
      });
    } else if (type === "CORTEX_STEP_TYPE_FIND" && step.find) {
      const f = step.find;
      const pattern = f.pattern ?? "*";
      const results = f.results ?? [];
      messages.push({
        role: "system",
        content: `Find \`${pattern}\` — ${results.length} result${results.length !== 1 ? "s" : ""}`,
        stepIndex: i,
        type,
        icon: "search",
      });
    }

    function extractMedia(step: any): any[] {
      const textSources = [
        step.plannerResponse?.modifiedResponse,
        ...(step.plannerResponse?.items?.map((it: any) => it.text) ?? []),
        step.userInput?.items?.map((it: any) => it.text).join("\n"),
        step.runCommand?.combinedOutput?.full,
        step.commandStatus?.combined,
        step.output,
      ].filter(Boolean);

      const allText = textSources.join("\n");
      const foundPaths = new Set<string>();

      const fileRegex = /(?:file:\/\/\/)?([a-zA-Z]:[\\/]+[^\"\'\r\n*?<>|]+?\.(?:png|webp|jpg|jpeg))/gi;
      let m;
      while ((m = fileRegex.exec(allText)) !== null) {
        foundPaths.add(m[1].trim());
      }

      return Array.from(foundPaths).map((p) => {
        let uri = p;
        if (!p.startsWith("file:")) {
          uri = "file:///" + p.replace(/\\/g, "/").replace(/^\/+/, "");
        }
        return {
          mimeType: "image/png",
          fileUri: uri,
        };
      });
    }

    // Universal Media Extraction for any step
    const extracted = extractMedia(step);
    if (extracted && extracted.length > 0) {
      // 1. Try to find an existing message from this step or related to this command
      let targetMsg = messages.find(m => m.stepIndex === i);
      
      // 2. If it's a command status, find the original command message
      if (!targetMsg && type === "CORTEX_STEP_TYPE_COMMAND_STATUS" && step.commandStatus) {
        const cmdId = step.commandStatus.commandId;
        targetMsg = messages.find(m => m.step?.runCommand?.commandId === cmdId);
      }

      // 3. Fallback: use the very last message created
      if (!targetMsg) {
        targetMsg = messages[messages.length - 1];
      }

      if (targetMsg) {
        const currentMedia = targetMsg.media || [];
        const existingUris = new Set(currentMedia.map((m: any) => m.fileUri).filter(Boolean));
        const toAdd = extracted.filter(m => !existingUris.has(m.fileUri));
        if (toAdd.length > 0) {
          targetMsg.media = [...currentMedia, ...toAdd];
        }
      }
    }
  }

  // Collapse consecutive text-only system messages
  const collapsed: ChatMessage[] = [];
  for (const msg of messages) {
    if (msg.role === "system" && !msg.step) {
      const prev = collapsed[collapsed.length - 1];
      if (prev?.role === "system" && !prev.step) {
        prev.content += "\n" + msg.content;
        continue;
      }
    }
    collapsed.push({ ...msg });
  }

  return collapsed;
}
