/**
 * DezLog Fiscal Engine — SEFAZ Endpoints
 * Mapa de URLs dos Web Services da SEFAZ por UF e ambiente.
 * 
 * A maioria dos estados usa o SVRS (Sefaz Virtual do Rio Grande do Sul).
 * São Paulo usa ambiente próprio (SVSP).
 * 
 * Referência: Portal Nacional do CT-e — https://dfe-portal.svrs.fazenda.rs.gov.br/Cte
 */

export type SefazAmbiente = 'homologacao' | 'producao';

export interface SefazEndpoint {
  /** Emissão síncrona de CT-e */
  CTeRecepcaoSinc: string;
  /** Consulta de CT-e por chave */
  CTeConsulta: string;
  /** Status do serviço */
  CTeStatusServico: string;
  /** Recepção de eventos (cancelamento, CC-e) */
  CTeRecepcaoEvento: string;
  /** Inutilização de numeração */
  CTeInutilizacao: string;
}

/**
 * Endpoints do SVRS (Sefaz Virtual do Rio Grande do Sul) — Usado pela maioria dos estados.
 * Referência: https://dfe-portal.svrs.rs.gov.br/Cte
 */
const SVRS_ENDPOINTS: Record<SefazAmbiente, SefazEndpoint> = {
  homologacao: {
    CTeRecepcaoSinc: 'https://cte-homologacao.svrs.rs.gov.br/ws/CTeRecepcaoSincV4/CTeRecepcaoSincV4.asmx',
    CTeConsulta: 'https://cte-homologacao.svrs.rs.gov.br/ws/CTeConsultaV4/CTeConsultaV4.asmx',
    CTeStatusServico: 'https://cte-homologacao.svrs.rs.gov.br/ws/CTeStatusServicoV4/CTeStatusServicoV4.asmx',
    CTeRecepcaoEvento: 'https://cte-homologacao.svrs.rs.gov.br/ws/CTeRecepcaoEventoV4/CTeRecepcaoEventoV4.asmx',
    CTeInutilizacao: 'https://cte-homologacao.svrs.rs.gov.br/ws/CTeInutilizacaoV4/CTeInutilizacaoV4.asmx',
  },
  producao: {
    CTeRecepcaoSinc: 'https://cte.svrs.rs.gov.br/ws/CTeRecepcaoSincV4/CTeRecepcaoSincV4.asmx',
    CTeConsulta: 'https://cte.svrs.rs.gov.br/ws/CTeConsultaV4/CTeConsultaV4.asmx',
    CTeStatusServico: 'https://cte.svrs.rs.gov.br/ws/CTeStatusServicoV4/CTeStatusServicoV4.asmx',
    CTeRecepcaoEvento: 'https://cte.svrs.rs.gov.br/ws/CTeRecepcaoEventoV4/CTeRecepcaoEventoV4.asmx',
    CTeInutilizacao: 'https://cte.svrs.rs.gov.br/ws/CTeInutilizacaoV4/CTeInutilizacaoV4.asmx',
  },
};

/**
 * Endpoints do SVSP (Sefaz Virtual de São Paulo) — Usado por SP e MS.
 * Referência: https://portal.fazenda.sp.gov.br/servicos/cte/Paginas/Webservices.aspx
 */
const SVSP_ENDPOINTS: Record<SefazAmbiente, SefazEndpoint> = {
  homologacao: {
    CTeRecepcaoSinc: 'https://homologacao.nfe.fazenda.sp.gov.br/CTeWS/WS/CTeRecepcaoSincV4.asmx',
    CTeConsulta: 'https://homologacao.nfe.fazenda.sp.gov.br/CTeWS/WS/CTeConsultaV4.asmx',
    CTeStatusServico: 'https://homologacao.nfe.fazenda.sp.gov.br/CTeWS/WS/CTeStatusServicoV4.asmx',
    CTeRecepcaoEvento: 'https://homologacao.nfe.fazenda.sp.gov.br/CTeWS/WS/CTeRecepcaoEventoV4.asmx',
    CTeInutilizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/CTeWS/WS/CTeInutilizacaoV4.asmx',
  },
  producao: {
    CTeRecepcaoSinc: 'https://nfe.fazenda.sp.gov.br/CTeWS/WS/CTeRecepcaoSincV4.asmx',
    CTeConsulta: 'https://nfe.fazenda.sp.gov.br/CTeWS/WS/CTeConsultaV4.asmx',
    CTeStatusServico: 'https://nfe.fazenda.sp.gov.br/CTeWS/WS/CTeStatusServicoV4.asmx',
    CTeRecepcaoEvento: 'https://nfe.fazenda.sp.gov.br/CTeWS/WS/CTeRecepcaoEventoV4.asmx',
    CTeInutilizacao: 'https://nfe.fazenda.sp.gov.br/CTeWS/WS/CTeInutilizacaoV4.asmx',
  },
};

