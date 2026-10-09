# Con Edison Floor 07 · MusterCommand Platform
## Complete Technical Architecture & AI Life-Safety Specification

---

## 1. System Overview & Architectural Topology

The **MusterCommand Platform** is an enterprise, high-availability life-safety operating system deployed at Con Edison Headquarters (4 Irving Place, New York, NY · Floor 07). It unifies real-time physical badge ingress, mobile occupant self-reporting, automated emergency broadcast dispatch, and FDNY regulatory compliance into a reactive, deterministic, 5-step operational workflow.

```
                         ┌────────────────────────────────────────────────────────┐
                         │              CLIENT LAYER (REACT 19 + VITE)            │
                         │                                                        │
                         │  ┌────────────────────┐      ┌──────────────────────┐  │
                         │  │   Commander Deck   │      │   Occupant Portal    │  │
                         │  │ (FSD Command View) │      │ (Mobile Self-Report) │  │
                         │  └─────────┬──────────┘      └──────────┬───────────┘  │
                         └────────────┼────────────────────────────┼──────────────┘
                                      │ REST / SSE                 │ REST / SSE
                                      ▼                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      SERVER LAYER (EXPRESS + TYPESCRIPT RUNTIME)                │
│                                                                                 │
│   ┌────────────────────────┐  ┌───────────────────────┐  ┌──────────────────┐   │
│   │  Ingress & Badge API   │  │ Multi-Channel Alerts  │  │ Walkie-Talkie Ch │   │
│   └───────────┬────────────┘  └───────────┬───────────┘  └────────┬─────────┘   │
│               │                           │                       │             │
│               ▼                           ▼                       ▼             │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                      IN-MEMORY LIFE-SAFETY STATE ENGINE                 │   │
│   │     • occupantsRoster[]   • activeIncidentState   • presenceLedger[]    │   │
│   └──────────────────────┬───────────────────────────────┬──────────────────┘   │
│                          │                               │                      │
│                          ▼                               ▼                      │
│   ┌──────────────────────────────┐              ┌───────────────────────────┐   │
│   │     GEMINI GENAI ENGINE      │              │   SHA-256 AUDIT LEDGER    │   │
│   │ • Mathematical Grounding     │              │ • Immutable Block Hashing │   │
│   │ • Deterministic Fallback     │              │ • 3 RCNY §401-01 Proof    │   │
│   └──────────────────────────────┘              └───────────────────────────┘   │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DUAL PERSISTENCE STORAGE LAYER                        │
│                                                                                 │
│      ┌───────────────────────────────────┐    ┌─────────────────────────────┐   │
│      │ Primary Local JSON Store          │    │ Optional Enterprise RDBMS   │   │
│      │ `data/fsd_roster.json`            │    │ PostgreSQL Connection Pool  │   │
│      └───────────────────────────────────┘    └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Full Technical Stack Specifications

| Layer | Technologies | Purpose |
| :--- | :--- | :--- |
| **Frontend Runtime** | React 19, TypeScript, Vite 6 | High-speed single-page reactive application with instant HMR and optimized production bundles. |
| **Styling & Design System** | Tailwind CSS v4, Lucide React | Con Edison Corporate Navy (`#005DAA`), NYC Amber (`#D97706`), Dark Slate (`#0B192C`), high-contrast emergency banners. |
| **Media & Audio** | HTML5 Web Audio API, Canvas 2D | In-browser synthesizer for evacuation sirens, radio chimes, PTT walkie-talkie audio buffers, and digital signature capture. |
| **Backend Runtime** | Node.js 23+, Express 4, TypeScript (`tsx`) | Low-latency HTTP/1.1 REST server, Server-Sent Events (SSE) broadcaster, and network orchestrator. |
| **Live Synchronization** | Server-Sent Events (SSE) (`/api/stream`) | Unidirectional, push-based reactive state streaming from server to all connected client consoles in <15ms. |
| **Artificial Intelligence** | Google GenAI SDK (`@google/genai`), Gemini 2.5 Flash | Real-time Red List natural language querying and automated FDNY drill narrative generation. |
| **Security & Auditing** | Node.js `crypto` (SHA-256) | Cryptographic block generation, linking previous block hashes into a tamper-evident audit ledger. |
| **Cellular Tunneling** | Cloudflare Tunnel (`cloudflared`) / `localtunnel` | Automatic reverse proxy exposing the local port to public internet for mobile smartphone ingress. |
| **Persistence** | Dual-Layer: `fs` JSON Disk Store + `pg` PostgreSQL Pool | Ensures zero-data-loss across server restarts and provides enterprise database scalability. |

