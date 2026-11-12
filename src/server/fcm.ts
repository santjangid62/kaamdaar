import { createSign } from "node:crypto";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

let cachedAccessToken: { value: string; expiresAt: number } | null = null;

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

async function accessToken(account: ServiceAccount): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.value;
  }
  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64url(JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })),
  ].join(".");
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(account.private_key, "base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`Google OAuth token exchange failed: ${response.status}`);
  const data = await response.json() as { access_token: string; expires_in: number };
  cachedAccessToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export async function sendProviderJobOffer(
  tokens: string[],
  booking: { id: string; serviceName?: string; serviceId: string; offerExpiresAt: number },
): Promise<void> {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw || tokens.length === 0) return;

  const account = JSON.parse(raw) as ServiceAccount;
  const projectId = process.env.FIREBASE_PROJECT_ID || account.project_id;
  if (!account.client_email || !account.private_key || !projectId) {
    throw new Error("Firebase service account is missing required fields");
  }
  const bearer = await accessToken(account);
  const secondsLeft = Math.max(0, Math.floor((booking.offerExpiresAt - Date.now()) / 1000));
  if (secondsLeft <= 0) return;

  const message = {
    notification: {
      title: "New Kaamdaar job request",
      body: `${booking.serviceName || booking.serviceId} • Accept within 40 seconds`,
    },
    data: {
      type: "job_offer",
      bookingId: booking.id,
      expiresAt: String(booking.offerExpiresAt),
    },
    android: {
      priority: "HIGH",
      ttl: `${secondsLeft}s`,
      notification: { sound: "default" },
    },
    apns: {
      headers: {
        "apns-priority": "10",
        "apns-expiration": String(Math.floor(booking.offerExpiresAt / 1000)),
      },
      payload: { aps: { sound: "default" } },
    },
  };

  await Promise.all(tokens.map(async (token) => {
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${bearer}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ message: { ...message, token } }),
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      // Invalid tokens are left for the next cleanup pass; a push failure
      // must never prevent a customer booking from being created.
      console.error("[fcm] provider push failed", response.status, detail.slice(0, 500));
    }
  }));
}
