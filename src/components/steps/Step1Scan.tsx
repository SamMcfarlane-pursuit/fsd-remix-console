import React, { useState, useEffect, useMemo } from "react";
import QRCode from "qrcode";
import { Occupant, StatusSnapshot } from "../../types";
import { SelfSignInModal } from "../SelfSignInModal";
import { QRCameraScanner } from "../QRCameraScanner";
import {
  parseQRData,
  getMobileNetworkOrigin,
  setCustomMobileOrigin,
  discoverMobileOrigin,
  startPublicTunnel,
  stopPublicTunnel,
  getTunnelStatus,
} from "../../lib/qr";
import { queueOfflineAction } from "../../lib/offlineQueue";

interface Step1ScanProps {
  snapshot: StatusSnapshot | null;
  occupants: Occupant[];
  onCheckIn: (
    occupantId: string,
    status: any,
    via?: string,
    notes?: string,
    locationCategory?: "inside-building" | "outside-assembly" | "offsite",
    assemblyPoint?: string
  ) => void;
  onProceedNext: () => void;
  onOpenSelfSignIn: () => void;
  onOpenQRPoster: () => void;
  onOpenOccupantPortal?: () => void;
  onRefreshState?: () => void;
}

export const Step1Scan: React.FC<Step1ScanProps> = ({
  snapshot,
  occupants,
  onCheckIn,
  onProceedNext,
  onOpenSelfSignIn,
  onOpenQRPoster,
  onOpenOccupantPortal,
  onRefreshState,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [badgeInput, setBadgeInput] = useState<string>("");
  const [selectedOccupantId, setSelectedOccupantId] = useState<string>("");
  const [scanMessage, setScanMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isSelfSignInModalOpen, setIsSelfSignInModalOpen] = useState<boolean>(false);
  const [selfSignInInitialName, setSelfSignInInitialName] = useState<string>("");
  const [mobileOrigin, setMobileOrigin] = useState<string>(getMobileNetworkOrigin());
  const [isEditingOrigin, setIsEditingOrigin] = useState<boolean>(false);
  const [customOriginInput, setCustomOriginInput] = useState<string>("");
  const [networkMode, setNetworkMode] = useState<"lan" | "cellular">("lan");
  const [isTunnelLoading, setIsTunnelLoading] = useState<boolean>(false);

  // Super-Size QR Display & Distance Scanning State
  const [qrDisplaySize, setQrDisplaySize] = useState<"standard" | "large" | "supersize">("supersize");
  const [isSuperSizeModalOpen, setIsSuperSizeModalOpen] = useState<boolean>(false);
  const [billboardZoom, setBillboardZoom] = useState<number>(100);

  // Quick Ingress Intake Form State
  const [showQuickIntake, setShowQuickIntake] = useState<boolean>(false);
  const [intakeName, setIntakeName] = useState<string>("");
  const [intakePhone, setIntakePhone] = useState<string>("");
  const [intakeRole, setIntakeRole] = useState<string>("Employee");
  const [intakeQuadrant, setIntakeQuadrant] = useState<"NW" | "NE" | "SW" | "SE">("NW");
  const [intakeDesk, setIntakeDesk] = useState<string>("");
  const [isIntaking, setIsIntaking] = useState<boolean>(false);

  // Batch Paste Intake State
  const [isBatchPasteOpen, setIsBatchPasteOpen] = useState<boolean>(false);
  const [batchPasteText, setBatchPasteText] = useState<string>("");
  const [isBatchIntaking, setIsBatchIntaking] = useState<boolean>(false);

  const handleQuickIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeName.trim()) {
      setScanMessage({ type: "error", text: "Please enter occupant full name." });
      return;
    }
    setIsIntaking(true);
    try {
      const res = await fetch("/api/occupant/sign-in-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: intakeName.trim(),
          phone: intakePhone.trim() || undefined,
          role: intakeRole,
          quadrant: intakeQuadrant,
          desk: intakeDesk.trim() || `07-${intakeQuadrant}-Desk`,
          action: "enter",
          locationCategory: "inside-building",
        }),
      });
      const data = await res.json();
      if (res.ok && data.occupant) {
        setScanMessage({
          type: "success",
          text: `✅ Intaken & Saved: ${data.occupant.name} (${data.occupant.id}) added to Floor 07 database and marked IN BUILDING!`,
        });
        setIntakeName("");
        setIntakePhone("");
        setIntakeDesk("");
        setShowQuickIntake(false);
        if (onRefreshState) onRefreshState();
      } else {
        setScanMessage({ type: "error", text: data.error || "Failed to intake occupant." });
      }
    } catch {
      setScanMessage({ type: "error", text: "Network error during intake." });
    } finally {
      setIsIntaking(false);
    }
  };

  const handleBatchPasteSubmit = async () => {
    if (!batchPasteText.trim()) return;
    setIsBatchIntaking(true);
    try {
      const lines = batchPasteText.split("\n").filter((l) => l.trim().length > 0);
      const parsedOccupants = lines.map((line, idx) => {
        const parts = line.split(/[,\t]/).map((p) => p.trim());
        const name = parts[0] || `Occupant ${idx + 1}`;
        const phone = parts[1] || "";
        const rawQuad = (parts[2] || "SE").toUpperCase();
        const quad = ["NW", "NE", "SW", "SE"].includes(rawQuad) ? rawQuad : "SE";
        const role = parts[3] || "Employee";
        return {
          name,
          phone,
          quadrant: quad,
          role,
          desk: `07-${quad}-Workstation`,
          status: "safe",
          locationCategory: "inside-building",
        };
      });
      const res = await fetch("/api/roster/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupants: parsedOccupants, mode: "append" }),
      });
      const data = await res.json();
      if (res.ok) {
        setScanMessage({
          type: "success",
          text: `✅ Batch Intake Complete: Successfully saved ${data.importedCount} personnel into Floor 07 database!`,
        });
        setBatchPasteText("");
        setIsBatchPasteOpen(false);
        if (onRefreshState) onRefreshState();
      } else {
        setScanMessage({ type: "error", text: data.error || "Batch intake failed." });
      }
    } catch {
      setScanMessage({ type: "error", text: "Batch intake request failed." });
    } finally {
      setIsBatchIntaking(false);
    }
  };

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

  // Extract latest sign-in and attendance ledger blocks in real-time
  const recentLedgerEntries = useMemo(() => {
    if (!snapshot?.ledgerEntries || snapshot.ledgerEntries.length === 0) return [];
    return [...snapshot.ledgerEntries]
      .filter((e) =>
        [
          "occupant-check-in",
          "qr-occupant-presence-event",
          "presence-toggle-event",
          "visitor-registered",
          "auth-biometric-success",
          "bulk-check-in",
          "occupant-sign-in",
          "event-attendance",
        ].includes(e.type) || e.payload?.occupantId || e.payload?.name
      )
      .slice(-6)
      .reverse();
  }, [snapshot?.ledgerEntries]);

  // Generate QR Code URL with mobile reachable origin
  useEffect(() => {
    getTunnelStatus().then((status) => {
      if (status.active && status.url) {
        setNetworkMode("cellular");
        setMobileOrigin(status.url);
      } else {
        discoverMobileOrigin().then((origin) => {
          setMobileOrigin(origin);
        });
      }
    });

    const handleOriginChange = () => {
      setMobileOrigin(getMobileNetworkOrigin());
    };
    window.addEventListener("muster-origin-changed", handleOriginChange);
    return () => {
      window.removeEventListener("muster-origin-changed", handleOriginChange);
    };
  }, []);

  useEffect(() => {
    if (snapshot?.publicTunnelUrl) {
      setNetworkMode("cellular");
      setMobileOrigin(snapshot.publicTunnelUrl);
    }
  }, [snapshot?.publicTunnelUrl]);

  const handleActivateCellular = async () => {
    setIsTunnelLoading(true);
    try {
      const res = await startPublicTunnel();
      if (res.ok && res.url) {
        setMobileOrigin(res.url);
        setNetworkMode("cellular");
      }
    } finally {
      setIsTunnelLoading(false);
    }
  };

  const handleSwitchToLocalWifi = async () => {
    setIsTunnelLoading(true);
    try {
      await stopPublicTunnel();
      const discovered = await discoverMobileOrigin();
      setMobileOrigin(discovered);
      setNetworkMode("lan");
    } finally {
      setIsTunnelLoading(false);
    }
  };

  useEffect(() => {
    const scanUrl = `${mobileOrigin}/?mode=signin&scan=1`;
    // High-resolution rendering (up to 800px) with High error correction (30% recovery)
    // Guarantees pin-sharp modules and effortless optical capture from distance
    const targetWidth = qrDisplaySize === "supersize" || isSuperSizeModalOpen ? 800 : (qrDisplaySize === "large" ? 540 : 360);
    QRCode.toDataURL(scanUrl, {
      width: targetWidth,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#002447", light: "#FFFFFF" },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error("QR Code generation error:", err));
  }, [mobileOrigin, qrDisplaySize, isSuperSizeModalOpen]);


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
      // First-time arrival: Open the clean registration form!
      const initialInput = parsed.name || (rawTarget.startsWith("OCC-") ? "" : rawTarget);
      setSelfSignInInitialName(initialInput);
      setIsSelfSignInModalOpen(true);
      setScanMessage({
        type: "success",
        text: `📝 First-time occupant arrival detected! Please fill out the quick form to register and be accounted for on Floor 07.`,
      });
      return;
    }

    try {
      if (action === "leave") {
        try {
          await fetch("/api/occupant/presence", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ occupantId: occ.id, action: "leave" }),
          });
          setScanMessage({
            type: "success",
            text: `🚪 Badged Out: ${occ.name} (${occ.id}) recorded as LEFT BUILDING (Off-Site).`,
          });
        } catch {
          queueOfflineAction("presence-toggle", { occupantId: occ.id, action: "leave" });
          setScanMessage({
            type: "success",
            text: `🟠 Recorded Offline: ${occ.name} (${occ.id}) badged out locally and queued for sync.`,
          });
        }
      } else {
        try {
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
        } catch {
          queueOfflineAction("check-in", {
            occupantId: occ.id,
            status: "safe",
            via: "qr-entrance-scanner",
            notes: `Physical Floor 07 entrance badge scan (offline queue)`,
            locationCategory: action === "muster" ? "outside-assembly" : "inside-building",
          });
          setScanMessage({
            type: "success",
            text: `🟠 Recorded Offline: ${occ.name} (${occ.id}) marked as PRESENT & queued for auto-sync.`,
          });
        }
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

      {/* Ready for Intake Status Banner */}
      {occupants.length === 0 && (
        <div className="bg-gradient-to-r from-[#003B70] via-[#005DAA] to-[#003B70] text-white rounded-2xl p-5 border-2 border-sky-300 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl shrink-0">
              📥
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm uppercase tracking-wider">DATABASE READY FOR INTAKE</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono font-bold animate-pulse">
                  0 ENROLLED · CLEAN
                </span>
              </div>
              <p className="text-xs text-sky-100 mt-1 max-w-xl leading-relaxed">
                Mock names have been removed. The database is in clean standby, ready to intake real employees and visitors. Intake can be completed via QR Code on mobile, Entrance Kiosk, or Quick Register below.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowQuickIntake(true)}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <span>➕</span>
              <span>Quick Intake</span>
            </button>
            <button
              type="button"
              onClick={() => setIsBatchPasteOpen(true)}
              className="px-3.5 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition cursor-pointer border border-white/20"
            >
              <span>📋 Paste Roster</span>
            </button>
          </div>
        </div>
      )}

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

          {/* Dual Network Pathway Selector */}
          <div className="w-full bg-[#F0F6FC] p-1.5 rounded-xl border border-[#B8D8F8] grid grid-cols-2 gap-1.5 text-xs font-bold">
            <button
              type="button"
              onClick={handleSwitchToLocalWifi}
              disabled={isTunnelLoading}
              className={`py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                networkMode === "lan"
                  ? "bg-[#005DAA] text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white"
              }`}
            >
              <span>🏢</span>
              <span>Building Wi-Fi</span>
            </button>

            <button
              type="button"
              onClick={handleActivateCellular}
              disabled={isTunnelLoading}
              className={`py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 ${
                networkMode === "cellular"
                  ? "bg-emerald-600 text-white shadow-xs font-black"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white"
              }`}
            >
              <span>🌐</span>
              <span>{isTunnelLoading ? "Connecting..." : "Cellular 5G"}</span>
            </button>
          </div>

          {/* Super-Size QR Scale Controls */}
          <div className="w-full flex items-center justify-between text-xs bg-[#F0F6FC] px-3 py-2 rounded-xl border border-[#CBDCEE]">
            <span className="font-bold text-[#0F2537] flex items-center gap-1.5 text-[11px]">
              <span className="text-amber-500">📐</span>
              <span className="font-black">SCALE:</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setQrDisplaySize("standard")}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  qrDisplaySize === "standard"
                    ? "bg-[#005DAA] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 bg-white"
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setQrDisplaySize("large")}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  qrDisplaySize === "large"
                    ? "bg-[#005DAA] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 bg-white"
                }`}
              >
                Large
              </button>
              <button
                type="button"
                onClick={() => setQrDisplaySize("supersize")}
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black transition cursor-pointer flex items-center gap-1 ${
                  qrDisplaySize === "supersize"
                    ? "bg-amber-600 text-white shadow-xs ring-1 ring-amber-400"
                    : "text-amber-800 bg-amber-50 hover:bg-amber-100"
                }`}
              >
                <span>⚡ Super-Size</span>
              </button>
            </div>
          </div>

          {/* QR Code Container with Distance Scan Reticles */}
          <div className="relative p-4 sm:p-5 bg-white rounded-2xl border-2 border-dashed border-[#005DAA]/50 shadow-md flex flex-col items-center w-full transition-all">
            {/* Targeting Reticle Corners for Distance Optical Alignment */}
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-500 rounded-tl-sm pointer-events-none" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-500 rounded-tr-sm pointer-events-none" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-500 rounded-bl-sm pointer-events-none" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-500 rounded-br-sm pointer-events-none" />

            {/* Clickable QR Code with Zoom Hint */}
            <div
              onClick={() => setIsSuperSizeModalOpen(true)}
              className="cursor-zoom-in group relative flex items-center justify-center p-2 bg-white rounded-xl hover:shadow-lg transition-all"
              title="Click to open Fullscreen Distance Billboard"
            >
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Floor 07 Sign-In QR"
                  className={`object-contain transition-all duration-200 ${
                    qrDisplaySize === "standard"
                      ? "w-48 h-48 sm:w-52 sm:h-52"
                      : qrDisplaySize === "large"
                      ? "w-72 h-72 sm:w-80 sm:h-80"
                      : "w-80 h-80 sm:w-96 sm:h-96 md:w-[380px] md:h-[380px]"
                  }`}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center bg-slate-100 rounded-xl text-xs text-slate-500">
                  Generating High-Res QR...
                </div>
              )}
              <div className="absolute inset-0 bg-[#005DAA]/10 opacity-0 group-hover:opacity-100 rounded-xl transition flex items-center justify-center">
                <span className="bg-black/80 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                  <span>🔎</span>
                  <span>Click for Fullscreen Billboard</span>
                </span>
              </div>
            </div>

            {/* High-Visibility Distance Scan Badge */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 w-full">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono font-black bg-amber-50 text-amber-900 border border-amber-300 shadow-2xs">
                <span>🎯</span>
                <span>DISTANCE SCAN READY (15–20 FT)</span>
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono font-bold border ${
                networkMode === "cellular"
                  ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                  : "bg-sky-50 text-sky-900 border-sky-300"
              }`}>
                <span>{networkMode === "cellular" ? "🌐 5G CELLULAR" : "🏢 BUILDING WI-FI"}</span>
              </span>
            </div>

            {/* Launch Fullscreen Super-Size Billboard Button */}
            <button
              type="button"
              onClick={() => setIsSuperSizeModalOpen(true)}
              className="mt-3 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#005DAA] to-[#003B70] hover:from-[#004A88] hover:to-[#002B49] text-white text-[11px] font-black uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🖥️</span>
              <span>Super-Size Fullscreen Billboard</span>
              <span>↗</span>
            </button>
          </div>

            {/* Mobile Reachable Network Address Strip */}
            <div className="mt-3 w-full bg-[#F0F6FC] p-2.5 rounded-xl border border-[#CBDCEE] text-left">
              <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#475569]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>MOBILE WI-FI / NETWORK URL</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingOrigin(!isEditingOrigin);
                    setCustomOriginInput(mobileOrigin);
                  }}
                  className="text-[#005DAA] hover:underline cursor-pointer"
                >
                  {isEditingOrigin ? "Cancel" : "Edit IP"}
                </button>
              </div>

              {!isEditingOrigin ? (
                <div className="mt-1 flex items-center justify-between gap-1">
                  <span className="font-mono text-xs font-bold text-[#0F2537] truncate select-all">
                    {mobileOrigin}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(`${mobileOrigin}/?mode=signin&scan=1`);
                        alert("Copied mobile sign-in URL to clipboard!");
                      }
                    }}
                    className="text-[10px] bg-white border border-[#CBDCEE] px-2 py-0.5 rounded text-[#005DAA] font-bold hover:bg-[#EBF3FB] transition cursor-pointer"
                  >
                    Copy URL
                  </button>
                </div>
              ) : (
                <div className="mt-1.5 flex gap-1.5">
                  <input
                    type="text"
                    value={customOriginInput}
                    onChange={(e) => setCustomOriginInput(e.target.value)}
                    placeholder="e.g. http://192.168.1.60:3000"
                    className="flex-1 px-2 py-1 bg-white border border-[#005DAA] rounded text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCustomMobileOrigin(customOriginInput.trim());
                      setMobileOrigin(getMobileNetworkOrigin());
                      setIsEditingOrigin(false);
                    }}
                    className="px-2.5 py-1 bg-[#005DAA] text-white rounded text-xs font-bold hover:bg-[#004884] cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>

          <div className="w-full space-y-2 text-xs">
            <div className="flex flex-col sm:flex-row gap-2">
              {onOpenOccupantPortal && (
                <button
                  type="button"
                  onClick={onOpenOccupantPortal}
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span>📱</span>
                  <span>Handheld Portal</span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenSelfSignIn}
                className="flex-1 py-2.5 px-3 bg-[#005DAA] hover:bg-[#004884] text-white rounded-xl font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <span>✍️</span>
                <span>Self Sign-In</span>
              </button>
              <button
                type="button"
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
          {/* Quick Personnel Intake & Registration Card */}
          <div className="bg-white rounded-2xl p-6 border-2 border-[#005DAA] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono font-bold text-[#005DAA] uppercase bg-[#EBF3FB] px-2 py-0.5 rounded">
                  Live Personnel Ingress
                </span>
                <h3 className="text-base font-black text-[#0F2537] mt-1 flex items-center gap-2">
                  <span>➕</span>
                  <span>Quick Personnel Intake &amp; Ingress</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchPasteOpen(!isBatchPasteOpen)}
                  className="text-xs font-bold text-[#005DAA] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>📋 Batch Paste</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickIntake(!showQuickIntake)}
                  className="text-xs font-mono font-bold text-[#005DAA] bg-[#EBF3FB] px-2.5 py-1 rounded-lg hover:bg-[#D8EAF8] cursor-pointer"
                >
                  {showQuickIntake ? "Collapse ▲" : "Intake Person ▼"}
                </button>
              </div>
            </div>

            {/* Quick Intake Form */}
            {showQuickIntake && (
              <form onSubmit={handleQuickIntakeSubmit} className="space-y-3 pt-2 border-t border-[#E2E8F0] animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wider block mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={intakeName}
                      onChange={(e) => setIntakeName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-bold text-[#0F2537] focus:ring-2 focus:ring-[#005DAA] outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wider block mb-1">
                      Mobile Phone (for Drill SMS) *
                    </label>
                    <input
                      type="text"
                      value={intakePhone}
                      onChange={(e) => setIntakePhone(e.target.value)}
                      placeholder="e.g. (212) 555-0144"
                      className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-bold text-[#0F2537] focus:ring-2 focus:ring-[#005DAA] outline-hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wider block mb-1">
                      Role
                    </label>
                    <select
                      value={intakeRole}
                      onChange={(e) => setIntakeRole(e.target.value)}
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-bold text-[#0F2537] outline-hidden cursor-pointer"
                    >
                      <option value="Employee">Employee</option>
                      <option value="Contractor">Contractor</option>
                      <option value="Visitor">Visitor</option>
                      <option value="VIP">VIP</option>
                      <option value="First Responder">First Responder</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wider block mb-1">
                      Floor 07 Quadrant
                    </label>
                    <select
                      value={intakeQuadrant}
                      onChange={(e) => setIntakeQuadrant(e.target.value as any)}
                      className="w-full px-3 py-2 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-bold text-[#0F2537] outline-hidden cursor-pointer"
                    >
                      <option value="NW">NW · Strategic Planning</option>
                      <option value="NE">NE · Gas Ops &amp; Security</option>
                      <option value="SW">SW · AMI &amp; Ombudsman</option>
                      <option value="SE">SE · Steam Operations</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#475569] uppercase tracking-wider block mb-1">
                      Desk / Workstation
                    </label>
                    <input
                      type="text"
                      value={intakeDesk}
                      onChange={(e) => setIntakeDesk(e.target.value)}
                      placeholder="e.g. 07-840-A2"
                      className="w-full px-3.5 py-2 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-medium text-[#0F2537] focus:ring-2 focus:ring-[#005DAA] outline-hidden"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={isIntaking || !intakeName.trim()}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <span>{isIntaking ? "Saving..." : "✓ Save & Intake Into Roster"}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Batch Paste Intake Drawer */}
            {isBatchPasteOpen && (
              <div className="p-4 bg-[#F0F6FC] rounded-xl border border-[#B8D8F8] space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#005DAA] uppercase">
                    📋 Paste Multiple Occupants (One Per Line)
                  </span>
                  <span className="text-[10px] text-[#64748B]">Format: Name, Phone, Quadrant, Role</span>
                </div>
                <textarea
                  rows={3}
                  value={batchPasteText}
                  onChange={(e) => setBatchPasteText(e.target.value)}
                  placeholder={`Alice Walker, (212) 555-0101, NW, Employee\nBob Martin, (212) 555-0102, NE, Contractor\nCharlie Chen, (212) 555-0103, SW, Visitor`}
                  className="w-full p-2.5 bg-white border border-[#CBDCEE] rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#005DAA] outline-hidden"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#475569]">
                    Lines detected: {batchPasteText.split("\n").filter((l) => l.trim().length > 0).length}
                  </span>
                  <button
                    type="button"
                    onClick={handleBatchPasteSubmit}
                    disabled={isBatchIntaking || !batchPasteText.trim()}
                    className="px-4 py-2 bg-[#005DAA] hover:bg-[#004884] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    {isBatchIntaking ? "Importing..." : "Import & Save All to Database"}
                  </button>
                </div>
              </div>
            )}
          </div>

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
                <div className="bg-white border border-[#CBDCEE] rounded-xl shadow-lg overflow-hidden divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {filteredOccupants.map((occ) => {
                    const isPresent = !occ.badgedOut && !occ.offSiteToday;
                    return (
                      <div
                        key={occ.id}
                        className="px-4 py-2.5 hover:bg-[#EBF3FB] transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-black text-[#0F2537] flex items-center gap-1.5">
                            <span>{occ.name}</span>
                            <span className="font-mono text-[10px] text-[#005DAA] font-bold">({occ.id})</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                isPresent
                                  ? "bg-emerald-100 text-emerald-950 border border-emerald-300"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {isPresent ? "🟢 In Building" : "⚪ Badged Out"}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            {occ.role} · Sector {occ.quadrant} · Desk: {occ.desk || "07-Floor"} · Phone: {occ.phone || "On File"}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleManualScan(occ.id, "enter")}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-black text-[11px] cursor-pointer shadow-xs transition flex items-center gap-1"
                            title="Record person as In Building"
                          >
                            <span>🏢</span>
                            <span>In-Building</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleManualScan(occ.id, "leave")}
                            className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-black text-[11px] cursor-pointer shadow-xs transition flex items-center gap-1"
                            title="Record person as Badged Out / Left Building"
                          >
                            <span>🚪</span>
                            <span>Badge Out</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
              <button
                onClick={() => handleManualScan(undefined, "enter")}
                disabled={!badgeInput.trim() && filteredOccupants.length === 0}
                className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                title="Record person as entering Floor 07 (In Building)"
              >
                <span>🏢</span>
                <span>In-Building (Ingress)</span>
              </button>

              <button
                onClick={() => handleManualScan(undefined, "leave")}
                disabled={!badgeInput.trim() && filteredOccupants.length === 0}
                className="py-3 px-3 bg-slate-700 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                title="Record person as badged out / leaving building"
              >
                <span>🚪</span>
                <span>Badge-Out (Left Bldg)</span>
              </button>

              <button
                onClick={() => {
                  setSelfSignInInitialName(badgeInput.trim());
                  setIsSelfSignInModalOpen(true);
                }}
                className="py-3 px-3 bg-[#EBF3FB] hover:bg-[#D6E8F8] text-[#005DAA] border border-[#CBDCEE] font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>+</span>
                <span>Register Person</span>
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

      {/* Live Floor 07 Sign-In Cryptographic Ledger Feed */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#B8D8F8] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⛓️</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-[#0F2537] uppercase tracking-wider">
                  Live Floor 07 Sign-In Ledger Feed
                </h3>
                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-950 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  REAL-TIME BLOCKS
                </span>
              </div>
              <p className="text-xs text-[#64748B]">
                Every phone QR scan, Touch ID entry, and staff badge-in is cryptographically recorded into the life-safety ledger.
              </p>
            </div>
          </div>
          <div className="text-xs font-mono font-bold text-[#005DAA] bg-[#F0F6FC] px-3 py-1.5 rounded-xl border border-[#CBDCEE] shrink-0 self-start sm:self-auto">
            Ledger Height: {snapshot?.ledgerEntries?.length || 1} Blocks
          </div>
        </div>

        <div className="space-y-2">
          {recentLedgerEntries.length === 0 ? (
            <div className="p-4 bg-[#F8FAFC] border border-dashed border-[#CBDCEE] rounded-xl text-center text-xs text-slate-500 font-mono">
              Awaiting ingress events. Scan phone QR or confirm badge-in above to commit the next block.
            </div>
          ) : (
            recentLedgerEntries.map((entry, idx) => {
              const name = entry.payload?.name || entry.payload?.occupantName || "Floor 07 Occupant";
              const id = entry.payload?.occupantId || entry.payload?.userId || "";
              const presence = entry.payload?.presence || (entry.payload?.newStatus === "safe" ? "IN_BUILDING" : entry.type);
              const isEntry = presence === "IN_BUILDING" || entry.payload?.action === "enter" || entry.payload?.newStatus === "safe";
              const isLeave = presence === "LEFT_BUILDING" || entry.payload?.action === "leave";

              return (
                <div
                  key={entry.id || idx}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all font-mono text-xs ${
                    idx === 0 ? "bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400" : "bg-[#F8FAFC] border-[#E2E8F0]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="px-2 py-0.5 bg-[#003B70] text-white rounded font-bold text-[10px]">
                      {entry.id || `L-${String(idx + 1).padStart(4, "0")}`}
                    </span>
                    <span className="font-bold text-[#0F2537]">
                      {name} {id && <span className="text-slate-500 text-[11px]">({id})</span>}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isEntry
                          ? "bg-emerald-100 text-emerald-950 border border-emerald-300"
                          : isLeave
                          ? "bg-amber-100 text-amber-950 border border-amber-300"
                          : "bg-sky-100 text-sky-950 border border-sky-300"
                      }`}
                    >
                      {isEntry ? "🏢 In Building" : isLeave ? "🚪 Badged Out" : "✓ Accounted"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-600 justify-between sm:justify-end">
                    <span className="truncate max-w-[200px]" title={entry.hash}>
                      SHA-256: {entry.hash ? entry.hash.substring(0, 10) + "..." + entry.hash.substring(entry.hash.length - 4) : "6c79...59ac"}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Just now"}
                    </span>
                  </div>
                </div>
              );
            })
          )}
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

      {/* Super-Size Fullscreen Distance Billboard Modal (Scannable from 15–20 Feet) */}
      {isSuperSizeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setIsSuperSizeModalOpen(false)}
        >
          <div
            className="relative bg-white rounded-3xl max-w-3xl w-full border-4 border-amber-400 shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close & Zoom Controls Bar */}
            <div className="w-full flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2 text-left">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse" />
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#002447] tracking-tight uppercase">
                    Con Edison Floor 07 · Ingress Billboard
                  </h2>
                  <p className="text-xs text-slate-500 font-semibold font-mono">
                    High-Density Optical QR · Detectable from 15–20 Feet
                  </p>
                </div>
              </div>

              {/* Zoom Buttons & Close */}
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                  <span className="px-2 text-slate-500 text-[10px] uppercase font-mono">Zoom:</span>
                  <button
                    type="button"
                    onClick={() => setBillboardZoom(100)}
                    className={`px-2 py-0.5 rounded-lg text-xs transition cursor-pointer ${
                      billboardZoom === 100 ? "bg-[#005DAA] text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillboardZoom(125)}
                    className={`px-2 py-0.5 rounded-lg text-xs transition cursor-pointer ${
                      billboardZoom === 125 ? "bg-[#005DAA] text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    125%
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillboardZoom(150)}
                    className={`px-2 py-0.5 rounded-lg text-xs transition cursor-pointer ${
                      billboardZoom === 150 ? "bg-[#005DAA] text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    150%
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSuperSizeModalOpen(false)}
                  className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-lg flex items-center justify-center transition cursor-pointer"
                  title="Close Billboard (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Target Alignment Reticle Container */}
            <div className="relative p-6 sm:p-8 bg-white rounded-3xl border-4 border-[#002447] shadow-inner flex flex-col items-center justify-center">
              {/* Corner Brackets */}
              <div className="absolute top-2 left-2 w-8 h-8 border-t-4 border-l-4 border-amber-500 rounded-tl-lg pointer-events-none" />
              <div className="absolute top-2 right-2 w-8 h-8 border-t-4 border-r-4 border-amber-500 rounded-tr-lg pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-8 h-8 border-b-4 border-l-4 border-amber-500 rounded-bl-lg pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-8 h-8 border-b-4 border-r-4 border-amber-500 rounded-br-lg pointer-events-none" />

              {/* Giant QR Code Image */}
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Floor 07 Super-Size Sign-In QR"
                  style={{
                    width: billboardZoom === 150 ? "580px" : billboardZoom === 125 ? "480px" : "380px",
                    height: billboardZoom === 150 ? "580px" : billboardZoom === 125 ? "480px" : "380px",
                    maxWidth: "85vw",
                    maxHeight: "60vh",
                  }}
                  className="object-contain transition-all duration-200 rounded-xl"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-80 h-80 flex items-center justify-center bg-slate-100 rounded-2xl text-sm text-slate-500 font-mono">
                  Rendering 800px Billboard QR...
                </div>
              )}

              {/* Scanning Reticle Tag */}
              <div className="mt-4 px-4 py-1.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 text-xs font-black font-mono tracking-wider shadow-xs">
                🎯 STAND BACK 15–20 FT · AIM PHONE CAMERA AT CENTER
              </div>
            </div>

            {/* Network Pathway Controls & Direct URL Strip */}
            <div className="w-full bg-[#F0F6FC] p-4 rounded-2xl border border-[#CBDCEE] space-y-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#0F2537]">Active Ingress Route:</span>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={handleSwitchToLocalWifi}
                      className={`px-3 py-1 rounded-md transition cursor-pointer ${
                        networkMode === "lan" ? "bg-[#005DAA] text-white" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      🏢 Building Wi-Fi
                    </button>
                    <button
                      type="button"
                      onClick={handleActivateCellular}
                      className={`px-3 py-1 rounded-md transition cursor-pointer ${
                        networkMode === "cellular" ? "bg-emerald-600 text-white" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      🌐 Cellular 5G
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(`${mobileOrigin}/?mode=signin&scan=1`);
                      alert("Copied mobile sign-in URL to clipboard!");
                    }
                  }}
                  className="px-4 py-1.5 rounded-xl bg-white border border-[#CBDCEE] text-[#005DAA] text-xs font-black hover:bg-slate-50 transition shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>📋</span>
                  <span>Copy Web Link</span>
                </button>
              </div>

              <div className="font-mono text-xs text-[#003B70] bg-white p-2.5 rounded-xl border border-[#CBDCEE] break-all select-all font-bold text-left flex items-center justify-between">
                <span>{mobileOrigin}/?mode=signin&scan=1</span>
                <span className="text-[10px] font-mono text-slate-400 shrink-0 ml-2">PORT 3000</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
