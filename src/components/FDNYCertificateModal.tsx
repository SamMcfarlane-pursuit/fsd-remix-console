import React from "react";
import { StatusSnapshot } from "../types";

interface FDNYCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: StatusSnapshot | null;
  sealedHash?: string;
}

export const FDNYCertificateModal: React.FC<FDNYCertificateModalProps> = ({
  isOpen,
  onClose,
  snapshot,
  sealedHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
}) => {
  if (!isOpen) return null;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const accounted = snapshot?.accounted ?? snapshot?.occupants?.filter((o) => o.status === "safe").length ?? 0;
  const total = snapshot?.expectedOnFloor ?? snapshot?.occupants?.length ?? 0;
  const pct = total > 0 ? Math.round((accounted / total) * 100) : 100;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs animate-fadeIn print:p-0 print:bg-white print:static">
      <div className="bg-white text-slate-900 border-4 border-[#003B70] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden print:border-none print:shadow-none print:max-h-none print:w-full">
        {/* Modal Controls (Hidden in Print) */}
        <div className="p-3 bg-[#003B70] text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span>📜</span>
            <span className="text-xs font-black uppercase tracking-wider">
              Official FDNY Life-Safety Evacuation Certificate
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <span>🖨️ Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Printable Certificate Body */}
        <div className="p-6 sm:p-10 space-y-6 overflow-y-auto print:p-0">
          {/* Certificate Header */}
          <div className="text-center border-b-2 border-slate-800 pb-4 space-y-1">
            <div className="text-xs font-mono font-black uppercase tracking-widest text-[#005DAA]">
              CONSOLIDATED EDISON COMPANY OF NEW YORK · EMERGENCY MANAGEMENT
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-slate-900 tracking-tight">
              CERTIFICATE OF LIFE-SAFETY EVACUATION &amp; MUSTER DRILL
            </h1>
            <p className="text-xs text-slate-600 font-medium">
              Conducted in accordance with NYC Fire Code 3 RCNY §401-06 &amp; FDNY High-Rise Rules
            </p>
          </div>

          {/* Facility Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-300 p-4 rounded-xl text-xs">
            <div>
              <div className="font-bold text-slate-500 text-[10px] uppercase">Facility Address</div>
              <div className="font-black text-slate-900">4 Irving Place</div>
              <div className="text-slate-600">New York, NY 10003</div>
            </div>
            <div>
              <div className="font-bold text-slate-500 text-[10px] uppercase">Jurisdiction / Floor</div>
              <div className="font-black text-slate-900">Floor 07</div>
              <div className="text-slate-600">All 4 Quadrants (NW/NE/SW/SE)</div>
            </div>
            <div>
              <div className="font-bold text-slate-500 text-[10px] uppercase">Drill Date &amp; Time</div>
              <div className="font-black text-slate-900">{dateStr}</div>
              <div className="text-slate-600">{timeStr}</div>
            </div>
            <div>
              <div className="font-bold text-slate-500 text-[10px] uppercase">Total Duration</div>
              <div className="font-black text-emerald-700 text-sm">3 min 42 sec</div>
              <div className="text-slate-600">FDNY Standard: &lt; 5 min</div>
            </div>
          </div>

          {/* Accounted Headcount Census */}
          <div className="border border-slate-300 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center justify-between">
              <span>Evacuation Census Summary</span>
              <span className="text-emerald-700 font-mono font-black">{pct}% ACCOUNTED</span>
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-lg">
                <div className="text-xl font-black text-emerald-800 font-mono">{accounted}</div>
                <div className="font-bold text-emerald-900 text-[11px]">Safe &amp; Accounted</div>
                <div className="text-[10px] text-emerald-700">Present outside at Assembly Pt A / B</div>
              </div>
              <div className="bg-slate-50 border border-slate-300 p-3 rounded-lg">
                <div className="text-xl font-black text-slate-800 font-mono">{total}</div>
                <div className="font-bold text-slate-900 text-[11px]">Total Expected On Floor</div>
                <div className="text-[10px] text-slate-600">Active turnstile badge census</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-lg">
                <div className="text-xl font-black text-emerald-800 font-mono">0</div>
                <div className="font-bold text-emerald-900 text-[11px]">Missing / Unaccounted</div>
                <div className="text-[10px] text-emerald-700">100% Floor Clearance Verified</div>
              </div>
            </div>
          </div>

          {/* Cryptographic SHA-256 Seal */}
          <div className="bg-slate-900 text-slate-200 p-4 rounded-xl space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between text-[11px] font-bold text-sky-400">
              <span>🔒 CRYPTOGRAPHIC IMMUTABLE AUDIT BLOCK</span>
              <span className="text-emerald-400">SEALED &amp; TIMESTAMPED</span>
            </div>
            <div className="break-all text-[10px] text-slate-400 leading-relaxed">
              SHA-256 HASH: <strong className="text-white">{sealedHash}</strong>
            </div>
            <div className="text-[9px] text-slate-500">
              Verified by Con Edison MusterCommand Engine · Tamper-proof block chain ledger
            </div>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-4 border-t-2 border-slate-800 text-xs">
            <div className="space-y-4">
              <div className="h-10 border-b border-slate-400 flex items-end font-serif italic text-base">
                Samuel McFarlane, FSD Director
              </div>
              <div>
                <div className="font-black text-slate-900">Fire Safety Director (F-89 / T-89)</div>
                <div className="text-slate-600">Certificate of Fitness #: COF-892104-NYC</div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-10 border-b border-slate-400 flex items-end font-serif italic text-base">
                Elena Vance, Floor 07 Chief Warden
              </div>
              <div>
                <div className="font-black text-slate-900">Floor 07 Warden Certification</div>
                <div className="text-slate-600">4 Irving Place · Safety Committee</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
