import type { PricingSettings, Vehicle } from './types';

const ALL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO'
];

const generateDefaultMinFreight = () => {
  const freight: Record<string, Record<string, any>> = {};
  ALL_UFS.forEach(origin => {
    freight[origin] = {};
    ALL_UFS.forEach(dest => {
      freight[origin][dest] = {
        capital: 320,
        metropolitana: 320,
        interior: 320,
        rural: 320,
        kgCubado: 1.50,
        kgCapital: 1.50,
        kgMetropolitana: 1.50,
        kgInterior: 1.50,
        kgRural: 1.50
      };
    });
  });
  return freight;
};

export const initialVehicles: Omit<Vehicle, 'id'>[] = [
    {
        key: 'fiorino',
        name: 'Fiorino',
        displayName: 'Fiorino - Até 1,8 Mt, até 700 Kg',
        cubagem: '1,8 m³',
        peso: '700 kg',
        valorBase: 350,
        kmGratis: 100,
        adicionalKm: 1.5,
        comprimento: 1.8,
        largura: 1.3,
        disabled: false
    },
    {
        key: 'van',
        name: 'Van',
        displayName: 'Van - Até 12 Mts, até 1500 Kg',
        cubagem: '12 m³',
        peso: '1500 kg',
        valorBase: 600,
        kmGratis: 100,
        adicionalKm: 2.5,
        comprimento: 3.3,
        largura: 1.8,
        disabled: false
    },
    {
        key: 'vuc',
        name: 'VUC',
        displayName: 'VUC - Até 15 Mts, até 3000 Kg',
        cubagem: '15 m³',
        peso: '3000 kg',
        valorBase: 900,
        kmGratis: 100,
        adicionalKm: 3.5,
        comprimento: 4.5,
        largura: 2.2,
        disabled: false
    },
    {
        key: 'toco',
        name: 'Toco',
        displayName: 'Toco - Até 6,5 Mt, até 6.000 Kg',
        cubagem: '40 m³',
        peso: '6000 kg',
        valorBase: 1100,
        kmGratis: 100,
        adicionalKm: 4.0,
        axles: 2,
        comprimento: 6.5,
        largura: 2.4,
        disabled: false
    },
    {
        key: 'truck',
        name: 'Truck',
        displayName: 'Truck - Até 12 Mt, até 14.000 Kg',
        cubagem: '80 m³',
        peso: '14000 kg',
        valorBase: 1200,
        kmGratis: 100,
        adicionalKm: 4.5,
        axles: 3,
        comprimento: 8.5,
        largura: 2.4,
        disabled: false
    },
    {
        key: 'bi-truck',
        name: 'Bi-Truck',
        displayName: 'Bi-Truck - Até 11 Mt - até 17.000 kg',
        cubagem: '70 m³',
        peso: '17000 kg',
        valorBase: 1500,
        kmGratis: 100,
        adicionalKm: 5.5,
        axles: 4,
        comprimento: 9.5,
        largura: 2.4,
        disabled: false
    },
    {
        key: 'carreta',
        name: 'Carreta',
        displayName: 'Carreta - Até 15 Mt, 25.000 kg',
        cubagem: '100 m³',
        peso: '25000 kg',
        valorBase: 1800,
        kmGratis: 100,
        adicionalKm: 6.5,
        axles: 5,
        comprimento: 13.5,
        largura: 2.5,
        disabled: false
    },
    {
        key: 'carreta-ls',
        name: 'Carreta LS',
        displayName: 'Carreta LS - Até 15 Mt, até 32.000 Kg',
        cubagem: '110 m³',
        peso: '32000 kg',
        valorBase: 2200,
        kmGratis: 100,
        adicionalKm: 7.5,
        axles: 6,
        comprimento: 15.0,
        largura: 2.5,
        disabled: false
    },
    {
        key: 'bi-trem',
        name: 'Carreta Bi-trem',
        displayName: 'Carreta Bi-tem 2 vagões 45 Ton',
        cubagem: '120 m³',
        peso: '45000 kg',
        valorBase: 3000,
        kmGratis: 100,
        adicionalKm: 9.5,
        axles: 9,
        comprimento: 19.0,
        largura: 2.5,
        disabled: false
    },
    {
        key: 'prancha',
        name: 'Prancha',
        displayName: 'Prancha - Cargas Especiais',
        cubagem: '150 m³',
        peso: '50000 kg',
        valorBase: 3500,
        kmGratis: 100,
        adicionalKm: 12.0,
        comprimento: 15.0,
        largura: 3.0,
        disabled: false
    }
];

