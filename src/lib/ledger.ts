// src/lib/ledger.ts
// Thin abstraction over the per-device SQLite (OPFS) + CRDT mesh.
// Every write is an immutable, hash-chained append — this module never
// mutates or deletes a row. "Current state" (presence, who's checked in)
// is always DERIVED by reading the ledger, never stored as a separate
// mutable source of truth — that's what keeps it CRDT-mergeable across
// devices without conflict.

import { getDb } from "./db";
import { subscribeMeshSync } from "./mesh";

export type LedgerEntryType = "presence" | "muster_session" | "muster_checkin" | "geofence_validation";

export type LedgerEntryInput = {
  facilityId: string;
  type: LedgerEntryType;
  actorUid: string;
  displayName: string;
  payload: Record<string, unknown>;
};

export type LedgerEntry = LedgerEntryInput & {
  id: string;
  deviceId: string;
  timestamp: number;
  prevHash: string;
  hash: string;
};

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getDeviceId(): string {
  // Swap for your real device-identity source (kiosk provisioning id, etc.)
  if (typeof localStorage === "undefined") return "server";
  let id = localStorage.getItem("muster_device_id");
  if (!id) {
    id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}`;
    localStorage.setItem("muster_device_id", id);
  }
  return id;
}

const GENESIS_HASH = "0".repeat(64);

/** Appends one entry to this device's hash chain. Never edits/removes anything. */
export async function appendLedgerEntry(input: LedgerEntryInput): Promise<LedgerEntry> {
  const db = await getDb();
  const deviceId = getDeviceId();

  const prevHash =
    (
      await db.get<{ hash: string }>(
        `SELECT hash FROM ledger_entries WHERE device_id = ? ORDER BY timestamp DESC LIMIT 1`,
        [deviceId]
      )
    )?.hash || GENESIS_HASH;

  const timestamp = Date.now();
  const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ledger-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const hash = await sha256Hex(prevHash + JSON.stringify({ ...input, id, deviceId, timestamp }));

  const entry: LedgerEntry = { ...input, id, deviceId, timestamp, prevHash, hash };

  await db.run(
    `INSERT INTO ledger_entries (id, device_id, facility_id, type, actor_uid, display_name, payload, timestamp, prev_hash, hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      deviceId,
      input.facilityId,
      input.type,
      input.actorUid,
      input.displayName,
      JSON.stringify(input.payload),
      timestamp,
      prevHash,
      hash,
    ]
  );

  broadcastLocalChange(input.facilityId);
  return entry;
}

/** Reads every ledger entry of a given type for a facility, across all synced devices. */
export async function readLedgerEntries(
  facilityId: string,
  type: LedgerEntryType
): Promise<LedgerEntry[]> {
  const db = await getDb();
  const rows = await db.all<any>(
    `SELECT * FROM ledger_entries WHERE facility_id = ? AND type = ? ORDER BY timestamp ASC`,
    [facilityId, type]
  );
  return rows.map((r) => ({
    id: r.id,
    deviceId: r.device_id,
    facilityId: r.facility_id,
    type: r.type,
    actorUid: r.actor_uid,
    displayName: r.display_name,
    payload: typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload,
    timestamp: r.timestamp,
    prevHash: r.prev_hash,
    hash: r.hash,
  }));
}

/** Derives current in/out status per uid from the presence entry history. */
export async function derivePresence(
  facilityId: string
): Promise<Record<string, { displayName: string; status: "in" | "out"; at: number }>> {
  const entries = await readLedgerEntries(facilityId, "presence");
  const latest: Record<string, { displayName: string; status: "in" | "out"; at: number }> = {};
  for (const e of entries) {
    const existing = latest[e.actorUid];
    if (!existing || e.timestamp > existing.at) {
      latest[e.actorUid] = {
        displayName: e.displayName,
        status: (e.payload as any).status as "in" | "out",
        at: e.timestamp,
      };
    }
  }
  return latest;
}

// --- Reactivity: same-device tabs via BroadcastChannel, other devices via mesh sync ---

type ChangeListener = (facilityId: string) => void;
const listeners = new Set<ChangeListener>();
const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("muster-ledger") : null;

channel?.addEventListener("message", (e: MessageEvent) => {
  listeners.forEach((fn) => fn(e.data.facilityId));
});

function broadcastLocalChange(facilityId: string) {
  channel?.postMessage({ facilityId });
  listeners.forEach((fn) => fn(facilityId));
}

/** Subscribe to ledger changes for a facility — fires on local writes AND incoming mesh syncs. */
export function subscribeLedgerChanges(facilityId: string, onChange: () => void): () => void {
  const wrapped: ChangeListener = (fid) => {
    if (fid === facilityId) onChange();
  };
  listeners.add(wrapped);
  const unsubMesh = subscribeMeshSync(facilityId, onChange);
  return () => {
    listeners.delete(wrapped);
    unsubMesh?.();
  };
}
