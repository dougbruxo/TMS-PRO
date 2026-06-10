
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Quote, QuoteHistoryEvent, BillingHistoryEvent, OperationalEvent, Expense, PricingSettings, User } from '@/lib/types';
import { format, parseISO, addDays, setDate } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { getUserFromRequest } from '@/lib/auth-api';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    const params = await context.params;
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts.pop() || '';

    const authUser = getUserFromRequest(request);
    if (!authUser) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: 'ID de cotação inválido' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const quote = await db.collection<Quote>('quotes').findOne({ _id: new ObjectId(id) });

    if (!quote) {
      return NextResponse.json({ message: 'Cotação não encontrada' }, { status: 404 });
    }

    // Verificação de Multi-Tenancy — só restringe clientes
    if (authUser.role === 'cliente' || authUser.role === 'sub-cliente') {
      const tenantId = authUser.role === 'sub-cliente' ? (authUser.parentId || authUser.userId) : authUser.userId;
      
      let hasAccess = quote.userId === tenantId;
      
      if (!hasAccess && quote.tomadorId) {
        const clientCompanies = await db.collection('client_companies').find({ userId: tenantId }).toArray();
        const companyCnpjsCleaned = clientCompanies.map(c => c.cnpj.replace(/[^\d]/g, ''));
        const companyCnpjsRaw = clientCompanies.map(c => c.cnpj);
        const allCnpjs = Array.from(new Set([...companyCnpjsCleaned, ...companyCnpjsRaw]));
        
        if (allCnpjs.length > 0) {
          const matchingCustomers = await db.collection('customers').find({ 
            cnpj: { $in: allCnpjs } 
          }).toArray();
          const customerIds = matchingCustomers.map(c => c._id.toHexString());
          
          hasAccess = customerIds.includes(quote.tomadorId) || matchingCustomers.some(c => c._id.toString() === quote.tomadorId.toString());
        }
      }
      
      if (!hasAccess) {
        return NextResponse.json({ message: 'Acesso negado para este registro.' }, { status: 403 });
      }
    }

    const { _id, ...rest } = quote;
    return NextResponse.json({ id: _id.toHexString(), ...rest }, { status: 200 });
  } catch (error: any) {
    console.error('API Quote GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar cotação: ${error.message}` }, { status: 500 });
  }
}

