
import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const mimeTypes: { [key: string]: string } = {
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.xml': 'application/xml',
};

export async function GET(
  request: Request
) {
  try {
    const pathname = new URL(request.url).pathname;
    const pathParts = pathname.split('/api/assets/');

    if (pathParts.length < 2) {
        return new NextResponse('URL de recurso inválido.', { status: 400 });
    }
    const slug = pathParts[1].split('/');

    const filePath = path.join(process.cwd(), 'public', ...slug);

    // Security check to prevent path traversal outside of the 'public' directory
    const publicDir = path.join(process.cwd(), 'public');
    if (!filePath.startsWith(publicDir)) {
      return new NextResponse('Acesso negado.', { status: 403 });
    }

    const stats = await fs.stat(filePath);
    const fileContents = await fs.readFile(filePath);

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Length', stats.size.toString());
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');

    return new NextResponse(fileContents, { status: 200, headers });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return new NextResponse('Ficheiro não encontrado.', { status: 404 });
    }
    console.error(`[API ASSETS] Erro ao servir ficheiro:`, error);
    return new NextResponse('Erro interno do servidor.', { status: 500 });
  }
}
