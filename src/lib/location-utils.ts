
/**
 * Mapeamento de Capitais por UF (Brasil)
 */
export const CAPITALS: Record<string, string> = {
  'AC': 'Rio Branco',
  'AL': 'Maceió',
  'AP': 'Macapá',
  'AM': 'Manaus',
  'BA': 'Salvador',
  'CE': 'Fortaleza',
  'DF': 'Brasília',
  'ES': 'Vitória',
  'GO': 'Goiânia',
  'MA': 'São Luís',
  'MT': 'Cuiabá',
  'MS': 'Campo Grande',
  'MG': 'Belo Horizonte',
  'PA': 'Belém',
  'PB': 'João Pessoa',
  'PR': 'Curitiba',
  'PE': 'Recife',
  'PI': 'Teresina',
  'RJ': 'Rio de Janeiro',
  'RN': 'Natal',
  'RS': 'Porto Alegre',
  'RO': 'Porto Velho',
  'RR': 'Boa Vista',
  'SC': 'Florianópolis',
  'SP': 'São Paulo',
  'SE': 'Aracaju',
  'TO': 'Palmas'
};

/**
 * Mapeamento de Regiões Metropolitanas por UF (Exemplos principais)
 */
export const METROPOLITAN_REGIONS: Record<string, string[]> = {
  'SP': [
    'Guarulhos', 'Osasco', 'São Bernardo do Campo', 'Santo André', 'São Caetano do Sul', 
    'Diadema', 'Mogi das Cruzes', 'Barueri', 'Carapicuíba', 'Itapevi', 'Cotia', 'Taboão da Serra',
    'Embu das Artes', 'Itapecerica da Serra', 'Ferraz de Vasconcelos', 'Itaquaquecetuba', 
    'Suzano', 'Poá', 'Arujá', 'Santana de Parnaíba', 'Jandira', 'Caieiras', 'Cajamar', 'Franco da Rocha', 'Francisco Morato'
  ],
  'PR': [
    'São José dos Pinhais', 'Colombo', 'Araucária', 'Pinhais', 'Fazenda Rio Grande', 
    'Campo Largo', 'Almirante Tamandaré', 'Piraquara', 'Campina Grande do Sul', 'Quatro Barras'
  ],
  'RJ': [
    'Niterói', 'Duque de Caxias', 'São Gonçalo', 'Nova Iguaçu', 'Belford Roxo', 
    'Nilópolis', 'Mesquita', 'Queimados', 'Japeri', 'Seropédica', 'Itaguaí', 'Magé', 'Guapimirim'
  ],
  'MG': [
    'Contagem', 'Betim', 'Ribeirão das Neves', 'Santa Luzia', 'Ibirité', 'Sabará', 
    'Vespasiano', 'Nova Lima', 'Caeté', 'Pedro Leopoldo', 'Lagoa Santa'
  ],
  'RS': [
    'Canoas', 'Gravataí', 'Viamão', 'Novo Hamburgo', 'São Leopoldo', 'Alvorada', 
    'Sapucaia do Sul', 'Cachoeirinha', 'Esteio', 'Guaíba'
  ],
  'PE': [
    'Jaboatão dos Guararapes', 'Olinda', 'Paulista', 'Cabo de Santo Agostinho', 
    'Camaragibe', 'Igarassu', 'São Lourenço da Mata', 'Abreu e Lima'
  ],
  'BA': [
    'Lauro de Freitas', 'Camaçari', 'Simões Filho', 'Candeias', 'Dias d\'Ávila', 'Mata de São João'
  ],
  'CE': [
    'Caucaia', 'Maracanaú', 'Eusébio', 'Aquiraz', 'Maranguape', 'Pacatuba', 'Itaitinga'
  ],
  'GO': [
    'Aparecida de Goiânia', 'Trindade', 'Senador Canedo', 'Goianira'
  ],
  'SC': [
    'São José', 'Palhoça', 'Biguaçu', 'Santo Amaro da Imperatriz'
  ],
  'ES': [
    'Vila Velha', 'Serra', 'Cariacica', 'Viana'
  ]
};

/**
 * Normaliza strings para comparação (remove acentos, espaços extras e converte para minúsculas)
 */
export function normalizeString(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Identifica o tipo de localidade com base na cidade e UF
 */
export function identifyLocationType(cityWithUf: string): {
  type: 'capital' | 'metropolitana' | 'interior';
  city: string;
  uf: string | null;
} {
  // Extrai Cidade e UF do formato "Cidade, UF"
  const match = cityWithUf.match(/^([^,]+)(?:,\s*([A-Z]{2}))?$/i);
  if (!match) return { type: 'interior', city: cityWithUf, uf: null };

  const city = match[1].trim();
  const uf = match[2]?.toUpperCase() || null;

  if (!uf) return { type: 'interior', city, uf };

  const normalizedCity = normalizeString(city);

  // Verifica se é Capital
  const capital = CAPITALS[uf];
  if (capital && normalizeString(capital) === normalizedCity) {
    return { type: 'capital', city, uf };
  }

  // Verifica se é Metropolitana
  const metroCities = METROPOLITAN_REGIONS[uf] || [];
  if (metroCities.some(metroCity => normalizeString(metroCity) === normalizedCity)) {
    return { type: 'metropolitana', city, uf };
  }

  return { type: 'interior', city, uf };
}
