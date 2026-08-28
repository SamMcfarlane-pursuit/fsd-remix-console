import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Occupant } from "../types";

interface QRBadgeGeneratorProps {
  occupants: Occupant[];
  onSelectOccupantForScan?: (occupantId: string) => void;
  onCheckInSuccess?: () => void;
}

export const QRBadgeGenerator: React.FC<QRBadgeGeneratorProps> = ({
  occupants,
  onSelectOccupantForScan,
  onCheckInSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<"stations" | "occupants" | "print-sheet">("stations");
  const [selectedStation, setSelectedStation] = useState<"assembly-a" | "assembly-b" | "kiosk-l7">("assembly-a");
  const [stationQrDataUrl, setStationQrDataUrl] = useState<string>("");
  const [selectedOccupantId, setSelectedOccupantId] = useState<string>(occupants[0]?.id || "OCC-101");
  const [occupantQrDataUrl, setOccupantQrDataUrl] = useState<string>("");
  const [occupantSearch, setOccupantSearch] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [batchQrMap, setBatchQrMap] = useState<Record<string, string>>({});

  const selectedOccupant = occupants.find((o) => o.id === selectedOccupantId) || occupants[0];

  // Base app URL for mobile scanner deep link
  const originUrl = typeof window !== "undefined" ? window.location.origin : "https://coned-muster.local";

  // Generate Station QR Code
  useEffect(() => {
    let payload = "";
    if (selectedStation === "assembly-a") {
      payload = `${originUrl}/?station=AssemblyPointA&loc=outside-assembly`;
    } else if (selectedStation === "assembly-b") {
      payload = `${originUrl}/?station=AssemblyPointB&loc=outside-assembly`;
    } else {
      payload = `${originUrl}/?station=Floor07Kiosk&loc=inside-building`;
    }

    QRCode.toDataURL(payload, {
      width: 320,
      margin: 1.5,
      color: {
        dark: "#003B70",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "H",
    }).then((url) => {
      setStationQrDataUrl(url);
    }).catch(console.error);
  }, [selectedStation, originUrl]);

  // Generate Individual Occupant QR Code
  useEffect(() => {
    if (!selectedOccupant) return;
    const payload = `CONED-BADGE-${selectedOccupant.id}-${selectedOccupant.quadrant}`;
    QRCode.toDataURL(payload, {
      width: 260,
      margin: 1.5,
      color: {
        dark: "#0F2537",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "H",
    }).then((url) => {
      setOccupantQrDataUrl(url);
    }).catch(console.error);
  }, [selectedOccupant]);

  // Pre-generate batch QRs for first 24 occupants for the sheet view
  useEffect(() => {
    const subset = occupants.slice(0, 24);
    const promises = subset.map((occ) => {
      const payload = `CONED-BADGE-${occ.id}-${occ.quadrant}`;
      return QRCode.toDataURL(payload, { width: 140, margin: 1 })
        .then((url) => ({ id: occ.id, url }))
        .catch(() => ({ id: occ.id, url: "" }));
    });

    Promise.all(promises).then((results) => {
      const map: Record<string, string> = {};
      results.forEach((r) => {
        if (r.url) map[r.id] = r.url;
      });
      setBatchQrMap(map);
    });
  }, [occupants]);

  const filteredOccupants = occupants.filter((o) => {
    if (filterRole !== "ALL" && o.role !== filterRole) return false;
    if (occupantSearch.trim()) {
      const q = occupantSearch.toLowerCase();
      return (
        o.name.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        (o.desk && o.desk.toLowerCase().includes(q)) ||
        o.quadrant.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="bg-white rounded-2xl border border-[#B8D8F8] p-4 sm:p-6 shadow-sm space-y-6 text-[#0F2537]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#B8D8F8] pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl">🔲</span>
            <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-[#005DAA]">
              QR Code Generator & Sign-In Station System
            </h2>
            <span className="text-[10px] font-mono font-bold bg-[#EBF5FB] text-[#005DAA] border border-[#B8D8F8] px-2 py-0.5 rounded">
              ISO/IEC 18004 STANDARD
            </span>
          </div>
          <p className="text-xs text-[#475569] mt-0.5 font-medium">
            Generate printable evacuation muster station check-in posters, personal QR badge passes, and bulk warden sign-in cards.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1.5 bg-[#F0F6FC] p-1 rounded-xl border border-[#B8D8F8] shrink-0">
          <button
            onClick={() => setActiveTab("stations")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "stations" ? "bg-[#005DAA] text-white shadow-xs" : "text-[#005DAA] hover:bg-white"
            }`}
          >
            <span>🚩</span>
            <span>Muster Station Posters</span>
          </button>
          <button
            onClick={() => setActiveTab("occupants")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "occupants" ? "bg-[#005DAA] text-white shadow-xs" : "text-[#005DAA] hover:bg-white"
            }`}
          >
            <span>🏷️</span>
            <span>Occupant Badges</span>
          </button>
          <button
            onClick={() => setActiveTab("print-sheet")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "print-sheet" ? "bg-[#005DAA] text-white shadow-xs" : "text-[#005DAA] hover:bg-white"
            }`}
          >
            <span>🖨️</span>
            <span>Warden Quick Sheet</span>
          </button>
        </div>
      </div>

      {/* TAB 1: MUSTER STATION CHECK-IN POSTERS */}
      {activeTab === "stations" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Station Selection Controls */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#005DAA]">
              1. Choose Muster Station Location
            </h3>

            <div className="space-y-2.5">
              {[
                {
                  id: "assembly-a",
                  title: "Assembly Point A — Park Plaza",
                  sub: "East 14th Street outside main building lobby",
                  color: "border-emerald-500 bg-emerald-50/50",
                  icon: "🌳",
                },
                {
                  id: "assembly-b",
                  title: "Assembly Point B — East Courtyard",
                  sub: "Irving Place outdoor muster grounds",
                  color: "border-sky-500 bg-sky-50/50",
                  icon: "🏛️",
                },
                {
                  id: "kiosk-l7",
                  title: "Floor 07 Main Entrance & Egress Kiosk",
                  sub: "Elevator Lobby C & Stairwell B threshold",
                  color: "border-blue-500 bg-blue-50/50",
                  icon: "🏢",
                },
              ].map((st) => (
                <div
                  key={st.id}
                  onClick={() => setSelectedStation(st.id as any)}
                  className={`p-3.5 rounded-xl border-2 transition cursor-pointer flex items-start gap-3 ${
                    selectedStation === st.id
                      ? `${st.color} shadow-sm`
                      : "border-[#B8D8F8] bg-white hover:bg-[#F0F6FC]"
                  }`}
                >
                  <span className="text-2xl shrink-0">{st.icon}</span>
                  <div>
                    <div className="text-xs font-black text-[#0F2537]">{st.title}</div>
                    <div className="text-[11px] text-[#475569] mt-0.5">{st.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-[#F0F6FC] rounded-xl border border-[#B8D8F8] text-xs space-y-2">
              <div className="font-bold text-[#005DAA] flex items-center gap-1.5">
                <span>💡</span>
                <span>How Occupants Sign In via Station QR</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[#475569] text-[11px] leading-relaxed">
                <li>Occupant opens standard Camera app on any smartphone.</li>
                <li>Points camera at this printed or displayed poster QR code.</li>
                <li>Tap banner to open Instant Sign-In and confirm safe attendance.</li>
                <li>Attendance is timestamped & streamed to the FSD Commander Deck.</li>
              </ol>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full py-2.5 bg-[#005DAA] hover:bg-[#004A88] text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center justify-center gap-2"
            >
              <span>🖨️</span>
              <span>Print Official 8.5x11 Muster Poster</span>
            </button>
          </div>

          {/* Printable Poster Visual Card Preview */}
          <div className="lg:col-span-7 bg-[#F8FAFC] p-6 rounded-2xl border-2 border-[#005DAA] shadow-md flex flex-col items-center text-center space-y-4 relative overflow-hidden">
            {/* Top ConEd Life-Safety Banner */}
            <div className="w-full bg-[#003B70] text-white py-2.5 px-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">⚡</span>
                <span className="text-xs font-black tracking-widest uppercase">CON EDISON · LIFE SAFETY</span>
              </div>
              <span className="text-[10px] font-mono font-bold bg-white/20 px-2 py-0.5 rounded">
                FLOOR 07 MUSTER
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-black uppercase tracking-widest text-[#005DAA]">
                EMERGENCY EVACUATION CHECK-IN
              </div>
              <h3 className="text-lg sm:text-xl font-black text-[#0F2537]">
                {selectedStation === "assembly-a"
                  ? "ASSEMBLY POINT A — PARK PLAZA"
                  : selectedStation === "assembly-b"
                  ? "ASSEMBLY POINT B — COURTYARD"
                  : "FLOOR 07 RECEPTION & KIOSK"}
              </h3>
              <p className="text-xs text-[#475569] font-semibold max-w-md mx-auto">
                Scan below with your mobile phone camera to instantly register yourself as <strong className="text-emerald-700">SAFE & ACCOUNTED FOR</strong>.
              </p>
            </div>

            {/* Rendered Scannable High-Resolution QR Code */}
            <div className="bg-white p-4 rounded-2xl border-4 border-[#003B70] shadow-lg inline-block">
              {stationQrDataUrl ? (
                <img
                  src={stationQrDataUrl}
                  alt="Station Check-In QR Code"
                  className="w-56 h-56 sm:w-64 sm:h-64 object-contain mx-auto"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs font-mono">
                  Generating QR Code...
                </div>
              )}
              <div className="mt-2 text-[10px] font-mono font-bold text-[#005DAA] uppercase">
                SCAN WITH PHONE CAMERA TO SIGN IN
              </div>
            </div>

            {/* Quick Test Trigger Button for Demo */}
            <div className="w-full pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                onClick={() => {
                  if (onSelectOccupantForScan) {
                    onSelectOccupantForScan("OCC-101");
                  }
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <span>⚡</span>
                <span>Simulate Phone Scan (Sign In Sample Occupant)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INDIVIDUAL OCCUPANT PERSONAL BADGES */}
      {activeTab === "occupants" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Occupant Directory List */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#005DAA]">🔍</span>
                <input
                  type="text"
                  value={occupantSearch}
                  onChange={(e) => setOccupantSearch(e.target.value)}
                  placeholder="Search occupant by name or badge ID..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#F0F6FC] border border-[#B8D8F8] rounded-lg text-xs text-[#0F2537] focus:outline-none focus:border-[#005DAA]"
                />
              </div>

              {/* Role filter */}
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="bg-[#F0F6FC] border border-[#B8D8F8] rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#0F2537] focus:outline-none"
              >
                <option value="ALL">All Roles ({occupants.length})</option>
                <option value="Employee">Employees</option>
                <option value="Contractor">Contractors</option>
                <option value="Visitor">Visitors</option>
              </select>
            </div>

            <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
              {filteredOccupants.map((occ) => (
                <div
                  key={occ.id}
                  onClick={() => setSelectedOccupantId(occ.id)}
                  className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                    selectedOccupantId === occ.id
                      ? "border-[#005DAA] bg-[#EBF5FB] shadow-xs"
                      : "border-[#B8D8F8] bg-white hover:bg-[#F0F6FC]"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-[#0F2537] truncate flex items-center gap-1.5">
                      <span>{occ.name}</span>
                      <span className="text-[10px] font-mono bg-[#005DAA]/10 text-[#005DAA] px-1.5 py-0.2 rounded font-bold">
                        {occ.id}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#475569] mt-0.5 font-medium">
                      {occ.role} · Quadrant {occ.quadrant} · Desk: {occ.desk || "07-Workstation"}
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-md border shrink-0 ${
                      occ.status === "safe"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : occ.status === "need-help" || occ.status === "mia"
                        ? "bg-red-100 text-red-800 border-red-300 animate-pulse"
                        : "bg-amber-100 text-amber-900 border-amber-300"
                    }`}
                  >
                    {occ.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Personal Digital QR Badge Card */}
          {selectedOccupant && (
            <div className="lg:col-span-6 bg-white p-5 rounded-2xl border-2 border-[#005DAA] shadow-md space-y-4 text-center">
              <div className="flex items-center justify-between border-b border-[#B8D8F8] pb-2.5">
                <span className="text-[10px] font-mono font-bold text-[#005DAA] uppercase">
                  CON EDISON FSD DIGITAL PASS #07
                </span>
                <span className="text-xs font-mono font-bold bg-[#005DAA] text-white px-2 py-0.5 rounded">
                  {selectedOccupant.id}
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-black text-[#0F2537]">{selectedOccupant.name}</h3>
                <div className="text-xs text-[#005DAA] font-bold">
                  {selectedOccupant.role} · Floor 07 ({selectedOccupant.quadrant} Quadrant)
                </div>
                <div className="text-xs font-mono text-[#475569] font-bold">
                  PHONE: {selectedOccupant.phone || "(212) 555-0100"} · PRESENCE:{" "}
                  <span className={selectedOccupant.badgedOut ? "text-slate-600 font-bold" : "text-emerald-700 font-bold"}>
                    {selectedOccupant.badgedOut ? "LEFT BUILDING" : "IN BUILDING"}
                  </span>
                </div>
                {selectedOccupant.desk && (
                  <div className="text-[11px] text-[#475569] font-mono font-semibold">
                    Workstation Desk: {selectedOccupant.desk}
                  </div>
                )}
              </div>

              {/* Scannable Occupant QR Code */}
              <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#B8D8F8] inline-block shadow-inner">
                {occupantQrDataUrl ? (
                  <img
                    src={occupantQrDataUrl}
                    alt={`QR Badge for ${selectedOccupant.name}`}
                    className="w-44 h-44 object-contain mx-auto"
                  />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-slate-400 text-xs">
                    Generating...
                  </div>
                )}
                <div className="mt-1.5 text-[10px] font-mono font-bold text-[#003B70]">
                  CONED-BADGE-{selectedOccupant.id}-{selectedOccupant.quadrant}
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  onClick={() => {
                    if (onSelectOccupantForScan) {
                      onSelectOccupantForScan(selectedOccupant.id);
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer shadow-xs flex items-center gap-1"
                >
                  <span>✓</span>
                  <span>Test Sign-In With This QR Badge</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-white border border-[#B8D8F8] text-[#005DAA] rounded-lg text-xs font-bold hover:bg-[#F0F6FC] transition cursor-pointer"
                >
                  🖨️ Print Badge
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WARDEN QUICK QR BADGE SHEET (Multi-Card Grid) */}
      {activeTab === "print-sheet" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#B8D8F8] pb-3">
            <div>
              <h3 className="text-sm font-black uppercase text-[#005DAA]">
                Floor Warden Rapid QR Attendance Roster Sheet
              </h3>
              <p className="text-xs text-[#475569]">
                Printable sheet with scannable QR codes for each floor occupant. Wardens can scan codes in rapid sequence to verify roster.
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-[#005DAA] text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-[#004A88] transition cursor-pointer shadow-xs"
            >
              🖨️ Print Full 24-Badge Sheet
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {occupants.slice(0, 24).map((occ) => (
              <div
                key={occ.id}
                onClick={() => {
                  if (onSelectOccupantForScan) {
                    onSelectOccupantForScan(occ.id);
                  }
                }}
                className="p-2.5 rounded-xl border border-[#B8D8F8] bg-white hover:border-[#005DAA] hover:shadow-md transition cursor-pointer text-center space-y-1.5 group"
              >
                <div className="text-[11px] font-black text-[#0F2537] truncate group-hover:text-[#005DAA]">
                  {occ.name}
                </div>
                <div className="text-[9px] text-[#475569] font-mono font-bold">
                  {occ.id} · {occ.quadrant}
                </div>

                <div className="w-20 h-20 bg-[#F8FAFC] mx-auto p-1 rounded-lg border border-[#B8D8F8] flex items-center justify-center">
                  {batchQrMap[occ.id] ? (
                    <img src={batchQrMap[occ.id]} alt={occ.id} className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-[8px] text-slate-400">QR</div>
                  )}
                </div>

                <div className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 py-0.5 rounded">
                  TAP TO SCAN 📲
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
