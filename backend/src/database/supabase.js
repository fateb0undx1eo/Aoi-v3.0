import { createClient } from '@supabase/supabase-js';
import { env } from '../core/config/env.js';

export const supabase = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
  auth: {
    persistSession: false
  }
});
