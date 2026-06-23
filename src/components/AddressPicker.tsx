import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Navigation, Search } from "lucide-react";

export type PickedAddress = {
  lat: number;
  lng: number;
  addressLine: string;
  city: string;
  pincode: string;
  formatted: string;
};

interface Props {
  value?: { lat?: number | null; lng?: number | null } | null;
  onChange: (a: PickedAddress) => void;
  height?: number;
}

type Suggestion = { display_name: string; lat: string; lon: string; address?: any };

// Nominatim usage policy: max 1 req/sec, include a UA / referer (browser sets referer automatically).
const NOMINATIM = "https://nominatim.openstreetmap.org";

async function reverseGeocode(lat: number, lng: number): Promise<PickedAddress | null> {
  try {
    const r = await fetch(`${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const a = j.address ?? {};
    const line = [a.house_number, a.road, a.neighbourhood, a.suburb].filter(Boolean).join(", ");
    return {
      lat, lng,
      addressLine: line || j.display_name?.split(",").slice(0, 2).join(", ") || "",
      city: a.city || a.town || a.village || a.county || "",
      pincode: a.postcode || "",
      formatted: j.display_name || "",
    };
  } catch { return null; }
}

async function searchPlaces(q: string): Promise<Suggestion[]> {
  if (q.trim().length < 3) return [];
  try {
    const r = await fetch(`${NOMINATIM}/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=5&addressdetails=1&countrycodes=in`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}

export function AddressPicker({ value, onChange, height = 300 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<any>({});
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const debounceRef = useRef<any>(null);

  // Initialize map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !ref.current || stateRef.current.map) return;
      const start: [number, number] = value?.lat && value?.lng
        ? [Number(value.lat), Number(value.lng)]
        : [12.9716, 77.5946]; // Bangalore default
      const map = L.map(ref.current).setView(start, value?.lat ? 16 : 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      const marker = L.marker(start, { draggable: true }).addTo(map);
      marker.on("dragend", async () => {
        const p = marker.getLatLng();
        await applyLatLng(p.lat, p.lng);
      });
      map.on("click", async (e: any) => {
        marker.setLatLng(e.latlng);
        await applyLatLng(e.latlng.lat, e.latlng.lng);
      });
      stateRef.current = { map, marker, L };
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyLatLng(lat: number, lng: number) {
    setBusy(true);
    const a = await reverseGeocode(lat, lng);
    setBusy(false);
    if (a) onChange(a);
    else onChange({ lat, lng, addressLine: "", city: "", pincode: "", formatted: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
  }

  function moveTo(lat: number, lng: number) {
    const { map, marker } = stateRef.current;
    if (!map || !marker) return;
    marker.setLatLng([lat, lng]);
    map.setView([lat, lng], 17);
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        moveTo(latitude, longitude);
        await applyLatLng(latitude, longitude);
      },
      () => setBusy(false),
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  function onQueryChange(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSuggestions(await searchPlaces(v));
    }, 400);
  }

  async function pickSuggestion(s: Suggestion) {
    const lat = Number(s.lat), lng = Number(s.lon);
    setQuery(s.display_name);
    setSuggestions([]);
    moveTo(lat, lng);
    await applyLatLng(lat, lng);
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search address, landmark, or area"
            className="h-11 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-ring"
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-[1000] mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
              {suggestions.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => pickSuggestion(s)}
                    className="block w-full px-3 py-2 text-left text-xs hover:bg-muted"
                  >
                    <MapPin className="mr-1 inline h-3 w-3" /> {s.display_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={busy}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
          Use my location
        </button>
      </div>
      <div ref={ref} style={{ height, width: "100%", borderRadius: 12, overflow: "hidden", border: "1px solid hsl(var(--border))" }} />
      <p className="text-[11px] text-muted-foreground">
        Drag the pin or tap on the map to set the exact delivery point.
      </p>
    </div>
  );
}
