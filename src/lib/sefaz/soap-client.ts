/**
 * DezLog Fiscal Engine — SOAP Client (SEFAZ)
 * 
 * Cliente para comunicação com os Web Services SOAP da SEFAZ.
 * Usa TLS mútuo (mutual TLS) com o certificado digital A1.
 * 
 * Os Web Services da SEFAZ usam SOAP 1.2 (namespace: http://www.w3.org/2003/05/soap-envelope)
 * e exigem que o certificado do cliente seja anexado à conexão HTTPS.
 */

import https from 'https';
import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
import { XMLParser } from 'fast-xml-parser';
import { getEndpoints, SOAP_ACTIONS, getMdfeEndpoints, MDFE_SOAP_ACTIONS, type SefazAmbiente } from './endpoints';
import { UF_CODES } from './utils';
import type { CertificateInfo } from './certificate';

// ============================================================
// TIPOS DE RESPOSTA
// ============================================================

export interface SefazResponse {
  /** Se a comunicação com a SEFAZ foi bem sucedida */
  success: boolean;
  /** Código de status retornado pela SEFAZ */
  cStat: string;
  /** Motivo/descrição do status */
  xMotivo: string;
  /** Protocolo de autorização (quando autorizado) */
  nProt?: string;
  /** Data/hora do recebimento pela SEFAZ */
  dhRecbto?: string;
  /** Chave de acesso do CT-e */
  chCTe?: string;
  /** XML da resposta completa */
  xmlRetorno: string;
  /** XML do protocolo (protCTe) para embutir no CT-e */
  xmlProtocolo?: string;
  /** Digest value retornado */
  digVal?: string;
}

export interface StatusServicoResponse {
  /** Se o serviço está operando */
  online: boolean;
  /** Código de status */
  cStat: string;
  /** Motivo */
  xMotivo: string;
  /** Tempo médio de resposta */
  tMed?: string;
  /** Data/hora do retorno */
  dhRetorno?: string;
  /** Observações */
  xObs?: string;
}

// ============================================================
// FUNÇÕES PRINCIPAIS
// ============================================================

/**
 * Envia um CT-e assinado para a SEFAZ (emissão síncrona).
 * 
 * @param xmlAssinado - XML do CT-e já assinado digitalmente
 * @param uf - UF do emitente (para determinar o endpoint correto)
 * @param ambiente - 'homologacao' ou 'producao'
 * @param cert - Informações do certificado digital
 * @returns Resposta da SEFAZ
 */
export async function enviarCte(
  xmlAssinado: string,
  uf: string,
  ambiente: SefazAmbiente,
  cert: CertificateInfo
): Promise<SefazResponse> {
  const endpoints = getEndpoints(uf, ambiente);
  const url = endpoints.CTeRecepcaoSinc;
  const soapAction = SOAP_ACTIONS.CTeRecepcaoSinc;

  console.log(`[SEFAZ CTE] UF=${uf}, Ambiente=${ambiente}`);
  console.log(`[SEFAZ CTE] Endpoint: ${url}`);
  console.log(`[SEFAZ CTE] SOAP Action: ${soapAction}`);

  // CTeRecepcaoSincV4 recebe o <CTe> DIRETAMENTE (sem wrapper <enviCTe>).
  // O enviCTe é usado apenas no serviço ASSÍNCRONO em lote.
  // cStat 215 confirma: "enviCTe element is not declared" para o serviço síncrono.
  const cteClean = xmlAssinado.replace(/^<\?xml[^>]+>\s*/i, '');

  console.log(`[SEFAZ CTE] CTe (primeiros 200 chars): ${cteClean.substring(0, 200)}`);

  // SEFAZ-SP: cteDadosMsg é type="s:string" no WSDL.
  // O conteúdo deve ser GZIP+Base64 (cStat 244 = falha na descompactação se não comprimido).
  const cteGzip = await gzip(Buffer.from(cteClean, 'utf-8'));
  const cteBase64 = cteGzip.toString('base64');

  // Montar envelope SOAP 1.2 com o conteúdo comprimido
  const soapEnvelope = buildSoapEnvelope(cteBase64, 'cteDadosMsg');

  // Enviar para a SEFAZ
  const responseXml = await sendSoapRequest(url, soapAction, soapEnvelope, cert);

  // Parsear resposta
  return parseCteResponse(responseXml);
}



/**
 * Consulta o status de um CT-e pela chave de acesso.
 */
