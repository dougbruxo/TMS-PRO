const { MongoClient } = require('mongodb');

async function check() {
    const client = new MongoClient("mongodb://localhost:27017");
    await client.connect();
    const db = client.db("db_dezlog");
    const profiles = await db.collection("company_profiles").find({}).toArray();
    console.log("Perfis Encontrados:", JSON.stringify(profiles, null, 2));
    await client.close();
}
check().catch(console.error);
