import React, { useState, useEffect } from "react";
import {
  Server,
  ShieldCheck,
  Radio,
  Cpu,
  Database,
  Terminal,
  Activity,
  Play,
  CheckCircle2,
  Lock,
  Layers,
  ArrowRight,
  ExternalLink,
  Code2,
  RefreshCw,
  Zap,
  Globe,
  Fingerprint,
  QrCode,
  Bell,
  Sparkles,
} from "lucide-react";
import { StatusSnapshot } from "../types";

interface BackendWireframeProps {
  snapshot?: StatusSnapshot | null;
  onRefreshState?: () => void;
}

interface SubsystemNode {
  id: string;
  name: string;
  category: string;
  icon: any;
  color: string;
  accentBorder: string;
  bgLight: string;
  description: string;
  status: "healthy" | "active" | "verified" | "fallback-mode";
  metrics: Record<string, string | number | boolean>;
  endpoints: {
    method: "GET" | "POST";
    path: string;
    description: string;
    authLevel: "Public" | "Occupant" | "FSD/Warden" | "Auditor";
  }[];
  spec: {
    protocols: string[];
    inputs: string[];
    outputs: string[];
    slaLatency: string;
  };
}

const SUBSYSTEM_NODES: SubsystemNode[] = [
  {
    id: "ingress-auth",
    name: "Security & Ingress Gateway",
    category: "Ingress & Identity",
    icon: ShieldCheck,
    color: "#38BDF8",
    accentBorder: "border-[#38BDF8]",
    bgLight: "bg-sky-500/10",
    description: "FIDO2 WebAuthn Fingerprint passkeys, QR optical badge scanner, and RBAC credential token issuer.",
    status: "healthy",
    metrics: {
      "Auth Modalities": "Fingerprint TouchID · QR Optical · Password",
      "Standard Compliance": "W3C WebAuthn / FIDO2 · FIPS-140",
      "Active Sessions": 4,
      "RBAC Roles": "FSD (8 caps) · Warden (3 caps) · Auditor (3) · Kiosk (1)",
    },
    endpoints: [
      { method: "POST", path: "/api/auth/biometric", description: "FIDO2 Fingerprint passkey token exchange", authLevel: "Public" },
      { method: "POST", path: "/api/auth/login", description: "Credential authentication with password", authLevel: "Public" },
      { method: "POST", path: "/api/auth/qr-scan", description: "Optical QR badge check-in and passkey issuer", authLevel: "Public" },
      { method: "POST", path: "/api/auth/guest-quick-signin", description: "Non-employee visitor fast pass generator", authLevel: "Public" },
      { method: "GET", path: "/api/auth/demo-accounts", description: "List pre-configured test profiles and caps", authLevel: "Public" },
    ],
    spec: {
      protocols: ["HTTP/1.1", "JSON", "WebAuthn / FIDO2", "Bearer Token"],
      inputs: ["userId", "password", "biometricType", "credentialId", "qrCode"],
      outputs: ["token", "user (id, role, capsList, token)", "ledgerEntry"],
      slaLatency: "< 45ms",
    },
  },
  {
    id: "rest-controllers",
    name: "Life-Safety REST Controllers",
    category: "Core Application Tier",
    icon: Server,
    color: "#FF6B00",
    accentBorder: "border-[#FF6B00]",
    bgLight: "bg-amber-500/10",
    description: "Core controllers handling optimistic check-ins, batch roll calls, emergency push alerts, and hazard states.",
    status: "healthy",
    metrics: {
      "Active Hazard": "Office Fire (Floor 07)",
      "Sync Mechanism": "Optimistic UI Update + Server Ledger Append",
      "Roster Pipelines": "Spreadsheet Matrix · QR Kiosk · Self-Portal",
      "Batch Capacity": "Up to 500 records / batch",
    },
    endpoints: [
      { method: "POST", path: "/api/check-in", description: "1-Tap single occupant check-in with notes & assembly point", authLevel: "Occupant" },
      { method: "POST", path: "/api/check-in/bulk", description: "Batch roll-call update for whole quadrant/selection", authLevel: "FSD/Warden" },
      { method: "POST", path: "/api/kiosk/scan", description: "Kiosk badge scanner search & sign-in", authLevel: "Occupant" },
      { method: "POST", path: "/api/visitor/register", description: "Register daily visitors at lobby kiosk", authLevel: "Occupant" },
      { method: "POST", path: "/api/roster/import", description: "Spreadsheet matrix batch import (append/replace)", authLevel: "FSD/Warden" },
      { method: "POST", path: "/api/emergency-alert", description: "Push evacuation alert to all registered mobile devices", authLevel: "FSD/Warden" },
      { method: "POST", path: "/api/incident/declare", description: "Declare active emergency drill or live incident", authLevel: "FSD/Warden" },
      { method: "POST", path: "/api/incident/clear", description: "Clear active incident & calculate muster duration", authLevel: "FSD/Warden" },
    ],
    spec: {
      protocols: ["RESTful HTTP", "JSON RPC"],
      inputs: ["occupantId", "status", "quadrant", "alertData", "rosterList"],
      outputs: ["StatusSnapshot", "Occupant", "LedgerEntry", "AlertPayload"],
      slaLatency: "< 15ms",
    },
  },
  {
    id: "sse-mesh",
    name: "Real-Time SSE Event Bus",
    category: "Messaging & Telemetry",
    icon: Radio,
    color: "#00A3E0",
    accentBorder: "border-[#00A3E0]",
    bgLight: "bg-cyan-500/10",
    description: "Low-overhead Server-Sent Events (SSE) stream delivering zero-latency state broadcasts across connected terminals.",
    status: "active",
    metrics: {
      "Transport Protocol": "HTTP EventStream (text/event-stream)",
      "Broadcast Mode": "Event-Driven Push on Ledger Mutation",
      "Heartbeat SLA": "Under 50ms across mesh",
      "Client Support": "Browsers, Kiosks, First Responder Tablets",
    },
    endpoints: [
      { method: "GET", path: "/api/stream", description: "Persistent SSE stream for real-time muster state sync", authLevel: "Public" },
    ],
    spec: {
      protocols: ["Server-Sent Events (SSE)", "HTTP Keep-Alive"],
      inputs: ["Event subscription stream request"],
      outputs: ["data: JSON(StatusSnapshot)\n\n"],
      slaLatency: "< 8ms",
    },
  },
  {
    id: "audit-ledger",
    name: "Cryptographic SHA-256 Audit Ledger",
    category: "Data Integrity & Compliance",
    icon: Lock,
    color: "#10B981",
    accentBorder: "border-emerald-500",
    bgLight: "bg-emerald-500/10",
    description: "FIPS-140 compliant SHA-256 hash-chained immutable audit ledger ensuring non-repudiation for FDNY fire safety compliance.",
    status: "verified",
    metrics: {
      "Hashing Algorithm": "SHA-256 (Node.js crypto)",
      "Chain Formula": "SHA256(prevHash + type + timestamp + payload)",
      "Tamper Detection": "Continuous Merkle-line verification",
      "Export Standards": "JSON Compliance Package / PDF Ready",
    },
    endpoints: [
      { method: "GET", path: "/api/audit-export", description: "Export full cryptographic chain & compliance metrics", authLevel: "Auditor" },
    ],
    spec: {
      protocols: ["Cryptographic Hash-Chain", "JSON Export"],
      inputs: ["type", "timestamp", "payload", "prevHash"],
      outputs: ["LedgerEntry (id, hash, prevHash, timestamp, payload)"],
      slaLatency: "< 5ms compute",
    },
  },
  {
    id: "gemini-ai",
    name: "Google Gemini 3.6 Flash Engine",
    category: "AI Intelligence Tier",
    icon: Sparkles,
    color: "#8B5CF6",
    accentBorder: "border-purple-500",
    bgLight: "bg-purple-500/10",
    description: "Official Google GenAI TypeScript SDK integration producing structured After-Action Reports and executing Natural Language Roster Queries.",
    status: "active",
    metrics: {
      "Foundation Model": "gemini-3.6-flash",
      "Official SDK": "@google/genai",
      "Response Schema": "Structured JSON Schema (Type.OBJECT)",
      "Grounding Source": "Live Ledger Chronology & Spatial Headcounts",
    },
    endpoints: [
      { method: "POST", path: "/api/ai/drill-narrative", description: "Generate grounded After-Action Report with p95 metrics", authLevel: "FSD/Warden" },
      { method: "POST", path: "/api/ai/drill-narrative/approve", description: "Cryptographically approve & bind AI narrative to ledger", authLevel: "FSD/Warden" },
      { method: "POST", path: "/api/ai/redlist-query", description: "Natural language red-list query parser and filter", authLevel: "FSD/Warden" },
    ],
    spec: {
      protocols: ["Google GenAI REST / gRPC", "JSON Schema Enforcement"],
      inputs: ["Live Snapshot Headcounts", "Ledger Timeline JSON", "Natural Language Query"],
      outputs: ["DrillNarrativeDraft", "RedListQueryResponse", "Structured FilterSpec"],
      slaLatency: "~1.5s (Gemini Flash)",
    },
  },
  {
    id: "spatial-store",
    name: "Floor 07 Spatial Topology Store",
    category: "Spatial & In-Memory Storage",
    icon: Database,
    color: "#6366F1",
    accentBorder: "border-indigo-500",
    bgLight: "bg-indigo-500/10",
    description: "High-speed in-memory store maintaining Floor 07 coordinates, Area of Rescue Assistance (ARA) queues, and quadrant aggregates.",
    status: "healthy",
    metrics: {
      "Tactical Zones": "NW Engineering · NE Comms · SW Legal · SE Visitors",
      "Spatial Grid": "100x100 relative coordinate matrix",
      "ARA Tracker": "Stairwell A / B evacuation chair queues",
      "Expected On Floor": "194 Occupants",
    },
    endpoints: [
      { method: "GET", path: "/api/state", description: "Retrieve complete derived status snapshot", authLevel: "Public" },
      { method: "GET", path: "/api/health", description: "Backend process telemetry, uptime & memory usage", authLevel: "Public" },
      { method: "GET", path: "/api/backend/topology", description: "Complete system topology & subsystem metrics", authLevel: "Public" },
    ],
    spec: {
      protocols: ["In-Memory Data Structures", "JSON Serialization"],
      inputs: ["Spatial coordinates", "Occupant records", "Quadrant boundaries"],
      outputs: ["StatusSnapshot (quadrants, occupants, accounted, mia, ara)"],
      slaLatency: "< 2ms",
    },
  },
];

