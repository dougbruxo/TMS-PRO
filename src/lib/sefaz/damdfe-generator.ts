/**
 * DezLog Fiscal Engine — DAMDFE Generator v2
 * Gera o PDF do DAMDFE usando @react-pdf/renderer (server-side).
 */

import React from 'react';
import fs from 'fs';
import path from 'path';
import { renderToStream } from '@react-pdf/renderer';
import { DamdfeDocument, type DamdfeData } from './damdfe-template';

export interface MdfeDocumentoCompleto {
  chaveAcesso: string;
  protocolo?: string;
  dataAutorizacao?: string;
  ambiente: 'homologacao' | 'producao';
  serie: number;
  numeroMdfe: number;
  dataEmissao: string;
  emitente: {
    razaoSocial: string;
    cnpj: string;
    inscricaoEstadual: string;
    endereco: string;
    cidade: string;
    estado: string;
    cep: string;
    telefone?: string;
    rntrc?: string;
    logoUrl?: string;
  };
  motoristaNome: string;
  motoristaCpf?: string;
  veiculoPlaca: string;
  veiculoRntrc?: string;
  veiculoEstado?: string;
  ufInicio: string;
  ufFim: string;
  ufPercurso?: string;
  qtdCte: number;
  qtdNfe: number;
  chavesDocumentos: string[];
  vCarga: number;
  qCarga: number;
  seguradora?: string;
  apolice?: string;
  averbacao?: string;
  ciot?: string;
  ciotCpfCnpj?: string;
  observacoes?: string;
}

export async function generateDamdfePdf(doc: MdfeDocumentoCompleto): Promise<Buffer> {
  const barcodeSrc = generateBarcodeDataUrl(doc.chaveAcesso);
  const qrCodeSrc = await generateQrCodeDataUrl(doc.chaveAcesso, doc.ambiente);
  const logoSrc = resolveLogoBase64(doc.emitente.logoUrl);

  const data: DamdfeData = {
    chaveAcesso: doc.chaveAcesso,
    protocolo: doc.protocolo,
    dataAutorizacao: doc.dataAutorizacao,
    ambiente: doc.ambiente,
    modelo: '58',
    serie: String(doc.serie),
    numeroMdfe: String(doc.numeroMdfe).padStart(9, '0'),
    dataEmissao: doc.dataEmissao,
    folha: '1/1',
    ufPercurso: doc.ufPercurso,
    emitente: { ...doc.emitente, logoUrl: logoSrc || undefined },
    motoristaNome: doc.motoristaNome,
    motoristaCpf: doc.motoristaCpf,
    veiculoPlaca: doc.veiculoPlaca,
    veiculoRntrc: doc.veiculoRntrc,
    veiculoEstado: doc.veiculoEstado,
    ufInicio: doc.ufInicio,
    ufFim: doc.ufFim,
    qtdCte: doc.qtdCte,
    qtdNfe: doc.qtdNfe,
    chavesDocumentos: doc.chavesDocumentos,
    vCarga: fmt2(doc.vCarga),
    qCarga: fmt4(doc.qCarga),
    seguradora: doc.seguradora,
    apolice: doc.apolice,
    averbacao: doc.averbacao,
    ciot: doc.ciot,
    ciotCpfCnpj: doc.ciotCpfCnpj,
    observacoes: doc.observacoes,
    barcodeSrc,
    qrCodeSrc,
  };

  // Sanitizar dados para garantir que não haja objetos complexos
  const plainData = JSON.parse(JSON.stringify(data));

  // Função recursiva para limpar propriedades de desenvolvimento do React
  const sanitizeReactElement = (element: any): any => {
    if (!element || typeof element !== 'object') return element;
    if (Array.isArray(element)) return element.map(sanitizeReactElement);
    const isElement = !!element.$$typeof || ('_owner' in element) || ('props' in element && 'type' in element);
    if (isElement) {
      const sanitizedProps = element.props ? sanitizeReactElement(element.props) : {};
      if ('ref' in sanitizedProps) {
        delete sanitizedProps.ref;
      }
      return {
        $$typeof: Symbol.for('react.element'),
        type: element.type,
        key: element.key != null ? element.key : null,
        ref: null,
        props: sanitizedProps
      };
    }
    const newObj: any = {};
    for (const key in element) {
      if (key === '_owner' || key === '_store' || key === '$$typeof') continue;
      newObj[key] = sanitizeReactElement(element[key]);
    }
    return newObj;
  };

  try {
    const element = DamdfeDocument({ data: plainData });
    const sanitizedElement = sanitizeReactElement(element);

    const stream = await renderToStream(sanitizedElement);
    const chunks: any[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);
    return Buffer.from(pdfBuffer);
  } catch (renderError: any) {
    console.error('Erro durante a renderização do PDF do DAMDFE:', renderError);
    throw new Error(`Falha na renderização do motor PDF do DAMDFE: ${renderError.message}`);
  }
}

// ── Logo resolver (local file → base64) ──
function resolveLogoBase64(logoUrl?: string): string | null {
  if (!logoUrl) return null;
  try {
    // Public URL to local path
    const relative = logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`;
    const localPath = path.join(process.cwd(), 'public', relative);
    if (fs.existsSync(localPath)) {
      const ext = path.extname(localPath).replace('.', '').toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg';
      const b64 = fs.readFileSync(localPath).toString('base64');
      return `data:${mime};base64,${b64}`;
    }
  } catch { /* ignore */ }
  return null;
}

// ── Barcode (simplified visual) ──
function generateBarcodeDataUrl(chaveAcesso: string): string {
  const digits = chaveAcesso.replace(/\D/g, '');
  let x = 0;
  const bars: string[] = [];
  for (let i = 0; i < digits.length; i++) {
    const d = parseInt(digits[i], 10);
    const bw = 1 + (d % 3);
    const ww = 1 + ((d + 1) % 2);
    bars.push(`<rect x="${x}" y="0" width="${bw}" height="40" fill="black"/>`);
    x += bw + ww;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="40" viewBox="0 0 ${x} 40">${bars.join('')}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// ── QR Code ──
async function generateQrCodeDataUrl(chaveAcesso: string, ambiente: 'homologacao' | 'producao'): Promise<string> {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const url = `https://dfe-portal.svrs.rs.gov.br/MDFE/QRCode?chMDFe=${chaveAcesso}&tpAmb=${tpAmb}`;
  try {
    const QRCode = await import('qrcode').catch(() => null);
    if (QRCode) {
      const svg = await QRCode.toString(url, { type: 'svg', width: 100, margin: 0 });
      return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    }
  } catch { /* fallback */ }
  const ph = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="white" stroke="#ccc"/><text x="50" y="50" text-anchor="middle" font-size="8" fill="#999">QR Code</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(ph).toString('base64')}`;
}

function fmt2(v: number) { return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmt4(v: number) { return v.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }); }
