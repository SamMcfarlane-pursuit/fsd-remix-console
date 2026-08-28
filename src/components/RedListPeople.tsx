import { useState, useEffect } from "react";
import { Occupant, OccupantStatus, RedListQueryResponse } from "../types";

interface RedListPeopleProps {
  occupants: Occupant[];
  onCheckIn: (occupantId: string, status: OccupantStatus, via?: string, notes?: string) => Promise<void>;
  onBulkCheckIn?: (occupantIds: string[], status: OccupantStatus, via?: string, notes?: string) => Promise<void>;
  initialQuadrant?: string;
}

export default function RedListPeople({ occupants, onCheckIn, onBulkCheckIn, initialQuadrant = "ALL" }: RedListPeopleProps) {
  const [nlQuery, setNlQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [aiQueryResult, setAiQueryResult] = useState<RedListQueryResponse | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("at-risk");
  const [selectedQuadrant, setSelectedQuadrant] = useState<string>(initialQuadrant);

  useEffect(() => {
    if (initialQuadrant) {
      setSelectedQuadrant(initialQuadrant);
    }
  }, [initialQuadrant]);
  const [textSearch, setTextSearch] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Batch Multi-Select state ("Mark down a list")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Quick chips for 6B
  const SAMPLE_QUERIES = [
    "who's still missing from SW Legal?",
    "show everyone who took longer than 3 minutes",
    "who's at the ARA right now?",
    "unaccounted visitors",
  ];

  // Natural language AI query handler (6B)
  const handleNlSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsSearching(true);
    setStatusMessage("Querying AI assist layer grounded in ledger...");
    try {
      const res = await fetch("/api/ai/redlist-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryText }),
      });
      if (res.ok) {
        const data: RedListQueryResponse = await res.json();
        setAiQueryResult(data);
        setStatusMessage(null);
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.warn("NL Query network fallback applied:", err);
      // Fallback local search matching query terms
      const q = queryText.toLowerCase();
      const matched = occupants.filter((o) => {
        if (q.includes("missing") || q.includes("unaccounted")) return o.status !== "safe";
        if (q.includes("help")) return o.status === "need-help";
        if (q.includes("ara") || q.includes("chair")) return o.status === "awaiting-evac-chair";
        if (q.includes("visitor")) return o.role === "Visitor";
        if (q.includes("sw")) return o.quadrant === "SW";
        if (q.includes("nw")) return o.quadrant === "NW";
        if (q.includes("ne")) return o.quadrant === "NE";
        if (q.includes("se")) return o.quadrant === "SE";
        return o.name.toLowerCase().includes(q) || o.role.toLowerCase().includes(q);
      });
      setAiQueryResult({
        answer: `Local query results for "${queryText}": Found ${matched.length} occupant(s).`,
        matchedOccupants: matched,
        totalMatched: matched.length,
      });
      setStatusMessage(null);
    } finally {
      setIsSearching(false);
    }
  };

  // Voice speech-to-text handler (6B / 6D)
  const toggleSpeechRecognition = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Speech recognition is not supported in this browser window. Please type your query.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setStatusMessage("Listening... Speak your query or voice check-in.");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setNlQuery(transcript);
        setIsListening(false);
        setStatusMessage(`Recognized: "${transcript}"`);
        handleNlSearch(transcript);
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setStatusMessage("⚠️ Microphone access disabled. Type your query in the input box above.");
          console.warn("Speech recognition access restricted:", event.error);
        } else if (event.error === "no-speech") {
          setStatusMessage("No voice detected. Please try again or type your query.");
        } else {
          setStatusMessage(`Voice input note (${event.error || "unavailable"}). Please type your query.`);
          console.warn("Speech recognition status:", event.error);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  };

  // Determine displayed list
  let displayedOccupants = occupants.filter((o) => !o.badgedOut && !o.offSiteToday);

  // Stats calculation for Admin Breakdown
  const totalEmployees = occupants.filter((o) => o.role !== "Visitor");
  const safeEmployees = totalEmployees.filter((o) => o.status === "safe").length;
  const unaccountedEmployees = totalEmployees.filter((o) => o.status !== "safe").length;

  const totalVisitors = occupants.filter((o) => o.role === "Visitor");
  const safeVisitors = totalVisitors.filter((o) => o.status === "safe").length;
  const unaccountedVisitors = totalVisitors.filter((o) => o.status !== "safe").length;

  // Category filter state (ALL | EMPLOYEE | VISITOR)
  const [roleCategory, setRoleCategory] = useState<"ALL" | "EMPLOYEE" | "VISITOR">("ALL");

  // Filter by Role Category
  if (roleCategory === "EMPLOYEE") {
    displayedOccupants = displayedOccupants.filter((o) => o.role !== "Visitor");
  } else if (roleCategory === "VISITOR") {
    displayedOccupants = displayedOccupants.filter((o) => o.role === "Visitor");
  }

  // If AI query active, prioritize matched occupants from AI result
  if (aiQueryResult) {
    const matchedIds = new Set(aiQueryResult.matchedOccupants.map((m) => m.id));
    displayedOccupants = displayedOccupants.filter((o) => matchedIds.has(o.id));
  } else {
    // Standard status filter
    if (activeFilter === "at-risk") {
      displayedOccupants = displayedOccupants.filter((o) => o.status !== "safe");
    } else if (activeFilter === "unaccounted") {
      displayedOccupants = displayedOccupants.filter((o) => o.status === "unaccounted");
    } else if (activeFilter === "safe") {
      displayedOccupants = displayedOccupants.filter((o) => o.status === "safe");
    } else if (activeFilter === "need-help") {
      displayedOccupants = displayedOccupants.filter((o) => o.status === "need-help");
    } else if (activeFilter === "mia") {
      displayedOccupants = displayedOccupants.filter((o) => o.status === "mia");
    } else if (activeFilter === "evac-chair") {
      displayedOccupants = displayedOccupants.filter((o) => o.status === "awaiting-evac-chair");
    } else if (activeFilter === "visitors") {
      displayedOccupants = displayedOccupants.filter((o) => o.role === "Visitor");
    } else if (activeFilter === "likely-mia") {
      displayedOccupants = displayedOccupants.filter((o) => o.likelyMia || (o.unaccountedMinutes ?? 0) >= 3);
    }

    if (selectedQuadrant !== "ALL") {
      displayedOccupants = displayedOccupants.filter((o) => o.quadrant === selectedQuadrant);
    }

    if (textSearch.trim()) {
      const q = textSearch.toLowerCase();
      displayedOccupants = displayedOccupants.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          o.role.toLowerCase().includes(q)
      );
    }
  }

  // Batch selection handlers ("Mark down a list")
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllDisplayed = () => {
    const allIds = displayedOccupants.map((o) => o.id);
    setSelectedIds(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBatchStatusUpdate = async (targetStatus: OccupantStatus) => {
    if (selectedIds.size === 0) return;
    const ids: string[] = Array.from(selectedIds);
    if (onBulkCheckIn) {
      await onBulkCheckIn(ids, targetStatus, "batch-list-override", `Admin batch marked ${ids.length} occupants as ${targetStatus}`);
    } else {
      for (const id of ids) {
        await onCheckIn(id, targetStatus, "batch-list-override", `Batch marked as ${targetStatus}`);
      }
    }
    setStatusMessage(`✅ Updated ${ids.length} occupant(s) to "${targetStatus.toUpperCase()}".`);
    setSelectedIds(new Set());
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const getStatusBadge = (status: OccupantStatus) => {
    switch (status) {
      case "safe":
        return <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900 border border-emerald-300 shadow-2xs">🟢 SAFE</span>;
      case "need-help":
        return <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2.5 py-1 text-xs font-black text-red-900 border border-red-400 shadow-2xs animate-pulse">🆘 NEED HELP</span>;
      case "mia":
        return <span className="inline-flex items-center gap-1 rounded-md bg-rose-900 px-2.5 py-1 text-xs font-black text-white border border-rose-950 shadow-2xs">🚨 MIA</span>;
      case "awaiting-evac-chair":
        return <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 border border-amber-300 shadow-2xs">🛗 ARA CHAIR</span>;
      case "claimed-unverified":
        return <span className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-800 border border-slate-300 shadow-2xs">❓ UNVERIFIED</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-md bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-950 border border-orange-300 shadow-2xs">⏳ UNACCOUNTED</span>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "Visitor":
        return <span className="rounded-full bg-purple-100 border border-purple-300 px-2 py-0.5 text-[10px] font-black text-purple-900 uppercase">VISITOR</span>;
      case "Contractor":
        return <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-black text-amber-900 uppercase">CONTRACTOR</span>;
      case "VIP":
        return <span className="rounded-full bg-pink-100 border border-pink-300 px-2 py-0.5 text-[10px] font-black text-pink-900 uppercase">VIP</span>;
      case "Fire Warden":
        return <span className="rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-[10px] font-black text-red-900 uppercase">WARDEN</span>;
      default:
        return <span className="rounded-full bg-blue-100 border border-blue-200 px-2 py-0.5 text-[10px] font-black text-blue-900 uppercase">EMPLOYEE</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* 6B: Natural Language Query Box */}
      <div className="rounded-xl border border-[#B8D8F8] bg-white p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black uppercase tracking-wider text-[#005DAA] flex items-center gap-1.5">
            <span>✨</span> Natural-Language Red List Query (Gemini AI)
          </label>
          {aiQueryResult && (
            <button
              onClick={() => {
                setAiQueryResult(null);
                setNlQuery("");
              }}
              className="text-xs text-[#005DAA] font-bold hover:underline cursor-pointer"
            >
              Clear AI Filter
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={nlQuery}
              onChange={(e) => setNlQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNlSearch(nlQuery)}
              placeholder="Ask anything (e.g., 'who is missing from SW Legal?', 'anyone awaiting evac chair?')..."
              className="w-full min-h-[44px] rounded-lg border border-[#B8D8F8] bg-[#F0F6FC] px-4 py-2 text-sm text-[#0F2537] placeholder-[#64748B] focus:border-[#005DAA] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={toggleSpeechRecognition}
              className={`flex-1 sm:flex-none min-h-[44px] rounded-lg border px-3.5 py-2 text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                isListening
                  ? "border-red-500 bg-red-100 text-red-900 animate-pulse"
                  : "border-[#B8D8F8] bg-white text-[#0F2537] hover:bg-[#F0F6FC]"
              }`}
              title="Speak query (Voice-first)"
            >
              <span>🎙️</span>
              <span>{isListening ? "Listening..." : "Voice"}</span>
            </button>

            <button
              onClick={() => handleNlSearch(nlQuery)}
              disabled={isSearching || !nlQuery.trim()}
              className="flex-1 sm:flex-none min-h-[44px] rounded-lg bg-[#005DAA] px-5 py-2 text-sm font-black text-white hover:bg-[#004A88] disabled:opacity-50 active:scale-95 transition cursor-pointer shadow-sm"
            >
              {isSearching ? "Querying..." : "Ask AI"}
            </button>
          </div>
        </div>

        {/* Quick One-Tap Sample Query Chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="text-[11px] font-extrabold text-[#475569] uppercase tracking-wider flex items-center">Suggested:</span>
          {SAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => {
                setNlQuery(q);
                handleNlSearch(q);
              }}
              className="rounded-md border border-[#B8D8F8] bg-[#EBF5FB] px-2.5 py-1 text-xs text-[#005DAA] font-bold hover:bg-[#005DAA] hover:text-white transition cursor-pointer"
            >
              "{q}"
            </button>
          ))}
        </div>

        {statusMessage && (
          <div className="text-xs text-[#005DAA] font-mono italic animate-pulse font-bold">
            {statusMessage}
          </div>
        )}

        {/* AI Answer Banner Grounded in Ledger */}
        {aiQueryResult && (
          <div className="rounded-lg border border-[#005DAA]/30 bg-[#EBF5FB] p-3.5 space-y-1 text-sm text-[#0F2537]">
            <div className="flex items-center justify-between font-black text-[#005DAA] text-xs uppercase tracking-wider">
              <span>LEDGER-GROUNDED AI ANSWER</span>
              <span className="rounded-full bg-[#005DAA] text-white px-2 py-0.5 text-[10px] font-extrabold">
                {aiQueryResult.totalMatched} MATCHES
              </span>
            </div>
            <p className="font-semibold text-[#0F2537]">{aiQueryResult.answer}</p>
            <div className="text-[11px] text-[#475569] font-mono">
              Filter Applied: {JSON.stringify(aiQueryResult.filterSpec)}
            </div>
          </div>
        )}
      </div>

      {/* Admin Separate View Switcher: Employees vs Visitors Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setRoleCategory("ALL")}
          className={`p-3.5 rounded-xl border transition text-left cursor-pointer shadow-sm ${
            roleCategory === "ALL"
              ? "bg-[#EBF5FB] border-[#005DAA] ring-2 ring-[#005DAA]"
              : "bg-white border-[#B8D8F8] hover:border-[#005DAA]"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#0F2537]">
            <span>🏢 Total Floor Roster</span>
            <span className="text-[10px] font-mono text-[#005DAA] bg-[#005DAA]/10 px-2 py-0.5 rounded-full font-bold">ALL</span>
          </div>
          <div className="text-2xl font-black text-[#005DAA] mt-1">
            {occupants.length} <span className="text-xs font-normal text-[#475569]">Occupants</span>
          </div>
          <div className="text-[11px] text-[#475569] mt-0.5 font-mono font-medium">
            {occupants.filter((o) => o.status === "safe").length} Safe · {occupants.filter((o) => o.status !== "safe").length} Unaccounted
          </div>
        </button>

        <button
          onClick={() => setRoleCategory("EMPLOYEE")}
          className={`p-3.5 rounded-xl border transition text-left cursor-pointer shadow-sm ${
            roleCategory === "EMPLOYEE"
              ? "bg-[#EBF5FB] border-[#005DAA] ring-2 ring-[#005DAA]"
              : "bg-white border-[#B8D8F8] hover:border-[#005DAA]"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#005DAA]">
            <span>👔 Employees & Staff</span>
            <span className="text-[10px] font-mono text-[#005DAA] bg-[#005DAA]/15 px-2 py-0.5 rounded-full font-bold">STAFF</span>
          </div>
          <div className="text-2xl font-black text-[#005DAA] mt-1">
            {totalEmployees.length} <span className="text-xs font-normal text-[#475569]">Employees</span>
          </div>
          <div className="text-[11px] text-[#005DAA] mt-0.5 font-mono font-bold">
            🟢 {safeEmployees} Safe · ⏳ {unaccountedEmployees} Unaccounted
          </div>
        </button>

        <button
          onClick={() => setRoleCategory("VISITOR")}
          className={`p-3.5 rounded-xl border transition text-left cursor-pointer shadow-sm ${
            roleCategory === "VISITOR"
              ? "bg-purple-50 border-purple-500 ring-2 ring-purple-500"
              : "bg-white border-[#B8D8F8] hover:border-purple-400"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-purple-900">
            <span>👤 Daily Visitors & Guests</span>
            <span className="text-[10px] font-mono text-purple-900 bg-purple-100 px-2 py-0.5 rounded-full font-bold">GUESTS</span>
          </div>
          <div className="text-2xl font-black text-purple-900 mt-1">
            {totalVisitors.length} <span className="text-xs font-normal text-[#475569]">Visitors</span>
          </div>
          <div className="text-[11px] text-purple-800 mt-0.5 font-mono font-bold">
            🟢 {safeVisitors} Safe · ⏳ {unaccountedVisitors} Unaccounted
          </div>
        </button>
      </div>

      {/* Filter Bar & Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white p-3 rounded-xl border border-[#B8D8F8] shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto">
          {[
            ["at-risk", "⚠️ At Risk"],
            ["all", "All Occupants"],
            ["unaccounted", "⏳ Unaccounted"],
            ["need-help", "🆘 Need Help"],
            ["mia", "🚨 MIA"],
            ["evac-chair", "🛗 Evac Chair"],
            ["likely-mia", "🔸 Likely MIA"],
            ["visitors", "👤 Visitors"],
            ["safe", "🟢 Safe"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                setAiQueryResult(null);
                setActiveFilter(id);
              }}
              className={`whitespace-nowrap min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider transition cursor-pointer shrink-0 ${
                !aiQueryResult && activeFilter === id
                  ? "bg-[#005DAA] text-white shadow"
                  : "bg-[#F0F6FC] text-[#475569] border border-[#B8D8F8] hover:text-[#005DAA] hover:bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={selectedQuadrant}
            onChange={(e) => setSelectedQuadrant(e.target.value)}
            className="flex-1 sm:flex-none min-h-[38px] rounded-lg border border-[#B8D8F8] bg-[#F0F6FC] px-2.5 py-1.5 text-xs text-[#0F2537] font-semibold focus:outline-none focus:border-[#005DAA] focus:bg-white"
          >
            <option value="ALL">All Quadrants</option>
            <option value="NW">NW · Engineering</option>
            <option value="NE">NE · Comms/Gov</option>
            <option value="SW">SW · Legal</option>
            <option value="SE">SE · IT/Visitors</option>
          </select>

          <input
            type="text"
            value={textSearch}
            onChange={(e) => setTextSearch(e.target.value)}
            placeholder="Filter name/ID..."
            className="flex-1 sm:w-36 min-h-[38px] rounded-lg border border-[#B8D8F8] bg-[#F0F6FC] px-2.5 py-1.5 text-xs text-[#0F2537] placeholder-[#64748B] focus:outline-none focus:border-[#005DAA] focus:bg-white"
          />
        </div>
      </div>

      {/* Batch Action Toolbar ("Mark Down a List") */}
      {selectedIds.size > 0 && (
        <div className="sticky top-2 z-30 bg-[#005DAA] border-2 border-[#00A3E0] rounded-xl p-3 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3 text-white animate-fadeIn">
          <div className="flex items-center gap-2 font-black text-sm">
            <span className="bg-[#00A3E0] text-slate-950 px-2.5 py-0.5 rounded-full text-xs">
              {selectedIds.size} SELECTED
            </span>
            <span>Batch Mark Down List:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => handleBatchStatusUpdate("safe")}
              className="flex-1 md:flex-none min-h-[36px] bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-3 py-1.5 rounded-lg font-black text-xs transition cursor-pointer flex items-center justify-center gap-1 shadow"
            >
              <span>🟢</span>
              <span>Mark Safe</span>
            </button>

            <button
              onClick={() => handleBatchStatusUpdate("unaccounted")}
              className="flex-1 md:flex-none min-h-[36px] bg-[#FF6B00] hover:bg-[#FF8533] text-slate-950 px-3 py-1.5 rounded-lg font-black text-xs transition cursor-pointer flex items-center justify-center gap-1 shadow"
            >
              <span>⏳</span>
              <span>Mark Unaccounted</span>
            </button>

            <button
              onClick={() => handleBatchStatusUpdate("need-help")}
              className="flex-1 md:flex-none min-h-[36px] bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg font-black text-xs transition cursor-pointer flex items-center justify-center gap-1 shadow"
            >
              <span>🆘</span>
              <span>Need Help</span>
            </button>

            <button
              onClick={() => handleBatchStatusUpdate("awaiting-evac-chair")}
              className="flex-1 md:flex-none min-h-[36px] bg-amber-400 hover:bg-amber-300 text-slate-950 px-3 py-1.5 rounded-lg font-black text-xs transition cursor-pointer flex items-center justify-center gap-1 shadow"
            >
              <span>🛗</span>
              <span>Evac Chair</span>
            </button>

            <button
              onClick={deselectAll}
              className="min-h-[36px] bg-[#070D18] hover:bg-[#142642] text-white border border-[#1E3A60] px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Occupants Roster List */}
      <div className="rounded-xl border border-[#B8D8F8] bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-[#EBF5FB] border-b border-[#B8D8F8] flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-black uppercase text-[#0F2537]">
              <input
                type="checkbox"
                checked={
                  displayedOccupants.length > 0 &&
                  displayedOccupants.every((o) => selectedIds.has(o.id))
                }
                onChange={(e) => {
                  if (e.target.checked) selectAllDisplayed();
                  else deselectAll();
                }}
                className="w-4 h-4 accent-[#005DAA] cursor-pointer rounded"
              />
              <span>Select All Listed ({displayedOccupants.length})</span>
            </label>
          </div>

          <span className="text-[11px] font-mono font-bold text-[#005DAA]">
            EXPECTED ON FLOOR: {occupants.filter((o) => !o.badgedOut && !o.offSiteToday).length}
          </span>
        </div>

        {displayedOccupants.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#64748B] font-medium">
            No occupants found matching the current filter criteria.
          </div>
        ) : (
          <div className="divide-y divide-[#B8D8F8] max-h-[500px] overflow-y-auto">
            {displayedOccupants.map((o) => {
              const isSelected = selectedIds.has(o.id);
              return (
                <div
                  key={o.id}
                  className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition hover:bg-[#F0F6FC] ${
                    isSelected
                      ? "bg-[#EBF5FB] border-l-4 border-l-[#005DAA]"
                      : o.status === "need-help" || o.status === "mia"
                      ? "bg-red-50/90 border-l-4 border-l-red-500"
                      : o.likelyMia
                      ? "bg-amber-50/90 border-l-4 border-l-amber-500"
                      : ""
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(o.id)}
                      className="mt-1 sm:mt-0 w-4 h-4 accent-[#005DAA] cursor-pointer rounded shrink-0"
                    />

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-[#0F2537] text-sm">{o.name}</span>
                        {getRoleBadge(o.role)}
                        <span className="font-mono text-[11px] text-[#005DAA] font-bold bg-[#EBF5FB] px-1.5 py-0.2 rounded border border-[#B8D8F8]">{o.id}</span>
                        {o.phone && <span className="font-mono text-[11px] text-[#475569] font-medium">{o.phone}</span>}
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                          o.badgedOut ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {o.badgedOut ? "⚪ Left Building" : "🟢 In Building"}
                        </span>
                        {o.geofenceValidation && (
                          <span
                            title={o.geofenceValidation.auditDetails || "Geo-fence verified"}
                            className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                              o.geofenceValidation.locationCategory === "outside-assembly"
                                ? "bg-amber-100 text-amber-900 border-amber-300"
                                : o.geofenceValidation.locationCategory === "inside-building"
                                ? "bg-blue-100 text-blue-900 border-blue-300"
                                : "bg-slate-100 text-slate-700 border-slate-300"
                            }`}
                          >
                            🛰️ {o.geofenceValidation.locationCategory === "outside-assembly" ? "Assembly Geo-Fence" : "Floor 07 Geo-Fence"}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#475569]">
                        <span className="font-black text-[#005DAA] bg-[#005DAA]/10 px-1.5 py-0.5 rounded font-mono text-[11px]">{o.quadrant}</span>
                        <span>Last: <strong className="text-[#0F2537]">{o.lastLocation}</strong> ({o.lastBadgeTime})</span>
                        {o.unaccountedMinutes !== undefined && o.unaccountedMinutes > 0 && o.status === "unaccounted" && (
                          <span className="font-mono text-orange-700 font-bold bg-orange-100 px-1.5 py-0.5 rounded text-[11px]">
                            ⏳ Unaccounted: {o.unaccountedMinutes}m
                          </span>
                        )}
                      </div>

                      {/* 6C: Predictive Likely-MIA Advisory Flag */}
                      {(o.likelyMia || (o.status === "unaccounted" && (o.unaccountedMinutes ?? 0) >= 3)) && (
                        <div className="mt-1 flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs text-amber-900">
                          <span>🔸</span>
                          <div>
                            <span className="font-black uppercase tracking-wider text-[10px] text-amber-900">PREDICTIVE LIKELY-MIA ADVISORY</span>
                            <p className="text-[11px] text-amber-800 font-medium">
                              {o.likelyMiaEvidence || `No check-in or mesh sighting for ${o.unaccountedMinutes} minutes.`}
                            </p>
                          </div>
                        </div>
                      )}

                      {o.notes && (
                        <p className="text-xs italic text-[#005DAA] font-medium">Note: {o.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap pl-7 sm:pl-0">
                    {getStatusBadge(o.status)}

                    {/* Quick Check-In Safe */}
                    {o.status !== "safe" && (
                      <button
                        onClick={() => onCheckIn(o.id, "safe", "fsa-kiosk", "FSD manual check-in")}
                        className="rounded-lg bg-[#005DAA] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#004A88] transition cursor-pointer shadow-xs"
                      >
                        Check-In Safe
                      </button>
                    )}

                    {/* Voice Check-In Button (6D) */}
                    <button
                      onClick={() => {
                        const spoken = prompt(`Simulate Voice Check-In for ${o.name}:`, `I am safe in ${o.quadrant}`);
                        if (spoken) {
                          onCheckIn(o.id, "safe", "voice", `Voice check-in: "${spoken}"`);
                        }
                      }}
                      className="rounded-lg border border-[#B8D8F8] bg-white px-2.5 py-1.5 text-xs font-bold text-[#0F2537] hover:bg-[#F0F6FC] transition cursor-pointer"
                      title="Voice Check-In"
                    >
                      🗣️ Voice
                    </button>

                    {/* Status Dropdown */}
                    <select
                      value={o.status}
                      onChange={(e) => onCheckIn(o.id, e.target.value as OccupantStatus, "fsd-override")}
                      className="rounded-lg border border-[#B8D8F8] bg-white px-2 py-1.5 text-xs font-bold text-[#0F2537] focus:outline-none focus:border-[#005DAA]"
                    >
                      <option value="safe">Mark Safe</option>
                      <option value="unaccounted">Unaccounted</option>
                      <option value="need-help">Need Help</option>
                      <option value="mia">MIA</option>
                      <option value="awaiting-evac-chair">Evac Chair (ARA)</option>
                      <option value="claimed-unverified">Unverified</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
