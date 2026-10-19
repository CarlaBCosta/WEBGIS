// Regras da visão MUT (Mudança do Uso do Solo), compartilhadas entre o portal,
// o painel administrativo e as rotas de API. Só funções puras: quem desenha no
// mapa é hooks/useMutView.ts.

import { area as turfArea } from '@turf/turf';
import type { MutConfig } from '@/lib/types/domain';

export const COR_ELEGIVEL = '#22c55e';
export const COR_INELEGIVEL = '#ef4444';
export const COR_SEM_CLASSE = '#9ca3af';
// Camada sem o campo de elegibilidade: nem verde nem vermelho.
export const COR_SEM_INFO = '#e5e7eb';

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

// As classes saem do QGIS numeradas e sem acento ("4-Lavoura de Graos"); o
// catálogo guarda o nome por extenso ("Lavoura de Grãos"). A comparação ignora
// o número, os acentos e as maiúsculas.
export function normalizarClasse(valor: unknown): string {
  return normalizarTexto(valor).replace(/^\d+\s*[-–.]\s*/, '');
}

// Nome de exibição da classe: sem o número do QGIS.
export function rotuloDaClasse(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .replace(/^\d+\s*[-–.]\s*/, '');
}

export type Elegibilidade = 'elegivel' | 'inelegivel' | 'desconhecida';

// Tri-estado: camada sem o campo de elegibilidade (ou com o campo vazio) não
// pode ser pintada de vermelho — isso diria que a área é inelegível.
//
// Com a camada das fazendas (Atlas) configurada, quem decide é a fazenda: é
// assim que a certificação avalia, a fazenda inteira é elegível ou não.
export function elegibilidadeDaFeicao(
  feature: GeoJSON.Feature,
  mut: MutConfig,
  fazendas?: IndiceFazendas
): Elegibilidade {
  const campoFazenda = mut.fazendas?.campoElegibilidade;
  if (fazendas && campoFazenda) {
    const codigo = codigoDaFeicao(feature, mut.campoCodigo);
    const dados = fazendas.get(codigo);
    if (dados) return situacao(valorDoCampo(dados, campoFazenda), mut.valoresElegivel);
  }
  return situacao(
    valorDoCampo(feature.properties as Record<string, unknown>, mut.campoElegibilidade),
    mut.valoresElegivel
  );
}

function situacao(bruto: unknown, valoresElegivel: string[]): Elegibilidade {
  if (bruto === undefined || bruto === null || String(bruto).trim() === '') return 'desconhecida';
  return ehElegivel(bruto, valoresElegivel) ? 'elegivel' : 'inelegivel';
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
  // Dados do cabeçalho, quando a camada das fazendas (Atlas) está configurada.
  nome: string;
  periodo: string;
  municipio: string;
  talhoes: number;
  areaTotalHa: number;
  areaElegivelHa: number;
  areaInelegivelHa: number;
  // Área dos talhões que não trazem o campo de elegibilidade.
  areaSemInfoHa: number;
  selo: 'elegivel' | 'parcial' | 'inelegivel' | 'sem-info';
  classes: ResumoClasse[];
  centro: { lat: number; lng: number } | null;
}

// Nome como aparece na tela: o do catálogo (acentuado) quando a classe do
// arquivo corresponde a alguma, senão o próprio nome do arquivo sem o número.
export function nomeDeExibicaoDaClasse(classes: { nome: string }[], nome: unknown): string {
  const alvo = normalizarClasse(nome);
  const achada = classes.find((c) => normalizarClasse(c.nome) === alvo);
  return achada ? achada.nome : rotuloDaClasse(nome) || 'Sem classificação';
}

// Índice código da fazenda -> atributos da feição do Atlas.
export type IndiceFazendas = Map<string, Record<string, unknown>>;

export function indexarFazendas(
  features: GeoJSON.Feature[],
  campoCodigo: string
): IndiceFazendas {
  const indice: IndiceFazendas = new Map();
  for (const f of features) {
    const codigo = codigoDaFeicao(f, campoCodigo);
    if (codigo) indice.set(codigo, (f.properties ?? {}) as Record<string, unknown>);
  }
  return indice;
}

export function corDaClasse(classes: { nome: string; cor: string }[], nome: unknown): string {
  const alvo = normalizarClasse(nome);
  if (!alvo) return COR_SEM_CLASSE;
  const achada = classes.find((c) => normalizarClasse(c.nome) === alvo);
  return achada ? achada.cor : COR_SEM_CLASSE;
}

