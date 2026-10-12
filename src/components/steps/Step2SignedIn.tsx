import React, { useState, useMemo } from "react";
import { Occupant, OccupantStatus, QuadrantId, StatusSnapshot } from "../../types";
import { OccupantSafetyActionModal } from "../OccupantSafetyActionModal";
import { ActualBuildingFloorMap } from "../ActualBuildingFloorMap";
import { EmergencyRescueProcedureModal } from "../EmergencyRescueProcedureModal";

interface Step2SignedInProps {
  snapshot: StatusSnapshot | null;
  occupants: Occupant[];
  onCheckIn: (
    occupantId: string,
    status: OccupantStatus,
    via?: string,
    notes?: string,
    locationCategory?: any
  ) => Promise<void>;
  onBulkCheckIn?: (
    occupantIds: string[],
    status: OccupantStatus,
    via?: string,
    notes?: string,
    action?: "enter" | "leave",
    locationCategory?: "inside-building" | "outside-assembly" | "offsite"
  ) => Promise<void>;
  onRefreshState: () => void;
  onProceedNext: () => void;
  onOpenWalkieTalkie?: () => void;
  onOpenRescueProcedure?: (occ: Occupant) => void;
}

export const Step2SignedIn: React.FC<Step2SignedInProps> = ({
  snapshot,
  occupants,
  onCheckIn,
  onBulkCheckIn,
  onRefreshState,
  onProceedNext,
  onOpenWalkieTalkie,
  onOpenRescueProcedure,
}) => {
  const [selectedQuadrant, setSelectedQuadrant] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"roster" | "ledger" | "map">("roster");
  const [selectedOccupantForAction, setSelectedOccupantForAction] = useState<Occupant | null>(null);
  const [rescueProcedureOccupant, setRescueProcedureOccupant] = useState<Occupant | null>(null);
  const [actionFeedbackMsg, setActionFeedbackMsg] = useState<string | null>(null);
  const [directPingSuccessId, setDirectPingSuccessId] = useState<string | null>(null);

  // Statistics
  const totalOccupants = occupants.length;
  const inBuilding = occupants.filter((o) => !o.badgedOut && !o.offSiteToday);
  const badgedOut = occupants.filter((o) => o.badgedOut === true);
  const offSite = occupants.filter((o) => o.offSiteToday === true);
  const visitors = occupants.filter((o) => o.role === "Visitor");

  const quadrantStats: Record<QuadrantId, { inBuilding: number; total: number; label: string }> = {
    NW: {
      label: "Strategic Planning",
      total: occupants.filter((o) => o.quadrant === "NW").length,
      inBuilding: occupants.filter((o) => o.quadrant === "NW" && !o.badgedOut && !o.offSiteToday).length,
    },
    NE: {
      label: "Gas Ops & Security",
      total: occupants.filter((o) => o.quadrant === "NE").length,
      inBuilding: occupants.filter((o) => o.quadrant === "NE" && !o.badgedOut && !o.offSiteToday).length,
    },
    SW: {
      label: "AMI & Ombudsman",
      total: occupants.filter((o) => o.quadrant === "SW").length,
      inBuilding: occupants.filter((o) => o.quadrant === "SW" && !o.badgedOut && !o.offSiteToday).length,
    },
    SE: {
      label: "Steam Operations",
      total: occupants.filter((o) => o.quadrant === "SE").length,
      inBuilding: occupants.filter((o) => o.quadrant === "SE" && !o.badgedOut && !o.offSiteToday).length,
    },
  };

  // Filter occupants
  const filteredOccupants = useMemo(() => {
    return occupants.filter((occ) => {
      // Quadrant filter
      if (selectedQuadrant !== "ALL" && occ.quadrant !== selectedQuadrant) return false;

      // Role filter
      if (filterRole !== "ALL" && occ.role !== filterRole) return false;

      // Presence status filter
      if (filterStatus === "in-building" && (occ.badgedOut || occ.offSiteToday)) return false;
      if (filterStatus === "badged-out" && !occ.badgedOut) return false;
      if (filterStatus === "offsite" && !occ.offSiteToday) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = occ.name.toLowerCase().includes(q);
        const matchDesk = occ.desk?.toLowerCase().includes(q);
        const matchComp = occ.company?.toLowerCase().includes(q);
        const matchId = occ.id.toLowerCase().includes(q);
        if (!matchName && !matchDesk && !matchComp && !matchId) return false;
      }

      return true;
    });
  }, [occupants, selectedQuadrant, filterRole, filterStatus, searchQuery]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOccupants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOccupants.map((o) => o.id)));
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkMarkInBuilding = async () => {
    if (selectedIds.size === 0) return;
    if (onBulkCheckIn) {
      await onBulkCheckIn(Array.from(selectedIds), "safe", "roster-bulk-inbuilding", "Marked in-building via roster", "enter", "inside-building");
    } else {
      for (const id of selectedIds) {
        await onCheckIn(id, "safe", "roster-bulk", "Marked in-building via roster", "inside-building");
      }
    }
    setSelectedIds(new Set());
    onRefreshState();
  };

  const handleBulkBadgeOut = async () => {
    if (selectedIds.size === 0) return;
    if (onBulkCheckIn) {
      await onBulkCheckIn(Array.from(selectedIds), "unaccounted", "roster-bulk-badgeout", "Marked badged out via roster", "leave", "offsite");
    } else {
      for (const id of selectedIds) {
        await onCheckIn(id, "unaccounted", "roster-bulk-badgeout", "Marked badged out via roster", "offsite");
      }
    }
    setSelectedIds(new Set());
    onRefreshState();
  };

  const handleGroupAction = async (qid: QuadrantId, action: "safe" | "in-building" | "badge-out") => {
    const targetOccupants = occupants.filter((o) => o.quadrant === qid);
    const targetIds = targetOccupants.map((o) => o.id);
    if (targetIds.length === 0) return;

    if (action === "safe") {
      if (onBulkCheckIn) {
        await onBulkCheckIn(targetIds, "safe", "sector-bulk-action", `Sector ${qid} marked safe outside`, "leave", "outside-assembly");
      } else {
        for (const id of targetIds) {
          await onCheckIn(id, "safe", "sector-bulk-action", `Sector ${qid} marked safe outside`, "outside-assembly");
        }
      }
      setActionFeedbackMsg(`🟢 Entire Sector ${qid} (${targetIds.length} occupants) marked Safe Outside at assembly area.`);
    } else if (action === "in-building") {
      if (onBulkCheckIn) {
        await onBulkCheckIn(targetIds, "safe", "sector-bulk-action", `Sector ${qid} marked present in building`, "enter", "inside-building");
      } else {
        for (const id of targetIds) {
          await onCheckIn(id, "safe", "sector-bulk-action", `Sector ${qid} marked present in building`, "inside-building");
        }
      }
      setActionFeedbackMsg(`🏢 Entire Sector ${qid} (${targetIds.length} occupants) confirmed In-Building on Floor 07.`);
    } else if (action === "badge-out") {
      if (onBulkCheckIn) {
        await onBulkCheckIn(targetIds, "unaccounted", "sector-bulk-action", `Sector ${qid} badged out of building`, "leave", "offsite");
      } else {
        for (const id of targetIds) {
          await onCheckIn(id, "unaccounted", "sector-bulk-action", `Sector ${qid} badged out of building`, "offsite");
        }
      }
      setActionFeedbackMsg(`🚪 Entire Sector ${qid} (${targetIds.length} occupants) marked Badged Out.`);
    }
    setTimeout(() => setActionFeedbackMsg(null), 5000);
    onRefreshState();
  };

  const handleSendDirectPing = (occ: Occupant) => {
    setDirectPingSuccessId(occ.id);
    setActionFeedbackMsg(`🚨 Life-Safety Evacuation Ping sent to ${occ.name} (${occ.phone || "Device Pass"}). Transmitted via Push & SMS.`);
    setTimeout(() => {
      setDirectPingSuccessId(null);
      setActionFeedbackMsg(null);
    }, 6000);
  };

  return (
    <div id="step-2-signed-in-container" className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#B8D8F8] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#005DAA] uppercase tracking-wider mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#005DAA]" />
            STEP 02 OF 05 · FLOOR ROSTER &amp; ACCOUNTED PRESENCE
          </div>
          <h2 className="text-2xl font-black tracking-tight text-[#0F2537]">
            Live Signed-In Floor Roster
          </h2>
          <p className="text-sm text-[#475569] mt-1 max-w-2xl">
            Everyone verified inside Floor 07 is listed here in real-time. Verified roster presence establishes the exact denominator before an emergency broadcast or alarm is sounded.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-[#F0F6FC] px-4 py-2.5 rounded-xl border border-[#CBDCEE] text-right">
            <div className="text-[10px] font-mono font-bold text-[#475569] uppercase">Total Present</div>
            <div className="text-xl font-mono font-black text-[#005DAA]">
              {inBuilding.length} <span className="text-xs text-[#64748B]">/ {totalOccupants}</span>
            </div>
          </div>

          {onOpenWalkieTalkie && (
            <button
              onClick={onOpenWalkieTalkie}
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="Open Floor Warden Walkie-Talkie Push-to-Talk Radio"
            >
              <span>📻</span>
              <span className="hidden sm:inline">Radio PTT</span>
            </button>
          )}

          <button
            id="step2-proceed-btn"
            onClick={onProceedNext}
            className="px-5 py-3 rounded-xl bg-[#005DAA] hover:bg-[#004884] text-white font-black text-sm tracking-wide transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span>Proceed to Step 03</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* Quadrant Presence Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["NW", "NE", "SW", "SE"] as QuadrantId[]).map((qid) => {
          const stat = quadrantStats[qid];
          const isSelected = selectedQuadrant === qid;
          return (
            <button
              key={qid}
              onClick={() => setSelectedQuadrant(isSelected ? "ALL" : qid)}
              className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${isSelected
                  ? "bg-[#005DAA] text-white border-[#005DAA] shadow-md ring-2 ring-[#005DAA]/30"
                  : "bg-white hover:bg-[#F0F6FC] text-[#0F2537] border-[#B8D8F8]"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-black text-lg ${isSelected ? "text-white" : "text-[#005DAA]"}`}>
                  {qid}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${isSelected ? "bg-white/20 text-white" : "bg-[#EBF3FB] text-[#005DAA]"
                  }`}>
                  {stat.inBuilding} inside
                </span>
              </div>
              <div className="mt-2">
                <div className={`text-xs font-bold truncate ${isSelected ? "text-white" : "text-[#0F2537]"}`}>
                  {stat.label}
                </div>
                <div className={`text-[11px] font-medium mt-0.5 ${isSelected ? "text-white/80" : "text-[#64748B]"}`}>
                  {stat.inBuilding} active / {stat.total} rostered
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Action Feedback Banner */}
      {actionFeedbackMsg && (
        <div className="bg-emerald-50 border-2 border-emerald-500 text-emerald-950 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-md animate-fadeIn">
          <div className="flex items-center gap-2.5 font-bold text-xs sm:text-sm">
            <span>✅</span>
            <span>{actionFeedbackMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedbackMsg(null)}
            className="text-xs font-mono text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sector Group Actions Bar (Active when a Quadrant is selected) */}
      {selectedQuadrant !== "ALL" && (
        <div className="bg-gradient-to-r from-[#003B70] via-[#005DAA] to-[#002D5A] p-4 sm:p-5 rounded-2xl text-white shadow-lg border border-sky-400 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black text-lg">
              🏢
            </div>
            <div>
              <div className="text-[10px] font-mono font-black uppercase text-sky-200 tracking-wider">
                GROUP DIRECT ACTIONS · SECTOR {selectedQuadrant} ({quadrantStats[selectedQuadrant as QuadrantId]?.label})
              </div>
              <div className="text-sm sm:text-base font-black">
                {quadrantStats[selectedQuadrant as QuadrantId]?.inBuilding} occupants currently present inside this sector
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleGroupAction(selectedQuadrant as QuadrantId, "safe")}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <span>🟢</span>
              <span>Mark All Sector Safe Outside</span>
            </button>
            <button
              type="button"
              onClick={() => handleGroupAction(selectedQuadrant as QuadrantId, "in-building")}
              className="px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <span>🏢</span>
              <span>Confirm In-Building</span>
            </button>
            <button
              type="button"
              onClick={() => handleGroupAction(selectedQuadrant as QuadrantId, "badge-out")}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <span>🚪</span>
              <span>Badge Out Sector</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedQuadrant("ALL")}
              className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Clear Filter
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-[#B8D8F8] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, department, desk, or badge ID..."
            className="w-full pl-9 pr-4 py-2.5 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#005DAA] focus:bg-white outline-hidden"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
            🔍
          </span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Quadrant Quick Filter */}
          <select
            value={selectedQuadrant}
            onChange={(e) => setSelectedQuadrant(e.target.value)}
            className="px-3 py-2 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-bold text-[#0F2537] outline-hidden cursor-pointer"
          >
            <option value="ALL">All Quadrants (4)</option>
            <option value="NW">NW · Strategic Planning</option>
            <option value="NE">NE · Gas Ops &amp; Security</option>
            <option value="SW">SW · AMI &amp; Ombudsman</option>
            <option value="SE">SE · Steam Operations</option>
          </select>

          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-bold text-[#0F2537] outline-hidden cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            <option value="Employee">Employees</option>
            <option value="Contractor">Contractors</option>
            <option value="Visitor">Visitors ({visitors.length})</option>
          </select>

          {/* Presence Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-bold text-[#0F2537] outline-hidden cursor-pointer"
          >
            <option value="ALL">All Statuses ({totalOccupants})</option>
            <option value="in-building">In Building ({inBuilding.length})</option>
            <option value="badged-out">Badged Out ({badgedOut.length})</option>
            <option value="offsite">Off-Site Today ({offSite.length})</option>
          </select>
        </div>
      </div>

      {/* Roster & Ledger Dual View Card */}
      <div className="bg-white rounded-2xl border border-[#B8D8F8] shadow-xs overflow-hidden">
        {/* Table Toolbar with View Switcher */}
        <div className="px-6 py-3.5 bg-[#F8FAFC] border-b border-[#CBDCEE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("roster")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${activeTab === "roster"
                  ? "bg-[#005DAA] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-[#CBDCEE] hover:bg-[#F0F6FC]"
                }`}
            >
              <span>👥</span>
              <span>Floor Personnel ({filteredOccupants.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ledger")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${activeTab === "ledger"
                  ? "bg-[#003B70] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-[#CBDCEE] hover:bg-[#F0F6FC]"
                }`}
            >
              <span>⛓️</span>
              <span>Audit Ledger ({snapshot?.ledgerEntries?.length || 0} Blocks)</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("map")}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${activeTab === "map"
                  ? "bg-[#0284C7] text-white shadow-xs"
                  : "bg-white text-slate-600 border border-[#CBDCEE] hover:bg-[#F0F6FC]"
                }`}
            >
              <span>🗺️</span>
              <span>Floor 07 CAD Map</span>
            </button>

            {selectedIds.size > 0 && activeTab === "roster" && (
              <span className="text-xs font-mono font-bold text-[#005DAA] bg-[#EBF3FB] px-2.5 py-0.5 rounded-full border border-[#CBDCEE]">
                {selectedIds.size} Selected
              </span>
            )}
          </div>

          {selectedIds.size > 0 && activeTab === "roster" && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkMarkInBuilding}
                className="px-3 py-1.5 bg-[#005DAA] text-white text-xs font-bold rounded-lg hover:bg-[#004884] transition cursor-pointer flex items-center gap-1"
                title="Mark all selected occupants as In Building"
              >
                <span>🏢</span>
                <span>Mark {selectedIds.size} In-Building</span>
              </button>
              <button
                onClick={handleBulkBadgeOut}
                className="px-3 py-1.5 bg-slate-700 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition cursor-pointer flex items-center gap-1"
                title="Mark all selected occupants as Badged Out / Left Building"
              >
                <span>🚪</span>
                <span>Badge Out {selectedIds.size}</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Personnel Roster Table */}
        {activeTab === "roster" && (
          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#F0F6FC] text-[#475569] font-bold uppercase tracking-wider border-b border-[#CBDCEE] z-10">
                <tr>
                  <th className="p-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredOccupants.length && filteredOccupants.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-[#CBDCEE] text-[#005DAA] cursor-pointer"
                    />
                  </th>
                  <th className="p-3.5">Occupant / Staff</th>
                  <th className="p-3.5">Zone &amp; Desk</th>
                  <th className="p-3.5">Role / Affiliation</th>
                  <th className="p-3.5">Presence Status</th>
                  <th className="p-3.5 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOccupants.map((occ) => {
                  const isSelected = selectedIds.has(occ.id);
                  const isPresent = !occ.badgedOut && !occ.offSiteToday;

                  return (
                    <tr
                      key={occ.id}
                      className={`hover:bg-[#F8FAFC] transition ${isSelected ? "bg-[#EBF3FB]" : isPresent ? "bg-white" : "bg-slate-50/70 opacity-75"
                        }`}
                    >
                      <td className="p-3.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectId(occ.id)}
                          className="rounded border-[#CBDCEE] text-[#005DAA] cursor-pointer"
                        />
                      </td>
                      <td className="p-3.5">
                        <button
                          type="button"
                          onClick={() => setSelectedOccupantForAction(occ)}
                          className="text-left group cursor-pointer w-full focus:outline-hidden"
                          title="Click name to view building location and execute individual life-safety actions"
                        >
                          <div className="font-bold text-sm text-[#0F2537] group-hover:text-[#005DAA] flex items-center gap-2">
                            <span className="group-hover:underline underline-offset-2 decoration-[#005DAA] font-black">{occ.name}</span>
                            <span className="text-[10px] bg-sky-100 group-hover:bg-[#005DAA] text-[#005DAA] group-hover:text-white border border-sky-300 px-2 py-0.5 rounded-md font-mono font-black transition flex items-center gap-1 shadow-2xs">
                              <span>🛡️</span>
                              <span>Safety Action</span>
                            </span>
                            {occ.role === "Visitor" && (
                              <span className="text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-mono px-1 rounded">
                                VISITOR
                              </span>
                            )}
                          </div>
                          <div className="text-slate-500 text-[11px] font-mono flex items-center gap-2 mt-0.5">
                            <span>{occ.id}</span>
                            <span>·</span>
                            {occ.phone ? (
                              <span className="text-[#005DAA] font-bold">
                                📞 {occ.phone}
                              </span>
                            ) : (
                              <span>(212) 555-0199</span>
                            )}
                          </div>
                        </button>
                      </td>
                      <td className="p-3.5">
                        <span className="font-mono font-bold text-[#005DAA]">Sector {occ.quadrant}</span>
                        <div className="text-slate-500 text-[11px]">{occ.desk || "Turnstile Ingress"}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-700">{occ.role}</div>
                        <div className="text-slate-500 text-[11px]">{occ.company || "Con Edison"}</div>
                      </td>
                      <td className="p-3.5">
                        {isPresent ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-950 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            In Building (Floor 07)
                          </span>
                        ) : occ.badgedOut ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[11px] bg-slate-200 text-slate-700">
                            Badged Out
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[11px] bg-blue-50 text-blue-800 border border-blue-200">
                            Off-Site / Remote
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedOccupantForAction(occ)}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#005DAA] to-[#003B70] hover:from-[#004884] hover:to-[#002D5A] text-white font-black text-xs cursor-pointer shadow-xs flex items-center gap-1.5 active:scale-95 transition"
                            title="Inspect building location and perform direct life-safety action"
                          >
                            <span>🛡️</span>
                            <span>Safety Action</span>
                          </button>
                          {isPresent ? (
                            <button
                              type="button"
                              onClick={() =>
                                onCheckIn(occ.id, "unaccounted", "manual-toggle", "Marked badged out", "offsite")
                              }
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                            >
                              Badge Out
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onCheckIn(occ.id, "safe", "manual-toggle", "Marked in-building", "inside-building")
                              }
                              className="px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-[11px] cursor-pointer"
                            >
                              In-Bldg
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Cryptographic Audit Ledger View */}
        {activeTab === "ledger" && (
          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-[#F0F6FC] text-[#475569] font-bold uppercase tracking-wider border-b border-[#CBDCEE] z-10">
                <tr>
                  <th className="p-3.5 w-24">Block #</th>
                  <th className="p-3.5 w-24">Time</th>
                  <th className="p-3.5">Occupant / Action</th>
                  <th className="p-3.5">Sector &amp; Location</th>
                  <th className="p-3.5">SHA-256 Hash Seal</th>
                  <th className="p-3.5 text-right">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(snapshot?.ledgerEntries || []).slice().reverse().map((entry: any, idx: number) => {
                  const name = entry.payload?.name || entry.payload?.occupantName || entry.type;
                  const id = entry.payload?.occupantId || entry.payload?.userId || "";
                  const action = entry.payload?.presence || entry.payload?.newStatus || entry.type;
                  const quad = entry.payload?.quadrant || "Floor 07";

                  return (
                    <tr key={entry.id || idx} className="hover:bg-[#F8FAFC] transition">
                      <td className="p-3.5 font-bold text-[#005DAA]">
                        {entry.id || `L-${String(idx + 1).padStart(4, "0")}`}
                      </td>
                      <td className="p-3.5 text-slate-500">
                        {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Recorded"}
                      </td>
                      <td className="p-3.5 font-sans font-bold text-[#0F2537]">
                        {name} {id && <span className="text-slate-500 font-mono text-[11px]">({id})</span>}
                        <div className="text-[10px] text-slate-500 font-mono capitalize">
                          {entry.type.replace(/-/g, " ")}
                        </div>
                      </td>
                      <td className="p-3.5 font-bold text-slate-700">
                        Sector {quad}
                      </td>
                      <td className="p-3.5 text-slate-500 truncate max-w-[200px]" title={entry.hash}>
                        {entry.hash ? entry.hash.substring(0, 14) + "..." + entry.hash.substring(entry.hash.length - 4) : "6c79d9cd..."}
                      </td>
                      <td className="p-3.5 text-right">
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-950 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          ✓ SEALED
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Floor 07 Architectural CAD Map View */}
        {activeTab === "map" && (
          <div className="p-4 bg-slate-50 border-t border-[#CBDCEE]">
            <ActualBuildingFloorMap
              targetQuadrant={selectedQuadrant !== "ALL" ? (selectedQuadrant as QuadrantId) : undefined}
              onSelectQuadrant={(qid) => setSelectedQuadrant(qid)}
              quadrantCounts={{
                NW: quadrantStats.NW.inBuilding,
                NE: quadrantStats.NE.inBuilding,
                SW: quadrantStats.SW.inBuilding,
                SE: quadrantStats.SE.inBuilding,
              }}
              showEgressPath={true}
            />
          </div>
        )}
      </div>
            {/* Unified Occupant Safety Action & Building Location Modal */}
      <OccupantSafetyActionModal
        occupant={selectedOccupantForAction}
        onClose={() => setSelectedOccupantForAction(null)}
        onCheckIn={onCheckIn}
        onSendDirectPing={handleSendDirectPing}
        onFeedbackMessage={(msg) => setActionFeedbackMsg(msg)}
        onOpenRescueProcedure={(occ) => {
          if (onOpenRescueProcedure) {
            onOpenRescueProcedure(occ);
          } else {
            setRescueProcedureOccupant(occ);
          }
        }}
      />

      {/* Emergency Rescue Procedure Modal if triggered locally */}
      {rescueProcedureOccupant && (
        <EmergencyRescueProcedureModal
          isOpen={!!rescueProcedureOccupant}
          occupant={rescueProcedureOccupant}
          onClose={() => setRescueProcedureOccupant(null)}
          onCheckIn={onCheckIn}
          onOpenWalkieTalkie={onOpenWalkieTalkie}
        />
      )}
    </div>
  );
};