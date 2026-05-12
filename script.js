const { MongoClient } = require('mongodb');
require('dotenv').config({path: '.env.local'});
async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB);
  const operational = await db.collection('quotes').countDocuments({ status: { $in: ['Fechada', 'Em Rota'] } });
  const receiving = await db.collection('quotes').countDocuments({ status: { $in: ['No Galpão', 'Aguardando Saída', 'Em Carregamento'] } });
  console.log({ operational, receiving });
  await client.close();
}
run().catch(console.error);
