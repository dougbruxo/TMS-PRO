/**
 * DezLog Fiscal Engine — CT-e XML Builder v4.00
 * 
 * Gera o XML completo do CT-e no formato exigido pela SEFAZ,
 * seguindo rigorosamente o schema XSD do CT-e versão 4.00.
 * 
 * A ordem dos elementos é estritamente definida pelo XSD e deve ser respeitada.
 * 
 * Referência: Manual de Orientação do Contribuinte (MOC) CT-e v4.00
 * Portal: https://dfe-portal.svrs.fazenda.rs.gov.br/Cte
 */

import { XMLBuilder } from 'fast-xml-parser';
import {
  UF_CODES,
  gerarChaveAcesso,
  gerarCodigoNumerico,
  formatRNTRC,
  formatIE,
  formatDateSefaz,
  sanitizeSefaz,
} from './utils';

// ============================================================
// TIPOS — Dados de entrada para o gerador
// ============================================================

export interface CteEmitente {
  cnpj: string;
  inscricaoEstadual: string;
  razaoSocial: string;
  nomeFantasia?: string;
  endereco: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade: string;
  estado: string;
  cep: string;
  codigo_ibge: string;
  telefone?: string;
  rntrc?: string;
}

export interface CteParticipante {
  cnpj: string;
  inscricaoEstadual?: string;
  razaoSocial: string;
  endereco: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade: string;
  estado: string;
  cep: string;
  codigo_ibge: string;
  telefone?: string;
  email?: string;
}

export interface CteCondutor {
  nome: string;
  cpf: string;
}

export interface CteVeiculo {
  placa: string;
  estado: string;
  renavam?: string;
  rntrc?: string;
  tpVeic?: string; // Tipo do veículo
}

export interface CteNfeRef {
  chave: string;
}

export interface CteDados {
  // --- Ambiente ---
  tpAmb: 1 | 2; // 1=Produção, 2=Homologação

  // --- Identificação ---
  serie: number;
  numeroCte: number;
  cfop: string;
  naturezaOperacao: string;
  tpCTe?: number;  // 0=Normal, 1=Complementar, 2=Anulação, 3=Substituto
  tpServ?: number; // 0=Normal, 1=Subcontratação, 2=Redespacho, 3=Redespacho Intermediário, 4=Multimodal
  tpEmis?: number; // 1=Normal, 4=EPEC, 5=SVC-RS, 6=SVC-SP, 7=SVC-AN, 8=SVC-DN

  // --- Participantes ---
  emitente: CteEmitente;
  remetente: CteParticipante;
  destinatario: CteParticipante;
  tomador: CteParticipante;
  tomadorTipo: 0 | 1 | 2 | 3 | 4; // 0=Remetente, 1=Expedidor, 2=Recebedor, 3=Destinatário, 4=Outros
  tomadorIE?: string;

  // --- Condutor e Veículo ---
  condutor?: CteCondutor;
  veiculo?: CteVeiculo;

  // --- Valores ---
  valorServico: number;
  valorReceber: number;

  // --- Carga ---
  valorCarga: number;
  produtoPredominante: string;
  especieCarga?: string;
  peso: number;
  quantidadeVolumes: number;

  // --- NF-e vinculada ---
  nfeRefs: CteNfeRef[];

  // --- Impostos ---
  icmsCst?: string;  // CST do ICMS
  icmsBase?: number;
  icmsAliquota?: number;
  icmsValor?: number;

  // --- Municípios (início/fim da prestação) ---
  cMunIni: string;
  xMunIni: string;
  ufIni: string;
  cMunFim: string;
  xMunFim: string;
  ufFim: string;

  // --- Observações ---
  observacoes?: string;
}

// ============================================================
// RESULTADO
// ============================================================

export interface CteXmlResult {
  /** XML completo do CT-e (sem envelope SOAP) */
  xml: string;
  /** Chave de acesso de 44 dígitos */
  chaveAcesso: string;
  /** Dígito verificador */
  cDV: number;
  /** Código numérico (8 dígitos) */
  codigoNumerico: string;
}

