import React, { useState } from "react";

interface NavigationGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectViewMode: (mode: "admin" | "occupant") => void;
  onSelectStep?: (stepNumber: number) => void;
  currentStep?: number;
  currentMode?: "admin" | "occupant";
}

export const NavigationGuideModal: React.FC<NavigationGuideModalProps> = ({
  isOpen,
  onClose,
  onSelectViewMode,
  onSelectStep,
  currentStep = 1,
  currentMode = "admin",
}) => {
  const [activeTab, setActiveTab] = useState<"admin" | "occupant" | "overview">("overview");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#0B172B] border border-[#1E3A60] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-white">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-[#1E3A60] bg-[#071324] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#005DAA] text-white flex items-center justify-center text-xl font-black shadow-inner">
              🧭
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-black uppercase tracking-wider text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">
                  SYSTEM GUIDE &amp; DIRECTORY
                </span>
                <span className="text-[10px] font-mono text-slate-400">v2.4 Production</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                Platform Navigation &amp; User Role Directory
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#1E3A60] bg-[#08172C] p-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex-1 py-2.5 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "overview"
                ? "bg-[#005DAA] text-white shadow-md font-black"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <span>🌐</span>
            <span>Platform Overview</span>
          </button>
          <button
            onClick={() => setActiveTab("admin")}
            className={`flex-1 py-2.5 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "admin"
                ? "bg-[#005DAA] text-white shadow-md font-black"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <span>🛡️</span>
            <span>Admin / Commander Deck (5 Steps)</span>
          </button>
          <button
            onClick={() => setActiveTab("occupant")}
            className={`flex-1 py-2.5 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "occupant"
                ? "bg-[#005DAA] text-white shadow-md font-black"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <span>📱</span>
            <span>Occupant &amp; Ingress Portal</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-sm">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-fadeIn">
              <div className="bg-[#0F253E] border border-[#1E4370] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-sky-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  TWO INTEGRATED USER EXPERIENCES IN ONE APPLICATION
                </div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Designed for High-Speed Emergency Response &amp; Daily Floor Ingress
                </h3>
                <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                  The MusterCommand Life-Safety platform serves two distinct user audiences at Con Edison 4 Irving Place (Floor 07). Select a mode below to launch it directly:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Admin Card */}
                <div className="bg-[#0A1A2E] border border-[#1E3A60] hover:border-[#005DAA] rounded-2xl p-5 space-y-3 transition flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">🛡️</span>
                      <span className="text-[10px] font-mono font-bold text-sky-300 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                        FOR COMMANDERS &amp; WARDENS
                      </span>
                    </div>
                    <h4 className="text-base font-black text-white">FSD Commander Console</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Orchestrates the official 5-Step emergency lifecycle: Floor ingress scans, quadrant headcount census (NW, NE, SW, SE), alarm declarations, multi-channel broadcasts, and cryptographic SHA-256 audit ledger sealing.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onSelectViewMode("admin");
                      onClose();
                    }}
                    className="w-full py-2.5 bg-[#005DAA] hover:bg-[#004884] text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    <span>Launch Commander Console</span>
                    <span>→</span>
                  </button>
                </div>

                {/* Occupant Card */}
                <div className="bg-[#0A1A2E] border border-[#1E3A60] hover:border-emerald-500 rounded-2xl p-5 space-y-3 transition flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">📱</span>
                      <span className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        FOR EMPLOYEES &amp; VISITORS
                      </span>
                    </div>
                    <h4 className="text-base font-black text-white">Occupant Self-Service Portal</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Optimized for smartphones and kiosks: 3-Action Sign-In (Enter / Leave / Muster), digital signature capture, instant QR turnstile pass generation, and offline-resilient emergency reporting.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onSelectViewMode("occupant");
                      onClose();
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    <span>Launch Occupant Portal</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ADMIN 5 STEPS */}
          {activeTab === "admin" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="text-xs text-slate-400 font-mono">
                THE 5 OFFICIAL PHASES OF BUILDING EVACUATION &amp; ACCOUNTABILITY:
              </div>

              <div className="space-y-3">
                {/* Step 1 */}
                <div className="bg-[#0F253E] border border-[#1E3A60] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#005DAA] text-white flex items-center justify-center font-black text-xs shrink-0">
                      01
                    </div>
                    <div>
                      <h4 className="font-black text-white text-sm">Step 01: Scan &amp; Entrance Ingress</h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Floor 07 poster QR display, mobile Wi-Fi URL generator, optical badge reader, and manual attendee search.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onSelectViewMode("admin");
                      if (onSelectStep) onSelectStep(1);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
                  >
                    Jump to Step 01
                  </button>
                </div>

                {/* Step 2 */}
                <div className="bg-[#0F253E] border border-[#1E3A60] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#005DAA] text-white flex items-center justify-center font-black text-xs shrink-0">
                      02
                    </div>
                    <div>
                      <h4 className="font-black text-white text-sm">Step 02: Floor 07 Signed-In Roster</h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Quadrant census (NW Strategic Planning, NE Gas Ops, SW AMI, SE Steam Ops) and 1-click presence toggling.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onSelectViewMode("admin");
                      if (onSelectStep) onSelectStep(2);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
                  >
                    Jump to Step 02
                  </button>
                </div>

                {/* Step 3 */}
                <div className="bg-[#0F253E] border border-[#1E3A60] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                      03
                    </div>
                    <div>
                      <h4 className="font-black text-white text-sm">Step 03: Alarm &amp; Incident Declaration</h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Drill &amp; emergency declarations, audible sirens, sector isolation, and Gemini 3.6 Flash red-list queries.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onSelectViewMode("admin");
                      if (onSelectStep) onSelectStep(3);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
                  >
                    Jump to Step 03
                  </button>
                </div>

                {/* Step 4 */}
                <div className="bg-[#0F253E] border border-[#1E3A60] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                      04
                    </div>
                    <div>
                      <h4 className="font-black text-white text-sm">Step 04: Broadcast &amp; Muster Triage</h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Push emergency SMS / Voice / In-App alerts, Assembly Point A &amp; B queues, and 1-Click Digital Sweeps.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onSelectViewMode("admin");
                      if (onSelectStep) onSelectStep(4);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
                  >
                    Jump to Step 04
                  </button>
                </div>

                {/* Step 5 */}
                <div className="bg-[#0F253E] border border-[#1E3A60] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                      05
                    </div>
                    <div>
                      <h4 className="font-black text-white text-sm">Step 05: All Safe &amp; Cryptographic Audit Ledger</h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Accountability verification, SHA-256 block chain sealing, compliance certificate, and JSON audit export.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onSelectViewMode("admin");
                      if (onSelectStep) onSelectStep(5);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
                  >
                    Jump to Step 05
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OCCUPANT PORTAL */}
          {activeTab === "occupant" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-[#0F253E] border border-[#1E3A60] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  OCCUPANT SELF-SERVICE WORKFLOW
                </div>
                <h3 className="text-base font-black text-white">How Employees &amp; Visitors Sign In</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
                  <div className="bg-[#071324] p-3 rounded-xl border border-[#1E3A60] space-y-1">
                    <div className="font-black text-emerald-400">🟢 1. Entering Building</div>
                    <div className="text-slate-300">
                      Records presence on Floor 07 and allocates a digital pass with scannable turnstile QR.
                    </div>
                  </div>
                  <div className="bg-[#071324] p-3 rounded-xl border border-[#1E3A60] space-y-1">
                    <div className="font-black text-amber-400">⚪ 2. Leaving Building</div>
                    <div className="text-slate-300">
                      Badges occupant out so they are not expected on the floor during emergency roll-calls.
                    </div>
                  </div>
                  <div className="bg-[#071324] p-3 rounded-xl border border-[#1E3A60] space-y-1">
                    <div className="font-black text-sky-400">🚨 3. Muster Check-In</div>
                    <div className="text-slate-300">
                      Self-reports safety from Assembly Point A (4 Irving Pl) or Assembly Point B (Union Sq).
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#071324] border border-[#1E3A60] rounded-xl p-4 text-xs space-y-2">
                <div className="font-black text-sky-400">📡 Offline-Resilient Pass Generator</div>
                <div className="text-slate-300 leading-relaxed">
                  If the building Wi-Fi or cellular signal drops, the Occupant Portal automatically generates a local temporary profile (<code className="text-amber-300 font-bold font-mono">OCC-OFF-xxx</code>), records legal digital signatures, and queues all attendance mutations for automatic synchronization upon reconnection.
                </div>
              </div>

              <button
                onClick={() => {
                  onSelectViewMode("occupant");
                  onClose();
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-md"
              >
                <span>Launch Occupant Portal Now</span>
                <span>→</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#1E3A60] bg-[#071324] flex items-center justify-between text-xs">
          <span className="text-slate-400">
            Active Mode: <strong className="text-white uppercase">{currentMode}</strong> · Step: <strong className="text-white">{currentStep}/5</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
