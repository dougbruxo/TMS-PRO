import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

/**
 * Rota de download de documentos fiscais (PDF/XML).
 * 
 * Agora busca o documento no banco local e redireciona para 
 * o gerador DACTE interno (/api/sefaz/dacte) ou retorna o XML armazenado.
 * 
 * Query params:
 *   - id: ID do documento (ObjectId do MongoDB ou chave de acesso)
 *   - type: tipo do documento ('cte', 'mdfe')
 *   - format: 'pdf' (padrão) ou 'xml'
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const type = searchParams.get('type'); // 'cte', 'mdfe'
        const format = searchParams.get('format') || 'pdf';

        if (!id || !type) {
            return new NextResponse('Estão faltando parâmetros (id/type).', { status: 400 });
        }

        const { db } = await connectToDatabase();
        
        // Buscar documento no banco local
        let doc;
        try {
            // Tentar buscar por ObjectId
            doc = await db.collection('issued_documents').findOne({ _id: new ObjectId(id) });
        } catch {
            // Se não for um ObjectId válido, tentar por chave de acesso
            doc = await db.collection('issued_documents').findOne({ chaveAcesso: id });
        }
        
        if (!doc) {
            return new NextResponse('Documento não encontrado no banco de dados.', { status: 404 });
        }
        
        // --- FORMATO XML ---
        if (format === 'xml') {
            const xmlContent = doc.xmlAssinado || doc.xmlRetorno;
            if (!xmlContent) {
                return new NextResponse('XML não disponível para este documento.', { status: 404 });
            }
            
            return new NextResponse(xmlContent, {
                headers: {
                    'Content-Type': 'application/xml; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${type.toUpperCase()}_${doc.chaveAcesso || id}.xml"`,
                }
            });
        }
        
        // --- FORMATO PDF ---
        if (type.toLowerCase() === 'cte') {
            // Redirecionar para o gerador DACTE interno
            const dacteId = doc.chaveAcesso || doc._id.toHexString();
            const baseUrl = new URL(request.url);
            const dacteUrl = `${baseUrl.origin}/api/sefaz/dacte?id=${dacteId}`;
            
            return NextResponse.redirect(dacteUrl);
        }
        
        // MDF-e (DAMDFE) — por enquanto retorna informações em texto
        // A implementação do DAMDFE (PDF do MDF-e) seguirá o mesmo padrão do DACTE
        if (type.toLowerCase() === 'mdfe') {
            return NextResponse.json({
                message: 'Download do DAMDFE (PDF do MDF-e) será implementado em breve.',
                documento: {
                    type: doc.type,
                    chaveAcesso: doc.chaveAcesso,
                    status: doc.status,
                    protocolo: doc.protocolo,
                    dataEmissao: doc.dataEmissao,
                }
            });
        }
        
        return new NextResponse('Tipo de documento não suportado.', { status: 400 });

    } catch (error: any) {
        console.error('Download Route Error:', error);
        return new NextResponse('Internal Server Error na Rota de Download', { status: 500 });
    }
}
