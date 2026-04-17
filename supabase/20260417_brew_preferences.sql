-- Single source of truth for brew dose/water/yield/ratio.
-- Stores the canonical normalized brew preferences alongside the recipe.

alter table public.user_saved_coffee_recipes
  add column if not exists brew_preferences jsonb;
