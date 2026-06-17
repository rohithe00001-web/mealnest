# Delivery System (Seller-managed + Admin-approved)

This is a large feature touching DB, 4 roles, dashboards, live tracking, payroll, and compliance. I'll ship it in 4 phases so each is reviewable and working before the next.

## Phase 1 — Foundation: schema + agent onboarding

**One migration** adds:

- `delivery_agent_status` enum: `pending_seller`, `pending_admin`, `approved`, `rejected`, `suspended`
- `delivery_agents` — `user_id`, `seller_id`, `status`, `phone`, `vehicle_type`, `vehicle_number`, `aadhaar_number`, `license_number`, `id_doc_url`, `license_doc_url`, `vehicle_doc_url`, `background_check_passed`, `seller_approved_at`, `admin_approved_at`, `rejected_reason`, `assigned_zones uuid[]`, `rating_avg`, `delivery_count`
- `delivery_zones` — `seller_id`, `name`, `pincode`, `radius_km`, `admin_approved`, `admin_approved_at`
- `agent_schedules` — `agent_id`, `weekday`, `slot` (morning/afternoon/evening), `active`
- `agent_payroll` — `agent_id`, `salary_base`, `per_order_rate`, `incentive_rules jsonb`, `month`, `paid_amount`, `status`
- `delivery_assignments` — `order_id` OR `delivery_id` (subscription), `agent_id`, `seller_id`, `status` (assigned/picked_up/delivered/failed), `assigned_at`, `picked_up_at`, `delivered_at`, `otp`, `customer_rating`, `notes`, `current_lat`, `current_lng`, `last_location_at`
- `delivery_audit_log` — admin actions (approve/reject/suspend/reassign)
- Add `delivery_agent_id` + `delivery_status` to `orders` and `subscription_deliveries`
- Add `app_role` value `delivery_agent`
- RLS + GRANTs per project conventions; `has_role` checks for admin

Server fns (`src/lib/delivery.functions.ts`): agent register, seller approve/reject, admin approve/reject, suspend.

UI:
- `/delivery/register` — public-ish (auth required) agent form with doc uploads to `dish-images` bucket (reuse)
- `/_authenticated/seller/delivery/agents` — list + seller approve/reject
- `/_authenticated/admin/delivery/agents` — final verification queue

## Phase 2 — Order assignment + agent dashboard

- Seller order list gains "Assign agent" action → creates `delivery_assignments` row
- Reassign / prioritize fastest/nearest (distance via stored zone pincode for now; real geo later)
- `/_authenticated/delivery/` route group gated by `delivery_agent` role
  - Today's assignments, mark picked up / delivered with OTP, earnings tile
- Customer order detail shows assigned agent name + phone + status
- Subscription delivery assignment screen for seller (per-customer agent picker, backup agent)

## Phase 3 — Scheduling, payroll, performance, zones

- Seller schedule planner (weekly grid, slots per agent)
- Payroll dashboard: base + per-order + incentives, monthly payout records
- Performance: delivery count, avg time, rating, missed — computed from `delivery_assignments`
- Zone request flow: seller creates zone (pending) → admin approves; orders outside approved zones blocked
- Admin compliance alerts table + view (late, low rating, OTP fails)

## Phase 4 — Live tracking + admin oversight + analytics

- Agent app posts `current_lat/lng` every N seconds (browser geolocation) to a server fn; throttled
- Seller live map (Leaflet, OSM tiles — no API key needed) showing active agents
- Customer tracking page with map + ETA
- Admin delivery monitoring dashboard: KPIs, active deliveries, delayed, failed, per-seller breakdown
- Admin emergency controls: freeze agent, freeze seller deliveries, reassign, block zone
- Admin analytics: success rate, avg time, top agents/sellers, subscription delivery performance

## Tech notes

- Live tracking: Leaflet + OpenStreetMap tiles (free, no key). Postgres stores last known lat/lng; optional Realtime channel on `delivery_assignments` for live updates.
- OTP: 4-digit generated on assignment, shown to customer, entered by agent on delivery.
- All admin-gated actions use `has_role(auth.uid(), 'admin')` in RLS.
- Notifications reuse existing `notifications` system.

## Scope checks before Phase 1

1. Doc uploads: reuse existing `dish-images` bucket with an `agent-docs/` prefix, or a new private `agent-docs` bucket? (recommend new private bucket)
2. Live tracking map: Leaflet/OSM (free, no key) — OK? Or do you want Google Maps (needs connector)?
3. Distance/nearest agent: pincode-match only for now (real geo later) — OK?

Reply "go" to start Phase 1, or answer the 3 questions and I'll fold them in.