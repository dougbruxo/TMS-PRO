/**
 * DezLog Fiscal Engine — MDF-e XML Parser
 *
 * Converte o XML original autorizado pela SEFAZ (MDFe + procMDFe) em um objeto
 * `MdfeDocumentoCompleto` pronto para o gerador do DAMDFE.
 *
 * Garante que o DAMDFE seja um espelho exato do XML da SEFAZ.
 */

import { XMLParser } from 'fast-xml-parser';
import type { MdfeDocumentoCompleto } from './damdfe-generator';

const clean = (s: any): string => String(s ?? '').replace(/\D/g, '');

const toNum = (v: any): number => {
  if (v === undefined || v === null || v === '') return 0;
  return Number(String(v).replace(',', '.')) || 0;
};

const str = (v: any): string => (v === undefined || v === null ? '' : String(v));

function formatDataSefaz(dhEmi: string): string {
  if (!dhEmi) return '';
  try {
    return new Date(dhEmi).toLocaleDateString('pt-BR');
  } catch {
    return dhEmi;
  }
}

function extractEndereco(ender: any): string {
  if (!ender) return '';
  const logr = str(ender.xLgr);
  const nro = str(ender.nro);
  const bairro = str(ender.xBairro);
  const parts = [logr, nro !== 'S/N' ? nro : ''].filter(Boolean).join(', ');
  return bairro ? `${parts} - ${bairro}` : parts;
}

export interface MdfeParseResult {
  mdfeData: MdfeDocumentoCompleto;
  protocolo?: string;
  dataAutorizacao?: string;
  ambiente: 'homologacao' | 'producao';
  chaveAcesso: string;
}

