# FindIt – Main Admin Portal & Contact Visibility Upgrade Plan

এই ডকুমেন্টে **FindIt** প্রজেক্টে দুটি বড় নতুন ফিচার যোগ করার সম্পূর্ণ টেকনিক্যাল পরিকল্পনা, ডাটাবেস পরিবর্তন, ফাইল-বাই-ফাইল আপডেট এবং বাস্তবায়ন ধাপ বিস্তারিতভাবে লেখা হয়েছে:

1. **Main Admin Portal:** অ্যাডমিন লগইন করে পুরো ক্যাম্পাসের **সকল ইউজারের** Lost & Found ডেটা দেখতে, সার্চ/ফিল্টার করতে, **Edit**, **Status Change**, এবং **Delete** করতে পারবে।
2. **Lost বনাম Found কনট্যাক্ট লজিক:**
   - **Lost Item (`type = 'lost'` — যার জিনিস হারিয়েছে):** আইটেম ডিটেইলস পেজে পোস্টদাতার (মালিকের) **ফোন নম্বর ও ইমেইল স্বাভাবিকভাবেই (Normally) দেখানো থাকবে**, যাতে কেউ জিনিসটি খুঁজে পেলেই সরাসরি যোগাযোগ করতে পারে।
   - **Found Item (`type = 'found'` — যে জিনিস খুঁজে পেয়েছে):** পোস্ট করার সময় দেওয়া **Secret Question**-এর সঠিক উত্তর দিতে পারলেই কেবল **কনট্যাক্ট নম্বর ও ইমেইল আনলক হয়ে দেখাবে** (আগে সম্পূর্ণ লুকানো থাকবে এবং ৫ বার ভুল করলে ১৫ মিনিট লকআউট হবে)।

---

## ১. একনজরে ফাইল পরিবর্তনের ম্যাপ (File Change Overview)

### নতুন তৈরি হবে (New Files)

| ফাইল পাথ | কাজের বিবরণ |
| :--- | :--- |
| `supabase/admin_and_contact_migration.sql` | বিদ্যমান ডাটাবেসে নতুন কলাম, ফাংশন, ভিউ এবং Admin RLS পলিসি নিরাপদভাবে রান করার SQL মাইগ্রেশন স্ক্রিপ্ট |
| `admin-login.html` | ডেডিকেটেড অ্যাডমিন লগইন পেজ (শুধু `role = 'admin'` ইউজার ঢুকতে পারবে) |
| `admin.html` | মেইন অ্যাডমিন ড্যাশবোর্ড (স্ট্যাটস, সব Lost & Found আইটেমের টেবিল, সার্চ/ফিল্টার, Edit/Status/Delete মোডাল, Claims লিস্ট) |
| `js/admin.js` | অ্যাডমিন পোর্টালের সম্পূর্ণ লজিক (অ্যাডমিন গার্ড, সব ডেটা ফেচ, সার্চ/ফিল্টার, Edit, Status Update, Delete + ছবি ডিলিট) |

### পরিবর্তন হবে (Modified Files)

