import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

export async function GET() {
    try {
        const { db } = await connectToDatabase();
        const settings = await db.collection('system_settings').findOne({ type: 'ambiente_sefaz' });
        
        return NextResponse.json({ 
            sefazEnvironment: settings?.sefazEnvironment || 'homologacao',
            nextCteNumber: settings?.nextCteNumber || 1,
            nextMdfeNumber: settings?.nextMdfeNumber || 1,
            defaultIbsRate: settings?.defaultIbsRate || 0,
            defaultCbsRate: settings?.defaultCbsRate || 0,
            defaultCstIbsCbs: settings?.defaultCstIbsCbs || '00',
            defaultNaturezaOperacao: settings?.defaultNaturezaOperacao || 'PRESTACAO DE SERVICO DE TRANSPORTE',
            defaultTpCTe: settings?.defaultTpCTe ?? 0,
            defaultTpServ: settings?.defaultTpServ ?? 0,
            defaultTpEmis: settings?.defaultTpEmis ?? 1,
            defaultSerie: settings?.defaultSerie ?? 1,
            ciotUser: settings?.ciotUser || '',
            ciotPassword: settings?.ciotPassword || '',
            ciotEnv: settings?.ciotEnv || 'homologacao'
        });
    } catch (error) {
        return NextResponse.json({ message: 'Erro ao buscar configurações globais do sistema' }, { status: 500 });
    }
}

    export async function POST(request: Request) {
        try {
            const { 
                sefazEnvironment, nextCteNumber, nextMdfeNumber, 
                defaultIbsRate, defaultCbsRate, defaultCstIbsCbs, 
                defaultNaturezaOperacao, defaultTpCTe, defaultTpServ, 
                defaultTpEmis, defaultSerie,
                ciotUser, ciotPassword, ciotEnv
            } = await request.json();
            
            if (!['producao', 'homologacao'].includes(sefazEnvironment)) {
                return NextResponse.json({ message: 'Ambiente inválido. Deve ser producao ou homologacao.' }, { status: 400 });
            }
    
            const { db } = await connectToDatabase();
            await db.collection('system_settings').updateOne(
                { type: 'ambiente_sefaz' },
                { $set: { 
                    sefazEnvironment, 
                    nextCteNumber: Number(nextCteNumber) || 1,
                    nextMdfeNumber: Number(nextMdfeNumber) || 1,
                    defaultIbsRate: Number(defaultIbsRate) || 0,
                    defaultCbsRate: Number(defaultCbsRate) || 0,
                    defaultCstIbsCbs: defaultCstIbsCbs || '00',
                    defaultNaturezaOperacao: defaultNaturezaOperacao || 'PRESTACAO DE SERVICO DE TRANSPORTE',
                    defaultTpCTe: Number(defaultTpCTe) || 0,
                    defaultTpServ: Number(defaultTpServ) || 0,
                    defaultTpEmis: Number(defaultTpEmis) || 1,
                    defaultSerie: Number(defaultSerie) || 1,
                    ciotUser: ciotUser || '',
                    ciotPassword: ciotPassword || '',
                    ciotEnv: ciotEnv || 'homologacao',
                    type: 'ambiente_sefaz' 
                } },
                { upsert: true }
            );

        return NextResponse.json({ message: 'Ambiente do Sistema salvo com sucesso.', sefazEnvironment });
    } catch (error) {
        return NextResponse.json({ message: 'Erro ao salvar o ambiente mestre.' }, { status: 500 });
    }
}
