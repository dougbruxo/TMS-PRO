import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
    try {
        const id = params.id;
        
        if (!id || !ObjectId.isValid(id)) {
            return NextResponse.json({ message: 'ID inválido.' }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        
        // Buscar em issued_documents (onde fica o histórico)
        let doc = await db.collection('issued_documents').findOne({ _id: new ObjectId(id) });
        let collection = 'issued_documents';

        if (!doc) {
            // Tentar em documents (rascunhos)
            doc = await db.collection('documents').findOne({ _id: new ObjectId(id) });
            collection = 'documents';
        }
        
        if (!doc) {
            return NextResponse.json({ message: 'Documento não encontrado.' }, { status: 404 });
        }
        
        // Proteção: Nunca excluir documentos autorizados/sucesso
        const status = (doc.status || '').toLowerCase();
        const protectedStatuses = ['autorizado', 'concluido', 'sucesso'];
        
        if (protectedStatuses.some(s => status.includes(s))) {
             return NextResponse.json({ 
                 message: 'Documentos AUTORIZADOS não podem ser excluídos por segurança fiscal. Use o Cancelamento se necessário.' 
             }, { status: 403 });
        }

        await db.collection(collection).deleteOne({ _id: new ObjectId(id) });
        
        return NextResponse.json({ message: 'Documento removido do histórico.' }, { status: 200 });
    } catch (error: any) {
        console.error('Error deleting document:', error);
        return NextResponse.json({ message: error.message || 'Erro ao excluir o documento.' }, { status: 500 });
    }
}
