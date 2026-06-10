/** @jsxImportSource react */
/**
 * DezLog Fiscal Engine — DACTE Template (React-PDF)
 * 
 * Template do Documento Auxiliar do Conhecimento de Transporte Eletrônico (DACTE)
 * seguindo o layout regulamentado pela SEFAZ (Ato COTEPE).
 * 
 * Formato: A4 (210 x 297 mm)
 * Usa @react-pdf/renderer para gerar o PDF no servidor.
 */

import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

// Desativa hifenização / quebra automática de palavras
Font.registerHyphenationCallback((word) => [word]);

// ============================================================
// TIPOS
// ============================================================

export interface DacteData {
  // --- Chave e Protocolo ---
  chaveAcesso: string;
  protocolo?: string;
  dataAutorizacao?: string;
  ambiente: 'homologacao' | 'producao';
  
  // --- Identificação do CT-e ---
  modelo: string;
  serie: string;
  numeroCte: string;
  dataEmissao: string;
  cfop: string;
  naturezaOperacao: string;
  tipoCte: string;
  tipoServico: string;
  modal: string;
  globalizado?: boolean;
  
  // --- Emitente ---
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
  
  // --- Remetente ---
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
  
  // --- Destinatário ---
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

  // --- Expedidor (opcional) ---
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

  // --- Recebedor (opcional) ---
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
  
  // --- Tomador ---
  tomador: {
    tipo: string; // Remetente, Destinatário, Outros
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
  
  // --- Valores ---
  valorServico: string;
  valorReceber: string;
  componentesValor?: Array<{ nome: string; valor: string }>;
  
  // --- Carga ---
  produtoPredominante: string;
  valorCarga: string;
  peso: string;
  quantidadeVolumes: string;
  especieCarga?: string;
  outrasCaracteristicas?: string;
  
  // --- Impostos ---
  icmsCst: string;
  icmsBase: string;
  icmsAliquota: string;
  icmsValor: string;
  situacaoTributaria?: string;
  
  // --- Prestação ---
  cidadeOrigem: string;
  ufOrigem: string;
  cidadeDestino: string;
  ufDestino: string;
  dataPrevEntrega?: string;
  
  // --- Documentos vinculados ---
  nfeChaves: string[];
  
  // --- Observações ---
  observacoes?: string;
  
  // --- Imagens Base64 ---
  barcodeSrc?: string;
  qrCodeSrc?: string;
}

// ============================================================
// ESTILOS
// ============================================================
const BORDER_STYLE = '1pt solid #000'; // Bordas mais fortes
const BORDER_LIGHT = '0.5pt solid #000'; // Divisões internas

const s = StyleSheet.create({
  page: {
    padding: 15,
    paddingBottom: 25,
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#000', // Preto puro para impressão
  },
  
  row: { flexDirection: 'row' },
  col: { flexDirection: 'column' },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  flex3: { flex: 3 },
  
  box: {
    border: BORDER_STYLE,
    padding: 3,
    minHeight: 18,
    justifyContent: 'flex-start',
  },
  
  boxNoBorderTop: { borderTop: 'none' },
  boxNoBorderLeft: { borderLeft: 'none' },
  
  label: {
    fontSize: 5,
    color: '#333',
    fontFamily: 'Helvetica',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  
  value: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000',
  },
  
  valueLarge: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#000',
  },
  
  sectionTitle: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#e4e4e4',
    paddingVertical: 3,
    paddingHorizontal: 4,
    marginTop: 3,
    border: BORDER_STYLE,
    borderBottom: 'none',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  watermark: {
    position: 'absolute',
    top: '40%',
    left: '10%',
    fontSize: 60,
    fontFamily: 'Helvetica-Bold',
    color: '#ff000015',
    transform: 'rotate(-35deg)',
    zIndex: -1,
  },
  
  canhotoContainer: {
    border: BORDER_STYLE,
    flexDirection: 'row',
    height: 55, 
    alignItems: 'stretch',
  },
  
  canhotoField: {
    padding: 3,
    borderRight: BORDER_STYLE,
    justifyContent: 'center',
  },
  
  canhotoCorte: {
    borderBottomWidth: 1,
    borderBottomColor: '#666',
    borderBottomStyle: 'dashed',
    height: 10,
    width: '100%',
    marginBottom: 10,
    marginTop: 2,
  },
  
  footerRow: {
    position: 'absolute',
    bottom: 10,
    left: 15,
    right: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: BORDER_LIGHT,
    paddingTop: 4,
  },
  footerText: {
    fontSize: 5,
    color: '#444',
    fontFamily: 'Helvetica',
  },
});

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================
const LabelValue = ({ label, value, style }: { label: string; value?: string | number | null; style?: any }) => (
  <View style={[s.box, style]}>
    <Text style={s.label}>{label}</Text>
    <Text style={s.value}>{value !== undefined && value !== null && value !== '' ? String(value) : '-'}</Text>
  </View>
);

