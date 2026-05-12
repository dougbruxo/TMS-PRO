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

const s = StyleSheet.create({
  page: {
    padding: 15,
    fontSize: 7,
    fontFamily: 'Helvetica',
    color: '#1a1a1a',
  },
  
  // --- Layout base ---
  row: { flexDirection: 'row' },
  col: { flexDirection: 'column' },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  flex3: { flex: 3 },
  
  // --- Bordas e Caixas ---
  box: {
    border: '0.5pt solid #333',
    padding: 3,
    minHeight: 20,
  },
  boxNoBorderTop: {
    borderTop: 'none',
  },
  boxNoBorderLeft: {
    borderLeft: 'none',
  },
  boxNoBorderRight: {
    borderRight: 'none',
  },
  boxNoBorderBottom: {
    borderBottom: 'none',
  },
  
  // --- Textos ---
  label: {
    fontSize: 5.5,
    color: '#555',
    marginBottom: 1,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
  },
  valueLarge: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  valueXL: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  textCenter: { textAlign: 'center' },
  textRight: { textAlign: 'right' },
  
  // --- Cabeçalho ---
  headerRow: {
    flexDirection: 'row',
    border: '1pt solid #333',
    minHeight: 60,
  },
  headerEmitente: {
    flex: 3,
    padding: 6,
    borderRight: '0.5pt solid #333',
    justifyContent: 'center',
  },
  headerDacte: {
    flex: 2,
    padding: 4,
    borderRight: '0.5pt solid #333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBarcode: {
    flex: 3,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // --- Seções ---
  sectionTitle: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    backgroundColor: '#eee',
    padding: '2 4',
    marginTop: 4,
    border: '0.5pt solid #333',
    borderBottom: 'none',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // --- Marca d'água ---
  watermark: {
    position: 'absolute',
    top: '40%',
    left: '15%',
    fontSize: 50,
    fontFamily: 'Helvetica-Bold',
    color: '#ff000020',
    transform: 'rotate(-30deg)',
  },
  
  // --- Canhoto ---
  canhoto: {
    border: '0.5pt dashed #999',
    padding: 6,
    marginBottom: 4,
    flexDirection: 'row',
    minHeight: 35,
    alignItems: 'center',
  },
  canhotoDivider: {
    width: 1,
    backgroundColor: '#999',
    marginHorizontal: 8,
    height: '100%',
  },
  
  // --- Rodapé ---
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 15,
    right: 15,
    fontSize: 5.5,
    color: '#777',
    textAlign: 'center',
    borderTop: '0.5pt solid #ccc',
    paddingTop: 3,
  },
});

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================

const LabelValue = ({ label, value, style }: { label: string; value?: string | number | null; style?: any }) => (
  <View style={[s.box, style]}>
    <Text style={s.label}>{label}</Text>
    <Text style={s.value}>{value !== undefined && value !== null ? String(value) : '-'}</Text>
  </View>
);

