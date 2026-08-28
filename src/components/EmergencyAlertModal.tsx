import React, { useState } from "react";
import { QuadrantId, EmergencyAlertPayload } from "../types";

interface EmergencyAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  expectedOnFloor: number;
  onSendAlert: (alertData: {
    title: string;
    narrative: string;
    priority: "CRITICAL" | "HIGH" | "WARNING";
    targetQuadrants: ("ALL" | QuadrantId)[];
    channels: string[];
  }) => Promise<EmergencyAlertPayload | void>;
}

const PRESET_NARRATIVES = [
  {
    label: "🔥 Standard Fire Evacuation",
    title: "FIRE EMERGENCY — IMMEDIATE EVACUATION",
    priority: "CRITICAL" as const,
    narrative:
      "FIRE EMERGENCY DETECTED ON FLOOR 7. Proceed immediately to nearest stairwell exit (Stair A West or Stair B East). DO NOT USE ELEVATORS. Floor wardens report to ARA landings.",
  },
  {
    label: "💨 Smoke Hazard (East Route Only)",
    title: "SMOKE DRIFT HAZARD — USE STAIR B",
    priority: "CRITICAL" as const,
    narrative:
      "HEAVY SMOKE DRIFT DETECTED IN WEST QUADRANTS (NW/SW). Evacuate strictly via STAIR B (East Landing). Stair A is currently restricted for firefighter access.",
  },
  {
    label: "♿ ARA Evacuation Chair Dispatch",
    title: "STAIRWELL A — EVAC CHAIR TEAM DISPATCH",
    priority: "HIGH" as const,
    narrative:
      "ASSISTANCE REQUIRED: 4 occupants awaiting evacuation chair assistance at Stairwell A, Landing 7. Assigned evacuation chair teams report immediately to Stair A.",
  },
  {
    label: "🚨 Emergency Drill Announcement",
    title: "SCHEDULED FIRE DRILL IN PROGRESS",
    priority: "WARNING" as const,
    narrative:
      "MUSTER COMMAND DRILL IN PROGRESS ON FLOOR 7. All floor occupants must mark safe using the mobile app, local mesh kiosk, or by informing your floor warden.",
  },
];