function parseNfeKey(chave: string) {
  const limpa = String(chave || '').replace(/\D/g, '');
  if (limpa.length !== 44) return { tpDoc: 'NFE', cnpjEmit: limpa || '-', serieNumero: '-' };
  const serie = limpa.substring(22, 25);
  const numero = limpa.substring(25, 34).replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
  return { tpDoc: 'NFE', cnpjEmit: limpa, serieNumero: `${serie} / ${numero}` };
}

function formatarQtdMedida(valor: string | number | null | undefined, unidadeSefaz: string, unidadePadrao: string) {
  if (valor === undefined || valor === null || valor === '') return '-';
  const strValor = String(valor).trim();
  if (!unidadeSefaz) return `${strValor} ${unidadePadrao}`;
  
  const partes = unidadeSefaz.split('-');
  if (partes.length === 2) {
    const sigla = partes[1].trim();
    // Retorna apenas a unidade, ex: "952,0000 KG" ou "2 UNIDADE"
    return `${strValor} ${sigla}`;
  }
  
  return `${strValor} ${unidadeSefaz}`;
}

function formatarNumeroCte(numero: string | number) {
  if (numero === undefined || numero === null) return '-';
  const clean = String(numero).replace(/\D/g, '').replace(/^0+/, '');
  return clean ? clean.padStart(2, '0') : '00';
}

