
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Company } from '@/lib/types';

async function getNextCustomerCode(db: any) {
    const counter = await db.collection('counters').findOneAndUpdate(
        { _id: 'customerCode' },
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true }
    );
    const seq = counter?.seq ?? 1;
    return `CL${seq.toString().padStart(5, '0')}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '1000', 10);
    const term = searchParams.get('term') || '';
    const skip = (page - 1) * limit;

    const query: any = {};
    if (term) {
        query.$or = [
            { razaoSocial: { $regex: term, $options: 'i' } },
            { cnpj: { $regex: term, $options: 'i' } },
            { nome: { $regex: term, $options: 'i' } }
        ];
    }

    const { db } = await connectToDatabase();
    const customers = await db.collection('customers')
      .find(query)
      .sort({ code: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    const customersWithId = customers.map(customer => {
      const { _id, ...rest } = customer;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(customersWithId);
  } catch (error: any) {
    console.error('API Customers GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar clientes: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const customerData: Omit<Company, 'id' | 'createdAt' | 'code'> = await request.json();
    const { db } = await connectToDatabase();

    if (!customerData.razaoSocial || !customerData.cnpj) {
        return NextResponse.json({ message: "Razão Social e CNPJ/CPF são obrigatórios." }, { status: 400 });
    }

    const cleanedCnpj = customerData.cnpj.replace(/[^\d]/g, '');
    const existingCustomer = await db.collection('customers').findOne({ cnpj: cleanedCnpj });
    if (existingCustomer) {
        return NextResponse.json({ message: `Já existe um cliente com o CNPJ/CPF ${customerData.cnpj}.` }, { status: 409 });
    }
    
    const code = await getNextCustomerCode(db);
    
    const dataToInsert = { 
        ...customerData, 
        cnpj: cleanedCnpj,
        code,
        disabled: false,
        createdAt: new Date().toISOString() 
    };
    const result = await db.collection('customers').insertOne(dataToInsert as any);
    
    return NextResponse.json({ id: result.insertedId.toHexString(), ...dataToInsert }, { status: 201 });

  } catch (error: any) {
    console.error('API Customers POST Error:', error);
    if ((error as any).code === 11000) {
      return NextResponse.json({ message: "Erro de duplicação. O CNPJ/CPF ou código já existe." }, { status: 409 });
    }
    return NextResponse.json({ message: `Erro ao adicionar cliente: ${error.message}` }, { status: 500 });
  }
}
