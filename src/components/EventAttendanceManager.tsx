import React, { useState, useEffect } from "react";
import { CheckinEvent, RosterAttendee, AttendanceRecord, EventRosterStatus } from "../types";

export const EventAttendanceManager: React.FC = () => {
  const [events, setEvents] = useState<CheckinEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("evt-fl07-daily");
  const [rosterStatus, setRosterStatus] = useState<EventRosterStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [bulkInput, setBulkInput] = useState("");
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [createdEventData, setCreatedEventData] = useState<{ event: CheckinEvent; checkinUrl: string; qrDataUrl: string } | null>(null);

  // Fetch events list
  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/events");
      const data = await res.json();
      if (data.ok && Array.isArray(data.events)) {
        setEvents(data.events);
        if (!selectedEventId && data.events.length > 0) {
          setSelectedEventId(data.events[0].id);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch events:", err);
    }
  };

  // Fetch live roster status for the selected event
  const fetchRosterStatus = async (eventId: string) => {
    if (!eventId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/roster-status`);
      const data = await res.json();
      if (data.ok) {
        setRosterStatus(data);
      }
    } catch (err) {
      console.warn("Failed to fetch roster status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchRosterStatus(selectedEventId);
      const interval = setInterval(() => fetchRosterStatus(selectedEventId), 4000);
      return () => clearInterval(interval);
    }
  }, [selectedEventId]);

  // Handle Create Event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventName.trim()) return;

    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEventName.trim(),
          event_date: newEventDate,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCreatedEventData(data);
        setStatusMessage(`Event "${data.event.name}" created with QR token "${data.event.qr_token}"!`);
        setIsCreatingEvent(false);
        setNewEventName("");
        await fetchEvents();
        setSelectedEventId(data.event.id);
      }
    } catch (err: any) {
      setStatusMessage("Error creating event: " + err.message);
    }
  };

  // Handle Bulk Roster Upload
  const handleBulkUpload = async () => {
    if (!bulkInput.trim() || !selectedEventId) return;

    try {
      let attendees: any[] = [];
      const lines = bulkInput.trim().split("\n");

      // Check if JSON or CSV/Lines
      if (bulkInput.trim().startsWith("[") || bulkInput.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(bulkInput);
          attendees = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          // fallback to CSV parse
        }
      }

      if (attendees.length === 0) {
        lines.forEach((line) => {
          const parts = line.split(",").map((p) => p.trim());
          if (parts[0]) {
            attendees.push({
              full_name: parts[0],
              email: parts[1] || null,
              org: parts[2] || "Con Edison",
              quadrant: parts[3] || "NW",
              role: parts[4] || "Employee",
            });
          }
        });
      }

      const res = await fetch(`/api/events/${selectedEventId}/roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendees }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatusMessage(`Successfully imported ${data.insertedCount} expected attendees!`);
        setIsBulkOpen(false);
        setBulkInput("");
        fetchRosterStatus(selectedEventId);
      }
    } catch (err: any) {
      setStatusMessage("Error uploading roster: " + err.message);
    }
  };

  const currentEvent = events.find((e) => e.id === selectedEventId) || rosterStatus?.event;
  const stats = rosterStatus?.stats || {
    totalExpected: 0,
    checkedInCount: 0,
    walkInCount: 0,
    pendingCount: 0,
    attendanceRate: 0,
  };

  return (
    <div className="space-y-4 text-left animate-fadeIn">
      {/* Header & Event Selector Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#B8D8F8] shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📱</span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black uppercase tracking-wider text-[#0F2537]">
                QR Check-In &amp; Digital Attendance Engine
              </h2>
              <span className="text-[10px] font-mono font-bold bg-[#EBF5FB] text-[#005DAA] px-2 py-0.5 rounded-full border border-[#00A3E0]/30">
                POSTGRESQL &amp; IN-MEMORY DUAL ENGINE
              </span>
            </div>
            <p className="text-xs text-[#475569] font-medium">
              Event tokens, digital signature verification, expected roster matching &amp; walk-in ledger.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="bg-[#F0F6FC] border border-[#B8D8F8] rounded-xl px-3 py-1.5 text-xs font-bold text-[#0F2537] focus:outline-none focus:border-[#005DAA]"
          >
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.name} ({evt.event_date})
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsCreatingEvent(true)}
            className="bg-[#005DAA] hover:bg-[#004A88] text-white px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center gap-1 shadow-xs"
          >
            <span>+</span>
            <span>New QR Event</span>
          </button>

          <button
            onClick={() => setIsBulkOpen(true)}
            className="bg-white border border-[#B8D8F8] hover:bg-[#F0F6FC] text-[#005DAA] px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
          >
            <span>📥</span>
            <span>Bulk Upload Roster</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between animate-fadeIn">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="bg-white p-3.5 rounded-2xl border border-[#CBDCEE] shadow-xs">
          <div className="text-[10px] font-mono font-bold uppercase text-[#475569]">Expected Roster</div>
          <div className="text-2xl font-black text-[#0F2537] mt-0.5">{stats.totalExpected}</div>
          <div className="text-[10px] text-slate-500 font-medium">Pre-loaded attendees</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="text-[10px] font-mono font-bold uppercase text-emerald-700">Checked In (Signed)</div>
          <div className="text-2xl font-black text-emerald-700 mt-0.5">{stats.checkedInCount}</div>
          <div className="text-[10px] text-emerald-600 font-medium">Verified presence</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-xs">
          <div className="text-[10px] font-mono font-bold uppercase text-amber-700">Walk-Ins</div>
          <div className="text-2xl font-black text-amber-700 mt-0.5">{stats.walkInCount}</div>
          <div className="text-[10px] text-amber-600 font-medium">Auto-onboarded</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-sky-200 shadow-xs">
          <div className="text-[10px] font-mono font-bold uppercase text-[#005DAA]">Pending Arrival</div>
          <div className="text-2xl font-black text-[#005DAA] mt-0.5">{stats.pendingCount}</div>
          <div className="text-[10px] text-slate-500 font-medium">Not yet scanned</div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#005DAA] shadow-xs col-span-2 sm:col-span-1">
          <div className="text-[10px] font-mono font-bold uppercase text-[#005DAA]">Attendance Rate</div>
          <div className="text-2xl font-black text-[#003B70] mt-0.5">{stats.attendanceRate}%</div>
          <div className="text-[10px] text-slate-500 font-medium">Roster completion</div>
        </div>
      </div>

      {/* Main Roster & Walk-In Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Cols: Expected Roster with Signatures */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#B8D8F8] shadow-sm overflow-hidden flex flex-col">
          <div className="p-3.5 bg-[#F8FAFC] border-b border-[#B8D8F8] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-[#0F2537] uppercase">
                Expected Roster ({rosterStatus?.roster?.length || 0})
              </span>
              <span className="text-[10px] font-mono text-[#005DAA] bg-[#EBF5FB] px-2 py-0.5 rounded-md font-bold">
                {currentEvent?.name}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              Token: <strong className="text-[#005DAA]">{currentEvent?.qr_token}</strong>
            </span>
          </div>

          <div className="max-h-[440px] overflow-y-auto divide-y divide-slate-100">
            {isLoading && (!rosterStatus || rosterStatus.roster.length === 0) ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading live attendance roster...</div>
            ) : rosterStatus?.roster?.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No expected attendees uploaded for this event. Use &quot;Bulk Upload Roster&quot; above.
              </div>
            ) : (
              rosterStatus?.roster?.map((attendee) => (
                <div
                  key={attendee.id}
                  className={`p-3 text-xs flex items-center justify-between transition hover:bg-slate-50 ${
                    attendee.checked_in ? "bg-emerald-50/40" : ""
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-[#0F2537]">{attendee.full_name}</span>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {attendee.role || "Employee"} · Sector {attendee.quadrant || "NW"}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span>{attendee.org || "Con Edison"}</span>
                      {attendee.email && <span>· {attendee.email}</span>}
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    {attendee.checked_in ? (
                      <div>
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                          ✓ Signed &amp; Present
                        </span>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          {attendee.checked_in_at}
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    )}

                    {attendee.signature_data && (
                      <div className="text-[9px] text-[#005DAA] font-bold">
                        ✍️ Signature Verified
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right 1 Col: Walk-Ins & QR Code Poster */}
        <div className="space-y-4">
          {/* Active QR Token Card */}
          <div className="bg-white p-4 rounded-2xl border border-[#B8D8F8] shadow-sm text-center space-y-2">
            <div className="text-xs font-mono font-bold text-[#005DAA] uppercase">
              SCAN TO TAKE ATTENDANCE
            </div>
            {currentEvent?.qrDataUrl ? (
              <img
                src={currentEvent.qrDataUrl}
                alt="Event QR Code"
                className="w-40 h-40 mx-auto object-contain border border-[#B8D8F8] rounded-xl p-1 bg-white shadow-xs"
              />
            ) : (
              <div className="w-40 h-40 mx-auto flex items-center justify-center bg-slate-100 rounded-xl text-[11px] text-slate-400">
                QR Token: {currentEvent?.qr_token}
              </div>
            )}
            <div className="text-[11px] font-mono text-slate-600 bg-[#F0F6FC] py-1 px-2 rounded-lg border border-[#CBDCEE]">
              Token: {currentEvent?.qr_token}
            </div>
          </div>

          {/* Walk-In Attendees List */}
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <span className="text-xs font-black text-amber-900 uppercase">
                Walk-In Check-Ins ({rosterStatus?.walkIns?.length || 0})
              </span>
              <span className="text-[10px] font-bold text-amber-700 bg-white px-2 py-0.5 rounded-full border border-amber-200">
                Live
              </span>
            </div>

            <div className="max-h-[220px] overflow-y-auto divide-y divide-slate-100">
              {rosterStatus?.walkIns?.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No unregistered walk-ins yet.
                </div>
              ) : (
                rosterStatus?.walkIns?.map((walkIn) => (
                  <div key={walkIn.id} className="p-2.5 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#0F2537]">{walkIn.full_name}</div>
                      <div className="text-[10px] text-slate-500">{walkIn.org || "Guest"}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                        Walk-In
                      </span>
                      <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                        {walkIn.checked_in_at}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Create New Event */}
      {isCreatingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border-2 border-[#005DAA] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-[#0F2537] uppercase">Create New QR Event / Session</h3>
              <button onClick={() => setIsCreatingEvent(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#0F2537] mb-1">Event / Session Name</label>
                <input
                  type="text"
                  required
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  placeholder="e.g. Con Edison Floor 07 Safety Drill"
                  className="w-full bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl px-3 py-2 text-xs text-[#0F2537] font-medium focus:outline-none focus:border-[#005DAA]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F2537] mb-1">Date</label>
                <input
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl px-3 py-2 text-xs text-[#0F2537] font-medium focus:outline-none focus:border-[#005DAA]"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#005DAA] hover:bg-[#004A88] text-white font-black text-xs py-2.5 rounded-xl transition cursor-pointer"
                >
                  Create &amp; Generate QR Token
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingEvent(false)}
                  className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bulk Upload Expected Roster */}
      {isBulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border-2 border-[#005DAA] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-[#0F2537] uppercase">Bulk Upload Expected Roster</h3>
              <button onClick={() => setIsBulkOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold">✕</button>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <p>Paste lines formatted as <strong>Full Name, Email, Organization, Sector (NW/NE/SW/SE), Role</strong> or JSON array.</p>
            </div>

            <textarea
              rows={6}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="Sarah Jenkins, sarah.jenkins@coned.com, Con Edison, NW, Employee&#10;Michael Chang, m.chang@coned.com, Con Edison, NE, Warden&#10;Alex Rivera, alex@pursuit.org, Pursuit, SE, Visitor"
              className="w-full bg-[#F8FAFC] border border-[#CBDCEE] rounded-xl p-3 font-mono text-xs text-[#0F2537] focus:outline-none focus:border-[#005DAA]"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleBulkUpload}
                className="flex-1 bg-[#005DAA] hover:bg-[#004A88] text-white font-black text-xs py-2.5 rounded-xl transition cursor-pointer"
              >
                Import to Live Expected Roster
              </button>
              <button
                type="button"
                onClick={() => setIsBulkOpen(false)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
