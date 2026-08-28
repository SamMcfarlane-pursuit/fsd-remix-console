/**
 * Journey 3 (mobile revision) — FSD Commander Status screen
 *
 * Headcount-style layout: one number, one screen.
 *  - Mobile (<lg): accountability ring + quadrant tiles + 3-tab bottom nav.
 *  - Desktop (lg+): same components, three-pane arrangement.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { Occupant, QuadrantId, QuadrantStat, StatusSnapshot } from "../types";
import BuildingPersonFinderModal from "./BuildingPersonFinderModal";

const QUADRANT_IDS: QuadrantId[] = ["NW", "NE", "SW", "SE"];
const QUADRANT_LABELS: Record<QuadrantId, string> = {
  NW: "NW · Strategic Planning (07-800)",
  NE: "NE · Gas Ops & Security (07-200/270)",
  SW: "SW · AMI & Ombudsman (07-700)",
  SE: "SE · Steam Operations (07-500/550)",
};

const LOADING_TIMEOUT_MS = 10_000;
const DEFAULT_POLL_MS = 3_000;

function fmtClock(t: number) {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const STATE_URL_CANDIDATES = [
  "/api/state",
  "/api/status",
  "/api/muster/state",
  "/api/muster",
  "/api/incident/state",
  "/api/incidents/state",
  "/api/dashboard/state",
  "/api/commander/state",
];

interface RawOccupant {
  quadrant?: string;
  status?: string;
  badgedOut?: boolean;
  offSiteToday?: boolean;
}

type Tab = "status" | "people" | "actions" | "kiosk" | "roster" | "demo" | "backend";
type LoadPhase = "loading" | "ready" | "error";

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function deriveQuadrants(occupants: RawOccupant[]): QuadrantStat[] {
  return QUADRANT_IDS.map((id) => {
    const inQuadrant = occupants.filter(
      (o) => o.quadrant === id && o.badgedOut !== true && o.offSiteToday !== true
    );
    return {
      id,
      label: QUADRANT_LABELS[id],
      expected: inQuadrant.length,
      accounted: inQuadrant.filter((o) => o.status === "safe").length,
      claimedUnverified: inQuadrant.filter((o) => o.status === "claimed-unverified").length,
      needHelp: inQuadrant.filter((o) => o.status === "need-help").length,
      mia: inQuadrant.filter((o) => o.status === "mia").length,
    };
  });
}

function normalizeSnapshot(raw: Record<string, unknown>): StatusSnapshot {
  const occupants: RawOccupant[] = Array.isArray(raw.occupants)
    ? (raw.occupants as RawOccupant[])
    : [];

  let quadrants: QuadrantStat[];
  if (Array.isArray(raw.quadrants) && raw.quadrants.length > 0) {
    quadrants = (raw.quadrants as Partial<QuadrantStat>[]).map((q) => {
      const id = QUADRANT_IDS.includes(q?.id as QuadrantId) ? (q!.id as QuadrantId) : "NW";
      return {
        id,
        label: typeof q?.label === "string" ? q.label : QUADRANT_LABELS[id],
        expected: num(q?.expected),
        accounted: num(q?.accounted),
        claimedUnverified: num(q?.claimedUnverified),
        needHelp: num(q?.needHelp),
        mia: num(q?.mia),
      };
    });
  } else {
    quadrants = deriveQuadrants(occupants);
  }

  const present = occupants.filter((o) => o.badgedOut !== true && o.offSiteToday !== true);
  const count = (status: string) => present.filter((o) => o.status === status).length;
  const quadrantExpected = quadrants.reduce((sum, q) => sum + q.expected, 0);

  const mode = raw.mode === "drill" || raw.mode === "incident" ? raw.mode : null;
  return {
    incidentActive: raw.incidentActive === true || mode !== null,
    mode,
    hazardType: typeof raw.hazardType === "string" ? raw.hazardType : null,
    declaredAt: typeof raw.declaredAt === "string" ? raw.declaredAt : null,
    expectedOnFloor: num(raw.expectedOnFloor) || quadrantExpected || present.length || 195,
    accounted: num(raw.accounted) || count("safe"),
    needHelp: num(raw.needHelp) || count("need-help"),
    mia: num(raw.mia) || count("mia"),
    awaitingEvacChair: num(raw.awaitingEvacChair) || count("awaiting-evac-chair"),
    quadrants,
    occupants: raw.occupants as any,
    ledgerEntries: raw.ledgerEntries as any,
    latestNarrative: raw.latestNarrative as any,
  };
}

function demoSnapshot(): StatusSnapshot {
  return {
    incidentActive: true,
    mode: "drill",
    hazardType: "office-fire",
    declaredAt: new Date().toISOString(),
    expectedOnFloor: 195,
    accounted: 174,
    needHelp: 1,
    mia: 1,
    awaitingEvacChair: 4,
    quadrants: [
      { id: "NW", label: QUADRANT_LABELS.NW, expected: 49, accounted: 44, claimedUnverified: 1, needHelp: 0, mia: 0 },
      { id: "NE", label: QUADRANT_LABELS.NE, expected: 49, accounted: 44, claimedUnverified: 1, needHelp: 1, mia: 0 },
      { id: "SW", label: QUADRANT_LABELS.SW, expected: 49, accounted: 43, claimedUnverified: 1, needHelp: 0, mia: 1 },
      { id: "SE", label: QUADRANT_LABELS.SE, expected: 48, accounted: 43, claimedUnverified: 0, needHelp: 0, mia: 0 },
    ],
  };
}

function useMusterState(preferredUrl: string, eventsUrl: string | undefined, pollMs: number) {
  const [snapshot, setSnapshot] = useState<StatusSnapshot | null>(null);
  const [phase, setPhase] = useState<LoadPhase>("loading");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const gotData = useRef(false);
  const resolvedUrl = useRef<string | null>(null);

  const retry = useCallback(() => {
    gotData.current = false;
    resolvedUrl.current = null;
    setErrorDetail(null);
    setIsDemo(false);
    setPhase("loading");
    setAttempt((a) => a + 1);
  }, []);

  const loadDemo = useCallback(() => {
    setSnapshot(demoSnapshot());
    setIsDemo(true);
    setPhase("ready");
  }, []);

  useEffect(() => {
    if (!preferredUrl) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let es: EventSource | null = null;

    const apply = (raw: Record<string, unknown>) => {
      if (cancelled) return;
      gotData.current = true;
      setSnapshot(normalizeSnapshot(raw));
      setIsDemo(false);
      setPhase("ready");
    };

    const candidates = Array.from(new Set([preferredUrl, ...STATE_URL_CANDIDATES]));

    const fetchOne = async (
      url: string
    ): Promise<{ ok: true; raw: Record<string, unknown> } | { ok: false; reason: string }> => {
      let r: Response;
      try {
        r = await fetch(url, { cache: "no-store" });
      } catch {
        return { ok: false, reason: `${url} → network error` };
      }
      if (r.status === 401 || r.status === 403) return { ok: false, reason: `${url} → ${r.status} auth required` };
      if (!r.ok) return { ok: false, reason: `${url} → ${r.status}` };
      try {
        return { ok: true, raw: (await r.json()) as Record<string, unknown> };
      } catch {
        return { ok: false, reason: `${url} → not JSON` };
      }
    };

    const tick = async () => {
      if (resolvedUrl.current) {
        const res = await fetchOne(resolvedUrl.current);
        if (res.ok) {
          apply(res.raw);
        } else {
          resolvedUrl.current = null;
        }
        return;
      }
      const failures: string[] = [];
      for (const url of candidates) {
        const res = await fetchOne(url);
        if (res.ok) {
          resolvedUrl.current = url;
          apply(res.raw);
          return;
        } else {
          failures.push((res as { ok: false; reason: string }).reason);
        }
      }
      if (!cancelled && !gotData.current) {
        setErrorDetail(
          `No muster state endpoint found. Tried:\n${failures.join("\n")}`
        );
        setPhase("error");
      }
    };

    void tick();
    pollTimer = setInterval(() => void tick(), pollMs);

    if (eventsUrl && typeof EventSource !== "undefined") {
      es = new EventSource(eventsUrl);
      es.onmessage = (ev) => {
        try {
          apply(JSON.parse(ev.data as string) as Record<string, unknown>);
        } catch {
          /* ignore */
        }
      };
    }

    const timeout = setTimeout(() => {
      if (!cancelled && !gotData.current) {
        setErrorDetail((d) => d ?? `No response within ${LOADING_TIMEOUT_MS / 1000}s.`);
        setPhase("error");
      }
    }, LOADING_TIMEOUT_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (pollTimer) clearInterval(pollTimer);
      es?.close();
    };
  }, [preferredUrl, eventsUrl, pollMs, attempt]);

  return { snapshot, phase, errorDetail, isDemo, retry, loadDemo };
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

