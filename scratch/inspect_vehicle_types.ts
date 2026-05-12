
import { MongoClient } from 'mongodb';

async function inspect() {
  const uri = 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('dezlog-db');
    const data = await db.collection('vehicle_types').find({}).toArray();
    console.log('--- CONTEÚDO DE vehicle_types ---');
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

inspect();
