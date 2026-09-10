import React, { useState } from "react";
import { StatusSnapshot } from "../types";

interface ExecutiveOnePagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot?: StatusSnapshot | null;
}

export const ExecutiveOnePagerModal: React.FC<ExecutiveOnePagerModalProps> = ({
  isOpen,
  onClose,
  snapshot,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopySummary = async () => {
    const text = `CON EDISON FLOOR 07 · MUSTERCOMMAND EXECUTIVE ONE-PAGER
============================================================
Location: 4 Irving Place, New York, NY · Floor 07
Regulatory Mandate: NYC Fire Code 3 RCNY §401-06 (Fire Safety and Evacuation Plans)

PLATFORM OVERVIEW
MusterCommand is a next-generation life-safety operating system designed to replace archaic paper muster clipboards with real-time smartphone QR ingress, spatial CAD floor accounting, an immutable SHA-256 cryptographic audit ledger, and Google Gemini AI after-action intelligence.

THE 5-STEP LIFE-SAFETY WORKFLOW
1. STEP 01: Scan & Account — Any smartphone on 5G cellular or local Wi-Fi scans official entrance posters to auto-account or register in 10 seconds.
2. STEP 02: Signed-In Floor Roster — Real-time spatial denominator establishing the exact headcount before any alarm is sounded.
3. STEP 03: Alarm & Directive Declaration — Incident commander triggers floor-wide emergency alerts with hazard categorization (Fire, Gas, Smoke, Drill).
4. STEP 04: Real-Time Directives & SitRep Dispatch — Occupants receive live stairwell directives on their phones and transmit SOS distress signals, situation notes, or evacuation chair requests directly to command.
5. STEP 05: 100% Headcount Closure & Sealed Ledger — Tamper-evident ledger sealing with automated NYC FDNY §401-06 certificate generation.

WHAT & HOW AI OPERATES (GOOGLE GEMINI 3.6 FLASH)
• Hash-Grounded After-Action Reports: Analyzes live muster metrics and the raw cryptographic ledger chain to generate formal FDNY compliance narratives with p95 muster duration benchmarks, strictly grounded in ledger block IDs (e.g. Block L-0094) to eliminate hallucinations.
• Natural Language Red-List Query Engine: Translates plain English commander questions ("Show missing visitors in Sector NW", "Who needs an evac chair?") into deterministic roster filters and instant executive summaries.

CORE TECHNOLOGY STACK
• Frontend: React 19, Vite 6, Tailwind CSS v4, Motion, Lucide, HTML5 Canvas 2D Spatial Engine.
• Backend: Node.js (v22+), Express, TypeScript, Server-Sent Events (SSE) real-time push bus.
• Edge Ingress: Cloudflare Quick Tunnels with automated 30s self-healing watchdog for universal cellular access.
• Security: Cryptographic SHA-256 hash chaining (tamper-evident audit blocks), offline IndexedDB action queues.
============================================================`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#07192C]/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-[#B8D8F8] my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Sticky Header */}
        <div className="px-6 py-4 bg-[#003B70] text-white flex items-center justify-between border-b border-[#00274B] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📑</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-wide uppercase">
                  MusterCommand Executive One-Pager
                </h2>
                <span className="bg-emerald-500 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
                  NYC FDNY §401-06
                </span>
              </div>
              <p className="text-xs text-[#829AB8] font-medium">
                Con Edison · 4 Irving Place · Floor 07 Life-Safety &amp; Ingress Platform
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer text-white"
              title="Copy executive summary to clipboard"
            >
              <span>{copied ? "✓" : "📋"}</span>
              <span>{copied ? "Copied!" : "Copy Summary"}</span>
            </button>

            <a
              id="download-one-pager-pdf-btn"
              href="/executive_one_pager.pdf"
              download="ConEdison_Floor07_MusterCommand_OnePager.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-sm"
              title="Download High-Resolution PDF Document"
            >
              <span>📥</span>
              <span className="hidden sm:inline">Download PDF</span>
            </a>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-white text-[#003B70] hover:bg-slate-100 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Print or Save as PDF"
            >
              <span>🖨️</span>
              <span className="hidden sm:inline">Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-base transition cursor-pointer ml-1"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable Printable Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-[#0F2537] text-sm leading-relaxed printable-one-pager">
          {/* Executive Overview Banner */}
          <div className="p-5 bg-gradient-to-br from-[#F0F6FC] via-white to-[#EBF3FB] rounded-2xl border border-[#B8D8F8] space-y-2">
            <div className="text-[10px] font-mono font-bold text-[#005DAA] uppercase tracking-wider">
              Executive Brief · Con Edison Life-Safety Platform
            </div>
            <h3 className="text-lg font-black text-[#003B70]">
              Next-Generation Digital Presence, Muster, and Cryptographic Life-Safety Accounting
            </h3>
            <p className="text-xs text-[#475569] leading-relaxed">
              MusterCommand replaces vulnerable paper clipboards and manual headcounts with an integrated digital workflow. It combines universal smartphone QR scanning (usable by any phone over 5G cellular without app installation), real-time CAD spatial floor mapping, an immutable SHA-256 life-safety audit ledger, and Google Gemini AI intelligence to ensure 100% headcount accountability during drills and structural emergencies.
            </p>
          </div>

          {/* Core Problem & Regulatory Mandate */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-[#CBDCEE] space-y-1.5">
              <div className="flex items-center gap-2 text-[#005DAA] font-bold text-xs">
                <span>🚨</span>
                <span className="uppercase tracking-wider">The Operational Challenge</span>
              </div>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Standard high-rise commercial evacuations rely on static badge-swipe logs and manual paper muster clipboards. Fire Safety Directors lack an exact real-time denominator of who is currently inside the building, leading to inaccurate missing person reports and dangerous search-and-rescue guesswork.
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#CBDCEE] space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                <span>⚖️</span>
                <span className="uppercase tracking-wider">NYC Fire Code Mandate</span>
              </div>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Under <strong>NYC Fire Code 3 RCNY §401-06</strong>, building operators must maintain verifiable, tamper-evident records of evacuation drills, after-action timelines, and Certificates of Fitness. MusterCommand cryptographically seals every life-safety event into an immutable ledger to guarantee full legal non-repudiation.
              </p>
            </div>
          </div>

          {/* The 5-Step Operational Lifecycle */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-[#003B70] uppercase tracking-wider flex items-center gap-2">
              <span>🔄</span>
              <span>The 5-Step Operational Lifecycle</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs">
              <div className="p-3 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl space-y-1">
                <div className="font-mono font-bold text-[#005DAA] text-[10px]">STEP 01</div>
                <div className="font-bold text-[#0F2537]">Scan &amp; Ingress</div>
                <p className="text-[11px] text-slate-500">
                  Phone camera QR scan via 5G Cloudflare tunnel or Wi-Fi auto-checks in staff in 10 seconds.
                </p>
              </div>

              <div className="p-3 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl space-y-1">
                <div className="font-mono font-bold text-[#005DAA] text-[10px]">STEP 02</div>
                <div className="font-bold text-[#0F2537]">Signed-In Roster</div>
                <p className="text-[11px] text-slate-500">
                  Establishes the true headcount denominator across NW, NE, SW, and SE quadrants before alarms.
                </p>
              </div>

              <div className="p-3 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl space-y-1">
                <div className="font-mono font-bold text-[#005DAA] text-[10px]">STEP 03</div>
                <div className="font-bold text-[#0F2537]">Alarm Declaration</div>
                <p className="text-[11px] text-slate-500">
                  FSD triggers emergency state with hazard categorization (Fire, Gas, Smoke, Drill) and floor lockdown.
                </p>
              </div>

              <div className="p-3 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl space-y-1">
                <div className="font-mono font-bold text-[#005DAA] text-[10px]">STEP 04</div>
                <div className="font-bold text-[#0F2537]">Emergency Push</div>
                <p className="text-[11px] text-slate-500">
                  Phones receive live stairwell directives; occupants send SOS signals, notes, and evac chair requests.
                </p>
              </div>

              <div className="p-3 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl space-y-1">
                <div className="font-mono font-bold text-[#005DAA] text-[10px]">STEP 05</div>
                <div className="font-bold text-[#0F2537]">All-Safe &amp; Ledger</div>
                <p className="text-[11px] text-slate-500">
                  100% headcount closure, cryptographic SHA-256 ledger sealing, and official FDNY certificate generation.
                </p>
              </div>
            </div>
          </div>

          {/* What & How the AI Works */}
          <div className="p-5 bg-[#001D3D] text-white rounded-2xl space-y-3.5 border border-[#1E3A60]">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧠</span>
                <h4 className="text-sm font-black uppercase tracking-wider">
                  How &amp; What AI Does in This Platform (Google Gemini 3.6 Flash)
                </h4>
              </div>
              <span className="bg-sky-400/20 text-sky-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full">
                @google/genai v2.4.0
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5 bg-white/5 p-3.5 rounded-xl border border-white/10">
                <span className="font-bold text-sky-300 block text-xs">
                  1. Hash-Grounded After-Action Report Generator (/api/ai/drill-narrative)
                </span>
                <p className="text-[#829AB8] text-[11px] leading-relaxed">
                  Ingests the live headcount snapshot alongside the last 15 raw hash-chained audit ledger blocks. Synthesizes a structured JSON compliance narrative featuring p95 muster statistical benchmarks, evacuation duration, and corrective actions.
                </p>
                <div className="bg-sky-950/60 p-2 rounded text-[10px] font-mono text-sky-200 border border-sky-800/60">
                  🛡️ <strong>Zero Hallucinations:</strong> The narrative cites exact cryptographic block IDs (e.g. Block L-0094). The AI draft is itself hashed and cryptographically bound to the ledger upon FSD Commander approval.
                </div>
              </div>

              <div className="space-y-1.5 bg-white/5 p-3.5 rounded-xl border border-white/10">
                <span className="font-bold text-amber-300 block text-xs">
                  2. Natural Language Red-List Query Engine (/api/ai/redlist-query)
                </span>
                <p className="text-[#829AB8] text-[11px] leading-relaxed">
                  Allows incident commanders and floor wardens to query live rosters using plain spoken English (e.g., <em>"Show me all visitors missing in the Northwest quadrant"</em> or <em>"Who has been unaccounted for over 3 minutes?"</em>).
                </p>
                <div className="bg-amber-950/60 p-2 rounded text-[10px] font-mono text-amber-200 border border-amber-800/60">
                  🎯 <strong>Deterministic Safety:</strong> Gemini translates questions into strict query specifications (quadrant, status, evac chair). Real roster rows are filtered mathematically, ensuring 100% data fidelity.
                </div>
              </div>
            </div>
          </div>

          {/* Complete Technology Stack Matrix */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black text-[#003B70] uppercase tracking-wider flex items-center gap-2">
              <span>💻</span>
              <span>Complete Technology Stack Matrix</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-[#CBDCEE] rounded-xl overflow-hidden">
                <thead className="bg-[#F0F6FC] text-[#475569] font-bold uppercase text-[10px] border-b border-[#CBDCEE]">
                  <tr>
                    <th className="p-2.5">Layer</th>
                    <th className="p-2.5">Technologies</th>
                    <th className="p-2.5">Role &amp; Architectural Responsibility</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  <tr>
                    <td className="p-2.5 font-bold text-[#005DAA]">Frontend UI</td>
                    <td className="p-2.5 font-mono">React 19 · Vite 6 · Tailwind v4 · Lucide</td>
                    <td className="p-2.5 text-slate-600">High-performance Commander console and responsive mobile turnstile pass.</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-[#005DAA]">Spatial Engine</td>
                    <td className="p-2.5 font-mono">HTML5 Canvas 2D · Device Pixel Scaling</td>
                    <td className="p-2.5 text-slate-600">Floor 07 CAD zone map with interactive sector geometry and occupant pins.</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-[#005DAA]">Backend &amp; SSE</td>
                    <td className="p-2.5 font-mono">Node.js 22+ · Express · TypeScript · esbuild</td>
                    <td className="p-2.5 text-slate-600">High-throughput REST API with real-time Server-Sent Events push bus.</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-[#005DAA]">Edge Ingress</td>
                    <td className="p-2.5 font-mono">Cloudflare Quick Tunnel + 30s Watchdog</td>
                    <td className="p-2.5 text-slate-600">Universal public URL enabling instant QR scanning from any 5G phone camera.</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-[#005DAA]">Audit Ledger</td>
                    <td className="p-2.5 font-mono">Crypto SHA-256 Hash Chain</td>
                    <td className="p-2.5 text-slate-600">Tamper-evident life-safety ledger satisfying NYC Fire Code 3 RCNY §401-06.</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-[#005DAA]">AI Engine</td>
                    <td className="p-2.5 font-mono">Google Gemini 3.6 Flash (@google/genai)</td>
                    <td className="p-2.5 text-slate-600">Hash-grounded after-action narratives and natural language roster queries.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Verification & Footprint */}
          <div className="pt-3 border-t border-[#CBDCEE] flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
            <div>
              Platform: <strong>Con Edison Floor 07 MusterCommand</strong> · Version: <strong>2026.1-LIFESAFETY</strong>
            </div>
            <div className="font-mono text-[10px] text-slate-400">
              Active Ledger Height: {snapshot?.ledgerEntries?.length || 30} Blocks · Geofence: 4 Irving Place
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-6 py-3.5 bg-[#F8FAFC] border-t border-[#CBDCEE] flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-medium">
            Press Print / PDF to generate an official shareable one-pager document.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#005DAA] hover:bg-[#004A88] text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
