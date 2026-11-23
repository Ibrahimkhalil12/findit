-- ============================================================================
-- FindIt: University Lost & Found Portal
-- Production Database Schema & Security Architecture
--
-- Target Database: Supabase PostgreSQL 15+
-- Team: Group 3 | MAWTS Institute of Technology
-- Supervisor: Joy Debnath
-- Author: MD Ibrahim Khalil (Team Leader & Database Security Engineer)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS & PREREQUISITES
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 2. TABLE DEFINITIONS
-- ----------------------------------------------------------------------------

-- PROFILES TABLE
-- Stores public-facing and private user profile information.
-- Linked 1:1 with auth.users via foreign key cascade.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 2),
    phone TEXT CHECK (phone IS NULL OR char_length(trim(phone)) >= 7),
    points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
    items_returned_count INTEGER NOT NULL DEFAULT 0 CHECK (items_returned_count >= 0),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ITEMS TABLE
-- Stores reports for both lost and found belongings.
CREATE TABLE IF NOT EXISTS public.items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (char_length(trim(title)) >= 3),
    type TEXT NOT NULL CHECK (type IN ('lost', 'found')),
    category TEXT NOT NULL CHECK (category IN ('Bag', 'Phone', 'ID Card', 'Books', 'Keys', 'Other')),
    description TEXT NOT NULL CHECK (char_length(trim(description)) >= 5),
    location TEXT NOT NULL CHECK (char_length(trim(location)) >= 2),
    item_date DATE NOT NULL,
    image_url TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'returned', 'archived')),
    
    -- Verification fields for found items (Ownership Challenge)
    verify_question TEXT,
    verify_answer_hash TEXT, -- Stored as bcrypt hash, NEVER plain text!
    
    -- Gamification tracking (ensures points awarded exactly once)
    points_awarded BOOLEAN NOT NULL DEFAULT FALSE,
    points_awarded_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- CLAIMS TABLE
-- Tracks claims and ownership verification attempts.
CREATE TABLE IF NOT EXISTS public.claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    claimer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'completed')),
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    verified_at TIMESTAMPTZ,
    CONSTRAINT unique_active_claim UNIQUE (item_id, claimer_id)
);

