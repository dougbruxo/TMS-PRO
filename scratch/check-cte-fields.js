
const { connectToDatabase } = require('./src/lib/database');

async function check() {
    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('issued_documents').findOne({ type: 'CTE' });
        console.log('Exemplo de CT-e:', Object.keys(doc));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
