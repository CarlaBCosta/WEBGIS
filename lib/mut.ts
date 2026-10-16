// Regras da visão MUT (Mudança do Uso do Solo), compartilhadas entre o portal,
// o painel administrativo e as rotas de API. Só funções puras: quem desenha no
// mapa é hooks/useMutView.ts.

import { area as turfArea } from '@turf/turf';
import type { MutConfig } from '@/lib/types/domain';

export const COR_ELEGIVEL = '#22c55e';
export const COR_INELEGIVEL = '#ef4444';
export const COR_SEM_CLASSE = '#9ca3af';

export const CAMPO_ELEGIBILIDADE_PADRAO = 'ELEG';
export const VALORES_ELEGIVEL_PADRAO = ['ELEGÍVEL'];

// Maiúsculas e sem acento: o mesmo valor aparece como "ELEGÍVEL", "Elegivel"
// ou "elegível" dependendo de quem preencheu a tabela no QGIS.
export function normalizarTexto(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase();
}

// Leitura de atributo tolerante a maiúsculas/minúsculas no nome do campo.
export function valorDoCampo(
  properties: Record<string, unknown> | undefined | null,
  campo: string | null | undefined
): unknown {
  if (!properties || !campo) return undefined;
  if (campo in properties) return properties[campo];
  const alvo = campo.toUpperCase();
  for (const chave of Object.keys(properties)) {
    if (chave.toUpperCase() === alvo) return properties[chave];
  }
  return undefined;
}

export function ehElegivel(valor: unknown, valoresElegivel: string[]): boolean {
  const v = normalizarTexto(valor);
  if (!v) return false;
  return valoresElegivel.map(normalizarTexto).includes(v);
}

// Área em hectares: usa o campo da tabela quando existe (é o número que a
// equipe calculou no QGIS e que aparece na prancha) e só cai no cálculo
// geodésico quando o campo não veio.
export function areaHaDaFeicao(feature: GeoJSON.Feature, campoArea: string | null): number {
  const bruto = valorDoCampo(feature.properties as Record<string, unknown>, campoArea);
  const numero = typeof bruto === 'number' ? bruto : parseFloat(String(bruto ?? '').replace(',', '.'));
  if (Number.isFinite(numero) && numero > 0) return numero;
  try {
    return turfArea(feature as GeoJSON.Feature) / 10000;
  } catch {
    return 0;
  }
}

export function codigoDaFeicao(feature: GeoJSON.Feature, campoCodigo: string): string {
  const valor = valorDoCampo(feature.properties as Record<string, unknown>, campoCodigo);
  return valor === null || valor === undefined ? '' : String(valor);
}

export interface ResumoClasse {
  nome: string;
  areaHa: number;
  cor: string;
}

export interface ResumoFazenda {
  codigo: string;
  talhoes: number;
  areaTotalHa: number;
  areaElegivelHa: number;
  areaInelegivelHa: number;
  selo: 'elegivel' | 'parcial' | 'inelegivel';
  classes: ResumoClasse[];
  centro: { lat: number; lng: number } | null;
}

export function corDaClasse(classes: { nome: string; cor: string }[], nome: unknown): string {
  const alvo = normalizarTexto(nome);
  if (!alvo) return COR_SEM_CLASSE;
  const achada = classes.find((c) => normalizarTexto(c.nome) === alvo);
  return achada ? achada.cor : COR_SEM_CLASSE;
}

export function corDaFeicao(
  feature: GeoJSON.Feature,
  mut: MutConfig,
  modo: 'elegibilidade' | 'uso'
): { contorno: string; preenchimento: string } {
  const props = feature.properties as Record<string, unknown>;
  const elegivel = ehElegivel(valorDoCampo(props, mut.campoElegibilidade), mut.valoresElegivel);
  const contorno = elegivel ? COR_ELEGIVEL : COR_INELEGIVEL;
  if (modo === 'elegibilidade' || !mut.campoUso) {
    return { contorno, preenchimento: contorno };
  }
  // No modo uso do solo o preenchimento mostra a classe e o contorno continua
  // dizendo se o talhão é elegível — as duas leituras ao mesmo tempo.
  return { contorno, preenchimento: corDaClasse(mut.classes, valorDoCampo(props, mut.campoUso)) };
}

