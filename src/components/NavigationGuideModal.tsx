import React, { useState } from "react";
import { Compass, Shield, Smartphone, Globe, ArrowRight, X } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn select-none">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[#0F2537]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-[#0F2537] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#005DAA] text-white flex items-center justify-center text-lg font-black shadow-xs">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/60">
                  SYSTEM GUIDE &amp; DIRECTORY
                </span>
                <span className="text-[10px] font-mono text-slate-300">v2.4 Production</span>
              </div>
              <h2 className="text-base font-extrabold text-white mt-0.5">
                Platform Navigation &amp; User Role Directory
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center text-sm font-bold transition cursor-pointer"
            title="Close guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 p-2 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab("overview")}
            className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "overview"
                ? "bg-[#005DAA] text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Platform Overview</span>
          </button>
          <button
            onClick={() => setActiveTab("admin")}
            className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "admin"
                ? "bg-[#005DAA] text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>FSD Commander Console (5 Steps)</span>
          </button>
          <button
            onClick={() => setActiveTab("occupant")}
            className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "occupant"
                ? "bg-[#005DAA] text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Occupant &amp; Ingress Portal</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-sm">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-4 sm:p-5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#005DAA]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  TWO INTEGRATED USER EXPERIENCES IN ONE APPLICATION
                </div>
                <h3 className="text-base font-extrabold text-[#0F2537]">
                  Designed for High-Speed Emergency Response &amp; Daily Floor Ingress
                </h3>
                <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                  The MusterCommand Life-Safety platform serves two distinct operational roles at Con Edison 4 Irving Place (Floor 07). Select a mode below to launch it directly:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Admin Card */}
                <div className="bg-white border border-slate-200 hover:border-[#005DAA] rounded-2xl p-5 space-y-3 transition flex flex-col justify-between shadow-xs">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">🛡️</span>
                      <span className="text-[10px] font-mono font-bold text-sky-800 bg-sky-100 px-2 py-0.5 rounded border border-sky-200">
                        FOR COMMANDERS &amp; WARDENS
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-[#0F2537]">FSD Commander Console</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Orchestrates the official 5-Step emergency lifecycle: Floor ingress scans, quadrant headcount census (NW, NE, SW, SE), alarm declarations, multi-channel broadcasts, and cryptographic SHA-256 audit ledger sealing.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onSelectViewMode("admin");
                      onClose();
                    }}
                    className="w-full py-2.5 bg-[#005DAA] hover:bg-[#004884] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <span>Launch Commander Console</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Occupant Card */}
                <div className="bg-white border border-slate-200 hover:border-emerald-500 rounded-2xl p-5 space-y-3 transition flex flex-col justify-between shadow-xs">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">📱</span>
                      <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                        FOR EMPLOYEES &amp; VISITORS
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-[#0F2537]">Occupant Self-Service Portal</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Optimized for smartphones and kiosks: 3-Action Sign-In (Enter / Leave / Muster), digital signature capture, instant QR turnstile pass generation, and offline-resilient emergency reporting.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onSelectViewMode("occupant");
                      onClose();
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <span>Launch Occupant Portal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ADMIN 5 STEPS */}
          {activeTab === "admin" && (
            <div className="space-y-3 animate-fadeIn">
              <div className="text-xs text-slate-500 font-mono font-bold">
                THE 5 OFFICIAL PHASES OF BUILDING EVACUATION &amp; ACCOUNTABILITY:
              </div>

              <div className="space-y-2.5">
                {[
                  { num: "01", title: "Step 01: Scan & Entrance Ingress", desc: "Floor 07 poster QR display, mobile Wi-Fi URL generator, optical badge reader, and manual attendee search.", step: 1, color: "bg-[#005DAA]" },
                  { num: "02", title: "Step 02: Floor 07 Signed-In Roster", desc: "Quadrant census (NW Strategic Planning, NE Gas Ops, SW AMI, SE Steam Ops) and 1-click presence toggling.", step: 2, color: "bg-[#005DAA]" },
                  { num: "03", title: "Step 03: Alarm & Incident Declaration", desc: "Drill & emergency declarations, audible sirens, sector isolation, and life-safety protocol configuration.", step: 3, color: "bg-rose-600" },
                  { num: "04", title: "Step 04: Broadcast & Muster Triage", desc: "Push emergency SMS / Voice / In-App alerts, Assembly Point A & B queues, and 1-Click Digital Sweeps.", step: 4, color: "bg-amber-600" },
                  { num: "05", title: "Step 05: All Safe & Cryptographic Audit Ledger", desc: "Accountability verification, SHA-256 blockchain sealing, compliance certificate, and JSON audit export.", step: 5, color: "bg-emerald-600" },
                ].map((s) => (
                  <div key={s.num} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg ${s.color} text-white flex items-center justify-center font-bold text-xs shrink-0`}>
                        {s.num}
                      </div>
                      <div>
                        <h4 className="font-bold text-[#0F2537] text-sm">{s.title}</h4>
                        <p className="text-xs text-slate-600 mt-0.5">{s.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        onSelectViewMode("admin");
                        if (onSelectStep) onSelectStep(s.step);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-[#005DAA] hover:bg-[#004A88] text-white font-bold text-xs rounded-lg transition cursor-pointer shrink-0"
                    >
                      Jump to Step {s.num}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: OCCUPANT PORTAL */}
          {activeTab === "occupant" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 sm:p-5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  OCCUPANT SELF-SERVICE WORKFLOW
                </div>
                <h3 className="text-base font-extrabold text-[#0F2537]">How Employees &amp; Visitors Sign In</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2">
                  <div className="bg-white p-3 rounded-xl border border-emerald-200 space-y-1 shadow-2xs">
                    <div className="font-bold text-emerald-800">🟢 1. Entering Building</div>
                    <div className="text-slate-600">
                      Records presence on Floor 07 and allocates a digital pass with scannable turnstile QR.
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-amber-200 space-y-1 shadow-2xs">
                    <div className="font-bold text-amber-800">⚪ 2. Leaving Building</div>
                    <div className="text-slate-600">
                      Badges occupant out so they are not expected on the floor during emergency roll-calls.
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-sky-200 space-y-1 shadow-2xs">
                    <div className="font-bold text-sky-800">🚨 3. Muster Check-In</div>
                    <div className="text-slate-600">
                      Self-reports safety from Assembly Point A (4 Irving Pl) or Assembly Point B (Union Sq).
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-1.5">
                <div className="font-bold text-slate-800">📡 Offline-Resilient Pass Generator</div>
                <div className="text-slate-600 leading-relaxed">
                  If the building Wi-Fi or cellular signal drops, the Occupant Portal automatically generates a local temporary profile (<code className="text-amber-800 font-bold font-mono">OCC-OFF-xxx</code>), records legal digital signatures, and queues all attendance mutations for automatic synchronization upon reconnection.
                </div>
              </div>

              <button
                onClick={() => {
                  onSelectViewMode("occupant");
                  onClose();
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <span>Launch Occupant Portal Now</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Active Mode: <strong className="text-slate-800 uppercase">{currentMode}</strong> · Step: <strong className="text-slate-800">{currentStep}/5</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
