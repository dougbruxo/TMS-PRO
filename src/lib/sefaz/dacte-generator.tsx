/**
 * DezLog Fiscal Engine — DACTE Generator
 * 
 * Gera o PDF do DACTE (Documento Auxiliar do CT-e) a partir dos dados
 * de um CT-e autorizado ou em processamento.
 * 
 * Usa @react-pdf/renderer para renderização server-side.
 * Gera código de barras (Code 128) e QR Code como imagens base64.
 */

import React from 'react';
/** @jsxImportSource react */
import { renderToStream } from '@react-pdf/renderer';
import { DacteDocument, type DacteData } from './dacte-template';
import fs from 'fs';
import path from 'path';

// ============================================================
// TIPOS DE ENTRADA
// ============================================================

export interface CteDocumentoCompleto {
  chaveAcesso: string;
  protocolo?: string;
  dataAutorizacao?: string;
  ambiente: 'homologacao' | 'producao';
  serie: number;
  numeroCte: number;
  dataEmissao: string;
  cfop: string;
  naturezaOperacao: string;
  tipoCte: number;
  tipoServico: number;
  
  emitente: {
    razaoSocial: string;
    nomeFantasia?: string;
    cnpj: string;
    inscricaoEstadual: string;
    endereco: string;
    cidade: string;
    estado: string;
    cep: string;
    telefone?: string;
    logoUrl?: string;
    rntrc?: string;
  };
  
  remetente: {
    razaoSocial: string;
    cnpj: string;
    inscricaoEstadual?: string;
    endereco: string;
    cidade: string;
    estado: string;
    cep: string;
    telefone?: string;
    pais?: string;
  };
  
  destinatario: {
    razaoSocial: string;
    cnpj: string;
    inscricaoEstadual?: string;
    endereco: string;
    cidade: string;
    estado: string;
    cep: string;
    telefone?: string;
    pais?: string;
  };

  expedidor?: {
    razaoSocial: string;
    cnpj: string;
    inscricaoEstadual?: string;
    endereco: string;
    cidade: string;
    estado: string;
    cep: string;
    telefone?: string;
    pais?: string;
  };

  recebedor?: {
    razaoSocial: string;
    cnpj: string;
    inscricaoEstadual?: string;
    endereco: string;
    cidade: string;
    estado: string;
    cep: string;
    telefone?: string;
    pais?: string;
  };
  
  tomador: {
    tipo: number; // 0=Rem, 1=Exp, 2=Rec, 3=Dest, 4=Outros
    razaoSocial: string;
    cnpj: string;
    inscricaoEstadual?: string;
    endereco: string;
    cidade: string;
    estado: string;
    cep: string;
    telefone?: string;
    pais?: string;
  };
  
  valorServico: number;
  valorReceber: number;
  componentesValor?: Array<{ nome: string; valor: number }>;
  globalizado?: boolean;
  
  produtoPredominante: string;
  valorCarga: number;
  peso: number;
  quantidadeVolumes: number;
  especieCarga?: string;
  outrasCaracteristicas?: string;
  
  icmsCst: string;
  icmsBase: number;
  icmsAliquota: number;
  icmsValor: number;
  situacaoTributaria?: string;
  
  cidadeOrigem: string;
  ufOrigem: string;
  cidadeDestino: string;
  ufDestino: string;
  dataPrevEntrega?: string;
  
  nfeChaves: string[];
  observacoes?: string;
}

// ============================================================
// GERADOR PRINCIPAL
// ============================================================

/**
 * Gera o PDF do DACTE como Buffer.
 * 
 * @param doc - Dados completos do CT-e
 * @returns Buffer com o conteúdo do PDF
 */
