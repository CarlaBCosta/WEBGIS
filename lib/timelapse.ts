// Regras compartilhadas dos timelapses por fazenda (card do cliente e cadastro).

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

// Sem sinal do robô há mais que isso, o painel mostra "offline".
export const ROBO_ONLINE_MS = 2 * 60 * 1000;
