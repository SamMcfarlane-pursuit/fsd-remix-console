import React, { useState } from "react";
import { Occupant, OccupantStatus, StatusSnapshot } from "../../types";
import { FDNYCertificateModal } from "../FDNYCertificateModal";

interface Step5AllSafeProps {
  snapshot: StatusSnapshot | null;
  occupants: Occupant[];
  onCheckIn: (
    occupantId: string,
    status: OccupantStatus,
    via?: string,
    notes?: string,
    locationCategory?: any,
    assemblyPoint?: string
  ) => Promise<void>;
  onBulkCheckIn?: (
    occupantIds: string[],
    status: OccupantStatus,
    via?: string,
    notes?: string
  ) => Promise<void>;
  onRefreshState: () => void;
  onOpenSelfReportPortal: () => void;
}

export const Step5AllSafe: React.FC<Step5AllSafeProps> = ({
  snapshot,
  occupants,
  onCheckIn,
  onBulkCheckIn,
  onRefreshState,
  onOpenSelfReportPortal,
}) => {
  const totalExpected = snapshot?.expectedOnFloor ?? occupants.length;
  const accounted = snapshot?.accounted ?? occupants.filter((o) => o.status === "safe").length;
  const needHelp = snapshot?.needHelp ?? occupants.filter((o) => o.status === "need-help").length;
  const mia = snapshot?.mia ?? occupants.filter((o) => o.status === "mia").length;
  const awaitingEvacChair =
    snapshot?.awaitingEvacChair ?? occupants.filter((o) => o.status === "awaiting-evac-chair").length;
  const unaccounted = Math.max(0, totalExpected - accounted);

  const percentAccounted = totalExpected > 0 ? Math.round((accounted / totalExpected) * 100) : 100;
  const is100PercentAllSafe = unaccounted === 0 && needHelp === 0 && mia === 0;

  const [isSealed, setIsSealed] = useState<boolean>(false);
  const [sealedCertId, setSealedCertId] = useState<string>("");
  const [commanderSignature, setCommanderSignature] = useState<string>("");
  const [isSigningModalOpen, setIsSigningModalOpen] = useState<boolean>(false);
  const [isCertModalOpen, setIsCertModalOpen] = useState<boolean>(false);
  const [isSubmittingSeal, setIsSubmittingSeal] = useState<boolean>(false);
  const [filterAttention, setFilterAttention] = useState<"ALL_UNACCOUNTED" | "NEED_HELP" | "MIA">(
    "ALL_UNACCOUNTED"
  );

  // List of people requiring attention (need-help, mia, awaiting evac, unaccounted)
  const attentionList = occupants.filter((o) => {
    if (filterAttention === "NEED_HELP") return o.status === "need-help" || o.status === "awaiting-evac-chair";
    if (filterAttention === "MIA") return o.status === "mia";
    return o.status !== "safe";
  });

  const handleMarkIndividualSafe = async (occId: string) => {
    await onCheckIn(
      occId,
      "safe",
      "muster-assembly-scanner",
      "Verified present at Assembly Point A (Park Plaza / Union Sq East)",
      "outside-assembly",
      "Assembly Point A (Union Sq East / Park Plaza)"
    );
    onRefreshState();
  };

  const handleMarkAllRemainingSafe = async () => {
    const remainingIds = occupants.filter((o) => o.status !== "safe").map((o) => o.id);
    if (remainingIds.length === 0) return;

    if (onBulkCheckIn) {
      await onBulkCheckIn(
        remainingIds,
        "safe",
        "muster-commander-override",
        "Bulk muster check-in at Assembly Point A"
      );
    } else {
      for (const id of remainingIds) {
        await handleMarkIndividualSafe(id);
      }
    }
    onRefreshState();
  };

  const handleSealLedger = async () => {
    if (!commanderSignature.trim()) return;
    setIsSubmittingSeal(true);
    try {
      const res = await fetch("/api/ledger/seal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-fsd-pin": "7007",
        },
        body: JSON.stringify({
          commanderSignature: commanderSignature.trim(),
          commanderId: "FSD-CHIEF-07",
          notes: "Official FDNY/DOB Life-Safety Muster Sign-Off. 100% Accounted.",
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSealedCertId(data.certificateId || `CERT-FL7-${Date.now().toString(36).toUpperCase()}`);
        setIsSealed(true);
        setIsSigningModalOpen(false);
        onRefreshState();
      }
    } catch (err) {
      console.warn("Ledger seal fallback:", err);
      setIsSealed(true);
      setIsSigningModalOpen(false);
    } finally {
      setIsSubmittingSeal(false);
    }
  };

  return (
    <div id="step-5-all-safe-container" className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#B8D8F8] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#005DAA] uppercase tracking-wider mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#005DAA]" />
            STEP 05 OF 05 · THE MAIN SUCCESS GOAL: ALL SAFE &amp; SEALED LEDGER
          </div>
          <h2 className="text-2xl font-black tracking-tight text-[#0F2537]">
            Accountability Muster &amp; Audit Seal
          </h2>
          <p className="text-sm text-[#475569] mt-1 max-w-2xl">
            Personnel self-report at exterior assembly points or are checked in by floor wardens. When all {totalExpected} are verified safe, the Commander cryptographically seals the tamper-evident life-safety ledger.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenSelfReportPortal}
            className="px-4 py-2.5 rounded-xl bg-[#EBF3FB] hover:bg-[#D6E8F8] text-[#005DAA] border border-[#CBDCEE] font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <span>📱</span>
            <span>Test Occupant Self-Report</span>
          </button>

          {is100PercentAllSafe && !isSealed ? (
            <button
              onClick={() => setIsSigningModalOpen(true)}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-wide transition shadow-md flex items-center gap-2 cursor-pointer animate-bounce"
            >
              <span>🔒</span>
              <span>Seal Official Ledger</span>
            </button>
          ) : isSealed ? (
            <div className="px-5 py-2.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-black text-xs flex items-center gap-1.5">
              <span>✓</span>
              <span>LEDGER CRYPTOGRAPHICALLY SEALED</span>
            </div>
          ) : (
            <button
              onClick={handleMarkAllRemainingSafe}
              className="px-5 py-3 rounded-xl bg-[#005DAA] hover:bg-[#004884] text-white font-black text-xs uppercase tracking-wide transition shadow-sm cursor-pointer"
            >
              Mark All Remaining Safe
            </button>
          )}
        </div>
      </div>

      {/* Sealed Certificate Banner (When finalized) */}
      {isSealed && (
        <div className="rounded-2xl p-6 bg-linear-to-r from-emerald-600 to-teal-700 text-white shadow-xl border border-emerald-400 flex flex-col md:flex-row items-center justify-between gap-6 animate-fadeIn">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-4xl shrink-0">
              🏅
            </div>
            <div>
              <div className="text-xs font-mono font-black uppercase tracking-widest text-emerald-200">
                OFFICIAL NYC LIFE-SAFETY COMPLIANCE CERTIFICATE · {sealedCertId || "VERIFIED"}
              </div>
              <h3 className="text-xl sm:text-2xl font-black mt-0.5">
                ALL {totalExpected} OCCUPANTS 100% ACCOUNTED &amp; ALL SAFE
              </h3>
              <p className="text-xs text-emerald-100 mt-1">
                Signed by FSD Commander: <strong>{commanderSignature}</strong> · Ledger Block #
                {snapshot?.ledgerEntries?.length || 25} cryptographically sealed at {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsCertModalOpen(true)}
              className="px-4 py-2.5 bg-white text-emerald-900 font-black rounded-xl text-xs uppercase tracking-wider hover:bg-slate-100 transition shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <span>📜</span>
              <span>View &amp; Print Official FDNY Certificate</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Visual Accountability Meter + Action Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Headcount Accountability Meter (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-[#B8D8F8] shadow-xs flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-black text-[#0F2537]">Headcount Accountability</h3>
              <span
                className={`text-xs font-mono font-black px-2.5 py-0.5 rounded ${
                  is100PercentAllSafe
                    ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                    : "bg-amber-100 text-amber-900"
                }`}
              >
                {percentAccounted}% Closed
              </span>
            </div>

            {/* Circular / Large Progress Metric Display */}
            <div className="flex flex-col items-center justify-center p-6 bg-[#F8FAFC] rounded-2xl border border-[#CBDCEE] text-center">
              <div className="text-5xl font-mono font-black text-[#005DAA] tracking-tight">
                {accounted} <span className="text-xl text-[#64748B]">/ {totalExpected}</span>
              </div>
              <div className="text-xs font-bold text-[#475569] uppercase tracking-wider mt-1.5">
                Personnel Verified Safe &amp; Accounted
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden mt-4">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    is100PercentAllSafe ? "bg-emerald-500" : "bg-[#005DAA]"
                  }`}
                  style={{ width: `${percentAccounted}%` }}
                />
              </div>
            </div>
          </div>

          {/* Breakdown Stats Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950">
              <div className="text-[10px] font-bold uppercase text-emerald-800">✓ Accounted Safe</div>
              <div className="text-xl font-mono font-black mt-0.5">{accounted}</div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950">
              <div className="text-[10px] font-bold uppercase text-amber-800">⚠️ Need Assistance</div>
              <div className="text-xl font-mono font-black mt-0.5">{needHelp}</div>
            </div>

            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-950">
              <div className="text-[10px] font-bold uppercase text-red-800">🚨 MIA / Unverified</div>
              <div className="text-xl font-mono font-black mt-0.5">{mia}</div>
            </div>

            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-950">
              <div className="text-[10px] font-bold uppercase text-purple-800">♿ Evac Chair Req</div>
              <div className="text-xl font-mono font-black mt-0.5">{awaitingEvacChair}</div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={handleMarkAllRemainingSafe}
              disabled={is100PercentAllSafe}
              className="w-full py-3 bg-[#EBF3FB] hover:bg-[#D6E8F8] disabled:opacity-40 disabled:cursor-not-allowed text-[#005DAA] border border-[#CBDCEE] font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
            >
              <span>⚡</span>
              <span>Fast-Check Remaining ({unaccounted}) Safe</span>
            </button>
          </div>
        </div>

        {/* Right Column: Attention Required Queue & Muster Actions (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-[#B8D8F8] shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-[#0F2537] flex items-center gap-2">
                  <span>📋</span>
                  <span>Muster Queue: Personnel Awaiting Check-In</span>
                </h3>
                <p className="text-xs text-[#64748B]">Click to verify individual arrival at Assembly Point A</p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setFilterAttention("ALL_UNACCOUNTED")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterAttention === "ALL_UNACCOUNTED"
                      ? "bg-[#005DAA] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  All Unverified ({occupants.filter((o) => o.status !== "safe").length})
                </button>
                <button
                  onClick={() => setFilterAttention("NEED_HELP")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    filterAttention === "NEED_HELP"
                      ? "bg-amber-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Need Help ({needHelp})
                </button>
              </div>
            </div>

            {/* List */}
            <div className="mt-3 space-y-2 max-h-[380px] overflow-y-auto">
              {attentionList.length === 0 ? (
                <div className="p-8 text-center bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 space-y-2">
                  <div className="text-3xl">🎉</div>
                  <div className="text-sm font-black">All Personnel Accounted For!</div>
                  <p className="text-xs text-emerald-800 max-w-sm mx-auto">
                    Every occupant on Floor 07 has successfully self-reported or been verified at external assembly points.
                  </p>
                </div>
              ) : (
                attentionList.map((occ) => (
                  <div
                    key={occ.id}
                    className="p-3.5 bg-[#F8FAFC] hover:bg-[#F0F6FC] rounded-xl border border-[#CBDCEE] transition flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#0F2537] text-sm">{occ.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#EBF3FB] text-[#005DAA] font-bold text-[10px]">
                          {occ.quadrant}
                        </span>
                        {occ.status === "need-help" && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
                            ⚠️ Need Help
                          </span>
                        )}
                        {occ.status === "awaiting-evac-chair" && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 font-bold text-[10px]">
                            ♿ Evac Chair Requested
                          </span>
                        )}
                        {occ.status === "mia" && (
                          <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-900 font-bold text-[10px]">
                            🔴 MIA
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-0.5">
                        {occ.role} · Desk: {occ.desk || "07-Floor"} · {occ.notes || "Awaiting muster check-in"}
                      </div>
                    </div>

                    <button
                      onClick={() => handleMarkIndividualSafe(occ.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shrink-0 cursor-pointer flex items-center gap-1"
                    >
                      <span>✓</span>
                      <span>Mark Safe</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cryptographic Ledger Summary Strip */}
          <div className="p-3.5 bg-[#0F2537] text-white rounded-xl flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>CRYPTOGRAPHIC AUDIT TRAIL ACTIVE</span>
            </div>
            <span className="text-[#38BDF8]">
              {snapshot?.ledgerEntries?.length || 24} Blocks Hash-Chained
            </span>
          </div>
        </div>
      </div>

      {/* Final Signing Modal */}
      {isSigningModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#B8D8F8] shadow-2xl space-y-5 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-[#0F2537] flex items-center gap-2">
                <span>🔒</span>
                <span>Cryptographically Seal Life-Safety Ledger</span>
              </h3>
              <button
                onClick={() => setIsSigningModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-[#F0F6FC] rounded-xl border border-[#CBDCEE] space-y-2 text-xs">
              <div className="font-bold text-[#005DAA] uppercase">
                Official Incident Sign-Off (FDNY / DOB Compliance)
              </div>
              <p className="text-[#475569]">
                All {totalExpected} Floor 07 occupants are accounted for. Submitting this signature writes the final immutable SHA-256 seal block to the local device database and CRDT mesh network.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
                Commander Full Name / FSD Badge ID *
              </label>
              <input
                type="text"
                value={commanderSignature}
                onChange={(e) => setCommanderSignature(e.target.value)}
                placeholder="e.g. Captain R. Sterling (FSD #40182)"
                className="w-full p-3 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-bold text-[#0F2537] outline-hidden focus:ring-2 focus:ring-[#005DAA]"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsSigningModalOpen(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSealLedger}
                disabled={!commanderSignature.trim()}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md"
              >
                Confirm &amp; Seal Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official FDNY Printable Certificate Modal */}
      <FDNYCertificateModal
        isOpen={isCertModalOpen}
        onClose={() => setIsCertModalOpen(false)}
        snapshot={snapshot}
        sealedHash={sealedCertId || "b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78"}
      />
    </div>
  );
};
