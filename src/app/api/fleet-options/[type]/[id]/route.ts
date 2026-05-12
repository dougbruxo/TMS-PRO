import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

const collectionMap: Record<string, string> = {
  brands: 'vehicle_brands',
  models: 'vehicle_models',
  colors: 'vehicle_colors',
  bodyTypes: 'vehicle_body_types',
  anttCategories: 'vehicle_antt_categories',
  vehicleTypes: 'vehicle_types',
};

// PUT an item
export async function PUT(request: Request) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];
    const type = parts[parts.length - 2];

    const collectionName = collectionMap[type];
    if (!collectionName) {
      return NextResponse.json({ message: 'Tipo de opção inválido.' }, { status: 400 });
    }

    const { code, name } = await request.json();

    if (!ObjectId.isValid(id) || !code || !name) {
      return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // Guard against editing default vehicle types
    if (type === 'vehicleTypes') {
        const defaultCodes = ['01', '02', '03', '04'];
        const item = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });
        if (item && defaultCodes.includes(item.code)) {
            return NextResponse.json({ message: 'Este item padrão não pode ser modificado.' }, { status: 403 });
        }
    }
    
    // Check for duplicate code on another document
    const existingCode = await db.collection(collectionName).findOne({ code, _id: { $ne: new ObjectId(id) } });
    if (existingCode) {
        return NextResponse.json({ message: `O código '${code}' já está em uso.` }, { status: 409 });
    }

    const result = await db.collection(collectionName).updateOne(
      { _id: new ObjectId(id) },
      { $set: { code, name } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Item não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ message: "Item atualizado com sucesso." });
  } catch (error: any) {
    console.error(`API Fleet Option PUT Error:`, error);
    return NextResponse.json({ message: `Erro ao atualizar item: ${error.message}` }, { status: 500 });
  }
}


// DELETE an item
export async function DELETE(request: Request) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];
    const type = parts[parts.length - 2];

    const collectionName = collectionMap[type];
    if (!collectionName) {
      return NextResponse.json({ message: 'Tipo de opção inválido.' }, { status: 400 });
    }
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID inválido." }, { status: 400 });
    }
    const { db } = await connectToDatabase();
    
     // Guard against deleting default vehicle types
    if (type === 'vehicleTypes') {
        const defaultCodes = ['01', '02', '03', '04'];
        const item = await db.collection(collectionName).findOne({ _id: new ObjectId(id) });
        if (item && defaultCodes.includes(item.code)) {
            return NextResponse.json({ message: 'Este item padrão não pode ser apagado.' }, { status: 403 });
        }
    }
    
    const result = await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Item não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ message: "Item apagado com sucesso." });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao apagar item: ${error.message}` }, { status: 500 });
  }
}