export function corDaFeicao(
  feature: GeoJSON.Feature,
  mut: MutConfig,
  modo: 'elegibilidade' | 'uso',
  fazendas?: IndiceFazendas
): { contorno: string; preenchimento: string } {
  const props = feature.properties as Record<string, unknown>;
  const situacao = elegibilidadeDaFeicao(feature, mut, fazendas);
  const contorno =
    situacao === 'elegivel' ? COR_ELEGIVEL : situacao === 'inelegivel' ? COR_INELEGIVEL : COR_SEM_INFO;
  if (modo === 'elegibilidade' || !mut.campoUso) {
    return { contorno, preenchimento: contorno };
  }
  // No modo uso do solo o preenchimento mostra a classe e o contorno continua
  // dizendo se o talhão é elegível — as duas leituras ao mesmo tempo. Sem
  // elegibilidade no arquivo, o contorno acompanha a classe: um traço neutro
  // em volta de cada polígono apagaria a cor dos talhões pequenos.
  const preenchimento = corDaClasse(mut.classes, valorDoCampo(props, mut.campoUso));
  return { contorno: situacao === 'desconhecida' ? preenchimento : contorno, preenchimento };
}

// Soma os talhões de uma fazenda: total, elegível/inelegível e área por classe.
export function resumirFazenda(
  features: GeoJSON.Feature[],
  mut: MutConfig,
  codigo: string,
  fazendas?: IndiceFazendas
): ResumoFazenda {
  const daFazenda = features.filter((f) => codigoDaFeicao(f, mut.campoCodigo) === codigo);
  const atlas = fazendas?.get(codigo);

  let areaTotalHa = 0;
  let areaElegivelHa = 0;
  let areaSemInfoHa = 0;
  const porClasse = new Map<string, number>();
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const f of daFazenda) {
    const props = f.properties as Record<string, unknown>;
    const ha = areaHaDaFeicao(f, mut.campoArea);
    areaTotalHa += ha;
    const situacao = elegibilidadeDaFeicao(f, mut);
    if (situacao === 'elegivel') areaElegivelHa += ha;
    else if (situacao === 'desconhecida') areaSemInfoHa += ha;
    if (mut.campoUso) {
      const classe = nomeDeExibicaoDaClasse(mut.classes, valorDoCampo(props, mut.campoUso));
      porClasse.set(classe, (porClasse.get(classe) ?? 0) + ha);
    }
    percorrerCoordenadas(f.geometry, (lng, lat) => {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    });
  }

  // Com o Atlas, a área total e as áreas por classe saem de lá: são os números
  // da prancha, e eles fecham exatamente com a área da fazenda.
  if (atlas) {
    const areaAtlas = Number(valorDoCampo(atlas, mut.fazendas?.campoArea ?? '') ?? NaN);
    const porClasseAtlas = new Map<string, number>();
    for (const classe of mut.classes) {
      if (!classe.campoAtlas) continue;
      const ha = Number(valorDoCampo(atlas, classe.campoAtlas) ?? 0);
      if (Number.isFinite(ha) && ha > 0) porClasseAtlas.set(classe.nome, ha);
    }
    if (porClasseAtlas.size > 0) {
      porClasse.clear();
      for (const [nome, ha] of porClasseAtlas) porClasse.set(nome, ha);
    }
    if (Number.isFinite(areaAtlas) && areaAtlas > 0) {
      areaTotalHa = areaAtlas;
    } else if (porClasseAtlas.size > 0) {
      areaTotalHa = [...porClasseAtlas.values()].reduce((a, b) => a + b, 0);
    }
    const situacaoFazenda = situacao(
      valorDoCampo(atlas, mut.fazendas?.campoElegibilidade ?? ''),
      mut.valoresElegivel
    );
    areaElegivelHa = situacaoFazenda === 'elegivel' ? areaTotalHa : 0;
    areaSemInfoHa = situacaoFazenda === 'desconhecida' ? areaTotalHa : 0;
  }

  const areaInelegivelHa = Math.max(areaTotalHa - areaElegivelHa - areaSemInfoHa, 0);
  const selo: ResumoFazenda['selo'] =
    areaElegivelHa <= 0.0005 && areaInelegivelHa <= 0.0005
      ? 'sem-info'
      : areaInelegivelHa <= 0.0005
        ? 'elegivel'
        : areaElegivelHa <= 0.0005
          ? 'inelegivel'
          : 'parcial';

  // Classes na ordem do catálogo; as que não estão no catálogo vão no fim.
  const ordem = new Map(mut.classes.map((c, i) => [normalizarClasse(c.nome), i]));
  const classes: ResumoClasse[] = [...porClasse.entries()]
    .map(([nome, areaHa]) => ({ nome, areaHa, cor: corDaClasse(mut.classes, nome) }))
    .sort(
      (a, b) =>
        (ordem.get(normalizarClasse(a.nome)) ?? 999) - (ordem.get(normalizarClasse(b.nome)) ?? 999) ||
        b.areaHa - a.areaHa
    );

  const latlong = String(valorDoCampo(atlas, mut.fazendas?.campoLatLong ?? '') ?? '')
    .split(',')
    .map((n) => Number(n.trim()));

  return {
    codigo,
    nome: String(valorDoCampo(atlas, mut.fazendas?.campoNome ?? '') ?? ''),
    periodo: String(valorDoCampo(atlas, mut.fazendas?.campoPeriodo ?? '') ?? ''),
    municipio: [valorDoCampo(atlas, 'Municipio'), valorDoCampo(atlas, 'Estado')]
      .filter(Boolean)
      .join(' / '),
    talhoes: daFazenda.length,
    areaTotalHa,
    areaElegivelHa,
    areaInelegivelHa,
    areaSemInfoHa,
    selo,
    classes,
    centro:
      latlong.length === 2 && latlong.every(Number.isFinite)
        ? { lat: latlong[0], lng: latlong[1] }
        : minLat === Infinity
          ? null
          : { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 },
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
  codigo: ['CODIGO', 'FAZENDA', 'COD_FAZENDA', 'COD', 'CHAVE_USIN', 'CHAVE_AMB'],
  talhao: ['TALHAO', 'TALHÃO', 'TALHOES', 'LOTE'],
  // AREA_MUT é a área do próprio polígono do MUT; AREA e AREA_GIS costumam ser
  // a área do talhão agrícola e a da fazenda inteira.
  area: ['AREA_MUT', 'AREA_HA', 'AREA', 'ÁREA', 'HA', 'AREA_HECTARE'],
  elegibilidade: ['ELEG', 'ELEGIBILIDADE', 'ELEGIVEL', 'ELEGÍVEL', 'STATUS_ELEG'],
  uso: ['CLASSE_08', 'USO', 'USO_SOLO', 'USO_DO_SOLO', 'CLASSE', 'CLASSE_USO', 'COBERTURA', 'LULC', 'MUT'],
} as const;