| ফাইল পাথ | কী পরিবর্তন আসবে |
| :--- | :--- |
| `supabase/schema.sql` | `profiles`-এ `role` ও `email` কলাম, `items`-এ ঐচ্ছিক `contact_phone`/`contact_email`, `is_admin()`, `admin_update_item()`, `get_platform_stats()`, `public_items` ভিউ রিক্রিয়েট, `post_item` ও `verify_and_get_contact` RPC আপডেট এবং Admin + Column-level RLS পলিসি |
| `js/supabase-client.js` | `getProfile()` ও `isAdmin()` হেল্পার যোগ করা (যাতে সব পেজের `common.js` থেকে ন্যাভবারে Admin বাটন দেখানো যায়, `auth.js` ছাড়াই) |
| `item.html` | Lost আইটেমের জন্য নতুন **Owner Contact Card (`#lost-contact-card`)** যোগ করা |
| `js/item.js` | `type === 'lost'` হলে সরাসরি মালিকের ফোন ও ইমেইল দেখানো; `type === 'found'` হলে Secret Question চ্যালেঞ্জ দেখানো এবং উত্তর মিললে কনট্যাক্ট আনলক করা |
| `post.html` | Lost আইটেম পোস্ট করার সময় কন্ট্যাক্ট ইনফো (ফোন ও ইমেইল) ইনপুট/প্রিভিউ সেকশন যোগ করা |
| `js/post.js` | URL-এর `?type=lost` / `?type=found` অটো-সিলেক্ট করা, প্রোফাইল থেকে ডিফল্ট ফোন/ইমেইল প্রি-ফিল করা এবং `post_item` RPC-তে কনট্যাক্ট ডেটা পাঠানো |
| `signup.html` | ফোন নম্বর ফিল্ডের হিন্ট টেক্সট আপডেট করা (Lost আইটেমে সাধারণভাবে দেখাবে ও Found আইটেমে ভেরিফিকেশনের পর আনলক হবে) |
| `js/auth.js` | `requireAdmin()` গার্ড যোগ করা এবং লগইন রিডাইরেক্টে অ্যাডমিন রোল সাপোর্ট |
| `js/common.js` | `window.FindItDB.isAdmin()` চেক করে লগইন করা ইউজার `admin` হলে ন্যাভবারে **"Admin Panel"** বাটন দেখানো |
| `js/home.js` | `loadStatistics()`-এ `get_platform_stats()` RPC বা `public_items` ভিউ ব্যবহার করা (যাতে RLS শক্ত করার পরও স্ট্যাটস কাজ করে) |
| `dashboard.html` ও `js/dashboard.js` | *(ঐচ্ছিক/বোনাস)* `get_claims_on_my_items()` RPC দিয়ে Found আইটেমের পোস্টদাতা যেন দেখতে পারে কে সঠিক উত্তর দিয়ে ক্লেইম করেছে (ক্লেইমারের নাম, ফোন ও ইমেইলসহ) |
| `style.css` | অ্যাডমিন টেবিল, স্ট্যাটস কার্ড, অ্যাডমিন ব্যাজ এবং Lost কনট্যাক্ট কার্ডের স্টাইল যোগ করা |
| `index.html` | ফুটারে **Admin Portal** লিংক যোগ করা |

---

## ২. ডাটাবেস পরিবর্তন (Supabase PostgreSQL)

**ফাইল:** `supabase/schema.sql` (মূল স্কিমা আপডেট) এবং `supabase/admin_and_contact_migration.sql` (ইতিমধ্যে তৈরি ডাটাবেসে রান করার জন্য)

### ২.১ `profiles` টেবিলে `role` এবং `email` কলাম যোগ করা
- বর্তমানে `profiles` টেবিলে রোল নেই এবং ইউজারের ইমেইল শুধু `auth.users` টেবিলে থাকে।
- `role` যোগ করলে আমরা আলাদা করতে পারব কে `student` আর কে `admin`।
- `email` কলাম `profiles`-এ সিঙ্ক রাখলে `public_items` ভিউ থেকে সরাসরি Lost আইটেমের মালিকের ইমেইল দেখানো সহজ ও নিরাপদ হবে।

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'admin'));

