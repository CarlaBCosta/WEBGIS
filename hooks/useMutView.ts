import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { MutConfig } from '@/lib/types/domain';
import type { FeatureCollectionData } from './useLayerData';
import {
  codigoDaFeicao,
  corDaFeicao,
  ehElegivel,
  formatarHa,
  areaHaDaFeicao,
  resumirFazenda,
  valorDoCampo,
  type ResumoFazenda,
} from '@/lib/mut';

export type ModoCorMut = 'elegibilidade' | 'uso';

interface Opcoes {
  map: L.Map | null;
  mut: MutConfig | null;
  loadLayer: (layerKey: string) => Promise<FeatureCollectionData>;
  onSelecionarFeicao: (feature: GeoJSON.Feature, layerName: string) => void;
}

const ESTILO_DESTAQUE: L.PathOptions = { weight: 3.5, fillOpacity: 0.65 };

function escapar(valor: unknown): string {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Visão MUT: desenha a camada de mudança do uso do solo com cor por
// elegibilidade ou por classe de uso, mostra os dados no hover e resume a
// fazenda inteira quando um talhão é clicado. A camada é desta visão: enquanto
// ela está ligada, a mesma camada fica desligada no painel de camadas comum.
export function useMutView({ map, mut, loadLayer, onSelecionarFeicao }: Opcoes) {
  const [ativo, setAtivo] = useState(false);
  const [modo, setModo] = useState<ModoCorMut>('elegibilidade');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [resumo, setResumo] = useState<ResumoFazenda | null>(null);

  const camadaRef = useRef<L.GeoJSON | null>(null);
  const dadosRef = useRef<FeatureCollectionData | null>(null);
  // O modo fica também num ref para a função de estilo da camada continuar
  // estável: o Leaflet guarda a função no momento em que a camada é criada.
  const modoRef = useRef<ModoCorMut>('elegibilidade');

  const estiloDaFeicao = useCallback(
    (feature?: GeoJSON.Feature): L.PathOptions => {
      if (!feature || !mut) return {};
      const { contorno, preenchimento } = corDaFeicao(feature, mut, modoRef.current);
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
      const elegivel = ehElegivel(valorDoCampo(props, mut.campoElegibilidade), mut.valoresElegivel);
      const talhao = mut.campoTalhao ? valorDoCampo(props, mut.campoTalhao) : undefined;
      const uso = mut.campoUso ? valorDoCampo(props, mut.campoUso) : undefined;
      const linhas = [
        `<strong>Fazenda ${escapar(codigoDaFeicao(feature, mut.campoCodigo))}</strong>`,
        talhao !== undefined && talhao !== null && talhao !== '' ? `Talhão ${escapar(talhao)}` : '',
        `${formatarHa(areaHaDaFeicao(feature, mut.campoArea))} ha`,
        uso ? escapar(uso) : '',
        `<span class="mut-tag ${elegivel ? 'elegivel' : 'inelegivel'}">${
          elegivel ? 'Elegível' : 'Inelegível'
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
      setResumo(resumirFazenda(dados.features as unknown as GeoJSON.Feature[], mut, codigo));
    },
    [mut, onSelecionarFeicao]
  );

  const limparSelecao = useCallback(() => setResumo(null), []);

  const desligar = useCallback(() => {
    if (map && camadaRef.current) map.removeLayer(camadaRef.current);
    camadaRef.current = null;
    setAtivo(false);
    setResumo(null);
  }, [map]);

  const ligar = useCallback(async () => {
    if (!map || !mut) return;
    setErro('');
    setCarregando(true);
    try {
      const dados = dadosRef.current ?? (await loadLayer(mut.layerKey));
      dadosRef.current = dados;
      if (!dados.features?.length) {
        setErro('A camada MUT deste cliente está vazia.');
        return;
      }

      const camada = L.geoJSON(dados as unknown as GeoJSON.FeatureCollection, {
        style: (feature) => estiloDaFeicao(feature as GeoJSON.Feature),
        onEachFeature: (feature, layer) => {
          layer.bindTooltip(textoDoHover(feature as GeoJSON.Feature), {
            sticky: true,
            direction: 'top',
            className: 'mut-tooltip-wrapper',
          });
          layer.on({
            mouseover: (e) => (e.target as L.Path).setStyle(ESTILO_DESTAQUE),
            mouseout: (e) =>
              (e.target as L.Path).setStyle(estiloDaFeicao(feature as GeoJSON.Feature)),
            click: (e) => {
              L.DomEvent.stopPropagation(e);
              selecionar(feature as GeoJSON.Feature);
            },
          });
        },
      });

      camada.addTo(map);
      camadaRef.current = camada;
      setAtivo(true);
      const limites = camada.getBounds();
      if (limites.isValid()) map.fitBounds(limites, { padding: [40, 40] });
    } catch {
      setErro('Não foi possível carregar a camada MUT. Tente de novo.');
    } finally {
      setCarregando(false);
    }
  }, [map, mut, loadLayer, estiloDaFeicao, textoDoHover, selecionar]);

  const alternar = useCallback(() => {
    if (camadaRef.current) desligar();
    else ligar();
  }, [ligar, desligar]);

  // Troca de cor sem recarregar nem redesenhar a camada.
  useEffect(() => {
    modoRef.current = modo;
    camadaRef.current?.setStyle((feature) => estiloDaFeicao(feature as GeoJSON.Feature));
  }, [modo, estiloDaFeicao]);

  // Tira a camada do mapa ao sair da página.
  useEffect(() => {
    return () => {
      if (map && camadaRef.current) map.removeLayer(camadaRef.current);
      camadaRef.current = null;
    };
  }, [map]);

  return {
    disponivel: !!mut,
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
