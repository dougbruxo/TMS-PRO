

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Expense, ExpenseCategory, ExpenseHistoryEvent, User, Quote } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driverId');
    const status = searchParams.get('status');
    const monthYear = searchParams.get('monthYear');

    const { db } = await connectToDatabase();
    
    const query: any = {};

    if (status) {
        query.status = status;
    }
    
    if (monthYear) {
      // Match by monthYear field OR by dueDate falling within the month
      const [year, month] = monthYear.split('-').map(Number);
      const startOfMonth = new Date(year, month - 1, 1).toISOString();
      const startOfNextMonth = new Date(year, month, 1).toISOString();
      query.$or = [
        { monthYear },
        { monthYear: { $exists: false }, dueDate: { $gte: startOfMonth, $lt: startOfNextMonth } }
      ];
    }


    if (driverId && ObjectId.isValid(driverId)) {
        // Lógica simplificada e correta para encontrar despesas do motorista
        
        // 1. Encontra todas as cotações onde o motorista participou e extrai apenas o histórico operacional.
        const quotesWithDriverEvents = await db.collection<Quote>('quotes').find(
            { "operationalHistory.driverId": driverId },
            { projection: { operationalHistory: 1 } }
        ).toArray();

        // 2. Extrai os IDs de todos os eventos operacionais pertencentes a este motorista.
        const eventIdsForDriver: string[] = [];
        quotesWithDriverEvents.forEach(quote => {
            quote.operationalHistory?.forEach(event => {
                if (event.driverId === driverId && event.id) {
                    eventIdsForDriver.push(event.id);
                }
            });
        });

        // 3. Constrói a query para buscar despesas cujo 'operationalEventId' esteja na lista que criámos.
        if (eventIdsForDriver.length > 0) {
            query.operationalEventId = { $in: eventIdsForDriver };
        } else {
            // Se não houver eventos, não há despesas para este motorista, retorna um array vazio.
            return NextResponse.json([]);
        }
    }

    const expenses = await db.collection('expenses').find(query).sort({ dueDate: 1 }).toArray();
    
    // Enrich with category name
    const categories = await db.collection('expense_categories').find({}).toArray();
    const categoryMap = new Map(categories.map(c => [c._id.toString(), c.name]));

    const expensesWithDetails = expenses.map(exp => {
      const { _id, ...rest } = exp;
      return { 
        id: _id.toHexString(), 
        ...rest,
        categoryName: categoryMap.get(rest.categoryId) || 'Sem Categoria'
      };
    });

    return NextResponse.json(expensesWithDetails);
  } catch (error: any) {
    console.error('API Expenses GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar despesas: ${error.message}` }, { status: 500 });
  }
}

// This endpoint now only handles SINGLE expense creation
export async function POST(request: Request) {
  try {
    const { userId, user, ...expenseData } = await request.json();

    if (!userId || !user || !expenseData.description || !expenseData.categoryId || !expenseData.value || !expenseData.dueDate) {
        return NextResponse.json({ message: "Campos obrigatórios em falta." }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // If categoryId is a custom string like 'TALENTOS', get the document
    let categoryObjectId;
    let categoryIdString;

    if (ObjectId.isValid(expenseData.categoryId)) {
        categoryObjectId = new ObjectId(expenseData.categoryId);
        categoryIdString = categoryObjectId.toHexString();
    } else {
        // It's a string ID like 'TALENTOS' or 'DRIVER_PAYMENT'
        const foundCategory = await db.collection('expense_categories').findOne({ _id: expenseData.categoryId });
        if (!foundCategory) {
            return NextResponse.json({ message: `Categoria com ID '${expenseData.categoryId}' não encontrada.` }, { status: 404 });
        }
        categoryObjectId = foundCategory._id; // This could be a string or an ObjectId
        categoryIdString = String(categoryObjectId);
    }

    const category = await db.collection('expense_categories').findOne({ _id: categoryObjectId });

    const historyEvent: ExpenseHistoryEvent = {
        timestamp: new Date().toISOString(),
        user: user.username,
        action: 'Criação',
        details: 'Despesa criada no sistema.'
    };

    const newExpense: Omit<Expense, 'id'> = {
      ...expenseData,
      categoryId: categoryIdString, // Ensure it's a string for consistency in the model
      createdBy: userId,
      createdAt: new Date().toISOString(),
      status: 'pendente',
      categoryName: category?.name || 'Desconhecida',
      isRecurring: false, // Always false for single creation
      history: [historyEvent]
    };
    
    const result = await db.collection('expenses').insertOne(newExpense as any);

    return NextResponse.json({ id: result.insertedId.toHexString(), ...newExpense }, { status: 201 });

  } catch (error: any) {
    console.error('API Expenses POST Error:', error);
    return NextResponse.json({ message: `Erro ao criar despesa: ${error.message}` }, { status: 500 });
  }
}
