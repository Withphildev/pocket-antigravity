export type HapticForce = "light" | "medium" | "heavy" | "success" | "error";

/**
 * Triggers a subtle notification vibration if supported by the browser.
 * This utilizes the navigator.vibrate API to mimic native app haptic feedback.
 */
export function triggerHaptic(force: HapticForce = "light") {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;

  try {
    switch (force) {
      case "light":
        navigator.vibrate(15);
        break;
      case "medium":
        navigator.vibrate(30);
        break;
      case "heavy":
        navigator.vibrate(50);
        break;
      case "success":
        navigator.vibrate([15, 40, 30]);
        break;
      case "error":
        navigator.vibrate([30, 50, 30, 50, 40]);
        break;
    }
  } catch (err) {
    // Ignore errors for devices without vibration hardware or permissions
  }
}
