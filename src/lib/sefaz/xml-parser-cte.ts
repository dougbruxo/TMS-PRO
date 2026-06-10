/**
 * DezLog Fiscal Engine — CT-e XML Parser
 *
 * Converte o XML original autorizado pela SEFAZ (CTe + procCTe) em um objeto
 * `CteDocumentoCompleto` pronto para o gerador do DACTE.
 *
 * Ao usar o XML como fonte primária, garantimos que o DACTE seja um espelho
 * exato dos dados aprovados pela SEFAZ, eliminando divergências com o banco.
 */

import { XMLParser } from 'fast-xml-parser';
import type { CteDocumentoCompleto } from './dacte-generator';

// ============================================================
// HELPERS
// ============================================================

/** Remove formatação (pontos, traços, barras) de documentos */
const clean = (s: any): string => String(s ?? '').replace(/\D/g, '');

/** Converte valor SEFAZ (string com ponto) para number */
const toNum = (v: any): number => {
  if (v === undefined || v === null || v === '') return 0;
  return Number(String(v).replace(',', '.')) || 0;
};

/** Garante string, retornando '' para null/undefined */
const str = (v: any): string => (v === undefined || v === null ? '' : String(v));

/** Tabela UF code → sigla */
const UF_SIGLAS: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
  '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

/** Mapas de tipo */
const TIPOS_CTE: Record<number, string> = {
  0: 'NORMAL', 1: 'COMPLEMENTAR', 2: 'ANULAÇÃO', 3: 'SUBSTITUTO',
};
const TIPOS_SERVICO: Record<number, string> = {
  0: 'NORMAL', 1: 'SUBCONTRATAÇÃO', 2: 'REDESPACHO', 3: 'REDESP. INTERMEDIÁRIO', 4: 'MULTIMODAL',
};
const TIPOS_TOMADOR: Record<number, string> = {
  0: 'REMETENTE', 1: 'EXPEDIDOR', 2: 'RECEBEDOR', 3: 'DESTINATÁRIO', 4: 'OUTROS',
};

/** Formata data ISO SEFAZ (2026-06-06T18:14:33-03:00) para exibição */
function formatDataSefaz(dhEmi: string): string {
  if (!dhEmi) return '';
  try {
    return new Date(dhEmi).toLocaleDateString('pt-BR');
  } catch {
    return dhEmi;
  }
}

/** Extrai endereço completo de um bloco de endereço do XML */
function extractEndereco(ender: any): string {
  if (!ender) return '';
  const logr = str(ender.xLgr);
  const nro = str(ender.nro);
  const bairro = str(ender.xBairro);
  const parts = [logr, nro !== 'S/N' ? nro : ''].filter(Boolean).join(', ');
  return bairro ? `${parts} - ${bairro}` : parts;
}

/** Extrai participante (remetente, destinatário, tomador) do XML */
function extractParticipante(bloco: any, tipo: string): {
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual?: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  telefone?: string;
  pais?: string;
} {
  if (!bloco) {
    return {
      razaoSocial: '', cnpj: '', endereco: '', cidade: '', estado: '', cep: '',
    };
  }

  // Pegar o bloco de endereço — pode ser enderReme, enderDest, enderToma, etc.
  const ender = bloco.enderReme || bloco.enderDest || bloco.enderToma || bloco.enderExped || bloco.enderReceb || bloco.enderEmit || {};

  return {
    razaoSocial: str(bloco.xNome),
    cnpj: clean(bloco.CNPJ) || clean(bloco.CPF),
    inscricaoEstadual: str(bloco.IE) || undefined,
    endereco: extractEndereco(ender),
    cidade: str(ender.xMun),
    estado: str(ender.UF),
    cep: clean(ender.CEP),
    telefone: clean(bloco.fone) || undefined,
    pais: 'BRASIL',
  };
}

// ============================================================
// PARSER PRINCIPAL
// ============================================================

export interface CteParseResult {
  cteData: CteDocumentoCompleto;
  protocolo?: string;
  dataAutorizacao?: string;
  ambiente: 'homologacao' | 'producao';
  chaveAcesso: string;
}

/**
 * Parseia o XML autorizado da SEFAZ e retorna um `CteDocumentoCompleto`
 * pronto para o gerador do DACTE.
 *
 * Aceita tanto o XML bruto do CT-e (`<CTe>`) quanto o XML de protocolo
 * (`<nfeProcCTe>` ou `<cteProc>`).
 */
