/**
 * /api/rpc/:method route — raw RPC passthrough (escape hatch)
 */

import type { Hono } from "hono";
import { rpc } from "../routing.js";
import { handleRPCError } from "../errors.js";

export function registerRpcPassthroughRoutes(app: Hono): void {
  app.post("/api/rpc/:method", async (c) => {
    const method = c.req.param("method");
    try {
      const body = await c.req.json().catch(() => ({}));
      const data = await rpc.call(method, body);
      return c.json(data);
    } catch (err) {
      return handleRPCError(c, err);
    }
  });
}
