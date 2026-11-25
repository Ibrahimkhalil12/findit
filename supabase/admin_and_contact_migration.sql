-- ============================================================================
-- FindIt: University Lost & Found Portal
-- Migration: Main Admin Portal + Lost/Found Contact Visibility + Security Hardening
--
-- Safe to run on an EXISTING FindIt Supabase database in SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SCHEMA UPDATES (profiles & items)
-- ----------------------------------------------------------------------------

-- Add email & role columns to profiles
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'profiles_role_check' AND conrelid = 'public.profiles'::regclass
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'admin'));
    END IF;
END $$;

-- Backfill email from auth.users for existing profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR trim(p.email) = '');

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Add optional per-item contact fields to items
ALTER TABLE public.items
    ADD COLUMN IF NOT EXISTS contact_phone TEXT,
    ADD COLUMN IF NOT EXISTS contact_email TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'items_contact_phone_check' AND conrelid = 'public.items'::regclass
    ) THEN
        ALTER TABLE public.items
            ADD CONSTRAINT items_contact_phone_check
            CHECK (contact_phone IS NULL OR trim(contact_phone) = '' OR char_length(trim(contact_phone)) >= 7);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. ROLE HELPER FUNCTIONS (SECURITY DEFINER to avoid RLS recursion)
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
-- 3. UPDATED SIGNUP TRIGGER (Syncs email & enforces student role on signup)
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 4. SAFE PUBLIC VIEWS (Lost = contact visible; Found = contact NULL/hidden)
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 5. SECURE RPC FUNCTIONS
-- ----------------------------------------------------------------------------

-- Drop old 9-parameter post_item to prevent PostgREST function overload ambiguity
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

-- Updated verify_and_get_contact: prefers item-level contact info, falls back to finder profile/auth
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

-- RPC: Admin Full Item Update (supports optional server-side Bcrypt answer update)
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

-- RPC: Public Platform Stats (safe aggregate counts for homepage)
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

-- RPC: Claims on Finder's Own Items (lets finder see verified claimer contact safely)
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

-- RPC: Admin Claims List (full claim visibility for Main Admin Portal)
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
-- 6. UPDATED ROW LEVEL SECURITY (RLS) POLICIES & COLUMN GRANTS
-- ----------------------------------------------------------------------------

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

-- STORAGE POLICIES (allow admin to delete any uploaded item image)
DROP POLICY IF EXISTS "Users can delete own item images" ON storage.objects;
CREATE POLICY "Users can delete own item images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'item-images' AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR public.is_admin()
        )
    );

-- COLUMN-LEVEL SECURITY: Prevent verify_answer_hash from ever being queried directly
REVOKE SELECT ON public.items FROM anon, authenticated;
GRANT SELECT (
    id, user_id, title, type, category, description, location,
    item_date, image_url, status, verify_question,
    contact_phone, contact_email, points_awarded, points_awarded_at,
    created_at, updated_at
) ON public.items TO authenticated;

GRANT SELECT ON public.public_items, public.public_leaderboard TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_item(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_and_get_contact(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_item(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_claims_on_my_items() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_claims() TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. HOW TO PROMOTE YOUR FIRST ADMIN ACCOUNT
-- ----------------------------------------------------------------------------
-- 1) Register a user via signup.html or Supabase Auth -> Users -> Add User.
-- 2) Run the query below with that user's email address:
--
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE email = 'admin@mawts.edu.bd';
