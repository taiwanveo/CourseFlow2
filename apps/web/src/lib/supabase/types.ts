import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@courseflow/db/types";

export type AppSupabase = SupabaseClient<Database>;
