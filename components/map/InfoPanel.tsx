'use client';

import type { SelectedFeature } from '@/hooks/useFeatureInfo';
import { formatLabel } from '@/lib/config/propertyDisplayNames';

interface InfoPanelProps {
  selected: SelectedFeature | null;
  onClose: () => void;
}

export function InfoPanel({ selected, onClose }: InfoPanelProps) {
  const rows = selected
    ? Object.entries(selected.properties).filter(
        ([key, value]) => !key.startsWith('_') && value !== null && value !== undefined && value !== ''
      )
    : [];

  return (
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
  );
}