/**
 * Endpoints do MG (Minas Gerais tem ambiente próprio para CT-e).
 */
const MG_ENDPOINTS: Record<SefazAmbiente, SefazEndpoint> = {
  homologacao: {
    CTeRecepcaoSinc: 'https://hcte.fazenda.mg.gov.br/cte/services/CTeRecepcaoSincV4',
    CTeConsulta: 'https://hcte.fazenda.mg.gov.br/cte/services/CTeConsultaV4',
    CTeStatusServico: 'https://hcte.fazenda.mg.gov.br/cte/services/CTeStatusServicoV4',
    CTeRecepcaoEvento: 'https://hcte.fazenda.mg.gov.br/cte/services/CTeRecepcaoEventoV4',
    CTeInutilizacao: 'https://hcte.fazenda.mg.gov.br/cte/services/CTeInutilizacaoV4',
  },
  producao: {
    CTeRecepcaoSinc: 'https://cte.fazenda.mg.gov.br/cte/services/CTeRecepcaoSincV4',
    CTeConsulta: 'https://cte.fazenda.mg.gov.br/cte/services/CTeConsultaV4',
    CTeStatusServico: 'https://cte.fazenda.mg.gov.br/cte/services/CTeStatusServicoV4',
    CTeRecepcaoEvento: 'https://cte.fazenda.mg.gov.br/cte/services/CTeRecepcaoEventoV4',
    CTeInutilizacao: 'https://cte.fazenda.mg.gov.br/cte/services/CTeInutilizacaoV4',
  },
};

/**
 * Endpoints do MT (Mato Grosso tem ambiente próprio).
 */
const MT_ENDPOINTS: Record<SefazAmbiente, SefazEndpoint> = {
  homologacao: {
    CTeRecepcaoSinc: 'https://homologacao.sefaz.mt.gov.br/ctews2/services/CTeRecepcaoSincV4',
    CTeConsulta: 'https://homologacao.sefaz.mt.gov.br/ctews2/services/CTeConsultaV4',
    CTeStatusServico: 'https://homologacao.sefaz.mt.gov.br/ctews2/services/CTeStatusServicoV4',
    CTeRecepcaoEvento: 'https://homologacao.sefaz.mt.gov.br/ctews2/services/CTeRecepcaoEventoV4',
    CTeInutilizacao: 'https://homologacao.sefaz.mt.gov.br/ctews2/services/CTeInutilizacaoV4',
  },
  producao: {
    CTeRecepcaoSinc: 'https://cte.sefaz.mt.gov.br/ctews2/services/CTeRecepcaoSincV4',
    CTeConsulta: 'https://cte.sefaz.mt.gov.br/ctews2/services/CTeConsultaV4',
    CTeStatusServico: 'https://cte.sefaz.mt.gov.br/ctews2/services/CTeStatusServicoV4',
    CTeRecepcaoEvento: 'https://cte.sefaz.mt.gov.br/ctews2/services/CTeRecepcaoEventoV4',
    CTeInutilizacao: 'https://cte.sefaz.mt.gov.br/ctews2/services/CTeInutilizacaoV4',
  },
};

/**
 * Endpoints do PR (Paraná tem ambiente próprio).
 */
