import React, { useState } from "react";
import { EmergencyProtocolConfig, StatusSnapshot } from "../types";

interface EmergencyProtocolModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProtocol?: EmergencyProtocolConfig;
  onProtocolSaved?: (updated: EmergencyProtocolConfig) => void;
}

export const EmergencyProtocolModal: React.FC<EmergencyProtocolModalProps> = ({
  isOpen,
  onClose,
  currentProtocol,
  onProtocolSaved,
}) => {
  const [emergencyTitle, setEmergencyTitle] = useState(
    currentProtocol?.emergencyTitle || "RED ALERT: EMERGENCY BUILDING EVACUATION IN PROGRESS"
  );
  const [customBannerText, setCustomBannerText] = useState(
    currentProtocol?.customEmergencyBannerText || "ACTIVE EMERGENCY EVACUATION DECLARED · FLOOR 07"
  );
  const [broadcastDirective, setBroadcastDirective] = useState(
    currentProtocol?.broadcastDirectiveText ||
      "Attention Floor 07 occupants: Immediate evacuation is ordered. Do not use elevators. Proceed to designated stairwells and report to your assigned outdoor muster assembly point."
  );
  const [elevatorDirective, setElevatorDirective] = useState(
    currentProtocol?.elevatorPhase1Directive ||
      "NYC Fire Code Phase I Emergency Recall: All elevator banks are locked out and grounded to Lobby 1 with doors parked open. Hoistway vents are pressurized open."
  );
  const [musterInstructions, setMusterInstructions] = useState(
    currentProtocol?.musterPointInstructions ||
      "Report to Assembly Point A (Park Plaza · East 14th) for Sectors NW/NE, or Assembly Point B (Courtyard · East 15th) for Sectors SW/SE. Maintain minimum 150m building clearance."
  );
  const [sarProcedure, setSarProcedure] = useState(
    currentProtocol?.sarDeploymentProcedure ||
      "Search & Rescue Squad dispatched to pinpoint coordinates. Wardens sweep assigned quadrants. Stryker Evacuation Chair deploy to Stairwell A landing."
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (presetType: "standard" | "severe" | "drill" | "shelter") => {
    if (presetType === "standard") {
      setEmergencyTitle("RED ALERT: EMERGENCY BUILDING EVACUATION IN PROGRESS");
      setCustomBannerText("ACTIVE EMERGENCY EVACUATION DECLARED · FLOOR 07");
      setBroadcastDirective(
        "Attention Floor 07 occupants: Immediate evacuation is ordered. Do not use elevators. Proceed to designated stairwells and report to your assigned outdoor muster assembly point."
      );
      setElevatorDirective(
        "NYC Fire Code Phase I Emergency Recall: All elevator banks are locked out and grounded to Lobby 1 with doors parked open."
      );
      setMusterInstructions(
        "Report to Assembly Point A (Park Plaza · East 14th) for Sectors NW/NE, or Assembly Point B (Courtyard · East 15th) for Sectors SW/SE. Maintain minimum 150m building clearance."
      );
    } else if (presetType === "severe") {
      setEmergencyTitle("CRITICAL RED ALERT: RAPID EXTRACTION & EVACUATION MANDATED");
      setCustomBannerText("CRITICAL LIFE-SAFETY HAZARD DETECTED · EVACUATE IMMEDIATELY");
      setBroadcastDirective(
        "CRITICAL ALERT: Rapid emergency evacuation in effect. Proceed immediately to nearest stairwell fire door. Do not stop for belongings. Wardens sweep corridor."
      );
      setElevatorDirective(
        "EMERGENCY OVERRIDE: Elevators locked out. High-velocity shaft pressurization engaged. Fire stairwells only."
      );
      setMusterInstructions(
        "Proceed past standard perimeter to Outer Assembly Area (Union Square Park Center). Maintain 250m clearance from building facade."
      );
    } else if (presetType === "drill") {
      setEmergencyTitle("LIFE-SAFETY MUSTER DRILL: CONTROLLED EVACUATION SIMULATION");
      setCustomBannerText("SCHEDULED DRILL IN PROGRESS · CON EDISON FLOOR 07");
      setBroadcastDirective(
        "Attention Floor 07 occupants: This is a scheduled evacuation muster drill. Proceed calmly via assigned stairwells to your designated outdoor assembly area. Tap Safe Outside when arrived."
      );
      setElevatorDirective(
        "Drill Protocol: Elevators placed in simulated Phase 1 recall. All personnel must practice stairwell egress."
      );
      setMusterInstructions(
        "Report to Assembly Point A (Park Plaza) or Assembly Point B (Courtyard) for digital check-in scanner verification."
      );
    } else if (presetType === "shelter") {
      setEmergencyTitle("SHELTER-IN-PLACE ADVISORY: EXTERNAL HAZARD DETECTED");
      setCustomBannerText("SHELTER-IN-PLACE ORDER · REMAIN WITHIN INTERIOR SECTORS");
      setBroadcastDirective(
        "Advisory Floor 07 occupants: External street hazard reported. Do not exit building. Move away from perimeter glass into interior office core and designated conference suites."
      );
      setElevatorDirective(
        "Elevator banks held at Ground Lobby. Stairwell access restricted to emergency wardens only."
      );
      setMusterInstructions(
        "Remain inside building Floor 07 Interior Core until FDNY All-Clear is officially broadcasted."
      );
    }
  };

  const handleSaveProtocol = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/protocol/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-fsd-pin": "7007",
        },
        body: JSON.stringify({
          emergencyTitle,
          customEmergencyBannerText: customBannerText,
          broadcastDirectiveText: broadcastDirective,
          elevatorPhase1Directive: elevatorDirective,
          musterPointInstructions: musterInstructions,
          sarDeploymentProcedure: sarProcedure,
          adminName: "Fire Command Center Director",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSaveSuccess("✅ Emergency protocols and custom text updated and broadcasted across all devices!");
        if (onProtocolSaved && data.protocol) {
          onProtocolSaved(data.protocol);
        }
        setTimeout(() => {
          setSaveSuccess(null);
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error("Save protocol error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-2xl w-full border-2 border-[#005DAA] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#003B70] text-white p-5 flex items-center justify-between border-b border-sky-600">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 text-white font-black text-xl flex items-center justify-center shrink-0">
              ⚙️
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">
                Emergency Protocol &amp; Directive Customization
              </h3>
              <p className="text-xs text-sky-200">
                NYC Fire Code 3 RCNY §401-06 · Con Edison 4 Irving Pl Floor 07
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white font-black text-sm transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-[#0F2537]">
          {/* Quick Preset Selector Buttons */}
          <div className="bg-[#F0F6FC] p-3 rounded-2xl border border-[#CBDCEE] space-y-2">
            <span className="text-[10px] font-mono font-black uppercase text-[#005DAA] tracking-wider block">
              1-Click Standard Protocol Presets:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleApplyPreset("standard")}
                className="p-2 bg-white hover:bg-sky-50 border border-sky-300 rounded-xl font-bold text-[11px] text-[#005DAA] transition cursor-pointer text-center"
              >
                🔥 Standard Fire
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("severe")}
                className="p-2 bg-white hover:bg-red-50 border border-red-300 rounded-xl font-bold text-[11px] text-red-700 transition cursor-pointer text-center"
              >
                🚨 Critical Rapid
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("drill")}
                className="p-2 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-xl font-bold text-[11px] text-emerald-800 transition cursor-pointer text-center"
              >
                🎯 Muster Drill
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("shelter")}
                className="p-2 bg-white hover:bg-amber-50 border border-amber-300 rounded-xl font-bold text-[11px] text-amber-800 transition cursor-pointer text-center"
              >
                🛡️ Shelter Core
              </button>
            </div>
          </div>

          {/* Field 1: Red Alert Headline */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold uppercase text-slate-600 block">
              Red Alert Headline Title:
            </label>
            <input
              type="text"
              value={emergencyTitle}
              onChange={(e) => setEmergencyTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CBDCEE] rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-[#005DAA] focus:ring-1 focus:ring-[#005DAA]"
              placeholder="e.g., RED ALERT: EMERGENCY BUILDING EVACUATION IN PROGRESS"
            />
          </div>

          {/* Field 2: Custom Emergency Banner Text */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold uppercase text-slate-600 block">
              Custom Status Banner Text (Displayed across Console &amp; Devices):
            </label>
            <input
              type="text"
              value={customBannerText}
              onChange={(e) => setCustomBannerText(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CBDCEE] rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-[#005DAA] focus:ring-1 focus:ring-[#005DAA]"
              placeholder="e.g., ACTIVE EMERGENCY EVACUATION DECLARED · FLOOR 07"
            />
          </div>

          {/* Field 3: Multi-Channel Broadcast Directive Message */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold uppercase text-slate-600 block">
              Multi-Channel Broadcast Directive Text (Pushed to Mobile Phones &amp; Displays):
            </label>
            <textarea
              rows={3}
              value={broadcastDirective}
              onChange={(e) => setBroadcastDirective(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CBDCEE] rounded-xl text-xs text-slate-900 outline-none focus:border-[#005DAA] focus:ring-1 focus:ring-[#005DAA] resize-none"
              placeholder="Enter speech & SMS evacuation directive..."
            />
          </div>

          {/* Field 4: Elevator Phase 1 Recall Directive */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold uppercase text-slate-600 block">
              Elevator Phase I Recall Directive &amp; Warning Text:
            </label>
            <textarea
              rows={2}
              value={elevatorDirective}
              onChange={(e) => setElevatorDirective(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CBDCEE] rounded-xl text-xs text-slate-900 outline-none focus:border-[#005DAA] focus:ring-1 focus:ring-[#005DAA] resize-none"
              placeholder="NYC Fire Code Phase I instructions..."
            />
          </div>

          {/* Field 5: Outdoor Muster Assembly Instructions */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold uppercase text-slate-600 block">
              Outdoor Muster Points Instructions (Assembly Point A &amp; B Routing):
            </label>
            <textarea
              rows={2}
              value={musterInstructions}
              onChange={(e) => setMusterInstructions(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CBDCEE] rounded-xl text-xs text-slate-900 outline-none focus:border-[#005DAA] focus:ring-1 focus:ring-[#005DAA] resize-none"
              placeholder="Assembly point routing instructions..."
            />
          </div>

          {/* Field 6: Search & Rescue (SAR) Procedure */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold uppercase text-slate-600 block">
              Search &amp; Rescue (SAR) &amp; Stryker Evacuation Chair Dispatch Procedure:
            </label>
            <textarea
              rows={2}
              value={sarProcedure}
              onChange={(e) => setSarProcedure(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#CBDCEE] rounded-xl text-xs text-slate-900 outline-none focus:border-[#005DAA] focus:ring-1 focus:ring-[#005DAA] resize-none"
              placeholder="Rescue procedure protocols..."
            />
          </div>

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold animate-fadeIn">
              {saveSuccess}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#F8FAFC] p-4 border-t border-[#CBDCEE] flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono">
            {currentProtocol?.lastEditedAt ? `Last updated: ${currentProtocol.lastEditedAt}` : "Customizable Live"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveProtocol}
              disabled={isSaving}
              className="px-5 py-2 bg-[#005DAA] hover:bg-[#004884] disabled:opacity-50 text-white font-black rounded-xl transition cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <span>💾</span>
              <span>{isSaving ? "Saving..." : "Save & Broadcast Updates"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
