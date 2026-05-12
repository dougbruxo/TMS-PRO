import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { FleetVehicle } from '@/lib/types';

// Maps the upload type to the folder name and database field
const uploadConfig = {
    crlv: { folder: 'CRLV', dbField: 'crlvDocumentUrl' },
    antt: { folder: 'ANTT', dbField: 'anttDocumentUrl' },
    ownerAddressProof: { folder: 'endereco', dbField: 'ownerAddressProofUrl' },
};

const sanitizeFilename = (name: string) => name.replace(/[^a-z0-9-]/gi, '_').toLowerCase();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const vehicleId = parts[parts.length - 2]; // Path is /api/fleet/[id]/upload

    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    const type: keyof typeof uploadConfig | null = data.get('type') as any;

    if (!file) {
      return NextResponse.json({ message: 'Nenhum ficheiro encontrado.' }, { status: 400 });
    }
    if (!vehicleId || !ObjectId.isValid(vehicleId)) {
      return NextResponse.json({ message: 'ID do veículo inválido.' }, { status: 400 });
    }
    if (!type || !uploadConfig[type]) {
      return NextResponse.json({ message: 'Tipo de ficheiro inválido.' }, { status: 400 });
    }
    
    const { db } = await connectToDatabase();
    const vehicle = await db.collection<FleetVehicle>('fleet').findOne({ _id: new ObjectId(vehicleId) });
    if (!vehicle || !vehicle.plate) {
        return NextResponse.json({ message: 'Veículo ou placa não encontrado.' }, { status: 404 });
    }
    
    const { folder, dbField } = uploadConfig[type];
    const plate = sanitizeFilename(vehicle.plate);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = join(process.cwd(), 'public', 'upload', 'veículos', plate, folder);
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    const fileExtension = file.name.split('.').pop() || 'pdf';
    const newFilename = `${folder.toUpperCase()}-${plate}.${fileExtension}`;
    const filePath = join(uploadDir, newFilename);

    await writeFile(filePath, buffer);
    const publicPath = `/upload/veículos/${plate}/${folder}/${newFilename}`;

    const result = await db.collection('fleet').updateOne(
      { _id: new ObjectId(vehicleId) },
      { $set: { [dbField]: publicPath } }
    );
      
    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Veículo não encontrado ao atualizar caminho do documento." }, { status: 404 });
    }

    return NextResponse.json({ success: true, path: publicPath });

  } catch (error: any) {
    console.error(`Erro no upload do ficheiro do veículo:`, error);
    return NextResponse.json({ success: false, message: `Erro interno do servidor: ${error.message}` }, { status: 500 });
  }
}
