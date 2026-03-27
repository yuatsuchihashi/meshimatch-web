-- MeshiMatch Database Schema
-- Run this in Supabase SQL Editor to set up all tables

-- ============================================
-- 1. Profiles (extends auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'ユーザー',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'ユーザー')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. Genre Preferences
-- ============================================
CREATE TABLE public.genre_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  genre_code TEXT NOT NULL,
  preference SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, genre_code),
  CHECK (preference IN (-1, 0, 1))
);

ALTER TABLE public.genre_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own genre preferences"
  ON public.genre_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own genre preferences"
  ON public.genre_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own genre preferences"
  ON public.genre_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own genre preferences"
  ON public.genre_preferences FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_genre_preferences_user_id ON public.genre_preferences(user_id);

-- ============================================
-- 3. Dietary Restrictions
-- ============================================
CREATE TABLE public.dietary_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  restriction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, restriction_type)
);

ALTER TABLE public.dietary_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dietary restrictions"
  ON public.dietary_restrictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dietary restrictions"
  ON public.dietary_restrictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dietary restrictions"
  ON public.dietary_restrictions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_dietary_restrictions_user_id ON public.dietary_restrictions(user_id);

-- ============================================
-- 4. Follows
-- ============================================
CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own follows"
  ON public.follows FOR SELECT
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

CREATE POLICY "Users can insert own follows"
  ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete own follows"
  ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);

CREATE INDEX idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX idx_follows_following_id ON public.follows(following_id);

-- ============================================
-- 5. Favorite Restaurants
-- ============================================
CREATE TABLE public.favorite_restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hotpepper_id TEXT NOT NULL,
  name TEXT NOT NULL,
  genre_code TEXT,
  genre_name TEXT,
  address TEXT,
  photo_url TEXT,
  budget_name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, hotpepper_id)
);

ALTER TABLE public.favorite_restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON public.favorite_restaurants FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favorites"
  ON public.favorite_restaurants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON public.favorite_restaurants FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_favorite_restaurants_user_id ON public.favorite_restaurants(user_id);

-- ============================================
-- 6. Search History
-- ============================================
CREATE TABLE public.search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_ids UUID[] NOT NULL,
  mood TEXT,
  location_text TEXT,
  location_code TEXT,
  time_slot TEXT,
  result_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own search history"
  ON public.search_history FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own search history"
  ON public.search_history FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE INDEX idx_search_history_created_by ON public.search_history(created_by);
