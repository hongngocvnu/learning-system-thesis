// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://xoipxsjakrlzujcvccim.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvaXB4c2pha3JsenVqY3ZjY2ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1NDcxMzgsImV4cCI6MjA2MjEyMzEzOH0.7B2havQdN7nhNjYFu1A4GM8FaIu2eqaTLn82RcHU0ag';
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
    global: {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Client-Info': 'supabase-js/2.39.0',
            'Prefer': 'return=minimal',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
        },
    },
    db: {
        schema: 'public',
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
});
