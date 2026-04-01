import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../types";
import { mergeOptimisticMessages } from "../utils/optimisticMessages";

function makeMessage(
  overrides: Partial<ChatMessage> & Pick<ChatMessage, "role" | "content">,
): ChatMessage {
  const { role, content, ...rest } = overrides;
  return {
    ...rest,
    role,
    content,
    stepIndex: rest.stepIndex ?? 0,
    type: rest.type ?? "CORTEX_STEP_TYPE_USER_INPUT",
  };
}

describe("mergeOptimisticMessages", () => {
  it("keeps only newer optimistic messages after confirming the front of the queue", () => {
    const serverMessages: ChatMessage[] = [
      makeMessage({ role: "user", content: "first", stepIndex: 0 }),
      makeMessage({
        role: "assistant",
        content: "still streaming",
        stepIndex: 1,
        type: "CORTEX_STEP_TYPE_PLANNER_RESPONSE",
      }),
      makeMessage({
        role: "user",
        content: "second",
        stepIndex: 2,
        optimisticId: "opt-1",
      }),
    ];
    const optimisticMessages: ChatMessage[] = [
      makeMessage({
        role: "user",
        content: "second",
        stepIndex: -1,
        optimisticId: "opt-1",
        optimisticState: "unconfirmed",
      }),
      makeMessage({
        role: "user",
        content: "third",
        stepIndex: -1,
        optimisticId: "opt-2",
        optimisticState: "unconfirmed",
      }),
    ];

    const result = mergeOptimisticMessages(serverMessages, optimisticMessages);

    expect(result.confirmedOptimisticIds).toEqual(["opt-1"]);
    expect(result.messages.map((msg) => msg.content)).toEqual([
      "first",
      "still streaming",
      "second",
      "third",
    ]);
    expect(result.hasUnconfirmedOptimistic).toBe(true);
  });

  it("does not let a failed optimistic message block confirmation of newer ones", () => {
    const serverMessages: ChatMessage[] = [
      makeMessage({
        role: "user",
        content: "confirmed",
        stepIndex: 0,
        optimisticId: "opt-confirmed",
      }),
    ];
    const optimisticMessages: ChatMessage[] = [
      makeMessage({
        role: "user",
        content: "failed",
        stepIndex: -1,
        optimisticId: "opt-failed",
        optimisticState: "failed",
      }),
      makeMessage({
        role: "user",
        content: "confirmed",
        stepIndex: -1,
        optimisticId: "opt-confirmed",
        optimisticState: "unconfirmed",
      }),
    ];

    const result = mergeOptimisticMessages(serverMessages, optimisticMessages);

    expect(result.confirmedOptimisticIds).toEqual(["opt-confirmed"]);
    expect(result.messages.map((msg) => msg.content)).toEqual([
      "confirmed",
      "failed",
    ]);
    expect(result.hasUnconfirmedOptimistic).toBe(false);
  });

  it("does not confirm by matching content alone", () => {
    const serverMessages: ChatMessage[] = [
      makeMessage({
        role: "user",
        content: "same text",
        stepIndex: 0,
      }),
    ];
    const optimisticMessages: ChatMessage[] = [
      makeMessage({
        role: "user",
        content: "same text",
        stepIndex: -1,
        optimisticId: "opt-1",
        optimisticState: "unconfirmed",
      }),
    ];

    const result = mergeOptimisticMessages(serverMessages, optimisticMessages);

    expect(result.confirmedOptimisticIds).toEqual([]);
    expect(result.messages.at(-1)?.optimisticId).toBe("opt-1");
    expect(result.hasUnconfirmedOptimistic).toBe(true);
  });
});
