export default function ResourcesPanel() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
      <div className="p-3 bg-white rounded-lg border border-[#B8D8F8] space-y-1 shadow-xs">
        <div className="flex items-center justify-between font-black text-red-700">
          <span>🚒 FDNY TRUCK 14</span>
          <span className="rounded bg-red-100 border border-red-300 px-1.5 py-0.5 text-[10px] text-red-800 font-bold">ON-SCENE</span>
        </div>
        <p className="text-[#0F2537] text-[11px] font-medium">Assigned Stairwell A Search & ARA Evacuation</p>
        <p className="font-mono text-[#475569] text-[10px] font-semibold">ETA: Arrived 02m ago · Ch. 7 Tac</p>
      </div>

      <div className="p-3 bg-white rounded-lg border border-[#B8D8F8] space-y-1 shadow-xs">
        <div className="flex items-center justify-between font-black text-[#005DAA]">
          <span>🚑 NYC EMS UNIT 06</span>
          <span className="rounded bg-[#EBF5FB] border border-[#B8D8F8] px-1.5 py-0.5 text-[10px] text-[#005DAA] font-bold">DISPATCHED</span>
        </div>
        <p className="text-[#0F2537] text-[11px] font-medium">Triage station set up at Lobby West Entrance</p>
        <p className="font-mono text-[#475569] text-[10px] font-semibold">4 ARA Chair Evacuations Requested</p>
      </div>

      <div className="p-3 bg-white rounded-lg border border-[#B8D8F8] space-y-1 shadow-xs">
        <div className="flex items-center justify-between font-black text-[#005DAA]">
          <span>🛡️ FSD COMMAND DESK</span>
          <span className="rounded bg-[#EBF5FB] border border-[#B8D8F8] px-1.5 py-0.5 text-[10px] text-[#005DAA] font-bold">MESH ACTIVE</span>
        </div>
        <p className="text-[#0F2537] text-[11px] font-medium">4 Wardens Active on Local Mesh Network</p>
        <p className="font-mono text-[#475569] text-[10px] font-semibold">Hash Chain: 100% Cryptographically Verified</p>
      </div>
    </div>
  );
}
