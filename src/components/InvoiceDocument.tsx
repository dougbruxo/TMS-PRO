import type { Quote, CompanyProfile, Invoice } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InvoiceDocumentProps {
  quote: Quote;
  companyProfile: CompanyProfile | null;
  pixQrCodeDataUrl: string;
  pixBrcode: string;
  groupedQuotes?: Quote[];
  isPartial?: boolean;
  tomadorCnpj?: string;
}

export function InvoiceDocument({
  quote,
  companyProfile,
  pixQrCodeDataUrl,
  pixBrcode,
  groupedQuotes = [],
  isPartial = false,
  tomadorCnpj = ''
}: InvoiceDocumentProps) {

  const totalAPagar = quote.valorFinal;
  const valorDoFrete = quote.isGrouped ? (quote as any).totalFrete : (quote.valorFinal || 0) - (quote.icmsValor || 0) + (quote.desconto || 0);

  const InfoItem = ({
    label,
    value
  }: {
    label: string;
    value?: string | number | null;
  }) => (
    <div>
      <p className="text-xs text-gray-500 uppercase">{label}</p>
      <p className="font-semibold text-gray-800">{value || 'N/A'}</p>
    </div>
  );

  const formatCurrency = (value: number) =>
    (value || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

  const getTitle = () => {
    if (isPartial) {
      return "FATURA (SALDO PENDENTE)";
    }
    return "FATURA";
  };

  const hasDiscount = (quote.desconto || 0) > 0;
  const subtotal = valorDoFrete - (quote.desconto || 0);

  return (
    <div className="bg-white font-sans text-gray-800 text-sm">
      <div className="invoice-page">
        {/* HEADER */}
        <header className="flex justify-between items-start pb-4 border-b-2 border-gray-300 mb-6">
          <div className="w-2/3">
            <img
              src={companyProfile?.logoUrl}
              alt={`Logo ${companyProfile?.razaoSocial}`}
              className="max-h-16 w-auto mb-2"
            />
            <p className="font-bold text-lg">{companyProfile?.razaoSocial}</p>
            <p className="text-xs text-gray-500">{companyProfile?.endereco}</p>
            <p className="text-xs text-gray-500">
              CNPJ: {companyProfile?.cnpj}
            </p>
          </div>

          <div className="text-right w-1/3">
            <h1 className="text-2xl font-bold">{getTitle()}</h1>
            <p className="font-semibold">Nº: {quote.quoteCode}</p>
            <p>Data de Emissão: {format(new Date(), 'dd/MM/yyyy')}</p>
            {quote.billingDueDate && (
              <p>
                Vencimento:{' '}
                {format(parseISO(quote.billingDueDate), 'dd/MM/yyyy')}
              </p>
            )}
          </div>
        </header>

        {/* CLIENTE */}
        <section className="mb-6 border rounded-lg p-4 bg-gray-50">
          <h2 className="font-bold text-base mb-2">CLIENTE (TOMADOR)</h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="Tomador do Serviço" value={quote.tomador} />
            {tomadorCnpj && <InfoItem label="CNPJ / CPF" value={tomadorCnpj} />}
          </div>
        </section>

        {/* DETALHES DO SERVIÇO */}
        <section className="mb-6">
          <h2 className="font-bold text-base mb-2">
            DETALHES DO SERVIÇO DE TRANSPORTE
          </h2>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2">Descrição</th>
                  <th className="p-2 text-right">Valor</th>
                </tr>
              </thead>

              <tbody>
                <tr className="border-b">
                  <td className="p-2">
                    {quote.isGrouped ? (
                      <p>
                        Frete referente ao agrupamento de {groupedQuotes.length}{' '}
                        cotações.
                      </p>
                    ) : (
                      <>
                        <p>
                          Frete referente à Cotação Nº {quote.quoteCode}
                        </p>
                        <p className="text-xs text-gray-500">
                          De: {quote.cidadeOrigem} Para:{' '}
                          {quote.cidadeDestino}
                        </p>
                      </>
                    )}
                  </td>
                  <td className="p-2 text-right">
                    {formatCurrency(valorDoFrete)}
                  </td>
                </tr>

                {hasDiscount && (
                    <tr className="border-b">
                        <td className="p-2">Desconto Aplicado</td>
                        <td className="p-2 text-right text-red-600">-{formatCurrency(quote.desconto || 0)}</td>
                    </tr>
                )}

                 {(!quote.isGrouped && (quote.icmsValor || 0) > 0) && (
                    <tr className="border-b">
                        <td className="p-2">ICMS ({quote.icmsAliquota || 0}%)</td>
                        <td className="p-2 text-right">{formatCurrency(quote.icmsValor || 0)}</td>
                    </tr>
                )}

              </tbody>

              <tfoot className="font-bold">
                <tr>
                  <td className="p-2 text-right">TOTAL A PAGAR:</td>
                  <td className="p-2 text-right text-lg">
                    {formatCurrency(totalAPagar)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* PAGAMENTO */}
        <section className="border rounded-lg p-4">
          <h2 className="font-bold text-base mb-3">
            INFORMAÇÕES DE PAGAMENTO
          </h2>

          <div className="flex items-start gap-6">
            {/* TRANSFERÊNCIA (lado esquerdo) */}
            {companyProfile?.banco && (
              <div className="flex-1">
                <p className="font-semibold">
                  Transferência Bancária (TED/DOC)
                </p>

                <div className="mt-2 text-xs space-y-1">
                  <p>
                    <strong>Banco:</strong> {companyProfile.banco}
                  </p>
                  <p>
                    <strong>Agência:</strong> {companyProfile.agencia}
                  </p>
                  <p>
                    <strong>Conta {companyProfile.tipoConta}:</strong>{' '}
                    {companyProfile.conta}
                  </p>
                  <p>
                    <strong>Favorecido:</strong>{' '}
                    {companyProfile.razaoSocial}
                  </p>
                  <p>
                    <strong>CNPJ:</strong> {companyProfile.cnpj}
                  </p>
                </div>
              </div>
            )}

            {/* QR CODE PIX (lado direito) */}
            {companyProfile?.pixKey && pixQrCodeDataUrl ? (
              <div className="flex flex-col items-center flex-shrink-0">
                <p className="font-semibold text-sm mb-1">PAGAMENTO VIA PIX</p>
                <img
                  src={pixQrCodeDataUrl}
                  alt="PIX QR Code"
                  className="w-32 h-32"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  Aponte a câmera para o QR Code
                </p>
              </div>
            ) : !companyProfile?.pixKey ? (
              <div className="flex flex-col items-center justify-center flex-shrink-0 text-center p-3 bg-red-50 rounded-md">
                <p className="text-red-600 font-bold text-xs">
                  PIX não configurado
                </p>
                <p className="text-[10px]">
                  Cadastre a chave PIX no perfil da empresa.
                </p>
              </div>
            ) : null}
          </div>

          {/* PIX COPIA E COLA (rodapé do container, largura total) */}
          {companyProfile?.pixKey && pixBrcode && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 font-semibold">
                PIX Copia e Cola:
              </p>
              <p className="text-[10px] break-all bg-gray-50 p-2 border rounded-md mt-1 font-mono">
                {pixBrcode}
              </p>
            </div>
          )}
        </section>

        {/* FOOTER */}
        <footer className="mt-12 text-center text-xs text-gray-500">
          <p>
            Em caso de dúvidas, entre em contato:{' '}
            {companyProfile?.email || companyProfile?.telefone}
          </p>
          <p>
            {companyProfile?.razaoSocial} | CNPJ:{' '}
            {companyProfile?.cnpj}
          </p>
        </footer>
      </div>

      {/* EXTRATO DE COTAÇÕES */}
      {groupedQuotes.length > 0 && (
        <div style={{ pageBreakBefore: 'always' }}>
          <header className="flex justify-between items-start pb-4 border-b-2 border-gray-300 mb-6">
            <div className="w-2/3">
              <img
                src={companyProfile?.logoUrl}
                alt={`Logo ${companyProfile?.razaoSocial}`}
                className="max-h-16 w-auto mb-2"
              />
            </div>

            <div className="text-right w-1/3">
              <h1 className="text-xl font-bold">
                EXTRATO DE COTAÇÕES
              </h1>
              <p className="font-semibold">
                Fatura Nº: {quote.quoteCode}
              </p>
              <p>Página de Detalhes</p>
            </div>
          </header>

          <section className="mb-6">
            <h2 className="font-bold text-base mb-2">
              COTAÇÕES AGRUPADAS NESTA FATURA
            </h2>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2">Cotação</th>
                    <th className="p-2">Data</th>
                    <th className="p-2">Origem</th>
                    <th className="p-2">Destino</th>
                    <th className="p-2 text-right">Valor</th>
                  </tr>
                </thead>

                <tbody>
                  {groupedQuotes.map((q, index) => (
                    <tr key={q.id || index} className="border-b">
                      <td className="p-2">{q.quoteCode}</td>
                      <td className="p-2">
                        {format(parseISO(q.data), 'dd/MM/yyyy')}
                      </td>
                      <td className="p-2">{q.cidadeOrigem}</td>
                      <td className="p-2">{q.cidadeDestino}</td>
                      <td className="p-2 text-right">
                        {formatCurrency(
                          (q.valorFinal || 0) + (q.icmsValor || 0)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
