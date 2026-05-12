import { connectToDatabase } from './src/lib/database';

async function run() {
    console.log("Connecting to database...");
    const { db } = await connectToDatabase();
    
    console.log("Deleting bad null coordinates from cache...");
    const result = await db.collection('city_coordinates').deleteMany({ lat: null, lng: null });
    
    console.log(`Deleted ${result.deletedCount} bad entries!`);
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
