'use client';

interface FarmFilterBarProps {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
  statusMessage: string;
}

export function FarmFilterBar({ value, onChange, onApply, onClear, statusMessage }: FarmFilterBarProps) {
  return (
    <>
      <div className="farm-filter-bar">
        <input
          type="text"
          placeholder="Código da fazenda..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onApply();
          }}
        />
        <button className="farm-filter-btn" onClick={onApply} data-tooltip="Filtrar">
          🔍
        </button>
        <button className="farm-filter-btn" onClick={onClear} data-tooltip="Limpar filtro">
          ✕
        </button>
      </div>
      <div className={`farm-filter-status${statusMessage ? ' active' : ''}`}>{statusMessage}</div>
    </>
  );
}