-- পুরোনো ইউজারদের email auth.users থেকে ব্যাকফিল করা
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
```

- `handle_new_user()` ট্রিগার আপডেট করে নতুন সাইন-আপে অটোমেটিক `email = NEW.email` এবং `role = 'student'` সেট করা হবে।

### ২.২ `items` টেবিলে ঐচ্ছিক কনট্যাক্ট ফিল্ড যোগ করা
- কোনো ইউজার যদি তার প্রোফাইলের নম্বরের বদলে নির্দিষ্ট আইটেমের জন্য আলাদা ফোন নম্বর বা ইমেইল দিতে চায়, তার জন্য `items` টেবিলে দুটি ঐচ্ছিক কলাম যোগ করা হবে:

```sql
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT;
```

> **ব্যাকওয়ার্ড কমপ্যাটিবিলিটি:** ইউজার আলাদা করে ফোন/ইমেইল না দিলেও `COALESCE(i.contact_phone, p.phone)` এবং `COALESCE(i.contact_email, p.email)` ব্যবহার করা হবে, ফলে প্রোফাইলের তথ্য অটোমেটিক কাজ করবে।

### ২.৩ `is_admin()` হেল্পার ফাংশন তৈরি করা
RLS পলিসিতে সরাসরি `profiles` টেবিল কুয়েরি করলে অনেক সময় recursion সমস্যা হয়। তাই `SECURITY DEFINER` দিয়ে `is_admin()` ফাংশন বানানো হবে:

```sql
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
```

### ২.৪ `public_items` ভিউ আপডেট (Lost = কনট্যাক্ট দেখাবে, Found = লুকানো থাকবে)
এটি সবচেয়ে গুরুত্বপূর্ণ সিকিউরিটি অংশ। ডাটাবেস লেভেলেই কন্ডিশন দেওয়া থাকবে।

> **PostgreSQL সতর্কতা:** বিদ্যমান ভিউতে মাঝখানে নতুন কলাম যোগ করলে `CREATE OR REPLACE VIEW` এরর দেয় (`cannot change name of view column`)। তাই মাইগ্রেশনে অবশ্যই আগে `DROP VIEW IF EXISTS public.public_items;` করে তারপর ভিউ তৈরি ও `GRANT SELECT` করতে হবে।

```sql
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
        WHEN i.status = 'open' AND i.created_at < (timezone('utc'::text, now()) - INTERVAL '30 days')
        THEN 'archived'
        ELSE i.status
    END AS status,
    i.verify_question,
    i.created_at,
    i.updated_at,
    p.full_name AS poster_name,
    p.avatar_url AS poster_avatar,
    -- শুধুমাত্র LOST আইটেমের ক্ষেত্রেই ফোন ও ইমেইল পাবলিকভাবে দেখাবে;
    -- FOUND আইটেমের ক্ষেত্রে সবসময় NULL থাকবে!
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

