
import type { Driver, CompanyProfile } from '@/lib/types';
import type { CollectionOrderData } from '@/app/(app)/documents/collection-order/page';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CollectionOrderDocumentProps {
  data: CollectionOrderData;
  driver: Driver;
  companyProfile: CompanyProfile | null;
}

export function CollectionOrderDocument({ data, driver, companyProfile }: CollectionOrderDocumentProps) {
  
  const InfoItem = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold text-gray-800">{value || 'N/A'}</p>
    </div>
  );

  const logoUrl = companyProfile?.logoUrl || "https://uploads.onecompiler.io/43rqwtabp/43s3ube24/logo_DezLog_transparente.png";
  const companyName = companyProfile?.razaoSocial || "Dezlog Transportes e Logistica LTDA";
  const companyAddress = companyProfile?.endereco || "R. Indiaporã, 22 - Guarulhos, SP";
  const companyCnpj = companyProfile?.cnpj || "48.532.554/0001-66";


  return (
    <div className="bg-white font-sans text-gray-800">
      {/* Header */}
      <div className="flex justify-between items-start pb-4 border-b-2 border-gray-200 mb-8">
        <div className="w-1/2">
           <img 
              src={logoUrl} 
              alt={`Logo ${companyName}`}
              className="max-h-[60px] w-auto"
            />
        </div>
        <div className="text-right w-1/2 text-xs text-gray-500">
          <p className="font-bold text-base text-gray-700">{companyName}</p>
          <p>{companyAddress}</p>
          <p>CNPJ: {companyCnpj}</p>
        </div>
      </div>
      
      <h1 className="text-2xl font-bold text-center mb-4">
        ORDEM DE COLETA{data.quoteCode ? ` — ${data.quoteCode}` : ''}
      </h1>
      <p className="text-center text-sm mb-6 text-gray-500">
        Data: {format(new Date(), "dd/MM/yyyy")} {data.quoteCode ? `| Cotação Nº: ${data.quoteCode}` : ''}
      </p>


      {/* Details Sections */}
      <div className="space-y-6">
        <div className="border rounded-lg p-4">
          <h2 className="font-bold text-primary mb-3">DADOS DO MOTORISTA</h2>
          <div className="grid grid-cols-3 gap-x-8 gap-y-4 text-sm">
            <InfoItem label="MOTORISTA" value={driver.name} />
            <InfoItem label="CPF" value={driver.cpf} />
            <InfoItem label="PLACA" value={driver.licensePlate} />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
                <h2 className="font-bold text-primary mb-3">DADOS DE COLETA (REMETENTE)</h2>
                <div className="text-sm space-y-2">
                    <InfoItem label="EMPRESA" value={data.collectFrom} />
                    <InfoItem label="ENDEREÇO" value={data.collectAddress} />
                </div>
            </div>
             <div className="border rounded-lg p-4">
                <h2 className="font-bold text-primary mb-3">DADOS DE ENTREGA (DESTINATÁRIO)</h2>
                 <div className="text-sm space-y-2">
                    <InfoItem label="EMPRESA" value={data.deliverTo} />
                    <InfoItem label="ENDEREÇO" value={data.deliverAddress} />
                </div>
            </div>
        </div>

        <div className="border rounded-lg p-4">
           <h2 className="font-bold text-primary mb-3">DADOS DA CARGA</h2>
           <div className="grid grid-cols-3 gap-x-8 text-sm">
             <InfoItem label="Nº NOTA FISCAL" value={data.nfNumber} />
             <InfoItem label="QUANTIDADE DE VOLUMES" value={data.volumes} />
             <InfoItem label="PESO" value={data.weight} />
           </div>
        </div>
         <div className="border rounded-lg p-4">
            <h2 className="font-bold text-primary mb-2">OBSERVAÇÕES</h2>
            <p className="text-sm text-gray-600">{data.observations || 'Nenhuma observação fornecida.'}</p>
        </div>
      </div>


      <p className="text-center text-sm my-12">
        {companyProfile?.cidade || 'Guarulhos'}, {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.
      </p>

      <div className="mt-24 flex justify-around">
        <div className="text-center">
          <div className="w-80 border-t border-gray-400 pt-2">
            <p className="text-sm font-semibold">{data.requester || '__________________________'}</p>
            <p className="text-xs text-gray-500">Solicitante</p>
          </div>
        </div>
        <div className="text-center">
          <div className="w-80 border-t border-gray-400 pt-2">
            <p className="text-sm font-semibold">{driver.name}</p>
            <p className="text-xs text-gray-500">Motorista</p>
          </div>
        </div>
      </div>
    </div>
  );
}
