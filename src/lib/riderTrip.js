export function groupPendingStops(stops) {
  const pending = (stops || []).filter((stop) => stop.status === "PENDING");
  if (!pending.length) return [];
  const firstGate = pending[0].gateId;
  return pending.filter((stop) => stop.gateId === firstGate);
}

export function mapsUrl(stop) {
  if (stop?.latitude != null && stop?.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${stop.latitude},${stop.longitude}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop?.address || "")}`;
}
