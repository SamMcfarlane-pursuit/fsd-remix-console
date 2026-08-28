import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Occupant, QuadrantId } from "../types";
import { syncOccupantToFirestore } from "../lib/firebase";
import { DigitalSignaturePad } from "./DigitalSignaturePad";

interface SelfSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onViewOnMap?: (occupantId: string) => void;
  defaultAction?: "enter" | "leave" | "muster";
  initialName?: string;
  occupants?: Occupant[];
}

export const SelfSignInModal: React.FC<SelfSignInModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onViewOnMap,
  defaultAction = "enter",
  initialName = "",
  occupants = [],
}) => {
  const [name, setName] = useState(initialName || "");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("Con Edison");
  const [role, setRole] = useState<string>("Employee");
  const [quadrant, setQuadrant] = useState<QuadrantId>("NW");
  const [desk, setDesk] = useState("");
  const [presenceAction, setPresenceAction] = useState<"enter" | "leave" | "muster">(defaultAction);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signatureType, setSignatureType] = useState<"drawn" | "typed">("drawn");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [directNotifyMsg, setDirectNotifyMsg] = useState<string | null>(null);

  // Result state
  const [allocatedOccupant, setAllocatedOccupant] = useState<Occupant | null>(null);
  const [badgeQrUrl, setBadgeQrUrl] = useState<string>("");

  useEffect(() => {
    if (initialName) {
      setName(initialName);
    }
  }, [initialName]);

  useEffect(() => {
    if (defaultAction) {
      setPresenceAction(defaultAction);
    }
  }, [defaultAction]);

  // Check if current name/phone matches someone already in database
  const matchingExistingUser = (name.trim().length >= 2 || phone.trim().length >= 4)
    ? occupants.find(
        (o) =>
          (name.trim() && o.name.toLowerCase() === name.trim().toLowerCase()) ||
          (name.trim().length >= 4 && o.name.toLowerCase().includes(name.trim().toLowerCase())) ||
          (phone.trim().length >= 4 && o.phone && o.phone.replace(/\D/g, "").includes(phone.replace(/\D/g, ""))) ||
          (name.trim() && o.id.toLowerCase() === name.trim().toLowerCase())
      )
    : null;

  // Direct Sign-In for recognized user in database
  const handleDirectSignInExisting = async (existingUser: Occupant) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/occupant/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occupantId: existingUser.id,
          action: presenceAction === "leave" ? "leave" : "enter",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAllocatedOccupant(existingUser);
        try {
          localStorage.setItem("muster_registered_occupant_id", existingUser.id);
          localStorage.setItem("muster_registered_name", existingUser.name);
          if (existingUser.phone) localStorage.setItem("muster_registered_phone", existingUser.phone);
        } catch (e) {}
        setDirectNotifyMsg(`⚡ Direct Sign-In Verified! Welcome back ${existingUser.name} (${existingUser.id}). You are recorded as PRESENT & ACCOUNTED on Floor 07.`);
        onSuccess();
      } else {
        setErrorMsg(data.error || "Could not sign in existing user.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error performing direct sign in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (allocatedOccupant) {
      const payload = `CONED-BADGE-${allocatedOccupant.id}-${allocatedOccupant.quadrant}`;
      QRCode.toDataURL(payload, {
        width: 240,
        margin: 1.5,
        color: {
          dark: "#003B70",
          light: "#FFFFFF",
        },
      })
        .then(setBadgeQrUrl)
        .catch(console.error);
    }
  }, [allocatedOccupant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!phone.trim()) {
      setErrorMsg("Please enter your phone number.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/occupant/sign-in-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          company: company.trim() || "Con Edison",
          role,
          quadrant,
          desk: desk.trim() || undefined,
          action: presenceAction === "leave" ? "leave" : "enter",
          status: presenceAction === "muster" ? "safe" : undefined,
          signature_data: signatureData,
          signature_type: signatureType,
          locationCategory:
            presenceAction === "leave"
              ? "offsite"
              : presenceAction === "muster"
              ? "outside-assembly"
              : "inside-building",
        }),
      });

      const data = await res.json();
      if (res.ok && data.occupant) {
        setAllocatedOccupant(data.occupant);
        syncOccupantToFirestore(data.occupant);
        try {
          localStorage.setItem("muster_registered_occupant_id", data.occupant.id);
          localStorage.setItem("muster_registered_phone", phone.trim());
          localStorage.setItem("muster_registered_name", name.trim());
        } catch (e) {
          console.warn("Could not save to localStorage", e);
        }
        onSuccess();
      } else {
        setErrorMsg(data.error || "Failed to sign in. Please check your details.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Network error submitting sign-in.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setName("");
    setPhone("");
    setAllocatedOccupant(null);
    setBadgeQrUrl("");
    setErrorMsg(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border-2 border-[#005DAA] rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#B8D8F8] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📱</span>
              <h2 className="text-base sm:text-lg font-black text-[#005DAA] uppercase">
                Floor 07 Digital Sign-In & Access Registration
              </h2>
            </div>
            <p className="text-xs text-[#475569] mt-0.5">
              Gathers your Name & Phone, assigns your official OCC #, and allocates your location on the live floor plan.
            </p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm cursor-pointer transition shrink-0"
          >
            ✕
          </button>
        </div>

        {directNotifyMsg && (
          <div className="p-3.5 bg-emerald-100 border-2 border-emerald-500 text-emerald-950 rounded-xl text-xs font-black flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="text-base">⚡</span>
              <span>{directNotifyMsg}</span>
            </div>
            <button
              onClick={() => setDirectNotifyMsg(null)}
              className="text-emerald-800 hover:text-emerald-950 cursor-pointer font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-300 text-red-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* RECOGNIZED EXISTING USER QUICK SIGN-IN HELPER */}
        {matchingExistingUser && !allocatedOccupant && (
          <div className="p-3.5 bg-[#EBF3FB] border-2 border-[#005DAA] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fadeIn">
            <div className="text-xs">
              <div className="font-mono font-black text-[#005DAA] uppercase text-[10px]">
                RECOGNIZED PROFILE IN DATABASE
              </div>
              <div className="font-black text-[#0F2537] text-sm">
                {matchingExistingUser.name}{" "}
                <span className="text-xs font-normal text-slate-500 font-mono">
                  ({matchingExistingUser.id} · {matchingExistingUser.role})
                </span>
              </div>
              <div className="text-[11px] text-slate-600">
                Floor 07 · Zone {matchingExistingUser.quadrant} · Phone: {matchingExistingUser.phone || "On File"}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDirectSignInExisting(matchingExistingUser)}
              disabled={isSubmitting}
              className="px-3.5 py-2 bg-[#005DAA] hover:bg-[#004A88] text-white rounded-lg font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-xs shrink-0 flex items-center justify-center gap-1.5"
            >
              <span>⚡</span>
              <span>Direct Sign In</span>
            </button>
          </div>
        )}

        {/* 1. SUCCESS VIEW: DISPLAY ALLOCATED OCCUPANT & QR PASS */}
        {allocatedOccupant ? (
          <div className="space-y-4 text-center animate-fadeIn">
            <div className="p-4 bg-emerald-50 border-2 border-emerald-500 rounded-2xl space-y-1">
              <span className="text-2xl">🎉</span>
              <h3 className="text-base font-black text-emerald-950">
                Sign-In Complete & Information Allocated!
              </h3>
              <p className="text-xs text-emerald-800 font-semibold">
                You have been assigned official badge identifier{" "}
                <strong className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300">
                  {allocatedOccupant.id}
                </strong>{" "}
                and allocated to Floor 07 ({allocatedOccupant.quadrant} Quadrant).
              </p>
            </div>

            {/* Scannable Badge Card */}
            <div className="p-5 bg-[#F8FAFC] border-2 border-[#005DAA] rounded-2xl max-w-sm mx-auto shadow-md space-y-3">
              <div className="flex items-center justify-between border-b border-[#B8D8F8] pb-2">
                <span className="text-[10px] font-mono font-bold text-[#005DAA] uppercase">
                  CON EDISON FSD DIGITAL PASS #07
                </span>
                <span className="text-xs font-mono font-bold bg-[#005DAA] text-white px-2 py-0.5 rounded">
                  {allocatedOccupant.id}
                </span>
              </div>

              <div className="space-y-0.5">
                <h4 className="text-base font-black text-[#0F2537]">{allocatedOccupant.name}</h4>
                <div className="text-xs text-[#005DAA] font-bold">
                  {allocatedOccupant.role} · {allocatedOccupant.company || "Con Edison"}
                </div>
                <div className="text-xs font-mono text-[#475569] font-medium">
                  PHONE: {allocatedOccupant.phone}
                </div>
                <div className="text-xs font-bold mt-1">
                  Zone: Floor 07 ({allocatedOccupant.quadrant}) · Desk: {allocatedOccupant.desk || "07-Workstation"}
                </div>
              </div>

              {/* QR Image */}
              <div className="bg-white p-3 rounded-xl border border-[#B8D8F8] inline-block shadow-inner">
                {badgeQrUrl ? (
                  <img
                    src={badgeQrUrl}
                    alt={`Pass for ${allocatedOccupant.name}`}
                    className="w-40 h-40 object-contain mx-auto"
                  />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400">
                    Generating Pass...
                  </div>
                )}
                <div className="text-[10px] font-mono font-bold text-[#003B70] mt-1">
                  CONED-BADGE-{allocatedOccupant.id}-{allocatedOccupant.quadrant}
                </div>
              </div>

              <div className="text-xs">
                Presence:{" "}
                <span
                  className={`font-black uppercase px-2.5 py-0.5 rounded ${
                    allocatedOccupant.badgedOut
                      ? "bg-slate-200 text-slate-700"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {allocatedOccupant.badgedOut ? "⚪ Left Building (Off-Site)" : "🟢 In Building (Floor 07)"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#B8D8F8]">
              {onViewOnMap && (
                <button
                  onClick={() => {
                    onClose();
                    onViewOnMap(allocatedOccupant.id);
                  }}
                  className="flex-1 min-h-[44px] bg-[#005DAA] hover:bg-[#004A88] text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <span>🗺️</span>
                  <span>View My Location on Live Map</span>
                </button>
              )}

              <button
                onClick={handleReset}
                className="px-4 min-h-[44px] bg-white border border-[#B8D8F8] hover:bg-[#F0F6FC] text-[#005DAA] rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Sign In Another Person
              </button>

              <button
                onClick={onClose}
                className="px-4 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* 2. SIGN-IN FORM: GATHER INFORMATION */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Presence Action Mode Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase text-[#005DAA] tracking-wider block">
                Select Sign-In Action:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPresenceAction("enter")}
                  className={`p-2.5 rounded-xl border text-xs font-black transition cursor-pointer flex flex-col items-center gap-1 ${
                    presenceAction === "enter"
                      ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                      : "bg-[#F0F6FC] text-[#0F2537] border-[#B8D8F8] hover:bg-white"
                  }`}
                >
                  <span className="text-base">🟢</span>
                  <span>Entering Building</span>
                  <span className="text-[10px] font-normal opacity-90">(On Floor 07)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPresenceAction("leave")}
                  className={`p-2.5 rounded-xl border text-xs font-black transition cursor-pointer flex flex-col items-center gap-1 ${
                    presenceAction === "leave"
                      ? "bg-slate-700 text-white border-slate-900 shadow-sm"
                      : "bg-[#F0F6FC] text-[#0F2537] border-[#B8D8F8] hover:bg-white"
                  }`}
                >
                  <span className="text-base">⚪</span>
                  <span>Leaving Building</span>
                  <span className="text-[10px] font-normal opacity-90">(Badge Out)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPresenceAction("muster")}
                  className={`p-2.5 rounded-xl border text-xs font-black transition cursor-pointer flex flex-col items-center gap-1 ${
                    presenceAction === "muster"
                      ? "bg-[#005DAA] text-white border-[#003B70] shadow-sm"
                      : "bg-[#F0F6FC] text-[#0F2537] border-[#B8D8F8] hover:bg-white"
                  }`}
                >
                  <span className="text-base">🚨</span>
                  <span>Muster Check-In</span>
                  <span className="text-[10px] font-normal opacity-90">(Safe Outside)</span>
                </button>
              </div>
            </div>

            {/* Name & Phone Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F2537] flex items-center gap-1">
                  <span>Full Name</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                  className="w-full min-h-[42px] px-3 py-2 bg-[#F8FAFC] border border-[#B8D8F8] rounded-xl text-xs font-bold text-[#0F2537] focus:bg-white focus:border-[#005DAA] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F2537] flex items-center gap-1">
                  <span>Phone Number (SMS Alert)</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. (212) 555-0144"
                  className="w-full min-h-[42px] px-3 py-2 bg-[#F8FAFC] border border-[#B8D8F8] rounded-xl text-xs font-bold text-[#0F2537] focus:bg-white focus:border-[#005DAA] focus:outline-none"
                />
              </div>
            </div>

            {/* Role & Company */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F2537]">Role / Type</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 bg-[#F8FAFC] border border-[#B8D8F8] rounded-xl text-xs font-bold text-[#0F2537] focus:bg-white focus:border-[#005DAA] focus:outline-none"
                >
                  <option value="Employee">Employee (Con Edison)</option>
                  <option value="Contractor">Contractor / Consultant</option>
                  <option value="Visitor">Visitor / Guest</option>
                  <option value="VIP">Executive / VIP</option>
                  <option value="First Responder">First Responder</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F2537]">Company / Organization</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Con Edison"
                  className="w-full min-h-[42px] px-3 py-2 bg-[#F8FAFC] border border-[#B8D8F8] rounded-xl text-xs font-bold text-[#0F2537] focus:bg-white focus:border-[#005DAA] focus:outline-none"
                />
              </div>
            </div>

            {/* Department Zone & Desk # */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F2537]">Department Zone</label>
                <select
                  value={quadrant}
                  onChange={(e) => setQuadrant(e.target.value as QuadrantId)}
                  className="w-full min-h-[42px] px-3 py-2 bg-[#F8FAFC] border border-[#B8D8F8] rounded-xl text-xs font-bold text-[#0F2537] focus:bg-white focus:border-[#005DAA] focus:outline-none"
                >
                  <option value="NW">NW · 800 Strategic Planning</option>
                  <option value="NE">NE · 500 Corp Security / Gas Ops</option>
                  <option value="SW">SW · 700 AMI / Steam West</option>
                  <option value="SE">SE · M Operations / Steam Ops (07-550)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#0F2537]">Desk / Workstation #</label>
                <input
                  type="text"
                  value={desk}
                  onChange={(e) => setDesk(e.target.value)}
                  placeholder="e.g. 07-463 or 07-551"
                  className="w-full min-h-[42px] px-3 py-2 bg-[#F8FAFC] border border-[#B8D8F8] rounded-xl text-xs font-bold text-[#0F2537] focus:bg-white focus:border-[#005DAA] focus:outline-none"
                />
              </div>
            </div>

            {/* Digital Signature Pad */}
            <div className="pt-1">
              <DigitalSignaturePad
                defaultName={name}
                onSignatureChange={(sigData, sigType) => {
                  setSignatureData(sigData);
                  setSignatureType(sigType);
                }}
              />
            </div>

            {/* Submit Button */}
            <div className="pt-3 border-t border-[#B8D8F8] flex flex-col sm:flex-row gap-2">
              <button
                type="submit"
                disabled={isSubmitting || !name.trim() || !phone.trim()}
                className="flex-1 min-h-[44px] bg-[#005DAA] hover:bg-[#004A88] disabled:bg-slate-300 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>{isSubmitting ? "Allocating..." : "✓ Complete Sign-In & Get Badge"}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
