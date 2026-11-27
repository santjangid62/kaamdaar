import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { claimDeviceSession, consumeDevicePairingCode, get, patch } from "./db";

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
  pairingCodeHash?: string;
  pairingExpiresAt?: number;
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
    const account = await get<{ id: string; status?: string }>(
      payload.role === "provider" ? "providers" : "users",
      payload.accountId,
    );
    if (!account || account.status === "blocked" || account.status === "deleted") return null;
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
  if (Date.now() - current.lastSeenAt < 5 * 60 * 1000) return;
  await patch("deviceSessions", accountKeyValue, { lastSeenAt: Date.now() });
}

export async function revokeDeviceSession(role: AccountRole, accountId: string): Promise<void> {
  const key = accountKey(role, accountId);
  const current = await get<DeviceSessionRecord>("deviceSessions", key);
  if (!current) return;
  await patch("deviceSessions", key, { revokedAt: Date.now() });
}

/** Create a six-digit, three-minute pairing code on the active native session. */
export async function createDevicePairingCode(role: AccountRole, accountId: string, sessionId: string): Promise<{ code: string; expiresAt: number } | null> {
  const key = accountKey(role, accountId);
  const current = await get<DeviceSessionRecord>("deviceSessions", key);
  if (!current || current.sessionId !== sessionId || current.revokedAt || current.expiresAt <= Date.now()) return null;
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = Date.now() + 3 * 60 * 1000;
  const hash = createHmac("sha256", secret()).update(`pair:${code}`).digest("hex");
  await patch("deviceSessions", key, { pairingCodeHash: hash, pairingExpiresAt: expiresAt });
  return { code, expiresAt };
}

/** Consume a pairing code once and mint a short-lived browser cookie token. */
export async function consumeDevicePairingCodeAndCreateWebToken(code: string): Promise<{ token: string; session: DeviceSessionRecord } | null> {
  if (!/^\\d{6}$/.test(code)) return null;
  const hash = createHmac("sha256", secret()).update(`pair:${code}`).digest("hex");
  const session = await consumeDevicePairingCode<DeviceSessionRecord>(hash, Date.now());
  if (!session || session.revokedAt || session.expiresAt <= Date.now()) return null;
  const expiresAt = Math.min(session.expiresAt, Date.now() + 12 * 60 * 60 * 1000);
  const payload = Buffer.from(JSON.stringify({
    accountKey: session.id,
    accountId: session.accountId,
    role: session.role,
    phone: session.phone,
    uid: session.uid,
    sessionId: session.sessionId,
    exp: Math.floor(expiresAt / 1000),
  })).toString("base64url");
  const unsigned = `ks1.${payload}`;
  return { token: `${unsigned}.${sign(unsigned)}`, session };
}

/** Short-lived, signed browser session issued after Firebase Phone OTP. */
export function createWebSessionToken(input: { phone: string; uid: string; role: AccountRole; accountId: string }): string {
  const payload = Buffer.from(JSON.stringify({
    ...input, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
  })).toString("base64url");
  const unsigned = `kw1.${payload}`;
  return `${unsigned}.${sign(unsigned)}`;
}

export function validateWebSession(token: string): {
  phone: string; uid: string; role: AccountRole; accountId: string;
} | null {
  if (!token.startsWith("kw1.")) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const unsigned = `${parts[0]}.${parts[1]}`;
  try {
    const expected = Buffer.from(sign(unsigned), "base64url");
    const actual = Buffer.from(parts[2], "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      phone?: string; uid?: string; role?: AccountRole; accountId?: string; exp?: number;
    };
    if (!payload.phone || !payload.uid || !payload.accountId ||
        (payload.role !== "customer" && payload.role !== "provider") ||
        typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return { phone: payload.phone, uid: payload.uid, role: payload.role, accountId: payload.accountId };
  } catch { return null; }
}
