// --- Client configuration template ---
// Copy this whole _template/ folder to clientes/<novo-cliente>/ (the
// novo-cliente.ps1 script does this for you) and edit the values below.
//
// Layer `id`s must match the data files this client's preprocess.js run
// produces: data/<id>.js exporting window.geojsonData_<id>. If you keep
// dataSuffix below, files become data/<id><dataSuffix>.js instead.
window.CLIENT_CONFIG = {
    clientId: 'NOME_DO_CLIENTE_AQUI',      // ex: 'usina-sao-jose' - usado só internamente/log
    clientName: 'Nome do Cliente Aqui',    // aparece no cabeçalho e no título da aba

    // Suffix dos arquivos/variáveis de dados. Deixe '' para clientes novos
    // (arquivos gerados como <id>.js / window.geojsonData_<id>).
    dataSuffix: '',

    // Centro e zoom inicial do mapa (copie as coordenadas da área do cliente)
    mapCenter: [-21.90, -48.67],
    mapZoom: 11,

    // Camada cujos limites definem o zoom inicial automático
    zoomToLayerOnLoad: 'Area_de_Influencias_Direta',

    // Camadas carregadas automaticamente ao abrir o portal (mantenha poucas,
    // só o necessário pro enquadramento inicial - o resto carrega ao clicar)
    defaultActiveLayers: ['Usina_Principal', 'Area_Diretamente_Afetada', 'Area_de_Influencias_Direta', 'Usinas_Vizinhas'],

    // Campos verificados (nessa ordem) pelo filtro de código de fazenda
    farmCodeFields: ['FAZENDA', 'CHAVE_USIN', 'CHAVE_AMB', 'PROPRIEDAD', 'cod_imovel'],

    // Estrutura do painel de camadas. Ajuste/remova grupos e camadas conforme
    // o que esse cliente realmente possui - não precisa manter todos.
    layerGroups: [
        {
            title: 'Empreendimento',
            layers: [
                { id: 'Usina_Principal', label: 'Usina Principal', legendStyle: 'background-color: #E31A1C; border-color: #ffffff;', style: { color: '#E31A1C', fillColor: '#E31A1C', fillOpacity: 0.8, weight: 3 } },
                { id: 'Area_Diretamente_Afetada', label: 'ADA (Área Direta Afetada)', legendStyle: 'background-color: rgba(227, 26, 28, 0.2); border: 2px dashed #E31A1C;', style: { color: '#E31A1C', fillColor: '#E31A1C', fillOpacity: 0.15, weight: 2, dashArray: '6, 6' } },
                { id: 'Area_de_Influencias_Direta', label: 'AID (Área de Influência)', legendStyle: 'background-color: rgba(31, 120, 180, 0.1); border: 2px solid #1F78B4;', style: { color: '#1F78B4', fillColor: '#1F78B4', fillOpacity: 0.08, weight: 3 } },
                { id: 'Usinas_Vizinhas', label: 'Usinas Vizinhas', legendStyle: 'background-color: #FF7F00; border-radius: 50%;', style: { radius: 6, fillColor: '#FF7F00', color: '#fff', weight: 1, fillOpacity: 0.9 } }
            ]
        },
        {
            title: 'Ambiental & Conservação',
            layers: [
                { id: 'Area_de_Preservacao_Permanente', label: 'APP (Preservação Permanente)', legendStyle: 'background-color: rgba(51, 160, 44, 0.4); border-color: #33A02C;', style: { color: '#33A02C', fillColor: '#33A02C', fillOpacity: 0.3, weight: 1.5 } },
                { id: 'Reserva_Legal', label: 'Reserva Legal', legendStyle: 'background-color: rgba(178, 223, 138, 0.4); border-color: #B2DF8A;', style: { color: '#B2DF8A', fillColor: '#B2DF8A', fillOpacity: 0.35, weight: 1.5 } },
                { id: 'Vegetacao_Nativa', label: 'Vegetação Nativa', legendStyle: 'background-color: rgba(51, 160, 44, 0.7); border-color: #1E5618;', style: { color: '#1E5618', fillColor: '#2E8B57', fillOpacity: 0.4, weight: 1.5 } },
                { id: 'UC', label: 'Unidades de Conservação (UC)', legendStyle: 'background-color: rgba(227, 26, 28, 0.3); border: 1px dashed #E31A1C;', style: { color: '#E31A1C', fillColor: '#E31A1C', fillOpacity: 0.1, weight: 1.5, dashArray: '4, 4' } }
            ]
        },
        {
            title: 'Recursos Hídricos',
            layers: [
                { id: 'Corpos_dagua', label: "Corpos d'água", legendStyle: 'background-color: #A6CEE3; border-color: #1F78B4;', style: { color: '#1F78B4', fillColor: '#A6CEE3', fillOpacity: 0.7, weight: 1 } },
                { id: 'Hidrografia', label: 'Canais / Hidrografia', legendStyle: 'border-bottom: 2px solid #1F78B4; background: none; border-radius: 0;', style: { color: '#1F78B4', weight: 2 } }
            ]
        }
    ]
};
