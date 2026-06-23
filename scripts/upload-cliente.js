// Publica/atualiza um cliente no Supabase: upserta a configuração (a partir
// de cliente-configs/<slug>.json) nas tabelas clients/layer_groups/layers, e
// sobe cada .geojson de processed/<slug>/ (gerado por preprocess.js) para o
// bucket de Storage "client-data". O código do portal nunca muda - só dados.
//
// Uso: node scripts/upload-cliente.js <slug>
const fs = require('fs');
const path = require('path');
const { getAdminClient } = require('./lib/supabase-admin');

const slug = process.argv[2];
if (!slug) {
    console.error('Uso: node scripts/upload-cliente.js <slug>');
    process.exit(1);
}

const configPath = path.join(__dirname, '..', 'cliente-configs', `${slug}.json`);
if (!fs.existsSync(configPath)) {
    console.error(`Config não encontrada: ${configPath}`);
    console.error('Copie cliente-configs/_template.json e ajuste antes de publicar.');
    process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const dataDir = path.join(__dirname, '..', 'processed', slug);

async function upsertConfig(supabase) {
    console.log(`Publicando configuração de "${slug}"...`);

    const { data: client, error: clientErr } = await supabase
        .from('clients')
        .upsert({
            slug: config.slug,
            name: config.name,
            map_center_lat: config.mapCenter[0],
            map_center_lng: config.mapCenter[1],
            map_zoom: config.mapZoom,
            zoom_to_layer: config.zoomToLayer,
            farm_code_fields: config.farmCodeFields
        }, { onConflict: 'slug' })
        .select()
        .single();
    if (clientErr) throw clientErr;

    for (let i = 0; i < config.layerGroups.length; i++) {
        const group = config.layerGroups[i];

        const { data: groupRow, error: groupErr } = await supabase
            .from('layer_groups')
            .upsert({ client_id: client.id, title: group.title, sort_order: i }, { onConflict: 'client_id,title' })
            .select()
            .single();
        // layer_groups has no unique(client_id,title) constraint by default;
        // fall back to insert-if-missing when upsert's onConflict target doesn't exist.
        let groupId = groupRow && groupRow.id;
        if (groupErr) {
            const { data: existing } = await supabase
                .from('layer_groups')
                .select('id')
                .eq('client_id', client.id)
                .eq('title', group.title)
                .maybeSingle();
            if (existing) {
                groupId = existing.id;
                await supabase.from('layer_groups').update({ sort_order: i }).eq('id', groupId);
            } else {
                const { data: inserted, error: insertErr } = await supabase
                    .from('layer_groups')
                    .insert({ client_id: client.id, title: group.title, sort_order: i })
                    .select()
                    .single();
                if (insertErr) throw insertErr;
                groupId = inserted.id;
            }
        }

        for (let j = 0; j < group.layers.length; j++) {
            const layer = group.layers[j];
            const { error: layerErr } = await supabase
                .from('layers')
                .upsert({
                    client_id: client.id,
                    group_id: groupId,
                    layer_key: layer.layerKey,
                    label: layer.label,
                    legend_style: layer.legendStyle || '',
                    style: layer.style || {},
                    default_active: !!layer.defaultActive,
                    sort_order: j
                }, { onConflict: 'client_id,layer_key' });
            if (layerErr) throw layerErr;
        }
    }

    console.log('Configuração publicada.');
    return client;
}

async function uploadGeojsonFiles(supabase) {
    if (!fs.existsSync(dataDir)) {
        console.log(`Nenhuma pasta processed/${slug}/ encontrada - pulando upload de dados.`);
        console.log(`(Rode "node preprocess.js ${slug}" primeiro se você exportou camadas novas do QGIS.)`);
        return;
    }

    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.geojson'));
    console.log(`Subindo ${files.length} arquivo(s) de processed/${slug}/ para o Storage...`);

    for (const file of files) {
        const filePath = path.join(dataDir, file);
        const fileBuffer = fs.readFileSync(filePath);
        const storagePath = `${slug}/${file}`;

        const { error } = await supabase.storage
            .from('client-data')
            .upload(storagePath, fileBuffer, { contentType: 'application/geo+json', upsert: true });

        if (error) {
            console.error(`  Falha ao subir ${file}:`, error.message);
        } else {
            console.log(`  OK: ${file} (${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
        }
    }
}

async function main() {
    const supabase = getAdminClient();
    await upsertConfig(supabase);
    await uploadGeojsonFiles(supabase);

    console.log('');
    console.log('Publicado! Link do cliente:');
    console.log(`  https://<seu-projeto>.vercel.app/cliente/${slug}/`);
}

main().catch(err => {
    console.error('Erro:', err.message || err);
    process.exit(1);
});
