
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { addMonths, format, parseISO } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { Expense, ExpenseHistoryEvent } from '@/lib/types';

export async function POST(request: Request) {
    try {
        const { userId, user, ...expenseData } = await request.json();

        if (!userId || !expenseData.description || !expenseData.categoryId || !expenseData.value || !expenseData.dueDate || !expenseData.installmentCount) {
            return NextResponse.json({ message: "Campos obrigatórios para despesa parcelada em falta." }, { status: 400 });
        }
        
        const { db } = await connectToDatabase();
        
        const category = await db.collection('expense_categories').findOne({ _id: new ObjectId(expenseData.categoryId) });
        const categoryName = category?.name || 'Desconhecida';
        
        const installmentId = uuidv4();
        const startDate = parseISO(expenseData.dueDate);
        const totalValue = parseFloat(expenseData.value);
        const installmentCount = parseInt(expenseData.installmentCount, 10);
        
        // Correctly calculate installment values
        const baseInstallmentValue = Math.floor((totalValue / installmentCount) * 100) / 100;
        const firstInstallmentValue = totalValue - (baseInstallmentValue * (installmentCount - 1));

        const expensesToInsert: Omit<Expense, 'id'>[] = [];

        const historyEvent: ExpenseHistoryEvent = {
            timestamp: new Date().toISOString(),
            user: user?.username || 'Sistema',
            action: 'Criação em Lote (Parcelamento)',
            details: `Despesa criada como parte de um parcelamento de ${installmentCount}x.`
        };

        for (let i = 0; i < installmentCount; i++) {
            const futureDate = addMonths(startDate, i);
            const installmentValue = i === 0 ? firstInstallmentValue : baseInstallmentValue;

            const newExpense: Omit<Expense, 'id'> = {
                ...expenseData,
                value: installmentValue,
                description: `${expenseData.description} (${i + 1}/${installmentCount})`,
                createdBy: userId,
                createdAt: new Date().toISOString(),
                status: 'pendente',
                categoryName: categoryName,
                isRecurring: false,
                isInstallment: true,
                installmentId: installmentId,
                installmentNumber: i + 1,
                installmentTotal: installmentCount,
                dueDate: futureDate.toISOString(),
                monthYear: format(futureDate, 'yyyy-MM'),
                history: [historyEvent]
            };
            // Remove installmentCount from the individual expense object as it's not part of the model
            delete (newExpense as any).installmentCount;
            expensesToInsert.push(newExpense as any);
        }

        await db.collection('expenses').insertMany(expensesToInsert);
        
        return NextResponse.json({ success: true, message: 'Despesas parceladas criadas com sucesso.' }, { status: 201 });

    } catch (error: any) {
        console.error('API Installment Expenses POST Error:', error);
        return NextResponse.json({ message: `Erro ao criar despesas parceladas: ${error.message}` }, { status: 500 });
    }
}
