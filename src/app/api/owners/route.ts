import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { Owner } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    const owners = await db.collection('owners').find({}).sort({ name: 1 }).toArray();
    
    const ownersWithId = owners.map(owner => {
      const { _id, ...rest } = owner;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(ownersWithId);
  } catch (error: any) {
    console.error('API Owners GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar proprietários: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ownerData: Partial<Omit<Owner, 'id' | 'createdAt'>> = await request.json();
    const { db } = await connectToDatabase();

    if (!ownerData.name || !ownerData.document) {
        return NextResponse.json({ message: "Nome e Documento são obrigatórios." }, { status: 400 });
    }
    
    const cleanedDoc = ownerData.document.replace(/[^\d]/g, '');
    const existingOwner = await db.collection('owners').findOne({ document: cleanedDoc });
    if (existingOwner) {
        return NextResponse.json({ message: `Já existe um proprietário com este documento.` }, { status: 409 });
    }
    
    const { logradouro, numero, complemento, bairro, city, state, zipCode } = ownerData;
    const fullAddress = [logradouro, numero, complemento, bairro, city, state, zipCode].filter(Boolean).join(', ');

    const dataToInsert = { 
        ...ownerData, 
        document: cleanedDoc,
        address: fullAddress,
        createdAt: new Date().toISOString() 
    };
    const result = await db.collection('owners').insertOne(dataToInsert as any);
    
    return NextResponse.json({ id: result.insertedId.toHexString(), ...dataToInsert }, { status: 201 });

  } catch (error: any) {
    console.error('API Owners POST Error:', error);
    if ((error as any).code === 11000) {
      return NextResponse.json({ message: "Erro de duplicação. O documento já existe." }, { status: 409 });
    }
    return NextResponse.json({ message: `Erro ao adicionar proprietário: ${error.message}` }, { status: 500 });
  }
}
