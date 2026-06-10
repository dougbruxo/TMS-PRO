import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { promises as fs } from 'fs';
import path from 'path';
import { ObjectId } from 'mongodb';

const backupDir = path.join(process.cwd(), 'private', 'backups');
const backupFilePath = path.join(backupDir, 'backup.json');

const collectionsToRestore = [
    // Exclude users to avoid password issues
    // 'users', 
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
    'counters',
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

// Helper to convert string IDs back to ObjectId
const processDocuments = (docs: any[]) => {
  return docs.map(doc => {
    if (doc._id && typeof doc._id === 'string' && ObjectId.isValid(doc._id)) {
      doc._id = new ObjectId(doc._id);
    }
    // Also convert any other potential stringified ObjectIds
    for (const key in doc) {
        if (typeof doc[key] === 'string' && (key.endsWith('Id') || key.endsWith('Ids')) && key !== 'recurringId' && key !== 'installmentId') {
            if (Array.isArray(doc[key])) {
                 doc[key] = doc[key].map((id: string) => ObjectId.isValid(id) ? new ObjectId(id) : id);
            } else if (ObjectId.isValid(doc[key])) {
                doc[key] = new ObjectId(doc[key]);
            }
        }
    }
    return doc;
  });
};


export async function POST(request: Request) {
    try {
        const body = await request.json();
        let backupData: Record<string, any[]>;

        if (body.from === 'server') {
            const backupJsonString = await fs.readFile(backupFilePath, 'utf-8');
            backupData = JSON.parse(backupJsonString);
        } else if (body.data) {
            backupData = body.data;
        } else {
            return NextResponse.json({ message: 'Nenhum dado de restauração fornecido.' }, { status: 400 });
        }
        
        const { db } = await connectToDatabase();

        try {
            const session = db.client.startSession();
            try {
                await session.withTransaction(async () => {
                    for (const collectionName of collectionsToRestore) {
                        if (backupData[collectionName]) {
                            const collection = db.collection(collectionName);
                            // Clear the collection before inserting new data
                            await collection.deleteMany({}, { session });
                            // Process documents to convert string IDs to ObjectIds
                            const documentsToInsert = processDocuments(backupData[collectionName]);
                            if(documentsToInsert.length > 0) {
                                await collection.insertMany(documentsToInsert, { session });
                            }
                        }
                    }
                });
            } finally {
                await session.endSession();
            }
        } catch (transactionError: any) {
            const isIllegalOperation = transactionError.code === 20 || 
                (transactionError.message && transactionError.message.includes('replica set'));
            
            if (isIllegalOperation) {
                console.warn('MongoDB does not support transactions (standalone instance). Falling back to sequential restore...');
                // Run restore sequentially without transaction session
                for (const collectionName of collectionsToRestore) {
                    if (backupData[collectionName]) {
                        const collection = db.collection(collectionName);
                        await collection.deleteMany({});
                        const documentsToInsert = processDocuments(backupData[collectionName]);
                        if (documentsToInsert.length > 0) {
                            await collection.insertMany(documentsToInsert);
                        }
                    }
                }
            } else {
                throw transactionError;
            }
        }

        return NextResponse.json({ message: 'Sistema restaurado com sucesso.' });

    } catch (error: any) {
        console.error('API Restore Error:', error);
        return NextResponse.json({ message: `Erro ao restaurar o sistema: ${error.message}` }, { status: 500 });
    }
}
