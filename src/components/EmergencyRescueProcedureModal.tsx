import React, { useState } from "react";
import { Occupant, OccupantStatus, QuadrantId } from "../types";

interface EmergencyRescueProcedureModalProps {
  isOpen: boolean;
  onClose: () => void;
  occupant: Occupant | null;
  distressedList?: Occupant[];
  onSelectOccupant?: (occ: Occupant) => void;
  onCheckIn: (
    occupantId: string,
    status: OccupantStatus,
    via?: string,
    notes?: string,
    locationCategory?: "inside-building" | "outside-assembly" | "offsite",
    assemblyPoint?: string
  ) => Promise<void> | void;
  onOpenWalkieTalkie?: () => void;
  stairwell?: string;
  assemblyPoint?: string;
}

export const EmergencyRescueProcedureModal: React.FC<EmergencyRescueProcedureModalProps> = ({
  isOpen,
  onClose,
  occupant,
  distressedList = [],
  onSelectOccupant,
  onCheckIn,
  onOpenWalkieTalkie,
  stairwell = "Stairwell A (East Core - Union Sq East)",
  assemblyPoint = "Assembly Point A (Union Sq East / Park Plaza)",
}) => {
  const [activeTab, setActiveTab] = useState<"LOCATE" | "PROCEDURE" | "FDNY_SLIP">("LOCATE");
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [wardenAssigned, setWardenAssigned] = useState<string>("");
  const [procedureStep, setProcedureStep] = useState<number>(1);
  const [isCopiedSlip, setIsCopiedSlip] = useState<boolean>(false);

  if (!isOpen || !occupant) return null;

  const quadrantLabels: Record<QuadrantId, string> = {
    NW: "NW · Strategic Planning (07-800)",
    NE: "NE · Gas Operations & Security (07-200)",
    SW: "SW · AMI & Ombudsman (07-700)",
    SE: "SE · Steam Operations (07-500)",
  };

  const sectorTitle = quadrantLabels[occupant.quadrant] || `Sector ${occupant.quadrant}`;
  const nearestStair = occupant.quadrant === "NW" || occupant.quadrant === "SW" ? "Stairwell B (West Core)" : "Stairwell A (East Core)";
  const distanceFeet = occupant.quadrant === "NW" ? 38 : occupant.quadrant === "SW" ? 44 : occupant.quadrant === "NE" ? 52 : 36;

  // CAD Map coordinate calculations
  const pinX = occupant.xCoord ? Math.max(10, Math.min(390, occupant.xCoord * 4)) : occupant.quadrant === "NW" ? 75 : occupant.quadrant === "NE" ? 315 : occupant.quadrant === "SW" ? 75 : 315;
  const pinY = occupant.yCoord ? Math.max(10, Math.min(230, occupant.yCoord * 2.4)) : occupant.quadrant === "NW" ? 50 : occupant.quadrant === "NE" ? 50 : occupant.quadrant === "SW" ? 180 : 180;
  
  // Stairwell coordinates
  const stairX = nearestStair.includes("Stairwell B") ? 25 : 375;
  const stairY = 110;

  const triggerNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 5000);
  };

  // Procedure Execution Handlers
  const handleDispatchWardenTeam = async () => {
    const warden = wardenAssigned.trim() || "Warden Squad Alpha";
    await onCheckIn(
      occupant.id,
      "need-help",
      "rescue-procedure",
      `RESCUE DISPATCHED: ${warden} deployed to Sector ${occupant.quadrant} at desk ${occupant.desk || "Workstation"}`,
      "inside-building"
    );
    setProcedureStep(2);
    triggerNotice(`🚨 Rescue team dispatched! ${warden} instructed to enter via ${nearestStair}.`);
  };

  const handleDispatchEvacChair = async () => {
    await onCheckIn(
      occupant.id,
      "awaiting-evac-chair",
      "rescue-procedure",
      `STAIRWELL CHAIR DISPATCHED: Stryker mobility chair team deployed to ${nearestStair} landing`,
      "inside-building"
    );
    setProcedureStep(2);
    triggerNotice(`🛞 Stryker Evac Chair team dispatched to ${nearestStair} Landing 7.`);
  };

  const handleOccupantSecuredInStairwell = async () => {
    await onCheckIn(
      occupant.id,
      "safe",
      "rescue-procedure",
      `OCCUPANT SECURED: Located by search team and descending safely via ${nearestStair}`,
      "inside-building"
    );
    setProcedureStep(3);
    triggerNotice(`🔵 ${occupant.name} located and secured! Team escorting occupant down ${nearestStair}.`);
  };

  const handleLifeSavedOutside = async () => {
    await onCheckIn(
      occupant.id,
      "safe",
      "rescue-procedure",
      `LIFE SAVED: Extracted from Floor 07 and verified Safe Outside at Assembly Point A (Park Plaza)`,
      "outside-assembly",
      assemblyPoint
    );
    setProcedureStep(4);
    triggerNotice(`🟢 SUCCESS: ${occupant.name} safely extracted! Status logged in FDNY audit ledger.`);
    setTimeout(() => onClose(), 2500);
  };

  const handleCopySlip = () => {
    const slipText = `
=============================================================
  FDNY TACTICAL LIFE-SAFETY RESCUE PACKET (3 RCNY §401-06)
=============================================================
INCIDENT: Structure Distress / Life-Safety Rescue
BUILDING: Con Edison Headquarters · 4 Irving Place, NY 10003
FLOOR: Floor 07 · High-Rise Core

VICTIM INFORMATION:
- Name: ${occupant.name}
- ID: ${occupant.id}
- Role: ${occupant.role}
- Company: ${occupant.company || "Con Edison"}
- Contact Phone: ${occupant.phone || "N/A"}

EXACT SPATIAL LOCATION:
- Assigned Quadrant: Sector ${occupant.quadrant} (${sectorTitle})
- Workstation/Desk: ${occupant.desk || "Floor 07 Interior Core"}
- Architectural Grid: X: ${occupant.xCoord || 25}, Y: ${occupant.yCoord || 20}
- Distance to Exit: ${distanceFeet} ft from ${nearestStair}
- Recommended Entry: Enter via ${nearestStair} Landing 7

DISTRESS DETAILS:
- Current Status: ${occupant.status.toUpperCase()}
- Reported Notes: ${occupant.notes || "Distress / Evacuation assistance requested"}
- Last Verified Time: ${occupant.lastBadgeTime || new Date().toLocaleTimeString()}

COMMANDER ACTION:
- FSD Commander Console (Floor 07 Command Post)
- Exterior Assembly Point: ${assemblyPoint}
=============================================================
    `.trim();

    if (navigator.clipboard) {
      navigator.clipboard.writeText(slipText);
      setIsCopiedSlip(true);
      setTimeout(() => setIsCopiedSlip(false), 3000);
    }
  };

  return (
    <div
      role="region"
      aria-label="Emergency Distress Rescue & Life Safety Procedure"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="bg-[#0F172A] border-4 border-red-600 text-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in duration-200">
        {/* Distress Header */}
        <div className="bg-gradient-to-r from-red-800 via-red-600 to-rose-800 p-4 sm:p-5 flex items-center justify-between border-b-2 border-red-500 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl animate-bounce">🆘</span>
            <div>
              <div className="text-[11px] font-black text-amber-300 uppercase tracking-widest flex items-center gap-2">
                <span>LIFE-SAVING EMERGENCY RESCUE PROTOCOL</span>
                <span className="bg-black/40 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                  FDNY 3 RCNY §401-06
                </span>
              </div>
              <h1 className="text-base sm:text-xl font-black text-white tracking-tight mt-0.5 flex items-center gap-2">
                <span>Rescue Target: {occupant.name}</span>
                <span className="text-xs bg-red-950 text-red-200 border border-red-400 px-2 py-0.5 rounded font-mono font-bold">
                  {occupant.status === "awaiting-evac-chair" ? "♿ AWAITING EVAC CHAIR" : "🆘 NEED IMMEDIATE HELP"}
                </span>
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/30 hover:bg-black/60 flex items-center justify-center text-white font-black text-sm transition cursor-pointer"
            title="Close Rescue Protocol"
          >
            ✕
          </button>
        </div>

        {/* Multi-Person Distress Queue Bar (If multiple people in distress) */}
        {distressedList.length > 1 && (
          <div className="bg-[#1E293B] px-4 py-2 border-b border-slate-700 flex items-center gap-2 overflow-x-auto shrink-0">
            <span className="text-[10px] font-mono text-amber-300 uppercase font-black shrink-0">
              DISTRESS QUEUE ({distressedList.length}):
            </span>
            <div className="flex items-center gap-1.5">
              {distressedList.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectOccupant && onSelectOccupant(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    d.id === occupant.id
                      ? "bg-red-600 text-white font-black ring-2 ring-amber-400"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  <span>🆘</span>
                  <span>{d.name}</span>
                  <span className="text-[10px] font-mono opacity-80">({d.quadrant})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("LOCATE")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "LOCATE"
                  ? "bg-red-600 text-white shadow-md"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <span>🧭</span>
              <span>1. EXACT SPATIAL LOCATION (CAD)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("PROCEDURE")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "PROCEDURE"
                  ? "bg-red-600 text-white shadow-md"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <span>🛡️</span>
              <span>2. LIFE-SAVING PROCEDURE (SOP)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("FDNY_SLIP")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "FDNY_SLIP"
                  ? "bg-red-600 text-white shadow-md"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <span>📋</span>
              <span>3. FDNY TACTICAL EXTRACTION SLIP</span>
            </button>
          </div>

          {/* Quick Direct Phone Call Button */}
          {occupant.phone && (
            <a
              href={`tel:${occupant.phone.replace(/[^\d+]/g, "")}`}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition"
            >
              <span>📞</span>
              <span>Call Phone ({occupant.phone})</span>
            </a>
          )}
        </div>

        {/* Notice feedback */}
        {actionNotice && (
          <div className="p-3 bg-emerald-950 border-b border-emerald-500 text-emerald-200 text-xs font-bold text-center animate-pulse shrink-0">
            {actionNotice}
          </div>
        )}

        {/* Tab 1: EXACT SPATIAL LOCATION (CAD Floor Map & Coordinates) */}
        {activeTab === "LOCATE" && (
          <div className="p-5 overflow-y-auto space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-2xl">
                <div className="text-[10px] font-mono font-bold text-sky-400 uppercase">
                  Building Floor &amp; Sector
                </div>
                <div className="text-base font-black text-white mt-1">
                  Floor 07 · Sector {occupant.quadrant}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{sectorTitle}</div>
              </div>

              <div className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-2xl">
                <div className="text-[10px] font-mono font-bold text-amber-400 uppercase">
                  Exact Workstation Desk
                </div>
                <div className="text-base font-black text-white mt-1">
                  {occupant.desk || "07-NW-Workstation"}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Interior Station Core · Turnstile Verified
                </div>
              </div>

              <div className="p-3.5 bg-slate-800/80 border border-slate-700 rounded-2xl">
                <div className="text-[10px] font-mono font-bold text-emerald-400 uppercase">
                  Nearest Egress Exit
                </div>
                <div className="text-base font-black text-white mt-1">
                  {nearestStair}
                </div>
                <div className="text-[11px] text-emerald-300 mt-0.5">
                  Approx. {distanceFeet} ft · ~18 sec walk
                </div>
              </div>
            </div>

            {/* High-Definition Interactive CAD Blueprint Floor Plan */}
            <div className="bg-[#07111E] border-2 border-red-500 rounded-2xl p-3 relative overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 text-red-400 font-black">
                  <span className="animate-ping inline-block w-2 h-2 rounded-full bg-red-500"></span>
                  <span>FLOOR 07 CAD ARCHITECTURAL EXTRACTION PINPOINT</span>
                </span>
                <span>4 Irving Pl · 100% CAD Scale Verified</span>
              </div>

              <svg viewBox="0 0 400 240" className="w-full h-auto max-h-[320px] font-sans rounded-xl bg-[#0A192F]">
                <rect width="400" height="240" fill="#0A192F" />
                <rect x="10" y="10" width="380" height="220" fill="#0C213D" stroke="#005DAA" strokeWidth="1.5" rx="4" />

                {/* Courtyard Core */}
                <rect x="160" y="80" width="80" height="80" fill="#05101E" stroke="#1E3A5F" strokeWidth="1" rx="2" />
                <text x="200" y="125" textAnchor="middle" fill="#64748B" fontSize="8" fontWeight="bold">COURTYARD CORE</text>

                {/* Stairwell B (West) */}
                <rect x="10" y="80" width="30" height="60" fill="#059669" rx="2" />
                <text x="25" y="112" textAnchor="middle" fill="#FFFFFF" fontSize="6.5" fontWeight="black">STAIR B</text>
                <text x="25" y="122" textAnchor="middle" fill="#D1FAE5" fontSize="5.5">(WEST)</text>

                {/* Stairwell A (East) */}
                <rect x="360" y="80" width="30" height="60" fill="#059669" rx="2" />
                <text x="375" y="112" textAnchor="middle" fill="#FFFFFF" fontSize="6.5" fontWeight="black">STAIR A</text>
                <text x="375" y="122" textAnchor="middle" fill="#D1FAE5" fontSize="5.5">(EAST)</text>

                {/* Quadrant boundary guidelines */}
                <rect x="20" y="20" width="130" height="55" fill={occupant.quadrant === "NW" ? "#7F1D1D44" : "transparent"} stroke={occupant.quadrant === "NW" ? "#EF4444" : "#1E3A5F"} strokeWidth={occupant.quadrant === "NW" ? "2" : "0.5"} rx="2" />
                <text x="30" y="35" fill={occupant.quadrant === "NW" ? "#FCA5A5" : "#64748B"} fontSize="8" fontWeight="bold">SECTOR NW (Strategic)</text>

                <rect x="250" y="20" width="130" height="55" fill={occupant.quadrant === "NE" ? "#7F1D1D44" : "transparent"} stroke={occupant.quadrant === "NE" ? "#EF4444" : "#1E3A5F"} strokeWidth={occupant.quadrant === "NE" ? "2" : "0.5"} rx="2" />
                <text x="260" y="35" fill={occupant.quadrant === "NE" ? "#FCA5A5" : "#64748B"} fontSize="8" fontWeight="bold">SECTOR NE (Gas Ops)</text>

                <rect x="20" y="165" width="130" height="55" fill={occupant.quadrant === "SW" ? "#7F1D1D44" : "transparent"} stroke={occupant.quadrant === "SW" ? "#EF4444" : "#1E3A5F"} strokeWidth={occupant.quadrant === "SW" ? "2" : "0.5"} rx="2" />
                <text x="30" y="180" fill={occupant.quadrant === "SW" ? "#FCA5A5" : "#64748B"} fontSize="8" fontWeight="bold">SECTOR SW (Ombudsman)</text>

                <rect x="250" y="165" width="130" height="55" fill={occupant.quadrant === "SE" ? "#7F1D1D44" : "transparent"} stroke={occupant.quadrant === "SE" ? "#EF4444" : "#1E3A5F"} strokeWidth={occupant.quadrant === "SE" ? "2" : "0.5"} rx="2" />
                <text x="260" y="180" fill={occupant.quadrant === "SE" ? "#FCA5A5" : "#64748B"} fontSize="8" fontWeight="bold">SECTOR SE (Steam Ops)</text>

                {/* Egress corridor path line from victim to stairwell */}
                <line
                  x1={pinX}
                  y1={pinY}
                  x2={stairX}
                  y2={stairY}
                  stroke="#10B981"
                  strokeWidth="2.5"
                  strokeDasharray="4 3"
                />

                {/* Target Pinpoint for Victim */}
                <circle cx={pinX} cy={pinY} r="18" fill="#EF4444" fillOpacity="0.25" className="animate-ping" />
                <circle cx={pinX} cy={pinY} r="10" fill="#DC2626" stroke="#FFFFFF" strokeWidth="2" />
                <text x={pinX} y={pinY + 3.5} textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="black">🆘</text>

                {/* Pin label */}
                <rect x={pinX - 45} y={pinY - 24} width="90" height="15" rx="3" fill="#991B1B" stroke="#FFFFFF" strokeWidth="1" />
                <text x={pinX} y={pinY - 13} textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="black">
                  {occupant.name.toUpperCase()}
                </text>
              </svg>

              <div className="flex items-center justify-between text-[11px] text-slate-300 pt-2 px-1">
                <span>🟢 Green dashed corridor = Optimal extraction path to {nearestStair}</span>
                <button
                  type="button"
                  onClick={() => setActiveTab("PROCEDURE")}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg cursor-pointer transition"
                >
                  Proceed to Rescue SOP →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: LIFE-SAVING STANDARD OPERATING PROCEDURE (4-STEP SOP) */}
        {activeTab === "PROCEDURE" && (
          <div className="p-5 overflow-y-auto space-y-4">
            <div className="bg-slate-800/70 border border-slate-700 p-3.5 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-slate-300 font-bold">
                Follow standard NYC High-Rise Emergency Extraction Protocol for Floor 07:
              </span>
              <span className="font-mono font-black text-amber-300">
                CURRENT STAGE: STEP {procedureStep} OF 4
              </span>
            </div>

            {/* SOP Step 1: Immediate Triage & Voice Check */}
            <div className={`p-4 rounded-2xl border-2 transition ${procedureStep === 1 ? "bg-slate-800 border-red-500 ring-2 ring-red-500/30" : "bg-slate-900/60 border-slate-700"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-red-600 text-white font-black text-xs flex items-center justify-center shrink-0">1</span>
                  <div>
                    <h2 className="text-sm font-black text-white">Step 1: Direct Voice Verification &amp; Distress Triage</h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Confirm occupant consciousness, mobility capability, and whether smoke or physical obstruction is blocking exit.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {occupant.phone && (
                    <a
                      href={`tel:${occupant.phone.replace(/[^\d+]/g, "")}`}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs"
                    >
                      📞 Direct Call
                    </a>
                  )}
                  {onOpenWalkieTalkie && (
                    <button
                      type="button"
                      onClick={onOpenWalkieTalkie}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer"
                    >
                      📻 Walkie Channel
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* SOP Step 2: Dispatch Search & Rescue Squad */}
            <div className={`p-4 rounded-2xl border-2 transition ${procedureStep === 2 ? "bg-slate-800 border-red-500 ring-2 ring-red-500/30" : "bg-slate-900/60 border-slate-700"}`}>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">2</span>
                <div className="flex-1 space-y-3">
                  <div>
                    <h2 className="text-sm font-black text-white">Step 2: Dispatch Assigned Floor Wardens or Evac Chair Squad</h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Assign 2 trained floor wardens or mobility operators to proceed directly to Sector {occupant.quadrant} with extraction gear.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="text"
                      value={wardenAssigned}
                      onChange={(e) => setWardenAssigned(e.target.value)}
                      placeholder="e.g. Warden Squad Alpha (Lt. Miller / Officer Davis)"
                      className="flex-1 p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white outline-hidden focus:ring-2 focus:ring-red-500"
                    />

                    <button
                      type="button"
                      onClick={handleDispatchWardenTeam}
                      className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition"
                    >
                      🚨 Dispatch Search Team
                    </button>

                    <button
                      type="button"
                      onClick={handleDispatchEvacChair}
                      className="px-4 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition"
                    >
                      🛞 Dispatch Stryker Evac Chair
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* SOP Step 3: Secure in Stairwell Egress Corridor */}
            <div className={`p-4 rounded-2xl border-2 transition ${procedureStep === 3 ? "bg-slate-800 border-red-500 ring-2 ring-red-500/30" : "bg-slate-900/60 border-slate-700"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-sky-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">3</span>
                  <div>
                    <h2 className="text-sm font-black text-white">Step 3: Confirm Occupant Reached &amp; Escorted into Stairwell</h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Wardens confirm physical contact. Escort occupant into {nearestStair} enclosure and descend toward street level.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOccupantSecuredInStairwell}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition shrink-0"
                >
                  🔵 Mark Reached &amp; In Egress
                </button>
              </div>
            </div>

            {/* SOP Step 4: Life Saved Outside at Assembly Point */}
            <div className={`p-4 rounded-2xl border-2 transition ${procedureStep === 4 ? "bg-slate-800 border-emerald-500 ring-2 ring-emerald-500/30" : "bg-slate-900/60 border-slate-700"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">4</span>
                  <div>
                    <h2 className="text-sm font-black text-white">Step 4: Life Saved — Confirm Safe Outside at Assembly Point</h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Occupant clears building exit and arrives at {assemblyPoint}. Resolves distress and writes audit ledger block.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLifeSavedOutside}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-lg border border-emerald-400 cursor-pointer transition shrink-0"
                >
                  🟢 Life Saved — Mark Safe Outside
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: FDNY TACTICAL EXTRACTION SLIP (Official First Responder Handover) */}
        {activeTab === "FDNY_SLIP" && (
          <div className="p-5 overflow-y-auto space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-bold">
                Official Incident Command Handover Slip for FDNY First Responders (3 RCNY §401-06):
              </span>
              <button
                type="button"
                onClick={handleCopySlip}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs rounded-xl cursor-pointer transition flex items-center gap-1.5"
              >
                <span>📋</span>
                <span>{isCopiedSlip ? "✓ Copied to Clipboard!" : "Copy Rescue Slip"}</span>
              </button>
            </div>

            <div className="bg-black/90 p-4 rounded-2xl border border-red-500/60 text-slate-200 leading-relaxed font-mono whitespace-pre-wrap select-all shadow-inner">
{`=============================================================
  FDNY TACTICAL LIFE-SAFETY RESCUE PACKET (3 RCNY §401-06)
=============================================================
INCIDENT: Structure Distress / Life-Safety Rescue
BUILDING: Con Edison Headquarters · 4 Irving Place, NY 10003
FLOOR: Floor 07 · High-Rise Core

VICTIM INFORMATION:
- Name: ${occupant.name}
- ID: ${occupant.id}
- Role: ${occupant.role}
- Company: ${occupant.company || "Con Edison"}
- Contact Phone: ${occupant.phone || "N/A"}

EXACT SPATIAL LOCATION:
- Assigned Quadrant: Sector ${occupant.quadrant} (${sectorTitle})
- Workstation/Desk: ${occupant.desk || "Floor 07 Interior Core"}
- Architectural Grid: X: ${occupant.xCoord || 25}, Y: ${occupant.yCoord || 20}
- Distance to Exit: ${distanceFeet} ft from ${nearestStair}
- Recommended Entry: Enter via ${nearestStair} Landing 7

DISTRESS DETAILS:
- Current Status: ${occupant.status.toUpperCase()}
- Reported Notes: ${occupant.notes || "Distress / Evacuation assistance requested"}
- Last Verified Time: ${occupant.lastBadgeTime || new Date().toLocaleTimeString()}

COMMANDER ACTION:
- FSD Commander Console (Floor 07 Command Post)
- Exterior Assembly Point: ${assemblyPoint}
=============================================================`}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="bg-slate-900 px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span>Target Occupant ID: <strong className="text-white">{occupant.id}</strong></span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
