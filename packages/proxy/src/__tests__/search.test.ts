import { describe, it, expect } from "vitest";
import { extractStepText, pMap } from "../routes/search.js";

// ── extractStepText ──

describe("extractStepText", () => {
  it("extracts user input text", () => {
    const step = {
      userInput: {
        items: [{ text: "hello" }, { text: "world" }],
      },
    };
    expect(extractStepText(step)).toBe("hello world");
  });

  it("extracts planner response", () => {
    const step = {
      plannerResponse: {
        modifiedResponse: "Here is my answer",
        thinking: "Let me think about this",
      },
    };
    const result = extractStepText(step);
    expect(result).toContain("Here is my answer");
    expect(result).toContain("Let me think about this");
  });

  it("extracts run command", () => {
    const step = {
      runCommand: {
        commandLine: "npm test",
        command: "npm",
      },
    };
    const result = extractStepText(step);
    expect(result).toContain("npm test");
    expect(result).toContain("npm");
  });

  it("extracts code action description", () => {
    const step = {
      codeAction: {
        description: "Refactored the module",
      },
    };
    expect(extractStepText(step)).toBe("Refactored the module");
  });

  it("extracts grep search query", () => {
    const step = {
      grepSearch: {
        query: "TODO",
      },
    };
    expect(extractStepText(step)).toBe("TODO");
  });

  it("returns empty string for unknown step type", () => {
    expect(extractStepText({})).toBe("");
    expect(extractStepText({ unknownField: "data" })).toBe("");
  });

  it("combines multiple fields", () => {
    const step = {
      userInput: { items: [{ text: "user question" }] },
      plannerResponse: { modifiedResponse: "agent answer" },
    };
    const result = extractStepText(step);
    expect(result).toContain("user question");
    expect(result).toContain("agent answer");
  });
});

// ── pMap ──

describe("pMap", () => {
  it("maps items with async function", async () => {
    const result = await pMap([1, 2, 3], async (x) => x * 2, 2);
    expect(result).toEqual([2, 4, 6]);
  });

  it("handles empty array", async () => {
    const result = await pMap([], async (x: number) => x * 2, 5);
    expect(result).toEqual([]);
  });

  it("respects concurrency limit", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const result = await pMap(
      [10, 20, 30, 40, 50],
      async (x) => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise((r) => setTimeout(r, 10));
        concurrent--;
        return x;
      },
      2,
    );

    expect(result).toEqual([10, 20, 30, 40, 50]);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("preserves order regardless of resolution time", async () => {
    const delays = [30, 10, 20];
    const result = await pMap(
      delays,
      async (ms) => {
        await new Promise((r) => setTimeout(r, ms));
        return ms;
      },
      3,
    );
    expect(result).toEqual([30, 10, 20]);
  });
});