const PR_ENDPOINTS: Record<SefazAmbiente, SefazEndpoint> = {
  homologacao: {
    CTeRecepcaoSinc: 'https://homologacao.cte.fazenda.pr.gov.br/cte4/CTeRecepcaoSincV4',
    CTeConsulta: 'https://homologacao.cte.fazenda.pr.gov.br/cte4/CTeConsultaV4',
    CTeStatusServico: 'https://homologacao.cte.fazenda.pr.gov.br/cte4/CTeStatusServicoV4',
    CTeRecepcaoEvento: 'https://homologacao.cte.fazenda.pr.gov.br/cte4/CTeRecepcaoEventoV4',
    CTeInutilizacao: 'https://homologacao.cte.fazenda.pr.gov.br/cte4/CTeInutilizacaoV4',
  },
  producao: {
    CTeRecepcaoSinc: 'https://cte.fazenda.pr.gov.br/cte4/CTeRecepcaoSincV4',
    CTeConsulta: 'https://cte.fazenda.pr.gov.br/cte4/CTeConsultaV4',
    CTeStatusServico: 'https://cte.fazenda.pr.gov.br/cte4/CTeStatusServicoV4',
    CTeRecepcaoEvento: 'https://cte.fazenda.pr.gov.br/cte4/CTeRecepcaoEventoV4',
    CTeInutilizacao: 'https://cte.fazenda.pr.gov.br/cte4/CTeInutilizacaoV4',
  },
};

/**
 * Mapeamento de UF → autorizador do CT-e.
 * A maioria dos estados usa o SVRS. Exceções: SP, MS (SVSP), MG, MT, PR.
 */
const UF_AUTORIZADOR: Record<string, 'SVRS' | 'SVSP' | 'MG' | 'MT' | 'PR'> = {
  'AC': 'SVRS', 'AL': 'SVRS', 'AM': 'SVRS', 'AP': 'SVRS', 'BA': 'SVRS',
  'CE': 'SVRS', 'DF': 'SVRS', 'ES': 'SVRS', 'GO': 'SVRS', 'MA': 'SVRS',
  'PA': 'SVRS', 'PB': 'SVRS', 'PE': 'SVRS', 'PI': 'SVRS', 'RJ': 'SVRS',
  'RN': 'SVRS', 'RO': 'SVRS', 'RR': 'SVRS', 'RS': 'SVRS', 'SC': 'SVRS',
  'SE': 'SVRS', 'TO': 'SVRS',
  'SP': 'SVSP', 'MS': 'SVSP',
  'MG': 'MG',
  'MT': 'MT',
  'PR': 'PR',
};

/**
 * Retorna os endpoints corretos para uma determinada UF e ambiente.
 */
export function getEndpoints(uf: string, ambiente: SefazAmbiente): SefazEndpoint {
  const autorizador = UF_AUTORIZADOR[uf.toUpperCase()];

  switch (autorizador) {
    case 'SVSP':
      return SVSP_ENDPOINTS[ambiente];
    case 'MG':
      return MG_ENDPOINTS[ambiente];
    case 'MT':
      return MT_ENDPOINTS[ambiente];
    case 'PR':
      return PR_ENDPOINTS[ambiente];
    case 'SVRS':
    default:
      return SVRS_ENDPOINTS[ambiente];
  }
}

export interface NfeEndpoint {
  /** Consulta de NF-e por chave */
  NfeConsulta: string;
  /** Status do serviço NF-e */
  NfeStatusServico: string;
}

/**
 * Endpoints de NF-e do SVRS.
 */
const SVRS_NFE_ENDPOINTS: Record<SefazAmbiente, NfeEndpoint> = {
  homologacao: {
    NfeConsulta: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    NfeStatusServico: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
  },
  producao: {
    NfeConsulta: 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    NfeStatusServico: 'https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
  },
};

/**
 * Endpoints de NF-e de São Paulo.
 */
const SP_NFE_ENDPOINTS: Record<SefazAmbiente, NfeEndpoint> = {
  homologacao: {
    NfeConsulta: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
    NfeStatusServico: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
  },
  producao: {
    NfeConsulta: 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
    NfeStatusServico: 'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
  },
};

/**
 * Retorna os endpoints de NF-e para uma UF.
 */
export function getNfeEndpoints(uf: string, ambiente: SefazAmbiente): NfeEndpoint {
  const autorizador = UF_AUTORIZADOR[uf.toUpperCase()] || 'SVRS';
  if (uf.toUpperCase() === 'SP') return SP_NFE_ENDPOINTS[ambiente];
  return SVRS_NFE_ENDPOINTS[ambiente];
}

/**
 * SOAP Actions para cada serviço do CT-e v4.00.
 */
