import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { loadCertificateFromDB } from '@/lib/sefaz/certificate';
import { sendSoapRequest, extractDeepValue } from '@/lib/sefaz/soap-client';
import { getEndpoints, getMdfeEndpoints, SOAP_ACTIONS, MDFE_SOAP_ACTIONS, SefazAmbiente } from '@/lib/sefaz/endpoints';
import { buildEventoXml, EventoInput } from '@/lib/sefaz/xml-builder-evento';
import { signEventoXml } from '@/lib/sefaz/xml-signer';
import { ObjectId } from 'mongodb';
import { XMLParser } from 'fast-xml-parser';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      documentId, 
      tipoEvento, 
      justificativa, 
      codigoMunicipioEncerramento, 
      ufEncerramento,
      grupoAlterado,
      campoAlterado,
      valorAlterado
    } = body;

    if (!documentId || !tipoEvento) {
      return NextResponse.json({ message: 'documentId e tipoEvento sÃ£o obrigatÃ³rios' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // 1. Buscar o documento emitido
    let doc;
    try {
      doc = await db.collection('issued_documents').findOne({ _id: new ObjectId(documentId) });
    } catch {
      doc = await db.collection('issued_documents').findOne({ chaveAcesso: documentId });
    }

    if (!doc) {
      return NextResponse.json({ message: 'Documento nÃ£o encontrado' }, { status: 404 });
    }

    if (doc.status === 'cancelado' || doc.status === 'encerrado') {
      return NextResponse.json({ message: `Documento jÃ¡ estÃ¡ ${doc.status}` }, { status: 400 });
    }

    // 2. Determinar tipo e ambiente
    const isCTe = doc.type?.toUpperCase().replace('-', '') === 'CTE';
    const isMDFe = doc.type?.toUpperCase().replace('-', '') === 'MDFE';
    const ambiente = doc.environment === 'producao' ? 'producao' : 'homologacao';
    
    // 3. Buscar perfil da empresa e certificado
    const company = await db.collection('company_profiles').findOne({ isDefault: true });

    // cUF: derivar dos 2 primeiros dÃ­gitos da chave de acesso (fonte canÃ´nica â€” sempre correto)
    const chaveAcessoLimpa = (doc.chaveAcesso || '').replace(/\D/g, '');
    const cUFFromChave = chaveAcessoLimpa.substring(0, 2);

    // CNPJ: preferir o do perfil da empresa; fallback: extrair do XML assinado armazenado
    let cnpjEmitente = company?.cnpj?.replace(/\D/g, '') || '';
    if (!cnpjEmitente && doc.xmlAssinado) {
      // Extrair CNPJ do bloco <emit><CNPJ> do XML armazenado
      const cnpjMatch = doc.xmlAssinado.match(/<emit[^>]*>[\s\S]*?<CNPJ>(\d{14})<\/CNPJ>/);
      if (cnpjMatch) cnpjEmitente = cnpjMatch[1];
    }
    if (!cnpjEmitente && chaveAcessoLimpa.length === 44) {
      // Ãšltimo fallback: posiÃ§Ãµes 3-16 da chave de acesso = CNPJ emitente
      cnpjEmitente = chaveAcessoLimpa.substring(3, 17);
    }

    if (!cUFFromChave || cUFFromChave.length !== 2) {
      return NextResponse.json({ message: 'Chave de acesso do documento invÃ¡lida (cUF nÃ£o encontrado)' }, { status: 400 });
    }
    if (!cnpjEmitente) {
      return NextResponse.json({ message: 'NÃ£o foi possÃ­vel determinar o CNPJ do emitente para o evento' }, { status: 400 });
    }

    const certData = await loadCertificateFromDB(db);
    if (!certData) {
      return NextResponse.json({ message: 'Certificado digital nÃ£o configurado' }, { status: 400 });
    }

    // Calcular nSeqEvento para CC-e (deve ser incremental)
    let nSeqEvento = 1;
    if (tipoEvento === '110110') {
      const eventosCce = doc.eventos?.filter((e: any) => e.tipo === '110110') || [];
      nSeqEvento = eventosCce.length + 1;
    }

    // 4. Montar o input do evento
    const eventoInput: EventoInput = {
      tipoDocumento: isCTe ? 'CTE' : 'MDFE',
      ambiente,
      codigoUf: cUFFromChave,
      cnpj: cnpjEmitente,
      chaveAcesso: doc.chaveAcesso,
      tipoEvento,
      nSeqEvento,
      detalhes: {
        protocolo: doc.protocolo,
        justificativa,
        codigoMunicipioEncerramento: codigoMunicipioEncerramento || doc.cMunCarrega || doc.cMunDescarga,
        ufEncerramento: ufEncerramento || doc.ufFim || doc.ufInicio,
        grupoAlterado,
        campoAlterado,
        valorAlterado
      }
    };

    // 5. Construir XML nÃ£o assinado
    let xmlUnsigned;
    try {
      const result = buildEventoXml(eventoInput);
      xmlUnsigned = result.xml;
    } catch (err: any) {
      return NextResponse.json({ message: `Erro ao construir evento: ${err.message}` }, { status: 400 });
    }

    // 6. Assinar o XML
    const xmlSigned = signEventoXml(xmlUnsigned, certData.privateKey, certData.certificate);

    // 7. Enviar via SOAP usando as funÃ§Ãµes de alto nÃ­vel do soap-client
    // (que constroem o envelope SOAP 1.2 correto com buildSoapEnvelope)
    const UF_BY_CODE: Record<string, string> = {
      '11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP','17':'TO',
      '21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL','28':'SE','29':'BA',
      '31':'MG','32':'ES','33':'RJ','35':'SP','41':'PR','42':'SC','43':'RS',
      '50':'MS','51':'MT','52':'GO','53':'DF',
    };
    const ufEmitente = company?.estado || UF_BY_CODE[cUFFromChave] || 'RS';

    const { enviarEvento, enviarEventoMdfe } = await import('@/lib/sefaz/soap-client');

    let soapResponse: string;
    if (isCTe) {
      const sefazResp = await enviarEvento(xmlSigned, ufEmitente, ambiente, certData);
      soapResponse = sefazResp.xmlRetorno;
    } else {
      const sefazResp = await enviarEventoMdfe(xmlSigned, ambiente, certData);
      soapResponse = sefazResp.xmlRetorno;
    }

    // 8. Extrair resposta
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const parsedObj = parser.parse(soapResponse);

    const tagRetorno = isCTe ? 'retEventoCTe' : 'retEventoMDFe';
    const result = extractDeepValue(parsedObj, tagRetorno);

    const retEvento = result?.infEvento || extractDeepValue(parsedObj, 'infEvento');

    // Status 135 significa Evento Registrado e Vinculado
    if (retEvento && (retEvento.cStat === '135' || String(retEvento.cStat) === '135')) {
      let newStatus = doc.status;
      if (tipoEvento === '110111') newStatus = 'cancelado';
      else if (tipoEvento === '110112') newStatus = 'encerrado';

      const eventoRegistro = {
        tipo: tipoEvento,
        protocolo: retEvento.nProt,
        data: retEvento.dhRegEvento,
        justificativa,
      };

      await db.collection('issued_documents').updateOne(
        { _id: doc._id },
        {
          $set: {
            status: newStatus,
            updatedAt: new Date().toISOString()
          },
          $push: { eventos: eventoRegistro } as any
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Evento registrado com sucesso',
        protocolo: retEvento.nProt,
        cStat: retEvento.cStat,
        xMotivo: retEvento.xMotivo,
        xmlAssinado: xmlSigned,
        xmlRetorno: soapResponse,
      });
    }

    // Se falhou
    return NextResponse.json({
      success: false,
      message: retEvento?.xMotivo || result?.xMotivo || 'Falha ao registrar evento na SEFAZ',
      cStat: retEvento?.cStat || result?.cStat,
      xmlRetorno: soapResponse,
      xmlEnviado: xmlSigned
    }, { status: 400 });

  } catch (error: any) {
    console.error('Erro na rota de Evento SEFAZ:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Erro interno no servidor'
    }, { status: 500 });
  }
}

