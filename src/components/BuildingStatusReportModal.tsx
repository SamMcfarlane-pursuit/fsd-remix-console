import { useMemo, useState } from "react";
import { Occupant, StatusSnapshot } from "../types";

interface BuildingStatusReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: StatusSnapshot | null;
  onCheckIn?: (occupantId: string, status: any, via?: string, notes?: string, locationCategory?: any, assemblyPoint?: string) => void;
}

export default function BuildingStatusReportModal({
  isOpen,
  onClose,
  snapshot,
  onCheckIn,
}: BuildingStatusReportModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<"summary" | "in-building" | "outside" | "offsite" | "needs-help" | "staircase">("summary");
  const [filterQuery, setFilterQuery] = useState("");

  const occupants = snapshot?.occupants || [];

  const inBuilding = useMemo(
    () => occupants.filter((o) => (o.locationCategory === "inside-building" || !o.locationCategory) && !o.badgedOut && !o.offSiteToday),
    [occupants]
  );

  const outsideAssembly = useMemo(
    () => occupants.filter((o) => o.locationCategory === "outside-assembly" || (o.status === "safe" && o.assemblyPoint)),
    [occupants]
  );

  const offsite = useMemo(
    () => occupants.filter((o) => o.badgedOut || o.offSiteToday || o.locationCategory === "offsite"),
    [occupants]
  );

  const needsHelpList = useMemo(
    () => occupants.filter((o) => o.status === "need-help" || o.status === "awaiting-evac-chair" || o.status === "mia"),
    [occupants]
  );

  // Staircase guidance logic based on hazard
  const isWestCompromised = snapshot?.hazardType === "office-fire" || snapshot?.hazardType === "hazmat";
  const safestStairwell = isWestCompromised ? "STAIRWELL B (EAST WING)" : "STAIRWELL A (WEST WING)";
  const primaryAssembly = isWestCompromised ? "Assembly Point B (East Courtyard - Irving Pl)" : "Assembly Point A (Park Plaza - East 14th St)";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border-2 border-[#005DAA] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-[#0F2537]">
        {/* Header */}
        <div className="bg-[#003B70] text-white px-5 py-4 flex items-center justify-between border-b border-[#005DAA] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-[#B8D8F8]">
                CON EDISON LIFE-SAFETY DISPATCH · ACCURATE HEADCOUNT & LOCATION MATRIX
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Live Building Attendance & Spatial Presence Report
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

        {/* Sub-tab Navigation */}
        <div className="bg-[#F0F6FC] border-b border-[#B8D8F8] px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs font-bold">
            {[
              { id: "summary", label: "Executive Summary", icon: "📊" },
              { id: "in-building", label: `🏢 In Building (${inBuilding.length})`, icon: "" },
              { id: "outside", label: `🌳 Outside Safe (${outsideAssembly.length})`, icon: "" },
              { id: "offsite", label: `🏠 Off-Site / WFH (${offsite.length})`, icon: "" },
              { id: "needs-help", label: `🚨 Needs Help / ARA (${needsHelpList.length})`, icon: "" },
              { id: "staircase", label: "🧭 Safest Stairway Egress", icon: "" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  activeSubTab === tab.id
                    ? "bg-[#005DAA] text-white shadow-xs font-black"
                    : "text-[#005DAA] hover:bg-[#EBF5FB] font-bold"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] font-mono text-[#005DAA] font-bold">
            TOTAL ROSTER: {occupants.length} OCCUPANTS
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: EXECUTIVE SUMMARY */}
          {activeSubTab === "summary" && (
            <div className="space-y-4">
              {/* Top High-Level Metrics Bento */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-[#EBF5FB] border border-[#B8D8F8] p-3.5 rounded-xl">
                  <div className="text-[10px] font-black uppercase text-[#005DAA]">Inside Building Floor 07</div>
                  <div className="text-2xl sm:text-3xl font-mono font-black text-[#005DAA] mt-1">{inBuilding.length}</div>
                  <div className="text-[10px] text-[#475569] font-medium">On-site across 4 quadrants</div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                  <div className="text-[10px] font-black uppercase text-emerald-800">Outside Safe (Assembly)</div>
                  <div className="text-2xl sm:text-3xl font-mono font-black text-emerald-800 mt-1">{outsideAssembly.length}</div>
                  <div className="text-[10px] text-emerald-700 font-medium">Park Plaza & Courtyard</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <div className="text-[10px] font-black uppercase text-slate-700">Off-Site / WFH Today</div>
                  <div className="text-2xl sm:text-3xl font-mono font-black text-slate-700 mt-1">{offsite.length}</div>
                  <div className="text-[10px] text-slate-500 font-medium">Verified not on floor</div>
                </div>

                <div className={`p-3.5 rounded-xl border ${
                  needsHelpList.length > 0 ? "bg-red-50 border-red-300 animate-pulse" : "bg-emerald-50 border-emerald-200"
                }`}>
                  <div className="text-[10px] font-black uppercase text-red-800">Needs Help / ARA / MIA</div>
                  <div className="text-2xl sm:text-3xl font-mono font-black text-red-700 mt-1">{needsHelpList.length}</div>
                  <div className="text-[10px] text-red-700 font-medium">Immediate first responder focus</div>
                </div>
              </div>

              {/* Quadrant Breakdown Cards */}
              <div className="bg-white border border-[#B8D8F8] rounded-xl p-4 space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#005DAA]">
                  Spatial Quadrant Presence Breakdown (Floor 07)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {snapshot?.quadrants.map((q) => {
                    const pct = q.expected > 0 ? Math.round((q.accounted / q.expected) * 100) : 0;
                    return (
                      <div key={q.id} className="p-3 bg-[#F0F6FC] border border-[#B8D8F8] rounded-xl space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-black text-[#005DAA]">
                          <span>{q.label}</span>
                          <span className="font-mono">{pct}%</span>
                        </div>
                        <div className="h-2 bg-[#D0E3F7] rounded-full overflow-hidden">
                          <div className="h-full bg-[#005DAA] transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-[11px] font-mono font-bold text-[#475569]">
                          <span>Accounted: {q.accounted}/{q.expected}</span>
                          {q.needHelp > 0 && <span className="text-red-700 font-black">{q.needHelp} Help</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Safest Staircase Alert Banner */}
              <div className="p-4 bg-emerald-50 border-2 border-emerald-600 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🧭</span>
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide text-emerald-900">
                      Recommended Primary Egress: {safestStairwell}
                    </div>
                    <p className="text-xs text-emerald-800 font-medium">
                      Pressurized, 100% smoke-free shaft leading directly to {primaryAssembly}.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveSubTab("staircase")}
                  className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-xs font-black hover:bg-emerald-800 transition cursor-pointer shrink-0"
                >
                  View Step-by-Step Guidance →
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: IN BUILDING OCCUPANTS */}
          {activeSubTab === "in-building" && (
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#005DAA]">Showing {inBuilding.length} Occupants Located Inside Floor 07:</span>
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter name, zone, role..."
                  className="px-3 py-1.5 border border-[#B8D8F8] rounded-lg text-xs font-semibold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto">
                {inBuilding
                  .filter((o) => !filterQuery || o.name.toLowerCase().includes(filterQuery.toLowerCase()) || o.quadrant.toLowerCase().includes(filterQuery.toLowerCase()))
                  .map((o) => (
                    <div key={o.id} className="p-3 bg-[#F0F6FC] border border-[#B8D8F8] rounded-xl flex items-center justify-between text-xs">
                      <div>
                        <div className="font-black text-[#005DAA]">{o.name}</div>
                        <div className="text-[11px] text-[#475569]">{o.id} · {o.role} · {o.quadrant} Quadrant</div>
                        <div className="text-[10px] font-mono text-slate-500 font-bold">{o.lastLocation}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        o.status === "safe" ? "bg-emerald-100 text-emerald-800" : o.status === "need-help" ? "bg-red-100 text-red-800 animate-pulse" : "bg-amber-100 text-amber-900"
                      }`}>
                        {o.status}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 3: OUTSIDE ASSEMBLY SAFE */}
          {activeSubTab === "outside" && (
            <div className="space-y-3">
              <div className="font-bold text-xs text-emerald-800">
                Showing {outsideAssembly.length} Occupants Accounted for Safe at Outside Assembly Areas:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto">
                {outsideAssembly.map((o) => (
                  <div key={o.id} className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black text-emerald-900">{o.name}</div>
                      <div className="text-[11px] text-emerald-700">{o.id} · {o.role}</div>
                      <div className="text-[10px] font-mono text-emerald-800 font-bold">{o.assemblyPoint || "Assembly Point A (Park Plaza)"}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-700 text-white">
                      SAFE OUTSIDE
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: OFF-SITE / WFH */}
          {activeSubTab === "offsite" && (
            <div className="space-y-3">
              <div className="font-bold text-xs text-slate-700">
                Showing {offsite.length} Occupants Off-Site, WFH, or Badged Out (Exempt from Floor 07 Sweep):
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto">
                {offsite.map((o) => (
                  <div key={o.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-black text-slate-800">{o.name}</div>
                      <div className="text-[11px] text-slate-600">{o.id} · {o.role}</div>
                      <div className="text-[10px] font-mono text-slate-500">{o.offSiteToday ? "WFH Schedule" : "Badged Out at Lobby"}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-800">
                      OFF-SITE
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: NEEDS HELP / ARA ASSISTANCE */}
          {activeSubTab === "needs-help" && (
            <div className="space-y-3">
              <div className="p-3 bg-red-100 border border-red-300 text-red-900 rounded-xl text-xs font-bold">
                🚨 High-Priority Life-Safety Triage: First responders and wardens have been dispatched to the following locations:
              </div>

              <div className="space-y-2">
                {needsHelpList.map((o) => (
                  <div key={o.id} className="p-4 bg-white border-2 border-red-500 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-red-700">{o.name}</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-700 text-white uppercase">
                          {o.status}
                        </span>
                        <span className="text-xs text-[#475569] font-mono">({o.id} · {o.role})</span>
                      </div>
                      <p className="text-xs text-[#0F2537] font-semibold mt-1">
                        Location: <span className="font-bold text-[#005DAA]">{o.quadrant} Quadrant · {o.lastLocation}</span>
                      </p>
                      {o.notes && (
                        <p className="text-xs text-red-800 font-bold mt-0.5">Note: {o.notes}</p>
                      )}
                    </div>

                    {onCheckIn && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onCheckIn(o.id, "safe", "fsd-triage", "Resolved by FSD Dispatcher", "outside-assembly", "Assembly Point A (Park Plaza)")}
                          className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg font-bold text-xs hover:bg-emerald-800 transition cursor-pointer"
                        >
                          ✓ Mark Safe Outside
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: SAFEST STAIRCASE GUIDANCE */}
          {activeSubTab === "staircase" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Stairwell B (Recommended East) */}
                <div className={`p-4 rounded-xl border-2 ${
                  isWestCompromised ? "bg-emerald-50 border-emerald-600" : "bg-white border-[#B8D8F8]"
                } space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🚪</span>
                      <h4 className="font-black text-sm text-emerald-950">STAIRWELL B (EAST — IRVING PLACE)</h4>
                    </div>
                    <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-emerald-700 text-white uppercase">
                      RECOMMENDED PRIMARY
                    </span>
                  </div>

                  <p className="text-xs text-emerald-900 font-medium">
                    Fully pressurized concrete shaft, zero smoke drift detected. Safe for all occupants in NE Comms, SE Visitors, and diverted NW staff.
                  </p>

                  <div className="p-2.5 bg-white/80 rounded-lg border border-emerald-200 text-xs space-y-1 font-semibold text-emerald-950">
                    <div>1. Proceed East down Corridor 7B towards Sector E.</div>
                    <div>2. Enter through heavy fire door (marked STAIR B).</div>
                    <div>3. Evacuate down 7 flights to Ground Courtyard Exit.</div>
                    <div>4. Report to Warden at Assembly Point B (Irving Pl).</div>
                  </div>
                </div>

                {/* Stairwell A (West) */}
                <div className={`p-4 rounded-xl border-2 ${
                  isWestCompromised ? "bg-amber-50 border-amber-500" : "bg-emerald-50 border-emerald-600"
                } space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🚪</span>
                      <h4 className="font-black text-sm text-[#0F2537]">STAIRWELL A (WEST — 14TH STREET)</h4>
                    </div>
                    <span className={`px-2.5 py-1 text-[10px] font-black rounded-full uppercase ${
                      isWestCompromised ? "bg-amber-600 text-white" : "bg-emerald-700 text-white"
                    }`}>
                      {isWestCompromised ? "CAUTION / ARA ONLY" : "CLEAR"}
                    </span>
                  </div>

                  <p className="text-xs text-amber-950 font-medium">
                    {isWestCompromised
                      ? "Thermal anomaly / smoke reported in adjacent Corridor 7A. Stairwell A is designated for Area of Rescue Assistance (ARA) Evac Chair transfer only."
                      : "Clear alternative egress route to 14th Street Park Plaza."}
                  </p>

                  <div className="p-2.5 bg-white/80 rounded-lg border border-amber-200 text-xs space-y-1 font-semibold text-amber-950">
                    <div>1. Reserved for mobility impaired ARA transfer.</div>
                    <div>2. Fire Department attack team staging at Landing 7.</div>
                    <div>3. Non-mobility occupants should route to Stairwell B.</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#F0F6FC] border-t border-[#B8D8F8] px-5 py-3 flex items-center justify-between shrink-0 text-xs">
          <span className="text-[#475569] font-medium">
            NYC Building Code Title 29 · FDNY R-02 Compliant Life-Safety Report
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#005DAA] text-white font-bold rounded-xl hover:bg-[#004A88] transition cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