GRANT SELECT ON public.public_items TO anon, authenticated;
```

### ২.৫ `post_item`, `verify_and_get_contact`, `admin_update_item` এবং `get_platform_stats` RPC
1. **`post_item` RPC (Function Overload এড়ানো):**
   - পুরোনো ৯-প্যারামিটারের ফাংশনটি আগে অবশ্যই ড্রপ করতে হবে, না হলে PostgreSQL-এ দুটি ওভারলোডেড ফাংশন তৈরি হয়ে PostgREST RPC কল ফেল করবে:
     ```sql
     DROP FUNCTION IF EXISTS public.post_item(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT);
     ```
   - এরপর নতুন ১১-প্যারামিটারের `post_item` তৈরি হবে, যেখানে `p_contact_phone TEXT DEFAULT NULL` ও `p_contact_email TEXT DEFAULT NULL` যুক্ত থাকবে।
2. **`verify_and_get_contact` RPC:**
   - Found আইটেমের গোপন প্রশ্নের উত্তর সঠিক হলে `COALESCE(NULLIF(trim(v_item.contact_phone), ''), v_finder.phone)` এবং `COALESCE(NULLIF(trim(v_item.contact_email), ''), v_finder.email)` রিটার্ন করবে।
   - ৫ বার ভুল করলে ১৫ মিনিট লকআউট আগের মতোই থাকবে।
3. **`admin_update_item` RPC (`SECURITY DEFINER`):**
   - অ্যাডমিন যদি কোনো আইটেমের টাইপ `lost` থেকে `found` করে অথবা Found আইটেমের **Secret Question / Secret Answer** পরিবর্তন করতে চায়, তবে এই RPC প্রথমে `public.is_admin()` যাচাই করবে এবং নতুন উত্তর থাকলে সার্ভার-সাইডে `crypt(..., gen_salt('bf', 8))` দিয়ে Bcrypt হ্যাশ করে সেভ করবে।
4. **`get_platform_stats()` RPC (`SECURITY DEFINER`):**
   - হোমপেজের ৪টি কাউন্টার (`total_reported`, `total_returned`, `active_users`) নিরাপদভাবে রিটার্ন করবে—যাতে `profiles` ও `items` টেবিলের RLS শক্ত করার পরও হোমপেজের স্ট্যাটস লগআউট ইউজারদের জন্য ঠিকমতো কাজ করে।

### ২.৬ Admin-এর জন্য RLS পলিসি ও সিকিউরিটি হার্ডেনিং
1. **`items` টেবিলের UPDATE ও DELETE পলিসি (অ্যাডমিন সব এডিট/ডিলিট করতে পারবে):**
   ```sql
   DROP POLICY IF EXISTS "Users can update their own items" ON public.items;
   CREATE POLICY "Users or admins can update items"
     ON public.items FOR UPDATE
     USING (auth.uid() = user_id OR public.is_admin())
     WITH CHECK (auth.uid() = user_id OR public.is_admin());

   DROP POLICY IF EXISTS "Users can delete their own items" ON public.items;
   CREATE POLICY "Users or admins can delete items"
     ON public.items FOR DELETE
     USING (auth.uid() = user_id OR public.is_admin());
   ```
2. **`items` টেবিলের SELECT প্রাইভেসি ও Column-Level সুরক্ষা (খুব গুরুত্বপূর্ণ):**
   - `verify_answer_hash` কলামটি কোনোভাবেই ক্লায়েন্ট (এমনকি অ্যাডমিন বা ক্লেইমার)-এর কাছে না যায়, সেজন্য কলাম-লেভেল `REVOKE/GRANT` দেওয়া হবে:
     ```sql
     REVOKE SELECT ON public.items FROM anon, authenticated;
     GRANT SELECT (
       id, user_id, title, type, category, description, location,
       item_date, image_url, status, verify_question,
       contact_phone, contact_email, points_awarded, points_awarded_at,
       created_at, updated_at
     ) ON public.items TO authenticated;
     ```
   - আর `items`-এর `SELECT` RLS পলিসিতে **নিজের পোস্ট**, **অ্যাডমিন**, এবং **যার ক্লেইম আছে (`claims.claimer_id = auth.uid()`)** — এই তিনজনকে অনুমোদন দিতে হবে, যাতে ড্যাশবোর্ডের `.from('claims').select('*, items(title, type, location)')` জয়েন কুয়েরিটি ভেঙে না যায়:
     ```sql
     DROP POLICY IF EXISTS "Items are viewable by authenticated users" ON public.items;
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
     ```
   - পাবলিক ব্রাউজিং (লগইন ও লগআউট) সম্পূর্ণভাবে `public_items` ভিউ দিয়ে চলবে।
3. **`profiles` টেবিলের প্রাইভেসি ও Role সুরক্ষা (Self-Promotion বন্ধ করা):**
   - সাধারণ ইউজার যেন অন্য ইউজারের `phone`/`email` সরাসরি `profiles` টেবিল থেকে না পড়তে পারে:
     ```sql
     DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
     CREATE POLICY "Users can view own profile or admin views all"
       ON public.profiles FOR SELECT
       USING (auth.uid() = id OR public.is_admin());
     ```
     *(পাবলিক লিডারবোর্ডের জন্য `public_leaderboard` ভিউ আগের মতোই কাজ করবে।)*
   - সাধারণ ইউজার যেন নিজের প্রোফাইল আপডেট করে নিজেই `role = 'admin'` বানাতে না পারে:
   ```sql
   DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
   CREATE POLICY "Users can update own profile without changing role"
     ON public.profiles FOR UPDATE
     USING (auth.uid() = id OR public.is_admin())
     WITH CHECK (
       public.is_admin()
       OR (
         auth.uid() = id
         AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
       )
     );
   ```
4. **`claims` ও `storage.objects` টেবিলে অ্যাডমিন অ্যাক্সেস:**
   - অ্যাডমিন সব `claims` দেখতে/আপডেট/ডিলিট করতে পারবে।
   - অ্যাডমিন `item-images` স্টোরেজ বাকেট থেকে যেকোনো ডিলিট করা আইটেমের ছবিও মুছে ফেলতে পারবে (`bucket_id = 'item-images' AND public.is_admin()`)।

### ২.৭ প্রথম অ্যাডমিন অ্যাকাউন্ট কীভাবে তৈরি করবে?
1. সাধারণভাবে `signup.html` দিয়ে বা Supabase Dashboard → **Authentication → Users → Add User** থেকে একটি অ্যাডমিন অ্যাকাউন্ট তৈরি করতে হবে (যেমন: `admin@mawts.edu.bd`)।
2. তারপর Supabase **SQL Editor**-এ নিচের এক লাইন রান করতে হবে:
   ```sql
   UPDATE public.profiles
   SET role = 'admin'
   WHERE email = 'admin@mawts.edu.bd';
   ```
3. ব্যস! ওই অ্যাকাউন্ট দিয়ে `admin-login.html`-এ লগইন করলেই মেইন অ্যাডমিন পোর্টাল খুলে যাবে।

---

## ৩. ফ্রন্টএন্ড পরিবর্তন (বিস্তারিত ফাইল-বাই-ফাইল)

### ৩.১ নতুন অ্যাডমিন লগইন পেজ — `admin-login.html`
- সাধারণ স্টুডেন্ট লগইনের চেয়ে আলাদা, ক্লিন **Admin Portal Login** ইন্টারফেস।
- ইমেইল ও পাসওয়ার্ড দিয়ে `supabase.auth.signInWithPassword()` কল করবে।
- লগইন সফল হওয়ার পর `profiles` টেবিল থেকে `role` চেক করবে:
  - যদি `role === 'admin'` হয় → `admin.html`-এ রিডাইরেক্ট করবে।
  - যদি `role !== 'admin'` হয় → সাথে সাথে `signOut()` করে এরর দেখাবে: *"Access Denied: এই অ্যাকাউন্টটির অ্যাডমিন পারমিশন নেই।"*

### ৩.২ নতুন মেইন অ্যাডমিন পোর্টাল — `admin.html` ও `js/admin.js`
অ্যাডমিন পোর্টালে নিচের সেকশনগুলো থাকবে:

1. **অ্যাডমিন রুট গার্ড (`requireAdmin()`):**
   - পেজ লোড হওয়ার সাথে সাথে চেক করবে ইউজার লগইন আছে কিনা এবং তার `role === 'admin'` কিনা। না হলে `admin-login.html`-এ পাঠিয়ে দেবে।
2. **ওভারভিউ স্ট্যাটস কার্ড (Top Metrics):**
   - Total Reports (সব আইটেম)
   - Lost Items Count
   - Found Items Count
   - Returned Items Count
   - Open / Archived Count
3. **সার্চ ও ফিল্টার বার:**
   - কীওয়ার্ড সার্চ (Title, Description, Location, Poster Name)
   - Type ফিল্টার (`All`, `Lost`, `Found`)
   - Status ফিল্টার (`All`, `Open`, `Claimed`, `Returned`, `Archived`)
   - Category ফিল্টার (`All`, `Bag`, `Phone`, `ID Card`, `Books`, `Keys`, `Other`)
4. **সব Lost & Found আইটেম ম্যানেজমেন্ট টেবিল/লিস্ট:**
   - প্রতিটি রো-তে থাকবে: Thumbnail ছবি, Title, Type ব্যাজ (`Lost`/`Found`), Category, Location, Incident Date, Posted By (নাম + ইমেইল/ফোন), Status ব্যাজ এবং Action বাটনগুলো:
     - **View:** `item.html?id=...` পেজে দেখা
     - **Status:** দ্রুত স্ট্যাটাস পরিবর্তন (`open`, `claimed`, `returned`, `archived`)
     - **Edit:** ফুল এডিট মোডাল (`admin_update_item` RPC ব্যবহার করে) — অ্যাডমিন যেকোনো আইটেমের `Title`, `Type (lost/found)`, `Category`, `Location`, `Item Date`, `Description`, `Status`, `Contact Phone`, `Contact Email`, এবং Found আইটেম হলে `Verify Question` ও নতুন `Verify Answer` (সার্ভার-সাইডে Bcrypt হ্যাশ হয়ে) আপডেট করতে পারবে।
     - **Delete:** কনফার্মেশন মোডালসহ স্থায়ী ডিলিট (`public.items` থেকে ডিলিট + ওই আইটেমের ছবি যদি Supabase Storage-এ থাকে তবে সেটিও রিমুভ করার অপশন)।
5. **Claims & Verification Logs ট্যাব (অ্যাডমিনের জন্য অতিরিক্ত সুবিধা):**
   - কোন Found আইটেমে কে ভেরিফিকেশন পাস করে ক্লেইম করেছে, তার তালিকা (Item Title, Finder, Claimer Name/Phone/Email, Status, Date)।

### ৩.৩ আইটেম ডিটেইলস পেজ — `item.html` এবং `js/item.js`
এখানেই **Lost** এবং **Found** আইটেমের কনট্যাক্ট দেখানোর আসল পার্থক্য কাজ করবে:

#### ক) `item.html`-এ নতুন সেকশন যোগ করা
`#verification-challenge-card`-এর ঠিক ওপরে একটি নতুন কার্ড যোগ হবে — `#lost-contact-card` (ডিফল্ট `display: none`):
- শিরোনাম: **"Lost Item Owner Contact Information"**
- সাবটাইটেল: *"আপনি কি এই জিনিসটি খুঁজে পেয়েছেন? নিচের নম্বর বা ইমেইলে সরাসরি মালিকের সাথে যোগাযোগ করুন।"*
- ফিল্ডগুলো:
  - **Owner Name** (`#lost-owner-name`)
  - **Phone Number** (`#lost-owner-phone` — ক্লিকেবল `tel:` লিংকসহ)
  - **Email Address** (`#lost-owner-email` — ক্লিকেবল `mailto:` লিংকসহ)
