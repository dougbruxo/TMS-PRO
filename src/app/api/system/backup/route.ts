import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { promises as fs } from 'fs';
import path from 'path';

// Define a directory for backups that is not publicly served
const backupDir = path.join(process.cwd(), 'private', 'backups');
const backupFilePath = path.join(backupDir, 'backup.json');
const backupInfoPath = path.join(backupDir, 'backup-info.json');

const collectionsToBackup = [
    'users',
    'vehicles',
    'customers',
    'announcements',
    'settings',
    'quotes',
    'expenses',
    'expense_categories',
    'drivers',
    'hiringTypes',
    'earningDeductionTypes',
    'payslips',
    'notices',
    'stock_positions',
    'stock_items',
    'stock_labels',
    'activityHistory',
    'company_profiles',
    'talents',
    'counters', // include counters
    'chat_hubs',
    'conversations',
    'messages',
    'occurrenceTypes',
    'vehicle_brands',
    'vehicle_models',
    'vehicle_colors',
    'vehicle_body_types',
    'vehicle_antt_categories',
    'vehicle_types',
];


// GET last backup info
export async function GET() {
  try {
    await fs.access(backupInfoPath);
    const infoContent = await fs.readFile(backupInfoPath, 'utf-8');
    return NextResponse.json(JSON.parse(infoContent));
  } catch (error) {
    return NextResponse.json({ message: 'Nenhum ponto de restauração encontrado.' }, { status: 404 });
  }
}

// POST to create a new backup
export async function POST() {
  try {
    const { db } = await connectToDatabase();
    const backupData: Record<string, any[]> = {};

    for (const collectionName of collectionsToBackup) {
      // For users, exclude password
      const projection = collectionName === 'users' ? { projection: { password: 0 } } : {};
      backupData[collectionName] = await db.collection(collectionName).find({}, projection).toArray();
    }
    
    const backupJsonString = JSON.stringify(backupData, null, 2);

    await fs.mkdir(backupDir, { recursive: true });
    await fs.writeFile(backupFilePath, backupJsonString);

    const stats = await fs.stat(backupFilePath);
    const backupInfo = {
      date: new Date().toISOString(),
      size: stats.size,
    };
    await fs.writeFile(backupInfoPath, JSON.stringify(backupInfo));

    return NextResponse.json({ message: 'Ponto de restauração criado com sucesso.', ...backupInfo });
  } catch (error: any) {
    console.error('API System Backup Error:', error);
    return NextResponse.json({ message: `Erro ao criar ponto de restauração: ${error.message}` }, { status: 500 });
  }
}
