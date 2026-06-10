
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Manifest, OperationalEvent } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    const manifests = await db.collection('manifests').find({}).sort({ createdAt: -1 }).toArray();

    const manifestsWithId = manifests.map(manifest => {
      const { _id, ...rest } = manifest;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(manifestsWithId);
  } catch (error: any) {
    console.error('API Manifests GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar romaneios: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { driverId, quoteIds, consultationNumber, payments } = await request.json();
    const { db } = await connectToDatabase();

    if (!driverId || !quoteIds || quoteIds.length === 0 || !consultationNumber || !payments) {
      return NextResponse.json({ message: 'Motorista, cotações, número da consulta e pagamentos são obrigatórios.' }, { status: 400 });
    }

    const driver = await db.collection('drivers').findOne({ _id: new ObjectId(driverId) });
    if (!driver) {
      return NextResponse.json({ message: 'Motorista não encontrado.' }, { status: 404 });
    }

    const quotes = await db.collection('quotes').find({ _id: { $in: quoteIds.map((id: string) => new ObjectId(id)) } }).toArray();

    if (quotes.length !== quoteIds.length) {
      return NextResponse.json({ message: 'Uma ou mais cotações não foram encontradas.' }, { status: 404 });
    }

    const counterResult = await db.collection<any>('counters').findOneAndUpdate(
      { _id: 'manifestSequence' },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    let sequentialNumber = counterResult?.value?.seq || counterResult?.seq;

    // Fast-forward counter if it's the first time and there are existing manifests
    if (sequentialNumber === 1) {
      const totalManifests = await db.collection('manifests').countDocuments();
      if (totalManifests > 0) {
        sequentialNumber = totalManifests + 1;
        await db.collection<any>('counters').updateOne({ _id: 'manifestSequence' }, { $set: { seq: sequentialNumber } });
      }
    }

    const manifestCode = `ROM${new Date().getFullYear()}${sequentialNumber.toString().padStart(5, '0')}`;

    const newManifest: Omit<Manifest, 'id'> = {
      manifestCode,
      driverId: driver._id.toHexString(),
      driverName: driver.name,
      driverLicensePlate: driver.licensePlate || 'N/A',
      consultationNumber,
      createdAt: new Date().toISOString(),
      closedAt: null,
      status: 'Pendente',
      quotes: quotes.map(q => ({
        quoteId: q._id.toHexString(),
        quoteCode: q.quoteCode || '',
        destinatario: q.destinatario || q.empresaDestino,
        cidadeDestino: q.cidadeDestino,
        enderecoEntrega: q.enderecoEntrega || '',
        nfNumber: q.nfNumber || 'N/A',
        nfeKey: '',
        totalVolumes: q.volumeCount || 0,
        scannedVolumes: 0,
        scannedBarcodes: [],
        driverPaymentAmount: payments[q._id.toHexString()] || 0,
      })),
    };

    const result = await db.collection('manifests').insertOne(newManifest as any);

    // Update status and add operational history for each quote
    for (const quote of quotes) {
      const paymentValue = payments[quote._id.toHexString()];
      const operationalEvent: OperationalEvent = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userId: 'SYSTEM', // This action is systemic
        username: 'SISTEMA',
        status: 'Em Carregamento',
        action: 'ETAPA_OPERACIONAL',
        details: `Adicionado ao romaneio ${manifestCode}. Valor a pagar ao motorista: ${paymentValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        expense: paymentValue,
        driverId: driver._id.toHexString(),
        driverName: driver.name,
        driverPaymentStatus: 'pendente',
        consultationNumber: consultationNumber,
      };

      const totalExpense = (quote.totalExpense || 0) + paymentValue;

      await db.collection<any>('quotes').updateOne(
        { _id: quote._id },
        {
          $set: { status: 'Em Carregamento', totalExpense },
          $push: { operationalHistory: operationalEvent }
        }
      );

      // Create expense for driver payment
      const expense = {
        monthYear: new Date().toISOString().slice(0, 7),
        description: `Pagamento Motorista - ${driver.name} | Cotação ${quote.quoteCode}`,
        categoryId: 'DRIVER_PAYMENT',
        categoryName: 'Motorista',
        value: paymentValue,
        dueDate: new Date().toISOString(),
        status: 'pendente',
        isRecurring: false,
        createdBy: 'SYSTEM', // Or a user ID if available from request context
        createdAt: new Date().toISOString(),
        quoteId: quote._id.toHexString(),
        driverId: driver._id.toHexString(),
        driverName: driver.name,
        operationalEventId: operationalEvent.id,
        history: [{
          timestamp: new Date().toISOString(),
          user: 'SISTEMA',
          action: 'Criação Automática',
          details: `Despesa criada automaticamente para o romaneio ${manifestCode}.`
        }]
      };
      await db.collection('expenses').insertOne(expense as any);
    }

    return NextResponse.json({ id: result.insertedId.toHexString(), ...newManifest }, { status: 201 });

  } catch (error: any) {
    console.error('API Manifests POST Error:', error);
    return NextResponse.json({ message: `Erro ao criar romaneio: ${error.message}` }, { status: 500 });
  }
}

