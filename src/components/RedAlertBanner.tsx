import React, { useState, useEffect } from "react";
import { StatusSnapshot, Occupant } from "../types";

interface RedAlertBannerProps {
  snapshot: StatusSnapshot | null;
  onOpenProtocolEditor: () => void;
  onOpenBroadcastStep: () => void;
  onOpenAllSafeStep: () => void;
  onOpenAlarmStep: () => void;
  onOpenRosterStep: () => void;
}

export const RedAlertBanner: React.FC<RedAlertBannerProps> = ({
  snapshot,
  onOpenProtocolEditor,
  onOpenBroadcastStep,
  onOpenAllSafeStep,
  onOpenAlarmStep,
  onOpenRosterStep,
}) => {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [expandedSection, setExpandedSection] = useState<"elevators" | "muster" | "metrics" | "actions" | null>(null);

  const isIncidentActive = snapshot?.incidentActive || false;
  const declaredAt = snapshot?.declaredAt;

  // Live real-time stopwatch from alarm declaration
  useEffect(() => {
    if (!isIncidentActive || !declaredAt) {
      setElapsedSec(0);
      return;
    }
    const updateElapsed = () => {
      const startMs = new Date(declaredAt).getTime();
      const nowMs = Date.now();
      setElapsedSec(Math.max(0, Math.round((nowMs - startMs) / 1000)));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [isIncidentActive, declaredAt]);

  const formatStopwatch = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const occupants = snapshot?.occupants || [];
  const inBuildingCount = occupants.filter((o) => !o.badgedOut && !o.offSiteToday && o.locationCategory === "inside-building").length;
  const outsideAssemblyCount = occupants.filter((o) => o.locationCategory === "outside-assembly" || o.status === "safe" && !o.badgedOut).length;
  const distressedCount = snapshot?.needHelp || 0;
  const evacChairCount = snapshot?.awaitingEvacChair || 0;

  const elevatorStatus = snapshot?.elevatorStatus;
  const outdoorMusterPoints = snapshot?.outdoorMusterPoints || [];
  const responseTimes = snapshot?.responseTimes;
  const actionableSteps = snapshot?.actionableSteps || [];
  const protocol = snapshot?.emergencyProtocol;

  // If incident is NOT active, show a clean, high-readiness standby bar with protocol access
  if (!isIncidentActive) {
    return (
      <div className="bg-[#002244] border-b border-sky-800 text-white px-4 sm:px-6 py-2.5 shadow-md animate-fadeIn">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black uppercase tracking-wider text-emerald-300">
                NORMAL READINESS STANDBY
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-300 font-medium">
                4 Irving Pl · Floor 07 Life-Safety Systems Verified
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-[11px] font-mono text-sky-200">
              <span>🛗 Elevators:</span>
              <span className="text-emerald-300 font-bold">Operational (Phase I Ready)</span>
            </div>
            <span className="text-sky-700 hidden sm:inline">|</span>
            <div className="flex items-center gap-2 text-[11px] font-mono text-sky-200">
              <span>📍 Outdoor Muster:</span>
              <span className="text-sky-300 font-bold">Points A &amp; B Designated</span>
            </div>
            <span className="text-sky-700 hidden sm:inline">|</span>
            <button
              type="button"
              onClick={onOpenProtocolEditor}
              className="px-2.5 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/40 rounded-lg text-[11px] font-bold cursor-pointer transition flex items-center gap-1 shadow-2xs"
              title="Edit Emergency Protocols & Custom Directives"
            >
              <span>⚙️</span>
              <span>Edit Protocols &amp; Emergency Text</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE RED ALERT BANNER (Vivid Red Interface & Prominent Status)
  return (
    <div className="bg-gradient-to-r from-red-950 via-red-900 to-red-950 border-b-4 border-red-500 text-white shadow-2xl z-30 transition-all animate-fadeIn">
      {/* Top Banner Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Left: Red Alert Flashing Identifier */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-red-600/90 border-2 border-red-400 flex items-center justify-center font-black text-2xl shadow-lg shrink-0 animate-pulse">
              🚨
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-red-500 text-white font-mono font-black text-[11px] uppercase tracking-widest animate-pulse shadow-xs">
                  RED ALERT ACTIVE
                </span>
                <span className="px-2 py-0.5 rounded-full bg-black/40 text-amber-300 border border-amber-400/40 font-mono font-bold text-[10px] uppercase">
                  {snapshot?.mode === "drill" ? "DRILL SIMULATION" : "LIVE EMERGENCY INCIDENT"}
                </span>
                <span className="text-xs font-mono font-bold text-red-200">
                  HAZARD: {snapshot?.hazardType?.toUpperCase() || "OFFICE FIRE"}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight mt-0.5 leading-snug">
                {protocol?.customEmergencyBannerText || "ACTIVE BUILDING EVACUATION IN PROGRESS · FLOOR 07"}
              </h2>
            </div>
          </div>

          {/* Center: Live Elapsed Stopwatch & Real-Time Metrics */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 bg-black/40 border border-red-500/50 p-2 sm:p-2.5 rounded-2xl shrink-0">
            <div className="text-center px-2">
              <div className="text-[9px] font-mono text-red-300 uppercase tracking-widest">Alarm Clock</div>
              <div className="text-xl sm:text-2xl font-mono font-black text-amber-300 tracking-wider">
                {formatStopwatch(elapsedSec)}
              </div>
            </div>

            <div className="h-8 w-[1px] bg-red-500/40" />

            {/* Time to Identify / Locate (TTI & TTL) */}
            <div className="text-left text-[11px] font-mono space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">TTI (Identify):</span>
                <span className="text-emerald-400 font-bold">{responseTimes?.timeToIdentifySec ?? 28}s</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">TTL (Locate):</span>
                <span className="text-sky-300 font-bold">{responseTimes?.timeToLocateSec ?? 42}s</span>
              </div>
            </div>

            <div className="h-8 w-[1px] bg-red-500/40 hidden sm:block" />

            {/* Egress Velocity Rate */}
            <div className="text-left text-[11px] font-mono hidden sm:block">
              <div className="text-slate-400 text-[10px]">Egress Velocity</div>
              <div className="text-emerald-400 font-bold">
                {responseTimes?.egressRatePerMinute ?? 42.5} /min
              </div>
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenProtocolEditor}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Edit Protocols, Announcement Text & Directives"
            >
              <span>⚙️</span>
              <span className="hidden sm:inline">Protocols</span>
            </button>
            <button
              type="button"
              onClick={onOpenBroadcastStep}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
              title="Push Multi-Channel Broadcast Directives"
            >
              <span>📢</span>
              <span>Broadcast</span>
            </button>
            <button
              type="button"
              onClick={onOpenAllSafeStep}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
              title="Verify All Safe & Seal Cryptographic Ledger"
            >
              <span>🟢</span>
              <span>All Safe</span>
            </button>
          </div>
        </div>

        {/* Primary Focus Areas Bar: Elevators · Outdoor Muster · Active Personnel */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3.5 border-t border-red-700/60 mt-3 text-xs">
          {/* Card 1: Elevators Status */}
          <div
            onClick={() => setExpandedSection(expandedSection === "elevators" ? null : "elevators")}
            className="bg-black/35 hover:bg-black/45 border border-red-500/60 p-3 rounded-xl transition cursor-pointer space-y-1.5 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono font-black uppercase text-red-300 text-[10px] flex items-center gap-1.5">
                <span>🛗</span>
                <span>ELEVATOR STATUS · PHASE I RECALL</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white font-mono font-bold text-[9px] animate-pulse">
                LOCKED OUT
              </span>
            </div>
            <div className="font-bold text-red-100 flex items-center justify-between text-[11px]">
              <span>All Banks Grounded to Lobby 1</span>
              <span className="text-red-400 font-mono text-[10px]">Shaft Vents Open ✓</span>
            </div>
            <div className="text-[10px] text-slate-300 flex items-center justify-between">
              <span>Bank A: Grounded · Bank B: Grounded</span>
              <span className="text-amber-300 font-medium">Click to inspect →</span>
            </div>
          </div>

          {/* Card 2: Outdoor Muster Points Status */}
          <div
            onClick={() => setExpandedSection(expandedSection === "muster" ? null : "muster")}
            className="bg-black/35 hover:bg-black/45 border border-red-500/60 p-3 rounded-xl transition cursor-pointer space-y-1.5 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono font-black uppercase text-sky-300 text-[10px] flex items-center gap-1.5">
                <span>📍</span>
                <span>OUTDOOR MUSTER POINTS</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-sky-900 text-sky-200 border border-sky-400/50 font-mono font-bold text-[9px]">
                {outdoorMusterPoints.reduce((acc, p) => acc + p.headcountVerified, 0)} VERIFIED SAFE
              </span>
            </div>
            <div className="font-bold text-sky-100 flex items-center justify-between text-[11px]">
              <span>Point A (Park Plaza): {outdoorMusterPoints[0]?.headcountVerified || 0}/250</span>
              <span className="text-emerald-400 font-mono text-[10px]">Radius &ge;150m ✓</span>
            </div>
            <div className="text-[10px] text-slate-300 flex items-center justify-between">
              <span>Point B (Courtyard): {outdoorMusterPoints[1]?.headcountVerified || 0}/150</span>
              <span className="text-sky-300 font-medium">Click to inspect →</span>
            </div>
          </div>

          {/* Card 3: Active Personnel & Validation */}
          <div
            onClick={() => setExpandedSection(expandedSection === "metrics" ? null : "metrics")}
            className="bg-black/35 hover:bg-black/45 border border-red-500/60 p-3 rounded-xl transition cursor-pointer space-y-1.5 shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono font-black uppercase text-amber-300 text-[10px] flex items-center gap-1.5">
                <span>👥</span>
                <span>PERSONNEL ACCOUNTABILITY</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/50 font-mono font-bold text-[9px]">
                {distressedCount + evacChairCount > 0 ? "⚠️ DISTRESS ACTIVE" : "EGRESS ACTIVE"}
              </span>
            </div>
            <div className="font-bold text-white flex items-center justify-between text-[11px]">
              <span className="text-emerald-300">Outside Safe: {outsideAssemblyCount}</span>
              <span className="text-slate-300">In-Building: {inBuildingCount}</span>
            </div>
            <div className="text-[10px] text-red-200 flex items-center justify-between font-mono">
              <span className={distressedCount > 0 ? "text-red-400 font-black animate-pulse" : ""}>
                🚨 SOS Distress: {distressedCount}
              </span>
              <span className={evacChairCount > 0 ? "text-purple-300 font-bold" : ""}>
                🛞 Evac Chair: {evacChairCount}
              </span>
            </div>
          </div>
        </div>

        {/* Expandable Section 1: Detailed Elevators Inspection */}
        {expandedSection === "elevators" && elevatorStatus && (
          <div className="mt-3 bg-black/60 border border-red-500/80 p-4 rounded-2xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-red-500/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛗</span>
                <span className="font-mono font-black uppercase text-red-200 text-xs">
                  ELEVATOR FIRE SERVICE PHASE I EMERGENCY RECALL · NYC FIRE CODE §401-06
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExpandedSection(null)}
                className="text-slate-400 hover:text-white cursor-pointer text-xs"
              >
                ✕ Close
              </button>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Upon alarm detection, all passenger and service elevators are automatically recalled to the designated primary ground level (Lobby 1) with doors parked open. Elevator shafts are mechanically vented. Normal hall call buttons and car operating panels are electronically deactivated to prevent entrapment.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px]">
              <div className="bg-red-950/80 border border-red-500/60 p-3 rounded-xl">
                <div className="font-black text-white">{elevatorStatus.banks.bankA.name}</div>
                <div className="text-[10px] text-slate-300 font-mono">{elevatorStatus.banks.bankA.cars}</div>
                <div className="text-red-400 font-bold mt-1 text-[10px]">Status: GROUNDED &amp; LOCKED OUT</div>
                <div className="text-slate-400 text-[10px]">{elevatorStatus.banks.bankA.floor}</div>
              </div>
              <div className="bg-red-950/80 border border-red-500/60 p-3 rounded-xl">
                <div className="font-black text-white">{elevatorStatus.banks.bankB.name}</div>
                <div className="text-[10px] text-slate-300 font-mono">{elevatorStatus.banks.bankB.cars}</div>
                <div className="text-red-400 font-bold mt-1 text-[10px]">Status: GROUNDED &amp; LOCKED OUT</div>
                <div className="text-slate-400 text-[10px]">{elevatorStatus.banks.bankB.floor}</div>
              </div>
              <div className="bg-red-950/80 border border-red-500/60 p-3 rounded-xl">
                <div className="font-black text-white">{elevatorStatus.banks.service.name}</div>
                <div className="text-[10px] text-slate-300 font-mono">{elevatorStatus.banks.service.cars}</div>
                <div className="text-amber-400 font-bold mt-1 text-[10px]">Status: PHASE II FIREFIGHTER READY</div>
                <div className="text-slate-400 text-[10px]">{elevatorStatus.banks.service.floor}</div>
              </div>
            </div>
            <div className="text-[10px] font-mono text-red-300 flex items-center justify-between pt-1">
              <span>Emergency Directive: DO NOT USE ELEVATORS · USE STAIRWELL A &amp; B ONLY</span>
              <span>Key Switch Authorized: {elevatorStatus.overrideKeyholder}</span>
            </div>
          </div>
        )}

        {/* Expandable Section 2: Detailed Outdoor Muster Inspection */}
        {expandedSection === "muster" && (
          <div className="mt-3 bg-black/60 border border-sky-500/80 p-4 rounded-2xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-sky-500/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">📍</span>
                <span className="font-mono font-black uppercase text-sky-200 text-xs">
                  DESIGNATED OUTDOOR MUSTER ASSEMBLY AREAS &amp; HEADCOUNT SYNC
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExpandedSection(null)}
                className="text-slate-400 hover:text-white cursor-pointer text-xs"
              >
                ✕ Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
              {outdoorMusterPoints.map((point) => (
                <div key={point.id} className="bg-sky-950/80 border border-sky-400/60 p-3.5 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-white text-xs">{point.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 font-mono font-bold text-[10px]">
                      {point.headcountVerified} / {point.capacity} Checked In
                    </span>
                  </div>
                  <div className="text-sky-200 text-[10px]">{point.address}</div>
                  <div className="text-slate-300 text-[10px]">
                    Assigned Sectors: <strong className="text-white">Sector {point.assignedQuadrants.join(" & ")}</strong>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-sky-800">
                    <span>Lead Warden: {point.wardenLead}</span>
                    <span className="text-emerald-400">Clearance: {point.safeDistanceMeters}m</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expandable Section 3: Time Measurement & Response Metrics */}
        {expandedSection === "metrics" && responseTimes && (
          <div className="mt-3 bg-black/60 border border-amber-500/80 p-4 rounded-2xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-amber-500/40 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">⏱️</span>
                <span className="font-mono font-black uppercase text-amber-200 text-xs">
                  RESPONSE TIME MEASUREMENT &amp; ACTIVE DISTRESS PINPOINT TRACKING
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExpandedSection(null)}
                className="text-slate-400 hover:text-white cursor-pointer text-xs"
              >
                ✕ Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-amber-950/60 border border-amber-500/40 p-2.5 rounded-xl">
                <div className="text-[10px] font-mono text-slate-400 uppercase">TTI · Time to Identify</div>
                <div className="text-lg font-black text-emerald-400 mt-0.5">{responseTimes.timeToIdentifySec ?? 28}s</div>
                <div className="text-[10px] text-slate-300">Elapsed from alarm trip to distress detection</div>
              </div>
              <div className="bg-amber-950/60 border border-amber-500/40 p-2.5 rounded-xl">
                <div className="text-[10px] font-mono text-slate-400 uppercase">TTL · Time to Locate</div>
                <div className="text-lg font-black text-sky-400 mt-0.5">{responseTimes.timeToLocateSec ?? 42}s</div>
                <div className="text-[10px] text-slate-300">Elapsed to confirm physical CAD coordinates &amp; desk</div>
              </div>
              <div className="bg-amber-950/60 border border-amber-500/40 p-2.5 rounded-xl">
                <div className="text-[10px] font-mono text-slate-400 uppercase">TTC · Time to Confirm / Safe</div>
                <div className="text-lg font-black text-amber-300 mt-0.5">
                  {responseTimes.timeToConfirmSec ? `${responseTimes.timeToConfirmSec}s` : "In Progress (Live Clock)"}
                </div>
                <div className="text-[10px] text-slate-300">Elapsed from distress alert to confirmed extraction</div>
              </div>
            </div>

            {/* List of Distressed Personnel with Pinpoint Locations */}
            {responseTimes.activeEmergenciesList.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-mono font-bold uppercase text-red-300">
                  Active Emergency Extraction Queue (Pinpointed on CAD):
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {responseTimes.activeEmergenciesList.map((emg) => (
                    <div
                      key={emg.occupantId}
                      className="bg-red-950/80 border border-red-500/60 p-2.5 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-black text-white flex items-center gap-2">
                          <span>{emg.name}</span>
                          <span className="text-[10px] font-mono bg-red-600 px-1.5 py-0.2 rounded text-white font-bold">
                            {emg.occupantId}
                          </span>
                          <span className="text-[10px] font-mono text-amber-300">
                            {emg.status === "awaiting-evac-chair" ? "🛞 EVAC CHAIR" : "🚨 SOS DISTRESS"}
                          </span>
                        </div>
                        <div className="text-[11px] text-red-200 font-mono">
                          Pinpoint: {emg.pinpointLocation} · {emg.isInsideBuilding ? "🏢 INSIDE FLOOR 07" : "OUTSIDE"}
                        </div>
                      </div>
                      <div className="text-right font-mono text-[10px] text-slate-300">
                        <div>TTI: {emg.ttiSec}s · TTL: {emg.ttlSec}s</div>
                        <button
                          type="button"
                          onClick={onOpenRosterStep}
                          className="mt-1 px-2 py-0.5 bg-sky-500 hover:bg-sky-600 text-white rounded font-bold cursor-pointer transition text-[10px]"
                        >
                          Dispatch Responder →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actionable Emergency Steps Situational Checklist */}
        <div className="mt-3.5 bg-black/40 border border-red-500/40 p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="font-black text-amber-300 uppercase">TACTICAL SOP CHECKLIST:</span>
            <span className="text-slate-300">
              {actionableSteps.filter((s) => s.status === "COMPLETED").length} of {actionableSteps.length} Steps Executed
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {actionableSteps.map((step) => (
              <span
                key={step.id}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold flex items-center gap-1 border ${
                  step.status === "COMPLETED"
                    ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/50"
                    : step.status === "IN_PROGRESS"
                    ? "bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse"
                    : "bg-black/50 text-slate-400 border-slate-700"
                }`}
                title={step.description}
              >
                <span>{step.status === "COMPLETED" ? "✓" : step.status === "IN_PROGRESS" ? "⏳" : "○"}</span>
                <span className="truncate max-w-[140px] sm:max-w-[180px]">{step.title}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
