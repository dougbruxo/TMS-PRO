import { ObjectId } from 'mongodb';

export type UserRole = 'admin' | 'user' | 'cliente' | 'driver' | 'sub-cliente' | 'parceiro';

export interface Occurrence {
    id: string;
    timestamp: string;
    code: string;
    description: string;
    notes?: string;
    blocksOperation: boolean;
    author: string;
}

export interface OccurrenceType {
  id: string;
  code: string;
  description: string;
  blocksOperation: boolean;
}

export interface StoragePricingSettings {
  id?: string;
  _id?: any;
  updatedAt: string;
  pricePerPosition: number;
  weightPricePerKg: number;
  cbmPrice: number;
  unloadingRate: number; // Taxa de descarga / movimentação
  pickingRate?: number; // Taxa de separação
  packingRate?: number; // Taxa de embalagem
}

export interface StockPosition {
  id: string;
  name: string; // Ex: A1, B2
  status: 'Vazio' | 'Ocupado' | 'Manutenção';
  quoteId?: string; // ID da cotação que ocupa a posição
  quoteCode?: string;
  occupiedAt?: string | null; // ISO string de quando foi ocupada
  updatedAt: string;
}

export type StockItemStatus = 'Em Conferência' | 'Disponível';
export type UnitType = 'VOLUMES' | 'PALETES' | 'CAIXAS' | 'UNIDADES';

export interface StockItem {
    id: string;
    sku: string; // Stock Keeping Unit
    name: string;
    description?: string;
    quantity: number;
    positionId: string; // Onde está localizado
    positionName: string;
    lastActivity: string;
    companyId?: string; // Ref ao client_companies 
    companyName?: string;
    nfNumber?: string;
    xmlId?: string;
    allocatedQuantity?: number; // Qtd alocada para expedição
    batch?: string; // Lote
    expirationDate?: string; // Validade (ISO string)
    status?: StockItemStatus; // 'Em Conferência' ou 'Disponível'
    unitType?: UnitType; // Espécie: PALETES, VOLUMES, etc.
    palletCount?: number; // Quantos paletes esse item ocupa (deprecated/alternative)
    palletNumber?: number; // Qual palete físico este item pertence (1 a N)
    receivingBatchId?: string; // Agrupamento do lote de recebimento
    conferenceNotes?: string; // Observações do conferente
    quantityNf?: number; // Quantidade original da NF (para divergência)
}

export interface ReceivingBatch {
    id: string;
    nfNumber: string;
    companyId?: string;
    companyName?: string;
    unitType?: UnitType;
    totalItemsNf: number; // Qtd de linhas da NF
    totalItemsReal: number; // Qtd de linhas conferidas
    status: 'Pendente' | 'Montar' | 'Posicionar' | 'Finalizado' | 'Com Divergência';
    importedAt: string;
    conferredAt?: string;
    conferredBy?: string;
    xmlFileName?: string;
    nfQVol?: number; // Quantidade de volumes da NF (ou paletes definidos pelo conferente)
    items: string[]; // IDs dos StockItems deste lote
}

export type StockMovementType = 'ENTRY' | 'EXIT' | 'TRANSFER' | 'ADJUSTMENT' | 'EXPEDITION';

export interface StockMovement {
    id: string;
    itemId: string;
    sku: string;
    itemName: string;
    type: StockMovementType;
    quantity: number;
    fromPositionId?: string;
    fromPositionName?: string;
    toPositionId?: string;
    toPositionName?: string;
    reason: string;
    userId: string;
    username: string;
    timestamp: string; // ISO string
    companyId?: string;
    companyName?: string;
}

export interface ExpeditionRequest {
    id: string;
    clientId: string; // ID do usuário/cliente (User)
    clientName: string;
    name?: string; // Nome ou referência manual (ex: "Pedido de Reposição #1")
    status: 'Rascunho' | 'Pendente' | 'Em Separação' | 'Expedido' | 'Cancelado';
    fractionalNfNumber?: string; // Tornar opcional para pedidos manuais
    fractionalNfeXml?: string; // Tornar opcional para pedidos manuais
    requestedAt: string;
    updatedAt?: string; // Controle de edição para rascunhos
    processedAt?: string;
    items: {
        sku: string; // Ex: Código EAN
        description: string;
        quantityRequested: number;
        resolvedQuantity: number;
        stockItemIds: string[]; // IDs dos StockItems afetados no picking
        outboundNfNumber?: string; // NF de saída para este item específico (Opção B)
    }[];
    generatedQuoteId?: string; // ID do FRETE FRACIONADO gerado na expedição
}


