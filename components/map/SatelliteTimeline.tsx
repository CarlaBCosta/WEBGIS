'use client';

import type { SatelliteOption } from '@/hooks/useSatelliteLayers';

interface SatelliteTimelineProps {
  options: SatelliteOption[];
  activeYear: string;
  onChange: (year: string) => void;
}

export function SatelliteTimeline({ options, activeYear, onChange }: SatelliteTimelineProps) {
  return (
    <div className="timeline-container">
      <div className="timeline-title">Imagens de Satélite</div>
      <div className="timeline-options">
        {options.map((opt) => (
          <button
            key={opt.year}
            className={`timeline-btn${activeYear === opt.year ? ' active' : ''}`}
            onClick={() => onChange(opt.year)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
