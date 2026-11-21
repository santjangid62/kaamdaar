/**
 * Device-bound sessions for Customer and Provider native apps.
 *
 * Firebase remains the phone-OTP authority. This module adds a server-owned
 * device lock and a signed bearer session. A native installation must send a
 * stable installation ID; browsers are paired separately and never claim a
 * device lock by IP address or browser fingerprint.
 */
import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { consumeDevicePairingCode, get, insert, patch, remove, setDevicePairingCode } from "./db";

export type DeviceRole = "customer" | "provider";

export type DeviceLocation = {
  label?: string;
  latitude?: number;
  longitude?: number;
  updatedAt: number;
};

export type DeviceSessionRecord = {
  id: string;
  role: DeviceRole;
  phone: string;
  uid: string;
  deviceId: string;
  deviceName: string;
  sessionId: string;
  loginAt: number;
  lastSeenAt: number;
  location?: DeviceLocation;
  status: "active";
  pairCodeHash?: string;
  pairCodeExpiresAt?: number;
  pairCodeCreatedAt?: number;
};

type SessionPayload = {
  iss: "kaamdaar-device-session";
  sub: string;
  phone: string;
  role: DeviceRole;
  deviceId: string;
  sessionId: string;
  clientType: "native" | "web";
  exp: number;
};

export type DeviceConflict = {
  code: "DEVICE_ALREADY_ACTIVE";
  error: string;
  existingDevice: {
    deviceName: string;
    loginAt: number;
    lastSeenAt: number;
    location: DeviceLocation | null;
  };
};

function secret(): string {
  // Preview QA can reuse its already branch-scoped QA secret. Production
  // must configure a dedicated DEVICE_SESSION_SECRET in Vercel.
  const value = process.env.DEVICE_SESSION_SECRET?.trim() ||
    (process.env.QA_MOBILE_AUTH_ENABLED === "true" ? process.env.QA_MOBILE_AUTH_SECRET?.trim() : "");
  if (!value) throw new Error("DEVICE_SESSION_SECRET is not configured");
  return value;
}

function lockId(role: DeviceRole, phone: string): string {
  return `device:${role}:${phone}`;
}

function sign(unsigned: string): string {
  return createHmac("sha256", secret()).update(unsigned).digest("base64url");
}

