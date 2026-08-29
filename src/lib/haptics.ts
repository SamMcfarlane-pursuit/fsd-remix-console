/**
 * Hardware Multi-Sensory Haptics & Screen WakeLock Controller
 * Provides crisp physical vibration feedback on mobile devices and keeps
 * emergency screens active without auto-dimming during evacuations.
 */

export type HapticType = "success" | "warning" | "error" | "alarm" | "light" | "heavy" | "selection";

const HAPTIC_PATTERNS: Record<HapticType, number | number[]> = {
  light: 25,
  heavy: 80,
  selection: 15,
  success: [40, 60, 40],
  warning: [120, 80, 120],
  error: [180, 100, 180, 100, 250],
  alarm: [300, 150, 300, 150, 400, 200, 500],
};

/**
 * Trigger physical device vibration feedback
 */
export function triggerHaptic(type: HapticType = "light"): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator && typeof navigator.vibrate === "function") {
    try {
      const pattern = HAPTIC_PATTERNS[type] || 30;
      navigator.vibrate(pattern);
    } catch {
      // Vibration not permitted or supported
    }
  }
}

// Active Screen WakeLock sentinel reference
let wakeLockSentinel: any = null;

/**
 * Request Screen Wake Lock (prevents screen from dimming/sleeping during emergency operations)
 */
export async function requestScreenWakeLock(): Promise<boolean> {
  if (typeof navigator !== "undefined" && "wakeLock" in navigator && (navigator as any).wakeLock) {
    try {
      if (wakeLockSentinel && !wakeLockSentinel.released) {
        return true;
      }
      wakeLockSentinel = await (navigator as any).wakeLock.request("screen");
      wakeLockSentinel.addEventListener("release", () => {
        wakeLockSentinel = null;
      });
      return true;
    } catch (e) {
      console.warn("Screen WakeLock could not be acquired:", e);
      return false;
    }
  }
  return false;
}

/**
 * Release active screen wake lock
 */
export async function releaseScreenWakeLock(): Promise<void> {
  try {
    if (wakeLockSentinel && typeof wakeLockSentinel.release === "function") {
      await wakeLockSentinel.release();
      wakeLockSentinel = null;
    }
  } catch (e) {
    console.warn("Error releasing Screen WakeLock:", e);
  }
}
