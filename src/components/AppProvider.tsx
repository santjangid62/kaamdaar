"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { identifyAccount, initAnalytics, resetAnalytics } from "../lib/analytics";
import { browserLocation, reverseGeocode } from "../lib/geo";
import { clearSession, loadSession, saveSession } from "../lib/store";
import type { GeoResult, User } from "../lib/types";

const LOC_KEY = "kaamdaar.location";

interface AppContextValue {
  user: User | null;
  ready: boolean;
  location: GeoResult | null;
  locating: boolean;
  locationError: string | null;
  detectLocation: () => Promise<void>;
  setLocation: (next: GeoResult) => void;
  signIn: (user: User) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [location, setLoc] = useState<GeoResult | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const setLocation = useCallback((next: GeoResult) => {
    setLoc(next);
    setLocationError(null);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LOC_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }
  }, []);

  const detectLocation = useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const point = await browserLocation();
      const geo = await reverseGeocode(point);
      setLocation(geo);
    } catch {
      setLocationError("Location access denied");
    } finally {
      setLocating(false);
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
    if (session) setUser(session);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    resetAnalytics();
    setUser(null);
  }, []);

  // Hydrate from localStorage after mount — reading it during render would
  // produce a server/client HTML mismatch on hydration.
  useEffect(() => {
    initAnalytics();

    const session = loadSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount hydration
    if (session) setUser(session);
    if (session) void identifyAccount(session.id);

    try {
      const cached = window.localStorage.getItem(LOC_KEY);
      if (cached) setLoc(JSON.parse(cached) as GeoResult);
    } catch {
      /* ignore */
    }
    setReady(true);

    let asked = false;
    try {
      asked = Boolean(window.localStorage.getItem(LOC_KEY));
    } catch {
      /* ignore */
    }
    if (!asked) void detectLocation();
  }, [detectLocation]);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      ready,
      location,
      locating,
      locationError,
      detectLocation,
      setLocation,
      signIn,
      refreshUser,
      logout,
    }),
    [user, ready, location, locating, locationError, detectLocation, setLocation, signIn, refreshUser, logout],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
