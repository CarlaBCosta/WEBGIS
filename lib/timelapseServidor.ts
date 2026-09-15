import 'server-only';
import { camposDoInicioDoGeojson, escolherCampoCodigo, pareceCamadaDeFazendas, sugerirCamadaFazendas } from '@/lib/timelapse';

// Lê só o começo do arquivo no Storage (Range) para descobrir os atributos da
// primeira feição. Em qualquer falha devolve [] (quem chama decide o que fazer).
export async function lerCamposDaCamada(storagePath: string, bytes = 262144): Promise<string[]> {
  try {
    const url = `${process.env.SUPABASE_URL}/storage/v1/object/public/client-data/${storagePath
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
    const res = await fetch(url, { headers: { Range: `bytes=0-${bytes - 1}` }, cache: 'no-store' });
    if (!res.ok) return [];
    return camposDoInicioDoGeojson(await res.text());
  } catch {
    return [];
  }
}

// Sugere a camada das fazendas e o campo do código: primeiro pelo nome
// (ADA, fazenda, talhão); se nenhum nome indicar, pelos atributos do arquivo.
export async function sugerirFazendas(
  camadas: { layer_key: string; storage_path: string | null }[],
  camposPreferidos: string[]
): Promise<{ layerKey: string; campo: string } | null> {
  const porNome = sugerirCamadaFazendas(camadas.map((c) => c.layer_key));
  const ordem = porNome ? [camadas.find((c) => c.layer_key === porNome)!, ...camadas] : camadas;

  const vistos = new Set<string>();
  for (const camada of ordem) {
    if (!camada?.storage_path || vistos.has(camada.layer_key)) continue;
    vistos.add(camada.layer_key);
    const campos = await lerCamposDaCamada(camada.storage_path, 65536);
    if (camada.layer_key === porNome || pareceCamadaDeFazendas(campos)) {
      const campo = escolherCampoCodigo(campos, camposPreferidos);
      if (campo) return { layerKey: camada.layer_key, campo };
    }
  }
  return null;
}
