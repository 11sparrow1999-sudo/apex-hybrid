import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://opxxqutnsgxekymapjl.supabase.co";
const supabaseAnonKey = "sb_publishable_6_pegpKX0FjxnwYYZq10Mg_LC1sdedC";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);