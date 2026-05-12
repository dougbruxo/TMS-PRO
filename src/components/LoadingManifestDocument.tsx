
import type { Manifest, CompanyProfile } from '@/lib/types';
import { format } from 'date-fns';

interface LoadingManifestDocumentProps {
  manifest: Manifest;
  companyProfile: CompanyProfile | null;
}

export function LoadingManifestDocument({ manifest, companyProfile }: LoadingManifestDocumentProps) {

  const logoUrl = companyProfile?.logoUrl || "https://uploads.onecompiler.io/43rqwtabp/43s3ube24/logo_DezLog_transparente.png";
  const companyName = companyProfile?.razaoSocial || "Dezlog Transportes e Logistica LTDA";
  const companyCnpj = companyProfile?.cnpj || "48.532.554/0001-66";

  const InfoRow = ({ label, value }: { label: string; value: string | undefined }) => (
    <div className="flex justify-between py-2 border-b border-gray-200">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-right text-gray-800">{value || 'N/A'}</span>
    </div>
  );

  const totalPayment = manifest.quotes.reduce((acc, q) => acc + (q.driverPaymentAmount || 0), 0);

  return (
    <div className="bg-white font-sans text-gray-800">
      <div className="flex justify-between items-start pb-4 border-b-2 border-gray-200 mb-6">
        <div className="w-1/2">
           <img 
              src={logoUrl}
              alt={`Logo ${companyName}`}
              className="max-h-[60px] w-auto"
            />
            <p className="text-xs text-gray-400 mt-2">{companyName} <br/> CNPJ: {companyCnpj}</p>
        </div>
        <div className="text-right w-1/2">
          <h2 className="text-2xl font-bold text-gray-800">Romaneio de Carregamento</h2>
          <p className="text-sm text-gray-500">Nº: <span className="font-medium">{manifest.manifestCode}</span></p>
          <p className="text-sm text-gray-500">Data de Emissão: <span className="font-medium">{format(new Date(manifest.createdAt), 'dd/MM/yyyy')}</span></p>
        </div>
      </div>

      <div className="mb-6 p-4 border rounded-lg bg-gray-50">
        <h3 className="text-lg font-semibold mb-2 text-primary">Dados do Transporte</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
            <InfoRow label="Motorista" value={manifest.driverName} />
            <InfoRow label="Placa do Veículo" value={manifest.driverLicensePlate} />
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2 text-primary">Entregas</h3>
        <table className="w-full text-left text-sm border-collapse">
            <thead>
                <tr className="border-b-2 border-gray-300">
                    <th className="p-2">Destinatário</th>
                    <th className="p-2">Cidade</th>
                    <th className="p-2">Nº NF</th>
                    <th className="p-2 text-center">Volumes</th>
                    <th className="p-2 text-right">Valor a Pagar</th>
                </tr>
            </thead>
            <tbody>
                {manifest.quotes.map(quote => (
                    <tr key={quote.quoteId} className="border-b border-gray-200">
                        <td className="p-2 font-medium">{quote.destinatario}</td>
                        <td className="p-2">{quote.cidadeDestino}</td>
                        <td className="p-2">{quote.nfNumber}</td>
                        <td className="p-2 text-center">{quote.totalVolumes}</td>
                        <td className="p-2 text-right font-semibold">{(quote.driverPaymentAmount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="font-bold border-t-2 border-gray-300">
                <td colSpan={4} className="p-2 text-right">Total a Pagar ao Motorista:</td>
                <td className="p-2 text-right text-base">{totalPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              </tr>
            </tfoot>
        </table>
      </div>

      <div className="mt-12 text-sm text-gray-600">
        <p>Confirmo que recebi as mercadorias listadas acima para transporte, nas quantidades descritas. Responsabilizo-me pela sua integridade até a entrega final no destino.</p>
      </div>

      <div className="mt-20 flex justify-between">
        <div className="text-center">
          <div className="w-64 border-t border-gray-400 pt-2">
            <p className="text-sm font-medium">Conferente</p>
            <p className="text-xs text-gray-500">Assinatura</p>
          </div>
        </div>
        <div className="text-center">
          <div className="w-64 border-t border-gray-400 pt-2">
            <p className="text-sm font-medium">{manifest.driverName}</p>
            <p className="text-xs text-gray-500">Assinatura do Motorista</p>
          </div>
        </div>
      </div>
    </div>
  );
}
