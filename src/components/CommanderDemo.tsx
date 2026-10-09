import { useEffect, useMemo, useRef, useState } from "react";

/**
 * MusterCommand — FSD Commander Console (interactive demo)
 * Single-file artifact version with 10x drill simulation clock.
 */

const EXPECTED = 194;
const TARGET_S = 180;
const SPEED = 10;

const C = {
  bg: "#F0F6FC",
  panel: "#FFFFFF",
  line: "#B8D8F8",
  text: "#0F2537",
  muted: "#475569",
  safe: "#15803D",
  amber: "#005DAA",
  danger: "#DC2626",
  sky: "#005DAA",
};

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const QUADRANTS = [
  { id: "NW", label: "NW · Engineering", expected: 49 },
  { id: "NE", label: "NE · Comms/Gov Affairs", expected: 49 },
  { id: "SW", label: "SW · Legal", expected: 49 },
  { id: "SE", label: "SE · IT/Visitors", expected: 48 },
];

const SCRIPT = [
  { t: 0, log: "incident-declared · drill · office-fire · Floor 7", id: "L-0001" },
  { t: 4, log: "4 occupants flagged AWAITING EVAC-CHAIR at ARA, Stair A landing", id: "L-0002", ara: true },
  { t: 8, log: "evac-chair partners notified via targeted push", id: "L-0003" },
  { t: 58, log: "WEARABLE: fall-detected — Occupant 87 (NE), Stair B — auto need-help", id: "L-0214", needHelp: true },
  { t: 96, log: "Occupant 87 checked in SAFE at Zone B — need-help resolved", id: "L-0342", resolveHelp: true },
  { t: 112, log: "4 ARA occupants confirmed with FDNY Truck company — evacuated", id: "L-0398", resolveAra: true },
  { t: 120, log: "MIA ESCALATION: Occupant 141 (SW) unaccounted past threshold", id: "L-0410", mia: true },
  { t: 149, log: "Occupant 141 checked in SAFE at Zone C — MIA resolved", id: "L-0455", resolveMia: true },
];

function accountedAt(t: number) {
  if (t <= 0) return 0;
  if (t >= 149) return EXPECTED;
  const x = Math.min(t / 130, 1);
  const s = x * x * (3 - 2 * x);
  return Math.min(194, Math.round(194 * s));
}

