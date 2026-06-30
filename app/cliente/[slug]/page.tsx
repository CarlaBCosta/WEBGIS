import { notFound } from 'next/navigation';
import { loadClientConfig } from '@/lib/loadClientConfig';
import { MapPortal } from '@/components/map/MapPortal';

export default async function ClientePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = await loadClientConfig(slug);

  if (!config) notFound();

  return (
    <div className="portal-shell">
      <header>
        <div className="logo-container">
          <img src="/logo.png" alt="AMBIUM Digital Logo" />
          <div className="header-title">
            <h1>Portal WebGIS</h1>
            <p>{config.clientName}</p>
          </div>
        </div>
      </header>
      <MapPortal config={config} />
    </div>
  );
}
