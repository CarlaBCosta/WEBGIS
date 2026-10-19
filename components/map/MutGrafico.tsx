'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { MutConfig } from '@/lib/types/domain';
import { corDaClasse, nomeDeExibicaoDaClasse } from '@/lib/mut';

interface Medicao {
  classe: string;
  data: string;
  ndvi: number | null;
  evi: number | null;
}

type Indice = 'evi' | 'ndvi';

const LARGURA = 280;
const ALTURA = 130;
const MARGEM = { topo: 8, direita: 4, baixo: 16, esquerda: 26 };

// O gráfico do rodapé da prancha: uma linha por classe de uso, ao longo dos
// anos, com os valores que a equipe calcula no QGIS e importa pelo painel.
export function MutGrafico({ codigo, clientId, mut }: { codigo: string; clientId: string; mut: MutConfig }) {
  // O resultado fica amarrado à fazenda que o pediu: ao trocar de fazenda ele
  // deixa de valer sozinho, sem precisar zerar estado dentro do efeito.
  const [resultado, setResultado] = useState<{ codigo: string; medicoes: Medicao[] } | null>(null);
  const [indice, setIndice] = useState<Indice>('evi');
  const medicoes = resultado && resultado.codigo === codigo ? resultado.medicoes : null;

  useEffect(() => {
    let cancelado = false;
    supabaseBrowser
      .from('mut_indices')
      .select('classe, data, ndvi, evi')
      .eq('client_id', clientId)
      .eq('codigo', codigo)
      .order('data', { ascending: true })
      .then(({ data }) => {
        if (!cancelado) setResultado({ codigo, medicoes: (data as Medicao[]) ?? [] });
      });
    return () => {
      cancelado = true;
    };
  }, [clientId, codigo]);

  const series = useMemo(() => {
    if (!medicoes?.length) return [];
    const porClasse = new Map<string, { x: number; y: number }[]>();
    for (const m of medicoes) {
      const valor = indice === 'evi' ? m.evi : m.ndvi;
      if (valor === null || valor === undefined) continue;
      const tempo = new Date(m.data).getTime();
      if (!Number.isFinite(tempo)) continue;
      const nome = nomeDeExibicaoDaClasse(mut.classes, m.classe);
      const pontos = porClasse.get(nome) ?? [];
      pontos.push({ x: tempo, y: valor });
      porClasse.set(nome, pontos);
    }
    return [...porClasse.entries()].map(([nome, pontos]) => ({
      nome,
      cor: corDaClasse(mut.classes, nome),
      pontos: pontos.sort((a, b) => a.x - b.x),
    }));
  }, [medicoes, indice, mut.classes]);

  const escala = useMemo(() => {
    const todos = series.flatMap((s) => s.pontos);
    if (todos.length === 0) return null;
    const xs = todos.map((p) => p.x);
    const ys = todos.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const larguraUtil = LARGURA - MARGEM.esquerda - MARGEM.direita;
    const alturaUtil = ALTURA - MARGEM.topo - MARGEM.baixo;
    return {
      minX,
      maxX,
      minY,
      maxY,
      px: (x: number) => MARGEM.esquerda + ((x - minX) / Math.max(maxX - minX, 1)) * larguraUtil,
      py: (y: number) =>
        MARGEM.topo + alturaUtil - ((y - minY) / Math.max(maxY - minY, 1e-6)) * alturaUtil,
    };
  }, [series]);

  if (medicoes === null) {
    return <p className="mut-grafico-vazio">Carregando o índice de vegetação...</p>;
  }
  if (!escala || series.length === 0) return null;

  const anoInicial = new Date(escala.minX).getFullYear();
  const anoFinal = new Date(escala.maxX).getFullYear();

  return (
    <div className="mut-grafico">
      <div className="mut-grafico-topo">
        <div className="mut-resumo-titulo">Índice de vegetação</div>
        <div className="mut-modos pequeno" role="group" aria-label="Índice">
          <button type="button" className={indice === 'evi' ? 'ativo' : ''} onClick={() => setIndice('evi')}>
            EVI
          </button>
          <button
            type="button"
            className={indice === 'ndvi' ? 'ativo' : ''}
            onClick={() => setIndice('ndvi')}
          >
            NDVI
          </button>
        </div>
      </div>

      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="mut-grafico-svg" role="img"
        aria-label={`${indice === 'evi' ? 'EVI' : 'NDVI'} de ${anoInicial} a ${anoFinal}`}>
        <line
          x1={MARGEM.esquerda}
          y1={ALTURA - MARGEM.baixo}
          x2={LARGURA - MARGEM.direita}
          y2={ALTURA - MARGEM.baixo}
          className="mut-grafico-eixo"
        />
        <line
          x1={MARGEM.esquerda}
          y1={MARGEM.topo}
          x2={MARGEM.esquerda}
          y2={ALTURA - MARGEM.baixo}
          className="mut-grafico-eixo"
        />
        <text x={MARGEM.esquerda - 4} y={MARGEM.topo + 6} className="mut-grafico-rotulo" textAnchor="end">
          {escala.maxY.toFixed(2)}
        </text>
        <text
          x={MARGEM.esquerda - 4}
          y={ALTURA - MARGEM.baixo}
          className="mut-grafico-rotulo"
          textAnchor="end"
        >
          {escala.minY.toFixed(2)}
        </text>
        <text x={MARGEM.esquerda} y={ALTURA - 4} className="mut-grafico-rotulo">
          {anoInicial}
        </text>
        <text x={LARGURA - MARGEM.direita} y={ALTURA - 4} className="mut-grafico-rotulo" textAnchor="end">
          {anoFinal}
        </text>

        {series.map((serie) => (
          <polyline
            key={serie.nome}
            fill="none"
            stroke={serie.cor}
            strokeWidth={1.2}
            points={serie.pontos.map((p) => `${escala.px(p.x)},${escala.py(p.y)}`).join(' ')}
          />
        ))}
      </svg>

      <ul className="mut-legenda compacta">
        {series.map((serie) => (
          <li key={serie.nome}>
            <span className="mut-legenda-cor" style={{ background: serie.cor }} />
            {serie.nome}
          </li>
        ))}
      </ul>
    </div>
  );
}