// ============================================================
// TEMPLATE DACTE PRINCIPAL
// ============================================================
export const DacteDocument = ({ data }: { data: DacteData }) => {
  const isHomolog = data.ambiente === 'homologacao';
  const chaveFormatada = data.chaveAcesso.replace(/(.{4})/g, '$1 ').trim();
  
  const nfeChaves = data.nfeChaves || [];
  const colEsquerda = nfeChaves.filter((_, idx) => idx % 2 === 0);
  const colDireita = nfeChaves.filter((_, idx) => idx % 2 !== 0);
  
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {isHomolog && <Text style={s.watermark}>SEM VALOR FISCAL</Text>}
        
        {/* 1. CANHOTO */}
        <View style={s.canhotoContainer}>
          <View style={[s.canhotoField, { width: 260, paddingVertical: 4 }]}>
            <Text style={[s.label, { fontSize: 5, marginBottom: 5 }]}>
              DECLARO QUE RECEBI OS VOLUMES DESTE CONHECIMENTO EM PERFEITO ESTADO PELO QUE DOU POR CUMPRIDO O PRESENTE CONTRATO DE TRANSPORTE
            </Text>
            <View style={[s.row, { marginTop: 6, alignItems: 'center' }]}>
              <Text style={[s.label, { width: 30, marginBottom: 0 }]}>NOME:</Text>
              <View style={{ flex: 1, borderBottom: BORDER_LIGHT, height: 8 }} />
            </View>
            <View style={[s.row, { marginTop: 6, alignItems: 'center' }]}>
              <Text style={[s.label, { width: 30, marginBottom: 0 }]}>RG/CPF:</Text>
              <View style={{ flex: 1, borderBottom: BORDER_LIGHT, height: 8 }} />
            </View>
          </View>
          
          <View style={[s.canhotoField, { flex: 2, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 8 }]}>
            <Text style={[s.label, { textAlign: 'center' }]}>ASSINATURA / CARIMBO</Text>
          </View>
          
          <View style={[s.canhotoField, { flex: 1.5, justifyContent: 'space-between', paddingTop: 2, paddingBottom: 2 }]}>
            <View style={{ alignItems: 'center' }}>
              <Text style={[s.label, { textAlign: 'center' }]}>CHEGADA DATA/HORA</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 6.5, textAlign: 'center' }}>___/___/___  ___:___</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[s.label, { textAlign: 'center' }]}>SAÍDA DATA/HORA</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 6.5, textAlign: 'center' }}>___/___/___  ___:___</Text>
            </View>
          </View>
          
          <View style={[{ width: 75, alignItems: 'center', justifyContent: 'center', padding: 3 }]}>
            <Text style={[s.valueLarge, { fontSize: 10 }]}>CT-e</Text>
            <Text style={[s.value, { marginTop: 4 }]}>{`N° ${formatarNumeroCte(data.numeroCte)}`}</Text>
            <Text style={[s.value, { marginTop: 2 }]}>{`SÉRIE: ${data.serie}`}</Text>
          </View>
        </View>
        
        <View style={s.canhotoCorte} />
        
        {/* 2. CABEÇALHO */}
        <View style={[s.row, { border: BORDER_STYLE, height: 100 }]}>
          {/* Emitente */}
          <View style={[{ width: 260, paddingTop: 4, paddingBottom: 4, paddingRight: 8, paddingLeft: 8, borderRight: BORDER_STYLE }, s.col]}>
            <Text style={[s.label, { fontSize: 5.5, marginBottom: 2 }]}>IDENTIFICAÇÃO DO EMITENTE</Text>
            <Text style={{ fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#000', marginBottom: 6 }}>{data.emitente?.razaoSocial}</Text>
            <View style={{ flex: 1, justifyContent: 'center', paddingLeft: 0, paddingRight: 0 }}>
              <View style={[s.row, { alignItems: 'flex-start', gap: 12 }]}>
                {!!data.emitente?.logoUrl && (
                  <Image src={data.emitente.logoUrl} style={{ maxHeight: 37, maxWidth: 64, objectFit: 'contain' }} />
                )}
                <View style={[s.col, { flex: 1, justifyContent: 'flex-start' }]}>
                  <Text style={{ fontSize: 7.2, fontFamily: 'Helvetica' }}>{data.emitente?.endereco}</Text>
                  <Text style={{ fontSize: 7.2, marginTop: 1 }}>{`${data.emitente?.cidade}/${data.emitente?.estado} - CEP: ${data.emitente?.cep}`}</Text>
                  {!!data.emitente?.telefone && (
                    <Text style={{ fontSize: 7.2, marginTop: 1 }}>{`FONE: ${data.emitente.telefone}`}</Text>
                  )}
                  <Text style={{ fontSize: 7.2, fontFamily: 'Helvetica-Bold', marginTop: 1.5 }}>{`CNPJ: ${data.emitente?.cnpj}`}</Text>
                  <Text style={{ fontSize: 7.2, fontFamily: 'Helvetica-Bold', marginTop: 1 }}>{`INSC. ESTADUAL: ${data.emitente?.inscricaoEstadual}`}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* DACTE Info */}
          <View style={[{ flex: 1, borderRight: BORDER_STYLE }, s.col]}>
            <View style={[{ padding: 3, alignItems: 'center', borderBottom: BORDER_STYLE, backgroundColor: '#f9f9f9' }, s.col]}>
              <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', letterSpacing: 1 }}>DACTE</Text>
              <Text style={{ fontSize: 4.5, textAlign: 'center', color: '#333', marginTop: 1 }}>Documento Auxiliar do Conhecimento de Transporte Eletrônico</Text>
            </View>
            <View style={[s.row, { borderBottom: BORDER_STYLE, height: 22 }]}>
              <View style={[{ flex: 1, borderRight: BORDER_LIGHT, alignItems: 'center', justifyContent: 'center' }]}><Text style={s.label}>MODELO</Text><Text style={s.value}>{data.modelo}</Text></View>
              <View style={[{ flex: 1, borderRight: BORDER_LIGHT, alignItems: 'center', justifyContent: 'center' }]}><Text style={s.label}>SÉRIE</Text><Text style={s.value}>{data.serie}</Text></View>
              <View style={[{ flex: 1.5, borderRight: BORDER_LIGHT, alignItems: 'center', justifyContent: 'center' }]}><Text style={s.label}>NÚMERO</Text><Text style={s.value}>{formatarNumeroCte(data.numeroCte)}</Text></View>
              <View style={[{ flex: 1, borderRight: BORDER_LIGHT, alignItems: 'center', justifyContent: 'center' }]}><Text style={s.label}>FOLHA</Text><Text style={s.value}>1/1</Text></View>
              <View style={[{ flex: 3.2, alignItems: 'center', justifyContent: 'center' }]}><Text style={s.label}>DATA/HORA EMISSÃO</Text><Text style={[s.value, { fontSize: 7 }]}>{data.dataEmissao}</Text></View>
            </View>
            <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 1 }]}>
              {!!data.barcodeSrc && <Image src={data.barcodeSrc} style={{ width: '98%', height: 40, objectFit: 'fill', marginTop: 4, marginBottom: 4 }} />}
            </View>
          </View>

          {/* Modal / QR Code */}
          <View style={[{ width: 75 }, s.col]}>
            <View style={[{ padding: 3, alignItems: 'center', borderBottom: BORDER_STYLE, height: 26, justifyContent: 'center' }]}>
              <Text style={s.label}>MODAL</Text>
              <Text style={[s.valueLarge, { fontSize: 8 }]}>{data.modal}</Text>
            </View>
            <View style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 4 }]}>
              {!!data.qrCodeSrc ? (
                <Image src={data.qrCodeSrc} style={{ width: 60, height: 60 }} />
              ) : (
                <Text style={{ fontSize: 5, color: '#ccc' }}>Sem QR Code</Text>
              )}
            </View>
          </View>
        </View>

        {/* 3. DADOS PRINCIPAIS DO CT-E */}
        <View style={s.row}>
          {LabelValue({ label: "TIPO DO CT-E", value: data.tipoCte, style: [{ width: '25%' }, s.boxNoBorderTop] })}
          {LabelValue({ label: "TIPO DO SERVIÇO", value: data.tipoServico, style: [{ width: '25%' }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          <View style={[s.box, s.boxNoBorderTop, s.boxNoBorderLeft, { width: '50%' }]}>
            <Text style={s.label}>CHAVE DE ACESSO</Text>
            <Text style={[s.valueLarge, { fontSize: 8.5, letterSpacing: 0.2, marginTop: 1 }]}>{chaveFormatada}</Text>
          </View>
        </View>

        <View style={s.row}>
          {LabelValue({ label: "TOMADOR DO SERVIÇO", value: data.tomador?.tipo, style: [{ width: '25%' }, s.boxNoBorderTop] })}
          <View style={[s.box, s.boxNoBorderTop, s.boxNoBorderLeft, { width: '25%' }]}>
            <Text style={s.label}>INDICADOR DE CT-E GLOBALIZADO</Text>
            <Text style={s.value}>{data.globalizado ? '[X] SIM   [ ] NÃO' : '[ ] SIM   [X] NÃO'}</Text>
          </View>
          <View style={[s.box, s.boxNoBorderTop, s.boxNoBorderLeft, { width: '50%', justifyContent: 'center', backgroundColor: '#f9f9f9' }]}>
            <Text style={{ fontSize: 5, color: '#333', textAlign: 'center' }}>
              Consulta de autenticidade no portal nacional do CT-e, no site da Sefaz Autorizadora ou em http://www.cte.fazenda.gov.br/portal
            </Text>
          </View>
        </View>

        <View style={s.row}>
          {LabelValue({ label: "CFOP - NATUREZA DA PRESTAÇÃO", value: `${data.cfop} - ${data.naturezaOperacao}`, style: [{ width: '50%' }, s.boxNoBorderTop] })}
          {LabelValue({ label: "PROTOCOLO DE AUTORIZAÇÃO DE USO", value: data.protocolo ? `${data.protocolo} - ${data.dataAutorizacao || ''}` : 'PENDENTE', style: [{ width: '50%' }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
        </View>

        <View style={s.row}>
          {LabelValue({ label: "ORIGEM DA PRESTAÇÃO", value: `${data.cidadeOrigem} / ${data.ufOrigem}`, style: [{ width: '50%' }, s.boxNoBorderTop] })}
          {LabelValue({ label: "DESTINO DA PRESTAÇÃO", value: `${data.cidadeDestino} / ${data.ufDestino}`, style: [{ width: '50%' }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
        </View>

        {/* 4. ATORES (Cards Complexos) */}
        <View style={s.row}>
          {/* Remetente */}
          <View style={[{ flex: 1, borderBottom: BORDER_STYLE, borderLeft: BORDER_STYLE, borderRight: BORDER_LIGHT, padding: 4 }, s.col]}>
            <Text style={[s.label, { fontSize: 6, marginBottom: 2, color: '#000' }]}>REMETENTE</Text>
            <Text style={s.value} numberOfLines={1}>{data.remetente?.razaoSocial}</Text>
            <Text style={{ fontSize: 6, marginTop: 2 }}>{`Endereço: ${data.remetente?.endereco}`}</Text>
            <View style={[s.row, { justifyContent: 'space-between', marginTop: 1 }]}>
              <Text style={{ fontSize: 6 }}>{`Município: ${data.remetente?.cidade}/${data.remetente?.estado}`}</Text>
              <Text style={{ fontSize: 6 }}>{`CEP: ${data.remetente?.cep}`}</Text>
            </View>
            <View style={[s.row, { justifyContent: 'space-between', marginTop: 1 }]}>
              <Text style={{ fontSize: 6 }}>{`CNPJ/CPF: ${data.remetente?.cnpj}`}</Text>
              <Text style={{ fontSize: 6 }}>{`Insc. Est.: ${data.remetente?.inscricaoEstadual || 'ISENTO'}`}</Text>
            </View>
            <View style={[s.row, { justifyContent: 'space-between', marginTop: 1 }]}>
              <Text style={{ fontSize: 6 }}>{`País: ${data.remetente?.pais || 'BRASIL'}`}</Text>
              {!!data.remetente?.telefone && (
                <Text style={{ fontSize: 6 }}>{`Fone: ${data.remetente.telefone}`}</Text>
              )}
            </View>
          </View>
          
          {/* Destinatário */}
          <View style={[{ flex: 1, borderBottom: BORDER_STYLE, borderRight: BORDER_STYLE, padding: 4 }, s.col]}>
            <Text style={[s.label, { fontSize: 6, marginBottom: 2, color: '#000' }]}>DESTINATÁRIO</Text>
            <Text style={s.value} numberOfLines={1}>{data.destinatario?.razaoSocial}</Text>
            <Text style={{ fontSize: 6, marginTop: 2 }}>{`Endereço: ${data.destinatario?.endereco}`}</Text>
            <View style={[s.row, { justifyContent: 'space-between', marginTop: 1 }]}>
              <Text style={{ fontSize: 6 }}>{`Município: ${data.destinatario?.cidade}/${data.destinatario?.estado}`}</Text>
              <Text style={{ fontSize: 6 }}>{`CEP: ${data.destinatario?.cep}`}</Text>
            </View>
            <View style={[s.row, { justifyContent: 'space-between', marginTop: 1 }]}>
              <Text style={{ fontSize: 6 }}>{`CNPJ/CPF: ${data.destinatario?.cnpj}`}</Text>
              <Text style={{ fontSize: 6 }}>{`Insc. Est.: ${data.destinatario?.inscricaoEstadual || 'ISENTO'}`}</Text>
            </View>
            <View style={[s.row, { justifyContent: 'space-between', marginTop: 1 }]}>
              <Text style={{ fontSize: 6 }}>{`País: ${data.destinatario?.pais || 'BRASIL'}`}</Text>
              {!!data.destinatario?.telefone && (
                <Text style={{ fontSize: 6 }}>{`Fone: ${data.destinatario.telefone}`}</Text>
              )}
            </View>
          </View>
        </View>

        <View style={s.row}>
          {/* Expedidor */}
          <View style={[{ flex: 1, borderBottom: BORDER_STYLE, borderLeft: BORDER_STYLE, borderRight: BORDER_LIGHT, padding: 4 }, s.col]}>
            <Text style={[s.label, { fontSize: 5, color: '#000' }]}>EXPEDIDOR</Text>
            <Text style={s.value} numberOfLines={1}>{data.expedidor?.razaoSocial || '-'}</Text>
            <Text style={{ fontSize: 6, marginTop: 1 }}>{`Endereço: ${data.expedidor?.endereco || '-'}`}</Text>
            <View style={[s.row, { justifyContent: 'space-between', marginTop: 1 }]}>
              <Text style={{ fontSize: 6 }}>{`Município: ${data.expedidor?.cidade || '-'}/${data.expedidor?.estado || '-'}`}</Text>
              <Text style={{ fontSize: 6 }}>{`CNPJ/CPF: ${data.expedidor?.cnpj || '-'}`}</Text>
            </View>
          </View>
          
          {/* Recebedor */}
          <View style={[{ flex: 1, borderBottom: BORDER_STYLE, borderRight: BORDER_STYLE, padding: 4 }, s.col]}>
            <Text style={[s.label, { fontSize: 5, color: '#000' }]}>RECEBEDOR</Text>
            <Text style={s.value} numberOfLines={1}>{data.recebedor?.razaoSocial || '-'}</Text>
            <Text style={{ fontSize: 6, marginTop: 1 }}>{`Endereço: ${data.recebedor?.endereco || '-'}`}</Text>
            <View style={[s.row, { justifyContent: 'space-between', marginTop: 1 }]}>
              <Text style={{ fontSize: 6 }}>{`Município: ${data.recebedor?.cidade || '-'}/${data.recebedor?.estado || '-'}`}</Text>
              <Text style={{ fontSize: 6 }}>{`CNPJ/CPF: ${data.recebedor?.cnpj || '-'}`}</Text>
            </View>
          </View>
        </View>

        <View style={[s.box, s.boxNoBorderTop, s.col, { padding: 4 }]}>
          <View style={[s.row, { alignItems: 'center' }]}>
            <Text style={[s.label, { marginRight: 4, marginBottom: 0 }]}>TOMADOR:</Text>
            <Text style={[s.value, { flex: 1 }]}>{data.tomador?.razaoSocial}</Text>
            <Text style={[s.label, { marginLeft: 10, marginRight: 4, marginBottom: 0 }]}>MUNICÍPIO:</Text>
            <Text style={s.value}>{`${data.tomador?.cidade || '-'}/${data.tomador?.estado || '-'}`}</Text>
            <Text style={[s.label, { marginLeft: 10, marginRight: 4, marginBottom: 0 }]}>CEP:</Text>
            <Text style={s.value}>{data.tomador?.cep || '-'}</Text>
          </View>
          <View style={[s.row, { marginTop: 3, alignItems: 'center' }]}>
            <Text style={[s.label, { marginRight: 4, marginBottom: 0 }]}>ENDEREÇO:</Text>
            <Text style={{ fontSize: 6.5, flex: 1, fontFamily: 'Helvetica' }} numberOfLines={1}>{data.tomador?.endereco || '-'}</Text>
            <Text style={[s.label, { marginLeft: 10, marginRight: 4, marginBottom: 0 }]}>INSC. ESTADUAL:</Text>
            <Text style={s.value}>{data.tomador?.inscricaoEstadual || 'ISENTO'}</Text>
            <Text style={[s.label, { marginLeft: 10, marginRight: 4, marginBottom: 0 }]}>CPF/CNPJ:</Text>
            <Text style={s.value}>{data.tomador?.cnpj}</Text>
            <Text style={[s.label, { marginLeft: 10, marginRight: 4, marginBottom: 0 }]}>PAÍS:</Text>
            <Text style={s.value}>{data.tomador?.pais || 'BRASIL'}</Text>
          </View>
        </View>

        {/* 5. CARGA */}
        <Text style={s.sectionTitle}>PRODUTO PREDOMINANTE E CARGA</Text>
        <View style={s.row}>
          {LabelValue({ label: "PRODUTO PREDOMINANTE", value: data.produtoPredominante, style: [s.flex1, s.boxNoBorderTop] })}
        </View>

        <View style={s.row}>
          {LabelValue({ label: "OUTRAS CARACTERÍSTICAS", value: data.outrasCaracteristicas || 'GRANEL', style: [s.flex1, s.boxNoBorderTop] })}
          {LabelValue({ label: "QTD/UN - PESO BRUTO", value: formatarQtdMedida(data.peso, data.especieCarga || '01-KG', 'KG'), style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "QTD/UN - VOLUMES", value: formatarQtdMedida(data.quantidadeVolumes, '03-UNIDADE', 'UN'), style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "VALOR DA CARGA", value: `R$ ${data.valorCarga}`, style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
        </View>

        {/* 6. COMPONENTES E TOTAIS */}
        <Text style={s.sectionTitle}>COMPONENTES DO VALOR DA PRESTAÇÃO</Text>
        <View style={[s.box, s.boxNoBorderTop, { flexDirection: 'row', minHeight: 28, padding: 0 }]}>
          
          {/* Colunas de Componentes */}
          <View style={{ flex: 1, flexDirection: 'row' }}>
            {[0, 1, 2, 3].map((idx) => {
              const c = data.componentesValor?.[idx];
              const nomeExibido = c ? c.nome : (idx === 0 ? "FRETE" : "");
              const valorExibido = c ? c.valor : (idx === 0 ? `R$ ${data.valorServico}` : "");
              return (
                <View key={idx} style={[{ flex: 1, borderRight: BORDER_LIGHT }, s.col]}>
                  <View style={[s.row, { borderBottom: BORDER_LIGHT, padding: 2, backgroundColor: '#f5f5f5' }]}>
                    <Text style={[s.label, { flex: 1, marginBottom: 0 }]}>NOME</Text>
                    <Text style={[s.label, { marginBottom: 0, width: 40, textAlign: 'right' }]}>VALOR</Text>
                  </View>
                  <View style={[s.row, { flex: 1, padding: 3, alignItems: 'center' }]}>
                    <Text style={[s.value, { flex: 1, fontSize: 6.5 }]} numberOfLines={1}>{nomeExibido}</Text>
                    <Text style={[s.value, { width: 45, textAlign: 'right', fontSize: 6.5 }]}>{valorExibido}</Text>
                  </View>
                </View>
              );
            })}
          </View>
          
          {/* Bloco de Totais (Lado a Lado) */}
          <View style={{ width: 170, flexDirection: 'row', backgroundColor: '#f0f0f0' }}>
            
            {/* VALOR TOTAL DO SERVIÇO */}
            <View style={{ flex: 1, borderRight: BORDER_LIGHT, padding: 4, justifyContent: 'center' }}>
              <Text style={[s.label, { textAlign: 'center', fontSize: 5, marginBottom: 2 }]}>VALOR TOTAL DO SERVIÇO</Text>
              <Text style={[s.valueLarge, { textAlign: 'center' }]}>{`R$ ${data.valorServico}`}</Text>
            </View>

            {/* VALOR A RECEBER */}
            <View style={{ flex: 1, padding: 4, justifyContent: 'center' }}>
              <Text style={[s.label, { textAlign: 'center', fontSize: 5, marginBottom: 2 }]}>VALOR A RECEBER</Text>
              <Text style={[s.valueLarge, { textAlign: 'center' }]}>{`R$ ${data.valorReceber}`}</Text>
            </View>

          </View>
        </View>

        {/* 7. IMPOSTOS */}
        <Text style={s.sectionTitle}>INFORMAÇÕES RELATIVAS AO IMPOSTO</Text>
        <View style={s.row}>
          {LabelValue({ label: "SITUAÇÃO TRIBUTÁRIA", value: data.situacaoTributaria, style: [s.flex2, s.boxNoBorderTop] })}
          {LabelValue({ label: "BASE DE CÁLCULO", value: `R$ ${data.icmsBase}`, style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "ALÍQUOTA ICMS", value: `${data.icmsAliquota}%`, style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "VALOR ICMS", value: `R$ ${data.icmsValor}`, style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "% RED. BC", value: '0,00', style: [{ width: 50 }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
        </View>

        {/* 8. NFE VINCULADAS */}
        <Text style={s.sectionTitle}>DOCUMENTOS ORIGINÁRIOS (NF-E)</Text>
        <View style={[s.row, s.box, s.boxNoBorderTop, { padding: 0 }]}>
          {[colEsquerda, colDireita].map((coluna, blockIdx) => (
            <View key={blockIdx} style={{ flex: 1, borderRight: blockIdx === 0 ? BORDER_LIGHT : 'none' }}>
              <View style={[s.row, { borderBottom: BORDER_LIGHT, backgroundColor: '#f5f5f5', padding: 2 }]}>
                <Text style={[s.label, { width: 35, marginBottom: 0 }]}>TP DOC.</Text>
                <Text style={[s.label, { flex: 1, marginBottom: 0 }]}>CNPJ/CPF EMITENTE</Text>
                <Text style={[s.label, { width: 85, marginBottom: 0 }]}>SÉRIE/NRO DOC.</Text>
              </View>
              {coluna.map((chave, idx) => {
                const info = parseNfeKey(chave);
                return (
                  <View key={idx} style={[s.row, { borderBottom: idx < coluna.length - 1 ? '0.5pt solid #eee' : 'none', padding: 2, alignItems: 'center' }]}>
                    <Text style={{ fontSize: 6, width: 35 }}>{info.tpDoc}</Text>
                    <Text style={{ fontSize: 6, flex: 1, fontFamily: 'Helvetica-Bold' }}>{info.cnpjEmit}</Text>
                    <Text style={{ fontSize: 6, width: 85 }}>{info.serieNumero}</Text>
                  </View>
                );
              })}
              {coluna.length === 0 && <View style={{ height: 12 }} />}
            </View>
          ))}
        </View>

        {/* 9. OBSERVAÇÕES (Espaço Expansivo) */}
        <Text style={s.sectionTitle}>OBSERVAÇÕES GERAIS</Text>
        <View style={[s.box, s.boxNoBorderTop, { flexGrow: 1, padding: 4 }]}>
          {!!data.observacoes && <Text style={{ fontSize: 6.5, lineHeight: 1.3 }}>{String(data.observacoes)}</Text>}
        </View>

        {/* 10. MODAL / FISCO */}
        <Text style={s.sectionTitle}>INFORMAÇÕES ESPECÍFICAS DO MODAL RODOVIÁRIO</Text>
        <View style={s.row}>
          {LabelValue({ label: "RNTRC DA EMPRESA", value: data.emitente?.rntrc, style: [s.flex1, s.boxNoBorderTop] })}
          {LabelValue({ label: "DATA PREV. ENTREGA", value: data.dataPrevEntrega, style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
        </View>
        <View style={[s.row, { height: 65 }]}>
          <View style={[s.flex1, s.box, s.boxNoBorderTop, { padding: 4 }]}>
            <Text style={s.label}>USO EXCLUSIVO DO EMISSOR DO CT-E</Text>
          </View>
          <View style={[s.flex1, s.box, s.boxNoBorderTop, s.boxNoBorderLeft, { padding: 4 }]}>
            <Text style={s.label}>RESERVADO AO FISCO</Text>
          </View>
        </View>

        {/* RODAPÉ */}
        <View style={s.footerRow}>
          <Text style={s.footerText}>
            {`Impresso em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
          </Text>
          <Text style={s.footerText}>Emitido por sistema autorizado - www.dezlog.com.br</Text>
        </View>
      </Page>
    </Document>
  );
};
