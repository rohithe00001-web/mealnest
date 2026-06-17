import { useEffect, useRef } from "react";

type Point = { lat: number; lng: number; label?: string };

interface Props {
  agent: Point | null;
  destination?: Point | null;
  height?: number;
}

// Lightweight Leaflet wrapper that loads the library lazily so it stays SSR-safe.
export function LiveMap({ agent, destination, height = 260 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<any>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !ref.current) return;
      const center = agent ?? destination ?? { lat: 12.97, lng: 77.59 };
      if (!stateRef.current.map) {
        const map = L.map(ref.current).setView([center.lat, center.lng], 14);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);
        stateRef.current.map = map;
        stateRef.current.L = L;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const { map, L } = stateRef.current;
    if (!map || !L) return;
    if (agent) {
      if (!stateRef.current.agentMarker) {
        stateRef.current.agentMarker = L.circleMarker([agent.lat, agent.lng], {
          radius: 9, color: "#fff", weight: 2, fillColor: "#16a34a", fillOpacity: 1,
        }).addTo(map).bindPopup(agent.label ?? "Agent");
      } else {
        stateRef.current.agentMarker.setLatLng([agent.lat, agent.lng]);
      }
      map.panTo([agent.lat, agent.lng]);
    }
    if (destination) {
      if (!stateRef.current.destMarker) {
        stateRef.current.destMarker = L.circleMarker([destination.lat, destination.lng], {
          radius: 8, color: "#fff", weight: 2, fillColor: "#ef4444", fillOpacity: 1,
        }).addTo(map).bindPopup(destination.label ?? "Destination");
      } else {
        stateRef.current.destMarker.setLatLng([destination.lat, destination.lng]);
      }
    }
  }, [agent?.lat, agent?.lng, destination?.lat, destination?.lng]);

  return <div ref={ref} style={{ height, width: "100%", borderRadius: 12, overflow: "hidden", border: "1px solid hsl(var(--border))" }} />;
}