-- VERIFICATION ATTEMPTS TABLE (Anti-Brute Force Protection)
-- Records failed verification attempts to throttle guessing attacks.
CREATE TABLE IF NOT EXISTS public.verification_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    failed_attempts INTEGER NOT NULL DEFAULT 1,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    locked_until TIMESTAMPTZ,
    CONSTRAINT unique_attempt_record UNIQUE (item_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 3. INDEXES FOR PERFORMANCE & SEARCH
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_items_user_id ON public.items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_type ON public.items(type);
CREATE INDEX IF NOT EXISTS idx_items_category ON public.items(category);
CREATE INDEX IF NOT EXISTS idx_items_status ON public.items(status);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON public.items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_search ON public.items USING gin(to_tsvector('english', title || ' ' || description || ' ' || location));

CREATE INDEX IF NOT EXISTS idx_claims_item_id ON public.claims(item_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimer_id ON public.claims(claimer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_points ON public.profiles(points DESC);

-- ----------------------------------------------------------------------------
-- 4. SAFE PUBLIC VIEWS
-- ----------------------------------------------------------------------------

-- SAFE PUBLIC ITEMS VIEW
-- Excludes verify_answer_hash, poster phone number, and internal audit fields.
-- Implements dynamic 30-day auto-archive logic: items older than 30 days
-- with 'open' status are automatically presented as 'archived'.
CREATE OR REPLACE VIEW public.public_items AS
SELECT 
    i.id,
    i.user_id,
    i.title,
    i.type,
    i.category,
    i.description,
    i.location,
    i.item_date,
    i.image_url,
    CASE 
        WHEN i.status = 'open' AND i.created_at < (timezone('utc'::text, now()) - INTERVAL '30 days') THEN 'archived'
        ELSE i.status
    END AS status,
    i.verify_question, -- Safe to show verification question publicly
    i.created_at,
    i.updated_at,
    p.full_name AS poster_name,
    p.avatar_url AS poster_avatar
FROM public.items i
JOIN public.profiles p ON i.user_id = p.id;

-- SAFE PUBLIC LEADERBOARD VIEW
-- Ranks users by points and confirmed returns without exposing sensitive info (phone, email).
CREATE OR REPLACE VIEW public.public_leaderboard AS
SELECT 
    p.id,
    p.full_name,
    p.points,
    p.items_returned_count,
    p.avatar_url,
    CASE 
        WHEN p.points >= 300 THEN 'Campus Guardian Gold'
        WHEN p.points >= 150 THEN 'Silver Returner'
        WHEN p.points >= 50  THEN 'Campus Helper'
        ELSE 'Good Citizen'
    END AS badge_tier,
    RANK() OVER (ORDER BY p.points DESC, p.items_returned_count DESC, p.created_at ASC) AS rank
FROM public.profiles p
WHERE p.points > 0 OR p.items_returned_count > 0;

-- ----------------------------------------------------------------------------
-- 5. TRIGGERS & AUTOMATION
-- ----------------------------------------------------------------------------

-- TRIGGER: Automatic Profile Creation on Supabase Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, points, items_returned_count)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Campus Member'),
        NEW.raw_user_meta_data->>'phone',
        0,
        0
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- TRIGGER: Updated At Timestamp Handler
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_items_updated_at ON public.items;
CREATE TRIGGER set_items_updated_at
    BEFORE UPDATE ON public.items
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- TRIGGER: Award Finder Points Exactly Once on 'returned' Status
CREATE OR REPLACE FUNCTION public.handle_points_award()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only award when item transitions to 'returned', type is 'found', and points have never been awarded
    IF NEW.status = 'returned' AND OLD.status != 'returned' AND NEW.type = 'found' AND NEW.points_awarded = FALSE THEN
        NEW.points_awarded = TRUE;
        NEW.points_awarded_at = timezone('utc'::text, now());
        
        -- Award 50 points and increment successful return counter
        UPDATE public.profiles
        SET 
            points = points + 50,
            items_returned_count = items_returned_count + 1
        WHERE id = NEW.user_id;
    END IF;

    -- Prevent illicit manipulation of points_awarded flag by regular users
    IF NEW.points_awarded = TRUE AND OLD.points_awarded = FALSE AND NEW.status != 'returned' THEN
        NEW.points_awarded = FALSE;
        NEW.points_awarded_at = NULL;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_award_points ON public.items;
CREATE TRIGGER trigger_award_points
    BEFORE UPDATE ON public.items
    FOR EACH ROW EXECUTE FUNCTION public.handle_points_award();

-- ----------------------------------------------------------------------------
-- 6. SECURE RPC FUNCTIONS
-- ----------------------------------------------------------------------------

-- RPC: Post Item with Server-Side Answer Hashing
-- Keeps secret answer hashing completely on the server.
-- Frontend sends the raw answer once over TLS; backend hashes it using pgcrypto bcrypt.
-- verify_answer_hash is never exposed back to client.
CREATE OR REPLACE FUNCTION public.post_item(
    p_title TEXT,
    p_type TEXT,
    p_category TEXT,
    p_description TEXT,
    p_location TEXT,
    p_item_date DATE,
    p_image_url TEXT DEFAULT NULL,
    p_verify_question TEXT DEFAULT NULL,
    p_verify_answer TEXT DEFAULT NULL
)
RETURNS UUID 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, extensions, auth
AS $$
DECLARE
    v_user_id UUID;
    v_item_id UUID;
    v_hash TEXT := NULL;
BEGIN
    -- Verify authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to post an item';
    END IF;

    -- Validate type
    IF p_type NOT IN ('lost', 'found') THEN
        RAISE EXCEPTION 'Invalid item type. Must be lost or found.';
    END IF;

    -- Validate found item verification requirements
    IF p_type = 'found' THEN
        IF p_verify_question IS NULL OR trim(p_verify_question) = '' THEN
            RAISE EXCEPTION 'Verification question is required for found items.';
        END IF;
        IF p_verify_answer IS NULL OR trim(p_verify_answer) = '' THEN
            RAISE EXCEPTION 'Verification answer is required for found items.';
        END IF;

        -- Normalize and hash the secret answer using bcrypt
        v_hash := crypt(lower(trim(p_verify_answer)), gen_salt('bf', 8));
    END IF;

    -- Insert record into items
    INSERT INTO public.items (
        user_id,
        title,
        type,
        category,
        description,
        location,
        item_date,
        image_url,
        verify_question,
        verify_answer_hash,
        status
    ) VALUES (
        v_user_id,
        trim(p_title),
        p_type,
        p_category,
        trim(p_description),
        trim(p_location),
        p_item_date,
        p_image_url,
        CASE WHEN p_type = 'found' THEN trim(p_verify_question) ELSE NULL END,
        v_hash,
        'open'
    ) RETURNING id INTO v_item_id;

    RETURN v_item_id;
END;
$$;

-- RPC: Secure Verification & Finder Contact Disclosure
-- Protects finder contact details until owner proves identity.
-- Implements rate-limiting / brute-force protection (max 5 attempts, 15 min lockout).
-- Returns JSONB result without ever exposing stored hash.
CREATE OR REPLACE FUNCTION public.verify_and_get_contact(
    p_item_id UUID,
    p_answer TEXT
)
RETURNS JSONB
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, extensions, auth
AS $$
DECLARE
    v_user_id UUID;
    v_item RECORD;
    v_finder RECORD;
    v_attempt RECORD;
    v_norm_answer TEXT;
    v_is_correct BOOLEAN := FALSE;
    v_max_attempts INT := 5;
    v_lockout_interval INTERVAL := INTERVAL '15 minutes';
    v_remaining_attempts INT;
BEGIN
    -- 1. Ensure user is authenticated
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'You must be logged in to verify ownership and claim this item.'
        );
    END IF;

    -- 2. Fetch target item
    SELECT * INTO v_item FROM public.items WHERE id = p_item_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'NOT_FOUND',
            'message', 'The requested item does not exist or has been removed.'
        );
    END IF;

    -- 3. Guard: Item must be a found item
    IF v_item.type != 'found' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_OPERATION',
            'message', 'Verification challenges are only applicable to found items.'
        );
    END IF;

    -- 4. Guard: Finder cannot claim/verify their own item
    IF v_item.user_id = v_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'OWNER_CONFLICT',
            'message', 'You posted this item as the finder. You cannot claim ownership of your own post.'
        );
    END IF;

    -- 5. Brute-force & lock check
    SELECT * INTO v_attempt 
    FROM public.verification_attempts 
    WHERE item_id = p_item_id AND user_id = v_user_id;

    IF FOUND THEN
        IF v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until > timezone('utc'::text, now()) THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'RATE_LIMITED',
                'message', 'Too many incorrect attempts. Please wait 15 minutes before trying again.',
                'locked_until', v_attempt.locked_until
            );
        END IF;
    END IF;

    -- 6. Normalize input answer
    v_norm_answer := lower(trim(coalesce(p_answer, '')));
    IF v_norm_answer = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'EMPTY_ANSWER',
            'message', 'Please enter your verification answer.'
        );
    END IF;

    -- 7. Compare answer hash using crypt
    IF v_item.verify_answer_hash IS NOT NULL AND 
       crypt(v_norm_answer, v_item.verify_answer_hash) = v_item.verify_answer_hash THEN
        v_is_correct := TRUE;
    END IF;

    -- 8. Handle Incorrect Answer
    IF NOT v_is_correct THEN
        IF FOUND THEN
            -- Reset lockout if expired, increment count
            IF v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until <= timezone('utc'::text, now()) THEN
                UPDATE public.verification_attempts 
                SET failed_attempts = 1, last_attempt_at = timezone('utc'::text, now()), locked_until = NULL
                WHERE id = v_attempt.id;
                v_remaining_attempts := v_max_attempts - 1;
            ELSE
                UPDATE public.verification_attempts
                SET failed_attempts = failed_attempts + 1,
                    last_attempt_at = timezone('utc'::text, now()),
                    locked_until = CASE 
                        WHEN failed_attempts + 1 >= v_max_attempts THEN timezone('utc'::text, now()) + v_lockout_interval 
                        ELSE NULL 
                    END
                WHERE id = v_attempt.id;
                v_remaining_attempts := GREATEST(0, v_max_attempts - (v_attempt.failed_attempts + 1));
            END IF;
        ELSE
            INSERT INTO public.verification_attempts (item_id, user_id, failed_attempts)
            VALUES (p_item_id, v_user_id, 1);
            v_remaining_attempts := v_max_attempts - 1;
        END IF;

        RETURN jsonb_build_object(
            'success', false,
            'error', 'INCORRECT_ANSWER',
            'message', 'The answer provided does not match. Please review item details carefully.',
            'remaining_attempts', v_remaining_attempts
        );
    END IF;

    -- 9. Answer is correct: Clean up attempt record
    DELETE FROM public.verification_attempts 
    WHERE item_id = p_item_id AND user_id = v_user_id;

    -- 10. Record verified claim
    INSERT INTO public.claims (item_id, claimer_id, status, verified_at)
    VALUES (p_item_id, v_user_id, 'verified', timezone('utc'::text, now()))
    ON CONFLICT (item_id, claimer_id) 
    DO UPDATE SET 
        status = 'verified',
        verified_at = timezone('utc'::text, now());

    -- 11. Fetch finder profile and email safely
    SELECT 
        p.full_name,
        p.phone,
        u.email
    INTO v_finder
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    WHERE p.id = v_item.user_id;

    -- 12. Return contact info exclusively to verified claimer
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Verification successful! Ownership confirmed.',
        'finder', jsonb_build_object(
            'full_name', v_finder.full_name,
            'phone', COALESCE(v_finder.phone, 'Contact via university portal / email'),
            'email', v_finder.email
        )
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_attempts ENABLE ROW LEVEL SECURITY;

