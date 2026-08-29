import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Occupant, StatusSnapshot } from "../../types";
import { SelfSignInModal } from "../SelfSignInModal";
import { QRCameraScanner } from "../QRCameraScanner";
import { parseQRData } from "../../lib/qr";

interface Step1ScanProps {
  snapshot: StatusSnapshot | null;
  occupants: Occupant[];
  onCheckIn: (
    occupantId: string,
    status: any,
    via?: string,
    notes?: string,
    locationCategory?: any
  ) => Promise<void>;
  onProceedNext: () => void;
  onOpenSelfSignIn: () => void;
  onOpenQRPoster: () => void;
}

export const Step1Scan: React.FC<Step1ScanProps> = ({
  snapshot,
  occupants,
  onCheckIn,
  onProceedNext,
  onOpenSelfSignIn,
  onOpenQRPoster,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [badgeInput, setBadgeInput] = useState<string>("");
  const [selectedOccupantId, setSelectedOccupantId] = useState<string>("");
  const [scanMessage, setScanMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isSelfSignInModalOpen, setIsSelfSignInModalOpen] = useState<boolean>(false);
  const [selfSignInInitialName, setSelfSignInInitialName] = useState<string>("");

  // Generate QR Code URL
  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const scanUrl = `${origin}?mode=signin&scan=1`;
    QRCode.toDataURL(scanUrl, {
      width: 320,
      margin: 2,
      color: { dark: "#003B70", light: "#FFFFFF" },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR Code generation error:", err));
  }, []);

  // Filter occupants matching search
  const filteredOccupants = badgeInput.trim()
    ? occupants.filter(
        (o) =>
          o.name.toLowerCase().includes(badgeInput.toLowerCase()) ||
          o.id.toLowerCase().includes(badgeInput.toLowerCase()) ||
          (o.phone && o.phone.replace(/\D/g, "").includes(badgeInput.replace(/\D/g, ""))) ||
          o.desk?.toLowerCase().includes(badgeInput.toLowerCase()) ||
          o.company?.toLowerCase().includes(badgeInput.toLowerCase())
      ).slice(0, 5)
    : [];

  const handleManualScan = async (occupantIdToUse?: string, action: "enter" | "leave" | "muster" = "enter") => {
    const rawTarget = occupantIdToUse || selectedOccupantId || (filteredOccupants.length > 0 ? filteredOccupants[0].id : badgeInput.trim());
    if (!rawTarget) {
      setScanMessage({ type: "error", text: "Please enter or scan an occupant name, phone, or badge ID." });
      return;
    }

    const parsed = parseQRData(rawTarget);
    const target = (parsed.occupantId || parsed.phone || parsed.name || rawTarget).trim();

    const occ = occupants.find((o) => {
      if (parsed.occupantId && o.id.toLowerCase() === parsed.occupantId.toLowerCase()) return true;
      if (o.id.toLowerCase() === target.toLowerCase()) return true;
      if (o.name.toLowerCase() === target.toLowerCase()) return true;
      if (target.length >= 4 && o.name.toLowerCase().includes(target.toLowerCase())) return true;
      if (target.replace(/\D/g, "").length >= 7 && o.phone && o.phone.replace(/\D/g, "") === target.replace(/\D/g, "")) return true;
      return false;
    });

    if (!occ) {
      setScanMessage({
        type: "error",
        text: `⚠️ '${rawTarget}' is not registered in the Floor 07 database.`,
      });
      setSelfSignInInitialName(parsed.name || rawTarget);
      return;
    }

    try {
      if (action === "leave") {
        await fetch("/api/occupant/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ occupantId: occ.id, action: "leave" }),
        });
        setScanMessage({
          type: "success",
          text: `🚪 Badged Out: ${occ.name} (${occ.id}) recorded as LEFT BUILDING (Off-Site).`,
        });
      } else {
        await onCheckIn(
          occ.id,
          "safe",
          "qr-entrance-scanner",
          `Physical Floor 07 entrance badge scan at ${new Date().toLocaleTimeString()}`,
          action === "muster" ? "outside-assembly" : "inside-building"
        );
        setScanMessage({
          type: "success",
          text: `⚡ Direct Sign-In Verified! Welcome back ${occ.name} (${occ.id}). You are recorded as PRESENT & ACCOUNTED on Floor 07.`,
        });
      }
      setBadgeInput("");
      setSelectedOccupantId("");
    } catch {
      setScanMessage({ type: "error", text: "Failed to submit badge scan. Please try again." });
    }
  };

  const inBuildingCount = occupants.filter((o) => !o.badgedOut && !o.offSiteToday).length;

  return (
    <div id="step-1-scan-container" className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Step Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#B8D8F8] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#005DAA] uppercase tracking-wider mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#005DAA]" />
            STEP 01 OF 05 · ENTRANCE ACCESS &amp; BADGE INGESTION
          </div>
          <h2 className="text-2xl font-black tracking-tight text-[#0F2537]">
            Scan Floor QR Code or Enter Badge ID
          </h2>
          <p className="text-sm text-[#475569] mt-1 max-w-2xl">
            Floor 07 entrance ingress checkpoint. Occupants scan the physical QR poster on arrival with their smartphone, or security verifies employee badge IDs directly into the live roster.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-[#F0F6FC] px-4 py-2.5 rounded-xl border border-[#CBDCEE] text-right">
            <div className="text-[10px] font-mono font-bold text-[#475569] uppercase">In Building Now</div>
            <div className="text-xl font-mono font-black text-[#005DAA]">
              {inBuildingCount} <span className="text-xs text-[#64748B]">/ {occupants.length}</span>
            </div>
          </div>

          <button
            id="step1-proceed-btn"
            onClick={onProceedNext}
            className="px-5 py-3 rounded-xl bg-[#005DAA] hover:bg-[#004884] text-white font-black text-sm tracking-wide transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span>Proceed to Step 02</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {scanMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-bold flex items-center justify-between transition-all ${
            scanMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-300"
              : "bg-red-50 text-red-900 border border-red-300"
          }`}
        >
          <span>{scanMessage.text}</span>
          <button
            onClick={() => setScanMessage(null)}
            className="text-xs opacity-75 hover:opacity-100 cursor-pointer"
          >
            Dismiss ✕
          </button>
        </div>
      )}

      {/* Main Grid: QR Poster Display & Interactive Scanner Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Official QR Poster Display (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-[#B8D8F8] shadow-xs flex flex-col items-center text-center justify-between space-y-4">
          <div className="w-full text-left border-b border-[#E2E8F0] pb-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-mono font-bold text-[#005DAA] uppercase bg-[#EBF3FB] px-2 py-0.5 rounded">
                Official Floor Poster
              </span>
              <h3 className="text-base font-bold text-[#0F2537] mt-1">Con Edison Floor 07 Sign-In</h3>
            </div>
            <button
              onClick={onOpenQRPoster}
              className="text-xs font-bold text-[#005DAA] hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Full Poster</span>
              <span>↗</span>
            </button>
          </div>

          {/* QR Code Container */}
          <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-[#005DAA]/40 shadow-inner flex flex-col items-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Floor 07 Sign-In QR"
                className="w-52 h-52 object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center bg-slate-100 rounded-xl text-xs text-slate-500">
                Generating QR...
              </div>
            )}
            <p className="text-[11px] font-mono text-[#003B70] font-semibold mt-2">
              SCAN WITH ANY SMARTPHONE CAMERA
            </p>
          </div>

          <div className="w-full space-y-2 text-xs">
            <div className="flex gap-2">
              <button
                onClick={onOpenSelfSignIn}
                className="flex-1 py-2.5 px-3 bg-[#005DAA] hover:bg-[#004884] text-white rounded-xl font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>📱</span>
                <span>Open Mobile Sign-In</span>
              </button>
              <button
                onClick={onOpenQRPoster}
                className="flex-1 py-2.5 px-3 bg-[#EBF3FB] hover:bg-[#D6E8F8] text-[#005DAA] border border-[#CBDCEE] rounded-xl font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>🖨️</span>
                <span>Print Poster</span>
              </button>
            </div>
            <p className="text-[11px] text-[#64748B]">
              No app download required. Connects directly to Con Ed life-safety mesh.
            </p>
          </div>
        </div>

        {/* Right Column: Fast Badge Ingestion & Visitor Station (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Badge Ingestion Card */}
          <div className="bg-white rounded-2xl p-6 border border-[#B8D8F8] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[#0F2537] flex items-center gap-2">
                <span>💳</span>
                <span>Direct Badge ID or Name Check-In</span>
              </h3>
              <span className="text-[11px] font-mono text-[#005DAA] bg-[#EBF3FB] px-2 py-0.5 rounded font-bold">
                Instant Ingress
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-[#475569] uppercase tracking-wider block">
                Type Employee Name, Badge ID, or Desk Location
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={badgeInput}
                  onChange={(e) => {
                    setBadgeInput(e.target.value);
                    setSelectedOccupantId("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleManualScan();
                  }}
                  placeholder="e.g. Fahmida Ali, BADGE-1014, 07-840, or Strategic Planning..."
                  className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#005DAA] focus:bg-white outline-hidden"
                />
                {badgeInput && (
                  <button
                    onClick={() => setBadgeInput("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                  >
                    Clear ✕
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {filteredOccupants.length > 0 && (
                <div className="bg-white border border-[#CBDCEE] rounded-xl shadow-lg overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {filteredOccupants.map((occ) => (
                    <div
                      key={occ.id}
                      className="px-4 py-2.5 hover:bg-[#EBF3FB] transition flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-black text-[#0F2537]">{occ.name} <span className="font-mono text-[10px] text-[#005DAA] font-bold">({occ.id})</span></div>
                        <div className="text-[11px] text-[#64748B]">
                          {occ.role} · Sector {occ.quadrant} · Desk: {occ.desk || "07-Floor"} · Phone: {occ.phone || "On File"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleManualScan(occ.id, "enter")}
                        className="px-3 py-1.5 bg-[#005DAA] hover:bg-[#004884] text-white rounded-lg font-black text-[11px] cursor-pointer shadow-xs transition flex items-center gap-1 shrink-0"
                      >
                        <span>⚡</span>
                        <span>Direct Sign-In</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {/* Unregistered occupant notification banner */}
              {badgeInput.trim().length > 0 && filteredOccupants.length === 0 && (
                <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fadeIn">
                  <div className="text-xs">
                    <span className="font-bold text-amber-900 block">
                      ⚠️ "{badgeInput}" is not registered in the Floor 07 database.
                    </span>
                    <span className="text-[11px] text-amber-800">
                      Click below to open the digital sign-in form, allocate desk, and issue pass.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelfSignInInitialName(badgeInput.trim());
                      setIsSelfSignInModalOpen(true);
                    }}
                    className="px-3.5 py-2 bg-[#005DAA] hover:bg-[#004A88] text-white rounded-lg font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-xs shrink-0 flex items-center justify-center gap-1.5"
                  >
                    <span>➕</span>
                    <span>Sign In &amp; Register</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handleManualScan()}
                disabled={!badgeInput.trim() && filteredOccupants.length === 0}
                className="flex-1 py-3 px-4 bg-[#005DAA] hover:bg-[#004884] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>✓</span>
                <span>Confirm Ingress Badge-In</span>
              </button>

              <button
                onClick={() => {
                  setSelfSignInInitialName("");
                  setIsSelfSignInModalOpen(true);
                }}
                className="py-3 px-4 bg-[#EBF3FB] hover:bg-[#D6E8F8] text-[#005DAA] border border-[#CBDCEE] font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <span>+</span>
                <span>Register / Sign-In Person</span>
              </button>
            </div>
          </div>

          {/* Camera Scanner Station Toggle */}
          <div className="bg-white rounded-2xl p-5 border border-[#B8D8F8] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📷</span>
                <div>
                  <h4 className="text-sm font-bold text-[#0F2537]">Live Optical Camera Scanner</h4>
                  <p className="text-xs text-[#64748B]">Scan physical employee badges or QR codes in real-time</p>
                </div>
              </div>
              <button
                onClick={() => setIsCameraActive(!isCameraActive)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                  isCameraActive
                    ? "bg-red-100 text-red-700 border border-red-300"
                    : "bg-[#005DAA] text-white hover:bg-[#004884]"
                }`}
              >
                {isCameraActive ? "Close Scanner ✕" : "Activate Optical Scanner"}
              </button>
            </div>

            {isCameraActive && (
              <div className="animate-fadeIn">
                <QRCameraScanner
                  stationName="Floor 07 Main Entrance Kiosk"
                  onScanSuccess={(decodedText, action) => {
                    handleManualScan(decodedText, action);
                  }}
                  onClose={() => setIsCameraActive(false)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comprehensive Self Sign-In & Ingress Registration Modal */}
      <SelfSignInModal
        isOpen={isSelfSignInModalOpen}
        initialName={selfSignInInitialName}
        occupants={occupants}
        onClose={() => setIsSelfSignInModalOpen(false)}
        onSuccess={() => {
          setScanMessage({
            type: "success",
            text: `⚡ Sign-In Registered & Accounted! Floor 07 life-safety roster and live sector map updated.`,
          });
        }}
      />
    </div>
  );
};