// Soma os talhões de uma fazenda: total, elegível/inelegível e área por classe.
export function resumirFazenda(
  features: GeoJSON.Feature[],
  mut: MutConfig,
  codigo: string
): ResumoFazenda {
  const daFazenda = features.filter((f) => codigoDaFeicao(f, mut.campoCodigo) === codigo);

  let areaTotalHa = 0;
  let areaElegivelHa = 0;
  const porClasse = new Map<string, number>();
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const f of daFazenda) {
    const props = f.properties as Record<string, unknown>;
    const ha = areaHaDaFeicao(f, mut.campoArea);
    areaTotalHa += ha;
    if (ehElegivel(valorDoCampo(props, mut.campoElegibilidade), mut.valoresElegivel)) {
      areaElegivelHa += ha;
    }
    if (mut.campoUso) {
      const classe = String(valorDoCampo(props, mut.campoUso) ?? '').trim() || 'Sem classificação';
      porClasse.set(classe, (porClasse.get(classe) ?? 0) + ha);
    }
    percorrerCoordenadas(f.geometry, (lng, lat) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });
  }

  const areaInelegivelHa = Math.max(areaTotalHa - areaElegivelHa, 0);
  const selo: ResumoFazenda['selo'] =
    areaInelegivelHa <= 0.0005 ? 'elegivel' : areaElegivelHa <= 0.0005 ? 'inelegivel' : 'parcial';

  // Classes na ordem do catálogo; as que não estão no catálogo vão no fim.
  const ordem = new Map(mut.classes.map((c, i) => [normalizarTexto(c.nome), i]));
  const classes: ResumoClasse[] = [...porClasse.entries()]
    .map(([nome, areaHa]) => ({ nome, areaHa, cor: corDaClasse(mut.classes, nome) }))
    .sort(
      (a, b) =>
        (ordem.get(normalizarTexto(a.nome)) ?? 999) - (ordem.get(normalizarTexto(b.nome)) ?? 999) ||
        b.areaHa - a.areaHa
    );

  return {
    codigo,
    talhoes: daFazenda.length,
    areaTotalHa,
    areaElegivelHa,
    areaInelegivelHa,
    selo,
    classes,
    centro:
      minLat === Infinity ? null : { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 },
  };
}

function percorrerCoordenadas(geom: GeoJSON.Geometry | null, visitar: (lng: number, lat: number) => void) {
  if (!geom) return;
  const anda = (valor: unknown) => {
    if (!Array.isArray(valor)) return;
    if (typeof valor[0] === 'number' && typeof valor[1] === 'number') {
      visitar(valor[0] as number, valor[1] as number);
      return;
    }
    for (const item of valor) anda(item);
  };
  if (geom.type !== 'GeometryCollection') anda((geom as { coordinates?: unknown }).coordinates);
  else geom.geometries.forEach((g) => percorrerCoordenadas(g, visitar));
}

export function formatarHa(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// --- Detecção de campos no cadastro -----------------------------------------

const PISTAS = {
  codigo: ['FAZENDA', 'COD_FAZENDA', 'CODIGO', 'COD', 'CHAVE_USIN', 'CHAVE_AMB'],
  talhao: ['TALHAO', 'TALHÃO', 'TALHOES', 'LOTE'],
  area: ['AREA', 'ÁREA', 'AREA_HA', 'HA', 'AREA_HECTARE'],
  elegibilidade: ['ELEG', 'ELEGIBILIDADE', 'ELEGIVEL', 'ELEGÍVEL', 'STATUS_ELEG'],
  uso: ['USO', 'USO_SOLO', 'USO_DO_SOLO', 'CLASSE', 'CLASSE_USO', 'COBERTURA', 'LULC', 'MUT'],
} as const;

export type CamposMut = { [K in keyof typeof PISTAS]: string | null };

// Qual campo do arquivo corresponde a cada informação da visão MUT.
export function detectarCamposMut(campos: string[]): CamposMut {
  const achar = (pistas: readonly string[]) => {
    const normalizados = campos.map((c) => ({ campo: c, chave: normalizarTexto(c) }));
    for (const pista of pistas) {
      const exato = normalizados.find((c) => c.chave === normalizarTexto(pista));
      if (exato) return exato.campo;
    }
    for (const pista of pistas) {
      const parcial = normalizados.find((c) => c.chave.includes(normalizarTexto(pista)));
      if (parcial) return parcial.campo;
    }
    return null;
  };
  return {
    codigo: achar(PISTAS.codigo),
    talhao: achar(PISTAS.talhao),
    area: achar(PISTAS.area),
    elegibilidade: achar(PISTAS.elegibilidade),
    uso: achar(PISTAS.uso),
  };
}

// A camada tem cara de MUT? Precisa de código e de elegibilidade.
export function pareceCamadaMut(campos: string[]): boolean {
  const detectado = detectarCamposMut(campos);
  return !!detectado.codigo && !!detectado.elegibilidade;
}
