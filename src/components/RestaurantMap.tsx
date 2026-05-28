import { useEffect, useRef } from "react";

type MapRestaurant = {
  id: string;
  name: string;
  cuisine: string | null;
  avg_rating: number | null;
  latitude: number | null;
  longitude: number | null;
};

declare global {
  interface Window {
    google?: typeof google;
    __halalbitesInitMap?: () => void;
    __halalbitesMapReady?: Promise<void>;
  }
}

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__halalbitesMapReady) return window.__halalbitesMapReady;

  window.__halalbitesMapReady = new Promise<void>((resolve, reject) => {
    if (!BROWSER_KEY) {
      reject(new Error("Google Maps key missing"));
      return;
    }
    window.__halalbitesInitMap = () => resolve();
    const script = document.createElement("script");
    const params = new URLSearchParams({
      key: BROWSER_KEY,
      loading: "async",
      callback: "__halalbitesInitMap",
    });
    if (TRACKING_ID) params.set("channel", TRACKING_ID);
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return window.__halalbitesMapReady;
}

interface Props {
  restaurants: MapRestaurant[];
  userLocation: { latitude: number; longitude: number } | null;
}

export function RestaurantMap({ restaurants, userLocation }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);

  const points = restaurants.filter(
    (r): r is MapRestaurant & { latitude: number; longitude: number } =>
      r.latitude != null && r.longitude != null,
  );

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        if (!mapRef.current) {
          const center = userLocation
            ? { lat: userLocation.latitude, lng: userLocation.longitude }
            : points[0]
              ? { lat: points[0].latitude, lng: points[0].longitude }
              : { lat: 33.749, lng: -84.388 }; // Atlanta
          mapRef.current = new google.maps.Map(containerRef.current, {
            center,
            zoom: 11,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
          infoRef.current = new google.maps.InfoWindow();
        }
      })
      .catch((err) => console.error("[RestaurantMap]", err));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    points.forEach((r) => {
      const position = { lat: r.latitude, lng: r.longitude };
      const marker = new google.maps.Marker({
        position,
        map: mapRef.current!,
        title: r.name,
      });
      marker.addListener("click", () => {
        if (!infoRef.current) return;
        const rating = Number(r.avg_rating ?? 0).toFixed(1);
        infoRef.current.setContent(
          `<div style="font-family:system-ui,sans-serif;min-width:180px">
            <div style="font-weight:600;font-size:14px;margin-bottom:2px">${escapeHtml(r.name)}</div>
            <div style="color:#666;font-size:12px;margin-bottom:6px">${escapeHtml(r.cuisine ?? "")}</div>
            <div style="font-size:12px;margin-bottom:6px">★ ${rating}</div>
            <a href="/restaurant/${r.id}" style="color:#c2410c;font-weight:600;font-size:12px;text-decoration:none">View details →</a>
          </div>`,
        );
        infoRef.current.open({ map: mapRef.current!, anchor: marker });
      });
      markersRef.current.push(marker);
      bounds.extend(position);
    });

    if (userLocation) {
      const userMarker = new google.maps.Marker({
        position: { lat: userLocation.latitude, lng: userLocation.longitude },
        map: mapRef.current,
        title: "You are here",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#2563eb",
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
      markersRef.current.push(userMarker);
      bounds.extend({ lat: userLocation.latitude, lng: userLocation.longitude });
    }

    if (points.length > 0) {
      mapRef.current.fitBounds(bounds, 60);
    }
  }, [points.length, userLocation?.latitude, userLocation?.longitude]);

  if (!BROWSER_KEY) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Map is unavailable right now.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-[420px] rounded-2xl border border-border overflow-hidden bg-muted"
    />
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
