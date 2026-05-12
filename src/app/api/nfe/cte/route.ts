
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Quote, Company, CompanyProfile, Driver, FleetVehicle } from '@/lib/types';
import { buildCteXml, type CteDados } from '@/lib/sefaz/xml-builder-cte';
import { signCteXml } from '@/lib/sefaz/xml-signer';
import { enviarCte, type SefazResponse } from '@/lib/sefaz/soap-client';
import { loadCertificateFromDB, validateCertificate } from '@/lib/sefaz/certificate';
import type { SefazAmbiente } from '@/lib/sefaz/endpoints';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { 
            quoteId, cfop, naturezaOperacao, valorReceber, serie,
            remetenteId, destinatarioId, tomadorId,
            condutorId, veiculoId, nfeKey, valorProdutos, valorNota, peso,
            produtoPredominante, especieCarga, cstIbsCbs, aliquotaIbs, aliquotaCbs, tomadorIE,
            quantidadeVolumes, observacoes
        } = body;
        
        if (!remetenteId || !destinatarioId || !tomadorId) {
            return NextResponse.json({ message: 'Dados insuficientes. Remetente, Destinatário e Tomador são obrigatórios.' }, { status: 400 });
        }

        const { db } = await connectToDatabase();
        
        // =====================================================
        // 1. CARREGAR CERTIFICADO DIGITAL A1
        // =====================================================
        const cert = await loadCertificateFromDB(db);
        if (!cert) {
            return NextResponse.json({ 
                message: 'Certificado digital A1 não configurado. Importe-o em Configurações > Certificado Digital.' 
            }, { status: 400 });
        }
        
        const certValidation = validateCertificate(cert);
        if (!certValidation.valid) {
            return NextResponse.json({ message: certValidation.message }, { status: 400 });
        }

        // =====================================================
        // 2. BUSCAR ENTIDADES NECESSÁRIAS
        // =====================================================
        const [
            emitenteRaw,
            remetenteRaw,
            destinatarioRaw,
            tomadorRaw,
            condutorRaw,
            veiculoRaw,
            quoteRaw,
            sysSettings
        ] = await Promise.all([
            db.collection('company_profiles').findOne({ isDefault: true }),
            db.collection('customers').findOne({ _id: new ObjectId(remetenteId) }),
            db.collection('customers').findOne({ _id: new ObjectId(destinatarioId) }),
            db.collection('customers').findOne({ _id: new ObjectId(tomadorId) }),
            condutorId ? db.collection('drivers').findOne({ _id: new ObjectId(condutorId) }) : Promise.resolve(null),
            veiculoId ? db.collection('fleet').findOne({ _id: new ObjectId(veiculoId) }) : Promise.resolve(null),
            quoteId && quoteId !== 'avulso' ? db.collection('quotes').findOne({ _id: new ObjectId(quoteId) }) : Promise.resolve(null),
            db.collection('system_settings').findOne({ type: 'ambiente_sefaz' }),
        ]);

        const emitente = emitenteRaw ? { id: (emitenteRaw as any)._id.toHexString(), ...emitenteRaw } as unknown as CompanyProfile : null;
        const remetente = remetenteRaw ? { id: (remetenteRaw as any)._id.toHexString(), ...remetenteRaw } as unknown as Company : null;
        const destinatario = destinatarioRaw ? { id: (destinatarioRaw as any)._id.toHexString(), ...destinatarioRaw } as unknown as Company : null;
        const tomador = tomadorRaw ? { id: (tomadorRaw as any)._id.toHexString(), ...tomadorRaw } as unknown as Company : null;
        const condutor = condutorRaw ? { id: (condutorRaw as any)._id.toHexString(), ...condutorRaw } as unknown as Driver : null;
        const veiculo = veiculoRaw ? { id: (veiculoRaw as any)._id.toHexString(), ...veiculoRaw } as unknown as FleetVehicle : null;
        const quote = quoteRaw ? { id: (quoteRaw as any)._id.toHexString(), ...quoteRaw } as unknown as Quote : null;

        if (!emitente) return NextResponse.json({ message: "Perfil corporativo emitente não configurado." }, { status: 400 });
        if (!remetente) return NextResponse.json({ message: "Remetente não encontrado no cadastro." }, { status: 404 });
        if (!destinatario) return NextResponse.json({ message: "Destinatário não encontrado no cadastro." }, { status: 404 });
        if (!tomador) return NextResponse.json({ message: "Tomador não encontrado no cadastro." }, { status: 404 });
        if (veiculoId && !veiculo) return NextResponse.json({ message: "Veículo não encontrado." }, { status: 404 });
        
        const tpAmb = sysSettings?.sefazEnvironment === 'producao' ? 1 : 2;
        const ambiente: SefazAmbiente = tpAmb === 1 ? 'producao' : 'homologacao';
        
        if (veiculo && (!veiculo.antt || !veiculo.renavam)) {
             return NextResponse.json({ message: "O veículo selecionado precisa ter ANTT e RENAVAM cadastrados." }, { status: 400 });
        }

        // =====================================================
        // 3. VALIDAÇÕES DE FIREWALL SEFAZ
        // =====================================================
        const UF_CODES: Record<string, number> = {
            'RO': 11, 'AC': 12, 'AM': 13, 'RR': 14, 'PA': 15, 'AP': 16, 'TO': 17,
            'MA': 21, 'PI': 22, 'CE': 23, 'RN': 24, 'PB': 25, 'PE': 26, 'AL': 27, 'SE': 28, 'BA': 29,
            'MG': 31, 'ES': 32, 'RJ': 33, 'SP': 35,
            'PR': 41, 'SC': 42, 'RS': 43,
            'MS': 50, 'MT': 51, 'GO': 52, 'DF': 53
        };

        const getIE = (ie?: string) => {
            if (!ie) return "ISENTO";
            const upper = ie.trim().toUpperCase();
            if (upper === "ISENTO") return "ISENTO";
            const clean = ie.replace(/\D/g, '');
            return clean.length >= 2 ? clean : "ISENTO";
        };

        const emitenteIE = emitente.inscricaoEstadual?.trim().toUpperCase();
        if (!emitenteIE) {
            return NextResponse.json({ message: "ATENÇÃO: A Inscrição Estadual (IE) da sua transportadora não foi preenchida! Vá em 'Configurações > Dados da Empresa' e informe a IE." }, { status: 400 });
        }
        const emitenteIsIsento = emitenteIE === "ISENTO";
        const emitenteCleanIE = emitenteIE.replace(/\D/g, '');
        if (!emitenteIsIsento && emitenteCleanIE.length < 2) {
            return NextResponse.json({ message: "A Inscrição Estadual da sua Empresa é inválida. Verifique em Configurações > Dados da Empresa." }, { status: 400 });
        }

        const validateIBGExUF = (ibge: string | undefined | null, uf: string | undefined | null, label: string) => {
            if (!uf) throw new Error(`[Firewall Sefaz] O Estado (UF) em ${label} não foi informado.`);
            if (!ibge) {
                const action = label.includes('Emitente') ? "Vá em 'Configurações > Dados da Empresa'" : "Vá no cadastro de clientes";
                throw new Error(`[Firewall Sefaz] O Código IBGE do município em ${label} não foi informado. ${action} e preencha.`);
            }
            
            const expectedPrefix = UF_CODES[uf.toUpperCase()];
            if (expectedPrefix && !ibge.startsWith(expectedPrefix.toString())) {
                const action = label.includes('Emitente') ? "Vá em 'Configurações > Dados da Empresa'" : "Edite o cliente";
                throw new Error(`[Firewall Sefaz Rejeição 414] Código do Município IBGE (${ibge}) de ${label} diverge da UF (${uf.toUpperCase()}). ${action} informando o IBGE correto.`);
            }
            return { ibge, uf: uf.toUpperCase() };
        };

        const emitenteEnder = validateIBGExUF(emitente.codigo_ibge, emitente.estado, "Endereço do Emitente");
        
        let origemCityName = emitente.cidade || "São Paulo";
        let origemIBGE = emitente.codigo_ibge;
        let origemUF = emitente.estado;
        if (quote && quote.cidadeOrigem) {
            origemCityName = quote.cidadeOrigem.split(',')[0].trim();
            origemUF = quote.cidadeOrigem.split(',')[1]?.trim() || origemUF;
            origemIBGE = (quote as any).cidadeOrigem_ibge; 
        }
        const iniValidation = validateIBGExUF(origemIBGE, origemUF, "Município Genérico de Início da Prestação");

        let destCityName = destinatario.cidade || "São Paulo";
        let destIBGE = destinatario.codigo_ibge;
        let destUF = destinatario.estado;
        if (quote && quote.cidadeDestino) {
            destCityName = quote.cidadeDestino.split(',')[0].trim();
            destUF = quote.cidadeDestino.split(',')[1]?.trim() || destUF;
            destIBGE = (quote as any).cidadeDestino_ibge;
        }
        const fimValidation = validateIBGExUF(destIBGE, destUF, "Município Genérico do Término da Prestação");
        
        const remetenteValidation = validateIBGExUF(remetente.codigo_ibge, remetente.estado, "Remetente");
        const destinatarioValidation = validateIBGExUF(destinatario.codigo_ibge, destinatario.estado, "Destinatário");
        
        const tomadorValidation = tomadorId !== remetenteId && tomadorId !== destinatarioId ? validateIBGExUF(tomador.codigo_ibge, tomador.estado, "Tomador") : null;

        const isInterstate = iniValidation.uf !== fimValidation.uf;
        const _cfopPrefix = String(cfop || "5352").replace(/\D/g, '').charAt(0);
        if (isInterstate && _cfopPrefix === '5') {
            return NextResponse.json({ message: `[Firewall Sefaz] Operação interestadual (Início: ${iniValidation.uf}, Fim: ${fimValidation.uf}) exige CFOP iniciado por 6. O CFOP atual é ${cfop}.` }, { status: 400 });
        }
        if (!isInterstate && _cfopPrefix === '6') {
             return NextResponse.json({ message: `[Firewall Sefaz] Operação estadual ${iniValidation.uf} exige CFOP iniciado por 5. O CFOP atual é ${cfop}.` }, { status: 400 });
        }

        // =====================================================
        // 4. MONTAR DADOS PARA O BUILDER DE XML
        // =====================================================
        const numeroCte = Number(sysSettings?.nextCteNumber) || 1;
        
        const tomadorTipo = tomadorId === remetenteId ? 0 
                          : tomadorId === destinatarioId ? 3 
                          : 4;

        const cteDados: CteDados = {
            tpAmb: tpAmb as 1 | 2,
            serie: Number(serie) || Number(sysSettings?.defaultSerie) || 1,
            numeroCte,
            cfop: String(cfop || "5352"),
            naturezaOperacao: String(naturezaOperacao || sysSettings?.defaultNaturezaOperacao || "PRESTACAO DE SERVICO DE TRANSPORTE"),
            tpCTe: body.tpCTe !== undefined ? Number(body.tpCTe) : (sysSettings?.defaultTpCTe ?? 0),
            tpServ: body.tpServ !== undefined ? Number(body.tpServ) : (sysSettings?.defaultTpServ ?? 0),
            tpEmis: body.tpEmis !== undefined ? Number(body.tpEmis) : (sysSettings?.defaultTpEmis ?? 1),

            emitente: {
                cnpj: emitente.cnpj,
                inscricaoEstadual: emitenteIsIsento ? "ISENTO" : emitenteCleanIE,
                razaoSocial: emitente.razaoSocial,
                nomeFantasia: emitente.nomeFantasia,
                endereco: emitente.endereco,
                cidade: emitente.cidade,
                estado: emitente.estado,
                cep: emitente.cep,
                codigo_ibge: emitenteEnder.ibge,
                telefone: emitente.telefone,
                rntrc: emitente.rntrc,
            },

            remetente: {
                cnpj: remetente.cnpj,
                inscricaoEstadual: tomadorId === remetenteId && tomadorIE ? getIE(tomadorIE) : getIE(remetente.inscricaoEstadual),
                razaoSocial: remetente.razaoSocial,
                endereco: remetente.endereco || "Rua Principal",
                cidade: remetente.cidade || "São Paulo",
                estado: remetenteValidation.uf,
                cep: remetente.cep || "01000000",
                codigo_ibge: remetenteValidation.ibge,
                telefone: remetente.telefone,
            },

            destinatario: {
                cnpj: destinatario.cnpj,
                inscricaoEstadual: tomadorId === destinatarioId && tomadorIE ? getIE(tomadorIE) : getIE(destinatario.inscricaoEstadual),
                razaoSocial: destinatario.razaoSocial,
                endereco: destinatario.endereco || "Rua Secundária",
                cidade: destinatario.cidade || "São Paulo",
                estado: destinatarioValidation.uf,
                cep: destinatario.cep || "01000000",
                codigo_ibge: destinatarioValidation.ibge,
                telefone: destinatario.telefone,
            },

            tomador: {
                cnpj: tomador.cnpj,
                inscricaoEstadual: tomadorIE ? getIE(tomadorIE) : getIE(tomador.inscricaoEstadual),
                razaoSocial: tomador.razaoSocial,
                endereco: tomador.endereco || "Rua",
                cidade: tomador.cidade || "São Paulo",
                estado: tomadorValidation?.uf || tomador.estado?.toUpperCase() || iniValidation.uf,
                cep: tomador.cep || "01000000",
                codigo_ibge: tomadorValidation?.ibge || tomador.codigo_ibge || iniValidation.ibge,
                telefone: tomador.telefone,
            },
            tomadorTipo: tomadorTipo as 0 | 1 | 2 | 3 | 4,
            tomadorIE: tomadorIE ? getIE(tomadorIE) : undefined,

            valorServico: Number(valorReceber) || 0,
            valorReceber: Number(valorReceber) || 0,

            valorCarga: Number(valorNota || valorProdutos) || 0,
            produtoPredominante: String(produtoPredominante || "DIVERSOS"),
            especieCarga: especieCarga ? String(especieCarga) : undefined,
            peso: Number(peso) || 0,
            quantidadeVolumes: Number(quantidadeVolumes) || 0,

            nfeRefs: nfeKey && nfeKey.length === 44 ? [{ chave: nfeKey.replace(/\D/g, '') }] : [],

            icmsCst: '00',
            icmsBase: Number(valorReceber) || 0,
            icmsAliquota: Number(quote?.icmsAliquota || 0),
            icmsValor: Number((Number(valorReceber || 0) * Number(quote?.icmsAliquota || 0) / 100).toFixed(2)),

            cMunIni: iniValidation.ibge,
            xMunIni: origemCityName,
            ufIni: iniValidation.uf,
            cMunFim: fimValidation.ibge,
            xMunFim: destCityName,
            ufFim: fimValidation.uf,

            observacoes: observacoes ? String(observacoes) : undefined,
        };

        // =====================================================
        // 5. GERAR XML → ASSINAR → ENVIAR PARA A SEFAZ
        // =====================================================
        
        // 5a. Gerar XML do CT-e
        const { xml, chaveAcesso } = buildCteXml(cteDados);
        
        // 5b. Assinar XML com certificado A1
        const xmlAssinado = signCteXml(xml, cert.privateKey, cert.certificate);
        
        // Logs removidos para producao
        
        // 5c. Enviar para a SEFAZ via SOAP
        const ufEmitente = emitente.estado.substring(0, 2).toUpperCase();
        const sefazResponse: SefazResponse = await enviarCte(xmlAssinado, ufEmitente, ambiente, cert);

        // =====================================================
        // 6. SALVAR DOCUMENTO LOCALMENTE
        // =====================================================
        const docStatus = sefazResponse.success ? 'autorizado' : 'rejeitado';
        const motivoStatus = sefazResponse.success 
            ? `[Cód: ${sefazResponse.cStat}] ${sefazResponse.xMotivo}`
            : `[Cód: ${sefazResponse.cStat}] ${sefazResponse.xMotivo}`;

        try {
            const insertResult = await db.collection('issued_documents').insertOne({
                type: 'CTE',
                environment: ambiente,
                status: docStatus,
                motivoStatus,
                chaveAcesso,
                protocolo: sefazResponse.nProt,
                dataAutorizacao: sefazResponse.dhRecbto,
                numeroCte,
                serie: Number(serie) || 1,
                cfop: String(cfop || "5352"),
                naturezaOperacao: String(naturezaOperacao || "PRESTACAO DE SERVICO DE TRANSPORTE"),
                remetenteNome: remetente?.razaoSocial,
                remetenteCnpj: remetente?.cnpj,
                destinatarioNome: destinatario?.razaoSocial,
                destinatarioCnpj: destinatario?.cnpj,
                tomadorTipo,
                tomadorNome: tomador?.razaoSocial,
                tomadorCnpj: tomador?.cnpj,
                valorServico: Number(valorReceber) || 0,
                valorReceber: Number(valorReceber) || 0,
                valorCarga: Number(valorNota || valorProdutos) || 0,
                produtoPredominante: String(produtoPredominante || "DIVERSOS"),
                peso: Number(peso) || 0,
                quantidadeVolumes: Number(quantidadeVolumes) || 0,
                icmsCst: '00',
                icmsBase: Number(valorReceber) || 0,
                icmsAliquota: Number(quote?.icmsAliquota || 0),
                icmsValor: Number((Number(valorReceber || 0) * Number(quote?.icmsAliquota || 0) / 100).toFixed(2)),
                cidadeOrigem: origemCityName,
                ufOrigem: iniValidation.uf,
                cidadeDestino: destCityName,
                ufDestino: fimValidation.uf,
                codigoIbgeDestino: fimValidation.ibge,
                nfeChaves: nfeKey && nfeKey.length === 44 ? [nfeKey] : [],
                xmlAssinado,
                xmlRetorno: sefazResponse.xmlRetorno,
                xmlProtocolo: sefazResponse.xmlProtocolo,
                dataEmissao: new Date().toISOString(),
                pdfUrl: `/api/sefaz/dacte?id=PLACEHOLDER`,
                formData: body,
            });
            
            // Atualizar pdfUrl com o ID real do documento
            if (insertResult.insertedId) {
                await db.collection('issued_documents').updateOne(
                    { _id: insertResult.insertedId },
                    { $set: { pdfUrl: `/api/sefaz/dacte?id=${insertResult.insertedId.toHexString()}` } }
                );
            }
            
            // Avançar a numeração do CT-e APENAS se foi autorizado (success) ou se acusou duplicidade (539)
            // Se for rejeição de validação (ex: 215, 427), o número não foi consumido na SEFAZ e deve ser reaproveitado.
            if (sefazResponse.success || sefazResponse.cStat === 539) {
                await db.collection('system_settings').updateOne(
                    { type: 'ambiente_sefaz' },
                    { $set: { nextCteNumber: numeroCte + 1 } },
                    { upsert: true }
                );
            }
            
        } catch(dbErr) {
            console.error("Falha ao salvar CTe localmente no banco:", dbErr);
        }

        // =====================================================
        // 7. RESPOSTA AO FRONTEND
        // =====================================================
        if (!sefazResponse.success) {
            console.error("SEFAZ Rejeição (RAW XML):", sefazResponse.xmlRetorno);
            return NextResponse.json({ 
                message: `[Sefaz Negada] ${sefazResponse.xMotivo}`, 
                chaveAcesso,
                cStat: sefazResponse.cStat,
                status: docStatus,
                xmlRetorno: sefazResponse.xmlRetorno
            }, { status: 400 });
        }

        return NextResponse.json({
            message: `CT-e autorizado com sucesso! Protocolo: ${sefazResponse.nProt}`,
            chaveAcesso,
            protocolo: sefazResponse.nProt,
            status: docStatus,
            pdfUrl: `/api/sefaz/dacte?id=${chaveAcesso}`,
        });

    } catch (error: any) {
        console.error('API CT-e POST Error:', error);
        const isFirewallError = error.message && error.message.includes('[Firewall Sefaz');
        return NextResponse.json({ message: error.message || 'Erro interno do servidor.' }, { status: isFirewallError ? 400 : 500 });
    }
}
