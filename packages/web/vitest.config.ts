import { defineConfig, mergeConfig } from "vite";
import viteConfig from "./vite.config";

const baseConfig =
  typeof viteConfig === "function"
    ? viteConfig({
        command: "serve",
        mode: "test",
        isSsrBuild: false,
        isPreview: false,
      })
    : viteConfig;

export default mergeConfig(baseConfig, defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    exclude: ["e2e/**", "node_modules/**"],
  },
}));
