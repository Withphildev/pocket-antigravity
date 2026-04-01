import { describe, expect, it } from "vitest";
import { ConversationMessageTracker } from "../message-tracker.js";

describe("ConversationMessageTracker", () => {
  it("annotates pending user steps in order", () => {
    const tracker = new ConversationMessageTracker();
    tracker.trackPendingMessage("conv-1", "opt-1", 4, 1_000);
    tracker.trackPendingMessage("conv-1", "opt-2", 4, 1_000);

    const annotated = tracker.annotateSteps(
      "conv-1",
      3,
      [
        { type: "CORTEX_STEP_TYPE_PLANNER_RESPONSE" },
        { type: "CORTEX_STEP_TYPE_USER_INPUT", userInput: { items: [] } },
        { type: "CORTEX_STEP_TYPE_RUN_COMMAND" },
        { type: "CORTEX_STEP_TYPE_USER_INPUT", userInput: { items: [] } },
      ],
      1_500,
    ) as Array<Record<string, unknown>>;

    expect(annotated[1].clientMessageId).toBe("opt-1");
    expect(annotated[3].clientMessageId).toBe("opt-2");
  });

  it("replays recent confirmed annotations on later fetches", () => {
    const tracker = new ConversationMessageTracker();
    tracker.trackPendingMessage("conv-1", "opt-1", 10, 1_000);

    tracker.annotateSteps(
      "conv-1",
      10,
      [{ type: "CORTEX_STEP_TYPE_USER_INPUT", userInput: { items: [] } }],
      1_500,
    );

    const annotated = tracker.annotateSteps(
      "conv-1",
      10,
      [{ type: "CORTEX_STEP_TYPE_USER_INPUT", userInput: { items: [] } }],
      2_000,
    ) as Array<Record<string, unknown>>;

    expect(annotated[0].clientMessageId).toBe("opt-1");
  });

  it("does not annotate corrupted placeholder user steps", () => {
    const tracker = new ConversationMessageTracker();
    tracker.trackPendingMessage("conv-1", "opt-1", 7, 1_000);

    const annotated = tracker.annotateSteps(
      "conv-1",
      7,
      [
        {
          type: "CORTEX_STEP_TYPE_USER_INPUT",
          _corrupted: true,
          userInput: { items: [{ text: "broken" }] },
        },
        { type: "CORTEX_STEP_TYPE_USER_INPUT", userInput: { items: [] } },
      ],
      1_500,
    ) as Array<Record<string, unknown>>;

    expect(annotated[0].clientMessageId).toBeUndefined();
    expect(annotated[1].clientMessageId).toBe("opt-1");
  });

  it("clears all state for a conversation", () => {
    const tracker = new ConversationMessageTracker();
    tracker.trackPendingMessage("conv-1", "opt-1", 2, 1_000);
    tracker.clearConversation("conv-1");

    const annotated = tracker.annotateSteps(
      "conv-1",
      2,
      [{ type: "CORTEX_STEP_TYPE_USER_INPUT", userInput: { items: [] } }],
      1_500,
    ) as Array<Record<string, unknown>>;

    expect(annotated[0].clientMessageId).toBeUndefined();
  });
});