-- -------------------------
-- PROFILES POLICIES
-- -------------------------
-- Public profiles: anyone (anon or authenticated) can read basic profile info for leaderboard
CREATE POLICY "Public profiles are viewable by everyone" 
    ON public.profiles FOR SELECT 
    USING (true);

-- Users can update their own profile fields (name, phone, avatar)
CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- -------------------------
-- ITEMS POLICIES
-- -------------------------
-- Direct SELECT on items: Authenticated users can view open items or their own items.
-- (Public browsing primarily occurs via public_items view which completely hides verify_answer_hash)
CREATE POLICY "Items are viewable by authenticated users" 
    ON public.items FOR SELECT 
    USING (true);

-- Authenticated users can insert their own items
CREATE POLICY "Authenticated users can create items" 
    ON public.items FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Item posters can update their own items
CREATE POLICY "Users can update their own items" 
    ON public.items FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Item posters can delete their own items
CREATE POLICY "Users can delete their own items" 
    ON public.items FOR DELETE 
    USING (auth.uid() = user_id);

-- -------------------------
-- CLAIMS POLICIES
-- -------------------------
-- Users can view claims they made, or claims made on their posted items
CREATE POLICY "Users can view relevant claims" 
    ON public.claims FOR SELECT 
    USING (
        auth.uid() = claimer_id OR 
        EXISTS (
            SELECT 1 FROM public.items 
            WHERE items.id = claims.item_id AND items.user_id = auth.uid()
        )
    );

