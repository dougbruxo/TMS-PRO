import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { generateDactePdf, type CteDocumentoCompleto } from '@/lib/sefaz/dacte-generator';
import { parseCteXml } from '@/lib/sefaz/xml-parser-cte';

/**
 * GET /api/sefaz/dacte?id=<documentId>
 * Gera e retorna o PDF do DACTE para um CT-e emitido.
 *
 * EstratÃ©gia de dados (em ordem de prioridade):
 * 1. XML original autorizado pela SEFAZ (`doc.xmlAssinado`) â€” espelho exato
 * 2. Fallback: campos do banco de dados (issued_documents + customers)
 *
 * Logo e RNTRC do emitente sÃ£o sempre mesclados do perfil da empresa
 * pois nÃ£o constam no XML.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json({ message: 'ID do documento nÃ£o informado.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Buscar documento emitido
    const { ObjectId } = await import('mongodb');
    let doc: any;
    try {
      doc = await db.collection('issued_documents').findOne({ _id: new ObjectId(documentId) });
    } catch {
      doc = await db.collection('issued_documents').findOne({ chaveAcesso: documentId });
    }

    if (!doc) {
      return NextResponse.json({ message: 'Documento nÃ£o encontrado.' }, { status: 404 });
    }

    // Buscar perfil da empresa (para logo e rntrc â€” nÃ£o presentes no XML)
    const emitentePerfil = await db.collection('company_profiles').findOne({ isDefault: true });

    // Resolver logo para URL absoluta
    const origin = new URL(request.url).origin;
    let logoUrl: string | undefined;
    if (emitentePerfil?.logoUrl) {
      logoUrl = emitentePerfil.logoUrl.startsWith('/')
        ? `${origin}${emitentePerfil.logoUrl}`
        : emitentePerfil.logoUrl;
    }

    // ============================================================
    // ESTRATÃ‰GIA 1: XML original da SEFAZ (fonte canÃ´nica)
    // ============================================================
    if (doc.xmlAssinado) {
      try {
        const { cteData } = parseCteXml(doc.xmlAssinado);

        // Mesclar dados que nÃ£o constam no XML
        cteData.emitente.logoUrl = logoUrl;
        if (!cteData.emitente.rntrc && emitentePerfil?.rntrc) {
          cteData.emitente.rntrc = emitentePerfil.rntrc;
        }

        // Protocolo e data de autorizaÃ§Ã£o do banco, se o XML nÃ£o trouxer
        if (!cteData.protocolo && doc.protocolo) cteData.protocolo = doc.protocolo;
        if (!cteData.dataAutorizacao && doc.dataAutorizacao) {
          cteData.dataAutorizacao = new Date(doc.dataAutorizacao).toLocaleDateString('pt-BR');
        }

        const pdfBuffer = await generateDactePdf(cteData);
        const cleanNumero = String(cteData.numeroCte || '').replace(/^0+/, '') || '0';
        const filename = `CTe-${cleanNumero.padStart(2, '0')}.pdf`;

        return new Response(new Uint8Array(pdfBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${filename}"`,
            'Content-Length': String(pdfBuffer.length),
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });
      } catch (parseErr: any) {
        console.warn('Falha ao parsear XML do CT-e, usando fallback do banco:', parseErr.message);
        // Continua para o fallback abaixo
      }
    }

    // ============================================================
    // ESTRATÃ‰GIA 2: Fallback â€” dados do banco de dados
    // ============================================================
    if (!emitentePerfil) {
      return NextResponse.json({ message: 'Perfil da empresa emitente nÃ£o configurado.' }, { status: 400 });
    }

    // Buscar cadastros de remetente, destinatÃ¡rio e tomador na collection customers
    let dbRemetente: any = null;
    let dbDestinatario: any = null;
    let dbTomador: any = null;

    if (doc.formData?.remetenteId) {
      try {
        dbRemetente = await db.collection('customers').findOne({ _id: new ObjectId(doc.formData.remetenteId) });
      } catch (e) {
        console.error('Erro ao buscar remetente por ID:', e);
      }
    }
    if (!dbRemetente && doc.remetenteCnpj) {
      const cnpjLimpo = doc.remetenteCnpj.replace(/\D/g, '');
      dbRemetente = await db.collection('customers').findOne({
        $or: [{ cnpj: doc.remetenteCnpj }, { cnpj: cnpjLimpo }, { cpf: doc.remetenteCnpj }, { cpf: cnpjLimpo }]
      });
    }

    if (doc.formData?.destinatarioId) {
      try {
        dbDestinatario = await db.collection('customers').findOne({ _id: new ObjectId(doc.formData.destinatarioId) });
      } catch (e) {
        console.error('Erro ao buscar destinatÃ¡rio por ID:', e);
      }
    }
    if (!dbDestinatario && doc.destinatarioCnpj) {
      const cnpjLimpo = doc.destinatarioCnpj.replace(/\D/g, '');
      dbDestinatario = await db.collection('customers').findOne({
        $or: [{ cnpj: doc.destinatarioCnpj }, { cnpj: cnpjLimpo }, { cpf: doc.destinatarioCnpj }, { cpf: cnpjLimpo }]
      });
    }

    if (doc.formData?.tomadorId) {
      try {
        dbTomador = await db.collection('customers').findOne({ _id: new ObjectId(doc.formData.tomadorId) });
      } catch (e) {
        console.error('Erro ao buscar tomador por ID:', e);
      }
    }
    if (!dbTomador && doc.tomadorCnpj) {
      const cnpjLimpo = doc.tomadorCnpj.replace(/\D/g, '');
      dbTomador = await db.collection('customers').findOne({
        $or: [{ cnpj: doc.tomadorCnpj }, { cnpj: cnpjLimpo }, { cpf: doc.tomadorCnpj }, { cpf: cnpjLimpo }]
      });
    }

    const dacteInput: CteDocumentoCompleto = {
      chaveAcesso: doc.chaveAcesso || '00000000000000000000000000000000000000000000',
      protocolo: doc.protocolo || '',
      dataAutorizacao: doc.dataAutorizacao || doc.dataEmissao || '',
      ambiente: doc.environment === 'producao' ? 'producao' : 'homologacao',
      serie: doc.serie || 1,
      numeroCte: doc.numeroCte || doc.numero || 0,
      dataEmissao: doc.dataEmissao ? new Date(doc.dataEmissao).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
      cfop: doc.cfop || '6353',
      naturezaOperacao: doc.naturezaOperacao || 'PRESTAÃ‡ÃƒO DE SERVIÃ‡O DE TRANSPORTE',
      tipoCte: doc.tipoCte ?? 0,
      tipoServico: doc.tipoServico ?? 0,

      emitente: {
        razaoSocial: emitentePerfil.razaoSocial || '',
        nomeFantasia: emitentePerfil.nomeFantasia,
        cnpj: emitentePerfil.cnpj || '',
        inscricaoEstadual: emitentePerfil.inscricaoEstadual || '',
        endereco: emitentePerfil.endereco || '',
        cidade: emitentePerfil.cidade || '',
        estado: emitentePerfil.estado || '',
        cep: emitentePerfil.cep || '',
        telefone: emitentePerfil.telefone,
        logoUrl,
        rntrc: emitentePerfil.rntrc,
      },

      remetente: {
        razaoSocial: doc.remetenteNome || dbRemetente?.razaoSocial || doc.remetente?.razaoSocial || '',
        cnpj: doc.remetenteCnpj || dbRemetente?.cnpj || doc.remetente?.cnpj || '',
        inscricaoEstadual: dbRemetente?.inscricaoEstadual || doc.remetente?.inscricaoEstadual || '',
        endereco: dbRemetente?.endereco || doc.remetente?.endereco || '',
        cidade: dbRemetente?.cidade || doc.remetente?.cidade || '',
        estado: dbRemetente?.estado || doc.remetente?.estado || '',
        cep: dbRemetente?.cep || doc.remetente?.cep || '',
        telefone: dbRemetente?.telefone || doc.remetente?.telefone,
        pais: dbRemetente?.pais || doc.remetente?.pais || 'BRASIL',
      },

      destinatario: {
        razaoSocial: doc.destinatarioNome || dbDestinatario?.razaoSocial || doc.destinatario?.razaoSocial || '',
        cnpj: doc.destinatarioCnpj || dbDestinatario?.cnpj || doc.destinatario?.cnpj || '',
        inscricaoEstadual: dbDestinatario?.inscricaoEstadual || doc.destinatario?.inscricaoEstadual || '',
        endereco: dbDestinatario?.endereco || doc.destinatario?.endereco || '',
        cidade: dbDestinatario?.cidade || doc.destinatario?.cidade || '',
        estado: dbDestinatario?.estado || doc.destinatario?.estado || '',
        cep: dbDestinatario?.cep || doc.destinatario?.cep || '',
        telefone: dbDestinatario?.telefone || doc.destinatario?.telefone,
        pais: dbDestinatario?.pais || doc.destinatario?.pais || 'BRASIL',
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
        razaoSocial: dbTomador?.razaoSocial || doc.tomadorNome || doc.tomador?.razaoSocial || doc.remetenteNome || '',
        cnpj: dbTomador?.cnpj || doc.tomadorCnpj || doc.tomador?.cnpj || doc.remetenteCnpj || '',
        inscricaoEstadual: dbTomador?.inscricaoEstadual || doc.tomador?.inscricaoEstadual || '',
        endereco: dbTomador?.endereco || doc.tomador?.endereco || '',
        cidade: dbTomador?.cidade || doc.tomador?.cidade || '',
        estado: dbTomador?.estado || doc.tomador?.estado || '',
        cep: dbTomador?.cep || doc.tomador?.cep || '',
        telefone: dbTomador?.telefone || doc.tomador?.telefone,
        pais: dbTomador?.pais || doc.tomador?.pais || 'BRASIL',
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

      cidadeOrigem: doc.cidadeOrigem || emitentePerfil.cidade || '',
      ufOrigem: doc.ufOrigem || emitentePerfil.estado || '',
      cidadeDestino: doc.cidadeDestino || '',
      ufDestino: doc.ufDestino || '',

      nfeChaves: doc.nfeChaves || [],
      observacoes: doc.observacoes,
    };

    const pdfBuffer = await generateDactePdf(dacteInput);
    const cleanNumero = String(dacteInput.numeroCte || '').replace(/\D/g, '').replace(/^0+/, '') || '0';
    const filename = `CTe-${cleanNumero.padStart(2, '0')}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error: any) {
    console.error('GET /api/sefaz/dacte error:', error);
    return NextResponse.json({
      message: `Erro ao gerar DACTE: ${error.message}`
    }, { status: 500 });
  }
}
