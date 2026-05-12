import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { loadCertificateFromDB, validateCertificate } from '@/lib/sefaz/certificate';
import { consultarStatusServico, type StatusServicoResponse } from '@/lib/sefaz/soap-client';
import type { SefazAmbiente } from '@/lib/sefaz/endpoints';

/**
 * GET /api/sefaz/status
 * Consulta se o serviço da SEFAZ está online.
 * Usado para teste de conectividade na tela de configurações.
 */
export async function GET() {
  try {
    const { db } = await connectToDatabase();
    
    // 1. Carregar certificado
    const cert = await loadCertificateFromDB(db);
    if (!cert) {
      return NextResponse.json({
        online: false,
        message: 'Certificado digital A1 não configurado. Importe-o em Configurações > Certificado Digital.',
      }, { status: 400 });
    }
    
    // 2. Validar certificado
    const validation = validateCertificate(cert);
    if (!validation.valid) {
      return NextResponse.json({
        online: false,
        message: validation.message,
      }, { status: 400 });
    }
    
    // 3. Determinar UF e ambiente
    const emitente = await db.collection('company_profiles').findOne({ isDefault: true });
    if (!emitente) {
      return NextResponse.json({
        online: false,
        message: 'Perfil da empresa emitente não configurado.',
      }, { status: 400 });
    }
    
    const sysSettings = await db.collection('system_settings').findOne({ type: 'ambiente_sefaz' });
    const ambiente: SefazAmbiente = sysSettings?.sefazEnvironment === 'producao' ? 'producao' : 'homologacao';
    const uf = emitente.estado?.substring(0, 2).toUpperCase() || 'SP';
    
    // Check Cache
    const CACHE_MINUTES = 5;
    const cacheRecord = await db.collection('system_settings').findOne({ type: 'sefaz_status_cache', uf, ambiente });
    if (cacheRecord && cacheRecord.updatedAt) {
      const diffMin = (new Date().getTime() - new Date(cacheRecord.updatedAt).getTime()) / 60000;
      if (diffMin < CACHE_MINUTES) {
        return NextResponse.json(cacheRecord.data);
      }
    }
    
    // 4. Consultar status do serviço
    const status: StatusServicoResponse = await consultarStatusServico(uf, ambiente, cert);
    
    const responseData = {
      online: status.online,
      cStat: status.cStat,
      xMotivo: status.xMotivo,
      tMed: status.tMed,
      dhRetorno: status.dhRetorno,
      xObs: status.xObs,
      ambiente,
      uf,
      message: status.online
        ? `✅ SEFAZ ${uf} (${ambiente}) está operando normalmente.`
        : `⚠️ SEFAZ ${uf} (${ambiente}): ${status.xMotivo}`,
    };

    // Save to Cache
    await db.collection('system_settings').updateOne(
      { type: 'sefaz_status_cache', uf, ambiente },
      { $set: { data: responseData, updatedAt: new Date() } },
      { upsert: true }
    );
    
    return NextResponse.json(responseData);
    
  } catch (error: any) {
    console.error('GET /api/sefaz/status error:', error);
    return NextResponse.json({
      online: false,
      message: `Erro ao consultar SEFAZ: ${error.message}`,
    }, { status: 500 });
  }
}
