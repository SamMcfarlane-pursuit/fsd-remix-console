import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Occupant } from "../types";

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
  const signInUrl = typeof window !== "undefined" ? `${window.location.origin}/?mode=signin&scan=1` : "/?mode=signin&scan=1";

  useEffect(() => {
    if (isOpen) {
      QRCode.toDataURL(signInUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: "#003B70",
          light: "#FFFFFF",
        },
      })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [isOpen, signInUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border-2 border-[#005DAA] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-center relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm cursor-pointer transition"
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
            Official Access & Sign-In QR Poster
          </h2>
          <p className="text-xs text-[#475569] font-medium">
            Scan this QR code with any smartphone camera to sign in with your Name & Phone, receive an official OCC #, and register your building presence.
          </p>
        </div>

        {/* Large Scannable QR Code */}
        <div className="bg-[#F8FAFC] p-5 rounded-2xl border-2 border-[#B8D8F8] inline-block shadow-inner">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Scan to Sign In"
              className="w-56 h-56 sm:w-64 sm:h-64 mx-auto object-contain"
            />
          ) : (
            <div className="w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center text-xs text-slate-400">
              Generating Sign-In QR...
            </div>
          )}

          <div className="mt-2 text-xs font-mono font-bold text-[#003B70] bg-[#EBF5FB] px-3 py-1 rounded-lg border border-[#B8D8F8]">
            SCAN WITH PHONE CAMERA TO SIGN IN
          </div>
        </div>

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

        {/* Instructions & Flow */}
        <div className="grid grid-cols-3 gap-2 text-left bg-[#F0F6FC] p-3 rounded-xl border border-[#B8D8F8] text-[11px]">
          <div className="space-y-0.5">
            <span className="font-black text-[#005DAA]">1. SCAN QR</span>
            <p className="text-slate-600">Open with your phone camera</p>
          </div>
          <div className="space-y-0.5">
            <span className="font-black text-[#005DAA]">2. EMPLOYEE / VISITOR</span>
            <p className="text-slate-600">Select role & enter name/phone</p>
          </div>
          <div className="space-y-0.5">
            <span className="font-black text-[#005DAA]">3. ACCOUNTED</span>
            <p className="text-slate-600">Pass created & floor map updated</p>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="flex items-center justify-center gap-4 text-xs font-bold text-[#475569]">
          <span>
            Total Registered: <strong className="text-[#005DAA]">{occupantsCount}</strong>
          </span>
          <span>·</span>
          <span>
            Currently In Building: <strong className="text-emerald-700">{inBuildingCount}</strong>
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#B8D8F8]">
          <button
            onClick={() => {
              onClose();
              onOpenSignInForm();
            }}
            className="flex-1 min-h-[44px] bg-[#005DAA] hover:bg-[#004A88] text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
          >
            <span>✍️</span>
            <span>Open Sign-In Form Directly</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-4 min-h-[44px] bg-white border border-[#B8D8F8] hover:bg-[#F0F6FC] text-[#005DAA] rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>🖨️</span>
            <span>Print Poster</span>
          </button>
        </div>
      </div>
    </div>
  );
};