export async function consultarCte(
  chaveAcesso: string,
  uf: string,
  ambiente: SefazAmbiente,
  cert: CertificateInfo
): Promise<SefazResponse> {
  const tpAmb = ambiente === 'producao' ? 1 : 2;

  const consSitCTe = [
    `<consSitCTe versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte">`,
    `<tpAmb>${tpAmb}</tpAmb>`,
    `<xServ>CONSULTAR</xServ>`,
    `<chCTe>${chaveAcesso}</chCTe>`,
    `</consSitCTe>`,
  ].join('');

  const endpoints = getEndpoints(uf, ambiente);
  const soapEnvelope = buildSoapEnvelope(consSitCTe, 'cteDadosMsg', 'http://www.portalfiscal.inf.br/cte/wsdl/CTeConsultaV4');
  const responseXml = await sendSoapRequest(
    endpoints.CTeConsulta,
    SOAP_ACTIONS.CTeConsulta,
    soapEnvelope,
    cert
  );

  return parseCteResponse(responseXml);
}

/**
 * Verifica se o serviço da SEFAZ está operando.
 */
export async function consultarStatusServico(
  uf: string,
  ambiente: SefazAmbiente,
  cert: CertificateInfo
): Promise<StatusServicoResponse> {
  const tpAmb = ambiente === 'producao' ? 1 : 2;
  const cUF = UF_CODES[uf.toUpperCase()] || 35;

  const consStatServ = [
    `<consStatServCTe versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte">`,
    `<tpAmb>${tpAmb}</tpAmb>`,
    `<cUF>${cUF}</cUF>`,
    `<xServ>STATUS</xServ>`,
    `</consStatServCTe>`,
  ].join('');

  const endpoints = getEndpoints(uf, ambiente);
  const soapEnvelope = buildSoapEnvelope(consStatServ, 'cteDadosMsg', 'http://www.portalfiscal.inf.br/cte/wsdl/CTeStatusServicoV4');
  const responseXml = await sendSoapRequest(
    endpoints.CTeStatusServico,
    SOAP_ACTIONS.CTeStatusServico,
    soapEnvelope,
    cert
  );

  // Parsear resposta do status
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
  const parsed = parser.parse(responseXml);

  const retorno = extractDeepValue(parsed, 'retConsStatServCTe') || {};

  return {
    online: String(retorno.cStat) === '107', // 107 = Serviço em Operação
    cStat: String(retorno.cStat || ''),
    xMotivo: String(retorno.xMotivo || ''),
    tMed: retorno.tMed ? String(retorno.tMed) : undefined,
    dhRetorno: retorno.dhRetorno ? String(retorno.dhRetorno) : undefined,
    xObs: retorno.xObs ? String(retorno.xObs) : undefined,
  };
}

/**
 * Envia um evento do CT-e (cancelamento, carta de correção).
 */
export async function enviarEvento(
  xmlEventoAssinado: string,
  uf: string,
  ambiente: SefazAmbiente,
  cert: CertificateInfo
): Promise<SefazResponse> {
  const endpoints = getEndpoints(uf, ambiente);
  const soapEnvelope = buildSoapEnvelope(xmlEventoAssinado, 'cteDadosMsg', 'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcaoEventoV4');
  const responseXml = await sendSoapRequest(
    endpoints.CTeRecepcaoEvento,
    SOAP_ACTIONS.CTeRecepcaoEvento,
    soapEnvelope,
    cert
  );

  return parseCteResponse(responseXml);
}

/**
 * Envia um MDF-e assinado para a SEFAZ (emissão síncrona).
 */
export async function enviarMdfe(
  xmlAssinado: string,
  ambiente: SefazAmbiente,
  cert: CertificateInfo
): Promise<SefazResponse> {
  const endpoints = getMdfeEndpoints(ambiente);
  const url = endpoints.MDFeRecepcaoSinc;
  const soapAction = MDFE_SOAP_ACTIONS.MDFeRecepcaoSinc;

  // SVRS MDFeRecepcaoSinc espera o XML comprimido com GZIP e codificado em Base64,
  // assim como o CT-e 4.00 síncrono.
  const mdfeClean = xmlAssinado.replace(/^<\?xml[^>]+>\s*/i, '');
  const mdfeGzip = await gzip(Buffer.from(mdfeClean, 'utf-8'));
  const mdfeBase64 = mdfeGzip.toString('base64');

  const soapEnvelope = buildSoapEnvelope(mdfeBase64, 'mdfeDadosMsg',
    'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoSinc');

  const responseXml = await sendSoapRequest(url, soapAction, soapEnvelope, cert);
  return parseMdfeResponse(responseXml);
}

