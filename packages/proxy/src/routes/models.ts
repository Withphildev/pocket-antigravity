/**
 * /api/models route
 */

import type { Hono } from "hono";
import { rpcAny } from "../routing.js";
import { handleRPCError } from "../errors.js";

export function registerModelRoutes(app: Hono): void {
  app.get("/api/models", async (c) => {
    try {
      const data = (await rpcAny("GetCascadeModelConfigData")) as any;

      // Override default model if specified in .env
      const override = process.env.DEFAULT_MODEL_ID;
      if (override && data.clientModelConfigs) {
        const found = data.clientModelConfigs.find(
          (m: any) => m.modelOrAlias?.model === override
        );
        if (found) {
          data.defaultOverrideModelConfig = found;
        }
      }

      return c.json(data);
    } catch (err) {
      return handleRPCError(c, err);
    }
  });
}