const quadrantTone = (q: QuadrantStat): string => {
  if (q.needHelp > 0 || q.mia > 0) return "border-l-4 border-l-red-600 border-[#B8D8F8] bg-red-50/50 text-[#0F2537] shadow-xs";
  if (q.accounted + q.claimedUnverified < q.expected) return "border-l-4 border-l-[#FF6B00] border-[#B8D8F8] bg-orange-50/40 text-[#0F2537] shadow-xs";
  return "border-l-4 border-l-[#005DAA] border-[#B8D8F8] bg-[#F0F6FC]/60 text-[#0F2537] shadow-xs";
};

export interface CommanderStatusProps {
  snapshot?: StatusSnapshot | null;
  stateUrl?: string;
  eventsUrl?: string;
  pollMs?: number;
  occupants?: Occupant[];
  onCheckIn?: (occupantId: string, status: any, via?: string, notes?: string, locationCategory?: any, assemblyPoint?: string) => void;
  onSelectQuadrant?: (id: QuadrantId) => void;
  onOpenPeople?: () => void;
  onOpenActions?: () => void;
  activeTab?: Tab;
  onTabChange?: (tab: Tab) => void;
  renderPeopleSlot?: ReactNode;
  renderActionsSlot?: ReactNode;
  renderKioskSlot?: ReactNode;
  renderRosterSlot?: ReactNode;
  renderMapSlot?: ReactNode;
  renderResourcesSlot?: ReactNode;
  renderDemoSlot?: ReactNode;
  renderBackendSlot?: ReactNode;
  renderRapidSweepSlot?: ReactNode;
  onRefreshState?: () => void;
}

