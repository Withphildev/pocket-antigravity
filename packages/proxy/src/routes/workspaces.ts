/**
 * /api/workspaces route
 */

import type { Hono } from "hono";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { discovery, rpc } from "../routing.js";
import { handleRPCError } from "../errors.js";

export function registerWorkspaceRoutes(app: Hono): void {
  app.get("/api/browse", async (c) => {
    const root = c.req.query("path") || "D:\\NovaSDK";
    try {
      const entries = await readdir(root, { withFileTypes: true });
      const folders = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith("."))
        .map((e) => ({
          name: e.name,
          uri: `file:///${join(root, e.name).replace(/\\/g, "/")}`,
        }));
      return c.json({ folders });
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  app.get("/api/workspaces", async (c) => {
    try {
      const instances = await discovery.getInstances();
      const allInfos: { workspaceUri: string; gitRootUri?: string }[] = [];
      let homeDirPath = "";
      let homeDirUri = "";

      await Promise.allSettled(
        instances.map(async (inst) => {
          try {
            const data = (await rpc.call("GetWorkspaceInfos", {}, inst)) as {
              homeDirPath?: string;
              homeDirUri?: string;
              workspaceInfos?: { workspaceUri: string; gitRootUri?: string }[];
            };
            if (data.homeDirPath) homeDirPath = data.homeDirPath;
            if (data.homeDirUri) homeDirUri = data.homeDirUri;
            if (data.workspaceInfos) allInfos.push(...data.workspaceInfos);
          } catch {
            // Skip unreachable instances
          }
        }),
      );

      return c.json({ homeDirPath, homeDirUri, workspaceInfos: allInfos });
    } catch (err) {
      return handleRPCError(c, err);
    }
  });
}
