import React from "react";
import { StatusSnapshot } from "../types";

interface UserFlowStepperProps {
  snapshot: StatusSnapshot | null;
  currentStep?: number;
  onSelectStep?: (stepNumber: number) => void;
  onOpenScan?: () => void;
  onOpenRoster?: () => void;
  onOpenAlarm?: () => void;
  onOpenBroadcast?: () => void;
  onOpenAllSafe?: () => void;
}

export const UserFlowStepper: React.FC<UserFlowStepperProps> = ({
  snapshot,
  currentStep,
  onSelectStep,
  onOpenScan,
  onOpenRoster,
  onOpenAlarm,
  onOpenBroadcast,
  onOpenAllSafe,
}) => {
  const isIncidentActive = snapshot?.incidentActive || false;
  const unaccountedCount = snapshot?.unaccounted || 0;
  const isAllSafeActive = isIncidentActive && unaccountedCount === 0;

  // Determine active step based on state if not forced
  let activeStep = currentStep;
  if (!activeStep) {
    if (isAllSafeActive) activeStep = 5;
    else if (isIncidentActive) activeStep = 4;
    else activeStep = 2;
  }

  const steps = [
    {
      num: "01",
      title: "Scan",
      desc: "QR at the floor entrance. Badge ID or visitor pass.",
      actionLabel: "Display / Scan QR",
      onClick: () => {
        if (onSelectStep) onSelectStep(1);
        if (onOpenScan) onOpenScan();
      },
    },
    {
      num: "02",
      title: "Signed in",
      desc: "Everyone on the floor is a known, live roster entry.",
      actionLabel: "View Roster",
      onClick: () => {
        if (onSelectStep) onSelectStep(2);
        if (onOpenRoster) onOpenRoster();
      },
    },
    {
      num: "03",
      title: "Alarm",
      desc: "Staff lead declares. Drill or incident, hazard set.",
      actionLabel: "Declare Drill / Alarm",
      onClick: () => {
        if (onSelectStep) onSelectStep(3);
        if (onOpenAlarm) onOpenAlarm();
      },
    },
    {
      num: "04",
      title: "Broadcast",
      desc: "Commander pushes to every device, all zones or one.",
      actionLabel: "Broadcast Emergency",
      onClick: () => {
        if (onSelectStep) onSelectStep(4);
        if (onOpenBroadcast) onOpenBroadcast();
      },
    },
    {
      num: "05",
      title: "All safe",
      desc: "People self-report. Counts close. Ledger seals it.",
      actionLabel: "Self-Report & Seal",
      onClick: () => {
        if (onSelectStep) onSelectStep(5);
        if (onOpenAllSafe) onOpenAllSafe();
      },
    },
  ];

  return (
    <div className="bg-[#F4F8FC] border-y border-[#CBDCEE] px-3 sm:px-6 py-3 shadow-xs">
      <div className="max-w-7xl mx-auto space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[#005DAA] uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#005DAA] animate-pulse" />
            OFFICIAL 5-STEP LIFE-SAFETY PROCESS
          </span>
          <span className="text-[#475569] hidden sm:inline">
            Step {activeStep} of 5 · Con Edison Floor 07
          </span>
        </div>

        {/* 5 Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 sm:gap-3">
          {steps.map((step, idx) => {
            const stepNum = idx + 1;
            const isActive = activeStep === stepNum;

            return (
              <div
                key={step.num}
                onClick={step.onClick}
                className={`relative rounded-2xl p-4 sm:p-5 border-2 transition-all cursor-pointer flex flex-col justify-between group ${
                  isActive
                    ? "bg-white border-[#005DAA] shadow-md ring-2 ring-[#005DAA]/20 scale-[1.01]"
                    : "bg-[#EBF3FB]/80 hover:bg-white border-[#B8D8F8] text-[#0F2537]"
                }`}
              >
                {/* Arrow connector between steps */}
                {idx < 4 && (
                  <div className="hidden md:block absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 text-[#005DAA]/40 font-black text-sm">
                    →
                  </div>
                )}

                <div>
                  <div
                    className={`text-2xl sm:text-3xl font-black mb-1.5 tracking-tight ${
                      isActive ? "text-[#005DAA]" : "text-[#1E4268]"
                    }`}
                  >
                    {step.num}
                  </div>
                  <h3
                    className={`text-base sm:text-lg font-black tracking-tight mb-2 ${
                      isActive ? "text-[#003B70]" : "text-[#0F2537]"
                    }`}
                  >
                    {step.title}
                  </h3>
                  <p className="text-xs text-[#475569] font-medium leading-relaxed">
                    {step.desc}
                  </p>
                </div>

                <div className="mt-4 pt-2.5 border-t border-[#D0E2F4] flex items-center justify-between text-[11px] font-bold text-[#005DAA]">
                  <span className="group-hover:underline">{step.actionLabel}</span>
                  <span className="text-xs transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
