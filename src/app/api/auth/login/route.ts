import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { User, ActivityRecord } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const { db } = await connectToDatabase();
    
    const user = await db.collection<Omit<User, 'id'>>('users').findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

    if (!user) {
      return NextResponse.json({ status: 'invalid-credentials', message: 'E-mail ou senha inválidos.' }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, user.password as string);
    if (!passwordMatch) {
      return NextResponse.json({ status: 'invalid-credentials', message: 'E-mail ou senha inválidos.' }, { status: 401 });
    }
    
    if (user.disabled) {
        return NextResponse.json({ status: 'disabled', message: 'Conta desabilitada.' }, { status: 403 });
    }

    // Log successful login
    const activityRecord: Omit<ActivityRecord, 'id'|'_id'> = {
        userId: user._id.toHexString(),
        username: user.username,
        timestamp: new Date().toISOString(),
        type: 'LOGIN',
        details: `Login bem-sucedido.`,
    };
    await db.collection('activityHistory').insertOne(activityRecord as any);

    const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';
    
    const token = jwt.sign(
      { 
        userId: user._id.toHexString(), 
        email: user.email,
        role: user.role, 
        username: user.username,
        isSubClient: user.isSubClient,
        parentId: user.parentId,
        subRole: user.subRole,
        effectiveUserId: user.isSubClient ? user.parentId : user._id.toHexString(),
        clientPortalsAccess: (user as any).clientPortalsAccess 
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    const { password: _, _id, ...userToReturn } = user;

    return NextResponse.json({ 
        status: 'success', 
        token, 
        user: { id: _id.toHexString(), ...userToReturn } 
    });

  } catch (error: any) {
    console.error('API Login Error:', error);
    if (error.code === 'ECONNREFUSED' || error.message?.includes('connect ECONNREFUSED')) {
        return NextResponse.json({ status: 'db-connection-error', message: 'Falha ao conectar-se à base de dados. Verifique se o serviço MongoDB está em execução.' }, { status: 500 });
    }
    return NextResponse.json({ status: 'error', message: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}