- আইটেম যদি ইতিমধ্যে `returned` হয়ে থাকে, তাহলে কনট্যাক্ট কার্ডের বদলে **"This Lost Item Has Been Found & Returned"** নোটিশ দেখাবে।

#### খ) `js/item.js`-এর লজিক পরিবর্তন
`renderItemDetails(item)` থেকে নিচের মতো দুই ভাগে হ্যান্ডেল হবে:
- **যদি `item.type === 'lost'` হয়:**
  - `#verification-challenge-card` → `display: none` (কোনো গোপন প্রশ্ন দেখাবে না)।
  - `#lost-contact-card` → `display: block`।
  - `item.contact_phone` ও `item.contact_email` (যা `public_items` ভিউ থেকে সরাসরি আসবে) নিরাপদভাবে `textContent` দিয়ে বসাবে এবং `tel:` / `mailto:` লিংক সেট করবে।
- **যদি `item.type === 'found'` হয়:**
  - `#lost-contact-card` → `display: none`।
  - `#verification-challenge-card` → `display: block`।
  - আগের মতোই Secret Question দেখাবে। ইউজার লগইন করে সঠিক উত্তর দিলে `verify_and_get_contact` RPC কল হয়ে Finder-এর নাম, ফোন ও ইমেইল `#contact-revealed-section`-এ আনলক হয়ে দেখাবে।
