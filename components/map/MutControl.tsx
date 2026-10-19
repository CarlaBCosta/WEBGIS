'use client';

import type { MutConfig } from '@/lib/types/domain';
import type { ModoCorMut } from '@/hooks/useMutView';
import { COR_ELEGIVEL, COR_INELEGIVEL } from '@/lib/mut';

interface MutControlProps {
  mut: MutConfig;
  ativo: boolean;
  carregando: boolean;
  erro: string;
  modo: ModoCorMut;
  // false quando a camada não traz o campo de elegibilidade preenchido.
  temElegibilidade: boolean;
  onAlternar: () => void;
  onModo: (modo: ModoCorMut) => void;
}

// Liga/desliga a visão MUT, escolhe o modo de cor e mostra a legenda
// correspondente. Fica no topo do painel de camadas.
export function MutControl({
  mut,
  ativo,
  carregando,
  erro,
  modo,
  temElegibilidade,
  onAlternar,
  onModo,
}: MutControlProps) {
  const temUso = !!mut.campoUso;
  const modoAtual: ModoCorMut = temUso && (modo === 'uso' || !temElegibilidade) ? 'uso' : 'elegibilidade';

  return (
    <div className={`mut-control${ativo ? ' ativo' : ''}`}>
      <div className="mut-control-head" onClick={onAlternar}>
        <div>
          <div className="mut-control-title">Visão MUT</div>
          <div className="mut-control-sub">
            {carregando ? 'Carregando os talhões...' : 'Mudança do uso do solo'}
          </div>
        </div>
        <label className="switch" onClick={(e) => e.stopPropagation()}>
          <input type="checkbox" checked={ativo} onChange={onAlternar} aria-label="Visão MUT" />
          <span className="slider" />
        </label>
      </div>

      {erro && <p className="mut-erro">{erro}</p>}

      {ativo && (
        <div className="mut-control-corpo">
          <div className="mut-modos" role="group" aria-label="Cor dos talhões">
            <button
              type="button"
              className={modoAtual === 'elegibilidade' ? 'ativo' : ''}
              onClick={() => temElegibilidade && onModo('elegibilidade')}
              disabled={!temElegibilidade}
              title={temElegibilidade ? undefined : 'Esta camada ainda não tem o campo de elegibilidade.'}
            >
              Elegibilidade
            </button>
            <button
              type="button"
              className={modoAtual === 'uso' ? 'ativo' : ''}
              onClick={() => temUso && onModo('uso')}
              disabled={!temUso}
              title={temUso ? undefined : 'Esta camada ainda não tem o campo de uso do solo.'}
            >
              Uso do Solo
            </button>
          </div>

          {!temUso && (
            <p className="mut-aviso">
              A camada não tem o campo de uso do solo; por enquanto só a elegibilidade é exibida.
            </p>
          )}
          {temUso && !temElegibilidade && (
            <p className="mut-aviso">
              A camada não tem o campo de elegibilidade; por enquanto só o uso do solo é exibido.
            </p>
          )}

          <ul className="mut-legenda">
            {modoAtual === 'elegibilidade' ? (
              <>
                <li>
                  <span className="mut-legenda-cor" style={{ background: COR_ELEGIVEL }} />
                  Elegível
                </li>
                <li>
                  <span className="mut-legenda-cor" style={{ background: COR_INELEGIVEL }} />
                  Inelegível
                </li>
              </>
            ) : (
              mut.classes.map((classe) => (
                <li key={classe.nome}>
                  <span className="mut-legenda-cor" style={{ background: classe.cor }} />
                  {classe.nome}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
