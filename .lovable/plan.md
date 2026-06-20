# Device Restriction & Anti-Fraud System

Builds a "one primary account per device" system across MealNest, with admin overrides, device transfer workflow, trusted-device management, and risk scoring. Reuses the existing fraud/audit pattern from the rewards work.

## What the user will see

- **At signup** (`/auth`): registration is blocked if the device already has an account, with the exact message:
  > "An account is already registered on this device. Please log in using the existing account or contact support."
  A "Request override" link opens a small form (reason + contact) that creates an admin review ticket.
- **In account settings** → new "Devices" page: list of devices linked to the user (name, last login, IP/city, current device badge), with **Logout device**, **Remove device**, and **Report unknown** actions, plus a "Transfer to this device" flow that emails a verification code.
- **Becoming a seller / delivery agent**: same check — blocked if the device already hosts a different role account, unless admin-approved.
- **Mystery Wheel & coupons**: silently scoped to device fingerprint in addition to user, so multi-account farming on one device hits the same daily/first-time limits.
- **Admin → Rewards & Promotions → Devices** (new tab): table of devices, linked accounts, risk score (Low/Medium/High/Critical), fraud events, plus actions: approve override, remove restriction, merge duplicates, force logout, blacklist.
- **Admin → Analytics**: new tiles for Total devices, Avg accounts/device, Fraud attempts prevented (signup / referral / coupon / wheel), top risky devices.

## Scope boundaries

- Fingerprint = stable client-side hash from UA + platform + language + timezone + screen + canvas + WebGL renderer + persistent `localStorage` install ID. No third-party fingerprinting library; no native hardware IDs (browser can't access them). Documented as best-effort, not cryptographic identity.
- "Email verification" for device transfer uses Supabase Auth's existing email OTP flow (no new mail provider).
- Family-sharing exceptions handled through the same admin override queue (no separate UI).
- Out of scope: IP geolocation lookup (we store IP only; city/country shown as "—" unless a geo provider is added later), SMS verification, real-time device push notifications, native mobile app integration.

## Technical plan

### Migration (new)

Tables (all with `GRANT`s + RLS, `service_role` full, `authenticated` scoped):

- `devices` — `id uuid pk`, `fingerprint text unique`, `name text`, `user_agent text`, `platform text`, `first_seen_at`, `last_seen_at`, `status text default 'active'` (`active|blocked|pending_transfer`), `risk_score int default 0`, `risk_level text default 'low'`, `blacklisted bool default false`, `notes text`.
- `device_accounts` — `id`, `device_id fk`, `user_id fk auth.users`, `role app_role`, `is_primary bool`, `approval_status text default 'auto'` (`auto|pending|approved|rejected`), `approved_by`, `approved_at`, `created_at`. Unique `(device_id, user_id)`.
- `device_sessions` — `id`, `device_id`, `user_id`, `ip text`, `last_active_at`, `revoked_at`. For "active devices" list.
- `device_override_requests` — `id`, `device_id`, `requesting_email text`, `reason text`, `contact text`, `status text default 'pending'`, `decided_by`, `decided_at`, `created_at`.
- `device_transfer_requests` — `id`, `user_id`, `from_device_id`, `to_device_id`, `otp_hash text`, `expires_at`, `status text default 'pending'`, `created_at`.
- `device_audit_log` — `id`, `device_id`, `user_id?`, `action text`, `success bool`, `details jsonb`, `ip text`, `created_at`.
- `device_fraud_events` — `id`, `device_id`, `user_id?`, `kind text` (`signup_blocked|referral_blocked|coupon_blocked|wheel_blocked|role_blocked`), `details jsonb`, `created_at`.

Functions (SECURITY DEFINER, `search_path=public`):

- `register_device(_fingerprint, _ua, _platform, _ip) -> uuid` — upserts device, updates `last_seen_at`, returns id.
- `check_device_signup(_fingerprint, _role) -> (allowed bool, reason text, device_id uuid)` — returns false if active primary account exists for any role; logs `device_fraud_events` with `signup_blocked` / `role_blocked`.
- `link_device_account(_device, _user, _role)` — inserts `device_accounts`, marks primary if first.
- `recompute_device_risk(_device)` — risk score from fraud events count + distinct accounts + age; sets `risk_level`.
- `request_device_override(_fingerprint, _email, _reason, _contact)` — inserts into `device_override_requests`.
- `admin_decide_override(_id, _approve, _admin)` — admin-only via `has_role`.
- `start_device_transfer(_user, _to_device) -> otp` — generates 6-digit code, hashed, 15-min expiry.
- `complete_device_transfer(_user, _to_device, _otp)` — validates, deactivates old device link, activates new one.
- Extend `spin_wheel_v2` and `apply_referral_code_v2` to accept `_device_id` and count by device too. Extend `redeem_coupon` to reject when a `first-order`/`new_customer` coupon was already redeemed by ANY user on the same device (lookup via `device_accounts`).

### Client

- `src/lib/device.ts` — `getDeviceFingerprint()` (cached install id + hash of stable signals), `ensureDeviceRegistered()` (calls server fn on first load, stores `device_id` in localStorage).
- `src/lib/devices.functions.ts` — server fns: `registerDevice`, `checkDeviceForSignup`, `linkDeviceToUser`, `listMyDevices`, `removeMyDevice`, `requestOverride`, `startTransfer`, `confirmTransfer`. Admin fns: `listDevices`, `deviceDetail`, `decideOverride`, `removeDeviceRestriction`, `mergeAccounts`, `blacklistDevice`.
- Wire `__root.tsx` to call `ensureDeviceRegistered()` on mount (non-blocking, no UI).
- `/auth` page: before sign-up submit, call `checkDeviceForSignup`. On block, show the standardized message + override-request modal.
- `/become-seller` and `/delivery.register`: same pre-check with role=`seller` / `delivery_agent`.
- After successful sign-up / sign-in: call `linkDeviceToUser` to register the session.
- `SpinWheel.tsx`: pass `device_id` to spin server fn.
- Referral apply (existing): pass device id (already wired to fingerprint, extend to use new device id).
- New route `/_authenticated/devices.tsx`: my-devices management.
- New route `/_authenticated/admin/rewards/devices.tsx` (added to rewards admin tab bar): admin device dashboard with risk filters, override queue, blacklist toggle, audit log drawer.
- Analytics tab: add device fraud tiles via a new server fn `getDeviceFraudAnalytics`.

### Security & correctness

- All admin endpoints gated by `has_role(uid,'admin')`; all writes go through `device_audit_log`.
- RLS: users see only their own `device_accounts` / `device_sessions` / `device_transfer_requests`; admins see all via `has_role`.
- Fingerprint is best-effort — never used as sole auth; account ownership still requires Supabase Auth session. Document this in code comments.
- Rate-limit `check_device_signup` (5/hour per fingerprint) via `reward_claim_attempts`-style table reuse.

## Files touched

New: migration, `src/lib/device.ts`, `src/lib/devices.functions.ts`, `src/routes/_authenticated/devices.tsx`, `src/routes/_authenticated/admin/rewards/devices.tsx`.
Edited: `src/routes/__root.tsx`, `src/routes/auth.tsx`, `src/routes/_authenticated/become-seller.tsx`, `src/routes/_authenticated/delivery.register.tsx`, `src/components/SpinWheel.tsx`, `src/routes/_authenticated/admin/rewards/route.tsx`, `src/routes/_authenticated/admin/rewards/analytics.tsx`, and the existing referral/coupon server fns to thread `device_id`.

Approve to proceed, or tell me what to change.