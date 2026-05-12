
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');

    if (!term || term.length < 2) {
      return NextResponse.json([]); // Return empty array for short terms
    }

    const { db } = await connectToDatabase();
    
    const regex = { $regex: term, $options: 'i' };

    const query = {
      $or: [
        { razaoSocial: regex },
        { nomeFantasia: regex },
        { cnpj: regex },
        { code: regex },
      ]
    };

    const customers = await db.collection('customers')
      .find(query)
      .limit(50) // Limit results for performance
      .sort({ razaoSocial: 1 })
      .toArray();

    const customersWithId = customers.map(customer => {
      const { _id, ...rest } = customer;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(customersWithId);

  } catch (error: any) {
    console.error('API Customers Search Error:', error);
    return NextResponse.json({ message: `Erro ao buscar clientes: ${error.message}` }, { status: 500 });
  }
}
