// Mesh module subscription placeholder for local CRDT / peer-to-peer / broadcast sync
export function subscribeMeshSync(facilityId: string, onChange: () => void): () => void {
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(`muster-mesh-${facilityId}`) : null;

  const handler = () => {
    onChange();
  };

  channel?.addEventListener("message", handler);

  return () => {
    channel?.removeEventListener("message", handler);
    channel?.close();
  };
}
