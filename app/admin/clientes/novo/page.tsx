import { ClientForm } from '@/components/admin/ClientForm';

export default function NovoClientePage() {
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Novo cliente</h1>
      <p className="mb-8 text-sm text-zinc-500">
        Nome, cor e o ZIP das camadas — o portal fica pronto em um passo só.
      </p>
      <ClientForm />
    </div>
  );
}
