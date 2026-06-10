import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const docId = id;

        if (!docId) {
            return new NextResponse('Missing parameter: id', { status: 400 });
        }

        const { db } = await connectToDatabase();
        
        // Puxa o Documento específico pela chave primária
        const document = await db.collection('issued_documents').findOne({ _id: new ObjectId(docId) });

        if (!document) {
            return new NextResponse('Document not found in database.', { status: 404 });
        }

        return NextResponse.json(document);

    } catch (error: any) {
        console.error('API /documents/[id] GET Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
