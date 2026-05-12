import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET() {
    try {
        const { db } = await connectToDatabase();
        const documents = await db.collection('issued_documents')
            .find({})
            .sort({ dataEmissao: -1 })
            .limit(100)
            .toArray();

        return NextResponse.json(documents);
    } catch (error: any) {
        console.error('Erro ao buscar histórico de documentos:', error);
        return NextResponse.json({ message: 'Erro ao buscar histórico.', error: error.message }, { status: 500 });
    }
}
