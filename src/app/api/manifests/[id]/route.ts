
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Quote } from '@/lib/types';

// PUT para atualizar um romaneio (por exemplo, fechar ou alterar motorista)
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    const updates = await request.json();
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de romaneio inválido" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    delete updates._id;

    // Se o motorista está a ser alterado, atualiza os dados do motorista no romaneio
    if (updates.driverId) {
        if (!ObjectId.isValid(updates.driverId)) {
            return NextResponse.json({ message: "ID de motorista inválido." }, { status: 400 });
        }
        const newDriver = await db.collection('drivers').findOne({ _id: new ObjectId(updates.driverId) });
        if (!newDriver) {
            return NextResponse.json({ message: "Novo motorista não encontrado." }, { status: 404 });
        }
        updates.driverName = newDriver.name;
        updates.driverLicensePlate = newDriver.licensePlate || 'N/A';
    }

    // Se estiver a fechar, define a data
    if (updates.status === 'Finalizado' && !updates.closedAt) {
      updates.closedAt = new Date().toISOString();
    }
    
    // Se o status está a mudar para 'Em Rota', atualiza as cotações
    if (updates.status === 'Em Rota') {
        const manifest = await db.collection('manifests').findOne({ _id: new ObjectId(id) });
        if (manifest) {
            const quoteIds = manifest.quotes.map((q: any) => new ObjectId(q.quoteId));
            
            // Define a previsão de entrega para cada cotação
            const quotesToUpdate = await db.collection<Quote>('quotes').find({ _id: { $in: quoteIds } }).toArray();

            for (const quote of quotesToUpdate) {
                const forecastDate = new Date();
                forecastDate.setDate(forecastDate.getDate() + quote.prazoEntrega);
                
                await db.collection('quotes').updateOne(
                    { _id: quote._id },
                    { $set: { status: 'Em Rota', deliveryForecast: forecastDate.toISOString() } }
                );
            }
        }
    }

    const result = await db.collection('manifests').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Romaneio não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ message: "Romaneio atualizado com sucesso" }, { status: 200 });
  } catch (error: any) {
    console.error('API Manifest PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar romaneio: ${error.message}` }, { status: 500 });
  }
}

// DELETE para apagar um romaneio
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de romaneio inválido" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const manifestToDelete = await db.collection('manifests').findOne({ _id: new ObjectId(id) });

    if (!manifestToDelete) {
        return NextResponse.json({ message: "Romaneio não encontrado" }, { status: 404 });
    }
    
    // Reverter o status das cotações para "No Galpão"
    const quoteIds = manifestToDelete.quotes.map((q: any) => new ObjectId(q.quoteId));
     await db.collection('quotes').updateMany(
        { _id: { $in: quoteIds } },
        { $set: { status: 'No Galpão' } }
    );

    const result = await db.collection('manifests').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Romaneio não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ message: "Romaneio apagado e cotações revertidas com sucesso." }, { status: 200 });
  } catch (error: any) {
    console.error('API Manifest DELETE Error:', error);
    return NextResponse.json({ message: `Erro ao apagar romaneio: ${error.message}` }, { status: 500 });
  }
}
