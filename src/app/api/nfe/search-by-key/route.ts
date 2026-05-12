import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

/**
 * Busca um documento fiscal (NF-e/CT-e/MDF-e) pela chave de acesso.
 * 
 * Primeiro tenta no banco de dados local (issued_documents).
 * Se não encontrar, informa ao usuário que a consulta direta 
 * à SEFAZ para NF-e de terceiros será implementada futuramente.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key || key.length !== 44) {
        return NextResponse.json({ message: 'Chave de acesso inválida. A chave deve conter 44 dígitos.' }, { status: 400 });
    }

    try {
        const { db } = await connectToDatabase();
        
        // Tentar buscar o documento no banco local primeiro
        const localDoc = await db.collection('issued_documents').findOne({ 
            $or: [
                { chaveAcesso: key },
                { 'nfeChaves': key }
            ]
        });
        
        if (localDoc) {
            // Retornar o XML armazenado localmente
            const xmlContent = localDoc.xmlAssinado || localDoc.xmlRetorno;
            if (xmlContent) {
                return new NextResponse(xmlContent, {
                    headers: { 
                        'Content-Type': 'application/xml; charset=utf-8'
                    }
                });
            }
            
            return NextResponse.json({ 
                message: 'Documento encontrado no sistema mas sem XML armazenado.',
                document: {
                    type: localDoc.type,
                    status: localDoc.status,
                    chaveAcesso: localDoc.chaveAcesso,
                    dataEmissao: localDoc.dataEmissao,
                }
            });
        }
        
        // Documento não encontrado localmente
        // Para NF-e de terceiros, a consulta à SEFAZ requer integração 
        // com o portal de distribuição de DFe (MDe)
        const modelo = key.substring(20, 22);
        const modeloNome = modelo === '55' ? 'NF-e' 
                          : modelo === '57' ? 'CT-e' 
                          : modelo === '58' ? 'MDF-e' 
                          : 'Documento fiscal';
        
        return NextResponse.json({ 
            message: `${modeloNome} com chave ${key} não encontrada no banco de dados local. A consulta direta à SEFAZ para documentos de terceiros será disponibilizada em breve.` 
        }, { status: 404 });

    } catch (error: any) {
        console.error('[API NFE SEARCH BY KEY Error]', error);
        return NextResponse.json({ message: `Erro no servidor: ${error.message}` }, { status: 500 });
    }
}
