export interface CfopEntry {
    id?: string;
    code: string;
    description: string;
}

export const defaultCfops: CfopEntry[] = [
    { code: "5351", description: "Prestação de serviço de transporte para execução de serviço da mesma natureza" },
    { code: "5352", description: "Prestação de serviço de transporte a estabelecimento industrial" },
    { code: "5353", description: "Prestação de serviço de transporte a estabelecimento comercial" },
    { code: "5354", description: "Prestação de serviço de transporte a estabelecimento de prestador de serviço de comunicação" },
    { code: "5355", description: "Prestação de serviço de transporte a estabelecimento de geradora ou distribuidora de energia elétrica" },
    { code: "5356", description: "Prestação de serviço de transporte a produtor rural" },
    { code: "5357", description: "Prestação de serviço de transporte a não contribuinte" },
    { code: "5359", description: "Prestação de serviço de transporte a contribuinte ou a não contribuinte quando não exista CFOP específico" },
    
    { code: "6351", description: "Prestação de serviço de transporte para execução de serviço da mesma natureza (Interestadual)" },
    { code: "6352", description: "Prestação de serviço de transporte a estabelecimento industrial (Interestadual)" },
    { code: "6353", description: "Prestação de serviço de transporte a estabelecimento comercial (Interestadual)" },
    { code: "6354", description: "Prestação de serviço de transporte a estabelecimento de prestador de serviço de comunicação (Interestadual)" },
    { code: "6355", description: "Prestação de serviço de transporte a estabelecimento de geradora ou distribuidora de energia elétrica (Interestadual)" },
    { code: "6356", description: "Prestação de serviço de transporte a produtor rural (Interestadual)" },
    { code: "6357", description: "Prestação de serviço de transporte a não contribuinte (Interestadual)" },
    { code: "6359", description: "Prestação de serviço de transporte a contribuinte ou a não contribuinte quando não exista CFOP específico (Interestadual)" },
    
    { code: "7358", description: "Prestação de serviço de transporte (Exterior)" }
];
