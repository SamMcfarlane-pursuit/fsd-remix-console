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
import { Wifi, Globe, Building2, QrCode, ExternalLink, RotateCw, X, ArrowRight, CheckCircle2 } from "lucide-react";

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
      // Check existing tunnel status, rejecting any deprecated loca.lt domains
      getTunnelStatus().then((status) => {
        if (status.active && status.url && status.url.includes("trycloudflare.com")) {
          setNetworkMode("cellular");
          setMobileOrigin(status.url);
        } else {
          discoverMobileOrigin().then((origin) => {
            if (origin && !origin.includes("loca.lt")) {
              setMobileOrigin(origin);
            }
          });
        }
      });
    }

    const handleOriginChange = () => {
      const orig = getMobileNetworkOrigin();
      if (!orig.includes("loca.lt")) {
        setMobileOrigin(orig);
      }
    };
    window.addEventListener("muster-origin-changed", handleOriginChange);
    return () => {
      window.removeEventListener("muster-origin-changed", handleOriginChange);
    };
  }, [isOpen]);

  const signInUrl = `${mobileOrigin}/?scan=1&mode=signin`;

  useEffect(() => {
    if (isOpen) {
      const qrRes = qrScale === "giant" ? 850 : qrScale === "supersize" ? 650 : qrScale === "large" ? 480 : 360;
      QRCode.toDataURL(signInUrl, {
        width: qrRes,
        margin: 3,
        errorCorrectionLevel: "M",
        color: {
          dark: "#001E3D",
          light: "#FFFFFF",
        },
      })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [isOpen, signInUrl, qrScale]);

  // Activate Public Cellular 5G Tunnel (Pure Cloudflare with Zero Interstitials)
  const handleActivateCellularPathway = async (force: boolean = false) => {
    setIsTunnelLoading(true);
    setTunnelError(null);
    try {
      const res = await startPublicTunnel(force);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn select-none">
      <div
        className={`bg-white border border-slate-200 rounded-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 text-center relative max-h-[94vh] overflow-y-auto transition-all ${
          qrScale === "giant" ? "max-w-3xl" : qrScale === "supersize" ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg w-8 h-8 flex items-center justify-center font-bold text-sm cursor-pointer transition z-10"
          title="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Poster Header */}
        <div className="border-b border-slate-100 pb-3 space-y-1">
          <div className="flex items-center justify-center gap-2">
            <Building2 className="w-4 h-4 text-[#005DAA]" />
            <span className="text-[11px] font-mono font-bold tracking-widest text-[#005DAA] uppercase">
              CON EDISON · 4 IRVING PLACE · FLOOR 07
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-extrabold text-[#0F2537]">
            Official Access &amp; Sign-In QR Poster
          </h2>
          <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
            Scan this QR code with any smartphone camera to check in on Floor 07 and receive an instant digital pass.
          </p>
        </div>

        {/* Super-Size Scale Control Bar */}
        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <span className="font-bold text-slate-700 flex items-center gap-1.5 text-[11px]">
            <QrCode className="w-3.5 h-3.5 text-[#005DAA]" />
            <span>POSTER QR SIZE:</span>
          </span>
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setQrScale("standard")}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                qrScale === "standard" ? "bg-[#005DAA] text-white shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setQrScale("large")}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                qrScale === "large" ? "bg-[#005DAA] text-white shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Large
            </button>
            <button
              type="button"
              onClick={() => setQrScale("supersize")}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                qrScale === "supersize"
                  ? "bg-[#005DAA] text-white shadow-xs font-bold ring-1 ring-[#005DAA]"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span>Super-Size</span>
            </button>
            <button
              type="button"
              onClick={() => setQrScale("giant")}
              className={`px-2.5 py-0.5 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                qrScale === "giant"
                  ? "bg-[#0F2537] text-white shadow-xs font-bold ring-1 ring-slate-800"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span>Giant Wall</span>
            </button>
          </div>
        </div>

        {/* Dual Network Pathway Selector */}
        <div className="bg-slate-50 p-1 rounded-xl border border-slate-200 grid grid-cols-2 gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={handleSwitchToLocalWifi}
            disabled={isTunnelLoading}
            className={`py-2 px-2.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              networkMode === "lan"
                ? "bg-[#005DAA] text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white"
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Local Building Wi-Fi</span>
          </button>

          <button
            type="button"
            onClick={() => handleActivateCellularPathway(false)}
            disabled={isTunnelLoading}
            className={`py-2 px-2.5 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              networkMode === "cellular"
                ? "bg-emerald-600 text-white shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900 hover:bg-white"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{isTunnelLoading ? "Connecting..." : "Cellular 5G Pathway"}</span>
          </button>
        </div>

        {networkMode === "cellular" && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-xs text-emerald-950 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold text-[11px]">
                Zero-Interstitial Gateway Active (Universal 5G Scan Verified)
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleActivateCellularPathway(true)}
              disabled={isTunnelLoading}
              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1 shrink-0"
              title="Force rotate to a fresh trycloudflare.com URL"
            >
              <RotateCw className="w-3 h-3" />
              <span>{isTunnelLoading ? "Rotating..." : "Rotate URL"}</span>
            </button>
          </div>
        )}

        {tunnelError && (
          <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-medium">
            ⚠️ {tunnelError}
          </div>
        )}

        {/* Large Scannable Super-Size QR Code Container */}
        <div className="relative bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-inner inline-block w-full transition-all">
          {/* Subtle Crop Marks */}
          <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-sky-400 rounded-tl-sm pointer-events-none" />
          <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-sky-400 rounded-tr-sm pointer-events-none" />
          <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-sky-400 rounded-bl-sm pointer-events-none" />
          <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-sky-400 rounded-br-sm pointer-events-none" />

          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan to Sign In on Floor 07"
              className={`mx-auto object-contain transition-all duration-200 rounded-lg ${
                qrScale === "giant"
                  ? "w-72 h-72 sm:w-[440px] sm:h-[440px]"
                  : qrScale === "supersize"
                  ? "w-64 h-64 sm:w-80 sm:h-80"
                  : qrScale === "large"
                  ? "w-56 h-56 sm:w-72 sm:h-72"
                  : "w-48 h-48 sm:w-56 sm:h-56"
              }`}
              style={{ maxWidth: "80vw", maxHeight: "50vh" }}
            />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400 font-mono mx-auto">
              Generating High-Resolution QR...
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-200">
              🎯 SCANNABLE UP TO 20 FT
            </span>
            <span
              className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-md border ${
                networkMode === "cellular"
                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                  : "bg-sky-50 text-sky-900 border-sky-200"
              }`}
            >
              {networkMode === "cellular"
                ? "🌐 CELLULAR 5G SCANNABLE"
                : "🏢 BUILDING WI-FI"}
            </span>
          </div>
        </div>

        {/* Reachable Destination HUD */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-slate-700 text-[11px]">
              {networkMode === "cellular" ? <Globe className="w-3.5 h-3.5 text-emerald-600" /> : <Wifi className="w-3.5 h-3.5 text-[#005DAA]" />}
              <span>{networkMode === "cellular" ? "Public 5G Pathway URL:" : "Local Wi-Fi URL:"}</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={signInUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>Test Link</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-slate-300">|</span>
              {!isEditingOrigin ? (
                <button
                  type="button"
                  onClick={() => {
                    setCustomOriginInput(mobileOrigin);
                    setIsEditingOrigin(true);
                  }}
                  className="text-[11px] font-bold text-sky-700 hover:text-sky-900 underline cursor-pointer"
                >
                  Edit IP
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResetOrigin}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-700 underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {!isEditingOrigin ? (
            <div className="font-mono text-[11px] text-slate-800 bg-white p-2 rounded-lg border border-slate-200 break-all select-all font-medium">
              {signInUrl}
            </div>
          ) : (
            <div className="flex gap-1.5">
              <input
                type="text"
                value={customOriginInput}
                onChange={(e) => setCustomOriginInput(e.target.value)}
                placeholder="e.g. http://192.168.1.182:3000 or https://xyz.tunnel"
                className="flex-1 px-2.5 py-1 text-[11px] font-mono border border-sky-400 rounded-lg bg-white outline-hidden"
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
        </div>

        {/* Direct Link Action */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenSignInForm();
          }}
          className="w-full bg-[#005DAA] hover:bg-[#004A88] text-white font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
        >
          <span>Open Sign-In Portal on This Device</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        {/* 3-Step Guide */}
        <div className="grid grid-cols-3 gap-2 text-left bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px]">
          <div>
            <span className="font-bold text-[#005DAA] block">1. Scan QR</span>
            <p className="text-slate-500 text-[10px]">Open camera &amp; tap link</p>
          </div>
          <div>
            <span className="font-bold text-[#005DAA] block">2. Auto-Verify</span>
            <p className="text-slate-500 text-[10px]">Badge or quick guest form</p>
          </div>
          <div>
            <span className="font-bold text-[#005DAA] block">3. Live Pass</span>
            <p className="text-slate-500 text-[10px]">Turnstile pass recorded</p>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="flex items-center justify-center gap-3 text-xs font-semibold text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Total Rostered: <strong className="text-slate-800">{occupantsCount}</strong>
          </span>
          <span>·</span>
          <span>
            In Building: <strong className="text-emerald-700 font-bold">{inBuildingCount}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
