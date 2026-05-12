
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

const collectionMap: Record<string, string> = {
  brands: 'vehicle_brands',
  models: 'vehicle_models',
  colors: 'vehicle_colors',
  bodyTypes: 'vehicle_body_types',
  anttCategories: 'vehicle_antt_categories',
};

export async function GET(request: Request) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const type = parts[parts.length - 2]; 
    
    const collectionName = collectionMap[type];
    if (!collectionName) {
      return NextResponse.json({ message: 'Tipo de opção inválido.' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');
    if (!term) {
        return NextResponse.json([]); // Return empty if no search term
    }
    
    const { db } = await connectToDatabase();
    
    const regex = { $regex: term, $options: 'i' };
    const query = { $or: [{ name: regex }, { code: regex }] };

    const items = await db.collection(collectionName).find(query).limit(50).toArray();

    const response = items.map(item => ({ ...item, id: item._id.toHexString() }));
    return NextResponse.json(response);
  } catch (error: any) {
    console.error(`API Search Error for ${request.url}:`, error);
    return NextResponse.json({ message: `Erro ao buscar itens: ${error.message}` }, { status: 500 });
  }
}
