// --- Client configuration: cliente-demo ---
// Edit this file to customize a client's portal: name, map position, default
// layers and the layer panel structure. Layer geometry/data itself lives in
// ./data/<id>_teste.js (exported from QGIS via preprocess.js).
window.CLIENT_CONFIG = {
    clientId: 'cliente-demo',
    clientName: 'Cliente Demo',

    // Initial map view
    mapCenter: [-21.90, -48.67],
    mapZoom: 11,

    // Layer whose bounds the map zooms to once layers finish loading
    zoomToLayerOnLoad: 'Area_de_Influencias_Direta',

    // Layers fetched and shown immediately on page load (kept small: just
    // the study-area boundaries needed for the initial zoom). Everything
    // else loads on demand when the user toggles it on.
    defaultActiveLayers: ['Usina_Principal', 'Area_Diretamente_Afetada', 'Area_de_Influencias_Direta', 'Usinas_Vizinhas'],

    // Properties checked (in order) when filtering features by farm/property code
    farmCodeFields: ['FAZENDA', 'CHAVE_USIN', 'CHAVE_AMB', 'PROPRIEDAD', 'cod_imovel'],

    // Panel groups, in display order. Each layer's `id` must match the data
    // file `data/<id>_teste.js` and its `window.geojsonData_<id>_teste` global.
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
                { id: 'Turfeiras', label: 'Turfeiras (Áreas Úmidas)', legendStyle: 'background-color: rgba(166, 97, 26, 0.5); border-color: #A6611A;', style: { color: '#A6611A', fillColor: '#A6611A', fillOpacity: 0.4, weight: 1.5 } },
                { id: 'UC', label: 'Unidades de Conservação (UC)', legendStyle: 'background-color: rgba(227, 26, 28, 0.3); border: 1px dashed #E31A1C;', style: { color: '#E31A1C', fillColor: '#E31A1C', fillOpacity: 0.1, weight: 1.5, dashArray: '4, 4' } },
                { id: 'RAMSAR', label: 'Sítios RAMSAR', legendStyle: 'background-color: rgba(1, 102, 94, 0.4); border-color: #01665E;', style: { color: '#01665E', fillColor: '#01665E', fillOpacity: 0.3, weight: 1.5 } },
                { id: 'Birdlife', label: 'Áreas Importantes de Aves', legendStyle: 'background-color: rgba(253, 191, 111, 0.4); border-color: #FDBF6F;', style: { color: '#FDBF6F', fillColor: '#FDBF6F', fillOpacity: 0.3, weight: 1.5 } }
            ]
        },
        {
            title: 'Recursos Hídricos',
            layers: [
                { id: 'Corpos_dagua', label: "Corpos d'água", legendStyle: 'background-color: #A6CEE3; border-color: #1F78B4;', style: { color: '#1F78B4', fillColor: '#A6CEE3', fillOpacity: 0.7, weight: 1 } },
                { id: 'Hidrografia', label: 'Canais / Hidrografia', legendStyle: 'border-bottom: 2px solid #1F78B4; background: none; border-radius: 0;', style: { color: '#1F78B4', weight: 2 } },
                { id: 'Sub_bacias', label: 'Sub-bacias', legendStyle: 'background-color: rgba(202, 178, 214, 0.3); border-color: #CAB2D6;', style: { color: '#CAB2D6', fillColor: '#CAB2D6', fillOpacity: 0.2, weight: 1.5 } },
                { id: 'Outorgas_Superficiais', label: 'Outorgas Superficiais', legendStyle: 'background-color: #00BFFF; border-radius: 50%;', style: { radius: 5, fillColor: '#00BFFF', color: '#fff', weight: 1, fillOpacity: 0.8 } },
                { id: 'Outorgas_Subterraneas', label: 'Outorgas Subterrâneas', legendStyle: 'background-color: #8A2BE2; border-radius: 50%;', style: { radius: 5, fillColor: '#8A2BE2', color: '#fff', weight: 1, fillOpacity: 0.8 } }
            ]
        },
        {
            title: 'Socioambiental & Cultural',
            layers: [
                { id: 'Assentamentos_Rurais', label: 'Assentamentos Rurais', legendStyle: 'background-color: rgba(251, 154, 153, 0.4); border-color: #FB9A99;', style: { color: '#FB9A99', fillColor: '#FB9A99', fillOpacity: 0.3, weight: 1.5 } },
                { id: 'Areas_Quilombolas', label: 'Áreas Quilombolas', legendStyle: 'background-color: rgba(227, 26, 28, 0.4); border-color: #E31A1C;', style: { color: '#E31A1C', fillColor: '#E31A1C', fillOpacity: 0.25, weight: 1.5 } },
                { id: 'Terras_Indigenas', label: 'Terras Indígenas', legendStyle: 'background-color: rgba(255, 127, 0, 0.4); border-color: #FF7F00;', style: { color: '#FF7F00', fillColor: '#FF7F00', fillOpacity: 0.3, weight: 1.5 } },
                { id: 'Patrimonio_Cultural', label: 'Patrimônio Cultural', legendStyle: 'background-color: #FFD700; border-radius: 50%;', style: { radius: 6, fillColor: '#FFD700', color: '#222', weight: 1.5, fillOpacity: 0.9 } },
                { id: 'Sitios_Arqueologicos', label: 'Sítios Arqueológicos', legendStyle: 'background-color: #FF4500; border-radius: 50%;', style: { radius: 6, fillColor: '#FF4500', color: '#fff', weight: 1, fillOpacity: 0.9 } }
            ]
        },
        {
            title: 'Solo & Outros',
            layers: [
                { id: 'Erodibilidade', label: 'Erodibilidade do Solo', legendStyle: 'background-color: rgba(177, 89, 40, 0.4); border-color: #B15928;', style: { color: '#B15928', fillColor: '#B15928', fillOpacity: 0.3, weight: 1.5 } },
                { id: 'BAZE', label: 'Limite Bacia (BAZE)', legendStyle: 'background-color: rgba(150, 150, 150, 0.2); border: 1px solid #969696;', style: { color: '#969696', weight: 2 } }
            ]
        }
    ]
};