// ============================================================
// COMUNICAÇÃO SOAP
// ============================================================

/**
 * Constrói o envelope SOAP 1.2 para envio à SEFAZ.
 */
function buildSoapEnvelope(
  xmlContent: string,
  bodyTag: string,
  wsdlNamespace: string = 'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcaoSincV4'
): string {
  // Remover a declaração XML (ex: <?xml version="1.0" encoding="UTF-8"?>) se existir
  // pois não pode haver declaração XML no meio do corpo do envelope SOAP
  const cleanXmlContent = xmlContent.replace(/^<\?xml[^>]+>\s*/i, '');

  return [
    `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">`,
    '<soap12:Body>',
    `<${bodyTag} xmlns="${wsdlNamespace}">`,
    cleanXmlContent,
    `</${bodyTag}>`,
    '</soap12:Body>',
    '</soap12:Envelope>',
  ].join('');
}

/**
 * Envia uma requisição SOAP para a SEFAZ com TLS mútuo.
 * 
 * O certificado digital A1 é usado tanto para a autenticação TLS
 * (o servidor SEFAZ exige certificado do cliente) quanto para
 * a assinatura do XML (feita antes de chegar aqui).
 */
export function sendSoapRequest(
  url: string,
  soapAction: string,
  soapEnvelope: string,
  cert: CertificateInfo
): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);

    const options: https.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${soapAction}"`,
        'SOAPAction': `"${soapAction}"`,
        'Content-Length': Buffer.byteLength(soapEnvelope, 'utf8'),
        'User-Agent': 'DezLog/1.0',
        'Accept': 'application/soap+xml, text/xml, */*',
      },
      // TLS Mútuo: certificado do cliente
      key: cert.privateKey,
      cert: cert.certificate,
      // Desabilitar verificação de certificado do servidor SEFAZ
      // (Node.js não possui as raízes ICP-Brasil nativamente)
      rejectUnauthorized: false,
      secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
      // Timeout de 60 segundos
      timeout: 60000,
    };

    const req = https.request(options, (res) => {
      let data = '';

      console.log(`[SOAP HTTP] Requesting: ${url}`);
      console.log(`[SOAP HTTP] Action: ${soapAction}`);
      console.log(`[SOAP HTTP] Envelope Length: ${Buffer.byteLength(soapEnvelope, 'utf8')}`);
      
      // Log sanitized envelope (first 500 chars)
      console.log(`[SOAP HTTP] Envelope: ${soapEnvelope.substring(0, 500)}...`);

      console.log(`[SOAP HTTP] Response Status: ${res.statusCode}`);
      console.log(`[SOAP HTTP] Response Headers:`, res.headers);

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          if (!data || data.trim() === '') {
            reject(new Error(`SEFAZ não retornou XML (HTTP ${res.statusCode}). Verifique se o certificado é válido e aceito pela SEFAZ.`));
          } else {
            resolve(data);
          }
        } else {
          reject(new Error(`SEFAZ retornou HTTP ${res.statusCode}: ${data.substring(0, 500)}`));
        }
      });
    });

    req.on('error', (error: any) => {
      if (error.code === 'ECONNREFUSED') {
        reject(new Error('Conexão recusada pela SEFAZ. O serviço pode estar fora do ar.'));
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
        reject(new Error('Timeout na conexão com a SEFAZ. Tente novamente em alguns minutos.'));
      } else if (error.message?.includes('SSL') || error.message?.includes('certificate')) {
        reject(new Error(`Erro de certificado SSL: ${error.message}. Verifique se o certificado A1 é válido.`));
      } else {
        reject(new Error(`Erro de comunicação com a SEFAZ: ${error.message}`));
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout: A SEFAZ não respondeu em 60 segundos.'));
    });

    req.write(soapEnvelope);
    req.end();
  });
}

// ============================================================
// PARSERS DE RESPOSTA
// ============================================================

/**
 * Parseia a resposta da SEFAZ para extrair o resultado da emissão.
 * 
 * A SEFAZ CT-e 4.00 pode retornar o resultado em diferentes estruturas:
 * - Síncrono: <retCTe> com <protCTe><infProt> interno
 * - Rejeição no lote: <retCTe> com cStat/xMotivo direto (sem protCTe)
 * - Consulta: <retConsSitCTe>
 * - Evento: <retEventoCTe>
 * - SOAP Fault: <Fault> com <Code>/<Reason>
 */
