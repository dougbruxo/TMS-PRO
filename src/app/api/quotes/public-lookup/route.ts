import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Quote } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Função auxiliar para buscar e limpar CNPJ/CPF por ID do cliente/parceiro
async function getCnpjCpfById(db: any, id: string): Promise<string | null> {
  if (!id) return null;
  
  try {
    const isObjId = ObjectId.isValid(id);
    const objId = isObjId ? new ObjectId(id) : null;
    
    // 1. Tenta buscar na coleção 'customers'
    const customer = await db.collection('customers').findOne(
      isObjId ? { _id: objId } : { id: id }
    );
    if (customer?.cnpj) return customer.cnpj.replace(/\D/g, '');

    // 2. Tenta buscar na coleção 'client_companies'
    const company = await db.collection('client_companies').findOne(
      isObjId ? { _id: objId } : { id: id }
    );
    if (company?.cnpj) return company.cnpj.replace(/\D/g, '');

    // 3. Tenta buscar na coleção 'client_partners'
    const partner = await db.collection('client_partners').findOne(
      isObjId ? { _id: objId } : { id: id }
    );
    if (partner?.cnpj) return partner.cnpj.replace(/\D/g, '');

  } catch (e) {
    console.error(`Erro ao buscar CNPJ/CPF para o ID ${id}:`, e);
  }
  
  return null;
}

// Função auxiliar de escape regex
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Função para mascarar nomes de remetente/destinatário (LGPD)
function maskName(name: string): string {
  if (!name) return '';
  const cleanName = name.trim();
  const words = cleanName.split(/\s+/);
  if (words.length === 0) return '';
  
  const firstWord = words[0];
  const maskedFirst = firstWord.length > 3 
    ? firstWord.substring(0, 3) + '***' 
    : firstWord + '***';
    
  if (words.length === 1) return maskedFirst;
  return `${maskedFirst} ***`;
}

