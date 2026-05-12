import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const authUser = getUserFromRequest(request);
        if (!authUser || authUser.role !== 'admin') {
             return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
        }

        const { db } = await connectToDatabase();
        
        const counterDoc = await db.collection('counters').findOne({ _id: 'quoteSequence' });
        
        return NextResponse.json({ seq: counterDoc?.seq || 0 });
    } catch (error: any) {
        console.error('GET Quote Counter Error:', error);
        return NextResponse.json({ message: `Erro ao buscar contador: ${error.message}` }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const authUser = getUserFromRequest(request);
        if (!authUser || authUser.role !== 'admin') {
             return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
        }

        const { seq } = await request.json();
        
        if (typeof seq !== 'number' || seq < 0) {
             return NextResponse.json({ message: 'Valor de sequência inválido.' }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        
        await db.collection('counters').updateOne(
            { _id: 'quoteSequence' },
            { $set: { seq } },
            { upsert: true }
        );

        return NextResponse.json({ message: 'Contador atualizado com sucesso.', seq });
    } catch (error: any) {
        console.error('POST Quote Counter Error:', error);
        return NextResponse.json({ message: `Erro ao atualizar contador: ${error.message}` }, { status: 500 });
    }
}