export interface SubPermissions {
  freight?: {
    canQuoteFracionado?: boolean;
    canQuoteDedicado?: boolean;
    canGiveDiscount?: boolean;
    canDeleteQuote?: boolean;
    canViewOthersQuotes?: boolean;
    canRemakeQuote?: boolean;
    canViewMyQuotes?: boolean;
    canViewBasePrice?: boolean;
    canViewDeliveryTime?: boolean;
    canDefineFreightValue?: boolean;
    canDefineManualCubage?: boolean;
    canDefineVolumes?: boolean;
    canViewAnttSuggestion?: boolean;
  };
  operational?: {
    canCreateJourney?: boolean;
    canEditJourney?: boolean;
    canAssignDriver?: boolean;
    canDeleteJourney?: boolean;
  };
  financial?: {
    canLogExpense?: boolean;
    canApproveExpense?: boolean;
    canDeleteExpense?: boolean;
  };
  registrations?: {
    canManageClients?: boolean;
    canManageVehicles?: boolean;
  };
  drivers?: {
    canApproveDriver?: boolean;
    canBlockDriver?: boolean;
  };
  hr?: {
    canViewTalents?: boolean;
    canEditTalents?: boolean;
    canManagePayroll?: boolean;
    canDeleteTalents?: boolean;
  };
  receiving?: {
    canUseScannerAllFunction?: boolean;
  };
}

export interface User {
  _id?: any;
  id: string;
  email: string;
  password?: string;
  username: string;
  role: UserRole;
  isSubClient?: boolean;
  parentId?: string;
  subRole?: 'ADM' | 'Colaborador';
  contact: string;
  avatarUrl?: string;
  disabled?: boolean;
  firstLogin?: boolean;
  createdAt?: string;
  salesBonusPercentage?: number;
  layoutMode?: 'header' | 'sidebar';
  // Permissions
  freightAccess?: boolean;
  myFreightsAccess?: boolean;
  chatEnabled?: boolean;
  operationalAccess?: boolean;
  driverManagementAccess?: boolean;
  settingsAccess?: boolean;
  noticeBoardAccess?: boolean;
  expensesAccess?: boolean;
  talentsAccess?: boolean;
  receivingAccess?: boolean;
  documentsAccess?: boolean;
  fracionadoEnabled?: boolean;
  sacAccess?: boolean;
  registrationsAccess?: boolean;
  panoramaAccess?: boolean;
  stockAccess?: boolean;
  financialAccess?: boolean; // Nova permissão para a área financeira do motorista
  myCompanyAccess?: boolean; // Nova permissão para o cliente acessar "Minha Empresa"
  clientPartnersAccess?: boolean; // Nova permissão para o cliente acessar "Clientes e Fornecedores"
  clientPortalsAccess?: boolean; // Permissão interna para gerenciar Portais B2B
  armazenagemAccess?: boolean; // Permissão para o cliente acessar o módulo de armazenagem (Meu Estoque)
  quoteArmazenagemAccess?: boolean; // Permissão para o cliente fazer cotações de armazenagem
  analyzeQuotesAccess?: boolean; // Permissão para analisar/aprovar cotações de clientes B2B
  requiresQuoteApproval?: boolean; // Cotações deste parceiro requerem aprovação antes de serem processadas
  supportUserIds?: string[]; // IDs dos usuários de suporte dedicados (multi-select)
  supportUserId?: string | null; // Legacy: primeiro ID de suporte dedicado
  subPermissions?: SubPermissions;
}

// Representa a empresa do cliente (para cotações, etc.)
export interface ContactPerson {
  name: string;
  email: string;
  phone: string;
}

