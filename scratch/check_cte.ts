import { connectToDatabase } from '../src/lib/database';

async function checkCte() {
    try {
        const { db } = await connectToDatabase();
        const cte = await db.collection('issued_documents').findOne({ type: 'CTE' });
        console.log('--- CTE DATA ---');
        console.log(JSON.stringify(cte, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

checkCte();
