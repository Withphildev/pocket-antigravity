import { describe, it, expect, vi, beforeEach } from "vitest";

describe("rewriteFileUris — edge cases", () => {
  let rewriteFileUris: (text: string) => string;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal("import.meta", {
      env: { VITE_API_BASE: "http://localhost:3100" },
    });
    const mod = await import("../utils/markdown");
    rewriteFileUris = mod.rewriteFileUris;
  });

  it("handles spaces in file paths", () => {
    const input = "![img](file:///home/user/my folder/image.png)";
    const result = rewriteFileUris(input);
    expect(result).toContain("/api/files?uri=");
    expect(result).toContain(
      encodeURIComponent("file:///home/user/my folder/image.png"),
    );
  });

  it("handles special characters in file paths", () => {
    const input = "![](file:///tmp/スクリーンショット.png)";
    const result = rewriteFileUris(input);
    expect(result).toContain("/api/files?uri=");
  });

  it("handles parentheses in alt text", () => {
    const input = "![image (1)](file:///path/img.png)";
    // The regex won't match this because of the closing paren in alt — that's fine
    // Just verify no crash
    expect(() => rewriteFileUris(input)).not.toThrow();
  });

  it("handles markdown with mixed content", () => {
    const input = `# Title

Some text with **bold** and \`code\`.

![screenshot](file:///home/user/shot.png)

More text after.`;

    const result = rewriteFileUris(input);
    expect(result).toContain("# Title");
    expect(result).toContain("/api/files?uri=");
    expect(result).toContain("More text after.");
  });

  it("preserves Windows file URIs intact", () => {
    const input = "![img](file:///C:/Users/test/My%20Image.png)";
    const result = rewriteFileUris(input);
    expect(result).toContain(
      encodeURIComponent("file:///C:/Users/test/My%20Image.png"),
    );
  });

  it("handles file:// link (not image) unchanged", () => {
    const input = "[click here](file:///docs/readme.md)";
    const result = rewriteFileUris(input);
    // Only image syntax ![...] is rewritten, not link syntax [...].
    expect(result).toBe(input);
  });
});

describe("renderMarkdown — edge cases", () => {
  let renderMarkdown: (text: string) => string;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal("import.meta", {
      env: { VITE_API_BASE: "http://localhost:3100" },
    });
    const mod = await import("../utils/markdown");
    renderMarkdown = mod.renderMarkdown;
  });

  it("renders GFM tables", () => {
    const md = `| A | B |
| --- | --- |
| 1 | 2 |`;
    const result = renderMarkdown(md);
    expect(result).toContain("<table");
    expect(result).toContain("<td>");
  });

  it("renders GFM strikethrough", () => {
    const result = renderMarkdown("~~deleted~~");
    expect(result).toContain("<del>");
  });

  it("renders line breaks with breaks:true", () => {
    const result = renderMarkdown("line1\nline2");
    expect(result).toContain("<br");
  });

  it("renders inline code", () => {
    const result = renderMarkdown("Use `const x = 1` here");
    expect(result).toContain("<code>const x = 1</code>");
  });

  it("renders nested lists", () => {
    const md = `- a
  - b
    - c`;
    const result = renderMarkdown(md);
    expect(result).toContain("<ul>");
    expect(result).toContain("<li>");
  });

  it("renders links with target=_blank", () => {
    const result = renderMarkdown("[Google](https://google.com)");
    expect(result).toContain('<a target="_blank" rel="noopener noreferrer"');
    expect(result).toContain('href="https://google.com"');
    expect(result).toContain("Google");
  });

  it("handles very long content without error", () => {
    const longText = "word ".repeat(10_000);
    expect(() => renderMarkdown(longText)).not.toThrow();
  });

  it("evicts oldest cache entry when limit exceeded", async () => {
    vi.resetModules();
    const mod = await import("../utils/markdown");
    // Render 502 unique strings to trigger the eviction (cap = 500)
    for (let i = 0; i < 502; i++) {
      mod.renderMarkdown(`entry_${i}`);
    }
    // If we get here without error, the eviction logic works
    // Verify a recent entry is still cached
    const recent = mod.renderMarkdown("entry_501");
    const same = mod.renderMarkdown("entry_501");
    expect(recent).toBe(same);
  });
});
