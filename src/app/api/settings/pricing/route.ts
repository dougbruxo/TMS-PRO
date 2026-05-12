
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { initialPricingSettings } from '@/lib/data';
import type { PricingSettings } from '@/lib/types';

export const dynamic = 'force-dynamic';

// GET current pricing settings
export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    const settings = await db.collection('settings').findOne({ _id: 'pricing' });

    if (!settings) {
      // If no settings exist, return the initial ones without writing to the database.
      // The POST endpoint is responsible for creating/updating the settings document.
      return NextResponse.json(initialPricingSettings);
    }
    
    // Remove o _id do objeto retornado
    const { _id, ...settingsData } = settings;
    return NextResponse.json(settingsData);

  } catch (error: any) {
    console.error('API Pricing GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar configurações de preço: ${''}${error.message}` }, { status: 500 });
  }
}

// POST to update pricing settings
export async function POST(request: Request) {
    try {
      const updates: Partial<PricingSettings> = await request.json();
      
      const { db } = await connectToDatabase();

      const result = await db.collection('settings').updateOne(
        { _id: 'pricing' },
        { $set: updates },
        { upsert: true }
      );
      
      return NextResponse.json({ message: "Configurações de preço atualizadas com sucesso.", success: true });

    } catch (error: any) {
        console.error('API Pricing POST Error:', error);
        return NextResponse.json({ message: `Erro ao atualizar configurações de preço: ${''}${error.message}` }, { status: 500 });
    }
}
