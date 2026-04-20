-- =========================================================
-- BrewMate — DB schema verification
-- Generated from supabase/*.sql at 2026-04-20T20:12:53.945Z
-- Paste this whole file into the Supabase SQL editor and run.
-- Output rows list every object that is missing from the DB.
-- An empty result set means the schema is in sync.
-- =========================================================

with expected(kind, qualified_name, sources) as (values
  ('column', 'app_users.created_at', 'setup.sql'),
  ('column', 'app_users.email', 'setup.sql'),
  ('column', 'app_users.id', 'setup.sql'),
  ('column', 'app_users.name', 'setup.sql'),
  ('column', 'app_users.updated_at', 'setup.sql'),
  ('column', 'coffee_match_cache.algorithm_version', '20260419_coffee_match_cache.sql, 20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'coffee_match_cache.cache_key', '20260419_coffee_match_cache.sql, 20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'coffee_match_cache.created_at', '20260419_coffee_match_cache.sql, 20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'coffee_match_cache.match', '20260419_coffee_match_cache.sql, 20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'coffee_match_cache.updated_at', '20260419_coffee_match_cache.sql, 20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'coffee_match_cache.user_id', '20260419_coffee_match_cache.sql, 20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'user_coffee_brew_logs.brew_method', '20260217_user_coffee_journal.sql'),
  ('column', 'user_coffee_brew_logs.brew_time_seconds', '20260217_user_coffee_journal.sql'),
  ('column', 'user_coffee_brew_logs.created_at', '20260217_user_coffee_journal.sql'),
  ('column', 'user_coffee_brew_logs.dose_g', '20260217_user_coffee_journal.sql'),
  ('column', 'user_coffee_brew_logs.id', '20260217_user_coffee_journal.sql'),
  ('column', 'user_coffee_brew_logs.notes', '20260217_user_coffee_journal.sql'),
  ('column', 'user_coffee_brew_logs.taste_rating', '20260217_user_coffee_journal.sql'),
  ('column', 'user_coffee_brew_logs.user_coffee_id', '20260217_user_coffee_journal.sql'),
  ('column', 'user_coffee_brew_logs.user_id', '20260217_user_coffee_journal.sql'),
  ('column', 'user_coffee_consumption_events.brew_method', '20260216_user_coffee_grams_tracking.sql'),
  ('column', 'user_coffee_consumption_events.consumed_g', '20260216_user_coffee_grams_tracking.sql'),
  ('column', 'user_coffee_consumption_events.created_at', '20260216_user_coffee_grams_tracking.sql'),
  ('column', 'user_coffee_consumption_events.id', '20260216_user_coffee_grams_tracking.sql'),
  ('column', 'user_coffee_consumption_events.source', '20260216_user_coffee_grams_tracking.sql'),
  ('column', 'user_coffee_consumption_events.user_coffee_id', '20260216_user_coffee_grams_tracking.sql'),
  ('column', 'user_coffee_consumption_events.user_id', '20260216_user_coffee_grams_tracking.sql'),
  ('column', 'user_coffee_images.content_type', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'user_coffee_images.created_at', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'user_coffee_images.image_base64', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'user_coffee_images.user_coffee_id', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'user_coffee_images.user_id', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'user_coffee_match_feedback.actual_rating', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'user_coffee_match_feedback.algorithm_version', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'user_coffee_match_feedback.created_at', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'user_coffee_match_feedback.id', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'user_coffee_match_feedback.notes', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'user_coffee_match_feedback.predicted_score', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'user_coffee_match_feedback.predicted_tier', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'user_coffee_match_feedback.user_coffee_id', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'user_coffee_match_feedback.user_id', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('column', 'user_coffee.ai_match_result', '20260215_user_coffee_inventory_updates.sql, setup.sql'),
  ('column', 'user_coffee.brew_method_default', '20260216_user_coffee_grams_tracking.sql'),
  ('column', 'user_coffee.coffee_profile', 'setup.sql'),
  ('column', 'user_coffee.corrected_text', 'setup.sql'),
  ('column', 'user_coffee.created_at', 'setup.sql'),
  ('column', 'user_coffee.id', 'setup.sql'),
  ('column', 'user_coffee.label_image_base64', '20260215_user_coffee_inventory_updates.sql, setup.sql'),
  ('column', 'user_coffee.last_consumed_at', '20260216_user_coffee_grams_tracking.sql'),
  ('column', 'user_coffee.loved', '20260215_user_coffee_inventory_updates.sql, setup.sql'),
  ('column', 'user_coffee.opened_at', '20260216_user_coffee_grams_tracking.sql'),
  ('column', 'user_coffee.package_size_g', '20260216_user_coffee_grams_tracking.sql'),
  ('column', 'user_coffee.preferred_dose_g', '20260216_user_coffee_grams_tracking.sql'),
  ('column', 'user_coffee.raw_text', 'setup.sql'),
  ('column', 'user_coffee.remaining_g', '20260216_user_coffee_grams_tracking.sql'),
  ('column', 'user_coffee.status', '20260216_user_coffee_grams_tracking.sql'),
  ('column', 'user_coffee.tracking_mode', '20260216_user_coffee_grams_tracking.sql'),
  ('column', 'user_coffee.user_id', 'setup.sql'),
  ('column', 'user_questionnaires.answers', '20250214_add_user_questionnaires.sql, setup.sql'),
  ('column', 'user_questionnaires.created_at', '20250214_add_user_questionnaires.sql, setup.sql'),
  ('column', 'user_questionnaires.id', '20250214_add_user_questionnaires.sql, setup.sql'),
  ('column', 'user_questionnaires.questionnaire_profile', '20250214_add_user_questionnaires.sql, setup.sql'),
  ('column', 'user_questionnaires.taste_profile', '20250214_add_user_questionnaires.sql, setup.sql'),
  ('column', 'user_questionnaires.user_id', '20250214_add_user_questionnaires.sql, setup.sql'),
  ('column', 'user_recipe_feedback.actual_rating', '20260417_recipe_feedback.sql, setup.sql, update_2026_04_17.sql'),
  ('column', 'user_recipe_feedback.algorithm_version', '20260417_recipe_feedback.sql, setup.sql, update_2026_04_17.sql'),
  ('column', 'user_recipe_feedback.created_at', '20260417_recipe_feedback.sql, setup.sql, update_2026_04_17.sql'),
  ('column', 'user_recipe_feedback.id', '20260417_recipe_feedback.sql, setup.sql, update_2026_04_17.sql'),
  ('column', 'user_recipe_feedback.notes', '20260417_recipe_feedback.sql, setup.sql, update_2026_04_17.sql'),
  ('column', 'user_recipe_feedback.predicted_score', '20260417_recipe_feedback.sql, setup.sql, update_2026_04_17.sql'),
  ('column', 'user_recipe_feedback.recipe_id', '20260417_recipe_feedback.sql, setup.sql, update_2026_04_17.sql'),
  ('column', 'user_recipe_feedback.user_id', '20260417_recipe_feedback.sql, setup.sql, update_2026_04_17.sql'),
  ('column', 'user_saved_coffee_recipes.analysis', '20260218_user_saved_coffee_recipes.sql, 20260219_user_saved_coffee_recipes_followup.sql, setup.sql'),
  ('column', 'user_saved_coffee_recipes.approved', '20260218_user_saved_coffee_recipes.sql, 20260219_user_saved_coffee_recipes_followup.sql, setup.sql'),
  ('column', 'user_saved_coffee_recipes.brew_preferences', '20260417_brew_preferences.sql, setup.sql, update_2026_04_17.sql'),
  ('column', 'user_saved_coffee_recipes.created_at', '20260218_user_saved_coffee_recipes.sql, 20260219_user_saved_coffee_recipes_followup.sql, setup.sql'),
  ('column', 'user_saved_coffee_recipes.id', '20260218_user_saved_coffee_recipes.sql, 20260219_user_saved_coffee_recipes_followup.sql, setup.sql'),
  ('column', 'user_saved_coffee_recipes.idempotency_key', '20260417_idempotency_key.sql, setup.sql, update_2026_04_17.sql'),
  ('column', 'user_saved_coffee_recipes.like_score', '20260218_user_saved_coffee_recipes.sql, 20260219_user_saved_coffee_recipes_followup.sql, setup.sql'),
  ('column', 'user_saved_coffee_recipes.prediction_metadata', '20260417_recipe_feedback.sql, setup.sql, update_2026_04_17.sql'),
  ('column', 'user_saved_coffee_recipes.recipe', '20260218_user_saved_coffee_recipes.sql, 20260219_user_saved_coffee_recipes_followup.sql, setup.sql'),
  ('column', 'user_saved_coffee_recipes.selected_preparation', '20260218_user_saved_coffee_recipes.sql, 20260219_user_saved_coffee_recipes_followup.sql, setup.sql'),
  ('column', 'user_saved_coffee_recipes.strength_preference', '20260218_user_saved_coffee_recipes.sql, 20260219_user_saved_coffee_recipes_followup.sql, setup.sql'),
  ('column', 'user_saved_coffee_recipes.user_id', '20260218_user_saved_coffee_recipes.sql, 20260219_user_saved_coffee_recipes_followup.sql, setup.sql'),
  ('column', 'user_statistics.created_at', 'setup.sql'),
  ('column', 'user_statistics.user_id', 'setup.sql'),
  ('extension', 'pgcrypto', 'setup.sql'),
  ('function', 'ensure_user_statistics', 'setup.sql'),
  ('function', 'is_valid_firebase_jwt', 'setup.sql'),
  ('function', 'set_updated_at', 'setup.sql'),
  ('index', 'coffee_match_cache_user_idx', '20260419_coffee_match_cache.sql, 20260419_coffee_match_hybrid.sql, setup.sql'),
  ('index', 'user_coffee_brew_logs_user_coffee_id_idx', '20260217_user_coffee_journal.sql'),
  ('index', 'user_coffee_brew_logs_user_id_idx', '20260217_user_coffee_journal.sql'),
  ('index', 'user_coffee_consumption_events_user_coffee_id_idx', '20260216_user_coffee_grams_tracking.sql'),
  ('index', 'user_coffee_consumption_events_user_id_idx', '20260216_user_coffee_grams_tracking.sql'),
  ('index', 'user_coffee_images_user_idx', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('index', 'user_coffee_match_feedback_coffee_idx', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('index', 'user_coffee_match_feedback_user_idx', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('index', 'user_coffee_user_id_idx', 'setup.sql'),
  ('index', 'user_questionnaires_user_id_idx', '20250214_add_user_questionnaires.sql, setup.sql'),
  ('index', 'user_recipe_feedback_user_id_idx', '20260417_recipe_feedback.sql, setup.sql, update_2026_04_17.sql'),
  ('index', 'user_saved_coffee_recipes_idempotency_idx', '20260417_idempotency_key.sql, setup.sql, update_2026_04_17.sql'),
  ('index', 'user_saved_coffee_recipes_user_id_idx', '20260218_user_saved_coffee_recipes.sql, 20260219_user_saved_coffee_recipes_followup.sql, setup.sql'),
  ('policy', 'app_users::users can insert their own profile', 'setup.sql'),
  ('policy', 'app_users::users can read their own profile', 'setup.sql'),
  ('policy', 'app_users::users can update their own profile', 'setup.sql'),
  ('policy', 'coffee_match_cache::users can delete their match cache', '20260419_coffee_match_cache.sql, 20260419_coffee_match_hybrid.sql, setup.sql'),
  ('policy', 'coffee_match_cache::users can insert their match cache', '20260419_coffee_match_cache.sql, 20260419_coffee_match_hybrid.sql, setup.sql'),
  ('policy', 'coffee_match_cache::users can read their match cache', '20260419_coffee_match_cache.sql, 20260419_coffee_match_hybrid.sql, setup.sql'),
  ('policy', 'coffee_match_cache::users can update their match cache', '20260419_coffee_match_cache.sql, 20260419_coffee_match_hybrid.sql, setup.sql'),
  ('policy', 'user_coffee_brew_logs::users can delete their brew logs', '20260217_user_coffee_journal.sql'),
  ('policy', 'user_coffee_brew_logs::users can insert their brew logs', '20260217_user_coffee_journal.sql'),
  ('policy', 'user_coffee_brew_logs::users can read their brew logs', '20260217_user_coffee_journal.sql'),
  ('policy', 'user_coffee_brew_logs::users can update their brew logs', '20260217_user_coffee_journal.sql'),
  ('policy', 'user_coffee_consumption_events::users can insert their consumption events', '20260216_user_coffee_grams_tracking.sql'),
  ('policy', 'user_coffee_consumption_events::users can read their consumption events', '20260216_user_coffee_grams_tracking.sql'),
  ('policy', 'user_coffee_consumption_events::users can update their consumption events', '20260216_user_coffee_grams_tracking.sql'),
  ('policy', 'user_coffee_images::users can delete their coffee images', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('policy', 'user_coffee_images::users can insert their coffee images', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('policy', 'user_coffee_images::users can read their coffee images', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('policy', 'user_coffee_match_feedback::users can delete their match feedback', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('policy', 'user_coffee_match_feedback::users can insert their match feedback', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('policy', 'user_coffee_match_feedback::users can read their match feedback', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('policy', 'user_coffee_match_feedback::users can update their match feedback', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('policy', 'user_coffee::users can delete their coffee entries', '20260215_user_coffee_inventory_updates.sql, setup.sql'),
  ('policy', 'user_coffee::users can insert their coffee entries', 'setup.sql'),
  ('policy', 'user_coffee::users can read their coffee entries', 'setup.sql'),
  ('policy', 'user_coffee::users can update their coffee entries', 'setup.sql'),
  ('policy', 'user_questionnaires::users can insert their questionnaires', '20250214_add_user_questionnaires.sql, setup.sql'),
  ('policy', 'user_questionnaires::users can read their questionnaires', '20250214_add_user_questionnaires.sql, setup.sql'),
  ('policy', 'user_questionnaires::users can update their questionnaires', '20250214_add_user_questionnaires.sql, setup.sql'),
  ('policy', 'user_recipe_feedback::users can delete their recipe feedback', '20260417_recipe_feedback.sql, setup.sql, update_2026_04_17.sql'),
  ('policy', 'user_recipe_feedback::users can insert their recipe feedback', '20260417_recipe_feedback.sql, setup.sql, update_2026_04_17.sql'),
  ('policy', 'user_recipe_feedback::users can read their recipe feedback', '20260417_recipe_feedback.sql, setup.sql, update_2026_04_17.sql'),
  ('policy', 'user_recipe_feedback::users can update their recipe feedback', '20260417_recipe_feedback.sql, setup.sql, update_2026_04_17.sql'),
  ('policy', 'user_saved_coffee_recipes::users can delete their saved recipes', '20260218_user_saved_coffee_recipes.sql, 20260219_user_saved_coffee_recipes_followup.sql, setup.sql'),
  ('policy', 'user_saved_coffee_recipes::users can insert their saved recipes', '20260218_user_saved_coffee_recipes.sql, 20260219_user_saved_coffee_recipes_followup.sql, setup.sql'),
  ('policy', 'user_saved_coffee_recipes::users can read their saved recipes', '20260218_user_saved_coffee_recipes.sql, 20260219_user_saved_coffee_recipes_followup.sql, setup.sql'),
  ('policy', 'user_saved_coffee_recipes::users can update their saved recipes', '20260218_user_saved_coffee_recipes.sql, 20260219_user_saved_coffee_recipes_followup.sql, setup.sql'),
  ('policy', 'user_statistics::users can insert their statistics', 'setup.sql'),
  ('policy', 'user_statistics::users can read their statistics', 'setup.sql'),
  ('table', 'app_users', 'setup.sql'),
  ('table', 'coffee_match_cache', '20260419_coffee_match_cache.sql, 20260419_coffee_match_hybrid.sql, setup.sql'),
  ('table', 'user_coffee', 'setup.sql'),
  ('table', 'user_coffee_brew_logs', '20260217_user_coffee_journal.sql'),
  ('table', 'user_coffee_consumption_events', '20260216_user_coffee_grams_tracking.sql'),
  ('table', 'user_coffee_images', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('table', 'user_coffee_match_feedback', '20260419_coffee_match_hybrid.sql, setup.sql'),
  ('table', 'user_questionnaires', '20250214_add_user_questionnaires.sql, setup.sql'),
  ('table', 'user_recipe_feedback', '20260417_recipe_feedback.sql, setup.sql, update_2026_04_17.sql'),
  ('table', 'user_saved_coffee_recipes', '20260218_user_saved_coffee_recipes.sql, 20260219_user_saved_coffee_recipes_followup.sql, setup.sql'),
  ('table', 'user_statistics', 'setup.sql'),
  ('trigger', 'app_users::app_users_create_stats', 'setup.sql'),
  ('trigger', 'app_users::app_users_set_updated_at', 'setup.sql')
),
actual(kind, qualified_name) as (
  select 'extension', lower(extname) from pg_extension
  union all
  select 'table', lower(tablename) from pg_tables where schemaname = 'public'
  union all
  select 'column', lower(table_name) || '.' || lower(column_name)
    from information_schema.columns where table_schema = 'public'
  union all
  select 'index', lower(indexname) from pg_indexes where schemaname = 'public'
  union all
  select 'policy', lower(tablename) || '::' || lower(policyname)
    from pg_policies where schemaname = 'public'
  union all
  select 'function', lower(p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
  union all
  select 'trigger', lower(c.relname) || '::' || lower(t.tgname)
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not t.tgisinternal
)
select e.kind,
       e.qualified_name as missing_object,
       e.sources as declared_in
  from expected e
  left join actual a
    on a.kind = e.kind
   and a.qualified_name = lower(e.qualified_name)
 where a.qualified_name is null
 order by e.kind, e.qualified_name;
