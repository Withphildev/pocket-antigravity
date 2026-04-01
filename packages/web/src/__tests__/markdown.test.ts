import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock import.meta.env before importing the module
vi.stubGlobal("import.meta", {
  env: { VITE_API_BASE: "http://localhost:3100" },
});

// We need to mock `marked` since it may have issues in a Node test environment.
// Instead, let's test `rewriteFileUris` which is pure string manipulation.

describe("rewriteFileUris", () => {
  // Import dynamically to get the mocked version
  let rewriteFileUris: (text: string) => string;

  beforeEach(async () => {
    // Reset modules so import.meta.env is fresh
    vi.resetModules();

    // Stub import.meta.env for the markdown module
    const mod = await import("../utils/markdown");
    rewriteFileUris = mod.rewriteFileUris;
  });

  it("rewrites file:// image URIs to proxy URLs", () => {
    const input = "![screenshot](file:///home/user/image.png)";
    const result = rewriteFileUris(input);
    expect(result).toContain("/api/files?uri=");
    expect(result).toContain(
      encodeURIComponent("file:///home/user/image.png"),
    );
  });

  it("preserves alt text", () => {
    const input = "![my alt text](file:///path/to/img.jpg)";
    const result = rewriteFileUris(input);
    expect(result).toContain("![my alt text]");
  });

  it("handles multiple file:// URIs", () => {
    const input = "![a](file:///one.png) text ![b](file:///two.jpg)";
    const result = rewriteFileUris(input);
    expect(result).toContain(encodeURIComponent("file:///one.png"));
    expect(result).toContain(encodeURIComponent("file:///two.jpg"));
  });

  it("does not modify non-file:// image URIs", () => {
    const input = "![pic](https://example.com/img.png)";
    const result = rewriteFileUris(input);
    expect(result).toBe(input);
  });

  it("does not modify plain text containing file://", () => {
    const input = "See file:///docs/readme.md for details";
    const result = rewriteFileUris(input);
    expect(result).toBe(input);
  });

  it("handles empty alt text", () => {
    const input = "![](file:///path/image.png)";
    const result = rewriteFileUris(input);
    expect(result).toContain("![]");
    expect(result).toContain("/api/files?uri=");
  });

  it("rewrites Windows file URIs without dropping the drive letter", () => {
    const input = "![win](file:///C:/Users/test/image.png)";
    const result = rewriteFileUris(input);
    expect(result).toContain(
      encodeURIComponent("file:///C:/Users/test/image.png"),
    );
  });
});

describe("renderMarkdown", () => {
  let renderMarkdown: (text: string) => string;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../utils/markdown");
    renderMarkdown = mod.renderMarkdown;
  });

  it("converts markdown to HTML", () => {
    const result = renderMarkdown("**bold**");
    expect(result).toContain("<strong>bold</strong>");
  });

  it("caches repeated calls", () => {
    const first = renderMarkdown("# heading");
    const second = renderMarkdown("# heading");
    // Same reference from cache
    expect(first).toBe(second);
  });

  it("converts code blocks", () => {
    const result = renderMarkdown("```js\nconst x = 1;\n```");
    expect(result).toContain("<code");
    expect(result).toContain("const x = 1;");
  });

  it("escapes raw HTML tags", () => {
    const result = renderMarkdown("hello <img src=x onerror=alert(1)>");
    expect(result).toContain("&lt;img");
    expect(result).not.toContain("<img");
  });

  it("drops unsafe markdown links", () => {
    const result = renderMarkdown("[x](javascript:alert(1))");
    expect(result).toContain(">x<");
    expect(result).not.toContain("<a");
    expect(result).not.toContain("javascript:");
  });

  it("drops entity-obfuscated javascript links", () => {
    const result = renderMarkdown("[x](jav&#x61;script:alert(1))");
    expect(result).toContain(">x<");
    expect(result).not.toContain("<a");
    expect(result).not.toContain("javascript:");
  });

  it("drops unsafe markdown images", () => {
    const result = renderMarkdown("![x](javascript:alert(1))");
    expect(result).toContain(">x<");
    expect(result).not.toContain("<img");
  });

  it("handles empty string", () => {
    const result = renderMarkdown("");
    expect(typeof result).toBe("string");
  });
});
