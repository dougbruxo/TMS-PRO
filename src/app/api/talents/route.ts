
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import type { Talent, User, UserRole } from '@/lib/types';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const { db } = await connectToDatabase();
    
    let query: any = {};
    if (term) {
        query.$or = [
            { fullName: { $regex: term, $options: 'i' } },
            { cpf: { $regex: term, $options: 'i' } }
        ];
    }

    const talents = await db.collection('talents').find(query).limit(limit).sort({ fullName: 1 }).toArray();
    const response = talents.map(talent => ({ ...talent, id: talent._id.toHexString() }));
    return NextResponse.json(response);
  } catch (error: any) {
    console.error('API Talents GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar talentos: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { accessOption, email, password, role, userId, ...talentData }: Omit<Talent, 'id'> & { accessOption: 'none' | 'create' | 'link', email?: string, password?: string, role?: UserRole, userId?: string } = await request.json();
    
    if (!talentData.fullName || !talentData.cpf || !talentData.hiringTypeId) {
        return NextResponse.json({ message: 'Nome, CPF e Tipo de Contratação são obrigatórios.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const existingTalent = await db.collection('talents').findOne({ cpf: talentData.cpf });
    if (existingTalent) {
        return NextResponse.json({ message: 'Já existe um talento com este CPF.' }, { status: 409 });
    }

    let finalUserId: string | undefined = undefined;

    if (accessOption === 'create') {
        if (!email || !password || !role) {
            return NextResponse.json({ message: "E-mail, Palavra-passe e Nível de acesso são obrigatórios para criar um novo utilizador." }, { status: 400 });
        }
        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
            return NextResponse.json({ message: "Este e-mail já está em uso por outro utilizador." }, { status: 409 });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser: Omit<User, 'id' | '_id'> = {
            email,
            password: hashedPassword,
            username: talentData.fullName.toUpperCase(),
            role,
            contact: talentData.phone1 || '',
            disabled: false,
            chatEnabled: true,
            operationalAccess: role !== 'cliente',
            driverManagementAccess: role !== 'cliente',
            settingsAccess: role === 'admin',
            noticeBoardAccess: true,
            expensesAccess: role !== 'cliente',
            talentsAccess: role === 'admin',
            receivingAccess: role !== 'cliente',
            documentsAccess: true,
            fracionadoEnabled: role !== 'cliente',
            sacAccess: role !== 'cliente',
            registrationsAccess: role !== 'cliente',
            panoramaAccess: role !== 'cliente',
            stockAccess: role !== 'cliente',
            freightAccess: true,
            myFreightsAccess: true,
            salesBonusPercentage: talentData.salesBonusPercentage,
        };
        const userResult = await db.collection('users').insertOne(newUser as any);
        finalUserId = userResult.insertedId.toHexString();
    } else if (accessOption === 'link' && userId) {
        finalUserId = userId;
    }
    
    const dataToInsert = { ...talentData, userId: finalUserId ? new ObjectId(finalUserId) : undefined };
    const result = await db.collection('talents').insertOne(dataToInsert as any);
    const newTalent = { id: result.insertedId.toHexString(), ...dataToInsert };
    
    return NextResponse.json(newTalent, { status: 201 });
  } catch (error: any) {
    console.error('API Talents POST Error:', error);
    return NextResponse.json({ message: `Erro ao criar talento: ${error.message}` }, { status: 500 });
  }
}
