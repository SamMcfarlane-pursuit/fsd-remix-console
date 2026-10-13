import React, { useEffect, useState } from "react";
import { StatusSnapshot } from "../../types";
import { playAlarmSiren, stopAlarmSiren, speakEmergencyBroadcast } from "../../lib/audioBroadcast";
import {
  ASSEMBLY_POINT_OPTIONS,
  HAZARD_OPTIONS,
  STAIRWELL_OPTIONS,
  getHazard,
  normalizeAssemblyPoint,
  normalizeStairwell,
  shortStairwell,
} from "../../lib/evacConstants";

interface Step3AlarmProps {
  snapshot: StatusSnapshot | null;
  onDeclareIncident: (mode: "drill" | "incident", type: string) => Promise<void>;
  onClearIncident: () => Promise<void>;
  onProceedNext: () => void;
  onBackToStep2?: () => void;
  stairwell?: string;
  assemblyPoint?: string;
  onUpdateEvacRoute?: (stairwell: string, assemblyPoint: string) => void;
  onOpenWalkieTalkie?: () => void;
}

/**
 * STEP 03 · ALARM
 * Job: decide WHAT is happening (drill vs. real, which hazard) and WHERE people go
 * (stairwell + muster point), then sound the alarm.
 * Output: incidentActive = true on the server → phones flip into emergency mode,
 * every in-building occupant resets to "unaccounted", Step 04 is unlocked and
 * pre-filled with this exact hazard and route.
 * The written/spoken message itself is composed and sent in Step 04.
 */