function parseCteResponse(responseXml: string): SefazResponse {
  console.log("=== RAW SEFAZ RESPONSE (length:", responseXml?.length, ") ===");
  console.log(responseXml);
  console.log("==========================");

  if (!responseXml || responseXml.trim().length === 0) {
    return {
      success: false,
      cStat: '999',
      xMotivo: 'SEFAZ retornou resposta vazia. Possível problema de conectividade ou certificado.',
      xmlRetorno: '',
    };
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    attributeNamePrefix: '@_',
  });

  let parsed: any;
  try {
    parsed = parser.parse(responseXml);
  } catch (e: any) {
    return {
      success: false,
      cStat: '999',
      xMotivo: `Erro ao parsear resposta XML da SEFAZ: ${e.message}. Resposta bruta: ${responseXml.substring(0, 300)}`,
      xmlRetorno: responseXml,
    };
  }

  console.log("=== PARSED SEFAZ KEYS ===");
  console.log(JSON.stringify(parsed, null, 2).substring(0, 2000));
  console.log("==========================");

  // 1. Tratar SOAP Fault primeiro
  const fault = extractDeepValue(parsed, 'Fault');
  if (fault) {
    const faultCode = extractDeepValue(fault, 'Value')
      || extractDeepValue(fault, 'faultcode')
      || 'SOAP-FAULT';
    const faultString = extractDeepValue(fault, 'Text')
      || extractDeepValue(fault, 'faultstring')
      || extractDeepValue(fault, 'Reason')
      || 'Erro SOAP retornado pela SEFAZ';
    const faultDetail = extractDeepValue(fault, 'Detail')
      || extractDeepValue(fault, 'detail')
      || '';
    const detailStr = typeof faultDetail === 'string' ? faultDetail : JSON.stringify(faultDetail);
    return {
      success: false,
      cStat: String(faultCode),
      xMotivo: `SOAP Fault: ${String(faultString)}${detailStr ? ` | Detalhe: ${detailStr.substring(0, 200)}` : ''}`,
      xmlRetorno: responseXml,
    };
  }

  // 2. Tentar extrair resultado por tags conhecidas (ordem de prioridade)
  const RESULT_TAGS = [
    'retCTe', 'retCTeOS', 'retConsSitCTe', 'retEventoCTe',
    'cteRecepcaoSincResult', 'cteResultMsg',
    'retEnviCte', 'retConsReciCTe',
  ];

  let retorno: any = null;
  let matchedTag = '';
  for (const tag of RESULT_TAGS) {
    const found = extractDeepValue(parsed, tag);
    if (found && typeof found === 'object' && Object.keys(found).length > 0) {
      retorno = found;
      matchedTag = tag;
      break;
    }
  }

  // 3. Se cteRecepcaoSincResult contém XML como string, parse-lo novamente
  if (retorno && matchedTag === 'cteRecepcaoSincResult' && typeof retorno === 'string') {
    try {
      const innerParsed = parser.parse(retorno);
      retorno = extractDeepValue(innerParsed, 'retCTe') || innerParsed;
    } catch (_) { /* ignorar, usar como está */ }
  }

  // 4. Se nenhuma tag conhecida foi encontrada, buscar cStat em qualquer profundidade
  if (!retorno || Object.keys(retorno).length === 0) {
    const deepCStat = extractDeepValue(parsed, 'cStat');
    const deepXMotivo = extractDeepValue(parsed, 'xMotivo');

    if (deepCStat) {
      console.log(`[SEFAZ Parser] Nenhuma tag raiz encontrada, mas cStat=${deepCStat} encontrado em busca profunda`);
      retorno = { cStat: deepCStat, xMotivo: deepXMotivo || 'Motivo não informado' };
      matchedTag = 'deep-search';
    } else {
      // Nenhum dado identificável — retornar erro com XML bruto para diagnóstico
      return {
        success: false,
        cStat: '999',
        xMotivo: `Resposta da SEFAZ não contém resultado identificável. Verifique o XML retornado no console do servidor. Primeiros 300 chars: ${responseXml.substring(0, 300)}`,
        xmlRetorno: responseXml,
      };
    }
  }

  console.log(`[SEFAZ Parser] Tag encontrada: ${matchedTag}`);

  // 5. Extrair protocolo (protCTe) — presente em autorizações
  const protCTe = retorno.protCTe || extractDeepValue(retorno, 'protCTe') || {};
  const infProt = protCTe.infProt || extractDeepValue(protCTe, 'infProt') || {};

  // 6. Resolver cStat/xMotivo: primeiro do protocolo, depois do retorno raiz
  const cStat = String(infProt.cStat || retorno.cStat || '');
  const xMotivo = String(infProt.xMotivo || retorno.xMotivo || 'Motivo não informado pela SEFAZ');

  console.log(`[SEFAZ Parser] cStat=${cStat}, xMotivo=${xMotivo}`);

  // Status 100 = Autorizado, 150 = Autorizado fora do prazo
  const isAutorizado = cStat === '100' || cStat === '150';

  // 7. Extrair XML do protocolo para embutir no CT-e processado
  let xmlProtocolo: string | undefined;
  if (isAutorizado) {
    const protMatch = responseXml.match(/<protCTe[^>]*>[\s\S]*?<\/protCTe>/);
    xmlProtocolo = protMatch?.[0];
  }

  return {
    success: isAutorizado,
    cStat,
    xMotivo,
    nProt: infProt.nProt ? String(infProt.nProt) : undefined,
    dhRecbto: infProt.dhRecbto ? String(infProt.dhRecbto) : undefined,
    chCTe: infProt.chCTe ? String(infProt.chCTe) : undefined,
    digVal: infProt.digVal ? String(infProt.digVal) : undefined,
    xmlRetorno: responseXml,
    xmlProtocolo,
  };
}

