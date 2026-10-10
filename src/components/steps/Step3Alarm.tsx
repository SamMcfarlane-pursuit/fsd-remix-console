import React, { useState } from "react";
import { StatusSnapshot } from "../../types";
import { playAlarmSiren, stopAlarmSiren, speakEmergencyBroadcast } from "../../lib/audioBroadcast";

interface Step3AlarmProps {
  snapshot: StatusSnapshot | null;
  onDeclareIncident: (mode: "drill" | "incident", type: string) => Promise<void>;
  onClearIncident: () => Promise<void>;
  onProceedNext: () => void;
  stairwell?: string;
  assemblyPoint?: string;
  onUpdateEvacRoute?: (stairwell: string, assemblyPoint: string) => void;
}

const HAZARD_OPTIONS = [
  {
    id: "office-fire",
    name: "Office Fire & Smoke Condition",
    icon: "🔥",
    desc: "Active smoke or thermal detection in commercial office suites. Immediate evacuation required.",
    recommendedStairwell: "Stairwell A (East Core)",
    color: "border-red-400 bg-red-50/70 text-red-950",
  },
  {
    id: "gas-leak",
    name: "Natural Gas Leak / Odor",
    icon: "⛽",
    desc: "Combustible gas detection or pipeline pressure drop. No elevator usage, avoid electrical switches.",
    recommendedStairwell: "Stairwell B (West Core)",
    color: "border-amber-400 bg-amber-50/70 text-amber-950",
  },
  {
    id: "power-outage",
    name: "Electrical Grid / Power Failure",
    icon: "⚡",
    desc: "Floor 07 sub-station circuit trip. Emergency exit egress lighting active.",
    recommendedStairwell: "Stairwell A & B",
    color: "border-yellow-400 bg-yellow-50/70 text-yellow-950",
  },
  {
    id: "active-threat",
    name: "Security Alert / Active Threat",
    icon: "⚠️",
    desc: "Building security perimeter breach or hostile intruder. Shelter in place or rapid tactical egress.",
    recommendedStairwell: "Tactical Egress Only",
    color: "border-purple-400 bg-purple-50/70 text-purple-950",
  },
  {
    id: "severe-weather",
    name: "Severe Weather / Structural",
    icon: "🌪️",
    desc: "High wind structural risk, shattered glass, or severe flooding condition.",
    recommendedStairwell: "Interior Core (Stairwell A)",
    color: "border-blue-400 bg-blue-50/70 text-blue-950",
  },
];

