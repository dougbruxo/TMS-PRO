import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { db } = await connectToDatabase();
        const id = (await context.params).id;
        
        if (!id) return NextResponse.json({ success: false }, { status: 400 });
        
        await db.collection('cargo_types').deleteOne({ _id: new ObjectId(id) });
        
        return NextResponse.json({ success: true });
    } catch(e) {
        console.error("Error deleting cargo type:", e);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
