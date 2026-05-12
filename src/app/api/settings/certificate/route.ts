import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { extractCertificate, validateCertificate, encryptPassword } from '@/lib/sefaz/certificate';

/**
 * GET /api/settings/certificate
 * Retorna informações do certificado configurado (sem expor dados sensíveis).
 */
export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const certDoc = await db.collection('system_settings').findOne({ type: 'certificado_a1' });

    if (!certDoc || !certDoc.pfxBase64) {
      return NextResponse.json({
        configured: false,
        message: 'Nenhum certificado digital configurado.',
      });
    }

    // Retorna apenas metadados, nunca o conteúdo do certificado
    return NextResponse.json({
      configured: true,
      commonName: certDoc.commonName || 'N/A',
      cnpjCpf: certDoc.cnpjCpf || 'N/A',
      validFrom: certDoc.validFrom,
      validUntil: certDoc.validUntil,
      isExpired: certDoc.isExpired,
      daysRemaining: certDoc.daysRemaining,
      uploadedAt: certDoc.uploadedAt,
    });
  } catch (error: any) {
    console.error('GET /api/settings/certificate error:', error);
    return NextResponse.json({ message: error.message || 'Erro interno.' }, { status: 500 });
  }
}

/**
 * POST /api/settings/certificate
 * Recebe o upload de um certificado A1 (.pfx) + senha.
 * Valida, extrai metadados e armazena de forma segura no MongoDB.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const pfxFile = formData.get('pfxFile') as File | null;
    const password = formData.get('password') as string | null;

    if (!pfxFile) {
      return NextResponse.json({ message: 'Arquivo .pfx não enviado.' }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ message: 'Senha do certificado não informada.' }, { status: 400 });
    }

    // Validar extensão do arquivo
    const fileName = pfxFile.name.toLowerCase();
    if (!fileName.endsWith('.pfx') && !fileName.endsWith('.p12')) {
      return NextResponse.json({ message: 'Formato inválido. Envie um arquivo .pfx ou .p12.' }, { status: 400 });
    }

    // Validar tamanho (máx 50KB — certificados A1 são pequenos)
    if (pfxFile.size > 50 * 1024) {
      return NextResponse.json({ message: 'Arquivo muito grande. Certificados A1 têm no máximo ~10KB.' }, { status: 400 });
    }

    // Converter File para Buffer
    const arrayBuffer = await pfxFile.arrayBuffer();
    const pfxBuffer = Buffer.from(arrayBuffer);

    // Extrair e validar certificado
    const certInfo = extractCertificate(pfxBuffer, password);
    const validation = validateCertificate(certInfo);

    if (!validation.valid) {
      return NextResponse.json({ message: validation.message }, { status: 400 });
    }

    // Criptografar a senha antes de salvar
    const encryptedPassword = encryptPassword(password);

    // Salvar no MongoDB
    const { db } = await connectToDatabase();
    await db.collection('system_settings').updateOne(
      { type: 'certificado_a1' },
      {
        $set: {
          type: 'certificado_a1',
          pfxBase64: pfxBuffer.toString('base64'),
          pfxPassword: encryptedPassword,
          commonName: certInfo.commonName,
          cnpjCpf: certInfo.cnpjCpf,
          validFrom: certInfo.validFrom.toISOString(),
          validUntil: certInfo.validUntil.toISOString(),
          isExpired: certInfo.isExpired,
          daysRemaining: certInfo.daysRemaining,
          uploadedAt: new Date().toISOString(),
          fileName: pfxFile.name,
        }
      },
      { upsert: true }
    );

    return NextResponse.json({
      message: 'Certificado A1 configurado com sucesso!',
      commonName: certInfo.commonName,
      cnpjCpf: certInfo.cnpjCpf,
      validUntil: certInfo.validUntil.toISOString(),
      daysRemaining: certInfo.daysRemaining,
      warning: certInfo.daysRemaining <= 30 ? validation.message : undefined,
    });
  } catch (error: any) {
    console.error('POST /api/settings/certificate error:', error);
    return NextResponse.json({ message: error.message || 'Erro ao processar certificado.' }, { status: 500 });
  }
}

/**
 * DELETE /api/settings/certificate
 * Remove o certificado digital configurado.
 */
export async function DELETE() {
  try {
    const { db } = await connectToDatabase();
    await db.collection('system_settings').deleteOne({ type: 'certificado_a1' });

    return NextResponse.json({ message: 'Certificado removido com sucesso.' });
  } catch (error: any) {
    console.error('DELETE /api/settings/certificate error:', error);
    return NextResponse.json({ message: error.message || 'Erro interno.' }, { status: 500 });
  }
}
