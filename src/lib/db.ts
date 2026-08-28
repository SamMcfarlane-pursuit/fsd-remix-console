// Simple browser-compatible local storage & IndexedDB wrapper for OPFS/SQLite fallback
// Provides a clean key-value / table interface for local ledger storage

class LocalDatabase {
  private memoryStore: Map<string, any[]> = new Map();

  constructor() {
    // Load from localStorage if available
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem("muster_local_db_ledger");
        if (stored) {
          this.memoryStore.set("ledger_entries", JSON.parse(stored));
        }
      }
    } catch {}
  }

  async get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const table = this.memoryStore.get("ledger_entries") || [];
    if (sql.includes("ORDER BY timestamp DESC LIMIT 1")) {
      const deviceId = params[0];
      const filtered = table.filter((r: any) => r.device_id === deviceId);
      if (filtered.length === 0) return null;
      return filtered[filtered.length - 1] as T;
    }
    return null;
  }

  async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const table = this.memoryStore.get("ledger_entries") || [];
    if (params.length >= 2) {
      const [facilityId, type] = params;
      return table.filter(
        (r: any) => r.facility_id === facilityId && r.type === type
      ) as T[];
    }
    return table as T[];
  }

  async run(sql: string, params: any[] = []): Promise<void> {
    if (sql.includes("INSERT INTO ledger_entries")) {
      const [
        id,
        device_id,
        facility_id,
        type,
        actor_uid,
        display_name,
        payload,
        timestamp,
        prev_hash,
        hash,
      ] = params;
      const row = {
        id,
        device_id,
        facility_id,
        type,
        actor_uid,
        display_name,
        payload,
        timestamp,
        prev_hash,
        hash,
      };
      const entries = this.memoryStore.get("ledger_entries") || [];
      entries.push(row);
      this.memoryStore.set("ledger_entries", entries);
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("muster_local_db_ledger", JSON.stringify(entries));
        }
      } catch {}
    }
  }
}

let dbInstance: LocalDatabase | null = null;

export async function getDb(): Promise<LocalDatabase> {
  if (!dbInstance) {
    dbInstance = new LocalDatabase();
  }
  return dbInstance;
}
