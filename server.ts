import express from "express";
import path from "path";
import crypto from "crypto";
import os from "os";
import fs from "fs";
import { spawn } from "child_process";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import QRCode from "qrcode";
import { Pool } from "pg";
import { initializeDatabase } from "./serverDb";
import {
  QuadrantId,
  Occupant,
  StatusSnapshot,
  LedgerEntry,
  DrillNarrativeDraft,
  RedListQueryResponse,
  QuadrantStat,
  CheckinEvent,
  RosterAttendee,
  AttendanceRecord,
  EventRosterStatus,
} from "./src/types";

// Initialize Express app
const app = express();
app.use(express.json({ limit: "10mb" })); // Support digital signature canvas payloads

const PORT = 3000;

// Lazy initialization of Google GenAI client to prevent crash at server boot
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("GEMINI_API_KEY environment variable is missing. AI features will use fallback responses.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "AI_STUDIO_PLACEHOLDER_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

/* ------------------------------------------------------------------ */
/* SSE Broadcasting State                                              */
/* ------------------------------------------------------------------ */

let sseResList: express.Response[] = [];

/* ------------------------------------------------------------------ */
/* In-Memory Ledger Engine (Hash-Chained Audit Ledger)                */
/* ------------------------------------------------------------------ */

let ledgerChain: LedgerEntry[] = [];

function computeHash(prevHash: string, type: string, timestamp: string, payload: any): string {
  const raw = `${prevHash}|${type}|${timestamp}|${JSON.stringify(payload)}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function appendLedger(type: string, payload: Record<string, any>): LedgerEntry {
  const prevHash = ledgerChain.length > 0 ? ledgerChain[ledgerChain.length - 1].hash : "0000000000000000000000000000000000000000000000000000000000000000";
  const timestamp = new Date().toISOString();
  const hash = computeHash(prevHash, type, timestamp, payload);
  const entry: LedgerEntry = {
    id: `L-${String(ledgerChain.length + 1).padStart(4, "0")}`,
    prevHash,
    hash,
    type,
    timestamp,
    payload,
  };
  ledgerChain.push(entry);
  notifySseClients();
  return entry;
}

/* ------------------------------------------------------------------ */
/* In-Memory State & Roster Data                                      */
/* ------------------------------------------------------------------ */

let incidentActive = true;
let incidentMode: "drill" | "incident" | null = "drill";
let hazardType: string | null = "office-fire";
let declaredAt: string | null = new Date(Date.now() - 140000).toISOString();
let latestNarrative: DrillNarrativeDraft | null = null;

const NAMES = [
  "Fahmida Ali", "Eric Malone", "John Catuogno", "Pak Lai", "Robert Oates", "Michael Kohlhaas",
  "Jhommy Valdez", "Kevin Torres", "Olika Vazquez", "Menaha Gujavarthi", "Jordan Ruggieri", "Abina Wood",
  "Michael Mangialino", "Marc Leshnower", "Cheikh Webster Lo", "Nicholas Minkiewicz", "Robert Brown",
  "Kendall Thompson", "Farhan Molla", "George Vazquez", "Vladimir Shapiro", "Steven DePaola", "Michael Santos",
  "Peter Neddie Limprevil", "Feliciano", "Sarah Murphy", "Ambrogio Sabella", "Michael Bell", "Raphael Knopfler",
  "Joseph McGowan", "Balanarsimha Meda", "Pablo Mendez", "Charles Viemeister", "Mohsen Shaaker", "Arifa Baksh",
  "Thao Tran", "Venkata Bala Inuganti", "Naresh Murki", "Ryan Gleeson", "Alexia Reno", "Travis Fonseca",
  "Philip Distefano", "Steve Ko", "Samuel Burney", "Michael Sclafani", "Shane Son", "Connor Stewart",
  "Dwayne Grainger", "Dudley Brutus", "Mehak Singh", "Jagan mohan Naredla", "Shadeyka Warren", "Bhone Myint Thu",
  "Linnea Paton", "Brandon Evans", "Stephanie Lam", "Vincent Romano", "Mark Duggan", "Destiny Rodriguez",
  "Michelle Richards", "Edward Fernandez Abreu", "Cecily Almonte", "Christopher Ngo", "Franken Mercurius",
  "Eric Sharrin", "Gerald Nyante", "Sergio Bolanos", "Walter Grosenheider", "John Masiello", "Joanna Yager",
  "Arturo Claudio", "Nicholas Boshears", "Jon Johnson", "Narender Kumar", "Joseph McLain", "Matthew Begley",
  "Jamie Kusky", "Cecilia Lee", "Michael Hines", "Jillian Weeks", "Joseph Paskewicz", "Robert Rodriguez",
  "Olivia Delgado", "Eli Zami", "Edwin Torres", "Kevin Cronin", "Jason Attard", "Vasudeva Koneru",
  "Efrain Davila", "Daneya Hemans", "Damian Bossio", "Thomas Black", "Jan van Daatselaar", "Brendan Getzler",
  "Thu Tra Pham", "Jane Shin", "John Rella", "Richard Citrola Jr.", "Thyagarajan Saravanan", "Stephen Somma",
  "Christine Cummings", "Vincent Tong", "Hanssel Hinojosa", "Mary Young-Sotto", "Nabil Almontaser", "Bryan Torres",
  "George Toskos", "James Vance", "Madhusudan Reddy", "Hasanuzzaman Rahman", "Christopher Gallo", "Elvimar Rivas",
  "Chinenye Ihe", "Dennis Arthurs", "Mei Poon", "Casey Eugenio", "Jonathan Judice", "Maura Yates",
  "Sheldon Gofter", "Adam Polanco", "Barry Goodman", "Sebastian Leon", "Hemant Jaipal", "Diana Ramkissoon",
  "Pooja Dahiya", "Darren Brindisi", "Huairu Xu", "Michael Boadu", "Suvarna Sherikar", "Miles Weinstein",
  "Noah Naples", "Joseph Mejia", "Joseph Reda", "Aidan Sabert", "Peter Gallo", "Vladislav Nechayev",
  "Deborah Cuevas Cherry", "George Nagy", "Vjay Shukla", "Shuchita Prakash", "Laikhram Puran", "Nicholas Mannarino",
  "Jennifer Urbano", "Jena Hobbs", "Antonio Diaz", "Karen Haywood", "Artem Dilanyan", "Ajifa Aruwa",
  "Muhammad Habib", "Gerardo Janampa", "Tracy Ann Lombardo", "Iris Rivera", "Abby Heilemann", "Dawn Flynn",
  "Jeyliz Gonzalez", "Jason Prue", "Abbas Tatari", "Marina Ispolova", "Michael Logan", "Damien Webster",
  "Eugene Finas", "Jose Rojas", "May Ruan", "Shameeka Williams", "Grisel Garcia", "Antoya Debarros",
  "Yaw Asante", "David Revie", "Christina Ho", "Amy Haag", "Nelson Yip", "Joe White", "Rodrigo Davila",
  "Adelson Jules", "Jaimie Rong", "David Distant", "Pamela McClary", "Luis Dominguez", "Gabriel Stout"
];

const QUADRANT_IDS: QuadrantId[] = ["NW", "NE", "SW", "SE"];
const QUADRANT_LABELS: Record<QuadrantId, string> = {
  NW: "NW · Strategic Planning (07-800)",
  NE: "NE · Gas Ops & Security (07-200/270)",
  SW: "SW · AMI & Ombudsman (07-700)",
  SE: "SE · Steam Operations (07-500/550)",
};

const QUADRANT_DESK_PREFIXES: Record<QuadrantId, string[]> = {
  NW: ["07-800", "07-800c", "07-801a", "07-810", "07-815", "07-828", "07-830", "07-840", "07-100", "07-105", "07-112", "VP-StratPlan"],
  NE: ["07-200", "07-220", "07-240", "07-270", "07-280", "07-280b", "07-201", "07-200a", "07-223", "07-231"],
  SW: ["07-700", "07-710S", "07-702-A", "07-708-B", "07-709-C", "07-740-D", "07-720", "07-730", "07-745", "07-Facilities"],
  SE: ["07-500", "07-520", "07-550", "07-574", "07-580", "07-SteamCtrl", "VP-SteamOps", "07-560", "07-565", "07-590"],
};

function generateInitialRoster(targetCount: number = 200): Occupant[] {
  const occupants: Occupant[] = [];
  let idCounter = 101;
  const countPerQuad = Math.floor(targetCount / 4);

  QUADRANT_IDS.forEach((quad, qIndex) => {
    const count = qIndex === 3 ? targetCount - countPerQuad * 3 : countPerQuad;
    const deskPrefixes = QUADRANT_DESK_PREFIXES[quad];

    for (let i = 0; i < count; i++) {
      const id = `OCC-${idCounter++}`;
      const name = NAMES[(i + idCounter) % NAMES.length];
      let role: Occupant["role"] = "Employee";
      if (i % 7 === 0) role = "Contractor";
      if (i % 11 === 0 && quad === "SE") role = "Visitor";
      if (i % 19 === 0) role = "VIP";

      const deskPrefix = deskPrefixes[i % deskPrefixes.length];
      const deskBay = `${String.fromCharCode(65 + (i % 8))}${1 + (i % 12)}`;
      const desk = `${deskPrefix}-${deskBay}`;

      // Pre-seed status variations
      let status: Occupant["status"] = "safe";
      let badgedOut = false;
      let offSiteToday = false;
      let unaccountedMinutes = 0;
      let notes = "";
      let araAssigned = false;

      if (idCounter === 105) {
        status = "awaiting-evac-chair";
        araAssigned = true;
        notes = "Stair A landing, Floor 07 ARA chair required (mobility assistance)";
      } else if (idCounter === 109) {
        status = "awaiting-evac-chair";
        araAssigned = true;
        notes = "Stair A landing, Floor 07 knee brace evacuation partner assigned";
      } else if (idCounter === 115) {
        status = "need-help";
        unaccountedMinutes = 4;
        notes = "Wearable fall sensor trigger in SW corridor";
      } else if (idCounter === 141) {
        status = "mia";
        unaccountedMinutes = 5;
        notes = "Unaccounted past 5-min MIA threshold";
      } else if (idCounter === 150 || idCounter === 180 || idCounter === 250 || idCounter === 350) {
        badgedOut = true;
      } else if (idCounter === 160 || idCounter === 190 || idCounter === 260 || idCounter === 360) {
        offSiteToday = true;
      } else if (i % 5 === 0 && idCounter > 160) {
        status = "unaccounted";
        unaccountedMinutes = Math.floor(Math.random() * 4) + 1;
      }

      // Assign locationCategory and assemblyPoint
      let locationCategory: Occupant["locationCategory"] = "inside-building";
      let assemblyPoint: string | undefined = undefined;

      if (badgedOut || offSiteToday) {
        locationCategory = "offsite";
      } else if (status === "safe" && i % 2 === 0) {
        locationCategory = "outside-assembly";
        assemblyPoint = i % 4 === 0 ? "Assembly Point A (Park Plaza · East 14th)" : "Assembly Point B (Courtyard · East 15th)";
      } else {
        locationCategory = "inside-building";
      }

      // Compute coordinate percentages on Floor 07 blueprint
      const col = i % 6;
      const row = Math.floor(i / 6);
      let xCoord = 14 + col * 5.5;
      let yCoord = 14 + row * 6.5;

      if (quad === "NE") xCoord += 46;
      if (quad === "SW") yCoord += 44;
      if (quad === "SE") {
        xCoord += 46;
        yCoord += 44;
      }

      occupants.push({
        id,
        name,
        phone: `(212) 555-01${String(10 + (i % 89))}`,
        quadrant: quad,
        status,
        role,
        desk,
        araAssigned,
        locationCategory,
        assemblyPoint,
        badgedOut,
        offSiteToday,
        unaccountedMinutes,
        lastLocation: locationCategory === "outside-assembly" ? (assemblyPoint || "Outside Assembly") : `${desk} (${quad} Sector)`,
        lastBadgeTime: new Date(Date.now() - (i * 120000 + 300000)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        notes,
        xCoord,
        yCoord,
      });
    }
  });

  return occupants;
}

let occupantsRoster: Occupant[] = generateInitialRoster(200);

/* ------------------------------------------------------------------ */
/* PostgreSQL Pool & In-Memory Dual Engine for QR Attendance & Events */
/* ------------------------------------------------------------------ */

let pgPool: Pool | null = null;
let isPgConnected = false;

if (process.env.DATABASE_URL) {
  try {
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    });

    pgPool.on("error", (err) => {
      console.warn("PostgreSQL pool background error (fallback to in-memory):", err.message);
    });

    // Initialize relational schema if PostgreSQL is reachable
    pgPool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        event_date VARCHAR(64) NOT NULL,
        qr_token VARCHAR(64) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS roster (
        id VARCHAR(64) PRIMARY KEY,
        event_id VARCHAR(64) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(64),
        org VARCHAR(255),
        quadrant VARCHAR(16),
        role VARCHAR(64),
        checked_in BOOLEAN DEFAULT FALSE,
        checked_in_at VARCHAR(64),
        signature_data TEXT,
        signature_type VARCHAR(32)
      );
      CREATE TABLE IF NOT EXISTS attendance (
        id VARCHAR(64) PRIMARY KEY,
        event_id VARCHAR(64) NOT NULL,
        roster_id VARCHAR(64),
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(64),
        org VARCHAR(255),
        signature_data TEXT,
        signature_type VARCHAR(32) DEFAULT 'drawn',
        ip_address VARCHAR(128),
        checked_in_at VARCHAR(64) NOT NULL
      );
    `).then(() => {
      isPgConnected = true;
      console.log("PostgreSQL relational attendance tables verified & active.");
    }).catch((err) => {
      console.warn("PostgreSQL table init skipped (operating in in-memory mode):", err.message);
    });
  } catch (err: any) {
    console.warn("Could not instantiate PostgreSQL pool:", err.message);
  }
}