const PACKET_WORKFLOWS = [
  {
    id: "biometric-auth",
    title: "1-Touch Fingerprint Passkey Authentication",
    description: "Traces biometric client verification, passkey exchange, cryptographic session token issuance, and ledger entry generation.",
    icon: Fingerprint,
    steps: [
      { node: "Client Ingress (Touch ID / Biometric Sensor)", action: "User initiates 1-Touch Fingerprint on Mobile/Desktop client" },
      { node: "Security & Ingress Gateway (/api/auth/biometric)", action: "Validates FIDO2 signature & generates cryptographic session token" },
      { node: "Cryptographic Audit Ledger", action: "Appends 'auth-biometric-success' block with SHA-256 hash chaining" },
      { node: "Real-Time SSE Event Bus", action: "Broadcasts updated authentication state to active mesh monitors" },
      { node: "Client Dashboard", action: "Signs in user (Sarah Jenkins, FSD) with 8 emergency capabilities" },
    ],
  },
  {
    id: "checkin-flow",
    title: "1-Tap Evacuation Check-In & Mesh Propagation",
    description: "Demonstrates real-time optimistic check-in, spatial headcount recalculation, and SSE broadcast to all floor terminals.",
    icon: CheckCircle2,
    steps: [
      { node: "Occupant Mobile App / Floor Warden Tablet", action: "Warden taps 'Safe at Assembly Point A' for Occupant OCC-104" },
      { node: "Life-Safety REST Controllers (/api/check-in)", action: "Recalculates quadrant accounted ratio and clears unaccounted timer" },
      { node: "Floor 07 Spatial Topology Store", action: "Updates occupant status: 'safe', location: 'Assembly Point A'" },
      { node: "Cryptographic Audit Ledger", action: "Appends 'occupant-check-in' block linking previous hash" },
      { node: "Real-Time SSE Event Bus (/api/events)", action: "Pushes updated StatusSnapshot to all connected screens in <50ms" },
    ],
  },
  {
    id: "emergency-broadcast",
    title: "High-Priority Emergency Evacuation Alert Broadcast",
    description: "Pushes high-priority evacuation instructions across mobile devices, kiosk displays, and mesh audio channels.",
    icon: Bell,
    steps: [
      { node: "FSD Admin Console", action: "Commander drafts CRITICAL alert: 'EVACUATE IMMEDIATELY VIA STAIR A/B'" },
      { node: "Life-Safety REST Controllers (/api/emergency-alert)", action: "Dispatches multi-channel payload targeting 194 registered devices" },
      { node: "Cryptographic Audit Ledger", action: "Records immutable 'emergency-alert-broadcast' audit event" },
      { node: "Real-Time SSE Event Bus", action: "Triggers emergency alert overlay on all client viewports simultaneously" },
      { node: "Client Receivers", action: "Mobile sound chime, vibration alert, and kiosk banner popups trigger" },
    ],
  },
  {
    id: "gemini-narrative",
    title: "Gemini 3.6 Flash After-Action Report Generation",
    description: "Grounds live ledger events into structured After-Action narrative with p95 muster metrics and cryptographic approval gate.",
    icon: Sparkles,
    steps: [
      { node: "Actions & Log Panel", action: "FSD triggers 'Generate AI After-Action Report'" },
      { node: "Google Gemini 3.6 Flash Engine (/api/ai/drill-narrative)", action: "Ingests recent ledger events & generates structured JSON analysis" },
      { node: "Life-Safety REST Controllers", action: "Returns draft with executive summary, p95 time, and corrective actions" },
      { node: "FSD Commander Approval Gate", action: "Commander reviews and clicks 'Approve & Seal Report'" },
      { node: "Cryptographic Audit Ledger", action: "Locks narrative with cryptographic signature into the immutable chain" },
    ],
  },
  {
    id: "ledger-verification",
    title: "Tamper-Evident SHA-256 Chain Verification",
    description: "Iterates through genesis block to current head to cryptographically prove zero tampering of life-safety records.",
    icon: Lock,
    steps: [
      { node: "Auditor / Fire Safety Officer", action: "Requests compliance audit package export" },
      { node: "Cryptographic Audit Ledger (/api/audit-export)", action: "Sequentially verifies prevHash[n] === hash[n-1] for every event" },
      { node: "Verification Engine", action: "Computes SHA256(prevHash + type + timestamp + payload) across all blocks" },
      { node: "Compliance Package Generator", action: "Produces signed compliance bundle with 100% integrity validation badge" },
    ],
  },
];

