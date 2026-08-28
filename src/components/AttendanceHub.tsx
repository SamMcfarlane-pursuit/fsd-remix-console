import React, { useState } from "react";
import RedListPeople from "./RedListPeople";
import { CheckInKioskStation } from "./CheckInKioskStation";
import { DailyRosterSpreadsheet } from "./DailyRosterSpreadsheet";
import { SignInQRPosterModal } from "./SignInQRPosterModal";
import { SelfSignInModal } from "./SelfSignInModal";
import { EventAttendanceManager } from "./EventAttendanceManager";
import { Occupant, OccupantStatus } from "../types";

interface AttendanceHubProps {
  occupants: Occupant[];
  onCheckIn: (occupantId: string, status: OccupantStatus, via?: string, notes?: string) => Promise<void>;
  onBulkCheckIn?: (occupantIds: string[], status: OccupantStatus, via?: string, notes?: string) => Promise<void>;
  onRefreshState: () => void;
  initialQuadrant?: string;
}

export const AttendanceHub: React.FC<AttendanceHubProps> = ({
  occupants,
  onCheckIn,
  onBulkCheckIn,
  onRefreshState,
  initialQuadrant = "ALL",
}) => {
  const [attendanceTab, setAttendanceTab] = useState<"roster" | "events" | "kiosk" | "matrix">("roster");
  const [isPosterOpen, setIsPosterOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);

  React.useEffect(() => {
    if (initialQuadrant && initialQuadrant !== "ALL") {
      setAttendanceTab("roster");
    }
  }, [initialQuadrant]);

  const totalOccupants = occupants.length;
  const inBuildingCount = occupants.filter((o) => !o.badgedOut && !o.offSiteToday).length;
  const employeeCount = occupants.filter((o) => o.role !== "Visitor").length;
  const visitorCount = occupants.filter((o) => o.role === "Visitor").length;

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Attendance Module Sub-Navigation Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-[#B8D8F8] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-[#0F2537]">
                Attendance &amp; Floor Occupancy
              </h2>
              <span className="text-[10px] font-mono text-[#005DAA] bg-[#EBF5FB] px-2.5 py-0.5 rounded-full border border-[#00A3E0]/30 font-bold">
                {inBuildingCount} IN BUILDING / {totalOccupants} TOTAL
              </span>
            </div>
            <p className="text-[11px] text-[#475569] font-medium hidden sm:block">
              {employeeCount} Scheduled Staff · {visitorCount} Daily Visitors
            </p>
          </div>
        </div>

        {/* Sub-Tabs Switcher */}
        <div className="flex items-center gap-1 bg-[#F0F6FC] p-1 rounded-xl border border-[#B8D8F8] w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setAttendanceTab("roster")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              attendanceTab === "roster"
                ? "bg-[#005DAA] text-white shadow-xs"
                : "text-[#475569] hover:text-[#005DAA] hover:bg-white"
            }`}
          >
            <span>👥</span>
            <span>Roster</span>
          </button>

          <button
            onClick={() => setAttendanceTab("events")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              attendanceTab === "events"
                ? "bg-[#005DAA] text-white shadow-xs"
                : "text-[#475569] hover:text-[#005DAA] hover:bg-white"
            }`}
          >
            <span>📱</span>
            <span>QR Events &amp; Signatures</span>
          </button>

          <button
            onClick={() => setAttendanceTab("kiosk")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              attendanceTab === "kiosk"
                ? "bg-[#005DAA] text-white shadow-xs"
                : "text-[#475569] hover:text-[#005DAA] hover:bg-white"
            }`}
          >
            <span>📟</span>
            <span>QR Kiosk</span>
          </button>

          <button
            onClick={() => setAttendanceTab("matrix")}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
              attendanceTab === "matrix"
                ? "bg-[#005DAA] text-white shadow-xs"
                : "text-[#475569] hover:text-[#005DAA] hover:bg-white"
            }`}
          >
            <span>📊</span>
            <span>Matrix</span>
          </button>
        </div>
      </div>

      {/* Selected View Slot */}
      {attendanceTab === "roster" && (
        <RedListPeople
          occupants={occupants}
          onCheckIn={onCheckIn}
          onBulkCheckIn={onBulkCheckIn}
          initialQuadrant={initialQuadrant}
        />
      )}

      {attendanceTab === "events" && (
        <EventAttendanceManager />
      )}

      {attendanceTab === "kiosk" && (
        <CheckInKioskStation
          occupants={occupants}
          onCheckInSuccess={onRefreshState}
        />
      )}

      {attendanceTab === "matrix" && (
        <DailyRosterSpreadsheet
          occupants={occupants}
          onRosterUpdated={onRefreshState}
        />
      )}

      {/* Modals */}
      <SignInQRPosterModal
        isOpen={isPosterOpen}
        onClose={() => setIsPosterOpen(false)}
        onOpenSignInForm={() => setIsSignInOpen(true)}
        occupantsCount={totalOccupants}
        inBuildingCount={inBuildingCount}
      />

      <SelfSignInModal
        isOpen={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
        onSuccess={onRefreshState}
      />
    </div>
  );
};