export const Step3Alarm: React.FC<Step3AlarmProps> = ({
  snapshot,
  onDeclareIncident,
  onClearIncident,
  onProceedNext,
  onBackToStep2,
  stairwell: routeStairwell,
  assemblyPoint: routeAssembly,
  onUpdateEvacRoute,
  onOpenWalkieTalkie,
}) => {
  const isIncidentActive = snapshot?.incidentActive || false;
  const activeMode = snapshot?.mode || "drill";
  const activeHazard = getHazard(snapshot?.hazardType);

  const [selectedMode, setSelectedMode] = useState<"drill" | "incident">(activeMode);
  const [selectedHazard, setSelectedHazard] = useState<string>(activeHazard.id);
  const [selectedStairwell, setSelectedStairwell] = useState<string>(normalizeStairwell(routeStairwell));
  const [assemblyPoint, setAssemblyPoint] = useState<string>(normalizeAssemblyPoint(routeAssembly));
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Keep the form in sync with what the server says is live (e.g. alarm declared
  // from another console, or snapshot arriving after first render).
  useEffect(() => {
    if (isIncidentActive) {
      setSelectedMode(activeMode);
      setSelectedHazard(activeHazard.id);
    }
  }, [isIncidentActive, activeMode, activeHazard.id]);

  const presentCount = (snapshot?.occupants || []).filter((o) => !o.badgedOut && !o.offSiteToday).length
    || snapshot?.expectedOnFloor || 0;
  const distressCount = (snapshot?.needHelp || 0) + (snapshot?.awaitingEvacChair || 0);
  const hazard = getHazard(selectedHazard);
  const routeChanged =
    isIncidentActive &&
    (normalizeStairwell(routeStairwell) !== selectedStairwell ||
      normalizeAssemblyPoint(routeAssembly) !== assemblyPoint ||
      activeHazard.id !== selectedHazard ||
      activeMode !== selectedMode);

  const handleDeclare = async () => {
    if (presentCount === 0) {
      setErrorMsg("No one is signed in on Floor 07. Sign occupants in (Step 01/02) before declaring.");
      return;
    }
    if (selectedMode === "incident" && !isIncidentActive) {
      const ok = window.confirm(
        "⚠️ Declare a REAL EMERGENCY?\n\nThis is not a drill. Every occupant's phone will show a live evacuation order.\n\nPress OK to declare."
      );
      if (!ok) return;
    }
    setErrorMsg(null);
    setIsProcessing(true);
    try {
      onUpdateEvacRoute?.(selectedStairwell, assemblyPoint);
      await onDeclareIncident(selectedMode, selectedHazard);
      if (!isIncidentActive) {
        // Step 03 sounds the alarm only. The spoken directive is sent in Step 04.
        playAlarmSiren(4);
      }
      onProceedNext();
    } catch {
      setErrorMsg("Could not reach the command server. Check connection and try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = async () => {
    const ok = window.confirm(
      "Stand down and clear the alarm?\n\nPhones will exit emergency mode. Use this only for a false alarm — for a completed drill, finish in Step 05 so the ledger is sealed."
    );
    if (!ok) return;
    setIsProcessing(true);
    try {
      await onClearIncident();
      stopAlarmSiren();
      speakEmergencyBroadcast(
        "Attention Floor 07: the alarm has been cleared. You may resume normal operations.",
        "INFO"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div id="step-3-alarm-container" className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-[#B8D8F8] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#005DAA] uppercase tracking-wider mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#005DAA]" />
            STEP 03 OF 05 · ALARM
          </div>
          <h2 className="text-2xl font-black tracking-tight text-[#0F2537]">
            {isIncidentActive ? "Alarm Is Active" : "Declare a Drill or Emergency"}
          </h2>
          <p className="text-sm text-[#475569] mt-1 max-w-2xl">
            Choose drill or real emergency, the hazard, and the evacuation route. Declaring sounds the alarm and
            switches every signed-in phone into emergency mode. You write and send the message in Step 04.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {onBackToStep2 && (
            <button
              type="button"
              onClick={onBackToStep2}
              className="px-4 py-3 rounded-xl border border-[#CBDCEE] bg-white hover:bg-[#F0F6FC] text-[#0F2537] font-bold text-xs transition shadow-xs cursor-pointer"
            >
              ← Step 02 Roster
            </button>
          )}
          <button
            id="step3-proceed-btn"
            onClick={onProceedNext}
            disabled={!isIncidentActive}
            title={isIncidentActive ? "" : "Declare the alarm first"}
            className="px-5 py-3 rounded-xl bg-[#005DAA] hover:bg-[#004884] text-white font-black text-sm tracking-wide transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>{isIncidentActive ? "Go to Step 04 Broadcast" : "🔒 Step 04 locked"}</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* Pre-flight readiness: what Step 02 handed us */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 border border-[#B8D8F8] flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono font-bold text-[#64748B] uppercase">On Floor Now (from Step 02)</div>
            <div className="text-2xl font-black text-[#005DAA] font-mono">{presentCount}</div>
          </div>
          <span className="text-2xl">👥</span>
        </div>
        <div className={`rounded-xl p-4 border flex items-center justify-between ${distressCount > 0 ? "bg-red-50 border-red-300" : "bg-white border-[#B8D8F8]"}`}>
          <div>
            <div className="text-[10px] font-mono font-bold text-[#64748B] uppercase">Active SOS / Evac Chair</div>
            <div className={`text-2xl font-black font-mono ${distressCount > 0 ? "text-red-700" : "text-slate-400"}`}>{distressCount}</div>
            {distressCount > 0 && <div className="text-[10px] text-red-800 font-bold">Preserved through declaration</div>}
          </div>
          <span className="text-2xl">🆘</span>
        </div>
        <div className={`rounded-xl p-4 border flex items-center justify-between ${isIncidentActive ? (activeMode === "incident" ? "bg-red-600 border-red-700 text-white" : "bg-[#005DAA] border-[#003B70] text-white") : "bg-emerald-50 border-emerald-300"}`}>
          <div>
            <div className={`text-[10px] font-mono font-bold uppercase ${isIncidentActive ? "text-white/80" : "text-emerald-800"}`}>Floor Status</div>
            <div className={`text-base font-black uppercase ${isIncidentActive ? "" : "text-emerald-900"}`}>
              {isIncidentActive ? `🔴 ${activeMode === "incident" ? "Live Emergency" : "Drill"} Active` : "🟢 Normal"}
            </div>
          </div>
          <span className="text-2xl">{isIncidentActive ? "🚨" : "🛡️"}</span>
        </div>
      </div>

      {/* Active alarm banner */}
      {isIncidentActive && (
        <div className={`rounded-2xl p-5 text-white shadow-lg border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${activeMode === "incident" ? "bg-linear-to-r from-red-600 to-red-700 border-red-400" : "bg-linear-to-r from-[#005DAA] to-[#003B70] border-sky-400"}`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl shrink-0 animate-pulse">
              {activeHazard.icon}
            </div>
            <div>
              <div className="text-[10px] font-mono font-black uppercase tracking-widest text-white/80">
                Alarm sounded{snapshot?.declaredAt ? ` at ${new Date(snapshot.declaredAt).toLocaleTimeString()}` : ""}
              </div>
              <h3 className="text-xl font-black mt-0.5">
                {activeMode === "incident" ? "LIVE EMERGENCY" : "LIFE-SAFETY DRILL"} · {activeHazard.name}
              </h3>
              <p className="text-xs text-white/90 mt-1">
                Route: <strong>{normalizeStairwell(routeStairwell)}</strong> → <strong>{normalizeAssemblyPoint(routeAssembly)}</strong>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenWalkieTalkie && (
              <button
                type="button"
                onClick={onOpenWalkieTalkie}
                className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
              >
                📻 Radio PTT
              </button>
            )}
            <button
              id="step3-banner-proceed-btn"
              onClick={onProceedNext}
              className="px-5 py-2.5 bg-white hover:bg-slate-100 text-[#005DAA] font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
            >
              Next: Send Broadcast →
            </button>
            <button
              onClick={handleClear}
              disabled={isProcessing}
              className="px-4 py-2.5 bg-black/20 hover:bg-black/30 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer border border-white/30"
            >
              False Alarm · Stand Down
            </button>
          </div>
        </div>
      )}

      {/* Configuration */}
      <div className="bg-white rounded-2xl p-6 border border-[#B8D8F8] shadow-xs space-y-6">
        {/* 1. Mode */}
        <div>
          <h3 className="text-base font-black text-[#0F2537] mb-3">1. Drill or real emergency?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setSelectedMode("drill")}
              className={`p-4 rounded-xl border-2 text-left transition cursor-pointer flex items-center gap-4 ${selectedMode === "drill" ? "bg-[#EBF3FB] border-[#005DAA] ring-2 ring-[#005DAA]/20" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <div className="w-10 h-10 rounded-xl bg-[#005DAA]/10 flex items-center justify-center text-xl shrink-0">🎯</div>
              <div>
                <div className="text-sm font-black text-[#0F2537]">Scheduled Drill</div>
                <div className="text-xs text-[#64748B] mt-0.5">Training. Times and muster metrics are recorded. No 911 dispatch.</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setSelectedMode("incident")}
              className={`p-4 rounded-xl border-2 text-left transition cursor-pointer flex items-center gap-4 ${selectedMode === "incident" ? "bg-red-50 border-red-600 ring-2 ring-red-500/20" : "bg-white border-slate-200 hover:border-slate-300"}`}
            >
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-xl shrink-0">🚨</div>
              <div>
                <div className="text-sm font-black text-red-950">Real Emergency</div>
                <div className="text-xs text-red-800/80 mt-0.5">Live threat. Phones show a critical evacuation order.</div>
              </div>
            </button>
          </div>
        </div>

        {/* 2. Hazard */}
        <div>
          <h3 className="text-base font-black text-[#0F2537] mb-3">2. What is the hazard?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {HAZARD_OPTIONS.map((haz) => {
              const isSelected = selectedHazard === haz.id;
              return (
                <button
                  key={haz.id}
                  type="button"
                  onClick={() => {
                    setSelectedHazard(haz.id);
                    setSelectedStairwell(haz.recommendedStairwell);
                  }}
                  className={`p-3.5 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${isSelected ? "border-[#005DAA] bg-[#EBF3FB] ring-2 ring-[#005DAA]/20" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <div>
                    <div className="text-2xl mb-1.5">{haz.icon}</div>
                    <div className="text-xs font-black text-[#0F2537]">{haz.name}</div>
                    <p className="text-[11px] text-[#64748B] mt-1 line-clamp-2">{haz.desc}</p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200/60 text-[10px] font-mono text-[#005DAA] font-bold">
                    Suggested: {shortStairwell(haz.recommendedStairwell)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Route */}
        <div>
          <h3 className="text-base font-black text-[#0F2537] mb-3">3. Where should people go?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">Evacuation stairwell</label>
              <select
                value={selectedStairwell}
                onChange={(e) => setSelectedStairwell(e.target.value)}
                className="w-full p-3 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-bold text-[#0F2537] outline-hidden focus:ring-2 focus:ring-[#005DAA]"
              >
                {STAIRWELL_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">Outdoor muster point</label>
              <select
                value={assemblyPoint}
                onChange={(e) => setAssemblyPoint(e.target.value)}
                className="w-full p-3 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-bold text-[#0F2537] outline-hidden focus:ring-2 focus:ring-[#005DAA]"
              >
                {ASSEMBLY_POINT_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* What happens when you press the button */}
        <div className="rounded-2xl bg-[#F0F6FC] border border-[#CBDCEE] p-4">
          <div className="text-[11px] font-mono font-black uppercase tracking-wider text-[#005DAA] mb-2">
            {isIncidentActive ? "Updating the alarm will:" : "When you declare, the system will:"}
          </div>
          <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-[#0F2537]">
            <li><strong>1.</strong> Sound the floor alarm tone {selectedMode === "incident" ? "(critical)" : "(drill)"}.</li>
            <li><strong>2.</strong> Switch all {presentCount} signed-in phones to emergency mode with the {shortStairwell(selectedStairwell)} route and map.</li>
            <li><strong>3.</strong> Reset everyone to <em>unaccounted</em> — only a real check-in counts as safe. Active SOS / evac-chair requests are kept.</li>
            <li><strong>4.</strong> Unlock Step 04 with a message pre-written for <em>{hazard.shortName}</em> → {shortStairwell(selectedStairwell)} → {assemblyPoint.split(" (")[0]}.</li>
          </ol>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-xs font-bold text-red-900">⚠️ {errorMsg}</div>
        )}

        {/* Single primary action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
          <div className="text-xs text-[#64748B]">
            {isIncidentActive
              ? routeChanged
                ? "You changed the settings. Update the live alarm, then re-send the broadcast in Step 04."
                : "Alarm is live with these settings. Continue to Step 04 to broadcast the message."
              : presentCount === 0
              ? "No occupants signed in yet — the alarm would reach nobody."
              : `Ready. ${presentCount} people on the floor will be alerted.`}
          </div>
          {isIncidentActive && !routeChanged ? (
            <button
              type="button"
              onClick={onProceedNext}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-black text-sm uppercase tracking-wider shadow-md transition cursor-pointer bg-[#005DAA] hover:bg-[#004884] text-white"
            >
              Continue to Step 04 Broadcast →
            </button>
          ) : (
            <button
              type="button"
              id="step3-declare-and-proceed-btn"
              onClick={handleDeclare}
              disabled={isProcessing}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-black text-sm uppercase tracking-wider shadow-md transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 ${selectedMode === "incident" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-[#005DAA] hover:bg-[#004884] text-white"}`}
            >
              <span>{isIncidentActive ? "🔁" : "🔔"}</span>
              <span>
                {isProcessing
                  ? "Declaring..."
                  : isIncidentActive
                  ? "Update Alarm & Continue →"
                  : selectedMode === "incident"
                  ? "Declare Emergency & Continue →"
                  : "Start Drill & Continue →"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