/**
 * Parseia a resposta da SEFAZ para MDF-e.
 */
function parseMdfeResponse(responseXml: string): SefazResponse {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    attributeNamePrefix: '@_',
  });

  let parsed: any;
  try {
    parsed = parser.parse(responseXml);
  } catch (e: any) {
    return {
      success: false,
      cStat: '999',
      xMotivo: `Erro ao parsear resposta XML da SEFAZ (MDF-e): ${e.message}`,
      xmlRetorno: responseXml,
    };
  }

  const retorno = extractDeepValue(parsed, 'retMDFe')
    || extractDeepValue(parsed, 'retConsSitMDFe')
    || extractDeepValue(parsed, 'retEventoMDFe')
    || extractDeepValue(parsed, 'mdfeRecepcaoSincResult')
    || {};

  // Tratar SOAP Fault
  const fault = extractDeepValue(parsed, 'Fault');
  if (fault && Object.keys(retorno).length === 0) {
    const faultCode = extractDeepValue(fault, 'Value') || 'SOAP-FAULT';
    const faultString = extractDeepValue(fault, 'Text') || 'Erro interno da SEFAZ';
    return {
      success: false,
      cStat: String(faultCode),
      xMotivo: String(faultString),
      xmlRetorno: responseXml,
    };
  }

  const protMDFe = retorno.protMDFe || extractDeepValue(parsed, 'protMDFe') || {};
  const infProt = protMDFe.infProt || {};

  const cStat = String(infProt.cStat || retorno.cStat || '');
  const xMotivo = String(infProt.xMotivo || retorno.xMotivo || 'Resposta não identificada');
  const isAutorizado = String(infProt.cStat) === '100' || String(infProt.cStat) === '150';

  let xmlProtocolo: string | undefined;
  if (isAutorizado) {
    const protMatch = responseXml.match(/<protMDFe[^>]*>[\s\S]*?<\/protMDFe>/);
    xmlProtocolo = protMatch?.[0];
  }

  return {
    success: isAutorizado,
    cStat,
    xMotivo,
    nProt: infProt.nProt ? String(infProt.nProt) : undefined,
    dhRecbto: infProt.dhRecbto ? String(infProt.dhRecbto) : undefined,
    chCTe: infProt.chMDFe ? String(infProt.chMDFe) : undefined,
    digVal: infProt.digVal ? String(infProt.digVal) : undefined,
    xmlRetorno: responseXml,
    xmlProtocolo,
  };
}

/**
 * Busca um valor profundo em um objeto parseado (independente de aninhamento SOAP).
 */
export function extractDeepValue(obj: any, key: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  if (key in obj) return obj[key];

  for (const k of Object.keys(obj)) {
    const result = extractDeepValue(obj[k], key);
    if (result !== undefined) return result;
  }

  return undefined;
}
