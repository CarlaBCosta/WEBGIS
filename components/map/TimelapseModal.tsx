'use client';

import { useEffect } from 'react';

export interface TimelapseVideo {
  codigo: string;
  sensor: 'landsat' | 'sentinel2';
  url: string;
}

const NOME_SENSOR: Record<TimelapseVideo['sensor'], string> = {
  landsat: 'Landsat · 30 m',
  sentinel2: 'Sentinel-2 · 10 m',
};

// O robô grava os anos no nome do arquivo: <sensor>-<inicio>-<fim>-<hash>.mp4
export function anosDoVideo(url: string): string | null {
  const m = url.match(/-(\d{4})-(\d{4})-[0-9a-f]{12}\.mp4$/);
  return m ? `${m[1]}–${m[2]}` : null;
}

interface TimelapseModalProps {
  video: TimelapseVideo | null;
  onClose: () => void;
}

export function TimelapseModal({ video, onClose }: TimelapseModalProps) {
  useEffect(() => {
    if (!video) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [video, onClose]);

  if (!video) return null;
  const anos = anosDoVideo(video.url);

  return (
    <div className="timelapse-overlay" onClick={onClose} role="dialog" aria-modal="true"
      aria-label={`Timelapse da fazenda ${video.codigo}`}>
      <div className="timelapse-modal" onClick={(e) => e.stopPropagation()}>
        <div className="timelapse-modal-header">
          <div>
            <h2>Timelapse · Fazenda {video.codigo}</h2>
            <p>
              {anos ? `${anos} · ` : ''}
              {NOME_SENSOR[video.sensor]} · composição anual da estação seca (mai–set)
            </p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Fechar timelapse">
            ×
          </button>
        </div>
        <video
          key={video.url}
          className="timelapse-video"
          src={video.url}
          controls
          autoPlay
          loop
          muted
          playsInline
        />
        <p className="timelapse-legenda">
          Contorno amarelo: limite da fazenda. Ano indicado no canto de cada quadro.
        </p>
      </div>
    </div>
  );
}