- **ডেমো ফলব্যাক আপডেট:** `getFallbackItem()`-এ `demo-1` (Lost) আইটেমেও ডেমো `contact_phone` ও `contact_email` যোগ করা হবে যাতে অফলাইন/ডেমো মোডেও সুন্দরভাবে টেস্ট করা যায়।

### ৩.৪ পোস্ট পেজ — `post.html` এবং `js/post.js`
1. **URL থেকে অটো-সিলেক্ট ফিক্স:**
   - হোমপেজের **"I Lost Something"** (`post.html?type=lost`) বা **"I Found Something"** (`post.html?type=found`) বাটনে ক্লিক করলে `js/post.js` যেন URL প্যারামিটার পড়ে অটোমেটিক সঠিক রেডিও বাটন সিলেক্ট করে ও `Found` হলে ভেরিফিকেশন সেকশন খুলে দেয়।
2. **Contact Information সেকশন যোগ করা (`post.html`):**
   - ফর্মে একটি **Contact Phone** (`#contact-phone`) এবং **Contact Email** (`#contact-email`) ফিল্ড থাকবে, যা লগইন করা ইউজারের প্রোফাইল থেকে অটোমেটিক প্রি-ফিল হয়ে থাকবে (চাইলে ইউজার বদলে দিতে পারবে)।
   - নিচে ডায়নামিক হিন্ট টেক্সট দেখাবে:
     - `Lost` সিলেক্ট থাকলে: *"এই ফোন নম্বর ও ইমেইল পোস্টের সাথে স্বাভাবিকভাবে দেখাবে, যাতে কেউ আপনার জিনিস খুঁজে পেলে যোগাযোগ করতে পারে।"*
     - `Found` সিলেক্ট থাকলে: *"আপনার ফোন নম্বর ও ইমেইল গোপন থাকবে। শুধুমাত্র গোপন প্রশ্নের সঠিক উত্তরদাতাই এটি দেখতে পারবে।"*
