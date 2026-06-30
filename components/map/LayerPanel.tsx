'use client';

import { memo } from 'react';
import type { ClientConfig } from '@/lib/types/domain';
import type { LayerStatus } from '@/hooks/useLayerVisibility';

interface LayerPanelProps {
  config: ClientConfig;
  status: Record<string, LayerStatus>;
  visible: Record<string, boolean>;
  onToggle: (layerKey: string) => void;
}

const LayerItem = memo(function LayerItem({
  id,
  label,
  legendStyle,
  isActive,
  layerStatus,
  onToggle,
}: {
  id: string;
  label: string;
  legendStyle: string;
  isActive: boolean;
  layerStatus: LayerStatus;
  onToggle: () => void;
}) {
  const isLoading = layerStatus === 'loading';
  const isError = layerStatus === 'error';

  return (
    <div
      className={`layer-item${isActive ? ' active' : ''}${isLoading ? ' loading' : ''}`}
      style={isError ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
      onClick={() => !isError && onToggle()}
    >
      <div className="layer-label">
        <span className="layer-legend-icon" style={parseLegendStyle(legendStyle)} />
        {label}
      </div>
      <label className="switch" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={isActive} disabled={isError} onChange={onToggle} />
        <span className="slider" />
      </label>
    </div>
  );
});

// legendStyle comes from the DB as an inline CSS string (e.g.
// "background-color: #E31A1C;"); parse it into a React style object instead
// of using dangerouslySetInnerHTML/raw innerHTML.
function parseLegendStyle(css: string): React.CSSProperties {
  const result: Record<string, string> = {};
  css.split(';').forEach((decl) => {
    const [prop, value] = decl.split(':').map((s) => s?.trim());
    if (!prop || !value) return;
    const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    result[camel] = value;
  });
  return result as React.CSSProperties;
}

export const LayerPanel = memo(function LayerPanel({ config, status, visible, onToggle }: LayerPanelProps) {
  return (
    <div className="panel-content">
      {config.layerGroups.map((group) => (
        <div className="layer-group" key={group.title}>
          <div className="group-title">{group.title}</div>
          {group.layers.map((layer) => (
            <LayerItem
              key={layer.id}
              id={layer.id}
              label={layer.label}
              legendStyle={layer.legendStyle}
              isActive={!!visible[layer.id]}
              layerStatus={status[layer.id] || 'idle'}
              onToggle={() => onToggle(layer.id)}
            />
          ))}
        </div>
      ))}
    </div>
  );
});
