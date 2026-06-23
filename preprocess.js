const fs = require('fs');
const path = require('path');
const proj4 = require('proj4');

// Define projection for SIRGAS 2000 / UTM zone 22S (EPSG:31982)
proj4.defs("EPSG:31982", "+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
const proj = proj4("EPSG:31982", "EPSG:4326");

// Each client exports GeoJSON from QGIS into its own subfolder of
// BASE_INPUT_DIR (e.g. .../GEOJSON/usina-sao-jose/*.geojson), and gets its
// data published into clientes/<id>/data/ where shared/app.js expects it.
// Usage: node preprocess.js <id-do-cliente>
const BASE_INPUT_DIR = 'C:\\Users\\carla.dalpian\\OneDrive - sigmagis.com.br\\Documentos\\Claude\\Projects\\8_WEBPORTAL\\GEOJSON';

const clientId = process.argv[2];
if (!clientId) {
    console.error('Uso: node preprocess.js <id-do-cliente>');
    console.error(`Os arquivos .geojson exportados do QGIS devem estar em: ${BASE_INPUT_DIR}\\<id-do-cliente>\\`);
    process.exit(1);
}

const INPUT_DIR = path.join(BASE_INPUT_DIR, clientId);
const OUTPUT_DIR = path.join(__dirname, 'clientes', clientId, 'data');

if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Pasta de entrada não encontrada: ${INPUT_DIR}`);
    console.error('Crie a pasta e exporte os .geojson do QGIS nela antes de rodar este script.');
    process.exit(1);
}

// Create output directory if it doesn't exist
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 1. Douglas-Peucker simplification algorithm
function simplifyDP(points, sqTolerance) {
    const len = points.length;
    if (len <= 2) return points;
    
    let dMax = 0;
    let index = 0;
    const end = len - 1;
    
    for (let i = 1; i < end; i++) {
        const d = getSqSegDist(points[i], points[0], points[end]);
        if (d > dMax) {
            index = i;
            dMax = d;
        }
    }
    
    if (dMax > sqTolerance) {
        const results1 = simplifyDP(points.slice(0, index + 1), sqTolerance);
        const results2 = simplifyDP(points.slice(index), sqTolerance);
        return results1.slice(0, results1.length - 1).concat(results2);
    }
    return [points[0], points[end]];
}

function getSqSegDist(p, p1, p2) {
    let x = p1[0], y = p1[1];
    let dx = p2[0] - x, dy = p2[1] - y;
        
    if (dx !== 0 || dy !== 0) {
        const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
        
        if (t > 1) {
            x = p2[0];
            y = p2[1];
        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }
    
    dx = p[0] - x;
    dy = p[1] - y;
    
    return dx * dx + dy * dy;
}

// 2. Helper to traverse coordinates of any geometry and find bounding box
function traverseCoordinates(geom, callback) {
    if (!geom || !geom.coordinates) return;
    if (geom.type === 'Point') {
        callback(geom.coordinates);
    } else if (geom.type === 'LineString' || geom.type === 'MultiPoint') {
        geom.coordinates.forEach(callback);
    } else if (geom.type === 'Polygon' || geom.type === 'MultiLineString') {
        geom.coordinates.forEach(ring => ring.forEach(callback));
    } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach(poly => poly.forEach(ring => ring.forEach(callback)));
    }
}

// 3. Project and simplify geometries
function projectAndSimplifyGeometry(geom, sqTolerance) {
    if (!geom) return null;
    
    const roundCoord = c => Math.round(c * 100000) / 100000;
    
    if (geom.type === 'Point') {
        const p = proj.forward(geom.coordinates);
        return {
            type: 'Point',
            coordinates: [roundCoord(p[0]), roundCoord(p[1])]
        };
    } else if (geom.type === 'LineString') {
        const pts = geom.coordinates.map(pt => proj.forward(pt));
        const simplified = simplifyDP(pts, sqTolerance);
        return {
            type: 'LineString',
            coordinates: simplified.map(pt => [roundCoord(pt[0]), roundCoord(pt[1])])
        };
    } else if (geom.type === 'MultiPoint') {
        const pts = geom.coordinates.map(pt => proj.forward(pt));
        return {
            type: 'MultiPoint',
            coordinates: pts.map(pt => [roundCoord(pt[0]), roundCoord(pt[1])])
        };
    } else if (geom.type === 'Polygon') {
        const rings = geom.coordinates.map(ring => {
            const pts = ring.map(pt => proj.forward(pt));
            const simplified = simplifyDP(pts, sqTolerance);
            if (simplified.length < 4) {
                return pts.map(pt => [roundCoord(pt[0]), roundCoord(pt[1])]);
            }
            return simplified.map(pt => [roundCoord(pt[0]), roundCoord(pt[1])]);
        });
        return {
            type: 'Polygon',
            coordinates: rings
        };
    } else if (geom.type === 'MultiLineString') {
        const lines = geom.coordinates.map(line => {
            const pts = line.map(pt => proj.forward(pt));
            const simplified = simplifyDP(pts, sqTolerance);
            return simplified.map(pt => [roundCoord(pt[0]), roundCoord(pt[1])]);
        });
        return {
            type: 'MultiLineString',
            coordinates: lines
        };
    } else if (geom.type === 'MultiPolygon') {
        const polys = geom.coordinates.map(poly => {
            return poly.map(ring => {
                const pts = ring.map(pt => proj.forward(pt));
                const simplified = simplifyDP(pts, sqTolerance);
                if (simplified.length < 4) {
                    return pts.map(pt => [roundCoord(pt[0]), roundCoord(pt[1])]);
                }
                return simplified.map(pt => [roundCoord(pt[0]), roundCoord(pt[1])]);
            });
        });
        return {
            type: 'MultiPolygon',
            coordinates: polys
        };
    }
    return geom;
}

// Bounding box helper
function getFeatureBBox(feature) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    traverseCoordinates(feature.geometry, pt => {
        if (pt[0] < minX) minX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] > maxY) maxY = pt[1];
    });
    return { minX, minY, maxX, maxY };
}

function checkBBoxOverlap(box1, box2) {
    return !(box1.minX > box2.maxX || box1.maxX < box2.minX || box1.minY > box2.maxY || box1.maxY < box2.minY);
}

// 4. Main Processing Flow
function main() {
    console.log("=== WebGIS Data Preprocessing ===");
    console.log(`Input Directory: ${INPUT_DIR}`);
    console.log(`Output Directory: ${OUTPUT_DIR}\n`);

    // Load the study area (AID) to get a reference bounding box, used to crop
    // large regional layers down to what's near this client's project. Matches
    // any "Area_de_Influencias_Direta*.geojson" file; if none is found, the
    // spatial crop step below is simply skipped (every feature is kept).
    const aidFileName = fs.readdirSync(INPUT_DIR).find(f => /Area_de_Influencias_Direta.*\.geojson$/i.test(f));
    let filterBox = null;

    if (aidFileName) {
        const aidData = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, aidFileName), 'utf8'));
        let aidMinX = Infinity, aidMinY = Infinity, aidMaxX = -Infinity, aidMaxY = -Infinity;
        aidData.features.forEach(f => {
            const box = getFeatureBBox(f);
            if (box.minX < aidMinX) aidMinX = box.minX;
            if (box.minY < aidMinY) aidMinY = box.minY;
            if (box.maxX > aidMaxX) aidMaxX = box.maxX;
            if (box.maxY > aidMaxY) aidMaxY = box.maxY;
        });

        console.log(`Study Area UTM BBox: MinX: ${aidMinX}, MinY: ${aidMinY}, MaxX: ${aidMaxX}, MaxY: ${aidMaxY}`);

        // Add 30km (30,000 meters) buffer for filtering large regional layers
        const BUFFER = 30000;
        filterBox = {
            minX: aidMinX - BUFFER,
            minY: aidMinY - BUFFER,
            maxX: aidMaxX + BUFFER,
            maxY: aidMaxY + BUFFER
        };
        console.log(`Filter Buffer BBox (30km buffer): MinX: ${filterBox.minX}, MinY: ${filterBox.minY}, MaxX: ${filterBox.maxX}, MaxY: ${filterBox.maxY}\n`);
    } else {
        console.warn('Aviso: nenhum arquivo "Area_de_Influencias_Direta*.geojson" encontrado - camadas grandes não serão recortadas espacialmente, apenas simplificadas.\n');
    }

    const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.geojson'));

    files.forEach(file => {
        const filePath = path.join(INPUT_DIR, file);
        const stats = fs.statSync(filePath);
        const fileSizeMB = stats.size / 1024 / 1024;
        
        console.log(`Processing: ${file} (Size: ${fileSizeMB.toFixed(2)} MB)`);
        
        const rawContent = fs.readFileSync(filePath, 'utf8');
        let geojson;
        try {
            geojson = JSON.parse(rawContent);
        } catch (e) {
            console.error(`Error parsing JSON for ${file}:`, e);
            return;
        }

        const originalCount = geojson.features.length;
        let processedFeatures = [];

        // Determine simplification and filter settings based on file size and name
        let isLarge = fileSizeMB > 2.0;
        
        // Custom tolerances in meters (converted to degrees squared in WGS84 for the DP algorithm)
        let toleranceMeters = 5; // Default 5 meters
        if (file.includes('Preservacao_Permanente') || file.includes('Vegetacao_Nativa')) {
            toleranceMeters = 15;
        } else if (file.includes('RAMSAR') || file.includes('Terras_Indigenas')) {
            toleranceMeters = 30; // Very large layers
        } else if (file.includes('Turfeiras')) {
            toleranceMeters = 20;
        } else if (file.includes('Usina_Principal') || file.includes('Area_de_Influencias') || file.includes('Area_Diretamente_Afetada')) {
            toleranceMeters = 2; // Keep high precision for project boundaries
        }

        const METERS_TO_DEGREES = 1 / 111000;
        const degTol = toleranceMeters * METERS_TO_DEGREES;
        const sqTolerance = degTol * degTol;

        geojson.features.forEach(feature => {
            if (!feature.geometry) return;

            // Apply spatial overlap filter ONLY for large files, and only when
            // we have a study-area bounding box to filter against
            if (isLarge && filterBox) {
                const featBox = getFeatureBBox(feature);
                if (featBox.minX === Infinity) return; // invalid geometry

                if (!checkBBoxOverlap(featBox, filterBox)) {
                    // Does not overlap with the study area + buffer, skip it!
                    return;
                }
            }

            // Project coordinates and simplify
            const newGeom = projectAndSimplifyGeometry(feature.geometry, sqTolerance);
            if (newGeom) {
                // Clean up properties to keep files small (remove very long string descriptions if any, or null values)
                const cleanProperties = {};
                for (const key in feature.properties) {
                    const val = feature.properties[key];
                    if (val !== null && val !== undefined) {
                        cleanProperties[key] = val;
                    }
                }

                processedFeatures.push({
                    type: 'Feature',
                    properties: cleanProperties,
                    geometry: newGeom
                });
            }
        });

        const newCount = processedFeatures.length;
        console.log(`  Features kept: ${newCount} / ${originalCount} (${((newCount/originalCount)*100).toFixed(1)}%)`);

        const outputCollection = {
            type: 'FeatureCollection',
            name: geojson.name || file.replace('.geojson', ''),
            features: processedFeatures
        };

        // Write output as a JS file to bypass CORS issues on local execution
        const cleanName = file.replace('.geojson', '').replace(/[^a-zA-Z0-9_]/g, '_');
        const jsVariableName = `geojsonData_${cleanName}`;
        
        const outputFilename = `${file.replace('.geojson', '')}.js`;
        const outputPath = path.join(OUTPUT_DIR, outputFilename);
        
        const fileContent = `window.${jsVariableName} = ${JSON.stringify(outputCollection)};\n`;
        fs.writeFileSync(outputPath, fileContent, 'utf8');
        
        const outStats = fs.statSync(outputPath);
        const outSizeMB = outStats.size / 1024 / 1024;
        console.log(`  Saved to: ${outputFilename} (Final Size: ${outSizeMB.toFixed(2)} MB)\n`);
    });

    console.log("=== Preprocessing Completed Successfully! ===");
}

main();
