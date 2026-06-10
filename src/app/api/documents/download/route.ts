import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { loadCertificateFromDB } from '@/lib/sefaz/certificate';
import { consultarCte } from '@/lib/sefaz/soap-client';
import type { SefazAmbiente } from '@/lib/sefaz/endpoints';

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

        const cleanType = type.toLowerCase().replace('-', '');

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
            const sync = searchParams.get('sync') === 'true';
            
            // Se o XML de retorno/protocolo não estiver disponível localmente ou se for forçado o sync
            if (cleanType === 'cte' && (sync || !doc.xmlProtocolo || !doc.xmlRetorno)) {
                try {
                    const cert = await loadCertificateFromDB(db);
                    if (cert && doc.chaveAcesso) {
                        const emitente = await db.collection('company_profiles').findOne({ isDefault: true });
                        const sysSettings = await db.collection('system_settings').findOne({ type: 'ambiente_sefaz' });
                        const ambiente: SefazAmbiente = sysSettings?.sefazEnvironment === 'producao' ? 'producao' : 'homologacao';
                        const ufEmitente = (emitente?.estado || 'SP').substring(0, 2).toUpperCase();
                        
                        console.log(`[XML Sync] Consultando situação do CTe ${doc.chaveAcesso} na SEFAZ (${ufEmitente} - ${ambiente})`);
                        const sefazResponse = await consultarCte(doc.chaveAcesso, ufEmitente, ambiente, cert);
                        
                        if (sefazResponse.success && sefazResponse.xmlProtocolo) {
                            const updateData: Record<string, any> = {
                                status: 'autorizado',
                                protocolo: sefazResponse.nProt || doc.protocolo,
                                dataAutorizacao: sefazResponse.dhRecbto || doc.dataAutorizacao,
                                xmlRetorno: sefazResponse.xmlRetorno,
                                xmlProtocolo: sefazResponse.xmlProtocolo,
                            };
                            
                            await db.collection('issued_documents').updateOne(
                                { _id: doc._id },
                                { $set: updateData }
                             );
                             
                             // Atualizar o objeto local em memória
                             doc = { ...doc, ...updateData };
                             console.log(`[XML Sync] Documento ${doc.chaveAcesso} sincronizado e atualizado no banco.`);
                        }
                    }
                } catch (e: any) {
                    console.error('[XML Sync] Falha ao sincronizar com a SEFAZ:', e.message);
                }
            }

            // Se tiver o XML assinado do CTe e o XML do protocolo de autorização, montamos o cteProc (XML de Distribuição)
            let xmlContent = '';
            let filename = `${cleanType.toUpperCase()}_${doc.chaveAcesso || id}.xml`;
            
            if (cleanType === 'cte' && doc.xmlAssinado && doc.xmlProtocolo) {
                const cleanCte = doc.xmlAssinado.replace(/^<\?xml[^>]+>\s*/i, '').trim();
                const cleanProt = doc.xmlProtocolo.replace(/^<\?xml[^>]+>\s*/i, '').trim();
                xmlContent = `<?xml version="1.0" encoding="UTF-8"?><cteProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte">${cleanCte}${cleanProt}</cteProc>`;
                
                // Formato padrão oficial de distribuição: chave-procCTe.xml
                if (doc.chaveAcesso) {
                    filename = `${doc.chaveAcesso}-procCTe.xml`;
                }
            } else {
                xmlContent = doc.xmlAssinado || doc.xmlRetorno || doc.xmlProtocolo;
            }
            
            if (!xmlContent) {
                return new NextResponse('XML não disponível para este documento.', { status: 404 });
            }
            
            return new NextResponse(xmlContent, {
                headers: {
                    'Content-Type': 'application/xml; charset=utf-8',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                }
            });
        }
        
        // --- FORMATO PDF ---
        if (cleanType === 'cte') {
            // Redirecionar para o gerador DACTE interno
            const dacteId = doc.chaveAcesso || doc._id.toHexString();
            const baseUrl = new URL(request.url);
            const dacteUrl = `${baseUrl.origin}/api/sefaz/dacte?id=${dacteId}`;
            
            return NextResponse.redirect(dacteUrl);
        }
        
        if (cleanType === 'mdfe') {
            // Redirecionar para o gerador DAMDFE interno
            const damdfeId = doc.chaveAcesso || doc._id.toHexString();
            const baseUrl = new URL(request.url);
            const damdfeUrl = `${baseUrl.origin}/api/sefaz/damdfe?id=${damdfeId}`;
            
            return NextResponse.redirect(damdfeUrl);
        }
        
        return new NextResponse('Tipo de documento não suportado.', { status: 400 });

    } catch (error: any) {
        console.error('Download Route Error:', error);
        return new NextResponse('Internal Server Error na Rota de Download', { status: 500 });
    }
}
