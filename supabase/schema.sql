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
-- Stores public-facing and private user profile information + role ('student' / 'admin').
-- Linked 1:1 with auth.users via foreign key cascade.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 2),
    email TEXT,
    phone TEXT CHECK (phone IS NULL OR char_length(trim(phone)) >= 7),
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
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

    -- Optional per-item contact overrides (shown publicly ONLY for 'lost' items;
    -- hidden for 'found' items until secret verification passes)
    contact_phone TEXT CHECK (contact_phone IS NULL OR trim(contact_phone) = '' OR char_length(trim(contact_phone)) >= 7),
    contact_email TEXT,

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
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ----------------------------------------------------------------------------
-- 4. ROLE HELPER FUNCTIONS (SECURITY DEFINER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT role
    FROM public.profiles
    WHERE id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- 5. SAFE PUBLIC VIEWS
-- ----------------------------------------------------------------------------

-- SAFE PUBLIC ITEMS VIEW
-- Excludes verify_answer_hash and internal audit fields.
-- Exposes contact_phone & contact_email ONLY for 'lost' items; always NULL for 'found' items.
-- Implements dynamic 30-day auto-archive logic.
DROP VIEW IF EXISTS public.public_items;
CREATE VIEW public.public_items AS
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
    i.verify_question,
    i.created_at,
    i.updated_at,
    p.full_name AS poster_name,
    p.avatar_url AS poster_avatar,
    CASE
        WHEN i.type = 'lost' THEN COALESCE(NULLIF(trim(i.contact_phone), ''), p.phone)
        ELSE NULL
    END AS contact_phone,
    CASE
        WHEN i.type = 'lost' THEN COALESCE(NULLIF(trim(i.contact_email), ''), p.email)
        ELSE NULL
    END AS contact_email
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
-- 6. TRIGGERS & AUTOMATION
-- ----------------------------------------------------------------------------

-- TRIGGER: Automatic Profile Creation on Supabase Auth Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, phone, role, points, items_returned_count)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1), 'Campus Member'),
        NEW.email,
        NEW.raw_user_meta_data->>'phone',
        'student',
        0,
        0
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = COALESCE(EXCLUDED.email, public.profiles.email),
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
    IF NEW.status = 'returned' AND OLD.status != 'returned' AND NEW.type = 'found' AND NEW.points_awarded = FALSE THEN
        NEW.points_awarded = TRUE;
        NEW.points_awarded_at = timezone('utc'::text, now());

        UPDATE public.profiles
        SET
            points = points + 50,
            items_returned_count = items_returned_count + 1
        WHERE id = NEW.user_id;
    END IF;

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
-- 7. SECURE RPC FUNCTIONS
-- ----------------------------------------------------------------------------

