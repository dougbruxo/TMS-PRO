
import type { Payslip as PayslipType, CompanyProfile } from '@/lib/types';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PayslipProps {
  payslip: PayslipType;
  companyProfile: CompanyProfile | null;
  isCompanyCopy?: boolean;
}

export function Payslip({ payslip, companyProfile, isCompanyCopy = false }: PayslipProps) {

  const referenceDate = parse(payslip.referenceMonth, 'yyyy-MM', new Date());
  const formatCurrency = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const companyName = companyProfile?.razaoSocial || "Dezlog Transportes e Logistica LTDA";
  const companyAddress = companyProfile?.endereco || "R. Indiaporã, 22 - Guarulhos, SP";
  const companyCnpj = companyProfile?.cnpj || "48.532.554/0001-66";

  const InfoRow = ({ label, value, fullWidth = false }: { label: string; value: string | number; fullWidth?: boolean }) => (
    <div className={`flex justify-between py-1 border-b ${fullWidth ? 'col-span-2' : ''}`}>
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );

  return (
    <div className={`bg-white font-sans text-xs ${!isCompanyCopy ? 'border-r-2 border-dashed border-gray-400' : ''}`}>
        
      <div className="text-right mb-2">
        <p className="text-xs font-semibold">{isCompanyCopy ? 'Via Empresa' : 'Via Funcionário'}</p>
        <p className="text-xs">ID: {payslip.id}</p>
      </div>

      <div className="flex justify-between items-start pb-2 border-b-2 border-gray-500 mb-2">
        <div>
          <h1 className="text-lg font-bold text-gray-800">{companyName}</h1>
          <p className="text-xs text-gray-500">{companyAddress} | CNPJ: {companyCnpj}</p>
        </div>
        <div className="text-right">
          <h2 className="text-base font-semibold text-gray-700">Recibo de Pagamento - {payslip.type}</h2>
          <p className="text-xs text-gray-500">Ref: <span className="font-medium">{format(referenceDate, 'MM/yyyy', { locale: ptBR })}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 mb-2">
        <InfoRow label="Nome do Funcionário" value={payslip.talentData.fullName} fullWidth />
        <InfoRow label="CPF" value={payslip.talentData.cpf} />
        <InfoRow label="Cargo" value={payslip.talentData.jobTitle} />
        <InfoRow label="Data de Admissão" value={format(new Date(payslip.talentData.hireDate), 'dd/MM/yyyy')} />
      </div>

      <table className="w-full text-xs border-collapse mb-2">
        <thead className="bg-gray-100">
            <tr>
                <th className="border p-1 text-left font-semibold">Cód.</th>
                <th className="border p-1 text-left font-semibold">Descrição</th>
                <th className="border p-1 text-center font-semibold">Ref.</th>
                <th className="border p-1 text-right font-semibold">Proventos (R$)</th>
                <th className="border p-1 text-right font-semibold">Descontos (R$)</th>
            </tr>
        </thead>
        <tbody>
            {payslip.items.map(item => (
                <tr key={item.id}>
                    <td className="border p-1 text-center">{item.code}</td>
                    <td className="border p-1">{item.description}</td>
                    <td className="border p-1 text-center">{item.reference} {item.factor}</td>
                    <td className="border p-1 text-right">{item.earnings > 0 ? formatCurrency(item.earnings) : ''}</td>
                    <td className="border p-1 text-right">{item.deductions > 0 ? formatCurrency(item.deductions) : ''}</td>
                </tr>
            ))}
        </tbody>
      </table>

      <div className="mt-2 pt-2 border-t grid grid-cols-3 gap-2">
        <div>
          <p className="text-[10px] text-gray-500">Total Vencimentos</p>
          <p className="font-semibold text-sm">{formatCurrency(payslip.totalEarnings)}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-500">Total Descontos</p>
          <p className="font-semibold text-sm">{formatCurrency(payslip.totalDeductions)}</p>
        </div>
        <div className="bg-gray-100 p-1 rounded">
          <p className="text-[10px] font-bold">Valor Líquido</p>
          <p className="font-bold text-base">{formatCurrency(payslip.netSalary)}</p>
        </div>
      </div>

      <div className="mt-8">
        <p className="text-center text-[10px]">Recebi o valor líquido descrito neste recibo, dando plena quitação do seu pagamento.</p>
        <div className="mt-8 text-center">
            <div className="w-60 border-t border-gray-400 pt-1 mx-auto">
                <p className="text-xs font-medium">{payslip.talentData.fullName}</p>
                <p className="text-[10px] text-gray-500">Assinatura do Funcionário</p>
            </div>
        </div>
      </div>
    </div>
  );
}