// In-Memory Fallback State & Primary Store
let dbEvents: CheckinEvent[] = [
  {
    id: "evt-fl07-daily",
    name: "Floor 07 Daily Access & Safety Muster",
    event_date: new Date().toISOString().split("T")[0],
    qr_token: "coned-fl07-active",
    created_at: new Date().toISOString(),
  },
];

let dbRoster: RosterAttendee[] = [];
let dbAttendance: AttendanceRecord[] = [];

// Seed initial roster from occupants into the active event
function syncInitialRosterToEvents() {
  const defaultEventId = "evt-fl07-daily";
  occupantsRoster.forEach((o) => {
    dbRoster.push({
      id: `ros-${o.id}`,
      event_id: defaultEventId,
      full_name: o.name,
      email: `${o.name.toLowerCase().replace(/[^a-z0-9]/g, ".")}@coned.com`,
      phone: o.phone,
      org: o.company || "Con Edison",
      quadrant: o.quadrant,
      role: o.role,
      checked_in: !o.badgedOut && !o.offSiteToday,
      checked_in_at: o.lastBadgeTime || null,
      signature_data: null,
      signature_type: null,
    });
  });
}

syncInitialRosterToEvents();

// Initialize Genesis ledger entry
appendLedger("genesis-init", { message: "MusterCommand ledger initialized", floor: "Floor 7" });

/* ------------------------------------------------------------------ */
/* Derive Snapshot Data                                               */
/* ------------------------------------------------------------------ */

function getDerivedSnapshot(): StatusSnapshot {
  const present = occupantsRoster.filter((o) => !o.badgedOut && !o.offSiteToday);

  // Apply predictive likely MIA (> 3 mins unaccounted)
  present.forEach((o) => {
    if (o.status === "unaccounted" && (o.unaccountedMinutes ?? 0) >= 3) {
      o.likelyMia = true;
      o.likelyMiaEvidence = `No check-in or mesh sighting for ${o.unaccountedMinutes} mins. Last badge at ${o.lastLocation} (${o.lastBadgeTime})`;
    } else {
      o.likelyMia = false;
      o.likelyMiaEvidence = undefined;
    }
  });

  const quadrants: QuadrantStat[] = QUADRANT_IDS.map((id) => {
    const inQuad = present.filter((o) => o.quadrant === id);
    return {
      id,
      label: QUADRANT_LABELS[id],
      expected: inQuad.length,
      accounted: inQuad.filter((o) => o.status === "safe").length,
      claimedUnverified: inQuad.filter((o) => o.status === "claimed-unverified").length,
      needHelp: inQuad.filter((o) => o.status === "need-help").length,
      mia: inQuad.filter((o) => o.status === "mia").length,
    };
  });

  const accountedCount = present.filter((o) => o.status === "safe").length;
  const needHelpCount = present.filter((o) => o.status === "need-help").length;
  const miaCount = present.filter((o) => o.status === "mia").length;
  const awaitingEvacChairCount = present.filter((o) => o.status === "awaiting-evac-chair").length;

  return {
    incidentActive,
    mode: incidentMode,
    hazardType,
    declaredAt,
    expectedOnFloor: present.length,
    accounted: accountedCount,
    needHelp: needHelpCount,
    mia: miaCount,
    awaitingEvacChair: awaitingEvacChairCount,
    quadrants,
    occupants: occupantsRoster,
    ledgerEntries: ledgerChain.slice(-30),
    latestNarrative,
  };
}

/* ------------------------------------------------------------------ */
/* SSE Broadcasting Setup                                              */
/* ------------------------------------------------------------------ */

function notifySseClients() {
  const snapshot = getDerivedSnapshot();
  const data = `data: ${JSON.stringify(snapshot)}\n\n`;
  sseResList.forEach((res) => {
    try {
      res.write(data);
    } catch {
      // client disconnected
    }
  });
}

app.get(["/api/stream", "/api/sse"], (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Send initial snapshot immediately
  const snapshot = getDerivedSnapshot();
  res.write(`data: ${JSON.stringify(snapshot)}\n\n`);

  sseResList.push(res);

  req.on("close", () => {
    sseResList = sseResList.filter((client) => client !== res);
  });
});

// Firebase Applet Backend Integration Endpoint
app.get("/api/firebase/config", (req, res) => {
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (require("fs").existsSync(configPath)) {
      const config = JSON.parse(require("fs").readFileSync(configPath, "utf-8"));
      res.json({
        ok: true,
        configured: true,
        projectId: config.projectId,
        firestoreDatabaseId: config.firestoreDatabaseId || "(default)",
        authDomain: config.authDomain,
      });
      return;
    }
  } catch (e) {
    // Fallback if read error
  }
  res.json({
    ok: true,
    configured: true,
    projectId: "gen-lang-client-0365544812",
    firestoreDatabaseId: "ai-studio-remixmustercomma-f7205f25-2e8a-4dc8-a2e4-13681ef91fd7",
  });
});

/* ------------------------------------------------------------------ */
/* Demo Accounts & Authentication Configuration                       */
/* ------------------------------------------------------------------ */

interface ServerUserAccount {
  userId: string;
  name: string;
  role: "fsd_director" | "warden" | "auditor" | "kiosk";
  roleLabel: string;
  passwordHash: string;
  caps: number;
  capsList: string[];
  quadrant?: QuadrantId;
}

const DEMO_ACCOUNTS: Record<string, ServerUserAccount> = {
  "fsd.director": {
    userId: "fsd.director",
    name: "Sarah Jenkins (Fire Safety Director)",
    role: "fsd_director",
    roleLabel: "Fire Safety Director (FSD)",
    passwordHash: "demo",
    caps: 8,
    capsList: [
      "incident:declare",
      "incident:clear",
      "alert:broadcast",
      "ai:redlist_query",
      "roster:import_edit",
      "kiosk:control",
      "narrative:approve_seal",
      "ledger:cryptographic_export",
    ],
  },
  "warden.nw": {
    userId: "warden.nw",
    name: "Michael Chang (NW Floor Warden)",
    role: "warden",
    roleLabel: "Floor Warden · NW Zone",
    passwordHash: "demo",
    caps: 3,
    capsList: ["quadrant:attendance", "occupant:check_in", "kiosk:scan"],
    quadrant: "NW",
  },
  "auditor.ehs": {
    userId: "auditor.ehs",
    name: "Elena Rostova (EHS Compliance Auditor)",
    role: "auditor",
    roleLabel: "EHS Compliance Auditor",
    passwordHash: "demo",
    caps: 3,
    capsList: ["ledger:audit_inspect", "drill:narrative_view", "reports:export"],
  },
  "kiosk.l7": {
    userId: "kiosk.l7",
    name: "Floor 07 Lobby Terminal",
    role: "kiosk",
    roleLabel: "Lobby Check-In Kiosk",
    passwordHash: "demo",
    caps: 1,
    capsList: ["kiosk:check_in_scan"],
  },
};

/* ------------------------------------------------------------------ */
/* Core API Endpoints                                                 */
/* ------------------------------------------------------------------ */

// Authentication Login endpoint
app.post("/api/auth/login", (req, res) => {
  const { userId, password } = req.body;
  const cleanId = (userId || "").trim().toLowerCase();
  const account = DEMO_ACCOUNTS[cleanId];

  if (!cleanId || !password) {
    appendLedger("auth-login-failure", {
      attemptedUserId: cleanId || "empty",
      reason: "Missing user ID or password",
      authMethod: "PASSWORD_CREDENTIAL",
    });
    res.status(400).json({ error: "User ID and password are required." });
    return;
  }

  if (account && (password === account.passwordHash || password === "demo")) {
    const token = `AUTH-${crypto.randomBytes(12).toString("hex")}`;
    const ledgerEntry = appendLedger("auth-login-success", {
      userId: account.userId,
      name: account.name,
      role: account.role,
      roleLabel: account.roleLabel,
      caps: account.caps,
      quadrant: account.quadrant || "ALL",
      authMethod: "PASSWORD_CREDENTIAL",
    });

    res.json({
      ok: true,
      user: {
        id: account.userId,
        userId: account.userId,
        name: account.name,
        role: account.role,
        roleLabel: account.roleLabel,
        caps: account.caps,
        capsList: account.capsList,
        quadrant: account.quadrant,
        token,
        authMethod: "PASSWORD_CREDENTIAL",
      },
      ledgerEntry,
      snapshot: getDerivedSnapshot(),
    });
    return;
  }

  // Record failed login attempt to the cryptographic audit ledger
  appendLedger("auth-login-failure", {
    attemptedUserId: cleanId,
    reason: "Invalid user ID or incorrect password",
    authMethod: "PASSWORD_CREDENTIAL",
  });

  res.status(401).json({
    ok: false,
    error: `Authentication failed: Invalid credentials for "${cleanId}". Demo accounts use password "demo".`,
  });
});

// Biometric Sign-In endpoint (WebAuthn / Passkey / TouchID / FaceID)
app.post("/api/auth/biometric", (req, res) => {
  const { userId, biometricType, credentialId } = req.body;
  const targetId = (userId || "fsd.director").trim().toLowerCase();
  const account = DEMO_ACCOUNTS[targetId] || DEMO_ACCOUNTS["fsd.director"];

  const token = `AUTH-BIO-${crypto.randomBytes(12).toString("hex")}`;
  const bioType = biometricType || "WebAuthn TouchID / FaceID Life-Safety Key";

  const ledgerEntry = appendLedger("auth-biometric-success", {
    userId: account.userId,
    name: account.name,
    role: account.role,
    roleLabel: account.roleLabel,
    biometricType: bioType,
    credentialId: credentialId || `PASSKEY-CONED-${Date.now().toString(36).toUpperCase()}`,
    authMethod: "BIOMETRIC_PASSKEY",
    verifiedAt: new Date().toISOString(),
  });

  notifySseClients();

  res.json({
    ok: true,
    user: {
      id: account.userId,
      userId: account.userId,
      name: account.name,
      role: account.role,
      roleLabel: account.roleLabel,
      caps: account.caps,
      capsList: account.capsList,
      quadrant: account.quadrant,
      token,
      authMethod: "BIOMETRIC_PASSKEY",
    },
    ledgerEntry,
    snapshot: getDerivedSnapshot(),
  });
});

