/**
 * DezLog Fiscal Engine — Certificate Manager
 * Gerencia certificados digitais A1 (PKCS#12 / .pfx).
 * 
 * O certificado digital A1 é armazenado no MongoDB como Buffer base64.
 * Este módulo é responsável por:
 * - Extrair chave privada e certificado público do .pfx
 * - Validar se o certificado está dentro da validade
 * - Fornecer os objetos necessários para assinatura XML e TLS mútuo
 */

import crypto from 'crypto';

export interface CertificateInfo {
  /** Chave privada em formato PEM */
  privateKey: string;
  /** Certificado público em formato PEM */
  certificate: string;
  /** Certificado público em formato DER (base64, para uso no XML Signature) */
  certificateBase64: string;
  /** Data de validade do certificado */
  validUntil: Date;
  /** Data de emissão do certificado */
  validFrom: Date;
  /** Nome do titular (Common Name) */
  commonName: string;
  /** CNPJ ou CPF extraído do certificado */
  cnpjCpf: string;
  /** Se o certificado está expirado */
  isExpired: boolean;
  /** Dias restantes de validade */
  daysRemaining: number;
}

import forge from 'node-forge';

/**
 * Extrai as informações de um certificado digital A1 (.pfx / .p12).
 * 
 * @param pfxBuffer - O conteúdo do arquivo .pfx como Buffer
 * @param password - A senha do certificado
 * @returns Objeto com chave privada, certificado público e metadados
 * @throws Error se o arquivo ou a senha forem inválidos
 */
export function extractCertificate(pfxBuffer: Buffer, password: string): CertificateInfo {
  try {
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
    
    let privateKeyPem = '';
    let certificatePem = '';
    let certObj: forge.pki.Certificate | null = null;
    
    const safeBags = p12.safeContents.flatMap((sc: any) => sc.safeBags);
    for (const safeBag of safeBags) {
      if (safeBag.type === forge.pki.oids.keyBag || safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
        privateKeyPem = forge.pki.privateKeyToPem(safeBag.key);
      } else if (safeBag.type === forge.pki.oids.certBag) {
        // Pega o certificado. Se houver múltiplos (cadeia), normalmente o do usuário tem os attributos CN
        if (!certObj || safeBag.cert.subject.attributes.length > certObj.subject.attributes.length) {
          certObj = safeBag.cert;
          certificatePem = forge.pki.certificateToPem(certObj);
        }
      }
    }

    if (!certObj || !privateKeyPem) {
      throw new Error('Não foi possível extrair a chave privada ou certificado do arquivo.');
    }

    // Extrair o certificado em base64 puro (sem cabeçalhos PEM)
    const certBase64Lines = certificatePem
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/\r?\n/g, '')
      .trim();

    // Extrair metadados
    const validUntil = certObj.validity.notAfter;
    const validFrom = certObj.validity.notBefore;
    const now = new Date();
    const isExpired = now > validUntil;
    const daysRemaining = Math.max(0, Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    // Extrair Common Name do subject
    const cnAttr = certObj.subject.getField('CN');
    const commonName = cnAttr ? cnAttr.value : 'Desconhecido';

    // Tentar extrair CNPJ/CPF
    let cnpjCpf = '';
    // A ICP Brasil normalmente coloca o CNPJ/CPF no CN, após dois pontos
    const cnpjMatch = String(commonName).match(/:(\d{11,14})/);
    if (cnpjMatch) {
      cnpjCpf = cnpjMatch[1];
    }

    return {
      privateKey: privateKeyPem,
      certificate: certificatePem,
      certificateBase64: certBase64Lines,
      validUntil,
      validFrom,
      commonName: String(commonName),
      cnpjCpf,
      isExpired,
      daysRemaining,
    };
  } catch (error: any) {
    if (error.message?.includes('PKCS#12 MAC could not be verified') || error.message?.includes('Invalid password')) {
      throw new Error('Senha do certificado incorreta. Verifique a senha informada.');
    }
    throw new Error(`Erro ao processar certificado: ${error.message}`);
  }
}

/**
 * Valida se um certificado está apto para uso (não expirado e com dados mínimos).
 */
export function validateCertificate(cert: CertificateInfo): { valid: boolean; message: string } {
  if (cert.isExpired) {
    return {
      valid: false,
      message: `Certificado expirado em ${cert.validUntil.toLocaleDateString('pt-BR')}. Renove seu certificado A1.`
    };
  }

  if (cert.daysRemaining <= 30) {
    return {
      valid: true,
      message: `⚠️ Certificado vence em ${cert.daysRemaining} dias (${cert.validUntil.toLocaleDateString('pt-BR')}). Considere renová-lo.`
    };
  }

  if (!cert.privateKey) {
    return {
      valid: false,
      message: 'Certificado não contém chave privada. Certifique-se de que é um certificado tipo A1.'
    };
  }

  return {
    valid: true,
    message: `Certificado válido até ${cert.validUntil.toLocaleDateString('pt-BR')} (${cert.daysRemaining} dias restantes).`
  };
}

/**
 * Carrega o certificado salvo no MongoDB e retorna as informações extraídas.
 * 
 * @param db - Instância do banco de dados MongoDB
 * @returns CertificateInfo ou null se não houver certificado configurado
 */
export async function loadCertificateFromDB(db: any): Promise<CertificateInfo | null> {
  const certDoc = await db.collection('system_settings').findOne({ type: 'certificado_a1' });
  
  if (!certDoc || !certDoc.pfxBase64 || !certDoc.pfxPassword) {
    return null;
  }

  const pfxBuffer = Buffer.from(certDoc.pfxBase64, 'base64');
  
  // Descriptografar a senha (armazenada com criptografia simétrica)
  const decryptedPassword = decryptPassword(certDoc.pfxPassword);
  
  return extractCertificate(pfxBuffer, decryptedPassword);
}

/**
 * Criptografa a senha do certificado para armazenamento seguro no banco.
 * Usa AES-256-GCM com uma chave derivada de uma variável de ambiente.
 */
export function encryptPassword(password: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Formato: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Descriptografa a senha do certificado armazenada no banco.
 */
export function decryptPassword(encryptedPassword: string): string {
  const key = getEncryptionKey();
  const parts = encryptedPassword.split(':');
  
  if (parts.length !== 3) {
    throw new Error('Formato de senha criptografada inválido.');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Obtém a chave de criptografia a partir da variável de ambiente.
 * Se não existir, gera uma chave determinística baseada no MONGODB_URI (fallback seguro).
 */
function getEncryptionKey(): Buffer {
  const envKey = process.env.CERTIFICATE_ENCRYPTION_KEY;
  
  if (envKey && envKey.length >= 32) {
    return Buffer.from(envKey.substring(0, 32), 'utf8');
  }
  
  // Fallback: derivar chave a partir do MONGODB_URI
  const mongoUri = process.env.MONGODB_URI || 'dezlog-default-key-do-not-use-in-production';
  return crypto.createHash('sha256').update(mongoUri).digest();
}
