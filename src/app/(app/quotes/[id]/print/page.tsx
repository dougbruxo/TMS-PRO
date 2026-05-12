
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import QuoteDocument from '@/components/QuoteDocument';
import type { Quote, CompanyProfile, PricingSettings } from '@/lib/types';
import { PrintManager } from '@/components/PrintManager';
import { initialPricingSettings } from '@/lib/data';

export default async function PrintQuotePage({ params }: { params: { id: string } }) {
  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return <div>ID da cotação inválido.</div>;
  }

  const { db } = await connectToDatabase();
  const quoteData = await db.collection('quotes').findOne({ _id: new ObjectId(id) });
  if (!quoteData) {
    return <div>Cotação não encontrada.</div>;
  }

  // Manually convert ObjectId to string for client-side consumption
  const quote: Quote = {
    ...JSON.parse(JSON.stringify(quoteData)),
    id: quoteData._id.toHexString(),
  };

  const companyProfileData = await db.collection('company_profiles').findOne({ isDefault: true });
  if (!companyProfileData) {
    return <div>Perfil da empresa padrão não configurado.</div>;
  }

  // Manually convert ObjectId to string
  const companyProfile: CompanyProfile = {
      ...JSON.parse(JSON.stringify(companyProfileData)),
      id: companyProfileData._id.toHexString(),
  };
  
  let pricingSettings = await db.collection('settings').findOne({ _id: 'pricing' }) as PricingSettings | null;
  if (!pricingSettings) {
      // Fallback to initial settings if not found in DB
      pricingSettings = initialPricingSettings;
  }

  return (
    <>
      <div className="printable-area">
        <QuoteDocument quote={quote} companyProfile={companyProfile} pricingSettings={pricingSettings} />
      </div>
      <div className="no-print p-8 text-center">
        <p>A preparar a proposta para impressão...</p>
        <p className="text-sm text-muted-foreground">Se a janela de impressão não abrir automaticamente, por favor, use a função de impressão do seu navegador (Ctrl/Cmd + P).</p>
      </div>
      <PrintManager />
    </>
  );
}