// Função para sanitizar detalhes do histórico operacional/ocorrências (sigilo de valores e LGPD)
function sanitizeOperationalDetails(details: string): string {
  if (!details) return '';
  let sanitized = details;

  // 1. Remover a frase sobre o valor a pagar ao motorista por completo
  sanitized = sanitized.replace(/[\.\s]*Valor a pagar ao motorista:\s*R\$\s*\d{1,3}(\.\d{3})*(,\d{2})?/gi, '');
  sanitized = sanitized.replace(/[\.\s]*Valor a pagar ao motorista:\s*\[Valor Ocultado\]/gi, '');
  sanitized = sanitized.replace(/[\.\s]*Valor a pagar ao motorista:\s*\[Ocultado\]/gi, '');
  
  // 2. Remover despesa adicionada por completo
  sanitized = sanitized.replace(/[\.\s]*Despesa adicionada:\s*R\$\s*\d{1,3}(\.\d{3})*(,\d{2})?/gi, '');
  sanitized = sanitized.replace(/[\.\s]*Despesa adicionada:\s*\[Valor Ocultado\]/gi, '');
  sanitized = sanitized.replace(/[\.\s]*Despesa adicionada:\s*\[Ocultado\]/gi, '');

  // 3. Caso existam outros valores monetários isolados
  sanitized = sanitized.replace(/R\$\s*\d{1,3}(\.\d{3})*(,\d{2})?/gi, '[Valor Ocultado]');

  // 4. Remover a parte do motorista por completo (ex: ". Motorista: BRUNO DE LIMA NEVES" ou "Motorista: Cadastrado")
  sanitized = sanitized.replace(/[\.\s]*Motorista:\s*Cadastrado/gi, '');
  sanitized = sanitized.replace(/[\.\s]*Motorista:\s*[A-ZÀ-Úa-zà-ú\s]{3,}/gi, '');

  // 5. Substituir nomes de operadores/usuários por "Operador"
  sanitized = sanitized.replace(/por\s+[A-ZÀ-Úa-zà-ú]{2,}(\s+[A-ZÀ-Úa-zà-ú]{2,})+/gi, 'por Operador');

  // Limpar múltiplos espaços
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Garantir que a frase termina com um ponto se não estiver vazia
  if (sanitized && !/[.!?]$/.test(sanitized)) {
    sanitized += '.';
  }
  
  // Limpar duplicações de pontos e espaços antes da pontuação
  sanitized = sanitized.replace(/\s*\.+\s*\./g, '.');
  sanitized = sanitized.replace(/\s+\./g, '.');
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

// Função para gerar dinamicamente um histórico de etapas detalhado, lógico e seguro para o rastreio público (LGPD e sigilo de valores)
function generateEnrichedHistory(quote: any): any[] {
  const history: any[] = [];
  const currentStatus = String(quote.status || '').toLowerCase();
  
  const statusLevels: Record<string, number> = {
    'aberta': 1,
    'em análise': 1,
    'fechada': 1,
    'coleta': 2,
    'aguardando recebimento': 2,
    'entregue no galpão': 3,
    'no galpão': 3,
    'aguardando saída': 4,
    'em carregamento': 4,
    'em rota': 5,
    'entregue': 6,
    'finalizado': 7
  };

  const level = statusLevels[currentStatus] || 1;
  const historyEvents = quote.operationalHistory || [];

  const findEventDate = (actions: string[], statusFilters?: string[]): Date | null => {
    const found = historyEvents.find((e: any) => 
      actions.includes(String(e.action || '').toUpperCase()) ||
      (statusFilters && statusFilters.includes(String(e.status || '').toUpperCase()))
    );
    return found ? new Date(found.timestamp) : null;
  };

  // 1. REGISTRO
  let tRegistro = quote.data ? new Date(quote.data) : null;
  if (!tRegistro && historyEvents.length > 0) {
    tRegistro = new Date(historyEvents[0].timestamp);
  }
  if (!tRegistro) {
    tRegistro = new Date();
  }

  // 2. COLETA
  let tColeta = findEventDate(['COLETA_MANUAL', 'COLETA_CONFIRMADA', 'COLETA']);
  if (!tColeta) {
    tColeta = findEventDate(['ATRIBUICAO_COLETA_GALPAO']);
  }
  if (!tColeta) {
    tColeta = findEventDate([], ['COLETA', 'AGUARDANDO RECEBIMENTO', 'AGUARDANDO_RECEBIMENTO']);
  }

  // 3. RECEPCAO
  let tRecepcao = findEventDate(['RECEBIDO_GALPAO', 'RECEBIDO_HUB']);
  if (!tRecepcao) {
    tRecepcao = findEventDate([], ['ENTREGUE NO GALPÃO', 'ENTREGUE_NO_GALPAO', 'NO GALPÃO', 'NO_GALPAO']);
  }

  // 4. CARREGAMENTO
  let tCarregamento = findEventDate(['SOLICITACAO_SAIDA_GALPAO', 'EM_CARREGAMENTO', 'CARREGAMENTO']);
  if (!tCarregamento) {
    tCarregamento = findEventDate([], ['AGUARDANDO SAÍDA', 'AGUARDANDO_SAIDA', 'EM CARREGAMENTO', 'EM_CARREGAMENTO']);
  }

  // 5. ROTA
  let tRota = findEventDate(['SAIDA_GALPAO_CONFIRMADA', 'EM ROTA', 'EM_ROTA', 'EXPEDIDO']);
  if (!tRota) {
    tRota = findEventDate([], ['EM ROTA', 'EM_ROTA']);
  }

  // 6. ENTREGA
  let tEntrega = quote.deliveredAt ? new Date(quote.deliveredAt) : null;
  if (!tEntrega) {
    tEntrega = findEventDate(['COMPROVATIVO_ANEXADO', 'ENTREGA_MANUAL', 'ENTREGUE']);
  }
  if (!tEntrega) {
    tEntrega = findEventDate([], ['ENTREGUE']);
  }

  // 7. FINALIZACAO
  let tFinalizacao = quote.closedAt ? new Date(quote.closedAt) : null;
  if (!tFinalizacao) {
    tFinalizacao = findEventDate(['FINALIZADO']);
  }
  if (!tFinalizacao) {
    const foundFinalizadoEvent = historyEvents.find((e: any) => 
      String(e.action || '').toUpperCase() === 'ETAPA_OPERACIONAL' && 
      String(e.status || '').toUpperCase() === 'FINALIZADO'
    );
    if (foundFinalizadoEvent) {
      tFinalizacao = new Date(foundFinalizadoEvent.timestamp);
    }
  }
  if (!tFinalizacao) {
    tFinalizacao = findEventDate([], ['FINALIZADO']);
  }

  // Define os marcos ativos baseados no nível atual
  const activeKeys: string[] = ['REGISTRO'];
  if (level >= 2) activeKeys.push('COLETA');
  if (level >= 3) activeKeys.push('RECEPCAO');
  if (level >= 4) activeKeys.push('CARREGAMENTO');
  if (level >= 5) activeKeys.push('ROTA');
  if (level >= 6) activeKeys.push('ENTREGA');
  if (level >= 7) activeKeys.push('FINALIZACAO');

  const milestoneDates: Record<string, Date | null> = {
    REGISTRO: tRegistro,
    COLETA: tColeta,
    RECEPCAO: tRecepcao,
    CARREGAMENTO: tCarregamento,
    ROTA: tRota,
    ENTREGA: tEntrega,
    FINALIZACAO: tFinalizacao
  };

  const resolvedDates: Record<string, Date> = {};

  // Inicializa com as datas reais existentes
  for (const key of activeKeys) {
    if (milestoneDates[key]) {
      resolvedDates[key] = milestoneDates[key]!;
    }
  }

  // Garante o primeiro
  if (!resolvedDates['REGISTRO']) {
    resolvedDates['REGISTRO'] = new Date();
  }

  // Garante o último
  const lastKey = activeKeys[activeKeys.length - 1];
  if (!resolvedDates[lastKey]) {
    const referenceDate = new Date();
    const regTime = resolvedDates['REGISTRO'].getTime();
    resolvedDates[lastKey] = referenceDate.getTime() > regTime ? referenceDate : new Date(regTime);
  }

  // Interpolação linear de datas para os marcos ausentes intermediários
  for (let i = 0; i < activeKeys.length; i++) {
    const key = activeKeys[i];
    if (!resolvedDates[key]) {
      let prevIndex = i - 1;
      while (prevIndex >= 0 && !resolvedDates[activeKeys[prevIndex]]) {
        prevIndex--;
      }
      const prevKey = activeKeys[prevIndex];
      const prevDate = resolvedDates[prevKey];

      let nextIndex = i + 1;
      while (nextIndex < activeKeys.length && !resolvedDates[activeKeys[nextIndex]]) {
        nextIndex++;
      }
      const nextKey = activeKeys[nextIndex];
      const nextDate = resolvedDates[nextKey];

      const gapCount = nextIndex - prevIndex;
      const timeDiff = nextDate.getTime() - prevDate.getTime();
      
      for (let j = prevIndex + 1; j < nextIndex; j++) {
        const currentKey = activeKeys[j];
        const fraction = (j - prevIndex) / gapCount;
        resolvedDates[currentKey] = new Date(prevDate.getTime() + timeDiff * fraction);
      }
      
      i = nextIndex - 1;
    }
  }

  // Função auxiliar para incrementar segundos
  const formatWithOffset = (d: Date, seconds: number): string => {
    const newDate = new Date(d);
    newDate.setSeconds(newDate.getSeconds() + seconds);
    return newDate.toISOString();
  };

  const cidadeOrigem = quote.cidadeOrigem ? String(quote.cidadeOrigem).toUpperCase() : 'ORIGEM';
  const cidadeDestino = quote.cidadeDestino ? String(quote.cidadeDestino).toUpperCase() : 'DESTINO';

  // Monta o histórico nas 11 etapas solicitadas

  // Nível 1: Registro (Etapa 1)
  history.push({
    timestamp: resolvedDates['REGISTRO'].toISOString(),
    status: 'Solicitado',
    details: 'Autorizado para coleta. Carga liberada pelo remetente.',
    action: 'SOLICITACAO'
  });

  // Nível 2+: Coleta (Etapas 2 e 3)
  if (level >= 2) {
    history.push({
      timestamp: formatWithOffset(resolvedDates['COLETA'], 0),
      status: 'Coleta',
      details: `Coletado em ${cidadeOrigem} com destino ao CD de Distribuição.`,
      action: 'COLETA'
    });
    history.push({
      timestamp: formatWithOffset(resolvedDates['COLETA'], 1),
      status: 'Coleta',
      details: 'Em trânsito para o CD de Distribuição.',
      action: 'TRANSITO_CD'
    });
  }

  // Nível 3+: No Galpão (Etapas 4, 5 e 6)
  if (level >= 3) {
    history.push({
      timestamp: formatWithOffset(resolvedDates['RECEPCAO'], 0),
      status: 'No Galpão',
      details: 'Recebido no CD de Distribuição.',
      action: 'RECEBIDO_HUB'
    });
    history.push({
      timestamp: formatWithOffset(resolvedDates['RECEPCAO'], 1),
      status: 'No Galpão',
      details: 'Em conferência e pesagem.',
      action: 'CONFERENCIA'
    });
    history.push({
      timestamp: formatWithOffset(resolvedDates['RECEPCAO'], 2),
      status: 'No Galpão',
      details: 'Aguardando expedição.',
      action: 'AGUARDANDO_EXPEDICAO'
    });
  }

  // Nível 4+: Em Carregamento (Etapa 7)
  if (level >= 4) {
    history.push({
      timestamp: formatWithOffset(resolvedDates['CARREGAMENTO'], 0),
      status: 'Em Carregamento',
      details: 'Carga em carregamento no veículo de transferência.',
      action: 'CARREGAMENTO'
    });
  }

  // Nível 5+: Em Rota (Etapas 8 e 9)
  if (level >= 5) {
    history.push({
      timestamp: formatWithOffset(resolvedDates['ROTA'], 0),
      status: 'Em Rota',
      details: `Saída confirmada com destino a ${cidadeDestino}.`,
      action: 'EXPEDIDO'
    });
    history.push({
      timestamp: formatWithOffset(resolvedDates['ROTA'], 1),
      status: 'Em Rota',
      details: 'Em Trânsito / Rota de Entrega.',
      action: 'EM_ROTA'
    });
  }

  // Nível 6+: Entregue (Etapa 10)
  if (level >= 6) {
    history.push({
      timestamp: formatWithOffset(resolvedDates['ENTREGA'], 0),
      status: 'Entregue',
      details: 'Carga entregue no endereço de destino.',
      action: 'ENTREGUE'
    });
  }

  // Nível 7+: Finalizado (Etapa 11)
  if (level >= 7) {
    history.push({
      timestamp: formatWithOffset(resolvedDates['FINALIZACAO'], 0),
      status: 'Finalizado',
      details: 'Entregue e Finalizado. Comprovante digitalizado disponível.',
      action: 'FINALIZADO'
    });
  }

  // Ordena cronologicamente por timestamp de forma crescente
  return history.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// Função auxiliar para buscar e limpar CNPJ/CPF por NOME do cliente/parceiro (Fallback)
async function getCnpjCpfByName(db: any, name: string): Promise<string | null> {
  if (!name) return null;
  const cleanName = name.trim();
  
  try {
    // 1. Tenta buscar na coleção 'customers' por razaoSocial ou nome
    const customer = await db.collection('customers').findOne({
      $or: [
        { razaoSocial: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') } },
        { nome: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') } }
      ]
    });
    if (customer?.cnpj) return customer.cnpj.replace(/\D/g, '');

    // 2. Tenta buscar na coleção 'client_companies' por razaoSocial ou nomeFantasia
    const company = await db.collection('client_companies').findOne({
      $or: [
        { razaoSocial: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') } },
        { nomeFantasia: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') } }
      ]
    });
    if (company?.cnpj) return company.cnpj.replace(/\D/g, '');

    // 3. Tenta buscar na coleção 'client_partners' por razaoSocial ou nomeFantasia
    const partner = await db.collection('client_partners').findOne({
      $or: [
        { razaoSocial: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') } },
        { nomeFantasia: { $regex: new RegExp(`^${escapeRegExp(cleanName)}$`, 'i') } }
      ]
    });
    if (partner?.cnpj) return partner.cnpj.replace(/\D/g, '');

  } catch (e) {
    console.error(`Erro ao buscar CNPJ/CPF por nome ${name}:`, e);
  }
  
  return null;
}

export async function POST(request: Request) {
  try {
    const { code, cnpjCpf } = await request.json();

    if (!code) {
      return NextResponse.json(
        { success: false, message: 'O número da cotação ou nota fiscal é obrigatório.' },
        { status: 400 }
      );
    }

    const cleanedCode = String(code).trim().toUpperCase();
    const { db } = await connectToDatabase();

    // Busca cotações onde quoteCode ou nfNumber coincidam com o código digitado
    // Consideramos nfNumber como string, mas cobrimos correspondência numérica caso esteja salvo assim
    const nfNumberQuery: any[] = [{ nfNumber: cleanedCode }];
    if (/^\d+$/.test(cleanedCode)) {
      nfNumberQuery.push({ nfNumber: parseInt(cleanedCode, 10) });
    }

    const quotes = await db.collection('quotes').find({
      $or: [
        { quoteCode: cleanedCode },
        ...nfNumberQuery
      ]
    }).toArray();

    if (!quotes || quotes.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Nenhuma cotação ou nota fiscal correspondente encontrada.' },
        { status: 404 }
      );
    }

    // FASE 1: Apenas verifica se existe, sem expor nenhum dado
    if (!cnpjCpf) {
      return NextResponse.json({
        success: true,
        requiresVerification: true,
        message: 'Informações localizadas. Confirme o CNPJ ou CPF para prosseguir.'
      });
    }

    // FASE 2: Validar o CNPJ/CPF inserido
    const cleanedInputCnpjCpf = String(cnpjCpf).replace(/\D/g, '');

    if (!cleanedInputCnpjCpf) {
      return NextResponse.json(
        { success: false, message: 'CNPJ ou CPF de confirmação inválido.' },
        { status: 400 }
      );
    }

    const verifiedQuotes: any[] = [];

    for (const quote of quotes) {
      const remetenteId = quote.remetenteId;
      const destinatarioId = quote.destinatarioId;

      let remetenteCnpj = remetenteId ? await getCnpjCpfById(db, remetenteId) : null;
      if (!remetenteCnpj && quote.remetente) {
        remetenteCnpj = await getCnpjCpfByName(db, quote.remetente);
      }

      let destinatarioCnpj = destinatarioId ? await getCnpjCpfById(db, destinatarioId) : null;
      if (!destinatarioCnpj && quote.destinatario) {
        destinatarioCnpj = await getCnpjCpfByName(db, quote.destinatario);
      }

      // Verifica se o CNPJ/CPF bate com o remetente ou destinatário da cotação específica
      const isRemetenteMatch = remetenteCnpj && remetenteCnpj === cleanedInputCnpjCpf;
      const isDestinatarioMatch = destinatarioCnpj && destinatarioCnpj === cleanedInputCnpjCpf;

      if (isRemetenteMatch || isDestinatarioMatch) {
        // Se bater, adiciona a cotação com a projeção de campos totalmente seguros
        verifiedQuotes.push({
          id: quote._id.toHexString(),
          quoteCode: quote.quoteCode,
          status: quote.status,
          remetente: maskName(quote.remetente),
          destinatario: maskName(quote.destinatario || quote.empresaDestino),
          cidadeOrigem: quote.cidadeOrigem,
          cidadeDestino: quote.cidadeDestino,
          data: quote.data,
          prazoEntrega: quote.prazoEntrega,
          deliveryForecast: quote.deliveryForecast,
          deliveredAt: quote.deliveredAt,
          deliveryStatus: quote.deliveryStatus,
          proofOfDeliveryUrl: quote.proofOfDeliveryUrl,
          proofOfDeliveryUrls: quote.proofOfDeliveryUrls,
          nfNumber: quote.nfNumber,
          peso: quote.peso,
          volumes: quote.volumes || quote.volumeCount,
          occurrences: (quote.occurrences || []).map((occ: any) => ({
            timestamp: occ.timestamp,
            code: occ.code,
            description: sanitizeOperationalDetails(occ.description),
            notes: sanitizeOperationalDetails(occ.notes)
          })),
          operationalHistory: generateEnrichedHistory(quote)
        });
      }
    }

    if (verifiedQuotes.length === 0) {
      return NextResponse.json(
        { success: false, message: 'O CNPJ ou CPF informado não confere com os registros deste rastreamento.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      quotes: verifiedQuotes
    });

  } catch (error: any) {
    console.error('API Public Lookup Error:', error);
    return NextResponse.json(
      { success: false, message: `Erro interno no servidor: ${error.message}` },
      { status: 500 }
    );
  }
}
