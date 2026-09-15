// Regras compartilhadas dos timelapses por fazenda (card do cliente, cadastro e API).

// Sugere a camada que contém os polígonos das fazendas pelo nome: a ADA
// (Área Diretamente Afetada) é onde ficam os talhões/fazendas com o código.
const PADROES_CAMADA_FAZENDAS = [/diretamente_afetada/i, /(^|_)ada(_|$)/i, /fazenda/i, /talh/i];

export function sugerirCamadaFazendas(layerKeys: string[]): string | null {
  for (const padrao of PADROES_CAMADA_FAZENDAS) {
    const encontrada = layerKeys.find((k) => padrao.test(k));
    if (encontrada) return encontrada;
  }
  return null;
}

export const CAMPO_FAZENDA_PADRAO = 'FAZENDA';

// Campos que indicam código de fazenda/talhão. cod_imovel fica de fora de
// propósito: é o código do CAR e aparece em camadas que não são de fazendas
// (Reserva Legal, APP...).
const CAMPOS_QUE_IDENTIFICAM_FAZENDA = ['FAZENDA', 'CHAVE_AMB', 'CHAVE_USIN', 'TALHAO'];

// Nomes dos atributos da primeira feição, lidos só do começo do texto do
// GeoJSON — assim funciona mesmo em arquivos grandes, sem carregar tudo.
export function camposDoInicioDoGeojson(inicio: string): string[] {
  const i = inicio.search(/"properties"\s*:\s*\{/);
  if (i < 0) return [];
  const abre = inicio.indexOf('{', i);
  const fecha = inicio.indexOf('}', abre);
  if (fecha < 0) return [];
  const trecho = inicio.slice(abre + 1, fecha);
  return [...trecho.matchAll(/"((?:[^"\\]|\\.)+)"\s*:/g)].map((m) => m[1]);
}

// Primeiro campo de código (na ordem configurada do cliente) que existe na camada.
export function escolherCampoCodigo(campos: string[], preferidos: string[]): string | null {
  const ordem = [...preferidos, ...CAMPOS_QUE_IDENTIFICAM_FAZENDA];
  const porNome = new Map(campos.map((c) => [c.toUpperCase(), c]));
  for (const p of ordem) {
    const achado = porNome.get(p.toUpperCase());
    if (achado && achado.toLowerCase() !== 'cod_imovel') return achado;
  }
  return null;
}

// A camada tem jeito de camada de fazendas pelos atributos?
export function pareceCamadaDeFazendas(campos: string[]): boolean {
  const nomes = new Set(campos.map((c) => c.toUpperCase()));
  return CAMPOS_QUE_IDENTIFICAM_FAZENDA.some((c) => nomes.has(c));
}

// Sem sinal do robô há mais que isso, o painel mostra "offline".
export const ROBO_ONLINE_MS = 2 * 60 * 1000;
