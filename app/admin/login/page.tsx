'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push('/admin');
      router.refresh();
    } else {
      setError('Senha incorreta.');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-white/10 bg-zinc-900 p-8">
        <h1 className="mb-1 text-lg font-semibold text-white">Painel Administrativo</h1>
        <p className="mb-6 text-sm text-zinc-400">AMBIUM Digital - Portal WebGIS</p>
        <input
          type="password"
          placeholder="Senha de acesso"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-3 w-full rounded-md border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-lime-500"
        />
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-lime-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-lime-400 disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
