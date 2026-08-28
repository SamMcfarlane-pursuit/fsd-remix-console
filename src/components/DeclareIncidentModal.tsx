import { useState } from "react";
import { StatusSnapshot } from "../types";

interface DeclareIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: StatusSnapshot | null;
  onDeclareIncident: (mode: "drill" | "incident", type: string) => Promise<void>;
  onClearIncident: () => Promise<void>;
}

export default function DeclareIncidentModal({
  isOpen,
  onClose,
  snapshot,
  onDeclareIncident,
  onClearIncident,
}: DeclareIncidentModalProps) {
  const [mode, setMode] = useState<"drill" | "incident">(snapshot?.mode === "incident" ? "incident" : "drill");
  const [hazardType, setHazardType] = useState<string>(snapshot?.hazardType || "office-fire");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleExecuteDeclare = async () => {
    setIsSubmitting(true);
    try {
      await onDeclareIncident(mode, hazardType);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecuteClear = async () => {
    setIsSubmitting(true);
    try {
      await onClearIncident();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/65 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border-2 border-[#005DAA] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-[#0F2537] flex flex-col">
        {/* Header */}
        <div className={`p-4 sm:p-5 text-white flex items-center justify-between border-b ${
          mode === "incident" ? "bg-red-800 border-red-900" : "bg-[#003B70] border-[#005DAA]"
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-pulse">{mode === "incident" ? "🚨" : "🔔"}</span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#B8D8F8]">
                FSD EMERGENCY COMMAND CONSOLE
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                {snapshot?.incidentActive ? "Active Incident Control & Mode" : "Declare Incident or Scheduled Drill"}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          {/* Mode Selector Radio Pills */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#005DAA] mb-2">
              Select Declaration Mode:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode("drill")}
                className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${
                  mode === "drill"
                    ? "bg-[#EBF5FB] border-[#005DAA] text-[#005DAA] font-black shadow-xs"
                    : "bg-[#F0F6FC] border-[#B8D8F8] text-[#475569] font-bold hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>🟡</span>
                  <span className="text-xs uppercase tracking-wide">Scheduled Drill</span>
                </div>
                <p className="text-[11px] font-normal text-[#475569] mt-1">
                  Training exercise, compliance timer, and after-action report generation.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode("incident")}
                className={`p-3 rounded-xl border-2 text-left transition cursor-pointer ${
                  mode === "incident"
                    ? "bg-red-50 border-red-600 text-red-950 font-black shadow-xs"
                    : "bg-[#F0F6FC] border-[#B8D8F8] text-[#475569] font-bold hover:bg-white"
                }`}
              >
                <div className="flex items-center gap-2 text-red-700">
                  <span>🔴</span>
                  <span className="text-xs uppercase tracking-wide">Live Emergency</span>
                </div>
                <p className="text-[11px] font-normal text-[#475569] mt-1">
                  Real life-safety incident, critical sirens, and FDNY push broadcast.
                </p>
              </button>
            </div>
          </div>

          {/* Hazard Type Selector */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#005DAA] mb-1.5">
              Hazard Classification:
            </label>
            <select
              value={hazardType}
              onChange={(e) => setHazardType(e.target.value)}
              className="w-full bg-[#F0F6FC] border border-[#B8D8F8] rounded-xl p-2.5 text-xs font-bold text-[#0F2537] focus:outline-none focus:bg-white focus:border-[#005DAA]"
            >
              <option value="office-fire">🔥 Office Fire / Smoke Condition (Floor 07)</option>
              <option value="active-shooter">🛡️ Active Threat / Lockdown Protocol</option>
              <option value="hazmat">☣️ HazMat / Chemical Release</option>
              <option value="power-failure">⚡ Power Substation Grid Failure</option>
              <option value="severe-weather">🌪️ Severe Weather / Tornado Shelter</option>
            </select>
          </div>

          {/* Target Impact Summary */}
          <div className="p-3 bg-[#EBF5FB] border border-[#B8D8F8] rounded-xl text-xs space-y-1">
            <div className="font-bold text-[#005DAA] flex items-center justify-between">
              <span>Target Scope: Floor 07 (All 4 Quadrants)</span>
              <span className="font-mono">{snapshot?.expectedOnFloor || 200} Expected Occupants</span>
            </div>
            <p className="text-[#475569]">
              Declaring will immediately notify all wardens and mobile occupants with dynamic safest staircase instructions.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#F0F6FC] border-t border-[#B8D8F8] p-4 flex items-center justify-between gap-3">
          {snapshot?.incidentActive ? (
            <button
              type="button"
              onClick={handleExecuteClear}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-black uppercase transition cursor-pointer"
            >
              Stand Down / Clear Incident
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleExecuteDeclare}
            disabled={isSubmitting}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase text-white transition cursor-pointer shadow-md ${
              mode === "incident" ? "bg-red-700 hover:bg-red-800" : "bg-[#005DAA] hover:bg-[#004A88]"
            }`}
          >
            {isSubmitting ? "Transmitting..." : `Declare ${mode.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
