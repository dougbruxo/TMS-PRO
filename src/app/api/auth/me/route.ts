
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import type { User, Driver } from '@/lib/types';

// Este endpoint valida um token e retorna os dados do usuário correspondente.
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Não autorizado: Token não fornecido.' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

    // Decodifica e valida o token JWT
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return NextResponse.json({ message: 'Não autorizado: Token inválido ou expirado.' }, { status: 401 });
    }

    if (!decoded.userId || !ObjectId.isValid(decoded.userId)) {
      return NextResponse.json({ message: 'Não autorizado: Token com formato inválido.' }, { status: 401 });
    }
    
    const { db } = await connectToDatabase();

    if (decoded.role === 'driver') {
        const driver = await db.collection<Omit<Driver, 'id'>>('drivers').findOne(
          { _id: new ObjectId(decoded.userId) },
          { projection: { password: 0 } }
        );

        if (driver) {
            if (!driver.hasPortalAccess) {
                return NextResponse.json({ message: 'Acesso negado: Portal do motorista desabilitado.' }, { status: 403 });
            }
            const { _id, ...driverData } = driver;
            // Constrói um objeto semelhante ao de User para o frontend
            const userObject = {
                id: _id.toHexString(),
                username: driver.name,
                role: 'driver',
                avatarUrl: driver.avatarUrl,
            };
            return NextResponse.json(userObject);
        } else {
             return NextResponse.json({ message: 'Não autorizado: Motorista não encontrado.' }, { status: 401 });
        }

    } else {
        // Lógica existente para usuários normais
        const user = await db.collection<Omit<User, 'id'>>('users').findOne(
          { _id: new ObjectId(decoded.userId) },
          { projection: { password: 0 } } // Exclui o campo da senha da resposta
        );

        if (user) {
          if (user.disabled) {
            return NextResponse.json({ message: 'Acesso negado: Conta desabilitada.' }, { status: 403 });
          }
          const { _id, ...userData } = user;
          return NextResponse.json({ id: _id.toHexString(), ...userData });
        } else {
          return NextResponse.json({ message: 'Não autorizado: Usuário não encontrado.' }, { status: 401 });
        }
    }

  } catch (error: any) {
    console.error('API /me Error:', error);
    return NextResponse.json({ message: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}
