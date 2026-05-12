
import type { Payslip, CompanyProfile } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BonusReportProps {
  payslip: Payslip;
  companyProfile: CompanyProfile | null;
}

export function BonusReport({ payslip, companyProfile }: BonusReportProps) {
  const formatCurrency = (value: number) => (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (!payslip.bonus?.eligibleQuotes || payslip.bonus.eligibleQuotes.length === 0) {
    return null;
  }

  const companyName = companyProfile?.razaoSocial || "Dezlog Transportes e Logistica LTDA";
  const companyAddress = companyProfile?.endereco || "R. Indiaporã, 22 - Guarulhos, SP";
  const companyCnpj = companyProfile?.cnpj || "48.532.554/0001-66";

  const totalBonus = payslip.items.find(i => i.code === '02')?.earnings || 0;

  return (
    <div className="bg-white font-sans text-xs p-8 min-h-[29.7cm] flex flex-col">
      <div className="flex justify-between items-start pb-2 border-b-2 border-gray-500 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{companyName}</h1>
          <p className="text-xs text-gray-500">{companyAddress} | CNPJ: {companyCnpj}</p>
        </div>
        <div className="text-right">
          <h2 className="text-lg font-bold text-blue-700">Relatório de Bônus sobre Vendas</h2>
          <p className="text-sm text-gray-500 font-medium">Holerite Ref: {payslip.referenceMonth}</p>
        </div>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">Identificação do Talento</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Nome</p>
            <p className="text-sm font-bold">{payslip.talentName}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-500 uppercase">CPF</p>
            <p className="text-sm font-bold">{payslip.talentData.cpf}</p>
          </div>
        </div>
      </div>

      <div className="flex-grow">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 ml-1">Detalhamento das Cotações Apuradas</h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 uppercase text-[10px] tracking-wider font-semibold text-gray-600">
              <th className="border p-2 text-left">Data</th>
              <th className="border p-2 text-left">Cotação</th>
              <th className="border p-2 text-left">Cliente</th>
              <th className="border p-2 text-right">Valor Faturamento</th>
              <th className="border p-2 text-right">Comissão (R$)</th>
            </tr>
          </thead>
          <tbody>
            {payslip.bonus.eligibleQuotes.map((quote) => (
              <tr key={quote.id} className="hover:bg-gray-50 transition-colors">
                <td className="border p-2">{format(parseISO(quote.date), 'dd/MM/yyyy')}</td>
                <td className="border p-2 font-medium">{quote.code}</td>
                <td className="border p-2 truncate max-w-[200px]">{quote.clientName}</td>
                <td className="border p-2 text-right text-gray-600">{formatCurrency(quote.billingValue)}</td>
                <td className="border p-2 text-right font-bold text-gray-800">{formatCurrency(quote.bonusValue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50 font-bold">
              <td colSpan={4} className="border p-3 text-right text-sm uppercase text-blue-800">Total de Comissão Gerado</td>
              <td className="border p-3 text-right text-sm text-blue-900">{formatCurrency(totalBonus)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-12 pt-8 border-t border-gray-200">
        <div className="flex justify-between items-end">
          <div className="text-[10px] text-gray-500 italic max-w-sm">
            Este relatório é um anexo oficial ao Recibo de Pagamento (Holerite) ref {payslip.referenceMonth} e detalha exclusivamente as bonificações descritas sob o código 02.
          </div>
          <div className="text-right">
              <p className="text-[10px] text-gray-400">Gerado automaticamente em {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
