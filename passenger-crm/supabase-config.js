// Supabase client for vanilla JS (loaded via CDN in HTML)
const SUPABASE_URL = 'https://pgdhuezxkehpjlxoesoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZGh1ZXp4a2VocGpseG9lc29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDcyNTYsImV4cCI6MjA4OTkyMzI1Nn0.qG8kFr2sTuat4vhQ7NikGaXIa57YAT21ABZ8Q8gkRXg';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
