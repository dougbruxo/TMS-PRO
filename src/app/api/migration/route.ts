import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET() {
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('stock_items').updateMany(
            { 
                $or: [
                    { batch: { $exists: false } },
                    { expirationDate: { $exists: false } }
                ]
            },
            { 
                $set: { 
                    batch: "", 
                    expirationDate: "" 
                } 
            }
        );
        return NextResponse.json({ success: true, updatedCount: result.modifiedCount });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
