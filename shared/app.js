// --- WebGIS Portal Main JavaScript - AMBIUM Digital ---
// One fixed codebase for every client. Client identity comes from the URL
// (/cliente/<slug>/), and all client-specific data (map view, layer list,
// styles, and the GeoJSON itself) is fetched at runtime from Supabase:
// Postgres tables (clients/layer_groups/layers) for config, Storage for the
// .geojson files. Publishing a new client or updating a layer never touches
// this file or requires a redeploy - see scripts/upload-cliente.js.

// Global variables
let map;
let activeSatelliteYear = '2026';
let activeLayers = {};
let measurementMode = null; // 'dist' or 'area' or null
let measureLayerGroup;
let measurePoints = [];
let measureTooltip;
let highlightLayer = null;
let currentFarmFilter = '';

// Populated by loadClientConfig() before anything else runs
let CONFIG = null;
let DEFAULT_ACTIVE_LAYERS = [];
let FARM_CODE_FIELDS = ['FAZENDA', 'CHAVE_USIN', 'CHAVE_AMB', 'PROPRIEDAD', 'cod_imovel'];
let styleConfig = {};

// Cache of parsed GeoJSON per layer, fetched lazily on first activation
const loadedLayerData = {};
const layerLoadPromises = {};

// Client slug comes from the URL path: /cliente/<slug>/...
function getClientSlugFromUrl() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('cliente');
    return idx !== -1 ? parts[idx + 1] : null;
}

