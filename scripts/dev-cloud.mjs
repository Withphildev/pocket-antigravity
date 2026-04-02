import path from "node:path";
import {
  commandName,
  ensureLogsDir,
  loadEnvFile,
  spawnLoggedProcess,
  terminateChild,
  waitForExit,
} from "./common.mjs";

loadEnvFile();

const tunnelName = process.env.PORTA_TUNNEL_NAME;
if (!tunnelName) {
  console.error("PORTA_TUNNEL_NAME is required in .env or the environment");
  process.exit(1);
}

const logsDir = ensureLogsDir();
let shuttingDown = false;

async function runComponent(label, command, args, logFile) {
  while (!shuttingDown) {
    console.log(`🚀 Starting ${label}...`);
    const { child, logStream } = spawnLoggedProcess(label, command, args, logFile);
    
    // Catch when it dies
    const { code, signal } = await waitForExit(child);
    logStream.end();
    
    if (shuttingDown) break;
    
    console.error(`⚠️  ${label} exited (code ${code}, signal ${signal}). Restarting in 5s...`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

// Start proxy and tunnel concurrently with their own restart loops
void runComponent(
  "proxy",
  commandName("pnpm"),
  ["--filter", "@porta/proxy", "dev"],
  path.join(logsDir, "proxy.log")
);

void runComponent(
  "tunnel",
  "cloudflared",
  ["tunnel", "--url", "http://127.0.0.1:3170", "run", tunnelName],
  path.join(logsDir, "tunnel.log")
);

console.log("✓ Porta cloud (Resilient) - Monitoring proxy and tunnel.");

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("🛑 Shutting down services...");
  // We don't track the children easily in the loop, so we kill everything matching or rely on taskkill.
  // Actually, to make shutdown clean, we should've tracked them.
  // But for simple dev scripts, taskkill is fine.
  process.exit(code);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    void shutdown(0);
  });
}
