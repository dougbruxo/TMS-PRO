

import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { InvoiceDocument } from '@/components/InvoiceDocument';
import type { Quote, CompanyProfile, Invoice, PricingSettings } from '@/lib/types';
import QRCode from 'qrcode';
import { PrintManager } from '@/components/PrintManager';
import type { Metadata, ResolvingMetadata } from 'next';
import { initialPricingSettings } from '@/lib/data';

// Corrected Type as per Next.js 16 standards for async pages
type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};


export async function generateMetadata(
  { params }: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params; // Correctly awaiting the promise

  if (!ObjectId.isValid(id)) {
    return {
      title: 'Documento Inválido',
    }
  }
  
  const { db } = await connectToDatabase();

  let item: Quote | Invoice | null = null;
  let isInvoice = false;

  const invoiceData = await db.collection('invoices').findOne({ _id: new ObjectId(id) });
  if (invoiceData) {
    item = JSON.parse(JSON.stringify(invoiceData));
    isInvoice = true;
  } else {
    const quoteData = await db.collection('quotes').findOne({ _id: new ObjectId(id) });
    if (quoteData) {
        item = JSON.parse(JSON.stringify(quoteData));
    }
  }

  if (!item) {
    return {
      title: 'Documento não encontrado',
    }
  }

  const code = isInvoice ? (item as Invoice).invoiceCode : (item as Quote).quoteCode || `LEGACY-${id.slice(0,5)}`;
  const tomador = (item as any).tomador || 'Cliente';
  
  const title = `${tomador} - Fatura ${code}`;

  return {
    title: title,
  }
}

// Helper functions remain the same
const formatValue = (value: number): string => {
  const formatted = value.toFixed(2);
  return formatted.length > 99 ? '' : formatted;
};

const formatField = (id: string, value: string): string => {
  const length = value.length.toString().padStart(2, '0');
  return `${id}${length}${value}`;
};

const crc16 = (payload: string): string => {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return ('0000' + (crc & 0xFFFF).toString(16).toUpperCase()).slice(-4);
};

const generatePixBrcode = (pixKey: string, beneficiaryName: string, city: string, amount: number, txid: string = '***'): string => {
    const payloadFormatIndicator = formatField('00', '01');
    const merchantAccountInfo = formatField('26', 
      formatField('00', 'br.gov.bcb.pix') +
      formatField('01', pixKey)
    );
    const merchantCategoryCode = formatField('52', '0000');
    const transactionCurrency = formatField('53', '986');
    const transactionAmount = formatField('54', formatValue(amount));
    const countryCode = formatField('58', 'BR');
    const beneficiaryNameFormatted = formatField('59', beneficiaryName.substring(0, 25));
    const cityFormatted = formatField('60', city.substring(0, 15));
    const additionalData = formatField('62', formatField('05', txid));
    
    let payload = `${payloadFormatIndicator}${merchantAccountInfo}${merchantCategoryCode}${transactionCurrency}${transactionAmount}${countryCode}${beneficiaryNameFormatted}${cityFormatted}${additionalData}`;
    payload += '6304';
    
    return payload + crc16(payload);
}


