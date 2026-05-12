
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { parseISO } from 'date-fns';
import type { Expense, ExpenseHistoryEvent, User, OperationalEvent, Quote } from '@/lib/types';

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

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1]; 
    
    const { updateFuture, user, ...updates } = await request.json();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de despesa inválido" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    delete updates._id;

    const originalExpense = await db.collection<Expense>('expenses').findOne({ _id: new ObjectId(id) });
    if (!originalExpense) {
        return NextResponse.json({ message: "Despesa não encontrada" }, { status: 404 });
    }
    
    // Logic for handling payments
    if(updates.paidValue && user) {
        const amountBeingPaid = updates.paidValue;
        const amountAlreadyPaid = originalExpense.paidValue || 0;
        const newTotalPaid = amountAlreadyPaid + amountBeingPaid;

        updates.paidValue = newTotalPaid;
        
        if (newTotalPaid >= originalExpense.value) {
            updates.status = 'pago';
            updates.paidAt = new Date().toISOString();
        } else {
            updates.status = 'parcial';
        }
        await addHistoryEvent(db, new ObjectId(id), user, 'Pagamento Registado', `Pagamento de ${amountBeingPaid.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} registado. Novo status: "${updates.status}".`);
    } else if (user) {
        let details = 'Despesa atualizada.';
        if (updates.status && updates.status !== originalExpense.status) {
            details = `Status alterado para "${updates.status}".`;
        }
        await addHistoryEvent(db, new ObjectId(id), user, 'Alteração', details);
    }
    
    // Check if this expense is linked to a quote's operational event
    if (originalExpense.operationalEventId && originalExpense.quoteId && (updates.status === 'pago' || updates.status === 'parcial')) {
        let paymentStatus: OperationalEvent['driverPaymentStatus'] = 'parcial';
        if (updates.status === 'pago') {
            paymentStatus = 'pago';
        }
        
        await db.collection('quotes').updateOne(
            { _id: new ObjectId(originalExpense.quoteId), "operationalHistory.id": originalExpense.operationalEventId },
            { $set: { "operationalHistory.$.driverPaymentStatus": paymentStatus, "operationalHistory.$.paidValue": updates.paidValue } }
        );
    }


    if (updates.isRecurring && updates.recurringId && updateFuture) {
        const originalDueDate = parseISO(originalExpense.dueDate);

        const futureUpdates: any = { ...updates };
        delete futureUpdates.status; 
        delete futureUpdates.paidAt;
        delete futureUpdates.proofs;
        delete futureUpdates.paidValue; // Do not propagate payment values to future recurring expenses

        await db.collection('expenses').updateMany(
            { 
                recurringId: updates.recurringId,
                dueDate: { $gte: originalDueDate.toISOString() }
            },
            { $set: futureUpdates }
        );
        // Add history to all updated recurring expenses
        const futureExpenses = await db.collection('expenses').find({ recurringId: updates.recurringId, dueDate: { $gte: originalDueDate.toISOString() } }).project({_id: 1}).toArray();
        for (const exp of futureExpenses) {
            if (exp._id.toHexString() !== id) {
                 await addHistoryEvent(db, exp._id, user, 'Alteração Recorrente', 'Alterações da despesa recorrente aplicadas.');
            }
        }

    } else {
        await db.collection('expenses').updateOne(
            { _id: new ObjectId(id) },
            { $set: updates }
        );
    }

    return NextResponse.json({ message: "Despesa atualizada com sucesso" }, { status: 200 });
  } catch (error: any) {
    console.error('API Expense PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar despesa: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1]; 

    const { searchParams } = new URL(request.url);
    const deleteAllFuture = searchParams.get('deleteAllFuture') === 'true';

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de despesa inválido" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const expenseToDelete = await db.collection('expenses').findOne({ _id: new ObjectId(id) });

    if (!expenseToDelete) {
      return NextResponse.json({ message: "Despesa não encontrada" }, { status: 404 });
    }

    if (expenseToDelete.isRecurring === true && deleteAllFuture) {
        const originalDueDate = parseISO(expenseToDelete.dueDate);
        await db.collection('expenses').deleteMany({
            recurringId: expenseToDelete.recurringId,
            dueDate: { $gte: originalDueDate.toISOString() }
        });
    } else {
        await db.collection('expenses').deleteOne({ _id: new ObjectId(id) });
    }

    return NextResponse.json({ message: "Despesa(s) removida(s) com sucesso" }, { status: 200 });
  } catch (error: any) {
    console.error('API Expense DELETE Error:', error);
    return NextResponse.json({ message: `Erro ao remover despesa: ${error.message}` }, { status: 500 });
  }
}
