import React, { useState, useMemo } from "react";
import { Occupant, OccupantStatus, QuadrantId, StatusSnapshot } from "../../types";

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
    notes?: string
  ) => Promise<void>;
  onRefreshState: () => void;
  onProceedNext: () => void;
}

export const Step2SignedIn: React.FC<Step2SignedInProps> = ({
  snapshot,
  occupants,
  onCheckIn,
  onBulkCheckIn,
  onRefreshState,
  onProceedNext,
}) => {
  const [selectedQuadrant, setSelectedQuadrant] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
      await onBulkCheckIn(Array.from(selectedIds), "safe", "roster-bulk-inbuilding");
    } else {
      for (const id of selectedIds) {
        await onCheckIn(id, "safe", "roster-bulk", "Marked in-building via roster", "inside-building");
      }
    }
    setSelectedIds(new Set());
    onRefreshState();
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
              className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "bg-[#005DAA] text-white border-[#005DAA] shadow-md ring-2 ring-[#005DAA]/30"
                  : "bg-white hover:bg-[#F0F6FC] text-[#0F2537] border-[#B8D8F8]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-black text-lg ${isSelected ? "text-white" : "text-[#005DAA]"}`}>
                  {qid}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  isSelected ? "bg-white/20 text-white" : "bg-[#EBF3FB] text-[#005DAA]"
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

      {/* Roster Table Card */}
      <div className="bg-white rounded-2xl border border-[#B8D8F8] shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="px-6 py-3.5 bg-[#F8FAFC] border-b border-[#CBDCEE] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-[#0F2537] uppercase tracking-wider">
              {filteredOccupants.length} Personnel Listed
            </span>
            {selectedIds.size > 0 && (
              <span className="text-xs font-mono font-bold text-[#005DAA] bg-[#EBF3FB] px-2.5 py-0.5 rounded-full border border-[#CBDCEE]">
                {selectedIds.size} Selected
              </span>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkMarkInBuilding}
                className="px-3 py-1.5 bg-[#005DAA] text-white text-xs font-bold rounded-lg hover:bg-[#004884] transition cursor-pointer"
              >
                Mark {selectedIds.size} In-Building
              </button>
            </div>
          )}
        </div>

        {/* Table Content */}
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
                    className={`hover:bg-[#F8FAFC] transition ${
                      isSelected ? "bg-[#EBF3FB]" : isPresent ? "bg-white" : "bg-slate-50/70 opacity-75"
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
                      <div className="font-bold text-[#0F2537] text-sm">{occ.name}</div>
                      <div className="text-[11px] text-[#64748B] font-mono">
                        {occ.id} · {occ.phone || "Ext 4100"}
                      </div>
                    </td>
                    <td className="p-3.5 font-medium">
                      <span className="inline-block px-2 py-0.5 rounded bg-[#EBF3FB] text-[#005DAA] font-bold text-[11px] mr-1.5">
                        {occ.quadrant}
                      </span>
                      <span className="text-[#475569]">{occ.desk || "07-Floor"}</span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          occ.role === "Visitor"
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : occ.role === "Contractor"
                            ? "bg-purple-100 text-purple-900 border border-purple-300"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {occ.role}
                      </span>
                      <div className="text-[11px] text-[#64748B] mt-0.5">{occ.company || "Con Edison"}</div>
                    </td>
                    <td className="p-3.5">
                      {isPresent ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold text-[11px] bg-emerald-100 text-emerald-900 border border-emerald-300">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
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
                      {isPresent ? (
                        <button
                          onClick={() =>
                            onCheckIn(occ.id, "unaccounted", "manual-toggle", "Marked badged out", "offsite")
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                        >
                          Badge Out
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            onCheckIn(occ.id, "safe", "manual-toggle", "Marked in-building", "inside-building")
                          }
                          className="px-2.5 py-1 rounded-lg bg-[#005DAA] hover:bg-[#004884] text-white font-bold text-[11px] cursor-pointer"
                        >
                          Mark In-Building
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
