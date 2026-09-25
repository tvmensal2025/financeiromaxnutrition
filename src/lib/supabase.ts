import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://wxkgrykduqtsgmjkzlou.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4a2dyeWtkdXF0c2dtamt6bG91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMjk0MjksImV4cCI6MjEwNTcwNTQyOX0.PwIew3FpmSvvt1pnxcqfoyRNleBK8xTwh0K-e6UkO_8";

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
