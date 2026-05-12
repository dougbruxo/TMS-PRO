import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';

export async function GET(request: Request) {
    try {
        const user = getUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const itemId = searchParams.get('itemId');
        const companyId = searchParams.get('companyId');
        const limit = parseInt(searchParams.get('limit') || '100');
        const dateStr = searchParams.get('date'); // Expecting YYYY-MM-DD

        const { db } = await connectToDatabase();
        
        let query: any = {};
        
        // Multi-tenancy filter
        if (user.role === 'cliente' || user.role === 'sub-cliente') {
            const effectiveId = user.effectiveUserId || user.userId;
            const clientCompanies = await db.collection('client_companies').find({ userId: effectiveId }).toArray();
            const companyIds = clientCompanies.map(c => c._id.toHexString());
            query.companyId = { $in: companyIds };
        } else if (companyId) {
            query.companyId = companyId;
        }

        if (itemId) {
            query.itemId = itemId;
        }

        // Determine which date to filter by
        let targetDatePrefix = '';
        if (dateStr) {
            targetDatePrefix = dateStr;
        } else {
            // Find the most recent movement to use its date
            const latestMovement = await db.collection('stock_movements')
                .find(query)
                .sort({ timestamp: -1 })
                .limit(1)
                .toArray();
                
            if (latestMovement.length > 0) {
                // timestamp is like "2026-04-23T12:34:56.789Z"
                targetDatePrefix = latestMovement[0].timestamp.substring(0, 10);
            }
        }

        if (targetDatePrefix) {
            // Filter movements that start with the target date prefix
            query.timestamp = { $regex: `^${targetDatePrefix}` };
        }

        const movements = await db.collection('stock_movements')
            .find(query)
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();

        return NextResponse.json(movements);
    } catch (error: any) {
        console.error('API Stock Movements GET Error:', error);
        return NextResponse.json({ message: `Erro ao buscar histórico: ${error.message}` }, { status: 500 });
    }
}