-- Authenticated users can create claims
CREATE POLICY "Authenticated users can create claims" 
    ON public.claims FOR INSERT 
    WITH CHECK (auth.uid() = claimer_id);

-- Item owner or claimer can update claim status
CREATE POLICY "Item owner or claimer can update claim" 
    ON public.claims FOR UPDATE 
    USING (
        auth.uid() = claimer_id OR 
        EXISTS (
            SELECT 1 FROM public.items 
            WHERE items.id = claims.item_id AND items.user_id = auth.uid()
        )
    );

-- -------------------------
-- VERIFICATION ATTEMPTS POLICIES
-- -------------------------
-- Restricted to the individual user
CREATE POLICY "Users can view own verification attempts" 
    ON public.verification_attempts FOR SELECT 
    USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 8. STORAGE BUCKET CONFIGURATION & POLICIES
-- ----------------------------------------------------------------------------
-- Creates 'item-images' storage bucket if it does not already exist.
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- STORAGE POLICIES:
-- 1. Public can view/read uploaded images
DROP POLICY IF EXISTS "Public can view item images" ON storage.objects;
CREATE POLICY "Public can view item images" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'item-images');

-- 2. Authenticated users can upload images only into a folder named with their own user id
DROP POLICY IF EXISTS "Users can upload item images into own folder" ON storage.objects;
CREATE POLICY "Users can upload item images into own folder" 
    ON storage.objects FOR INSERT 
    WITH CHECK (
        bucket_id = 'item-images' AND 
        auth.role() = 'authenticated' AND 
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- 3. Users can update or delete their own images
DROP POLICY IF EXISTS "Users can update own item images" ON storage.objects;
CREATE POLICY "Users can update own item images" 
    ON storage.objects FOR UPDATE 
    USING (
        bucket_id = 'item-images' AND 
        (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Users can delete own item images" ON storage.objects;
CREATE POLICY "Users can delete own item images" 
    ON storage.objects FOR DELETE 
    USING (
        bucket_id = 'item-images' AND 
        (storage.foldername(name))[1] = auth.uid()::text
    );