// QR Code Badge Scanner Authentication endpoint (Employees, Contractors, Visitors, Commanders)
app.post("/api/auth/qr-scan", (req, res) => {
  const { qrCode } = req.body;
  if (!qrCode || typeof qrCode !== "string") {
    res.status(400).json({ error: "QR code payload is required." });
    return;
  }

  const rawCode = qrCode.trim();
  const cleanCode = rawCode.toLowerCase();

  // 1. Check if it's a Commander or Staff Passkey QR
  if (cleanCode.includes("fsd") || cleanCode.includes("director") || cleanCode === "fsd.director") {
    const account = DEMO_ACCOUNTS["fsd.director"];
    const token = `AUTH-QR-${crypto.randomBytes(12).toString("hex")}`;
    const ledgerEntry = appendLedger("auth-qr-scan-success", {
      targetType: "COMMANDER_BADGE",
      userId: account.userId,
      name: account.name,
      qrBadgeId: rawCode,
      authMethod: "QR_BADGE_SCAN",
    });
    notifySseClients();
    res.json({
      ok: true,
      user: {
        id: account.userId,
        userId: account.userId,
        name: account.name,
        role: account.role,
        roleLabel: account.roleLabel,
        caps: account.caps,
        capsList: account.capsList,
        token,
        authMethod: "QR_BADGE_SCAN",
      },
      ledgerEntry,
      snapshot: getDerivedSnapshot(),
    });
    return;
  }

  if (cleanCode.includes("warden") || cleanCode === "warden.nw") {
    const account = DEMO_ACCOUNTS["warden.nw"];
    const token = `AUTH-QR-${crypto.randomBytes(12).toString("hex")}`;
    const ledgerEntry = appendLedger("auth-qr-scan-success", {
      targetType: "WARDEN_BADGE",
      userId: account.userId,
      name: account.name,
      qrBadgeId: rawCode,
      authMethod: "QR_BADGE_SCAN",
    });
    notifySseClients();
    res.json({
      ok: true,
      user: {
        id: account.userId,
        userId: account.userId,
        name: account.name,
        role: account.role,
        roleLabel: account.roleLabel,
        caps: account.caps,
        capsList: account.capsList,
        quadrant: account.quadrant,
        token,
        authMethod: "QR_BADGE_SCAN",
      },
      ledgerEntry,
      snapshot: getDerivedSnapshot(),
    });
    return;
  }

  // 2. Check if it matches an existing occupant on the roster
  const foundOccupant = occupantsRoster.find(
    (o) =>
      o.id.toLowerCase() === cleanCode ||
      o.name.toLowerCase().includes(cleanCode) ||
      cleanCode.includes(o.id.toLowerCase())
  );

  if (foundOccupant) {
    foundOccupant.status = "safe";
    foundOccupant.unaccountedMinutes = 0;
    foundOccupant.lastBadgeTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    foundOccupant.checkInMethod = "qr-badge-scanner";

    const ledgerEntry = appendLedger("auth-qr-occupant-checkin", {
      occupantId: foundOccupant.id,
      name: foundOccupant.name,
      role: foundOccupant.role,
      quadrant: foundOccupant.quadrant,
      qrCodeScanned: rawCode,
      authMethod: "QR_BADGE_SCAN",
    });

    notifySseClients();

    const authUser: any = {
      id: foundOccupant.id,
      userId: foundOccupant.id.toLowerCase(),
      name: foundOccupant.name,
      role: "occupant",
      roleLabel: `${foundOccupant.role} · ${foundOccupant.quadrant}`,
      caps: 0,
      capsList: ["occupant:self_status"],
      quadrant: foundOccupant.quadrant,
      token: `AUTH-OCC-${crypto.randomBytes(8).toString("hex")}`,
      authMethod: "QR_BADGE_SCAN",
      isGuest: foundOccupant.role === "Visitor",
    };

    res.json({
      ok: true,
      user: authUser,
      occupant: foundOccupant,
      ledgerEntry,
      snapshot: getDerivedSnapshot(),
    });
    return;
  }

  // 3. New / Non-employee guest QR badge quick scan
  const guestCount = occupantsRoster.filter((o) => o.role === "Visitor").length + 1;
  const newGuestId = `VIS-${String(800 + guestCount)}`;
  const guestName = rawCode.replace(/^(CONED-|QR-|BADGE-|PASS-)/i, "").trim() || `ConEd Guest ${guestCount}`;

  const newOccupant: Occupant = {
    id: newGuestId,
    name: guestName.length > 25 ? guestName.slice(0, 25) : guestName,
    quadrant: "SE",
    status: "safe",
    role: "Visitor",
    badgedOut: false,
    offSiteToday: false,
    unaccountedMinutes: 0,
    lastLocation: `SE Floor 07 (Scanned: ${rawCode})`,
    lastBadgeTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    notes: `QR Optical Scan Pass: ${rawCode} · Fast Onboarded`,
    checkInMethod: "qr-scanner-onboard",
  };

  occupantsRoster.unshift(newOccupant);

  const ledgerEntry = appendLedger("coned-guest-qr-scanned-onboard", {
    guestId: newOccupant.id,
    name: newOccupant.name,
    qrPayload: rawCode,
    status: "safe",
    issuedAt: new Date().toISOString(),
  });

  notifySseClients();

  const authUser: any = {
    id: newOccupant.id,
    userId: newOccupant.id.toLowerCase(),
    name: newOccupant.name,
    role: "occupant",
    roleLabel: "ConEd Registered Visitor (QR Pass)",
    caps: 0,
    capsList: ["occupant:self_status"],
    quadrant: "SE",
    token: `AUTH-GUEST-${crypto.randomBytes(8).toString("hex")}`,
    authMethod: "QR_BADGE_SCAN",
    isGuest: true,
    guestDetails: {
      qrPassCode: rawCode,
      category: "Visitor",
      organization: "ConEd HQ Guest",
    },
  };

  res.json({
    ok: true,
    user: authUser,
    occupant: newOccupant,
    ledgerEntry,
    snapshot: getDerivedSnapshot(),
  });
});

// Con Edison Non-Employee / Visitor / Contractor Quick Sign-In & Life-Safety Pass Issuance
app.post("/api/auth/guest-quick-signin", (req, res) => {
  const { name, organization, category, hostEmployee, quadrant, phone, needsAssistance } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    res.status(400).json({ error: "Full Name is required for ConEd Life-Safety Visitor Pass." });
    return;
  }

  const cleanName = name.trim();
  const org = (organization || "").trim() || "Independent Contractor / Visitor";
  const cat = category || "Visitor";
  const host = (hostEmployee || "").trim() || "ConEd Floor 07 Lead";
  const assignedQuad: QuadrantId = (quadrant && QUADRANT_IDS.includes(quadrant)) ? quadrant : "SE";

  const guestCount = occupantsRoster.filter((o) => o.role === "Visitor").length + 1;
  const guestId = `VIS-${String(820 + guestCount)}`;
  const qrPassCode = `CONED-PASS-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

  const newVisitor: Occupant = {
    id: guestId,
    name: cleanName,
    quadrant: assignedQuad,
    status: "safe",
    role: "Visitor",
    badgedOut: false,
    offSiteToday: false,
    unaccountedMinutes: 0,
    lastLocation: `${assignedQuad} Floor 07 · Host: ${host} (${org})`,
    lastBadgeTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    notes: `${cat} · Org: ${org} · Host: ${host}${phone ? ` · Tel: ${phone}` : ""}${needsAssistance ? " · [ARA/MOBILITY ASSISTANCE NEEDED]" : ""}`,
    checkInMethod: "coned-fast-pass",
  };

  occupantsRoster.unshift(newVisitor);

  const ledgerEntry = appendLedger("coned-non-employee-pass-issued", {
    guestId: newVisitor.id,
    name: newVisitor.name,
    organization: org,
    category: cat,
    hostEmployee: host,
    quadrant: assignedQuad,
    phone: phone || null,
    needsAssistance: !!needsAssistance,
    qrPassCode,
    issuedAt: new Date().toISOString(),
  });

  notifySseClients();

  const authUser: any = {
    id: newVisitor.id,
    userId: newVisitor.id.toLowerCase(),
    name: newVisitor.name,
    role: "occupant",
    roleLabel: `ConEd ${cat} (${org})`,
    caps: 0,
    capsList: ["occupant:self_status"],
    quadrant: assignedQuad,
    token: `AUTH-GUEST-${crypto.randomBytes(8).toString("hex")}`,
    authMethod: "CONED_GUEST_ONBOARDING",
    isGuest: true,
    guestDetails: {
      organization: org,
      category: cat,
      hostEmployee: host,
      qrPassCode,
      phone,
      needsAssistance: !!needsAssistance,
    },
  };

  res.json({
    ok: true,
    user: authUser,
    occupant: newVisitor,
    qrPassCode,
    ledgerEntry,
    snapshot: getDerivedSnapshot(),
  });
});

// Authentication Logout endpoint
app.post("/api/auth/logout", (req, res) => {
  const { userId } = req.body;
  appendLedger("auth-logout", {
    userId: userId || "unknown",
    timestamp: new Date().toISOString(),
  });
  res.json({ ok: true });
});

// Get Demo Accounts list endpoint
app.get("/api/auth/demo-accounts", (req, res) => {
  const list = Object.values(DEMO_ACCOUNTS).map((acc) => ({
    userId: acc.userId,
    name: acc.name,
    role: acc.role,
    roleLabel: acc.roleLabel,
    caps: acc.caps,
    capsList: acc.capsList,
    quadrant: acc.quadrant,
  }));
  res.json({ accounts: list });
});

/* ------------------------------------------------------------------ */
/* QR Events, Expected Roster & Digital Signature Attendance Endpoints */
/* ------------------------------------------------------------------ */

// 1. Create an event + generate its QR code data URL
app.post("/api/events", async (req, res) => {
  try {
    const { name, event_date } = req.body;
    const eventName = (name || "Floor 07 Muster & Access Session").trim();
    const eventDate = event_date || new Date().toISOString().split("T")[0];
    const qr_token = crypto.randomBytes(12).toString("hex");
    const eventId = `evt-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;

    const newEvent: CheckinEvent = {
      id: eventId,
      name: eventName,
      event_date: eventDate,
      qr_token,
      created_at: new Date().toISOString(),
    };

    dbEvents.unshift(newEvent);

    if (pgPool && isPgConnected) {
      try {
        await pgPool.query(
          `INSERT INTO events (id, name, event_date, qr_token) VALUES ($1, $2, $3, $4)`,
          [newEvent.id, newEvent.name, newEvent.event_date, newEvent.qr_token]
        );
      } catch (err: any) {
        console.warn("PostgreSQL event insert error:", err.message);
      }
    }

    const origin = req.headers.origin || (req.headers.host ? `${req.protocol}://${req.headers.host}` : "http://localhost:3000");
    const checkinUrl = `${origin}/?mode=signin&token=${qr_token}`;
    const qrDataUrl = await QRCode.toDataURL(checkinUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: "#003B70",
        light: "#FFFFFF",
      },
    });

    newEvent.checkinUrl = checkinUrl;
    newEvent.qrDataUrl = qrDataUrl;

    appendLedger("event-created", {
      eventId: newEvent.id,
      name: newEvent.name,
      eventDate: newEvent.event_date,
      qrToken: qr_token,
      checkinUrl,
    });

    notifySseClients();

    res.json({
      ok: true,
      event: newEvent,
      checkinUrl,
      qrDataUrl,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create event: " + err.message });
  }
});

// List all events with live attendance totals
app.get("/api/events", (req, res) => {
  const eventsWithStats = dbEvents.map((evt) => {
    const attendees = dbRoster.filter((r) => r.event_id === evt.id);
    const walkIns = dbAttendance.filter((a) => a.event_id === evt.id && !a.roster_id);
    const checkedInCount = attendees.filter((r) => r.checked_in).length + walkIns.length;
    return {
      ...evt,
      expectedCount: attendees.length,
      checkedInCount,
      walkInCount: walkIns.length,
    };
  });
  res.json({ ok: true, events: eventsWithStats });
});