3. **`js/post.js` সাবমিশন আপডেট:**
   - `client.rpc('post_item', { ... p_contact_phone, p_contact_email })` কল করে কনট্যাক্ট ডেটা পাঠাবে।

### ৩.৫ অথেনটিকেশন, Supabase Client ও ন্যাভবার — `js/supabase-client.js`, `js/auth.js`, `js/common.js`, `js/home.js`
- **`js/supabase-client.js` (সব পেজে লোড হয়):**
  - নতুন হেল্পার মেথড: `getProfile()` এবং `isAdmin()`।
  - যেহেতু `index.html`, `items.html`, `item.html`, `leaderboard.html` পেজগুলোতে `js/auth.js` লোড করা নেই, তাই `isAdmin()` ফাংশনটি `js/supabase-client.js`-এ রাখলে সব পেজের ন্যাভবার থেকেই অ্যাডমিন রোল চেক করা যাবে।
- **`js/auth.js`:**
  - নতুন মেথড: `requireAdmin()` (অ্যাডমিন না হলে `admin-login.html`-এ পাঠাবে)।
  - `initLoginForm()`: লগইনের পর যদি `redirect` প্যারামিটার না থাকে এবং ইউজার `admin` হয়, তাহলে `admin.html`-এ যাওয়ার সুবিধা।
  - `admin-login.html` যেন সাধারণ `redirectIfAuth()` দিয়ে `dashboard.html`-এ না পাঠিয়ে শুধু `isAdmin()` হলে `admin.html`-এ পাঠায়।
- **`js/common.js`:**
  - `updateNavbarAuthState()`-এ `await window.FindItDB.isAdmin()` চেক করে লগইন করা ইউজার `admin` হলে ন্যাভবারে আলাদা **"Admin Panel"** (`admin.html`) বাটন দেখাবে।
- **`js/home.js`:**
  - `loadStatistics()`-এ `get_platform_stats()` RPC কল করবে (ফলব্যাক হিসেবে `public_items`), যাতে `items` ও `profiles` টেবিলের RLS শক্ত করার পরও হোমপেজের কাউন্টার সঠিকভাবে কাজ করে।

