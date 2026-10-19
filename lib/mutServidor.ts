import 'server-only';
import { lerCamposDaCamada } from '@/lib/timelapseServidor';
import {
  detectarCamposFazenda,
  detectarCamposMut,
  pareceCamadaFazendas,
  pareceCamadaMut,
  type CamposFazenda,
  type CamposMut,
} from '@/lib/mut';

export interface SugestaoMut {
  layerKey: string;
  campos: string[];
  detectado: CamposMut;
}

export interface SugestaoFazendas {
  layerKey: string;
  campos: string[];
  detectado: CamposFazenda;
}

// Nomes que costumam indicar a camada de mudança do uso do solo.
const PADROES = [/(^|_)mut(_|$)/i, /uso_?do_?solo/i, /uso_solo/i, /fazenda/i, /talh/i];

// Lê os atributos de uma camada e diz qual campo é o quê.
export async function lerCamposMut(storagePath: string | null): Promise<SugestaoMut['detectado'] | null> {
  if (!storagePath) return null;
  const campos = await lerCamposDaCamada(storagePath, 65536);
  return campos.length ? detectarCamposMut(campos) : null;
}

// Sugere a camada MUT do cliente: primeiro pelo nome, depois pelos atributos
// (precisa ter código da fazenda e elegibilidade).
export async function sugerirCamadaMut(
  camadas: { layer_key: string; storage_path: string | null }[],
  preferida?: string | null
): Promise<SugestaoMut | null> {
  const porNome = camadas.find((c) => PADROES.some((p) => p.test(c.layer_key)));
  const escolhida = preferida ? camadas.find((c) => c.layer_key === preferida) : undefined;
  const ordem = [escolhida, porNome, ...camadas].filter(Boolean) as typeof camadas;

  const vistos = new Set<string>();
  for (const camada of ordem) {
    if (!camada.storage_path || vistos.has(camada.layer_key)) continue;
    vistos.add(camada.layer_key);
    const campos = await lerCamposDaCamada(camada.storage_path, 65536);
    if (!campos.length) continue;
    if (camada.layer_key === preferida || pareceCamadaMut(campos)) {
      return { layerKey: camada.layer_key, campos, detectado: detectarCamposMut(campos) };
    }
  }
  return null;
}

const PADROES_FAZENDAS = [/atlas/i, /fazenda/i, /imove/i, /propriedade/i];

// Sugere a camada das fazendas (Atlas): uma feição por fazenda, com nome e
// elegibilidade.
export async function sugerirCamadaFazendas(
  camadas: { layer_key: string; storage_path: string | null }[],
  preferida?: string | null
): Promise<SugestaoFazendas | null> {
  const porNome = camadas.find((c) => PADROES_FAZENDAS.some((p) => p.test(c.layer_key)));
  const escolhida = preferida ? camadas.find((c) => c.layer_key === preferida) : undefined;
  const ordem = [escolhida, porNome, ...camadas].filter(Boolean) as typeof camadas;

  const vistos = new Set<string>();
  for (const camada of ordem) {
    if (!camada.storage_path || vistos.has(camada.layer_key)) continue;
    vistos.add(camada.layer_key);
    const campos = await lerCamposDaCamada(camada.storage_path, 65536);
    if (!campos.length) continue;
    if (camada.layer_key === preferida || pareceCamadaFazendas(campos)) {
      return { layerKey: camada.layer_key, campos, detectado: detectarCamposFazenda(campos) };
    }
  }
  return null;
}
