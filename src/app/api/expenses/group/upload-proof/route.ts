import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Expense, ExpenseHistoryEvent, User, PaymentProof, OperationalEvent, Quote } from '@/lib/types';

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

const sanitizeFilename = (name: string) => {
    return name.replace(/[^a-z0-9\._-]/gi, '_').toLowerCase();
};

function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export async function POST(request: Request) {
    try {
        const data = await request.formData();
        const file: File | null = data.get('file') as unknown as File;
        const userJson: string | null = data.get('user') as string;
        const paidValueString: string | null = data.get('paidValue') as string;
        const groupId: string | null = data.get('groupId') as string;

        if (!userJson || !paidValueString || !groupId) {
            return NextResponse.json({ success: false, message: 'Dados do utilizador, valor de pagamento ou ID do grupo em falta.' }, { status: 400 });
        }

        const user: User = JSON.parse(userJson);
        const paidValue = parseFloat(paidValueString);

        if (!user || !user.id || !user.username || isNaN(paidValue) || paidValue <= 0) {
            return NextResponse.json({ success: false, message: 'Dados do utilizador ou valor do pagamento inválidos.' }, { status: 400 });
        }

        const { db } = await connectToDatabase();

        // 1. Busca todas as despesas pertencentes ao grupo
        const groupExpenses = await db.collection<Expense>('expenses').find({ groupId }).toArray();
        if (groupExpenses.length === 0) {
            return NextResponse.json({ success: false, message: 'Nenhuma despesa encontrada para este grupo.' }, { status: 404 });
        }

        // Filtra as despesas que ainda não foram totalmente pagas para realizar o rateio nelas
        const unpaidExpenses = groupExpenses.filter(e => e.status !== 'pago');
        if (unpaidExpenses.length === 0) {
            return NextResponse.json({ success: false, message: 'Todas as despesas deste grupo já estão pagas.' }, { status: 400 });
        }

        // 2. Calcula o valor pendente total
        const pendingValues = unpaidExpenses.map(e => {
            const pending = e.value - (e.paidValue || 0);
            return { expense: e, pending: Math.max(0, pending) };
        });

        const pendingTotal = pendingValues.reduce((sum, item) => sum + item.pending, 0);

        // 3. Processa o upload físico do arquivo se existir
        let publicPath = '';
        let fileName = '';
        if (file) {
            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            // Pasta dedicada para o grupo de despesas
            const subfolder = `comprovantes-grupo/${sanitizeFilename(groupId)}`;
            const uploadDir = join(process.cwd(), 'public', 'upload', 'comprovantes-despesas', subfolder);

            if (!existsSync(uploadDir)) {
                mkdirSync(uploadDir, { recursive: true });
            }

            const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'bin';
            const baseFilename = sanitizeFilename(groupExpenses[0].groupDescription || 'comprovante_grupo');
            fileName = `comprovante_${baseFilename}_${Date.now()}.${fileExtension}`;
            const filePath = join(uploadDir, fileName);

            await writeFile(filePath, buffer);
            publicPath = `/api/assets/upload/comprovantes-despesas/${subfolder}/${fileName}`;
        }

        const newProof: PaymentProof | null = publicPath ? {
            url: publicPath,
            timestamp: new Date().toISOString(),
        } : null;

        // 4. Rateia o valor do pagamento proporcionalmente entre as despesas não pagas
        let distributedTotal = 0;
        const updatesList: { expenseId: string; paidIncrement: number; newPaidValue: number; newStatus: Expense['status'] }[] = [];

        if (paidValue >= pendingTotal) {
            // Pagamento integral do valor restante de todas as despesas
            unpaidExpenses.forEach(e => {
                const pending = e.value - (e.paidValue || 0);
                updatesList.push({
                    expenseId: e._id!.toHexString(),
                    paidIncrement: pending,
                    newPaidValue: e.value,
                    newStatus: 'pago'
                });
            });
        } else {
            // Pagamento parcial do grupo: rateia de acordo com a proporção pendente de cada uma
            pendingValues.forEach((item, index) => {
                const ratio = item.pending / pendingTotal;
                let paidIncrement = Math.round((paidValue * ratio) * 100) / 100;
                
                updatesList.push({
                    expenseId: item.expense._id!.toHexString(),
                    paidIncrement,
                    newPaidValue: (item.expense.paidValue || 0) + paidIncrement,
                    newStatus: 'parcial' // provisório
                });
                distributedTotal += paidIncrement;
            });

            // Ajusta centavos se a soma dos arredondamentos diferir do total pago
            const difference = Math.round((paidValue - distributedTotal) * 100) / 100;
            if (difference !== 0 && updatesList.length > 0) {
                // Aplica a diferença na primeira despesa da lista que tem valor pendente
                const firstUpdate = updatesList[0];
                firstUpdate.paidIncrement = Math.round((firstUpdate.paidIncrement + difference) * 100) / 100;
                firstUpdate.newPaidValue = Math.round((firstUpdate.newPaidValue + difference) * 100) / 100;
            }

            // Recalcula o status final de cada uma após o incremento
            updatesList.forEach(up => {
                const exp = unpaidExpenses.find(e => e._id!.toHexString() === up.expenseId)!;
                if (up.newPaidValue >= exp.value) {
                    up.newStatus = 'pago';
                    up.newPaidValue = exp.value; // Garante que não ultrapasse
                } else {
                    up.newStatus = 'parcial';
                }
            });
        }

        // 5. Executa as atualizações no banco e sincronizações
        for (const up of updatesList) {
            const expId = new ObjectId(up.expenseId);
            const exp = unpaidExpenses.find(e => e._id!.toHexString() === up.expenseId)!;

            const paymentUpdates: any = {
                paidValue: up.newPaidValue,
                status: up.newStatus,
            };

            if (up.newStatus === 'pago') {
                paymentUpdates.paidAt = new Date().toISOString();
            }

            // Atualiza a despesa
            await db.collection('expenses').updateOne(
                { _id: expId },
                {
                    $set: paymentUpdates,
                    ...(newProof ? { $push: { proofs: newProof } } : {})
                }
            );

            // Adiciona histórico
            const proofDetails = fileName ? ` Comprovativo unificado: ${fileName}` : '';
            await addHistoryEvent(
                db, 
                expId, 
                user, 
                'Pagamento Registado', 
                `Pagamento unificado de ${formatCurrency(up.paidIncrement)} registado para o grupo "${exp.groupDescription}". Novo status: "${up.newStatus}".${proofDetails}`
            );

            // Sincroniza com Cotação/Histórico operacional se aplicável
            if (exp.operationalEventId && exp.quoteId) {
                const operationalPaymentStatus: OperationalEvent['driverPaymentStatus'] = up.newStatus === 'pago' ? 'pago' : 'parcial';
                
                await db.collection('quotes').updateOne(
                    { _id: new ObjectId(exp.quoteId), "operationalHistory.id": exp.operationalEventId },
                    { $set: { 
                        "operationalHistory.$.driverPaymentStatus": operationalPaymentStatus,
                        "operationalHistory.$.paidValue": up.newPaidValue,
                    } }
                );
            }
        }

        return NextResponse.json({ success: true, path: publicPath });

    } catch (error: any) {
        console.error('API Upload Group Expense Proof Error:', error);
        return NextResponse.json({ success: false, message: `Erro interno ao pagar o grupo: ${error.message}` }, { status: 500 });
    }
}
