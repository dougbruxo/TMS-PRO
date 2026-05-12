import { MongoClient } from 'mongodb';

async function test() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'dezlog-db';
  const client = await MongoClient.connect(uri);
  const db = client.db(dbName);
  
  const quotes = await db.collection('quotes').find({ nfeXml: { $exists: true, $ne: null } }, { projection: { quoteCode: 1, nfeXml: 1 } }).limit(10).toArray();
  
  if (quotes.length === 0) {
    console.log("Nenhuma cotação com nfeXml encontrada.");
  } else {
    console.log(JSON.stringify(quotes.map(q => ({ 
      code: q.quoteCode, 
      hasXml: !!q.nfeXml, 
      xmlLength: q.nfeXml?.length, 
      xmlPreview: q.nfeXml?.substring(0, 50) 
    })), null, 2));
  }
  
  await client.close();
}

test().catch(console.error);