export interface Company {
  id: string;
  code: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  codigo_ibge?: string;
  inscricaoEstadual?: string;
  telefone?: string;
  email?: string;
  openingHours?: string;
  createdAt: string;
  discountPercentage?: number;
  surchargePercentage?: number;
  disabled?: boolean;
  contacts?: ContactPerson[];
  isDefaultTdOrigem?: boolean;
  isDefaultTdDestino?: boolean;
  additionalDays?: number;
  defaultObservations?: string;
}

export interface OperatingHour {
  active: boolean;
  start: string;
  end: string;
}

export interface OperatingHours {
  seg: OperatingHour;
  ter: OperatingHour;
  qua: OperatingHour;
  qui: OperatingHour;
  sex: OperatingHour;
  sab: OperatingHour;
  dom: OperatingHour;
}

export interface BusinessRules {
  discountPercentage?: number;
  extraFeePercentage?: number;
  extraDays?: number;
  reducedDays?: number;
}

export interface ClientCompany {
  id?: string;
  _id?: any;
  userId: string; // The owner (role = cliente)
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  cep: string;
  endereco: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade: string;
  estado: string;
  telefone?: string;
  email?: string;
  inscricaoEstadual?: string;
  isDefault?: boolean; // Flag para auto-preenchimento
  operatingHours?: OperatingHours | null;
  businessRules?: BusinessRules | null;
  createdAt: string;
  updatedAt?: string;
  logoUrl?: string;
}

export interface ClientPartner {
  id?: string;
  _id?: any;
  userId: string; // O cliente dono deste registro
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  cep: string;
  endereco: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade: string;
  estado: string;
  telefone?: string;
  email?: string;
  inscricaoEstadual?: string;
  type?: 'Cliente' | 'Fornecedor' | 'Ambos';
  createdAt: string;
  updatedAt?: string;
}

export interface Owner {
  id: string;
  type: 'Pessoa Física' | 'Pessoa Jurídica';
  name: string; // Nome ou Razão Social
  document: string; // CPF ou CNPJ
  address?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  cnhRgDocumentUrl?: string;
  addressProofUrl?: string;
  createdAt: string;
}


// Representa os dados da própria empresa que usa o sistema (Dezlog)
export interface CompanyProfile {
  id: string;
  isDefault: boolean;
  logoUrl?: string;
  // Fiscal
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal?: string;
  razaoSocial: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  codigo_ibge?: string;
  rntrc?: string;
  rntrcType?: 'ETC' | 'TAC' | 'CTC';
  telefone?: string;
  email?: string;
  website?: string;
  // Financeiro
  banco?: string;
  tipoConta?: 'Corrente' | 'Poupança';
  agencia?: string;
  conta?: string;
  pixKeyType?: 'Celular' | 'E-mail' | 'CNPJ' | 'Aleatória';
  pixKey?: string;
  // Seguro de Carga (RCTR-C) - Obrigatório
  insuranceCompany?: string;
  insuranceCnpj?: string;
  insurancePolicy?: string;
  insuranceExpirationRctrc?: string;
  insuranceCoverageRctrc?: number;
  // Seguro de Carga (RC-DC) - Obrigatório (Lei 14.599/2023)
  insuranceCompanyRcdc?: string;
  insuranceCnpjRcdc?: string;
  insurancePolicyRcdc?: string;
  insuranceExpirationRcdc?: string;
  insuranceCoverageRcdc?: number;
  // Seguro de Veículo (RC-V) - Obrigatório (Terceiros)
  insuranceCompanyRcv?: string;
  insuranceCnpjRcv?: string;
  insurancePolicyRcv?: string;
  insuranceExpirationRcv?: string;
}


export interface Driver {
  id: string;
  name: string;
  cpf: string;
  phone1: string;
  phone2?: string;
  pixKey?: string;
  licensePlate?: string;
  licensePlate2?: string;
  vehicleType?: string;
  mainVehicleId?: string;
  linkedCarretaIds?: string[];
  avatarUrl?: string;
  cnhDocumentUrl?: string;
  addressProofUrl?: string;
  hasPortalAccess?: boolean;
  password?: string;
  lastKnownLocation?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  lastLocationUpdate?: string; // ISO string
  rating?: number;
  ratingCount?: number;
  isThirdParty?: boolean;
  isEmployee?: boolean;
}

