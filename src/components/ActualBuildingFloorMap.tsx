import React from "react";
import { QuadrantId } from "../types";

interface ActualBuildingFloorMapProps {
  targetQuadrant?: QuadrantId | string;
  targetDesk?: string;
  targetStairwell?: string;
  showEgressPath?: boolean;
  className?: string;
}

/**
 * Authentic Floor 07 Architectural CAD Map (4 Irving Place - Corporate HQ)
 * Recreated accurately from the official Con Edison As-Built Blueprints & Fire Team Training maps.
 * Renders building core, elevator banks, exit stairwells, and perimeter streets WITHOUT cluttered names.
 */
export const ActualBuildingFloorMap: React.FC<ActualBuildingFloorMapProps> = ({
  targetQuadrant = "ALL",
  targetDesk,
  targetStairwell = "Stairwell A",
  showEgressPath = true,
  className = "",
}) => {
  const isTargetNW = targetQuadrant === "NW";
  const isTargetNE = targetQuadrant === "NE";
  const isTargetSW = targetQuadrant === "SW";
  const isTargetSE = targetQuadrant === "SE";

  const isStairA = !targetStairwell || targetStairwell.includes("Stairwell A") || targetStairwell.includes("Stair A");

  // Coordinates for designated victim pin
  const victimX = isTargetNE ? 680 : isTargetSW ? 260 : isTargetSE ? 680 : 260; // NW default
  const victimY = isTargetSW ? 340 : isTargetSE ? 340 : 130; // NW/NE default

  // Exit stair coordinate (Stair A on East, Stair B on West)
  const exitStairX = isStairA ? 740 : 170;
  const exitStairY = 220;

  return (
    <div className={`w-full rounded-2xl border border-[#CBDCEE] bg-[#F8FAFC] p-3 text-[#0F2537] shadow-inner select-none ${className}`}>
      {/* Top Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#475569] mb-2 pb-1.5 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-3">
          <span className="font-bold text-[#005DAA] flex items-center gap-1">
            <span>🏢</span>
            <span>4 IRVING PLACE · FLOOR 07</span>
          </span>
          <span className="text-[#94A3B8]">|</span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#059669] inline-block" />
            <span>Exit Stairwells</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#38BDF8] inline-block" />
            <span>Elevator Banks</span>
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-[#64748B]">
          <span>North Compass ▲</span>
          <span className="bg-[#E2E8F0] px-1.5 py-0.5 rounded font-bold text-[#334155]">PORTFOLIO AS-BUILT</span>
        </div>
      </div>

      {/* Responsive Architectural SVG Map */}
      <svg
        viewBox="0 0 900 460"
        className="w-full h-auto max-h-[260px] font-sans"
        aria-label="Floor 07 Building Map without occupant names"
      >
        <defs>
          <pattern id="lightGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E2E8F0" strokeWidth="0.6" />
          </pattern>
        </defs>

        {/* Blueprint background grid */}
        <rect width="900" height="460" fill="url(#lightGrid)" rx="8" />

        {/* ======================================================== */}
        {/* SURROUNDING STREET BORDERS                               */}
        {/* ======================================================== */}
        {/* North Street: East 15th Street */}
        <rect x="0" y="0" width="900" height="20" fill="#003B70" rx="4" />
        <text x="450" y="14" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="900" letterSpacing="3">
          ▲ NORTH — EAST 15TH STREET ▲
        </text>

        {/* West Street: Irving Place */}
        <rect x="0" y="20" width="22" height="420" fill="#003B70" />
        <text
          x="-230"
          y="15"
          transform="rotate(-90)"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="9"
          fontWeight="900"
          letterSpacing="2"
        >
          ◄ WEST — IRVING PLACE (MAIN ENTRANCE) ◄
        </text>

        {/* East Street: Third Avenue */}
        <rect x="878" y="20" width="22" height="420" fill="#003B70" />
        <text
          x="230"
          y="-886"
          transform="rotate(90)"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="9"
          fontWeight="900"
          letterSpacing="2"
        >
          ► EAST — THIRD AVENUE ►
        </text>

        {/* South Street: East 14th Street */}
        <rect x="0" y="440" width="900" height="20" fill="#003B70" rx="4" />
        <text x="450" y="454" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="900" letterSpacing="3">
          ▼ SOUTH — EAST 14TH STREET ▼
        </text>

        {/* ======================================================== */}
        {/* MAIN FLOOR SLAB BOUNDARY (4 Irving Place footprint)      */}
        {/* ======================================================== */}
        <rect
          x="35"
          y="28"
          width="830"
          height="404"
          fill="#FFFFFF"
          stroke="#005DAA"
          strokeWidth="2.5"
          rx="6"
        />

        {/* ======================================================== */}
        {/* CENTRAL COURTYARD LIGHTWELL CORE                         */}
        {/* ======================================================== */}
        <rect
          x="375"
          y="160"
          width="150"
          height="140"
          fill="#F1F5F9"
          stroke="#94A3B8"
          strokeWidth="1.5"
          rx="4"
        />
        <text x="450" y="225" textAnchor="middle" fill="#475569" fontSize="11" fontWeight="900" letterSpacing="2">
          COURTYARD
        </text>
        <text x="450" y="242" textAnchor="middle" fill="#94A3B8" fontSize="8" fontWeight="bold">
          (OPEN AIR CORE)
        </text>

        {/* ======================================================== */}
        {/* QUADRANT DIVISION BOUNDARIES & SECTOR LABELS             */}
        {/* ======================================================== */}
        {/* Sector NW: Strategic Planning (07-800) */}
        <rect
          x="45"
          y="36"
          width="320"
          height="160"
          fill={isTargetNW ? "#E0F2FE" : "#F8FAFC"}
          stroke={isTargetNW ? "#005DAA" : "#CBDCEE"}
          strokeWidth={isTargetNW ? "2.5" : "1"}
          rx="4"
        />
        <text x="55" y="54" fill="#003B70" fontSize="10" fontWeight="900">
          SECTOR NW · Strategic Planning (07-800)
        </text>
        <text x="55" y="68" fill="#64748B" fontSize="8" fontWeight="bold">
          VP Office · Implementation Area
        </text>

        {/* Sector NE: Gas Ops & Security (07-200) */}
        <rect
          x="535"
          y="36"
          width="320"
          height="160"
          fill={isTargetNE ? "#E0F2FE" : "#F8FAFC"}
          stroke={isTargetNE ? "#005DAA" : "#CBDCEE"}
          strokeWidth={isTargetNE ? "2.5" : "1"}
          rx="4"
        />
        <text x="545" y="54" fill="#003B70" fontSize="10" fontWeight="900">
          SECTOR NE · Gas Operations &amp; Security (07-200)
        </text>
        <text x="545" y="68" fill="#64748B" fontSize="8" fontWeight="bold">
          Control Center · Investigations Hub
        </text>

        {/* Sector SW: AMI & Ombudsman (07-700) */}
        <rect
          x="45"
          y="260"
          width="320"
          height="160"
          fill={isTargetSW ? "#E0F2FE" : "#F8FAFC"}
          stroke={isTargetSW ? "#005DAA" : "#CBDCEE"}
          strokeWidth={isTargetSW ? "2.5" : "1"}
          rx="4"
        />
        <text x="55" y="278" fill="#003B70" fontSize="10" fontWeight="900">
          SECTOR SW · AMI &amp; Ombudsman (07-700)
        </text>
        <text x="55" y="292" fill="#64748B" fontSize="8" fontWeight="bold">
          Team Rooms A/B/C · Customer Operations
        </text>

        {/* Sector SE: Steam Operations (07-500) */}
        <rect
          x="535"
          y="260"
          width="320"
          height="160"
          fill={isTargetSE ? "#E0F2FE" : "#F8FAFC"}
          stroke={isTargetSE ? "#005DAA" : "#CBDCEE"}
          strokeWidth={isTargetSE ? "2.5" : "1"}
          rx="4"
        />
        <text x="545" y="278" fill="#003B70" fontSize="10" fontWeight="900">
          SECTOR SE · Steam Operations (07-500)
        </text>
        <text x="545" y="292" fill="#64748B" fontSize="8" fontWeight="bold">
          Bulk Power · Control Ops (07-550)
        </text>

        {/* ======================================================== */}
        {/* ELEVATOR BANKS (A, B, C, D, E, F, G)                     */}
        {/* ======================================================== */}
        {/* Bank G (North) */}
        <g transform="translate(405, 42)">
          <rect width="90" height="36" fill="#BAE6FD" stroke="#0284C7" strokeWidth="1.2" rx="3" />
          <text x="45" y="16" textAnchor="middle" fill="#0369A1" fontSize="8" fontWeight="900">BANK 'G' ELEV</text>
          <text x="45" y="28" textAnchor="middle" fill="#0C4A6E" fontSize="7" fontWeight="bold">Cars 12, 13</text>
        </g>

        {/* Bank E / Lobby E (NW Core) */}
        <g transform="translate(145, 95)">
          <rect width="80" height="42" fill="#BAE6FD" stroke="#0284C7" strokeWidth="1.2" rx="3" />
          <text x="40" y="18" textAnchor="middle" fill="#0369A1" fontSize="8" fontWeight="900">BANK 'E'</text>
          <text x="40" y="32" textAnchor="middle" fill="#0C4A6E" fontSize="7" fontWeight="bold">Lobby E (Cars 1-2)</text>
        </g>

        {/* Bank C / Bank B (Center Core) */}
        <g transform="translate(385, 95)">
          <rect width="130" height="42" fill="#BAE6FD" stroke="#0284C7" strokeWidth="1.2" rx="3" />
          <text x="65" y="18" textAnchor="middle" fill="#0369A1" fontSize="8" fontWeight="900">BANK 'C' &amp; 'B'</text>
          <text x="65" y="32" textAnchor="middle" fill="#0C4A6E" fontSize="7" fontWeight="bold">Passenger Cars 24-29</text>
        </g>

        {/* Bank D / Lobby D (East Core) */}
        <g transform="translate(710, 95)">
          <rect width="85" height="42" fill="#BAE6FD" stroke="#0284C7" strokeWidth="1.2" rx="3" />
          <text x="42.5" y="18" textAnchor="middle" fill="#0369A1" fontSize="8" fontWeight="900">BANK 'D'</text>
          <text x="42.5" y="32" textAnchor="middle" fill="#0C4A6E" fontSize="7" fontWeight="bold">Lobby D (Cars 31-35)</text>
        </g>

        {/* Bank A (Southeast Core) */}
        <g transform="translate(680, 310)">
          <rect width="85" height="40" fill="#BAE6FD" stroke="#0284C7" strokeWidth="1.2" rx="3" />
          <text x="42.5" y="17" textAnchor="middle" fill="#0369A1" fontSize="8" fontWeight="900">BANK 'A'</text>
          <text x="42.5" y="30" textAnchor="middle" fill="#0C4A6E" fontSize="7" fontWeight="bold">Cars 14-17</text>
        </g>

        {/* Bank T (South/Irving Base) */}
        <g transform="translate(145, 310)">
          <rect width="80" height="40" fill="#BAE6FD" stroke="#0284C7" strokeWidth="1.2" rx="3" />
          <text x="40" y="17" textAnchor="middle" fill="#0369A1" fontSize="8" fontWeight="900">BANK 'T'</text>
          <text x="40" y="30" textAnchor="middle" fill="#0C4A6E" fontSize="7" fontWeight="bold">Down to Bsmnt</text>
        </g>

        {/* ======================================================== */}
        {/* OFFICIAL EXIT STAIRWELLS (GREEN FIRE CODE BOXES)         */}
        {/* ======================================================== */}
        {/* STAIR B (West Core - Irving Place side) */}
        <g transform="translate(48, 195)">
          <rect
            width="65"
            height="50"
            fill="#059669"
            stroke="#047857"
            strokeWidth="1.5"
            rx="4"
            className={!isStairA ? "animate-pulse" : ""}
          />
          <text x="32.5" y="22" textAnchor="middle" fill="#FFFFFF" fontSize="8.5" fontWeight="900">
            STAIR B
          </text>
          <text x="32.5" y="34" textAnchor="middle" fill="#D1FAE5" fontSize="7" fontWeight="bold">
            WEST EXIT
          </text>
          <circle cx="52" cy="12" r="4.5" fill="#DC2626" />
          <text x="52" y="14" textAnchor="middle" fill="#FFFFFF" fontSize="5" fontWeight="black">SP</text>
        </g>

        {/* STAIR A (East Core - Third Ave / Union Sq East side) */}
        <g transform="translate(787, 195)">
          <rect
            width="65"
            height="50"
            fill="#059669"
            stroke="#047857"
            strokeWidth="1.5"
            rx="4"
            className={isStairA ? "animate-pulse" : ""}
          />
          <text x="32.5" y="22" textAnchor="middle" fill="#FFFFFF" fontSize="8.5" fontWeight="900">
            STAIR A
          </text>
          <text x="32.5" y="34" textAnchor="middle" fill="#D1FAE5" fontSize="7" fontWeight="bold">
            EAST EXIT
          </text>
          <circle cx="52" cy="12" r="4.5" fill="#DC2626" />
          <text x="52" y="14" textAnchor="middle" fill="#FFFFFF" fontSize="5" fontWeight="black">SP</text>
        </g>

        {/* STAIR F & E (Center & North stair towers) */}
        <rect x="375" y="95" width="22" height="25" fill="#10B981" rx="2" />
        <text x="386" y="111" textAnchor="middle" fill="#FFFFFF" fontSize="6.5" fontWeight="black">F</text>

        <rect x="503" y="95" width="22" height="25" fill="#10B981" rx="2" />
        <text x="514" y="111" textAnchor="middle" fill="#FFFFFF" fontSize="6.5" fontWeight="black">G</text>

        {/* ======================================================== */}
        {/* EGRESS CORRIDOR ROUTING LINE                             */}
        {/* ======================================================== */}
        {showEgressPath && (
          <>
            <line
              x1={victimX}
              y1={victimY}
              x2={exitStairX}
              y2={exitStairY}
              stroke="#059669"
              strokeWidth="3.5"
              strokeDasharray="6 4"
            />
            {/* Pulsing Target Marker for current user position */}
            <circle cx={victimX} cy={victimY} r="14" fill="#0284C7" opacity="0.25" className="animate-ping" />
            <circle cx={victimX} cy={victimY} r="7" fill="#005DAA" stroke="#FFFFFF" strokeWidth="2" />
            <text x={victimX} y={victimY - 10} textAnchor="middle" fill="#003B70" fontSize="8" fontWeight="900">
              YOUR SECTOR ({targetQuadrant || "FLOOR 07"})
            </text>
          </>
        )}
      </svg>

      {/* Bottom Route Indicator */}
      <div className="mt-2 pt-2 border-t border-[#E2E8F0] flex flex-wrap items-center justify-between text-xs text-[#475569]">
        <div className="flex items-center gap-1.5 font-bold text-[#0F2537]">
          <span>🏃‍♂️ Primary Exit Route:</span>
          <span className="text-[#059669] font-black">{isStairA ? "STAIRWELL A (East Core)" : "STAIRWELL B (West Core)"}</span>
          <span className="text-[11px] text-[#64748B]">→ Descend directly to street level</span>
        </div>

        <div className="text-[11px] font-mono text-[#005DAA] font-bold">
          DO NOT USE ELEVATORS (BANKS A-G DISABLED DURING ALARM)
        </div>
      </div>
    </div>
  );
};