export const SOAP_ACTIONS = {
  // Confirmado via WSDL: operação chama-se 'cteRecepcao' (não 'cteRecepcaoSinc')
  CTeRecepcaoSinc: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcaoSincV4/cteRecepcao',
  CTeConsulta: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeConsultaV4/cteConsultaCT',
  CTeStatusServico: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeStatusServicoV4/cteStatusServicoCT',
  CTeRecepcaoEvento: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeRecepcaoEventoV4/cteRecepcaoEvento',
  CTeInutilizacao: 'http://www.portalfiscal.inf.br/cte/wsdl/CTeInutilizacaoV4/cteInutilizacaoCT',
} as const;

/**
 * SOAP Actions para NF-e.
 */
export const NFE_SOAP_ACTIONS = {
  NfeConsulta: 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeConsultaProtocolo4/nfeConsultaNF',
  NfeStatusServico: 'http://www.portalfiscal.inf.br/nfe/wsdl/NfeStatusServico4/nfeStatusServicoNF',
} as const;

// ============================================================
// MDF-e ENDPOINTS (todos os estados usam o SVRS para MDF-e)
// ============================================================

export interface MdfeEndpoint {
  MDFeRecepcaoSinc: string;
  MDFeConsultaSit: string;
  MDFeStatusServico: string;
  MDFeRecepcaoEvento: string;
  MDFeConsNaoEnc: string;
}

const MDFE_ENDPOINTS: Record<SefazAmbiente, MdfeEndpoint> = {
  homologacao: {
    MDFeRecepcaoSinc: 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeRecepcaoSinc/MDFeRecepcaoSinc.asmx',
    MDFeConsultaSit: 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeConsulta/MDFeConsulta.asmx',
    MDFeStatusServico: 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeStatusServico/MDFeStatusServico.asmx',
    MDFeRecepcaoEvento: 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeRecepcaoEvento/MDFeRecepcaoEvento.asmx',
    MDFeConsNaoEnc: 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeConsNaoEnc/MDFeConsNaoEnc.asmx',
  },
  producao: {
    MDFeRecepcaoSinc: 'https://mdfe.svrs.rs.gov.br/ws/MDFeRecepcaoSinc/MDFeRecepcaoSinc.asmx',
    MDFeConsultaSit: 'https://mdfe.svrs.rs.gov.br/ws/MDFeConsulta/MDFeConsulta.asmx',
    MDFeStatusServico: 'https://mdfe.svrs.rs.gov.br/ws/MDFeStatusServico/MDFeStatusServico.asmx',
    MDFeRecepcaoEvento: 'https://mdfe.svrs.rs.gov.br/ws/MDFeRecepcaoEvento/MDFeRecepcaoEvento.asmx',
    MDFeConsNaoEnc: 'https://mdfe.svrs.rs.gov.br/ws/MDFeConsNaoEnc/MDFeConsNaoEnc.asmx',
  },
};

/**
 * Retorna os endpoints do MDF-e (todos passam pelo SVRS).
 */
export function getMdfeEndpoints(ambiente: SefazAmbiente): MdfeEndpoint {
  return MDFE_ENDPOINTS[ambiente];
}

/**
 * SOAP Actions para MDF-e.
 */
export const MDFE_SOAP_ACTIONS = {
  MDFeRecepcaoSinc: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoSinc/mdfeRecepcao',
  MDFeConsultaSit: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeConsulta/mdfeConsultaMDF',
  MDFeStatusServico: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeStatusServico/mdfeStatusServicoMDF',
  MDFeRecepcaoEvento: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoEvento/mdfeRecepcaoEvento',
  MDFeConsNaoEnc: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeConsNaoEnc/mdfeConsNaoEnc',
} as const;

/**
 * Namespaces XML usados nos envelopes SOAP do CT-e e MDF-e.
 */
export const XML_NAMESPACES = {
  soap: 'http://www.w3.org/2003/05/soap-envelope',
  cte: 'http://www.portalfiscal.inf.br/cte',
  mdfe: 'http://www.portalfiscal.inf.br/mdfe',
  nfe: 'http://www.portalfiscal.inf.br/nfe',
  ds: 'http://www.w3.org/2000/09/xmldsig#',
  wsdl: 'http://www.portalfiscal.inf.br/cte/wsdl/',
} as const;

