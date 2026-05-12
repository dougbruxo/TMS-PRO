import { connectToDatabase } from '../src/lib/database';

async function checkVehicle() {
    try {
        const { db } = await connectToDatabase();
        const vehicle = await db.collection('fleet').findOne({ plate: 'ESS-6G91' });
        const company = await db.collection('company_profiles').findOne({ isDefault: true });
        console.log('--- VEHICLE DATA ---');
        console.log(JSON.stringify(vehicle, null, 2));
        console.log('--- COMPANY DATA ---');
        console.log(JSON.stringify(company, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

checkVehicle();