---

## 3. How the AI Works: Deterministic Grounding & Architecture

### 3.1 The Life-Safety Challenge: Zero Tolerance for Hallucinations
In emergency management, generative AI cannot be allowed to make assumptions, extrapolate unverified headcounts, or invent occupant names. A single hallucinated number can divert rescue teams away from actual trapped personnel.

To eliminate this risk, **MusterCommand implements a Strictly Mathematically Grounded AI Pipeline**.

### 3.2 AI Initialization & Lifecycle
The AI client is lazily instantiated via `@google/genai`:
```typescript
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    aiClient = new GoogleGenAI({
      apiKey: key || "AI_STUDIO_PLACEHOLDER_KEY",
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
  }
  return aiClient;
}
```

### 3.3 Prompt Grounding with Live In-Memory Snapshot Injection
Whenever an AI request is initiated (such as `/api/narrative/draft` or `/api/red-list/query`), the system captures the exact, instantaneous snapshot of the building state:
- Exact total occupants on the floor (`expectedOnFloor`)
- Verified safe occupants (`accounted`)
- Unaccounted occupants (`unaccounted`)
- Missing personnel (`mia`)
- Mobility-impaired / wheelchair chair requests (`awaitingEvacChair`)
- Quadrant-by-quadrant breakdown (`NW`, `NE`, `SW`, `SE`)
- Complete list of active occupant names, roles, and status flags

This JSON snapshot is injected directly into the Gemini system instructions:

```typescript
const prompt = `You are the official Con Edison Life-Safety AI Assistant.
Analyze this exact real-time evacuation snapshot for Floor 07:
${JSON.stringify(snapshot, null, 2)}

STRICT OPERATIONAL RULES:
1. Every single number in your summary MUST match the numbers in the snapshot.
2. DO NOT invent occupants, do not round numbers, and do not assume missing individuals.
3. Compute the exact muster completion rate: (accounted / expectedOnFloor) * 100.
4. Output strictly structured JSON conforming to the requested schema.`;
```

### 3.4 Structured Output Enforcement (`responseSchema`)
The AI generation call enforces strict schema typing via Gemini's native structured JSON mode:
```typescript
const response = await ai.models.generateContent({
  model: "gemini-2.5-flash",
  contents: prompt,
  config: {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        executiveSummary: { type: Type.STRING },
        timelineNarrative: { type: Type.STRING },
        musterPerformance: {
          type: Type.OBJECT,
          properties: {
            timeToAllSafeSec: { type: Type.INTEGER },
            p95TimeToSafe: { type: Type.INTEGER },
            musterCompletionRate: { type: Type.INTEGER },
          },
          required: ["timeToAllSafeSec", "p95TimeToSafe", "musterCompletionRate"],
        },
        miaExceptionReview: { type: Type.STRING },
      },
      required: ["executiveSummary", "timelineNarrative", "musterPerformance", "miaExceptionReview"],
    },
  },
});
```

### 3.5 Deterministic Local Fallback Engine (100% Offline Survivability)
If the building loses external internet connectivity, if the Gemini API rate limit is exceeded, or if the `GEMINI_API_KEY` is not configured, the platform **never fails**. 

A local, deterministic rule engine executes immediately:
- It calculates:
  $$\text{Completion Rate} = \left(\frac{\text{Accounted}}{\text{Expected On Floor}}\right) \times 100$$
- It formats exact quadrant tallies and time-to-safe metrics.
- It hashes the generated narrative draft with SHA-256 for cryptographic ledger insertion.
- Return latency: **< 2 milliseconds**.

---

## 4. Real-Time Persistence Layer

### 4.1 Local Disk Storage (`data/fsd_roster.json`)
The application maintains persistent state in `data/fsd_roster.json`.
- **On Boot:** `loadPersistedRoster()` reads `data/fsd_roster.json`. If clean, it initializes `[]`.
- **On Ingress/Check-In:** When an employee registers or badges in/out, `notifySseClients()` invokes `savePersistedRoster(occupantsRoster)`, atomically writing the serialized array to disk.
- **On Database Clean:** `cleanDatabase()` resets `occupantsRoster = []`, writes `[]` to disk, and resets the SHA-256 ledger to Genesis block `L-0001`.

### 4.2 Dual-Layer PostgreSQL Support (`serverDb.ts`)
If a `DATABASE_URL` environment variable is detected, the server automatically connects to PostgreSQL:
- Creates tables `muster_occupants`, `muster_events`, and `muster_ledger` with automated indexes.
- Runs parallel write operations, ensuring both local fast file caching and relational SQL replication.

