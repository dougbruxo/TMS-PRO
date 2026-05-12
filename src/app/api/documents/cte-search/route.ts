import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

/**
 * GET /api/documents/cte-search?q=&limit=20
 * Busca CT-e autorizados por demanda (server-side search).
 * Parâmetros:
 *   q      - termo de busca (número, remetente, destinatário, cidade, CNPJ)
 *   limit  - max de resultados (default 15, max 50)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '15'), 50);

    const { db } = await connectToDatabase();

    // Filtro base: apenas CT-e autorizados
    const baseFilter: any = {
      type: 'CTE',
      status: { $in: ['autorizado', 'concluido', 'sucesso', 'autorizado sefaz'] },
    };

    // Adicionar filtro de texto se há termo de busca
    if (q) {
      const numQ = parseInt(q);
      const conditions: any[] = [
        { remetenteNome: { $regex: q, $options: 'i' } },
        { destinatarioNome: { $regex: q, $options: 'i' } },
        { cidadeOrigem: { $regex: q, $options: 'i' } },
        { cidadeDestino: { $regex: q, $options: 'i' } },
        { remetenteCnpj: { $regex: q, $options: 'i' } },
        { destinatarioCnpj: { $regex: q, $options: 'i' } },
        { chaveAcesso: { $regex: q } },
      ];
      if (!isNaN(numQ)) {
        conditions.push({ numeroCte: numQ });
      }
      baseFilter.$or = conditions;
    }

    const ctes = await db.collection('issued_documents')
      .find(baseFilter)
      .sort({ dataEmissao: -1 })
      .limit(limit)
      .project({
        _id: 1,
        numeroCte: 1,
        serie: 1,
        chaveAcesso: 1,
        remetenteNome: 1,
        destinatarioNome: 1,
        valorServico: 1,
        peso: 1,
        cidadeOrigem: 1,
        ufOrigem: 1,
        cidadeDestino: 1,
        ufDestino: 1,
        codigoIbgeDestino: 1,
        valorCarga: 1,
        dataEmissao: 1,
        tomadorNome: 1,
        tomadorCnpj: 1,
        tomadorTipo: 1,
        remetenteCnpj: 1,
        destinatarioCnpj: 1,
      })
      .toArray();

    // Verificar quais estão vinculados a MDF-e ativo
    const mdfes = await db.collection('issued_documents')
      .find({
        type: 'MDFE',
        status: { $in: ['autorizado', 'concluido', 'sucesso', 'autorizado sefaz'] },
        chavesCte: { $exists: true },
      })
      .project({ chavesCte: 1 })
      .toArray();

    const chavesMdfVinculadas = new Set<string>(
      mdfes.flatMap((m: any) => m.chavesCte || [])
    );

    const result = ctes.map((doc: any) => ({
      _id: doc._id.toHexString(),
      numeroCte: doc.numeroCte,
      serie: doc.serie,
      chaveAcesso: doc.chaveAcesso,
      remetenteNome: doc.remetenteNome,
      destinatarioNome: doc.destinatarioNome,
      valorServico: doc.valorServico,
      valorCarga: doc.valorCarga || doc.valorServico,
      peso: doc.peso,
      cidadeOrigem: doc.cidadeOrigem,
      ufOrigem: doc.ufOrigem,
      cidadeDestino: doc.cidadeDestino,
      ufDestino: doc.ufDestino,
      codigoIbgeDestino: doc.codigoIbgeDestino,
      dataEmissao: doc.dataEmissao,
      vinculado: chavesMdfVinculadas.has(doc.chaveAcesso),
      // Fallback para documentos antigos que não tinham tomadorNome/tomadorCnpj salvos
      tomadorNome: doc.tomadorNome || (doc.tomadorTipo === 0 ? doc.remetenteNome : doc.destinatarioNome),
      tomadorCnpj: doc.tomadorCnpj || (doc.tomadorTipo === 0 ? doc.remetenteCnpj : doc.destinatarioCnpj),
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
