'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MutClasseRow } from '@/lib/types/database';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 ' +
  'placeholder:text-zinc-600 focus:border-lime-400/60 focus:outline-none';

export function MutClassesEditor({ classes }: { classes: MutClasseRow[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [nova, setNova] = useState({ nome: '', cor: '#9ACD32' });

  async function chamar(metodo: string, corpo: unknown): Promise<boolean> {
    setOcupado(true);
    setErro('');
    const res = await fetch('/api/admin/mut-classes', {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    setOcupado(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErro(body.error || 'Não foi possível salvar.');
      return false;
    }
    router.refresh();
    return true;
  }

  async function mover(idx: number, direcao: -1 | 1) {
    const a = classes[idx];
    const b = classes[idx + direcao];
    if (!b) return;
    await chamar('PATCH', {
      ordem: [
        { id: a.id, sortOrder: b.sort_order },
        { id: b.id, sortOrder: a.sort_order },
      ],
    });
  }

  return (
    <div>
      {erro && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {erro}
        </p>
      )}

      <ul className="mb-6 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50">
        {classes.map((classe, idx) => (
          <li key={classe.id} className="flex items-center gap-3 px-4 py-3">
            <input
              type="color"
              value={classe.cor}
              disabled={ocupado}
              onChange={(e) => chamar('PATCH', { id: classe.id, cor: e.target.value })}
              className="h-8 w-10 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent"
              aria-label={`Cor de ${classe.nome}`}
            />
            <input
              defaultValue={classe.nome}
              disabled={ocupado}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== classe.nome) {
                  chamar('PATCH', { id: classe.id, nome: e.target.value });
                }
              }}
              className={inputClass}
              aria-label={`Nome de ${classe.nome}`}
            />
            <span className="font-mono text-xs text-zinc-600">{classe.cor}</span>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => mover(idx, -1)}
                disabled={ocupado || idx === 0}
                className="rounded px-2 py-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                aria-label="Subir"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => mover(idx, 1)}
                disabled={ocupado || idx === classes.length - 1}
                className="rounded px-2 py-1 text-zinc-500 hover:text-zinc-200 disabled:opacity-30"
                aria-label="Descer"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => chamar('DELETE', { id: classe.id })}
                disabled={ocupado}
                className="rounded px-2 py-1 text-xs text-zinc-600 hover:text-red-400"
              >
                excluir
              </button>
            </div>
          </li>
        ))}
        {classes.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-zinc-500">Nenhuma classe cadastrada ainda.</li>
        )}
      </ul>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-zinc-900/50 p-4">
        <input
          type="color"
          value={nova.cor}
          onChange={(e) => setNova({ ...nova, cor: e.target.value })}
          className="h-9 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
          aria-label="Cor da nova classe"
        />
        <input
          value={nova.nome}
          onChange={(e) => setNova({ ...nova, nome: e.target.value })}
          placeholder="Nome da classe (ex: Reflorestamento)"
          className={`${inputClass} max-w-sm`}
        />
        <button
          type="button"
          disabled={ocupado || !nova.nome.trim()}
          onClick={async () => {
            if (await chamar('POST', nova)) setNova({ nome: '', cor: '#9ACD32' });
          }}
          className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-lime-400 disabled:opacity-50"
        >
          Adicionar classe
        </button>
      </div>
    </div>
  );
}
