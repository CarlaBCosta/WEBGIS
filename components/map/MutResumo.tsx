'use client';

import type { MutConfig } from '@/lib/types/domain';
import { COR_ELEGIVEL, COR_INELEGIVEL, formatarHa, type ResumoFazenda } from '@/lib/mut';
import { MutGrafico } from './MutGrafico';

const SELO = {
  elegivel: { texto: 'Elegível', classe: 'elegivel' },
  parcial: { texto: 'Parcialmente elegível', classe: 'parcial' },
  inelegivel: { texto: 'Inelegível', classe: 'inelegivel' },
  'sem-info': { texto: 'Elegibilidade não informada', classe: 'sem-info' },
} as const;

// O quadro da prancha do QGIS: cabeçalho da fazenda, elegibilidade em hectares
// e a legenda de uso do solo com a área de cada classe. Entra no painel de
// informações, acima dos atributos do talhão clicado.
export function MutResumo({
  resumo,
  mut,
  clientId,
}: {
  resumo: ResumoFazenda;
  mut: MutConfig;
  clientId: string;
}) {
  const selo = SELO[resumo.selo];
  const semInfo = resumo.selo === 'sem-info';
  const percentual = resumo.areaTotalHa > 0 ? (resumo.areaElegivelHa / resumo.areaTotalHa) * 100 : 0;

  return (
    <div className="mut-resumo">
      <div className="mut-resumo-fazenda">{resumo.nome || mut.nomeFazenda || `Fazenda ${resumo.codigo}`}</div>
      <div className="mut-resumo-codigo">
        Código {resumo.codigo}
        {resumo.municipio ? ` · ${resumo.municipio}` : ''}
      </div>

      <dl className="mut-resumo-dados">
        <div>
          <dt>Área total</dt>
          <dd>{formatarHa(resumo.areaTotalHa)} ha</dd>
        </div>
        <div>
          <dt>Talhões</dt>
          <dd>{resumo.talhoes}</dd>
        </div>
        {(resumo.periodo || mut.safra) && (
          <div>
            <dt>{resumo.periodo ? 'Período' : 'Safra'}</dt>
            <dd>{resumo.periodo || mut.safra}</dd>
          </div>
        )}
        {resumo.centro && (
          <div>
            <dt>Coordenadas</dt>
            <dd>
              {resumo.centro.lat.toFixed(3)}, {resumo.centro.lng.toFixed(3)}
            </dd>
          </div>
        )}
      </dl>

      <div className={`mut-selo ${selo.classe}`}>{selo.texto}</div>

      {!semInfo && (
        <>
          <div className="mut-barra" aria-hidden>
            <span style={{ width: `${percentual}%`, background: COR_ELEGIVEL }} />
            <span style={{ width: `${100 - percentual}%`, background: COR_INELEGIVEL }} />
          </div>
          <div className="mut-barra-legenda">
            <span>{formatarHa(resumo.areaElegivelHa)} ha elegíveis</span>
            <span>{formatarHa(resumo.areaInelegivelHa)} ha inelegíveis</span>
          </div>
        </>
      )}

      {resumo.classes.length > 0 && (
        <>
          <div className="mut-resumo-titulo">Uso do solo em {mut.anoMut}</div>
          <table className="mut-classes">
            <tbody>
              {resumo.classes.map((classe) => (
                <tr key={classe.nome}>
                  <td>
                    <span className="mut-legenda-cor" style={{ background: classe.cor }} />
                    {classe.nome}
                  </td>
                  <td className="valor">{formatarHa(classe.areaHa)} ha</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <MutGrafico codigo={resumo.codigo} clientId={clientId} mut={mut} />
    </div>
  );
}
