/**
 * Server-Side PostgreSQL Database Adapter & Migration Runner
 */

import { Pool } from "pg";
import fs from "fs";
import path from "path";

let pool: Pool | null = null;
let isConnected = false;

export function getDatabasePool(): Pool | null {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err) => {
      console.warn("Unexpected PostgreSQL client error:", err);
    });
  }

  return pool;
}

/**
 * Initialize PostgreSQL Schema on Startup
 */
export async function initializeDatabase(): Promise<boolean> {
  const p = getDatabasePool();
  if (!p) {
    console.log("ℹ️ Running with in-memory life-safety store (DATABASE_URL not set).");
    return false;
  }

  try {
    const client = await p.connect();
    try {
      console.log("🐘 Connected to PostgreSQL database. Running migrations...");
      const schemaPath = path.join(process.cwd(), "db", "schema.sql");
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, "utf-8");
        await client.query(sql);
        console.log("✅ PostgreSQL schema & indexes initialized successfully.");
      }
      isConnected = true;
      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn("⚠️ PostgreSQL connection failed, falling back to in-memory store:", err.message);
    isConnected = false;
    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected;
}
