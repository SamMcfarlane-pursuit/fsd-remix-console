import React, { useState } from "react";
import { Occupant, QuadrantId } from "../types";
import { ActualBuildingFloorMap } from "./ActualBuildingFloorMap";

interface OccupantSafetyActionModalProps {
  occupant: Occupant | null;
  onClose: () => void;
  onCheckIn: (
    occupantId: string,
    status: any,
    method: string,
    notes?: string,
    locCat?: string,
    musterPoint?: string
  ) => Promise<any> | void;
  onSendDirectPing?: (occ: Occupant) => void;
  onFeedbackMessage?: (msg: string) => void;
  onOpenRescueProcedure?: (occ: Occupant) => void;
}

const QUADRANT_LABELS: Record<QuadrantId, string> = {
  NW: "Strategic Planning & Engineering",
  NE: "Gas Ops & Substation Security",
  SW: "AMI Operations & Ombudsman",
  SE: "Steam Operations & Bulk Power",
};

export const OccupantSafetyActionModal: React.FC<OccupantSafetyActionModalProps> = ({
  occupant,
  onClose,
  onCheckIn,
  onSendDirectPing,
  onFeedbackMessage,
  onOpenRescueProcedure,
}) => {
  const [pingSent, setPingSent] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);

  if (!occupant) return null;

  const isPresent = !occupant.badgedOut && !occupant.offSiteToday;
  const sectorLabel = QUADRANT_LABELS[occupant.quadrant] || "Floor 07 Interior Core";
  const primaryExit = occupant.quadrant === "NW" || occupant.quadrant === "NE"
    ? "Door 7-A · Stairwell A (East Core - Union Sq East)"
    : "Door 7-B · Stairwell B (West Core - Irving Pl)";

  const triggerFeedback = (msg: string) => {
    setLocalFeedback(msg);
    if (onFeedbackMessage) onFeedbackMessage(msg);
  };

  const handleMarkSafe = async () => {
    await onCheckIn(
      occupant.id,
      "safe",
      "commander-action",
      "Marked safe outside",
      "outside-assembly",
      "Assembly Point A (Union Sq East / Park Plaza)"
    );
    triggerFeedback(`🟢 ${occupant.name} verified Safe Outside at Assembly Point A.`);
    onClose();
  };

  const handleConfirmInBuilding = async () => {
    await onCheckIn(
      occupant.id,
      "safe",
      "commander-action",
      "Confirmed inside building on Floor 07",
      "inside-building"
    );
    triggerFeedback(`🏢 ${occupant.name} confirmed In-Building on Floor 07.`);
    onClose();
  };

  const handleBadgeOut = async () => {
    await onCheckIn(
      occupant.id,
      "unaccounted",
      "commander-action",
      "Badged out / left premises",
      "offsite"
    );
    triggerFeedback(`🚪 ${occupant.name} marked Badged Out.`);
    onClose();
  };

  const handleAssignEvacChair = async () => {
    await onCheckIn(
      occupant.id,
      "awaiting-evac-chair",
      "commander-action",
      "Evac chair assistance requested at Stairwell A landing",
      "inside-building"
    );
    triggerFeedback(`🛞 Stryker Evac Chair dispatched for ${occupant.name} at Stairwell A.`);
    onClose();
  };

  const handlePing = () => {
    setPingSent(true);
    if (onSendDirectPing) {
      onSendDirectPing(occupant);
    }
    triggerFeedback(`🚨 Urgent Evacuation Ping transmitted to ${occupant.name}'s phone.`);
    setTimeout(() => setPingSent(false), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-xl w-full border-2 border-[#005DAA] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#003B70] text-white p-5 flex items-center justify-between border-b border-sky-600">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 text-white font-black text-xl flex items-center justify-center shrink-0">
              {occupant.role === "Visitor" ? "🏷️" : "👤"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black">{occupant.name}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/20 text-sky-200 font-bold">
                  {occupant.id}
                </span>
              </div>
              <p className="text-xs text-sky-200">
                {occupant.role} · {occupant.company || "Con Edison"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white font-black text-sm transition cursor-pointer"
            title="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#0F2537]">
          {/* Active Distress / Need Help Warning Banner */}
          {(occupant.status === "need-help" || occupant.status === "awaiting-evac-chair") && (
            <div className="p-4 bg-red-50 border-2 border-red-500 rounded-2xl flex items-center justify-between gap-3 animate-pulse shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚨</span>
                <div>
                  <div className="text-xs font-black text-red-950 uppercase tracking-wide">
                    {occupant.status === "awaiting-evac-chair" ? "🛞 EVACUATION CHAIR REQUIRED" : "ACTIVE SOS DISTRESS ALERT"}
                  </div>
                  <div className="text-[11px] text-red-800 font-medium">
                    Occupant requested immediate emergency rescue extraction from Sector {occupant.quadrant}.
                  </div>
                </div>
              </div>
              {onOpenRescueProcedure && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenRescueProcedure(occupant);
                  }}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer shrink-0"
                >
                  Launch Rescue SOP →
                </button>
              )}
            </div>
          )}

          {/* Occupant SitRep Transmission Note */}
          {occupant.notes && (
            <div className="p-3.5 bg-amber-50/90 rounded-2xl border-2 border-amber-300 space-y-1 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-black uppercase text-amber-900 tracking-wider flex items-center gap-1.5">
                  <span>💬</span>
                  <span>OCCUPANT SITUATION REPORT (SITREP)</span>
                </span>
                <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                  VIA {occupant.checkInMethod?.toUpperCase() || "MOBILE APP"}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 leading-relaxed">
                "{occupant.notes.replace(/^Occupant SitRep:\s*/i, "")}"
              </p>
            </div>
          )}

          {/* Building Location Blueprint Card */}
          <div className="bg-[#F0F6FC] rounded-2xl p-4 border border-[#CBDCEE] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-black uppercase text-[#005DAA] tracking-wider flex items-center gap-1.5">
                <span>🧭</span>
                <span>LOCATION INSIDE BUILDING (4 IRVING PL · FL 07)</span>
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${isPresent
                    ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                    : occupant.badgedOut
                      ? "bg-slate-200 text-slate-700 border-slate-300"
                      : "bg-blue-100 text-blue-900 border-blue-300"
                  }`}
              >
                {isPresent ? "In Building (Floor 07)" : occupant.badgedOut ? "Badged Out" : "Offsite"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-[#CBDCEE]">
                <div className="text-[10px] font-mono text-slate-500 uppercase">Assigned Sector</div>
                <div className="font-black text-[#005DAA] text-sm mt-0.5">
                  Sector {occupant.quadrant}
                </div>
                <div className="text-[11px] text-slate-600 truncate">{sectorLabel}</div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-[#CBDCEE]">
                <div className="text-[10px] font-mono text-slate-500 uppercase">Workstation Desk</div>
                <div className="font-black text-[#0F2537] text-sm mt-0.5">
                  {occupant.desk || "Turnstile Ingress Point"}
                </div>
                <div className="text-[11px] text-slate-600">Floor 07 Interior Core</div>
              </div>
            </div>

            {/* Enterprise Vector CAD Architectural Floor Plan (Calm daylight theme, occupant-name free) */}
            <div className="rounded-2xl overflow-hidden border border-[#CBDCEE] bg-white shadow-xs p-1">
              <ActualBuildingFloorMap
                targetQuadrant={occupant.quadrant}
                targetDesk={occupant.desk}
                targetStairwell={primaryExit}
                showEgressPath={true}
                targetX={occupant.xCoord}
                targetY={occupant.yCoord}
                targetStatus={occupant.status}
                targetName={occupant.name}
                accuracyRadiusMeters={2.5}
                className="border-0 shadow-none p-1 sm:p-2"
              />
            </div>

            <div className="text-[11px] text-slate-600 flex items-center justify-between font-medium">
              <span>Assigned Exit: {primaryExit}</span>
              <span>Descent Time: ~3 min</span>
            </div>
          </div>

          {/* Direct Individual Action Controls */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-mono font-black uppercase text-[#005DAA] tracking-wider flex items-center gap-1.5">
                <span>🛡️</span>
                <span>LIFE-SAFETY ACTIONS TO ENSURE SAFETY</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                Instant 1-Click Execution
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Action 1: Mark Safe Outside */}
              <button
                type="button"
                onClick={handleMarkSafe}
                className="p-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl transition cursor-pointer flex items-start gap-3 shadow-sm active:scale-95 text-left border-2 border-emerald-500"
              >
                <span className="text-2xl shrink-0">🟢</span>
                <div>
                  <div className="font-black text-sm">Mark Safe Outside</div>
                  <div className="text-[11px] text-emerald-100 font-medium mt-0.5">
                    Recorded at Assembly Point A (Park Plaza)
                  </div>
                </div>
              </button>

              {/* Action 2: Confirm In-Building */}
              <button
                type="button"
                onClick={handleConfirmInBuilding}
                className="p-3.5 bg-[#005DAA] hover:bg-[#004884] text-white rounded-2xl transition cursor-pointer flex items-start gap-3 shadow-sm active:scale-95 text-left border-2 border-[#005DAA]"
              >
                <span className="text-2xl shrink-0">🏢</span>
                <div>
                  <div className="font-black text-sm">Confirm In-Building</div>
                  <div className="text-[11px] text-sky-100 font-medium mt-0.5">
                    Verified present during warden sweep
                  </div>
                </div>
              </button>

              {/* Action 3: Send Direct Evacuation Ping */}
              <button
                type="button"
                onClick={handlePing}
                className="p-3.5 bg-red-600 hover:bg-red-500 text-white rounded-2xl transition cursor-pointer flex items-start gap-3 shadow-sm active:scale-95 text-left border-2 border-red-500"
              >
                <span className="text-2xl shrink-0">🚨</span>
                <div>
                  <div className="font-black text-sm">
                    {pingSent ? "✓ Ping Transmitted!" : "Direct Evacuation Ping"}
                  </div>
                  <div className="text-[11px] text-red-100 font-medium mt-0.5">
                    Transmits urgent push alert &amp; SMS
                  </div>
                </div>
              </button>

              {/* Action 4: Assign Stryker Evac Chair */}
              <button
                type="button"
                onClick={handleAssignEvacChair}
                className="p-3.5 bg-purple-700 hover:bg-purple-600 text-white rounded-2xl transition cursor-pointer flex items-start gap-3 shadow-sm active:scale-95 text-left border-2 border-purple-600"
              >
                <span className="text-2xl shrink-0">🛞</span>
                <div>
                  <div className="font-black text-sm">Assign Evac Chair</div>
                  <div className="text-[11px] text-purple-100 font-medium mt-0.5">
                    Mobility assistance to Stairwell A
                  </div>
                </div>
              </button>
            </div>

            {/* Rescue Procedure SOP Trigger */}
            {onOpenRescueProcedure && (
              <div className="p-3 bg-red-50 rounded-2xl border-2 border-red-200 flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl shrink-0">🚨</span>
                  <div>
                    <div className="font-black text-xs text-red-950">
                      Emergency Rescue Procedure & SAR
                    </div>
                    <div className="text-[10px] text-red-800 font-medium">
                      Search & Rescue Squad Dispatch, Stairwell Evac Chair & Life Saved protocol
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenRescueProcedure(occupant);
                  }}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer shrink-0 active:scale-95"
                >
                  Launch Rescue SOP →
                </button>
              </div>
            )}

            {/* Secondary Quick Contact & Badge Out Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200">
              {occupant.phone ? (
                <a
                  href={`tel:${occupant.phone.replace(/[^\d+]/g, "")}`}
                  className="p-3 bg-sky-700 hover:bg-sky-600 text-white rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-xs font-bold text-xs text-center"
                >
                  <span className="text-base">📞</span>
                  <span>Call Mobile: {occupant.phone}</span>
                </a>
              ) : (
                <button
                  disabled
                  className="p-3 bg-slate-100 text-slate-400 font-bold rounded-xl cursor-not-allowed flex items-center justify-center gap-2 text-xs text-center"
                >
                  <span>📞</span>
                  <span>No Registered Phone</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleBadgeOut}
                className="p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-xs font-bold text-xs text-center"
              >
                <span className="text-base">🚪</span>
                <span>Badge Out / Left Building</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#F8FAFC] p-4 border-t border-[#CBDCEE] flex items-center justify-between text-xs">
          <span className="text-slate-500 font-mono">Con Edison Life Safety · NYC Fire Code §401-06</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