-- RPC: Post Item with Server-Side Answer Hashing & Optional Contact Overrides
DROP FUNCTION IF EXISTS public.post_item(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.post_item(
    p_title TEXT,
    p_type TEXT,
    p_category TEXT,
    p_description TEXT,
    p_location TEXT,
    p_item_date DATE,
    p_image_url TEXT DEFAULT NULL,
    p_verify_question TEXT DEFAULT NULL,
    p_verify_answer TEXT DEFAULT NULL,
    p_contact_phone TEXT DEFAULT NULL,
    p_contact_email TEXT DEFAULT NULL
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
    v_clean_phone TEXT;
    v_clean_email TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to post an item';
    END IF;

    IF p_type NOT IN ('lost', 'found') THEN
        RAISE EXCEPTION 'Invalid item type. Must be lost or found.';
    END IF;

    v_clean_phone := NULLIF(trim(COALESCE(p_contact_phone, '')), '');
    v_clean_email := NULLIF(trim(COALESCE(p_contact_email, '')), '');

    IF v_clean_phone IS NOT NULL AND char_length(v_clean_phone) < 7 THEN
        RAISE EXCEPTION 'Please provide a valid contact phone number (at least 7 characters).';
    END IF;

    IF p_type = 'found' THEN
        IF p_verify_question IS NULL OR trim(p_verify_question) = '' THEN
            RAISE EXCEPTION 'Verification question is required for found items.';
        END IF;
        IF p_verify_answer IS NULL OR trim(p_verify_answer) = '' THEN
            RAISE EXCEPTION 'Verification answer is required for found items.';
        END IF;

        v_hash := crypt(lower(trim(p_verify_answer)), gen_salt('bf', 8));
    END IF;

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
        contact_phone,
        contact_email,
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
        v_clean_phone,
        v_clean_email,
        'open'
    ) RETURNING id INTO v_item_id;

    RETURN v_item_id;
END;
$$;

-- RPC: Secure Verification & Finder Contact Disclosure
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
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'You must be logged in to verify ownership and claim this item.'
        );
    END IF;

    SELECT * INTO v_item FROM public.items WHERE id = p_item_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'NOT_FOUND',
            'message', 'The requested item does not exist or has been removed.'
        );
    END IF;

    IF v_item.type != 'found' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_OPERATION',
            'message', 'Verification challenges are only applicable to found items.'
        );
    END IF;

    IF v_item.user_id = v_user_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'OWNER_CONFLICT',
            'message', 'You posted this item as the finder. You cannot claim ownership of your own post.'
        );
    END IF;

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

    v_norm_answer := lower(trim(coalesce(p_answer, '')));
    IF v_norm_answer = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'EMPTY_ANSWER',
            'message', 'Please enter your verification answer.'
        );
    END IF;

    IF v_item.verify_answer_hash IS NOT NULL AND
       crypt(v_norm_answer, v_item.verify_answer_hash) = v_item.verify_answer_hash THEN
        v_is_correct := TRUE;
    END IF;

    IF NOT v_is_correct THEN
        IF FOUND THEN
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

    DELETE FROM public.verification_attempts
    WHERE item_id = p_item_id AND user_id = v_user_id;

    INSERT INTO public.claims (item_id, claimer_id, status, verified_at)
    VALUES (p_item_id, v_user_id, 'verified', timezone('utc'::text, now()))
    ON CONFLICT (item_id, claimer_id)
    DO UPDATE SET
        status = 'verified',
        verified_at = timezone('utc'::text, now());

    SELECT
        p.full_name,
        p.phone,
        COALESCE(NULLIF(trim(p.email), ''), u.email) AS email
    INTO v_finder
    FROM public.profiles p
    LEFT JOIN auth.users u ON p.id = u.id
    WHERE p.id = v_item.user_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Verification successful! Ownership confirmed.',
        'finder', jsonb_build_object(
            'full_name', v_finder.full_name,
            'phone', COALESCE(NULLIF(trim(v_item.contact_phone), ''), v_finder.phone, 'Contact via university portal / email'),
            'email', COALESCE(NULLIF(trim(v_item.contact_email), ''), v_finder.email)
        )
    );
END;
$$;

