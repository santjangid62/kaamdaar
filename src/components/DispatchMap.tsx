"use client";

/**
 * Map used by the dispatch and tracking flows — nearby Pros appear as pins
 * on the map only (no list), the user's location is the centre pin, and the
 * accepted Pro's marker moves during live tracking.
 *
 * Leaflet is imported dynamically inside an effect so the module never
 * touches `window` during SSR.
 */
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker, Circle } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPoint } from "../lib/types";

export interface MapProviderMarker {
  id: string;
  point: GeoPoint;
  rating: number;
  name: string;
  /** accepted Pro — bigger marker that animates towards the user */
  moving?: boolean;
  /** dispatch searching — pulsing ring */
  pulse?: boolean;
}

interface Props {
  center: GeoPoint;
  user: GeoPoint;
  providers: MapProviderMarker[];
  radiusKm?: number;
  /** fit the viewport once when providers first arrive */
  autoFit?: boolean;
  className?: string;
}

type LayerState = {
  user: Marker | null;
  circle: Circle | null;
  pros: Map<string, Marker>;
  flags: Map<string, string>;
  fitted: boolean;
};

const MAP_CSS = `
.kd-icon { background: none !important; border: none !important; }
.kd-user { display:block; width:24px; height:24px; border-radius:50%;
  background:#0f2d4f; border:3px solid #f26a21; box-shadow:0 2px 10px rgba(0,0,0,.35); }
.kd-pro { position:relative; display:grid; place-items:center; width:34px; height:34px;
  background:#0f2d4f; border:2px solid #fff; border-radius:50% 50% 50% 6px;
  font-size:15px; line-height:1; box-shadow:0 3px 10px rgba(0,0,0,.35); }
.kd-pro-move { width:42px; height:42px; font-size:21px; background:#f26a21;
  border-radius:50% 50% 6px 50%; animation:kd-bob 1s ease-in-out infinite; }
.kd-pro-pulse::after { content:""; position:absolute; inset:-7px; border-radius:50%;
  border:2px solid #f26a21; animation:kd-ping 1.5s ease-out infinite; }
@keyframes kd-ping { 0% { transform:scale(.6); opacity:.9 } 100% { transform:scale(1.5); opacity:0 } }
@keyframes kd-bob { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-4px) } }
`;

export default function DispatchMap({
  center,
  user,
  providers,
  radiusKm = 3,
  autoFit = true,
  className = "",
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const renderRef = useRef<(() => void) | null>(null);
  const stateRef = useRef<LayerState>({
    user: null,
    circle: null,
    pros: new Map(),
    flags: new Map(),
    fitted: false,
  });
  const propsRef = useRef({ center, user, providers, radiusKm, autoFit });

  // keep the latest props available to the imperative map layer
  useEffect(() => {
    propsRef.current = { center, user, providers, radiusKm, autoFit };
  });

  // init once — dynamic import keeps leaflet off the server
  useEffect(() => {
    let disposed = false;

    void import("leaflet").then((mod) => {
      const L = mod.default;
      if (disposed || !elRef.current || mapRef.current) return;

      const map = L.map(elRef.current, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const icon = (html: string, size: [number, number], anchor: [number, number]) =>
        L.divIcon({ className: "kd-icon", html, iconSize: size, iconAnchor: anchor });

      const render = () => {
        const { center: c, user: u, providers: list, radiusKm: r, autoFit: fit } = propsRef.current;
        const st = stateRef.current;

        // user pin
        if (!st.user) {
          st.user = L.marker([u.lat, u.lng], {
            icon: icon(`<span class="kd-user"></span>`, [24, 24], [12, 12]),
            zIndexOffset: 600,
          }).addTo(map);
        } else {
          st.user.setLatLng([u.lat, u.lng]);
        }

        // 2–3 km radius ring
        if (!st.circle) {
          st.circle = L.circle([c.lat, c.lng], r * 1000, {
            color: "#f26a21",
            weight: 1.5,
            dashArray: "6 8",
            fillColor: "#f26a21",
            fillOpacity: 0.04,
          }).addTo(map);
        } else {
          st.circle.setLatLng([c.lat, c.lng]);
          st.circle.setRadius(r * 1000);
        }

        // provider markers
        const seen = new Set<string>();
        for (const p of list) {
          seen.add(p.id);
          const flag = `${p.moving ? "m" : ""}${p.pulse ? "p" : ""}`;
          const html = p.moving
            ? `<span class="kd-pro kd-pro-move">🛵</span>`
            : `<span class="kd-pro${p.pulse ? " kd-pro-pulse" : ""}">🧑‍🔧</span>`;
          const existing = stateRef.current.pros.get(p.id);
          if (existing) {
            existing.setLatLng([p.point.lat, p.point.lng]);
            if (st.flags.get(p.id) !== flag) {
              existing.setIcon(
                icon(html, p.moving ? [42, 42] : [34, 34], p.moving ? [21, 21] : [17, 17]),
              );
              st.flags.set(p.id, flag);
            }
          } else {
            const marker = L.marker([p.point.lat, p.point.lng], {
              icon: icon(html, p.moving ? [42, 42] : [34, 34], p.moving ? [21, 21] : [17, 17]),
              zIndexOffset: p.moving ? 500 : 0,
            })
              .bindTooltip(`${p.name} · ⭐ ${p.rating}`, { direction: "top", offset: [0, -18] })
              .addTo(map);
            st.pros.set(p.id, marker);
            st.flags.set(p.id, flag);
          }
        }
        for (const [id, marker] of st.pros) {
          if (!seen.has(id)) {
            marker.remove();
            st.pros.delete(id);
            st.flags.delete(id);
          }
        }

        // one-time fit around user + Pros
        if (fit && !st.fitted && list.length > 0) {
          const bounds = L.latLngBounds([
            [u.lat, u.lng],
            ...list.map((p) => [p.point.lat, p.point.lng] as [number, number]),
          ]);
          map.fitBounds(bounds.pad(0.25), { animate: false });
          st.fitted = true;
        }
      };

      renderRef.current = render;
      render();
    });

    return () => {
      disposed = true;
      renderRef.current = null;
      stateRef.current = {
        user: null,
        circle: null,
        pros: new Map(),
        flags: new Map(),
        fitted: false,
      };
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // repaint after every parent render — propsRef already holds the latest
  useEffect(() => {
    renderRef.current?.();
  });

  return (
    <div className={`relative ${className}`}>
      <style dangerouslySetInnerHTML={{ __html: MAP_CSS }} />
      <div ref={elRef} className="h-full w-full rounded-2xl" />
    </div>
  );
}