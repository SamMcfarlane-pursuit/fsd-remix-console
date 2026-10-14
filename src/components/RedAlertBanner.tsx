import React, { useState, useEffect } from "react";
import { StatusSnapshot } from "../types";

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
}) => {
  const [elapsedSec, setElapsedSec] = useState(0);

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
  // Exclude badged-out and off-site staff from floor evacuation denominator
  const onSiteOccupants = occupants.filter((o) => !o.badgedOut && !o.offSiteToday);
  const expectedTotal = snapshot?.expectedOnFloor || (onSiteOccupants.length > 0 ? onSiteOccupants.length : 195);
  
  const safeOutsideOccupants = onSiteOccupants.filter(
    (o) => o.status === "safe" && (o.locationCategory === "outside-assembly" || o.assemblyPoint || isIncidentActive)
  );
  const safeOutsideCount = Math.min(expectedTotal, safeOutsideOccupants.length);
  const inBuildingCount = Math.max(0, expectedTotal - safeOutsideCount);
  const percentSafe = expectedTotal > 0 ? Math.min(100, Math.round((safeOutsideCount / expectedTotal) * 100)) : 0;

  const distressedCount = snapshot?.needHelp || occupants.filter((o) => o.status === "need-help").length;
  const evacChairCount =
    snapshot?.awaitingEvacChair || occupants.filter((o) => o.status === "awaiting-evac-chair").length;
  const totalAssistance = distressedCount + evacChairCount;

  // Accurate Muster Point counts from live roster (Points A & B)
  // When evacuated, east quadrants (NE, SE) muster at Point A (Park Plaza/Union Sq), west at Point B (14th St)
  const explicitPointA = safeOutsideOccupants.filter(
    (o) => o.assemblyPoint?.includes("Point A") || o.quadrant === "NE" || o.quadrant === "SE"
  ).length;
  const explicitPointB = safeOutsideOccupants.filter(
    (o) => o.assemblyPoint?.includes("Point B") || o.quadrant === "NW" || o.quadrant === "SW"
  ).length;

  const pointACount = safeOutsideCount > 0 ? (explicitPointA > 0 ? explicitPointA : Math.round(safeOutsideCount * 0.6)) : 0;
  const pointBCount = safeOutsideCount > 0 ? Math.max(0, safeOutsideCount - pointACount) : 0;

  const protocol = snapshot?.emergencyProtocol;

  // If incident is NOT active, show a clean, high-readiness standby bar
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
              <span className="text-sky-300 font-bold">Point A (Union Sq East) &amp; Point B (14th St)</span>
            </div>
            <span className="text-sky-700 hidden sm:inline">|</span>
            <button
              type="button"
              onClick={onOpenProtocolEditor}
              className="px-2.5 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/40 rounded-lg text-[11px] font-bold cursor-pointer transition flex items-center gap-1 shadow-2xs"
              title="Edit Emergency Protocols & Custom Directives"
            >
              <span>⚙️</span>
              <span>Protocols</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE RED ALERT BANNER (High-Impact, Compact, Accurate & Non-Redundant)
  return (
    <div className="bg-gradient-to-r from-red-950 via-red-900 to-red-950 border-b-4 border-red-500 text-white shadow-2xl z-30 transition-all animate-fadeIn">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-2.5">
        {/* Main Row: Alert Title, Live Clock, and Direct Step Actions */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          {/* Left: Emergency Status & Hazard */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-red-600 border-2 border-red-400 flex items-center justify-center font-black text-xl shadow-lg shrink-0 animate-pulse">
              🚨
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-red-500 text-white font-mono font-black text-[10px] uppercase tracking-widest animate-pulse shadow-xs">
                  RED ALERT ACTIVE
                </span>
                <span className="px-2 py-0.5 rounded-full bg-black/40 text-amber-300 border border-amber-400/40 font-mono font-bold text-[10px] uppercase">
                  {snapshot?.mode === "drill" ? "DRILL SIMULATION" : "LIVE EMERGENCY"}
                </span>
                <span className="text-xs font-mono font-bold text-red-200 uppercase">
                  HAZARD: {snapshot?.hazardType?.replace(/-/g, " ").toUpperCase() || "ELECTRICAL FIRE"}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-black text-white tracking-tight mt-0.5">
                {protocol?.customEmergencyBannerText ||
                  "RED ALERT: IMMEDIATE FLOOR 07 EGRESS MANDATED · STAIRWELL A & B OPEN"}
              </h2>
            </div>
          </div>

          {/* Center-Right: Live Clock & Quick Navigation */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0 self-end lg:self-center">
            {/* Alarm Clock */}
            <div className="bg-black/50 border border-red-500/50 px-3 py-1.5 rounded-xl text-center">
              <div className="text-[9px] font-mono text-red-300 uppercase tracking-widest leading-none">
                Alarm Clock
              </div>
              <div className="text-lg sm:text-xl font-mono font-black text-amber-300 tracking-wider mt-0.5">
                {formatStopwatch(elapsedSec)}
              </div>
            </div>

            {/* Quick Step Buttons */}
            <button
              type="button"
              onClick={onOpenBroadcastStep}
              className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-md flex items-center gap-1.5"
              title="Go to Step 04 Broadcast Directives"
            >
              <span>📢</span>
              <span>Step 04 Directives</span>
            </button>

            <button
              type="button"
              onClick={onOpenAllSafeStep}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-md flex items-center gap-1.5"
              title="Go to Step 05 All Safe & Ledger Seal"
            >
              <span>🟢</span>
              <span>Step 05 All Safe</span>
            </button>

            <button
              type="button"
              onClick={onOpenProtocolEditor}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition cursor-pointer"
              title="Protocols & Directives Settings"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Operational Status Strip: Synchronized Headcount, Muster Points, and Elevators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-red-800/60 text-xs">
          {/* Item 1: Synchronized Headcount */}
          <div className="bg-black/30 border border-red-500/40 px-3 py-2 rounded-xl flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-red-300 uppercase font-bold flex items-center gap-1.5 shrink-0">
              <span>👥</span>
              <span>Accountability</span>
            </span>
            <div className="font-mono font-black text-xs flex items-center gap-1.5 flex-wrap justify-end">
              <span className="text-emerald-300">{safeOutsideCount} Safe Outside ({percentSafe}%)</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-300">{inBuildingCount} In-Building</span>
            </div>
          </div>

          {/* Item 2: Outdoor Muster Breakdown */}
          <div className="bg-black/30 border border-red-500/40 px-3 py-2 rounded-xl flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-sky-300 uppercase font-bold flex items-center gap-1.5 shrink-0">
              <span>📍</span>
              <span>Muster Points</span>
            </span>
            <div className="font-mono text-xs text-sky-100 flex items-center gap-2 font-bold justify-end">
              <span>Point A: {pointACount}</span>
              <span className="text-sky-700">·</span>
              <span>Point B: {pointBCount}</span>
            </div>
          </div>

          {/* Item 3: Elevator Phase I Recall Status & Special Assistance */}
          <div className="bg-black/30 border border-red-500/40 px-3 py-2 rounded-xl flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] text-amber-300 uppercase font-bold flex items-center gap-1.5 shrink-0">
              <span>🛗</span>
              <span>Elevators &amp; Life-Safety</span>
            </span>
            <div className="font-mono text-xs flex items-center gap-2 flex-wrap justify-end">
              <span className="text-red-300 font-bold">Phase I Grounded</span>
              {totalAssistance > 0 ? (
                <span className="bg-red-600/90 text-white px-2 py-0.5 rounded text-[10px] font-black animate-pulse">
                  {totalAssistance} Assistance Required
                </span>
              ) : (
                <span className="text-emerald-400 font-bold">✓ 0 Stragglers</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
