# MealNest Promotions & Rewards System

The existing `coupons` table is minimal (10 columns, 2 policies). We'll extend the schema substantially and ship in 4 phases so each phase is reviewable and testable. Admin + Seller dashboards, customer-facing redemption, and analytics are all in scope.

## Phase 1 — Coupon Engine Foundation (core of the request)
**Schema (migration):**
- Extend `coupons`: `scope` (`platform`|`seller`|`category`), `seller_id`, `discount_type` (`flat`|`percent`|`free_delivery`|`partial_delivery`), `value`, `max_discount`, `min_order_value`, `usage_limit_total`, `usage_limit_per_user`, `starts_at`, `expires_at`, `applies_to` (`order`|`subscription`|`both`), `subscription_plan_types` (text[]), `category_ids` (uuid[]), `cuisine_tags` (text[]), `geo_pincodes` (text[]), `festival_tag`, `is_active`, `metadata jsonb`.
- New `coupon_redemptions` (coupon_id, user_id, order_id, subscription_id, discount_amount, redeemed_at).
- Helper SQL function `public.validate_coupon(_code, _user, _seller, _order_total, _kind)` returning `(valid, discount, reason)`.
- GRANTs + RLS: admins manage all; sellers manage their own (`seller` scope + their `seller_id`); authenticated users SELECT active coupons; redemptions readable by owner/admin/seller.

**Server functions (`src/lib/coupons.functions.ts`):**
- `adminListCoupons`, `adminUpsertCoupon`, `adminToggleCoupon`
- `sellerListCoupons`, `sellerUpsertCoupon`
- `previewCoupon` (validate without redeeming)
- `redeemCoupon` (atomic; checks usage limits, dates, min order, scope)

**UI:**
- `/_authenticated/admin/coupons` — list + create/edit dialog (all discount types, festival tag, plan types, categories, dates, limits).
- `/_authenticated/seller/coupons` — same but locked to seller scope + kitchen-only flags.
- Customer: coupon input on cart/checkout and subscription checkout, applies discount via `previewCoupon`.

## Phase 2 — Rewards: Coins, Referrals, Streaks, Birthdays
**Schema:**
- `loyalty_accounts` (user_id, coins_balance, lifetime_coins, current_streak, longest_streak, last_order_date).
- `loyalty_transactions` (user_id, delta, reason, ref_id, ref_type).
- `referrals` (referrer_id, referee_id, code, status, reward_given_at).
- `user_referral_codes` (user_id PK, code unique).
- Add `dob`, `anniversary` columns to `profiles`.
- Triggers: on `orders` insert with status `delivered` → award coins (`floor(total/10)`), update streak, fire streak-milestone coupons.
- Cron (pg_cron): daily birthday/anniversary coupon issuance.

**Server functions:**
- `getMyLoyalty`, `redeemCoins` (convert to one-shot coupon), `generateReferralCode`, `applyReferralCode`, `claimStreakReward`.

**UI:**
- `/_authenticated/rewards` — coins balance, streak progress, referral code share, milestones, redeem coins → coupon.

## Phase 3 — Campaigns: Festivals, Happy Hour, Flash Sales, Combos, Family/Corporate
**Schema:**
- `promotional_campaigns` (id, scope, seller_id, type [`festival`|`happy_hour`|`flash_sale`|`combo`|`family_plan`|`corporate`|`weather`], name, config jsonb, starts_at, ends_at, audience_limit, audience_used, is_active).
- `campaign_redemptions` for tracking.
- Combo rules stored as jsonb (`buy: [...]`, `get: [...]`).

**Server functions / logic:**
- `listActiveCampaigns(sellerId?)` — used by browse/cart to surface badges + auto-apply.
- `applyHappyHour(orderDraft)` — applies time-window discount automatically.
- `joinFlashSale` — atomic counter via Postgres function.
- `corporateBulkQuote` — admin endpoint.

**UI:**
- Admin: `/admin/campaigns` (festival scheduler with Diwali/Christmas presets).
- Seller: `/seller/campaigns` (happy hour windows, flash sales with countdown, combo builder).
- Customer: campaign banners on home + dish/seller pages with live countdown for flash sales.

## Phase 4 — Gamification, Spin & Win, Mystery Rewards, Sponsorships, Analytics
**Schema:**
- `achievements` (key, name, criteria jsonb, reward jsonb), `user_achievements` (user_id, achievement_key, unlocked_at).
- `spin_wheel_spins` (user_id, spun_at, prize jsonb) — 1/day enforced by unique partial index.
- `mystery_rewards` triggered every 10 delivered orders (server fn).
- `seller_sponsorships` (seller_id, type [`new_boost`|`featured`|`top_rated`], starts_at, ends_at, admin_id, badge).

**Server functions:**
- `spinWheel`, `claimMysteryReward`, `adminGrantSponsorship`, `adminCampaignAnalytics`, `sellerCampaignAnalytics` (usage rate, revenue from coupons via redemptions×order totals, retention, subscription conversion).

**UI:**
- Customer: `/rewards` adds Spin & Win wheel + achievements grid + mystery progress.
- Admin: `/admin/analytics/promotions` (top campaigns, ROI, conversion).
- Seller: analytics tab in `/seller/coupons`.
- Browse page: featured badges from `seller_sponsorships`.

## Technical notes
- All discount math runs server-side in `validate_coupon` + `redeemCoupon` to prevent client tampering.
- Coupon application order at checkout: campaign auto-discounts → coupon code → coin redemption → free-delivery flag. Atomic transaction.
- Weather-based offers use a config flag on campaigns; an optional cron pulls a weather API (deferred; admin can manually toggle for v1).
- Realtime not required; checkout re-fetches on apply.
- Audit log: reuse existing audit pattern for admin actions on coupons/campaigns/sponsorships.

## What I'd like to confirm
1. Ship **Phase 1 now** and then continue with 2 → 3 → 4 in subsequent turns? (Recommended — each phase is already large.)
2. Currency: ₹ (INR) throughout — confirm.
3. Weather API: skip auto-trigger for now (admin manual toggle), or wire one up later?
