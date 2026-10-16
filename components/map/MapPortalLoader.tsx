'use client';

import dynamic from 'next/dynamic';
import type { ClientConfig } from '@/lib/types/domain';

// O Leaflet só roda no navegador (usa `window` ao ser carregado). Sem isto, o
// Next.js tenta montar o mapa no servidor, o render falha com "window is not
// defined" e a página inteira é remontada no cliente — o que aparecia como
// "1 Issue" no modo de desenvolvimento e atrasava a primeira exibição.
const MapPortal = dynamic(() => import('./MapPortal').then((m) => m.MapPortal), {
  ssr: false,
  loading: () => (
    <div className="loading-overlay">
      <div className="spinner" />
      <div className="loading-text">Carregando o mapa...</div>
    </div>
  ),
});

export function MapPortalLoader({ config }: { config: ClientConfig }) {
  return <MapPortal config={config} />;
}
