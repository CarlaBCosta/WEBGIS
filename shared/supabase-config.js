// Public Supabase connection info for the browser. The publishable/anon key
// is designed to be exposed client-side - it can only SELECT, and only what
// Row Level Security policies allow (see supabase/schema.sql: public read on
// clients/layer_groups/layers, public Storage bucket for geojson files).
// Never put the secret/service_role key here - that one stays local-only,
// used by scripts/upload-cliente.js to write data.
window.SUPABASE_URL = 'https://stluooawuhwoakxjjqtp.supabase.co';
window.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Zm3nVO-LJ85vbLODty_u-g_uSr3ySAS';