export interface Vehicle {
  id: string;
  key: string;
  name: string;
  displayName: string;
  cubagem: string;
  peso: string;
  valorBase: number;
  kmGratis: number;
  adicionalKm: number;
  disabled: boolean;
  taxaDificuldade?: number;
  axles?: number;
  comprimento?: number;
  largura?: number;
}

export interface AnttCoefficient {
  id?: string;
  _id?: any;
  axles: number;
  cargoType: string; // Geral, Granel, Frigorificada, etc.
  ccd: number; // Coeficiente de Custo de Deslocamento
  cc: number;  // Coeficiente de Carga e Descarga
  updatedAt: string;
}

export interface AnttSettings {
  id: string;
  enabled: boolean;
  defaultCargoType: string;
}


export interface FleetVehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  city: string;
  state: string;
  renavam: string;
  chassis: string;
  antt: string;
  category: string;
  color: string;
  axles: number;
  capacity: string; // Will map to capKG
  cubage: string;   // Will map to capM3
  tara: string;     // Mandatory for MDF-e
  type: 'Próprio' | 'Terceiro';
  bodyType: string; // Will map to tpCar
  vehicleType: string; // Will map to tpRod
  tpRod?: string;   // Explicit field for SEFAZ
  tpCar?: string;   // Explicit field for SEFAZ
  ownerId?: string;
  ownerType?: 'driver' | 'customer' | 'owner';
  ownerName?: string;
  crlvDocumentUrl?: string;
  anttDocumentUrl?: string;
  ownerAddressProofUrl?: string;
}

export interface VehicleOption {
    id: string;
    code: string;
    name: string;
}

export type QuoteStatus = 
  | 'Aberta'
  | 'Em Análise'
  | 'Fechada'
  | 'Coleta'
  | 'Aguardando Recebimento'
  | 'Entregue no Galpão'
  | 'No Galpão'
  | 'Aguardando Saída'
  | 'Em Carregamento'
  | 'Em Rota'
  | 'Entregue'
  | 'Finalizado';
  
export type DeliveryStatus = 'Pendente' | 'Em Andamento' | 'No Prazo' | 'Atrasado';

export type QuotePriority = 'Baixa' | 'Normal' | 'Alta' | 'Urgente';

export type FreightMode = 'dedicado' | 'fracionado' | 'armazenagem';

export type PaymentStatus = 'Pendente' | 'Pago' | 'Parcial';

export interface BillingHistoryEvent {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  action: 'CRIADA' | 'VENCIMENTO_ALTERADO' | 'PAGAMENTO_REGISTRADO' | 'PAGAMENTO_REVERTIDO' | 'DESCONTO_APLICADO';
  details: string;
}

