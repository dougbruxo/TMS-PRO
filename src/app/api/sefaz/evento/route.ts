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
      return NextResponse.json({ message: 'documentId e tipoEvento são obrigatórios' }, { status: 400 });
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
      return NextResponse.json({ message: 'Documento não encontrado' }, { status: 404 });
    }

    if (doc.status === 'cancelado' || doc.status === 'encerrado') {
      return NextResponse.json({ message: `Documento já está ${doc.status}` }, { status: 400 });
    }

    // 2. Determinar tipo e ambiente
    const isCTe = doc.type === 'CTE';
    const isMDFe = doc.type === 'MDFE';
    const ambiente = doc.environment === 'producao' ? 'producao' : 'homologacao';
    
    // 3. Buscar perfil da empresa e certificado
    const company = await db.collection('company_profiles').findOne({ isDefault: true });
    if (!company || !company.cnpj || !company.codigoUf) {
      return NextResponse.json({ message: 'Perfil da empresa incompleto (CNPJ e código UF são necessários)' }, { status: 400 });
    }

    const certData = await loadCertificateFromDB(db);
    if (!certData) {
      return NextResponse.json({ message: 'Certificado digital não configurado' }, { status: 400 });
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
      codigoUf: company.codigoUf,
      cnpj: company.cnpj.replace(/\D/g, ''),
      chaveAcesso: doc.chaveAcesso,
      tipoEvento,
      nSeqEvento,
      detalhes: {
        protocolo: doc.protocolo,
        justificativa,
        codigoMunicipioEncerramento: codigoMunicipioEncerramento || doc.cMunCarrega || doc.cMunDescarga, // fallback simplificado
        ufEncerramento: ufEncerramento || doc.ufFim || doc.ufInicio,
        grupoAlterado,
        campoAlterado,
        valorAlterado
      }
    };

    // 5. Construir XML não assinado
    let xmlUnsigned;
    try {
      const result = buildEventoXml(eventoInput);
      xmlUnsigned = result.xml;
    } catch (err: any) {
      return NextResponse.json({ message: `Erro ao construir evento: ${err.message}` }, { status: 400 });
    }

    // 6. Assinar o XML
    const xmlSigned = signEventoXml(xmlUnsigned, certData.privateKey, certData.certificate);

    // 7. Enviar via SOAP
    const certInfo = { privateKey: certData.privateKey, certificate: certData.certificate };
    
    let url = '';
    let action = '';
    
    if (isCTe) {
      const endpoints = getEndpoints(company.estado || 'RS', ambiente);
      url = endpoints.CTeRecepcaoEvento;
      action = SOAP_ACTIONS.CTeRecepcaoEvento;
    } else {
      const endpoints = getMdfeEndpoints(ambiente);
      url = endpoints.MDFeRecepcaoEvento;
      action = MDFE_SOAP_ACTIONS.MDFeRecepcaoEvento;
    }

    // O Envelope de evento envia os dados dentro de <cteDadosMsg> (para CT-e) ou <mdfeDadosMsg> (para MDF-e)
    const namespace = isCTe ? 'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcaoEventoV4' : 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoEvento';
    const msgTag = isCTe ? 'cteDadosMsg' : 'mdfeDadosMsg';
    
    const soapBody = `
      <${msgTag} xmlns="${namespace}">
        ${xmlSigned}
      </${msgTag}>
    `;

    const soapResponse = await sendSoapRequest(url, action, soapBody, certInfo);
    
    // 8. Extrair resposta
    // Para evento, o retorno é retEventoCTe ou retEventoMDFe
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const parsedObj = parser.parse(soapResponse);

    const tagRetorno = isCTe ? 'retEventoCTe' : 'retEventoMDFe';
    const result = extractDeepValue(parsedObj, tagRetorno);
    
    const retEvento = result?.infEvento || extractDeepValue(parsedObj, 'infEvento');
    
    // Status 135 significa Evento Registrado e Vinculado
    if (retEvento && retEvento.cStat === '135') {
      // Atualizar no banco de dados local
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
