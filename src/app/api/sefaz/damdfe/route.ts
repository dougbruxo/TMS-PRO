import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { generateDamdfePdf, type MdfeDocumentoCompleto } from '@/lib/sefaz/damdfe-generator';
import { parseMdfeXml } from '@/lib/sefaz/xml-parser-mdfe';

/**
 * GET /api/sefaz/damdfe?id=<documentId>
 * Gera e retorna o PDF do DAMDFE para um MDF-e emitido.
 * 
 * O MDF-e deve estar salvo na collection `issued_documents` com tipo 'MDFE'.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');
    
    if (!documentId) {
      return NextResponse.json({ message: 'ID do documento não informado.' }, { status: 400 });
    }
    
    const { db } = await connectToDatabase();
    
    // Buscar documento emitido
    const { ObjectId } = await import('mongodb');
    let doc;
    try {
      doc = await db.collection('issued_documents').findOne({ _id: new ObjectId(documentId) });
    } catch {
      // Tentar buscar por chave de acesso
      doc = await db.collection('issued_documents').findOne({ chaveAcesso: documentId });
    }
    
    if (!doc) {
      return NextResponse.json({ message: 'Documento MDF-e não encontrado.' }, { status: 404 });
    }
    
    // Buscar dados da empresa emitente
    const emitente = await db.collection('company_profiles').findOne({ isDefault: true });
    
    // Resolver logo para URL absoluta
    const origin = new URL(request.url).origin;
    let logoUrl: string | undefined;
    if (emitente?.logoUrl) {
      logoUrl = emitente.logoUrl.startsWith('/')
        ? `${origin}${emitente.logoUrl}`
        : emitente.logoUrl;
    } else if (emitente?.logo) {
      logoUrl = emitente.logo.startsWith('/')
        ? `${origin}${emitente.logo}`
        : emitente.logo;
    }

    // ============================================================
    // ESTRATÉGIA 1: XML original da SEFAZ (fonte canônica)
    // ============================================================
    if (doc.xmlAssinado) {
      try {
        const { mdfeData } = parseMdfeXml(doc.xmlAssinado);

        // Mesclar dados que não constam no XML
        mdfeData.emitente.logoUrl = logoUrl;
        if (!mdfeData.emitente.rntrc && emitente?.rntrc) {
          mdfeData.emitente.rntrc = emitente.rntrc;
        }

        // Protocolo e data de autorização do banco, se o XML não trouxer
        if (!mdfeData.protocolo && doc.protocolo) mdfeData.protocolo = doc.protocolo;
        if (!mdfeData.dataAutorizacao && doc.dataAutorizacao) {
          mdfeData.dataAutorizacao = new Date(doc.dataAutorizacao).toLocaleDateString('pt-BR');
        }

        const pdfBuffer = await generateDamdfePdf(mdfeData);
        return new Response(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="DAMDFE_${mdfeData.numeroMdfe}_${mdfeData.chaveAcesso.slice(-8)}.pdf"`,
            'Content-Length': String(pdfBuffer.length),
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
      } catch (parseErr: any) {
        console.warn('Falha ao parsear XML do MDF-e, usando fallback do banco:', parseErr.message);
      }
    }

    // ============================================================
    // ESTRATÉGIA 2: Fallback — dados do banco de dados
    // ============================================================
    if (!emitente) {
      return NextResponse.json({ message: 'Perfil da empresa emitente não configurado.' }, { status: 400 });
    }
    
    const damdfeInput: MdfeDocumentoCompleto = {
      chaveAcesso: doc.chaveAcesso || '00000000000000000000000000000000000000000000',
      protocolo: doc.protocolo || '',
      dataAutorizacao: doc.dataAutorizacao || doc.dataEmissao || '',
      ambiente: doc.environment === 'producao' ? 'producao' : 'homologacao',
      serie: doc.serie || 1,
      numeroMdfe: doc.numeroMdfe || doc.numero || 0,
      dataEmissao: doc.dataEmissao ? new Date(doc.dataEmissao).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),

      emitente: {
        razaoSocial: emitente.razaoSocial || '',
        cnpj: emitente.cnpj || '',
        inscricaoEstadual: emitente.inscricaoEstadual || '',
        endereco: emitente.endereco || '',
        cidade: emitente.cidade || '',
        estado: emitente.estado || '',
        cep: emitente.cep || '',
        telefone: emitente.telefone,
        rntrc: emitente.rntrc || '',
        logoUrl,
      },

      motoristaNome: doc.motoristaNome || doc.condutor?.nome || '',
      motoristaCpf: doc.motoristaCpf || doc.condutor?.cpf || '',
      veiculoPlaca: doc.veiculoPlacas || doc.veiculo?.placa || '',
      veiculoRntrc: doc.veiculoRntrc || emitente.rntrc || '',
      veiculoEstado: doc.veiculoEstado || doc.veiculo?.uf || '',

      ufInicio: doc.ufInicio || doc.ufCarregamento || emitente.estado || '',
      ufFim: doc.ufFim || doc.ufDescarregamento || '',
      ufPercurso: doc.ufPercurso,

      qtdCte: doc.totalChavesCte || doc.qtdCte || (doc.chavesCte?.length ?? 0),
      qtdNfe: doc.qtdNfe || 0,
      chavesDocumentos: doc.chavesCte || doc.cteChaves || [],

      vCarga: doc.vCarga || doc.valorCarga || 0,
      qCarga: doc.qCarga || doc.pesoCarga || 0,

      seguradora: doc.seguradora,
      apolice: doc.apolice,
      averbacao: doc.averbacao,
      ciot: doc.ciot,
      ciotCpfCnpj: doc.ciotCpfCnpj,
      observacoes: doc.observacoes,
    };
    
    // Gerar o PDF
    const pdfBuffer = await generateDamdfePdf(damdfeInput);
    
    // Retornar o PDF
    const response = new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="DAMDFE_${damdfeInput.numeroMdfe}_${damdfeInput.chaveAcesso.slice(-8)}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    
    return response;
    
  } catch (error: any) {
    console.error('GET /api/sefaz/damdfe error:', error);
    return NextResponse.json({ 
      message: `Erro ao gerar DAMDFE: ${error.message}` 
    }, { status: 500 });
  }
}
