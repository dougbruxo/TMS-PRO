
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { ExpenseHistoryEvent, User, Expense, PaymentProof, OperationalEvent, Quote, Driver, Manifest } from '@/lib/types';

async function addHistoryEvent(db: any, expenseId: ObjectId, user: User, action: string, details: string) {
    const historyEvent: ExpenseHistoryEvent = {
        timestamp: new Date().toISOString(),
        user: user.username,
        action,
        details,
    };
    await db.collection('expenses').updateOne(
        { _id: new ObjectId(expenseId) },
        { $push: { history: { $each: [historyEvent], $position: 0 } } }
    );
}

// Helper para sanitizar o nome do ficheiro
const sanitizeFilename = (name: string) => {
    return name.replace(/[^a-z0-9\._-]/gi, '_').toLowerCase();
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const pathname = new URL(request.url).pathname;
        const parts = pathname.split('/');
        const expenseId = parts[parts.length - 2]; // Path is /api/expenses/[id]/upload-proof

        if (!ObjectId.isValid(expenseId)) {
            return NextResponse.json({ message: 'ID de despesa inválido' }, { status: 400 });
        }

        const data = await request.formData();
        const file: File | null = data.get('file') as unknown as File;
        const userJson: string | null = data.get('user') as string;
        const paidValueString: string | null = data.get('paidValue') as string;

        if (!file || !userJson || !paidValueString) {
            return NextResponse.json({ success: false, message: 'Ficheiro, utilizador ou valor do pagamento em falta.' }, { status: 400 });
        }
        
        const user: User = JSON.parse(userJson);
        const paidValue = parseFloat(paidValueString);

        if (!user || !user.id || !user.username || isNaN(paidValue)) {
            return NextResponse.json({ success: false, message: 'Dados do utilizador ou valor do pagamento inválidos.' }, { status: 400 });
        }
        
        const { db } = await connectToDatabase();
        const expense = await db.collection<Expense>('expenses').findOne({ _id: new ObjectId(expenseId) });
        if (!expense) {
            return NextResponse.json({ message: 'Despesa não encontrada' }, { status: 404 });
        }

        // --- Lógica de Pagamento ---
        const amountAlreadyPaid = expense.paidValue || 0;
        const newTotalPaid = amountAlreadyPaid + paidValue;
        const paymentUpdates: Partial<Expense> = {
            paidValue: newTotalPaid,
        };

        if (newTotalPaid >= expense.value) {
            paymentUpdates.status = 'pago';
            paymentUpdates.paidAt = new Date().toISOString();
        } else {
            paymentUpdates.status = 'parcial';
        }

        // --- Lógica de Nomenclatura e Upload do Ficheiro ---
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        let subfolder = sanitizeFilename(expense.categoryName);
        let baseFilename = sanitizeFilename(expense.description.replace(/ \(\d+\/\d+\)$/, ''));

        // Lógica específica para pagamento de motorista
        if (expense.categoryId === 'DRIVER_PAYMENT' && expense.quoteId) {
            const quote = await db.collection<Quote>('quotes').findOne({ _id: new ObjectId(expense.quoteId) });
            if (quote) {
                const operationalEvent = quote.operationalHistory?.find(e => e.id === expense.operationalEventId);
                if (operationalEvent?.driverId) {
                    const driver = await db.collection<Driver>('drivers').findOne({ _id: new ObjectId(operationalEvent.driverId) });
                    const manifest = await db.collection<Manifest>('manifests').findOne({ "quotes.quoteId": expense.quoteId });
                    
                    const driverCpf = driver?.cpf?.replace(/[^\d]/g, '') || 'cpf-nao-encontrado';

                    if (manifest) {
                        subfolder = `pagamento-de-motorista/${driverCpf}/romaneio-${sanitizeFilename(manifest.manifestCode)}`;
                        baseFilename = `romaneio_${sanitizeFilename(manifest.manifestCode)}`;
                    } else {
                        subfolder = `pagamento-de-motorista/${driverCpf}/cotacao-${sanitizeFilename(quote.quoteCode || quote.id)}`;
                        baseFilename = `cotacao_${sanitizeFilename(quote.quoteCode || quote.id)}`;
                    }
                }
            }
        }
        
        const uploadDir = join(process.cwd(), 'public', 'upload', 'comprovantes-despesas', subfolder);
        if (!existsSync(uploadDir)) {
            mkdirSync(uploadDir, { recursive: true });
        }
        
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'bin';
        
        const existingProofsCount = expense.proofs?.length || 0;
        const suffix = paymentUpdates.status === 'pago' ? '_final' : `_parcial${existingProofsCount + 1}`;
        const fileName = `${baseFilename}${suffix}.${fileExtension}`;
        const filePath = join(uploadDir, fileName);

        await writeFile(filePath, buffer);
        const publicPath = `/api/assets/upload/comprovantes-despesas/${subfolder}/${fileName}`;
        
        const newProof: PaymentProof = {
            url: publicPath,
            timestamp: new Date().toISOString(),
        };

        // --- Atualização e Histórico ---
        await db.collection('expenses').updateOne(
            { _id: new ObjectId(expenseId) },
            { 
                $set: paymentUpdates,
                $push: { proofs: newProof }
            }
        );
        
        await addHistoryEvent(db, new ObjectId(expenseId), user, 'Pagamento Registado', `Pagamento de ${formatCurrency(paidValue)} registado. Novo status: "${paymentUpdates.status}". Comprovativo: ${fileName}`);

        // --- Sincronização com Cotação ---
        if (expense.operationalEventId && expense.quoteId) {
            const operationalPaymentStatus: OperationalEvent['driverPaymentStatus'] = paymentUpdates.status === 'pago' ? 'pago' : 'parcial';
            
            await db.collection('quotes').updateOne(
                { _id: new ObjectId(expense.quoteId), "operationalHistory.id": expense.operationalEventId },
                { $set: { 
                    "operationalHistory.$.driverPaymentStatus": operationalPaymentStatus,
                    "operationalHistory.$.paidValue": newTotalPaid,
                } }
            );
        }

        return NextResponse.json({ success: true, path: publicPath });

    } catch (error: any) {
        console.error('API Upload Expense Proof Error:', error);
        return NextResponse.json({ success: false, message: `Erro interno do servidor: ${error.message}` }, { status: 500 });
    }
}


