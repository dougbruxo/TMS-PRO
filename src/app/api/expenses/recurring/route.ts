
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { addMonths, format, parseISO } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type { Expense } from '@/lib/types';

// This endpoint handles the creation of RECURRING expenses for the next X months.
export async function POST(request: Request) {
    try {
        const { userId, count, ...expenseData } = await request.json();

        if (!userId || !expenseData.description || !expenseData.categoryId || !expenseData.value || !expenseData.dueDate) {
            return NextResponse.json({ message: "Campos obrigatórios para despesa recorrente em falta." }, { status: 400 });
        }
        
        const { db } = await connectToDatabase();
        
        const category = await db.collection('expense_categories').findOne({ _id: new ObjectId(expenseData.categoryId) });
        const categoryName = category?.name || 'Desconhecida';
        
        const recurringId = uuidv4();
        const startDate = parseISO(expenseData.dueDate);
        const expensesToInsert: Omit<Expense, 'id'>[] = [];
        const numberOfMonths = count || 12; // Use count from request or default to 12

        for (let i = 0; i < numberOfMonths; i++) {
            const futureDate = addMonths(startDate, i);
            const newExpense: Omit<Expense, 'id'> = {
                ...expenseData,
                createdBy: userId,
                createdAt: new Date().toISOString(),
                status: 'pendente',
                categoryName: categoryName,
                isRecurring: true,
                recurringId: recurringId,
                dueDate: futureDate.toISOString(),
                monthYear: format(futureDate, 'yyyy-MM'),
            };
            expensesToInsert.push(newExpense as any);
        }

        await db.collection('expenses').insertMany(expensesToInsert);
        
        return NextResponse.json({ success: true, message: 'Despesas recorrentes criadas com sucesso.' }, { status: 201 });

    } catch (error: any) {
        console.error('API Recurring Expenses POST Error:', error);
        return NextResponse.json({ message: `Erro ao criar despesas recorrentes: ${error.message}` }, { status: 500 });
    }
}
