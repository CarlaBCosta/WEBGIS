import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get('file') as File | null;
  const slug = form.get('slug') as string | null;
  const clientId = form.get('clientId') as string | null;

  if (!file || !slug || !clientId) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando.' }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: 'Formato de logo inválido. Use PNG, JPG, SVG ou WebP.' },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Logo muito grande (máximo 2 MB).' }, { status: 400 });
  }

  // Nome com timestamp para não servir versão antiga de cache após troca.
  const storagePath = `${slug}/logo-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from('client-data')
    .upload(storagePath, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: `Falha no upload da logo: ${uploadError.message}` }, { status: 500 });
  }

  const { data: pub } = supabaseAdmin.storage.from('client-data').getPublicUrl(storagePath);

  const { error: updateError } = await supabaseAdmin
    .from('clients')
    .update({ logo_url: pub.publicUrl, updated_at: new Date().toISOString() })
    .eq('id', clientId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({ logoUrl: pub.publicUrl });
}
