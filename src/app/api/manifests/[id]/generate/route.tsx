
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { LoadingManifestDocument } from '@/components/LoadingManifestDocument';
import type { Manifest, CompanyProfile } from '@/lib/types';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 2]; // Path is /api/manifests/[id]/generate

    if (!ObjectId.isValid(id)) {
      return new Response('ID de romaneio inválido.', { status: 400 });
    }

    const { db } = await connectToDatabase();
    const manifest = await db.collection('manifests').findOne({ _id: new ObjectId(id) }) as Manifest | null;
    if (!manifest) {
      return new Response('Romaneio não encontrado.', { status: 404 });
    }

    const companyProfile = await db.collection('company_profiles').findOne({ isDefault: true }) as CompanyProfile | null;
    if (!companyProfile) {
      return new Response('Perfil da empresa padrão não configurado.', { status: 500 });
    }
    
    const htmlContent = <LoadingManifestDocument manifest={manifest} companyProfile={companyProfile} />;

    return new Response(
      `<!DOCTYPE html>
       <html lang="pt-BR">
         <head>
           <meta charset="UTF-8">
           <title>Romaneio - ${manifest.manifestCode}</title>
           <script src="https://cdn.tailwindcss.com"></script>
           <style>
             @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
             body { font-family: 'Poppins', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
           </style>
         </head>
         <body>${require('react-dom/server').renderToStaticMarkup(htmlContent)}</body>
       </html>`,
      {
        headers: { 'Content-Type': 'text/html' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('API Generate Manifest Error:', error);
    return new Response(`Erro ao gerar romaneio: ${error.message}`, { status: 500 });
  }
}
