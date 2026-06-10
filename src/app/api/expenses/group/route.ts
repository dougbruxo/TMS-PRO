import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import type { Expense, ExpenseHistoryEvent, User } from '@/lib/types';

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

export async function POST(request: Request) {
  try {
    const { action, user, ...payload } = await request.json();

    if (!user || !user.username) {
      return NextResponse.json({ message: "Usuário não autenticado ou inválido." }, { status: 401 });
    }

    const { db } = await connectToDatabase();

    // --- AÇÃO: AGRUPAR ---
    if (action === 'group') {
      const { expenseIds, groupDescription } = payload;

      if (!expenseIds || !Array.isArray(expenseIds) || expenseIds.length < 2) {
        return NextResponse.json({ message: "Selecione pelo menos 2 despesas para agrupar." }, { status: 400 });
      }

      if (!groupDescription || !groupDescription.trim()) {
        return NextResponse.json({ message: "Descrição do grupo é obrigatória." }, { status: 400 });
      }

      const groupId = uuidv4();
      const objectIds = expenseIds.map(id => new ObjectId(id));

      // Atualiza todas as despesas selecionadas
      await db.collection('expenses').updateMany(
        { _id: { $in: objectIds } },
        { $set: { groupId, groupDescription } }
      );

      // Adiciona histórico para cada uma delas
      for (const id of objectIds) {
        await addHistoryEvent(db, id, user, 'Agrupamento', `Despesa agrupada no grupo "${groupDescription}" (ID: ${groupId}).`);
      }

      return NextResponse.json({ success: true, groupId, groupDescription });
    }

    // --- AÇÃO: DESAGRUPAR ---
    if (action === 'ungroup') {
      const { groupId } = payload;

      if (!groupId) {
        return NextResponse.json({ message: "ID do grupo não informado." }, { status: 400 });
      }

      // Encontra as despesas pertencentes ao grupo para registrar no histórico antes de remover os campos
      const groupExpenses = await db.collection<Expense>('expenses').find({ groupId }).toArray();

      if (groupExpenses.length === 0) {
        return NextResponse.json({ message: "Nenhuma despesa encontrada para este grupo." }, { status: 404 });
      }

      // Remove as propriedades de grupo
      await db.collection('expenses').updateMany(
        { groupId },
        { $unset: { groupId: "", groupDescription: "" } }
      );

      // Adiciona histórico individual
      for (const exp of groupExpenses) {
        await addHistoryEvent(db, exp._id, user, 'Desagrupamento', `Despesa desagrupada do grupo "${exp.groupDescription}".`);
      }

      return NextResponse.json({ success: true });
    }

    // --- AÇÃO: RELACIONAR EM LOTE (LINK) ---
    if (action === 'link') {
      const { groupId, linkType, linkId, linkName } = payload;

      if (!groupId || !linkType) {
        return NextResponse.json({ message: "Campos obrigatórios em falta para o relacionamento." }, { status: 400 });
      }

      // Encontra as despesas pertencentes ao grupo
      const groupExpenses = await db.collection<Expense>('expenses').find({ groupId }).toArray();
      if (groupExpenses.length === 0) {
        return NextResponse.json({ message: "Grupo de despesas não encontrado." }, { status: 404 });
      }

      // Define os updates baseados no linkType
      let updates: any = {};
      let actionName = 'Relacionamento em Lote';
      let details = '';

      if (linkId) {
        // Vinculando
        if (linkType === 'driver') {
          updates = { driverId: linkId, driverName: linkName };
          details = `Vinculado ao Motorista "${linkName}" em lote para o grupo.`;
        } else if (linkType === 'quote') {
          updates = { quoteId: linkId };
          details = `Vinculado à Cotação ID "${linkId}" em lote para o grupo.`;
        } else if (linkType === 'talent') {
          updates = { talentId: linkId, talentName: linkName };
          details = `Vinculado ao Talento "${linkName}" em lote para o grupo.`;
        } else if (linkType === 'customer') {
          updates = { customerId: linkId, customerName: linkName };
          details = `Vinculado ao Cliente/Fornecedor "${linkName}" em lote para o grupo.`;
        } else if (linkType === 'owner') {
          updates = { ownerId: linkId, ownerName: linkName };
          details = `Vinculado ao Proprietário "${linkName}" em lote para o grupo.`;
        }
      } else {
        // Desvinculando
        if (linkType === 'driver') {
          updates = { driverId: null, driverName: null };
          details = 'Desvinculado do Motorista em lote para o grupo.';
        } else if (linkType === 'quote') {
          updates = { quoteId: null };
          details = 'Desvinculado da Cotação em lote para o grupo.';
        } else if (linkType === 'talent') {
          updates = { talentId: null, talentName: null };
          details = 'Desvinculado do Talento em lote para o grupo.';
        } else if (linkType === 'customer') {
          updates = { customerId: null, customerName: null };
          details = 'Desvinculado do Cliente/Fornecedor em lote para o grupo.';
        } else if (linkType === 'owner') {
          updates = { ownerId: null, ownerName: null };
          details = 'Desvinculado do Proprietário em lote para o grupo.';
        }
      }

      // Se for desvinculação, precisamos usar $unset para campos específicos no MongoDB
      const updateQuery: any = {};
      const unsetFields: any = {};
      const setFields: any = {};

      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          unsetFields[key] = "";
        } else {
          setFields[key] = value;
        }
      }

      if (Object.keys(setFields).length > 0) updateQuery.$set = setFields;
      if (Object.keys(unsetFields).length > 0) updateQuery.$unset = unsetFields;

      await db.collection('expenses').updateMany({ groupId }, updateQuery);

      // Adiciona histórico
      for (const exp of groupExpenses) {
        await addHistoryEvent(db, exp._id, user, actionName, details);
      }

      return NextResponse.json({ success: true });
    }

    // --- AÇÃO: REVERTER PAGAMENTO EM LOTE ---
    if (action === 'revert-payment') {
      const { groupId } = payload;

      if (!groupId) {
        return NextResponse.json({ message: "ID do grupo não informado." }, { status: 400 });
      }

      // Encontra as despesas pertencentes ao grupo
      const groupExpenses = await db.collection<Expense>('expenses').find({ groupId }).toArray();
      if (groupExpenses.length === 0) {
        return NextResponse.json({ message: "Nenhuma despesa encontrada para este grupo." }, { status: 404 });
      }

      // Reverte status, paidValue e remove comprovantes de todas
      await db.collection('expenses').updateMany(
        { groupId },
        { 
          $set: { status: 'pendente', paidValue: 0 },
          $unset: { paidAt: "", proofs: "" }
        }
      );

      // Adiciona histórico e sincroniza cotações se aplicável
      for (const exp of groupExpenses) {
        await addHistoryEvent(db, exp._id, user, 'Pagamento Revertido', `Pagamento unificado do grupo "${exp.groupDescription}" revertido para pendente.`);

        if (exp.operationalEventId && exp.quoteId) {
          await db.collection('quotes').updateOne(
            { _id: new ObjectId(exp.quoteId), "operationalHistory.id": exp.operationalEventId },
            { $set: { 
                "operationalHistory.$.driverPaymentStatus": 'pendente',
                "operationalHistory.$.paidValue": 0,
            } }
          );
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: `Ação "${action}" inválida.` }, { status: 400 });

  } catch (error: any) {
    console.error('API Expenses Group POST Error:', error);
    return NextResponse.json({ message: `Erro ao processar ação no grupo de despesas: ${error.message}` }, { status: 500 });
  }
}
