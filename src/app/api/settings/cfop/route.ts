import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { defaultCfops } from '@/lib/defaultCfops';
import { ObjectId } from 'mongodb';

export async function GET() {
    try {
        const { db } = await connectToDatabase();
        const collection = db.collection('cfops');

        let cfops = await collection.find({}).sort({ code: 1 }).toArray();

        // Auto-Seed if empty
        if (cfops.length === 0) {
            const seedResult = await collection.insertMany(defaultCfops);
            cfops = Object.values(seedResult.insertedIds).map((id, index) => ({
                _id: id,
                ...defaultCfops[index]
            })) as any[];
        }

        const mapped = cfops.map(cfop => ({
            id: cfop._id.toHexString(),
            code: cfop.code,
            description: cfop.description
        }));

        return NextResponse.json(mapped);
    } catch (error: any) {
        return NextResponse.json({ message: `Erro ao buscar CFOPs: ${error.message}` }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { code, description } = body;

        if (!code || !description) {
            return NextResponse.json({ message: "Código e Descrição são obrigatórios." }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        
        // Check uniqueness
        const exists = await db.collection('cfops').findOne({ code: code });
        if (exists) {
            return NextResponse.json({ message: "Este CFOP já está cadastrado." }, { status: 400 });
        }

        const result = await db.collection('cfops').insertOne({ code, description });
        return NextResponse.json({ id: result.insertedId.toHexString(), code, description }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ message: `Erro ao adicionar CFOP: ${error.message}` }, { status: 500 });
    }
}
