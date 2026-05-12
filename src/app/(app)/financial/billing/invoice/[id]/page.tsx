
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

  const code = isInvoice ? (item as Invoice).invoiceCode : (item as Quote).quoteCode || `LEGACY-${id.slice(0, 5)}`;
  const tomador = (item as any).tomador || 'Cliente';

  const title = `${tomador} - Fatura ${code}`;

  return {
    title: title,
  }
}

// Helper functions remain the same
const formatField = (id: string, value: string): string => {
  return id + String(value.length).padStart(2, '0') + value;
};

const crc16 = (payload: string): string => {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
};

const sanitizePixText = (text: string): string => {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .substring(0, 25);
};

const sanitizeTxid = (text: string): string => {
  return text.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***';
};

const generatePixBrcode = (pixKey: string, beneficiaryName: string, city: string, amount: number, txid: string = '***'): string => {
  // Clear any accidental whitespaces from the PIX key
  const cleanPixKey = (pixKey || '').replace(/\s/g, '');

  // Payload Format Indicator + Point of Initiation Method (11 = one-time)
  let payload = '000201010211';

  // Merchant Account Information (ID 26)
  let accountInfo =
    formatField('00', 'br.gov.bcb.pix') +
    formatField('01', cleanPixKey);
  payload += formatField('26', accountInfo);

  // Merchant Category Code
  payload += '52040000';
  // Transaction Currency (986 = BRL)
  payload += '5303986';
  // Transaction Amount
  payload += formatField('54', amount.toFixed(2));
  // Country Code
  payload += '5802BR';
  // Merchant Name (sanitized)
  payload += formatField('59', sanitizePixText(beneficiaryName));
  // Merchant City (sanitized)
  payload += formatField('60', sanitizePixText(city));
  // Additional Data (TXID)
  payload += formatField('62', formatField('05', sanitizeTxid(txid)));
  // CRC16 placeholder
  payload += '6304';
  // Calculate and append CRC16
  payload += crc16(payload);

  return payload;
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

    if (tomadorId && ObjectId.isValid(tomadorId)) {
      const customer = await db.collection('customers').findOne({ _id: new ObjectId(tomadorId) });
      if (customer?.cnpj) {
        const raw = customer.cnpj.replace(/\D/g, '');
        tomadorCnpj = raw.length === 14
          ? raw.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
          : raw.length === 11
            ? raw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
            : customer.cnpj;
      }
    } else {
      // Fallback: search by name (tomador) if ID is missing or invalid
      const tomadorName = (itemToPrint as any).tomador;
      if (tomadorName) {
        const customerByName = await db.collection('customers').findOne({ 
          $or: [
            { razaoSocial: { $regex: new RegExp(`^${tomadorName}$`, 'i') } },
            { nomeFantasia: { $regex: new RegExp(`^${tomadorName}$`, 'i') } }
          ]
        });
        
        if (customerByName?.cnpj) {
          const raw = customerByName.cnpj.replace(/\D/g, '');
          tomadorCnpj = raw.length === 14
            ? raw.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
            : raw.length === 11
              ? raw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
              : customerByName.cnpj;
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
    totalValue = invoice.totalValue;
    if (amountType === 'partial' && invoice.status === 'Parcial' && invoice.paidAmount) {
      totalValue -= invoice.paidAmount;
    }
    // Create a "fake" quote for the document component
    finalQuoteForDocument = {
      ...invoice,
      valorFinal: totalValue,
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
  let pixBrcode = '';
  if (companyProfile.pixKey) {
    const txid = isGroupedInvoice ? (itemToPrint as Invoice).invoiceCode : (itemToPrint as Quote).quoteCode || 'DEZLOG';
    pixBrcode = generatePixBrcode(companyProfile.pixKey, companyProfile.razaoSocial, companyProfile.cidade, totalValue, txid);
    pixQrCodeDataUrl = await QRCode.toDataURL(pixBrcode);
  }

  return (
    <>
      <div className="printable-area">
        <InvoiceDocument
          quote={finalQuoteForDocument}
          companyProfile={companyProfile}
          pixQrCodeDataUrl={pixQrCodeDataUrl}
          pixBrcode={pixBrcode}
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

