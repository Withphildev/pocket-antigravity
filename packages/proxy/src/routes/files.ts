/**
 * /api/files route — local file preview (images)
 */

import type { Hono } from "hono";
import { createReadStream, existsSync } from "node:fs";
import { extname, posix, win32 } from "node:path";
import { Readable } from "node:stream";
import { homedir } from "node:os";
import type { LSDiscovery } from "../discovery.js";

const IMAGE_EXTS: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

function fileUriToPath(
  fileUri: string,
  useWindowsPaths: boolean,
): string | null {
  try {
    const url = new URL(fileUri);
    if (url.protocol !== "file:") return null;

    let pathname = decodeURIComponent(url.pathname);

    if (!useWindowsPaths) {
      if (url.hostname && url.hostname !== "localhost") {
        return `//${url.hostname}${pathname}`;
      }
      return pathname;
    }

    // Node's fileURLToPath() follows the host runtime OS. This custom branch
    // keeps Windows file:// URIs testable and correctly resolved even when the
    // code runs on a non-Windows host.
    if (url.hostname && url.hostname !== "localhost") {
      return `\\\\${url.hostname}${pathname.replaceAll("/", "\\")}`;
    }

    if (/^\/[A-Za-z]:/.test(pathname)) {
      return pathname.slice(1).replaceAll("/", "\\");
    }

    // On Windows, the pathname can sometimes be /D:/...
    if (pathname.startsWith("/")) {
       pathname = pathname.slice(1);
    }

    return pathname.replaceAll("/", "\\");
  } catch {
    return null;
  }
}

function normalizeLegacyPath(
  filePath: string,
  useWindowsPaths: boolean,
): string {
  // Backward-compatibility for old clients that already rewrote file:///C:/...
  // into /C:/... before the URI-safe pipeline existed.
  if (useWindowsPaths && /^\/[A-Za-z]:/.test(filePath)) {
    return filePath.slice(1);
  }
  return filePath;
}

function looksLikeWindowsPath(filePath: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(filePath) || /^\\\\/.test(filePath);
}

function inferWindowsPathMode(
  home: string,
  fileRef: string,
  useWindowsPaths?: boolean,
): boolean {
  if (typeof useWindowsPaths === "boolean") {
    return useWindowsPaths;
  }

  if (looksLikeWindowsPath(home)) {
    return true;
  }

  if (home.startsWith("/") && !/^\/[A-Za-z]:/.test(home)) {
    return false;
  }

  if (fileRef.startsWith("file://")) {
    try {
      const url = new URL(fileRef);
      const pathname = decodeURIComponent(url.pathname);
      return (
        (Boolean(url.hostname) && url.hostname !== "localhost") ||
        /^\/[A-Za-z]:/.test(pathname)
      );
    } catch {
      return false;
    }
  }

  return looksLikeWindowsPath(fileRef) || /^\/[A-Za-z]:/.test(fileRef);
}

/**
 * Resolve a file reference (URI or path) against a set of allowed roots.
 * Returns the absolute resolved path if it is inside any root, or null otherwise.
 */
export function resolveSafePath(
  fileRef: string,
  allowedRoots: string[],
  useWindowsPaths?: boolean,
): string | null {
  const home = allowedRoots[0] || homedir();
  const windowsPaths = inferWindowsPathMode(home, fileRef, useWindowsPaths);
  const pathApi = windowsPaths ? win32 : posix;

  const localPath = fileRef.startsWith("file://")
    ? fileUriToPath(fileRef, windowsPaths)
    : normalizeLegacyPath(fileRef, windowsPaths);
  if (!localPath) return null;

  if (!pathApi.isAbsolute(localPath)) {
    // If not absolute, try resolving against each root until one fits
    for (const root of allowedRoots) {
      const resolvedRoot = pathApi.resolve(root);
      const resolvedPath = pathApi.resolve(resolvedRoot, localPath);
      const relativePath = pathApi.relative(resolvedRoot, resolvedPath);
      if (!relativePath.startsWith("..") && !pathApi.isAbsolute(relativePath)) {
        return resolvedPath;
      }
    }
    return null;
  }

  // If absolute, it must be under at least one allowed root
  const resolvedPath = pathApi.resolve(localPath);
  for (const root of allowedRoots) {
    const resolvedRoot = pathApi.resolve(root);
    const relativePath = pathApi.relative(resolvedRoot, resolvedPath);
    if (!relativePath.startsWith("..") && !pathApi.isAbsolute(relativePath)) {
      return resolvedPath;
    }
  }

  return null;
}

export function registerFileRoutes(app: Hono, discovery?: LSDiscovery): void {
  app.get("/api/files", async (c) => {
    const fileRef = c.req.query("uri") ?? c.req.query("path");
    if (!fileRef) {
      return c.json({ error: "Missing 'uri' or 'path' query param" }, 400);
    }

    const roots = [homedir()];
    if (discovery) {
      // Add more permissive roots for testing/development if desired.
      if (process.platform === "win32") {
        roots.push("D:\\");
        roots.push("C:\\");
      } else {
        roots.push("/");
      }
    }

    const resolved = resolveSafePath(fileRef, roots);
    if (!resolved) {
      console.warn(`🛑 File access denied: [${fileRef}] (not under ${roots.join(", ")})`);
      return c.json({ error: "Access denied" }, 403);
    }

    // Only serve images
    console.log(`🔍 Serving file: ${resolved}`);
    const ext = extname(resolved).toLowerCase();
    const mimeType = IMAGE_EXTS[ext];
    if (!mimeType) {
      return c.json({ error: `Unsupported file type: ${ext}` }, 400);
    }

    if (!existsSync(resolved)) {
      return c.json({ error: "File not found" }, 404);
    }

    const stream = createReadStream(resolved);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  });
}