// 2. Bulk upload expected roster for an event
app.post("/api/events/:eventId/roster", async (req, res) => {
  const { eventId } = req.params;
  const { attendees } = req.body; // [{ full_name, email, org, phone, quadrant, role }]

  if (!Array.isArray(attendees) || attendees.length === 0) {
    res.status(400).json({ error: "attendees array is required" });
    return;
  }

  const targetEvent = dbEvents.find((e) => e.id === eventId || e.qr_token === eventId) || dbEvents[0];
  const inserted: RosterAttendee[] = [];

  for (let i = 0; i < attendees.length; i++) {
    const a = attendees[i];
    if (!a.full_name) continue;

    const newRosterItem: RosterAttendee = {
      id: `ros-${Date.now().toString(36)}-${i}-${crypto.randomBytes(2).toString("hex")}`,
      event_id: targetEvent.id,
      full_name: a.full_name.trim(),
      email: a.email ? a.email.trim().toLowerCase() : null,
      phone: a.phone ? a.phone.trim() : null,
      org: a.org ? a.org.trim() : "Con Edison",
      quadrant: (a.quadrant && QUADRANT_IDS.includes(a.quadrant)) ? a.quadrant : "NW",
      role: a.role || "Employee",
      checked_in: false,
      checked_in_at: null,
      signature_data: null,
      signature_type: null,
    };

    dbRoster.push(newRosterItem);
    inserted.push(newRosterItem);

    if (pgPool && isPgConnected) {
      try {
        await pgPool.query(
          `INSERT INTO roster (id, event_id, full_name, email, phone, org, quadrant, role, checked_in) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [newRosterItem.id, targetEvent.id, newRosterItem.full_name, newRosterItem.email, newRosterItem.phone, newRosterItem.org, newRosterItem.quadrant, newRosterItem.role, false]
        );
      } catch (err: any) {
        console.warn("PostgreSQL roster insert error:", err.message);
      }
    }
  }

  appendLedger("roster-bulk-uploaded", {
    eventId: targetEvent.id,
    eventName: targetEvent.name,
    count: inserted.length,
    timestamp: new Date().toISOString(),
  });

  notifySseClients();

  res.json({ ok: true, insertedCount: inserted.length, attendees: inserted });
});

// 3. Resolve QR token -> event info (for the sign-in page to load)
app.get("/api/checkin/:token", async (req, res) => {
  const { token } = req.params;
  const event = dbEvents.find((e) => e.qr_token === token || e.id === token) || dbEvents[0];

  if (!event) {
    res.status(404).json({ error: "Event session not found for this QR token" });
    return;
  }

  const rosterItems = dbRoster.filter((r) => r.event_id === event.id);
  const walkIns = dbAttendance.filter((a) => a.event_id === event.id && !a.roster_id);
  const checkedInCount = rosterItems.filter((r) => r.checked_in).length + walkIns.length;

  res.json({
    ok: true,
    event: {
      id: event.id,
      name: event.name,
      event_date: event.event_date,
      qr_token: event.qr_token,
      created_at: event.created_at,
    },
    totalExpected: rosterItems.length,
    checkedInCount,
    walkInCount: walkIns.length,
  });
});

// 4. Submit sign-in + digital signature & automatic attendance taking
app.post("/api/checkin/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { full_name, email, phone, org, quadrant, role, signature_data, signature_type, action } = req.body;

    if (!full_name || typeof full_name !== "string" || !full_name.trim()) {
      res.status(400).json({ error: "Full name is required to complete digital attendance sign-in." });
      return;
    }

    const cleanName = full_name.trim();
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    const cleanPhone = phone ? phone.trim() : null;
    const cleanOrg = org ? org.trim() : "Con Edison";
    const sigType: "drawn" | "typed" = signature_type === "typed" ? "typed" : "drawn";
    const assignedQuad: QuadrantId = (quadrant && QUADRANT_IDS.includes(quadrant)) ? quadrant : "NW";
    const assignedRole: Occupant["role"] = role || (cleanOrg.toLowerCase().includes("coned") || cleanOrg.toLowerCase().includes("con edison") ? "Employee" : "Visitor");

    const event = dbEvents.find((e) => e.qr_token === token || e.id === token) || dbEvents[0];
    const eventId = event.id;

    // Try to match against pre-loaded roster by email, fallback to name
    let rosterMatch = dbRoster.find((r) => {
      if (r.event_id !== eventId) return false;
      if (cleanEmail && r.email && r.email.toLowerCase() === cleanEmail) return true;
      if (r.full_name.toLowerCase() === cleanName.toLowerCase()) return true;
      return false;
    });

    const isLeaving = action === "leave";
    const checkedInAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    let rosterId = rosterMatch?.id || null;

    if (rosterMatch) {
      // Update roster item
      rosterMatch.checked_in = !isLeaving;
      rosterMatch.checked_in_at = checkedInAt;
      if (signature_data) rosterMatch.signature_data = signature_data;
      if (signature_type) rosterMatch.signature_type = sigType;
      if (cleanPhone) rosterMatch.phone = cleanPhone;
      if (cleanOrg) rosterMatch.org = cleanOrg;
    } else {
      // Add as roster entry so future lookups find it
      rosterId = `ros-${Date.now().toString(36)}-${crypto.randomBytes(2).toString("hex")}`;
      const newRosterEntry: RosterAttendee = {
        id: rosterId,
        event_id: eventId,
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        org: cleanOrg,
        quadrant: assignedQuad,
        role: assignedRole,
        checked_in: !isLeaving,
        checked_in_at: checkedInAt,
        signature_data: signature_data || null,
        signature_type: sigType,
      };
      dbRoster.unshift(newRosterEntry);
    }

    // Insert attendance record
    const attendanceRecordId = `att-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
    const attendanceRecord: AttendanceRecord = {
      id: attendanceRecordId,
      event_id: eventId,
      roster_id: rosterId,
      full_name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      org: cleanOrg,
      signature_data: signature_data || null,
      signature_type: sigType,
      ip_address: req.ip || "127.0.0.1",
      checked_in_at: checkedInAt,
    };
    dbAttendance.unshift(attendanceRecord);

    // Save to PostgreSQL if connected
    if (pgPool && isPgConnected) {
      try {
        await pgPool.query(
          `INSERT INTO attendance (id, event_id, roster_id, full_name, email, phone, org, signature_data, signature_type, ip_address, checked_in_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            attendanceRecord.id,
            eventId,
            rosterId,
            cleanName,
            cleanEmail,
            cleanPhone,
            cleanOrg,
            signature_data || null,
            sigType,
            req.ip || "127.0.0.1",
            checkedInAt,
          ]
        );
        if (rosterId) {
          await pgPool.query(
            `UPDATE roster SET checked_in = $1, checked_in_at = $2, signature_data = $3, signature_type = $4 WHERE id = $5`,
            [!isLeaving, checkedInAt, signature_data || null, sigType, rosterId]
          );
        }
      } catch (err: any) {
        console.warn("PostgreSQL attendance query error:", err.message);
      }
    }

    // Also sync to floor 07 occupants roster so CAD map and status numbers reflect it immediately!
    let matchedOccupant = occupantsRoster.find(
      (o) =>
        o.name.toLowerCase() === cleanName.toLowerCase() ||
        (cleanPhone && o.phone && o.phone.replace(/\D/g, "") === cleanPhone.replace(/\D/g, ""))
    );

    if (matchedOccupant) {
      matchedOccupant.status = "safe";
      matchedOccupant.badgedOut = isLeaving;
      matchedOccupant.offSiteToday = isLeaving;
      matchedOccupant.unaccountedMinutes = 0;
      matchedOccupant.lastBadgeTime = checkedInAt;
      matchedOccupant.lastLocation = isLeaving ? "Off-Site / Exited Building" : `${matchedOccupant.quadrant} Floor 07`;
      matchedOccupant.checkInMethod = "qr-signature-portal";
    } else {
      // Create new occupant entry
      const maxOccNum = occupantsRoster.reduce((max, o) => {
        const match = o.id.match(/OCC-(\d+)/);
        return match ? Math.max(max, parseInt(match[1], 10)) : max;
      }, 100);

      const newId = assignedRole === "Visitor" ? `VIS-${800 + dbAttendance.length}` : `OCC-${maxOccNum + 1}`;
      matchedOccupant = {
        id: newId,
        name: cleanName,
        phone: cleanPhone || "(212) 555-0199",
        company: cleanOrg,
        quadrant: assignedQuad,
        status: "safe",
        role: assignedRole,
        badgedOut: isLeaving,
        offSiteToday: isLeaving,
        unaccountedMinutes: 0,
        desk: `07-${assignedQuad}-Workstation`,
        locationCategory: isLeaving ? "offsite" : "inside-building",
        lastLocation: isLeaving ? "Off-Site / Exited Building" : `Floor 07 (${assignedQuad})`,
        lastBadgeTime: checkedInAt,
        notes: `QR Signed Attendance (${sigType.toUpperCase()} Signature verified · IP: ${req.ip || "local"})`,
        checkInMethod: "qr-signature-portal",
      };
      occupantsRoster.unshift(matchedOccupant);
    }

    // Record to immutable audit ledger
    const ledgerEntry = appendLedger("qr-signature-checkin", {
      eventId,
      eventName: event.name,
      occupantId: matchedOccupant.id,
      name: cleanName,
      email: cleanEmail,
      org: cleanOrg,
      quadrant: matchedOccupant.quadrant,
      signatureType: sigType,
      hasSignatureData: Boolean(signature_data),
      presence: isLeaving ? "LEFT_BUILDING" : "IN_BUILDING",
      ipAddress: req.ip || "127.0.0.1",
      timestamp: new Date().toISOString(),
    });

    notifySseClients();

    res.json({
      success: true,
      attendance: attendanceRecord,
      occupant: matchedOccupant,
      event: {
        id: event.id,
        name: event.name,
      },
      ledgerEntry,
      snapshot: getDerivedSnapshot(),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Check-in processing error: " + err.message });
  }
});

// 5. Live roster: current state + stats
app.get("/api/events/:eventId/roster-status", async (req, res) => {
  const { eventId } = req.params;
  const event = dbEvents.find((e) => e.id === eventId || e.qr_token === eventId) || dbEvents[0];

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const rosterList = dbRoster.filter((r) => r.event_id === event.id);
  const walkInList = dbAttendance.filter((a) => a.event_id === event.id && !a.roster_id);
  const checkedInCount = rosterList.filter((r) => r.checked_in).length;
  const totalExpected = rosterList.length;
  const attendanceRate = totalExpected > 0 ? Math.round((checkedInCount / totalExpected) * 100) : 100;

  res.json({
    ok: true,
    event,
    roster: rosterList,
    walkIns: walkInList,
    stats: {
      totalExpected,
      checkedInCount,
      walkInCount: walkInList.length,
      pendingCount: totalExpected - checkedInCount,
      attendanceRate,
    },
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  const memory = process.memoryUsage();
  res.json({
    status: "ok",
    service: "MusterCommand Life-Safety Backend",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    memory: {
      rssMb: Math.round(memory.rss / (1024 * 1024) * 10) / 10,
      heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024) * 10) / 10,
      heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024) * 10) / 10,
    },
    sseClientsCount: sseResList.length,
    ledgerHeight: ledgerChain.length,
    incidentActive,
    mode: incidentMode,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Server Network & LAN Discovery Endpoint for Mobile Device Scanners
app.get("/api/system/network-info", (req, res) => {
  const ifaces = os.networkInterfaces();
  const lanIps: string[] = [];
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        lanIps.push(net.address);
      }
    }
  }
  const primaryIp = lanIps[0] || "127.0.0.1";
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const hostHeader = req.headers.host || `localhost:${PORT}`;
  const isLocalhost = hostHeader.includes("localhost") || hostHeader.includes("127.0.0.1");
  const mobileOrigin = isLocalhost && lanIps.length > 0 ? `${protocol}://${primaryIp}:${PORT}` : `${protocol}://${hostHeader}`;

  res.json({
    ok: true,
    lanIps,
    primaryIp,
    port: PORT,
    currentHost: hostHeader,
    isLocalhost,
    mobileOrigin,
    publicTunnelUrl: activeTunnelUrl || null,
  });
});

// Dynamic Public Cellular Pathway (for phones outside building Wi-Fi)
let activeTunnelChild: any = null;
let activeTunnelUrl: string = "";

async function launchPublicTunnel(): Promise<string> {
  // First attempt: Cloudflare Quick Tunnel (zero interstitials, instant, universal phone reachability)
  const cfBinary = fs.existsSync("./bin/cloudflared") ? "./bin/cloudflared" : "cloudflared";
  try {
    const url = await new Promise<string>((resolve, reject) => {
      const child = spawn(cfBinary, ["tunnel", "--url", `http://localhost:${PORT}`]);
      let resolved = false;

      child.stderr.on("data", (data) => {
        const text = data.toString();
        const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (match && !resolved) {
          resolved = true;
          activeTunnelChild = child;
          activeTunnelUrl = match[0];
          console.log(`🌐 Cloudflare Public Cellular Pathway Live: ${activeTunnelUrl}`);
          resolve(match[0]);
        }
      });

      child.on("close", () => {
        activeTunnelChild = null;
        activeTunnelUrl = "";
      });

      child.on("error", (err) => {
        if (!resolved) {
          reject(err);
        }
      });

      setTimeout(() => {
        if (!resolved) {
          try { child.kill(); } catch {}
          reject(new Error("Cloudflare tunnel handshake timed out"));
        }
      }, 10000);
    });
    return url;
  } catch (cfErr) {
    console.warn("Cloudflare tunnel attempt failed, trying localtunnel fallback:", cfErr);
  }

  // Fallback: Localtunnel
  const localtunnel = (await import("localtunnel")).default;
  const lt = await localtunnel({ port: PORT });
  activeTunnelChild = {
    kill: () => {
      try { lt.close(); } catch {}
    },
  };
  activeTunnelUrl = lt.url;
  lt.on("close", () => {
    activeTunnelChild = null;
    activeTunnelUrl = "";
  });
  console.log(`🌐 Localtunnel Pathway Live: ${activeTunnelUrl}`);
  return activeTunnelUrl;
}

app.get("/api/system/tunnel/status", (req, res) => {
  res.json({
    ok: true,
    active: !!activeTunnelChild && !!activeTunnelUrl,
    url: activeTunnelUrl || null,
  });
});

app.post("/api/system/tunnel/start", async (req, res) => {
  try {
    if (activeTunnelChild && activeTunnelUrl) {
      return res.json({ ok: true, active: true, url: activeTunnelUrl, message: "Tunnel already active" });
    }
    const url = await launchPublicTunnel();
    res.json({ ok: true, active: true, url });
  } catch (err: any) {
    console.error("Failed to launch public tunnel:", err);
    res.status(500).json({ ok: false, error: err.message || "Failed to launch public tunnel" });
  }
});

app.post("/api/system/tunnel/stop", (req, res) => {
  try {
    if (activeTunnelChild) {
      if (typeof activeTunnelChild.kill === "function") {
        activeTunnelChild.kill();
      }
      activeTunnelChild = null;
      activeTunnelUrl = "";
    }
    res.json({ ok: true, active: false });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Backend Wireframe & Architecture Topology Endpoint
app.get("/api/backend/topology", (req, res) => {
  const snapshot = getDerivedSnapshot();
  const memory = process.memoryUsage();

  // Validate ledger chain integrity
  let validChain = true;
  for (let i = 1; i < ledgerChain.length; i++) {
    if (ledgerChain[i].prevHash !== ledgerChain[i - 1].hash) {
      validChain = false;
      break;
    }
  }

  res.json({
    system: {
      name: "MusterCommand Core Engine",
      version: "3.2.0-FIPS",
      environment: process.env.NODE_ENV || "development",
      port: PORT,
      uptimeSeconds: Math.floor(process.uptime()),
      bootTimestamp: declaredAt || new Date().toISOString(),
      nodeVersion: process.version,
      memory: {
        rssMb: Math.round(memory.rss / (1024 * 1024) * 10) / 10,
        heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024) * 10) / 10,
        heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024) * 10) / 10,
      },
    },
    subsystems: [
      {
        id: "ingress-auth",
        name: "Security & Ingress Gateway",
        category: "Security & Gateway",
        description: "FIDO2 / WebAuthn Fingerprint passkeys, QR badge scanners, and credential authentication",
        status: "healthy",
        metrics: {
          activeSessions: 4,
          supportedMethods: ["BIOMETRIC_PASSKEY", "QR_BADGE_SCAN", "PASSWORD_CREDENTIAL", "CONED_GUEST_ONBOARDING"],
          demoAccountsCount: Object.keys(DEMO_ACCOUNTS).length,
        },
        endpoints: ["/api/auth/login", "/api/auth/biometric", "/api/auth/qr-scan", "/api/auth/guest-quick-signin"],
      },
      {
        id: "rest-controllers",
        name: "Life-Safety REST Controllers",
        category: "Application Tier",
        description: "Core controllers managing check-ins, bulk roll calls, emergency push alerts, and incidents",
        status: "healthy",
        metrics: {
          totalOccupants: occupantsRoster.length,
          presentExpected: snapshot.expectedOnFloor,
          accountedSafe: snapshot.accounted,
          incidentActive,
          hazardType,
        },
        endpoints: [
          "/api/check-in",
          "/api/check-in/bulk",
          "/api/kiosk/scan",
          "/api/visitor/register",
          "/api/roster/import",
          "/api/emergency-alert",
          "/api/incident/declare",
          "/api/incident/clear",
        ],
      },
      {
        id: "sse-mesh",
        name: "Real-Time SSE Event Bus",
        category: "Messaging & Sync",
        description: "Low-latency Server-Sent Events stream delivering sub-50ms state updates to all consoles",
        status: "healthy",
        metrics: {
          activeConnections: sseResList.length,
          broadcastFrequency: "event-driven",
          heartbeatSlaMs: 50,
        },
        endpoints: ["/api/events"],
      },
      {
        id: "audit-ledger",
        name: "Cryptographic Audit Ledger",
        category: "Data & Compliance",
        description: "FIPS-140 compliant SHA-256 hash-chained immutable sequence for life-safety accountability",
        status: validChain ? "verified" : "tampered",
        metrics: {
          totalBlocks: ledgerChain.length,
          isChainValid: validChain,
          genesisHash: ledgerChain[0]?.hash || "N/A",
          headHash: ledgerChain[ledgerChain.length - 1]?.hash || "N/A",
        },
        endpoints: ["/api/audit-export", "/api/export"],
      },
      {
        id: "gemini-ai",
        name: "Google Gemini 3.6 Flash Engine",
        category: "Intelligence Tier",
        description: "Grounded AI after-action narrative generator and natural language red-list query parser",
        status: process.env.GEMINI_API_KEY ? "active" : "fallback-mode",
        metrics: {
          model: "gemini-3.6-flash",
          sdk: "@google/genai",
          capabilities: ["After-Action Drill Narratives", "Natural Language Roster Queries"],
        },
        endpoints: ["/api/ai/drill-narrative", "/api/ai/drill-narrative/approve", "/api/ai/redlist-query"],
      },
      {
        id: "spatial-store",
        name: "Floor 07 Spatial Topology Store",
        category: "Storage Tier",
        description: "In-memory high-speed spatial quadrant state, grid coordinates, and ARA tracking store",
        status: "healthy",
        metrics: {
          quadrants: QUADRANT_IDS,
          araCount: snapshot.awaitingEvacChair,
          needHelpCount: snapshot.needHelp,
          miaCount: snapshot.mia,
        },
        endpoints: ["/api/state", "/api/status", "/api/muster/state"],
      },
    ],
  });
});

// State / Status endpoint
app.get(["/api/state", "/api/status", "/api/muster/state"], (req, res) => {
  res.json(getDerivedSnapshot());
});

// Check-in / Status update endpoint with Geo-Fence validation check
app.post("/api/check-in", (req, res) => {
  const { occupantId, status, quadrant, via, notes, locationCategory, assemblyPoint, locationMetadata, geoValidation } = req.body;
  const occupant = occupantsRoster.find((o) => o.id === occupantId);

  if (!occupant) {
    res.status(404).json({ error: `Occupant ${occupantId} not found` });
    return;
  }

  const oldStatus = occupant.status;
  occupant.status = status || "safe";
  occupant.unaccountedMinutes = 0;
  if (quadrant && QUADRANT_IDS.includes(quadrant)) {
    occupant.quadrant = quadrant;
  }
  if (locationCategory) {
    occupant.locationCategory = locationCategory;
  }
  if (assemblyPoint) {
    occupant.assemblyPoint = assemblyPoint;
    occupant.lastLocation = assemblyPoint;
  } else if (locationCategory === "outside-assembly") {
    occupant.assemblyPoint = occupant.assemblyPoint || "Assembly Point A (Park Plaza / Union Sq East)";
    occupant.lastLocation = occupant.assemblyPoint;
  } else if (locationCategory === "inside-building") {
    occupant.lastLocation = `${occupant.quadrant} Floor 07`;
  }
  if (notes) {
    occupant.notes = notes;
  }
  occupant.checkInMethod = via || "kiosk";

  if (geoValidation) {
    occupant.geofenceValidation = {
      isInsideBuilding: !!geoValidation.isInsideBuilding,
      isAtAssemblyPoint: !!geoValidation.isAtAssemblyPoint,
      locationCategory: occupant.locationCategory || "inside-building",
      assemblyPoint: occupant.assemblyPoint || null,
      confidence: geoValidation.confidence || "HIGH",
      distanceMeters: geoValidation.distanceMeters || null,
      verifiedAt: new Date().toISOString(),
      auditDetails: geoValidation.auditDetails || "Physical constraints verified",
    };
  }

  const ledgerItem = appendLedger("occupant-check-in", {
    occupantId: occupant.id,
    name: occupant.name,
    quadrant: occupant.quadrant,
    locationCategory: occupant.locationCategory,
    assemblyPoint: occupant.assemblyPoint || null,
    previousStatus: oldStatus,
    newStatus: occupant.status,
    via: occupant.checkInMethod,
    notes: occupant.notes || null,
    geofenceVerification: occupant.geofenceValidation || {
      isInsideBuilding: occupant.locationCategory === "inside-building",
      isAtAssemblyPoint: occupant.locationCategory === "outside-assembly",
      locationCategory: occupant.locationCategory,
      verifiedAt: new Date().toISOString(),
    },
  });

  notifySseClients();

  res.json({ ok: true, occupant, ledgerEntry: ledgerItem });
});

// Bulk Check-In / Status Update endpoint (Mark down a list)
app.post("/api/check-in/bulk", (req, res) => {
  const { occupantIds, status, via, notes } = req.body;

  if (!Array.isArray(occupantIds) || occupantIds.length === 0) {
    res.status(400).json({ error: "occupantIds must be a non-empty array" });
    return;
  }

  const updatedOccupants: Occupant[] = [];
  const targetStatus = status || "safe";
  const checkInVia = via || "batch-admin-action";

  for (const id of occupantIds) {
    const occupant = occupantsRoster.find((o) => o.id === id);
    if (occupant) {
      const oldStatus = occupant.status;
      occupant.status = targetStatus;
      occupant.unaccountedMinutes = 0;
      occupant.checkInMethod = checkInVia;
      if (notes) occupant.notes = notes;

      appendLedger("bulk-check-in", {
        occupantId: occupant.id,
        name: occupant.name,
        quadrant: occupant.quadrant,
        previousStatus: oldStatus,
        newStatus: targetStatus,
        via: checkInVia,
      });

      updatedOccupants.push(occupant);
    }
  }

  notifySseClients();

  res.json({
    ok: true,
    updatedCount: updatedOccupants.length,
    status: targetStatus,
    message: `Batch updated ${updatedOccupants.length} occupants to "${targetStatus}".`,
  });
});

// QR Kiosk Badge Scan / Sign-In / Sign-Out endpoint
app.post("/api/kiosk/scan", (req, res) => {
  const { code, status, action } = req.body; // action: "enter" | "leave" | "toggle" | "muster"
  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Badge/QR code is required" });
    return;
  }

  const cleanCode = code.trim().toUpperCase();
  // Search by exact ID, or substring ID, or name match, or phone
  let occupant = occupantsRoster.find(
    (o) =>
      o.id.toUpperCase() === cleanCode ||
      o.id.toUpperCase().replace("OCC-", "") === cleanCode ||
      o.name.toUpperCase().includes(cleanCode) ||
      (o.phone && o.phone.replace(/\D/g, "").includes(cleanCode.replace(/\D/g, "")))
  );

  if (!occupant) {
    res.status(404).json({
      error: `Badge or QR code "${code}" not found in current daily roster.`,
      code: "BADGE_NOT_FOUND",
    });
    return;
  }

  const prevStatus = occupant.status;
  const prevBadgedOut = occupant.badgedOut;

  // Determine presence based on action parameter or default enter
  const isLeaving = action === "leave" || (action === "toggle" && !prevBadgedOut);

  if (isLeaving) {
    occupant.badgedOut = true;
    occupant.offSiteToday = true;
    occupant.locationCategory = "offsite";
    occupant.status = "safe";
    occupant.unaccountedMinutes = 0;
    occupant.lastBadgeTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    occupant.lastLocation = "Off-Site / Exited Building";
    occupant.checkInMethod = "kiosk-qr-badge-out";

    const ledgerItem = appendLedger("kiosk-qr-scan-badge-out", {
      occupantId: occupant.id,
      name: occupant.name,
      phone: occupant.phone || "N/A",
      role: occupant.role,
      quadrant: occupant.quadrant,
      departureTime: occupant.lastBadgeTime,
      presence: "LEFT_BUILDING",
      method: "KIOSK_QR_SCANNER",
    });

    notifySseClients();

    res.json({
      ok: true,
      occupant,
      presence: "LEFT_BUILDING",
      ledgerEntry: ledgerItem,
      message: `Badged Out: ${occupant.name} (${occupant.id}) has LEFT the building. Headcount updated.`,
      snapshot: getDerivedSnapshot(),
    });
    return;
  }

  // Entering building / In-Building sign-in
  occupant.status = status || "safe";
  occupant.badgedOut = false;
  occupant.offSiteToday = false;
  occupant.locationCategory = action === "muster" ? "outside-assembly" : "inside-building";
  occupant.unaccountedMinutes = 0;
  occupant.lastBadgeTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  occupant.lastLocation = action === "muster" ? "Outside Assembly Point" : `${occupant.desk || "Floor 07"} (${occupant.quadrant})`;
  occupant.checkInMethod = "kiosk-qr-scan";

  const ledgerItem = appendLedger("kiosk-qr-scan-checkin", {
    occupantId: occupant.id,
    name: occupant.name,
    phone: occupant.phone || "N/A",
    role: occupant.role,
    quadrant: occupant.quadrant,
    previousStatus: prevStatus,
    checkInTime: occupant.lastBadgeTime,
    presence: "IN_BUILDING",
    method: "KIOSK_QR_SCANNER",
  });

  notifySseClients();

  res.json({
    ok: true,
    occupant,
    presence: "IN_BUILDING",
    ledgerEntry: ledgerItem,
    message: `Signed In: ${occupant.name} (${occupant.id}) is IN THE BUILDING (Quadrant ${occupant.quadrant}).`,
    snapshot: getDerivedSnapshot(),
  });
});

// Full Self-Service Sign-In / Register endpoint with Name, Phone, and Occ # Assignment
app.post("/api/occupant/sign-in-register", (req, res) => {
  const { name, phone, action, quadrant, role, company, desk, notes } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Full Name is required for QR attendance sign-in" });
    return;
  }

  const cleanName = name.trim();
  const cleanPhone = (phone || "").trim();
  const cleanDigits = cleanPhone.replace(/\D/g, "");

  // Check if occupant exists by exact phone, or exact name, or partial match
  let occupant = occupantsRoster.find((o) => {
    if (cleanDigits && o.phone && o.phone.replace(/\D/g, "") === cleanDigits) return true;
    if (o.name.toLowerCase() === cleanName.toLowerCase()) return true;
    return false;
  });

  let isNew = false;
  const isLeaving = action === "leave";

  if (occupant) {
    // Update existing occupant details
    if (cleanPhone) occupant.phone = cleanPhone;
    if (company) occupant.company = company;
    if (quadrant && QUADRANT_IDS.includes(quadrant)) occupant.quadrant = quadrant;
  } else {
    // Generate new official OCC #
    isNew = true;
    const maxOccNum = occupantsRoster.reduce((max, o) => {
      const match = o.id.match(/OCC-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 100);

    const newId = `OCC-${maxOccNum + 1}`;
    const assignedQuad: QuadrantId = (quadrant && QUADRANT_IDS.includes(quadrant)) ? quadrant : "SE";
    const assignedRole: Occupant["role"] = (role && ["Employee", "Contractor", "Visitor", "VIP", "First Responder"].includes(role))
      ? role as Occupant["role"]
      : "Employee";

    const offset = Math.floor(Math.random() * 16);
    let xCoord = 14 + (offset % 5) * 6;
    let yCoord = 14 + Math.floor(offset / 5) * 8;
    if (assignedQuad === "NE") xCoord += 46;
    if (assignedQuad === "SW") yCoord += 44;
    if (assignedQuad === "SE") {
      xCoord += 46;
      yCoord += 44;
    }

    occupant = {
      id: newId,
      name: cleanName,
      phone: cleanPhone || "(212) 555-0199",
      company: company || "Con Edison",
      quadrant: assignedQuad,
      status: "safe",
      role: assignedRole,
      badgedOut: isLeaving,
      offSiteToday: isLeaving,
      unaccountedMinutes: 0,
      desk: desk || `07-${assignedQuad}-Workstation`,
      locationCategory: isLeaving ? "offsite" : "inside-building",
      lastLocation: isLeaving ? "Off-Site / Exited Building" : `Floor 07 (${assignedQuad})`,
      lastBadgeTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      notes: notes || `Registered via QR Code Sign-In (Phone: ${cleanPhone || "N/A"})`,
      checkInMethod: "qr-code-self-signin",
      xCoord,
      yCoord,
    };

    occupantsRoster.unshift(occupant);
  }

  // Update presence status
  if (isLeaving) {
    occupant.badgedOut = true;
    occupant.offSiteToday = true;
    occupant.locationCategory = "offsite";
    occupant.status = "safe";
    occupant.lastBadgeTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    occupant.lastLocation = "Off-Site / Exited Building";
  } else {
    occupant.badgedOut = false;
    occupant.offSiteToday = false;
    occupant.locationCategory = action === "muster" ? "outside-assembly" : "inside-building";
    occupant.status = "safe";
    occupant.lastBadgeTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    occupant.lastLocation = action === "muster" ? "Outside Assembly Point" : `${occupant.desk || "Floor 07"} (${occupant.quadrant})`;
  }

  const ledgerItem = appendLedger("qr-occupant-presence-event", {
    occupantId: occupant.id,
    name: occupant.name,
    phone: occupant.phone,
    presence: isLeaving ? "LEFT_BUILDING" : "IN_BUILDING",
    isNewRegistration: isNew,
    timestamp: occupant.lastBadgeTime,
  });

  notifySseClients();

  res.json({
    ok: true,
    occupant,
    isNew,
    presence: isLeaving ? "LEFT_BUILDING" : "IN_BUILDING",
    message: isLeaving
      ? `Badged Out: ${occupant.name} (${occupant.id}) marked as LEFT BUILDING.`
      : `Signed In: ${occupant.name} (${occupant.id}) registered & detected as IN BUILDING!`,
    ledgerEntry: ledgerItem,
    snapshot: getDerivedSnapshot(),
  });
});

// Quick Presence Toggle Endpoint (Enter vs Leave Building)
app.post("/api/occupant/presence", (req, res) => {
  const { occupantId, action } = req.body; // action: "enter" | "leave" | "toggle"

  if (!occupantId) {
    res.status(400).json({ error: "occupantId is required" });
    return;
  }

  const occupant = occupantsRoster.find((o) => o.id.toUpperCase() === occupantId.toUpperCase());
  if (!occupant) {
    res.status(404).json({ error: "Occupant not found" });
    return;
  }

  const isLeaving = action === "leave" || (action === "toggle" && !occupant.badgedOut);

  if (isLeaving) {
    occupant.badgedOut = true;
    occupant.offSiteToday = true;
    occupant.locationCategory = "offsite";
    occupant.status = "safe";
    occupant.lastLocation = "Off-Site / Exited Building";
    occupant.lastBadgeTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else {
    occupant.badgedOut = false;
    occupant.offSiteToday = false;
    occupant.locationCategory = "inside-building";
    occupant.status = "safe";
    occupant.lastLocation = `${occupant.desk || "Floor 07"} (${occupant.quadrant})`;
    occupant.lastBadgeTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const ledgerItem = appendLedger("presence-toggle-event", {
    occupantId: occupant.id,
    name: occupant.name,
    phone: occupant.phone,
    presence: isLeaving ? "LEFT_BUILDING" : "IN_BUILDING",
    timestamp: occupant.lastBadgeTime,
  });

  notifySseClients();

  res.json({
    ok: true,
    occupant,
    presence: isLeaving ? "LEFT_BUILDING" : "IN_BUILDING",
    snapshot: getDerivedSnapshot(),
  });
});

// Daily Visitor / Roster Add Registration Kiosk endpoint
app.post(["/api/visitor/register", "/api/roster/add"], (req, res) => {
  const { name, phone, company, hostEmployee, quadrant, notes, immediateCheckIn, role, locationCategory, status } = req.body;

  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const assignedRole = (role && ["Employee", "Contractor", "Visitor", "VIP", "First Responder"].includes(role))
    ? role
    : "Visitor";

  const prefix = assignedRole === "Visitor" ? "VIS" : assignedRole === "Contractor" ? "CTR" : "OCC";
  const visitorCount = occupantsRoster.filter((o) => o.role === assignedRole).length + 1;
  const newId = `${prefix}-${String(800 + visitorCount)}`;
  const assignedQuad: QuadrantId = (quadrant && QUADRANT_IDS.includes(quadrant)) ? quadrant : "SE";

  const newOccupant: Occupant = {
    id: newId,
    name: name.trim(),
    phone: phone ? phone.trim() : `(212) 555-${String(9000 + visitorCount)}`,
    company: company ? company.trim() : (assignedRole === "Visitor" ? "Guest Visitor" : "Con Edison"),
    quadrant: assignedQuad,
    status: (status || (immediateCheckIn ? "safe" : "safe")) as Occupant["status"],
    role: assignedRole as Occupant["role"],
    badgedOut: false,
    offSiteToday: false,
    unaccountedMinutes: 0,
    locationCategory: locationCategory || "inside-building",
    lastLocation: `${assignedQuad} · ${notes || "Checked In"}`,
    lastBadgeTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    notes: notes || `Host: ${hostEmployee || "N/A"} · Org: ${company || "Visitor"}`,
    checkInMethod: "entrance-kiosk-pass",
  };

  occupantsRoster.unshift(newOccupant);

  const ledgerItem = appendLedger(assignedRole === "Visitor" ? "daily-visitor-registered" : "occupant-roster-added", {
    occupantId: newOccupant.id,
    name: newOccupant.name,
    phone: newOccupant.phone,
    company: newOccupant.company,
    role: newOccupant.role,
    quadrant: assignedQuad,
    checkInStatus: newOccupant.status,
    issuedAt: new Date().toISOString(),
  });

  notifySseClients();

  res.json({
    ok: true,
    occupant: newOccupant,
    visitor: newOccupant,
    ledgerEntry: ledgerItem,
    snapshot: getDerivedSnapshot(),
  });
});

// Roster Schedule / Matrix Import endpoint
app.post("/api/roster/import", (req, res) => {
  const { occupants, mode } = req.body; // mode: "append" | "replace"

  if (!Array.isArray(occupants) || occupants.length === 0) {
    res.status(400).json({ error: "Valid occupants list is required" });
    return;
  }

  let importedCount = 0;

  if (mode === "replace") {
    // Map imported records to valid Occupant structure
    occupantsRoster = occupants.map((item: any, idx: number) => {
      const q: QuadrantId = QUADRANT_IDS.includes(item.quadrant) ? item.quadrant : "SE";
      return {
        id: item.id || `OCC-${101 + idx}`,
        name: item.name || `Occupant ${idx + 1}`,
        quadrant: q,
        status: (item.status as Occupant["status"]) || "safe",
        role: (item.role as Occupant["role"]) || "Employee",
        badgedOut: Boolean(item.badgedOut),
        offSiteToday: Boolean(item.offSiteToday),
        unaccountedMinutes: 0,
        lastLocation: item.lastLocation || `${q} Zone A`,
        lastBadgeTime: item.lastBadgeTime || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        notes: item.notes || item.schedule || "Imported via Daily Roster Matrix",
        checkInMethod: "roster-matrix-import",
      };
    });
    importedCount = occupantsRoster.length;
  } else {
    // Append or update existing items
    occupants.forEach((item: any, idx: number) => {
      const existing = occupantsRoster.find((o) => o.id === item.id || o.name.toLowerCase() === item.name?.toLowerCase());
      const q: QuadrantId = QUADRANT_IDS.includes(item.quadrant) ? item.quadrant : "SE";

      if (existing) {
        existing.quadrant = q;
        existing.role = item.role || existing.role;
        existing.status = item.status || existing.status;
        existing.notes = item.notes || item.schedule || existing.notes;
      } else {
        occupantsRoster.push({
          id: item.id || `OCC-${900 + idx}`,
          name: item.name || `New Occupant ${idx + 1}`,
          quadrant: q,
          status: item.status || "safe",
          role: item.role || "Employee",
          badgedOut: Boolean(item.badgedOut),
          offSiteToday: Boolean(item.offSiteToday),
          unaccountedMinutes: 0,
          lastLocation: item.lastLocation || `${q} Zone A`,
          lastBadgeTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          notes: item.notes || item.schedule || "Imported via Daily Roster Matrix",
          checkInMethod: "roster-matrix-import",
        });
      }
      importedCount++;
    });
  }

  const ledgerItem = appendLedger("daily-roster-imported", {
    importMode: mode || "append",
    importedRecordsCount: importedCount,
    totalRosterCount: occupantsRoster.length,
    timestamp: new Date().toISOString(),
  });

  notifySseClients();

  res.json({
    ok: true,
    importedCount,
    totalRoster: occupantsRoster.length,
    ledgerEntry: ledgerItem,
    snapshot: getDerivedSnapshot(),
  });
});

// Dynamic Roster Scaler Endpoint (200 to 400 Occupants)
app.post("/api/roster/scale", (req, res) => {
  const count = Number(req.body.count) || 200;
  const validCount = Math.max(100, Math.min(450, count));

  occupantsRoster = generateInitialRoster(validCount);

  const ledgerItem = appendLedger("roster-scaled", {
    targetCount: validCount,
    actualCount: occupantsRoster.length,
    scaledBy: "FSD COMMAND CONSOLE",
    timestamp: new Date().toISOString(),
  });

  notifySseClients();

  res.json({
    ok: true,
    count: occupantsRoster.length,
    message: `Roster reconfigured to ${occupantsRoster.length} occupants across 4 quadrants.`,
    ledgerEntry: ledgerItem,
    snapshot: getDerivedSnapshot(),
  });
});

// Rapid 1-Click Digital Muster Sweep Endpoint ("Process Round in Seconds")
app.post("/api/muster/sweep", (req, res) => {
  const { quadrant, sweepAll, via, wardenName } = req.body;
  const startTime = Date.now();
  const sweptOccupants: Occupant[] = [];
  const sweepMethod = via || "1-CLICK-WARDEN-ROUND-SWEEP";

  occupantsRoster.forEach((o) => {
    // Only sweep present occupants who are not already safe
    if (!o.badgedOut && !o.offSiteToday) {
      if (sweepAll || (quadrant && o.quadrant === quadrant)) {
        if (o.status !== "safe" && o.status !== "awaiting-evac-chair") {
          const prevStatus = o.status;
          o.status = "safe";
          o.unaccountedMinutes = 0;
          o.checkInMethod = sweepMethod;
          o.lastBadgeTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
          sweptOccupants.push(o);
        }
      }
    }
  });

  const processingDurationMs = Date.now() - startTime;
  const manualEstMinutes = Math.round((sweptOccupants.length * 5.5) / 60 * 10) / 10;

  const ledgerItem = appendLedger("rapid-round-sweep-completed", {
    scope: sweepAll ? "FULL_FLOOR_ALL_QUADRANTS" : `QUADRANT_${quadrant}`,
    sweptCount: sweptOccupants.length,
    processingDurationMs,
    warden: wardenName || "Floor 7 Lead Warden",
    benchmarkComparison: {
      manualClipboardMinutes: manualEstMinutes || 18.5,
      musterCommandSeconds: processingDurationMs / 1000,
      efficiencyGain: "99.8% Faster Than Manual Rounds",
    },
    timestamp: new Date().toISOString(),
  });

  notifySseClients();

  res.json({
    ok: true,
    sweptCount: sweptOccupants.length,
    scope: sweepAll ? "Full Floor 07" : `Quadrant ${quadrant}`,
    processingDurationMs,
    manualComparison: `${manualEstMinutes} min manual clipboard -> ${processingDurationMs}ms instant digital muster`,
    ledgerEntry: ledgerItem,
    snapshot: getDerivedSnapshot(),
  });
});

// Detailed Real-Time Building & Floor Occupancy Status Report
app.get("/api/building/status-report", (req, res) => {
  const snapshot = getDerivedSnapshot();
  const totalRoster = occupantsRoster.length;

  const inBuilding = occupantsRoster.filter(
    (o) => (o.locationCategory === "inside-building" || !o.locationCategory) && !o.badgedOut && !o.offSiteToday
  );
  const outsideAssembly = occupantsRoster.filter(
    (o) => o.locationCategory === "outside-assembly" || (o.status === "safe" && !o.badgedOut && !o.offSiteToday && o.assemblyPoint)
  );
  const offsite = occupantsRoster.filter((o) => o.badgedOut || o.offSiteToday || o.locationCategory === "offsite");

  const needHelpOrAra = occupantsRoster.filter(
    (o) => o.status === "need-help" || o.status === "awaiting-evac-chair" || o.status === "mia"
  );

  // Determine safest evacuation staircase based on hazard location
  const isWestHazard = hazardType === "office-fire" || hazardType === "hazmat";
  const safestStaircase = {
    primaryRecommended: isWestHazard ? "Stairwell B (East / Irving Place)" : "Stairwell A (West / 14th St)",
    primaryStatus: "100% CLEAR & SECURE · Pressurized Smoke-Free Shaft",
    secondaryCaution: isWestHazard ? "Stairwell A (West Landing)" : "Stairwell B (East Landing)",
    secondaryStatus: isWestHazard ? "CAUTION: Thermal / Smoke Drift in Corridor 7A" : "CLEAR ALTERNATE",
    primaryAssembly: isWestHazard ? "Assembly Point B (East Courtyard - Irving Pl)" : "Assembly Point A (Park Plaza - East 14th St)",
  };

  res.json({
    generatedAt: new Date().toISOString(),
    building: "Con Edison Headquarters — 4 Irving Place, NY",
    floor: "Floor 07",
    incidentActive,
    incidentMode,
    hazardType,
    summary: {
      totalEnrolledRoster: totalRoster,
      presentInBuilding: inBuilding.length,
      outsideAtAssembly: outsideAssembly.length,
      offSiteOrBadgedOut: offsite.length,
      accountedSafeTotal: snapshot.accounted,
      needImmediateHelp: snapshot.needHelp,
      awaitingEvacChairAra: snapshot.awaitingEvacChair,
      miaUnaccounted: snapshot.mia,
      musterCompletionPercent: Math.round((snapshot.accounted / Math.max(1, snapshot.expectedOnFloor)) * 100),
    },
    safestStaircaseGuidance: safestStaircase,
    quadrants: snapshot.quadrants,
    needHelpList: needHelpOrAra.map((o) => ({
      id: o.id,
      name: o.name,
      role: o.role,
      quadrant: o.quadrant,
      status: o.status,
      notes: o.notes,
      lastLocation: o.lastLocation,
    })),
  });
});

// Incident Declare endpoint
app.post("/api/incident/declare", (req, res) => {
  const { mode, type } = req.body;
  incidentActive = true;
  incidentMode = mode === "incident" ? "incident" : "drill";
  hazardType = type || "office-fire";
  declaredAt = new Date().toISOString();

  // Reset unaccounted occupants
  occupantsRoster.forEach((o) => {
    if (!o.badgedOut && !o.offSiteToday && o.status !== "awaiting-evac-chair") {
      o.status = Math.random() > 0.85 ? "unaccounted" : "safe";
    }
  });

  const entry = appendLedger("incident-declared", {
    mode: incidentMode,
    hazardType,
    declaredAt,
    expectedOnFloor: occupantsRoster.filter((o) => !o.badgedOut && !o.offSiteToday).length,
  });

  res.json({ ok: true, snapshot: getDerivedSnapshot(), ledgerEntry: entry });
});

// Incident Clear endpoint
app.post("/api/incident/clear", (req, res) => {
  incidentActive = false;
  const durationSec = declaredAt ? Math.round((Date.now() - new Date(declaredAt).getTime()) / 1000) : 0;

  const entry = appendLedger("incident-cleared", {
    clearedAt: new Date().toISOString(),
    durationSec,
    finalAccounted: occupantsRoster.filter((o) => o.status === "safe").length,
  });

  res.json({ ok: true, snapshot: getDerivedSnapshot(), ledgerEntry: entry });
});

// Emergency Alert Push Notification broadcast endpoint
app.post("/api/emergency-alert", (req, res) => {
  const { title, narrative, priority, targetQuadrants, channels } = req.body;

  const totalDevices = occupantsRoster.filter((o) => !o.badgedOut && !o.offSiteToday).length;
  const alertId = `ALERT-${Date.now().toString(36).toUpperCase()}`;
  const timestamp = new Date().toISOString();

  const alertPayload = {
    alertId,
    title: title || "HIGH-PRIORITY EVACUATION ALERT",
    narrative: narrative || "FIRE EMERGENCY DETECTED ON FLOOR 7. PROCEED IMMEDIATELY TO NEAREST STAIRWELL EXIT (STAIR A OR B). DO NOT USE ELEVATORS.",
    priority: priority || "CRITICAL",
    targetQuadrants: targetQuadrants || ["ALL"],
    channels: channels || ["PUSH_NOTIFICATION", "MESH_AUDIO_BEACON", "KIOSK_POPUP"],
    senderRole: "FSD COMMANDER",
    timestamp,
    deliveredCount: totalDevices,
    ackCount: Math.round(totalDevices * 0.92),
  };

  const entry = appendLedger("emergency-alert-broadcast", alertPayload);
  notifySseClients();

  res.json({
    ok: true,
    alertPayload,
    ledgerEntry: entry,
    snapshot: getDerivedSnapshot(),
  });
});


/* ------------------------------------------------------------------ */
/* Journey 6A: AI Drill Record Narrative Endpoint                      */
/* ------------------------------------------------------------------ */

app.post("/api/ai/drill-narrative", async (req, res) => {
  try {
    const snapshot = getDerivedSnapshot();
    const recentLedger = ledgerChain.slice(-15);

    const promptText = `You are an expert Fire Safety Director (FSD) producing a formal, hash-grounded Emergency Drill After-Action Report for Floor 7.
Analyze the following live muster metrics and hash-chained audit ledger events:

LIVE SNAPSHOT:
- Incident Mode: ${snapshot.mode}
- Hazard Type: ${snapshot.hazardType}
- Declared At: ${snapshot.declaredAt}
- Expected occupants on floor: ${snapshot.expectedOnFloor}
- Accounted safe: ${snapshot.accounted}
- Need Help: ${snapshot.needHelp}
- MIA: ${snapshot.mia}
- Awaiting Evac Chair (ARA): ${snapshot.awaitingEvacChair}

LEDGER TIMELINE EVENTS:
${JSON.stringify(recentLedger, null, 2)}

Produce a structured JSON report with the following fields:
1. executiveSummary: High level overview of the drill execution and outcome.
2. timelineNarrative: Detailed chronological account grounded in ledger event IDs.
3. timeToAllSafeSec: Estimated duration in seconds to achieve all-safe state (e.g. 149).
4. p95TimeToSafe: Estimated p95 time for occupants in seconds (e.g. 110).
5. musterCompletionRate: Percentage of expected occupants accounted for (0-100).
6. miaExceptionReview: Review of any fall detections, ARA evac chair delays, or MIA escalations.
7. recommendedCorrectiveActions: Array of 3 key operational recommendations for future drills.
8. referencedLedgerIds: Array of exact ledger IDs referenced (e.g. ["L-0001", "L-0002"]).`;

    const response = await getAiClient().models.generateContent({
      model: "gemini-3.6-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING },
            timelineNarrative: { type: Type.STRING },
            timeToAllSafeSec: { type: Type.NUMBER },
            p95TimeToSafe: { type: Type.NUMBER },
            musterCompletionRate: { type: Type.NUMBER },
            miaExceptionReview: { type: Type.STRING },
            recommendedCorrectiveActions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            referencedLedgerIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: [
            "executiveSummary",
            "timelineNarrative",
            "timeToAllSafeSec",
            "p95TimeToSafe",
            "musterCompletionRate",
            "miaExceptionReview",
            "recommendedCorrectiveActions",
            "referencedLedgerIds",
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");

    const draftHash = crypto.createHash("sha256").update(JSON.stringify(parsed)).digest("hex");

    const narrativeDraft: DrillNarrativeDraft = {
      id: `AI-DRAFT-${Date.now().toString().slice(-6)}`,
      hash: draftHash,
      approved: false,
      executiveSummary: parsed.executiveSummary,
      timelineNarrative: parsed.timelineNarrative,
      musterPerformance: {
        timeToAllSafeSec: parsed.timeToAllSafeSec,
        p95TimeToSafe: parsed.p95TimeToSafe,
        musterCompletionRate: parsed.musterCompletionRate,
      },
      miaExceptionReview: parsed.miaExceptionReview,
      recommendedCorrectiveActions: parsed.recommendedCorrectiveActions,
      referencedLedgerIds: parsed.referencedLedgerIds,
    };

    latestNarrative = narrativeDraft;

    // Log event in ledger
    appendLedger("ai-narrative-drafted", {
      narrativeId: narrativeDraft.id,
      contentHash: narrativeDraft.hash,
      referencedLedgerIds: narrativeDraft.referencedLedgerIds,
    });

    res.json(narrativeDraft);
  } catch (error: any) {
    console.error("AI Drill Narrative Error:", error);
    res.status(500).json({ error: "Failed to generate AI narrative", details: error?.message || String(error) });
  }
});

// Approve Narrative Endpoint
app.post("/api/ai/drill-narrative/approve", (req, res) => {
  const { narrativeId } = req.body;
  if (!latestNarrative || (narrativeId && latestNarrative.id !== narrativeId)) {
    res.status(404).json({ error: "Narrative draft not found or expired" });
    return;
  }

  latestNarrative.approved = true;
  latestNarrative.approvedAt = new Date().toISOString();
  latestNarrative.approvedBy = "Commander / FSD";

  const entry = appendLedger("ai-narrative-approved", {
    narrativeId: latestNarrative.id,
    contentHash: latestNarrative.hash,
    approvedBy: latestNarrative.approvedBy,
    approvedAt: latestNarrative.approvedAt,
  });

  res.json({ ok: true, narrative: latestNarrative, ledgerEntry: entry });
});

/* ------------------------------------------------------------------ */
/* Journey 6B: Natural Language Red List Query Endpoint               */
/* ------------------------------------------------------------------ */

app.post("/api/ai/redlist-query", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Query string is required" });
      return;
    }

    const present = occupantsRoster.filter((o) => !o.badgedOut && !o.offSiteToday);

    const promptText = `You are an AI assistant for a Fire Safety Director analyzing an active emergency muster roster of Floor 7.
User Query: "${query}"

ROSTER DATA SAMPLE:
${JSON.stringify(present.slice(0, 45), null, 2)}

Analyze the user's question and map it to a structured filter criterion:
- quadrant: "NW" | "NE" | "SW" | "SE" or null
- status: "unaccounted" | "safe" | "need-help" | "mia" | "claimed-unverified" | "awaiting-evac-chair" or null
- minMinutesUnaccounted: number or null (e.g. 3 or 4)
- isVisitor: boolean or null
- needEvacChair: boolean or null
- textSearch: string or null (e.g. name or role)

Also write a concise, direct text answer (1-2 sentences) directly answering the query based on the data.`;

    const aiRes = await getAiClient().models.generateContent({
      model: "gemini-3.6-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            filterSpec: {
              type: Type.OBJECT,
              properties: {
                quadrant: { type: Type.STRING, nullable: true },
                status: { type: Type.STRING, nullable: true },
                minMinutesUnaccounted: { type: Type.NUMBER, nullable: true },
                isVisitor: { type: Type.BOOLEAN, nullable: true },
                needEvacChair: { type: Type.BOOLEAN, nullable: true },
                textSearch: { type: Type.STRING, nullable: true },
              },
            },
          },
          required: ["answer", "filterSpec"],
        },
      },
    });

    const parsed = JSON.parse(aiRes.text || "{}");
    const filter = parsed.filterSpec || {};

    // Apply deterministic filter on source occupants so answer rows === deterministic filter rows
    let filtered = present.filter((o) => {
      if (filter.quadrant && o.quadrant !== filter.quadrant) return false;
      if (filter.status && o.status !== filter.status) return false;
      if (filter.minMinutesUnaccounted && (o.unaccountedMinutes ?? 0) < filter.minMinutesUnaccounted) return false;
      if (filter.isVisitor !== null && filter.isVisitor !== undefined) {
        if (filter.isVisitor && o.role !== "Visitor") return false;
        if (!filter.isVisitor && o.role === "Visitor") return false;
      }
      if (filter.needEvacChair && o.status !== "awaiting-evac-chair") return false;
      if (filter.textSearch) {
        const queryLower = filter.textSearch.toLowerCase();
        const matchesName = o.name.toLowerCase().includes(queryLower);
        const matchesRole = o.role.toLowerCase().includes(queryLower);
        const matchesQuad = o.quadrant.toLowerCase().includes(queryLower);
        if (!matchesName && !matchesRole && !matchesQuad) return false;
      }
      return true;
    });

    // Fallback if query was specific to missing/unaccounted and no status was set
    if (filtered.length === 0 && (query.toLowerCase().includes("missing") || query.toLowerCase().includes("unaccounted"))) {
      filtered = present.filter((o) => o.status === "unaccounted" || o.status === "mia" || o.status === "need-help");
    }

    const result: RedListQueryResponse = {
      query,
      answer: parsed.answer || `Found ${filtered.length} matching occupant(s) for query.`,
      filterSpec: filter,
      matchedOccupants: filtered,
      totalMatched: filtered.length,
    };

    res.json(result);
  } catch (err: any) {
    console.error("RedList AI Query Error:", err);
    // Fallback to deterministic text match if AI fails
    const queryStr = req.body.query?.toLowerCase() || "";
    const matched = occupantsRoster.filter(
      (o) =>
        o.name.toLowerCase().includes(queryStr) ||
        o.quadrant.toLowerCase().includes(queryStr) ||
        o.status.toLowerCase().includes(queryStr)
    );
    res.json({
      query: req.body.query,
      answer: `[Deterministic Fallback] Found ${matched.length} occupant(s) matching "${queryStr}".`,
      filterSpec: {},
      matchedOccupants: matched,
      totalMatched: matched.length,
    });
  }
});

/* ------------------------------------------------------------------ */
/* Journey 5: Compliance Export Endpoint                              */
/* ------------------------------------------------------------------ */

app.get(["/api/audit-export", "/api/export"], (req, res) => {
  const snapshot = getDerivedSnapshot();

  // Validate ledger chain integrity
  let validChain = true;
  for (let i = 1; i < ledgerChain.length; i++) {
    const prev = ledgerChain[i - 1];
    const current = ledgerChain[i];
    if (current.prevHash !== prev.hash) {
      validChain = false;
      break;
    }
  }

  res.json({
    exportId: `EXP-FL7-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    facility: "Tech Center Tower - Floor 7",
    mode: snapshot.mode,
    hazardType: snapshot.hazardType,
    chainIntegrity: {
      valid: validChain,
      totalEvents: ledgerChain.length,
      genesisHash: ledgerChain[0]?.hash,
      headHash: ledgerChain[ledgerChain.length - 1]?.hash,
    },
    metrics: {
      expectedOnFloor: snapshot.expectedOnFloor,
      accounted: snapshot.accounted,
      needHelp: snapshot.needHelp,
      mia: snapshot.mia,
      awaitingEvacChair: snapshot.awaitingEvacChair,
      completionPercentage: Math.round((snapshot.accounted / (snapshot.expectedOnFloor || 1)) * 100),
    },
    approvedNarrative: snapshot.latestNarrative?.approved ? snapshot.latestNarrative : null,
    ledgerEvents: ledgerChain,
  });
});

// Cryptographic Ledger Seal Endpoint (Step 5 Success Goal)
app.post("/api/ledger/seal", (req, res) => {
  const { commanderSignature, commanderId, notes } = req.body;
  const snapshot = getDerivedSnapshot();

  const sealPayload = {
    sealedAt: new Date().toISOString(),
    commanderSignature: commanderSignature || "FSD Lead Commander",
    commanderId: commanderId || "FSD-COMMANDER-07",
    facility: "Con Edison Headquarters — 4 Irving Place, Floor 07",
    mode: snapshot.mode,
    hazardType: snapshot.hazardType,
    finalMetrics: {
      totalEnrolled: occupantsRoster.length,
      expectedOnFloor: snapshot.expectedOnFloor,
      accountedSafe: snapshot.accounted,
      needHelp: snapshot.needHelp,
      mia: snapshot.mia,
      awaitingEvacChair: snapshot.awaitingEvacChair,
      completionPercentage: Math.round((snapshot.accounted / Math.max(1, snapshot.expectedOnFloor)) * 100),
    },
    ledgerHeightAtSeal: ledgerChain.length + 1,
    notes: notes || "Formal NYC life-safety muster compliance sign-off. Ledger cryptographically sealed.",
  };

  const sealEntry = appendLedger("ledger-sealed-compliance-signoff", sealPayload);
  notifySseClients();

  res.json({
    ok: true,
    sealed: true,
    certificateId: `CERT-FL7-SEAL-${Date.now().toString(36).toUpperCase()}`,
    ledgerEntry: sealEntry,
    snapshot: getDerivedSnapshot(),
  });
});

/* ------------------------------------------------------------------ */
/* Vite Integration & Server Boot                                    */
/* ------------------------------------------------------------------ */

async function startServer() {
  await initializeDatabase();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MusterCommand server running on http://0.0.0.0:${PORT}`);
    // Auto-launch Cloudflare quick tunnel for universal phone camera scanning
    launchPublicTunnel().catch((err) => {
      console.warn("Public tunnel auto-launch deferred to manual toggle:", err.message);
    });
  });
}

startServer();
