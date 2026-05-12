import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Invoice, BillingHistoryEvent, User } from '@/lib/types';
import { format, parseISO } from 'date-fns';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1]; 

    const body = await request.json();
    const { user, ...updates } = body;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID da fatura inválido" }, { status: 400 });
    }
    if (!user || !user.id || !user.username) {
        return NextResponse.json({ message: "Utilizador não fornecido ou inválido." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const originalInvoice = await db.collection<Invoice>('invoices').findOne({ _id: new ObjectId(id) });

    if (!originalInvoice) {
      return NextResponse.json({ message: "Fatura não encontrada" }, { status: 404 });
    }
    
    const historyEvents: BillingHistoryEvent[] = [];

    // Handle Discount
    if (updates.desconto !== undefined && updates.desconto !== originalInvoice.desconto) {
        historyEvents.push({
            id: `hist-${Date.now()}-desc`,
            timestamp: new Date().toISOString(),
            userId: user.id,
            username: user.username,
            action: 'DESCONTO_APLICADO',
            details: `Desconto de ${updates.desconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} aplicado.`
        });
    }

    // Handle Due Date Change
    if (updates.billingDueDate && updates.billingDueDate !== originalInvoice.billingDueDate) {
        historyEvents.push({
            id: `hist-${Date.now()}-due`,
            timestamp: new Date().toISOString(),
            userId: user.id,
            username: user.username,
            action: 'VENCIMENTO_ALTERADO',
            details: `Vencimento alterado para ${format(parseISO(updates.billingDueDate), 'dd/MM/yyyy')}.`
        });
    }

    // Handle Payment
    if (updates.paidAmount !== undefined && updates.paidAmount > (originalInvoice.paidAmount || 0)) {
        const amountBeingPaid = updates.paidAmount - (originalInvoice.paidAmount || 0);
        historyEvents.push({
            id: `hist-${Date.now()}-pay`,
            timestamp: new Date().toISOString(),
            userId: user.id,
            username: user.username,
            action: 'PAGAMENTO_REGISTRADO',
            details: `Pagamento de ${amountBeingPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} registrado.`
        });
    }

    // Recalculate status based on final values
    const finalDesconto = updates.desconto ?? originalInvoice.desconto ?? 0;
    const finalPaidAmount = updates.paidAmount ?? originalInvoice.paidAmount ?? 0;
    const netValue = originalInvoice.totalValue - finalDesconto;

    if (finalPaidAmount >= netValue) {
        updates.status = 'Pago';
        updates.paymentDate = body.paymentDate || originalInvoice.paymentDate || new Date().toISOString();
    } else if (finalPaidAmount > 0) {
        updates.status = 'Parcial';
        updates.paymentDate = null;
    } else {
        updates.status = 'Pendente';
        updates.paymentDate = null;
    }
    
    if (updates.status !== originalInvoice.status && historyEvents.length > 0) {
        historyEvents[historyEvents.length - 1].details += ` Novo status: "${updates.status}".`;
    }

    const updateQuery: any = {};
    if (Object.keys(updates).length > 0) {
        updateQuery.$set = updates;
    }
    if (historyEvents.length > 0) {
        updateQuery.$push = { billingHistory: { $each: historyEvents, $position: 0 } };
    }

    if (Object.keys(updateQuery).length === 0) {
        return NextResponse.json({ message: "Nenhuma alteração detectada." }, { status: 200 });
    }

    const result = await db.collection('invoices').updateOne(
      { _id: new ObjectId(id) },
      updateQuery
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Fatura não encontrada durante a atualização" }, { status: 404 });
    }
    
    // Propagate payment status and due date to child quotes
    if (originalInvoice.quoteIds && originalInvoice.quoteIds.length > 0) {
        const childQuoteObjectIds = originalInvoice.quoteIds.map((id: string) => new ObjectId(id));
        const childQuotesUpdate: any = {};
        if (updates.status) childQuotesUpdate.paymentStatus = updates.status;
        if (updates.paymentDate) childQuotesUpdate.paymentDate = updates.paymentDate;
        if (updates.billingDueDate) childQuotesUpdate.billingDueDate = updates.billingDueDate;

        if (Object.keys(childQuotesUpdate).length > 0) {
             await db.collection('quotes').updateMany(
              { _id: { $in: childQuoteObjectIds } },
              { $set: childQuotesUpdate }
            );
        }
    }

    return NextResponse.json({ message: "Fatura atualizada com sucesso" });
  } catch (error: any) {
    console.error('API Invoice PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar fatura: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts[parts.length - 1];

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "ID de fatura inválido" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const invoiceToDelete = await db.collection<Invoice>('invoices').findOne({ _id: new ObjectId(id) });
    if (!invoiceToDelete) {
        return NextResponse.json({ message: "Fatura não encontrada" }, { status: 404 });
    }
    
    // Revert quotes linked to this invoice
    if (invoiceToDelete.quoteIds && invoiceToDelete.quoteIds.length > 0) {
        const childQuoteObjectIds = invoiceToDelete.quoteIds.map((id: string) => new ObjectId(id));
        await db.collection('quotes').updateMany(
          { _id: { $in: childQuoteObjectIds } },
          { $unset: { invoiceId: "" }, $set: { paymentStatus: 'Pendente' } }
        );
    }
    
    const result = await db.collection('invoices').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ message: "Fatura não encontrada durante a exclusão" }, { status: 404 });
    }

    return NextResponse.json({ message: "Fatura apagada com sucesso" });
  } catch (error: any) {
    console.error('API Invoice DELETE Error:', error);
    return NextResponse.json({ message: `Erro ao apagar fatura: ${error.message}` }, { status: 500 });
  }
}