---

## 5. Cryptographic SHA-256 Tamper-Evident Ledger

To satisfy **FDNY Rule 3 RCNY §401-01** and **NYC Fire Code FC 401.7**, every life-safety event must be legally provable. MusterCommand utilizes a linked-list cryptographic ledger:

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│          BLOCK L-0001           │       │          BLOCK L-0002           │
│  prevHash: 000000000000000...   │◄──────┤  prevHash: 2863ee524f28cb5...   │
│  type: "genesis-init"           │       │  type: "qr-occupant-presence"   │
│  timestamp: 2026-10-08T22:32... │       │  timestamp: 2026-10-08T22:32... │
│  payload: { readyForIntake }    │       │  payload: { name: "Alex..." }   │
│  hash: 2863ee524f28cb5...       │       │  hash: c4a62c00f6c7be2...       │
└─────────────────────────────────┘       └─────────────────────────────────┘
```

### Hash Computation Formula
$$\text{Hash}_n = \text{SHA256}\left(\text{ID}_n + \text{PrevHash}_{n-1} + \text{Type}_n + \text{Timestamp}_n + \text{JSON}(\text{Payload}_n)\right)$$

If any record is modified post-event, all subsequent hashes in the chain break, providing verifiable proof of data integrity.

---

## 6. Multi-Channel Emergency Alert Dispatch Pipeline

When the FSD Commander triggers an alert in Step 4, the broadcast pipeline dispatches the payload across four parallel vectors:

1. **Cellular SMS Simulation Gateway:**
   - Targets all intaken occupants with valid cellular numbers.
   - Formats phone numbers into E.164 international standard (`+1-212-555-0177`).
   - Dispatches simulated carrier delivery receipts (`DELIVERED`) with microsecond timestamps.
2. **Web Push Notification Engine:**
   - Broadcasts JSON alert notifications to registered service worker clients.
3. **In-Browser Web Audio Synthesizer:**
   - Utilizes `AudioContext` with `OscillatorNode` to generate standard NYC high-rise evacuation two-tone siren sweeps (880 Hz / 440 Hz) and radio burst squelches.
4. **Digital Signage Override Webhooks:**
   - Posts emergency directives to elevator bank kiosks and conference room displays.

---

## 7. Network Architecture & Resilience

### 7.1 Triple-Redundancy Network Hierarchy
1. **Primary On-Premise LAN:** Binds to `0.0.0.0:3000`. Detects all local IP interfaces via `os.networkInterfaces()` for direct tablet access across building subnets (`192.168.x.x` / `10.x.x.x`).
2. **Automated Cloudflare Cellular Pathway:** Spawns a managed `cloudflared` tunnel process. Exposes a public HTTPS endpoint (`https://*.trycloudflare.com`) for smartphone camera QR scanning outside the corporate intranet.
3. **Self-Healing Watchdog:** Pings the public tunnel every 15 seconds. If unreachable across 3 consecutive checks, it automatically tears down the process and provisions a fresh secure tunnel.
4. **Localtunnel Secondary Fallback:** If Cloudflare is blocked by firewall rules, the system fails over to `localtunnel` (`*.loca.lt`).

---

## 8. Summary of API Endpoints

| Endpoint | Method | Function |
| :--- | :--- | :--- |
| `/api/database/status` | `GET` | Returns database health, clean state, occupant count, ledger height, and Postgres status. |
| `/api/database/clean` | `POST` | Wipes mock data, empties disk store, re-mints Genesis block, returns `{ readyForIntake: true }`. |
| `/api/occupant/sign-in-register` | `POST` | Self-service & manual intake; registers name, phone, quadrant, desk, role, and coordinates. |
| `/api/occupant/presence` | `POST` | Toggles in-building vs. left-building presence without deleting historical enrollment. |
| `/api/roster/import` | `POST` | Batch imports multi-line CSV/tab lists into the active floor database. |
| `/api/emergency-alert` | `POST` | Dispatches multi-channel emergency alert to all enrolled personnel and appends to ledger. |
| `/api/drill/broadcast` | `POST` | Alias for emergency alert broadcast targeting all intaken occupants. |
| `/api/narrative/draft` | `POST` | Generates mathematically grounded AI post-drill narrative draft via Gemini 2.5 Flash. |
| `/api/ledger/seal` | `POST` | Cryptographically seals the drill ledger and mints the official FDNY certificate. |
| `/api/stream` | `GET` | Server-Sent Events (SSE) real-time reactive state stream. |
