// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xoipxsjakrlzujcvccim.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvaXB4c2pha3JsenVqY3ZjY2ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1NDcxMzgsImV4cCI6MjA2MjEyMzEzOH0.7B2havQdN7nhNjYFu1A4GM8FaIu2eqaTLn82RcHU0ag'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
