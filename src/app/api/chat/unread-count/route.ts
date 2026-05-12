import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId || !ObjectId.isValid(userId)) {
            return NextResponse.json({ count: 0 }); // Return 0 if no user
        }

        const { db } = await connectToDatabase();
        
        const query = {
            participants: new ObjectId(userId),
            [`readBy.${userId}`]: false 
        };

        const count = await db.collection('conversations').countDocuments(query);

        return NextResponse.json({ count });
    } catch (error: any) {
        console.error('API Unread Count Error:', error);
        return NextResponse.json({ count: 0, error: error.message }, { status: 500 });
    }
}
