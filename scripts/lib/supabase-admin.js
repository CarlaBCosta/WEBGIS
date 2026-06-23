// Loads .env (SUPABASE_URL, SUPABASE_SECRET_KEY) and returns a Supabase
// client authenticated with the secret/service_role key. This client can
// write data (bypassing Row Level Security) - it must only ever run locally,
// never in browser code. .env is gitignored; see .env.example.
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
    const envPath = path.join(__dirname, '..', '..', '.env');
    if (!fs.existsSync(envPath)) {
        console.error('Arquivo .env não encontrado na raiz do projeto.');
        console.error('Copie .env.example para .env e preencha SUPABASE_URL e SUPABASE_SECRET_KEY.');
        process.exit(1);
    }
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = (match[2] || '').trim();
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            process.env[key] = value;
        }
    });
}

function getAdminClient() {
    loadEnv();
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) {
        console.error('SUPABASE_URL ou SUPABASE_SECRET_KEY ausentes no .env');
        process.exit(1);
    }
    return createClient(url, key);
}

module.exports = { getAdminClient };
