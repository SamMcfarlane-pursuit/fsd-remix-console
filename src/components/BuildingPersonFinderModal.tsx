import { useState, useMemo } from "react";
import { Occupant, OccupantStatus, QuadrantId } from "../types";

interface BuildingPersonFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  occupants: Occupant[];
  onCheckIn: (
    occupantId: string,
    status: OccupantStatus,
    via?: string,
    notes?: string,
    locationCategory?: "inside-building" | "outside-assembly" | "offsite",
    assemblyPoint?: string
  ) => void;
  initialQuadrant?: string;
  onLocateOnMap?: (quadrantId: QuadrantId) => void;
}

export default function BuildingPersonFinderModal({
  isOpen,
  onClose,
  occupants,
  onCheckIn,
  initialQuadrant = "ALL",
  onLocateOnMap,
}: BuildingPersonFinderModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuadrant, setSelectedQuadrant] = useState<string>(initialQuadrant);
  const [statusFilter, setStatusFilter] = useState<"all" | "inside" | "unaccounted" | "at-risk" | "safe">("all");
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Sync initial quadrant when modal opens
  useState(() => {
    if (initialQuadrant) {
      setSelectedQuadrant(initialQuadrant);
    }
  });

  const filteredOccupants = useMemo(() => {
    return occupants.filter((o) => {
      // Quadrant filter
      if (selectedQuadrant !== "ALL") {
        if (selectedQuadrant === "ARA" && !o.araAssigned && o.status !== "awaiting-evac-chair") return false;
        if (selectedQuadrant === "OUTSIDE" && o.locationCategory !== "outside-assembly" && o.status !== "safe") return false;
        if (["NW", "NE", "SW", "SE"].includes(selectedQuadrant) && o.quadrant !== selectedQuadrant) return false;
      }

      // Status / Location filter
      if (statusFilter === "inside" && o.locationCategory !== "inside-building" && o.locationCategory !== undefined) return false;
      if (statusFilter === "unaccounted" && o.status === "safe") return false;
      if (statusFilter === "at-risk" && o.status !== "need-help" && o.status !== "awaiting-evac-chair" && o.status !== "mia") return false;
      if (statusFilter === "safe" && o.status !== "safe") return false;

      // Text search (matches name, id, role, lastLocation, desk, assembly point)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = o.name.toLowerCase().includes(q);
        const matchId = o.id.toLowerCase().includes(q);
        const matchRole = o.role.toLowerCase().includes(q);
        const matchLoc = (o.lastLocation || "").toLowerCase().includes(q);
        const matchDesk = (o.desk || "").toLowerCase().includes(q);
        const matchAssembly = (o.assemblyPoint || "").toLowerCase().includes(q);
        return matchName || matchId || matchRole || matchLoc || matchDesk || matchAssembly;
      }

      return true;
    });
  }, [occupants, selectedQuadrant, statusFilter, searchQuery]);

  if (!isOpen) return null;

  const handleStatusChange = (occupantId: string, name: string, newStatus: OccupantStatus) => {
    onCheckIn(occupantId, newStatus, "person-finder", `Status updated via building finder radar`);
    setActionSuccessMessage(`Updated ${name} → ${newStatus.toUpperCase()}`);
    setTimeout(() => setActionSuccessMessage(null), 3000);
  };

  const nwCount = occupants.filter((o) => o.quadrant === "NW" && !o.badgedOut).length;
  const neCount = occupants.filter((o) => o.quadrant === "NE" && !o.badgedOut).length;
  const swCount = occupants.filter((o) => o.quadrant === "SW" && !o.badgedOut).length;
  const seCount = occupants.filter((o) => o.quadrant === "SE" && !o.badgedOut).length;
  const araCount = occupants.filter((o) => o.araAssigned || o.status === "awaiting-evac-chair").length;
  const outsideCount = occupants.filter((o) => o.locationCategory === "outside-assembly" || o.status === "safe").length;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl border-2 border-[#005DAA] shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden text-[#0F2537]">
        {/* Modal Header */}
        <div className="bg-[#003B70] text-white p-4 sm:p-5 flex items-center justify-between border-b border-[#005DAA] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#005DAA] border border-[#38BDF8]/40 flex items-center justify-center text-xl shadow-xs">
              🎯
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <span>Building Occupant Finder & Spatial Attendance</span>
                <span className="text-[10px] font-mono font-bold bg-[#FF6B00] text-slate-950 px-2 py-0.5 rounded-full">
                  LIVE RADAR
                </span>
              </h2>
              <p className="text-xs text-sky-200 font-medium">
                Locate any person across all 4 quadrants, ARA landing, or outside assembly points.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white font-black text-sm flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Notification Toast */}
        {actionSuccessMessage && (
          <div className="bg-emerald-600 text-white text-xs font-bold py-1.5 px-4 text-center animate-pulse shrink-0">
            ✓ {actionSuccessMessage}
          </div>
        )}

        {/* Quadrant Quick-Filter Bar */}
        <div className="p-3 sm:p-4 bg-[#F0F6FC] border-b border-[#B8D8F8] space-y-3 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#005DAA]">
              Filter By Quadrant / Sector:
            </span>
            <span className="text-xs font-mono font-bold text-[#64748B]">
              Found: <strong className="text-[#005DAA]">{filteredOccupants.length}</strong> / {occupants.length} Total
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 text-xs font-bold">
            <button
              onClick={() => setSelectedQuadrant("ALL")}
              className={`p-2 rounded-lg text-center transition cursor-pointer border ${
                selectedQuadrant === "ALL"
                  ? "bg-[#005DAA] text-white border-[#005DAA] shadow-xs"
                  : "bg-white text-[#0F2537] border-[#B8D8F8] hover:bg-[#EBF5FB]"
              }`}
            >
              <div className="text-[10px] font-black uppercase">All Floors</div>
              <div className="font-mono text-sm font-black">{occupants.length}</div>
            </button>

            <button
              onClick={() => setSelectedQuadrant("NW")}
              className={`p-2 rounded-lg text-center transition cursor-pointer border ${
                selectedQuadrant === "NW"
                  ? "bg-[#005DAA] text-white border-[#005DAA] shadow-xs"
                  : "bg-white text-[#0F2537] border-[#B8D8F8] hover:bg-[#EBF5FB]"
              }`}
            >
              <div className="text-[10px] font-black uppercase">NW Engineering</div>
              <div className="font-mono text-sm font-black">{nwCount}</div>
            </button>

            <button
              onClick={() => setSelectedQuadrant("NE")}
              className={`p-2 rounded-lg text-center transition cursor-pointer border ${
                selectedQuadrant === "NE"
                  ? "bg-[#005DAA] text-white border-[#005DAA] shadow-xs"
                  : "bg-white text-[#0F2537] border-[#B8D8F8] hover:bg-[#EBF5FB]"
              }`}
            >
              <div className="text-[10px] font-black uppercase">NE Comms/Gov</div>
              <div className="font-mono text-sm font-black">{neCount}</div>
            </button>

            <button
              onClick={() => setSelectedQuadrant("SW")}
              className={`p-2 rounded-lg text-center transition cursor-pointer border ${
                selectedQuadrant === "SW"
                  ? "bg-[#005DAA] text-white border-[#005DAA] shadow-xs"
                  : "bg-white text-[#0F2537] border-[#B8D8F8] hover:bg-[#EBF5FB]"
              }`}
            >
              <div className="text-[10px] font-black uppercase">SW Legal</div>
              <div className="font-mono text-sm font-black">{swCount}</div>
            </button>

            <button
              onClick={() => setSelectedQuadrant("SE")}
              className={`p-2 rounded-lg text-center transition cursor-pointer border ${
                selectedQuadrant === "SE"
                  ? "bg-[#005DAA] text-white border-[#005DAA] shadow-xs"
                  : "bg-white text-[#0F2537] border-[#B8D8F8] hover:bg-[#EBF5FB]"
              }`}
            >
              <div className="text-[10px] font-black uppercase">SE Visitors/IT</div>
              <div className="font-mono text-sm font-black">{seCount}</div>
            </button>

            <button
              onClick={() => setSelectedQuadrant("ARA")}
              className={`p-2 rounded-lg text-center transition cursor-pointer border ${
                selectedQuadrant === "ARA"
                  ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                  : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100"
              }`}
            >
              <div className="text-[10px] font-black uppercase">🛗 Stair A ARA</div>
              <div className="font-mono text-sm font-black">{araCount}</div>
            </button>

            <button
              onClick={() => setSelectedQuadrant("OUTSIDE")}
              className={`p-2 rounded-lg text-center transition cursor-pointer border ${
                selectedQuadrant === "OUTSIDE"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100"
              }`}
            >
              <div className="text-[10px] font-black uppercase">🌳 Outside Assembly</div>
              <div className="font-mono text-sm font-black">{outsideCount}</div>
            </button>
          </div>

          {/* Search Bar & Secondary Triage Filters */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#005DAA]">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, desk (e.g. 07-NW-14), employee role, or department..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-[#B8D8F8] rounded-xl text-xs font-semibold text-[#0F2537] placeholder-[#64748B] focus:outline-none focus:border-[#005DAA] shadow-xs"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#B8D8F8]">
              {[
                { id: "all", label: "All Status" },
                { id: "inside", label: "Inside Bldg" },
                { id: "unaccounted", label: "Unaccounted" },
                { id: "at-risk", label: "Need Help/ARA" },
                { id: "safe", label: "Safe" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                    statusFilter === f.id
                      ? "bg-[#005DAA] text-white shadow-xs"
                      : "text-[#64748B] hover:bg-[#F0F6FC]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Occupants Search Results Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 max-h-[50vh]">
          {filteredOccupants.length === 0 ? (
            <div className="text-center py-12 text-[#64748B] space-y-2">
              <div className="text-3xl">🔍</div>
              <div className="text-sm font-bold text-[#0F2537]">No occupants matched your search or quadrant filter</div>
              <p className="text-xs">Try clearing the search query or selecting "All Floors".</p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedQuadrant("ALL");
                  setStatusFilter("all");
                }}
                className="mt-2 px-3 py-1.5 bg-[#005DAA] text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Reset Search Filters
              </button>
            </div>
          ) : (
            filteredOccupants.map((o) => {
              const isSafe = o.status === "safe";
              const isHelp = o.status === "need-help";
              const isAra = o.status === "awaiting-evac-chair";
              const isMia = o.status === "mia";

              return (
                <div
                  key={o.id}
                  className={`p-3 rounded-xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
                    isHelp || isMia
                      ? "bg-red-50/70 border-red-300"
                      : isAra
                      ? "bg-amber-50/70 border-amber-300"
                      : isSafe
                      ? "bg-emerald-50/50 border-emerald-200"
                      : "bg-white border-[#B8D8F8]"
                  }`}
                >
                  {/* Occupant Identity & Location */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-[#005DAA] bg-[#EBF5FB] px-1.5 py-0.5 rounded border border-[#B8D8F8]">
                        {o.id}
                      </span>
                      <span className="font-bold text-sm text-[#0F2537]">{o.name}</span>
                      <span className="text-[11px] font-semibold text-[#64748B]">· {o.role}</span>
                      {o.araAssigned && (
                        <span className="text-[10px] font-black text-amber-900 bg-amber-200 px-1.5 py-0.5 rounded border border-amber-400">
                          🛗 ARA Assigned
                        </span>
                      )}
                    </div>

                    {/* Spatial Location Readout */}
                    <div className="flex items-center gap-2 text-xs text-[#475569] flex-wrap">
                      <span className="font-bold text-[#0F2537]">
                        📍 Sector: {o.quadrant} Quadrant (Floor 07)
                      </span>
                      <span>·</span>
                      <span>Desk/Zone: <strong className="text-[#005DAA]">{o.desk || `${o.quadrant}-Core`}</strong></span>
                      {o.lastLocation && (
                        <>
                          <span>·</span>
                          <span className="italic">Last seen: {o.lastLocation}</span>
                        </>
                      )}
                      {o.assemblyPoint && (
                        <>
                          <span>·</span>
                          <span className="text-emerald-800 font-bold">Assembly: {o.assemblyPoint}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Status Badge & 1-Click Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {/* Current Status Pill */}
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase font-mono ${
                        isSafe
                          ? "bg-emerald-600 text-white"
                          : isHelp
                          ? "bg-red-600 text-white animate-pulse"
                          : isAra
                          ? "bg-amber-500 text-slate-950 font-black"
                          : isMia
                          ? "bg-red-800 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {o.status.toUpperCase()}
                    </span>

                    {/* 1-Click Action Buttons */}
                    {o.status !== "safe" && (
                      <button
                        onClick={() => handleStatusChange(o.id, o.name, "safe")}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                        title="Mark Accounted & Safe"
                      >
                        ✓ Safe
                      </button>
                    )}

                    {o.status !== "need-help" && (
                      <button
                        onClick={() => handleStatusChange(o.id, o.name, "need-help")}
                        className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 rounded-lg text-xs font-bold transition cursor-pointer"
                        title="Flag Need Immediate Assistance"
                      >
                        🚨 Help
                      </button>
                    )}

                    {o.araAssigned && o.status !== "awaiting-evac-chair" && (
                      <button
                        onClick={() => handleStatusChange(o.id, o.name, "awaiting-evac-chair")}
                        className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition cursor-pointer"
                        title="Request Evac Chair at Stairwell A"
                      >
                        🛗 ARA
                      </button>
                    )}

                    {onLocateOnMap && o.quadrant && (
                      <button
                        onClick={() => {
                          onLocateOnMap(o.quadrant as QuadrantId);
                          onClose();
                        }}
                        className="px-2 py-1 bg-[#EBF5FB] hover:bg-[#B8D8F8] text-[#005DAA] border border-[#B8D8F8] rounded-lg text-xs font-bold transition cursor-pointer"
                        title="Highlight Sector on Tactical Floorplan"
                      >
                        🗺️ Map
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#F0F6FC] border-t border-[#B8D8F8] p-3 sm:p-4 flex items-center justify-between shrink-0">
          <div className="text-xs text-[#64748B] font-medium hidden sm:block">
            Press <kbd className="px-1.5 py-0.5 bg-white border border-[#B8D8F8] rounded font-mono text-[10px]">Esc</kbd> or click Close to return to Command Deck.
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-[#005DAA] hover:bg-[#004A88] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-xs"
          >
            Close Radar Finder
          </button>
        </div>
      </div>
    </div>
  );
}