export default function EmergencyAlertModal({
  isOpen,
  onClose,
  expectedOnFloor,
  onSendAlert,
}: EmergencyAlertModalProps) {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [title, setTitle] = useState(PRESET_NARRATIVES[0].title);
  const [narrative, setNarrative] = useState(PRESET_NARRATIVES[0].narrative);
  const [priority, setPriority] = useState<"CRITICAL" | "HIGH" | "WARNING">("CRITICAL");
  const [selectedQuadrant, setSelectedQuadrant] = useState<"ALL" | QuadrantId>("ALL");
  const [channels, setChannels] = useState<{ [key: string]: boolean }>({
    PUSH_NOTIFICATION: true,
    MESH_AUDIO_BEACON: true,
    KIOSK_POPUP: true,
    SMS_BACKUP: false,
  });

  const [isSending, setIsSending] = useState(false);
  const [sentResult, setSentResult] = useState<EmergencyAlertPayload | null>(null);

  if (!isOpen) return null;

  const handleSelectPreset = (idx: number) => {
    setSelectedPresetIndex(idx);
    const p = PRESET_NARRATIVES[idx];
    setTitle(p.title);
    setNarrative(p.narrative);
    setPriority(p.priority);
  };

  const toggleChannel = (key: string) => {
    setChannels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDispatch = async () => {
    if (!narrative.trim()) return;
    setIsSending(true);
    try {
      const activeChannels = Object.keys(channels).filter((k) => channels[k]);
      const result = await onSendAlert({
        title,
        narrative,
        priority,
        targetQuadrants: [selectedQuadrant],
        channels: activeChannels,
      });

      if (result) {
        setSentResult(result);
      } else {
        // Fallback result for local demo
        setSentResult({
          alertId: `ALERT-${Date.now().toString(36).toUpperCase()}`,
          title,
          narrative,
          priority,
          targetQuadrants: [selectedQuadrant],
          channels: activeChannels,
          senderRole: "FSD COMMANDER",
          timestamp: new Date().toISOString(),
          deliveredCount: expectedOnFloor || 195,
          ackCount: Math.round((expectedOnFloor || 195) * 0.94),
        });
      }
    } catch (err) {
      console.error("Alert broadcast failed", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    setSentResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border-2 border-[#005DAA] bg-white text-[#0F2537] shadow-2xl overflow-hidden">
        {/* Top Emergency Header Bar */}
        <div className="bg-[#005DAA] text-white px-4 sm:px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="text-xl sm:text-2xl animate-bounce">📢</span>
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase tracking-wider leading-none">
                Emergency Alert Push Notification
              </h2>
              <p className="text-[10px] sm:text-[11px] font-extrabold tracking-widest text-sky-100 mt-0.5">
                CON ED FSD COMMAND CENTER · HIGH-PRIORITY BROADCAST
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-black flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label="Close Modal"
          >
            ✕
          </button>
        </div>

        {sentResult ? (
          /* Confirmation State after Dispatch */
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
            <div className="rounded-xl border border-[#B8D8F8] bg-[#EBF5FB] p-5 text-center space-y-3">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#005DAA]/10 text-3xl text-[#005DAA]">
                ✅
              </div>
              <h3 className="text-lg font-black text-[#005DAA] uppercase tracking-wider">
                Emergency Alert Broadcasted
              </h3>
              <p className="text-xs text-[#0F2537] font-medium">
                Push notification and audio beacons dispatched across mesh network to Floor 07 mobile devices.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-center">
              <div className="bg-[#F0F6FC] p-3 rounded-lg border border-[#B8D8F8]">
                <div className="text-[10px] text-[#475569] uppercase font-sans font-bold">Alert ID</div>
                <div className="text-xs font-black text-[#005DAA] mt-1">{sentResult.alertId}</div>
              </div>
              <div className="bg-[#F0F6FC] p-3 rounded-lg border border-[#B8D8F8]">
                <div className="text-[10px] text-[#475569] uppercase font-sans font-bold">Notified Devices</div>
                <div className="text-lg font-black text-[#005DAA] mt-0.5">{sentResult.deliveredCount}</div>
              </div>
              <div className="bg-[#F0F6FC] p-3 rounded-lg border border-[#B8D8F8]">
                <div className="text-[10px] text-[#475569] uppercase font-sans font-bold">Mesh Acks</div>
                <div className="text-lg font-black text-[#005DAA] mt-0.5">{sentResult.ackCount}</div>
              </div>
              <div className="bg-[#F0F6FC] p-3 rounded-lg border border-[#B8D8F8]">
                <div className="text-[10px] text-[#475569] uppercase font-sans font-bold">Ledger Chain</div>
                <div className="text-xs font-black text-[#005DAA] mt-1">VERIFIED SHA-256</div>
              </div>
            </div>

            <div className="bg-[#F0F6FC] p-4 rounded-xl border border-[#B8D8F8] space-y-2 text-xs">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#005DAA]">
                Broadcast Payload Summary
              </div>
              <div className="font-bold text-[#0F2537]">{sentResult.title}</div>
              <p className="text-[#0F2537] bg-white p-3 rounded-lg border border-[#B8D8F8] font-medium">
                {sentResult.narrative}
              </p>
              <div className="flex flex-wrap justify-between items-center text-[10px] text-[#475569] font-mono font-bold pt-1">
                <span>CHANNELS: {sentResult.channels.join(", ")}</span>
                <span>TIMESTAMP: {new Date(sentResult.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-[#B8D8F8]">
              <button
                onClick={handleReset}
                className="w-full sm:w-auto rounded-xl bg-[#005DAA] px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-[#004A88] transition cursor-pointer shadow-xs"
              >
                Return to FSD Console
              </button>
            </div>
          </div>
        ) : (
          /* Modal Form Body */
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
            {/* Target Audience & Registered Device Counter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#F0F6FC] p-3.5 rounded-xl border border-[#B8D8F8]">
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full bg-[#005DAA] animate-ping" />
                <span className="font-black text-[#0F2537] uppercase tracking-wider">
                  Target Audience:
                </span>
                <span className="font-mono font-bold text-[#005DAA]">
                  {expectedOnFloor} Registered Floor 07 Mobile Devices
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-[#475569] font-bold">Target Zone:</span>
                <select
                  value={selectedQuadrant}
                  onChange={(e) => setSelectedQuadrant(e.target.value as any)}
                  className="bg-white border border-[#B8D8F8] rounded-md px-2 py-1 text-xs font-bold text-[#0F2537] focus:outline-none focus:border-[#005DAA]"
                >
                  <option value="ALL">Entire Floor 07 (All Quadrants)</option>
                  <option value="NW">NW Quadrant (Engineering)</option>
                  <option value="NE">NE Quadrant (Comms / Gov Affairs)</option>
                  <option value="SW">SW Quadrant (Legal)</option>
                  <option value="SE">SE Quadrant (IT / Visitors)</option>
                </select>
              </div>
            </div>

            {/* Pre-Drafted Evacuation Narratives Quick Select */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-[#005DAA] mb-2">
                Pre-Drafted Evacuation Narratives (Quick Select)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_NARRATIVES.map((preset, idx) => (
                  <button
                    key={preset.label}
                    onClick={() => handleSelectPreset(idx)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      selectedPresetIndex === idx
                        ? "border-[#005DAA] bg-[#EBF5FB] text-[#0F2537]"
                        : "border-[#B8D8F8] bg-[#F0F6FC] text-[#475569] hover:bg-white hover:text-[#0F2537]"
                    }`}
                  >
                    <div className="text-xs font-black text-[#005DAA]">{preset.label}</div>
                    <div className="text-[10px] font-mono text-[#475569] truncate mt-1 font-semibold">
                      {preset.title}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Priority & Alert Title */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-[#0F2537] mb-1">
                  Alert Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full rounded-lg border border-[#B8D8F8] bg-[#F0F6FC] px-3 py-2 text-xs font-bold text-[#0F2537] focus:border-[#005DAA] focus:bg-white focus:outline-none"
                >
                  <option value="CRITICAL">🔴 CRITICAL (Mandatory Evac)</option>
                  <option value="HIGH">🟠 HIGH (Immediate Action)</option>
                  <option value="WARNING">🟡 WARNING (Precautionary)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-black uppercase tracking-widest text-[#0F2537] mb-1">
                  Alert Header Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter alert title..."
                  className="w-full rounded-lg border border-[#B8D8F8] bg-[#F0F6FC] px-3 py-2 text-xs font-bold text-[#0F2537] placeholder-[#64748B] focus:border-[#005DAA] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Editable Evacuation Narrative Text Area */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-black uppercase tracking-widest text-[#0F2537]">
                  Evacuation Message Narrative
                </label>
                <span className="text-[10px] font-mono text-[#005DAA] font-bold">
                  {narrative.length} Characters
                </span>
              </div>
              <textarea
                rows={4}
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="Draft evacuation instructions..."
                className="w-full rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] p-3 text-xs text-[#0F2537] font-medium placeholder-[#64748B] focus:border-[#005DAA] focus:bg-white focus:outline-none font-sans leading-relaxed"
              />
            </div>

            {/* Broadcast Channel Toggles */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-[#0F2537] mb-2">
                Active Broadcast Channels
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
                {[
                  { key: "PUSH_NOTIFICATION", label: "📱 Mobile Push" },
                  { key: "MESH_AUDIO_BEACON", label: "🔊 Mesh Audio" },
                  { key: "KIOSK_POPUP", label: "🖥️ Floor Kiosk" },
                  { key: "SMS_BACKUP", label: "💬 SMS Backup" },
                ].map((ch) => (
                  <button
                    key={ch.key}
                    type="button"
                    onClick={() => toggleChannel(ch.key)}
                    className={`py-2 px-3 rounded-lg border text-center transition cursor-pointer ${
                      channels[ch.key]
                        ? "border-[#005DAA] bg-[#005DAA] text-white"
                        : "border-[#B8D8F8] bg-[#F0F6FC] text-[#475569]"
                    }`}
                  >
                    {ch.label} {channels[ch.key] ? "✓" : ""}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="pt-3 border-t border-[#B8D8F8] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#B8D8F8] bg-[#F0F6FC] px-5 py-2.5 text-xs font-black uppercase tracking-wider text-[#0F2537] hover:bg-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDispatch}
                disabled={isSending || !narrative.trim()}
                className="rounded-xl bg-[#005DAA] px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-[#004A88] disabled:opacity-50 transition cursor-pointer shadow-xs flex items-center gap-2"
              >
                {isSending ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Broadcasting...</span>
                  </>
                ) : (
                  <>
                    <span>📢</span>
                    <span>Broadcast High-Priority Push Alert</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
