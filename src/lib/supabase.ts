import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://wxkgrykduqtsgmjkzlou.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_luxpvy-rsEFpxANjNiU07g_V5xg6FDF";

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(url, key, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

export const supabaseUrl = url;
