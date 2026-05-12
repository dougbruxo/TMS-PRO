import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function POST(request: Request) {
  try {
    const { driverId, latitude, longitude } = await request.json();

    if (!driverId || !latitude || !longitude) {
      return NextResponse.json({ message: 'Dados de localização incompletos.' }, { status: 400 });
    }
    if (!ObjectId.isValid(driverId)) {
      return NextResponse.json({ message: 'ID do motorista inválido.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const result = await db.collection('drivers').updateOne(
      { _id: new ObjectId(driverId) },
      {
        $set: {
          lastKnownLocation: {
            type: 'Point',
            coordinates: [longitude, latitude], // GeoJSON standard: [longitude, latitude]
          },
          lastLocationUpdate: new Date().toISOString(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: 'Motorista não encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Localização atualizada.' });
  } catch (error: any) {
    console.error('API Location Update Error:', error);
    return NextResponse.json({ message: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}
