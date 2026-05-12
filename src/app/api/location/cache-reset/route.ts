import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const { db } = await connectToDatabase();
        const coordsCollection = db.collection('city_coordinates');
        const result = await coordsCollection.deleteMany({ lat: null, lng: null });
        
        return NextResponse.json({ message: `Cache limpo! Removidos ${result.deletedCount} registros nulos.` });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
