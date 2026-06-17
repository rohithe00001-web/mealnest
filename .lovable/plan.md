# Meal Subscription System

This is a large feature spanning DB, seller tooling, customer browse/checkout, deliveries, pause/resume, AI, and admin analytics. I'll ship it in 4 phases so each step is reviewable and working before the next.

## Phase 1 — Foundation (DB + seller plan builder)
**Database (one migration):**
- `subscription_plans` — seller_id, title, description, plan_type (`weekly`/`half_month`/`monthly`), duration_days (7/15/30), meal_types (array: breakfast/lunch/dinner), price_per_person, cuisines (array), is_veg, is_active, status (`pending`/`approved`/`rejected`), rating_avg, image_url
- `subscription_plan_days` — plan_id, day_number, breakfast_name, breakfast_desc, lunch_name, lunch_desc, dinner_name, dinner_desc, calories, protein_g, carbs_g, fat_g, is_veg
- `subscriptions` — customer_id, plan_id, seller_id, people_count, meal_selection (enum: breakfast_only/lunch_only/dinner_only/breakfast_lunch/lunch_dinner/full_day), address_id, delivery_slot, start_date, end_date, status (`active`/`paused`/`completed`/`cancelled`), total_price, customizations jsonb (exclude_dishes, spice_level, diet, allergies), extension_days
- `subscription_deliveries` — subscription_id, scheduled_date, day_number, status (`scheduled`/`skipped`/`delivered`/`paused`), meals jsonb
- RLS + GRANTs + triggers (auto-generate deliveries on subscription create; auto-extend end_date on skip)

**Seller UI:** `/seller/meal-plans` — list + create/edit plan with day-by-day meal editor (tabs for week, scrollable list for 15/30 day), duplicate plan, publish for admin approval.

## Phase 2 — Customer marketplace + purchase
- `/meal-plans` browse page: filter by duration, veg/non-veg, cuisine, price; cards show cost, cost/meal, rating, cuisines.
- `/meal-plans/$id` detail: tabbed week view, horizontal timeline for 15-day, calendar grid for monthly. Nutrition badges per day.
- Checkout flow: people count, meal selection, address, slot, customizations (exclude/spice/diet/allergies), price calculation.
- `/my-subscriptions` list + detail with delivery schedule.

## Phase 3 — Pause/Resume + seller dashboards
- Pause/skip specific dates → auto-extend end_date.
- Seller `/seller/subscriptions`: active subscribers, revenue, top plans, demand-by-day chart.
- Daily delivery list for seller (today's meals to prepare per subscriber).

## Phase 4 — Admin + AI
- Admin `/admin/subscriptions`: approve plans, monitor active subs, revenue split by duration, retention.
- AI (Lovable AI Gateway) on plan detail: "Recommend a plan" using order history + prefs; nutrition assistant summarizing weekly intake.

## Technical notes
- All server logic via `createServerFn` with `requireSupabaseAuth`; admin/seller actions check `has_role`.
- Deliveries generated server-side from `subscription_plan_days` at subscription creation.
- Pause = mark range of `subscription_deliveries` as `paused`, increment `extension_days`, push `end_date`.
- Reuse existing addresses, notifications, and seller approval patterns.
- Nutrition + AI recs via existing Lovable AI Gateway (no new secrets).

## Scope check before I start
1. Payments: keep COD for subscriptions for now (consistent with current orders)? Or block until real payments wired?
2. Delivery slots: reuse a simple set (morning/afternoon/evening) — OK?
3. "Download meal calendar" — ship as ICS download (works everywhere) — OK?

Reply "go" to start Phase 1 (DB + seller plan builder), or answer the 3 questions and I'll incorporate.