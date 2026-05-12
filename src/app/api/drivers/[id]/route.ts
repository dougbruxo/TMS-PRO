
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import type { Driver, FleetVehicle } from '@/lib/types';

// Obter um motorista específico
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de motorista inválido" }, { status: 400 });
    }
    const { db } = await connectToDatabase();
    const driver = await db.collection('drivers').findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } });
    if (!driver) {
      return NextResponse.json({ message: "Motorista não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ...driver, id: driver._id.toHexString() });
  } catch (error: any) {
    console.error('API Driver GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar motorista: ${error.message}` }, { status: 500 });
  }
}

// Atualizar um motorista
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    const updates: Partial<Driver> = await request.json();
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de motorista inválido" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const originalDriver = await db.collection<Driver>('drivers').findOne({ _id: new ObjectId(id) });
    if (!originalDriver) {
      return NextResponse.json({ message: "Motorista não encontrado" }, { status: 404 });
    }
    
    // Se o acesso ao portal está a ser habilitado pela primeira vez, define a senha padrão
    if (updates.hasPortalAccess && !originalDriver.hasPortalAccess) {
        const defaultPassword = '123456';
        updates.password = await bcrypt.hash(defaultPassword, 10);
    }

    if (updates.cpf) {
      updates.cpf = updates.cpf.replace(/[^\d]/g, '');
    }

    // Handle vehicle linking
    if (updates.mainVehicleId && ObjectId.isValid(updates.mainVehicleId)) {
        const mainVehicle = await db.collection<FleetVehicle>('fleet').findOne({ _id: new ObjectId(updates.mainVehicleId) });
        if (mainVehicle) {
            updates.licensePlate = mainVehicle.plate;
            updates.vehicleType = mainVehicle.vehicleType;
        }
    } else if (updates.mainVehicleId === '' || updates.mainVehicleId === null || updates.mainVehicleId === undefined) {
        updates.licensePlate = undefined;
        updates.vehicleType = undefined;
    }

    if (updates.linkedCarretaIds && updates.linkedCarretaIds.length > 0 && ObjectId.isValid(updates.linkedCarretaIds[0])) {
        const firstCarreta = await db.collection<FleetVehicle>('fleet').findOne({ _id: new ObjectId(updates.linkedCarretaIds[0]) });
        updates.licensePlate2 = firstCarreta?.plate;
    } else {
        updates.licensePlate2 = undefined;
    }

    // Assegura que o _id não seja atualizado
    delete (updates as any)._id;

    const result = await db.collection('drivers').updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Motorista não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ message: "Motorista atualizado com sucesso" }, { status: 200 });
  } catch (error: any) {
    console.error('API Driver PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar motorista: ${error.message}` }, { status: 500 });
  }
}


// Apagar um motorista
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de motorista inválido" }, { status: 400 });
    }
      
    const { db } = await connectToDatabase();

    const result = await db.collection('drivers').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Motorista não encontrado" }, { status: 404 });
    }

    return NextResponse.json({ message: "Motorista apagado com sucesso" }, { status: 200 });
  } catch (error: any) {
    console.error('API Driver DELETE Error:', error);
    return NextResponse.json({ message: `Erro ao apagar motorista: ${error.message}` }, { status: 500 });
  }
}
