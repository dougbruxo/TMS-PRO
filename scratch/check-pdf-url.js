
const { connectToDatabase } = require('./src/lib/database');
const { ObjectId } = require('mongodb');

async function check() {
    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('issued_documents').findOne({ type: 'CTE' }, { sort: { dataEmissao: -1 } });
        console.log('Ultimo CT-e emitido:');
        console.log('ID:', doc._id);
        console.log('pdfUrl:', doc.pdfUrl);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