// Fetch this client's config + layer panel structure from Supabase Postgres
// (via PostgREST) using the public, RLS-restricted publishable key.
async function loadClientConfig(slug) {
    const headers = {
        apikey: window.SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${window.SUPABASE_PUBLISHABLE_KEY}`
    };
    const base = window.SUPABASE_URL;

    const clientRes = await fetch(`${base}/rest/v1/clients?slug=eq.${encodeURIComponent(slug)}&select=*`, { headers });
    if (!clientRes.ok) throw new Error(`Falha ao buscar cliente (HTTP ${clientRes.status})`);
    const clients = await clientRes.json();
    if (clients.length === 0) throw new Error(`Cliente "${slug}" não encontrado.`);
    const client = clients[0];

    const groupsRes = await fetch(`${base}/rest/v1/layer_groups?client_id=eq.${client.id}&select=*,layers(*)&order=sort_order.asc`, { headers });
    if (!groupsRes.ok) throw new Error(`Falha ao buscar camadas (HTTP ${groupsRes.status})`);
    const groups = await groupsRes.json();

    groups.forEach(g => g.layers.sort((a, b) => a.sort_order - b.sort_order));

    return {
        slug,
        clientName: client.name,
        mapCenter: [client.map_center_lat, client.map_center_lng],
        mapZoom: client.map_zoom,
        zoomToLayerOnLoad: client.zoom_to_layer,
        farmCodeFields: client.farm_code_fields,
        layerGroups: groups.map(g => ({
            title: g.title,
            layers: g.layers.map(l => ({
                id: l.layer_key,
                label: l.label,
                legendStyle: l.legend_style,
                style: l.style,
                defaultActive: l.default_active
            }))
        }))
    };
}

// Build the "Camadas do Projeto" panel markup from CONFIG.layerGroups
function renderLayerPanel() {
    const container = document.getElementById('panel-content');
    if (!container) return;

    container.innerHTML = (CONFIG.layerGroups || []).map(group => `
        <div class="layer-group">
            <div class="group-title">${group.title}</div>
            ${(group.layers || []).map(layer => {
                const isDefault = DEFAULT_ACTIVE_LAYERS.includes(layer.id);
                return `
                <div class="layer-item${isDefault ? ' active' : ''}" onclick="toggleLayer('${layer.id}')">
                    <div class="layer-label">
                        <span class="layer-legend-icon" style="${layer.legendStyle || ''}"></span>
                        ${layer.label}
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="chk_${layer.id}" ${isDefault ? 'checked' : ''} onclick="event.stopPropagation(); toggleLayer('${layer.id}')">
                        <span class="slider"></span>
                    </label>
                </div>`;
            }).join('')}
        </div>
    `).join('');
}

// Initialize the portal once the DOM is loaded: resolve the client from the
// URL, fetch its config from Supabase, then build the map and panel.
window.addEventListener('DOMContentLoaded', async () => {
    const loading = document.getElementById('loading');
    const slug = getClientSlugFromUrl();

    if (!slug) {
        showLanding();
        return;
    }

    try {
        CONFIG = await loadClientConfig(slug);
    } catch (err) {
        console.error('Erro ao carregar configuração do cliente:', err);
        showLanding(`Não foi possível carregar o portal de "${slug}". ${err.message}`);
        return;
    }

    DEFAULT_ACTIVE_LAYERS = [];
    FARM_CODE_FIELDS = CONFIG.farmCodeFields || FARM_CODE_FIELDS;
    styleConfig = {};
    CONFIG.layerGroups.forEach(group => {
        group.layers.forEach(layer => {
            styleConfig[layer.id] = layer.style || { color: '#3388ff', weight: 2 };
            if (layer.defaultActive) DEFAULT_ACTIVE_LAYERS.push(layer.id);
        });
    });

    if (CONFIG.clientName) {
        document.title = `Portal WebGIS - ${CONFIG.clientName} | AMBIUM Digital`;
        const nameEl = document.getElementById('client-name');
        if (nameEl) nameEl.textContent = CONFIG.clientName;
    }

    renderLayerPanel();
    initMap();
    await initDefaultLayers();
    zoomToStudyArea();

    // Hide loading screen
    if (loading) {
        loading.style.opacity = '0';
        setTimeout(() => loading.style.display = 'none', 400);
    }
});

// No valid /cliente/<slug>/ in the URL (or that client failed to load):
// hide the map UI and show the landing screen instead.
function showLanding(errorMessage) {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';

    document.querySelector('header').style.display = 'none';
    document.querySelector('.map-wrapper').style.display = 'none';

    const landing = document.getElementById('landing');
    if (landing) {
        landing.style.display = 'flex';
        if (errorMessage) {
            const p = document.createElement('p');
            p.style.color = '#E31A1C';
            p.textContent = errorMessage;
            landing.appendChild(p);
        }
    }
}

function initMap() {
    // Center at general region of interest
    map = L.map('map', {
        zoomControl: true,
        attributionControl: true,
        // Canvas rendering is much faster than the default SVG renderer when
        // toggling layers with thousands of features (no per-feature DOM nodes
        // to create/destroy on add/remove), which was the cause of the lag
        // when switching layers on/off.
        preferCanvas: true
    }).setView(CONFIG.mapCenter || [-21.90, -48.67], CONFIG.mapZoom || 11);

    // Add scale bar
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    // Initialize satellite layers
    window.satelliteLayers = {
        '2026': L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            attribution: 'Google Satellite 2026'
        }),
        '2021': L.tileLayer('https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/26120/{z}/{y}/{x}', {
            maxZoom: 20,
            attribution: 'Esri Wayback (2021-12-21)'
        }),
        '2014': L.tileLayer('https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/10/{z}/{y}/{x}', {
            maxZoom: 20,
            attribution: 'Esri Wayback (2014-02-20)'
        }),
        '2008': L.layerGroup([
            L.tileLayer('https://gibs-b.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2008-07-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', {
                maxZoom: 9,
                attribution: 'NASA GIBS (MODIS 2008)'
            }),
            L.tileLayer('https://gibs-c.earthdata.nasa.gov/wmts/epsg3857/best/Landsat_WELD_Global_Annual_TrueColor/default/2008-01-01/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg', {
                minZoom: 9,
                maxZoom: 13,
                attribution: 'NASA GIBS (Landsat 7 2008)'
            })
        ])
    };

    // Activate default satellite (2026)
    window.satelliteLayers['2026'].addTo(map);

    // Layer group for measurements
    measureLayerGroup = L.layerGroup().addTo(map);

    // Click handler for map to support measurements and deselecting
    map.on('click', onMapClick);
}

// Fetch a layer's GeoJSON from the public Supabase Storage bucket on demand.
// Files live at client-data/<slug>/<layer_key>.geojson (uploaded by
// scripts/upload-cliente.js). This is a real HTTPS endpoint with proper CORS
// headers, so a plain fetch() works fine here (unlike loading the portal
// directly via file://, which is what caused the old "Não foi possível
// carregar a camada" errors when data lived as local script-tag files).
function loadLayerData(name) {
    if (loadedLayerData[name]) return Promise.resolve(loadedLayerData[name]);
    if (layerLoadPromises[name]) return layerLoadPromises[name];

    const url = `${window.SUPABASE_URL}/storage/v1/object/public/client-data/${CONFIG.slug}/${name}.geojson`;

    layerLoadPromises[name] = fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        })
        .then(data => {
            loadedLayerData[name] = data;
            return data;
        })
        .finally(() => {
            delete layerLoadPromises[name];
        });

    return layerLoadPromises[name];
}

// Build the styled Leaflet GeoJSON layer for a given data set
function buildLayer(name, data) {
    const config = styleConfig[name] || { color: '#3388ff', weight: 2 };

    return L.geoJSON(data, {
        style: (feature) => ({
            color: config.color,
            fillColor: config.fillColor || config.color,
            fillOpacity: config.fillOpacity !== undefined ? config.fillOpacity : 0.2,
            weight: config.weight || 2,
            dashArray: config.dashArray || null
        }),
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
            radius: config.radius || 6,
            fillColor: config.fillColor || '#3388ff',
            color: config.color || '#fff',
            weight: config.weight || 1,
            opacity: 1,
            fillOpacity: config.fillOpacity || 0.8
        }),
        onEachFeature: (feature, layer) => {
            // Remember the original fillOpacity so the farm filter can restore it later
            layer._baseFillOpacity = layer.options.fillOpacity;
            layer.on({
                click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    showFeatureInfo(feature, name, layer);
                }
            });
        }
    });
}

function disableLayerUI(name) {
    console.warn(`Layer ${name} data not found or is empty.`);
    const chk = document.getElementById(`chk_${name}`);
    if (chk) {
        chk.disabled = true;
        chk.checked = false;
        const item = chk.closest('.layer-item');
        if (item) {
            item.style.opacity = '0.5';
            item.style.pointerEvents = 'none';
            item.classList.remove('active', 'loading');
        }
    }
}

function setLayerLoadingUI(name, isLoading) {
    const chk = document.getElementById(`chk_${name}`);
    const item = chk && chk.closest('.layer-item');
    if (item) item.classList.toggle('loading', isLoading);
}

// Load and activate the layers that are checked by default on first paint
// (kept eager because the study area bounds depend on them).
async function initDefaultLayers() {
    await Promise.all(DEFAULT_ACTIVE_LAYERS.map(async (name) => {
        setLayerLoadingUI(name, true);
        try {
            const data = await loadLayerData(name);
            if (!data || !data.features || data.features.length === 0) {
                disableLayerUI(name);
                return;
            }
            activeLayers[name] = buildLayer(name, data);
            activeLayers[name].addTo(map);
        } catch (err) {
            console.error(`Erro ao carregar camada ${name}:`, err);
            disableLayerUI(name);
        } finally {
            setLayerLoadingUI(name, false);
        }
    }));
}

// Toggle layer visibility, fetching the layer's data the first time it is activated
async function toggleLayer(name) {
    const chk = document.getElementById(`chk_${name}`);
    const item = chk && chk.closest('.layer-item');

    // Already built: just show/hide on the map (fast path, no network)
    if (activeLayers[name]) {
        if (map.hasLayer(activeLayers[name])) {
            map.removeLayer(activeLayers[name]);
            if (chk) chk.checked = false;
            if (item) item.classList.remove('active');

            if (highlightLayer) {
                map.removeLayer(highlightLayer);
                highlightLayer = null;
                closeInfoPanel();
            }
        } else {
            activeLayers[name].addTo(map);
            if (chk) chk.checked = true;
            if (item) item.classList.add('active');
            if (currentFarmFilter) applyFilterToLayer(name);
        }
        return;
    }

    // First activation: fetch the data on demand
    setLayerLoadingUI(name, true);
    try {
        const data = await loadLayerData(name);
        if (!data || !data.features || data.features.length === 0) {
            disableLayerUI(name);
            return;
        }
        activeLayers[name] = buildLayer(name, data);
        activeLayers[name].addTo(map);
        if (chk) chk.checked = true;
        if (item) item.classList.add('active');
        if (currentFarmFilter) applyFilterToLayer(name);
    } catch (err) {
        console.error(`Erro ao carregar camada ${name}:`, err);
        if (chk) chk.checked = false;
        alert(`Não foi possível carregar a camada "${name.replace(/_/g, ' ')}". Tente novamente.`);
    } finally {
        setLayerLoadingUI(name, false);
    }
}

// --- Farm code filter ---
// Highlights/dims features across all currently loaded layers whose property
// matches one of FARM_CODE_FIELDS, and zooms to the matching extent.
function applyFarmFilter() {
    const input = document.getElementById('farm-filter-input');
    const code = (input.value || '').trim();
    const statusEl = document.getElementById('farm-filter-status');

    if (!code) {
        clearFarmFilter();
        return;
    }

    currentFarmFilter = code;
    let matchCount = 0;
    const matchedBounds = [];

    Object.keys(activeLayers).forEach(name => {
        const result = applyFilterToLayer(name);
        matchCount += result.matchCount;
        if (result.bounds) matchedBounds.push(result.bounds);
    });

    if (matchCount === 0) {
        statusEl.textContent = `Nenhuma feição encontrada para o código "${code}" nas camadas ativas. Ative outras camadas e tente novamente.`;
        statusEl.classList.add('active');
        return;
    }

    statusEl.textContent = `${matchCount} feição(ões) encontrada(s) para o código "${code}".`;
    statusEl.classList.add('active');

    if (matchedBounds.length > 0) {
        let bounds = matchedBounds[0];
        for (let i = 1; i < matchedBounds.length; i++) bounds.extend(matchedBounds[i]);
        map.fitBounds(bounds, { padding: [40, 40] });
    }
}

// Re-applies the current filter to a single layer (used on filter, and when a
// layer is toggled on after a filter is already active). Returns match info.
function applyFilterToLayer(name) {
    const layer = activeLayers[name];
    let matchCount = 0;
    let bounds = null;

    if (!layer) return { matchCount, bounds };

    layer.eachLayer(featureLayer => {
        const props = featureLayer.feature ? featureLayer.feature.properties : null;
        const isMatch = !currentFarmFilter || featureMatchesFarmCode(props, currentFarmFilter);

        if (featureLayer.setStyle) {
            const baseFillOpacity = featureLayer._baseFillOpacity !== undefined ? featureLayer._baseFillOpacity : 0.2;
            featureLayer.setStyle({
                opacity: isMatch ? 1 : 0.05,
                fillOpacity: isMatch ? baseFillOpacity : 0.03
            });
        }

        if (isMatch && currentFarmFilter) {
            matchCount++;
            if (featureLayer.getBounds) {
                bounds = bounds ? bounds.extend(featureLayer.getBounds()) : L.latLngBounds(featureLayer.getBounds());
            } else if (featureLayer.getLatLng) {
                const ll = featureLayer.getLatLng();
                bounds = bounds ? bounds.extend(ll) : L.latLngBounds(ll, ll);
            }
        }
    });

    return { matchCount, bounds };
}

function featureMatchesFarmCode(properties, code) {
    if (!properties) return false;
    const needle = code.toLowerCase();
    return FARM_CODE_FIELDS.some(field => {
        const value = properties[field];
        return value !== undefined && value !== null && String(value).toLowerCase().includes(needle);
    });
}

function clearFarmFilter() {
    currentFarmFilter = '';
    document.getElementById('farm-filter-input').value = '';
    const statusEl = document.getElementById('farm-filter-status');
    statusEl.textContent = '';
    statusEl.classList.remove('active');

    Object.keys(activeLayers).forEach(name => {
        const layer = activeLayers[name];
        layer.eachLayer(featureLayer => {
            if (featureLayer.setStyle) {
                featureLayer.setStyle({
                    opacity: 1,
                    fillOpacity: featureLayer._baseFillOpacity !== undefined ? featureLayer._baseFillOpacity : 0.2
                });
            }
        });
    });
}

// Time Machine Slider logic
function setSatelliteYear(year) {
    if (activeSatelliteYear === year) return;

    // Toggle button active class
    const buttons = document.querySelectorAll('.timeline-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    document.getElementById(`time-${year}`).classList.add('active');

    // Remove active satellite layer
    map.removeLayer(window.satelliteLayers[activeSatelliteYear]);

    // Add new satellite layer
    window.satelliteLayers[year].addTo(map);
    activeSatelliteYear = year;
}

// Zoom to client's study area, as configured by zoomToLayerOnLoad
function zoomToStudyArea() {
    const target = CONFIG.zoomToLayerOnLoad;
    if (target && activeLayers[target]) {
        map.fitBounds(activeLayers[target].getBounds(), { padding: [40, 40] });
    }
}

// Custom display names for raw GeoJSON properties
const propertyDisplayNames = {
    // General
    id: 'ID',
    nome: 'Nome',
    sigla: 'Sigla',
    municipio: 'Município',
    estado: 'Estado',
    area_ha: 'Área (ha)',
    perimetro_m: 'Perímetro (m)',
    identifica: 'Nome/Identificação',
    // Usina / ADA
    usina: 'Nome da Usina',
    capacidade: 'Capacidade (MW)',
    potencia: 'Potência Inst.',
    status: 'Status',
    empresa: 'Empresa',
    // Outorgas
    vazao_m3h: 'Vazão (m³/h)',
    tipo_uso: 'Tipo de Uso',
    finalidade: 'Finalidade',
    tipo_outorga: 'Tipo de Outorga',
    num_outorga: 'Número da Outorga',
    validad: 'Validade',
    processo: 'Nº Processo',
    substancia: 'Substância',
    // IPHAN/Heritage
    id_bem: 'Código do Bem',
    co_iphan: 'Nº Registro IPHAN',
    ds_naturez: 'Natureza do Bem',
    ds_classif: 'Classificação',
    ds_tipo_be: 'Tipo de Bem',
    sintese_be: 'Descrição Resumida',
    dt_cadastr: 'Data Cadastro',
    // Environmental
    tipo_app: 'Tipo de APP',
    tipo_veg: 'Fisionomia Vegetal',
    estagio_suc: 'Estágio Sucessório',
    supressao: 'Autoriz. Supressão',
    erodibilid: 'Classe de Erodibilidade',
    // General categories
    nome_uc: 'Nome da UC',
    grupo_uc: 'Grupo da UC',
    categoria: 'Categoria da UC',
    esfera: 'Esfera Administrativa'
};

function formatLabel(key) {
    return propertyDisplayNames[key.toLowerCase()] || key;
}

// Display feature details in right panel
function showFeatureInfo(feature, layerName, layer) {
    const infoPanel = document.getElementById('info-panel');
    const infoPanelBody = document.getElementById('info-panel-body');

    // Remove previous highlight
    if (highlightLayer) {
        map.removeLayer(highlightLayer);
    }

    // Highlight clicked feature
    if (feature.geometry.type === 'Point' || feature.geometry.type === 'MultiPoint') {
        const coords = feature.geometry.coordinates;
        highlightLayer = L.circleMarker([coords[1], coords[0]], {
            radius: 9,
            color: '#fff',
            fillColor: '#9ACD32',
            fillOpacity: 0.5,
            weight: 3,
            pane: 'markerPane'
        }).addTo(map);
    } else {
        highlightLayer = L.geoJSON(feature, {
            style: {
                color: '#fff',
                fillColor: '#9ACD32',
                fillOpacity: 0.35,
                weight: 3
            }
        }).addTo(map);
    }

    // Build attributes table
    let tableContent = `<div class="info-title">${layerName.replace(/_/g, ' ')}</div>`;
    tableContent += '<table class="info-table">';

    let hasProps = false;
    for (const key in feature.properties) {
        const value = feature.properties[key];
        // Skip technical or long empty fields
        if (key.startsWith('_') || value === null || value === undefined || value === "") continue;
        
        hasProps = true;
        const formattedLabel = formatLabel(key);
        tableContent += `
            <tr>
                <td class="label">${formattedLabel}</td>
                <td class="value">${value}</td>
            </tr>
        `;
    }

    if (!hasProps) {
        tableContent += '<tr><td colspan="2" style="color: var(--text-muted);">Nenhuma propriedade disponível.</td></tr>';
    }
    
    tableContent += '</table>';
    infoPanelBody.innerHTML = tableContent;

    // Slide in info panel
    infoPanel.classList.add('visible');
}

function closeInfoPanel() {
    document.getElementById('info-panel').classList.remove('visible');
    if (highlightLayer) {
        map.removeLayer(highlightLayer);
        highlightLayer = null;
    }
}

function onMapClick(e) {
    if (measurementMode) {
        handleMeasureClick(e);
        return;
    }
    
    // If not in measure mode, clicking blank map closes details
    closeInfoPanel();
}

// --- Custom Measurement Tools Logic ---

function toggleMeasure(mode) {
    if (measurementMode === mode) {
        // Turn off
        clearMeasurements();
        measurementMode = null;
        deactivateMeasureButtons();
    } else {
        clearMeasurements();
        measurementMode = mode;
        deactivateMeasureButtons();
        
        document.getElementById(`btn-measure-${mode}`).classList.add('active');
        map.getContainer().style.cursor = 'crosshair';
        
        // Show tooltip prompt
        showMeasureTooltip(map.getCenter(), "Clique no mapa para iniciar a medição.");
    }
}

function deactivateMeasureButtons() {
    document.getElementById('btn-measure-dist').classList.remove('active');
    document.getElementById('btn-measure-area').classList.remove('active');
    map.getContainer().style.cursor = '';
}

function clearMeasurements() {
    measureLayerGroup.clearLayers();
    measurePoints = [];
    if (measureTooltip) {
        map.removeLayer(measureTooltip);
        measureTooltip = null;
    }
    map.off('mousemove', handleMeasureMouseMove);
}

function showMeasureTooltip(latlng, text) {
    if (!measureTooltip) {
        measureTooltip = L.tooltip({
            permanent: true,
            className: 'measure-tooltip',
            offset: [15, 0],
            direction: 'right'
        });
    }
    measureTooltip.setLatLng(latlng).setContent(text).addTo(map);
}

function handleMeasureClick(e) {
    const latlng = e.latlng;
    measurePoints.push(latlng);

    // Draw marker at point
    L.circleMarker(latlng, {
        radius: 5,
        color: '#222',
        fillColor: '#9ACD32',
        fillOpacity: 1,
        weight: 1.5
    }).addTo(measureLayerGroup);

    if (measurePoints.length === 1) {
        // Start listening to mouse move for preview line
        map.on('mousemove', handleMeasureMouseMove);
    } else {
        // Redraw permanent lines/polygons
        redrawMeasureLayer();
    }
}

function handleMeasureMouseMove(e) {
    if (measurePoints.length === 0) return;
    
    const tempPoints = [...measurePoints, e.latlng];
    let displayText = "";

    if (measurementMode === 'dist') {
        const totalDist = calculateDistance(tempPoints);
        displayText = `Distância: ${totalDist}`;
    } else if (measurementMode === 'area') {
        if (tempPoints.length >= 3) {
            const areaVal = calculateArea(tempPoints);
            displayText = `Área: ${areaVal}`;
        } else {
            displayText = "Clique mais pontos para fechar a área...";
        }
    }

    showMeasureTooltip(e.latlng, displayText);
    
    // Draw preview line
    updatePreviewLine(tempPoints);
}

let previewLine;
function updatePreviewLine(points) {
    if (previewLine) {
        measureLayerGroup.removeLayer(previewLine);
    }

    if (measurementMode === 'dist') {
        previewLine = L.polyline(points, {
            color: '#9ACD32',
            weight: 2,
            dashArray: '5, 5',
            opacity: 0.8
        }).addTo(measureLayerGroup);
    } else if (measurementMode === 'area') {
        previewLine = L.polygon(points, {
            color: '#9ACD32',
            fillColor: '#9ACD32',
            fillOpacity: 0.2,
            weight: 2,
            dashArray: '5, 5',
            opacity: 0.8
        }).addTo(measureLayerGroup);
    }
}

function redrawMeasureLayer() {
    // Clear previous static lines
    measureLayerGroup.eachLayer(layer => {
        if (layer instanceof L.Polyline || layer instanceof L.Polygon) {
            measureLayerGroup.removeLayer(layer);
        }
    });

    if (measurementMode === 'dist') {
        L.polyline(measurePoints, {
            color: '#9ACD32',
            weight: 3,
            opacity: 0.9
        }).addTo(measureLayerGroup);
    } else if (measurementMode === 'area' && measurePoints.length >= 3) {
        L.polygon(measurePoints, {
            color: '#9ACD32',
            fillColor: '#9ACD32',
            fillOpacity: 0.25,
            weight: 3,
            opacity: 0.9
        }).addTo(measureLayerGroup);
    }
}

// Calculate geodesic cumulative distance
function calculateDistance(points) {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        total += points[i].distanceTo(points[i+1]);
    }
    
    if (total < 1000) {
        return `${total.toFixed(1)} m`;
    } else {
        return `${(total / 1000).toFixed(3)} km`;
    }
}

// Calculate area of polygon in hectares or sq meters
function calculateArea(points) {
    // Spherical area calculation using standard formulas
    const radius = 6378137; // WGS84 major axis
    let totalArea = 0;
    
    if (points.length < 3) return "0 m²";
    
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        
        const lambda1 = p1.lng * Math.PI / 180;
        const lambda2 = p2.lng * Math.PI / 180;
        const phi1 = p1.lat * Math.PI / 180;
        const phi2 = p2.lat * Math.PI / 180;
        
        totalArea += (lambda2 - lambda1) * (2 + Math.sin(phi1) + Math.sin(phi2));
    }
    
    totalArea = Math.abs(totalArea * radius * radius / 2.0);
    
    if (totalArea < 10000) {
        return `${totalArea.toFixed(1)} m²`;
    } else {
        // Hectares (1 ha = 10,000 m²)
        const ha = totalArea / 10000;
        return `${ha.toFixed(2)} ha (${(totalArea / 1000000).toFixed(3)} km²)`;
    }
}
