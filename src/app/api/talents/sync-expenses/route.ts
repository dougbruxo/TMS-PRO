
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { format, addMonths, setDate, parseISO } from 'date-fns';
import type { Talent, Expense } from '@/lib/types';

export async function POST(request: Request) {
    try {
        const { talentId, talent, userId } = await request.json();

        if (!talentId || !talent || !userId) {
            return NextResponse.json({ message: 'Dados insuficientes.' }, { status: 400 });
        }

        const { db } = await connectToDatabase();

        const salaryCategoryId = 'SALARY';
        const advanceCategoryId = 'ADVANCE';

        await db.collection('expenseCategories').updateOne(
            { _id: salaryCategoryId },
            { $setOnInsert: { name: 'Salário', createdBy: userId, createdAt: new Date().toISOString() } },
            { upsert: true }
        );
        await db.collection('expenseCategories').updateOne(
            { _id: advanceCategoryId },
            { $setOnInsert: { name: 'Adiantamento', createdBy: userId, createdAt: new Date().toISOString() } },
            { upsert: true }
        );

        const now = new Date();
        for (let i = 0; i < 12; i++) { // Create/update for the next 12 months
            const targetMonth = addMonths(now, i);

            // Adiantamento
            const advanceDate = setDate(targetMonth, talent.advancePayslipConfig[0]?.reference || 20);
            const advanceMonthYear = format(advanceDate, 'yyyy-MM');
            const advanceExpense: Omit<Expense, 'id'> = {
                monthYear: advanceMonthYear,
                description: `Adiantamento - ${talent.fullName}`,
                categoryId: advanceCategoryId,
                categoryName: 'Adiantamento',
                value: talent.advancePayslipConfig.reduce((acc, item) => acc + item.earnings, 0),
                dueDate: advanceDate.toISOString(),
                status: 'pendente',
                isRecurring: true,
                recurringId: talentId,
                createdBy: userId,
                createdAt: new Date().toISOString(),
            };
             await db.collection('expenses').updateOne(
                { recurringId: talentId, categoryId: advanceCategoryId, monthYear: advanceMonthYear },
                { $set: advanceExpense },
                { upsert: true }
            );

            // Salário Final
            const finalPaymentDate = setDate(addMonths(targetMonth, 1), talent.payslipConfig[0]?.reference || 5);
            const finalPaymentMonthYear = format(finalPaymentDate, 'yyyy-MM');
            const finalPaymentExpense: Omit<Expense, 'id'> = {
                monthYear: finalPaymentMonthYear,
                description: `Salário - ${talent.fullName}`,
                categoryId: salaryCategoryId,
                categoryName: 'Salário',
                value: talent.baseSalary,
                dueDate: finalPaymentDate.toISOString(),
                status: 'pendente',
                isRecurring: true,
                recurringId: talentId,
                createdBy: userId,
                createdAt: new Date().toISOString(),
            };
             await db.collection('expenses').updateOne(
                { recurringId: talentId, categoryId: salaryCategoryId, monthYear: finalPaymentMonthYear },
                { $set: finalPaymentExpense },
                { upsert: true }
            );
        }
        
        return NextResponse.json({ message: 'Despesas sincronizadas com sucesso.' });

    } catch (error: any) {
        console.error('API Sync Expenses Error:', error);
        return NextResponse.json({ message: `Erro ao sincronizar despesas: ${error.message}` }, { status: 500 });
    }
}