export interface Quote {
  id: string;
  userId: string | ObjectId;
  usuario: string;
  remetente: string;
  remetenteId?: string;
  empresaDestino: string;
  destinatario?: string;
  destinatarioId?: string;
  tomador: string;
  tomadorId?: string;
  responsavelSolicitante?: string;
  contato?: string;
  email?: string;
  cidadeOrigem: string;
  cidadeDestino: string;
  veiculo: string;
  kmIda: number;
  kmTotal: number;
  kmExcedente: number;
  valorProduto: number;
  adicional: number;
  adicionalProduto: number;
  totalFrete: number;
  acrescimoRegional: number;
  regiao: string | null;
  icmsAliquota: number;
  icmsValor?: number;
  desconto: number;
  valorFinal: number;
  prazoEntrega: number;
  data: string; // ISO String
  closedAt?: string; // ISO String for when it was set to 'Fechada' or 'Finalizado'
  status: QuoteStatus;
  history: QuoteHistoryEvent[];
  operationalHistory?: OperationalEvent[];
  quoteCode?: string;
  nfNumber?: string;
  volumeCount?: number;
  totalExpense?: number;
  grossProfit?: number;
  netProfit?: number;
  enderecoColeta?: string;
  enderecoEntrega?: string;
  deliveryForecast?: string | null;
  deliveredAt?: string | null;
  deliveryStatus?: DeliveryStatus;
  proofOfDeliveryUrl?: string;
  proofOfDeliveryUrls?: string[];
  peso?: number;
  cubagem?: number;
  cubageItems?: Array<{ length: number; width: number; height: number; quantity: number }>;
  quantidade?: number;
  priority?: QuotePriority;
  occurrences?: Occurrence[];
  freightMode?: FreightMode;
  cliente?: string; // Mantido por compatibilidade
  solicitante?: string; // Mantido por compatibilidade
  // Billing fields
  billingDueDate?: string | null;
  paymentStatus?: PaymentStatus;
  paidAmount?: number;
  paymentDate?: string | null;
  billingHistory?: BillingHistoryEvent[];
  paidPayslipId?: string; // ID do holerite que pagou o bônus desta cotação
  // Grouping fields
  isGrouped?: boolean;
  groupedQuoteIds?: string[];
  parentQuoteId?: string;
  invoiceId?: string; // New field to link to an invoice
  isRoundTrip?: boolean;
  nfeXml?: string;
  nfeChave?: string;
  taxaDificuldade?: number;
  isRuralOrigem?: boolean;
  isRuralDestino?: boolean;
  isCapitalDestino?: boolean;
  isMetropolitanaDestino?: boolean;
  obs?: string;
  volumes?: number;
  aliquotaIbs?: number;
  aliquotaCbs?: number;
  cstIbsCbs?: string;
  naturezaOperacao?: string;
  driverRating?: number;
  hasManualBaseFreight?: boolean;
  valorBaseManual?: number;
  hasManualFinalValue?: boolean;
  extras?: QuoteExtra[];
  extrasTotal?: number;
  // Manual relation fields for the "Relacionados" column in billing
  customerId?: string;
  customerName?: string;
  ownerId?: string;
  ownerName?: string;
  talentId?: string;
  talentName?: string;
}

export interface QuoteExtra {
  name: string;
  enabled: boolean;
  quantity: number;
  unitValue: number;
  total: number;
}

export interface Invoice {
    id: string;
    invoiceCode: string;
    tomador: string;
    tomadorId?: string;
    quoteIds: string[];
    // Single linked quote (for individual billing, not grouped)
    quoteId?: string;
    quoteCode?: string;
    totalValue: number;
    desconto?: number;
    status: PaymentStatus;
    billingDueDate: string; // ISO String
    createdAt: string; // ISO String
    paidAmount?: number;
    paymentDate?: string | null; // ISO String
    billingHistory?: BillingHistoryEvent[];
    // Relation fields for the "Relacionados" column
    remetente?: string;
    remetenteId?: string;
    customerId?: string;
    customerName?: string;
    ownerId?: string;
    ownerName?: string;
    talentId?: string;
    talentName?: string;
}


export interface QuoteHistoryEvent {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  action: string;
  details: string;
}

export type DriverPaymentStatus = 'pago' | 'pendente' | 'parcial';

export interface OperationalEvent {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  status: QuoteStatus;
  details: string;
  action: string;
  expense?: number;
  driverId?: string;
  driverName?: string;
  driverPaymentStatus?: DriverPaymentStatus;
  paidValue?: number; // Valor pago ao motorista
  consultationNumber?: string;
}

export type ActivityType = 'LOGIN' | 'AVATAR_UPDATE';

export interface ActivityRecord {
  _id?: any;
  id?: string;
  userId: string;
  username: string;
  timestamp: string;
  type: ActivityType;
  details?: string;
}

export type SharedItemType = 
    | 'cotação' 
    | 'motorista' 
    | 'veículo' 
    | 'cliente' 
    | 'proprietário' 
    | 'talento' 
    | 'fatura' 
    | 'holerite' 
    | 'posição de estoque' 
    | 'despesa';

export interface SharedItem {
  type: SharedItemType;
  id: string;
  title: string;
  description: string;
  link: string;
}

export interface ChatMessage {
  id: string;
  chatId: ObjectId;
  senderId: ObjectId;
  senderUsername: string;
  senderAvatarUrl?: string;
  text: string;
  sharedItem?: SharedItem;
  timestamp: string;
  isDeleted: boolean;
}

export interface ChatConversation {
  id: string;
  participants: (string | ObjectId)[];
  lastMessage: {
    text: string;
    timestamp: string;
    senderId: string;
    sharedItem?: SharedItem;
  } | null;
  readBy: Record<string, boolean>;
  name?: string; // For group chats
  avatarUrl?: string; // For group chats
  isGroup?: boolean;
  status?: 'pending' | 'active' | 'finished';
  activeOperatorIds?: string[];
}

