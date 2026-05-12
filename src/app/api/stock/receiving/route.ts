import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { getUserFromRequest } from '@/lib/auth-api';
import { ObjectId } from 'mongodb';

// GET: List all receiving batches (pending conference)
export async function GET(request: Request) {
    try {
        const user = getUserFromRequest(request);
        const { db } = await connectToDatabase();
        const { searchParams } = new URL(request.url);
        const statusFilter = searchParams.get('status');

        let filter: any = {};
        if (statusFilter) {
            filter.status = statusFilter;
        }

        if (user.role === 'cliente' || user.role === 'sub-cliente') {
             const effectiveId = user.effectiveUserId || user.userId;
             const userCompanys = await db.collection('client_companies').find({ userId: effectiveId }).toArray(); 
             const companyIds = userCompanys.map(c => c._id.toHexString());
             filter.companyId = { $in: companyIds };
        } else if (user.role !== 'admin' && user.role !== 'user') {
             return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
        }

        const batches = await db.collection('receiving_batches')
            .find(filter)
            .sort({ importedAt: -1 })
            .toArray();

        const mapped = batches.map(b => {
            const { _id, ...rest } = b;
            return { id: _id.toHexString(), ...rest };
        });

        return NextResponse.json(mapped, { status: 200 });
    } catch (error: any) {
        console.error('API /api/stock/receiving GET Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
