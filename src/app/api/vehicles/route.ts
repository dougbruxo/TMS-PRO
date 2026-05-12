
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { Vehicle } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    const vehicles = await db.collection('vehicles').find({}).toArray();
    
    const vehiclesWithId = vehicles.map(vehicle => {
      const { _id, ...rest } = vehicle;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(vehiclesWithId);
  } catch (error: any) {
     console.error('API Vehicles GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar veículos: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const vehicleData: Omit<Vehicle, 'id'> = await request.json();
    const { db } = await connectToDatabase();
    
    // Validação
    if (!vehicleData.key || !vehicleData.name) {
      return NextResponse.json({ message: "Chave e nome são obrigatórios." }, { status: 400 });
    }

    const existingVehicle = await db.collection('vehicles').findOne({ key: vehicleData.key });
    if(existingVehicle) {
      return NextResponse.json({ message: "Já existe um veículo com esta chave." }, { status: 409 });
    }

    if (vehicleData.axles !== undefined) {
      vehicleData.axles = parseInt(vehicleData.axles as any) || 0;
    }

    const result = await db.collection('vehicles').insertOne(vehicleData);

    return NextResponse.json({ ...vehicleData, id: result.insertedId.toHexString() }, { status: 201 });
  } catch (error: any) {
    console.error('API Vehicles POST Error:', error);
    return NextResponse.json({ message: `Erro ao adicionar veículo: ${error.message}` }, { status: 500 });
  }
}
