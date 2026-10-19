import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { MutConfig } from '@/lib/types/domain';
import type { FeatureCollectionData } from './useLayerData';
import {
  COR_ELEGIVEL,
  COR_INELEGIVEL,
  COR_SEM_INFO,
  codigoDaFeicao,
  corDaFeicao,
  ehElegivel,
  elegibilidadeDaFeicao,
  formatarHa,
  areaHaDaFeicao,
  indexarFazendas,
  resumirFazenda,
  nomeDeExibicaoDaClasse,
  valorDoCampo,
  type IndiceFazendas,
  type ResumoFazenda,
} from '@/lib/mut';

export type ModoCorMut = 'elegibilidade' | 'uso';

interface Opcoes {
  map: L.Map | null;
  mut: MutConfig | null;
  loadLayer: (layerKey: string) => Promise<FeatureCollectionData>;
  onSelecionarFeicao: (feature: GeoJSON.Feature, layerName: string) => void;
  // Mapa das camadas no ar (de useLayerVisibility). A camada MUT entra nele
  // enquanto a visão está ligada para a busca por código também achá-la.
  camadasNoAr: Map<string, L.GeoJSON>;
}

const ESTILO_DESTAQUE: L.PathOptions = { weight: 3.5, fillOpacity: 0.65 };