// ============================================================
// HELPERS DE FORMATAÇÃO NUMÉRICA
// ============================================================

/**
 * Formata um número com exatamente `decimals` casas decimais como string.
 * SEFAZ exige formatos fixos: TDec_1104 (4 decimais), TDec_1302 (2 decimais), etc.
 * Exemplo: formatDecimal(886.9, 4) → "886.9000"
 */
function formatDecimal(value: number | string, decimals: number): string {
  return Number(value).toFixed(decimals);
}

// ============================================================
// GERADOR PRINCIPAL
// ============================================================

/**
 * Gera o XML completo do CT-e v4.00.
 * 
 * @param dados - Todos os dados necessários para a emissão
 * @returns Objeto contendo o XML, chave de acesso e metadados
 */
export function buildCteXml(dados: CteDados): CteXmlResult {
  const { emitente, remetente, destinatario, tomador } = dados;

  // --- Calcular Chave de Acesso ---
  const cUF = UF_CODES[emitente.estado.substring(0, 2).toUpperCase()] || 35;
  const codigoNumerico = gerarCodigoNumerico();
  const dataEmissao = new Date();

  const { chave44, cDV, cCT } = gerarChaveAcesso({
    cUF,
    dataEmissao,
    cnpj: emitente.cnpj,
    modelo: 57, // CT-e
    serie: dados.serie,
    numero: dados.numeroCte,
    tpEmis: dados.tpEmis || 1,
    codigoNumerico,
  });

  const dhEmi = formatDateSefaz(dataEmissao);

  // --- Determinar indIEToma ---
  const tomadorIEValue = dados.tomadorIE || tomador.inscricaoEstadual;
  const tomadorIEClean = formatIE(tomadorIEValue);
  let indIEToma: number;
  if (tomadorIEClean === 'ISENTO') {
    indIEToma = 2; // Isento
  } else if (tomadorIEClean.length >= 2) {
    indIEToma = 1; // Contribuinte
  } else {
    indIEToma = 9; // Não contribuinte
  }

  // --- Construir o bloco IDE ---
  const ide: Record<string, any> = {
    cUF,
    cCT,
    CFOP: dados.cfop.replace(/\D/g, '').substring(0, 4),
    natOp: sanitizeSefaz(dados.naturezaOperacao, 60),
    mod: 57,
    serie: dados.serie,
    nCT: dados.numeroCte,
    dhEmi,
    tpImp: 1, // DACTE Normal
    tpEmis: dados.tpEmis || 1,
    cDV,
    tpAmb: dados.tpAmb,
    tpCTe: dados.tpCTe ?? 0,
    procEmi: 0, // Emissão por aplicação do contribuinte
    verProc: 'DezLog 1.0',
    cMunEnv: emitente.codigo_ibge,
    xMunEnv: sanitizeSefaz(emitente.cidade, 60),
    UFEnv: emitente.estado.toUpperCase(),
    modal: '01', // Rodoviário
    tpServ: dados.tpServ ?? 0,
    cMunIni: dados.cMunIni,
    xMunIni: sanitizeSefaz(dados.xMunIni, 60),
    UFIni: dados.ufIni.toUpperCase(),
    cMunFim: dados.cMunFim,
    xMunFim: sanitizeSefaz(dados.xMunFim, 60),
    UFFim: dados.ufFim.toUpperCase(),
    retira: 0, // Sem retira (padrão)
    indIEToma,
  };

  // --- Tomador (toma3 ou toma4) ---
  if (dados.tomadorTipo <= 3) {
    // toma3: quando o tomador é remetente(0), expedidor(1), recebedor(2) ou destinatário(3)
    ide.toma3 = { toma: dados.tomadorTipo };
  }
  // toma4 é adicionado fora do ide, como campo direto de infCte

  // --- Construir bloco EMIT ---
  const cnpjEmitClean = emitente.cnpj.replace(/\D/g, '');
  const ieEmit = formatIE(emitente.inscricaoEstadual);

  const emit: Record<string, any> = {
    CNPJ: cnpjEmitClean,
    IE: ieEmit,
    xNome: sanitizeSefaz(emitente.razaoSocial, 60),
    enderEmit: buildEndereco(emitente, 'emit'),
    CRT: emitente.crt || 1, // 1=Simples Nacional, 2=Simples-Excesso, 3=Regime Normal
  };
  if (emitente.nomeFantasia) {
    emit.xFant = sanitizeSefaz(emitente.nomeFantasia, 60);
  }

  // --- Construir bloco REM (Remetente) ---
  const rem = buildParticipante(remetente, 'rem', dados.tomadorTipo === 0 ? dados.tomadorIE : undefined);
  if (dados.tpAmb === 2) {
    rem.xNome = 'CTE EMITIDO EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
  }

  // --- Construir bloco DEST (Destinatário) ---
  const dest = buildParticipante(destinatario, 'dest', dados.tomadorTipo === 3 ? dados.tomadorIE : undefined);
  if (dados.tpAmb === 2) {
    dest.xNome = 'CTE EMITIDO EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
  }

  // --- Construir bloco VPREST (Prestação de Serviço) ---
  const vPrest: Record<string, any> = {
    vTPrest: formatDecimal(dados.valorServico, 2),
    vRec: formatDecimal(dados.valorReceber, 2),
    Comp: [
      {
        xNome: 'FRETE VALOR',
        vComp: formatDecimal(dados.valorReceber, 2),
      }
    ]
  };

  // --- Construir bloco IMP (Impostos) ---
  const imp = buildImpostos(dados);

  // --- Construir bloco infCTeNorm ---
  const infCTeNorm = buildInfCTeNorm(dados, emitente);

  // --- Montar infCte ---
  // IMPORTANTE: Para a assinatura C14N funcionar, os atributos DEVEM estar em ordem alfabética!
  // 'Id' vem antes de 'versao' (I < V)
  const infCte: Record<string, any> = {
    '@_Id': `CTe${chave44}`,
    '@_versao': '4.00',
    ide,
  };

  // toma4 fica fora do ide, é filho direto de infCte
  if (dados.tomadorTipo === 4) {
    infCte.toma4 = buildToma4(tomador, dados.tomadorIE);
    if (dados.tpAmb === 2) {
      infCte.toma4.xNome = 'CTE EMITIDO EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
    }
  }

  // Complemento (observações)
  if (dados.observacoes) {
    infCte.compl = {
      xObs: sanitizeSefaz(dados.observacoes, 2000),
    };
  }

  infCte.emit = emit;
  infCte.rem = rem;
  infCte.dest = dest;
  infCte.vPrest = vPrest;
  infCte.imp = imp;
  infCte.infCTeNorm = infCTeNorm;

  // --- Montar infCTeSupl (QR Code - Obrigatório na v4.00) ---
  // A URL base para SP (pode precisar de uma tabela de URLs no futuro para outros estados)
  const baseUrlQrCode = dados.tpAmb === 1
    ? 'https://nfe.fazenda.sp.gov.br/CTeConsulta/qrCode'
    : 'https://homologacao.nfe.fazenda.sp.gov.br/CTeConsulta/qrCode';

  const qrCodCTe = `${baseUrlQrCode}?chCTe=${chave44}&tpAmb=${dados.tpAmb}`;

  const infCTeSupl = {
    qrCodCTe,
  };

  // --- Montar CTe raiz ---
  const cteObj = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    CTe: {
      '@_xmlns': 'http://www.portalfiscal.inf.br/cte',
      infCte,
      infCTeSupl,
      // O nó <Signature> será adicionado pelo assinador (xml-signer.ts) como o ÚLTIMO nó.
    }
  };

  // --- Gerar XML ---
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: false, // SEFAZ exige XML sem formatação (sem espaços/quebras extras)
    suppressEmptyNode: false, // SEFAZ (C14N) não aceita tags auto-fechadas (<tag/>), exige <tag></tag>
    processEntities: true,
  });

  const xml = builder.build(cteObj);

  return {
    xml,
    chaveAcesso: chave44,
    cDV,
    codigoNumerico: cCT,
  };
}

