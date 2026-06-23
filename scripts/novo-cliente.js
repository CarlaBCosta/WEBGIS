// Cria a config de um novo cliente a partir do template e já publica a
// estrutura (sem dados ainda) no Supabase, gerando o link do cliente.
// Uso: node scripts/novo-cliente.js "Nome do Cliente"
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const nome = process.argv[2];
if (!nome) {
    console.error('Uso: node scripts/novo-cliente.js "Nome do Cliente"');
    process.exit(1);
}

function semAcentos(str) {
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const slug = semAcentos(nome).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const configsDir = path.join(__dirname, '..', 'cliente-configs');
const destPath = path.join(configsDir, `${slug}.json`);

if (fs.existsSync(destPath)) {
    console.error(`Já existe cliente-configs/${slug}.json. Edite-o diretamente ou escolha outro nome.`);
    process.exit(1);
}

const template = JSON.parse(fs.readFileSync(path.join(configsDir, '_template.json'), 'utf8'));
delete template._comentario;
template.slug = slug;
template.name = nome;

fs.writeFileSync(destPath, JSON.stringify(template, null, 4), 'utf8');
console.log(`Criado: cliente-configs/${slug}.json`);
console.log('Edite esse arquivo (centro do mapa, camadas) se necessário antes de publicar.');
console.log('');
console.log(`Pasta para exportar os .geojson do QGIS deste cliente:`);
console.log(`  C:\\Users\\carla.dalpian\\OneDrive - sigmagis.com.br\\Documentos\\Claude\\Projects\\8_WEBPORTAL\\GEOJSON\\${slug}\\`);
console.log('');
console.log('Publicando estrutura no Supabase (ainda sem dados de camadas)...');

try {
    execFileSync('node', [path.join(__dirname, 'upload-cliente.js'), slug], { stdio: 'inherit' });
} catch (err) {
    console.error('Falha ao publicar. Rode manualmente depois: node scripts/upload-cliente.js ' + slug);
    process.exit(1);
}