export function parseMdfeXml(xmlString: string): MdfeParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: true,
    parseAttributeValue: false,
  });

  const doc = parser.parse(xmlString);

  // Suporte a wrappers: <mdfeProc>, <MDFe>, etc.
  const root = doc.mdfeProc || doc;
  const mdfeRoot = root.MDFe || root.mdfe || doc.MDFe;
  const infMDFe = mdfeRoot?.infMDFe;
  const procMDFe = root.protMDFe;

  if (!infMDFe) {
    throw new Error('XML inválido: não encontrou <infMDFe> no documento MDF-e');
  }

  // --- IDE ---
  const ide = infMDFe.ide || {};
  const tpAmb = Number(ide.tpAmb) || 2;
  const ambiente: 'homologacao' | 'producao' = tpAmb === 1 ? 'producao' : 'homologacao';

  // Chave de acesso: extraída de Id (ex: "MDFe3526...")
  const idAttr = str(infMDFe['@_Id'] || '');
  const chaveAcesso = idAttr.replace(/^MDFe/, '').replace(/\D/g, '') || '';

  // --- PROTOCOLO ---
  const infProt = procMDFe?.infProt || {};
  const protocolo = str(infProt.nProt) || undefined;
  const dataAutorizacao = infProt.dhRecbto ? formatDataSefaz(str(infProt.dhRecbto)) : undefined;

  // --- EMIT ---
  const emitBloco = infMDFe.emit || {};
  const enderEmit = emitBloco.enderEmit || {};
  const emitente = {
    razaoSocial: str(emitBloco.xNome),
    cnpj: clean(emitBloco.CNPJ),
    inscricaoEstadual: str(emitBloco.IE),
    endereco: extractEndereco(enderEmit),
    cidade: str(enderEmit.xMun),
    estado: str(enderEmit.UF),
    cep: clean(enderEmit.CEP),
    telefone: clean(enderEmit.fone) || undefined,
    rntrc: undefined as string | undefined,
    logoUrl: undefined as string | undefined,
  };

  // --- MODAL (RODOVIÁRIO) ---
  const infModal = infMDFe.infModal || {};
  const rodo = infModal.rodo || {};
  
  // RNTRC
  if (rodo.infANTT?.RNTRC) {
    emitente.rntrc = str(rodo.infANTT.RNTRC);
  }

  // Veículo Tração e Condutor
  const veicTracao = rodo.veicTracao || {};
  const condutorList = veicTracao.condutor
    ? (Array.isArray(veicTracao.condutor) ? veicTracao.condutor : [veicTracao.condutor])
    : [];
  
  const motoristaNome = condutorList.map((c: any) => str(c.xNome)).join(', ') || 'N/A';
  const motoristaCpf = condutorList.map((c: any) => clean(c.CPF)).join(', ') || 'N/A';

  const veiculoPlaca = str(veicTracao.placa);
  const veiculoEstado = str(veicTracao.UF);
  const veiculoRntrc = veicTracao.prop?.RNTRC ? str(veicTracao.prop.RNTRC) : emitente.rntrc;

  // --- DOCUMENTOS E MUNICIPIOS DE DESCARGA ---
  const infDoc = infMDFe.infDoc || {};
  const infMunDescargaList = infDoc.infMunDescarga
    ? (Array.isArray(infDoc.infMunDescarga) ? infDoc.infMunDescarga : [infDoc.infMunDescarga])
    : [];

  let qtdCte = 0;
  let qtdNfe = 0;
  const chavesDocumentos: string[] = [];

  for (const mun of infMunDescargaList) {
    if (mun.infCTe) {
      const ctes = Array.isArray(mun.infCTe) ? mun.infCTe : [mun.infCTe];
      ctes.forEach((c: any) => {
        if (c.chCTe) {
          chavesDocumentos.push(str(c.chCTe));
          qtdCte++;
        }
      });
    }
    if (mun.infNFe) {
      const nfes = Array.isArray(mun.infNFe) ? mun.infNFe : [mun.infNFe];
      nfes.forEach((n: any) => {
        if (n.chNFe) {
          chavesDocumentos.push(str(n.chNFe));
          qtdNfe++;
        }
      });
    }
  }

  // --- TOTAIS ---
  const tot = infMDFe.tot || {};
  const vCarga = toNum(tot.vCarga);
  const qCarga = toNum(tot.qCarga);

  // --- SEGUROS ---
  const segList = infMDFe.seg
    ? (Array.isArray(infMDFe.seg) ? infMDFe.seg : [infMDFe.seg])
    : [];
  let seguradora: string | undefined;
  let apolice: string | undefined;
  let averbacao: string | undefined;

  if (segList.length > 0) {
    const mainSeg = segList[0];
    seguradora = mainSeg.infSeg?.xSeg ? str(mainSeg.infSeg.xSeg) : undefined;
    apolice = mainSeg.nApol ? str(mainSeg.nApol) : undefined;
    if (mainSeg.nAver) {
      const avers = Array.isArray(mainSeg.nAver) ? mainSeg.nAver : [mainSeg.nAver];
      averbacao = avers.map((a: any) => str(a)).join(', ');
    }
  }

  // --- OUTROS ---
  const ufInicio = str(ide.UFIni);
  const ufFim = str(ide.UFFim);
  const serie = Number(ide.serie) || 1;
  const numeroMdfe = Number(ide.nMDF) || 0;
  const dataEmissao = formatDataSefaz(str(ide.dhEmi));

  const ufsPercursoList = ide.infPercurso
    ? (Array.isArray(ide.infPercurso) ? ide.infPercurso : [ide.infPercurso])
    : [];
  const ufPercurso = ufsPercursoList.map((p: any) => str(p.UFPer)).join(', ') || undefined;

  const observacoes = infMDFe.infAdic?.infCpl ? str(infMDFe.infAdic.infCpl) : undefined;

  const mdfeData: MdfeDocumentoCompleto = {
    chaveAcesso,
    protocolo,
    dataAutorizacao,
    ambiente,
    serie,
    numeroMdfe,
    dataEmissao,
    emitente,
    motoristaNome,
    motoristaCpf,
    veiculoPlaca,
    veiculoRntrc,
    veiculoEstado,
    ufInicio,
    ufFim,
    ufPercurso,
    qtdCte,
    qtdNfe,
    chavesDocumentos,
    vCarga,
    qCarga,
    seguradora,
    apolice,
    averbacao,
    observacoes,
  };

  return { mdfeData, protocolo, dataAutorizacao, ambiente, chaveAcesso };
}