export const Step3Alarm: React.FC<Step3AlarmProps> = ({
  snapshot,
  onDeclareIncident,
  onClearIncident,
  onProceedNext,
  stairwell: initialStairwell,
  assemblyPoint: initialAssemblyPoint,
  onUpdateEvacRoute,
}) => {
  const isIncidentActive = snapshot?.incidentActive || false;
  const currentMode = snapshot?.mode || "drill";
  const currentHazard = snapshot?.hazardType || "office-fire";

  const [selectedMode, setSelectedMode] = useState<"drill" | "incident">(currentMode);
  const [selectedHazard, setSelectedHazard] = useState<string>(currentHazard);
  const [selectedStairwell, setSelectedStairwell] = useState<string>(
    initialStairwell || "Stairwell A (East Core - Union Sq East)"
  );
  const [assemblyPoint, setAssemblyPoint] = useState<string>(
    initialAssemblyPoint || "Assembly Point A (Union Sq East / Park Plaza)"
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleDeclare = async (autoProceedToBroadcast = true) => {
    setIsProcessing(true);
    try {
      if (onUpdateEvacRoute) {
        onUpdateEvacRoute(selectedStairwell, assemblyPoint);
      }
      await onDeclareIncident(selectedMode, selectedHazard);
      playAlarmSiren(6);
      speakEmergencyBroadcast(
        `Attention Floor 07 occupants: A ${selectedMode === "drill" ? "life-safety evacuation drill" : "live emergency evacuation"} has been declared due to ${selectedHazard.replace("-", " ")}. Please evacuate immediately via ${selectedStairwell} and report to ${assemblyPoint}.`,
        selectedMode === "drill" ? "HIGH" : "CRITICAL"
      );
      if (autoProceedToBroadcast) {
        onProceedNext();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = async () => {
    setIsProcessing(true);
    try {
      await onClearIncident();
      stopAlarmSiren();
      speakEmergencyBroadcast(
        "Attention Floor 07 occupants: The life-safety incident has been cleared. All safe. You may resume normal operations.",
        "INFO"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div id="step-3-alarm-container" className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#B8D8F8] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#005DAA] uppercase tracking-wider mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#005DAA]" />
            STEP 03 OF 05 · INCIDENT &amp; DRILL ALARM DECLARATION
          </div>
          <h2 className="text-2xl font-black tracking-tight text-[#0F2537]">
            Declare Life-Safety Alarm or Drill
          </h2>
          <p className="text-sm text-[#475569] mt-1 max-w-2xl">
            Staff lead or Fire Safety Director activates the floor-wide alarm. Select whether this is a scheduled training drill or a live emergency, set the specific hazard, and designate the safest evacuation path.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div
            className={`px-4 py-2.5 rounded-xl border text-right font-mono ${
              isIncidentActive
                ? selectedMode === "incident"
                  ? "bg-red-500 text-white border-red-600 animate-pulse"
                  : "bg-[#005DAA] text-white border-[#003B70]"
                : "bg-emerald-50 text-emerald-900 border-emerald-300"
            }`}
          >
            <div className="text-[10px] uppercase font-bold tracking-wider">
              {isIncidentActive ? "Alarm Status" : "Operational Status"}
            </div>
            <div className="text-sm font-black uppercase">
              {isIncidentActive
                ? `🔴 ACTIVE ${currentMode?.toUpperCase()}`
                : "🟢 NORMAL READINESS"}
            </div>
          </div>

          <button
            id="step3-proceed-btn"
            onClick={onProceedNext}
            className="px-5 py-3 rounded-xl bg-[#005DAA] hover:bg-[#004884] text-white font-black text-sm tracking-wide transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span>Proceed to Step 04</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* Active Alarm Status Display Banner */}
      {isIncidentActive ? (
        <div className="rounded-2xl p-6 bg-linear-to-r from-red-600 to-red-700 text-white shadow-lg border border-red-400 flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl shrink-0">
              🚨
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-mono font-black uppercase tracking-widest text-red-200">
                <span>ALARM SOUNDED · FLOOR 07 EVACUATION ACTIVE</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black mt-1">
                {currentMode === "incident" ? "EMERGENCY INCIDENT ACTIVE" : "SCHEDULED LIFE-SAFETY DRILL"}
              </h3>
              <p className="text-xs text-red-100 mt-1">
                Hazard: <strong className="uppercase">{currentHazard}</strong> · Directive: Egress via {selectedStairwell} to {assemblyPoint}.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              id="step3-banner-proceed-btn"
              onClick={onProceedNext}
              className="px-5 py-3 bg-white hover:bg-slate-100 text-[#005DAA] font-black rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <span>Proceed to Step 04 Broadcast</span>
              <span>→</span>
            </button>

            <button
              onClick={handleClear}
              disabled={isProcessing}
              className="px-4 py-3 bg-red-800/80 hover:bg-red-900 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer border border-red-500/50"
            >
              Stand Down / Clear
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-5 bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <div className="text-xs font-bold font-mono text-emerald-800 uppercase tracking-wide">
                System in Normal Standby
              </div>
              <p className="text-xs text-emerald-900 mt-0.5">
                No active alarms on Floor 07. Ready to initiate emergency declaration or life-safety drill below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mode & Hazard Configuration Controls */}
      <div className="bg-white rounded-2xl p-6 border border-[#B8D8F8] shadow-xs space-y-6">
        <div>
          <h3 className="text-base font-black text-[#0F2537] mb-3">1. Select Operation Mode</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setSelectedMode("drill")}
              className={`p-4 rounded-xl border-2 text-left transition cursor-pointer flex items-center gap-4 ${
                selectedMode === "drill"
                  ? "bg-[#EBF3FB] border-[#005DAA] ring-2 ring-[#005DAA]/20"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-[#005DAA]/10 text-[#005DAA] flex items-center justify-center text-xl shrink-0 font-bold">
                🎯
              </div>
              <div>
                <div className="text-sm font-black text-[#0F2537]">Scheduled Life-Safety Drill</div>
                <div className="text-xs text-[#64748B] mt-0.5">
                  Training exercise. Records muster response times and metrics without 911 dispatch.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMode("incident")}
              className={`p-4 rounded-xl border-2 text-left transition cursor-pointer flex items-center gap-4 ${
                selectedMode === "incident"
                  ? "bg-red-50 border-red-600 ring-2 ring-red-500/20"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center text-xl shrink-0 font-bold">
                🚨
              </div>
              <div>
                <div className="text-sm font-black text-red-950">Active Emergency Incident</div>
                <div className="text-xs text-red-800/80 mt-0.5">
                  Real life-safety threat. Activates critical high-priority broadcast protocols.
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Hazard Selection */}
        <div>
          <h3 className="text-base font-black text-[#0F2537] mb-3">2. Select Hazard Scenario</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
                  className={`p-4 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "border-[#005DAA] bg-[#EBF3FB] shadow-xs ring-2 ring-[#005DAA]/20"
                      : "border-slate-200 bg-white hover:border-slate-300 text-slate-800"
                  }`}
                >
                  <div>
                    <div className="text-2xl mb-2">{haz.icon}</div>
                    <div className="text-xs font-black text-[#0F2537]">{haz.name}</div>
                    <p className="text-[11px] text-[#64748B] mt-1 line-clamp-2">{haz.desc}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200/60 text-[10px] font-mono text-[#005DAA] font-bold">
                    Egress: {haz.recommendedStairwell}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Evacuation Directives & Stairwells */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
              Primary Designated Stairwell (Floor 07)
            </label>
            <select
              value={selectedStairwell}
              onChange={(e) => setSelectedStairwell(e.target.value)}
              className="w-full p-3 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-bold text-[#0F2537] outline-hidden focus:ring-2 focus:ring-[#005DAA]"
            >
              <option value="Stairwell A (East Core - Union Sq East)">Stairwell A (East Core - Union Sq East)</option>
              <option value="Stairwell B (West Core - Irving Pl)">Stairwell B (West Core - Irving Pl)</option>
              <option value="Stairwell C (South Egress)">Stairwell C (South Egress)</option>
              <option value="All Stairwells Available">All Stairwells Available</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
              External Assembly Point Destination
            </label>
            <select
              value={assemblyPoint}
              onChange={(e) => setAssemblyPoint(e.target.value)}
              className="w-full p-3 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-bold text-[#0F2537] outline-hidden focus:ring-2 focus:ring-[#005DAA]"
            >
              <option value="Assembly Point A (Union Sq East / Park Plaza)">
                Assembly Point A (Union Sq East / Park Plaza)
              </option>
              <option value="Assembly Point B (Irving Pl & 14th St)">
                Assembly Point B (Irving Pl &amp; 14th St)
              </option>
              <option value="Assembly Point C (15th St Perimeter)">
                Assembly Point C (15th St Perimeter)
              </option>
            </select>
          </div>
        </div>

        {/* Declaration Action Button */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
          <div className="text-xs text-[#64748B]">
            {isIncidentActive
              ? "Alarm is currently active on Floor 07. Update evacuation settings or proceed directly to Step 04 broadcast."
              : "Activating this alarm sets floor life-safety status, sounds sirens, and seamlessly arms Step 04 broadcast directives."}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleDeclare(false)}
              disabled={isProcessing}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🔔</span>
              <span>{isIncidentActive ? "Update Alarm Only" : "Sound Alarm Only"}</span>
            </button>

            <button
              type="button"
              id="step3-declare-and-proceed-btn"
              onClick={() => handleDeclare(true)}
              disabled={isProcessing}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-xl font-black text-sm uppercase tracking-wider shadow-md transition cursor-pointer flex items-center justify-center gap-2 ${
                selectedMode === "incident"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-[#005DAA] hover:bg-[#004884] text-white"
              }`}
            >
              <span>⚡</span>
              <span>
                {isIncidentActive
                  ? "Proceed to Step 04 Broadcast →"
                  : `Declare & Proceed to Step 04 Broadcast →`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