// ============================================================
// BUILDERS AUXILIARES
// ============================================================

/**
 * Constrói o bloco de endereço no padrão SEFAZ.
 */
function buildEndereco(
  entity: CteEmitente | CteParticipante,
  prefix: 'emit' | 'rem' | 'dest' | 'toma'
): Record<string, any> {
  // Tentar extrair número do endereço (ex: "Rua X, 123 - Bairro")
  const enderParts = (entity.endereco || '').split(',');
  const logradouro = sanitizeSefaz(enderParts[0] || 'Rua', 60);
  const numero = entity.numero || (enderParts[1]?.trim().split(/[\s\-]/)[0]) || 'S/N';
  const bairro = entity.bairro || (enderParts.length > 2 ? enderParts[2]?.trim() : '') || 'Centro';

  const tagName = prefix === 'emit' ? 'enderEmit'
    : prefix === 'rem' ? 'enderReme'
      : prefix === 'dest' ? 'enderDest'
        : 'enderToma';

  // O retorno é o conteúdo, não wrappado com o tagName (feito pelo caller)
  void tagName; // apenas para referência interna

  const ender: Record<string, any> = {
    xLgr: logradouro,
    nro: sanitizeSefaz(numero, 60) || 'S/N',
    xBairro: sanitizeSefaz(bairro, 60),
    cMun: entity.codigo_ibge,
    xMun: sanitizeSefaz(entity.cidade, 60),
    CEP: (entity.cep || '').replace(/\D/g, '').padStart(8, '0'),
    UF: entity.estado.toUpperCase(),
  };

  if (entity.complemento) {
    ender.xCpl = sanitizeSefaz(entity.complemento, 60);
  }

  if (entity.telefone && prefix === 'emit') {
    const fone = entity.telefone.replace(/\D/g, '');
    if (fone.length >= 7) ender.fone = fone;
  }

  return ender;
}

