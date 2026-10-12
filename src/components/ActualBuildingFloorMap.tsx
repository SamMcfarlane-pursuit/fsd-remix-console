import React from "react";
import { QuadrantId } from "../types";
import { Compass, Navigation, ShieldCheck } from "lucide-react";

interface ActualBuildingFloorMapProps {
  targetQuadrant?: QuadrantId | string;
  targetDesk?: string;
  targetStairwell?: string;
  showEgressPath?: boolean;
  className?: string;
  onSelectQuadrant?: (quad: QuadrantId) => void;
  quadrantCounts?: Partial<Record<QuadrantId, number>>;
}

/**
 * Enterprise Architectural Vector CAD Map — Floor 07 (4 Irving Place - Corporate HQ)
 * Reconstructed accurately from official Con Edison Portfolio As-Built Blueprints & FDNY Fire Team maps.
 * Renders building core, circulation corridors, elevator banks, and exit stairwells WITHOUT individual occupant names.
 */
export const ActualBuildingFloorMap: React.FC<ActualBuildingFloorMapProps> = ({
  targetQuadrant = "NW",
  targetDesk,
  targetStairwell = "Stairwell A",
  showEgressPath = true,
  className = "",
  onSelectQuadrant,
  quadrantCounts,
}) => {
  const isTargetNW = targetQuadrant === "NW";
  const isTargetNE = targetQuadrant === "NE";
  const isTargetSW = targetQuadrant === "SW";
  const isTargetSE = targetQuadrant === "SE";

  const isStairA = !targetStairwell || targetStairwell.toLowerCase().includes("stairwell a") || targetStairwell.toLowerCase().includes("stair a");

  // Coordinate waypoints for corridor-guided egress (avoids cutting through courtyard or walls)
  let userPin = { x: 200, y: 100, label: "Sector NW · Strategic Planning" };
  let pathWaypoints = "200,100 200,135 680,135 735,210"; // NW -> North corridor -> East corridor -> Stair A

  if (isTargetNE) {
    userPin = { x: 620, y: 100, label: "Sector NE · Gas Operations" };
    pathWaypoints = isStairA ? "620,100 680,135 735,210" : "620,100 620,135 180,135 125,210";
  } else if (isTargetSW) {
    userPin = { x: 200, y: 320, label: "Sector SW · AMI Operations" };
    pathWaypoints = isStairA ? "200,320 200,285 680,285 735,210" : "200,320 180,285 125,210";
  } else if (isTargetSE) {
    userPin = { x: 620, y: 320, label: "Sector SE · Steam Operations" };
    pathWaypoints = isStairA ? "620,320 680,285 735,210" : "620,320 620,285 180,285 125,210";
  } else {
    // Default NW
    pathWaypoints = isStairA ? "200,100 200,135 680,135 735,210" : "200,100 180,135 125,210";
  }

  return (
    <div className={`w-full rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 text-slate-800 shadow-xs select-none ${className}`}>
      {/* Top Professional Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2 border-b border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold text-[#003B70]">
            <span className="w-2 h-2 rounded-full bg-[#005DAA]" />
            <span>4 IRVING PLACE · FLOOR 07</span>
          </div>
          <span className="text-slate-300">|</span>
          <span className="text-[11px] font-medium text-slate-500">
            Architectural Egress Layout (Name-Free CAD)
          </span>
        </div>

        {/* Legend pills */}
        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-600">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600" />
            <span>Exit Stairs</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-200 border border-sky-400" />
            <span>Elevators (Offline)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-1 rounded-full bg-emerald-500" />
            <span>Corridor Path</span>
          </span>
        </div>
      </div>

      {/* Vector CAD SVG Map Canvas */}
      <div className="relative rounded-xl overflow-hidden bg-[#F8FAFC] border border-slate-200">
        <svg
          viewBox="0 0 860 420"
          className="w-full h-auto max-h-[260px] font-sans block"
          aria-label="Floor 07 Building Egress Map"
        >
          <defs>
            {/* Fine architectural grid */}
            <pattern id="cadGrid" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#E2E8F0" strokeWidth="0.5" />
            </pattern>
            {/* Hatch pattern for lightwell courtyard */}
            <pattern id="courtyardHatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#CBD5E1" strokeWidth="1" />
            </pattern>
            {/* Marker for route chevrons */}
            <marker id="arrowHead" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
              <polygon points="0 0, 6 3, 0 6" fill="#059669" />
            </marker>
          </defs>

          {/* Blueprint background grid */}
          <rect width="860" height="420" fill="url(#cadGrid)" />

          {/* ======================================================== */}
          {/* PERIMETER STREET BOUNDARY LABELS (CLEAN ARCHITECTURAL)   */}
          {/* ======================================================== */}
          {/* North: East 15th St */}
          <line x1="60" y1="24" x2="800" y2="24" stroke="#94A3B8" strokeWidth="1" strokeDasharray="4 4" />
          <text x="430" y="18" textAnchor="middle" fill="#475569" fontSize="9.5" fontWeight="700" letterSpacing="1.5">
            ▲ NORTH · EAST 15TH STREET ▲
          </text>

          {/* West: Irving Place */}
          <line x1="50" y1="35" x2="50" y2="385" stroke="#94A3B8" strokeWidth="1" strokeDasharray="4 4" />
          <text
            x="-210"
            y="38"
            transform="rotate(-90)"
            textAnchor="middle"
            fill="#475569"
            fontSize="9.5"
            fontWeight="700"
            letterSpacing="1"
          >
            ◄ WEST · IRVING PLACE (MAIN ENTRANCE) ◄
          </text>

          {/* East: Third Avenue */}
          <line x1="810" y1="35" x2="810" y2="385" stroke="#94A3B8" strokeWidth="1" strokeDasharray="4 4" />
          <text
            x="210"
            y="-822"
            transform="rotate(90)"
            textAnchor="middle"
            fill="#475569"
            fontSize="9.5"
            fontWeight="700"
            letterSpacing="1"
          >
            ► EAST · THIRD AVENUE (UNION SQ EAST) ►
          </text>

          {/* South: East 14th St */}
          <line x1="60" y1="396" x2="800" y2="396" stroke="#94A3B8" strokeWidth="1" strokeDasharray="4 4" />
          <text x="430" y="411" textAnchor="middle" fill="#475569" fontSize="9.5" fontWeight="700" letterSpacing="1.5">
            ▼ SOUTH · EAST 14TH STREET ▼
          </text>

          {/* ======================================================== */}
          {/* BUILDING EXTERIOR ENVELOPE (4 Irving Place footprint)    */}
          {/* ======================================================== */}
          <rect
            x="70"
            y="35"
            width="720"
            height="350"
            rx="6"
            fill="#FFFFFF"
            stroke="#334155"
            strokeWidth="2.5"
          />

          {/* ======================================================== */}
          {/* BASE BUILDING CIRCULATION CORRIDORS                      */}
          {/* ======================================================== */}
          {/* Continuous Hallway Ring wrapping around core */}
          <path
            d="M 120 120 L 740 120 L 740 300 L 120 300 Z"
            fill="none"
            stroke="#F1F5F9"
            strokeWidth="32"
            strokeLinejoin="round"
          />
          <path
            d="M 120 120 L 740 120 L 740 300 L 120 300 Z"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="30"
            strokeLinejoin="round"
          />

          {/* Hallway text markers */}
          <text x="430" y="124" textAnchor="middle" fill="#94A3B8" fontSize="7.5" fontWeight="bold" letterSpacing="2">
            BASE BUILDING CIRCULATION CORRIDOR
          </text>
          <text x="430" y="304" textAnchor="middle" fill="#94A3B8" fontSize="7.5" fontWeight="bold" letterSpacing="2">
            BASE BUILDING CIRCULATION CORRIDOR
          </text>

          {/* ======================================================== */}
          {/* CENTRAL OPEN-AIR COURTYARD LIGHTWELL                     */}
          {/* ======================================================== */}
          <rect
            x="345"
            y="145"
            width="170"
            height="130"
            rx="6"
            fill="#F8FAFC"
            stroke="#94A3B8"
            strokeWidth="2"
          />
          <rect
            x="345"
            y="145"
            width="170"
            height="130"
            rx="6"
            fill="url(#courtyardHatch)"
            opacity="0.3"
          />
          <rect
            x="375"
            y="190"
            width="110"
            height="38"
            rx="4"
            fill="#FFFFFF"
            stroke="#CBD5E1"
            strokeWidth="1"
          />
          <text x="430" y="206" textAnchor="middle" fill="#1E293B" fontSize="9" fontWeight="900" letterSpacing="1.5">
            COURTYARD
          </text>
          <text x="430" y="219" textAnchor="middle" fill="#64748B" fontSize="7" fontWeight="bold">
            (OPEN-AIR LIGHTWELL)
          </text>

          {/* ======================================================== */}
          {/* FOUR PRIMARY QUADRANT SECTORS (NO OCCUPANT NAMES)        */}
          {/* ======================================================== */}
          {/* Sector NW: Strategic Planning (07-800) */}
          <g
            onClick={() => onSelectQuadrant?.("NW")}
            className={onSelectQuadrant ? "cursor-pointer transition hover:opacity-85" : ""}
          >
            <rect
              x="78"
              y="42"
              width="240"
              height="75"
              rx="4"
              fill={isTargetNW ? "#E0F2FE" : "#FFFFFF"}
              stroke={isTargetNW ? "#0284C7" : "#CBD5E1"}
              strokeWidth={isTargetNW ? "2" : "1"}
            />
            <text x="88" y="60" fill="#0F2537" fontSize="9" fontWeight="800">
              SECTOR NW · Strategic Planning (07-800)
            </text>
            <text x="88" y="74" fill="#64748B" fontSize="7.5" fontWeight="500">
              Workstation Pods 07-801 to 07-841 · Conf Rm A
            </text>
            {quadrantCounts?.NW !== undefined && (
              <g transform="translate(230, 84)">
                <rect width="80" height="20" rx="10" fill="#005DAA" />
                <text x="40" y="13" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="bold">
                  {quadrantCounts.NW} inside
                </text>
              </g>
            )}
          </g>

          {/* Sector NE: Gas Operations & Investigations (07-200) */}
          <g
            onClick={() => onSelectQuadrant?.("NE")}
            className={onSelectQuadrant ? "cursor-pointer transition hover:opacity-85" : ""}
          >
            <rect
              x="542"
              y="42"
              width="240"
              height="75"
              rx="4"
              fill={isTargetNE ? "#E0F2FE" : "#FFFFFF"}
              stroke={isTargetNE ? "#0284C7" : "#CBD5E1"}
              strokeWidth={isTargetNE ? "2" : "1"}
            />
            <text x="552" y="60" fill="#0F2537" fontSize="9" fontWeight="800">
              SECTOR NE · Gas Operations (07-200)
            </text>
            <text x="552" y="74" fill="#64748B" fontSize="7.5" fontWeight="500">
              Control Center · PSC Supply · Conf Rm 07-240
            </text>
            {quadrantCounts?.NE !== undefined && (
              <g transform="translate(694, 84)">
                <rect width="80" height="20" rx="10" fill="#005DAA" />
                <text x="40" y="13" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="bold">
                  {quadrantCounts.NE} inside
                </text>
              </g>
            )}
          </g>

          {/* Sector SW: AMI & Ombudsman (07-700) */}
          <g
            onClick={() => onSelectQuadrant?.("SW")}
            className={onSelectQuadrant ? "cursor-pointer transition hover:opacity-85" : ""}
          >
            <rect
              x="78"
              y="302"
              width="240"
              height="75"
              rx="4"
              fill={isTargetSW ? "#E0F2FE" : "#FFFFFF"}
              stroke={isTargetSW ? "#0284C7" : "#CBD5E1"}
              strokeWidth={isTargetSW ? "2" : "1"}
            />
            <text x="88" y="322" fill="#0F2537" fontSize="9" fontWeight="800">
              SECTOR SW · AMI &amp; Ombudsman (07-700)
            </text>
            <text x="88" y="336" fill="#64748B" fontSize="7.5" fontWeight="500">
              Team Rooms A-D · Implementation Area
            </text>
            {quadrantCounts?.SW !== undefined && (
              <g transform="translate(230, 344)">
                <rect width="80" height="20" rx="10" fill="#005DAA" />
                <text x="40" y="13" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="bold">
                  {quadrantCounts.SW} inside
                </text>
              </g>
            )}
          </g>

          {/* Sector SE: Steam Operations & Bulk Power (07-500) */}
          <g
            onClick={() => onSelectQuadrant?.("SE")}
            className={onSelectQuadrant ? "cursor-pointer transition hover:opacity-85" : ""}
          >
            <rect
              x="542"
              y="302"
              width="240"
              height="75"
              rx="4"
              fill={isTargetSE ? "#E0F2FE" : "#FFFFFF"}
              stroke={isTargetSE ? "#0284C7" : "#CBD5E1"}
              strokeWidth={isTargetSE ? "2" : "1"}
            />
            <text x="552" y="322" fill="#0F2537" fontSize="9" fontWeight="800">
              SECTOR SE · Steam Operations (07-500)
            </text>
            <text x="552" y="336" fill="#64748B" fontSize="7.5" fontWeight="500">
              Steam Ops Control Rm · Desks 07-501 to 07-595
            </text>
            {quadrantCounts?.SE !== undefined && (
              <g transform="translate(694, 344)">
                <rect width="80" height="20" rx="10" fill="#005DAA" />
                <text x="40" y="13" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="bold">
                  {quadrantCounts.SE} inside
                </text>
              </g>
            )}
          </g>

          {/* ======================================================== */}
          {/* ELEVATOR BANKS (RECALLED / OFFLINE DURING FIRE ALARM)    */}
          {/* ======================================================== */}
          {/* Bank G (North Wall) */}
          <g transform="translate(390, 48)">
            <rect width="80" height="34" rx="4" fill="#F0F9FF" stroke="#38BDF8" strokeWidth="1" />
            <text x="40" y="16" textAnchor="middle" fill="#0284C7" fontSize="7.5" fontWeight="800">BANK 'G' ELEV</text>
            <text x="40" y="27" textAnchor="middle" fill="#DC2626" fontSize="6.5" fontWeight="bold">✕ RECALLED</text>
          </g>

          {/* Bank E (West Lobby) */}
          <g transform="translate(180, 160)">
            <rect width="70" height="36" rx="4" fill="#F0F9FF" stroke="#38BDF8" strokeWidth="1" />
            <text x="35" y="16" textAnchor="middle" fill="#0284C7" fontSize="7.5" fontWeight="800">BANK 'E'</text>
            <text x="35" y="27" textAnchor="middle" fill="#DC2626" fontSize="6.5" fontWeight="bold">✕ RECALLED</text>
          </g>

          {/* Bank B & C (Central Core) */}
          <g transform="translate(180, 225)">
            <rect width="70" height="36" rx="4" fill="#F0F9FF" stroke="#38BDF8" strokeWidth="1" />
            <text x="35" y="16" textAnchor="middle" fill="#0284C7" fontSize="7.5" fontWeight="800">BANK 'C &amp; B'</text>
            <text x="35" y="27" textAnchor="middle" fill="#DC2626" fontSize="6.5" fontWeight="bold">✕ RECALLED</text>
          </g>

          {/* Bank D (East Lobby) */}
          <g transform="translate(610, 160)">
            <rect width="70" height="36" rx="4" fill="#F0F9FF" stroke="#38BDF8" strokeWidth="1" />
            <text x="35" y="16" textAnchor="middle" fill="#0284C7" fontSize="7.5" fontWeight="800">BANK 'D'</text>
            <text x="35" y="27" textAnchor="middle" fill="#DC2626" fontSize="6.5" fontWeight="bold">✕ RECALLED</text>
          </g>

          {/* Bank A (Southeast Core) */}
          <g transform="translate(610, 225)">
            <rect width="70" height="36" rx="4" fill="#F0F9FF" stroke="#38BDF8" strokeWidth="1" />
            <text x="35" y="16" textAnchor="middle" fill="#0284C7" fontSize="7.5" fontWeight="800">BANK 'A'</text>
            <text x="35" y="27" textAnchor="middle" fill="#DC2626" fontSize="6.5" fontWeight="bold">✕ RECALLED</text>
          </g>

          {/* Bank T (South / Bsmnt) */}
          <g transform="translate(390, 338)">
            <rect width="80" height="34" rx="4" fill="#F0F9FF" stroke="#38BDF8" strokeWidth="1" />
            <text x="40" y="16" textAnchor="middle" fill="#0284C7" fontSize="7.5" fontWeight="800">BANK 'T'</text>
            <text x="40" y="27" textAnchor="middle" fill="#DC2626" fontSize="6.5" fontWeight="bold">✕ RECALLED</text>
          </g>

          {/* ======================================================== */}
          {/* OFFICIAL FIRE STAIRWELLS (ILLUMINATED NFPA LIFE-SAFETY)  */}
          {/* ======================================================== */}
          {/* STAIR B (WEST EXIT - Irving Place Side) */}
          <g transform="translate(78, 185)">
            <rect
              width="50"
              height="50"
              rx="5"
              fill={!isStairA ? "#059669" : "#10B981"}
              stroke="#047857"
              strokeWidth="2"
            />
            <text x="25" y="20" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="900">
              STAIR B
            </text>
            <text x="25" y="32" textAnchor="middle" fill="#ECFDF5" fontSize="7" fontWeight="bold">
              WEST EXIT
            </text>
            {/* Standpipe marker */}
            <circle cx="40" cy="11" r="4" fill="#DC2626" />
            <text x="40" y="13" textAnchor="middle" fill="#FFFFFF" fontSize="4.5" fontWeight="black">SP</text>
          </g>

          {/* STAIR A (EAST EXIT - Third Ave / Union Sq East Side) */}
          <g transform="translate(732, 185)">
            <rect
              width="50"
              height="50"
              rx="5"
              fill={isStairA ? "#059669" : "#10B981"}
              stroke="#047857"
              strokeWidth="2"
            />
            {isStairA && (
              <rect
                width="56"
                height="56"
                x="-3"
                y="-3"
                rx="8"
                fill="none"
                stroke="#10B981"
                strokeWidth="1.5"
                opacity="0.8"
                className="animate-ping"
              />
            )}
            <text x="25" y="20" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="900">
              STAIR A
            </text>
            <text x="25" y="32" textAnchor="middle" fill="#ECFDF5" fontSize="7" fontWeight="bold">
              EAST EXIT
            </text>
            {/* Standpipe marker */}
            <circle cx="40" cy="11" r="4" fill="#DC2626" />
            <text x="40" y="13" textAnchor="middle" fill="#FFFFFF" fontSize="4.5" fontWeight="black">SP</text>
          </g>

          {/* STAIR F & G (Center Core Fire Towers) */}
          <g transform="translate(350, 95)">
            <rect width="26" height="22" rx="3" fill="#10B981" />
            <text x="13" y="14" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="900">STAIR F</text>
          </g>
          <g transform="translate(484, 95)">
            <rect width="26" height="22" rx="3" fill="#10B981" />
            <text x="13" y="14" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="900">STAIR G</text>
          </g>

          {/* ======================================================== */}
          {/* CORRIDOR-GUIDED EGRESS ROUTE (SMOOTH HALLWAY NAVIGATION) */}
          {/* ======================================================== */}
          {showEgressPath && (
            <g>
              {/* Illuminated path glow */}
              <polyline
                points={pathWaypoints}
                fill="none"
                stroke="#A7F3D0"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.6"
              />
              {/* Active path dashed */}
              <polyline
                points={pathWaypoints}
                fill="none"
                stroke="#059669"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="8 6"
              />

              {/* User Position Beacon */}
              <g transform={`translate(${userPin.x}, ${userPin.y})`}>
                <circle r="14" fill="#0284C7" opacity="0.25" className="animate-ping" />
                <circle r="7" fill="#005DAA" stroke="#FFFFFF" strokeWidth="2.5" />
                {/* Pin callout card */}
                <rect x="-65" y="-28" width="130" height="18" rx="4" fill="#0F2537" />
                <polygon points="-4,-10 4,-10 0,-6" fill="#0F2537" />
                <text x="0" y="-16" textAnchor="middle" fill="#FFFFFF" fontSize="7.5" fontWeight="bold">
                  📍 YOUR LOCATION
                </text>
              </g>
            </g>
          )}

          {/* Architectural North Arrow & Stamp */}
          <g transform="translate(740, 52)">
            <circle cx="12" cy="12" r="11" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
            <text x="12" y="16" textAnchor="middle" fill="#003B70" fontSize="9" fontWeight="900">N ▲</text>
          </g>
        </svg>
      </div>

      {/* Bottom Route Guidance Bar */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-800">
          <Navigation className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Assigned Egress:</span>
          <span className="text-emerald-700 font-extrabold">
            {isStairA ? "STAIRWELL A (East Core)" : "STAIRWELL B (West Core)"}
          </span>
          <span className="text-slate-500 font-normal hidden sm:inline">
            → Follow green illuminated corridor route to ground exit
          </span>
        </div>

        <div className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
          DO NOT USE ELEVATORS · RECALLED DURING ALARM
        </div>
      </div>
    </div>
  );
};
