

import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import { parseISO, endOfDay } from 'date-fns';
import type { Quote, User, Talent } from '@/lib/types';

export async function POST(request: Request) {
    try {
        const { talentId, startDateStr, endDateStr } = await request.json();

        if (!talentId || !startDateStr || !endDateStr) {
            return NextResponse.json({ message: "talentId, startDateStr e endDateStr são obrigatórios." }, { status: 400 });
        }
        
        if (!ObjectId.isValid(talentId)) {
            return NextResponse.json({ message: "talentId inválido." }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        
        const talent = await db.collection<Talent>('talents').findOne({ _id: new ObjectId(talentId) });

        if (!talent || !talent.userId || !ObjectId.isValid(talent.userId.toString())) {
             return NextResponse.json({ 
                totalBonus: 0, 
                eligibleQuotes: [], 
                paidQuotes: [],
                message: 'Talento não encontrado ou não vinculado a um usuário do sistema.' 
            }, { status: 200 });
        }
        
        const userObjectId = new ObjectId(talent.userId);
        const user = await db.collection<Omit<User,'id'>>('users').findOne({ _id: userObjectId });
        
        if (!user || typeof user.salesBonusPercentage !== 'number') {
            return NextResponse.json({ 
                totalBonus: 0, 
                eligibleQuotes: [], 
                paidQuotes: [],
                message: 'Utilizador não encontrado ou sem taxa de bônus configurada.' 
            }, { status: 200 });
        }
        
        const bonusPercentage = user.salesBonusPercentage;
        const startDate = parseISO(startDateStr);
        const endDate = endOfDay(parseISO(endDateStr));
        
        const talentUserIdStr = userObjectId.toHexString();
        
        const baseQuery = {
            status: 'Finalizado' as const,
            $or: [
                { userId: userObjectId },
                { userId: talentUserIdStr },
                { creatorId: userObjectId },
                { creatorId: talentUserIdStr }
            ],
            $and: [
                {
                    $or: [
                        { closedAt: { $gte: startDate.toISOString(), $lte: endDate.toISOString() } },
                        { 
                            closedAt: { $exists: false },
                            data: { $gte: startDate.toISOString(), $lte: endDate.toISOString() }
                        }
                    ]
                }
            ]
        };
        
        const allFinalizedQuotes = await db.collection('quotes').find(baseQuery).toArray();
        
        const eligibleQuotesData: Quote[] = [];
        const paidQuotesData: Quote[] = [];

        allFinalizedQuotes.forEach(quoteDoc => {
            const { _id, ...quoteData } = quoteDoc;
            const quoteWithId = { ...quoteData, id: _id.toHexString() } as unknown as Quote;
            if (quoteWithId.paidPayslipId) {
                paidQuotesData.push(quoteWithId);
            } else {
                eligibleQuotesData.push(quoteWithId);
            }
        });
        
        let totalBonus = 0;
        eligibleQuotesData.forEach(quote => {
            const grossProfit = quote.grossProfit || 0;
            const totalExpense = quote.totalExpense || 0;
            const netProfit = grossProfit - totalExpense;

            if (netProfit > 0) {
                const quoteBonus = netProfit * (bonusPercentage / 100);
                totalBonus += quoteBonus;
            }
        });

        if (eligibleQuotesData.length === 0 && paidQuotesData.length > 0) {
             return NextResponse.json({ 
                totalBonus: 0, 
                eligibleQuotes: [], 
                paidQuotes: paidQuotesData,
                message: `Todas as ${paidQuotesData.length} cotações elegíveis neste período já foram incluídas num holerite anterior.`
            }, { status: 200 });
        }
        
        if(totalBonus === 0 && eligibleQuotesData.length > 0) {
             return NextResponse.json({ 
                totalBonus: 0, 
                eligibleQuotes: eligibleQuotesData, 
                paidQuotes: paidQuotesData,
                message: `Nenhuma das ${eligibleQuotesData.length} cotações elegíveis gerou lucro líquido positivo para cálculo de bônus.`
            }, { status: 200 });
        }
        
        if(totalBonus === 0 && eligibleQuotesData.length === 0 && paidQuotesData.length === 0) {
            return NextResponse.json({ 
                totalBonus: 0, 
                eligibleQuotes: [], 
                paidQuotes: [],
                message: 'Nenhuma cotação finalizada encontrada para este talento no período selecionado.' 
            }, { status: 200 });
        }

        return NextResponse.json({ 
            totalBonus, 
            eligibleQuotes: eligibleQuotesData,
            paidQuotes: paidQuotesData,
        });

    } catch (error: any) {
        console.error("[API Bonus] ERRO INESPERADO:", error);
        return NextResponse.json({ message: `Erro ao calcular bônus: ${error.message}` }, { status: 500 });
    }
}
