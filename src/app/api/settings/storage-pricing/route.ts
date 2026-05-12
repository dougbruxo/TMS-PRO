import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';
import { StoragePricingSettings } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    
    let settings = await db.collection('storage_pricing_settings').findOne({});
    
    if (!settings) {
      settings = {
        pricePerPosition: 100,
        weightPricePerKg: 10,
        cbmPrice: 50,
        unloadingRate: 15,
        pickingRate: 5,
        packingRate: 3,
        updatedAt: new Date().toISOString()
      };
      await db.collection('storage_pricing_settings').insertOne(settings);
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Failed to fetch storage pricing settings:', error);
    return NextResponse.json(
      { message: 'Erro ao buscar configurações', error: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const data: StoragePricingSettings = await request.json();

    const { db } = await connectToDatabase();

    const updateDoc = {
      pricePerPosition: Number(data.pricePerPosition),
      weightPricePerKg: Number(data.weightPricePerKg),
      cbmPrice: Number(data.cbmPrice),
      unloadingRate: Number(data.unloadingRate),
      pickingRate: Number(data.pickingRate || 0),
      packingRate: Number(data.packingRate || 0),
      updatedAt: new Date().toISOString()
    };

    const existing = await db.collection('storage_pricing_settings').findOne({});
    
    if (existing) {
      await db.collection('storage_pricing_settings').updateOne(
        { _id: existing._id },
        { $set: updateDoc }
      );
    } else {
      await db.collection('storage_pricing_settings').insertOne(updateDoc);
    }

    return NextResponse.json({ message: 'Configurações atualizadas com sucesso' });
  } catch (error) {
    console.error('Failed to update storage pricing settings:', error);
    return NextResponse.json(
      { message: 'Erro ao salvar configurações', error: String(error) },
      { status: 500 }
    );
  }
}
