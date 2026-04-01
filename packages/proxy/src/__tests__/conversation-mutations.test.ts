import { describe, expect, it } from "vitest";
import { runConversationMutation } from "../conversation-mutations.js";

describe("runConversationMutation", () => {
  it("serializes tasks for the same conversation", async () => {
    const events: string[] = [];

    const first = runConversationMutation("conv-1", async () => {
      events.push("first:start");
      await new Promise((resolve) => setTimeout(resolve, 20));
      events.push("first:end");
    });

    const second = runConversationMutation("conv-1", async () => {
      events.push("second:start");
      events.push("second:end");
    });

    await Promise.all([first, second]);

    expect(events).toEqual([
      "first:start",
      "first:end",
      "second:start",
      "second:end",
    ]);
  });

  it("allows different conversations to progress independently", async () => {
    const events: string[] = [];

    await Promise.all([
      runConversationMutation("conv-a", async () => {
        events.push("a:start");
        await new Promise((resolve) => setTimeout(resolve, 10));
        events.push("a:end");
      }),
      runConversationMutation("conv-b", async () => {
        events.push("b:start");
        events.push("b:end");
      }),
    ]);

    expect(events[0]).toBe("a:start");
    expect(events).toContain("b:start");
    expect(events).toContain("b:end");
    expect(events.at(-1)).toBe("a:end");
  });
});
