
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { differenceInDays, parseISO, addDays, startOfToday } from 'date-fns';
import type { Quote, PricingSettings, Invoice, Expense } from '@/lib/types';
import { initialPricingSettings } from '@/lib/data';

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    
    const settings = (await db.collection('settings').findOne({ _id: 'pricing' })) as PricingSettings | null;
    const alertSettings = settings?.alerts || initialPricingSettings.alerts;
    const today = startOfToday();

    // --- OPERATIONAL ALERTS ---
    // 1. Calculate overdue collections
    const collectionQuotes = await db.collection<Quote>('quotes').find({
      status: 'Fechada',
      closedAt: { $exists: true, $ne: null }
    }).project({ closedAt: 1 }).toArray();

    let collectionAlertCount = 0;
    collectionQuotes.forEach(quote => {
      const closedAt = parseISO(quote.closedAt!);
      const deadline = addDays(closedAt, alertSettings.collectionDeadlineDays);
      const alertDate = addDays(deadline, alertSettings.collectionAlertTriggerDays);
      if (today > alertDate) {
        collectionAlertCount++;
      }
    });

    // 2. Calculate delivery alerts
    const deliveryQuotes = await db.collection<Quote>('quotes').find({
      status: 'Em Rota',
      deliveryForecast: { $exists: true, $ne: null }
    }).project({ deliveryForecast: 1, prazoEntrega: 1 }).toArray();
    
    let deliveryAlertCount = 0;
    deliveryQuotes.forEach(quote => {
      if(!quote.deliveryForecast) return;
      const forecastDate = parseISO(quote.deliveryForecast!);
      // addDays handles negative numbers correctly (subtracts days)
      const alertDate = addDays(forecastDate, alertSettings.deliveryAlertTriggerDays * -1);
      if (today >= alertDate) {
        deliveryAlertCount++;
      }
    });
    
    // 3. Calculate warehouse stagnation alerts
    const warehouseQuotes = await db.collection<Quote>('quotes').find({
      status: { $in: ['No Galpão', 'Aguardando Saída', 'Em Carregamento'] }
    }).project({ operationalHistory: 1 }).toArray();

    let warehouseAlertCount = 0;
    warehouseQuotes.forEach(quote => {
        const enteredWarehouseEvent = [...(quote.operationalHistory || [])]
            .reverse()
            .find(e => e.status === 'No Galpão');
        
        if (enteredWarehouseEvent) {
            const enteredDate = parseISO(enteredWarehouseEvent.timestamp);
            const daysInWarehouse = differenceInDays(today, enteredDate);

            if (daysInWarehouse > alertSettings.warehouseStagnationDays) {
                warehouseAlertCount++;
            }
        }
    });
    
    // --- FINANCIAL ALERTS ---
    // 4. Calculate expense alerts
    const expenses = await db.collection<Expense>('expenses').find({
      status: { $in: ['pendente', 'parcial', 'atrasado'] },
      dueDate: { $exists: true, $ne: null }
    }).project({ dueDate: 1 }).toArray();

    let expenseAlertCount = 0;
    expenses.forEach(exp => {
      const dueDate = parseISO(exp.dueDate);
      const alertDate = addDays(dueDate, -alertSettings.expenseDueTriggerDays);
      if (today >= alertDate) {
        expenseAlertCount++;
      }
    });

    // 5. Calculate billing alerts (quotes + invoices)
    const pendingBillingQuotes = await db.collection<Quote>('quotes').find({
      status: { $in: ['Fechada', 'Finalizado'] },
      paymentStatus: { $in: ['Pendente', 'Parcial'] },
      billingDueDate: { $exists: true, $ne: null }
    }).project({ billingDueDate: 1 }).toArray();

    const pendingInvoices = await db.collection<Invoice>('invoices').find({
      status: { $in: ['Pendente', 'Parcial'] },
      billingDueDate: { $exists: true, $ne: null }
    }).project({ billingDueDate: 1 }).toArray();

    let billingAlertCount = 0;
    const allBillingItems = [...pendingBillingQuotes, ...pendingInvoices];
    
    allBillingItems.forEach(item => {
      if(!item.billingDueDate) return;
      const dueDate = parseISO(item.billingDueDate!);
      const alertDate = addDays(dueDate, -alertSettings.billingDueTriggerDays);
      if (today >= alertDate) {
        billingAlertCount++;
      }
    });
    
    return NextResponse.json({ 
        operationalAlertCount: collectionAlertCount + deliveryAlertCount + warehouseAlertCount,
        receivingAlertCount: warehouseAlertCount,
        expenseAlertCount: expenseAlertCount,
        billingAlertCount: billingAlertCount
    });

  } catch (error: any) {
    console.error('API Alerts GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar alertas: ${error.message}` }, { status: 500 });
  }
}