const formatValueForLog = (key: string, value: any): string => {
    if (value === null || value === undefined || value === '') return 'N/A';
    const currencyFields = ['valorFinal', 'totalFrete', 'desconto', 'icmsValor', 'adicional', 'adicionalProduto', 'valorProduto', 'totalExpense', 'grossProfit', 'paidAmount'];
    if (currencyFields.includes(key)) {
        return (value as number).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    if (key.toLowerCase().includes('date') || key.toLowerCase().includes('at')) {
        try {
            return format(parseISO(value), 'dd/MM/yyyy HH:mm');
        } catch {
            return value;
        }
    }
    return String(value);
};

async function getNextCustomerCode(db: any) {
    const counter = await db.collection('counters').findOneAndUpdate(
        { _id: 'customerCode' },
        { $inc: { seq: 1 } },
        { returnDocument: 'after', upsert: true }
    );
    const seq = counter?.seq ?? 1;
    return `CL${seq.toString().padStart(5, '0')}`;
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    const params = await context.params;
  try {
    const pathname = new URL(request.url).pathname;
    const parts = pathname.split('/');
    const id = parts.pop() || '';

    const authUser = getUserFromRequest(request);
    if (!authUser) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    
    const body = await request.json();
    
    if (!ObjectId.isValid(id)) {
        return NextResponse.json({ message: "ID de cotação inválido" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const originalQuote = await db.collection<Quote>('quotes').findOne({ _id: new ObjectId(id) });
    if (!originalQuote) {
        return NextResponse.json({ message: "Cotação não encontrada" }, { status: 404 });
    }

    // Verificação de Multi-Tenancy — só restringe clientes
    if (authUser.role === 'cliente' || authUser.role === 'sub-cliente') {
        const tenantId = authUser.role === 'sub-cliente' ? (authUser.parentId || authUser.userId) : authUser.userId;
        if (originalQuote.userId !== tenantId) {
            return NextResponse.json({ message: "Acesso negado para este registro." }, { status: 403 });
        }
    }
    
    const { user, operationalEvent, history, nfeParties, ...otherUpdates } = body;
    
    const updateOperation: { $set?: any, $push?: any } = {};
    
    const setUpdates: Partial<Quote> = {};
    const changeDetails: string[] = [];
    const billingHistoryEvents: BillingHistoryEvent[] = [];

    // --- XML Intelligent Customers Registration ---
    if (nfeParties) {
        try {
            const registerCustomerIfMissing = async (partyData: any, typeLabel: string) => {
                if (!partyData || !partyData.cnpjCpf) return { id: null, name: null };
                const cleanedCnpj = partyData.cnpjCpf.replace(/\D/g, '');
                if (!cleanedCnpj) return { id: null, name: partyData.name };

                let existing = await db.collection('customers').findOne({ cnpj: cleanedCnpj });
                if (existing) return { id: existing._id.toHexString(), name: existing.razaoSocial };

                const code = await getNextCustomerCode(db);
                const isPJ = cleanedCnpj.length > 11;
                const newCustomer = {
                    code: code.toString(),
                    type: isPJ ? 'PJ' : 'PF',
                    cnpj: cleanedCnpj,
                    razaoSocial: partyData.name,
                    inscricaoEstadual: partyData.ie || (isPJ ? 'ISENTO' : ''),
                    endereco: partyData.address || '',
                    cidade: partyData.city || '',
                    estado: partyData.state || '',
                    cep: partyData.zipCode || '',
                    codigo_ibge: partyData.cMun || '', // Added cMun as codigo_ibge
                    disabled: false,
                    createdAt: new Date().toISOString()
                };
                const result = await db.collection('customers').insertOne(newCustomer);
                changeDetails.push(`Novo ${typeLabel} cadastrado via XML (${partyData.name})`);
                return { id: result.insertedId.toHexString(), name: newCustomer.razaoSocial };
            };

            const emitData = await registerCustomerIfMissing(nfeParties.emitente, 'Remetente');
            const destData = await registerCustomerIfMissing(nfeParties.destinatario, 'Destinatário');

            if (emitData.id) (setUpdates as any).remetenteId = emitData.id;
            if (emitData.name) (setUpdates as any).remetente = emitData.name;
            if (destData.id) (setUpdates as any).destinatarioId = destData.id;
            if (destData.name) (setUpdates as any).destinatario = destData.name;

            // Mapeamento e registro inteligente do Tomador
            let xmlTomadorParty = null;
            const quoteTomadorLower = (originalQuote.tomador || '').toLowerCase().trim();
            const quoteRemetenteLower = (originalQuote.remetente || '').toLowerCase().trim();
            const quoteDestinatarioLower = (originalQuote.destinatario || '').toLowerCase().trim();
            
            const nfeEmit = nfeParties.emitente;
            const nfeDest = nfeParties.destinatario;
            
            const emitNameLower = (nfeEmit?.name || '').toLowerCase().trim();
            const destNameLower = (nfeDest?.name || '').toLowerCase().trim();
            
            if (
              quoteTomadorLower === 'remetente' || 
              (quoteRemetenteLower && (quoteTomadorLower === quoteRemetenteLower || quoteTomadorLower.includes(quoteRemetenteLower) || quoteRemetenteLower.includes(quoteTomadorLower))) ||
              (emitNameLower && (emitNameLower.includes(quoteTomadorLower) || quoteTomadorLower.includes(emitNameLower)))
            ) {
              xmlTomadorParty = nfeEmit;
            } else if (
              quoteTomadorLower === 'destinatario' || 
              (quoteDestinatarioLower && (quoteTomadorLower === quoteDestinatarioLower || quoteTomadorLower.includes(quoteDestinatarioLower) || quoteDestinatarioLower.includes(quoteTomadorLower))) ||
              (destNameLower && (destNameLower.includes(quoteTomadorLower) || quoteTomadorLower.includes(destNameLower)))
            ) {
              xmlTomadorParty = nfeDest;
            } else {
              xmlTomadorParty = nfeEmit || nfeDest;
            }

            if (xmlTomadorParty) {
              const tomadorData = await registerCustomerIfMissing(xmlTomadorParty, 'Tomador');
              if (tomadorData.id) {
                (setUpdates as any).tomadorId = tomadorData.id;
                changeDetails.push(`"tomadorId" de "N/A" para "${tomadorData.id}"`);
              }
              if (tomadorData.name) {
                (setUpdates as any).tomador = tomadorData.name;
                if (originalQuote.tomador !== tomadorData.name) {
                  changeDetails.push(`"tomador" de "${originalQuote.tomador || 'N/A'}" para "${tomadorData.name}"`);
                }
              }
            }
            
        } catch (partyErr) {
            console.error("Error creating customers from nfeParties:", partyErr);
        }
    }

    // --- Recalculation and History Logging ---
    if (user) {
        // Handle Discount Change
        if (body.desconto !== undefined && body.desconto !== originalQuote.desconto) {
            const oldDesconto = originalQuote.desconto || 0;
            const totalOriginal = (originalQuote.valorFinal || 0) + (originalQuote.icmsValor || 0) + oldDesconto;
            
            const targetTotal = totalOriginal - body.desconto;
            const icmsAliquota = originalQuote.icmsAliquota || 0;
            
            const divisor = 1 + (icmsAliquota / 100);
            const novoValorFinal = targetTotal / divisor;
            const novoIcmsValor = targetTotal - novoValorFinal;
            
            setUpdates.valorFinal = Math.round(novoValorFinal * 100) / 100;
            setUpdates.icmsValor = Math.round(novoIcmsValor * 100) / 100;
            setUpdates.grossProfit = Math.round(targetTotal * 100) / 100;

            billingHistoryEvents.push({
                id: `hist-${Date.now()}-discount`,
                timestamp: new Date().toISOString(),
                userId: user.id,
                username: user.username,
                action: 'DESCONTO_APLICADO',
                details: `Desconto de ${body.desconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} aplicado.`
            });
        }

        // Handle Due Date Change
        if (body.billingDueDate && body.billingDueDate !== originalQuote.billingDueDate) {
            billingHistoryEvents.push({
                id: `hist-${Date.now()}-due`,
                timestamp: new Date().toISOString(),
                userId: user.id,
                username: user.username,
                action: 'VENCIMENTO_ALTERADO',
                details: `Vencimento alterado para ${format(parseISO(body.billingDueDate), 'dd/MM/yyyy')}.`
            });
        }
        
        // Handle Payment
        if (body.paidAmount !== undefined && body.paidAmount > (originalQuote.paidAmount || 0)) {
            const amountBeingPaid = body.paidAmount - (originalQuote.paidAmount || 0);
            const totalComDesconto = (setUpdates.valorFinal ?? originalQuote.valorFinal) + (setUpdates.icmsValor ?? originalQuote.icmsValor ?? 0);
            
            if (body.paidAmount >= totalComDesconto) {
              setUpdates.paymentStatus = 'Pago';
              setUpdates.paymentDate = body.paymentDate || new Date().toISOString();
            } else {
              setUpdates.paymentStatus = 'Parcial';
              setUpdates.paymentDate = null;
            }

            billingHistoryEvents.push({
                id: `hist-${Date.now()}-pay`,
                timestamp: new Date().toISOString(),
                userId: user.id,
                username: user.username,
                action: 'PAGAMENTO_REGISTRADO',
                details: `Pagamento de ${amountBeingPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} registrado. Novo status: "${setUpdates.paymentStatus}".`
            });
        }
        
        // Log other generic changes
        Object.keys(body).forEach(key => {
            const updatableFields = ['status', 'obs', 'billingDueDate', 'paymentStatus', 'paymentDate', 'valorFinal', 'desconto', 'enderecoColeta', 'enderecoEntrega', 'priority', 'paidAmount', 'invoiceId', 'nfeXml', 'peso', 'volumeCount', 'quantidade', 'nfNumber', 'nfeChave', 'driverId', 'driverName', 'vehicleId', 'totalExpense', 'remetenteId', 'destinatarioId', 'remetente', 'destinatario', 'tomador', 'tomadorId', 'responsavelSolicitante', 'contato', 'email', 'isRuralOrigem', 'isRuralDestino', 'cubagem', 'hasManualFinalValue', 'hasManualBaseFreight', 'valorBaseManual', 'operationalHistory'];
            if (updatableFields.includes(key) && JSON.stringify(originalQuote[key as keyof Quote]) !== JSON.stringify(body[key])) {
                (setUpdates as any)[key] = body[key];
                 if (user && key !== 'operationalHistory') {
                     changeDetails.push(`"${key}" de "${formatValueForLog(key, originalQuote[key as keyof Quote])}" para "${formatValueForLog(key, body[key])}"`);
                 }
            }
        });
    }

    if (setUpdates.status === 'Finalizado') {
      if (!originalQuote.closedAt) {
        setUpdates.closedAt = new Date().toISOString();
      }
      const deliveryDateStr = setUpdates.closedAt || originalQuote.closedAt || new Date().toISOString();
      const forecastStr = body.deliveryForecast || originalQuote.deliveryForecast;
      if (forecastStr) {
        const forecastDate = new Date(forecastStr);
        const deliveryDate = new Date(deliveryDateStr);
        if (!isNaN(forecastDate.getTime()) && !isNaN(deliveryDate.getTime())) {
          setUpdates.deliveryStatus = deliveryDate <= forecastDate ? 'No Prazo' : 'Atrasado';
        }
      }
    }

    if (setUpdates.status === 'Em Rota' && originalQuote.status !== 'Em Rota') {
      const prazo = Number(setUpdates.prazoEntrega ?? originalQuote.prazoEntrega ?? 0);
      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + prazo);
      setUpdates.deliveryForecast = forecastDate.toISOString();
      
      // Também adicionamos aos logs do histórico a nova previsão
      changeDetails.push(`"deliveryForecast" de "${originalQuote.deliveryForecast ? formatValueForLog('deliveryForecast', originalQuote.deliveryForecast) : 'N/A'}" para "${formatValueForLog('deliveryForecast', setUpdates.deliveryForecast)}"`);
    }

    // Processamento de Notificações In-App e Regras de Motorista Terceiro
    if (setUpdates.status && setUpdates.status !== originalQuote.status) {
        const oldStatus = originalQuote.status;
        const newStatus = setUpdates.status;
        const quoteCode = originalQuote.quoteCode || `LEGACY-${id.slice(0, 5)}`;
        
        try {
            // 1. Notificação para o criador da cotação
            if (originalQuote.userId) {
                const userNotification = {
                    userId: originalQuote.userId,
                    title: `Cotação ${quoteCode} atualizada`,
                    message: `A cotação mudou de "${oldStatus}" para "${newStatus}".`,
                    type: 'status_change',
                    quoteId: id,
                    quoteCode: quoteCode,
                    read: false,
                    createdAt: new Date().toISOString()
                };
                await db.collection('notifications').insertOne(userNotification);
            }
            
            // 2. Verificação de motorista Terceiro para status "No Galpão" ou "Entregue"
            const isTargetStatus = newStatus === 'No Galpão' || newStatus === 'Entregue';
            if (isTargetStatus) {
                const driverId = body.driverId || originalQuote.driverId;
                if (driverId) {
                    let isThirdParty = false;
                    let driverName = body.driverName || originalQuote.driverName || 'Motorista';
                    try {
                        const driver = await db.collection('drivers').findOne({ _id: new ObjectId(driverId) });
                        if (driver && driver.isThirdParty) {
                            isThirdParty = true;
                            driverName = driver.name;
                        }
                    } catch (err) {
                        const driver = await db.collection('drivers').findOne({ id: driverId });
                        if (driver && driver.isThirdParty) {
                            isThirdParty = true;
                            driverName = driver.name;
                        }
                    }
                    
                    if (isThirdParty) {
                        // Notificar Administradores
                        const adminNotification = {
                            userId: 'admin',
                            title: `Alerta de Terceiro: Cotação ${quoteCode}`,
                            message: `A cotação está "${newStatus}" com o motorista terceiro ${driverName}. Despesas marcadas como atrasadas.`,
                            type: 'third_party_alert',
                            quoteId: id,
                            quoteCode: quoteCode,
                            read: false,
                            createdAt: new Date().toISOString()
                        };
                        await db.collection('notifications').insertOne(adminNotification);
                        
                        // Atualizar despesas associadas para "atrasado"
                        await db.collection('expenses').updateMany(
                            { 
                                quoteId: id, 
                                status: { $in: ['pendente', 'parcial'] } 
                            },
                            { 
                                $set: { status: 'atrasado' },
                                $push: {
                                    history: {
                                        timestamp: new Date().toISOString(),
                                        user: 'Sistema',
                                        action: 'Atualização Automática',
                                        details: `Despesa marcada como atrasada devido à confirmação de status "${newStatus}" com motorista Terceiro.`
                                    }
                                } as any
                            }
                        );
                    }
                }
            }
        } catch (notifErr) {
            console.error('Erro ao processar notificações/alertas de terceiros:', notifErr);
        }
    }

    // Handle Driver Rating process
    const isRatableStatus = setUpdates.status === 'Finalizado' || setUpdates.status === 'No Galpão' || setUpdates.status === 'Coleta';
    if (isRatableStatus && body.driverRating && body.driverRating >= 1 && body.driverRating <= 5) {
        const targetDriverId = body.operationalEvent?.driverId || (originalQuote as any).driverId;
          
          if (targetDriverId && ObjectId.isValid(targetDriverId)) {
              try {
                  const driver = await db.collection('drivers').findOne({ _id: new ObjectId(targetDriverId) });
                  if (driver) {
                      const currentRating = driver.rating || 0;
                      const currentCount = driver.ratingCount || 0;
                      const newCount = currentCount + 1;
                      const newRating = ((currentRating * currentCount) + body.driverRating) / newCount;
                      
                      await db.collection('drivers').updateOne(
                          { _id: new ObjectId(targetDriverId) },
                          { $set: { rating: newRating, ratingCount: newCount } }
                      );
                      changeDetails.push(`Avaliação de ${body.driverRating} estrelas atribuída ao motorista "${driver.name}"`);
                      
                      // Also save the rating in the quote for history
                      (setUpdates as any).driverRating = body.driverRating;
                  }
              } catch (err) {
                  console.error("Error updating driver rating:", err);
              }
          }
      }
    
    if (Object.keys(setUpdates).length > 0) {
        updateOperation.$set = setUpdates;
    }

    // --- Array Push Operations ---
    const pushOperations: any = {};
    if (history && Array.isArray(history)) {
        pushOperations.history = { $each: history, $position: 0 };
    }

    // Combine any new billing history events with those from the request body
    if (body.billingHistory && Array.isArray(body.billingHistory)) {
      billingHistoryEvents.push(...body.billingHistory);
    }
    if (billingHistoryEvents.length > 0) {
      pushOperations.billingHistory = { $each: billingHistoryEvents, $position: 0 };
    }
    
        // Process New Operational Event
    if (operationalEvent && user) {
        const operationalEventId = uuidv4();
        const fullEvent: OperationalEvent = { id: operationalEventId, timestamp: new Date().toISOString(), userId: user.id, username: user.username, status: body.status || originalQuote.status, details: operationalEvent.details || `Status alterado para ${body.status}`, action: operationalEvent.action || 'ETAPA_OPERACIONAL', ...operationalEvent };
        
        if (body.operationalHistory && Array.isArray(body.operationalHistory)) {
            body.operationalHistory.push(fullEvent);
            setUpdates.operationalHistory = body.operationalHistory;
        } else {
            pushOperations.operationalHistory = { $each: [fullEvent] };
        }
        
        if (fullEvent.expense && fullEvent.expense > 0) {
          // Incrementar totalExpense na cotação
          const currentExpense = originalQuote.totalExpense || 0;
          setUpdates.totalExpense = currentExpense + fullEvent.expense;

          // Lógica de fallback para motorista
          let finalDriverId = fullEvent.driverId || body.driverId || originalQuote.driverId || null;
          let finalDriverName = fullEvent.driverName || body.driverName || originalQuote.driverName || null;

          if (finalDriverId && !finalDriverName) {
              try {
                  const driverObj = await db.collection('drivers').findOne({ _id: new ObjectId(finalDriverId) });
                  if (driverObj) {
                      finalDriverName = driverObj.name;
                  }
              } catch (err) {
                  console.error("Erro ao buscar motorista para despesa:", err);
              }
          }

          // Criar registro de despesa na collection 'expenses'
          const now = new Date();
          const expenseMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          const driverLabel = finalDriverName || 'Motorista não identificado';
          const expenseRecord = {
              description: `${driverLabel} - ${fullEvent.action} - ${originalQuote.quoteCode || id}`,
              value: fullEvent.expense,
              categoryId: 'DRIVER_PAYMENT',
              categoryName: 'Motorista',
              quoteId: id,
              operationalEventId: operationalEventId,
              driverId: finalDriverId,
              driverName: finalDriverName,
              monthYear: expenseMonthYear,
              dueDate: now.toISOString(),
              createdBy: user.id,
              createdAt: new Date().toISOString(),
              status: 'pendente',
              isRecurring: false,
              history: [{
                  timestamp: new Date().toISOString(),
                  user: user.username,
                  action: 'Criação',
                  details: `Despesa criada via fluxo operacional (${fullEvent.action}).`
              }]
          };
          await db.collection('expenses').insertOne(expenseRecord);
        }
    }
    
    // Log general changes to main history
    if (changeDetails.length > 0 && user) {
        if (!pushOperations.history) { pushOperations.history = { $each: [], $position: 0 }; }
        const historyEvent: QuoteHistoryEvent = { id: uuidv4(), timestamp: new Date().toISOString(), userId: user.id, username: user.username, action: 'ALTERACAO', details: `Dados alterados: ${changeDetails.join('; ')}.` };
        pushOperations.history.$each.unshift(historyEvent);
    }
    
    if(Object.keys(pushOperations).length > 0) {
        updateOperation.$push = pushOperations;
    }
    
    if (Object.keys(updateOperation).length === 0) {
        return NextResponse.json({ message: "Nenhuma alteração detectada.", quote: originalQuote }, { status: 200 });
    }

    const result = await db.collection('quotes').updateOne({ _id: new ObjectId(id) }, updateOperation);
    
    if (result.matchedCount === 0) {
        return NextResponse.json({ message: "Cotação não encontrada" }, { status: 404 });
    }

    // --- Sync with Linked Invoice ---
    const updatedQuoteFromDb = await db.collection('quotes').findOne({ _id: new ObjectId(id) });
    if (updatedQuoteFromDb && updatedQuoteFromDb.invoiceId) {
        try {
            const invoiceId = updatedQuoteFromDb.invoiceId;
            // Fetch all quotes for this invoice to recalculate totalValue
            const siblingQuotes = await db.collection('quotes').find({ invoiceId }).toArray();
            const newTotalValue = siblingQuotes.reduce((acc, q) => acc + (q.valorFinal || 0) + (q.icmsValor || 0), 0);
            
            // Build invoice update
            const invoiceUpdate: any = { totalValue: newTotalValue };
            
            // If tomador changed, update it in the invoice as well (assuming invoice tomador follows the quotes)
            if (setUpdates.tomador) {
                invoiceUpdate.tomador = setUpdates.tomador;
            }
            if (setUpdates.tomadorId) {
                invoiceUpdate.tomadorId = setUpdates.tomadorId;
            }

            await db.collection('invoices').updateOne(
                { _id: new ObjectId(invoiceId) },
                { 
                    $set: invoiceUpdate,
                    $push: {
                        billingHistory: {
                            $each: [{
                                id: `hist-${Date.now()}-sync`,
                                timestamp: new Date().toISOString(),
                                userId: user?.id || 'system',
                                username: user?.username || 'Sistema',
                                action: 'SINCRONIZACAO',
                                details: `Fatura atualizada automaticamente após edição da cotação ${updatedQuoteFromDb.quoteCode}. Novo total: ${newTotalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`
                            } as any],
                            $position: 0
                        }
                    } as any
                }
            );
        } catch (syncErr) {
            console.error("Error syncing with invoice:", syncErr);
        }
    }
    
    if (updatedQuoteFromDb) {
      const { _id, ...rest } = updatedQuoteFromDb;
      const quoteToReturn = { id: _id.toHexString(), ...rest };
      return NextResponse.json({ message: "Cotação atualizada com sucesso", quote: quoteToReturn }, { status: 200 });
    }
    
    return NextResponse.json({ message: "Cotação atualizada, mas não foi possível retorná-la" }, { status: 200 });

  } catch (error: any) {
    console.error('API Quote PUT Error:', error);
    return NextResponse.json({ message: `Erro ao atualizar cotação: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    const params = await context.params;
    try {
        const pathname = new URL(request.url).pathname;
        const parts = pathname.split('/');
        const id = parts.pop() || '';
        
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ message: "ID de cotação inválido" }, { status: 400 });
        }

        const authUser = getUserFromRequest(request);
        if (!authUser) return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });

        const { db } = await connectToDatabase();
        
        // Verificação de Multi-Tenancy antes de apagar — só restringe clientes
        if (authUser.role === 'cliente' || authUser.role === 'sub-cliente') {
            const originalQuote = await db.collection<Quote>('quotes').findOne({ _id: new ObjectId(id) });
            if (originalQuote) {
                const tenantId = authUser.role === 'sub-cliente' ? (authUser.parentId || authUser.userId) : authUser.userId;
                if (originalQuote.userId !== tenantId) {
                    return NextResponse.json({ message: "Acesso negado para este registro." }, { status: 403 });
                }
            }
        }
        
        const result = await db.collection('quotes').deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            return NextResponse.json({ message: "Cotação não encontrada" }, { status: 404 });
        }

        return NextResponse.json({ message: "Cotação apagada com sucesso" }, { status: 200 });
    } catch (error: any) {
        console.error('API Quote DELETE Error:', error);
        return NextResponse.json({ message: `Erro ao apagar cotação: ${error.message}` }, { status: 500 });
    }
}
