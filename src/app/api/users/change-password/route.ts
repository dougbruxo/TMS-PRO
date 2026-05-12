
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { userId, currentPassword, newPassword } = await request.json();

    if (!userId || !currentPassword || !newPassword) {
      return NextResponse.json({ message: 'Dados insuficientes.' }, { status: 400 });
    }

    if (!ObjectId.isValid(userId)) {
      return NextResponse.json({ message: 'ID de usuário inválido.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return NextResponse.json({ message: 'Usuário não encontrado.' }, { status: 404 });
    }

    // Compare the provided current password with the stored hashed password
    const passwordMatch = await bcrypt.compare(currentPassword, user.password as string);

    if (!passwordMatch) {
      return NextResponse.json({ message: 'A palavra-passe atual está incorreta.' }, { status: 401 });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password in the database
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { password: hashedNewPassword } }
    );

    if (result.matchedCount === 0) {
        // This should be rare as we just found the user
        return NextResponse.json({ message: 'Erro ao encontrar usuário para atualizar.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Palavra-passe atualizada com sucesso.' }, { status: 200 });

  } catch (error: any) {
    console.error('API Change Password Error:', error);
    return NextResponse.json({ message: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}
