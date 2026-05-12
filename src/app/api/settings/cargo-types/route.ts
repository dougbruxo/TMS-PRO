import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET() {
   try {
       const { db } = await connectToDatabase();
       const data = await db.collection('cargo_types').find({}).toArray();
       return NextResponse.json(data);
   } catch(e) {
       return NextResponse.json([], { status: 500 });
   }
}

export async function POST(req: Request) {
   try {
       const { db } = await connectToDatabase();
       const { name } = await req.json();
       
       if (!name) return NextResponse.json({ success: false }, { status: 400 });
       const upperName = name.toUpperCase().trim();
       
       const existing = await db.collection('cargo_types').findOne({ name: upperName });
       if (!existing) {
           await db.collection('cargo_types').insertOne({ name: upperName });
       }
       return NextResponse.json({ success: true, name: upperName });
   } catch(e) {
       return NextResponse.json({ success: false }, { status: 500 });
   }
}