export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
     try {
        const pathname = new URL(request.url).pathname;
        const parts = pathname.split('/');
        const expenseId = parts[parts.length - 2];

        if (!ObjectId.isValid(expenseId)) {
            return NextResponse.json({ message: 'ID de despesa inválido' }, { status: 400 });
        }
        
        const { searchParams } = new URL(request.url);
        const userJson = searchParams.get('user');
        const user = userJson ? JSON.parse(userJson) : null;

        if (!user) {
            return NextResponse.json({ message: 'Utilizador não fornecido.' }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        const expense = await db.collection<Expense>('expenses').findOne({ _id: new ObjectId(expenseId) });

        if (!expense || !expense.proofs || expense.proofs.length === 0) {
            return NextResponse.json({ message: 'Nenhum comprovativo para remover.' }, { status: 404 });
        }
        
        const lastProof = expense.proofs[expense.proofs.length - 1];
        if (lastProof.url) {
            const oldFileRelativePath = lastProof.url.replace('/api/assets', '');
            const filePath = join(process.cwd(), 'public', oldFileRelativePath);
            if (existsSync(filePath)) {
                await unlink(filePath);
            }
        }
        
        await db.collection('expenses').updateOne(
            { _id: new ObjectId(expenseId) },
            { 
                $set: { status: 'pendente' }, // A lógica para reverter valor pago será mais complexa
                $pop: { proofs: 1 } // Remove o último comprovativo do array
            }
        );
        
        await addHistoryEvent(db, new ObjectId(expenseId), user, 'Pagamento Revertido', 'Último comprovativo removido e status da despesa alterado para pendente.');

        return NextResponse.json({ success: true, message: 'Último comprovativo removido e despesa marcada como pendente.' });

    } catch (error: any) {
        console.error('API Delete Expense Proof Error:', error);
        return NextResponse.json({ success: false, message: `Erro interno do servidor: ${error.message}` }, { status: 500 });
    }
}

function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
