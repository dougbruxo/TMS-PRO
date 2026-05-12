import { connectToDatabase } from '../src/lib/database';
import { ObjectId } from 'mongodb';

async function migrateCtes() {
    try {
        const { db } = await connectToDatabase();
        const ctes = await db.collection('issued_documents').find({ type: 'CTE', codigoIbgeDestino: { $exists: false } }).toArray();
        console.log(`Encontrados ${ctes.length} CT-es sem código IBGE.`);

        for (const cte of ctes) {
            let ibge = '';
            // Tenta pegar do destinatarioId no formData
            if (cte.formData?.destinatarioId) {
                const customer = await db.collection('customers').findOne({ _id: new ObjectId(cte.formData.destinatarioId) });
                if (customer?.codigo_ibge) {
                    ibge = customer.codigo_ibge;
                }
            }
            
            // Se não encontrou, tenta por cidade/uf (menos preciso mas melhor que nada)
            if (!ibge && cte.cidadeDestino && cte.ufDestino) {
                // Aqui poderíamos ter uma tabela de busca, mas vamos focar no destinatário que é mais certeiro no sistema deles
            }

            if (ibge) {
                await db.collection('issued_documents').updateOne(
                    { _id: cte._id },
                    { $set: { codigoIbgeDestino: ibge } }
                );
                console.log(`Atualizado CT-e ${cte.numeroCte} com IBGE ${ibge}`);
            }
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}

migrateCtes();
