/**
 * DezLog Fiscal Engine — Utility Functions
 * Funções auxiliares compartilhadas pelo motor fiscal.
 */

/**
 * Tabela de códigos IBGE por UF.
 */
export const UF_CODES: Record<string, number> = {
  'RO': 11, 'AC': 12, 'AM': 13, 'RR': 14, 'PA': 15, 'AP': 16, 'TO': 17,
  'MA': 21, 'PI': 22, 'CE': 23, 'RN': 24, 'PB': 25, 'PE': 26, 'AL': 27, 'SE': 28, 'BA': 29,
  'MG': 31, 'ES': 32, 'RJ': 33, 'SP': 35,
  'PR': 41, 'SC': 42, 'RS': 43,
  'MS': 50, 'MT': 51, 'GO': 52, 'DF': 53
};

/**
 * Calcula o dígito verificador (módulo 11) da chave de acesso de 43 dígitos.
 * Retorna o dígito verificador (0-9).
 */
export function calcularDigitoVerificador(chave43: string): number {
  if (chave43.length !== 43) {
    throw new Error(`Chave deve ter 43 dígitos para cálculo do DV, recebeu ${chave43.length}`);
  }

  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;

  // Percorre da direita para a esquerda
  for (let i = chave43.length - 1, pesoIdx = 0; i >= 0; i--, pesoIdx++) {
    soma += parseInt(chave43[i], 10) * pesos[pesoIdx % pesos.length];
  }

  const resto = soma % 11;
  const dv = (resto < 2) ? 0 : 11 - resto;
  return dv;
}

/**
 * Gera a chave de acesso completa (44 dígitos) para um documento fiscal.
 * Formato: cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nCT(9) + tpEmis(1) + cCT(8) + cDV(1)
 */
export function gerarChaveAcesso(params: {
  cUF: number;
  dataEmissao: Date;
  cnpj: string;
  modelo: number; // 57 = CT-e, 58 = MDF-e
  serie: number;
  numero: number;
  tpEmis: number;
  codigoNumerico: number;
}): { chave44: string; cDV: number; cCT: string } {
  const { cUF, dataEmissao, cnpj, modelo, serie, numero, tpEmis, codigoNumerico } = params;

  const aamm = `${String(dataEmissao.getFullYear()).slice(2)}${String(dataEmissao.getMonth() + 1).padStart(2, '0')}`;
  const cnpjClean = cnpj.replace(/\D/g, '').padStart(14, '0');
  const mod = String(modelo).padStart(2, '0');
  const ser = String(serie).padStart(3, '0');
  const nCT = String(numero).padStart(9, '0');
  const tpE = String(tpEmis);
  const cCT = String(codigoNumerico).padStart(8, '0');

  const chave43 = `${String(cUF).padStart(2, '0')}${aamm}${cnpjClean}${mod}${ser}${nCT}${tpE}${cCT}`;
  const cDV = calcularDigitoVerificador(chave43);
  const chave44 = `${chave43}${cDV}`;

  return { chave44, cDV, cCT };
}

/**
 * Gera um código numérico aleatório de 8 dígitos para compor a chave de acesso.
 */
export function gerarCodigoNumerico(): number {
  return Math.floor(10000000 + Math.random() * 90000000);
}

/**
 * Formata RNTRC para o padrão SEFAZ (8 dígitos ou "ISENTO").
 */
export function formatRNTRC(rntrc?: string): string {
  if (!rntrc) return "ISENTO";
  const upper = rntrc.trim().toUpperCase();
  if (upper === "ISENTO") return "ISENTO";
  const clean = rntrc.replace(/\D/g, '');
  if (clean.length === 0) return "ISENTO";
  return clean.padStart(8, '0').slice(-8);
}

/**
 * Formata Inscrição Estadual para o padrão SEFAZ.
 */
export function formatIE(ie?: string): string {
  if (!ie) return "ISENTO";
  const upper = ie.trim().toUpperCase();
  if (upper === "ISENTO") return "ISENTO";
  const clean = ie.replace(/\D/g, '');
  return clean.length >= 2 ? clean : "ISENTO";
}

/**
 * Formata data no padrão ISO 8601 com timezone do Brasil (-03:00).
 */
export function formatDateSefaz(date: Date): string {
  const offset = '-03:00';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}${offset}`;
}

/**
 * Remove caracteres especiais e limita o tamanho de uma string para o padrão SEFAZ.
 */
export function sanitizeSefaz(value: string | undefined | null, maxLen: number): string {
  if (!value) return '';
  // Remove acentos e caracteres especiais que a SEFAZ rejeita
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s.,\-\/()]/g, '')
    .substring(0, maxLen)
    .trim();
}
