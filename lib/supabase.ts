import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client for browser use (with user session)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Avoid bundling server-side code in client
export const getServerSupabase = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  console.log("Service key length:", supabaseServiceKey.length); // For debugging
  console.log(
    "Service key starts with:",
    supabaseServiceKey.substring(0, 20) + "..."
  ); // For debugging

  if (!supabaseServiceKey || supabaseServiceKey.length < 50) {
    throw new Error("Invalid service key: Key is missing or too short");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
