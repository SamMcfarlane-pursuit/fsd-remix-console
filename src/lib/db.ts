/**
 * Client-side local DB abstraction for offline hash-chain ledger
 */

interface LocalDbStore {
  get<T = any>(query: string, params?: any[]): Promise<T | undefined>;
  all<T = any>(query: string, params?: any[]): Promise<T[]>;
  run(query: string, params?: any[]): Promise<void>;
}

const localLedgerStorage: any[] = [];

export async function getDb(): Promise<LocalDbStore> {
  return {
    async get<T = any>(query: string, params: any[] = []): Promise<T | undefined> {
      if (query.includes("ledger_entries")) {
        const deviceId = params[0];
        const entries = localLedgerStorage.filter((e) => !deviceId || e.device_id === deviceId);
        return entries[entries.length - 1] as T | undefined;
      }
      return undefined;
    },
    async all<T = any>(query: string, params: any[] = []): Promise<T[]> {
      if (query.includes("ledger_entries")) {
        return [...localLedgerStorage] as T[];
      }
      return [];
    },
    async run(query: string, params: any[] = []): Promise<void> {
      if (query.includes("INSERT INTO ledger_entries")) {
        localLedgerStorage.push({
          id: params[0],
          facility_id: params[1],
          device_id: params[2],
          type: params[3],
          actor_uid: params[4],
          display_name: params[5],
          payload: params[6],
          timestamp: params[7],
          prev_hash: params[8],
          hash: params[9],
        });
      }
    },
  };
}
