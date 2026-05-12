
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

const collectionsToReset = [
    'quotes',
    'expenses',
    'manifests',
    'announcements',
    'notices',
    'payslips',
    'talents',
    'hiringTypes',
    'earningDeductionTypes',
    'activityHistory',
    'stock_positions',
    'stock_items',
    'stock_labels',
    // We keep customers, drivers, fleet, company_profiles, users, settings
];


export async function POST(request: Request) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ message: 'Autenticação necessária.' }, { status: 401 });
        }

        const { db } = await connectToDatabase();

        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ message: 'Ação não autorizada. Apenas administradores podem redefinir o sistema.' }, { status: 403 });
        }

        for (const collectionName of collectionsToReset) {
            await db.collection(collectionName).deleteMany({});
        }
        
        // Log the reset action
        await db.collection('systemHistory').insertOne({
            action: 'RESET',
            timestamp: new Date().toISOString(),
            userId: userId,
            username: user.username
        });
        
        return NextResponse.json({ message: "Dados do sistema redefinidos com sucesso." });

    } catch (error: any) {
        console.error('API System Reset Error:', error);
        return NextResponse.json({ message: `Erro ao redefinir o sistema: ${error.message}` }, { status: 500 });
    }
}
