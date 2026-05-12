/**
 * DezLog Fiscal Engine — DAMDFE Template (React-PDF) v2
 * Layout baseado no Ato COTEPE/ICMS para MDF-e versão 3.00
 * Formato: A4 (210 x 297 mm)
 */

import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

export interface DamdfeData {
  chaveAcesso: string;
  protocolo?: string;
  dataAutorizacao?: string;
  ambiente: 'homologacao' | 'producao';
  modelo: string;
  serie: string;
  numeroMdfe: string;
  dataEmissao: string;
  folha?: string;
  ufPercurso?: string;
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
  qtdCte: number;
  qtdNfe: number;
  chavesDocumentos: string[];
  vCarga: string;
  qCarga: string;
  seguradora?: string;
  apolice?: string;
  averbacao?: string;
  ciot?: string;
  ciotCpfCnpj?: string;
  observacoes?: string;
  barcodeSrc?: string;
  qrCodeSrc?: string;
}

const s = StyleSheet.create({
  page: { padding: 14, fontSize: 7, fontFamily: 'Helvetica', color: '#111' },
  row: { flexDirection: 'row' },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  flex3: { flex: 3 },
  bold: { fontFamily: 'Helvetica-Bold' },
  center: { textAlign: 'center' },
  right: { textAlign: 'right' },

  box: { border: '0.5pt solid #333', padding: '2 3', minHeight: 18 },
  noTop: { borderTop: 'none' },
  noLeft: { borderLeft: 'none' },
  noRight: { borderRight: 'none' },
  noBottom: { borderBottom: 'none' },

  label: { fontSize: 5, color: '#555', textTransform: 'uppercase', marginBottom: 1 },
  value: { fontSize: 7, fontFamily: 'Helvetica-Bold' },
  valueMd: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  valueLg: { fontSize: 11, fontFamily: 'Helvetica-Bold' },

  sectionTitle: {
    backgroundColor: '#ddd',
    padding: '1.5 4',
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    borderTop: '0.5pt solid #333',
    borderBottom: '0.5pt solid #333',
    marginTop: 3,
  },

  watermark: {
    position: 'absolute',
    top: '38%',
    left: '10%',
    fontSize: 48,
    fontFamily: 'Helvetica-Bold',
    color: '#ff000018',
    transform: 'rotate(-30deg)',
  },

  headerRow: {
    flexDirection: 'row',
    border: '0.75pt solid #333',
    minHeight: 60,
  },
  headerLogo: {
    width: 55,
    borderRight: '0.5pt solid #333',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  headerEmit: {
    flex: 3,
    padding: '4 6',
    borderRight: '0.5pt solid #333',
    justifyContent: 'center',
  },
  headerDamdfe: {
    flex: 2,
    padding: 4,
    borderRight: '0.5pt solid #333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerQr: {
    width: 62,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#eee',
    borderBottom: '0.5pt solid #aaa',
    padding: '1.5 2',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.3pt solid #ddd',
    padding: '1.5 2',
  },
});

const LV = ({ label, value, style }: { label: string; value?: string; style?: any }) => (
  <View style={[s.box, style]}>
    <Text style={s.label}>{label}</Text>
    <Text style={s.value}>{value || '-'}</Text>
  </View>
);

export const DamdfeDocument = ({ data }: { data: DamdfeData }) => {
  const isHomolog = data.ambiente === 'homologacao';
  const chaveGrp = data.chaveAcesso.replace(/(\d{4})/g, '$1 ').trim();
  const ctes = data.chavesDocumentos.filter(k => k.substring(20, 22) === '57');
  const nfes = data.chavesDocumentos.filter(k => k.substring(20, 22) === '55');
  const allDocs = data.chavesDocumentos;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {isHomolog && <Text style={s.watermark}>SEM VALOR FISCAL</Text>}

        {/* ── CABEÇALHO ── */}
        <View style={s.headerRow}>
          {/* Logo */}
          <View style={s.headerLogo}>
            {data.emitente.logoUrl
              ? <Image src={data.emitente.logoUrl} style={{ maxWidth: 48, maxHeight: 48, objectFit: 'contain' }} />
              : <Text style={{ fontSize: 5, color: '#aaa', textAlign: 'center' }}>LOGO</Text>}
          </View>

          {/* Dados do emitente */}
          <View style={s.headerEmit}>
            <Text style={[s.valueLg, { marginBottom: 1 }]}>{data.emitente.razaoSocial}</Text>
            <Text style={{ fontSize: 6.5 }}>{data.emitente.endereco}</Text>
            <Text style={{ fontSize: 6.5 }}>{data.emitente.cidade} - {data.emitente.estado}</Text>
            <Text style={{ fontSize: 6.5 }}>CEP: {data.emitente.cep}{data.emitente.telefone ? `  Fone: ${data.emitente.telefone}` : ''}</Text>
            <Text style={{ fontSize: 6.5 }}>CNPJ: {data.emitente.cnpj}</Text>
            <Text style={{ fontSize: 6.5 }}>IE: {data.emitente.inscricaoEstadual}  RNTRC: {data.emitente.rntrc || '-'}</Text>
          </View>

          {/* DAMDFE Label */}
          <View style={s.headerDamdfe}>
            <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>DAMDFE</Text>
            <Text style={{ fontSize: 5.5, textAlign: 'center', marginBottom: 4, color: '#444' }}>
              Documento Auxiliar do Manifesto{'\n'}Eletrônico de Documentos Fiscais
            </Text>
            {!!data.barcodeSrc && (
              <Image src={data.barcodeSrc} style={{ width: '100%', height: 28, marginBottom: 2 }} />
            )}
            <Text style={[s.label, { textAlign: 'center' }]}>CHAVE DE ACESSO</Text>
            <Text style={{ fontSize: 5, fontFamily: 'Helvetica-Bold', textAlign: 'center', letterSpacing: 0.2 }}>
              {chaveGrp}
            </Text>
            <Text style={{ fontSize: 5, color: '#555', marginTop: 2, textAlign: 'center' }}>
              Consulta em https://dfe-portal.svrs.rs.gov.br/MDFE/Consulta
            </Text>
          </View>

          {/* QR Code */}
          <View style={s.headerQr}>
            {data.qrCodeSrc
              ? <Image src={data.qrCodeSrc} style={{ width: 55, height: 55 }} />
              : <Text style={{ fontSize: 5, color: '#aaa' }}>QR</Text>}
          </View>
        </View>

        {/* ── LINHA DE IDENTIFICAÇÃO ── */}
        <View style={[s.row, { marginTop: 0 }]}>
          <LV label="Modelo" value="58" style={[{ width: 36 }, s.noTop]} />
          <LV label="Série" value={data.serie} style={[{ width: 36 }, s.noTop, s.noLeft]} />
          <LV label="Número" value={data.numeroMdfe} style={[{ width: 70 }, s.noTop, s.noLeft]} />
          <LV label="FL" value={data.folha || '1/1'} style={[{ width: 30 }, s.noTop, s.noLeft]} />
          <LV label="Data e Hora de Emissão" value={data.dataEmissao} style={[s.flex1, s.noTop, s.noLeft]} />
          <LV label="UF Carreg." value={data.ufInicio} style={[{ width: 50 }, s.noTop, s.noLeft]} />
          <LV label="UF Descarreg." value={data.ufFim} style={[{ width: 60 }, s.noTop, s.noLeft]} />
          {data.ufPercurso && <LV label="UF Percurso" value={data.ufPercurso} style={[{ width: 60 }, s.noTop, s.noLeft]} />}
        </View>

        {/* ── MODAL RODOVIÁRIO + CONTROLE DO FISCO ── */}
        <View style={[s.row, { marginTop: 3 }]}>
          {/* Modal + Qtds */}
          <View style={{ flex: 1 }}>
            <Text style={[s.sectionTitle, { marginTop: 0 }]}>Modal Rodoviário de Carga</Text>
            <View style={s.row}>
              <LV label="Qtd. CT-e" value={String(data.qtdCte)} style={[{ width: 60 }]} />
              <LV label="Qtd. NF-e" value={String(data.qtdNfe)} style={[{ width: 60 }, s.noLeft]} />
              <LV label="Peso Total  KG" value={data.qCarga} style={[s.flex1, s.noLeft]} />
            </View>
          </View>

          {/* Controle do Fisco (barcode área) */}
          <View style={{ width: 200, marginLeft: 6 }}>
            <Text style={[s.sectionTitle, { marginTop: 0 }]}>Controle do Fisco</Text>
            <View style={[s.box, { minHeight: 30, alignItems: 'center', justifyContent: 'center' }]}>
              {data.barcodeSrc && (
                <Image src={data.barcodeSrc} style={{ width: '95%', height: 28 }} />
              )}
            </View>
          </View>
        </View>

        {/* ── PROTOCOLO + CHAVE ── */}
        <View style={[s.row, { marginTop: 3 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { marginBottom: 1 }]}>Protocolo de Autorização</Text>
            <Text style={s.value}>{data.protocolo || 'PENDENTE'}{data.dataAutorizacao ? ` - ${data.dataAutorizacao}` : ''}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.label, { marginBottom: 1 }]}>Chave de Acesso</Text>
            <Text style={{ fontSize: 6, fontFamily: 'Helvetica-Bold', letterSpacing: 0.3 }}>{chaveGrp}</Text>
          </View>
        </View>

        {/* ── VEÍCULOS + CONDUTOR ── */}
        <View style={[s.row, { marginTop: 4 }]}>
          {/* Veículos */}
          <View style={{ flex: 1, marginRight: 4 }}>
            <Text style={[s.sectionTitle, { marginTop: 0 }]}>Veículos</Text>
            <View style={s.row}>
              <View style={[s.box, { flex: 1 }]}>
                <Text style={s.label}>Placa</Text>
                <Text style={s.value}>{data.veiculoPlaca}</Text>
              </View>
              <View style={[s.box, s.noLeft, { width: 90 }]}>
                <Text style={s.label}>RNTC</Text>
                <Text style={s.value}>{data.veiculoRntrc || data.emitente.rntrc || '-'}</Text>
              </View>
            </View>
          </View>

          {/* Condutor */}
          <View style={{ flex: 1 }}>
            <Text style={[s.sectionTitle, { marginTop: 0 }]}>Condutor</Text>
            <View style={s.row}>
              <View style={[s.box, { width: 80 }]}>
                <Text style={s.label}>CPF</Text>
                <Text style={s.value}>{data.motoristaCpf || '-'}</Text>
              </View>
              <View style={[s.box, s.noLeft, { flex: 1 }]}>
                <Text style={s.label}>Nome</Text>
                <Text style={s.value}>{data.motoristaNome}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── VALE PEDÁGIO + CIOT ── */}
        <View style={[s.row, { marginTop: 3 }]}>
          <View style={{ flex: 1, marginRight: 4 }}>
            <Text style={[s.sectionTitle, { marginTop: 0 }]}>Vale Pedágio</Text>
            <View style={[s.row, { backgroundColor: '#f5f5f5' }]}>
              <View style={[s.box, { flex: 1 }]}><Text style={s.label}>Responsável CNPJ</Text><Text style={s.value}>-</Text></View>
              <View style={[s.box, s.noLeft, { flex: 1 }]}><Text style={s.label}>Fornecedor CNPJ</Text><Text style={s.value}>-</Text></View>
              <View style={[s.box, s.noLeft, { width: 70 }]}><Text style={s.label}>Nº Comprovante</Text><Text style={s.value}>-</Text></View>
              <View style={[s.box, s.noLeft, { width: 55 }]}><Text style={s.label}>Valor</Text><Text style={s.value}>-</Text></View>
            </View>
          </View>

          <View style={{ width: 170 }}>
            <Text style={[s.sectionTitle, { marginTop: 0 }]}>Informações do Ciot</Text>
            <View style={s.row}>
              <View style={[s.box, { width: 80 }]}><Text style={s.label}>CPF/CNPJ</Text><Text style={s.value}>{data.ciotCpfCnpj || '-'}</Text></View>
              <View style={[s.box, s.noLeft, { flex: 1 }]}><Text style={s.label}>CIOT</Text><Text style={s.value}>{data.ciot || '-'}</Text></View>
            </View>
          </View>
        </View>

        {/* ── DOCUMENTOS ── */}
        <Text style={[s.sectionTitle]}>Documentos</Text>
        <View style={[s.box, { minHeight: 50, flexDirection: 'row' }]}>
          {/* Coluna esquerda */}
          <View style={{ flex: 1, borderRight: '0.5pt solid #ccc', paddingRight: 4 }}>
            <View style={s.row}>
              <Text style={[s.label, { width: 20, fontFamily: 'Helvetica-Bold' }]}>Tipo</Text>
              <Text style={[s.label, { flex: 1, fontFamily: 'Helvetica-Bold' }]}>Chave</Text>
            </View>
            {allDocs.slice(0, Math.ceil(allDocs.length / 2)).map((chave, i) => {
              const tipo = chave.substring(20, 22) === '57' ? 'CTe' : 'NFe';
              return (
                <View key={i} style={[s.row, { marginBottom: 1 }]}>
                  <Text style={{ fontSize: 6, width: 20, fontFamily: 'Helvetica-Bold', color: '#333' }}>{tipo}</Text>
                  <Text style={{ fontSize: 5.5, flex: 1, letterSpacing: 0.2 }}>{chave}</Text>
                </View>
              );
            })}
          </View>
          {/* Coluna direita */}
          <View style={{ flex: 1, paddingLeft: 4 }}>
            <View style={s.row}>
              <Text style={[s.label, { width: 20, fontFamily: 'Helvetica-Bold' }]}>Tipo</Text>
              <Text style={[s.label, { flex: 1, fontFamily: 'Helvetica-Bold' }]}>Chave</Text>
            </View>
            {allDocs.slice(Math.ceil(allDocs.length / 2)).map((chave, i) => {
              const tipo = chave.substring(20, 22) === '57' ? 'CTe' : 'NFe';
              return (
                <View key={i} style={[s.row, { marginBottom: 1 }]}>
                  <Text style={{ fontSize: 6, width: 20, fontFamily: 'Helvetica-Bold', color: '#333' }}>{tipo}</Text>
                  <Text style={{ fontSize: 5.5, flex: 1, letterSpacing: 0.2 }}>{chave}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── OBSERVAÇÕES ── */}
        <Text style={s.sectionTitle}>Observações</Text>
        <View style={[s.box, { minHeight: 22 }]}>
          <Text style={{ fontSize: 6.5, color: '#555' }}>
            {data.observacoes || (isHomolog ? 'DOCUMENTO EMITIDO EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL' : `Total de Notas Fiscais: ${data.qtdNfe}`)}
          </Text>
        </View>

        {/* ── SEGURO ── */}
        {(data.seguradora || data.apolice) && (
          <View style={{ marginTop: 4 }}>
            {data.seguradora && <Text style={{ fontSize: 6, color: '#555' }}>Seguradora: {data.seguradora}</Text>}
            {data.apolice && <Text style={{ fontSize: 6, color: '#555' }}>Apólice: {data.apolice}</Text>}
            {data.averbacao && <Text style={{ fontSize: 6, color: '#555' }}>Averbação: {data.averbacao}</Text>}
          </View>
        )}

        {/* ── RODAPÉ ── */}
        <Text style={{ position: 'absolute', bottom: 10, left: 14, right: 14, fontSize: 5.5, color: '#aaa', textAlign: 'center', borderTop: '0.5pt solid #ddd', paddingTop: 2 }}>
          Emitido por DezLog — Sistema de Gestão para Transportadoras
        </Text>
      </Page>
    </Document>
  );
};
