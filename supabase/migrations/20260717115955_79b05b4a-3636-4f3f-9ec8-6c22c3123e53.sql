
-- 1. Extend app_role enum with vendor roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'food_vendor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'snacks_vendor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coffee_vendor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'drinks_vendor';
