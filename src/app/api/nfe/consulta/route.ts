import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { sendSoapRequest, extractDeepValue } from '@/lib/sefaz/soap-client';
import { getEndpoints, getMdfeEndpoints, SOAP_ACTIONS, MDFE_SOAP_ACTIONS } from '@/lib/sefaz/endpoints';
import { loadCertificateFromDB } from '@/lib/sefaz/certificate';
import { XMLParser } from 'fast-xml-parser';

export async function POST(request: Request) {
  try {
    const { chave } = await request.json();

    if (!chave || typeof chave !== 'string') {
      return NextResponse.json({ message: 'Chave de acesso inválida.' }, { status: 400 });
    }

    // Limpar a chave
    const cleanChave = chave.replace(/\D/g, '');

    if (cleanChave.length !== 44) {
      return NextResponse.json({ message: 'A chave de acesso deve ter 44 dígitos.' }, { status: 400 });
    }

    // Identificar o tipo do documento pela chave (dígitos 20 e 21)
    const modelo = cleanChave.substring(20, 22);
    // Identificar UF (dígitos 0 e 1)
    const ufCod = cleanChave.substring(0, 2);

    let isCTe = false;
    let isMDFe = false;
    let isNFe = false;

    if (modelo === '57') isCTe = true;
    else if (modelo === '58') isMDFe = true;
    else if (modelo === '55') isNFe = true;
    else {
      return NextResponse.json({ message: `Modelo de documento não suportado: ${modelo}.` }, { status: 400 });
    }

    // Buscar perfil da empresa e certificado
    const { db } = await connectToDatabase();
    const company = await db.collection('company_profiles').findOne({ isDefault: true });
    
    // Identificar ambiente - se não informado, assume produção para consulta de terceiros, 
    // ou usamos o que estiver no banco de dados para os nossos próprios docs
    let ambiente: 'producao' | 'homologacao' = 'producao';
    // Opcional: verificar se o documento foi emitido por nós para saber o ambiente correto
    const localDoc = await db.collection('issued_documents').findOne({ chaveAcesso: cleanChave });
    if (localDoc) {
      ambiente = localDoc.environment === 'homologacao' ? 'homologacao' : 'producao';
    } else {
      // Pela chave, o dígito 34 define tipo de emissão, mas o ambiente (tpAmb) precisamos tentar adivinhar. 
      // Por padrão vamos usar o ambiente que está configurado no perfil da empresa
      ambiente = company?.ambienteSefaz === 'homologacao' ? 'homologacao' : 'producao';
    }
    
    const tpAmb = ambiente === 'producao' ? '1' : '2';

    const certData = await loadCertificateFromDB(db);
    if (!certData) {
      return NextResponse.json({ message: 'Certificado digital não configurado' }, { status: 400 });
    }

    const certInfo = { privateKey: certData.privateKey, certificate: certData.certificate };

    if (isNFe) {
      // Para NF-e precisaríamos mapear os endpoints da NFe. 
      // Como o foco é CT-e e MDF-e, vamos retornar uma mensagem explicativa.
      // Se necessário, podemos manter o fallback do ConsultaDanfe APENAS para baixar XML de NF-e
      return NextResponse.json({ 
        message: 'A consulta de status de NF-e via SOAP requer os endpoints específicos da NFe que não estão mapeados no motor atual. Faça upload do XML manualmente.',
        status: 'Requer Upload XML' 
      }, { status: 400 });
    }

    let url = '';
    let action = '';
    let soapBody = '';
    let tagRetorno = '';

    if (isCTe) {
      // Mapeamento simplificado de codigo para sigla UF
      const codigosUf: Record<string, string> = {
        '35': 'SP', '43': 'RS', '31': 'MG', '51': 'MT', '41': 'PR' // Adicionar mais se necessário
      };
      const ufSigla = codigosUf[ufCod] || 'RS'; // Fallback para SVRS
      
      const endpoints = getEndpoints(ufSigla, ambiente);
      url = endpoints.CTeConsulta;
      action = SOAP_ACTIONS.CTeConsulta;
      tagRetorno = 'retConsSitCTe';
      
      soapBody = `
        <cteDadosMsg xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeConsultaV4">
          <consSitCTe xmlns="http://www.portalfiscal.inf.br/cte" versao="4.00">
            <tpAmb>${tpAmb}</tpAmb>
            <xServ>CONSULTAR</xServ>
            <chCTe>${cleanChave}</chCTe>
          </consSitCTe>
        </cteDadosMsg>
      `;
    } else if (isMDFe) {
      const endpoints = getMdfeEndpoints(ambiente);
      url = endpoints.MDFeConsultaSit;
      action = MDFE_SOAP_ACTIONS.MDFeConsultaSit;
      tagRetorno = 'retConsSitMDFe';
      
      soapBody = `
        <mdfeDadosMsg xmlns="http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeConsulta">
          <consSitMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00">
            <tpAmb>${tpAmb}</tpAmb>
            <xServ>CONSULTAR</xServ>
            <chMDFe>${cleanChave}</chMDFe>
          </consSitMDFe>
        </mdfeDadosMsg>
      `;
    }

    const soapResponse = await sendSoapRequest(url, action, soapBody, certInfo);
    
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const parsedObj = parser.parse(soapResponse);
    const result = extractDeepValue(parsedObj, tagRetorno);
    
    // O retorno da SEFAZ para consulta (retConsSitCTe / retConsSitMDFe)
    // O status cStat=100 significa autorizado. Se for 101 é cancelado.
    
    return NextResponse.json({
      status: 'ok',
      tipo: isCTe ? 'CTE' : 'MDFE',
      chave: cleanChave,
      cStat: result?.cStat,
      xMotivo: result?.xMotivo,
      ambiente: ambiente,
      // Nota: O web service de consulta da SEFAZ NÃO retorna o XML original completo (apenas o protCTe ou protMDFe)
      xml_base64: null,
      pdf_base64: null,
      rawReturn: result
    });

  } catch (error: any) {
    console.error('Erro na consulta SEFAZ:', error);
    return NextResponse.json(
      { message: 'Erro interno na consulta SEFAZ via SOAP.', error: error.message },
      { status: 500 }
    );
  }
}
