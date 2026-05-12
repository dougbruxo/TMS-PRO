
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { User, OperationalEvent, Quote, Manifest } from '@/lib/types';

// Função para limpar e criar um nome de ficheiro seguro
const sanitizeFilename = (name: string) => {
    return name.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase();
};


export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const pathname = new URL(request.url).pathname;
        const parts = pathname.split('/');
        const quoteId = parts[parts.length - 2]; // Path is /api/quotes/[id]/upload-proof

        if (!ObjectId.isValid(quoteId)) {
            return NextResponse.json({ message: 'ID de cotação inválido' }, { status: 400 });
        }

        const data = await request.formData();
        const file: File | null = data.get('file') as unknown as File;
        const userJson: string | null = data.get('user') as string;

        if (!file || !userJson) {
            return NextResponse.json({ message: 'Dados do ficheiro ou do utilizador em falta.' }, { status: 400 });
        }
        
        const user: User = JSON.parse(userJson);
        if (!user || !user.id || !user.username) {
             return NextResponse.json({ message: 'Dados do utilizador inválidos.' }, { status: 400 });
        }
        
        const { db } = await connectToDatabase();
        
        const quote = await db.collection<Quote>('quotes').findOne({ _id: new ObjectId(quoteId) });
        if (!quote) {
            return NextResponse.json({ message: 'Cotação não encontrada' }, { status: 404 });
        }

        // No longer deleting old proofs since we support multiple.
        // We will just push the new one.

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        const quoteCode = sanitizeFilename(quote.quoteCode || quoteId);

        // Cria o diretório com base no código da cotação
        const uploadDir = join(process.cwd(), 'public', 'upload', 'comprovantes-entregas', quoteCode);
        if (!existsSync(uploadDir)) {
            mkdirSync(uploadDir, { recursive: true });
        }
        
        const fileExtension = file.name.split('.').pop() || 'file';

        // Construir o nome do ficheiro padronizado
        const tomador = sanitizeFilename(quote.tomador || 'sem-tomador');
        const nfNumber = quote.nfNumber ? sanitizeFilename(quote.nfNumber) : 'sem-nf';

        const finalFileName = `${tomador}_${quoteCode}_${nfNumber}.${fileExtension}`;
        const filePath = join(uploadDir, finalFileName);

        await writeFile(filePath, buffer);
        
        const publicPath = `/api/assets/upload/comprovantes-entregas/${quoteCode}/${finalFileName}`;

        const operationalEvent: OperationalEvent = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            userId: user.id,
            username: user.username,
            status: 'Entregue',
            action: 'COMPROVATIVO_ANEXADO',
            details: `Entrega confirmada com anexo de comprovativo por ${user.username}.`
        };

        const isFirstProof = !quote.proofOfDeliveryUrl && (!quote.proofOfDeliveryUrls || quote.proofOfDeliveryUrls.length === 0);

        const result = await db.collection<any>('quotes').updateOne(
            { _id: new ObjectId(quoteId) },
            { 
                $set: { 
                    ...(isFirstProof ? { proofOfDeliveryUrl: publicPath } : {}), // Legacy
                    status: 'Entregue', // Muda o status para Entregue
                    deliveredAt: new Date().toISOString(),
                },
                $push: { 
                    operationalHistory: operationalEvent,
                    proofOfDeliveryUrls: publicPath
                }
            }
        );
        
        // Agora, verifique se todas as cotações do romaneio foram entregues
        const manifest = await db.collection<Manifest>('manifests').findOne({ "quotes.quoteId": quoteId });

        if (manifest) {
            const allDelivered = (await db.collection<Quote>('quotes').find({
                _id: { $in: manifest.quotes.map(q => new ObjectId(q.quoteId)) }
            }).toArray()).every(q => q.status === 'Entregue' || q.status === 'Finalizado');

            if (allDelivered) {
                await db.collection('manifests').updateOne(
                    { _id: manifest._id },
                    { $set: { status: 'Finalizado', closedAt: new Date().toISOString() } }
                );
            }
        }


        if (result.matchedCount === 0) {
            return NextResponse.json({ message: 'Cotação não encontrada' }, { status: 404 });
        }

        return NextResponse.json({ success: true, path: publicPath });

    } catch (error: any) {
        console.error('API Upload Proof Error:', error);
        return NextResponse.json({ success: false, message: `Erro interno do servidor: ${error.message}` }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const pathname = new URL(request.url).pathname;
        const parts = pathname.split('/');
        const quoteId = parts[parts.length - 2];

        if (!ObjectId.isValid(quoteId)) {
            return NextResponse.json({ message: 'ID de cotação inválido' }, { status: 400 });
        }
        
        const { searchParams } = new URL(request.url);
        const userJson = searchParams.get('user');
        const user: User | null = userJson ? JSON.parse(userJson) : null;
        
        if (!user || !user.id || !user.username) {
            return NextResponse.json({ message: 'Utilizador não fornecido.' }, { status: 400 });
        }
        
        if (user.role !== 'admin') {
            return NextResponse.json({ message: 'Apenas administradores podem remover comprovativos.' }, { status: 403 });
        }

        const { db } = await connectToDatabase();
        const quote = await db.collection('quotes').findOne({ _id: new ObjectId(quoteId) });
        if (!quote) {
            return NextResponse.json({ message: 'Cotação não encontrada' }, { status: 404 });
        }
        
        const targetUrl = searchParams.get('url');
        
        let proofPath = '';
        if (targetUrl) {
            const oldFileRelativePath = targetUrl.replace('/api/assets', '');
            proofPath = join(process.cwd(), 'public', oldFileRelativePath);
        } else if (quote.proofOfDeliveryUrl) {
            const oldFileRelativePath = quote.proofOfDeliveryUrl.replace('/api/assets', '');
            proofPath = join(process.cwd(), 'public', oldFileRelativePath);
        }

        if (proofPath && existsSync(proofPath)) {
            await unlink(proofPath);
        }
        
        const historyEvent: OperationalEvent = {
            id: uuidv4(),
            timestamp: new Date().toISOString(),
            userId: user.id,
            username: user.username,
            action: 'COMPROVATIVO_REMOVIDO',
            details: `Comprovativo de entrega removido por ${user.username}.`,
            status: quote.status,
        };

        const updateQuery: any = {
            $push: { operationalHistory: historyEvent }
        };

        if (targetUrl) {
            updateQuery.$pull = { proofOfDeliveryUrls: targetUrl };
            if (quote.proofOfDeliveryUrl === targetUrl) {
                updateQuery.$unset = { proofOfDeliveryUrl: "" };
            }
        } else {
            updateQuery.$unset = { proofOfDeliveryUrl: "", proofOfDeliveryUrls: "" };
        }

        const result = await db.collection<any>('quotes').updateOne(
            { _id: new ObjectId(quoteId) },
            updateQuery
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ message: 'Cotação não encontrada durante a atualização' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Comprovativo removido com sucesso.' });

    } catch (error: any) {
        console.error('API Delete Proof Error:', error);
        return NextResponse.json({ success: false, message: `Erro interno do servidor: ${error.message}` }, { status: 500 });
    }
}
