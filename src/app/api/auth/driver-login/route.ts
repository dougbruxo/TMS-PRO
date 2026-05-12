
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Driver, LoginResult, ActivityRecord } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const { cpf, password } = await request.json();
    const { db } = await connectToDatabase();
    
    // CPF deve ser guardado sem formatação
    const cleanedCpf = cpf.replace(/[^\d]/g, '');

    const driver = await db.collection<Omit<Driver, 'id'>>('drivers').findOne({ cpf: cleanedCpf });

    if (!driver) {
      return NextResponse.json({ status: 'invalid-credentials', message: 'CPF ou senha inválidos.' }, { status: 401 });
    }

    if (!driver.hasPortalAccess) {
        return NextResponse.json({ status: 'disabled', message: 'Acesso ao portal não habilitado.' }, { status: 403 });
    }

    const passwordMatch = await bcrypt.compare(password, driver.password as string);
    if (!passwordMatch) {
      return NextResponse.json({ status: 'invalid-credentials', message: 'CPF ou senha inválidos.' }, { status: 401 });
    }

    // Log successful login
    const activityRecord: Omit<ActivityRecord, 'id'|'_id'> = {
        userId: driver._id.toHexString(),
        username: driver.name,
        timestamp: new Date().toISOString(),
        type: 'LOGIN',
        details: `Login de motorista bem-sucedido.`,
    };
    await db.collection('activityHistory').insertOne(activityRecord as any);

    const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';
    
    // Padroniza o token para usar 'userId' para compatibilidade com a verificação de sessão
    const token = jwt.sign(
      { userId: driver._id.toHexString(), role: 'driver', username: driver.name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    const { password: _, _id, ...driverToReturn } = driver;

    const result: LoginResult = { 
        status: 'success', 
        token, 
        user: { 
            id: _id.toHexString(), 
            username: driver.name, 
            role: 'driver',
            avatarUrl: driver.avatarUrl,
        } as any
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('API Driver Login Error:', error);
    if (error.code === 'ECONNREFUSED' || error.message?.includes('connect ECONNREFUSED')) {
        return NextResponse.json({ status: 'db-connection-error', message: 'Falha ao conectar-se à base de dados.' }, { status: 500 });
    }
    return NextResponse.json({ status: 'error', message: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}
