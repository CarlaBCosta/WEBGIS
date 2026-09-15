import { ClientForm } from '@/components/admin/ClientForm';
import { carregarTiposProjeto } from '@/lib/tiposProjeto';

export default async function NovoClientePage() {
  const tiposProjeto = await carregarTiposProjeto();

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Novo cliente</h1>
      <p className="mb-8 text-sm text-zinc-500">
        Nome, projeto, logo e o ZIP das camadas — o portal fica pronto em um passo só.
      </p>
      <ClientForm tiposProjeto={tiposProjeto} />
    </div>
  );
}