export default async function UnifiedInvoicePage({ params, searchParams }: PageProps) {
  const { id } = await params; // Correctly awaiting the promise
  const resolvedSearchParams = await searchParams; // Correctly awaiting the promise
  const amountType = resolvedSearchParams?.amountType;

  if (!ObjectId.isValid(id)) {
    return <div>ID inválido.</div>;
  }

  const { db } = await connectToDatabase();

  let itemToPrint: Quote | Invoice | null = null;
  let groupedQuotes: Quote[] = [];
  let isGroupedInvoice = false;

  const invoiceData = await db.collection('invoices').findOne({ _id: new ObjectId(id) });
  
  if (invoiceData) {
    itemToPrint = JSON.parse(JSON.stringify(invoiceData));
    isGroupedInvoice = true;
    if ((itemToPrint as Invoice).quoteIds && (itemToPrint as Invoice).quoteIds.length > 0) {
      const childQuoteObjectIds = (itemToPrint as Invoice).quoteIds.map((childId: string) => new ObjectId(childId));
      const childQuotesData = await db.collection('quotes').find({ _id: { $in: childQuoteObjectIds } }).toArray();
      groupedQuotes = JSON.parse(JSON.stringify(childQuotesData));
    }
  } else {
    const quoteData = await db.collection('quotes').findOne({ _id: new ObjectId(id) });
    if (quoteData) {
        itemToPrint = JSON.parse(JSON.stringify(quoteData));
    }
  }

  if (!itemToPrint) {
    return <div>Documento de cobrança não encontrado.</div>;
  }

  const companyProfileData = await db.collection('company_profiles').findOne({ isDefault: true });
  if (!companyProfileData) {
    return <div>Perfil da empresa padrão não configurado.</div>;
  }
  const companyProfile: CompanyProfile = JSON.parse(JSON.stringify(companyProfileData));
  
  // Look up the client (tomador) CNPJ from the customers collection
  let tomadorCnpj = '';
  try {
    let tomadorId = (itemToPrint as any).tomadorId;
    
    // Fallback for grouped invoices if id is missing on the invoice itself
    if (!tomadorId && isGroupedInvoice && groupedQuotes.length > 0) {
      tomadorId = (groupedQuotes[0] as any).tomadorId;
    }

    const formatCnpjCpf = (raw: string): string => {
      if (raw.length === 14) return raw.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
      if (raw.length === 11) return raw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      return raw;
    };

    if (tomadorId && ObjectId.isValid(tomadorId)) {
      // 1. Try customers collection first
      const customer = await db.collection('customers').findOne({ _id: new ObjectId(tomadorId) });
      if (customer?.cnpj) {
        tomadorCnpj = formatCnpjCpf(customer.cnpj.replace(/\D/g, ''));
      } else {
        // 2. Fallback: try client_companies collection
        const clientCompany = await db.collection('client_companies').findOne({ _id: new ObjectId(tomadorId) });
        if (clientCompany?.cnpj) {
          tomadorCnpj = formatCnpjCpf(clientCompany.cnpj.replace(/\D/g, ''));
        }
      }
    }
    
    // 3. Fallback: search by name (tomador) if ID is missing/invalid or CNPJ still not found
    if (!tomadorCnpj) {
      const tomadorName = (itemToPrint as any).tomador;
      if (tomadorName) {
        const nameRegex = new RegExp(`^${tomadorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        
        // Search in customers
        const customerByName = await db.collection('customers').findOne({ 
          $or: [
            { razaoSocial: { $regex: nameRegex } },
            { nomeFantasia: { $regex: nameRegex } }
          ]
        });
        
        if (customerByName?.cnpj) {
          tomadorCnpj = formatCnpjCpf(customerByName.cnpj.replace(/\D/g, ''));
        } else {
          // Search in client_companies
          const companyByName = await db.collection('client_companies').findOne({
            $or: [
              { razaoSocial: { $regex: nameRegex } },
              { nomeFantasia: { $regex: nameRegex } }
            ]
          });
          if (companyByName?.cnpj) {
            tomadorCnpj = formatCnpjCpf(companyByName.cnpj.replace(/\D/g, ''));
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch tomador CNPJ:', e);
  }

  let totalValue: number;
  let finalQuoteForDocument: Quote;

  if (isGroupedInvoice) {
    const invoice = itemToPrint as Invoice;
    let originalTotalValue = invoice.totalValue;
    if (amountType === 'partial' && invoice.status === 'Parcial' && invoice.paidAmount) {
        totalValue = originalTotalValue - (invoice.desconto || 0) - invoice.paidAmount;
    } else {
        totalValue = originalTotalValue - (invoice.desconto || 0);
    }
    finalQuoteForDocument = {
        ...invoice,
        totalFrete: originalTotalValue, // Renomeado para uso no documento
        valorFinal: totalValue,
        desconto: invoice.desconto || 0,
        isGrouped: true,
        data: invoice.createdAt,
        quoteCode: invoice.invoiceCode,
    } as unknown as Quote;
  } else {
    const quote = itemToPrint as Quote;
    totalValue = (quote.valorFinal || 0) + (quote.icmsValor || 0);
    if (amountType === 'partial' && quote.paymentStatus === 'Parcial' && quote.paidAmount) {
        totalValue -= quote.paidAmount;
    }
    finalQuoteForDocument = { ...quote, valorFinal: totalValue };
  }
  
  let pixQrCodeDataUrl = '';
  if (companyProfile.pixKey) {
      const txid = isGroupedInvoice ? (itemToPrint as Invoice).invoiceCode : (itemToPrint as Quote).quoteCode || 'DEZLOG';
      const brcode = generatePixBrcode(companyProfile.pixKey, companyProfile.razaoSocial, companyProfile.cidade, totalValue, txid);
      pixQrCodeDataUrl = await QRCode.toDataURL(brcode);
  }

  return (
    <>
      <div className="printable-area">
        <InvoiceDocument 
            quote={finalQuoteForDocument} 
            companyProfile={companyProfile} 
            pixQrCodeDataUrl={pixQrCodeDataUrl}
            pixBrcode={""}
            groupedQuotes={groupedQuotes}
            isPartial={amountType === 'partial'}
            tomadorCnpj={tomadorCnpj}
        />
      </div>
      <div className="no-print p-8 text-center">
        <p>A preparar a fatura para impressão...</p>
        <p className="text-sm text-muted-foreground">Se a janela de impressão não abrir automaticamente, por favor, use a função de impressão do seu navegador (Ctrl/Cmd + P).</p>
      </div>
      <PrintManager />
    </>
  );
}