export interface HubUser {
  id: string;
  name: string;
  avatarUrl?: string;
  linkedUserIds: string[];
}

export interface ChatAnnouncement {
  id: string;
  text: string;
  pinned: boolean;
  duration?: number;
  timestamp: string;
  authorId: string;
  authorUsername: string;
  visibleTo: UserRole[];
  parentId?: string;
}

export type NoticeUrgency = 'normal' | 'atencao' | 'critico';
export type NoticeStatus = 'ativo' | 'finalizado';

export interface Notice {
  id: string;
  text: string;
  urgency: NoticeUrgency;
  status: NoticeStatus;
  timestamp: string;
  authorId: string;
  authorUsername: string;
}

export type ExpenseStatus = 'pendente' | 'pago' | 'finalizado' | 'parcial' | 'atrasado';

export interface ExpenseHistoryEvent {
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface PaymentProof {
  url: string;
  timestamp: string;
}

export interface Expense {
  id: string;
  monthYear: string; // YYYY-MM
  description: string;
  categoryId: string;
  categoryName: string;
  value: number;
  dueDate: string; // ISO string
  status: ExpenseStatus;
  notes?: string;
  paidAt?: string; // ISO string for the final payment date
  paidValue?: number; // valor total pago
  proofs?: PaymentProof[]; // Array to store all proofs
  isRecurring: boolean;
  recurringId?: string; // e.g., talentId
  isInstallment?: boolean;
  installmentId?: string;
  installmentNumber?: number;
  installmentTotal?: number;
  createdBy: string;
  createdAt: string;
  history?: ExpenseHistoryEvent[];
  quoteId?: string;
  operationalEventId?: string;
  payslipId?: string;
  driverId?: string;
  driverName?: string;
  talentId?: string;
  talentName?: string;
  customerId?: string;
  customerName?: string;
  ownerId?: string;
  ownerName?: string;
  groupId?: string;
  groupDescription?: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface Regions {
  [key: string]: string[];
}

export interface Surcharges {
  dezlog: Record<string, number>;
  fracionado: Record<string, { regional: number; cubageMultiplier: number; ia?: number }>;
}

export interface IcmsRates {
    [originUf: string]: {
        [destUf: string]: number;
    };
}

export interface OperationalSettings {
  profitTaxRate: number; // e.g., 0.16 for 16%
  grisAdvaloremRate: number; // e.g., 0.005 for 0.5%
}

export interface PayrollSettings {
    advancePaymentDay: number;
    finalPaymentDay: number;
}

export interface LabelPrintingSettings {
  colorLevel: 'light' | 'normal' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  qrCodeUrl: string;
}

export interface PrintingSettings {
  labels: LabelPrintingSettings;
}

export interface OperationalAlertsSettings {
  collectionDeadlineDays: number;
  collectionAlertTriggerDays: number;
  deliveryAlertTriggerDays: number;
  warehouseStagnationDays: number;
  expenseDueTriggerDays: number;
  billingDueTriggerDays: number;
}

export interface MinimumFreightValues {
  capital: number;
  metropolitana: number;
  interior: number;
  rural: number;
  kgCubado: number; // Legado
  kgCapital?: number;
  kgMetropolitana?: number;
  kgInterior?: number;
  kgRural?: number;
}

export type MinimumFreightRates = Record<string, Record<string, MinimumFreightValues>>;

export interface WeightTier {
  maxWeight: number;  // Até quantos kg esta faixa se aplica
  factor: number;     // Fator multiplicador (1.00 = normal, 0.70 = 30% desconto)
  label?: string;     // Label amigável (ex: "Até 500 kg")
}

export interface PricingSettings {
  regions: Regions;
  surcharges: Surcharges;
  icmsRates: IcmsRates;
  fractionalMinimumFreight?: MinimumFreightRates;
  dedicatedMinimumFreight?: MinimumFreightRates;
  regionMinimumFreight?: Record<string, Record<string, MinimumFreightValues>>;
  operational: OperationalSettings;
  payroll: PayrollSettings;
  printing: PrintingSettings;
  alerts: OperationalAlertsSettings;
  difficultyFees?: {
    fracionado: Record<string, number>;
  }
  weightTiers?: WeightTier[];
  weightTiersMode?: 'global' | 'region' | 'route';
  regionWeightTiers?: Record<string, Record<string, WeightTier[]>>;
  routeWeightTiers?: Record<string, Record<string, WeightTier[]>>;
}


export interface ResetHistoryEvent {
    id: string;
    timestamp: string;
    userId: string;
    username: string;
    targets: string[];
}

export interface PayslipItem {
    id: string; // Will reference the EarningDeductionType ID
    code: string;
    description: string;
    reference: number;
    factor: 'Dias' | 'Horas' | '%' | 'Valor Fixo';
    earnings: number;
    deductions: number;
}

export interface Talent {
    id: string;
    status: 'Ativo' | 'Inativo';
    fullName: string;
    rg: string;
    cpf: string;
    phone1: string;
    phone2?: string;
    address: string;
    hireDate: string; // ISO string
    terminationDate?: string; // ISO string
    pixKey: string;
    pixKeyType: 'CPF/CNPJ' | 'Celular' | 'E-mail';
    hiringTypeId: string;
    jobTitle: string;
    baseSalary: number;
    salesBonusPercentage?: number;
    observations?: string;
    userId?: string | ObjectId;
}

export interface HiringType {
    id: string;
    name: string;
}

export interface EarningDeductionType {
  id: string;
  code: string;
  name: string;
  type: 'Provento' | 'Desconto';
}

export interface Payslip {
    id: string;
    talentId: string;
    talentName: string;
    referenceMonth: string; // YYYY-MM
    type: 'Pagamento Final' | 'Adiantamento';
    createdAt: string;
    createdBy?: string;
    talentData: {
        fullName: string;
        cpf: string;
        jobTitle: string;
        hireDate: string;
    };
    items: PayslipItem[];
    totalEarnings: number;
    totalDeductions: number;
    netSalary: number;
    bonus?: {
        eligibleQuoteIds: string[];
        eligibleQuotes?: {
            id: string;
            code: string;
            date: string;
            clientName: string;
            billingValue: number;
            bonusValue: number;
        }[];
    }
}

export interface LabelData {
  quoteCode: string;
  nf: string;
  totalVolumes: number;
  remetenteName: string;
  origem: string;
  destinatarioName: string;
  entrega: string;
}

export interface StockLabel extends LabelData {
  id: string;
  quoteId: string;
  createdAt: string;
}

export interface CnpjAddressInfo {
  id?: string;
  razaoSocial: string;
  nomeFantasia: string;
  endereco: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  city: string;
  state: string;
  cep: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  inscricaoEstadual?: string;
  openingHours?: string;
  source: 'local' | 'api';
  codigo_ibge?: string;
}

export interface NfeData {
  nfNumber: string;
  volumeCount: number;
  remetente: string;
  remetenteEndereco: string;
  destinatario: string;
  destinatarioEndereco: string;
}

export interface Manifest {
    _id?: ObjectId;
    id: string;
    manifestCode: string;
    driverId: string;
    driverName: string;
    driverLicensePlate: string;
    consultationNumber: string;
    createdAt: string;
    closedAt: string | null;
    status: 'Pendente' | 'Finalizado' | 'Em Rota';
    quotes: {
        quoteId: string;
        quoteCode: string;
        destinatario: string;
        cidadeDestino: string;
        enderecoEntrega?: string;
        nfNumber: string;
        nfeKey: string;
        totalVolumes: number;
        scannedVolumes: number;
        scannedBarcodes: string[];
        status?: QuoteStatus;
        proofOfDeliveryUrl?: string;
        driverPaymentAmount?: number;
    }[];
}

export interface DriverPortalData {
  manifests: Manifest[];
  activityHistory: ActivityRecord[];
}


export type LoginResult = {
  status: 'success' | 'invalid-credentials' | 'disabled' | 'error' | 'db-connection-error';
  message?: string;
  token?: string;
  user?: User;
};

export interface RouteInfo {
    distance: number;
    duration: number;
    geometry: any;
    waypoints: { name: string; location: [number, number] }[];
}
