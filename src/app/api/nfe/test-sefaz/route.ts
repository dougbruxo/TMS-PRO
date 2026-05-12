/**
 * Diagnóstico: compara WSDL StatusServico vs RecepcaoSinc e testa CDATA encoding.
 * GET /api/nfe/test-sefaz
 */
import { NextResponse } from 'next/server';
import https from 'https';
import crypto from 'crypto';
import { connectToDatabase } from '@/lib/database';
import { extractCertificate, decryptPassword } from '@/lib/sefaz/certificate';

async function httpsGet(url: string, cert: any) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, port: 443, path: u.pathname + u.search, method: 'GET', key: cert.privateKey, cert: cert.certificate, rejectUnauthorized: false, secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT, timeout: 15000 }, (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode || 0, body: b })); });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); }); req.end();
  });
}

async function soap(url: string, action: string, envelope: string, cert: any) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, port: 443, path: u.pathname, method: 'POST', headers: { 'Content-Type': `application/soap+xml; charset=utf-8; action="${action}"`, 'Content-Length': Buffer.byteLength(envelope, 'utf8') }, key: cert.privateKey, cert: cert.certificate, rejectUnauthorized: false, secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT, timeout: 30000 }, (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode || 0, body: b || '(vazio)' })); });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); }); req.write(envelope); req.end();
  });
}

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const certDoc = await db.collection('system_settings').findOne({ type: 'certificado_a1' });
    if (!certDoc?.pfxBase64 || !certDoc?.pfxPassword) return NextResponse.json({ error: 'Cert não configurado' }, { status: 400 });
    const cert = extractCertificate(Buffer.from(certDoc.pfxBase64, 'base64'), decryptPassword(certDoc.pfxPassword));

    const base = 'https://homologacao.nfe.fazenda.sp.gov.br/CTeWS/WS';

    // 1. Comparar tipos de cteDadosMsg nos 2 WSDLs
    const [wsdlStatus, wsdlRecepcao] = await Promise.all([
      httpsGet(`${base}/CTeStatusServicoV4.asmx?WSDL`, cert),
      httpsGet(`${base}/CTeRecepcaoSincV4.asmx?WSDL`, cert),
    ]);
    const statusCteDadosType = wsdlStatus.body.match(/name="cteDadosMsg"[^/]*type="([^"]+)"/)?.[1] || 'não encontrado';
    const recepcaoCteDadosType = wsdlRecepcao.body.match(/name="cteDadosMsg"[^/]*type="([^"]+)"/)?.[1] || 'não encontrado';

    // 2. Testar com CDATA (XML como string literal)
    const wsdlNs = 'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcaoSincV4';
    const action = 'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcaoSincV4/cteRecepcao';
    const url = `${base}/CTeRecepcaoSincV4.asmx`;
    const innerXml = `<enviCTe versao="4.00" xmlns="http://www.portalfiscal.inf.br/cte"><idLote>1</idLote><indSinc>1</indSinc><CTe xmlns="http://www.portalfiscal.inf.br/cte"><infCte versao="4.00" Id="x"><ide><cUF>35</cUF></ide></infCte></CTe></enviCTe>`;

    // Formato A: XML inline (atual)
    const envA = `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><cteDadosMsg xmlns="${wsdlNs}">${innerXml}</cteDadosMsg></soap12:Body></soap12:Envelope>`;

    // Formato B: CDATA
    const envB = `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><cteDadosMsg xmlns="${wsdlNs}"><![CDATA[${innerXml}]]></cteDadosMsg></soap12:Body></soap12:Envelope>`;

    // Formato C: XML escaped
    const escaped = innerXml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const envC = `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><cteDadosMsg xmlns="${wsdlNs}">${escaped}</cteDadosMsg></soap12:Body></soap12:Envelope>`;

    const [rA, rB, rC] = await Promise.all([soap(url, action, envA, cert), soap(url, action, envB, cert), soap(url, action, envC, cert)]);

    return NextResponse.json({
      wsdl_cteDadosMsg_StatusServico: statusCteDadosType,
      wsdl_cteDadosMsg_RecepcaoSinc: recepcaoCteDadosType,
      formatoA_xmlInline: { status: rA.status, body: rA.body.substring(0, 300) },
      formatoB_cdata: { status: rB.status, body: rB.body.substring(0, 300) },
      formatoC_escaped: { status: rC.status, body: rC.body.substring(0, 300) },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
