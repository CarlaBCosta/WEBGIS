'use client';

import { useEffect, useState } from 'react';
import type { SelectedFeature } from '@/hooks/useFeatureInfo';
import { formatLabel } from '@/lib/config/propertyDisplayNames';
import { supabaseBrowser } from '@/lib/supabase/client';
import { TimelapseModal, anosDoVideo, type TimelapseVideo } from './TimelapseModal';

interface InfoPanelProps {
  selected: SelectedFeature | null;
  onClose: () => void;
  clientId: string;
  farmCodeFields: string[];
}

export function InfoPanel({ selected, onClose, clientId, farmCodeFields }: InfoPanelProps) {
  // Resultado e vídeo aberto ficam associados à feição a que pertencem: ao trocar
  // de feição, deixam de valer sem precisar zerar estado dentro do efeito.
  const [resultado, setResultado] = useState<{ feicao: SelectedFeature; videos: TimelapseVideo[] } | null>(null);
  const [aberto, setAberto] = useState<{ feicao: SelectedFeature; video: TimelapseVideo } | null>(null);
  const videos = resultado && resultado.feicao === selected ? resultado.videos : [];
  const videoAberto = aberto && aberto.feicao === selected ? aberto.video : null;

  // Procura timelapses publicados da feição clicada: mesma camada que gerou os
  // vídeos e código em algum dos campos de fazenda do cliente.
  useEffect(() => {
    if (!selected) return;
    const codigos = [
      ...new Set(
        farmCodeFields
          .map((campo) => selected.properties[campo])
          .filter((v) => v !== null && v !== undefined && v !== '')
          .map(String)
      ),
    ];
    if (codigos.length === 0) return;

    let cancelado = false;
    supabaseBrowser
      .from('timelapse_videos')
      .select('codigo, sensor, url')
      .eq('client_id', clientId)
      .eq('layer_key', selected.layerName)
      .in('codigo', codigos)
      .not('url', 'is', null)
      .then(({ data }) => {
        if (cancelado || !data) return;
        const ordem = { landsat: 0, sentinel2: 1 };
        setResultado({
          feicao: selected,
          videos: (data as TimelapseVideo[]).sort((a, b) => ordem[a.sensor] - ordem[b.sensor]),
        });
      });
    return () => {
      cancelado = true;
    };
  }, [selected, clientId, farmCodeFields]);

  const rows = selected
    ? Object.entries(selected.properties).filter(
        ([key, value]) => !key.startsWith('_') && value !== null && value !== undefined && value !== ''
      )
    : [];

  return (
    <>
      <div className={`info-panel${selected ? ' visible' : ''}`}>
        <div className="panel-header">
          <h2>Informações da Feição</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="info-content">
          {!selected && (
            <p style={{ color: 'var(--text-muted)' }}>
              Clique em qualquer elemento do mapa para visualizar suas informações detalhadas aqui.
            </p>
          )}
          {selected && (
            <>
              <div className="info-title">{selected.layerName.replace(/_/g, ' ')}</div>
              {videos.length > 0 && (
                <div className="timelapse-botoes">
                  {videos.map((v) => {
                    const anos = anosDoVideo(v.url);
                    return (
                      <button
                        key={v.sensor}
                        className="timelapse-btn"
                        onClick={() => selected && setAberto({ feicao: selected, video: v })}
                      >
                        ▶ Ver timelapse{anos ? ` (${anos})` : ''}
                        {videos.length > 1 && (
                          <span>{v.sensor === 'sentinel2' ? 'Sentinel-2' : 'Landsat'}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <table className="info-table">
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={2} style={{ color: 'var(--text-muted)' }}>
                        Nenhuma propriedade disponível.
                      </td>
                    </tr>
                  )}
                  {rows.map(([key, value]) => (
                    <tr key={key}>
                      <td className="label">{formatLabel(key)}</td>
                      <td className="value">{String(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
      <TimelapseModal video={videoAberto} onClose={() => setAberto(null)} />
    </>
  );
}
