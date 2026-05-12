import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get('term');
    const statusFilter = searchParams.get('status');

    if (!term) {
      return NextResponse.json({ message: 'O termo de busca é obrigatório.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    const isNumeric = !isNaN(parseFloat(term)) && isFinite(term as any);

    const orConditions: any[] = [
      { description: { $regex: term, $options: 'i' } },
      { categoryName: { $regex: term, $options: 'i' } },
      { notes: { $regex: term, $options: 'i' } }
    ];

    if (isNumeric) {
      orConditions.push({ value: parseFloat(term) });
    }
    
    const query: any = {
      $or: orConditions
    };
    
    if (statusFilter && statusFilter !== 'todos') {
        if (statusFilter === 'atraso') {
            query.status = 'pendente';
            query.dueDate = { $lt: new Date().toISOString() };
        } else {
            query.status = statusFilter;
        }
    }

    const expenses = await db.collection('expenses')
        .find(query)
        .sort({ dueDate: -1 })
        .limit(50)
        .toArray();
        
    const recurringExpenseMap = new Map<string, any>();
    const singleExpenses: any[] = [];
    
    // Group recurring expenses
    expenses.forEach(exp => {
      if (exp.isRecurring && exp.recurringId) {
        if (!recurringExpenseMap.has(exp.recurringId)) {
          recurringExpenseMap.set(exp.recurringId, {
            ...exp,
            description: exp.description.replace(/ \(\d+\/\d+\)$/, ''), // Clean description
            id: exp.recurringId, // Use recurringId as a unique key for the group
            isGroup: true,
            count: 0,
            monthYear: 'Recorrente', // Indicate it's a series
          });
        }
        recurringExpenseMap.get(exp.recurringId).count++;
      } else {
        singleExpenses.push(exp);
      }
    });

    const results = [...recurringExpenseMap.values(), ...singleExpenses];

    const resultsWithId = results.map(exp => {
      const { _id, ...rest } = exp;
      return { id: _id ? _id.toHexString() : rest.id, ...rest };
    });

    return NextResponse.json(resultsWithId);

  } catch (error: any) {
    console.error('API Expenses Search Error:', error);
    return NextResponse.json({ message: `Erro ao buscar despesas: ${error.message}` }, { status: 500 });
  }
}
