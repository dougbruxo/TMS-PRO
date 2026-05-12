
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET() {
  try {
    const { db } = await connectToDatabase();

    const [
      users,
      vehicles,
      companies,
      announcements,
      pricingSettings,
      quotes,
      expenses,
      expenseCategories,
      drivers,
      hiringTypes,
      earningDeductionTypes,
      payslips,
      notices,
      stockPositions,
      stockItems,
      loginHistory,
      profiles,
      talents,
    ] = await Promise.all([
      db.collection('users').find({}).project({ password: 0 }).toArray(),
      db.collection('vehicles').find({}).toArray(),
      db.collection('customers').find({}).sort({ razaoSocial: 1 }).toArray(),
      db.collection('announcements').find({}).sort({ pinned: -1, timestamp: -1 }).toArray(),
      db.collection('settings').findOne({ _id: 'pricing' }),
      db.collection('quotes').find({}).sort({ data: -1 }).limit(1000).toArray(),
      db.collection('expenses').find({}).sort({ dueDate: -1 }).toArray(),
      db.collection('expense_categories').find({}).sort({ name: 1 }).toArray(),
      db.collection('drivers').find({}).sort({ name: 1 }).toArray(),
      db.collection('hiringTypes').find({}).sort({ name: 1 }).toArray(),
      db.collection('earningDeductionTypes').find({}).sort({ code: 1 }).toArray(),
      db.collection('payslips').find({}).sort({ createdAt: -1 }).toArray(),
      db.collection('notices').find({}).sort({ timestamp: -1 }).toArray(),
      db.collection('stock_positions').find({}).sort({ name: 1 }).toArray(),
      db.collection('stock_items').find({}).sort({ lastActivity: -1 }).toArray(),
      db.collection('activityHistory').find({}).sort({ timestamp: -1 }).limit(1000).toArray(),
      db.collection('company_profiles').find({}).sort({ razaoSocial: 1 }).toArray(),
      db.collection('talents').find({}).sort({ fullName: 1 }).toArray(),
    ]);
    
    // Helper function to map _id to id
    const mapId = (item: any) => {
        const { _id, ...rest } = item;
        return { id: _id.toHexString(), ...rest };
    };

    const data = {
        users: users.map(mapId),
        vehicles: vehicles.map(mapId),
        companies: companies.map(mapId),
        announcements: announcements.map(mapId),
        pricingSettings: pricingSettings ? (({ _id, ...rest }) => rest)(pricingSettings) : null,
        quotes: quotes.map(mapId),
        expenses: expenses.map(mapId),
        expenseCategories: expenseCategories.map(cat => ({
            ...cat,
            id: typeof cat._id === 'string' ? cat._id : cat._id.toHexString()
        })),
        drivers: drivers.map(mapId),
        hiringTypes: hiringTypes.map(mapId),
        earningDeductionTypes: earningDeductionTypes.map(mapId),
        payslips: payslips.map(mapId),
        notices: notices.map(mapId),
        stockPositions: stockPositions.map(mapId),
        stockItems: stockItems.map(mapId),
        loginHistory: loginHistory.map(mapId),
        profiles: profiles.map(mapId),
        talents: talents.map(mapId),
    };

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('API App Data GET Error:', error);
    return NextResponse.json({ message: `Erro ao buscar dados da aplicação: ${error.message}` }, { status: 500 });
  }
}
