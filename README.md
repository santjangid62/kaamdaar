# Kaamdaar

## Production integrations

- **MongoDB Atlas** is the authoritative application database. Set `MONGODB_URI` and `MONGODB_DB=kaamdaar` in Vercel for Production, Preview, and Development. Production refuses to fall back to the ephemeral `/tmp` JSON store.
- **Firebase Phone Authentication** verifies customer/provider phone OTP. Configure all six `NEXT_PUBLIC_FIREBASE_*` Web App values from the Firebase project and enable Phone as a sign-in provider in Firebase Authentication. Add the deployed website domains to Firebase Authentication → Settings → Authorized domains.
- **Firebase Cloud Messaging (FCM)** sends provider job-offer push notifications. Set `FIREBASE_PROJECT_ID` and the complete service-account JSON in `FIREBASE_SERVICE_ACCOUNT_JSON` as encrypted Vercel environment variables. Never commit service-account JSON to Git.
- **Super Admin login** requires `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET` in Production. Use a strong unique password and a randomly generated session secret of at least 32 characters. Production will not accept the built-in development credentials.

### Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill the Firebase Web App values and MongoDB Atlas connection string.
3. Set the three Admin credentials. Keep `.env.local` out of Git.
4. Install dependencies with `npm ci`, then run `npm run dev`.
5. Check `GET /api/health` for a non-secret readiness report.

### Production readiness

`GET /api/health` performs a read-only MongoDB ping and reports whether Firebase Phone Auth, FCM, and secure Admin credentials are configured. It never returns credential values. A missing production MongoDB connection, Firebase Web configuration, FCM service account, or Admin credential set is reported as not ready.

## Commands

```bash
npm ci
npm run lint
npm run build
npm run dev
```
