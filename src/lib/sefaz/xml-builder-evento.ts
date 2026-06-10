/**
 * DezLog Fiscal Engine — Event XML Builder
 * 
 * Constrói o XML para eventos de CT-e (v4.00) e MDF-e (v3.00),
 * como Cancelamento (110111), Encerramento (110112 - MDFe) e CC-e (110110).
 */

import { formatDateSefaz } from './utils';

export interface EventoInput {
  tipoDocumento: 'CTE' | 'MDFE';
  ambiente: 'homologacao' | 'producao';
  codigoUf: string;
  cnpj: string;
  chaveAcesso: string;
  tipoEvento: '110111' | '110112' | '110110';
  nSeqEvento: number;
  dataHora?: Date; // Default: now
  
  // Detalhes específicos do evento
  detalhes: {
    protocolo?: string; // Obrigatório para Cancelamento/Encerramento
    justificativa?: string; // Obrigatório para Cancelamento/CC-e (min 15 chars)
    
    // Para Encerramento de MDF-e
    codigoMunicipioEncerramento?: string;
    ufEncerramento?: string;
    
    // Para CC-e (CT-e)
    grupoAlterado?: string;
    campoAlterado?: string;
    valorAlterado?: string;
    numeroItemAlterado?: string;
  };
}

/**
 * Constrói o XML de um evento (não assinado).
 * Retorna o XML em string e a tag ID que deve ser assinada.
 */
export function buildEventoXml(input: EventoInput): { xml: string; signId: string } {
  const {
    tipoDocumento,
    ambiente,
    codigoUf,
    cnpj,
    chaveAcesso,
    tipoEvento,
    nSeqEvento,
    detalhes,
  } = input;
  
  const tpAmb = ambiente === 'producao' ? '1' : '2';
  const dhEvento = formatDateSefaz(input.dataHora || new Date());
  
  // O ID do evento tem o formato: ID + tpEvento + chave + nSeqEvento (2 posições para MDF-e, 3 posições para CT-e)
  const nSeqFormatado = tipoDocumento === 'CTE' 
    ? String(nSeqEvento).padStart(3, '0') 
    : String(nSeqEvento).padStart(2, '0');
  const idEvento = `ID${tipoEvento}${chaveAcesso}${nSeqFormatado}`;
  
  const versao = tipoDocumento === 'CTE' ? '4.00' : '3.00';
  const xmlns = tipoDocumento === 'CTE' 
    ? 'http://www.portalfiscal.inf.br/cte' 
    : 'http://www.portalfiscal.inf.br/mdfe';
    
  const tagRoot = tipoDocumento === 'CTE' ? 'eventoCTe' : 'eventoMDFe';
  const tagChave = tipoDocumento === 'CTE' ? 'chCTe' : 'chMDFe';

  let detEventoXml = '';
  
  if (tipoEvento === '110111') {
    // Cancelamento
    const tagCanc = tipoDocumento === 'CTE' ? 'evCancCTe' : 'evCancMDFe';
    if (!detalhes.protocolo || !detalhes.justificativa) {
      throw new Error('Cancelamento exige protocolo e justificativa (mínimo 15 caracteres).');
    }
    
    detEventoXml = `<detEvento versaoEvento="${versao}"><${tagCanc}><descEvento>Cancelamento</descEvento><nProt>${detalhes.protocolo}</nProt><xJust>${detalhes.justificativa}</xJust></${tagCanc}></detEvento>`;
      
  } else if (tipoEvento === '110112' && tipoDocumento === 'MDFE') {
    // Encerramento de MDF-e
    if (!detalhes.protocolo || !detalhes.codigoMunicipioEncerramento || !detalhes.ufEncerramento) {
      throw new Error('Encerramento de MDF-e exige protocolo, cMun e UF de encerramento.');
    }
    
    // A data de encerramento no formato YYYY-MM-DD
    const dtEnc = (input.dataHora || new Date()).toISOString().split('T')[0];
    
    detEventoXml = `<detEvento versaoEvento="${versao}"><evEncMDFe><descEvento>Encerramento</descEvento><nProt>${detalhes.protocolo}</nProt><dtEnc>${dtEnc}</dtEnc><cUF>${codigoUf}</cUF><cMun>${detalhes.codigoMunicipioEncerramento}</cMun></evEncMDFe></detEvento>`;
      
  } else if (tipoEvento === '110110' && tipoDocumento === 'CTE') {
    // Carta de Correção - CC-e (Apenas CT-e, MDF-e não tem CC-e)
    if (!detalhes.justificativa) {
      throw new Error('CC-e exige a justificativa (condição de alteração/erro).');
    }
    
    // O XML da CC-e para CT-e v4.00 exige grupo e campo
    detEventoXml = `<detEvento versaoEvento="${versao}"><evCCeCTe><descEvento>Carta de Correcao</descEvento><infCorrecao><grupoAlterado>${detalhes.grupoAlterado || 'infCTe'}</grupoAlterado><campoAlterado>${detalhes.campoAlterado || 'xObs'}</campoAlterado><valorAlterado>${detalhes.valorAlterado || detalhes.justificativa}</valorAlterado></infCorrecao><xCondUso>A Carta de Correcao e disciplinada pelo Art. 58-B do CONVENIO/SINIEF 06/89: Fica permitida a utilizacao de carta de correcao, para regularizacao de erro ocorrido na emissao de documentos fiscais relativos a prestacao de servico de transporte, desde que o erro nao esteja relacionado com: I - as variaveis que determinam o valor do imposto tais como: base de calculo, aliquota, diferenca de preco, quantidade, valor da prestacao;II - a correcao de dados cadastrais que implique mudanca do emitente, tomador, remetente ou do destinatario;III - a data de emissao ou de saida.</xCondUso></evCCeCTe></detEvento>`;
  } else {
    throw new Error(`Tipo de evento ${tipoEvento} não suportado para ${tipoDocumento}.`);
  }

  // Montagem final do XML (minificada)
  const xml = `<?xml version="1.0" encoding="UTF-8"?><${tagRoot} xmlns="${xmlns}" versao="${versao}"><infEvento Id="${idEvento}"><cOrgao>${codigoUf}</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${cnpj}</CNPJ><${tagChave}>${chaveAcesso}</${tagChave}><dhEvento>${dhEvento}</dhEvento><tpEvento>${tipoEvento}</tpEvento><nSeqEvento>${nSeqEvento}</nSeqEvento>${detEventoXml}</infEvento></${tagRoot}>`;

  return { xml, signId: 'infEvento' };
}
