
import type { DeclarationData } from '@/app/(app)/documents/declaration/page';
import type { CompanyProfile } from '@/lib/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DeclarationDocumentProps {
  data: DeclarationData;
  companyProfile: CompanyProfile | null;
}

export function DeclarationDocument({ data, companyProfile }: DeclarationDocumentProps) {
  
  const logoUrl = companyProfile?.logoUrl || "https://uploads.onecompiler.io/43rqwtabp/43s3ube24/logo_DezLog_transparente.png";
  const companyName = companyProfile?.razaoSocial || "Dezlog Transportes e Logistica LTDA";
  const companyAddress = companyProfile?.endereco || "R. Indiaporã, 22 - Guarulhos, SP";
  const companyCnpj = companyProfile?.cnpj || "48.532.554/0001-66";

  const InfoItem = ({ label, value }: { label: string; value?: string | null }) => (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold text-gray-800">{value || 'N/A'}</p>
    </div>
  );

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
      
      <h1 className="text-2xl font-bold text-center mb-6">DECLARAÇÃO DE TRANSPORTE</h1>

      <p className="text-base leading-relaxed mb-6 text-justify">
        Declaramos para os devidos fins que a empresa <strong>{companyName.toUpperCase()}</strong>, 
        inscrita no CNPJ sob o nº <strong>{companyCnpj}</strong>, está transportando o(s) produto(s) 
        descrito(s) abaixo, de propriedade do remetente para o destinatário, conforme dados que seguem:
      </p>

      {/* Details Sections */}
      <div className="space-y-6">
        <div className="border-t pt-4">
          <h2 className="font-bold text-primary mb-3">DADOS DO REMETENTE E DESTINATÁRIO</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <InfoItem label="REMETENTE" value={data.remetente} />
            <InfoItem label="CNPJ/CPF (Remetente)" value={data.remetenteCnpj} />
            <InfoItem label="DESTINATÁRIO" value={data.destinatario} />
            <InfoItem label="CNPJ/CPF (Destinatário)" value={data.destinatarioCnpj} />
          </div>
        </div>
        
        <div className="border-t pt-4">
           <h2 className="font-bold text-primary mb-3">DADOS DA MERCADORIA</h2>
           <div className="text-sm space-y-4">
             <InfoItem label="PRODUTO(S) TRANSPORTADO(S)" value={data.produto} />
             <div className="grid grid-cols-2 gap-x-8">
               <InfoItem label="Nº NF (SE HOUVER)" value={data.nfNumero} />
               <InfoItem label="VALOR DA MERCADORIA" value={data.valor} />
             </div>
           </div>
        </div>

        <div className="border-t pt-4">
          <h2 className="font-bold text-primary mb-3">DADOS DO TRANSPORTE</h2>
          <div className="grid grid-cols-3 gap-x-8 text-sm">
            <InfoItem label="VEÍCULO/PLACA" value={data.veiculoPlaca} />
            <InfoItem label="MOTORISTA" value={data.motorista} />
            <InfoItem label="CPF (Motorista)" value={data.motoristaCpf} />
          </div>
        </div>
      </div>


      <p className="text-center text-sm my-12">
        {companyProfile?.cidade || 'Guarulhos'}, {format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.
      </p>

      <div className="mt-24 flex justify-center">
        <div className="text-center">
          <div className="w-96 border-t border-gray-400 pt-2">
            <p className="text-sm font-semibold">{companyName.toUpperCase()}</p>
            <p className="text-xs text-gray-500">Assinatura</p>
          </div>
        </div>
      </div>
    </div>
  );
}
