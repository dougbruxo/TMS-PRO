const { MongoClient } = require('mongodb');

async function run() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('dezlog-db');
    const res = await db.collection('city_coordinates').deleteMany({ lat: null, lng: null });
    console.log("Deleted:", res.deletedCount);
    process.exit(0);
}
run();
