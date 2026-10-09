import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import {
  discoverMobileOrigin,
  getMobileNetworkOrigin,
  setCustomMobileOrigin,
  startPublicTunnel,
  stopPublicTunnel,
  getTunnelStatus,
} from "../lib/qr";

interface SignInQRPosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSignInForm: () => void;
  occupantsCount: number;
  inBuildingCount: number;
}

export const SignInQRPosterModal: React.FC<SignInQRPosterModalProps> = ({
  isOpen,
  onClose,
  onOpenSignInForm,
  occupantsCount,
  inBuildingCount,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [mobileOrigin, setMobileOrigin] = useState<string>(getMobileNetworkOrigin());
  const [isEditingOrigin, setIsEditingOrigin] = useState<boolean>(false);
  const [customOriginInput, setCustomOriginInput] = useState<string>("");
  const [networkMode, setNetworkMode] = useState<"lan" | "cellular">("lan");
  const [isTunnelLoading, setIsTunnelLoading] = useState<boolean>(false);
  const [tunnelError, setTunnelError] = useState<string | null>(null);
  const [qrScale, setQrScale] = useState<"standard" | "large" | "supersize" | "giant">("supersize");

  useEffect(() => {
    if (isOpen) {
      // Check existing tunnel status
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
    }

    const handleOriginChange = () => {
      setMobileOrigin(getMobileNetworkOrigin());
    };
    window.addEventListener("muster-origin-changed", handleOriginChange);
    return () => {
      window.removeEventListener("muster-origin-changed", handleOriginChange);
    };
  }, [isOpen]);

  const signInUrl = `${mobileOrigin}/?mode=signin&scan=1`;

  useEffect(() => {
    if (isOpen) {
      const qrRes = qrScale === "giant" ? 850 : qrScale === "supersize" ? 650 : qrScale === "large" ? 480 : 360;
      QRCode.toDataURL(signInUrl, {
        width: qrRes,
        margin: 2,
        errorCorrectionLevel: "H",
        color: {
          dark: "#002447",
          light: "#FFFFFF",
        },
      })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [isOpen, signInUrl, qrScale]);

  // Activate Public Cellular 5G Tunnel
  const handleActivateCellularPathway = async () => {
    setIsTunnelLoading(true);
    setTunnelError(null);
    try {
      const res = await startPublicTunnel();
      if (res.ok && res.url) {
        setMobileOrigin(res.url);
        setNetworkMode("cellular");
      } else {
        setTunnelError(res.error || "Could not launch public tunnel. Use custom IP.");
      }
    } catch (err: any) {
      setTunnelError(err.message || "Failed to start public tunnel.");
    } finally {
      setIsTunnelLoading(false);
    }
  };

  // Switch back to Local Wi-Fi (LAN)
  const handleSwitchToLocalWifi = async () => {
    setIsTunnelLoading(true);
    setTunnelError(null);
    try {
      await stopPublicTunnel();
      const discovered = await discoverMobileOrigin();
      setMobileOrigin(discovered);
      setNetworkMode("lan");
    } finally {
      setIsTunnelLoading(false);
    }
  };

  const handleSaveCustomOrigin = () => {
    let clean = customOriginInput.trim();
    if (clean) {
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        clean = `http://${clean}`;
      }
      setCustomMobileOrigin(clean);
      setMobileOrigin(clean);
    }
    setIsEditingOrigin(false);
  };

  const handleResetOrigin = async () => {
    setCustomMobileOrigin("");
    const discovered = await discoverMobileOrigin();
    setMobileOrigin(discovered);
    setIsEditingOrigin(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className={`bg-white border-2 border-[#005DAA] rounded-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 text-center relative max-h-[94vh] overflow-y-auto transition-all ${
        qrScale === "giant" ? "max-w-3xl" : qrScale === "supersize" ? "max-w-2xl" : "max-w-lg"
      }`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm cursor-pointer transition z-10"
        >
          ✕
        </button>

        {/* Poster Header */}
        <div className="border-b border-[#B8D8F8] pb-3 space-y-1">
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl">🏢</span>
            <span className="text-xs font-mono font-bold tracking-widest text-[#005DAA] uppercase">
              CON EDISON · 4 IRVING PLACE · FLOOR 07
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-[#0F2537] uppercase">
            Official Access &amp; Sign-In QR Poster
          </h2>
          <p className="text-xs text-[#475569] font-medium">
            Scan this QR code with any smartphone camera to check in on Floor 07, receive your digital turnstile pass, and be accounted for immediately.
          </p>
        </div>

        {/* Super-Size Scale Control Bar */}
        <div className="bg-[#F0F6FC] p-2 rounded-xl border border-[#CBDCEE] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <span className="font-bold text-[#0F2537] flex items-center gap-1.5 text-[11px]">
            <span className="text-amber-500">📐</span>
            <span className="font-black">POSTER QR SIZE:</span>
          </span>
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-[#CBDCEE]">
            <button
              type="button"
              onClick={() => setQrScale("standard")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                qrScale === "standard" ? "bg-[#005DAA] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setQrScale("large")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                qrScale === "large" ? "bg-[#005DAA] text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Large
            </button>
            <button
              type="button"
              onClick={() => setQrScale("supersize")}
              className={`px-2.5 py-0.5 rounded text-[11px] font-black transition cursor-pointer flex items-center gap-1 ${
                qrScale === "supersize" ? "bg-amber-600 text-white shadow-xs ring-1 ring-amber-400" : "text-amber-800 bg-amber-50 hover:bg-amber-100"
              }`}
            >
              <span>⚡ Super-Size</span>
            </button>
            <button
              type="button"
              onClick={() => setQrScale("giant")}
              className={`px-2.5 py-0.5 rounded text-[11px] font-black transition cursor-pointer flex items-center gap-1 ${
                qrScale === "giant" ? "bg-[#002447] text-white shadow-xs ring-1 ring-amber-400" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span>🏢 Giant Wall</span>
            </button>
          </div>
        </div>

        {/* Dual Network Pathway Selector */}
        <div className="bg-[#F0F6FC] p-1.5 rounded-xl border border-[#B8D8F8] grid grid-cols-2 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={handleSwitchToLocalWifi}
            disabled={isTunnelLoading}
            className={`py-2 px-2.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              networkMode === "lan"
                ? "bg-[#005DAA] text-white shadow-xs font-black"
                : "text-slate-600 hover:text-slate-900 hover:bg-white"
            }`}
          >
            <span>🏢</span>
            <span>Local Building Wi-Fi</span>
          </button>

          <button
            type="button"
            onClick={handleActivateCellularPathway}
            disabled={isTunnelLoading}
            className={`py-2 px-2.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              networkMode === "cellular"
                ? "bg-emerald-600 text-white shadow-xs font-black"
                : "text-slate-600 hover:text-slate-900 hover:bg-white"
            }`}
          >
            <span>🌐</span>
            <span>{isTunnelLoading ? "Connecting..." : "Cellular 5G Pathway"}</span>
          </button>
        </div>

        {tunnelError && (
          <div className="p-2 bg-red-100 border border-red-300 text-red-900 rounded-lg text-xs font-bold">
            ⚠️ {tunnelError}
          </div>
        )}

        {/* Large Scannable Super-Size QR Code Container */}
        <div className="relative bg-white p-5 sm:p-7 rounded-3xl border-3 border-[#002447] shadow-xl inline-block w-full transition-all">
          {/* Long-Distance Targeting Reticles */}
          <div className="absolute top-2 left-2 w-6 h-6 border-t-3 border-l-3 border-amber-500 rounded-tl-md pointer-events-none" />
          <div className="absolute top-2 right-2 w-6 h-6 border-t-3 border-r-3 border-amber-500 rounded-tr-md pointer-events-none" />
          <div className="absolute bottom-2 left-2 w-6 h-6 border-b-3 border-l-3 border-amber-500 rounded-bl-md pointer-events-none" />
          <div className="absolute bottom-2 right-2 w-6 h-6 border-b-3 border-r-3 border-amber-500 rounded-br-md pointer-events-none" />

          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan to Sign In on Floor 07"
              className={`mx-auto object-contain transition-all duration-200 rounded-xl ${
                qrScale === "giant"
                  ? "w-80 h-80 sm:w-[480px] sm:h-[480px] md:w-[540px] md:h-[540px]"
                  : qrScale === "supersize"
                  ? "w-72 h-72 sm:w-[400px] sm:h-[400px]"
                  : qrScale === "large"
                  ? "w-64 h-64 sm:w-80 sm:h-80"
                  : "w-52 h-52 sm:w-60 sm:h-60"
              }`}
              style={{ maxWidth: "85vw", maxHeight: "55vh" }}
            />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center text-xs text-slate-400 font-mono mx-auto">
              Generating High-Resolution QR...
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="px-3 py-1 rounded-md text-[11px] font-mono font-black bg-amber-50 text-amber-900 border border-amber-300">
              🎯 DISTANCE SCANNABLE UP TO 20 FEET
            </span>
            <span className={`text-[11px] font-mono font-bold px-3 py-1 rounded-md border ${
              networkMode === "cellular"
                ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                : "bg-[#EBF5FB] text-[#003B70] border-[#B8D8F8]"
            }`}>
              {networkMode === "cellular"
                ? "🌐 CELLULAR 5G SCANNABLE (ANY NETWORK)"
                : "🏢 SCAN ON BUILDING WI-FI"}
            </span>
          </div>
        </div>

        {/* Reachable Destination HUD */}
        <div className="bg-[#F0F6FC] p-3 rounded-xl border border-[#CBDCEE] text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-[#005DAA] text-[11px]">
              <span>{networkMode === "cellular" ? "🌐" : "📡"}</span>
              <span>
                {networkMode === "cellular" ? "Public 5G Pathway URL:" : "Local LAN Wi-Fi URL:"}
              </span>
            </div>
            {!isEditingOrigin ? (
              <button
                type="button"
                onClick={() => {
                  setCustomOriginInput(mobileOrigin);
                  setIsEditingOrigin(true);
                }}
                className="text-[10px] font-bold text-sky-700 hover:text-sky-900 underline cursor-pointer"
              >
                Change IP / URL
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResetOrigin}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-700 underline cursor-pointer"
              >
                Reset Auto
              </button>
            )}
          </div>

          {!isEditingOrigin ? (
            <div className="font-mono text-[11px] text-[#003B70] bg-white p-2 rounded-lg border border-[#B8D8F8] break-all select-all font-semibold">
              {signInUrl}
            </div>
          ) : (
            <div className="flex gap-1.5">
              <input
                type="text"
                value={customOriginInput}
                onChange={(e) => setCustomOriginInput(e.target.value)}
                placeholder="e.g. http://192.168.1.182:3000 or https://xyz.tunnel"
                className="flex-1 px-2.5 py-1 text-[11px] font-mono border border-sky-400 rounded-lg bg-white outline-none"
              />
              <button
                type="button"
                onClick={handleSaveCustomOrigin}
                className="px-3 py-1 bg-[#005DAA] text-white rounded-lg font-bold text-[11px] cursor-pointer"
              >
                Apply
              </button>
            </div>
          )}

          <p className="text-[10px] text-slate-500 text-left">
            {networkMode === "cellular"
              ? "✓ Connects phones on AT&T, Verizon, T-Mobile, or any guest Wi-Fi from outside."
              : "✓ Zero-cost & works offline during power outages when phones are on building Wi-Fi."}
          </p>
        </div>

        {/* Direct Link Action */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenSignInForm();
          }}
          className="w-full bg-[#005DAA] hover:bg-[#004A88] text-white font-black text-xs py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
        >
          <span>📱</span>
          <span>OPEN SIGN-IN &amp; ACCOUNTED PORTAL ON THIS DEVICE</span>
        </button>

        {/* Instructions & Matching Flow */}
        <div className="grid grid-cols-3 gap-2 text-left bg-[#F0F6FC] p-3 rounded-xl border border-[#B8D8F8] text-[11px]">
          <div className="space-y-0.5">
            <span className="font-black text-[#005DAA]">1. SCAN QR</span>
            <p className="text-slate-600">Scan with any smartphone camera</p>
          </div>
          <div className="space-y-0.5">
            <span className="font-black text-[#005DAA]">2. AUTO-VERIFY</span>
            <p className="text-slate-600">Staff auto-accounted; guests quick form</p>
          </div>
          <div className="space-y-0.5">
            <span className="font-black text-[#005DAA]">3. LIVE PASS</span>
            <p className="text-slate-600">Pass generated &amp; Floor 07 map updated</p>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="flex items-center justify-center gap-4 text-xs font-bold text-[#475569] pt-1 border-t border-[#B8D8F8]/60">
          <span>
            Total Registered: <strong className="text-[#005DAA]">{occupantsCount}</strong>
          </span>
          <span>·</span>
          <span>
            Currently In Building: <strong className="text-emerald-700">{inBuildingCount}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
