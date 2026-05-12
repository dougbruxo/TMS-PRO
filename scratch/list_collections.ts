
import { MongoClient } from 'mongodb';

async function listAll() {
  const uri = 'mongodb://localhost:27017';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('dezlog-db');
    const collections = await db.listCollections().toArray();
    console.log('--- COLEÇÕES ---');
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`${col.name}: ${count} documentos`);
    }
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

listAll();
