import { ClientForm } from '@/components/admin/ClientForm';

export default function NovoClientePage() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Novo cliente</h1>
      <ClientForm />
    </div>
  );
}