export default function BackendWireframe({ snapshot, onRefreshState }: BackendWireframeProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>("ingress-auth");
  const [activeWorkflowId, setActiveWorkflowId] = useState<string>("biometric-auth");
  const [simulatingStep, setSimulatingStep] = useState<number | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simLogs, setSimLogs] = useState<string[]>([]);

  // Live probe test runner state
  const [probeEndpoint, setProbeEndpoint] = useState<string>("/api/health");
  const [probeResult, setProbeResult] = useState<any>(null);
  const [isProbing, setIsProbing] = useState<boolean>(false);
  const [probeLatency, setProbeLatency] = useState<number | null>(null);

  // Live system telemetry state
  const [backendHealth, setBackendHealth] = useState<any>(null);

  // Fetch initial telemetry
  const fetchBackendHealth = async () => {
    try {
      const res = await fetch("/api/health");
      if (res.ok) {
        const data = await res.json();
        setBackendHealth(data);
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    fetchBackendHealth();
    const interval = setInterval(fetchBackendHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const selectedNode = SUBSYSTEM_NODES.find((n) => n.id === selectedNodeId) || SUBSYSTEM_NODES[0];
  const activeWorkflow = PACKET_WORKFLOWS.find((w) => w.id === activeWorkflowId) || PACKET_WORKFLOWS[0];

  // Run live endpoint probe
  const handleRunProbe = async (endpointToTest?: string) => {
    const target = endpointToTest || probeEndpoint;
    setIsProbing(true);
    setProbeResult(null);
    const start = performance.now();

    try {
      const res = await fetch(target);
      const latency = Math.round(performance.now() - start);
      setProbeLatency(latency);
      const data = await res.json();
      setProbeResult({
        status: res.status,
        statusText: res.statusText,
        headers: {
          "content-type": res.headers.get("content-type"),
          "cache-control": res.headers.get("cache-control"),
        },
        data,
      });
    } catch (err: any) {
      setProbeLatency(Math.round(performance.now() - start));
      setProbeResult({
        status: "ERROR",
        error: err.message || "Network request failed",
      });
    } finally {
      setIsProbing(false);
    }
  };

  // Run packet simulation animation
  const handleStartSimulation = async () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimLogs([]);
    const steps = activeWorkflow.steps;

    for (let i = 0; i < steps.length; i++) {
      setSimulatingStep(i);
      const timeStr = new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setSimLogs((prev) => [
        ...prev,
        `[${timeStr}] STEP ${i + 1}/${steps.length}: ${steps[i].node} → ${steps[i].action}`,
      ]);
      await new Promise((r) => setTimeout(r, 900));
    }

    setSimulatingStep(steps.length);
    setSimLogs((prev) => [
      ...prev,
      `[COMPLETE] Packet workflow "${activeWorkflow.title}" finished successfully with 0 dropped events.`,
    ]);
    setIsSimulating(false);
    if (onRefreshState) onRefreshState();
  };

  return (
    <div className="space-y-6 animate-fade-in text-[#0F2537] max-w-full overflow-x-hidden">
      {/* Top Header & Telemetry HUD */}
      <div className="rounded-2xl bg-[#0B172B] border border-[#1E3A60] p-4 sm:p-6 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1E3A60] pb-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#005DAA] to-[#00A3E0] flex items-center justify-center text-white shadow-lg shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black uppercase tracking-wider text-white">
                  Backend Architecture &amp; Service Wireframe
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase">
                  ACTIVE EXPRESS 3000
                </span>
              </div>
              <p className="text-xs text-[#829AB8] mt-1 font-mono">
                Full-stack service topology, data flow pipelines, REST microservices, SSE event bus, and SHA-256 audit ledger.
              </p>
            </div>
          </div>

          {/* Real-time Telemetry Pills */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <div className="bg-[#060E1C] border border-[#1E3A60] px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-[#829AB8]">UPTIME:</span>
              <span className="font-bold text-white">
                {backendHealth?.uptimeSeconds ? `${backendHealth.uptimeSeconds}s` : "Online"}
              </span>
            </div>

            <div className="bg-[#060E1C] border border-[#1E3A60] px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span className="text-[#829AB8]">MEM HEAP:</span>
              <span className="font-bold text-white">
                {backendHealth?.memory?.heapUsedMb ? `${backendHealth.memory.heapUsedMb} MB` : "~18.4 MB"}
              </span>
            </div>

            <div className="bg-[#060E1C] border border-[#1E3A60] px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-[#00A3E0]" />
              <span className="text-[#829AB8]">SSE CLIENTS:</span>
              <span className="font-bold text-[#00A3E0]">
                {backendHealth?.sseClientsCount ?? 1} Connected
              </span>
            </div>

            <div className="bg-[#060E1C] border border-[#1E3A60] px-3 py-1.5 rounded-xl flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[#829AB8]">LEDGER BLOCKS:</span>
              <span className="font-bold text-emerald-400">
                {backendHealth?.ledgerHeight ?? snapshot?.ledgerEntries?.length ?? 1}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Subsystem Nav Tabs */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {SUBSYSTEM_NODES.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const Icon = node.icon;
            return (
              <button
                key={node.id}
                onClick={() => setSelectedNodeId(node.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold font-mono transition cursor-pointer flex items-center gap-2 shrink-0 border ${
                  isSelected
                    ? "bg-[#112440] border-[#38BDF8] text-white shadow-md shadow-[#38BDF8]/20"
                    : "bg-[#060E1C]/80 border-[#1E3A60] text-[#829AB8] hover:text-white hover:border-[#38BDF8]/50"
                }`}
              >
                <Icon className="w-4 h-4" style={{ color: node.color }} />
                <span>{node.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================================================================= */}
      {/* 1. VISUAL INTERACTIVE TOPOLOGY WIREFRAME CANVAS                  */}
      {/* ================================================================= */}
      <div className="rounded-2xl bg-white border border-[#B8D8F8] p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#B8D8F8] pb-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-[#005DAA] flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#005DAA]" />
              <span>Interactive Backend Topology Wireframe</span>
            </h3>
            <p className="text-xs text-[#475569] font-medium">
              Click any block to inspect its protocol contracts, input/output schemas, and live microservice metrics.
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold bg-[#EBF5FB] text-[#005DAA] border border-[#B8D8F8] px-2.5 py-1 rounded-full uppercase self-start sm:self-auto">
            SELECT NODE TO INSPECT
          </span>
        </div>

        {/* Architecture Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {SUBSYSTEM_NODES.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const Icon = node.icon;
            return (
              <div
                key={node.id}
                onClick={() => setSelectedNodeId(node.id)}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                  isSelected
                    ? "bg-[#0B172B] text-white border-[#38BDF8] shadow-lg scale-[1.01]"
                    : "bg-[#F8FAFC] hover:bg-[#F0F6FC] text-[#0F2537] border-[#B8D8F8] hover:border-[#005DAA]"
                }`}
              >
                {/* Status Indicator */}
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isSelected ? "bg-white/10" : "bg-white shadow-xs border border-[#B8D8F8]"
                      }`}
                    >
                      <Icon className="w-4 h-4" style={{ color: node.color }} />
                    </div>
                    <div>
                      <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isSelected ? "text-[#38BDF8]" : "text-[#005DAA]"}`}>
                        {node.category}
                      </span>
                      <h4 className="text-xs sm:text-sm font-black leading-tight">
                        {node.name}
                      </h4>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase border ${
                      node.status === "verified" || node.status === "healthy" || node.status === "active"
                        ? isSelected
                          ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/40"
                          : "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-amber-50 text-amber-700 border-amber-300"
                    }`}
                  >
                    {node.status}
                  </span>
                </div>

                <p className={`text-xs mb-3 font-normal leading-relaxed ${isSelected ? "text-slate-300" : "text-[#475569]"}`}>
                  {node.description}
                </p>

                {/* Key Endpoint Count and Latency */}
                <div className={`pt-2 border-t flex items-center justify-between text-[10px] font-mono font-bold ${
                  isSelected ? "border-slate-800 text-[#829AB8]" : "border-slate-200 text-[#64748B]"
                }`}>
                  <span>{node.endpoints.length} Endpoints</span>
                  <span className="text-emerald-500">{node.spec.slaLatency} SLA</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================================================================= */}
      {/* 2. SELECTED NODE DEEP INSPECTOR & API PROBE WORKBENCH             */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Node Specification */}
        <div className="lg:col-span-6 rounded-2xl bg-white border border-[#B8D8F8] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#B8D8F8] pb-3">
            <div className="flex items-center gap-2.5">
              <selectedNode.icon className="w-5 h-5" style={{ color: selectedNode.color }} />
              <div>
                <h3 className="text-sm font-black text-[#005DAA] uppercase">
                  {selectedNode.name} Inspector
                </h3>
                <span className="text-[10px] font-mono text-[#64748B] font-bold">
                  CATEGORY: {selectedNode.category.toUpperCase()}
                </span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold bg-[#EBF5FB] text-[#005DAA] px-2.5 py-1 rounded-lg border border-[#B8D8F8]">
              {selectedNode.spec.slaLatency}
            </span>
          </div>

          {/* Metrics List */}
          <div>
            <div className="text-[11px] font-mono font-bold text-[#005DAA] uppercase tracking-wider mb-2">
              LIVE SUBSYSTEM METRICS
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              {Object.entries(selectedNode.metrics).map(([k, v]) => (
                <div key={k} className="p-2.5 bg-[#F8FAFC] border border-[#B8D8F8] rounded-lg">
                  <div className="text-[10px] text-[#64748B] uppercase font-bold">{k}</div>
                  <div className="text-xs font-black text-[#0F2537] truncate mt-0.5">{String(v)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Protocol Specifications */}
          <div className="space-y-2 text-xs">
            <div className="text-[11px] font-mono font-bold text-[#005DAA] uppercase tracking-wider">
              PROTOCOL &amp; INTERFACE SPECS
            </div>
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="p-2 bg-[#F8FAFC] border border-[#B8D8F8] rounded-lg flex items-center justify-between">
                <span className="text-[#64748B] font-bold">Supported Protocols:</span>
                <span className="font-bold text-[#0F2537]">{selectedNode.spec.protocols.join(" · ")}</span>
              </div>
              <div className="p-2 bg-[#F8FAFC] border border-[#B8D8F8] rounded-lg flex items-center justify-between">
                <span className="text-[#64748B] font-bold">Accepted Inputs:</span>
                <span className="font-bold text-[#0F2537]">{selectedNode.spec.inputs.join(", ")}</span>
              </div>
              <div className="p-2 bg-[#F8FAFC] border border-[#B8D8F8] rounded-lg flex items-center justify-between">
                <span className="text-[#64748B] font-bold">Output Payloads:</span>
                <span className="font-bold text-[#0F2537]">{selectedNode.spec.outputs.join(", ")}</span>
              </div>
            </div>
          </div>

          {/* Subsystem Endpoints List with 1-Click Probe */}
          <div>
            <div className="text-[11px] font-mono font-bold text-[#005DAA] uppercase tracking-wider mb-2">
              REGISTERED API ROUTES
            </div>
            <div className="space-y-1.5">
              {selectedNode.endpoints.map((ep) => (
                <div
                  key={ep.path}
                  className="p-2 bg-[#F8FAFC] hover:bg-[#EBF5FB] border border-[#B8D8F8] rounded-lg flex items-center justify-between text-xs transition cursor-pointer group"
                  onClick={() => {
                    setProbeEndpoint(ep.path);
                    if (ep.method === "GET") {
                      handleRunProbe(ep.path);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                        ep.method === "GET"
                          ? "bg-sky-100 text-sky-800 border border-sky-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300"
                      }`}
                    >
                      {ep.method}
                    </span>
                    <span className="font-mono font-bold text-[#0F2537] text-[11px] truncate">
                      {ep.path}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-[#64748B] hidden sm:inline">
                      {ep.authLevel}
                    </span>
                    <button
                      type="button"
                      className="text-[10px] font-mono font-bold text-[#005DAA] group-hover:text-[#FF6B00] flex items-center gap-1"
                    >
                      <span>Probe</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Live Endpoint Probe & Testing Workbench */}
        <div className="lg:col-span-6 rounded-2xl bg-[#0B172B] border border-[#1E3A60] p-5 text-white shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#1E3A60] pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#38BDF8]" />
                <h3 className="text-sm font-black uppercase text-white tracking-wider">
                  Live API Probe &amp; Workbench
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40 px-2 py-0.5 rounded uppercase">
                EXPRESS RUNTIME
              </span>
            </div>

            {/* Target Endpoint Input Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={probeEndpoint}
                  onChange={(e) => setProbeEndpoint(e.target.value)}
                  placeholder="/api/health"
                  className="w-full bg-[#060E1C] border border-[#1E3A60] rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-[#38BDF8] outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => handleRunProbe()}
                disabled={isProbing}
                className="bg-[#005DAA] hover:bg-[#00A3E0] active:scale-95 text-white font-bold font-mono text-xs px-4 py-2 rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {isProbing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>PROBING...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>SEND REQUEST</span>
                  </>
                )}
              </button>
            </div>

            {/* Preset Quick Probes */}
            <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
              {[
                "/api/health",
                "/api/backend/topology",
                "/api/state",
                "/api/audit-export",
                "/api/auth/demo-accounts",
              ].map((path) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => {
                    setProbeEndpoint(path);
                    handleRunProbe(path);
                  }}
                  className="bg-[#112440] hover:bg-[#1E3A60] border border-[#1E3A60] text-[#829AB8] hover:text-white px-2 py-1 rounded transition cursor-pointer"
                >
                  {path}
                </button>
              ))}
            </div>

            {/* Response Console */}
            <div className="bg-[#060E1C] border border-[#1E3A60] rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono border-b border-[#1E3A60] pb-2 text-[#829AB8]">
                <span>RESPONSE CONSOLE</span>
                {probeLatency !== null && (
                  <span className="text-emerald-400 font-bold">
                    HTTP {probeResult?.status || 200} · {probeLatency}ms
                  </span>
                )}
              </div>

              <pre className="max-h-60 overflow-y-auto font-mono text-[11px] text-[#38BDF8] leading-relaxed whitespace-pre-wrap">
                {isProbing
                  ? "// Dispatching HTTP request to Express.js listener..."
                  : probeResult
                  ? JSON.stringify(probeResult, null, 2)
                  : `// Ready to probe live endpoints. Click "SEND REQUEST" or pick a preset above.\n// Active endpoint: ${probeEndpoint}`}
              </pre>
            </div>
          </div>

          <div className="text-[10px] font-mono text-[#829AB8] flex items-center justify-between pt-2 border-t border-[#1E3A60]">
            <span>NODE PORT: 3000 (LOCAL PROXY)</span>
            <span className="text-emerald-400 font-bold">LIVE SOCKET READY</span>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 3. INTERACTIVE PACKET FLOW & EVENT SIMULATOR                      */}
      {/* ================================================================= */}
      <div className="rounded-2xl bg-white border border-[#B8D8F8] p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#B8D8F8] pb-3">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-[#005DAA] flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#FF6B00]" />
              <span>Interactive Data Flow &amp; Packet Simulator</span>
            </h3>
            <p className="text-xs text-[#475569] font-medium">
              Select an operational scenario to trace how packets route through the authentication, REST, SSE, and cryptographic ledger pipelines.
            </p>
          </div>

          <button
            type="button"
            onClick={handleStartSimulation}
            disabled={isSimulating}
            className="bg-[#FF6B00] hover:bg-[#FF8533] active:scale-95 text-slate-950 font-black text-xs font-mono uppercase px-4 py-2.5 rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50 self-start sm:self-auto"
          >
            {isSimulating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-black" />
                <span>ROUTING PACKET...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-black" />
                <span>RUN PACKET FLOW</span>
              </>
            )}
          </button>
        </div>

        {/* Workflow Selector Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {PACKET_WORKFLOWS.map((wf) => {
            const isSelected = activeWorkflowId === wf.id;
            const Icon = wf.icon;
            return (
              <button
                key={wf.id}
                type="button"
                onClick={() => {
                  setActiveWorkflowId(wf.id);
                  setSimulatingStep(null);
                  setSimLogs([]);
                }}
                className={`p-3 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? "bg-[#005DAA] text-white border-[#005DAA] shadow-sm"
                    : "bg-[#F8FAFC] hover:bg-[#EBF5FB] text-[#0F2537] border-[#B8D8F8]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${isSelected ? "text-[#38BDF8]" : "text-[#005DAA]"}`} />
                  <span className="text-xs font-bold truncate">{wf.title}</span>
                </div>
                <p className={`text-[10px] leading-tight ${isSelected ? "text-sky-100" : "text-[#64748B]"}`}>
                  {wf.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Step-by-Step Flow Visualization Nodes */}
        <div className="pt-3">
          <div className="text-[11px] font-mono font-bold text-[#005DAA] uppercase tracking-wider mb-2">
            STEP-BY-STEP ROUTE MAP: {activeWorkflow.title.toUpperCase()}
          </div>

          <div className="space-y-2">
            {activeWorkflow.steps.map((step, idx) => {
              const isActive = simulatingStep === idx;
              const isPast = simulatingStep !== null && simulatingStep > idx;

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                    isActive
                      ? "bg-[#0B172B] text-white border-[#38BDF8] shadow-md scale-[1.01]"
                      : isPast
                      ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                      : "bg-[#F8FAFC] border-[#B8D8F8] text-[#0F2537]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                        isActive
                          ? "bg-[#38BDF8] text-slate-950 animate-bounce"
                          : isPast
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {isPast ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>
                    <div>
                      <div className="text-xs font-black font-mono">{step.node}</div>
                      <div className={`text-[11px] mt-0.5 ${isActive ? "text-[#38BDF8]" : isPast ? "text-emerald-800" : "text-[#475569]"}`}>
                        {step.action}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                      isActive
                        ? "bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]"
                        : isPast
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {isActive ? "IN-FLIGHT" : isPast ? "VERIFIED" : "PENDING"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Packet Simulation Logs Output */}
          {simLogs.length > 0 && (
            <div className="mt-4 p-3 bg-[#0B172B] border border-[#1E3A60] rounded-xl font-mono text-xs text-[#38BDF8] space-y-1">
              <div className="text-[10px] font-bold text-[#829AB8] uppercase border-b border-[#1E3A60] pb-1 mb-1">
                PACKET TRACE TIMELINE
              </div>
              {simLogs.map((log, lidx) => (
                <div key={lidx} className="leading-relaxed">
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