function encode(payload: SessionPayload): string {
  const unsigned = `kd1.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  return `${unsigned}.${sign(unsigned)}`;
}

function decode(token: string): SessionPayload | null {
  const [version, body, signature, extra] = token.split(".");
  if (version !== "kd1" || !body || !signature || extra) return null;
  try {
    const unsigned = `${version}.${body}`;
    const expected = Buffer.from(sign(unsigned), "base64url");
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (payload.iss !== "kaamdaar-device-session" ||
        !payload.sub || !payload.phone || !payload.deviceId || !payload.sessionId ||
        (payload.clientType !== "native" && payload.clientType !== "web") ||
        (payload.role !== "customer" && payload.role !== "provider") ||
        !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Claims the single native-device slot for an account. Mongo's unique _id
 * makes the first insert the winner under concurrent first logins. The
 * losing request re-reads the winner and returns a conflict; it never
 * overwrites another installation's lock.
 */
export async function claimDeviceSession(input: {
  role: DeviceRole;
  phone: string;
  uid: string;
  deviceId: string;
  deviceName: string;
  location?: DeviceLocation;
}): Promise<{ token: string; session: DeviceSessionRecord } | { conflict: DeviceConflict }> {
  const { role, phone, uid, deviceId } = input;
  if (!deviceId.trim() || deviceId.length > 180) throw new Error("A valid device installation ID is required");
  if (!input.deviceName.trim() || input.deviceName.length > 120) throw new Error("A valid device name is required");

  const id = lockId(role, phone);
  const now = Date.now();
  let current = await get<DeviceSessionRecord>("deviceSessions", id);

  if (!current) {
    const sessionId = randomUUID();
    const candidate: DeviceSessionRecord = {
      id, role, phone, uid, deviceId, deviceName: input.deviceName.trim(),
      sessionId, loginAt: now, lastSeenAt: now, location: input.location, status: "active",
    };
    try {
      current = await insert<DeviceSessionRecord>("deviceSessions", candidate);
    } catch {
      // A concurrent login may have won the unique _id. Re-read below.
      current = await get<DeviceSessionRecord>("deviceSessions", id);
      if (!current) throw new Error("Could not claim the device session; please retry");
    }
  }

  if (current.deviceId !== deviceId) {
    return {
      conflict: {
        code: "DEVICE_ALREADY_ACTIVE",
        error: "This account is already active on another device. Sign out there or contact support to recover access.",
        existingDevice: {
          deviceName: current.deviceName,
          loginAt: current.loginAt,
          lastSeenAt: current.lastSeenAt,
          location: current.location ?? null,
        },
      },
    };
  }

  // Same native installation: refresh the bearer session and its metadata.
  const sessionId = randomUUID();
  const session = await patch<DeviceSessionRecord>("deviceSessions", id, {
    uid, deviceName: input.deviceName.trim(), sessionId, lastSeenAt: now,
    ...(input.location ? { location: input.location } : {}),
  });
  if (!session) throw new Error("The device session disappeared; please sign in again");

  const exp = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
  const token = encode({
    iss: "kaamdaar-device-session",
    sub: uid,
    phone,
    role,
    deviceId,
    sessionId,
    clientType: "native",
    exp,
  });
  return { token, session };
}

export async function verifyDeviceSessionToken(token: string): Promise<{
  phone: string;
  uid: string;
  role: DeviceRole;
  deviceId: string;
  sessionId: string;
  clientType: "native" | "web";
} | null> {
  const payload = decode(token);
  if (!payload) return null;
  const session = await get<DeviceSessionRecord>("deviceSessions", lockId(payload.role, payload.phone));
  if (!session || session.status !== "active" ||
      session.sessionId !== payload.sessionId ||
      session.deviceId !== payload.deviceId ||
      session.uid !== payload.sub) return null;
  return {
    phone: session.phone,
    uid: session.uid,
    role: session.role,
    deviceId: session.deviceId,
    sessionId: session.sessionId,
    clientType: payload.clientType,
  };
}

export async function touchDeviceSession(
  role: DeviceRole,
  phone: string,
  deviceId: string,
  location?: DeviceLocation,
): Promise<boolean> {
  const id = lockId(role, phone);
  const current = await get<DeviceSessionRecord>("deviceSessions", id);
  if (!current || current.deviceId !== deviceId || current.status !== "active") return false;
  await patch<DeviceSessionRecord>("deviceSessions", id, {
    lastSeenAt: Date.now(),
    ...(location ? { location } : {}),
  });
  return true;
}

export async function releaseDeviceSession(
  role: DeviceRole,
  phone: string,
  deviceId: string,
): Promise<boolean> {
  const id = lockId(role, phone);
  const current = await get<DeviceSessionRecord>("deviceSessions", id);
  if (!current || current.deviceId !== deviceId) return false;
  return remove("deviceSessions", id);
}

/** Create a six-digit, five-minute pairing code for the authorized native app. */
export async function createWebPairingCode(
  role: DeviceRole,
  phone: string,
  deviceId: string,
): Promise<{ code: string; expiresAt: number }> {
  const id = lockId(role, phone);
  const session = await get<DeviceSessionRecord>("deviceSessions", id);
  if (!session || session.status !== "active" || session.deviceId !== deviceId) {
    throw new Error("Only the currently authorized app device can create a web pairing code");
  }
  const code = String(randomInt(100000, 1000000));
  const now = Date.now();
  const expiresAt = now + 5 * 60 * 1000;
  const codeHash = createHash("sha256")
    .update(`${role}:${phone}:${code}:${secret()}`)
    .digest("hex");
  const saved = await setDevicePairingCode(id, session.sessionId, codeHash, expiresAt, now);
  if (!saved) throw new Error("The app session changed. Please retry pairing.");
  return { code, expiresAt };
}

/** Consume a one-time pairing code and issue a browser session on the same device lock. */
export async function consumeWebPairingCode(
  role: DeviceRole,
  phone: string,
  uid: string,
  code: string,
): Promise<string | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const id = lockId(role, phone);
  const codeHash = createHash("sha256")
    .update(`${role}:${phone}:${code}:${secret()}`)
    .digest("hex");
  const consumed = await consumeDevicePairingCode(id, uid, codeHash, Date.now());
  if (!consumed) return null;
  const session = consumed as unknown as DeviceSessionRecord;
  const exp = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
  return encode({
    iss: "kaamdaar-device-session",
    sub: session.uid,
    phone: session.phone,
    role: session.role,
    deviceId: session.deviceId,
    sessionId: session.sessionId,
    clientType: "web",
    exp,
  });
}
