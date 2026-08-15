-- ═══════════════════════════════════════════════════════════════════════════════
-- 0005_app_version.sql — track each account's installed app version
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- The app reports its version with the same first-login/last-active call it
-- already makes on every launch; the edge function stores it here. Lets support
-- see which release a user is on when they report a problem ("solutions can be
-- provided"). Not PII; disclosed in the privacy policy table. Nullable — older
-- builds that don't send a version simply leave it as-is.

alter table public.first_login
  add column if not exists app_version text;
