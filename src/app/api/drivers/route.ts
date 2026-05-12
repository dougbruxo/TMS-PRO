
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Driver, FleetVehicle } from '@/lib/types';
import bcrypt from 'bcryptjs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const term = searchParams.get('term') || '';
    const skip = (page - 1) * limit;

    const query: any = {};
    if (term) {
        query.$or = [
            { name: { $regex: term, $options: 'i' } },
            { cpf: { $regex: term, $options: 'i' } }
        ];
    }

    const { db } = await connectToDatabase();
    const drivers = await db.collection('drivers').find(query).sort({ name: 1 }).skip(skip).limit(limit).toArray();
    
    const driversWithId = drivers.map(driver => {
      const { _id, ...rest } = driver;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(driversWithId);
  } catch (error: any) {
    console.error('API Drivers GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar motoristas: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const driverData: Partial<Driver> = await request.json();
    const { db } = await connectToDatabase();

    if (!driverData.name || !driverData.cpf || !driverData.phone1) {
        return NextResponse.json({ message: "Nome, CPF e Telefone 1 são obrigatórios." }, { status: 400 });
    }
    
    driverData.cpf = driverData.cpf.replace(/[^\d]/g, '');

    if (driverData.hasPortalAccess) {
        const defaultPassword = '123456';
        driverData.password = await bcrypt.hash(defaultPassword, 10);
    }
    
    if (driverData.mainVehicleId && ObjectId.isValid(driverData.mainVehicleId)) {
        const mainVehicle = await db.collection<FleetVehicle>('fleet').findOne({ _id: new ObjectId(driverData.mainVehicleId) });
        if (mainVehicle) {
            driverData.licensePlate = mainVehicle.plate;
            driverData.vehicleType = mainVehicle.vehicleType;
        }
    } else {
        driverData.licensePlate = undefined;
        driverData.vehicleType = undefined;
    }

    if (driverData.linkedCarretaIds && driverData.linkedCarretaIds.length > 0 && ObjectId.isValid(driverData.linkedCarretaIds[0])) {
        const firstCarreta = await db.collection<FleetVehicle>('fleet').findOne({ _id: new ObjectId(driverData.linkedCarretaIds[0]) });
        driverData.licensePlate2 = firstCarreta?.plate;
    } else {
        driverData.licensePlate2 = undefined;
    }


    const result = await db.collection('drivers').insertOne(driverData as Omit<Driver, 'id'>);
    
    const newDriver = {
      id: result.insertedId.toHexString(),
      ...driverData
    };

    return NextResponse.json(newDriver, { status: 201 });

  } catch (error: any) {
    console.error('API Drivers POST Error:', error);
    return NextResponse.json({ message: `Erro ao adicionar motorista: ${error.message}` }, { status: 500 });
  }
}
