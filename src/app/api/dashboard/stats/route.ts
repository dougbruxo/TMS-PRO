
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import type { Quote, QuoteStatus } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();

    const pipeline = [
      // 1. Otimização: Filtrar apenas os documentos relevantes no início.
      {
        $match: {
          status: { $nin: ['Aberta', 'Em Análise'] }
        }
      },
      // 2. Adicionar um campo 'groupStatus' para agrupar status relacionados.
      {
        $addFields: {
          groupStatus: {
            $switch: {
              branches: [
                {
                  // Cotações pendentes de coleta (motorista ainda não coletou)
                  case: { $in: ['$status', ['Fechada', 'Coleta']] },
                  then: 'Coleta'
                },
                {
                  // Cargas já coletadas, a caminho do galpão
                  case: { $eq: ['$status', 'Aguardando Recebimento'] },
                  then: 'Aguardando Recebimento'
                },
                {
                  case: { $in: ['$status', ['No Galpão', 'Aguardando Saída', 'Em Carregamento']] },
                  then: 'No Galpão'
                }
              ],
              default: '$status'
            }
          }
        }
      },
      // 3. Agrupar por 'groupStatus' e calcular as métricas.
      {
        $group: {
          _id: '$groupStatus',
          quoteCount: { $sum: 1 },
          withOccurrences: {
            $sum: {
              $cond: [{ $gt: [{ $size: { $ifNull: ['$occurrences', []] } }, 0] }, 1, 0]
            }
          },
          pendingPayments: {
            $sum: {
              $cond: [
                { $anyElementTrue: [
                  { $map: {
                      input: { $ifNull: ["$operationalHistory", []] },
                      as: "event",
                      in: { $eq: ["$$event.driverPaymentStatus", "pendente"] }
                  }}
                ]},
                1, 0
              ]
            }
          }
        }
      }
    ];

    const results = await db.collection('quotes').aggregate(pipeline).toArray();

    // Formata o resultado para o formato esperado pelo frontend.
    const stats: Record<string, { quoteCount: number; pendingPayments: number, withOccurrences: number }> = {};
    const allStatuses: QuoteStatus[] = ['Coleta', 'Aguardando Recebimento', 'No Galpão', 'Em Rota', 'Entregue', 'Finalizado'];

    // Inicializa todos os status com zero
    allStatuses.forEach(status => {
        stats[status] = { quoteCount: 0, pendingPayments: 0, withOccurrences: 0 };
    });

    // Preenche com os dados da agregação
    results.forEach((result: any) => {
      if (stats[result._id]) {
        stats[result._id] = {
          quoteCount: result.quoteCount,
          pendingPayments: result.pendingPayments,
          withOccurrences: result.withOccurrences
        };
      }
    });

    return NextResponse.json(stats);

  } catch (error: any) {
    console.error('API Dashboard Stats GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar estatísticas: ${error.message}` }, { status: 500 });
  }
}
