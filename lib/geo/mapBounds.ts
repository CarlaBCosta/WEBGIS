// Cálculo da extensão máxima de navegação (PRD "Comportamento da Extensão do
// Mapa"): bbox da área de estudo + buffer em km. Função pura (sem Leaflet)
// para poder ser usada tanto no cliente quanto em código server-side.

export interface BoundsBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LNG_EQUATOR = 111.32;

export function bufferBoundsKm(box: BoundsBox, bufferKm: number): BoundsBox {
  const latDelta = bufferKm / KM_PER_DEG_LAT;
  const midLat = (box.south + box.north) / 2;
  // Clamp do cosseno evita divisão por ~0 em latitudes extremas.
  const cosLat = Math.max(Math.cos((midLat * Math.PI) / 180), 0.01);
  const lngDelta = bufferKm / (KM_PER_DEG_LNG_EQUATOR * cosLat);

  return {
    south: Math.max(box.south - latDelta, -90),
    north: Math.min(box.north + latDelta, 90),
    west: box.west - lngDelta,
    east: box.east + lngDelta,
  };
}