/**
 * Constrói o bloco de um participante (remetente ou destinatário).
 */
function buildParticipante(
  p: CteParticipante,
  tipo: 'rem' | 'dest',
  tomadorIEOverride?: string
): Record<string, any> {
  const cnpjClean = p.cnpj.replace(/\D/g, '');
  const isPJ = cnpjClean.length > 11;

  const ie = tomadorIEOverride ? formatIE(tomadorIEOverride) : formatIE(p.inscricaoEstadual);

  const result: Record<string, any> = {};

  if (isPJ) {
    result.CNPJ = cnpjClean.padStart(14, '0');
  } else {
    result.CPF = cnpjClean.padStart(11, '0');
  }

  result.IE = ie;
  result.xNome = sanitizeSefaz(p.razaoSocial, 60);

  if (p.telefone) {
    const fone = p.telefone.replace(/\D/g, '');
    if (fone.length >= 7) result.fone = fone;
  }

  // Endereço
  const enderTag = tipo === 'rem' ? 'enderReme' : 'enderDest';
  result[enderTag] = buildEndereco(p, tipo);

  if (p.email) {
    result.email = p.email.substring(0, 60);
  }

  return result;
}

/**
 * Constrói o bloco toma4 (tomador que não é rem/dest/exped/receb).
 */
function buildToma4(tomador: CteParticipante, tomadorIE?: string): Record<string, any> {
  const cnpjClean = tomador.cnpj.replace(/\D/g, '');
  const isPJ = cnpjClean.length > 11;
  const ie = tomadorIE ? formatIE(tomadorIE) : formatIE(tomador.inscricaoEstadual);

  const toma4: Record<string, any> = {
    toma: 4,
  };

  if (isPJ) {
    toma4.CNPJ = cnpjClean.padStart(14, '0');
  } else {
    toma4.CPF = cnpjClean.padStart(11, '0');
  }

  toma4.IE = ie;
  toma4.xNome = sanitizeSefaz(tomador.razaoSocial, 60);
  if (tomador.telefone) {
    const fone = tomador.telefone.replace(/\D/g, '');
    if (fone.length >= 7) toma4.fone = fone;
  }

  toma4.enderToma = buildEndereco(tomador, 'toma');

  if (tomador.email) {
    toma4.email = tomador.email.substring(0, 60);
  }

  return toma4;
}

