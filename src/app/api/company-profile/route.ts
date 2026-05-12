import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import type { CompanyProfile } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    const profiles = await db.collection('company_profiles').find({}).sort({ razaoSocial: 1 }).toArray();
    
    const profilesWithId = profiles.map(profile => {
      const { _id, ...rest } = profile;
      return { id: _id.toHexString(), ...rest };
    });

    return NextResponse.json(profilesWithId);
  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao buscar perfis da empresa: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const profileData: Omit<CompanyProfile, 'id'> = await request.json();
    const { db } = await connectToDatabase();

    if (!profileData.razaoSocial || !profileData.cnpj) {
        return NextResponse.json({ message: "Razão Social e CNPJ são obrigatórios." }, { status: 400 });
    }
    
    if (profileData.isDefault) {
      await db.collection('company_profiles').updateMany({}, { $set: { isDefault: false } });
    }

    const result = await db.collection('company_profiles').insertOne(profileData as any);
    
    return NextResponse.json({ id: result.insertedId.toHexString(), ...profileData }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ message: `Erro ao adicionar perfil: ${error.message}` }, { status: 500 });
  }
}