function fmtClock(t: number) {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function CommanderDemo() {
  const [running, setRunning] = useState(false);
  const [t, setT] = useState(0);
  const [events, setEvents] = useState<any[]>([]);
  const [ara, setAra] = useState(0);
  const [needHelp, setNeedHelp] = useState(0);
  const [mia, setMia] = useState(0);
  const [allSafeAt, setAllSafeAt] = useState<number | null>(null);
  const scriptIdx = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);

  const accounted = accountedAt(t);
  const done = allSafeAt !== null;

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setT((prev) => prev + 2), 2000 / SPEED);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    while (scriptIdx.current < SCRIPT.length && SCRIPT[scriptIdx.current].t <= t && running) {
      const ev = SCRIPT[scriptIdx.current];
      scriptIdx.current += 1;
      setEvents((prev) => [...prev, { ...ev, at: fmtClock(ev.t) }]);
      if (ev.ara) setAra(4);
      if (ev.resolveAra) setAra(0);
      if (ev.needHelp) setNeedHelp(1);
      if (ev.resolveHelp) setNeedHelp(0);
      if (ev.mia) setMia(1);
      if (ev.resolveMia) setMia(0);
    }
    if (running && accountedAt(t) >= EXPECTED && allSafeAt === null) {
      const finalT = 149;
      setAllSafeAt(finalT);
      setRunning(false);
      setEvents((prev) => [
        ...prev,
        { t: finalT, at: fmtClock(finalT), id: "L-0456", log: `ALL ACCOUNTED — ${EXPECTED}/${EXPECTED} in ${finalT}s (target <${TARGET_S}s)`, final: true },
      ]);
    }
  }, [t, running, allSafeAt]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  const start = () => {
    scriptIdx.current = 0;
    setT(0);
    setEvents([]);
    setAra(0);
    setNeedHelp(0);
    setMia(0);
    setAllSafeAt(null);
    setRunning(true);
  };

  const reset = () => {
    setRunning(false);
    scriptIdx.current = 0;
    setT(0);
    setEvents([]);
    setAra(0);
    setNeedHelp(0);
    setMia(0);
    setAllSafeAt(null);
  };

  const quadStats = useMemo(() => {
    let remaining = accounted;
    return QUADRANTS.map((q, i) => {
      const share = i === QUADRANTS.length - 1 ? remaining : Math.min(q.expected, Math.round(accounted * (q.expected / EXPECTED)));
      remaining -= share;
      const qNeedHelp = q.id === "NE" ? needHelp : 0;
      const qMia = q.id === "SW" ? mia : 0;
      return { ...q, accounted: Math.max(0, Math.min(q.expected, share)), needHelp: qNeedHelp, mia: qMia };
    });
  }, [accounted, needHelp, mia]);

  const started = t > 0 || running;
  const pct = accounted / EXPECTED;
  const critical = needHelp > 0 || mia > 0;
  const r = 84;
  const circ = 2 * Math.PI * r;

  const tone = (q: any) => {
    if (q.needHelp > 0 || q.mia > 0) return C.danger;
    if (q.accounted < q.expected) return C.amber;
    return C.safe;
  };

  return (
    <div className="rounded-2xl border border-[#B8D8F8] p-2 sm:p-4 bg-white text-[#0F2537] font-sans shadow-sm w-full max-w-full overflow-hidden">
      <div style={{ background: "#005DAA", color: "#FFFFFF", textAlign: "center", padding: "6px 12px", fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase" }} className="rounded-t-lg">
        Interactive Simulation — 10× Compressed Floor 7 Evacuation Replay
      </div>

      <div
        role="status"
        style={{
          padding: "10px 12px",
          background: started ? (done ? "#15803D" : "#003B70") : "#EBF5FB",
          color: started ? "#fff" : "#005DAA",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <span className="text-xs">{started ? (done ? "Drill complete — office-fire · Floor 7" : "DRILL SIMULATION — office-fire · Floor 7") : "Standby — Press Start to simulate"}</span>
        <span style={{ fontFamily: MONO, fontSize: 14 }}>{started ? fmtClock(Math.min(t, allSafeAt ?? t)) : "0:00"}</span>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "12px 6px" }} className="w-full max-w-full overflow-hidden">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", justifyContent: "center" }} className="w-full max-w-full">
          {/* Ring */}
          <div style={{ position: "relative", width: 200, height: 200, flexShrink: 0 }} role="img">
            <svg viewBox="0 0 200 200" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
              <circle cx="100" cy="100" r={r} fill="none" stroke={C.line} strokeWidth="14" />
              <circle
                cx="100"
                cy="100"
                r={r}
                fill="none"
                stroke={critical ? C.danger : pct >= 1 ? C.safe : C.amber}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - Math.min(pct, 1))}
                style={{ transition: "stroke-dashoffset 300ms ease, stroke 300ms ease" }}
              />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontFamily: MONO, fontSize: 32, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                {accounted}
                <span style={{ fontSize: 16, color: C.muted, fontWeight: 500 }}> / {EXPECTED}</span>
              </div>
              <div style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: C.muted }}>accounted</div>
              {critical && (
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: C.danger }}>
                  {needHelp > 0 ? `${needHelp} need help` : ""}
                  {needHelp > 0 && mia > 0 ? " · " : ""}
                  {mia > 0 ? `${mia} MIA` : ""}
                </div>
              )}
              {done && <div style={{ marginTop: 4, fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.safe }}>all-safe {allSafeAt}s</div>}
            </div>
          </div>

          <div style={{ flex: "1 1 280px", minWidth: 0 }} className="w-full max-w-full min-w-0">
            {ara > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: `2px solid ${C.sky}`, borderRadius: 12, padding: "8px 12px", marginBottom: 10, background: "rgba(56,189,248,0.08)" }}>
                <span style={{ fontWeight: 700, color: C.sky, fontSize: 13 }}>Area of Rescue Assistance</span>
                <span style={{ fontFamily: MONO, fontWeight: 700, color: C.sky, fontSize: 14 }}>{ara} awaiting evac chair</span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
              {quadStats.map((q) => (
                <div key={q.id} style={{ border: `2px solid ${tone(q)}`, borderRadius: 12, padding: "10px 10px", background: C.panel }}>
                  <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted }}>{q.label}</div>
                  <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                    {q.accounted}
                    <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}> / {q.expected}</span>
                  </div>
                  <div style={{ marginTop: 2, fontSize: 10, fontWeight: 700, minHeight: 14 }}>
                    {q.needHelp > 0 && <span style={{ color: C.danger }}>{q.needHelp} need help</span>}
                    {q.mia > 0 && <span style={{ color: C.danger }}>{q.mia} MIA</span>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12 }} className="w-full">
              <button
                onClick={start}
                disabled={running}
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "none",
                  background: running ? C.line : C.text,
                  color: running ? C.muted : C.bg,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: running ? "default" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {started ? "Replay drill" : "Start drill simulation"}
              </button>
              <button
                onClick={reset}
                style={{ padding: "10px 16px", borderRadius: 12, border: `1px solid ${C.line}`, background: "transparent", color: C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
              >
                Reset
              </button>
            </div>
            <p style={{ marginTop: 6, fontSize: 11, color: C.muted, lineHeight: 1.4 }}>
              Compressed replay at {SPEED}× — full Floor 7 drill (200 roster, 5 badged out, 4 ARA, 11 visitors) in ~15 seconds.
            </p>
          </div>
        </div>

        <div style={{ marginTop: 14, border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel }} className="w-full max-w-full overflow-hidden">
          <div style={{ padding: "8px 12px", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted, borderBottom: `1px solid ${C.line}` }}>
            Audit ledger — hash-chained event feed
          </div>
          <div ref={logRef} style={{ maxHeight: 180, overflowY: "auto", overflowX: "hidden", wordBreak: "break-word", padding: "8px 12px", fontFamily: MONO, fontSize: 11, lineHeight: 1.6 }}>
            {events.length === 0 ? (
              <div style={{ color: C.muted }}>Start the simulation to stream live hash-chained ledger events.</div>
            ) : (
              events.map((ev) => (
                <div key={ev.id} style={{ color: ev.final ? C.safe : ev.mia || ev.needHelp ? C.danger : C.text }}>
                  <span style={{ color: C.muted }}>[{ev.at}] {ev.id} </span>
                  {ev.log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Executive Presentation Demo Script & Technical Architecture Guide */}
        <div className="mt-5 pt-4 border-t border-[#B8D8F8] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-[#005DAA] flex items-center gap-2">
              <span>🎙️</span> Official Life-Safety Presentation Script & Architecture Guide
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#EBF5FB] text-[#005DAA] border border-[#B8D8F8]">
              PRESENTATION READY
            </span>
          </div>

          {/* 5-Step Demo Script */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-[#F0F6FC] rounded-xl border border-[#B8D8F8] space-y-2">
              <div className="font-black text-[#005DAA] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#005DAA] text-white flex items-center justify-center text-[10px]">1</span>
                Biometric Login & Instant Access
              </div>
              <p className="text-[#475569] font-medium leading-relaxed">
                <strong>Speaker script:</strong> "We sign in with Touch ID / Face ID via WebAuthn in 1 tap, instantly verifying our FSD Commander identity without vulnerable passwords. Occupants and visitors can also tap 'Guest Access' to access life-saving routes immediately."
              </p>
            </div>

            <div className="p-3.5 bg-[#F0F6FC] rounded-xl border border-[#B8D8F8] space-y-2">
              <div className="font-black text-[#005DAA] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#005DAA] text-white flex items-center justify-center text-[10px]">2</span>
                Real-Time Presence: Inside vs. Offsite
              </div>
              <p className="text-[#475569] font-medium leading-relaxed">
                <strong>Speaker script:</strong> "The system automatically reconciles badged-out personnel, PTO rosters, and on-floor visitors. Notice how the expected headcount is exactly 194 on Floor 07, eliminating phantom missing persons from the start."
              </p>
            </div>

            <div className="p-3.5 bg-[#F0F6FC] rounded-xl border border-[#B8D8F8] space-y-2">
              <div className="font-black text-[#005DAA] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#005DAA] text-white flex items-center justify-center text-[10px]">3</span>
                Declare Drill vs. Real Incident & Dynamic Egress
              </div>
              <p className="text-[#475569] font-medium leading-relaxed">
                <strong>Speaker script:</strong> "Clicking 'Declare Drill' locks the system into active accounting. Notice how the hazard routing dynamically marks Stairwell B as 100% CLEAR and warns occupants in real-time away from Stairwell A due to smoke drift."
              </p>
            </div>

            <div className="p-3.5 bg-[#F0F6FC] rounded-xl border border-[#B8D8F8] space-y-2">
              <div className="font-black text-[#005DAA] flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#005DAA] text-white flex items-center justify-center text-[10px]">4</span>
                1-Click Digital Warden Sweeps (200–400 Scale)
              </div>
              <p className="text-[#475569] font-medium leading-relaxed">
                <strong>Speaker script:</strong> "Instead of manual paper clipboards taking 15 minutes, wardens conduct digital sweeps in seconds. We can scale our building density from 200 up to 400 occupants with 0 latency."
              </p>
            </div>
          </div>

          {/* Technical Stack Architecture & Security Q&A */}
          <div className="p-4 bg-white rounded-xl border border-[#B8D8F8] space-y-3">
            <h4 className="text-xs font-black uppercase text-[#005DAA]">
              Frequently Asked Technical Questions (Inspector & Audit Defense)
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 bg-[#F0F6FC] rounded-lg">
                <div className="font-black text-[#0F2537]">Q: What happens if cellular or cloud internet fails during an emergency?</div>
                <p className="text-[#475569] mt-0.5 font-medium">
                  <strong>A:</strong> The architecture supports local peer mesh fallback with dual-transport Server-Sent Events and localized cryptographic ledger storage. Kiosks and warden devices operate uninterrupted offline and sync via SHA-256 block reconciliation once reconnected.
                </p>
              </div>

              <div className="p-2.5 bg-[#F0F6FC] rounded-lg">
                <div className="font-black text-[#0F2537]">Q: How are individuals with mobility impairments (ARA) handled?</div>
                <p className="text-[#475569] mt-0.5 font-medium">
                  <strong>A:</strong> Occupants can tap "Request Evacuation Chair" directly from their phones. The FSD console immediately highlights their exact quadrant and directs designated Evac Chair response teams to their landing with priority dispatch.
                </p>
              </div>

              <div className="p-2.5 bg-[#F0F6FC] rounded-lg">
                <div className="font-black text-[#0F2537]">Q: How does the system guarantee records cannot be falsified after a drill?</div>
                <p className="text-[#475569] mt-0.5 font-medium">
                  <strong>A:</strong> Every check-in, sweep, and incident status change creates an immutable SHA-256 block cryptographically linked to the previous transaction hash, satisfying OSHA 1910.38 and NFPA 101 compliance standards.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