const LabelValueInline = ({ label, value, style }: { label: string; value?: string | number | null; style?: any }) => (
  <View style={[{ padding: 3 }, style]}>
    <Text style={s.label}>{label}</Text>
    <Text style={s.value}>{value !== undefined && value !== null ? String(value) : '-'}</Text>
  </View>
);

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export const DacteDocument = ({ data }: { data: DacteData }) => {
  const isHomolog = data.ambiente === 'homologacao';
  
  // Formatar chave de acesso em grupos de 4
  const chaveFormatada = data.chaveAcesso.replace(/(.{4})/g, '$1 ').trim();
  
  return (
    <Document>
      <Page size="A4" style={s.page}>
        
        {/* Marca d'água de homologação */}
        {isHomolog && (
          <Text style={s.watermark}>SEM VALOR FISCAL</Text>
        )}
        
        {/* ============================================================ */}
        {/* CANHOTO */}
        {/* ============================================================ */}
        <View style={s.canhoto}>
          <View style={[s.flex1, { paddingRight: 4 }]}>
            <Text style={[s.label, { fontSize: 6, marginBottom: 2 }]}>
              DECLARO QUE RECEBI OS VOLUMES DESTE CONHECIMENTO EM PERFEITO ESTADO PELO QUE DOU POR CUMPRIDO O PRESENTE CONTRATO DE TRANSPORTE
            </Text>
            <View style={[s.row, { marginTop: 4 }]}>
              <View style={s.flex1}>
                <Text style={s.label}>NOME</Text>
                <View style={{ borderBottom: '0.5pt solid #999', marginTop: 8 }} />
              </View>
              <View style={{ width: 80, marginLeft: 6 }}>
                <Text style={s.label}>RG/CPF</Text>
                <View style={{ borderBottom: '0.5pt solid #999', marginTop: 8 }} />
              </View>
              <View style={{ width: 60, marginLeft: 6 }}>
                <Text style={s.label}>DATA</Text>
                <View style={{ borderBottom: '0.5pt solid #999', marginTop: 8 }} />
              </View>
            </View>
          </View>
          <View style={s.canhotoDivider} />
          <View style={{ width: 80, alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={[s.label, { textAlign: 'center' }]}>ASSINATURA/CARIMBO</Text>
              <View style={{ borderBottom: '0.5pt solid #999', width: '100%', marginTop: 14 }} />
            </View>
            <View style={{ marginTop: 4, alignItems: 'flex-end' }}>
              <Text style={s.label}>CT-e</Text>
              <Text style={[s.value, { fontSize: 9, textAlign: 'right' }]}>{`N°: ${data.numeroCte}`}</Text>
              <Text style={s.label}>{`SÉRIE: ${data.serie}`}</Text>
            </View>
          </View>
        </View>
        
        {/* Cabeçalho Principal */}
        <View style={s.headerRow}>
          {/* Dados do Emitente */}
          <View style={s.headerEmitente}>
            <Text style={[s.label, { marginBottom: 2, fontSize: 5 }]}>IDENTIFICAÇÃO DO EMITENTE</Text>
            {!!data.emitente.logoUrl ? (
              <Image src={data.emitente.logoUrl} style={{ maxHeight: 25, maxWidth: 80, marginBottom: 3, objectFit: 'contain', alignSelf: 'flex-start' }} />
            ) : null}
            <Text style={[s.valueLarge, { marginBottom: 1 }]}>
              {data.emitente.razaoSocial}
            </Text>
            {!!data.emitente.nomeFantasia && (
              <Text style={{ fontSize: 6.5, marginBottom: 1, color: '#555' }}>
                {String(data.emitente.nomeFantasia)}
              </Text>
            )}
            <Text style={{ fontSize: 6.5 }}>{data.emitente.endereco}</Text>
            <Text style={{ fontSize: 6.5 }}>
              {`${data.emitente.cidade}/${data.emitente.estado} - CEP: ${data.emitente.cep}`}
            </Text>
            <Text style={{ fontSize: 6.5 }}>
              {`CNPJ: ${data.emitente.cnpj} | IE: ${data.emitente.inscricaoEstadual}`}
            </Text>
            {!!data.emitente.telefone && (
              <Text style={{ fontSize: 6.5 }}>{`Fone: ${data.emitente.telefone}`}</Text>
            )}
          </View>
          
          {/* DACTE Identificação */}
          <View style={s.headerDacte}>
            <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>
              DACTE
            </Text>
            <Text style={{ fontSize: 6, textAlign: 'center', marginBottom: 4 }}>
              {`Documento Auxiliar do\nConhecimento de Transporte Eletrônico`}
            </Text>
            <Text style={s.label}>MODAL</Text>
            <Text style={[s.value, s.textCenter]}>{data.modal || 'RODOVIÁRIO'}</Text>
          </View>
          
          {/* Código de barras + Chave */}
          <View style={s.headerBarcode}>
            {!!data.barcodeSrc && (
              <Image src={data.barcodeSrc} style={{ width: '90%', height: 30, marginBottom: 2 }} />
            )}
            <Text style={[s.label, s.textCenter]}>CHAVE DE ACESSO</Text>
            <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', textAlign: 'center', letterSpacing: 0.3 }}>
              {chaveFormatada}
            </Text>
          </View>
        </View>
        
        {/* Tipo do CT-e + Nº + Série + Data + Protocolo */}
        <View style={s.row}>
          {LabelValue({ label: "TIPO DO CT-E", value: data.tipoCte, style: [s.flex1, s.boxNoBorderTop] })}
          {LabelValue({ label: "TIPO DO SERVIÇO", value: data.tipoServico, style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "CFOP", value: data.cfop, style: [{ width: 50 }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "NÚMERO", value: data.numeroCte, style: [{ width: 70 }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "SÉRIE", value: data.serie, style: [{ width: 35 }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "DATA EMISSÃO", value: data.dataEmissao, style: [{ width: 70 }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
        </View>
        
        {/* Protocolo */}
        <View style={s.row}>
          {LabelValue({ label: "PROTOCOLO DE AUTORIZAÇÃO", value: data.protocolo || 'PENDENTE', style: [s.flex1, s.boxNoBorderTop] })}
          {LabelValue({ label: "DATA AUTORIZAÇÃO", value: data.dataAutorizacao || '-', style: [{ width: 100 }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {!!data.qrCodeSrc && (
            <View style={[s.box, s.boxNoBorderTop, s.boxNoBorderLeft, { width: 60, alignItems: 'center', justifyContent: 'center' }]}>
              <Image src={data.qrCodeSrc} style={{ width: 45, height: 45 }} />
            </View>
          )}
        </View>
        
        {/* ============================================================ */}
        {/* PRESTAÇÃO DO SERVIÇO */}
        {/* ============================================================ */}
        <Text style={s.sectionTitle}>Prestação do Serviço de Transporte</Text>
        
        <View style={s.row}>
          {LabelValue({ label: "INÍCIO DA PRESTAÇÃO", value: `${data.cidadeOrigem} / ${data.ufOrigem}`, style: s.flex1 })}
          {LabelValue({ label: "TÉRMINO DA PRESTAÇÃO", value: `${data.cidadeDestino} / ${data.ufDestino}`, style: [s.flex1, s.boxNoBorderLeft] })}
        </View>
        
        {/* ============================================================ */}
        {/* REMETENTE */}
        {/* ============================================================ */}
        <Text style={s.sectionTitle}>Remetente</Text>
        
        <View style={s.row}>
          {LabelValue({ label: "NOME / RAZÃO SOCIAL", value: data.remetente.razaoSocial, style: s.flex3 })}
          {LabelValue({ label: "CNPJ/CPF", value: data.remetente.cnpj, style: [s.flex1, s.boxNoBorderLeft] })}
          {LabelValue({ label: "INSCRIÇÃO ESTADUAL", value: data.remetente.inscricaoEstadual || 'ISENTO', style: [s.flex1, s.boxNoBorderLeft] })}
        </View>
        <View style={s.row}>
          {LabelValue({ label: "ENDEREÇO", value: data.remetente.endereco, style: [s.flex3, s.boxNoBorderTop] })}
          {LabelValue({ label: "MUNICÍPIO", value: data.remetente.cidade, style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "UF", value: data.remetente.estado, style: [{ width: 30 }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "CEP", value: data.remetente.cep, style: [{ width: 60 }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "FONE", value: data.remetente.telefone || '-', style: [{ width: 80 }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
        </View>
        
        {/* ============================================================ */}
        {/* DESTINATÁRIO */}
        {/* ============================================================ */}
        <Text style={s.sectionTitle}>Destinatário</Text>
        
        <View style={s.row}>
          {LabelValue({ label: "NOME / RAZÃO SOCIAL", value: data.destinatario.razaoSocial, style: s.flex3 })}
          {LabelValue({ label: "CNPJ/CPF", value: data.destinatario.cnpj, style: [s.flex1, s.boxNoBorderLeft] })}
          {LabelValue({ label: "INSCRIÇÃO ESTADUAL", value: data.destinatario.inscricaoEstadual || 'ISENTO', style: [s.flex1, s.boxNoBorderLeft] })}
        </View>
        <View style={s.row}>
          {LabelValue({ label: "ENDEREÇO", value: data.destinatario.endereco, style: [s.flex3, s.boxNoBorderTop] })}
          {LabelValue({ label: "MUNICÍPIO", value: data.destinatario.cidade, style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "UF", value: data.destinatario.estado, style: [{ width: 30 }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "CEP", value: data.destinatario.cep, style: [{ width: 60 }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "FONE", value: data.destinatario.telefone || '-', style: [{ width: 80 }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
        </View>
        {/* ============================================================ */}
        {/* EXPEDIDOR / RECEBEDOR */}
        {/* ============================================================ */}
        <View style={s.row}>
          <View style={s.flex1}>
            <Text style={s.sectionTitle}>Expedidor</Text>
            <View style={s.row}>
              {LabelValue({ label: "NOME / RAZÃO SOCIAL", value: data.expedidor?.razaoSocial || '-', style: s.flex2 })}
              {LabelValue({ label: "CNPJ/CPF", value: data.expedidor?.cnpj || '-', style: [s.flex1, s.boxNoBorderLeft] })}
            </View>
            <View style={s.row}>
              {LabelValue({ label: "ENDEREÇO", value: data.expedidor?.endereco || '-', style: [s.flex2, s.boxNoBorderTop] })}
              {LabelValue({ label: "MUNICÍPIO", value: data.expedidor?.cidade || '-', style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
            </View>
            <View style={s.row}>
              {LabelValue({ label: "UF", value: data.expedidor?.estado || '-', style: [{ width: 30 }, s.boxNoBorderTop] })}
              {LabelValue({ label: "CEP", value: data.expedidor?.cep || '-', style: [{ width: 60 }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
              {LabelValue({ label: "PAÍS", value: data.expedidor?.pais || 'BRASIL', style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
              {LabelValue({ label: "FONE", value: data.expedidor?.telefone || '-', style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
            </View>
          </View>
          <View style={[s.flex1, { borderLeft: '0.5pt solid #333' }]}>
            <Text style={s.sectionTitle}>Recebedor</Text>
            <View style={s.row}>
              {LabelValue({ label: "NOME / RAZÃO SOCIAL", value: data.recebedor?.razaoSocial || '-', style: s.flex2 })}
              {LabelValue({ label: "CNPJ/CPF", value: data.recebedor?.cnpj || '-', style: [s.flex1, s.boxNoBorderLeft] })}
            </View>
            <View style={s.row}>
              {LabelValue({ label: "ENDEREÇO", value: data.recebedor?.endereco || '-', style: [s.flex2, s.boxNoBorderTop] })}
              {LabelValue({ label: "MUNICÍPIO", value: data.recebedor?.cidade || '-', style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
            </View>
            <View style={s.row}>
              {LabelValue({ label: "UF", value: data.recebedor?.estado || '-', style: [{ width: 30 }, s.boxNoBorderTop] })}
              {LabelValue({ label: "CEP", value: data.recebedor?.cep || '-', style: [{ width: 60 }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
              {LabelValue({ label: "PAÍS", value: data.recebedor?.pais || 'BRASIL', style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
              {LabelValue({ label: "FONE", value: data.recebedor?.telefone || '-', style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
            </View>
          </View>
        </View>

        {/* ============================================================ */}
        {/* TOMADOR DO SERVIÇO */}
        {/* ============================================================ */}
        <Text style={s.sectionTitle}>Tomador do Serviço</Text>
        
        <View style={s.row}>
          {LabelValue({ label: "NOME / RAZÃO SOCIAL", value: data.tomador.razaoSocial, style: s.flex2 })}
          {LabelValue({ label: "MUNICÍPIO", value: data.tomador.cidade, style: [s.flex1, s.boxNoBorderLeft] })}
          {LabelValue({ label: "CEP", value: data.tomador.cep, style: [{ width: 60 }, s.boxNoBorderLeft] })}
        </View>
        <View style={s.row}>
          {LabelValue({ label: "ENDEREÇO", value: data.tomador.endereco, style: [s.flex3, s.boxNoBorderTop] })}
          {LabelValue({ label: "PAÍS", value: data.tomador.pais || 'BRASIL', style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "FONE", value: data.tomador.telefone || '-', style: [{ width: 80 }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
        </View>
        <View style={s.row}>
          {LabelValue({ label: "CNPJ/CPF", value: data.tomador.cnpj, style: [s.flex1, s.boxNoBorderTop] })}
          {LabelValue({ label: "INSCRIÇÃO ESTADUAL", value: data.tomador.inscricaoEstadual || 'ISENTO', style: [s.flex1, s.boxNoBorderTop, s.boxNoBorderLeft] })}
          {LabelValue({ label: "INDICADOR DO CT-E GLOBALIZADO", value: data.globalizado ? 'SIM' : 'NÃO', style: [{ width: 100 }, s.boxNoBorderTop, s.boxNoBorderLeft] })}
        </View>
        
        {/* ============================================================ */}
        {/* PRODUTO PREDOMINANTE + VALORES */}
        {/* ============================================================ */}
        <Text style={s.sectionTitle}>Produto Predominante / Valores</Text>
        <View style={s.row}>
          {LabelValue({ label: "PRODUTO PREDOMINANTE", value: data.produtoPredominante, style: s.flex2 })}
          {LabelValue({ label: "OUTRAS CARACTERÍSTICAS DA CARGA", value: data.outrasCaracteristicas || 'GRANEL', style: [s.flex1, s.boxNoBorderLeft] })}
          {LabelValue({ label: "VALOR TOTAL DA MERCADORIA", value: `R$ ${data.valorCarga}`, style: [s.flex1, s.boxNoBorderLeft] })}
        </View>

        {/* ============================================================ */}
        {/* ============================================================ */}
        {/* COMPONENTES DO VALOR DA PRESTAÇÃO (LAYOUT COMPACTO) */}
        {/* ============================================================ */}
        <Text style={s.sectionTitle}>Componentes do Valor da Prestação do Serviço</Text>
        <View style={[s.box, { flexDirection: 'row', minHeight: 25 }]}>
          {/* Grade de Componentes */}
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 2 }}>
            {(data.componentesValor && data.componentesValor.length > 0
              ? data.componentesValor
              : [{ nome: 'FRETE', valor: data.valorServico }]
            ).map((c, i) => (
              <View key={i} style={{ width: '25%', padding: 1, marginBottom: 2 }}>
                <Text style={[s.label, { fontSize: 4.5 }]}>{c.nome}</Text>
                <Text style={[s.value, { fontSize: 7 }]}>{`R$ ${c.valor}`}</Text>
              </View>
            ))}
          </View>
          {/* Totais do Serviço */}
          <View style={{ width: 100, borderLeft: '0.5pt solid #333', backgroundColor: '#f9f9f9', padding: 2 }}>
            <View style={{ marginBottom: 3 }}>
              <Text style={[s.label, { textAlign: 'right', fontSize: 5 }]}>VALOR TOTAL DO SERVIÇO</Text>
              <Text style={[s.value, { textAlign: 'right', fontSize: 9, fontFamily: 'Helvetica-Bold' }]}>{`R$ ${data.valorServico}`}</Text>
            </View>
            <View>
              <Text style={[s.label, { textAlign: 'right', fontSize: 5 }]}>VALOR A RECEBER</Text>
              <Text style={[s.value, { textAlign: 'right', fontSize: 9, fontFamily: 'Helvetica-Bold' }]}>{`R$ ${data.valorReceber}`}</Text>
            </View>
          </View>
        </View>
        
        {/* ============================================================ */}
        {/* INFORMAÇÕES DA CARGA */}
        {/* ============================================================ */}
        <Text style={s.sectionTitle}>Informações da Carga</Text>
        <View style={s.row}>
          {LabelValue({ label: "UNIDADE/QTD — PESO BRUTO", value: `${data.especieCarga || '01-KG'} / ${data.peso} KG`, style: s.flex1 })}
          {LabelValue({ label: "QTDE VOLUMES", value: data.quantidadeVolumes, style: [s.flex1, s.boxNoBorderLeft] })}
        </View>
        
        {/* ============================================================ */}
        {/* INFORMAÇÕES TRIBUTÁRIAS */}
        {/* ============================================================ */}
        <Text style={s.sectionTitle}>Informações Relativas ao Imposto</Text>
        <View style={s.row}>
          {LabelValue({ label: "SITUAÇÃO TRIBUTÁRIA", value: data.situacaoTributaria || 'ICMS Simples Nacional', style: s.flex2 })}
          {LabelValue({ label: "BASE DE CÁLCULO", value: `R$ ${data.icmsBase}`, style: [s.flex1, s.boxNoBorderLeft] })}
          {LabelValue({ label: "ALÍQUOTA ICMS (%)", value: `${data.icmsAliquota}%`, style: [s.flex1, s.boxNoBorderLeft] })}
          {LabelValue({ label: "VALOR ICMS", value: `R$ ${data.icmsValor}`, style: [s.flex1, s.boxNoBorderLeft] })}
          {LabelValue({ label: "% RED. BC", value: '0,00', style: [{ width: 50 }, s.boxNoBorderLeft] })}
        </View>
        
        {/* ============================================================ */}
        {/* DOCUMENTOS ORIGINÁRIOS */}
        {/* ============================================================ */}
        <Text style={s.sectionTitle}>Documentos Originários (NF-e)</Text>
        
        <View style={[s.box, { minHeight: 30 }]}>
          {data.nfeChaves && data.nfeChaves.length > 0 ? (
            data.nfeChaves.map((chave, idx) => (
              <View key={idx} style={[s.row, { marginBottom: 1 }]}>
                <Text style={{ fontSize: 5.5, width: 15, color: '#888' }}>{`${idx + 1}.`}</Text>
                <Text style={{ fontSize: 6.5, fontFamily: 'Helvetica', letterSpacing: 0.3 }}>
                  {typeof chave === 'string' ? chave.replace(/(.{4})/g, '$1 ').trim() : String(chave)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ fontSize: 6.5, color: '#888' }}>Nenhum documento vinculado</Text>
          )}
        </View>
        
        {/* ============================================================ */}
        {/* OBSERVAÇÕES GERAIS */}
        {/* ============================================================ */}
        <Text style={s.sectionTitle}>Observações Gerais</Text>
        <View style={[s.box, { minHeight: 30 }]}>
          {!!data.observacoes && (
            <Text style={{ fontSize: 6.5 }}>{String(data.observacoes)}</Text>
          )}
        </View>

        {/* ============================================================ */}
        {/* INFORMAÇÕES ESPECÍFICAS DO MODAL RODOVIÁRIO */}
        {/* ============================================================ */}
        <Text style={s.sectionTitle}>Informações Específicas do Modal Rodoviário</Text>
        <View style={s.row}>
          {LabelValue({ label: "RNTRC DA EMPRESA", value: data.emitente.rntrc || '-', style: { width: 90 } })}
          {LabelValue({ label: "DATA PREV. ENTREGA", value: data.dataPrevEntrega || '-', style: [{ width: 90 }, s.boxNoBorderLeft] })}
          <View style={[s.flex1, s.box, s.boxNoBorderLeft]}>
            <Text style={s.label}>USO EXCLUSIVO DO EMISSOR DO CT-e</Text>
          </View>
          <View style={[s.flex1, s.box, s.boxNoBorderLeft]}>
            <Text style={s.label}>RESERVADO AO FISCO</Text>
          </View>
        </View>
        
        {/* ============================================================ */}
        {/* RODAPÉ */}
        {/* ============================================================ */}
        <Text style={s.footer}>
          Documento emitido por DezLog — Sistema de Gestão para Transportadoras | www.dezlog.com.br
        </Text>
        
      </Page>
    </Document>
  );
};