### ৩.৬ ড্যাশবোর্ডে বোনাস আপডেট — `dashboard.html` ও `js/dashboard.js`
- বর্তমানে [js/dashboard.js](file:///var/www/OTHER/findit/js/dashboard.js) শুধু ইউজার নিজে যেসব আইটেমে ক্লেইম করেছে (`claimer_id = currentUser.id`) তা দেখায়।
- চাইলে আরেকটি সেকশন যোগ করা যাবে: **"Verified Claims on My Found Items"** — যেখানে Finder দেখতে পারবে তার পোস্ট করা Found আইটেমে কোন ইউজার গোপন প্রশ্নের সঠিক উত্তর দিয়েছে এবং ওই মালিকের ফোন নম্বর/ইমেইল কী।

### ৩.৭ ডিজাইন ও স্টাইল — `style.css`
- অ্যাডমিন পোর্টালের জন্য নতুন রেস্পন্সিভ স্টাইল ক্লাস:
  - `.admin-header`, `.admin-stats-grid`, `.admin-toolbar`, `.admin-table-wrapper`, `.admin-table`
  - `.badge-admin` (অ্যাডমিন রোল ব্যাজ)
  - `.lost-contact-card` ও `.contact-info-grid` (Lost আইটেমের মালিকের কনট্যাক্ট কার্ডের জন্য)
- লাইট ও ডার্ক দুই মোডেই CSS ভ্যারিয়েবল (`--bg-surface`, `--border-subtle`, `--text-primary` ইত্যাদি) ব্যবহার করা হবে।

---

## ৪. কাজের ধারাবাহিক ধাপ (Implementation Roadmap)

1. **ধাপ ১ (ডাটাবেস):** `supabase/admin_and_contact_migration.sql` তৈরি করা, `supabase/schema.sql` আপডেট করা এবং Supabase SQL Editor-এ মাইগ্রেশন রান করে একজন ইউজারকে `role = 'admin'` সেট করা।
2. **ধাপ ২ (Auth & Navbar):** `js/auth.js`, `js/common.js` এবং `js/home.js` আপডেট করা।
3. **ধাপ ৩ (Lost/Found Contact Flow):** `post.html`, `js/post.js`, `item.html`, `js/item.js` আপডেট করে Lost-এ নরমাল কনট্যাক্ট ও Found-এ Secret Question লকড কনট্যাক্ট নিশ্চিত করা।
4. **ধাপ ৪ (Admin Portal):** `admin-login.html`, `admin.html`, `js/admin.js` এবং `style.css` তৈরি/আপডেট করা এবং `index.html` ফুটারে লিংক দেওয়া।
5. **ধাপ ৫ (টেস্টিং ও ভেরিফিকেশন):** নিচের QA চেকলিস্ট দিয়ে প্রতিটি ফিচার যাচাই করা।

---

## ৫. টেস্টিং চেকলিস্ট (QA Checklist)

- [ ] **Admin Access Control:** সাধারণ স্টুডেন্ট অ্যাকাউন্ট দিয়ে `admin-login.html` বা সরাসরি `admin.html` খুলতে গেলে ব্লক করে `admin-login.html`-এ পাঠিয়ে দিচ্ছে।
- [ ] **Admin Full CRUD:** অ্যাডমিন লগইন করে অন্য ইউজারের Lost এবং Found আইটেম সার্চ, ফিল্টার, Edit, Status Change এবং Delete করতে পারছে এবং পরিবর্তনটি ডাটাবেস ও পাবলিক পেজে প্রতিফলিত হচ্ছে।
- [ ] **Student Protection (RLS):** সাধারণ স্টুডেন্ট DevTools বা API দিয়েও নিজের `role` পরিবর্তন করে `admin` করতে পারছে না এবং অন্য ইউজারের আইটেম Edit/Delete করতে পারছে না।
- [ ] **Lost Item Contact (Normal Visibility):** যেকোনো Lost আইটেমের ডিটেইলস পেজে (`item.html`) গোপন প্রশ্ন ছাড়াই মালিকের ফোন নম্বর ও ইমেইল স্বাভাবিকভাবে দেখাচ্ছে (লগইন ও লগআউট দুই অবস্থাতেই)।
- [ ] **Found Item Secret Verification:** Found আইটেমের ডিটেইলস পেজে ফোন/ইমেইল শুরুতে লুকানো আছে (Network Response-এও `contact_phone: null`, `contact_email: null`); সঠিক উত্তর দিলে কনট্যাক্ট আনলক হচ্ছে এবং ৫ বার ভুল করলে ১৫ মিনিট লকআউট হচ্ছে।
- [ ] **Post Form UX:** `post.html?type=found` ও `post.html?type=lost` লিংক থেকে সঠিক টাইপ অটো-সিলেক্ট হচ্ছে এবং কনট্যাক্ট ফিল্ড প্রি-ফিল হয়ে সেভ হচ্ছে।
- [ ] **Dark/Light Mode & Mobile View:** `admin.html`, `admin-login.html` এবং `item.html` ডার্ক মোড ও মোবাইল স্ক্রিনে ঠিকভাবে দেখাচ্ছে।
