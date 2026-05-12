
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';
import { ObjectId } from 'mongodb';
import type { Driver, FleetVehicle } from '@/lib/types';
import { buildMdfeXml, type MdfeDados, type MdfeMunDescarga } from '@/lib/sefaz/xml-builder-mdfe';
import { signMdfeXml } from '@/lib/sefaz/xml-signer';
import { enviarMdfe, type SefazResponse } from '@/lib/sefaz/soap-client';
import { loadCertificateFromDB, validateCertificate } from '@/lib/sefaz/certificate';
import type { SefazAmbiente } from '@/lib/sefaz/endpoints';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const {
            ufInicio, ufFim, veiculoTracaoId, condutorId,
            documentos, vCarga, qCarga, cMunDescarga, xMunDescarga,
            munsDescarga, tpRod, tpCar, infCpl, nAver,
            ufsPercurso, contratanteCnpj, contratanteCpf, contratanteNome,
            infLotacao,
        } = body;

        // Regra SEFAZ: Para transportadora (ETC), MDF-e deve ter ao menos um CT-e vinculado
        const chavesCte: string[] = Array.isArray(documentos)
            ? documentos.filter((k: string) => k.substring(20, 22) === '57')
            : [];

        if (!ufInicio || !ufFim || !veiculoTracaoId || !condutorId || chavesCte.length === 0 || !vCarga || !qCarga) {
            return NextResponse.json({ message: 'Dados insuficientes. UF início/fim, veículo, condutor e ao menos um CT-e são obrigatórios.' }, { status: 400 });
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
        // 2. BUSCAR ENTIDADES
        // =====================================================
        const emitente = await db.collection('company_profiles').findOne({ isDefault: true });
        if (!emitente) {
            return NextResponse.json({ message: "Perfil da empresa emitente (padrão) não configurado." }, { status: 400 });
        }

        const sysSettings = await db.collection('system_settings').findOne({ type: 'ambiente_sefaz' });
        const tpAmb = sysSettings?.sefazEnvironment === 'producao' ? 1 : 2;
        const ambiente: SefazAmbiente = tpAmb === 1 ? 'producao' : 'homologacao';

        if (!emitente.codigo_ibge) {
            return NextResponse.json({ message: "O perfil da empresa emitente precisa ter um código IBGE configurado." }, { status: 400 });
        }

        const veiculoRaw = await db.collection('fleet').findOne({ _id: new ObjectId(veiculoTracaoId) });
        const condutorRaw = await db.collection('drivers').findOne({ _id: new ObjectId(condutorId) });

        const veiculo = veiculoRaw ? { id: (veiculoRaw as any)._id.toHexString(), ...veiculoRaw } as unknown as FleetVehicle : null;
        const condutor = condutorRaw ? { id: (condutorRaw as any)._id.toHexString(), ...condutorRaw } as unknown as Driver : null;

        if (!veiculo || !condutor) {
            return NextResponse.json({ message: "Veículo ou condutor não encontrado." }, { status: 404 });
        }
        if (!veiculo.antt) {
            return NextResponse.json({ message: "O veículo selecionado precisa ter um RNTRC (ANTT) válido." }, { status: 400 });
        }

        // =====================================================
        // 3. VALIDAR IE DO EMITENTE
        // =====================================================
        const emitenteIE = emitente.inscricaoEstadual?.trim().toUpperCase();
        if (!emitenteIE) {
            return NextResponse.json({ message: "ATENÇÃO: A Inscrição Estadual (IE) da sua transportadora não foi preenchida! Vá em 'Configurações > Dados da Empresa' e informe a IE." }, { status: 400 });
        }
        const emitenteIsIsento = emitenteIE === "ISENTO";
        const emitenteCleanIE = emitenteIE.replace(/\D/g, '');
        if (!emitenteIsIsento && emitenteCleanIE.length < 2) {
            return NextResponse.json({ message: "A Inscrição Estadual da sua Empresa é inválida. Verifique em Configurações > Dados da Empresa." }, { status: 400 });
        }

        // =====================================================
        // 4. IDENTIFICAR PROPRIETÁRIO E TIPO TRANSP.
        // =====================================================
        let tpTransp: 1 | 2 | 3 = 1; // Default: ETC
        const vCat = String(veiculo.category || '').toUpperCase();
        if (vCat.includes('TAC')) tpTransp = 2;
        else if (vCat.includes('CTC')) tpTransp = 3;
        else if (vCat.includes('ETC')) tpTransp = 1;

        let prop: any = undefined;
        if (veiculo.type === 'Terceiro') {
            if (veiculo.ownerType === 'driver' && condutor) {
                // O proprietário é o próprio motorista
                prop = {
                    cpf: condutor.cpf,
                    rntrc: veiculo.antt,
                    xNome: condutor.name,
                    ie: 'ISENTO',
                    uf: veiculo.state,
                    tpProp: '1', // TAC Independente
                };
            } else if (veiculo.ownerId) {
                // Proprietário cadastrado na coleção 'owners'
                const ownerRaw = await db.collection('owners').findOne({ _id: new ObjectId(veiculo.ownerId) });
                if (ownerRaw) {
                    // SEFAZ: Se o proprietário for a própria transportadora, não deve informar o grupo 'prop'
                    const ownerDoc = (ownerRaw.document || '').replace(/\D/g, '');
                    const emitterDoc = (emitente.cnpj || '').replace(/\D/g, '');
                    
                    if (ownerDoc !== emitterDoc) {
                        prop = {
                            cnpj: ownerRaw.type === 'Pessoa Jurídica' ? ownerRaw.document : undefined,
                            cpf: ownerRaw.type === 'Pessoa Física' ? ownerRaw.document : undefined,
                            rntrc: veiculo.antt,
                            xNome: ownerRaw.name,
                            ie: (ownerRaw as any).inscricaoEstadual || 'ISENTO',
                            uf: ownerRaw.state || veiculo.state,
                            tpProp: veiculo.category === 'TAC' ? '1' : '2',
                        };
                    }
                }
            }
        }

        // Regra de Ouro SEFAZ: Se o proprietário do veículo for CPF, o tpTransp DEVE ser 2 (TAC)
        if (prop && prop.cpf) {
            tpTransp = 2;
        }

        // =====================================================
        // 5. MONTAR DADOS DO MDF-e
        // =====================================================
        const nMDF = Number(sysSettings?.nextMdfeNumber) || 1;

        // Agrupar documentos por município de descarga
        let munGroups: any[] = [];

        if (Array.isArray(munsDescarga) && munsDescarga.length > 0) {
            munGroups = munsDescarga.map((mun: any) => ({
                cMunDescarga: mun.cMunDescarga,
                xMunDescarga: mun.xMunDescarga,
                infCTe: (mun.chaves || []).filter((k: string) => k.substring(20, 22) === '57').map((k: string) => ({ chave: k })),
                infNFe: (mun.chaves || []).filter((k: string) => k.substring(20, 22) === '55').map((k: string) => ({ chave: k })),
            }));
        } else {
            const munGroup = {
                cMunDescarga: cMunDescarga || emitente.codigo_ibge,
                xMunDescarga: xMunDescarga || emitente.cidade || 'Municipio',
                infCTe: [] as { chave: string }[],
                infNFe: [] as { chave: string }[],
            };
            documentos.forEach((chaveStr: string) => {
                const modelo = chaveStr.substring(20, 22);
                if (modelo === '57') munGroup.infCTe.push({ chave: chaveStr });
                else if (modelo === '55') munGroup.infNFe.push({ chave: chaveStr });
            });
            munGroups = [munGroup];
        }

        const mdfeDados: MdfeDados = {
            tpAmb: tpAmb as 1 | 2,
            serie: 1,
            nMDF,
            tpTransp,

            emitente: {
                cnpj: emitente.cnpj,
                inscricaoEstadual: emitenteIsIsento ? 'ISENTO' : emitenteCleanIE,
                razaoSocial: emitente.razaoSocial,
                endereco: emitente.endereco,
                cidade: emitente.cidade,
                estado: emitente.estado,
                cep: emitente.cep,
                codigo_ibge: emitente.codigo_ibge,
                rntrc: emitente.rntrc,
            },

            condutor: {
                nome: condutor.name,
                cpf: condutor.cpf,
            },

            veiculo: {
                placa: veiculo.plate,
                estado: veiculo.state,
                renavam: veiculo.renavam,
                tara: Number((veiculo as any).tara) || 15000,
                capKG: Number(String((veiculo as any).capacity || '').replace(/\D/g, '')) || undefined,
                capM3: Number(String((veiculo as any).cubage || '').replace(/\D/g, '')) || undefined,
                tpRod: tpRod || (veiculo as any).tpRod || '03',
                tpCar: tpCar || (veiculo as any).tpCar || '02',
                prop,
            },

            ufInicio,
            ufFim,
            ufsPercurso: Array.isArray(ufsPercurso) ? ufsPercurso.filter(Boolean) : [],
            munDescarga: munGroups,
            infLotacao: infLotacao ? {
                cepCarrega: String(infLotacao.cepCarrega),
                cepDescarrega: String(infLotacao.cepDescarrega)
            } : undefined,
            contratante: (contratanteCnpj || contratanteCpf)
                ? { 
                    cnpj: contratanteCnpj || undefined, 
                    cpf: contratanteCpf || undefined,
                    xNome: contratanteNome || undefined
                  }
                : undefined,
            vCarga: Number(vCarga),
            qCarga: Number(qCarga),
            cUnid: '01',
            infCpl: infCpl || undefined,
            seg: (() => {
                const s = [];
                if (emitente.insuranceCompany) {
                    s.push({
                        respSeg: '1' as const,
                        xSeg: emitente.insuranceCompany,
                        cnpj: emitente.insuranceCnpj,
                        nApol: emitente.insurancePolicy,
                        nAver: nAver ? [nAver] : [],
                    });
                }
                if (emitente.insuranceCompanyRcdc) {
                    s.push({
                        respSeg: '1' as const,
                        xSeg: emitente.insuranceCompanyRcdc,
                        cnpj: emitente.insuranceCnpjRcdc,
                        nApol: emitente.insurancePolicyRcdc,
                        nAver: nAver ? [nAver] : [],
                    });
                }
                return s.length > 0 ? s : undefined;
            })(),
        };

        // =====================================================
        // 5. GERAR XML → ASSINAR → ENVIAR PARA A SEFAZ
        // =====================================================

        // 5a. Gerar XML do MDF-e
        const { xml, chaveAcesso } = buildMdfeXml(mdfeDados);

        // 5b. Assinar XML com certificado A1
        const xmlAssinado = signMdfeXml(xml, cert.privateKey, cert.certificate);

        // 5c. Enviar para a SEFAZ via SOAP
        const sefazResponse: SefazResponse = await enviarMdfe(xmlAssinado, ambiente, cert);

        // =====================================================
        // 6. SALVAR DOCUMENTO LOCALMENTE
        // =====================================================
        const docStatus = sefazResponse.success ? 'autorizado' : 'rejeitado';
        const motivoStatus = `[Cód: ${sefazResponse.cStat}] ${sefazResponse.xMotivo}`;

        try {
            await db.collection('issued_documents').insertOne({
                type: 'MDF-e',
                environment: ambiente,
                status: docStatus,
                motivoStatus,
                chaveAcesso,
                protocolo: sefazResponse.nProt,
                dataAutorizacao: sefazResponse.dhRecbto,
                motoristaNome: condutor?.name,
                veiculoPlacas: veiculo?.plate,
                ufInicio,
                ufFim,
                chavesCte,                             // ← rastrear CT-e vinculados
                totalChavesCte: chavesCte.length,
                vCarga: Number(vCarga),
                qCarga: Number(qCarga),
                xmlAssinado,
                xmlRetorno: sefazResponse.xmlRetorno,
                xmlProtocolo: sefazResponse.xmlProtocolo,
                dataEmissao: new Date().toISOString(),
            });

            // Avançar numeração do MDF-e apenas se foi autorizado com sucesso
            if (sefazResponse.success) {
                await db.collection('system_settings').updateOne(
                    { type: 'ambiente_sefaz' },
                    { $inc: { nextMdfeNumber: 1 } }
                );
            }

        } catch (dbErr) {
            console.error("Falha ao salvar MDFe localmente no banco:", dbErr);
        }

        // =====================================================
        // 7. RESPOSTA AO FRONTEND
        // =====================================================
        if (!sefazResponse.success) {
            return NextResponse.json({
                message: `[Sefaz Negada] ${sefazResponse.xMotivo}`,
                chaveAcesso,
                cStat: sefazResponse.cStat,
                status: docStatus,
            }, { status: 400 });
        }

        return NextResponse.json({
            message: `MDF-e autorizado com sucesso! Protocolo: ${sefazResponse.nProt}`,
            chaveAcesso,
            protocolo: sefazResponse.nProt,
            status: docStatus,
        });

    } catch (error: any) {
        console.error('API MDF-e POST Error:', error);
        return NextResponse.json({ message: error.message || 'Erro interno do servidor.' }, { status: 500 });
    }
}
