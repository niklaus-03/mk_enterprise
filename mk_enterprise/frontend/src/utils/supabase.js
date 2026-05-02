import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ttlxqwiipfeqbfytgqmz.supabase.co';      // from Project Settings → API
const supabaseKey = 'sb_publishable_JgZ2h3qNSKYfKfOcVBiwuA_wJIgH5g8';  // from Project Settings → API

export const supabase = createClient(supabaseUrl, supabaseKey); 