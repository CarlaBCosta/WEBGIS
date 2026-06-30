// Ported from preprocess.js: reprojection (EPSG:31982 -> EPSG:4326) +
// Douglas-Peucker simplification + optional bbox crop against a study-area
// reference. Operates purely on in-memory GeoJSON objects (no fs access) so
// it can run both in the admin upload API route and in the legacy CLI
// wrapper (scripts/preprocess.ts).
import proj4 from 'proj4';

proj4.defs(
  'EPSG:31982',
  '+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
);

export type GeoJSONGeometry = {
  type: string;
  coordinates: unknown;
};

export type GeoJSONFeature = {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: GeoJSONGeometry;
};

export type GeoJSONFeatureCollection = {
  type: 'FeatureCollection';
  name?: string;
  features: GeoJSONFeature[];
};

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

type Point = [number, number];

function simplifyDP(points: Point[], sqTolerance: number): Point[] {
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

function getSqSegDist(p: Point, p1: Point, p2: Point): number {
  let x = p1[0];
  let y = p1[1];
  let dx = p2[0] - x;
  let dy = p2[1] - y;

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

export function traverseCoordinates(
  geom: GeoJSONGeometry | null | undefined,
  callback: (pt: Point) => void
) {
  if (!geom || !geom.coordinates) return;
  const coords = geom.coordinates as unknown;
  if (geom.type === 'Point') {
    callback(coords as Point);
  } else if (geom.type === 'LineString' || geom.type === 'MultiPoint') {
    (coords as Point[]).forEach(callback);
  } else if (geom.type === 'Polygon' || geom.type === 'MultiLineString') {
    (coords as Point[][]).forEach((ring) => ring.forEach(callback));
  } else if (geom.type === 'MultiPolygon') {
    (coords as Point[][][]).forEach((poly) =>
      poly.forEach((ring) => ring.forEach(callback))
    );
  }
}

export function getFeatureBBox(feature: GeoJSONFeature): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  traverseCoordinates(feature.geometry, (pt) => {
    if (pt[0] < minX) minX = pt[0];
    if (pt[1] < minY) minY = pt[1];
    if (pt[0] > maxX) maxX = pt[0];
    if (pt[1] > maxY) maxY = pt[1];
  });
  return { minX, minY, maxX, maxY };
}

export function checkBBoxOverlap(box1: BBox, box2: BBox): boolean {
  return !(
    box1.minX > box2.maxX ||
    box1.maxX < box2.minX ||
    box1.minY > box2.maxY ||
    box1.maxY < box2.minY
  );
}

function projectAndSimplifyGeometry(
  geom: GeoJSONGeometry,
  sqTolerance: number,
  reproject: boolean
): GeoJSONGeometry | null {
  if (!geom) return null;
  const proj = proj4('EPSG:31982', 'EPSG:4326');
  const forward = (pt: Point): Point => (reproject ? (proj.forward(pt) as Point) : pt);
  const roundCoord = (c: number) => Math.round(c * 100000) / 100000;
  const round = (pt: Point): Point => [roundCoord(pt[0]), roundCoord(pt[1])];

  if (geom.type === 'Point') {
    return { type: 'Point', coordinates: round(forward(geom.coordinates as Point)) };
  }
  if (geom.type === 'LineString') {
    const pts = (geom.coordinates as Point[]).map(forward);
    const simplified = simplifyDP(pts, sqTolerance);
    return { type: 'LineString', coordinates: simplified.map(round) };
  }
  if (geom.type === 'MultiPoint') {
    const pts = (geom.coordinates as Point[]).map(forward);
    return { type: 'MultiPoint', coordinates: pts.map(round) };
  }
  if (geom.type === 'Polygon') {
    const rings = (geom.coordinates as Point[][]).map((ring) => {
      const pts = ring.map(forward);
      const simplified = simplifyDP(pts, sqTolerance);
      return (simplified.length < 4 ? pts : simplified).map(round);
    });
    return { type: 'Polygon', coordinates: rings };
  }
  if (geom.type === 'MultiLineString') {
    const lines = (geom.coordinates as Point[][]).map((line) => {
      const pts = line.map(forward);
      return simplifyDP(pts, sqTolerance).map(round);
    });
    return { type: 'MultiLineString', coordinates: lines };
  }
  if (geom.type === 'MultiPolygon') {
    const polys = (geom.coordinates as Point[][][]).map((poly) =>
      poly.map((ring) => {
        const pts = ring.map(forward);
        const simplified = simplifyDP(pts, sqTolerance);
        return (simplified.length < 4 ? pts : simplified).map(round);
      })
    );
    return { type: 'MultiPolygon', coordinates: polys };
  }
  return geom;
}

export interface PreprocessOptions {
  /** Source CRS - if 'EPSG:31982', reprojects to EPSG:4326. Defaults to no reprojection. */
  sourceCrs?: 'EPSG:31982' | 'EPSG:4326';
  /** Simplification tolerance in meters. Default 5m, matching preprocess.js's default. */
  toleranceMeters?: number;
  /** Optional bbox (already in the target CRS) used to crop features that don't overlap. */
  filterBox?: BBox | null;
}

export interface PreprocessResult {
  collection: GeoJSONFeatureCollection;
  originalCount: number;
  keptCount: number;
}

export function preprocessGeoJSON(
  input: GeoJSONFeatureCollection,
  options: PreprocessOptions = {}
): PreprocessResult {
  const { sourceCrs = 'EPSG:4326', toleranceMeters = 5, filterBox = null } = options;
  const reproject = sourceCrs === 'EPSG:31982';

  const METERS_TO_DEGREES = 1 / 111000;
  const degTol = toleranceMeters * METERS_TO_DEGREES;
  const sqTolerance = degTol * degTol;

  const originalCount = input.features.length;
  const processedFeatures: GeoJSONFeature[] = [];

  for (const feature of input.features) {
    if (!feature.geometry) continue;

    if (filterBox) {
      const featBox = getFeatureBBox(feature);
      if (featBox.minX === Infinity) continue;
      if (!checkBBoxOverlap(featBox, filterBox)) continue;
    }

    const newGeom = projectAndSimplifyGeometry(feature.geometry, sqTolerance, reproject);
    if (!newGeom) continue;

    const cleanProperties: Record<string, unknown> = {};
    for (const key in feature.properties) {
      const val = feature.properties[key];
      if (val !== null && val !== undefined) cleanProperties[key] = val;
    }

    processedFeatures.push({ type: 'Feature', properties: cleanProperties, geometry: newGeom });
  }

  return {
    collection: {
      type: 'FeatureCollection',
      name: input.name,
      features: processedFeatures,
    },
    originalCount,
    keptCount: processedFeatures.length,
  };
}

/** Computes a bbox (in the geometry's own CRS) around all features, expanded by a buffer in the same units. */
export function computeBufferedBBox(
  collection: GeoJSONFeatureCollection,
  bufferUnits: number
): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const feature of collection.features) {
    const box = getFeatureBBox(feature);
    if (box.minX < minX) minX = box.minX;
    if (box.minY < minY) minY = box.minY;
    if (box.maxX > maxX) maxX = box.maxX;
    if (box.maxY > maxY) maxY = box.maxY;
  }
  return {
    minX: minX - bufferUnits,
    minY: minY - bufferUnits,
    maxX: maxX + bufferUnits,
    maxY: maxY + bufferUnits,
  };
}

/** Detects the dominant geometry type present in a FeatureCollection, for admin UI hints. */
export function detectGeometryType(collection: GeoJSONFeatureCollection): string | null {
  return collection.features[0]?.geometry?.type ?? null;
}
