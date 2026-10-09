import React, { useState, useEffect } from "react";
import {
  Fingerprint,
  Building2,
  Smartphone,
  Laptop,
  ArrowRight,
  RefreshCw,
  User,
  Lock,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  ShieldAlert,
  KeyRound,
  ExternalLink,
} from "lucide-react";
import { AuthUser, QuadrantId } from "../types";
import { SignInQRPosterModal } from "./SignInQRPosterModal";
import { authenticateWithBiometrics } from "../lib/biometrics";
import { createOfflineOccupant, queueOfflineAction } from "../lib/offlineQueue";
import QRCode from "qrcode";
import { discoverMobileOrigin, getMobileNetworkOrigin } from "../lib/qr";

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
  onEnterOccupantApp: () => void;
  onOpenQRPoster?: () => void;
}

type UserCategory = "qr" | "worker" | "visitor" | "admin";

export default function LoginScreen({
  onLoginSuccess,
  onEnterOccupantApp,
  onOpenQRPoster,
}: LoginScreenProps) {
  const [activeCategory, setActiveCategory] = useState<UserCategory>(() => {
    try {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("mode") === "signin" || params.get("scan") === "1") {
          return "worker";
        }
      }
    } catch {}
    return "qr";
  });

  // Worker inputs
  const [workerName, setWorkerName] = useState<string>("Robert Petillo");
  const [workerPhone, setWorkerPhone] = useState<string>("(212) 555-0195");
  const [workerQuad, setWorkerQuad] = useState<QuadrantId>("NW");
  const [workerAction, setWorkerAction] = useState<"enter" | "leave" | "muster">("enter");

  // Visitor inputs
  const [visitorName, setVisitorName] = useState<string>("");
  const [visitorPhone, setVisitorPhone] = useState<string>("");
  const [visitorHost, setVisitorHost] = useState<string>("Robert Petillo (Staff Lead)");
  const [visitorQuad, setVisitorQuad] = useState<QuadrantId>("SE");

  // Admin inputs
  const [adminRole, setAdminRole] = useState<"fsd_director" | "warden" | "security">("fsd_director");
  const [adminPin, setAdminPin] = useState<string>("7007");

  // State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    try {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("mode") === "signin" || params.get("scan") === "1") return true;
        return window.innerWidth < 768 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      }
    } catch {}
    return false;
  });
  const [loginQrDataUrl, setLoginQrDataUrl] = useState<string>("");
  const [activeNetworkOrigin, setActiveNetworkOrigin] = useState<string>(getMobileNetworkOrigin());

  useEffect(() => {
    discoverMobileOrigin().then((origin) => {
      setActiveNetworkOrigin(origin);
    });

    const handleOriginChange = () => {
      setActiveNetworkOrigin(getMobileNetworkOrigin());
    };
    window.addEventListener("muster-origin-changed", handleOriginChange);
    return () => {
      window.removeEventListener("muster-origin-changed", handleOriginChange);
    };
  }, []);

  useEffect(() => {
    const targetUrl = `${activeNetworkOrigin}/?mode=signin&scan=1`;
    QRCode.toDataURL(targetUrl, {
      width: 600,
      margin: 2,
      errorCorrectionLevel: "H",
      color: {
        dark: "#002447",
        light: "#FFFFFF",
      },
    })
      .then(setLoginQrDataUrl)
      .catch(console.error);
  }, [activeNetworkOrigin]);

  useEffect(() => {
    const userAgent = navigator.userAgent || "";
    const isMobileDevice = /android|iphone|ipad|ipod|mobile/i.test(userAgent) || window.innerWidth < 768;
    setIsMobile(isMobileDevice);
  }, []);

  // Update default PIN when admin role changes
  useEffect(() => {
    if (adminRole === "fsd_director") setAdminPin("7007");
    else if (adminRole === "warden") setAdminPin("2026");
    else setAdminPin("1901");
  }, [adminRole]);

  // 1. Worker Direct Sign-In
  const handleWorkerSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!workerName.trim()) {
      setErrorMsg("Please enter your Name or Badge ID");
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/occupant/sign-in-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workerName.trim(),
          phone: workerPhone.trim(),
          action: workerAction,
          role: "Employee",
          company: "Con Edison",
          quadrant: workerQuad,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        try {
          localStorage.setItem("muster_registered_occupant_id", data.occupant.id);
          localStorage.setItem("muster_occupant_id", data.occupant.id);
          localStorage.setItem("muster_registered_name", data.occupant.name);
          localStorage.setItem("muster_registered_phone", workerPhone.trim());
          localStorage.setItem("muster_registered_quad", workerQuad);
          localStorage.setItem("muster_registered_role", "Employee");
          localStorage.setItem("muster_registered_company", "Con Edison");
          localStorage.setItem("muster_registered_occupant_json", JSON.stringify(data.occupant));
        } catch {}
        setSuccessMsg(`Welcome ${data.occupant.name}! Recorded as PRESENT on Floor 07.`);
        setTimeout(() => {
          onEnterOccupantApp();
        }, 600);
      } else {
        onEnterOccupantApp();
      }
    } catch {
      // Offline fallback: create offline occupant and queue action
      const offlineOccupant = createOfflineOccupant({
        name: workerName.trim(),
        phone: workerPhone.trim(),
        quadrant: workerQuad,
        role: "Employee",
        company: "Con Edison",
      });
      queueOfflineAction("occupant-sign-in", {
        name: workerName.trim(),
        phone: workerPhone.trim(),
        action: workerAction,
        role: "Employee",
        company: "Con Edison",
        quadrant: workerQuad,
      });
      try {
        localStorage.setItem("muster_registered_occupant_id", offlineOccupant.id);
        localStorage.setItem("muster_occupant_id", offlineOccupant.id);
        localStorage.setItem("muster_registered_name", offlineOccupant.name);
        localStorage.setItem("muster_registered_phone", workerPhone.trim());
        localStorage.setItem("muster_registered_quad", workerQuad);
        localStorage.setItem("muster_registered_role", "Employee");
        localStorage.setItem("muster_registered_company", "Con Edison");
        localStorage.setItem("muster_registered_occupant_json", JSON.stringify(offlineOccupant));
      } catch {}
      setSuccessMsg(`🟠 Offline Mode: Pass ${offlineOccupant.id} created locally for ${offlineOccupant.name}. Queued for auto-sync.`);
      setTimeout(() => {
        onEnterOccupantApp();
      }, 700);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Visitor Pass Issuance
  const handleVisitorSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitorName.trim()) {
      setErrorMsg("Please enter your Full Name");
      return;
    }
    if (!visitorPhone.trim()) {
      setErrorMsg("Please enter your Mobile Phone for emergency alerts");
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/occupant/sign-in-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: visitorName.trim(),
          phone: visitorPhone.trim(),
          action: "enter",
          role: "Visitor",
          company: `Guest of ${visitorHost}`,
          quadrant: visitorQuad,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        try {
          localStorage.setItem("muster_registered_occupant_id", data.occupant.id);
          localStorage.setItem("muster_occupant_id", data.occupant.id);
          localStorage.setItem("muster_registered_name", data.occupant.name);
          localStorage.setItem("muster_registered_phone", visitorPhone.trim());
          localStorage.setItem("muster_registered_quad", visitorQuad);
          localStorage.setItem("muster_registered_role", "Visitor");
          localStorage.setItem("muster_registered_company", `Guest of ${visitorHost}`);
          localStorage.setItem("muster_registered_occupant_json", JSON.stringify(data.occupant));
        } catch {}
        setSuccessMsg(`Visitor Pass ${data.occupant.id} Issued for ${data.occupant.name}!`);
        setTimeout(() => {
          onEnterOccupantApp();
        }, 600);
      } else {
        onEnterOccupantApp();
      }
    } catch {
      const offlineVisitor = createOfflineOccupant({
        name: visitorName.trim(),
        phone: visitorPhone.trim(),
        quadrant: visitorQuad,
        role: "Visitor",
        company: `Guest of ${visitorHost}`,
      });
      queueOfflineAction("visitor-register", {
        name: visitorName.trim(),
        phone: visitorPhone.trim(),
        action: "enter",
        role: "Visitor",
        company: `Guest of ${visitorHost}`,
        quadrant: visitorQuad,
      });
      try {
        localStorage.setItem("muster_registered_occupant_id", offlineVisitor.id);
        localStorage.setItem("muster_occupant_id", offlineVisitor.id);
        localStorage.setItem("muster_registered_name", offlineVisitor.name);
        localStorage.setItem("muster_registered_phone", visitorPhone.trim());
        localStorage.setItem("muster_registered_quad", visitorQuad);
        localStorage.setItem("muster_registered_role", "Visitor");
        localStorage.setItem("muster_registered_company", `Guest of ${visitorHost}`);
        localStorage.setItem("muster_registered_occupant_json", JSON.stringify(offlineVisitor));
      } catch {}
      setSuccessMsg(`🟠 Offline Visitor Pass ${offlineVisitor.id} Created! Welcome to Floor 07. Queued for auto-sync.`);
      setTimeout(() => {
        onEnterOccupantApp();
      }, 700);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Admin Commander Access
  const handleAdminSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    const validPins: Record<string, string> = {
      fsd_director: "7007",
      warden: "2026",
      security: "1901",
    };

    const targetPin = validPins[adminRole];
    if (adminPin.trim() !== targetPin && adminPin.trim() !== "demo") {
      setErrorMsg(`Invalid PIN for this role. Default is ${targetPin}.`);
      setIsLoading(false);
      return;
    }

    try {
      const adminProfiles: Record<string, AuthUser> = {
        fsd_director: {
          id: "fsd.director",
          userId: "fsd.director",
          name: "Sarah Jenkins",
          role: "fsd_director",
          roleLabel: "Fire Safety Director",
          caps: 8,
          capsList: ["incident:control", "attendance:view", "alarm:trigger", "broadcast:send"],
          token: `AUTH-ADMIN-${Date.now()}`,
          authMethod: "PIN_CREDENTIAL",
        },
        warden: {
          id: "warden.nw",
          userId: "warden.nw",
          name: "Michael Chen",
          role: "warden",
          roleLabel: "Floor Warden (Sector NW)",
          caps: 4,
          capsList: ["attendance:scan", "attendance:view"],
          quadrant: "NW",
          token: `AUTH-WARDEN-${Date.now()}`,
          authMethod: "PIN_CREDENTIAL",
        },
        security: {
          id: "kiosk.l7",
          userId: "kiosk.l7",
          name: "Turnstile Security Desk",
          role: "kiosk",
          roleLabel: "Front Desk Security",
          caps: 2,
          capsList: ["attendance:scan"],
          token: `AUTH-SEC-${Date.now()}`,
          authMethod: "PIN_CREDENTIAL",
        },
      };

      setSuccessMsg(`Welcome Commander! Unlocking 5-Step Emergency Deck...`);
      setTimeout(() => {
        onLoginSuccess(adminProfiles[adminRole]);
      }, 400);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Biometric Touch ID Quick Sign-In
  const handleBiometricClick = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const bioRes = await authenticateWithBiometrics(
        activeCategory === "admin" ? "FSD Commander" : workerName || "Floor 07 Personnel"
      );
      if (bioRes.success) {
        if (activeCategory === "admin") {
          handleAdminSignIn();
        } else {
          handleWorkerSignIn();
        }
      }
    } catch {
      setErrorMsg("Biometric verification canceled.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070D18] flex flex-col items-center justify-center p-3 sm:p-6 selection:bg-[#FF6B00] selection:text-black">
      {/* Ambient Grid Background */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#1E3A60_1px,transparent_1px)] [background-size:24px_24px]" />

      <div className="w-full max-w-md sm:max-w-lg relative z-10 my-auto py-2 space-y-4">
        {/* Header Branding */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#1E3A60]/60 border border-[#1E3A60] rounded-full text-[10px] font-mono font-bold text-[#38BDF8] uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5" />
            <span>4 IRVING PLACE · FLOOR 07</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-wider uppercase">
            MUSTERCOMMAND
          </h1>
          <p className="text-xs font-mono text-[#829AB8] uppercase tracking-widest">
            Floor 07 Life-Safety &amp; Ingress Portal
          </p>
        </div>

        {/* Intuitive Intent Selector: Commander/Admin button is strictly hidden on mobile phones */}
        <div className={`bg-[#0B172B] p-1.5 rounded-2xl border border-[#1E3A60] grid ${isMobile ? "grid-cols-2" : "grid-cols-4"} gap-1 shadow-xl text-xs font-bold`}>
          {!isMobile && (
            <button
              type="button"
              onClick={() => {
                setActiveCategory("qr");
                setErrorMsg(null);
              }}
              className={`py-2 px-1.5 rounded-xl transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                activeCategory === "qr"
                  ? "bg-[#005DAA] text-white shadow-md font-black"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <QrCode className="w-4 h-4" />
              <span className="text-[11px]">Phone QR</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setActiveCategory("worker");
              setErrorMsg(null);
            }}
            className={`py-2 px-1.5 rounded-xl transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
              activeCategory === "worker"
                ? "bg-[#005DAA] text-white shadow-md font-black"
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <span className="text-sm">🏢</span>
            <span className="text-[11px]">Worker</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveCategory("visitor");
              setErrorMsg(null);
            }}
            className={`py-2 px-1.5 rounded-xl transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
              activeCategory === "visitor"
                ? "bg-amber-600 text-white shadow-md font-black"
                : "text-slate-400 hover:text-white hover:bg-slate-800/40"
            }`}
          >
            <span className="text-sm">🎟️</span>
            <span className="text-[11px]">Visitor</span>
          </button>

          {!isMobile && (
            <button
              type="button"
              onClick={() => {
                setActiveCategory("admin");
                setErrorMsg(null);
              }}
              className={`py-2 px-1.5 rounded-xl transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                activeCategory === "admin"
                  ? "bg-red-600 text-white shadow-md font-black"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <span className="text-sm">🛡️</span>
              <span className="text-[11px]">Admin</span>
            </button>
          )}
        </div>

        {/* Feedback Toasts */}
        {errorMsg && (
          <div className="p-3 bg-red-950/80 border border-red-500/60 rounded-xl text-red-200 font-medium flex items-center gap-2 text-xs animate-fadeIn">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-500/60 rounded-xl text-emerald-200 font-bold flex items-center gap-2 text-xs animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODE 1: PROMINENT PHONE QR INGRESS (CLEAN & FOCUSED)      */}
        {/* ========================================================= */}
        {activeCategory === "qr" && (
          <div className="bg-[#0B172B] border-2 border-[#005DAA] rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden text-center space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#1E3A60] pb-3">
              <div className="text-left flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <div>
                  <span className="text-[10px] font-mono font-black text-[#38BDF8] uppercase tracking-wider block">
                    FAST SMARTPHONE INGRESS
                  </span>
                  <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                    Scan QR with Phone Camera
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenQRPoster) onOpenQRPoster();
                    else setIsQrModalOpen(true);
                  }}
                  className="text-[10px] font-mono font-bold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 px-2.5 py-1.5 rounded-lg border border-amber-400/40 transition cursor-pointer flex items-center gap-1 shrink-0"
                  title="Super-Size QR for distance scanning"
                >
                  <span>⚡ Super-Size</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenQRPoster) onOpenQRPoster();
                    else setIsQrModalOpen(true);
                  }}
                  className="text-[10px] font-mono font-bold text-[#38BDF8] hover:text-white bg-[#1E3A60]/60 hover:bg-[#1E3A60] px-2.5 py-1.5 rounded-lg border border-[#38BDF8]/30 transition cursor-pointer flex items-center gap-1 shrink-0"
                  title="Open Printable Official Poster"
                >
                  <span>Full Poster</span>
                  <span>↗</span>
                </button>
              </div>
            </div>

            {/* High-Contrast Robust QR Code with Distance Support */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 py-2">
              <div
                onClick={() => {
                  if (onOpenQRPoster) onOpenQRPoster();
                  else setIsQrModalOpen(true);
                }}
                className="p-3.5 bg-white rounded-2xl shadow-2xl border-3 border-[#38BDF8]/70 shrink-0 cursor-zoom-in group relative hover:scale-105 transition-all"
                title="Click to Super-Size QR for distance scanning"
              >
                {loginQrDataUrl ? (
                  <img
                    src={loginQrDataUrl}
                    alt="Scan QR Code to Sign In"
                    className="w-52 h-52 sm:w-60 sm:h-60 object-contain block mx-auto rounded-lg"
                  />
                ) : (
                  <div className="w-52 h-52 sm:w-60 sm:h-60 flex items-center justify-center text-slate-400 text-xs font-mono">
                    Generating High-Res QR...
                  </div>
                )}
                <div className="absolute inset-0 bg-[#005DAA]/10 opacity-0 group-hover:opacity-100 rounded-2xl transition flex items-center justify-center">
                  <span className="bg-black/85 text-white text-[10px] font-mono font-black px-2.5 py-1 rounded-full shadow-lg">
                    🔍 Click to Super-Size
                  </span>
                </div>
              </div>

              <div className="text-left space-y-3 max-w-xs">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>
                      {activeNetworkOrigin.includes(".trycloudflare.com")
                        ? "🌐 5G CELLULAR SCANNABLE"
                        : "🏢 BUILDING WI-FI READY"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 font-semibold leading-relaxed">
                    Point your iPhone or Android camera at the QR code to check in on Floor 07.
                  </p>
                </div>

                <div className="space-y-1 text-[11px] text-[#829AB8] bg-[#070D18] p-2.5 rounded-xl border border-[#1E3A60]">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <span>✓</span>
                    <span>Normal staff: Auto-accounted instantly</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sky-400 font-bold">
                    <span>✓</span>
                    <span>Visitors: Quick 10-second intake</span>
                  </div>
                </div>

                <div
                  onClick={onEnterOccupantApp}
                  title="Click to open handheld portal URL directly"
                  className="text-[10px] font-mono text-sky-400 hover:text-white truncate bg-[#070D18] hover:bg-[#0E1D33] p-1.5 rounded-lg border border-[#1E3A60] cursor-pointer transition flex items-center justify-between group"
                >
                  <span className="truncate">{activeNetworkOrigin}/?mode=signin&scan=1</span>
                  <span className="text-[9px] font-bold bg-[#1E3A60] px-1.5 py-0.5 rounded text-sky-300 shrink-0 group-hover:bg-[#005DAA]">Open ↗</span>
                </div>

                <button
                  type="button"
                  onClick={onEnterOccupantApp}
                  className="w-full py-2.5 px-3 bg-[#005DAA] hover:bg-[#004A88] text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                  title="Open Handheld Occupant Portal directly"
                >
                  <span>📱</span>
                  <span>Open Handheld Portal On This Device</span>
                </button>
              </div>
            </div>

            {/* Quick Switch Prompt */}
            <div className="pt-2 border-t border-[#1E3A60] flex items-center justify-between text-xs text-slate-400">
              <span>Signing in without a phone?</span>
              <button
                type="button"
                onClick={() => setActiveCategory("worker")}
                className="text-[#38BDF8] hover:underline font-bold cursor-pointer"
              >
                Use Terminal Sign-In →
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODE 2: WORKER TERMINAL INGRESS (TOUCH ID + NAME SEARCH)  */}
        {/* ========================================================= */}
        {activeCategory === "worker" && (
          <div className="bg-[#0B172B] border border-[#1E3A60] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 text-white text-xs animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#1E3A60] pb-3">
              <div>
                <span className="text-[10px] font-mono text-[#38BDF8] font-bold uppercase tracking-wider block">
                  CON EDISON EMPLOYEE PORTAL
                </span>
                <h2 className="text-base font-black text-white uppercase">
                  Staff Ingress &amp; Attendance
                </h2>
              </div>
              <span className="text-[10px] font-mono bg-[#1E3A60] text-slate-300 px-2 py-0.5 rounded">
                195 Expected
              </span>
            </div>

            {/* 1-Tap Touch ID Fingerprint Sensor */}
            <button
              type="button"
              onClick={handleBiometricClick}
              disabled={isLoading}
              className="w-full bg-[#152744] hover:bg-[#1E3A60] border-2 border-[#005DAA] text-white p-3.5 rounded-xl transition cursor-pointer flex items-center justify-between shadow-sm group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#005DAA] flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-xs text-white">1-Tap Fingerprint / Touch ID</div>
                  <div className="text-[11px] text-slate-400">Instant hardware biometric verification</div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-sky-400 group-hover:translate-x-0.5 transition" />
            </button>

            {/* Manual Form */}
            <form onSubmit={handleWorkerSignIn} className="space-y-3.5 pt-1">
              <div>
                <label className="text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase block mb-1">
                  FULL NAME OR BADGE ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={workerName}
                    onChange={(e) => setWorkerName(e.target.value)}
                    placeholder="e.g. Robert Petillo or OCC-101"
                    required
                    className="w-full bg-[#060E1C] border border-[#1E3A60] rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-500 font-medium focus:border-[#005DAA] outline-none"
                  />
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase block mb-1">
                  FLOOR 07 WORK SECTOR
                </label>
                <div className="grid grid-cols-4 gap-1.5 font-bold text-xs">
                  {(["NW", "NE", "SW", "SE"] as QuadrantId[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setWorkerQuad(q)}
                      className={`py-2 rounded-xl transition cursor-pointer font-mono ${
                        workerQuad === q
                          ? "bg-[#005DAA] text-white shadow-sm font-black"
                          : "bg-[#060E1C] border border-[#1E3A60] text-slate-400 hover:text-white"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase block mb-1">
                  INGRESS INTENT
                </label>
                <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setWorkerAction("enter")}
                    className={`py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1 ${
                      workerAction === "enter"
                        ? "bg-emerald-600 text-white shadow-sm font-black"
                        : "bg-[#060E1C] border border-[#1E3A60] text-slate-400"
                    }`}
                  >
                    <span>🟢</span>
                    <span>Enter Floor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkerAction("leave")}
                    className={`py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1 ${
                      workerAction === "leave"
                        ? "bg-amber-600 text-white shadow-sm font-black"
                        : "bg-[#060E1C] border border-[#1E3A60] text-slate-400"
                    }`}
                  >
                    <span>⚪</span>
                    <span>Badge Out</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkerAction("muster")}
                    className={`py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1 ${
                      workerAction === "muster"
                        ? "bg-sky-600 text-white shadow-sm font-black"
                        : "bg-[#060E1C] border border-[#1E3A60] text-slate-400"
                    }`}
                  >
                    <span>🚨</span>
                    <span>Muster Safe</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-[#005DAA] hover:bg-[#004884] text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>⚡</span>}
                <span>Direct Sign-In &amp; View Digital Pass</span>
              </button>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODE 3: VISITOR PASS INTAKE                               */}
        {/* ========================================================= */}
        {activeCategory === "visitor" && (
          <div className="bg-[#0B172B] border border-[#1E3A60] rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 text-white text-xs animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#1E3A60] pb-3">
              <div>
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block">
                  VISITOR / CONTRACTOR INTAKE
                </span>
                <h2 className="text-base font-black text-white uppercase">
                  Issue Digital Visitor Pass
                </h2>
              </div>
              <span className="text-xs">🎟️</span>
            </div>

            <form onSubmit={handleVisitorSignIn} className="space-y-3.5">
              <div>
                <label className="text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase block mb-1">
                  FULL NAME
                </label>
                <input
                  type="text"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="e.g. David Miller"
                  required
                  className="w-full bg-[#060E1C] border border-[#1E3A60] rounded-xl px-3 py-2.5 text-white placeholder-slate-500 font-medium focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase block mb-1">
                  MOBILE PHONE (FOR SMS ALERTS)
                </label>
                <input
                  type="tel"
                  value={visitorPhone}
                  onChange={(e) => setVisitorPhone(e.target.value)}
                  placeholder="(212) 555-0144"
                  required
                  className="w-full bg-[#060E1C] border border-[#1E3A60] rounded-xl px-3 py-2.5 text-white placeholder-slate-500 font-medium focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase block mb-1">
                  VISITING HOST / CONTACT
                </label>
                <input
                  type="text"
                  value={visitorHost}
                  onChange={(e) => setVisitorHost(e.target.value)}
                  placeholder="John Davis (Floor Warden)"
                  className="w-full bg-[#060E1C] border border-[#1E3A60] rounded-xl px-3 py-2.5 text-white placeholder-slate-500 font-medium focus:border-amber-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>🎟️</span>}
                <span>Issue Visitor Pass &amp; Record Presence</span>
              </button>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODE 4: ADMIN / COMMANDER CONSOLE ACCESS (FULLY WORKING)  */}
        {/* ========================================================= */}
        {activeCategory === "admin" && (
          <div className="bg-[#0B172B] border-2 border-red-900/60 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 text-white text-xs animate-fadeIn">
            <div className="flex items-center justify-between border-b border-[#1E3A60] pb-3">
              <div>
                <span className="text-[10px] font-mono text-red-400 font-bold uppercase tracking-wider block flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>LIFE-SAFETY INCIDENT COMMAND</span>
                </span>
                <h2 className="text-base font-black text-white uppercase">
                  Commander Console Access
                </h2>
              </div>
              <span className="text-xs bg-red-950 text-red-300 font-mono font-bold px-2 py-0.5 rounded border border-red-800">
                FSD Deck
              </span>
            </div>

            {/* Role Selection */}
            <div>
              <label className="text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase block mb-1.5">
                SELECT COMMAND ROLE
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setAdminRole("fsd_director")}
                  className={`py-2 rounded-xl border transition cursor-pointer flex flex-col items-center gap-0.5 ${
                    adminRole === "fsd_director"
                      ? "bg-red-600 text-white border-red-500 font-black shadow-sm"
                      : "bg-[#060E1C] border-[#1E3A60] text-slate-400 hover:text-white"
                  }`}
                >
                  <span>🎖️</span>
                  <span>FSD Director</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdminRole("warden")}
                  className={`py-2 rounded-xl border transition cursor-pointer flex flex-col items-center gap-0.5 ${
                    adminRole === "warden"
                      ? "bg-amber-600 text-white border-amber-500 font-black shadow-sm"
                      : "bg-[#060E1C] border-[#1E3A60] text-slate-400 hover:text-white"
                  }`}
                >
                  <span>🦺</span>
                  <span>Floor Warden</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdminRole("security")}
                  className={`py-2 rounded-xl border transition cursor-pointer flex flex-col items-center gap-0.5 ${
                    adminRole === "security"
                      ? "bg-blue-600 text-white border-blue-500 font-black shadow-sm"
                      : "bg-[#060E1C] border-[#1E3A60] text-slate-400 hover:text-white"
                  }`}
                >
                  <span>👮</span>
                  <span>Security</span>
                </button>
              </div>
            </div>

            {/* Preset PIN Fast Fill */}
            <div className="bg-[#060E1C] p-2.5 rounded-xl border border-[#1E3A60] space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#829AB8]">
                <span>QUICK PRESET PIN:</span>
                <span className="text-sky-400 font-bold">Tap to autofill</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-mono font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setAdminRole("fsd_director");
                    setAdminPin("7007");
                  }}
                  className={`py-1.5 rounded-lg border text-center transition cursor-pointer ${
                    adminPin === "7007" ? "bg-red-600 text-white border-red-400" : "bg-[#0B172B] border-[#1E3A60] text-slate-300"
                  }`}
                >
                  7007 (FSD)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdminRole("warden");
                    setAdminPin("2026");
                  }}
                  className={`py-1.5 rounded-lg border text-center transition cursor-pointer ${
                    adminPin === "2026" ? "bg-amber-600 text-white border-amber-400" : "bg-[#0B172B] border-[#1E3A60] text-slate-300"
                  }`}
                >
                  2026 (Warden)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdminRole("security");
                    setAdminPin("1901");
                  }}
                  className={`py-1.5 rounded-lg border text-center transition cursor-pointer ${
                    adminPin === "1901" ? "bg-blue-600 text-white border-blue-400" : "bg-[#0B172B] border-[#1E3A60] text-slate-300"
                  }`}
                >
                  1901 (Sec)
                </button>
              </div>
            </div>

            <form onSubmit={handleAdminSignIn} className="space-y-3.5">
              <div>
                <label className="text-[10px] font-mono font-bold tracking-widest text-[#829AB8] uppercase block mb-1">
                  ENTER 4-DIGIT SECURITY PIN
                </label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={4}
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="****"
                    required
                    className="w-full bg-[#060E1C] border border-[#1E3A60] rounded-xl pl-9 pr-3 py-2.5 text-white font-mono text-center tracking-widest text-lg font-black focus:border-red-500 outline-none"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2"
              >
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                <span>Unlock 5-Step Commander Console</span>
              </button>
            </form>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs px-1 text-slate-400 gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              if (onOpenQRPoster) onOpenQRPoster();
              else setIsQrModalOpen(true);
            }}
            className="text-sky-400 hover:text-sky-300 font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            <span>📱</span>
            <span>Display Official Entrance Poster</span>
          </button>

          <button
            type="button"
            onClick={onEnterOccupantApp}
            className="hover:text-white transition cursor-pointer"
          >
            Direct Occupant Pass →
          </button>
        </div>

        {/* Printable Poster Modal */}
        <SignInQRPosterModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          onOpenSignInForm={() => {
            setIsQrModalOpen(false);
            onEnterOccupantApp();
          }}
          occupantsCount={194}
          inBuildingCount={142}
        />
      </div>
    </div>
  );
}
