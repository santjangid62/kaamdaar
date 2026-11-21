import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { claimDeviceSession, get, patch } from "./db";

export type AccountRole = "customer" | "provider";
export type DeviceSessionRecord = {
  id: string;
  accountId: string;
  role: AccountRole;
  phone: string;
  uid: string;
  deviceId: string;
  deviceName: string;
  platform: "mobile_app";
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
  locationAt?: number;
  loginAt: number;
  lastSeenAt: number;
  sessionId: string;
  expiresAt: number;
  revokedAt: number | null;
};

export type DeviceConflict = {
  code: "DEVICE_ALREADY_ACTIVE";
  error: string;
  existingDevice: {
    deviceName: string;
    location: string;
    locationAt: number | null;
    loginAt: number;
  };
};

function secret(): string {
  const value = process.env.DEVICE_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("DEVICE_SESSION_SECRET must be configured with at least 32 characters");
  }
  return value;
}

function accountKey(role: AccountRole, accountId: string): string {
  return `${role}:${accountId}`;
}

function sign(unsigned: string): string {
  return createHmac("sha256", secret()).update(unsigned).digest("base64url");
}

export async function createDeviceSession(input: {
  accountId: string;
  role: AccountRole;
  phone: string;
  uid: string;
  deviceId: string;
  deviceName: string;
  locationLabel?: string;
  latitude?: number;
  longitude?: number;
}): Promise<{ token: string; session: DeviceSessionRecord } | { conflict: DeviceConflict }> {
  if (!input.deviceId || input.deviceId.length > 160) {
    throw new Error("A stable app installation ID is required");
  }
  const now = Date.now();
  const key = accountKey(input.role, input.accountId);
  const session: DeviceSessionRecord = {
    id: key,
    ...input,
    platform: "mobile_app",
    loginAt: now,
    lastSeenAt: now,
    ...(Number.isFinite(input.latitude) && Number.isFinite(input.longitude)
      ? { locationAt: now }
      : {}),
    sessionId: randomUUID(),
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    revokedAt: null,
  };
  const claimed = await claimDeviceSession<DeviceSessionRecord>(key, session);
  if (!claimed.claimed || !claimed.session) {
    const existing = claimed.session;
    return {
      conflict: {
        code: "DEVICE_ALREADY_ACTIVE",
        error: "This account is already active on another device. Sign out there or contact support.",
        existingDevice: {
          deviceName: existing?.deviceName || "Unknown device",
          location: existing?.locationLabel || "Location unavailable",
          locationAt: typeof existing?.locationAt === "number" ? existing.locationAt : null,
          loginAt: typeof existing?.loginAt === "number" ? existing.loginAt : 0,
        },
      },
    };
  }
  const payload = Buffer.from(JSON.stringify({
    accountKey: key,
    accountId: input.accountId,
    role: input.role,
    phone: input.phone,
    uid: input.uid,
    sessionId: session.sessionId,
    exp: Math.floor(session.expiresAt / 1000),
  })).toString("base64url");
  const unsigned = `ks1.${payload}`;
  return { token: `${unsigned}.${sign(unsigned)}`, session };
}

export async function validateDeviceSession(token: string): Promise<{
  phone: string;
  uid: string;
  role: AccountRole;
  accountId: string;
  sessionId: string;
  deviceId: string;
} | null> {
  if (!token.startsWith("ks1.")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const unsigned = `${parts[0]}.${parts[1]}`;
  let expected: Buffer;
  let actual: Buffer;
  try {
    expected = Buffer.from(sign(unsigned), "base64url");
    actual = Buffer.from(parts[2], "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      accountKey?: string; accountId?: string; role?: AccountRole; phone?: string;
      uid?: string; sessionId?: string; exp?: number;
    };
    if (!payload.accountKey || !payload.accountId ||
        (payload.role !== "customer" && payload.role !== "provider") ||
        !payload.phone || !payload.uid || !payload.sessionId ||
        typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    const session = await get<DeviceSessionRecord>("deviceSessions", payload.accountKey);
    if (!session || session.revokedAt || session.expiresAt <= Date.now() ||
        session.sessionId !== payload.sessionId || session.accountId !== payload.accountId ||
        session.role !== payload.role || session.phone !== payload.phone) return null;
    return {
      phone: session.phone,
      uid: session.uid,
      role: session.role,
      accountId: session.accountId,
      sessionId: session.sessionId,
      deviceId: session.deviceId,
    };
  } catch {
    return null;
  }
}

export async function touchDeviceSession(accountKeyValue: string, sessionId: string): Promise<void> {
  const current = await get<DeviceSessionRecord>("deviceSessions", accountKeyValue);
  if (!current || current.sessionId !== sessionId || current.revokedAt) return;
  await patch("deviceSessions", accountKeyValue, { lastSeenAt: Date.now() });
}

export async function revokeDeviceSession(role: AccountRole, accountId: string): Promise<void> {
  const key = accountKey(role, accountId);
  const current = await get<DeviceSessionRecord>("deviceSessions", key);
  if (!current) return;
  await patch("deviceSessions", key, { revokedAt: Date.now() });
}
