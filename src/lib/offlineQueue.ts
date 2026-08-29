/**
 * Offline-First Resilient Sign-In & Attendance Queue Engine
 * Ensures 100% continuous operation during network blackouts, basement dead-zones,
 * and emergency communications failures.
 */

export interface OfflineAction {
  id: string;
  type: "occupant-sign-in" | "presence-toggle" | "check-in" | "bulk-check-in" | "visitor-register";
  timestamp: string;
  payload: any;
  retryCount: number;
  status: "pending" | "syncing" | "failed";
}

const STORAGE_KEY = "muster_offline_action_queue_v1";
const CACHED_ROSTER_KEY = "muster_cached_roster_v1";

/**
 * Cache current active roster locally for offline lookups
 */
export function cacheRosterLocally(occupants: any[]): void {
  try {
    if (Array.isArray(occupants) && occupants.length > 0) {
      localStorage.setItem(CACHED_ROSTER_KEY, JSON.stringify(occupants));
    }
  } catch (e) {
    console.warn("Could not cache roster locally", e);
  }
}

/**
 * Retrieve locally cached roster for offline lookup
 */
export function getCachedRoster(): any[] {
  try {
    const raw = localStorage.getItem(CACHED_ROSTER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

/**
 * Get all queued offline actions
 */
export function getOfflineQueue(): OfflineAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

/**
 * Save action to the offline queue
 */
export function queueOfflineAction(
  type: OfflineAction["type"],
  payload: any
): OfflineAction {
  const action: OfflineAction = {
    id: `off-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    timestamp: new Date().toISOString(),
    payload,
    retryCount: 0,
    status: "pending",
  };

  const queue = getOfflineQueue();
  queue.push(action);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent("muster-offline-queue-changed", { detail: { queue } }));
  } catch (e) {
    console.warn("Error persisting offline action:", e);
  }

  return action;
}

/**
 * Remove an action from the queue by ID
 */
export function removeOfflineAction(actionId: string): void {
  const queue = getOfflineQueue().filter((a) => a.id !== actionId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent("muster-offline-queue-changed", { detail: { queue } }));
  } catch (e) {}
}

/**
 * Clear all actions in queue
 */
export function clearOfflineQueue(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("muster-offline-queue-changed", { detail: { queue: [] } }));
  } catch (e) {}
}

/**
 * Synchronize all queued offline actions with the backend server
 */
export async function syncOfflineQueue(
  onProgress?: (synced: number, total: number) => void
): Promise<{ success: boolean; syncedCount: number; failedCount: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) {
    return { success: true, syncedCount: 0, failedCount: 0 };
  }

  let syncedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      const base = typeof window !== "undefined" && window.location ? "" : "http://localhost:3000";
      let endpoint = "/api/check-in";
      if (item.type === "occupant-sign-in") {
        endpoint = "/api/occupant/sign-in-register";
      } else if (item.type === "presence-toggle") {
        endpoint = "/api/occupant/presence";
      } else if (item.type === "bulk-check-in") {
        endpoint = "/api/check-in/bulk";
      } else if (item.type === "visitor-register") {
        endpoint = "/api/visitor/register";
      }

      const res = await fetch(base + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item.payload, isOfflineReplay: true, originalTimestamp: item.timestamp }),
      });

      if (res.ok) {
        removeOfflineAction(item.id);
        syncedCount++;
      } else {
        item.retryCount++;
        failedCount++;
      }
    } catch (err) {
      item.retryCount++;
      failedCount++;
    }

    if (onProgress) {
      onProgress(syncedCount, queue.length);
    }
  }

  return {
    success: failedCount === 0,
    syncedCount,
    failedCount,
  };
}

/**
 * Generate a valid offline temporary occupant profile with passkey
 */
export function createOfflineOccupant(params: {
  name: string;
  phone?: string;
  quadrant?: string;
  role?: string;
  company?: string;
  desk?: string;
}): any {
  const cleanQuad = params.quadrant || "NW";
  const numSuffix = Math.floor(100 + Math.random() * 900);
  const tempId = `OCC-OFF-${numSuffix}`;

  return {
    id: tempId,
    name: params.name,
    phone: params.phone || "",
    role: params.role || "Employee",
    company: params.company || "Con Edison",
    quadrant: cleanQuad,
    desk: params.desk || `OFFLINE-DESK-${numSuffix}`,
    status: "safe",
    locationCategory: "inside-building",
    checkedIn: true,
    lastCheckInTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    isOfflineCreated: true,
    xCoord: 50,
    yCoord: 50,
  };
}
