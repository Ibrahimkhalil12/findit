-- ============================================================================
-- FindIt: University Lost & Found Portal
-- Fictional Realistic Campus Demo Seed Data
--
-- Institution: MAWTS Institute of Technology
-- Team: Group 3 | Supervisor: Joy Debnath
-- Author: MD Ibrahim Khalil & Akash Biswas
--
-- NOTE: All data herein is entirely fictional. No real personal student data
-- is used. All demo records are clearly prefixed with '[DEMO]'.
-- Instructions for cleaning up demo data are provided at the end of this script.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FICTIONAL DEMO PROFILES
-- ----------------------------------------------------------------------------
-- Pre-generate consistent UUIDs for demo student accounts
DO $$
DECLARE
    v_user1_id UUID := '00000000-0000-0000-0000-000000000001';
    v_user2_id UUID := '00000000-0000-0000-0000-000000000002';
    v_user3_id UUID := '00000000-0000-0000-0000-000000000003';
    v_user4_id UUID := '00000000-0000-0000-0000-000000000004';
BEGIN
    -- Optional: If running in environment without auth.users pre-seeded,
    -- create dummy auth entries if auth schema is accessible.
    -- (In Supabase Studio SQL editor, this smoothly populates profiles)
    BEGIN
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud)
        VALUES 
            (v_user1_id, 'demo.tanvir@mawts.edu.bd', crypt('DemoPass123!', gen_salt('bf')), now(), '{"full_name":"Tanvir Hasan (Demo)","phone":"+8801711000001"}'::jsonb, 'authenticated', 'authenticated'),
            (v_user2_id, 'demo.nusrat@mawts.edu.bd', crypt('DemoPass123!', gen_salt('bf')), now(), '{"full_name":"Nusrat Jahan (Demo)","phone":"+8801811000002"}'::jsonb, 'authenticated', 'authenticated'),
            (v_user3_id, 'demo.shahriar@mawts.edu.bd', crypt('DemoPass123!', gen_salt('bf')), now(), '{"full_name":"Shahriar Kabir (Demo)","phone":"+8801911000003"}'::jsonb, 'authenticated', 'authenticated'),
            (v_user4_id, 'demo.anika@mawts.edu.bd', crypt('DemoPass123!', gen_salt('bf')), now(), '{"full_name":"Anika Tabassum (Demo)","phone":"+8801611000004"}'::jsonb, 'authenticated', 'authenticated')
        ON CONFLICT (id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        -- If direct insert to auth.users is restricted by Supabase host permissions, proceed to profiles
        NULL;
    END;

    -- Upsert demo profiles
    INSERT INTO public.profiles (id, full_name, email, phone, role, points, items_returned_count)
    VALUES 
        (v_user1_id, 'Tanvir Hasan (Demo)', 'demo.tanvir@mawts.edu.bd', '+8801711000001', 'student', 350, 7),
        (v_user2_id, 'Nusrat Jahan (Demo)', 'demo.nusrat@mawts.edu.bd', '+8801811000002', 'student', 150, 3),
        (v_user3_id, 'Shahriar Kabir (Demo)', 'demo.shahriar@mawts.edu.bd', '+8801911000003', 'student', 100, 2),
        (v_user4_id, 'Anika Tabassum (Demo)', 'demo.anika@mawts.edu.bd', '+8801611000004', 'student', 50, 1)
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        points = EXCLUDED.points,
        items_returned_count = EXCLUDED.items_returned_count;

    -- ----------------------------------------------------------------------------
    -- 2. FICTIONAL DEMO ITEMS (6 Campus Requirements)
    -- ----------------------------------------------------------------------------

    -- Item 1: Lost Black Backpack
    INSERT INTO public.items (
        user_id, title, type, category, description, location, item_date, 
        image_url, status, verify_question, verify_answer_hash
    ) VALUES (
        v_user1_id,
        '[DEMO] Lost Black Arctic Hunter Backpack',
        'lost',
        'Bag',
        'Black waterproof Arctic Hunter backpack with red logo zipper. Contains DSA lecture notebook and blue umbrella. Left near the window desk.',
        'Central Library - 2nd Floor Study Hall',
        CURRENT_DATE - INTERVAL '2 days',
        'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
        'open',
        NULL,
        NULL
    );

    -- Item 2: Found Student ID Card
    -- Secret answer: 'CSE-2023-084'
    INSERT INTO public.items (
        user_id, title, type, category, description, location, item_date, 
        image_url, status, verify_question, verify_answer_hash
    ) VALUES (
        v_user2_id,
        '[DEMO] Found MAWTS Student Identity Card',
        'found',
        'ID Card',
        'Found an official MAWTS student smart card on the floor near Terminal 14. Surrendered to safe-keeping with computer lab proctor.',
        'Computer Lab 3 (Ground Floor)',
        CURRENT_DATE - INTERVAL '1 days',
        'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=800&q=80',
        'open',
        'What is the last 4 digits of the Student Roll Number on this card?',
        crypt(lower(trim('0084')), gen_salt('bf', 8))
    );

    -- Item 3: Lost Wireless Earbuds
    INSERT INTO public.items (
        user_id, title, type, category, description, location, item_date, 
        image_url, status, verify_question, verify_answer_hash
    ) VALUES (
        v_user3_id,
        '[DEMO] Lost White Galaxy Buds 2 Pro in Black Case',
        'lost',
        'Phone',
        'Matte white Samsung Galaxy Buds in a protective carbon-fiber style black case. Case has a small anime sticker on the bottom lid.',
        'Cafeteria - East Corner Booth',
        CURRENT_DATE - INTERVAL '3 days',
        'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80',
        'open',
        NULL,
        NULL
    );

    -- Item 4: Found Spiral Notebook
    -- Secret answer: 'Algorithms'
    INSERT INTO public.items (
        user_id, title, type, category, description, location, item_date, 
        image_url, status, verify_question, verify_answer_hash
    ) VALUES (
        v_user4_id,
        '[DEMO] Found Hardcover Spiral Engineering Notebook',
        'found',
        'Books',
        'Dark navy 200-page spiral notebook with handwritten diagrams on graph paper. Left on the second row desk after 11:30 AM class.',
        'Academic Building 1 - Room 402',
        CURRENT_DATE - INTERVAL '4 days',
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80',
        'open',
        'What subject or course title is written on the first header line?',
        crypt(lower(trim('Algorithms')), gen_salt('bf', 8))
    );

    -- Item 5: Lost Scientific Calculator
    INSERT INTO public.items (
        user_id, title, type, category, description, location, item_date, 
        image_url, status, verify_question, verify_answer_hash
    ) VALUES (
        v_user1_id,
        '[DEMO] Lost Casio fx-991EX ClassWiz Calculator',
        'lost',
        'Other',
        'Black and white Casio fx-991EX scientific calculator with sliding cover. Small silver initial sticker "TH" on the back battery slot.',
        'Physics Laboratory 201',
        CURRENT_DATE - INTERVAL '5 days',
        'https://images.unsplash.com/photo-1611125832047-1d7ad1e8e48f?auto=format&fit=crop&w=800&q=80',
        'open',
        NULL,
        NULL
    );

    -- Item 6: Found Insulated Metal Water Bottle
    -- Secret answer: 'Hydro Flask'
    INSERT INTO public.items (
        user_id, title, type, category, description, location, item_date, 
        image_url, status, verify_question, verify_answer_hash
    ) VALUES (
        v_user2_id,
        '[DEMO] Found Olive Green Stainless Steel Water Bottle',
        'found',
        'Other',
        'Found a 750ml insulated metal thermal bottle near the outdoor badminton court benches. Still in pristine condition.',
        'Campus Gymnasium & Sports Complex',
        CURRENT_DATE,
        'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80',
        'open',
        'What brand logo or sticker is embossed on the cap handle?',
        crypt(lower(trim('Hydro Flask')), gen_salt('bf', 8))
    );

END $$;

-- ----------------------------------------------------------------------------
-- HOW TO CLEAN UP DEMO DATA BEFORE PRODUCTION LAUNCH
-- ----------------------------------------------------------------------------
-- Run the following single command in Supabase SQL Editor to wipe all demo entries:
--
-- DELETE FROM public.items WHERE title LIKE '[DEMO]%';
-- DELETE FROM public.profiles WHERE id IN (
--     '00000000-0000-0000-0000-000000000001',
--     '00000000-0000-0000-0000-000000000002',
--     '00000000-0000-0000-0000-000000000003',
--     '00000000-0000-0000-0000-000000000004'
-- );
