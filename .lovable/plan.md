# Rewards & Promotions Admin Management

Build an admin-configurable system for the Referral Program and Mystery Wheel so all rewards, probabilities, limits, eligibility, fraud rules, and campaign schedules can be edited at runtime — no code changes.

## 1. Database (new migration)

New tables (all `public`, with GRANTs + RLS; admin-write via `has_role(uid,'admin')`, read-where-needed for users):

- `referral_campaigns` — id, name, active, starts_at, ends_at, referrer_reward_type (`cash|coupon|coins|free_delivery|sub_discount`), referrer_reward_value, referred_reward_type, referred_reward_value, min_order_amount, max_uses_per_referrer, reward_trigger (`first_order|payment|subscription`), expiry_days, fraud flags (device/duplicate/multi/ip/self), created_by, timestamps.
- `mystery_wheels` — id, name, scope (`global|seller|campaign`), seller_id?, active, starts_at, ends_at, spins_per_day, spins_per_week, spins_per_month, eligibility (login/order/subscription/min_purchase/referral_done), min_purchase_amount, created_by.
- `mystery_wheel_segments` — id, wheel_id, label, reward_type (`cash_off|percent_off|free_delivery|coins|sub_discount|free_food|jackpot_coupon|better_luck`), reward_value, coupon_template (jsonb: min_order, max_discount, applies_to, expires_days, stackable), probability_weight numeric, active, sort_order, color.
- `reward_redemption_rules` — id, wheel_id|campaign_id, expires_days, min_order_value, max_usage, stackable, subscription_applicable.
- `rewards_audit_log` — id, admin_id, action, entity_type, entity_id, previous_value jsonb, new_value jsonb, created_at.
- `referral_fraud_events` — id, user_id, kind, ip, device_fingerprint, details, created_at.
- Extend `user_referral_codes` with `device_fingerprint`, `signup_ip` (nullable, captured client-side).
- Extend `referrals` with `campaign_id`.
- Extend `spin_wheel_spins` with `wheel_id`, `segment_id`.

DB functions:

- `validate_wheel_probabilities(_wheel uuid)` — sums active segment weights; raises if not ~100.
- Rewrite `spin_wheel(_user, _wheel)` → reads active wheel, checks eligibility + per-period spin limits, weighted random over `mystery_wheel_segments`, materializes coupon per `coupon_template`, logs `spin_wheel_spins` with segment id.
- Rewrite `apply_referral_code(_user, _code, _ip, _device)` → resolves active campaign, runs fraud checks (self/dup-device/dup-ip), records `referrals` w/ campaign.
- New `process_referral_reward(_user, _trigger)` — called by triggers on orders/payments/subscriptions per campaign.reward_trigger.
- `log_rewards_audit(...)` helper, called by all admin server fns.

## 2. Server functions (`src/lib/rewards-admin.functions.ts`)

All gated by `has_role(uid,'admin')`. Each mutating call writes to `rewards_audit_log`.

Referral campaigns: `listReferralCampaigns`, `upsertReferralCampaign`, `toggleReferralCampaign`, `deleteReferralCampaign`.

Mystery wheels: `listWheels`, `upsertWheel`, `toggleWheel`, `deleteWheel`, `listSegments`, `upsertSegment`, `deleteSegment`, `reorderSegments`, `validateWheelProbabilities`.

Analytics: `getReferralAnalytics` (totals, conversions, revenue), `getWheelAnalytics` (spins, top rewards, cost, conversion).

Audit: `getAuditLog(filters)`.

## 3. Admin UI (new routes under `_authenticated/admin/`)

- `admin/rewards/route.tsx` — tabbed layout: Referrals, Wheels, Loyalty, Analytics, Audit.
- `admin/rewards/index.tsx` — overview cards.
- `admin/rewards/referrals.tsx` — list + drawer editor with all fields (reward types, triggers, limits, fraud toggles, schedule).
- `admin/rewards/wheels.tsx` — wheel list, create wheel, segment editor with live probability bar (sum + validation), color picker, weighted preview spin.
- `admin/rewards/loyalty.tsx` — existing achievements + coin tier config.
- `admin/rewards/analytics.tsx` — charts for referral + wheel.
- `admin/rewards/audit.tsx` — paginated audit log with diff view.
- Add nav entry in admin sidebar.

## 4. Client wiring

- `SpinWheel.tsx` — fetch active wheel + segments from server, render dynamic segments, respect per-period limits.
- Referral apply call passes captured device fingerprint (lightweight `navigator`-based hash) and lets server read IP from request header.
- Existing `gamification.functions.ts` `spinWheel` switches to new dynamic path.

## 5. Safety

- DB trigger on `mystery_wheel_segments` recomputes active probability sum; reject save if not 100 (±0.5 tolerance) via server-side validation before activation.
- Reward value caps configurable per campaign; server clamps.
- Idempotent claims via unique `(user_id, spin_id)` and existing `reward_claim_attempts` rate limiting reused.
- All admin endpoints require `has_role 'admin'`; UI route gated.

## Out of scope (this pass)

- Email/SMS notifications for new campaigns.
- A/B experimentation framework.
- Real device-fingerprinting library beyond simple UA+canvas hash.
