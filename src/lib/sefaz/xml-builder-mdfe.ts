/**
 * DezLog Fiscal Engine — MDF-e XML Builder v3.00
 * 
 * Gera o XML completo do MDF-e (Manifesto Eletrônico de Documentos Fiscais)
 * no formato exigido pela SEFAZ, seguindo o schema XSD do MDF-e versão 3.00.
 * 
 * Referência: Portal MDFe - https://dfe-portal.svrs.rs.gov.br/Mdfe
 */

import { XMLBuilder } from 'fast-xml-parser';
import {
  UF_CODES,
  gerarCodigoNumerico,
  formatRNTRC,
  formatDateSefaz,
  sanitizeSefaz,
} from './utils';

// ============================================================
// TIPOS
// ============================================================

export interface MdfeEmitente {
  cnpj: string;
  inscricaoEstadual: string;
  razaoSocial: string;
  endereco: string;
  bairro?: string;
  cidade: string;
  estado: string;
  cep: string;
  codigo_ibge: string;
  rntrc?: string;
}

export interface MdfeCondutor {
  nome: string;
  cpf: string;
}

export interface MdfeVeiculo {
  placa: string;
  estado: string;
  renavam?: string;
  tara?: number;
  capKG?: number;
  capM3?: number;
  /** Tipo de Rodado: 01=Truck 02=Toco 03=Cavalo Mecânico 04=VAN 05=Utilitário 06=Outros */
  tpRod?: string;
  /** Tipo de Carroceria: 00=N/A 01=Aberta 02=Fechada/Baú 03=Graneleira 04=Porta Container 05=Sider */
  tpCar?: string;
  /** Dados do Proprietário (Obrigatório se o veículo não for próprio) */
  prop?: {
    cnpj?: string;
    cpf?: string;
    rntrc: string;
    xNome: string;
    ie: string;
    uf: string;
    tpProp: '0' | '1' | '2';
  };
}

export interface MdfeMunDescarga {
  cMunDescarga: string;
  xMunDescarga: string;
  infCTe: { chave: string }[];
  infNFe: { chave: string }[];
}

export interface MdfeDados {
  tpAmb: 1 | 2;
  serie: number;
  nMDF: number;

  emitente: MdfeEmitente;
  condutor: MdfeCondutor;
  veiculo: MdfeVeiculo;
  /** Tipo de Transportador: 1=ETC; 2=TAC; 3=CTC */
  tpTransp?: 1 | 2 | 3;

  ufInicio: string;
  ufFim: string;

  /**
   * UFs de percurso (infPercurso/UFPer).
   * OBRIGATÓRIO em transporte interestadual.
   * Não repetir UFIni e UFFim.
   * Máx: 25 ocorrências.
   */
  ufsPercurso?: string[];

  /** Município(s) de carregamento (origem). Default: município do emitente. */
  munCarrega?: { cMunCarrega: string; xMunCarrega: string }[];

  munDescarga: MdfeMunDescarga[];
  
  /**
   * Informações de carga lotação (infLotacao).
   * Obrigatório se tpEmit=1 (ETC) e houver apenas 1 documento.
   */
  infLotacao?: {
    cepCarrega: string;
    cepDescarrega: string;
  };

  /**
   * Contratante do serviço (infContratante).
   * OBRIGATÓRIO para ETC transportando carga de terceiros.
   */
  contratante?: { cnpj?: string; cpf?: string; xNome?: string };

  vCarga: number;
  qCarga: number;
  /** Unidade de medida: 01=KG 02=TON */
  cUnid?: '01' | '02';
  infCpl?: string;
  seg?: MdfeSeguro[];
}

export interface MdfeSeguro {
  /** Responsável pelo seguro: 1-Emitente; 2-Contratante */
  respSeg: '1' | '2';
  /** Nome da Seguradora */
  xSeg: string;
  /** CNPJ da Seguradora */
  cnpj: string;
  /** Número da Apólice */
  nApol: string;
  /** Números de Averbação */
  nAver: string[];
}

export interface MdfeXmlResult {
  xml: string;
  chaveAcesso: string;
  cDV: number;
  codigoNumerico: string;
}

// ============================================================
// GERADOR PRINCIPAL
// ============================================================