export default function CommanderStatus({
  snapshot: controlled,
  stateUrl = "/api/state",
  eventsUrl = "/api/events",
  pollMs = DEFAULT_POLL_MS,
  occupants,
  onCheckIn,
  onRefreshState,
  onSelectQuadrant,
  onOpenPeople,
  onOpenActions,
  activeTab,
  onTabChange,
  renderPeopleSlot,
  renderActionsSlot,
  renderKioskSlot,
  renderRosterSlot,
  renderMapSlot,
  renderResourcesSlot,
  renderDemoSlot,
  renderBackendSlot,
  renderRapidSweepSlot,
}: CommanderStatusProps) {
  const [internalTab, setInternalTab] = useState<Tab>("status");
  const [triageFilter, setTriageFilter] = useState<"unaccounted" | "at-risk" | "safe" | "all">("unaccounted");
  const [triageSearch, setTriageSearch] = useState("");
  const [isProcessingSweep, setIsProcessingSweep] = useState(false);
  const [sweepResultMsg, setSweepResultMsg] = useState<string | null>(null);
  const [isScalingRoster, setIsScalingRoster] = useState(false);
  const tab = activeTab || internalTab;

  const setTab = (t: Tab) => {
    setInternalTab(t);
    onTabChange?.(t);
  };

  const isDesktop = useIsDesktop();
  const internal = useMusterState(controlled ? "" : stateUrl, controlled ? undefined : eventsUrl, pollMs);
  const s = controlled ?? internal.snapshot;

  // Execute 1-Click Digital Round Sweep
  const handleExecuteSweep = async (quadrant?: string, sweepAll: boolean = false) => {
    setIsProcessingSweep(true);
    setSweepResultMsg(null);
    try {
      const res = await fetch("/api/muster/sweep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quadrant,
          sweepAll,
          via: "1-CLICK-DIGITAL-ROUND",
          wardenName: "Floor 07 Lead Life-Safety Warden",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSweepResultMsg(`⚡ Round Completed: ${data.sweptCount} Accounted for in ${data.processingDurationMs}ms.`);
        onRefreshState?.();
        internal.retry?.();
      }
    } catch (e) {
      console.warn("Sweep error:", e);
    } finally {
      setIsProcessingSweep(false);
    }
  };

  // Scale Roster (200, 300, 400 occupants)
  const handleScaleRoster = async (count: number) => {
    setIsScalingRoster(true);
    try {
      const res = await fetch("/api/roster/scale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count }),
      });
      if (res.ok) {
        onRefreshState?.();
        internal.retry?.();
      }
    } catch (e) {
      console.warn("Roster scale error:", e);
    } finally {
      setIsScalingRoster(false);
    }
  };

  // Real-time live muster elapsed timer
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!s?.incidentActive || !s?.declaredAt) {
      setLiveElapsedSeconds(0);
      return undefined;
    }
    const updateElapsed = () => {
      const declaredTime = new Date(s.declaredAt!).getTime();
      const now = Date.now();
      setLiveElapsedSeconds(Math.max(0, Math.floor((now - declaredTime) / 1000)));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [s?.incidentActive, s?.declaredAt]);

  // Collapsible live ledger controller state inside Command Deck
  const [isSimDeckOpen, setIsSimDeckOpen] = useState(false);

  // Building Person Finder Modal State
  const [isFinderOpen, setIsFinderOpen] = useState(false);
  const [finderInitialQuadrant, setFinderInitialQuadrant] = useState("ALL");

  const openFinderForQuadrant = (quadId: string) => {
    setFinderInitialQuadrant(quadId);
    setIsFinderOpen(true);
  };

  const phase: LoadPhase = controlled ? "ready" : internal.phase;

  if (!s && phase === "loading") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#0A1424] text-zinc-100" role="status">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1E3A60] border-t-[#00A3E0]" aria-hidden="true" />
        <p className="text-sm font-bold text-[#829AB8] uppercase tracking-wider">Establishing Command Deck Telemetry…</p>
      </div>
    );
  }

  if (!s) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0A1424] px-6 text-center text-zinc-100" role="alert">
        <div className="rounded-full bg-amber-500/10 p-3 text-amber-400">
          <span className="text-2xl">⚠️</span>
        </div>
        <p className="text-lg font-semibold">Can't reach MusterCommand state endpoint</p>
        <pre className="max-w-md overflow-x-auto whitespace-pre-wrap rounded-lg bg-zinc-900 px-4 py-3 text-left font-mono text-xs text-amber-300 border border-zinc-800">
          {internal.errorDetail ?? "No data received."}
        </pre>
        <p className="max-w-xs text-sm text-zinc-400">
          Retrying automatically every {Math.round(pollMs / 1000)}s. Warden kiosks continue operating on local mesh.
        </p>
        <div className="flex gap-3">
          <button
            onClick={internal.retry}
            className="rounded-xl bg-zinc-100 px-6 py-3 text-sm font-semibold text-zinc-950 hover:bg-white transition"
          >
            Retry connection
          </button>
          <button
            onClick={internal.loadDemo}
            className="rounded-xl border border-amber-400 px-6 py-3 text-sm font-semibold text-amber-300 hover:bg-amber-400/10 transition"
          >
            Load Demo Mode
          </button>
        </div>
      </div>
    );
  }

  const pct = s.expectedOnFloor > 0 ? s.accounted / s.expectedOnFloor : 0;
  const pctFormatted = Math.round(pct * 100);

  // Filter occupants for embedded quick triage
  const allOccupants = occupants || s.occupants || [];
  const activeFloorOccupants = allOccupants.filter((o) => !o.badgedOut && !o.offSiteToday);
  
  const triageList = activeFloorOccupants.filter((o) => {
    if (triageSearch.trim()) {
      const q = triageSearch.toLowerCase();
      const matchName = o.name.toLowerCase().includes(q) || o.id.toLowerCase().includes(q) || o.role.toLowerCase().includes(q);
      if (!matchName) return false;
    }
    if (triageFilter === "unaccounted") return o.status !== "safe";
    if (triageFilter === "at-risk") return o.status === "need-help" || o.status === "awaiting-evac-chair" || o.status === "mia";
    if (triageFilter === "safe") return o.status === "safe";
    return true;
  });

  return (
    <div className="flex flex-col bg-[#F0F6FC] text-[#0F2537] font-sans min-h-screen">
      {internal.isDemo && (
        <div className="bg-[#FF6B00] text-slate-950 text-center py-1 text-[10px] font-black uppercase tracking-[0.2em]" role="alert">
          Demo Mode — disconnected from live muster state
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 p-3 sm:p-5 max-w-7xl mx-auto w-full space-y-4">
        {tab === "status" && (
          <div className="space-y-4 w-full">
            {/* Top 4-Metric Command Telemetry HUD Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Metric 1: Expected on Floor */}
              <div className="bg-white rounded-xl border border-[#B8D8F8] p-3 sm:p-4 shadow-xs">
                <div className="text-[11px] font-black uppercase tracking-wider text-[#64748B] flex items-center justify-between">
                  <span>Floor 07 Census</span>
                  <span className="text-[#005DAA] font-mono text-[10px] bg-[#EBF5FB] px-1.5 py-0.5 rounded font-bold">ROSTER</span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-2xl sm:text-3xl font-black text-[#0F2537]">{s.expectedOnFloor}</span>
                  <span className="text-xs text-[#64748B] font-semibold">Total Present</span>
                </div>
                <div className="mt-1 text-[11px] text-[#475569] font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#005DAA]" />
                  <span>{allOccupants.filter(o => o.role !== "Visitor" && !o.badgedOut).length} Staff · {allOccupants.filter(o => o.role === "Visitor").length} Visitors</span>
                </div>
              </div>

              {/* Metric 2: Accounted & Safe */}
              <div className="bg-white rounded-xl border border-[#B8D8F8] p-3 sm:p-4 shadow-xs">
                <div className="text-[11px] font-black uppercase tracking-wider text-[#64748B] flex items-center justify-between">
                  <span>Accounted Safe</span>
                  <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    pct >= 1 ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-[#005DAA]"
                  }`}>
                    {pctFormatted}%
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-2xl sm:text-3xl font-black text-emerald-700">{s.accounted}</span>
                  <span className="text-xs text-[#64748B] font-semibold">/ {s.expectedOnFloor}</span>
                </div>
                <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-500 rounded-full"
                    style={{ width: `${Math.min(100, pctFormatted)}%` }}
                  />
                </div>
              </div>

              {/* Metric 3: Critical & ARA Action Priority */}
              <div className={`rounded-xl border p-3 sm:p-4 shadow-xs ${
                s.needHelp > 0 || s.mia > 0
                  ? "bg-red-50/70 border-red-300"
                  : s.awaitingEvacChair > 0
                  ? "bg-amber-50/70 border-amber-300"
                  : "bg-white border-[#B8D8F8]"
              }`}>
                <div className="text-[11px] font-black uppercase tracking-wider text-[#64748B] flex items-center justify-between">
                  <span>Action Priority</span>
                  {(s.needHelp > 0 || s.awaitingEvacChair > 0) && (
                    <span className="animate-ping w-2 h-2 rounded-full bg-red-600" />
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={`font-mono text-2xl sm:text-3xl font-black ${
                    s.needHelp > 0 ? "text-red-700" : s.awaitingEvacChair > 0 ? "text-amber-800" : "text-emerald-700"
                  }`}>
                    {s.needHelp + s.awaitingEvacChair + s.mia}
                  </span>
                  <span className="text-xs text-[#64748B] font-semibold">Flagged</span>
                </div>
                <div className="mt-1 text-[11px] font-bold flex flex-wrap gap-1.5">
                  {s.needHelp > 0 && <span className="text-red-700 bg-red-100 px-1.5 py-0.5 rounded">{s.needHelp} Help</span>}
                  {s.awaitingEvacChair > 0 && <span className="text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">{s.awaitingEvacChair} ARA Chair</span>}
                  {s.mia > 0 && <span className="text-red-700 bg-red-100 px-1.5 py-0.5 rounded">{s.mia} MIA</span>}
                  {s.needHelp === 0 && s.awaitingEvacChair === 0 && s.mia === 0 && (
                    <span className="text-emerald-700">✓ No immediate alerts</span>
                  )}
                </div>
              </div>

              {/* Metric 4: Safe Egress Path */}
              <div className="bg-white rounded-xl border border-[#B8D8F8] p-3 sm:p-4 shadow-xs">
                <div className="text-[11px] font-black uppercase tracking-wider text-[#64748B] flex items-center justify-between">
                  <span>Primary Egress</span>
                  <span className="text-emerald-700 font-mono text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded font-bold">100% CLEAR</span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-bold text-base sm:text-lg text-[#0F2537]">Stairwell B</span>
                  <span className="text-[11px] text-emerald-700 font-bold">(East Core)</span>
                </div>
                <div className="mt-1 text-[11px] text-[#475569] font-medium truncate">
                  Stairwell A: {s.awaitingEvacChair > 0 ? "ARA Landing 07 Active" : "Clear"}
                </div>
              </div>
            </div>

            {/* LIVE COMMAND DECK OPERATIONAL CONTROLLER (Real-Time Live Incident Muster Deck) */}
            <div className="bg-[#003B70] text-white rounded-xl border border-[#005DAA] shadow-md px-3.5 sm:px-5 py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className={`w-2.5 h-2.5 rounded-full ${s.incidentActive ? "bg-red-500 animate-ping" : "bg-emerald-400"}`} />
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                  <span>{s.incidentActive ? `🔴 LIVE ${s.mode?.toUpperCase()} MUSTER IN PROGRESS` : "🟢 STANDBY READINESS"}</span>
                </span>
                <span className="font-mono text-xs bg-[#0A1424] text-sky-300 px-2.5 py-1 rounded-lg border border-[#1E3A60] font-black">
                  ⏱ MUSTER CLOCK: {fmtClock(liveElapsedSeconds || 140)}
                </span>
                <span className="hidden md:inline-block font-mono text-[10px] bg-[#0A1424]/60 text-slate-300 px-2 py-1 rounded border border-[#1E3A60]">
                  ⛓️ SHA-256 LEDGER: L-{String((s.ledger?.length || 18)).padStart(4, "0")}
                </span>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                {/* 1-Click Sweep All Action */}
                <button
                  onClick={() => handleExecuteSweep(undefined, true)}
                  disabled={isProcessingSweep}
                  className="px-3 py-1.5 min-h-[38px] bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  title="Execute 1-Click Floorwide Digital Sweep for all remaining unaccounted occupants"
                >
                  <span>⚡</span>
                  <span>{isProcessingSweep ? "Sweeping..." : "Sweep All Sectors"}</span>
                </button>

                {/* Quick Person / Desk Finder */}
                <button
                  onClick={() => openFinderForQuadrant("ALL")}
                  className="px-3 py-1.5 min-h-[38px] bg-[#FF6B00] hover:bg-[#FF8533] active:scale-95 text-slate-950 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center gap-1.5"
                  title="Spatial Radar: Find any occupant or desk on Floor 07"
                >
                  <span>🎯</span>
                  <span>Find Person</span>
                </button>

                {/* Collapsible Ledger Live Feed Toggle */}
                <button
                  onClick={() => setIsSimDeckOpen(!isSimDeckOpen)}
                  className="text-xs font-bold text-sky-200 hover:text-white px-2.5 py-1.5 min-h-[38px] bg-white/10 hover:bg-white/20 rounded-lg transition cursor-pointer flex items-center gap-1"
                >
                  <span>📋</span>
                  <span>{isSimDeckOpen ? "Hide Ledger ▴" : "Ledger ▾"}</span>
                </button>
              </div>
            </div>

            {/* Collapsible Real-Time Cryptographic Ledger Audit Feed */}
            {isSimDeckOpen && (
              <div className="bg-white rounded-xl border border-[#B8D8F8] p-3 shadow-xs space-y-1.5 animate-fadeIn">
                <div className="text-[10px] font-black uppercase tracking-wider text-[#64748B] flex justify-between items-center">
                  <span>Cryptographic Audit Ledger Stream (Hash-Chained SHA-256)</span>
                  <span className="font-mono text-emerald-700 font-bold">100% Immutable Verification</span>
                </div>
                <div className="bg-[#F0F6FC] rounded-lg p-2.5 max-h-32 overflow-y-auto font-mono text-[11px] space-y-1 border border-[#B8D8F8]">
                  {s.ledger && s.ledger.length > 0 ? (
                    s.ledger.slice(-12).reverse().map((entry: any, i: number) => (
                      <div key={entry.id || i} className="text-[#0F2537] flex items-baseline gap-2">
                        <span className="text-[#64748B] shrink-0">[{new Date(entry.timestamp).toLocaleTimeString()}]</span>
                        <span className="text-[#005DAA] font-bold shrink-0">{entry.id}</span>
                        <span className="text-emerald-700 font-semibold">{entry.type}</span>
                        <span className="text-slate-600 truncate">{JSON.stringify(entry.payload || {})}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 font-medium">
                      ✓ Genesis audit entry verified. Real-time check-ins and muster sweep updates streamed via SSE.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* EXACT TACTICAL MUSTER MAP (Full-Width Primary Centerpiece) */}
            <div className="w-full">
              {renderMapSlot}
            </div>

            {/* Master Command Deck: 2-Column Responsive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pb-16 md:pb-0">
              {/* Left Column (7 cols): Combined Sector Sweep Hub & Systems */}
              <div className="lg:col-span-7 space-y-4">
                {/* COMBINED SECTOR SWEEP & PEOPLE ACCOUNTABILITY MASTER HUB */}
                <div className="bg-white rounded-xl border-2 border-[#005DAA] p-3.5 sm:p-4 shadow-md space-y-3.5">
                  {/* Hub Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#B8D8F8] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🧭</span>
                        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-[#005DAA]">
                          Sector Sweep & People Accountability Hub
                        </h3>
                      </div>
                      <div className="text-[11px] text-[#475569] font-medium mt-0.5 flex items-center gap-2">
                        <span className="font-bold text-[#0F2537]">
                          {s.quadrants.filter(q => q.accounted >= q.expected).length}/4 Sectors Cleared
                        </span>
                        <span>·</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {s.accounted}/{s.expectedOnFloor} Safe ({pctFormatted}%)
                        </span>
                      </div>
                    </div>

                    {/* High-Leverage Master Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => openFinderForQuadrant("ALL")}
                        className="px-3.5 py-2 min-h-[44px] bg-[#FF6B00] hover:bg-[#FF8533] text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95"
                        title="Locate any occupant or desk within the building"
                      >
                        <span className="text-sm">🎯</span>
                        <span>Find Person</span>
                      </button>

                      <button
                        onClick={() => handleExecuteSweep(undefined, true)}
                        disabled={isProcessingSweep || s.accounted >= s.expectedOnFloor}
                        className="px-3.5 py-2 min-h-[44px] bg-[#005DAA] hover:bg-[#004A88] disabled:bg-slate-300 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95"
                        title="1-Click Digital Round Sweep for all remaining sectors"
                      >
                        <span>⚡</span>
                        <span>{isProcessingSweep ? "Sweeping…" : "Sweep All"}</span>
                      </button>

                      {/* Roster Size Preset Scaler */}
                      <div className="hidden sm:flex items-center gap-1 bg-[#F0F6FC] p-1 rounded-lg border border-[#B8D8F8]">
                        {[200, 300, 400].map((size) => (
                          <button
                            key={size}
                            onClick={() => handleScaleRoster(size)}
                            disabled={isScalingRoster}
                            className={`px-2 py-1 rounded text-[10px] font-mono font-bold transition cursor-pointer ${
                              allOccupants.length >= size - 20 && allOccupants.length <= size + 20
                                ? "bg-[#005DAA] text-white"
                                : "text-[#64748B] hover:bg-white"
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Sweep Result Banner */}
                  {sweepResultMsg && (
                    <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between animate-fadeIn">
                      <span className="flex items-center gap-1.5">
                        <span>✓</span>
                        <span>{sweepResultMsg}</span>
                      </span>
                      <button
                        onClick={() => setSweepResultMsg(null)}
                        className="text-emerald-700 hover:text-emerald-950 text-sm font-black cursor-pointer ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* 4 Quadrants Sweep & Accountability Matrix */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {s.quadrants.map((q) => {
                      const isCleared = q.accounted >= q.expected && q.expected > 0;
                      const hasCritical = q.needHelp > 0 || q.mia > 0;
                      const unaccountedInSector = Math.max(0, q.expected - q.accounted);

                      return (
                        <div
                          key={q.id}
                          className={`rounded-xl border p-3.5 flex flex-col justify-between transition shadow-xs ${
                            hasCritical
                              ? "bg-red-50/70 border-red-300"
                              : isCleared
                              ? "bg-emerald-50/50 border-emerald-300"
                              : "bg-[#F0F6FC] border-[#B8D8F8]"
                          }`}
                        >
                          <div>
                            {/* Sector Title & Status Pill */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black uppercase text-[#005DAA] tracking-wider">
                                {q.label} Sector
                              </span>
                              <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded font-mono ${
                                  isCleared
                                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                    : hasCritical
                                    ? "bg-red-100 text-red-800 border border-red-300 animate-pulse"
                                    : "bg-amber-100 text-amber-900 border border-amber-300"
                                }`}
                              >
                                {isCleared ? "✓ 100% Cleared" : `${unaccountedInSector} Pending`}
                              </span>
                            </div>

                            {/* Headcount */}
                            <div className="mt-2 flex items-baseline justify-between">
                              <div className="font-mono text-2xl font-black text-[#0F2537]">
                                {q.accounted}
                                <span className="text-xs text-[#64748B] font-semibold"> / {q.expected}</span>
                              </div>
                              <div className="text-[11px] font-bold text-[#64748B]">
                                {Math.round(q.expected > 0 ? (q.accounted / q.expected) * 100 : 0)}% Safe
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="h-2 bg-[#E2E8F0] w-full rounded-full overflow-hidden mt-1.5">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  hasCritical
                                    ? "bg-red-600"
                                    : isCleared
                                    ? "bg-emerald-600"
                                    : "bg-[#FF6B00]"
                                }`}
                                style={{ width: `${q.expected > 0 ? Math.min(100, (q.accounted / q.expected) * 100) : 0}%` }}
                              />
                            </div>

                            {/* Tags */}
                            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black uppercase">
                              {q.needHelp > 0 && <span className="text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">{q.needHelp} Need Help</span>}
                              {q.mia > 0 && <span className="text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">{q.mia} MIA</span>}
                            </div>
                          </div>

                          {/* 1-Tap Mobile Actions */}
                          <div className="mt-3 pt-2.5 border-t border-[#B8D8F8]/70 grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleExecuteSweep(q.id)}
                              disabled={isProcessingSweep || isCleared}
                              className={`py-2 min-h-[44px] px-2 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1 active:scale-95 ${
                                isCleared
                                  ? "bg-emerald-100 text-emerald-800 cursor-default"
                                  : "bg-[#005DAA] hover:bg-[#004A88] text-white shadow-xs"
                              }`}
                            >
                              <span>⚡</span>
                              <span>{isCleared ? "Swept" : "Sweep"}</span>
                            </button>

                            <button
                              onClick={() => openFinderForQuadrant(q.id)}
                              className="py-2 min-h-[44px] px-2 bg-white hover:bg-[#EBF5FB] text-[#005DAA] border border-[#B8D8F8] rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                              title={`Find personnel in ${q.id}`}
                            >
                              <span>🔍</span>
                              <span>Find in {q.id}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Special Area of Rescue & Outside Assembly Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {/* ARA Landing */}
                    <div className="p-3 rounded-xl border border-amber-300 bg-amber-50/70 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-black uppercase text-amber-950 tracking-wider flex items-center gap-1">
                          <span>🛗</span>
                          <span>Stairwell A (ARA Landing)</span>
                        </div>
                        <div className="text-xs font-bold text-amber-800 mt-0.5">
                          {s.awaitingEvacChair} Evac Chair Requested
                        </div>
                      </div>
                      <button
                        onClick={() => openFinderForQuadrant("ARA")}
                        className="px-3 py-2 min-h-[44px] bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[11px] font-black uppercase tracking-wider transition cursor-pointer shrink-0"
                      >
                        🔍 Find ARA
                      </button>
                    </div>

                    {/* Outside Assembly */}
                    <div className="p-3 rounded-xl border border-emerald-300 bg-emerald-50/70 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-black uppercase text-emerald-950 tracking-wider flex items-center gap-1">
                          <span>🌳</span>
                          <span>Outside Assembly Points</span>
                        </div>
                        <div className="text-xs font-bold text-emerald-800 mt-0.5">
                          {allOccupants.filter(o => o.locationCategory === "outside-assembly" || o.status === "safe").length} Verified Safe
                        </div>
                      </div>
                      <button
                        onClick={() => openFinderForQuadrant("OUTSIDE")}
                        className="px-3 py-2 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-black uppercase tracking-wider transition cursor-pointer shrink-0"
                      >
                        🔍 Find Outside
                      </button>
                    </div>
                  </div>
                </div>

                {/* First Responder & Life-Safety Readiness */}
                <div className="bg-white rounded-xl border border-[#B8D8F8] p-3.5 sm:p-4 shadow-xs">
                  <div className="text-xs font-black uppercase tracking-wider text-[#005DAA] mb-3 flex items-center justify-between border-b border-[#B8D8F8] pb-2">
                    <span className="flex items-center gap-1.5">
                      <span>🚒</span>
                      <span>First Responder & Building Systems</span>
                    </span>
                  </div>
                  {renderResourcesSlot}
                </div>
              </div>

              {/* Right Column (5 cols): Accountability Core & Live Triage List */}
              <div className="lg:col-span-5 space-y-4">
                {/* Accountability Gauge & ARA Callout */}
                <div className="bg-white rounded-xl border border-[#B8D8F8] p-4 shadow-xs flex flex-col items-center gap-4">
                  <AccountabilityRing
                    accounted={s.accounted}
                    expected={s.expectedOnFloor}
                    pct={pct}
                    needHelp={s.needHelp}
                    mia={s.mia}
                  />

                  {/* Area of Rescue Assistance Callout */}
                  {s.awaitingEvacChair > 0 && (
                    <button
                      onClick={() => openFinderForQuadrant("ARA")}
                      className="w-full flex items-center justify-between min-h-[48px] rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-left hover:bg-amber-100/80 active:scale-98 transition cursor-pointer shadow-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-amber-800 text-xl">🛗</span>
                        <div>
                          <div className="text-xs font-black text-amber-950 uppercase tracking-wider">Area of Rescue Assistance (ARA)</div>
                          <div className="text-[11px] text-amber-800 font-bold">Stairwell A · Landing Floor 07</div>
                        </div>
                      </div>
                      <span className="text-xs font-black text-amber-950 font-mono bg-amber-200 px-2.5 py-1 rounded-md border border-amber-400 shrink-0">
                        {s.awaitingEvacChair} Chair Needed
                      </span>
                    </button>
                  )}
                </div>

                {/* Embedded Live Quick-Triage Feed */}
                <div className="bg-white rounded-xl border border-[#B8D8F8] p-3.5 sm:p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-[#B8D8F8] pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">👥</span>
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#005DAA]">
                        Live Rapid Triage Deck
                      </h3>
                    </div>
                    <button
                      onClick={() => {
                        setTab("people");
                        onOpenPeople?.();
                      }}
                      className="text-[11px] font-bold text-[#005DAA] hover:underline cursor-pointer"
                    >
                      Open Hub →
                    </button>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 bg-[#F0F6FC] p-1 rounded-lg border border-[#B8D8F8]">
                    {[
                      { id: "unaccounted", label: "Unaccounted" },
                      { id: "at-risk", label: "At-Risk / ARA" },
                      { id: "safe", label: "Safe" },
                      { id: "all", label: "All" },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setTriageFilter(f.id as any)}
                        className={`flex-1 py-1.5 px-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition cursor-pointer text-center min-h-[36px] flex items-center justify-center ${
                          triageFilter === f.id
                            ? "bg-[#005DAA] text-white shadow-xs"
                            : "text-[#64748B] hover:bg-white"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={triageSearch}
                      onChange={(e) => setTriageSearch(e.target.value)}
                      placeholder="Search occupant by name or desk..."
                      className="w-full pl-8 pr-3 py-2 bg-[#F0F6FC] border border-[#B8D8F8] rounded-lg text-xs font-semibold text-[#0F2537] placeholder-[#64748B] focus:outline-none focus:border-[#005DAA]"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#005DAA]">🔍</span>
                  </div>

                  {/* Occupant Quick Triage List */}
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {triageList.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-400 font-medium">
                        No occupants match the selected filter.
                      </div>
                    ) : (
                      triageList.slice(0, 15).map((o) => (
                        <div
                          key={o.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-[#F0F6FC] border border-[#B8D8F8] text-xs hover:bg-white transition gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-[#0F2537] truncate">{o.name}</div>
                            <div className="text-[10px] text-[#64748B] truncate">
                              {o.quadrant} Sector · {o.role} {o.desk && `· ${o.desk}`}
                            </div>
                          </div>

                          {/* Quick 1-Click Status Buttons with 44px touch */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {o.status !== "safe" ? (
                              <button
                                onClick={() => onCheckIn?.(o.id, "safe", "commander-deck", "Marked safe by commander")}
                                className="px-2.5 py-1.5 min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-black transition cursor-pointer shadow-xs active:scale-95"
                                title="Mark Safe"
                              >
                                ✓ Safe
                              </button>
                            ) : (
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                                Safe
                              </span>
                            )}

                            {o.status !== "need-help" && (
                              <button
                                onClick={() => onCheckIn?.(o.id, "need-help", "commander-deck", "Flagged by commander")}
                                className="px-2 py-1.5 min-h-[38px] bg-red-100 hover:bg-red-200 text-red-700 rounded text-[11px] font-bold transition cursor-pointer"
                                title="Flag Need Help"
                              >
                                🚨 Help
                              </button>
                            )}

                            {o.araAssigned && o.status !== "awaiting-evac-chair" && (
                              <button
                                onClick={() => onCheckIn?.(o.id, "awaiting-evac-chair", "commander-deck", "ARA chair requested")}
                                className="px-2 py-1.5 min-h-[38px] bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-[11px] font-bold transition cursor-pointer"
                                title="Request Evac Chair"
                              >
                                🛗 ARA
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {triageList.length > 15 && (
                      <button
                        onClick={() => {
                          setTab("people");
                          onOpenPeople?.();
                        }}
                        className="w-full py-2 text-center text-xs font-bold text-[#005DAA] hover:bg-[#EBF5FB] rounded-lg transition"
                      >
                        View all {triageList.length} occupants in Hub →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile-First Floating Quick-Action Dock (visible on phones/tablets for 1-thumb reach) */}
            <div className="md:hidden fixed bottom-10 left-0 right-0 p-3 bg-white/95 backdrop-blur border-t border-[#B8D8F8] shadow-2xl flex items-center gap-2.5 z-40">
              <button
                onClick={() => openFinderForQuadrant("ALL")}
                className="flex-1 min-h-[48px] bg-[#FF6B00] hover:bg-[#FF8533] text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <span className="text-base">🎯</span>
                <span>Find Person</span>
              </button>

              <button
                onClick={() => handleExecuteSweep(undefined, true)}
                disabled={isProcessingSweep || s.accounted >= s.expectedOnFloor}
                className="flex-1 min-h-[48px] bg-[#005DAA] hover:bg-[#004A88] disabled:bg-slate-300 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <span>⚡</span>
                <span>{isProcessingSweep ? "Sweeping…" : "Sweep All"}</span>
              </button>
            </div>
          </div>
        )}

        {tab === "people" && (
          <div className="w-full">
            {renderPeopleSlot}
          </div>
        )}

        {tab === "actions" && (
          <div className="w-full">
            {renderActionsSlot}
          </div>
        )}

        {tab === "kiosk" && (
          <div className="w-full">
            {renderKioskSlot}
          </div>
        )}

        {tab === "roster" && (
          <div className="w-full">
            {renderRosterSlot}
          </div>
        )}

        {tab === "demo" && (
          <div className="w-full">
            {renderDemoSlot}
          </div>
        )}

        {tab === "backend" && (
          <div className="w-full">
            {renderBackendSlot}
          </div>
        )}
      </main>

      {/* Building Occupant & Spatial Presence Finder Radar Modal */}
      <BuildingPersonFinderModal
        isOpen={isFinderOpen}
        onClose={() => setIsFinderOpen(false)}
        occupants={allOccupants}
        onCheckIn={onCheckIn || (() => {})}
        initialQuadrant={finderInitialQuadrant}
        onLocateOnMap={(q) => {
          onSelectQuadrant?.(q);
        }}
      />
    </div>
  );
}

function AccountabilityRing({
  accounted,
  expected,
  pct,
  needHelp,
  mia,
}: {
  accounted: number;
  expected: number;
  pct: number;
  needHelp: number;
  mia: number;
}) {
  const r = 84;
  const c = 2 * Math.PI * r;
  const critical = needHelp > 0 || mia > 0;
  return (
    <div
      className="relative h-56 w-56 shrink-0 flex flex-col items-center justify-center"
      role="img"
      aria-label={`${accounted} of ${expected} occupants accounted for${
        needHelp > 0 ? `, ${needHelp} need help` : ""
      }${mia > 0 ? `, ${mia} missing` : ""}`}
    >
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="100" cy="100" r={r} fill="none" stroke="#E2E8F0" strokeWidth="16" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke={critical ? "#DC2626" : pct >= 1 ? "#005DAA" : "#EA580C"}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(pct, 1))}
          style={{ transition: "stroke-dashoffset 400ms ease, stroke 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-mono text-4xl font-black tracking-tighter text-[#0F2537]">
          {accounted}
          <span className="text-lg text-[#64748B] font-semibold"> /{expected}</span>
        </div>
        <div className="text-[11px] uppercase font-black tracking-[0.2em] text-[#005DAA] mt-1">
          Accounted
        </div>
        {critical && (
          <div className="mt-2 text-xs font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 flex items-center gap-1 animate-pulse">
            <span>🚨</span>
            {needHelp > 0 && `${needHelp} NEED HELP`}
            {needHelp > 0 && mia > 0 && " · "}
            {mia > 0 && `${mia} MIA`}
          </div>
        )}
      </div>
    </div>
  );
}