export const initialPricingSettings: PricingSettings = {
    regions: {
        'SUDESTE': ['SP', 'RJ', 'ES', 'MG'],
        'SUL': ['PR', 'SC', 'RS'],
        'CENTRO-OESTE': ['MT', 'MS', 'GO', 'DF'],
        'NORDESTE': ['BA', 'SE', 'AL', 'PE', 'PB', 'RN', 'CE', 'PI', 'MA'],
        'NORTE': ['AC', 'RO', 'AM', 'RR', 'AP', 'PA', 'TO'],
    },
    surcharges: {
        dezlog: {
            'SUDESTE': 0.1,
            'SUL': 0.15,
            'CENTRO-OESTE': 0.2,
            'NORDESTE': 0.25,
            'NORTE': 0.3
        },
        fracionado: {
            'SUDESTE': { regional: 0.1, cubageMultiplier: 1.5 },
            'SUL': { regional: 0.15, cubageMultiplier: 1.5 },
            'CENTRO-OESTE': { regional: 0.2, cubageMultiplier: 1.5 },
            'NORDESTE': { regional: 0.25, cubageMultiplier: 1.5 },
            'NORTE': { regional: 0.3, cubageMultiplier: 1.5 }
        }
    },
    icmsRates: {
        'SP': {'AC':7, 'AL':7, 'AM':7, 'AP':7, 'BA':7, 'CE':7, 'DF':7, 'ES':7, 'GO':7, 'MA':7, 'MT':7, 'MS':7, 'MG':12, 'PA':7, 'PB':7, 'PR':12, 'PE':7, 'PI':7, 'RN':7, 'RS':12, 'RJ':12, 'RO':7, 'RR':7, 'SC':12, 'SP':18, 'SE':7, 'TO':7},
        'MG': {'AC':7, 'AL':7, 'AM':7, 'AP':7, 'BA':7, 'CE':7, 'DF':7, 'ES':7, 'GO':7, 'MA':7, 'MT':7, 'MS':7, 'MG':18, 'PA':7, 'PB':7, 'PR':12, 'PE':7, 'PI':7, 'RN':7, 'RS':12, 'RJ':12, 'RO':7, 'RR':7, 'SC':12, 'SP':12, 'SE':7, 'TO':7},
        'AC': {'AC':19, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'AL': {'AC':12, 'AL':19, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'AM': {'AC':12, 'AL':12, 'AM':20, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'AP': {'AC':12, 'AL':12, 'AM':12, 'AP':18, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'BA': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':20.5, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'CE': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':20, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'DF': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':20, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'ES': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':17, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'GO': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':19, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'MA': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':23, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'MS': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':17, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'MT': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':17, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'PA': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':19, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'PB': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':20, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'PE': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':20.5, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'PI': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':22.5, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'PR': {'AC':7, 'AL':7, 'AM':7, 'AP':7, 'BA':7, 'CE':7, 'DF':7, 'ES':7, 'GO':7, 'MA':7, 'MT':7, 'MS':7, 'MG':12, 'PA':7, 'PB':7, 'PR':19.5, 'PE':7, 'PI':7, 'RN':7, 'RS':12, 'RJ':12, 'RO':7, 'RR':7, 'SC':12, 'SP':12, 'SE':7, 'TO':7},
        'RJ': {'AC':7, 'AL':7, 'AM':7, 'AP':7, 'BA':7, 'CE':7, 'DF':7, 'ES':7, 'GO':7, 'MA':7, 'MT':7, 'MS':7, 'MG':12, 'PA':7, 'PB':7, 'PR':12, 'PE':7, 'PI':7, 'RN':7, 'RS':12, 'RJ':20, 'RO':7, 'RR':7, 'SC':12, 'SP':12, 'SE':7, 'TO':7},
        'RN': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':20, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'RO': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':19.5, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'RR': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':20, 'SC':12, 'SP':12, 'SE':12, 'TO':12},
        'RS': {'AC':7, 'AL':7, 'AM':7, 'AP':7, 'BA':7, 'CE':7, 'DF':7, 'ES':7, 'GO':7, 'MA':7, 'MT':7, 'MS':7, 'MG':12, 'PA':7, 'PB':7, 'PR':12, 'PE':7, 'PI':7, 'RN':7, 'RS':17, 'RJ':12, 'RO':7, 'RR':7, 'SC':12, 'SP':12, 'SE':7, 'TO':7},
        'SC': {'AC':7, 'AL':7, 'AM':7, 'AP':7, 'BA':7, 'CE':7, 'DF':7, 'ES':7, 'GO':7, 'MA':7, 'MT':7, 'MS':7, 'MG':12, 'PA':7, 'PB':7, 'PR':12, 'PE':7, 'PI':7, 'RN':7, 'RS':12, 'RJ':12, 'RO':7, 'RR':7, 'SC':17, 'SP':12, 'SE':7, 'TO':7},
        'SE': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':19, 'TO':12},
        'TO': {'AC':12, 'AL':12, 'AM':12, 'AP':12, 'BA':12, 'CE':12, 'DF':12, 'ES':12, 'GO':12, 'MA':12, 'MT':12, 'MS':12, 'MG':12, 'PA':12, 'PB':12, 'PR':12, 'PE':12, 'PI':12, 'RN':12, 'RS':12, 'RJ':12, 'RO':12, 'RR':12, 'SC':12, 'SP':12, 'SE':12, 'TO':20}
    },
    fractionalMinimumFreight: generateDefaultMinFreight(),
    dedicatedMinimumFreight: {},
    operational: {
        profitTaxRate: 0.16,
        grisAdvaloremRate: 0.008,
    },
    payroll: {
        advancePaymentDay: 20,
        finalPaymentDay: 5
    },
    printing: {
      labels: {
        colorLevel: 'normal',
        fontSize: 'medium',
        qrCodeUrl: '',
      },
    },
    alerts: {
        collectionDeadlineDays: 2,
        collectionAlertTriggerDays: 1,
        deliveryAlertTriggerDays: 2,
        warehouseStagnationDays: 5,
        expenseDueTriggerDays: 3,
        billingDueTriggerDays: 5,
    },
    difficultyFees: {
        fracionado: {
            'SUDESTE': 50,
            'SUL': 60,
            'CENTRO-OESTE': 70,
            'NORDESTE': 80,
            'NORTE': 100
        }
    },
    weightTiers: [
        { maxWeight: 100,   factor: 2.00, label: 'Até 100 kg' },
        { maxWeight: 500,   factor: 1.50, label: 'Até 500 kg' },
        { maxWeight: 1000,  factor: 1.20, label: 'Até 1.000 kg' },
        { maxWeight: 3000,  factor: 1.00, label: 'Até 3.000 kg' },
        { maxWeight: 10000, factor: 0.70, label: 'Até 10.000 kg' },
        { maxWeight: 30000, factor: 0.50, label: 'Até 30.000 kg' },
    ],
    weightTiersMode: 'global' as const,
};

export const cityList = [
    'São Paulo, SP',
    'Guarulhos, SP',
    'Campinas, SP',
    'Rio de Janeiro, RJ',
    'Belo Horizonte, MG',
    'Curitiba, PR',
    'Porto Alegre, RS',
    'Salvador, BA',
    'Brasília, DF',
];

export const initialVehicleBrands: { code: string, name: string }[] = [
  { code: '01', name: 'Agrale' },
  { code: '02', name: 'Ford' },
  { code: '03', name: 'GMC' },
  { code: '04', name: 'Hyundai' },
  { code: '05', name: 'Iveco' },
  { code: '06', name: 'Mercedes-Benz' },
  { code: '07', name: 'Scania' },
  { code: '08', name: 'SINO TRUCK' },
  { code: '09', name: 'Volkswagen' },
  { code: '10', name: 'Volvo' },
];

export const initialVehicleModels: { code: string, name: string }[] = [
  { code: '01', name: 'Tector' },
  { code: '02', name: 'Hi-Way' },
  { code: '03', name: 'Stralis' },
  { code: '04', name: 'FH 540' },
  { code: '05', name: 'Constellation' },
  { code: '06', name: 'Meteor' },
  { code: '07', name: 'Actros' },
  { code: '08', name: 'Atego' },
];

export const initialVehicleBodyTypes: { code: string, name: string }[] = [
  { code: '00', name: 'Não aplicável' },
  { code: '01', name: 'Aberta' },
  { code: '02', name: 'Fechada/Baú' },
  { code: '03', name: 'Granelera' },
  { code: '04', name: 'Porta Container' },
  { code: '05', name: 'Sider' },
];

export const initialVehicleColors: { code: string, name: string }[] = [
  { code: '01', name: 'Branco' },
  { code: '02', name: 'Preto' },
  { code: '03', name: 'Prata' },
  { code: '04', name: 'Vermelho' },
  { code: '05', name: 'Azul' },
  { code: '06', name: 'Cinza' },
];

export const initialVehicleAnttCategories: { code: string, name: string }[] = [
    { code: '01', name: 'TAC - Transportador Autônomo de Cargas' },
    { code: '02', name: 'ETC - Empresa de Transporte Rodoviário de Cargas' },
    { code: '03', name: 'CTC - Cooperativa de Transporte Rodoviário de Cargas' },
];

export const initialAnttCoefficients = [
    // Carga Geral
    { axles: 2, cargoType: 'Geral', ccd: 3.4645, cc: 408.57, updatedAt: new Date().toISOString() },
    { axles: 3, cargoType: 'Geral', ccd: 4.4360, cc: 495.60, updatedAt: new Date().toISOString() },
    { axles: 4, cargoType: 'Geral', ccd: 5.0845, cc: 536.30, updatedAt: new Date().toISOString() },
    { axles: 5, cargoType: 'Geral', ccd: 5.5455, cc: 520.16, updatedAt: new Date().toISOString() },
    { axles: 6, cargoType: 'Geral', ccd: 6.1249, cc: 546.66, updatedAt: new Date().toISOString() },
    { axles: 7, cargoType: 'Geral', ccd: 7.0577, cc: 710.36, updatedAt: new Date().toISOString() },
    { axles: 9, cargoType: 'Geral', ccd: 7.9940, cc: 755.95, updatedAt: new Date().toISOString() },

    // Granel Sólido
    { axles: 2, cargoType: 'Granel Sólido', ccd: 3.4880, cc: 408.57, updatedAt: new Date().toISOString() },
    { axles: 3, cargoType: 'Granel Sólido', ccd: 4.4505, cc: 495.60, updatedAt: new Date().toISOString() },
    { axles: 4, cargoType: 'Granel Sólido', ccd: 5.1405, cc: 536.30, updatedAt: new Date().toISOString() },
    { axles: 5, cargoType: 'Granel Sólido', ccd: 5.5749, cc: 520.16, updatedAt: new Date().toISOString() },
    { axles: 6, cargoType: 'Granel Sólido', ccd: 6.2063, cc: 546.66, updatedAt: new Date().toISOString() },
    { axles: 7, cargoType: 'Granel Sólido', ccd: 7.0506, cc: 710.36, updatedAt: new Date().toISOString() },
    { axles: 9, cargoType: 'Granel Sólido', ccd: 7.9437, cc: 755.95, updatedAt: new Date().toISOString() },

    // Granel Líquido
    { axles: 2, cargoType: 'Granel Líquido', ccd: 3.5634, cc: 423.65, updatedAt: new Date().toISOString() },
    { axles: 3, cargoType: 'Granel Líquido', ccd: 4.5518, cc: 517.81, updatedAt: new Date().toISOString() },
    { axles: 4, cargoType: 'Granel Líquido', ccd: 5.1213, cc: 520.16, updatedAt: new Date().toISOString() },
    { axles: 5, cargoType: 'Granel Líquido', ccd: 5.7255, cc: 550.70, updatedAt: new Date().toISOString() },
    { axles: 6, cargoType: 'Granel Líquido', ccd: 6.4428, cc: 600.82, updatedAt: new Date().toISOString() },
    { axles: 7, cargoType: 'Granel Líquido', ccd: 7.1940, cc: 738.92, updatedAt: new Date().toISOString() },
    { axles: 9, cargoType: 'Granel Líquido', ccd: 8.2354, cc: 825.27, updatedAt: new Date().toISOString() },

    // Frigorificada ou Aquecida
    { axles: 2, cargoType: 'Frigorificada', ccd: 4.1977, cc: 490.43, updatedAt: new Date().toISOString() },
    { axles: 3, cargoType: 'Frigorificada', ccd: 5.3292, cc: 589.50, updatedAt: new Date().toISOString() },
    { axles: 4, cargoType: 'Frigorificada', ccd: 6.1395, cc: 640.20, updatedAt: new Date().toISOString() },
    { axles: 5, cargoType: 'Frigorificada', ccd: 6.7886, cc: 658.43, updatedAt: new Date().toISOString() },
    { axles: 6, cargoType: 'Frigorificada', ccd: 7.4860, cc: 675.05, updatedAt: new Date().toISOString() },
    { axles: 7, cargoType: 'Frigorificada', ccd: 8.9162, cc: 999.88, updatedAt: new Date().toISOString() },
    { axles: 9, cargoType: 'Frigorificada', ccd: 9.8118, cc: 1011.88, updatedAt: new Date().toISOString() },

    // Conteinerizada
    { axles: 2, cargoType: 'Conteinerizada', ccd: 4.4235, cc: 488.19, updatedAt: new Date().toISOString() },
    { axles: 3, cargoType: 'Conteinerizada', ccd: 5.0137, cc: 501.44, updatedAt: new Date().toISOString() },
    { axles: 4, cargoType: 'Conteinerizada', ccd: 5.5159, cc: 503.95, updatedAt: new Date().toISOString() },
    { axles: 5, cargoType: 'Conteinerizada', ccd: 6.1318, cc: 526.18, updatedAt: new Date().toISOString() },
    { axles: 6, cargoType: 'Conteinerizada', ccd: 7.0371, cc: 706.64, updatedAt: new Date().toISOString() },
    { axles: 7, cargoType: 'Conteinerizada', ccd: 7.8991, cc: 743.67, updatedAt: new Date().toISOString() },
];

    