export function buildMdfeXml(dados: MdfeDados): MdfeXmlResult {
  const { emitente } = dados;
  
  // --- Calcular chave de acesso ---
  const cUF = UF_CODES[emitente.estado.substring(0, 2).toUpperCase()] || 35;
  const codigoNumerico = gerarCodigoNumerico();
  const dataEmissao = new Date();
  
  // Chave MDF-e: cUF + AAMM + CNPJ + mod(58) + serie + nMDF + tpEmis + cMDF + cDV
  const cnpjClean = emitente.cnpj.replace(/\D/g, '').padStart(14, '0');
  const aamm = `${String(dataEmissao.getFullYear()).substring(2)}${String(dataEmissao.getMonth() + 1).padStart(2, '0')}`;
  const serieStr = String(dados.serie).padStart(3, '0');
  const nMDFStr = String(dados.nMDF).padStart(9, '0');
  const tpEmis = '1';
  
  const chave43 = `${cUF}${aamm}${cnpjClean}58${serieStr}${nMDFStr}${tpEmis}${codigoNumerico}`;
  
  // Calcular DV (mod 11)
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  for (let i = chave43.length - 1, p = 0; i >= 0; i--, p++) {
    soma += parseInt(chave43[i], 10) * pesos[p % 8];
  }
  const resto = soma % 11;
  const cDV = resto < 2 ? 0 : 11 - resto;
  const chave44 = `${chave43}${cDV}`;
  
  const dhEmi = formatDateSefaz(dataEmissao);
  
  // --- Blocos do XML ---
  const ide: Record<string, any> = {
    cUF,
    tpAmb: dados.tpAmb,
    tpEmit: 1, // 1=Prestador de Serviço de Transporte (ETC); 2=Transportador de Carga Própria
    tpTransp: dados.tpTransp || 1, // 1=ETC; 2=TAC; 3=CTC
    mod: 58,
    serie: dados.serie,
    nMDF: dados.nMDF,
    cMDF: codigoNumerico,
    cDV,
    modal: 1, // Rodoviário
    dhEmi,
    tpEmis: 1,
    procEmi: '0',
    verProc: 'DezLog 1.0',
    UFIni: dados.ufInicio?.toUpperCase() || '',
    UFFim: dados.ufFim?.toUpperCase() || '',
    infMunCarrega: (dados.munCarrega && dados.munCarrega.length > 0)
      ? dados.munCarrega
      : [{ cMunCarrega: emitente.codigo_ibge, xMunCarrega: sanitizeSefaz(emitente.cidade, 60) }],
    ...(dados.ufsPercurso && dados.ufsPercurso.length > 0
      ? { infPercurso: dados.ufsPercurso.map(uf => ({ UFPer: uf?.toUpperCase() || '' })) }
      : {}),
  };
  
  const contratanteDoc = (dados.contratante?.cnpj || dados.contratante?.cpf || '').replace(/\D/g, '');
  const infContratante = (dados.contratante && contratanteDoc)
    ? {
        ...(dados.contratante.xNome ? { xNome: sanitizeSefaz(dados.contratante.xNome, 60) } : {}),
        ...(dados.contratante.cnpj ? { CNPJ: dados.contratante.cnpj.replace(/\D/g, '') } : {}),
        ...(dados.contratante.cpf && !dados.contratante.cnpj ? { CPF: dados.contratante.cpf.replace(/\D/g, '') } : {}),
      }
    : undefined;
  
  // No fields to delete now as tpTransp is set
  
  const emit: Record<string, any> = {
    CNPJ: cnpjClean,
    IE: emitente.inscricaoEstadual.replace(/\D/g, '') || 'ISENTO',
    xNome: sanitizeSefaz(emitente.razaoSocial, 60),
    xFant: sanitizeSefaz(emitente.razaoSocial, 60),
    enderEmit: {
      xLgr: sanitizeSefaz(emitente.endereco.split(',')[0] || emitente.endereco, 60),
      nro: 'S/N',
      xBairro: sanitizeSefaz(emitente.bairro || emitente.endereco.split(',')[1]?.trim() || 'Centro', 60),
      cMun: emitente.codigo_ibge,
      xMun: sanitizeSefaz(emitente.cidade, 60),
      CEP: emitente.cep?.replace(/\D/g, '').padStart(8, '0') || '',
      UF: emitente.estado?.toUpperCase() || '',
    },
  };
  
  // --- infModal (Rodoviário) ---
  const infModal: Record<string, any> = {
    '@_versaoModal': '3.00',
    rodo: {
      infANTT: { 
        RNTRC: formatRNTRC(emitente.rntrc),
        ...(infContratante ? { infContratante: [infContratante] } : {})
      },
      veicTracao: {
        placa: dados.veiculo.placa?.replace('-', '').toUpperCase() || '',
        ...(dados.veiculo.renavam ? { RENAVAM: dados.veiculo.renavam } : {}),
        tara: dados.veiculo.tara || 15000,
        ...(dados.veiculo.capKG ? { capKG: dados.veiculo.capKG } : {}),
        ...(dados.veiculo.capM3 ? { capM3: dados.veiculo.capM3 } : {}),
        ...(dados.veiculo.prop ? {
          prop: {
            ...(dados.veiculo.prop.cnpj ? { CNPJ: dados.veiculo.prop.cnpj.replace(/\D/g, '') } : {}),
            ...(dados.veiculo.prop.cpf ? { CPF: dados.veiculo.prop.cpf.replace(/\D/g, '') } : {}),
            RNTRC: formatRNTRC(dados.veiculo.prop.rntrc),
            xNome: sanitizeSefaz(dados.veiculo.prop.xNome, 60),
            IE: dados.veiculo.prop.ie?.replace(/\D/g, '') || 'ISENTO',
            UF: dados.veiculo.prop.uf?.toUpperCase() || dados.veiculo.estado?.toUpperCase(),
            tpProp: dados.veiculo.prop.tpProp,
          }
        } : {}),
        condutor: [{
          xNome: sanitizeSefaz(dados.condutor.nome, 60),
          CPF: dados.condutor.cpf?.replace(/\D/g, '').padStart(11, '0') || '',
        }],
        tpRod: dados.veiculo.tpRod || '03', // 03=Cavalo Mecânico (padrão para cargas)
        tpCar: dados.veiculo.tpCar || '02', // 02=Fechada/Baú
        UF: dados.veiculo.estado?.toUpperCase() || '',
      },
      ...(dados.infLotacao ? {
        infLotacao: {
          infLocalCarrega: {
            CEP: dados.infLotacao.cepCarrega.replace(/\D/g, '')
          },
          infLocalDescarrega: {
            CEP: dados.infLotacao.cepDescarrega.replace(/\D/g, '')
          }
        }
      } : {})
    },
  };
  
  // --- infDoc (documentos vinculados) ---
  const munDescarga = dados.munDescarga.map(mun => {
    const result: Record<string, any> = {
      cMunDescarga: mun.cMunDescarga,
      xMunDescarga: sanitizeSefaz(mun.xMunDescarga, 60),
    };
    
    if (mun.infCTe && mun.infCTe.length > 0) {
      result.infCTe = mun.infCTe.map(c => ({ chCTe: c.chave.replace(/\D/g, '') }));
    }
    if (mun.infNFe && mun.infNFe.length > 0) {
      result.infNFe = mun.infNFe.map(n => ({ chNFe: n.chave.replace(/\D/g, '') }));
    }
    
    return result;
  });
  
  // --- tot (totais) ---
  const qCTe = dados.munDescarga.reduce((sum, m) => sum + (m.infCTe?.length || 0), 0);
  const qNFe = dados.munDescarga.reduce((sum, m) => sum + (m.infNFe?.length || 0), 0);
  
  const tot: Record<string, any> = {
    qCTe: qCTe > 0 ? qCTe : undefined,
    qNFe: qNFe > 0 ? qNFe : undefined,
    vCarga: Number(Number(dados.vCarga).toFixed(2)),
    cUnid: dados.cUnid || '01', // 01=KG (obrigatório)
    qCarga: Number(Number(dados.qCarga).toFixed(4)),
  };

  // Remover campos undefined
  if (!tot.qCTe) delete tot.qCTe;
  if (!tot.qNFe) delete tot.qNFe;

  // infAdic (informações adicionais - opcional)
  const infAdic = dados.infCpl ? { infCpl: sanitizeSefaz(dados.infCpl, 2000) } : undefined;
  
  // --- Montar infMDFe ---
  const infMDFe: Record<string, any> = {
    '@_versao': '3.00',
    '@_Id': `MDFe${chave44}`,
    ide,
    emit,
    infModal,
    infDoc: {
      infMunDescarga: munDescarga,
    },
    ...(dados.seg && dados.seg.length > 0 ? {
      seg: dados.seg.map(s => {
        const respCnpj = s.respSeg === '2' ? (s.cnpj || '').replace(/\D/g, '') : '';
        return {
          infResp: {
            respSeg: s.respSeg,
            ...(respCnpj ? (respCnpj.length === 11 ? { CPF: respCnpj } : { CNPJ: respCnpj }) : {})
          },
          ...(s.xSeg && s.cnpj ? {
            infSeg: {
              xSeg: sanitizeSefaz(s.xSeg, 30),
              CNPJ: (s.cnpj || '').replace(/\D/g, ''),
            }
          } : {}),
          nApol: s.nApol || '0',
          nAver: (s.nAver || []).map(a => a.trim()).filter(Boolean),
        };
      })
    } : {}),
    prodPred: {
      tpCarga: '05', // Carga Geral
      xProd: 'CARGA GERAL',
    },
    tot,
    ...(infAdic ? { infAdic } : {}),
  };

  
  const mdfeObj = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    MDFe: {
      '@_xmlns': 'http://www.portalfiscal.inf.br/mdfe',
      infMDFe,
    },
  };
  
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: false,
    suppressEmptyNode: true,
    processEntities: true,
  });
  
  return {
    xml: builder.build(mdfeObj),
    chaveAcesso: chave44,
    cDV,
    codigoNumerico,
  };
}