export type CamposMut = { [K in keyof typeof PISTAS]: string | null };

const PISTAS_FAZENDA = {
  codigo: ['CHAVE_AMB', 'CODIGO', 'FAZENDA', 'COD_FAZENDA'],
  nome: ['NOME_FAZ', 'NOME_FAZENDA', 'NOME', 'FAZENDA_NOME'],
  area: ['AREA', 'AREA_HA', 'AREA_TOTAL'],
  periodo: ['PERIODO', 'SAFRA'],
  latlong: ['LATLONG', 'LAT_LONG', 'COORDENADAS'],
  elegibilidade: ['ELEGIB', 'ELEG', 'ELEGIBILIDADE', 'ELEGIVEL'],
} as const;

export type CamposFazenda = { [K in keyof typeof PISTAS_FAZENDA]: string | null };

// Qual campo da camada das fazendas (Atlas) corresponde a cada informação.
export function detectarCamposFazenda(campos: string[]): CamposFazenda {
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
    codigo: achar(PISTAS_FAZENDA.codigo),
    nome: achar(PISTAS_FAZENDA.nome),
    area: achar(PISTAS_FAZENDA.area),
    periodo: achar(PISTAS_FAZENDA.periodo),
    latlong: achar(PISTAS_FAZENDA.latlong),
    elegibilidade: achar(PISTAS_FAZENDA.elegibilidade),
  };
}

// A camada tem cara de Atlas (uma feição por fazenda)? Precisa do código e do
// nome ou da elegibilidade.
export function pareceCamadaFazendas(campos: string[]): boolean {
  const d = detectarCamposFazenda(campos);
  return !!d.codigo && (!!d.nome || !!d.elegibilidade);
}

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

// A camada tem cara de MUT? Precisa do código da fazenda e de uso do solo ou
// de elegibilidade — o MUT 2008 real vem só com a classe de uso.
export function pareceCamadaMut(campos: string[]): boolean {
  const detectado = detectarCamposMut(campos);
  return !!detectado.codigo && (!!detectado.uso || !!detectado.elegibilidade);
}
