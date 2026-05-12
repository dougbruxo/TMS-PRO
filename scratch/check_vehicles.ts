
import { connectToDatabase } from '../src/lib/database';
import * as dotenv from 'dotenv';
import path from 'path';

// Carrega .env.local explicitamente
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkVehicles() {
  console.log('MONGODB_URI:', process.env.MONGODB_URI);
  console.log('MONGODB_DB_NAME:', process.env.MONGODB_DB_NAME);
  
  try {
    const { db } = await connectToDatabase();
    const collections = await db.listCollections().toArray();
    console.log('Coleções no banco:', collections.map(c => c.name));
    
    const vehicles = await db.collection('vehicles').find({}).toArray();
    console.log('Total de veículos encontrados na coleção "vehicles":', vehicles.length);
    if (vehicles.length > 0) {
        console.log('Primeiro veículo:', JSON.stringify(vehicles[0], null, 2));
    }
    process.exit(0);
  } catch (e) {
    console.error('Erro no script:', e);
    process.exit(1);
  }
}

checkVehicles();
