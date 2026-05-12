import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { generateDactePdf, type CteDocumentoCompleto } from '@/lib/sefaz/dacte-generator';

/**
 * GET /api/sefaz/dacte?id=<documentId>
 * Gera e retorna o PDF do DACTE para um CT-e emitido.
 * 
 * O CT-e deve estar salvo na collection `issued_documents` com tipo 'CTE'.
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
      return NextResponse.json({ message: 'Documento não encontrado.' }, { status: 404 });
    }
    
    // Buscar dados da empresa emitente
    const emitente = await db.collection('company_profiles').findOne({ isDefault: true });
    if (!emitente) {
      return NextResponse.json({ message: 'Perfil da empresa emitente não configurado.' }, { status: 400 });
    }
    
    // Montar dados para o DACTE
    const dacteInput: CteDocumentoCompleto = {
      chaveAcesso: doc.chaveAcesso || doc.nuvemFiscalId || '00000000000000000000000000000000000000000000',
      protocolo: doc.protocolo || doc.motivoStatus || '',
      dataAutorizacao: doc.dataAutorizacao || doc.dataEmissao || '',
      ambiente: doc.environment === 'producao' ? 'producao' : 'homologacao',
      serie: doc.serie || 1,
      numeroCte: doc.numeroCte || doc.numero || 0,
      dataEmissao: doc.dataEmissao ? new Date(doc.dataEmissao).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
      cfop: doc.cfop || '6353',
      naturezaOperacao: doc.naturezaOperacao || 'PRESTAÇÃO DE SERVIÇO DE TRANSPORTE',
      tipoCte: doc.tipoCte ?? 0,
      tipoServico: doc.tipoServico ?? 0,
      
      emitente: {
        razaoSocial: emitente.razaoSocial || '',
        nomeFantasia: emitente.nomeFantasia,
        cnpj: emitente.cnpj || '',
        inscricaoEstadual: emitente.inscricaoEstadual || '',
        endereco: emitente.endereco || '',
        cidade: emitente.cidade || '',
        estado: emitente.estado || '',
        cep: emitente.cep || '',
        telefone: emitente.telefone,
        logoUrl: emitente.logoUrl ? (emitente.logoUrl.startsWith('/') ? `${new URL(request.url).origin}${emitente.logoUrl}` : emitente.logoUrl) : undefined,
        rntrc: emitente.rntrc,
      },
      
      remetente: {
        razaoSocial: doc.remetenteNome || doc.remetente?.razaoSocial || '',
        cnpj: doc.remetenteCnpj || doc.remetente?.cnpj || '',
        inscricaoEstadual: doc.remetente?.inscricaoEstadual,
        endereco: doc.remetente?.endereco || '',
        cidade: doc.remetente?.cidade || '',
        estado: doc.remetente?.estado || '',
        cep: doc.remetente?.cep || '',
        telefone: doc.remetente?.telefone,
        pais: doc.remetente?.pais || 'BRASIL',
      },
      
      destinatario: {
        razaoSocial: doc.destinatarioNome || doc.destinatario?.razaoSocial || '',
        cnpj: doc.destinatarioCnpj || doc.destinatario?.cnpj || '',
        inscricaoEstadual: doc.destinatario?.inscricaoEstadual,
        endereco: doc.destinatario?.endereco || '',
        cidade: doc.destinatario?.cidade || '',
        estado: doc.destinatario?.estado || '',
        cep: doc.destinatario?.cep || '',
        telefone: doc.destinatario?.telefone,
        pais: doc.destinatario?.pais || 'BRASIL',
      },

      expedidor: doc.expedidor ? {
        razaoSocial: doc.expedidor.razaoSocial || '',
        cnpj: doc.expedidor.cnpj || '',
        inscricaoEstadual: doc.expedidor.inscricaoEstadual,
        endereco: doc.expedidor.endereco || '',
        cidade: doc.expedidor.cidade || '',
        estado: doc.expedidor.estado || '',
        cep: doc.expedidor.cep || '',
        telefone: doc.expedidor.telefone,
        pais: doc.expedidor.pais || 'BRASIL',
      } : undefined,

      recebedor: doc.recebedor ? {
        razaoSocial: doc.recebedor.razaoSocial || '',
        cnpj: doc.recebedor.cnpj || '',
        inscricaoEstadual: doc.recebedor.inscricaoEstadual,
        endereco: doc.recebedor.endereco || '',
        cidade: doc.recebedor.cidade || '',
        estado: doc.recebedor.estado || '',
        cep: doc.recebedor.cep || '',
        telefone: doc.recebedor.telefone,
        pais: doc.recebedor.pais || 'BRASIL',
      } : undefined,
      
      tomador: {
        tipo: doc.tomadorTipo ?? 0,
        razaoSocial: doc.tomador?.razaoSocial || doc.remetenteNome || '',
        cnpj: doc.tomador?.cnpj || doc.remetenteCnpj || '',
        inscricaoEstadual: doc.tomador?.inscricaoEstadual,
        endereco: doc.tomador?.endereco || '',
        cidade: doc.tomador?.cidade || '',
        estado: doc.tomador?.estado || '',
        cep: doc.tomador?.cep || '',
        telefone: doc.tomador?.telefone,
        pais: doc.tomador?.pais || 'BRASIL',
      },

      globalizado: doc.globalizado ?? false,
      componentesValor: doc.componentesValor,
      outrasCaracteristicas: doc.outrasCaracteristicas,
      situacaoTributaria: doc.situacaoTributaria,
      dataPrevEntrega: doc.dataPrevEntrega ? new Date(doc.dataPrevEntrega).toLocaleDateString('pt-BR') : undefined,
      
      valorServico: doc.valorServico || doc.vPrest || 0,
      valorReceber: doc.valorReceber || doc.vRec || 0,
      
      produtoPredominante: doc.produtoPredominante || 'DIVERSOS',
      valorCarga: doc.valorCarga || 0,
      peso: doc.peso || 0,
      quantidadeVolumes: doc.quantidadeVolumes || 0,
      especieCarga: doc.especieCarga,
      
      icmsCst: doc.icmsCst || '00',
      icmsBase: doc.icmsBase || 0,
      icmsAliquota: doc.icmsAliquota || 0,
      icmsValor: doc.icmsValor || 0,
      
      cidadeOrigem: doc.cidadeOrigem || emitente.cidade || '',
      ufOrigem: doc.ufOrigem || emitente.estado || '',
      cidadeDestino: doc.cidadeDestino || '',
      ufDestino: doc.ufDestino || '',
      
      nfeChaves: doc.nfeChaves || [],
      observacoes: doc.observacoes,
    };
    
    // Gerar o PDF
    const pdfBuffer = await generateDactePdf(dacteInput);
    
    // Retornar o PDF com cache desabilitado para desenvolvimento/testes
    const response = new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="DACTE_${dacteInput.numeroCte}_${dacteInput.chaveAcesso.slice(-8)}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
    
    return response;
    
  } catch (error: any) {
    console.error('GET /api/sefaz/dacte error:', error);
    return NextResponse.json({ 
      message: `Erro ao gerar DACTE: ${error.message}` 
    }, { status: 500 });
  }
}
