
import { NextResponse } from 'next/server';

// Função para formatar o valor monetário
const formatValue = (value: number): string => {
  const formatted = value.toFixed(2);
  return formatted.length > 99 ? '' : formatted;
};

// Função para formatar os dados do payload
const formatField = (id: string, value: string): string => {
  const length = value.length.toString().padStart(2, '0');
  return `${id}${length}${value}`;
};

// Função para calcular o CRC16
const crc16 = (payload: string): string => {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return ('0000' + (crc & 0xFFFF).toString(16).toUpperCase()).slice(-4);
};

export async function POST(request: Request) {
  try {
    const { pixKey, beneficiaryName, city, amount, txid = '***' } = await request.json();

    if (!pixKey || !beneficiaryName || !city || !amount) {
      return NextResponse.json({ message: 'Campos obrigatórios em falta.' }, { status: 400 });
    }

    const payloadFormatIndicator = formatField('00', '01');
    const merchantAccountInfo = formatField('26', 
      formatField('00', 'br.gov.bcb.pix') +
      formatField('01', pixKey)
    );
    const merchantCategoryCode = formatField('52', '0000');
    const transactionCurrency = formatField('53', '986');
    const transactionAmount = formatField('54', formatValue(amount));
    const countryCode = formatField('58', 'BR');
    const beneficiaryNameFormatted = formatField('59', beneficiaryName.substring(0, 25));
    const cityFormatted = formatField('60', city.substring(0, 15));
    const additionalData = formatField('62', formatField('05', txid));
    
    let payload = `${payloadFormatIndicator}${merchantAccountInfo}${merchantCategoryCode}${transactionCurrency}${transactionAmount}${countryCode}${beneficiaryNameFormatted}${cityFormatted}${additionalData}`;
    payload += '6304';
    
    const finalPayload = payload + crc16(payload);

    return NextResponse.json({ brcode: finalPayload });
  } catch (error: any) {
    console.error('API PIX Error:', error);
    return NextResponse.json({ message: `Erro ao gerar código PIX: ${error.message}` }, { status: 500 });
  }
}
