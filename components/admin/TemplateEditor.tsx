'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LayerGroupTemplateRow } from '@/lib/types/database';

const inputClass =
  'w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 ' +
  'placeholder:text-zinc-600 focus:border-lime-400/60 focus:outline-none';

type Rascunho = { title: string; descricao: string; keywords: string };

function paraRascunho(t?: LayerGroupTemplateRow): Rascunho {
  return { title: t?.title ?? '', descricao: t?.descricao ?? '', keywords: (t?.keywords ?? []).join(', ') };
}

export function TemplateEditor({ templates }: { templates: LayerGroupTemplateRow[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho>(paraRascunho());
  const [nova, setNova] = useState<Rascunho>(paraRascunho());
  const [mostrarNova, setMostrarNova] = useState(false);

  async function chamar(metodo: string, corpo: unknown): Promise<boolean> {
    setOcupado(true);
    setErro('');
    const res = await fetch('/api/admin/group-templates', {
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
    const a = templates[idx];
    const b = templates[idx + direcao];
    if (!b) return;
    await chamar('PATCH', {
      ordem: [
        { id: a.id, sortOrder: b.sort_order },
        { id: b.id, sortOrder: a.sort_order },
      ],
    });
  }

  function campos(valor: Rascunho, mudar: (v: Rascunho) => void) {
    return (
      <div className="grid gap-2">
        <input
          className={inputClass}
          placeholder="Nome da divisão (ex: Recursos Hídricos)"
          value={valor.title}
          onChange={(e) => mudar({ ...valor, title: e.target.value })}
          aria-label="Nome da divisão"
        />
        <input
          className={inputClass}
          placeholder="Descrição: camadas que entram nela (ex: Rios, Nascentes, Poços)"
          value={valor.descricao}
          onChange={(e) => mudar({ ...valor, descricao: e.target.value })}
          aria-label="Descrição"
        />
        <input
          className={`${inputClass} font-mono text-xs`}
          placeholder="Palavras-chave do nome do arquivo, separadas por vírgula (ex: rio, nascente, poco)"
          value={valor.keywords}
          onChange={(e) => mudar({ ...valor, keywords: e.target.value })}
          aria-label="Palavras-chave"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setMostrarNova((v) => !v)}
          className="rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-lime-400"
        >
          + Nova divisão no modelo
        </button>
      </div>

      {mostrarNova && (
        <div className="rounded-xl border border-lime-400/30 bg-zinc-900/60 p-4">
          {campos(nova, setNova)}
          <div className="mt-3 flex gap-2">
            <button
              disabled={ocupado || !nova.title.trim()}
              onClick={async () => {
                if (await chamar('POST', nova)) {
                  setNova(paraRascunho());
                  setMostrarNova(false);
                }
              }}
              className="rounded-lg bg-lime-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-lime-400 disabled:opacity-50"
            >
              Incluir no modelo
            </button>
            <button onClick={() => setMostrarNova(false)} className="px-2 text-xs text-zinc-400 hover:text-white">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {erro && <p className="text-sm text-red-400">{erro}</p>}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50">
        {templates.length === 0 && <p className="px-5 py-10 text-center text-sm text-zinc-500">O modelo está vazio.</p>}
        {templates.map((t, i) => (
          <div key={t.id} className="border-b border-white/5 px-5 py-4 last:border-b-0">
            {editandoId === t.id ? (
              <>
                {campos(rascunho, setRascunho)}
                <div className="mt-3 flex gap-2">
                  <button
                    disabled={ocupado || !rascunho.title.trim()}
                    onClick={async () => {
                      if (await chamar('PATCH', { id: t.id, ...rascunho })) setEditandoId(null);
                    }}
                    className="rounded-lg bg-lime-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-lime-400 disabled:opacity-50"
                  >
                    Salvar
                  </button>
                  <button onClick={() => setEditandoId(null)} className="px-2 text-xs text-zinc-400 hover:text-white">
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-zinc-100">{t.title}</div>
                  <p className="mt-0.5 text-sm text-zinc-400">
                    {t.descricao || <span className="text-zinc-600">Sem descrição</span>}
                  </p>
                  <p className="mt-1 truncate font-mono text-[11px] text-zinc-600" title={t.keywords.join(', ')}>
                    {t.keywords.length} palavras-chave: {t.keywords.slice(0, 8).join(', ')}
                    {t.keywords.length > 8 ? '…' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <button onClick={() => mover(i, -1)} disabled={i === 0 || ocupado} className="hover:text-white disabled:opacity-30" aria-label="Subir">
                    ↑
                  </button>
                  <button
                    onClick={() => mover(i, 1)}
                    disabled={i === templates.length - 1 || ocupado}
                    className="hover:text-white disabled:opacity-30"
                    aria-label="Descer"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => {
                      setEditandoId(t.id);
                      setRascunho(paraRascunho(t));
                    }}
                    className="hover:text-white"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Excluir "${t.title}" do modelo? Clientes que já têm essa divisão não mudam.`)) {
                        chamar('DELETE', { id: t.id });
                      }
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
