import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppResume } from "../hooks/useAppResume";

describe("useAppResume", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  it("fires when the document becomes visible", () => {
    const onResume = vi.fn();
    renderHook(() => useAppResume(onResume));

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("dedupes closely-spaced resume events from the same foreground transition", () => {
    const onResume = vi.fn();
    renderHook(() => useAppResume(onResume));

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("pageshow"));
    });

    expect(onResume).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(300);
      window.dispatchEvent(new Event("focus"));
    });

    expect(onResume).toHaveBeenCalledTimes(2);
  });

  it("does not fire while the document is hidden", () => {
    const onResume = vi.fn();
    renderHook(() => useAppResume(onResume));

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });

    expect(onResume).not.toHaveBeenCalled();
  });
});
