
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { FleetVehicle } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const term = searchParams.get('term') || '';
    const skip = (page - 1) * limit;

    const query: any = {};
    if (term) {
      // Make plate search robust against missing hyphens
      const cleanTerm = term.replace(/[^a-zA-Z0-9]/g, '');
      let plateRegex = term;
      if (cleanTerm.length > 3) {
        plateRegex = `${cleanTerm.slice(0, 3)}-?${cleanTerm.slice(3)}`;
      } else if (cleanTerm.length > 0) {
        plateRegex = cleanTerm;
      }

      query.$or = [
        { plate: { $regex: plateRegex, $options: 'i' } },
        { brand: { $regex: term, $options: 'i' } },
        { model: { $regex: term, $options: 'i' } },
        { vehicleType: { $regex: term, $options: 'i' } },
        { bodyType: { $regex: term, $options: 'i' } }
      ];
    }

    const { db } = await connectToDatabase();
    // Allow up to 100 results to avoid hiding vehicles
    const limitNum = Math.min(limit || 100, 100);
    const vehicles = await db.collection('fleet').find(query).sort({ brand: 1, model: 1 }).skip(skip).limit(limitNum).toArray();
    const vehiclesWithId = vehicles.map(vehicle => {
      const { _id, ...rest } = vehicle;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(vehiclesWithId);
  } catch (error: any) {
    console.error('API Fleet GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar veículos da frota: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const vehicleData: Omit<FleetVehicle, 'id'> = await request.json();
    const { db } = await connectToDatabase();

    if (!vehicleData.plate || !vehicleData.bodyType || !vehicleData.vehicleType || !vehicleData.tara) {
      return NextResponse.json({ message: "Placa, Tipo de Carroceria, Tipo de Rodado e Tara são obrigatórios." }, { status: 400 });
    }

    if (vehicleData.type === 'Terceiro' && !vehicleData.ownerName) {
      return NextResponse.json({ message: "O nome do proprietário é obrigatório para veículos de terceiros." }, { status: 400 });
    }

    const orConditions: any[] = [];
    if (vehicleData.plate) {
      orConditions.push({ plate: vehicleData.plate });
    }
    if (vehicleData.renavam && vehicleData.renavam.trim()) {
      orConditions.push({ renavam: vehicleData.renavam.trim() });
    }
    if (vehicleData.chassis && vehicleData.chassis.trim()) {
      orConditions.push({ chassis: vehicleData.chassis.trim() });
    }

    if (orConditions.length > 0) {
      const existingVehicle = await db.collection('fleet').findOne({ $or: orConditions });
      if (existingVehicle) {
        return NextResponse.json({ message: "Já existe um veículo com esta Placa, Renavam ou Chassi." }, { status: 409 });
      }
    }

    const result = await db.collection('fleet').insertOne(vehicleData as any);

    const newVehicle = {
      id: result.insertedId.toHexString(),
      ...vehicleData
    };

    return NextResponse.json(newVehicle, { status: 201 });

  } catch (error: any) {
    console.error('API Fleet POST Error:', error);
    return NextResponse.json({ message: `Erro ao adicionar veículo: ${error.message}` }, { status: 500 });
  }
}


