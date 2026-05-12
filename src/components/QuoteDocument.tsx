

"use client"

import type { Quote, CompanyProfile, PricingSettings } from '@/lib/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function QuoteDocument({ quote, companyProfile, pricingSettings }: { quote: Quote, companyProfile: CompanyProfile | null, pricingSettings: PricingSettings | null }) {
  const getQuoteCode = (q: Quote) => {
    if (q.quoteCode) return q.quoteCode;
    const date = new Date(q.data);
    return `LEGACY-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
  }

  const formatCurrency = (value?: number): string => {
      return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const logoUrl = companyProfile?.logoUrl || "https://uploads.onecompiler.io/43rqwtabp/43s3ube24/logo_DezLog_transparente.png";
  const companyName = companyProfile?.razaoSocial || "Dezlog Transportes e Logistica LTDA";
  const companyAddress = companyProfile?.endereco || "R. Indiaporã, 22 - Guarulhos, SP";
  const companyCnpj = companyProfile?.cnpj || "48.532.554/0001-66";
  const companyContact = [companyProfile?.telefone, companyProfile?.email, companyProfile?.website].filter(Boolean).join(' | ') || 'www.dezlog.com.br';

  // Recalculates the components based on the stored totalFrete and acrescimoRegional rate
  const subtotal = (quote.totalFrete || 0) / (1 + (quote.acrescimoRegional || 0));
  const acrescimoRegionalValor = (quote.totalFrete || 0) - subtotal;
  const fretePeso = subtotal - (quote.adicional || 0) - (quote.adicionalProduto || 0) - (quote.taxaDificuldade || 0);

  return (
    <div style={{
        fontFamily: "'Poppins', sans-serif",
        backgroundColor: '#ffffff',
        color: '#1a202c',
        fontSize: '11px',
        lineHeight: '1.4',
        margin: 0,
    }}>
        <div className="container" id="proposta" style={{ width: '100%', margin: 'auto', display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 2rem)' }}>
            <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                <img src={logoUrl} alt={`Logo ${companyName}`} className="logo" style={{ maxWidth: '120px' }} />
                <div className="company-info" style={{ textAlign: 'right', fontSize: '0.7rem' }}>
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 600 }}>{companyName}</h2>
                    <p>{companyAddress}</p>
                    <p>CNPJ: {companyCnpj}</p>
                    <p>Contato: {companyContact}</p>
                </div>
            </header>

            <main style={{ flexGrow: 1 }}>
                <div className="text-center mb-6" style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <h1 className="text-2xl font-bold text-primary" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0369a1' }}>
                      {quote.freightMode === 'armazenagem' ? 'Proposta Comercial de Armazenagem' : 'Proposta Comercial de Transporte'}
                    </h1>
                    <p className="text-slate-500" style={{ color: '#64748b', fontSize: '0.8rem' }}>N° {getQuoteCode(quote)} &bull; Data: {format(new Date(quote.data), 'dd/MM/yyyy', { locale: ptBR })}</p>
                </div>

                {quote.freightMode === 'armazenagem' ? (
                  // ── STORAGE QUOTE LAYOUT ──────────────────────────────────────
                  <>
                    <div className="grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
                      <div className="section" style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.75rem', backgroundColor: '#f0f4ff', marginBottom: '0.75rem' }}>
                        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#4338ca', marginBottom: '0.5rem', borderBottom: '1px solid #c7d2fe', paddingBottom: '0.5rem' }}>Dados do Cliente</h2>
                        <div style={{ display: 'grid', gap: '0.2rem', fontSize: '0.75rem' }}>
                          <dl style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Tomador do Serviço:</dt><dd style={{ fontWeight: 500, textAlign: 'right' }}>{quote.tomador}</dd></dl>
                          <dl style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Responsável:</dt><dd style={{ fontWeight: 500, textAlign: 'right' }}>{quote.responsavelSolicitante || 'N/A'}</dd></dl>
                          <dl style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}><dt style={{ color: '#4a5568' }}>Usuário Responsável:</dt><dd style={{ fontWeight: 500, textAlign: 'right' }}>{quote.usuario}</dd></dl>
                        </div>
                      </div>
                      <div className="section" style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.75rem', backgroundColor: '#f0f4ff', marginBottom: '0.75rem' }}>
                        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#4338ca', marginBottom: '0.5rem', borderBottom: '1px solid #c7d2fe', paddingBottom: '0.5rem' }}>Local e Período</h2>
                        <div style={{ display: 'grid', gap: '0.2rem', fontSize: '0.75rem' }}>
                          <dl style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Local de Armazenagem:</dt><dd style={{ fontWeight: 500, textAlign: 'right' }}>Armazém DezLog</dd></dl>
                          <dl style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Período Previsto:</dt><dd style={{ fontWeight: 500, textAlign: 'right' }}>{quote.prazoEntrega || 30} dias</dd></dl>
                          <dl style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}><dt style={{ color: '#4a5568' }}>Data de Emissão:</dt><dd style={{ fontWeight: 500, textAlign: 'right' }}>{format(new Date(quote.data), 'dd/MM/yyyy', { locale: ptBR })}</dd></dl>
                        </div>
                      </div>
                    </div>

                    <div className="section" style={{ border: '1px solid #c7d2fe', borderRadius: '0.5rem', padding: '0.75rem', backgroundColor: '#f0f4ff', marginBottom: '0.75rem' }}>
                      <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#4338ca', marginBottom: '0.5rem', borderBottom: '1px solid #c7d2fe', paddingBottom: '0.5rem' }}>Composição dos Serviços de Armazenagem</h2>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0 3rem', fontSize: '0.75rem' }}>
                        {(quote.quantidade || 0) > 0 && (
                          <dl style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}>
                            <dt style={{ color: '#4a5568' }}>Posições (Paletes): {quote.quantidade} un.</dt>
                            <dd style={{ fontWeight: 500, textAlign: 'right' }}>—</dd>
                          </dl>
                        )}
                        {(quote.peso || 0) > 0 && (
                          <dl style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}>
                            <dt style={{ color: '#4a5568' }}>Peso Total:</dt>
                            <dd style={{ fontWeight: 500, textAlign: 'right' }}>{quote.peso} kg</dd>
                          </dl>
                        )}
                        {(quote.cubagem || 0) > 0 && (
                          <dl style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}>
                            <dt style={{ color: '#4a5568' }}>Cubagem:</dt>
                            <dd style={{ fontWeight: 500, textAlign: 'right' }}>{(quote.cubagem || 0).toFixed(3)} m³</dd>
                          </dl>
                        )}
                        <dl style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}>
                          <dt style={{ color: '#4a5568' }}>Período de Armazenagem:</dt>
                          <dd style={{ fontWeight: 500, textAlign: 'right' }}>{quote.prazoEntrega || 30} dias</dd>
                        </dl>
                        <dl style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', gridColumn: '1 / -1', borderBottom: '1px solid #e2e8f0' }}>
                          <dt style={{ color: '#4a5568' }}>Valor Base do Serviço:</dt>
                          <dd style={{ fontWeight: 500, textAlign: 'right' }}>{formatCurrency(quote.totalFrete)}</dd>
                        </dl>
                        {(quote.desconto || 0) > 0 && (
                          <dl style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', gridColumn: '1 / -1', borderBottom: '1px solid #e2e8f0' }}>
                            <dt style={{ color: '#4a5568' }}>Desconto Aplicado:</dt>
                            <dd style={{ fontWeight: 500, textAlign: 'right', color: '#16a34a' }}>- {formatCurrency(quote.desconto)}</dd>
                          </dl>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  // ── FREIGHT QUOTE LAYOUT ──────────────────────────────────────
                  <>
                    <div className="grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
                      <div className="section" style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.75rem', backgroundColor: '#f8fafc', marginBottom: '0.75rem' }}>
                        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0369a1', marginBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Dados da Operação</h2>
                        <div className="info-grid" style={{ display: 'grid', gap: '0.2rem', fontSize: '0.75rem' }}>
                          <dl className="info-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Tomador do Serviço:</dt> <dd style={{ fontWeight: 500, textAlign: 'right' }}>{quote.tomador}</dd></dl>
                          <dl className="info-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Remetente (Origem):</dt> <dd style={{ fontWeight: 500, textAlign: 'right' }}>{quote.remetente} - {quote.cidadeOrigem}</dd></dl>
                          <dl className="info-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Destinatário (Destino):</dt> <dd style={{ fontWeight: 500, textAlign: 'right' }}>{quote.empresaDestino || quote.destinatario} - {quote.cidadeDestino}</dd></dl>
                          <dl className="info-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}><dt style={{ color: '#4a5568' }}>Responsável Solicitante:</dt> <dd style={{ fontWeight: 500, textAlign: 'right' }}>{quote.responsavelSolicitante || 'N/A'}</dd></dl>
                        </div>
                      </div>
                      <div className="section" style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.75rem', backgroundColor: '#f8fafc', marginBottom: '0.75rem' }}>
                        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0369a1', marginBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Detalhes da Carga</h2>
                        <div className="info-grid" style={{ display: 'grid', gap: '0.2rem', fontSize: '0.75rem' }}>
                          <dl className="info-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Veículo Dedicado:</dt> <dd style={{ fontWeight: 500, textAlign: 'right' }}>{quote.veiculo}</dd></dl>
                          <dl className="info-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Prazo de Entrega:</dt> <dd style={{ fontWeight: 500, textAlign: 'right' }}>{quote.prazoEntrega} dias</dd></dl>
                          <dl className="info-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Distância:</dt> <dd style={{ fontWeight: 500, textAlign: 'right' }}>{(quote.kmIda || 0).toFixed(0)} km</dd></dl>
                          <dl className="info-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Valor da Mercadoria:</dt> <dd style={{ fontWeight: 500, textAlign: 'right' }}>{formatCurrency(quote.valorProduto)}</dd></dl>
                          <dl className="info-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Volumes:</dt> <dd style={{ fontWeight: 500, textAlign: 'right' }}>{quote.quantidade || 'N/A'}</dd></dl>
                          <dl className="info-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}><dt style={{ color: '#4a5568' }}>Peso:</dt> <dd style={{ fontWeight: 500, textAlign: 'right' }}>{quote.peso || 'N/A'} kg</dd></dl>
                        </div>
                      </div>
                    </div>

                    <div className="section" style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.75rem', backgroundColor: '#f8fafc', marginBottom: '0.75rem' }}>
                      <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0369a1', marginBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Composição do Frete</h2>
                      <div className="grid-cols-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0 3rem', fontSize: '0.75rem' }}>
                        <dl className="info-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Frete Peso:</dt> <dd style={{ fontWeight: 500, textAlign: 'right' }}>{formatCurrency(fretePeso)}</dd></dl>
                        <dl className="info-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Km Excedente ({(quote.kmExcedente || 0).toFixed(0)} km):</dt> <dd style={{ fontWeight: 500, textAlign: 'right' }}>{formatCurrency(quote.adicional)}</dd></dl>
                        <dl className="info-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Taxas (GRIS/Advalorem - {((pricingSettings?.operational?.grisAdvaloremRate || 0) * 100).toFixed(2)}%):</dt> <dd style={{ fontWeight: 500, textAlign: 'right' }}>{formatCurrency(quote.adicionalProduto)}</dd></dl>
                        <dl className="info-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Acréscimo Regional ({quote.regiao} - {((quote.acrescimoRegional || 0) * 100).toFixed(0)}%):</dt> <dd style={{ fontWeight: 500, textAlign: 'right' }}>{formatCurrency(acrescimoRegionalValor)}</dd></dl>
                        {(quote.taxaDificuldade || 0) > 0 && <dl className="info-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #e2e8f0' }}><dt style={{ color: '#4a5568' }}>Taxa de Dificuldade:</dt> <dd style={{ fontWeight: 500, textAlign: 'right' }}>{formatCurrency(quote.taxaDificuldade)}</dd></dl>}
                        <dl className="info-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}><dt style={{ color: '#4a5568' }}>ICMS ({(quote.icmsAliquota || 0).toFixed(2)}%):</dt> <dd style={{ fontWeight: 500, textAlign: 'right' }}>{formatCurrency(quote.icmsValor)}</dd></dl>
                      </div>
                    </div>
                  </>
                )}

                <div className="total-section" style={{ marginTop: '0.75rem', backgroundColor: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: '0.5rem', padding: '1rem' }}>
                    <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-lg font-semibold" style={{ fontSize: '1rem', fontWeight: 600 }}>Valor Total da Proposta:</span>
                        <span className="total-item" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0369a1' }}>{formatCurrency((quote.valorFinal || 0) + (quote.icmsValor || 0))}</span>
                    </div>
                     {(quote.desconto || 0) > 0 && (
                        <p className="text-right text-sm text-slate-600 mt-1" style={{ textAlign: 'right', fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem' }}>Desconto aplicado: {formatCurrency(quote.desconto)}</p>
                     )}
                </div>

                <div className="section" style={{ border: '1px solid #e2e8f0', borderRadius: '0.5rem', padding: '0.75rem', backgroundColor: '#f8fafc', marginBottom: '0.75rem', marginTop: '0.75rem' }}>
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0369a1', marginBottom: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>Observações</h2>
                    <p className="text-sm" style={{ fontSize: '0.75rem' }}>{quote.obs || 'Nenhuma observação.'}</p>
                </div>
            </main>

            <footer style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '0.65rem', color: '#4a5568' }}>
                <div className="flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="text-left" style={{ textAlign: 'left' }}>
                        <p className="font-semibold" style={{ fontWeight: 600 }}>Responsável pela Cotação:</p>
                        <p>{quote.usuario} | Contato: {companyProfile?.telefone || 'N/A'}</p>
                    </div>
                    <div className="text-right" style={{ textAlign: 'right' }}>
                        <p className="font-semibold" style={{ fontWeight: 600 }}>Condições Gerais:</p>
                        <p>Validade da proposta: 15 dias. Sujeito a alterações após o período.</p>
                    </div>
                </div>
                <div className="text-center mt-4 text-xs text-slate-400" style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.65rem', color: '#94a3b8' }}>
                    <p>Proposta gerada em {format(new Date(quote.data), 'dd/MM/yyyy')} por DezLog Sistema de Fretes &copy; {new Date().getFullYear()}</p>
                </div>
            </footer>
        </div>
    </div>
  );
}
