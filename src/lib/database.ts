
"server-only";

import { MongoClient, Db } from 'mongodb';
import bcrypt from 'bcryptjs';
import { initialVehicleBrands, initialVehicleModels, initialVehicleColors, initialVehicleBodyTypes, initialVehicleAnttCategories, initialPricingSettings, initialVehicles, initialAnttCoefficients } from './data';
import type { User } from './types';


// New initial data
export const initialVehicleTypes: { code: string; name: string }[] = [
  { code: '01', name: 'Truck' },
  { code: '02', name: 'Cavalo Mecânico' },
  { code: '03', name: 'Van' },
  { code: '04', name: 'Utilitário' },
  { code: '05', name: 'Outros' },
  { code: '00', name: 'Carreta' },
];

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'dezlog-db';

if (!uri) {
  throw new Error('Please define the MONGODB_URI environment variable');
}
if (!dbName) {
    throw new Error('Please define the MONGODB_DB_NAME environment variable');
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;
let isSeedingAttempted = false;

async function seedDatabase(db: Db) {
    if (isSeedingAttempted) return;
    isSeedingAttempted = true; // Mark that we're attempting to seed to prevent re-entry within the same process

    try {
        // Idempotent seeding function
        const seedCollection = async (collectionName: string, data: { code: string; name: string }[]) => {
            if (data.length === 0) return;
            const collection = db.collection(collectionName);
            const operations = data.map(item => ({
                updateOne: {
                    filter: { code: item.code },
                    update: { $setOnInsert: { ...item } },
                    upsert: true,
                },
            }));
            await collection.bulkWrite(operations as any[], { ordered: false });
        };
        
        const seedCollectionWithKey = async (collectionName: string, data: any[]) => {
            if (data.length === 0) return;
            const collection = db.collection(collectionName);
            const operations = data.map(item => ({
                updateOne: {
                    filter: { key: item.key },
                    update: { $setOnInsert: { ...item } },
                    upsert: true,
                },
            }));
            await collection.bulkWrite(operations as any[], { ordered: false });
        };

        // Seed default user
        const usersCollection = db.collection('users');
        const hashedPassword = await bcrypt.hash('123456', 10);
        const defaultUser: Omit<User, 'id' | '_id'> = {
            email: 'empresa@adm.com',
            password: hashedPassword,
            username: 'ADMINISTRADOR',
            role: 'admin',
            contact: 'N/A',
            disabled: false,
            firstLogin: true,
            chatEnabled: true,
            operationalAccess: true,
            driverManagementAccess: true,
            settingsAccess: true,
            noticeBoardAccess: true,
            expensesAccess: true,
            talentsAccess: true,
            receivingAccess: true,
            documentsAccess: true,
            fracionadoEnabled: true,
            sacAccess: true,
            registrationsAccess: true,
            panoramaAccess: true,
            stockAccess: true,
            freightAccess: true,
            myFreightsAccess: true,
            salesBonusPercentage: 0,
        };
        await usersCollection.updateOne(
            { email: 'empresa@adm.com' },
            { $setOnInsert: defaultUser as any },
            { upsert: true }
        );

        const seedAnttCoefficients = async (data: any[]) => {
            if (data.length === 0) return;
            const collection = db.collection('antt_coefficients');
            const operations = data.map(item => ({
                updateOne: {
                    filter: { axles: item.axles, cargoType: item.cargoType },
                    update: { $set: { ...item } },
                    upsert: true,
                },
            }));
            await collection.bulkWrite(operations as any[], { ordered: false });
        };
        
        // Seed default settings using upsert
        const settingsCollection = db.collection('settings');
        await settingsCollection.updateOne(
            { _id: 'pricing' as any },
            { $setOnInsert: { _id: 'pricing', ...initialPricingSettings } },
            { upsert: true }
        );
        
        // Seed default expense categories using upsert
        const expenseCategoriesCollection = db.collection('expense_categories');
        const expenseCatOps = [
            { _id: 'SALARY', name: 'Salário', createdBy: 'SYSTEM', createdAt: new Date().toISOString() },
            { _id: 'ADVANCE', name: 'Adiantamento', createdBy: 'SYSTEM', createdAt: new Date().toISOString() },
            { _id: 'DRIVER_PAYMENT', name: 'Motorista', createdBy: 'SYSTEM', createdAt: new Date().toISOString() }
        ].map(cat => ({
            updateOne: {
                filter: { _id: cat._id },
                update: { $setOnInsert: cat },
                upsert: true,
            }
        }));
        if (expenseCatOps.length > 0) {
            await expenseCategoriesCollection.bulkWrite(expenseCatOps as any[], { ordered: false });
        }
        
        // Seed other collections
        await Promise.all([
            seedCollection('vehicle_brands', initialVehicleBrands),
            seedCollection('vehicle_models', initialVehicleModels),
            seedCollection('vehicle_colors', initialVehicleColors),
            seedCollection('vehicle_body_types', initialVehicleBodyTypes),
            seedCollection('vehicle_antt_categories', initialVehicleAnttCategories),
            seedCollection('vehicle_types', initialVehicleTypes),
            seedCollectionWithKey('vehicles', initialVehicles),
            seedAnttCoefficients(initialAnttCoefficients),
        ]);
        
    } catch (error: any) {
        // We log the error but don't throw, as duplicate key errors are expected and okay here.
        if (error.code !== 11000) { // 11000 is the duplicate key error code
            console.error("Database seeding encountered a non-duplicate key error:", error);
        }
    }
}


export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  try {
    const client = new MongoClient(uri!);
    await client.connect();
    const db = client.db(dbName);
    
    // Seeding is now handled inside connectToDatabase to ensure it runs once per connection.
    await seedDatabase(db);
    
    cachedClient = client;
    cachedDb = db;
    
    return { client, db };
  } catch (error: any) {
    console.error("Failed to connect to MongoDB:", error);
    throw new Error(`Could not connect to database. Details: ${error.message}`);
  }
}