/**
 * Constrói o bloco de impostos (imp).
 * Atualmente suporta ICMS CST 00 (tributação normal) e CST 90 (outros).
 */
function buildImpostos(dados: CteDados): Record<string, any> {
  const cst = dados.icmsCst || '00';
  const vBC = formatDecimal(dados.icmsBase ?? dados.valorReceber, 2);
  const pICMS = formatDecimal(dados.icmsAliquota ?? 0, 2);
  const vICMS = formatDecimal(dados.icmsValor ?? (vBC * pICMS / 100), 2);

  const imp: Record<string, any> = { ICMS: {} };

  switch (cst) {
    case '00': // Tributação normal
      imp.ICMS.ICMS00 = {
        CST: '00',
        vBC,
        pICMS,
        vICMS,
      };
      break;
    case '20': // Redução da base de cálculo
      imp.ICMS.ICMS20 = {
        CST: '20',
        pRedBC: formatDecimal(0, 2), // Percentual de redução - ajustar conforme necessidade
        vBC,
        pICMS,
        vICMS,
      };
      break;
    case '40': // ICMS isento
    case '41': // ICMS não tributado
    case '51': // ICMS diferido
      imp.ICMS.ICMS45 = {
        CST: cst,
      };
      break;
    case '60': // ICMS cobrado por ST
      imp.ICMS.ICMS60 = {
        CST: '60',
        vBCSTRet: formatDecimal(0, 2),
        vICMSSTRet: formatDecimal(0, 2),
        pICMSSTRet: formatDecimal(0, 2),
        vCred: formatDecimal(0, 2),
      };
      break;
    case '90': // Outros
    default:
      imp.ICMS.ICMS90 = {
        CST: '90',
        pRedBC: formatDecimal(0, 2),
        vBC,
        pICMS,
        vICMS,
        vCred: formatDecimal(0, 2),
      };
      break;
  }

  return imp;
}

/**
 * Constrói o bloco infCTeNorm (informações do CT-e normal).
 */
function buildInfCTeNorm(dados: CteDados, emitente: CteEmitente): Record<string, any> {
  // --- infCarga ---
  const infCarga: Record<string, any> = {
    vCarga: formatDecimal(dados.valorCarga, 2),
    proPred: sanitizeSefaz(dados.produtoPredominante || 'DIVERSOS', 60),
  };

  if (dados.especieCarga) {
    infCarga.xOutCat = sanitizeSefaz(dados.especieCarga, 30);
  }

  // Quantidades da carga
  infCarga.infQ = [];

  if (dados.peso > 0) {
    infCarga.infQ.push({
      cUnid: '01', // KG
      tpMed: 'PESO',
      qCarga: formatDecimal(dados.peso, 4),
    });
  }

  if (dados.quantidadeVolumes > 0) {
    infCarga.infQ.push({
      cUnid: '03', // UNIDADE
      tpMed: 'UNIDADE',
      qCarga: formatDecimal(dados.quantidadeVolumes, 4),
    });
  }

  // --- infDoc ---
  const infDoc: Record<string, any> = {};

  if (dados.nfeRefs && dados.nfeRefs.length > 0) {
    const validNfes = dados.nfeRefs.filter(n => n.chave && n.chave.replace(/\D/g, '').length === 44);
    if (validNfes.length > 0) {
      infDoc.infNFe = validNfes.map(n => ({
        chave: n.chave.replace(/\D/g, ''),
      }));
    }
  }

  // --- infModal (Rodoviário) ---
  const rodo: Record<string, any> = {
    RNTRC: formatRNTRC(emitente.rntrc),
  };

  const infModal: Record<string, any> = {
    '@_versaoModal': '4.00',
    rodo,
  };

  return {
    infCarga,
    infDoc,
    infModal,
  };
}

// ============================================================
// HELPERS
// ============================================================

// (Função formatDecimal foi movida para o topo e agora retorna string)
