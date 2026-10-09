import React, { useState } from "react";
import { EmergencyAlertPayload, QuadrantId, StatusSnapshot } from "../../types";
import { speakEmergencyBroadcast, testAiVoice } from "../../lib/audioBroadcast";

interface Step4BroadcastProps {
  snapshot: StatusSnapshot | null;
  onSendAlert: (alertData: {
    title: string;
    narrative: string;
    priority: "CRITICAL" | "HIGH" | "WARNING";
    targetQuadrants: ("ALL" | QuadrantId)[];
    channels: string[];
  }) => Promise<EmergencyAlertPayload | void>;
  onProceedNext: () => void;
  onOpenWalkieTalkie?: () => void;
}

export const Step4Broadcast: React.FC<Step4BroadcastProps> = ({
  snapshot,
  onSendAlert,
  onProceedNext,
  onOpenWalkieTalkie,
}) => {
  const hazard = snapshot?.hazardType || "office-fire";
  const isIncident = snapshot?.mode === "incident";
  const [isPlayingTestVoice, setIsPlayingTestVoice] = useState(false);

  const defaultTitle = isIncident
    ? `🚨 EMERGENCY EVACUATION: ${hazard.toUpperCase().replace("-", " ")} ON FLOOR 07`
    : `🎯 LIFE-SAFETY DRILL: FLOOR 07 EVACUATION EXERCISE`;

  const defaultNarrative = isIncident
    ? `FSD Directive: Immediate evacuation ordered for all Floor 07 personnel. Please proceed calmly to designated Stairwell A. Do not use elevators. Assemble at Union Sq East / Park Plaza.`
    : `FSD Drill Announcement: Scheduled emergency evacuation drill is now in progress. All occupants please badge out or self-check-in at external muster point.`;

  const [title, setTitle] = useState<string>(defaultTitle);
  const [narrative, setNarrative] = useState<string>(defaultNarrative);
  const [priority, setPriority] = useState<"CRITICAL" | "HIGH" | "WARNING">(
    isIncident ? "CRITICAL" : "HIGH"
  );
  const [targetAll, setTargetAll] = useState<boolean>(true);
  const [selectedQuadrants, setSelectedQuadrants] = useState<QuadrantId[]>(["NW", "NE", "SW", "SE"]);
  const [channels, setChannels] = useState<{ [key: string]: boolean }>({
    push: true,
    sms: true,
    pa: true,
    signage: true,
  });
  const [isSending, setIsSending] = useState<boolean>(false);
  const [broadcastHistory, setBroadcastHistory] = useState<
    Array<{
      id: string;
      title: string;
      priority: string;
      sentAt: string;
      recipients: number;
      channels: string[];
    }>
  >([]);

  const handleToggleQuadrant = (qid: QuadrantId) => {
    if (selectedQuadrants.includes(qid)) {
      if (selectedQuadrants.length === 1) return; // Keep at least one
      setSelectedQuadrants(selectedQuadrants.filter((q) => q !== qid));
      setTargetAll(false);
    } else {
      const next = [...selectedQuadrants, qid];
      setSelectedQuadrants(next);
      if (next.length === 4) setTargetAll(true);
    }
  };

  const handleToggleAll = (all: boolean) => {
    setTargetAll(all);
    if (all) setSelectedQuadrants(["NW", "NE", "SW", "SE"]);
  };

  const handleTestVoice = async () => {
    setIsPlayingTestVoice(true);
    try {
      await testAiVoice();
    } finally {
      setIsPlayingTestVoice(false);
    }
  };

  const handleDispatch = async () => {
    if (!title.trim() || !narrative.trim()) return;
    setIsSending(true);

    const activeChannels = Object.keys(channels).filter((k) => channels[k]);
    const targetPayload = targetAll ? ["ALL" as const] : selectedQuadrants;

    try {
      const res = await onSendAlert({
        title,
        narrative,
        priority,
        targetQuadrants: targetPayload,
        channels: activeChannels,
      });

      speakEmergencyBroadcast(narrative, priority, { playChime: true });

      const entry = {
        id: `BCST-${Date.now().toString().slice(-4)}`,
        title,
        priority,
        sentAt: new Date().toLocaleTimeString(),
        recipients: snapshot?.occupants?.length ?? snapshot?.expectedOnFloor ?? 0,
        channels: activeChannels,
      };

      setBroadcastHistory((prev) => [entry, ...prev]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div id="step-4-broadcast-container" className="max-w-6xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-[#B8D8F8] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#005DAA] uppercase tracking-wider mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#005DAA]" />
            STEP 04 OF 05 · MULTI-CHANNEL EMERGENCY BROADCAST
          </div>
          <h2 className="text-2xl font-black tracking-tight text-[#0F2537]">
            Push Emergency Alert to Every Device
          </h2>
          <p className="text-sm text-[#475569] mt-1 max-w-2xl">
            Commander broadcasts instant life-safety alerts across all occupant mobile devices, SMS emergency gateways, in-building PA speaker channels, and digital safety displays.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-[#F0F6FC] px-4 py-2.5 rounded-xl border border-[#CBDCEE] text-right">
            <div className="text-[10px] font-mono font-bold text-[#475569] uppercase">Total Recipients</div>
            <div className="text-xl font-mono font-black text-[#005DAA]">
              {snapshot?.occupants?.length ?? snapshot?.expectedOnFloor ?? 0} <span className="text-xs text-[#64748B]">Devices</span>
            </div>
          </div>

          <button
            id="step4-proceed-btn"
            onClick={onProceedNext}
            className="px-5 py-3 rounded-xl bg-[#005DAA] hover:bg-[#004884] text-white font-black text-sm tracking-wide transition shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <span>Proceed to Step 05</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* Industrial Walkie-Talkie (PTT) & Natural Voice Station */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Card: Warden Walkie-Talkie Push-to-Talk (8 cols) */}
        <div className="md:col-span-8 bg-gradient-to-r from-[#0B1728] via-[#10243C] to-[#0B1728] rounded-2xl p-5 border-2 border-[#1E3E66] shadow-xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-2xl shadow-inner shrink-0">
              📻
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-wide text-white uppercase flex items-center gap-1.5">
                  <span>Warden Walkie-Talkie Radio Station</span>
                  <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40">
                    LIVE PTT
                  </span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-lg leading-relaxed">
                Authorized Floor Wardens and FSD Chief Commanders can transmit live spoken voice dispatches with real-time acoustic radio effects and live speech transcription directly to all floor occupant devices.
              </p>
            </div>
          </div>

          <button
            id="step4-launch-walkie-btn"
            type="button"
            onClick={onOpenWalkieTalkie}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-95"
          >
            <span className="text-base">🎙️</span>
            <span>Key Walkie-Talkie</span>
          </button>
        </div>

        {/* Right Card: AI Voice Clarity Preview (4 cols) */}
        <div className="md:col-span-4 bg-white rounded-2xl p-5 border border-[#B8D8F8] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-mono font-bold text-[#005DAA] uppercase tracking-wider flex items-center gap-1">
                <span>✨</span>
                <span>Natural Voice Engine</span>
              </span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                PA Chime Active
              </span>
            </div>
            <p className="text-xs text-[#475569]">
              Replaced robotic synthesizer with natural human cadence (0.94 rate), warm vocal authority, and commercial PA acoustic chime.
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestVoice}
            disabled={isPlayingTestVoice}
            className="mt-3 w-full py-2.5 bg-[#F0F6FC] hover:bg-[#E2EEF9] border border-[#CBDCEE] text-[#005DAA] font-black text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>{isPlayingTestVoice ? "🔊 Playing Announcement..." : "🔊 Test Clear AI Voice"}</span>
          </button>
        </div>
      </div>

      {/* Broadcast Composer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Broadcast Composer (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-6 border border-[#B8D8F8] shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-black text-[#0F2537] flex items-center gap-2">
              <span>📡</span>
              <span>Emergency Dispatch Message Composer</span>
            </h3>
            <span className="text-xs font-mono text-[#005DAA] bg-[#EBF3FB] px-2.5 py-0.5 rounded font-bold">
              Instant Push Ready
            </span>
          </div>

          {/* Priority Selector */}
          <div>
            <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">
              Broadcast Priority Level
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "CRITICAL", label: "🔴 Critical (Immediate Evac)", bg: "bg-red-50 text-red-950 border-red-500" },
                { id: "HIGH", label: "🟠 High (Urgent Action)", bg: "bg-amber-50 text-amber-950 border-amber-500" },
                { id: "WARNING", label: "🟡 Warning (Notice / Drill)", bg: "bg-yellow-50 text-yellow-950 border-yellow-500" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPriority(p.id as any)}
                  className={`p-3 rounded-xl border-2 text-xs font-black transition cursor-pointer text-center ${
                    priority === p.id ? `${p.bg} shadow-xs ring-2 ring-slate-900/10` : "border-slate-200 text-slate-600 bg-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject Line */}
          <div>
            <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
              Alert Subject Header *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-black text-[#0F2537] outline-hidden focus:ring-2 focus:ring-[#005DAA]"
              placeholder="e.g. MANDATORY EVACUATION: Office Fire on Floor 07"
            />
          </div>

          {/* Narrative Body */}
          <div>
            <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
              Evacuation Instructions &amp; Action Directives *
            </label>
            <textarea
              rows={4}
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              className="w-full p-3 bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl text-xs font-medium text-[#0F2537] outline-hidden focus:ring-2 focus:ring-[#005DAA]"
              placeholder="Enter exact evacuation instructions for occupants..."
            />
          </div>

          {/* Target Zones */}
          <div>
            <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">
              Target Broadcast Zones
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleToggleAll(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                  targetAll
                    ? "bg-[#005DAA] text-white shadow-xs"
                    : "bg-[#F0F6FC] text-[#005DAA] border border-[#CBDCEE]"
                }`}
              >
                ✓ ALL FLOOR 07 ({snapshot?.occupants?.length ?? snapshot?.expectedOnFloor ?? 0} Personnel)
              </button>

              {(["NW", "NE", "SW", "SE"] as QuadrantId[]).map((qid) => {
                const isSelected = selectedQuadrants.includes(qid);
                return (
                  <button
                    key={qid}
                    type="button"
                    onClick={() => handleToggleQuadrant(qid)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? "bg-[#005DAA] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Quadrant {qid}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dispatch Button */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-[#64748B]">
              Broadcast dispatches in &lt;100ms via Con Ed mesh gateway.
            </div>

            <button
              type="button"
              onClick={handleDispatch}
              disabled={isSending || !title.trim() || !narrative.trim()}
              className="px-8 py-3.5 bg-[#FF6B00] hover:bg-[#FF8533] text-slate-950 font-black text-sm uppercase tracking-wider rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span className="text-lg">📢</span>
              <span>{isSending ? "Dispatching Broadcast..." : "Send Emergency Alert Now"}</span>
            </button>
          </div>
        </div>

        {/* Right Column: Active Channels & Live Delivery Receipts (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Channels Selector */}
          <div className="bg-white rounded-2xl p-5 border border-[#B8D8F8] shadow-xs space-y-3">
            <h3 className="text-sm font-black text-[#0F2537]">Active Delivery Channels</h3>
            <div className="space-y-2.5 text-xs">
              {[
                { id: "push", label: "Mobile Occupant Web Push", desc: "Instant banner on all smartphones" },
                { id: "sms", label: "SMS Emergency Gateway", desc: "Twilio failover for low data connections" },
                { id: "pa", label: "Building PA Audio Chime", desc: "Floor 07 acoustic tone broadcast" },
                { id: "signage", label: "Digital Signage Displays", desc: "Hallway & elevator screen takeover" },
              ].map((ch) => (
                <label
                  key={ch.id}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-[#F8FAFC] transition cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={channels[ch.id]}
                    onChange={(e) =>
                      setChannels((prev) => ({ ...prev, [ch.id]: e.target.checked }))
                    }
                    className="mt-0.5 rounded border-[#CBDCEE] text-[#005DAA]"
                  />
                  <div>
                    <div className="font-bold text-[#0F2537]">{ch.label}</div>
                    <div className="text-[11px] text-[#64748B]">{ch.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Target Audience: Registered Personnel */}
          <div className="bg-white rounded-2xl p-5 border border-[#B8D8F8] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-[#0F2537] flex items-center gap-1.5">
                <span>📱</span>
                <span>Drill Notification Audience</span>
              </h3>
              <span className="text-[10px] font-mono text-[#005DAA] font-bold bg-[#EBF3FB] px-2 py-0.5 rounded">
                {snapshot?.occupants?.length || 0} Registered
              </span>
            </div>

            {(!snapshot?.occupants || snapshot.occupants.length === 0) ? (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-bold">⚠️ Roster Currently Empty (Ready for Intake)</div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  No occupants are currently intaken. Personnel who sign in via the Step 01 QR code, Kiosk, or Quick Intake will appear here and receive direct push alerts and emergency SMS broadcasts.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto divide-y divide-slate-100">
                {snapshot.occupants.map((occ) => (
                  <div key={occ.id} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-[#0F2537] flex items-center gap-1">
                        <span>{occ.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({occ.id})</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {occ.phone || "No phone registered"} · Sector {occ.quadrant}
                      </div>
                    </div>
                    <span className="text-[9px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded">
                      {occ.phone ? "SMS + PUSH" : "PORTAL PUSH"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Broadcast Delivery History */}
          <div className="bg-white rounded-2xl p-5 border border-[#B8D8F8] shadow-xs space-y-3">
            <h3 className="text-sm font-black text-[#0F2537] flex items-center justify-between">
              <span>Dispatch Receipts</span>
              <span className="text-[10px] font-mono text-[#005DAA] font-bold">
                {broadcastHistory.length} Sent
              </span>
            </h3>

            {broadcastHistory.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#64748B] bg-[#F8FAFC] rounded-xl border border-dashed border-[#CBDCEE]">
                No broadcasts sent yet during this session. Send an alert above to verify delivery.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {broadcastHistory.map((bc) => (
                  <div
                    key={bc.id}
                    className="p-3 bg-[#F0F6FC] rounded-xl border border-[#CBDCEE] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold text-[#0F2537]">
                      <span className="truncate max-w-[160px]">{bc.title}</span>
                      <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                        ✓ Delivered
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#64748B] font-mono">
                      <span>{bc.sentAt}</span>
                      <span>{bc.recipients} Recipients</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
