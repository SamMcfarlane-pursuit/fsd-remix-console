import React, { useState } from "react";
import { Occupant, QuadrantId, OccupantRole } from "../types";

interface DailyRosterSpreadsheetProps {
  occupants: Occupant[];
  onRosterUpdated: () => void;
}

export const DailyRosterSpreadsheet: React.FC<DailyRosterSpreadsheetProps> = ({
  occupants,
  onRosterUpdated,
}) => {
  const [gridData, setGridData] = useState<Occupant[]>(occupants);
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedQuadrantFilter, setSelectedQuadrantFilter] = useState<string>("ALL");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("ALL");

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // New row form state
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<OccupantRole>("Employee");
  const [newQuad, setNewQuad] = useState<QuadrantId>("NW");
  const [newSchedule, setNewSchedule] = useState("08:00 - 17:00 (Full Shift)");

  // Sync state to backend
  const handleSyncToBackend = async (dataToSync: Occupant[], mode: "append" | "replace" = "replace") => {
    setIsSyncing(true);
    setStatusMessage("Syncing Daily Roster Schedule Matrix to MusterCommand ledger...");
    try {
      const res = await fetch("/api/roster/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occupants: dataToSync, mode }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage(`✅ Daily Roster Matrix Synced! ${data.importedCount} records bound to ledger hash.`);
        onRosterUpdated();
      } else {
        setStatusMessage(`⚠️ Sync error: ${data.error || "Failed to update roster"}`);
      }
    } catch (err: any) {
      console.warn("Roster sync fallback:", err);
      setStatusMessage("✅ Daily Roster updated locally.");
      onRosterUpdated();
    } finally {
      setIsSyncing(false);
    }
  };

  // Add new occupant row to spreadsheet
  const handleAddRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const generatedId = newId.trim() || `OCC-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOccupant: Occupant = {
      id: generatedId,
      name: newName.trim(),
      quadrant: newQuad,
      status: "unaccounted",
      role: newRole,
      badgedOut: false,
      offSiteToday: false,
      unaccountedMinutes: 0,
      lastLocation: `${newQuad} Zone A`,
      lastBadgeTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      notes: `Schedule: ${newSchedule}`,
      checkInMethod: "manual-roster-entry",
    };

    const updated = [newOccupant, ...gridData];
    setGridData(updated);
    setNewId("");
    setNewName("");
    handleSyncToBackend(updated, "replace");
  };

  // Remove row
  const handleRemoveRow = (id: string) => {
    const updated = gridData.filter((o) => o.id !== id);
    setGridData(updated);
    handleSyncToBackend(updated, "replace");
  };

  // Edit cell value
  const handleCellEdit = (id: string, field: keyof Occupant, value: any) => {
    const updated = gridData.map((o) => {
      if (o.id === id) {
        return { ...o, [field]: value };
      }
      return o;
    });
    setGridData(updated);
  };

  // Parse CSV text and update
  const handleCsvImport = () => {
    if (!csvText.trim()) return;

    const lines = csvText.trim().split("\n");
    const parsed: Occupant[] = [];

    lines.forEach((line, index) => {
      if (index === 0 && (line.toLowerCase().includes("id") || line.toLowerCase().includes("name"))) {
        return; // Skip header line if present
      }
      const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
      if (parts.length >= 2) {
        const id = parts[0] || `OCC-${200 + index}`;
        const name = parts[1] || `Occupant ${index}`;
        const roleStr = parts[2] || "Employee";
        const quadStr = (parts[3] || "SE").toUpperCase();

        const quad: QuadrantId = ["NW", "NE", "SW", "SE"].includes(quadStr)
          ? (quadStr as QuadrantId)
          : "SE";

        const role: OccupantRole = ["Employee", "Contractor", "Visitor", "VIP", "First Responder"].includes(roleStr)
          ? (roleStr as OccupantRole)
          : "Employee";

        parsed.push({
          id,
          name,
          role,
          quadrant: quad,
          status: "unaccounted",
          badgedOut: false,
          offSiteToday: false,
          unaccountedMinutes: 0,
          lastLocation: `${quad} Zone A`,
          lastBadgeTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          notes: parts[4] || "CSV Import Schedule",
          checkInMethod: "csv-import",
        });
      }
    });

    if (parsed.length > 0) {
      setGridData(parsed);
      setIsImportModalOpen(false);
      setCsvText("");
      handleSyncToBackend(parsed, "replace");
    }
  };

  // Export CSV file download
  const handleExportCsv = () => {
    const headers = ["ID", "Name", "Role", "Quadrant", "Status", "Notes/Schedule", "LastBadgeTime"];
    const rows = gridData.map((o) => [
      `"${o.id}"`,
      `"${o.name}"`,
      `"${o.role}"`,
      `"${o.quadrant}"`,
      `"${o.status}"`,
      `"${o.notes || ""}"`,
      `"${o.lastBadgeTime || ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Floor_07_Daily_Roster_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter grid items
  const filteredGrid = gridData.filter((item) => {
    if (selectedQuadrantFilter !== "ALL" && item.quadrant !== selectedQuadrantFilter) return false;
    if (selectedRoleFilter === "Employee") {
      if (item.role === "Visitor") return false;
    } else if (selectedRoleFilter === "Visitor") {
      if (item.role !== "Visitor") return false;
    } else if (selectedRoleFilter !== "ALL" && item.role !== selectedRoleFilter) {
      return false;
    }

    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Spreadsheet Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0F1E36] p-4 rounded-xl border border-[#1E3A60] shadow-md">
        <div>
          <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-[#E2E8F0] flex items-center gap-2">
            <span>📊</span>
            <span>Daily Occupant Roster & Work Schedule Matrix</span>
            <span className="text-[10px] font-mono font-bold bg-[#FF6B00]/20 text-[#FF8533] px-2 py-0.5 rounded border border-[#FF6B00]/40">
              CSV / SPREADSHEET MATRIX
            </span>
          </h2>
          <p className="text-xs text-[#829AB8] mt-0.5">
            Manage scheduled daily employees, contractors, and expected visitors to establish floor location baselines.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#1E3A60] bg-[#070D18] text-xs font-black uppercase tracking-wider text-[#E2E8F0] hover:bg-[#142642] hover:border-[#FF6B00] transition cursor-pointer flex items-center gap-1.5"
          >
            <span>📥</span>
            <span>Import CSV Matrix</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#1E3A60] bg-[#070D18] text-xs font-black uppercase tracking-wider text-[#E2E8F0] hover:bg-[#142642] hover:border-[#FF6B00] transition cursor-pointer flex items-center gap-1.5"
          >
            <span>📤</span>
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => handleSyncToBackend(gridData, "replace")}
            disabled={isSyncing}
            className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#FF6B00] text-slate-950 text-xs font-black uppercase tracking-wider hover:bg-[#FF8533] active:scale-95 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
          >
            <span>⚡</span>
            <span>{isSyncing ? "Syncing..." : "Sync Roster Matrix"}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {statusMessage && (
        <div className="p-3 rounded-lg bg-[#070D18] border border-[#1E3A60] text-xs font-mono font-bold text-[#38BDF8] flex items-center justify-between">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Add New Occupant / Daily Visitor Form */}
      <form onSubmit={handleAddRow} className="bg-[#0F1E36] p-4 rounded-xl border border-[#1E3A60] space-y-3">
        <div className="text-xs font-black uppercase tracking-wider text-[#829AB8]">
          ➕ Add Scheduled Occupant / Daily Visitor Row
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
          <input
            type="text"
            placeholder="ID (e.g. OCC-201)"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            className="min-h-[38px] rounded-lg border border-[#1E3A60] bg-[#070D18] px-3 py-1.5 text-xs text-[#E2E8F0] font-mono focus:border-[#FF6B00] focus:outline-none"
          />
          <input
            type="text"
            required
            placeholder="Full Name *"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="min-h-[38px] rounded-lg border border-[#1E3A60] bg-[#070D18] px-3 py-1.5 text-xs text-[#E2E8F0] focus:border-[#FF6B00] focus:outline-none"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as OccupantRole)}
            className="min-h-[38px] rounded-lg border border-[#1E3A60] bg-[#070D18] px-3 py-1.5 text-xs text-[#E2E8F0] focus:border-[#FF6B00] focus:outline-none"
          >
            <option value="Employee">Employee</option>
            <option value="Contractor">Contractor</option>
            <option value="Visitor">Visitor</option>
            <option value="VIP">VIP</option>
            <option value="First Responder">First Responder</option>
          </select>

          <select
            value={newQuad}
            onChange={(e) => setNewQuad(e.target.value as QuadrantId)}
            className="min-h-[38px] rounded-lg border border-[#1E3A60] bg-[#070D18] px-3 py-1.5 text-xs text-[#E2E8F0] focus:border-[#FF6B00] focus:outline-none"
          >
            <option value="NW">NW · Engineering</option>
            <option value="NE">NE · Comms/Gov</option>
            <option value="SW">SW · Legal</option>
            <option value="SE">SE · IT/Visitors</option>
          </select>

          <button
            type="submit"
            className="min-h-[38px] px-4 rounded-lg bg-[#FF6B00] text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-[#FF8533] active:scale-95 transition cursor-pointer"
          >
            + ADD ROW
          </button>
        </div>
      </form>

      {/* Filter and Table Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#0F1E36] p-3 rounded-xl border border-[#1E3A60]">
        {/* Category Mode Pills */}
        <div className="flex items-center gap-1.5 bg-[#070D18] p-1 rounded-lg border border-[#1E3A60]">
          <button
            onClick={() => setSelectedRoleFilter("ALL")}
            className={`px-3 py-1.5 rounded-md text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              selectedRoleFilter === "ALL"
                ? "bg-[#FF6B00] text-slate-950 shadow"
                : "text-[#829AB8] hover:text-white"
            }`}
          >
            All ({gridData.length})
          </button>
          <button
            onClick={() => setSelectedRoleFilter("Employee")}
            className={`px-3 py-1.5 rounded-md text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              selectedRoleFilter === "Employee"
                ? "bg-[#38BDF8] text-slate-950 shadow"
                : "text-[#829AB8] hover:text-white"
            }`}
          >
            Employees ({gridData.filter((i) => i.role !== "Visitor").length})
          </button>
          <button
            onClick={() => setSelectedRoleFilter("Visitor")}
            className={`px-3 py-1.5 rounded-md text-xs font-black uppercase tracking-wider transition cursor-pointer ${
              selectedRoleFilter === "Visitor"
                ? "bg-purple-400 text-slate-950 shadow"
                : "text-[#829AB8] hover:text-white"
            }`}
          >
            Visitors ({gridData.filter((i) => i.role === "Visitor").length})
          </button>
        </div>

        <div className="flex flex-1 items-center gap-2">
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search spreadsheet by name, ID, schedule..."
            className="flex-1 min-h-[38px] rounded-lg border border-[#1E3A60] bg-[#070D18] px-3.5 py-1.5 text-xs text-[#E2E8F0] focus:border-[#FF6B00] focus:outline-none placeholder-[#829AB8]"
          />

          <select
            value={selectedQuadrantFilter}
            onChange={(e) => setSelectedQuadrantFilter(e.target.value)}
            className="min-h-[38px] rounded-lg border border-[#1E3A60] bg-[#070D18] px-2.5 py-1.5 text-xs text-[#E2E8F0] focus:outline-none shrink-0"
          >
            <option value="ALL">All Quads</option>
            <option value="NW">NW (Eng)</option>
            <option value="NE">NE (Comms)</option>
            <option value="SW">SW (Legal)</option>
            <option value="SE">SE (IT/Vis)</option>
          </select>
        </div>
      </div>

      {/* Spreadsheet Data Grid */}
      <div className="bg-[#0F1E36] rounded-xl border border-[#1E3A60] shadow-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="bg-[#070D18] border-b border-[#1E3A60] text-[10px] font-black uppercase tracking-widest text-[#829AB8] sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4 w-28">Badge ID</th>
                <th className="py-3 px-4">Occupant Name</th>
                <th className="py-3 px-4 w-32">Role</th>
                <th className="py-3 px-4 w-36">Assigned Quad</th>
                <th className="py-3 px-4 w-36">Daily Status</th>
                <th className="py-3 px-4">Schedule / Notes</th>
                <th className="py-3 px-4 w-16 text-center">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E3A60]/60 text-xs font-mono text-[#E2E8F0]">
              {filteredGrid.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#829AB8]">
                    No occupants matching filter criteria.
                  </td>
                </tr>
              ) : (
                filteredGrid.map((occ) => (
                  <tr key={occ.id} className="hover:bg-[#142642]/60 transition">
                    <td className="py-2.5 px-4 font-bold text-[#38BDF8]">
                      {occ.id}
                    </td>
                    <td className="py-2.5 px-4 font-sans font-bold">
                      <input
                        type="text"
                        value={occ.name}
                        onChange={(e) => handleCellEdit(occ.id, "name", e.target.value)}
                        className="bg-transparent text-white w-full border-b border-transparent hover:border-[#1E3A60] focus:border-[#FF6B00] focus:outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <select
                        value={occ.role}
                        onChange={(e) => handleCellEdit(occ.id, "role", e.target.value)}
                        className="bg-[#070D18] border border-[#1E3A60] rounded px-2 py-1 text-xs text-[#E2E8F0]"
                      >
                        <option value="Employee">Employee</option>
                        <option value="Contractor">Contractor</option>
                        <option value="Visitor">Visitor</option>
                        <option value="VIP">VIP</option>
                        <option value="First Responder">First Responder</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-4">
                      <select
                        value={occ.quadrant}
                        onChange={(e) => handleCellEdit(occ.id, "quadrant", e.target.value as QuadrantId)}
                        className="bg-[#070D18] border border-[#1E3A60] rounded px-2 py-1 text-xs text-[#E2E8F0]"
                      >
                        <option value="NW">NW (Eng)</option>
                        <option value="NE">NE (Comms)</option>
                        <option value="SW">SW (Legal)</option>
                        <option value="SE">SE (IT/Vis)</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          occ.status === "safe"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : occ.status === "need-help"
                            ? "bg-red-500/20 text-red-300 border border-red-500/40"
                            : "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                        }`}
                      >
                        {occ.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-sans text-slate-300">
                      <input
                        type="text"
                        value={occ.notes || ""}
                        placeholder="e.g. 08:00 - 17:00"
                        onChange={(e) => handleCellEdit(occ.id, "notes", e.target.value)}
                        className="bg-transparent text-slate-200 w-full border-b border-transparent hover:border-[#1E3A60] focus:border-[#FF6B00] focus:outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => handleRemoveRow(occ.id)}
                        className="text-red-400 hover:text-red-200 transition font-bold"
                        title="Remove row"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV IMPORT MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="relative w-full max-w-xl rounded-2xl border-2 border-[#FF6B00] bg-[#0A1424] text-[#E2E8F0] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#1E3A60] pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-[#FF8533]">
                📥 Import Daily Roster CSV / Schedule Matrix
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#829AB8]">
              Paste CSV records below (Format: <code className="text-[#38BDF8]">ID, Name, Role, Quadrant, Schedule/Notes</code>):
            </p>

            <textarea
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`OCC-301, Marcus Vance, Employee, NW, 08:00-17:00 Shift\nOCC-302, Ling Wu, Contractor, NE, 09:00-18:00 Shift\nVIS-805, Robert Taylor, Visitor, SE, Host: Sarah Jenkins`}
              className="w-full rounded-lg border border-[#1E3A60] bg-[#070D18] p-3 font-mono text-xs text-[#E2E8F0] focus:border-[#FF6B00] focus:outline-none placeholder-[#829AB8]"
            />

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => {
                  const sampleCsv = `OCC-101, Sarah Jenkins, Employee, NW, 08:00-17:00 Full Shift\nOCC-102, Michael Chang, Employee, NW, 08:00-17:00 Full Shift\nOCC-103, Elena Rostova, Contractor, NE, 09:00-18:00 Shift\nOCC-104, David Vance, VIP, SW, Executive Briefing\nVIS-801, Robert Taylor, Visitor, SE, Host: Sarah Jenkins (Con Ed Guest)`;
                  setCsvText(sampleCsv);
                }}
                className="text-xs text-[#38BDF8] underline font-bold hover:text-white"
              >
                Insert Sample CSV
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[#1E3A60] text-xs font-bold text-slate-300 hover:bg-[#142642]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCsvImport}
                  className="px-5 py-2 rounded-lg bg-[#FF6B00] text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-[#FF8533]"
                >
                  Process CSV Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
