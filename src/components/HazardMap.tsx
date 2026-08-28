import React, { useState, useMemo, useRef, useEffect } from "react";
import { Occupant, QuadrantId } from "../types";

interface HazardMapProps {
  occupants?: Occupant[];
  hazardType?: string | null;
  onSelectQuadrant?: (id: QuadrantId) => void;
  onCheckIn?: (
    occupantId: string,
    status: any,
    via?: string,
    notes?: string,
    locationCategory?: any,
    assemblyPoint?: string
  ) => void;
}

export default function HazardMap({
  occupants = [],
  hazardType = "office-fire",
  onSelectQuadrant,
  onCheckIn,
}: HazardMapProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOccupantId, setSelectedOccupantId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Accurate Presence Breakdown
  const insideBuildingCount = useMemo(
    () => occupants.filter((o) => !o.badgedOut && !o.offSiteToday && o.locationCategory !== "outside-assembly" && o.locationCategory !== "offsite").length,
    [occupants]
  );

  const outsideAssemblyCount = useMemo(
    () => occupants.filter((o) => o.locationCategory === "outside-assembly" || (o.status === "safe" && !o.badgedOut && !o.offSiteToday)).length,
    [occupants]
  );

  const offsiteCount = useMemo(
    () => occupants.filter((o) => o.badgedOut || o.offSiteToday || o.locationCategory === "offsite").length,
    [occupants]
  );

  // Department counts
  const nwCount = useMemo(() => occupants.filter((o) => o.quadrant === "NW" && !o.badgedOut && !o.offSiteToday).length, [occupants]);
  const swCount = useMemo(() => occupants.filter((o) => o.quadrant === "SW" && !o.badgedOut && !o.offSiteToday).length, [occupants]);
  const neCount = useMemo(() => occupants.filter((o) => o.quadrant === "NE" && !o.badgedOut && !o.offSiteToday).length, [occupants]);
  const seCount = useMemo(() => occupants.filter((o) => o.quadrant === "SE" && !o.badgedOut && !o.offSiteToday).length, [occupants]);
  const unverifiedCount = useMemo(() => occupants.filter((o) => o.status === "unaccounted" && !o.badgedOut && !o.offSiteToday).length, [occupants]);

  // Filter occupants based on search query
  const filteredOccupants = useMemo(() => {
    if (!searchQuery.trim()) return occupants;
    const q = searchQuery.toLowerCase();
    return occupants.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.role.toLowerCase().includes(q) ||
        (o.desk && o.desk.toLowerCase().includes(q)) ||
        (o.phone && o.phone.toLowerCase().includes(q)) ||
        (o.lastLocation && o.lastLocation.toLowerCase().includes(q))
    );
  }, [occupants, searchQuery]);

  const selectedOccupant = useMemo(
    () => occupants.find((o) => o.id === selectedOccupantId),
    [occupants, selectedOccupantId]
  );

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.6));
  const handleResetView = () => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const toggleFullscreen = () => {
    if (!mapContainerRef.current) return;
    if (!document.fullscreenElement) {
      mapContainerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Mouse pan handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoomLevel((prev) => Math.min(prev + 0.1, 3));
    } else {
      setZoomLevel((prev) => Math.max(prev - 0.1, 0.6));
    }
  };

  return (
    <div
      ref={mapContainerRef}
      className={`bg-white rounded-2xl border border-[#B8D8F8] p-4 sm:p-5 shadow-sm space-y-3.5 text-[#0F2537] ${
        isFullscreen ? "p-6 h-screen w-screen overflow-auto" : ""
      }`}
    >
      {/* 1. Header & Live Presence Counters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#B8D8F8] pb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl">🗺️</span>
            <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-[#005DAA]">
              4 IRVING PLACE · FLOOR 07 — LIVE OCCUPANT MAP
            </h2>
          </div>
          <p className="text-xs text-[#475569] mt-0.5 font-medium">
            Actual as-built floor plan (Jan 14 2026). Each dot is a real occupant from the Floor 7 evacuation list, shown in their department zone.
          </p>
        </div>

        {/* Live Presence Statistics Badges */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-950 text-xs font-black flex items-center gap-1.5 shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span>In Building: {insideBuildingCount}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-black flex items-center gap-1.5 shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <span>Outside: {outsideAssemblyCount}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-100 text-slate-700 text-xs font-black flex items-center gap-1.5 shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span>Off-Site: {offsiteCount}</span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Search Bar */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-[#005DAA]">🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Find person by name, room (e.g. 07-463), section, or ID..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#B8D8F8] rounded-xl text-xs sm:text-sm font-semibold text-[#0F2537] placeholder-[#64748B] focus:outline-none focus:border-[#005DAA] shadow-2xs"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Selected Person Inspector Flyout */}
      {selectedOccupant && (
        <div className="p-3.5 bg-[#EBF5FB] border-2 border-[#005DAA] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-[#005DAA]">{selectedOccupant.name}</span>
              <span className="font-mono text-xs bg-[#005DAA] text-white px-2 py-0.5 rounded font-bold">
                {selectedOccupant.id}
              </span>
              <span className="text-xs text-[#475569] font-mono">
                {selectedOccupant.phone || "(212) 555-0100"}
              </span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                selectedOccupant.badgedOut ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-800"
              }`}>
                {selectedOccupant.badgedOut ? "⚪ Left Building" : "🟢 In Building"}
              </span>
            </div>
            <div className="text-xs text-[#0F2537] mt-1 font-medium">
              Quadrant: <strong>{selectedOccupant.quadrant}</strong> · Desk: <strong>{selectedOccupant.desk || "07-Workstation"}</strong> · Status: <strong className="uppercase">{selectedOccupant.status}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onCheckIn && (
              <>
                <button
                  onClick={() => onCheckIn(selectedOccupant.id, "safe", "hazard-map", "Marked safe from map", "outside-assembly", "Assembly Point A")}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  ✓ Mark Safe
                </button>
                <button
                  onClick={() => onCheckIn(selectedOccupant.id, "awaiting-evac-chair", "hazard-map", "Requested ARA Chair", "inside-building")}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  🛗 Evac Chair
                </button>
              </>
            )}
            <button
              onClick={() => setSelectedOccupantId(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-1 cursor-pointer"
            >
              ✕ Close
            </button>
          </div>
        </div>
      )}

      {/* 3. High-Resolution CAD Floorplan Map Canvas with Floating Pan/Zoom Controls */}
      <div
        className="relative w-full aspect-[16/10] bg-[#F8FAFC] rounded-2xl border-2 border-[#B8D8F8] overflow-hidden select-none shadow-inner cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Floating Zoom & Tool Controls (Top Right) */}
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-white/95 backdrop-blur-xs p-1.5 rounded-xl border border-[#B8D8F8] shadow-md">
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#005DAA] font-black text-sm flex items-center justify-center transition cursor-pointer"
            title="Zoom Out"
          >
            🔍-
          </button>
          <span className="font-mono text-xs font-black text-[#005DAA] px-2 min-w-[48px] text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#005DAA] font-black text-sm flex items-center justify-center transition cursor-pointer"
            title="Zoom In"
          >
            🔍+
          </button>
          <button
            onClick={handleResetView}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#005DAA] font-bold text-sm flex items-center justify-center transition cursor-pointer"
            title="Reset Pan & Zoom"
          >
            🎯
          </button>
          <button
            onClick={toggleFullscreen}
            className="w-8 h-8 rounded-lg bg-[#005DAA] hover:bg-[#004A88] text-white font-bold text-sm flex items-center justify-center transition cursor-pointer"
            title="Fullscreen Mode"
          >
            ⛶
          </button>
        </div>

        {/* Pan and Zoom Transformation Container */}
        <div
          style={{
            transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          className="w-full h-full"
        >
          <svg viewBox="0 0 1000 620" className="w-full h-full font-sans pointer-events-auto">
            <defs>
              <pattern id="cadGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E2E8F0" strokeWidth="0.7" />
              </pattern>
              <radialGradient id="hazardPulse" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#DC2626" stopOpacity="0.75" />
                <stop offset="60%" stopColor="#EA580C" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#EA580C" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Background Grid */}
            <rect width="1000" height="620" fill="url(#cadGrid)" />

            {/* Surrounding Streets & North Compass */}
            <rect x="0" y="0" width="1000" height="24" fill="#003B70" />
            <text x="500" y="16" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="900" letterSpacing="3">
              ▲ NORTH — EAST 15TH STREET ▲
            </text>

            <rect x="0" y="24" width="24" height="572" fill="#003B70" />
            <text
              x="-310"
              y="16"
              transform="rotate(-90)"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="900"
              letterSpacing="3"
            >
              ◄ WEST — IRVING PLACE ◄
            </text>

            <rect x="976" y="24" width="24" height="572" fill="#003B70" />
            <text
              x="310"
              y="-984"
              transform="rotate(90)"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="900"
              letterSpacing="3"
            >
              ► EAST — THIRD AVENUE ►
            </text>

            <rect x="0" y="596" width="1000" height="24" fill="#003B70" />
            <text x="500" y="612" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="900" letterSpacing="3">
              ▼ SOUTH — EAST 14TH STREET ▼
            </text>

            {/* Main Outer Building Floor Wall Boundary */}
            <rect x="36" y="34" width="928" height="552" fill="#FFFFFF" stroke="#005DAA" strokeWidth="2.5" rx="4" />

            {/* Central Courtyard Lightwell */}
            <rect x="420" y="210" width="160" height="190" fill="#E2E8F0" stroke="#005DAA" strokeWidth="1.5" rx="4" />
            <text x="500" y="300" textAnchor="middle" fill="#475569" fontSize="11" fontWeight="900" letterSpacing="2">
              COURTYARD
            </text>
            <text x="500" y="318" textAnchor="middle" fill="#64748B" fontSize="9" fontWeight="bold">
              (OPEN AIR LIGHTWELL)
            </text>

            {/* Elev Core Lobby E (NW) */}
            <g transform="translate(180, 75)">
              <rect width="110" height="95" fill="#80D0F8" stroke="#005DAA" strokeWidth="1.5" rx="3" />
              <text x="55" y="30" textAnchor="middle" fill="#003B70" fontSize="10" fontWeight="900">
                ELEV LOBBY E
              </text>
              <rect x="10" y="42" width="25" height="38" fill="#FFFFFF" stroke="#005DAA" strokeWidth="1" />
              <text x="22" y="64" textAnchor="middle" fill="#005DAA" fontSize="8" fontWeight="bold">EL-1</text>
              <rect x="42" y="42" width="25" height="38" fill="#FFFFFF" stroke="#005DAA" strokeWidth="1" />
              <text x="54" y="64" textAnchor="middle" fill="#005DAA" fontSize="8" fontWeight="bold">EL-2</text>
              <rect x="74" y="42" width="25" height="38" fill="#FFFFFF" stroke="#005DAA" strokeWidth="1" />
              <text x="86" y="64" textAnchor="middle" fill="#005DAA" fontSize="8" fontWeight="bold">EL-3</text>
            </g>

            {/* Main Center Elev Lobby C */}
            <g transform="translate(420, 75)">
              <rect width="160" height="125" fill="#80D0F8" stroke="#005DAA" strokeWidth="1.5" rx="3" />
              <text x="80" y="28" textAnchor="middle" fill="#003B70" fontSize="10.5" fontWeight="900">
                ELEV LOBBY C (MAIN CORE)
              </text>
              <rect x="15" y="42" width="36" height="42" fill="#FFFFFF" stroke="#005DAA" strokeWidth="1" />
              <text x="33" y="66" textAnchor="middle" fill="#005DAA" fontSize="8.5" fontWeight="bold">ELEV A</text>
              <rect x="62" y="42" width="36" height="42" fill="#FFFFFF" stroke="#005DAA" strokeWidth="1" />
              <text x="80" y="66" textAnchor="middle" fill="#005DAA" fontSize="8.5" fontWeight="bold">ELEV B</text>
              <rect x="108" y="42" width="38" height="42" fill="#FFFFFF" stroke="#005DAA" strokeWidth="1" />
              <text x="127" y="66" textAnchor="middle" fill="#005DAA" fontSize="8.5" fontWeight="bold">ELEV C</text>
              <text x="80" y="105" textAnchor="middle" fill="#DC2626" fontSize="7.5" fontWeight="bold">
                (GROUNDED IN ALARM)
              </text>
            </g>

            {/* Elev Lobby G & D (NE) */}
            <g transform="translate(680, 75)">
              <rect width="95" height="95" fill="#80D0F8" stroke="#005DAA" strokeWidth="1.5" rx="3" />
              <text x="47" y="35" textAnchor="middle" fill="#003B70" fontSize="9.5" fontWeight="900">
                ELEV LOBBY G
              </text>
              <text x="47" y="55" textAnchor="middle" fill="#005DAA" fontSize="8" fontWeight="bold">
                RISER D / SHAFTS
              </text>
            </g>

            <g transform="translate(795, 150)">
              <rect width="90" height="85" fill="#80D0F8" stroke="#005DAA" strokeWidth="1.5" rx="3" />
              <text x="45" y="45" textAnchor="middle" fill="#003B70" fontSize="9.5" fontWeight="900">
                ELEV LOBBY D
              </text>
            </g>

            {/* Stair A - West ARA Landing */}
            <g transform="translate(36, 205)">
              <rect width="65" height="115" fill="#FEF3C7" stroke="#D97706" strokeWidth="2" rx="3" />
              <text x="32" y="24" textAnchor="middle" fill="#B45309" fontSize="9.5" fontWeight="900">
                STAIR A
              </text>
              <rect x="8" y="32" width="50" height="22" fill="#D97706" rx="3" />
              <text x="32" y="47" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="900">
                🛗 ARA ZONE
              </text>
              <text x="32" y="70" textAnchor="middle" fill="#92400E" fontSize="7.5" fontWeight="bold">
                Floor 07 Chair
              </text>
              <text x="32" y="85" textAnchor="middle" fill="#92400E" fontSize="7" fontWeight="bold">
                Capacity: 2
              </text>
              <text x="32" y="102" textAnchor="middle" fill="#B45309" fontSize="7" fontWeight="900">
                ASSIST REQ
              </text>
            </g>

            {/* Stair B - East Primary Safe Egress */}
            <g transform="translate(899, 205)">
              <rect width="65" height="115" fill="#ECFDF5" stroke="#059669" strokeWidth="2" rx="3" />
              <text x="32" y="24" textAnchor="middle" fill="#047857" fontSize="9.5" fontWeight="900">
                STAIR B
              </text>
              <rect x="8" y="32" width="50" height="22" fill="#059669" rx="3" />
              <text x="32" y="47" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="900">
                🟢 SAFEST
              </text>
              <text x="32" y="70" textAnchor="middle" fill="#065F46" fontSize="7.5" fontWeight="bold">
                Primary Clear
              </text>
              <text x="32" y="85" textAnchor="middle" fill="#065F46" fontSize="7" fontWeight="bold">
                Direct to St 14
              </text>
              <text x="32" y="102" textAnchor="middle" fill="#047857" fontSize="7" fontWeight="900">
                100% EGRESS
              </text>
            </g>

            {/* Department Boundary Boxes matching Screenshot */}
            {/* 800 · STRATEGIC PLANNING */}
            <g onClick={() => onSelectQuadrant?.("NW")} className="cursor-pointer">
              <rect x="46" y="44" width="370" height="155" fill="#F8FAFC" stroke="#005DAA" strokeWidth="1.5" strokeDasharray="3 3" />
              <rect x="46" y="44" width="220" height="22" fill="#005DAA" rx="3" />
              <text x="156" y="59" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="900">
                800 · STRATEGIC PLANNING · {nwCount}
              </text>
            </g>

            {/* 700 · AMI / STEAM WEST */}
            <g onClick={() => onSelectQuadrant?.("SW")} className="cursor-pointer">
              <rect x="46" y="325" width="365" height="250" fill="#F8FAFC" stroke="#005DAA" strokeWidth="1.5" strokeDasharray="3 3" />
              <rect x="46" y="325" width="210" height="22" fill="#005DAA" rx="3" />
              <text x="151" y="340" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="900">
                700 · AMI / STEAM WEST · {swCount}
              </text>
            </g>

            {/* VERIFY LOCATION CALLOUT */}
            <g transform="translate(305, 270)">
              <rect width="180" height="22" fill="#005DAA" rx="3" />
              <text x="90" y="15" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="900">
                VERIFY LOCATION · {unverifiedCount}
              </text>
            </g>

            {/* 500 · CORP SECURITY / GAS OPS */}
            <g onClick={() => onSelectQuadrant?.("NE")} className="cursor-pointer">
              <rect x="420" y="325" width="260" height="250" fill="#F8FAFC" stroke="#005DAA" strokeWidth="1.5" strokeDasharray="3 3" />
              <rect x="420" y="325" width="260" height="22" fill="#005DAA" rx="3" />
              <text x="550" y="340" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="900">
                500 · CORP SECURITY / GAS OPS · {neCount}
              </text>
            </g>

            {/* M OPERATIONS */}
            <g onClick={() => onSelectQuadrant?.("SE")} className="cursor-pointer">
              <rect x="690" y="325" width="274" height="250" fill="#F8FAFC" stroke="#005DAA" strokeWidth="1.5" strokeDasharray="3 3" />
              <rect x="690" y="325" width="180" height="22" fill="#005DAA" rx="3" />
              <text x="780" y="340" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="900">
                M OPERATIONS · {seCount}
              </text>
            </g>

            {/* Primary Egress Directional Arrows */}
            <path d="M 500 175 L 880 175 L 880 220" fill="none" stroke="#059669" strokeWidth="3" strokeDasharray="6 4" />
            <path d="M 500 435 L 880 435 L 880 295" fill="none" stroke="#059669" strokeWidth="3" strokeDasharray="6 4" />

            {/* OCCUPANT DOTS (Interactive Nodes on Floor 07) */}
            {filteredOccupants
              .filter((o) => !o.badgedOut && !o.offSiteToday)
              .map((o) => {
                const cx = (o.xCoord || 50) * 9.2 + 40;
                const cy = (o.yCoord || 50) * 5.4 + 40;
                const isSelected = selectedOccupantId === o.id;

                const color =
                  o.status === "safe"
                    ? "#059669" // Green
                    : o.status === "need-help" || o.status === "mia"
                    ? "#DC2626" // Red
                    : o.status === "awaiting-evac-chair"
                    ? "#D97706" // Yellow / Gold
                    : "#EA580C"; // Orange / Unaccounted

                return (
                  <g
                    key={o.id}
                    className="cursor-pointer transition-transform hover:scale-125"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOccupantId(o.id);
                    }}
                  >
                    {isSelected && (
                      <circle cx={cx} cy={cy} r="14" fill="none" stroke="#005DAA" strokeWidth="3" className="animate-ping" />
                    )}
                    {(o.status === "need-help" || o.status === "mia") && (
                      <circle cx={cx} cy={cy} r="12" fill="none" stroke="#DC2626" strokeWidth="2.5" className="animate-pulse" />
                    )}
                    {o.status === "awaiting-evac-chair" && (
                      <circle cx={cx} cy={cy} r="10" fill="none" stroke="#D97706" strokeWidth="2" />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? "7" : "5.5"}
                      fill={color}
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })}

            {/* As-Built Title Block */}
            <g transform="translate(730, 485)">
              <rect width="230" height="80" fill="#FFFFFF" stroke="#005DAA" strokeWidth="1.2" rx="3" />
              <text x="10" y="15" fill="#003B70" fontSize="7.5" fontWeight="900">
                4 IRVING PLACE · CORPORATE HEADQUARTERS
              </text>
              <text x="10" y="27" fill="#475569" fontSize="6.5" fontWeight="bold">
                7th Floor Portfolio: As Built (Jan 14 2026)
              </text>
              <line x1="10" y1="32" x2="220" y2="32" stroke="#CBD5E1" strokeWidth="1" />
              <text x="10" y="44" fill="#047857" fontSize="7" fontWeight="bold">
                Stair B: Primary Clear | Stair A: ARA Evac Chair
              </text>
              <text x="10" y="58" fill="#003B70" fontSize="7.5" fontWeight="900">
                CON EDISON MUSTER COMMAND SYSTEM
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* 4. Bottom Instructions & Status Legend matching Screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 text-xs text-[#475569] font-medium border-t border-[#B8D8F8]">
        <div className="text-[11px] text-[#64748B]">
          Scroll, pinch, or double-click to zoom · drag to pan · ■ fullscreen
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3.5 flex-wrap text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#059669]" />
            <span className="text-[#0F2537]">Safe / Accounted</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#EA580C]" />
            <span className="text-[#0F2537]">Unaccounted</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#D97706]" />
            <span className="text-[#0F2537]">Evac Chair</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#DC2626]" />
            <span className="text-[#0F2537]">Need Help / MIA</span>
          </div>
        </div>
      </div>
    </div>
  );
}
