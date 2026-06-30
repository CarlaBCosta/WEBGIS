'use client';

import type { MeasureMode } from '@/hooks/useMeasurementTool';

interface ToolsPanelProps {
  mode: MeasureMode;
  onToggleMeasure: (mode: 'dist' | 'area') => void;
  onClearMeasure: () => void;
  onFitBounds: () => void;
}

export function ToolsPanel({ mode, onToggleMeasure, onClearMeasure, onFitBounds }: ToolsPanelProps) {
  return (
    <div className="tools-panel">
      <button
        className={`tool-btn${mode === 'dist' ? ' active' : ''}`}
        data-tooltip="Medir Distância"
        onClick={() => onToggleMeasure('dist')}
      >
        📏
      </button>
      <button
        className={`tool-btn${mode === 'area' ? ' active' : ''}`}
        data-tooltip="Medir Área"
        onClick={() => onToggleMeasure('area')}
      >
        📐
      </button>
      <button className="tool-btn" data-tooltip="Limpar Medições" onClick={onClearMeasure}>
        🗑️
      </button>
      <button className="tool-btn" data-tooltip="Centralizar na Área de Estudo" onClick={onFitBounds}>
        🏠
      </button>
    </div>
  );
}