-- RPC: Admin Full Item Update (with server-side Bcrypt hashing if secret answer is updated)
CREATE OR REPLACE FUNCTION public.admin_update_item(
    p_item_id UUID,
    p_title TEXT,
    p_type TEXT,
    p_category TEXT,
    p_description TEXT,
    p_location TEXT,
    p_item_date DATE,
    p_status TEXT,
    p_contact_phone TEXT DEFAULT NULL,
    p_contact_email TEXT DEFAULT NULL,
    p_verify_question TEXT DEFAULT NULL,
    p_verify_answer TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
DECLARE
    v_existing RECORD;
    v_new_hash TEXT;
    v_clean_phone TEXT;
    v_clean_email TEXT;
    v_clean_question TEXT;
    v_clean_answer TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Forbidden: Admin privileges are required for this action.';
    END IF;

    SELECT * INTO v_existing FROM public.items WHERE id = p_item_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found.';
    END IF;

    IF p_type NOT IN ('lost', 'found') THEN
        RAISE EXCEPTION 'Invalid item type. Must be lost or found.';
    END IF;

    IF p_status NOT IN ('open', 'claimed', 'returned', 'archived') THEN
        RAISE EXCEPTION 'Invalid item status.';
    END IF;

    v_clean_phone := NULLIF(trim(COALESCE(p_contact_phone, '')), '');
    v_clean_email := NULLIF(trim(COALESCE(p_contact_email, '')), '');
    v_clean_question := NULLIF(trim(COALESCE(p_verify_question, '')), '');
    v_clean_answer := NULLIF(trim(COALESCE(p_verify_answer, '')), '');

    IF v_clean_phone IS NOT NULL AND char_length(v_clean_phone) < 7 THEN
        RAISE EXCEPTION 'Please provide a valid contact phone number (at least 7 characters).';
    END IF;

    IF p_type = 'found' THEN
        IF v_clean_question IS NULL THEN
            RAISE EXCEPTION 'Verification question is required for found items.';
        END IF;

        IF v_clean_answer IS NOT NULL THEN
            v_new_hash := crypt(lower(v_clean_answer), gen_salt('bf', 8));
        ELSIF v_existing.verify_answer_hash IS NOT NULL THEN
            v_new_hash := v_existing.verify_answer_hash;
        ELSE
            RAISE EXCEPTION 'Verification answer is required when converting a lost item to found.';
        END IF;
    ELSE
        v_clean_question := NULL;
        v_new_hash := NULL;
    END IF;

    UPDATE public.items
    SET
        title = trim(p_title),
        type = p_type,
        category = p_category,
        description = trim(p_description),
        location = trim(p_location),
        item_date = p_item_date,
        status = p_status,
        contact_phone = v_clean_phone,
        contact_email = v_clean_email,
        verify_question = v_clean_question,
        verify_answer_hash = v_new_hash
    WHERE id = p_item_id;

    RETURN TRUE;
END;
$$;

-- RPC: Public Platform Stats (safe aggregate counts)
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_total_reported INT;
    v_total_returned INT;
    v_active_users INT;
BEGIN
    SELECT COUNT(*) INTO v_total_reported FROM public.items;
    SELECT COUNT(*) INTO v_total_returned FROM public.items WHERE status = 'returned';
    SELECT COUNT(*) INTO v_active_users FROM public.profiles;

    RETURN jsonb_build_object(
        'total_reported', COALESCE(v_total_reported, 0),
        'total_returned', COALESCE(v_total_returned, 0),
        'active_users', COALESCE(v_active_users, 0)
    );
END;
$$;

-- RPC: Verified Claims on Current User's Found Items
CREATE OR REPLACE FUNCTION public.get_claims_on_my_items()
RETURNS TABLE (
    claim_id UUID,
    item_id UUID,
    item_title TEXT,
    item_type TEXT,
    item_status TEXT,
    claim_status TEXT,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    claimer_name TEXT,
    claimer_phone TEXT,
    claimer_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        c.id AS claim_id,
        i.id AS item_id,
        i.title AS item_title,
        i.type AS item_type,
        i.status AS item_status,
        c.status AS claim_status,
        c.verified_at,
        c.created_at,
        p.full_name AS claimer_name,
        p.phone AS claimer_phone,
        COALESCE(NULLIF(trim(p.email), ''), u.email) AS claimer_email
    FROM public.claims c
    JOIN public.items i ON i.id = c.item_id
    JOIN public.profiles p ON p.id = c.claimer_id
    LEFT JOIN auth.users u ON u.id = c.claimer_id
    WHERE i.user_id = auth.uid()
    ORDER BY COALESCE(c.verified_at, c.created_at) DESC;
END;
$$;

-- RPC: Admin Claims Log
CREATE OR REPLACE FUNCTION public.get_admin_claims()
RETURNS TABLE (
    claim_id UUID,
    item_id UUID,
    item_title TEXT,
    item_type TEXT,
    item_status TEXT,
    claim_status TEXT,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    finder_name TEXT,
    finder_email TEXT,
    claimer_name TEXT,
    claimer_phone TEXT,
    claimer_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Forbidden: Admin privileges required.';
    END IF;

    RETURN QUERY
    SELECT
        c.id AS claim_id,
        i.id AS item_id,
        i.title AS item_title,
        i.type AS item_type,
        i.status AS item_status,
        c.status AS claim_status,
        c.verified_at,
        c.created_at,
        fp.full_name AS finder_name,
        COALESCE(NULLIF(trim(fp.email), ''), fu.email) AS finder_email,
        cp.full_name AS claimer_name,
        cp.phone AS claimer_phone,
        COALESCE(NULLIF(trim(cp.email), ''), cu.email) AS claimer_email
    FROM public.claims c
    JOIN public.items i ON i.id = c.item_id
    JOIN public.profiles fp ON fp.id = i.user_id
    LEFT JOIN auth.users fu ON fu.id = i.user_id
    JOIN public.profiles cp ON cp.id = c.claimer_id
    LEFT JOIN auth.users cu ON cu.id = c.claimer_id
    ORDER BY COALESCE(c.verified_at, c.created_at) DESC;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_attempts ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile or admin views all" ON public.profiles;
CREATE POLICY "Users can view own profile or admin views all"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile without changing role" ON public.profiles;
CREATE POLICY "Users can update own profile without changing role"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (
        public.is_admin()
        OR (auth.uid() = id AND role = public.get_my_role())
    );

-- ITEMS POLICIES
DROP POLICY IF EXISTS "Items are viewable by authenticated users" ON public.items;
DROP POLICY IF EXISTS "Items selectable by owner, claimer, or admin" ON public.items;
CREATE POLICY "Items selectable by owner, claimer, or admin"
    ON public.items FOR SELECT
    USING (
        auth.uid() = user_id
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.claims c
            WHERE c.item_id = items.id AND c.claimer_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated users can create items" ON public.items;
CREATE POLICY "Authenticated users can create items"
    ON public.items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own items" ON public.items;
DROP POLICY IF EXISTS "Users or admins can update items" ON public.items;
CREATE POLICY "Users or admins can update items"
    ON public.items FOR UPDATE
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can delete their own items" ON public.items;
DROP POLICY IF EXISTS "Users or admins can delete items" ON public.items;
CREATE POLICY "Users or admins can delete items"
    ON public.items FOR DELETE
    USING (auth.uid() = user_id OR public.is_admin());

-- CLAIMS POLICIES
DROP POLICY IF EXISTS "Users can view relevant claims" ON public.claims;
CREATE POLICY "Users can view relevant claims"
    ON public.claims FOR SELECT
    USING (
        auth.uid() = claimer_id
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = claims.item_id AND items.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Authenticated users can create claims" ON public.claims;
CREATE POLICY "Authenticated users can create claims"
    ON public.claims FOR INSERT
    WITH CHECK (auth.uid() = claimer_id);

DROP POLICY IF EXISTS "Item owner or claimer can update claim" ON public.claims;
CREATE POLICY "Item owner or claimer can update claim"
    ON public.claims FOR UPDATE
    USING (
        auth.uid() = claimer_id
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM public.items
            WHERE items.id = claims.item_id AND items.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can delete claims" ON public.claims;
CREATE POLICY "Admins can delete claims"
    ON public.claims FOR DELETE
    USING (public.is_admin());

-- VERIFICATION ATTEMPTS POLICIES
DROP POLICY IF EXISTS "Users can view own verification attempts" ON public.verification_attempts;
CREATE POLICY "Users can view own verification attempts"
    ON public.verification_attempts FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- ----------------------------------------------------------------------------
-- 9. STORAGE BUCKET CONFIGURATION & POLICIES
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public can view item images" ON storage.objects;
CREATE POLICY "Public can view item images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'item-images');

DROP POLICY IF EXISTS "Users can upload item images into own folder" ON storage.objects;
CREATE POLICY "Users can upload item images into own folder"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'item-images' AND
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

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
        bucket_id = 'item-images' AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR public.is_admin()
        )
    );

-- ----------------------------------------------------------------------------
-- 10. LEAST-PRIVILEGE GRANTS (Column-Level Hash Protection)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Public views accessible to everyone
GRANT SELECT ON public.public_items, public.public_leaderboard TO anon, authenticated;

-- Authenticated base table access (verify_answer_hash explicitly excluded from SELECT)
REVOKE SELECT ON public.items FROM anon, authenticated;
GRANT SELECT (
    id, user_id, title, type, category, description, location,
    item_date, image_url, status, verify_question,
    contact_phone, contact_email, points_awarded, points_awarded_at,
    created_at, updated_at
) ON public.items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.items TO authenticated;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claims TO authenticated;
GRANT SELECT ON public.verification_attempts TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_item(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_and_get_contact(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_item(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_claims_on_my_items() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_claims() TO authenticated;
