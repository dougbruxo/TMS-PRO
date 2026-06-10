
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import type { Quote, QuoteHistoryEvent } from '@/lib/types';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { getUserFromRequest } from '@/lib/auth-api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limitParam = searchParams.get('limit');
    const status = searchParams.get('status');
    const excludeStatus = searchParams.get('excludeStatus');
    const monthYear = searchParams.get('monthYear');
    const term = searchParams.get('term');
    const paginated = searchParams.get('paginated') === 'true';

    let query: any = {};
    
    // Filtro de Segurança por Tenant — só restringe clientes
    if (authUser.role === 'cliente' || authUser.role === 'sub-cliente') {
        const tenantId = authUser.role === 'sub-cliente' ? authUser.parentId : authUser.userId;
        
        const { db: dbTemp } = await connectToDatabase();
        // Buscar todas as empresas vinculadas a este cliente B2B
        const clientCompanies = await dbTemp.collection('client_companies').find({ userId: tenantId }).toArray();
        const companyCnpjsCleaned = clientCompanies.map(c => c.cnpj.replace(/[^\d]/g, ''));
        const companyCnpjsRaw = clientCompanies.map(c => c.cnpj);
        const allCnpjs = Array.from(new Set([...companyCnpjsCleaned, ...companyCnpjsRaw]));
        
        const companyNames = clientCompanies.map(c => c.razaoSocial).filter(Boolean);
        const companyNomes = clientCompanies.map(c => c.nome).filter(Boolean);
        const companyNomesFantasia = clientCompanies.map(c => c.nomeFantasia).filter(Boolean);
        
        let customerIds: any[] = [];
        let customerNames: string[] = [];
        let customerNomes: string[] = [];
        let customerNomesFantasia: string[] = [];
        
        if (allCnpjs.length > 0) {
            const matchingCustomers = await dbTemp.collection('customers').find({ 
              cnpj: { $in: allCnpjs } 
            }).toArray();
            matchingCustomers.forEach(c => {
                customerIds.push(c._id.toHexString());
                customerIds.push(c._id);
                if (c.razaoSocial) customerNames.push(c.razaoSocial);
                if (c.nome) customerNomes.push(c.nome);
                if (c.nomeFantasia) customerNomesFantasia.push(c.nomeFantasia);
            });
        }
        
        const allPossibleNames = Array.from(new Set([
          ...companyNames,
          ...companyNomes,
          ...companyNomesFantasia,
          ...customerNames,
          ...customerNomes,
          ...customerNomesFantasia
        ])).filter(name => name.trim().length > 0);
        
        query.$or = [
          { userId: tenantId },
          { tomadorId: { $in: customerIds } },
          { tomador: { $in: allPossibleNames } }
        ];
    } else if (authUser.role === 'user' || authUser.role === 'parceiro') {
        const { db: dbTemp } = await connectToDatabase();
        const userDoc = await dbTemp.collection('users').findOne({ _id: new ObjectId(authUser.userId) });

        // Se o usuário tem permissão de análise e está buscando cotações "Em Análise", mostrar todas
        const isAnalysisQuery = status === 'Em Análise' && userDoc?.analyzeQuotesAccess;

        if (!isAnalysisQuery) {
            if (authUser.role === 'parceiro') {
                // Parceiros sempre veem apenas suas próprias cotações
                query.$or = [{ creatorId: authUser.userId }, { userId: authUser.userId }];
            } else if (userDoc && userDoc.subPermissions && userDoc.subPermissions.freight) {
               if (!userDoc.subPermissions.freight.canViewOthersQuotes) {
                   query.$or = [{ creatorId: authUser.userId }, { userId: authUser.userId }];
               }
            } else {
                 query.$or = [{ creatorId: authUser.userId }, { userId: authUser.userId }];
            }
        }
    }

    if (term) {
        const termFilter = [
            { quoteCode: { $regex: term, $options: 'i' } },
            { nfNumber: { $regex: term, $options: 'i' } },
            { destinatario: { $regex: term, $options: 'i' } },
            { empresaDestino: { $regex: term, $options: 'i' } },
            { remetente: { $regex: term, $options: 'i' } },
            { cidadeOrigem: { $regex: term, $options: 'i' } },
            { cidadeDestino: { $regex: term, $options: 'i' } }
        ];
        if (query.$or) {
            // Já existe um $or de segurança — combinar com $and
            const securityOr = query.$or;
            delete query.$or;
            query.$and = [{ $or: securityOr }, { $or: termFilter }];
        } else {
            query.$or = termFilter;
        }
    }

    if (status) {
        if (status === 'billing_all') {
            query.status = { $nin: ['Aberta', 'Em Análise'] };
        } else if (status === 'all_operational') {
            query.status = { $in: ['Fechada', 'Coleta', 'Aguardando Recebimento', 'No Galpão', 'Aguardando Saída', 'Em Carregamento'] };
        } else if (status.includes(',')) {
            query.status = { $in: status.split(',') };
        } else {
            query.status = status;
        }
    } else if (excludeStatus) {
        query.status = { $ne: excludeStatus };
    }
    
    if (monthYear) {
      const [year, month] = monthYear.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);
      query.billingDueDate = {
        $gte: startDate.toISOString(),
        $lt: endDate.toISOString(),
      };
    }
    
    const { db } = await connectToDatabase();
    
    const projection = {
        history: 0,
        billingHistory: 0,
    };
    
    let totalCount = 0;
    if (paginated) {
        totalCount = await db.collection('quotes').countDocuments(query);
    }
    
    const queryBuilder = db.collection('quotes').find(query, { projection }).sort({ data: -1 });

    if (limitParam) {
        const limit = parseInt(limitParam, 10);
        const skip = (page - 1) * limit;
        queryBuilder.skip(skip).limit(limit);
    } else if (paginated) {
        // Limite padrão para paginação se não especificado
        queryBuilder.skip((page - 1) * 20).limit(20);
    }
    
    const quotes = await queryBuilder.toArray();
    
    const quotesWithId = quotes.map(quote => {
      const { _id, ...rest } = quote;
      return { id: _id.toHexString(), ...rest };
    });

    if (paginated) {
        const limit = limitParam ? parseInt(limitParam, 10) : 20;
        return NextResponse.json({
            quotes: quotesWithId,
            totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            limit
        });
    }

    return NextResponse.json(quotesWithId);
  } catch (error: any) {
    console.error('API Quotes GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar cotações: ${error.message}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });

    const quoteData = await request.json();
    const { db } = await connectToDatabase();
    
    // No POST, usamos o usuário autenticado, mas permitimos passar 'userId' corporativo se for admin
    let targetUserId = authUser.userId;
    if (authUser.role === 'sub-cliente') {
        targetUserId = authUser.parentId || authUser.userId;
    }

    const { userId: bodyUserId, ...restOfQuoteData } = quoteData;
    
    // Se for admin, pode criar cotação em nome de qualquer usuário
    const userIdToUse = authUser.role === 'admin' && bodyUserId ? bodyUserId : targetUserId;

    const user = await db.collection('users').findOne({ _id: new ObjectId(authUser.userId) });
    if (!user) {
        return NextResponse.json({ message: "Usuário autenticado não encontrado." }, { status: 404 });
    }
    
    const counterResult = await db.collection<any>('counters').findOneAndUpdate(
        { _id: 'quoteSequence' },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' }
    );
    // Depending on mongodb driver version, it's either in .value or directly returned
    let sequentialNumber = counterResult?.value?.seq || counterResult?.seq;

    // If it's the very first time running this (seq === 1), let's sync with existing documents to avoid resetting to 1
    if (sequentialNumber === 1) {
        const totalQuotes = await db.collection('quotes').countDocuments();
        if (totalQuotes > 0) {
            sequentialNumber = totalQuotes + 1;
            await db.collection<any>('counters').updateOne({ _id: 'quoteSequence' }, { $set: { seq: sequentialNumber } });
        }
    }
    
    let quoteCode;

    if (restOfQuoteData.isGrouped) {
        quoteCode = `AGRP-${sequentialNumber}`;
    } else {
        const randomLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        quoteCode = `${sequentialNumber}${randomLetter}`;
    }


    const effectiveUserId = user.isSubClient ? user.parentId : user._id.toHexString();

    const historyEvent: QuoteHistoryEvent = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        userId: user._id.toHexString(), // O registro do log de sistema mantém a autoria exata do subcliente
        username: user.username,
        action: 'CRIADA',
        details: `Cotação criada por ${user.username}.`
    };

    const quoteToInsert: any = {
        ...restOfQuoteData,
        userId: userIdToUse, // ID Tenant (Matriz)
        creatorId: authUser.userId, // ID Real (Colaborador)
        usuario: user.username,
        data: new Date().toISOString(),
        quoteCode: quoteCode,
        history: [historyEvent],
    };

    // Parceiros com aprovação obrigatória: cotação entra como "Em Análise"
    if (user.requiresQuoteApproval) {
        quoteToInsert.status = 'Em Análise';
        quoteToInsert.history[0].details = `Cotação criada por ${user.username} (Parceiro). Aguardando aprovação.`;
    }
    
    delete quoteToInsert.id;

    const result = await db.collection('quotes').insertOne(quoteToInsert as Omit<Quote, 'id'>);
    const newQuoteId = result.insertedId;

    if (restOfQuoteData.isGrouped && restOfQuoteData.groupedQuoteIds) {
        const childQuoteObjectIds = restOfQuoteData.groupedQuoteIds.map((id: string) => new ObjectId(id));
        await db.collection('quotes').updateMany(
            { _id: { $in: childQuoteObjectIds } },
            { $set: { parentQuoteId: newQuoteId.toHexString() } }
        );
    }
    
    const newQuoteFromDb = await db.collection('quotes').findOne({ _id: newQuoteId });
    
    if (!newQuoteFromDb) {
        return NextResponse.json({ message: "Erro ao recuperar a cotação após a criação" }, { status: 500 });
    }
    
    const { _id, ...rest } = newQuoteFromDb;
    const newQuote = { id: _id.toHexString(), ...rest };

    return NextResponse.json({ message: "Cotação criada com sucesso", quote: newQuote }, { status: 201 });
  } catch (error: any)
   {
     console.error('API Quotes POST Error:', error);
    return NextResponse.json({ message: `Erro ao criar cotação: ${error.message}` }, { status: 500 });
  }
}