function escapar(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Cor do contorno de uma fazenda do Atlas, pela elegibilidade dela.
function corDaFazenda(
  props: Record<string, unknown>,
  campo: string | null,
  valoresElegivel: string[]
): string {
  const bruto = valorDoCampo(props, campo ?? '');
  const valor = String(bruto ?? '').trim();
  if (!valor) return COR_SEM_INFO;
  return ehElegivel(valor, valoresElegivel) ? COR_ELEGIVEL : COR_INELEGIVEL;
}

// Visão MUT: desenha a camada de mudança do uso do solo com cor por
// elegibilidade ou por classe de uso, mostra os dados no hover e resume a
// fazenda inteira quando um talhão é clicado. A camada é desta visão: enquanto
// ela está ligada, a mesma camada fica desligada no painel de camadas comum.
export function useMutView({ map, mut, loadLayer, onSelecionarFeicao, camadasNoAr }: Opcoes) {
  const [ativo, setAtivo] = useState(false);
  const [modo, setModo] = useState<ModoCorMut>('elegibilidade');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [resumo, setResumo] = useState<ResumoFazenda | null>(null);
  // Camada sem o campo de elegibilidade (ou com ele vazio): a visão entra
  // mostrando o uso do solo, sem pintar nada de vermelho.
  const [temElegibilidade, setTemElegibilidade] = useState(true);

  const camadaRef = useRef<L.GeoJSON | null>(null);
  const dadosRef = useRef<FeatureCollectionData | null>(null);
  // Contorno das fazendas (Atlas) e o índice código -> dados da fazenda.
  const contornosRef = useRef<L.GeoJSON | null>(null);
  const fazendasRef = useRef<IndiceFazendas | undefined>(undefined);
  // O modo fica também num ref para a função de estilo da camada continuar
  // estável: o Leaflet guarda a função no momento em que a camada é criada.
  const modoRef = useRef<ModoCorMut>('elegibilidade');

  const estiloDaFeicao = useCallback(
    (feature?: GeoJSON.Feature): L.PathOptions => {
      if (!feature || !mut) return {};
      const { contorno, preenchimento } = corDaFeicao(feature, mut, modoRef.current, fazendasRef.current);
      return {
        color: contorno,
        weight: 2,
        opacity: 1,
        fillColor: preenchimento,
        fillOpacity: 0.45,
      };
    },
    [mut]
  );

  // Mesmos dados do popup, só que sem precisar clicar.
  const textoDoHover = useCallback(
    (feature: GeoJSON.Feature): string => {
      if (!mut) return '';
      const props = feature.properties as Record<string, unknown>;
      const situacao = elegibilidadeDaFeicao(feature, mut, fazendasRef.current);
      const talhao = mut.campoTalhao ? valorDoCampo(props, mut.campoTalhao) : undefined;
      const uso = mut.campoUso
        ? nomeDeExibicaoDaClasse(mut.classes, valorDoCampo(props, mut.campoUso))
        : '';
      const codigo = codigoDaFeicao(feature, mut.campoCodigo);
      const dadosFazenda = fazendasRef.current?.get(codigo);
      const nome = mut.fazendas?.campoNome
        ? String(valorDoCampo(dadosFazenda, mut.fazendas.campoNome) ?? '')
        : '';
      const linhas = [
        `<strong>${nome ? escapar(nome) : `Fazenda ${escapar(codigo)}`}</strong>`,
        nome ? `Fazenda ${escapar(codigo)}` : '',
        talhao !== undefined && talhao !== null && talhao !== '' ? `Talhão ${escapar(talhao)}` : '',
        `${formatarHa(areaHaDaFeicao(feature, mut.campoArea))} ha`,
        uso ? escapar(uso) : '',
        situacao === 'desconhecida'
          ? ''
          : `<span class="mut-tag ${situacao}">${
              situacao === 'elegivel' ? 'Elegível' : 'Inelegível'
            }</span>`,
      ].filter(Boolean);
      return `<div class="mut-tooltip">${linhas.join('<br>')}</div>`;
    },
    [mut]
  );

  const selecionar = useCallback(
    (feature: GeoJSON.Feature) => {
      if (!mut) return;
      onSelecionarFeicao(feature, mut.layerKey);
      const dados = dadosRef.current;
      if (!dados) return;
      const codigo = codigoDaFeicao(feature, mut.campoCodigo);
      setResumo(
        resumirFazenda(
          dados.features as unknown as GeoJSON.Feature[],
          mut,
          codigo,
          fazendasRef.current
        )
      );
    },
    [mut, onSelecionarFeicao]
  );

  const limparSelecao = useCallback(() => setResumo(null), []);

  const desligar = useCallback(() => {
    if (map && camadaRef.current) map.removeLayer(camadaRef.current);
    if (map && contornosRef.current) map.removeLayer(contornosRef.current);
    if (mut) camadasNoAr.delete(mut.layerKey);
    camadaRef.current = null;
    contornosRef.current = null;
    setAtivo(false);
    setResumo(null);
  }, [map, mut, camadasNoAr]);

  const ligar = useCallback(async () => {
    if (!map || !mut) return;
    setErro('');
    setCarregando(true);
    try {
      const dados = dadosRef.current ?? (await loadLayer(mut.layerKey));
      dadosRef.current = dados;

      // Camada das fazendas (Atlas): elegibilidade, nome e período vêm dela.
      if (mut.fazendas && !fazendasRef.current) {
        try {
          const atlas = await loadLayer(mut.fazendas.layerKey);
          fazendasRef.current = indexarFazendas(
            atlas.features as unknown as GeoJSON.Feature[],
            mut.fazendas.campoCodigo
          );
          contornosRef.current = L.geoJSON(atlas as unknown as GeoJSON.FeatureCollection, {
            interactive: false,
            style: (feature) => ({
              color: corDaFazenda(
                (feature?.properties ?? {}) as Record<string, unknown>,
                mut.fazendas!.campoElegibilidade,
                mut.valoresElegivel
              ),
              weight: 1.5,
              opacity: 0.9,
              fill: false,
            }),
          });
        } catch {
          // Sem o Atlas a visão continua: só perde o cabeçalho e a elegibilidade.
          fazendasRef.current = undefined;
        }
      }
      if (!dados.features?.length) {
        setErro('A camada MUT deste cliente está vazia.');
        return;
      }

      const feicoes = dados.features as unknown as GeoJSON.Feature[];
      const temEleg = feicoes.some(
        (f) => elegibilidadeDaFeicao(f, mut, fazendasRef.current) !== 'desconhecida'
      );
      setTemElegibilidade(temEleg);
      if (!temEleg && mut.campoUso) {
        modoRef.current = 'uso';
        setModo('uso');
      }

      const camada = L.geoJSON(dados as unknown as GeoJSON.FeatureCollection, {
        style: (feature) => estiloDaFeicao(feature as GeoJSON.Feature),
        onEachFeature: (feature, layer) => {
          // Guarda a opacidade base do preenchimento, como nas camadas comuns:
          // é o que a busca por código restaura ao limpar o filtro.
          (layer as L.Path & { _baseFillOpacity?: number })._baseFillOpacity = 0.45;
          layer.bindTooltip(textoDoHover(feature as GeoJSON.Feature), {
            sticky: true,
            direction: 'top',
            className: 'mut-tooltip-wrapper',
          });
          layer.on({
            mouseover: (e) => {
              const alvo = e.target as L.Path & { _estiloAntesDoHover?: L.PathOptions };
              // Guarda como o talhão estava (a busca por código apaga os que
              // não batem) para devolver o mesmo estilo ao sair.
              alvo._estiloAntesDoHover = {
                opacity: alvo.options.opacity,
                fillOpacity: alvo.options.fillOpacity,
                weight: alvo.options.weight,
              };
              alvo.setStyle(ESTILO_DESTAQUE);
            },
            mouseout: (e) => {
              const alvo = e.target as L.Path & { _estiloAntesDoHover?: L.PathOptions };
              alvo.setStyle(alvo._estiloAntesDoHover ?? estiloDaFeicao(feature as GeoJSON.Feature));
            },
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              selecionar(feature as GeoJSON.Feature);
            },
          });
        },
      });

      contornosRef.current?.addTo(map);
      camada.addTo(map);
      camadaRef.current = camada;
      camadasNoAr.set(mut.layerKey, camada);
      setAtivo(true);
      const limites = camada.getBounds();
      if (limites.isValid()) map.fitBounds(limites, { padding: [40, 40] });
    } catch {
      setErro('Não foi possível carregar a camada MUT. Tente de novo.');
    } finally {
      setCarregando(false);
    }
  }, [map, mut, loadLayer, estiloDaFeicao, textoDoHover, selecionar, camadasNoAr]);

  const alternar = useCallback(() => {
    if (camadaRef.current) desligar();
    else ligar();
  }, [ligar, desligar]);

  // Troca de cor sem recarregar nem redesenhar a camada. A transparência de
  // cada talhão é preservada: a busca por código apaga os que não batem, e
  // trocar o modo de cor não pode acender todos de volta.
  useEffect(() => {
    modoRef.current = modo;
    camadaRef.current?.eachLayer((camada) => {
      const alvo = camada as L.Path & { feature?: GeoJSON.Feature };
      if (!alvo.feature || typeof alvo.setStyle !== 'function') return;
      alvo.setStyle({
        ...estiloDaFeicao(alvo.feature),
        opacity: alvo.options.opacity,
        fillOpacity: alvo.options.fillOpacity,
      });
    });
  }, [modo, estiloDaFeicao]);

  // Tira a camada do mapa ao sair da página.
  useEffect(() => {
    const registro = camadasNoAr;
    const chave = mut?.layerKey;
    return () => {
      if (map && camadaRef.current) map.removeLayer(camadaRef.current);
      if (chave) registro.delete(chave);
      camadaRef.current = null;
    };
  }, [map, mut?.layerKey, camadasNoAr]);

  return {
    disponivel: !!mut,
    temElegibilidade,
    ativo,
    carregando,
    erro,
    modo,
    setModo,
    alternar,
    resumo,
    limparSelecao,
  };
}
