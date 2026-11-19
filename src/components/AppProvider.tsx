"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { identifyAccount, initAnalytics, resetAnalytics } from "../lib/analytics";
import { browserLocation, reverseGeocode } from "../lib/geo";
import { clearSession, loadSession, saveSession } from "../lib/store";
import { setCatalog } from "../lib/assistant";
import type { GeoResult, Provider, Service, User } from "../lib/types";

const LOC_KEY = "kaamdaar.location";
const RADIUS_KEY = "kaamdaar.radius-km";
const LOCATION_PROMPT_DISMISSED_KEY = "kaamdaar.location-prompt-dismissed";

interface AppContextValue {
  user: User | null;
  ready: boolean;
  /** Live catalogue from the backend (Admin panel is the source of truth). */
  services: Service[];
  categories: string[];
  providers: Provider[];
  settings: Record<string, string>;
  refreshCatalog: () => Promise<void>;
  /** true once the catalogue fetch finished (so pages can show a loader, not "not found"). */
  catalogReady: boolean;
  location: GeoResult | null;
  locating: boolean;
  locationError: string | null;
  locationPromptVisible: boolean;
  dismissLocationPrompt: () => void;
  radiusKm: 3 | 5;
  setRadiusKm: (radius: 3 | 5) => void;
  detectLocation: (force?: boolean) => Promise<void>;
  setLocation: (next: GeoResult, source?: "manual" | "device") => void;
  signIn: (user: User) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [catalogReady, setCatalogReady] = useState(false);
  const [location, setLoc] = useState<GeoResult | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationPromptVisible, setLocationPromptVisible] = useState(true);
  const [radiusKm, setRadiusKmState] = useState<3 | 5>(5);
  /** Latest known point, read by refreshCatalog without re-creating it. */
  const locationRef = useRef<GeoResult | null>(null);
  const manualLocationSelectedRef = useRef(false);
  const locationRequestIdRef = useRef(0);

  const setLocation = useCallback((next: GeoResult, source: "manual" | "device" = "manual") => {
    const saved: GeoResult = { ...next, source };
    if (source === "manual") {
      manualLocationSelectedRef.current = true;
      locationRequestIdRef.current += 1; // invalidate any pending GPS lookup
    }
    locationRef.current = saved;
    setLoc(saved);
    setLocationError(null);
    setLocationPromptVisible(false);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LOC_KEY, JSON.stringify(saved));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const dismissLocationPrompt = useCallback(() => {
    setLocationPromptVisible(false);
    try {
      window.sessionStorage.setItem(LOCATION_PROMPT_DISMISSED_KEY, "1");
    } catch {
      /* ignore private-mode storage restrictions */
    }
  }, []);

  const setRadiusKm = useCallback((next: 3 | 5) => {
    setRadiusKmState(next);
    try {
      window.localStorage.setItem(RADIUS_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, []);

  const detectLocation = useCallback(async (force = false) => {
    if (manualLocationSelectedRef.current && !force) return;
    if (force) manualLocationSelectedRef.current = false;
    const requestId = ++locationRequestIdRef.current;

    setLocating(true);
    setLocationError(null);
    setLocationPromptVisible(false);
    try {
      const point = await browserLocation();
      const geo = await reverseGeocode(point);
      // If the user chose a locality while GPS/reverse-geocoding was pending,
      // discard this older device result instead of moving the service radius.
      if (requestId === locationRequestIdRef.current && !manualLocationSelectedRef.current) {
        setLocation(geo, "device");
      }
    } catch (error) {
      if (requestId === locationRequestIdRef.current && !manualLocationSelectedRef.current) {
        const code = error instanceof Error ? error.message : "unavailable";
        const message = code === "permission-denied"
          ? "Browser location permission is blocked. Allow Location access for this site in your browser settings, then retry."
          : code === "position-unavailable"
            ? "Your device could not determine the location. Turn on device Location/GPS and check your internet connection, then retry."
            : code === "timeout"
              ? "Location detection timed out. Move to an open area or check GPS, then retry."
              : "Unable to detect your location. Check browser permission and device GPS, then retry.";
        setLocationError(message);
        setLocationPromptVisible(true);
      }
    } finally {
      if (requestId === locationRequestIdRef.current) setLocating(false);
    }
  }, [setLocation]);

  const signIn = useCallback((next: User) => {
    setUser(next);
    saveSession(next);
    // analytics identity is the opaque account hash, never the phone number
    void identifyAccount(next.id);
  }, []);

  const refreshUser = useCallback(async () => {
    const session = loadSession();
    if (!session) return;
    // re-read the account from the backend so profile edits and admin
    // block/delete actions apply without re-login
    try {
      const res = await fetch(`/api/users/resolve?phone=${encodeURIComponent(session.phone)}`);
      if (res.status === 404) {
        clearSession();
        setUser(null);
        return;
      }
      if (res.ok) {
        const data = (await res.json()) as { user: User | null };
        if (data.user && data.user.status !== "blocked") {
          setUser(data.user);
          saveSession(data.user);
          return;
        }
        if (data.user?.status === "blocked") {
          clearSession();
          setUser(null);
          return;
        }
      }
    } catch {
      /* backend unreachable — keep the cached session */
    }
    setUser(session);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    resetAnalytics();
    setUser(null);
  }, []);

  const refreshCatalog = useCallback(async () => {
    // Area-aware: services a nearby Pro actually covers come back first, and
    // the rest of the catalogue still follows in the same list.
    const point = locationRef.current;
    const query = point ? `?lat=${point.lat}&lng=${point.lng}` : "";
    try {
      const res = await fetch(`/api/catalog${query}`);
      const data = (await res.json()) as {
        services?: Service[];
        categories?: string[];
        settings?: Record<string, string>;
      };
      const list = data.services ?? [];
      setSettings(data.settings ?? {});
      // An intentionally emptied catalogue (Admin bulk delete) is a valid
      // successful response too; never keep stale services in client state.
      setServices(list);
      setCategories(data.categories ?? []);
      setCatalog(list);
    } catch {
      /* keep the last successful catalog */
    }
    try {
      const res = await fetch("/api/providers");
      const data = (await res.json()) as { providers?: Provider[] };
      if (Array.isArray(data.providers)) setProviders(data.providers);
    } catch {
      /* keep the last successful provider list */
    }
    setCatalogReady(true);
  }, []);

  // Re-rank the catalogue the moment the customer's location is known or
  // changes, so "available in your area" services move to the top.
  useEffect(() => {
    if (!location) return;
    locationRef.current = location;
    void refreshCatalog();
  }, [location, refreshCatalog]);

  // Load the live catalogue + provider roster once the shell hydrates, so
  // every page renders what the Admin panel actually manages.
  useEffect(() => {
    queueMicrotask(() => void refreshCatalog());
    window.addEventListener("focus", refreshCatalog);
    return () => {
      window.removeEventListener("focus", refreshCatalog);
    };
  }, [refreshCatalog]);

  useEffect(() => {
    const theme = [
      ["--color-navy", settings.brand_navy],
      ["--color-blue-600", settings.brand_blue],
      ["--color-flame", settings.brand_orange],
      ["--color-flame-600", settings.brand_orange],
      ["--color-offwhite", settings.brand_background],
    ] as const;
    for (const [token, value] of theme) {
      if (value && /^#[\da-f]{6}$/i.test(value)) {
        document.documentElement.style.setProperty(token, value);
      }
    }
  }, [settings]);

  // Hydrate from localStorage after mount — reading it during render would
  // produce a server/client HTML mismatch on hydration.
  useEffect(() => {
    initAnalytics();

    const session = loadSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount hydration
    if (session) setUser(session);
    if (session) {
      void identifyAccount(session.id);
      void refreshUser(); // pull the latest row from the backend
    }

    let hasSavedLocation = false;
    let hasManualLocation = false;
    let promptDismissedThisSession = false;
    try {
      promptDismissedThisSession = window.sessionStorage.getItem(LOCATION_PROMPT_DISMISSED_KEY) === "1";
    } catch {
      /* ignore */
    }
    try {
      const cached = window.localStorage.getItem(LOC_KEY);
      if (cached) {
        const saved = JSON.parse(cached) as GeoResult;
        setLoc(saved);
        locationRef.current = saved;
        hasSavedLocation = true;
        hasManualLocation = saved.source === "manual";
        if (hasManualLocation) {
          manualLocationSelectedRef.current = true;
          setLocationPromptVisible(false);
        }
      }
      const cachedRadius = window.localStorage.getItem(RADIUS_KEY);
      if (cachedRadius === "3" || cachedRadius === "5") {
        setRadiusKmState(Number(cachedRadius) as 3 | 5);
      }
    } catch {
      /* ignore */
    }
    setReady(true);

    void (async () => {
      // A locality chosen from the Jaipur area list is an explicit user choice.
      // Keep it as the anchor for Area We Serve instead of replacing it with a
      // coarse desktop/browser geolocation result on every page load.
      if (hasManualLocation) return;

      let permissionAvailable = false;
      if (navigator.permissions?.query) {
        try {
          const permission = await navigator.permissions.query({ name: "geolocation" });
          if (permission.state === "granted") {
            void detectLocation();
            return;
          }
          permissionAvailable = true;
        } catch {
          /* show the in-app prompt when permission state is unavailable */
        }
      }
      if (!promptDismissedThisSession && (!hasSavedLocation || permissionAvailable)) {
        setLocationPromptVisible(true);
      }
    })();
  }, [detectLocation, refreshUser]);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      ready,
      services,
      categories,
      providers,
      settings,
      refreshCatalog,
      catalogReady,
      location,
      locating,
      locationError,
      locationPromptVisible,
      dismissLocationPrompt,
      radiusKm,
      setRadiusKm,
      detectLocation,
      setLocation,
      signIn,
      refreshUser,
      logout,
    }),
    [user, ready, services, categories, providers, settings, refreshCatalog, catalogReady, location, locating, locationError, locationPromptVisible, dismissLocationPrompt, radiusKm, setRadiusKm, detectLocation, setLocation, signIn, refreshUser, logout],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