export function parseCteXml(xmlString: string): CteParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: true,
    parseAttributeValue: false,
  });

  const doc = parser.parse(xmlString);

  // Suporte a diferentes wrappers:
  // <cteProc>, <CTe>, <nfeProcCTe>
  const root = doc.cteProc || doc.nfeProcCTe || doc;
  const cteRoot = root.CTe || root.cte || doc.CTe;
  const infCte = cteRoot?.infCte;
  const procCTe = root.protCTe;

  if (!infCte) {
    throw new Error('XML inválido: não encontrou <infCte> no documento CT-e');
  }

  // --- IDE ---
  const ide = infCte.ide || {};
  const tpAmb = Number(ide.tpAmb) || 2;
  const ambiente: 'homologacao' | 'producao' = tpAmb === 1 ? 'producao' : 'homologacao';

  // Chave de acesso: extraída do atributo Id (ex: "CTe3526...")
  const idAttr = str(infCte['@_Id'] || '');
  const chaveAcesso = idAttr.replace(/^CTe/, '').replace(/\D/g, '') || '';

  // --- PROTOCOLO ---
  const infProt = procCTe?.infProt || {};
  const protocolo = str(infProt.nProt) || undefined;
  const dataAutorizacao = infProt.dhRecbto ? formatDataSefaz(str(infProt.dhRecbto)) : undefined;

  // --- EMIT ---
  const emitBloco = infCte.emit || {};
  const enderEmit = emitBloco.enderEmit || {};
  const emitente = {
    razaoSocial: str(emitBloco.xNome),
    nomeFantasia: str(emitBloco.xFant) || undefined,
    cnpj: clean(emitBloco.CNPJ),
    inscricaoEstadual: str(emitBloco.IE),
    endereco: extractEndereco(enderEmit),
    cidade: str(enderEmit.xMun),
    estado: str(enderEmit.UF),
    cep: clean(enderEmit.CEP),
    telefone: clean(enderEmit.fone) || undefined,
    // logoUrl e rntrc: não estão no XML — serão adicionados pela rota do DACTE
    logoUrl: undefined as string | undefined,
    rntrc: undefined as string | undefined,
  };

  // --- REM / DEST / TOMA ---
  const remetente = extractParticipante(infCte.rem, 'rem');
  const destinatario = extractParticipante(infCte.dest, 'dest');

  // Expedidor e Recebedor (opcionais)
  const expedidor = infCte.exped ? extractParticipante(infCte.exped, 'exped') : undefined;
  const recebedor = infCte.receb ? extractParticipante(infCte.receb, 'receb') : undefined;

  // Tomador: pode ser toma3 (dentro de ide) ou toma4 (filho direto de infCte)
  const toma3 = ide.toma3;
  const toma4 = infCte.toma4;
  let tomadorTipoNum = 0;
  let tomadorObj: ReturnType<typeof extractParticipante>;

  if (toma4) {
    tomadorTipoNum = 4;
    tomadorObj = extractParticipante(toma4, 'toma');
  } else if (toma3) {
    tomadorTipoNum = Number(toma3.toma) || 0;
    // Para toma3, os dados estão no participante correspondente
    if (tomadorTipoNum === 0) tomadorObj = { ...remetente };
    else if (tomadorTipoNum === 1) tomadorObj = expedidor ? { ...expedidor } : { ...remetente };
    else if (tomadorTipoNum === 2) tomadorObj = recebedor ? { ...recebedor } : { ...destinatario };
    else tomadorObj = { ...destinatario };
  } else {
    tomadorObj = { ...remetente };
  }

  const tomador = {
    tipo: TIPOS_TOMADOR[tomadorTipoNum] || 'REMETENTE',
    ...tomadorObj,
  };

  // --- VPREST ---
  const vPrest = infCte.vPrest || {};
  const valorServico = toNum(vPrest.vTPrest);
  const valorReceber = toNum(vPrest.vRec);

  // Componentes de valor (Comp[])
  let componentesValor: Array<{ nome: string; valor: string }> | undefined;
  if (vPrest.Comp) {
    const comps = Array.isArray(vPrest.Comp) ? vPrest.Comp : [vPrest.Comp];
    componentesValor = comps.map((c: any) => ({
      nome: str(c.xNome),
      valor: String(toNum(c.vComp).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
    }));
  }

  // --- IMP ---
  const imp = infCte.imp || {};
  const icms = imp.ICMS || {};
  const icmsBloco = icms.ICMS00 || icms.ICMS20 || icms.ICMS45 || icms.ICMS60 || icms.ICMS90 || {};
  const icmsCst = str(icmsBloco.CST) || '00';
  const icmsBase = toNum(icmsBloco.vBC);
  const icmsAliquota = toNum(icmsBloco.pICMS);
  const icmsValor = toNum(icmsBloco.vICMS);

  // Situação tributária: combina CST com descrição
  const ST_DESCRICOES: Record<string, string> = {
    '00': '00 - Tributação Normal ICMS',
    '20': '20 - Tributação com BC Reduzida',
    '40': '40 - ICMS Isento',
    '41': '41 - Não Tributado',
    '51': '51 - Diferimento',
    '60': '60 - ICMS Cobrado por ST',
    '90': '90 - Outros',
  };
  const situacaoTributaria = ST_DESCRICOES[icmsCst] || icmsCst;

  // --- infCTeNorm ---
  const infCTeNorm = infCte.infCTeNorm || {};
  const infCarga = infCTeNorm.infCarga || {};
  const valorCarga = toNum(infCarga.vCarga);
  const produtoPredominante = str(infCarga.proPred) || 'DIVERSOS';
  const outrasCaracteristicas = str(infCarga.xOutCat) || undefined;

  // Quantidades (infQ[])
  let peso = 0;
  let quantidadeVolumes = 0;
  let especieCarga: string | undefined;

  const infQList = infCarga.infQ
    ? (Array.isArray(infCarga.infQ) ? infCarga.infQ : [infCarga.infQ])
    : [];

  for (const q of infQList) {
    const cUnid = str(q.cUnid);
    if (cUnid === '01') {
      // KG
      peso = toNum(q.qCarga);
      especieCarga = '01-KG';
    } else if (cUnid === '03') {
      // UNIDADE
      quantidadeVolumes = toNum(q.qCarga);
    }
  }

  // NF-e vinculadas
  const infDoc = infCTeNorm.infDoc || {};
  const infNFeList = infDoc.infNFe
    ? (Array.isArray(infDoc.infNFe) ? infDoc.infNFe : [infDoc.infNFe])
    : [];
  const nfeChaves: string[] = infNFeList.map((n: any) => str(n.chave)).filter(Boolean);

  // --- IDE — campos de prestação ---
  const cfop = str(ide.CFOP);
  const naturezaOperacao = str(ide.natOp);
  const tipoCteNum = Number(ide.tpCTe) || 0;
  const tipoServicoNum = Number(ide.tpServ) || 0;
  const serie = Number(ide.serie) || 1;
  const numeroCte = Number(ide.nCT) || 0;
  const dataEmissao = formatDataSefaz(str(ide.dhEmi));
  const globalizado = false; // CT-e normal não tem flag de globalizado no XML v4

  // Município início/fim
  const xMunIni = str(ide.xMunIni);
  const ufIni = str(ide.UFIni);
  const xMunFim = str(ide.xMunFim);
  const ufFim = str(ide.UFFim);

  // Modal rodoviário — RNTRC
  const infModal = infCTeNorm.infModal || {};
  const rodo = infModal.rodo || {};
  emitente.rntrc = str(rodo.RNTRC) || undefined;

  // Observações (compl.xObs)
  const compl = infCte.compl || {};
  const observacoes = str(compl.xObs) || undefined;

  // --- Montar resultado final ---
  const cteData: CteDocumentoCompleto = {
    chaveAcesso,
    protocolo,
    dataAutorizacao,
    ambiente,

    serie,
    numeroCte,
    dataEmissao,
    cfop,
    naturezaOperacao,
    tipoCte: tipoCteNum,
    tipoServico: tipoServicoNum,

    emitente,
    remetente,
    destinatario,
    expedidor,
    recebedor,
    tomador: {
      tipo: tomadorTipoNum,
      ...tomadorObj,
    },

    globalizado,
    valorServico,
    valorReceber,
    componentesValor: componentesValor?.map(c => ({ nome: c.nome, valor: parseFloat(c.valor.replace(/\./g, '').replace(',', '.')) || 0 })),

    produtoPredominante,
    valorCarga,
    peso,
    quantidadeVolumes,
    especieCarga,
    outrasCaracteristicas,

    icmsCst,
    icmsBase,
    icmsAliquota,
    icmsValor,
    situacaoTributaria,

    cidadeOrigem: xMunIni,
    ufOrigem: ufIni,
    cidadeDestino: xMunFim,
    ufDestino: ufFim,

    nfeChaves,
    observacoes,
  };

  return { cteData, protocolo, dataAutorizacao, ambiente, chaveAcesso };
}
