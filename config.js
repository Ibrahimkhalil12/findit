/**
 * FindIt - Lost & Found Portal
 * Global Application Configuration
 *
 * Team: Group 3 | MAWTS Institute of Technology
 * Supervisor: Joy Debnath
 *
 * NOTE: Keep Supabase URL and Anon Key here.
 * NEVER expose the Supabase service_role key or database password in frontend code!
 */

const CONFIG = {
  // Institutional Settings (Easily Configurable)
  INSTITUTION_NAME: 'MAWTS Institute of Technology',
  INSTITUTION_SHORT: 'MAWTS',
  CAMPUS_NAME: 'Main Campus, Mirpur, Dhaka',
  DEPARTMENT: 'Department of Computer Technology',

  // Project Metadata
  PROJECT_NAME: 'FindIt',
  PROJECT_TAGLINE: 'Campus Lost & Found Management Portal',
  SUPERVISOR: 'Joy Debnath',
  TEAM_GROUP: 'Group 3',
  TEAM_MEMBERS: [
    'MD Ibrahim Khalil (Team Leader & Security Engineer)',
    'Adib Akanda (UI/UX Designer)',
    'Konika Tripura (Auth & Forms Developer)',
    'Christopher Mack Dcosta (Search & Filter Developer)',
    'Akash Biswas (Dashboard & Gamification Developer)'
  ],

  // Supabase Configuration
  // Replace these with your actual Supabase Project Settings -> API credentials:
  SUPABASE_URL: 'https://xyzcompany.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder_anon_key',

  // Storage Bucket
  STORAGE_BUCKET_NAME: 'item-images',
  MAX_IMAGE_SIZE_BYTES: 2 * 1024 * 1024, // 2 Megabytes
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],

  // Business Rules
  ARCHIVE_DAYS_THRESHOLD: 30, // Items older than 30 days are automatically archived
  POINTS_PER_RETURN: 50,      // Awarded once to finder upon item reaching 'returned' status
  MAX_VERIFY_ATTEMPTS: 5,     // Anti brute-force threshold

  // Gamification Badges
  BADGE_TIERS: [
    { name: 'Campus Guardian Gold', minPoints: 300, icon: 'shield-check', color: '#f59e0b' },
    { name: 'Silver Returner',      minPoints: 150, icon: 'award',        color: '#94a3b8' },
    { name: 'Campus Helper',        minPoints: 50,  icon: 'star',         color: '#3b82f6' },
    { name: 'Good Citizen',         minPoints: 0,   icon: 'user-check',   color: '#10b981' }
  ],

  // Pagination
  ITEMS_PER_PAGE: 9
};

// Freeze configuration to prevent tampering at runtime
if (typeof Object.freeze === 'function') {
  Object.freeze(CONFIG);
  Object.freeze(CONFIG.TEAM_MEMBERS);
  Object.freeze(CONFIG.BADGE_TIERS);
  Object.freeze(CONFIG.ALLOWED_IMAGE_TYPES);
}