export async function generateDactePdf(doc: CteDocumentoCompleto): Promise<Buffer> {
  // Mapear tipos
  const tiposCte: Record<number, string> = {
    0: 'NORMAL', 1: 'COMPLEMENTAR', 2: 'ANULAÇÃO', 3: 'SUBSTITUTO',
  };
  const tiposServico: Record<number, string> = {
    0: 'NORMAL', 1: 'SUBCONTRATAÇÃO', 2: 'REDESPACHO', 3: 'REDESP. INTERMEDIÁRIO', 4: 'MULTIMODAL',
  };
  const tiposTomador: Record<number, string> = {
    0: 'REMETENTE', 1: 'EXPEDIDOR', 2: 'RECEBEDOR', 3: 'DESTINATÁRIO', 4: 'OUTROS',
  };
  
  // Gerar imagens do código de barras e QR Code
  const barcodeSrc = generateBarcodeDataUrl(doc.chaveAcesso);
  const qrCodeSrc = await generateQrCodeDataUrl(doc.chaveAcesso, doc.ambiente);
  
  // Resolver Logo para Base64 se for um caminho local
  let logoBase64 = doc.emitente.logoUrl;
  if (doc.emitente.logoUrl && doc.emitente.logoUrl.startsWith('/')) {
    try {
      // Tentar encontrar o arquivo no sistema de arquivos
      // Se a URL for /api/assets/upload/logos/..., o arquivo está em public/upload/logos/...
      const relativePath = doc.emitente.logoUrl.replace(/^\/api\/assets\//, '').replace(/^\//, '');
      const fullPath = path.join(process.cwd(), 'public', relativePath);
      
      if (fs.existsSync(fullPath)) {
        const fileBuffer = fs.readFileSync(fullPath);
        const extension = path.extname(fullPath).replace('.', '') || 'png';
        logoBase64 = `data:image/${extension === 'jpg' ? 'jpeg' : extension};base64,${fileBuffer.toString('base64')}`;
      }
    } catch (err) {
      console.error('Erro ao converter logo para base64:', err);
    }
  }
  
  // Montar dados para o template
  const dacteData: DacteData = {
    chaveAcesso: doc.chaveAcesso,
    protocolo: doc.protocolo,
    dataAutorizacao: doc.dataAutorizacao,
    ambiente: doc.ambiente,
    
    modelo: '57',
    serie: String(doc.serie),
    numeroCte: String(doc.numeroCte).padStart(9, '0'),
    dataEmissao: doc.dataEmissao,
    cfop: doc.cfop,
    naturezaOperacao: doc.naturezaOperacao,
    tipoCte: tiposCte[doc.tipoCte] || 'NORMAL',
    tipoServico: tiposServico[doc.tipoServico] || 'NORMAL',
    modal: 'RODOVIÁRIO',
    
    emitente: {
      ...doc.emitente,
      logoUrl: logoBase64,
      rntrc: doc.emitente.rntrc,
    },
    remetente: doc.remetente,
    destinatario: doc.destinatario,
    expedidor: doc.expedidor,
    recebedor: doc.recebedor,
    tomador: {
      ...doc.tomador,
      tipo: tiposTomador[doc.tomador.tipo] || 'REMETENTE',
    },
    globalizado: doc.globalizado,
    
    valorServico: formatCurrency(doc.valorServico),
    valorReceber: formatCurrency(doc.valorReceber),
    componentesValor: doc.componentesValor?.map(c => ({ nome: c.nome, valor: formatCurrency(c.valor) })),
    
    produtoPredominante: doc.produtoPredominante,
    valorCarga: formatCurrency(doc.valorCarga),
    peso: formatNumber(doc.peso, 4),
    quantidadeVolumes: String(doc.quantidadeVolumes),
    especieCarga: doc.especieCarga,
    outrasCaracteristicas: doc.outrasCaracteristicas,
    
    icmsCst: doc.icmsCst,
    icmsBase: formatCurrency(doc.icmsBase),
    icmsAliquota: formatNumber(doc.icmsAliquota, 2),
    icmsValor: formatCurrency(doc.icmsValor),
    situacaoTributaria: doc.situacaoTributaria,
    
    cidadeOrigem: doc.cidadeOrigem,
    ufOrigem: doc.ufOrigem,
    cidadeDestino: doc.cidadeDestino,
    ufDestino: doc.ufDestino,
    dataPrevEntrega: doc.dataPrevEntrega,
    
    nfeChaves: doc.nfeChaves,
    observacoes: doc.observacoes,
    
    barcodeSrc,
    qrCodeSrc,
  };
  
  // Sanitizar dados para garantir que não haja objetos complexos (como ObjectId)
  const plainData = JSON.parse(JSON.stringify(dacteData));

  // Função recursiva para limpar propriedades de desenvolvimento do React
  // que causam o erro #31 e #284 no @react-pdf/renderer (Next.js App Router)
  const sanitizeReactElement = (element: any): any => {
    if (!element || typeof element !== 'object') return element;
    
    // Se for um array, sanitizar cada item
    if (Array.isArray(element)) return element.map(sanitizeReactElement);
    
    // Identificar um elemento React
    const isElement = !!element.$$typeof || ('_owner' in element) || ('props' in element && 'type' in element);
    
    if (isElement) {
      const sanitizedProps = element.props ? sanitizeReactElement(element.props) : {};
      
      // No React 19, ref foi movido para props.ref. O react-pdf espera React 18.
      // Removemos ref de props para evitar conflitos (nenhum componente do DACTE usa ref)
      if ('ref' in sanitizedProps) {
        delete sanitizedProps.ref;
      }
      
      return {
        $$typeof: Symbol.for('react.element'),
        type: element.type,
        key: element.key != null ? element.key : null,
        ref: null, // Forçar null absoluto para evitar Error 284
        props: sanitizedProps
      };
    }
    
    // Se for um objeto regular
    const newObj: any = {};
    for (const key in element) {
      if (key === '_owner' || key === '_store' || key === '$$typeof') continue;
      newObj[key] = sanitizeReactElement(element[key]);
    }
    
    return newObj;
  };

  try {
    // Renderizar o PDF invocando a função diretamente para evitar erros
    // de compatibilidade (Error #31) com o React 18+ / Next.js 15 RSC
    const element = DacteDocument({ data: plainData });
    const sanitizedElement = sanitizeReactElement(element);

    // Renderizar o PDF usando renderToStream (workaround para Next.js App Router)
    const stream = await renderToStream(sanitizedElement);
    
    // Converter stream para buffer
    const chunks: any[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);
    
    return Buffer.from(pdfBuffer);
  } catch (renderError: any) {
    console.error('Erro durante a renderização do PDF:', renderError);
    throw new Error(`Falha na renderização do motor PDF: ${renderError.message}`);
  }
}

// ============================================================
// GERADORES DE IMAGEM (Barcode e QR Code)
// ============================================================

/**
 * Gera um código de barras Code 128 no subconjunto C (Code 128-C)
 * específico para chaves de acesso numéricas de 44 dígitos, como SVG data URL.
 */
function generateBarcodeDataUrl(chaveAcesso: string): string {
  const digits = chaveAcesso.replace(/\D/g, '');
  if (digits.length !== 44) {
    // Fallback simples caso a chave não seja válida
    return `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><text x="10" y="20">Chave Inválida</text></svg>').toString('base64')}`;
  }

  // Tabela oficial do Code 128 (padrões de 0 a 106)
  const patterns = [
    "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
    "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
    "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
    "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
    "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
    "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
    "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
    "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
    "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
    "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
    "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
    "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
    "114311", "411113", "411311", "113141", "114131", "311141", "411131",
    "211412", // 103: Start A
    "211214", // 104: Start B
    "211232", // 105: Start C
    "2331112" // 106: Stop
  ];

  const codeList: number[] = [];

  // 1. Inserir caractere de Start C (índice 105)
  codeList.push(105);

  // 2. Codificar os 44 dígitos em 22 pares
  for (let i = 0; i < digits.length; i += 2) {
    const pairValue = parseInt(digits.substring(i, i + 2), 10);
    codeList.push(pairValue);
  }

  // 3. Calcular Checksum Modulo 103
  let checksum = 105; // Valor do Start C
  for (let i = 1; i < codeList.length; i++) {
    checksum += codeList[i] * i;
  }
  checksum = checksum % 103;

  // 4. Adicionar Checksum
  codeList.push(checksum);

  // 5. Adicionar Stop C (índice 106)
  codeList.push(106);

  // 6. Gerar caminhos de desenho do SVG
  const height = 40;
  const barWidth = 1.35; // Largura do módulo otimizada para encaixar no cabeçalho DACTE
  let x = 0;
  const bars: string[] = [];

  for (let charIdx = 0; charIdx < codeList.length; charIdx++) {
    const pattern = patterns[codeList[charIdx]];
    for (let elemIdx = 0; elemIdx < pattern.length; elemIdx++) {
      const width = parseInt(pattern[elemIdx], 10) * barWidth;
      const isBar = elemIdx % 2 === 0;

      if (isBar) {
        bars.push(`<rect x="${x}" y="0" width="${width}" height="${height}" fill="black"/>`);
      }
      x += width;
    }
  }

  const svgWidth = x;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${height}" viewBox="0 0 ${svgWidth} ${height}">${bars.join('')}</svg>`;
  
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Gera um QR Code como SVG data URL.
 * Conteúdo: URL de consulta do CT-e no portal da SEFAZ.
 */
async function generateQrCodeDataUrl(chaveAcesso: string, ambiente: 'homologacao' | 'producao'): Promise<string> {
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  // URL padrão do QR Code do CT-e
  const url = `https://dfe-portal.svrs.rs.gov.br/CTE/QRCode?chCTe=${chaveAcesso}&tpAmb=${tpAmb}`;
  
  try {
    // Tentar usar a lib qrcode se disponível
    const QRCode = await import('qrcode').catch(() => null);
    if (QRCode) {
      const qrSvg = await QRCode.toString(url, { type: 'svg', width: 100, margin: 0 });
      const base64 = Buffer.from(qrSvg).toString('base64');
      return `data:image/svg+xml;base64,${base64}`;
    }
  } catch {
    // Fallback: QR Code não disponível
  }
  
  // Fallback: gerar um placeholder SVG
  const placeholder = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="white" stroke="#ccc"/>
    <text x="50" y="50" text-anchor="middle" font-size="8" fill="#999">QR Code</text>
    <text x="50" y="62" text-anchor="middle" font-size="6" fill="#ccc">Instale 'qrcode'</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(placeholder).toString('base64')}`;
}

// ============================================================
// FORMATADORES
// ============================================================

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatNumber(value: number, decimals: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
