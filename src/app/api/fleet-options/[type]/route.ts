import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

const collectionMap: Record<string, string> = {
  brands: 'vehicle_brands',
  models: 'vehicle_models',
  colors: 'vehicle_colors',
  bodyTypes: 'vehicle_body_types',
  anttCategories: 'vehicle_antt_categories',
  vehicleTypes: 'vehicle_types',
};

// GET all items for a type
export async function GET(request: Request) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const type = parts[parts.length - 1];

    const collectionName = collectionMap[type];
    if (!collectionName) {
      return NextResponse.json({ message: 'Tipo de opção inválido.' }, { status: 400 });
    }
    const { db } = await connectToDatabase();
    const items = await db.collection(collectionName).find({}).collation({ locale: 'en_US', numericOrdering: true }).sort({ code: 1 }).toArray();
    const response = items.map(item => ({ ...item, id: item._id.toHexString() }));
    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao buscar itens: ${error.message}` }, { status: 500 });
  }
}

// POST a new item
export async function POST(request: Request) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const type = parts[parts.length - 1];
    
    const collectionName = collectionMap[type];
    if (!collectionName) {
      return NextResponse.json({ message: 'Tipo de opção inválido.' }, { status: 400 });
    }

    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ message: "Nome é obrigatório." }, { status: 400 });
    }
    const { db } = await connectToDatabase();
    
    // Check for duplicate name
    const existingName = await db.collection(collectionName).findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingName) {
        return NextResponse.json({ message: "Este item já existe." }, { status: 409 });
    }
    
    // Auto-increment code
    const allItems = await db.collection(collectionName).find({}, { projection: { code: 1 } }).toArray();
    const highestCode = allItems.reduce((max, item) => {
        const codeNum = parseInt(item.code, 10);
        return !isNaN(codeNum) && codeNum > max ? codeNum : max;
    }, 0);
    const newCode = (highestCode + 1).toString().padStart(2, '0');

    const result = await db.collection(collectionName).insertOne({ name, code: newCode });
    const newItem = { id: result.insertedId.toHexString(), name, code: newCode };
    return NextResponse.json(newItem, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao criar item: ${error.message}` }, { status: 500 });
  }
}
