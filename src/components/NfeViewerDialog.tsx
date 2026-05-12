"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Printer, Download, FileText, Loader2, Search, FileDown } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { authFetch } from '@/lib/api-client';

interface NfeViewerDialogProps {
  xmlContent?: string;
  nfeChave?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NfeViewerDialog({ xmlContent, nfeChave, isOpen, onOpenChange }: NfeViewerDialogProps) {
  const [parsedData, setParsedData] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // SEFAZ states
  const [chaveInput, setChaveInput] = useState('');
  const [isConsulting, setIsConsulting] = useState(false);
  const [consultaResult, setConsultaResult] = useState<{ cStat?: string; xMotivo?: string } | null>(null);
  const [consultaError, setConsultaError] = useState('');

  useEffect(() => {
    if (isOpen && nfeChave) {
      setChaveInput(nfeChave);
    }
    if (!isOpen) {
      setConsultaResult(null);
      setConsultaError('');
    }
  }, [isOpen, nfeChave]);

  const handleConsultaSefaz = async () => {
    const cleanChave = chaveInput.replace(/\D/g, '');
    if (cleanChave.length !== 44) {
      setConsultaError('A chave de acesso deve ter 44 dígitos.');
      return;
    }
    setIsConsulting(true);
    setConsultaError('');
    setConsultaResult(null);
    try {
      const res = await authFetch('/api/nfe/consulta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: cleanChave }),
      });
      const data = await res.json();
      if (!res.ok) {
        setConsultaError(data.message || 'Erro ao consultar SEFAZ.');
      } else {
        setConsultaResult(data);
      }
    } catch (e: any) {
      setConsultaError('Falha na conexão com o servidor.');
    } finally {
      setIsConsulting(false);
    }
  };

  const handleDownloadOfficialPdf = () => {
    // PDF download is not supported via direct SEFAZ SOAP.
  };

  const handleDownloadOfficialXml = () => {
    if (!xmlContent) return;
    const blob = new Blob([xmlContent], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Documento-${chaveInput.replace(/\D/g, '')}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseXmlContent = (xml: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, 'text/xml');
      const getTag = (tag: string, element: Element | Document = xmlDoc) => {
        const els = element.getElementsByTagName(tag);
        return els.length > 0 ? els[0].textContent || '' : '';
      };
      const emit = xmlDoc.getElementsByTagName('emit')[0];
      const dest = xmlDoc.getElementsByTagName('dest')[0];
      const ide = xmlDoc.getElementsByTagName('ide')[0];
      const total = xmlDoc.getElementsByTagName('total')[0];
      const detArray = Array.from(xmlDoc.getElementsByTagName('det'));
      const transp = xmlDoc.getElementsByTagName('transp')[0];
      const vol = transp?.getElementsByTagName('vol')[0];
      setParsedData({
        chave: getTag('chNFe') || getTag('Id').replace('NFe', ''),
        natOp: getTag('natOp', ide), nNF: getTag('nNF', ide),
        serie: getTag('serie', ide), dhEmi: getTag('dhEmi', ide),
        emitente: { cnpj: getTag('CNPJ', emit) || getTag('CPF', emit), nome: getTag('xNome', emit), ie: getTag('IE', emit), fantasia: getTag('xFant', emit) },
        destinatario: { cnpj: getTag('CNPJ', dest) || getTag('CPF', dest), nome: getTag('xNome', dest), ie: getTag('IE', dest) },
        totais: { vNF: getTag('vNF', total), vProd: getTag('vProd', total), vFrete: getTag('vFrete', total) },
        carga: { qVol: getTag('qVol', vol), pesoL: getTag('pesoL', vol), pesoB: getTag('pesoB', vol) },
        produtos: detArray.map((det) => ({ cProd: getTag('cProd', det), xProd: getTag('xProd', det), qCom: getTag('qCom', det), vUnCom: getTag('vUnCom', det), vProd: getTag('vProd', det) }))
      });
    } catch (e) { setParsedData(null); }
  };

  useEffect(() => {
    if (!xmlContent || !isOpen) return;
    parseXmlContent(xmlContent);
  }, [xmlContent, isOpen]);

  const handlePrint = () => {
      const d = parsedData;
      if (!d) return;
      const formatCNPJ = (v: string) => v?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') || v;
      const formatCurrency = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const chaveFormatada = d.chave?.replace(/(.{4})/g, '$1 ').trim() || '';
      const dataEmissao = d.dhEmi ? new Date(d.dhEmi).toLocaleString('pt-BR') : '';
      
      const prodRows = d.produtos.map((p: any, i: number) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#f8f9fa'}">
          <td style="padding:4px 6px;border:1px solid #dee2e6;text-align:center;font-size:11px">${p.cProd}</td>
          <td style="padding:4px 6px;border:1px solid #dee2e6;font-size:11px">${p.xProd}</td>
          <td style="padding:4px 6px;border:1px solid #dee2e6;text-align:right;font-size:11px">${Number(p.qCom).toFixed(2)}</td>
          <td style="padding:4px 6px;border:1px solid #dee2e6;text-align:right;font-family:monospace;font-size:11px">${Number(p.vUnCom).toFixed(4)}</td>
          <td style="padding:4px 6px;border:1px solid #dee2e6;text-align:right;font-family:monospace;font-size:11px;font-weight:600">${Number(p.vProd).toFixed(2)}</td>
        </tr>
      `).join('');

      const html = `<!DOCTYPE html><html><head><title>DANFE Simplificado - NF-e ${d.nNF}</title>
<style>
  @media print { @page { margin: 10mm 8mm; } body { margin:0; } }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #1a1a1a; font-size: 12px; line-height: 1.4; padding: 0; margin: 12px; }
  .container { max-width: 780px; margin: 0 auto; border: 2px solid #000; }
  .header { display: flex; justify-content: space-between; align-items: stretch; border-bottom: 2px solid #000; }
  .header-left { flex: 1; padding: 12px 16px; border-right: 2px solid #000; }
  .header-right { width: 320px; padding: 12px 16px; display: flex; flex-direction: column; justify-content: center; }
  .title { font-size: 18px; font-weight: 800; letter-spacing: 2px; color: #000; margin: 0 0 2px 0; }
  .subtitle { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin: 0; }
  .nf-info { margin-top: 8px; font-size: 13px; }
  .nf-info strong { color: #000; }
  .chave-label { font-size: 8px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 4px; }
  .chave-valor { font-family: 'Courier New', monospace; font-size: 12px; font-weight: 700; letter-spacing: 1px; word-break: break-all; line-height: 1.6; }
  .section { border-bottom: 1px solid #ccc; }
  .section:last-child { border-bottom: none; }
  .section-header { background: #f0f2f5; padding: 4px 12px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #555; border-bottom: 1px solid #ccc; }
  .section-body { padding: 10px 16px; }
  .row { display: flex; gap: 16px; }
  .col { flex: 1; }
  .field-label { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 1px; }
  .field-value { font-size: 12px; font-weight: 600; }
  .field-value.mono { font-family: 'Courier New', monospace; }
  .totals-grid { display: flex; border-bottom: 1px solid #ccc; }
  .total-box { flex: 1; text-align: center; padding: 10px 8px; border-right: 1px solid #ccc; }
  .total-box:last-child { border-right: none; }
  .total-label { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
  .total-value { font-size: 18px; font-weight: 800; font-family: 'Courier New', monospace; color: #000; }
  .total-value.highlight { color: #0057a3; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #e9ecef; padding: 6px 8px; border: 1px solid #dee2e6; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700; color: #555; text-align: left; }
  .footer { display: flex; justify-content: space-between; padding: 6px 16px; background: #f8f9fa; font-size: 9px; color: #999; border-top: 1px solid #ccc; }
</style></head><body>
<div class="container">
  <div class="header">
    <div class="header-left">
      <p class="title">DANFE SIMPLIFICADO</p>
      <p class="subtitle">Documento Auxiliar da Nota Fiscal Eletrônica</p>
      <div class="nf-info">
        <strong>Nº:</strong> ${d.nNF} &nbsp;&nbsp; <strong>Série:</strong> ${d.serie} &nbsp;&nbsp; <strong>Emissão:</strong> ${dataEmissao}
      </div>
      <div style="margin-top:4px;font-size:11px"><strong>Natureza:</strong> ${d.natOp}</div>
    </div>
    <div class="header-right">
      <div class="chave-label">Chave de Acesso</div>
      <div class="chave-valor">${chaveFormatada}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">Emitente</div>
    <div class="section-body">
      <div class="row">
        <div class="col"><div class="field-label">Razão Social</div><div class="field-value">${d.emitente.nome}</div></div>
      </div>
      <div class="row" style="margin-top:6px">
        <div class="col"><div class="field-label">CNPJ/CPF</div><div class="field-value mono">${formatCNPJ(d.emitente.cnpj)}</div></div>
        <div class="col"><div class="field-label">Inscrição Estadual</div><div class="field-value mono">${d.emitente.ie || 'ISENTO'}</div></div>
        ${d.emitente.fantasia ? `<div class="col"><div class="field-label">Nome Fantasia</div><div class="field-value">${d.emitente.fantasia}</div></div>` : ''}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">Destinatário / Remetente</div>
    <div class="section-body">
      <div class="row">
        <div class="col"><div class="field-label">Razão Social</div><div class="field-value">${d.destinatario.nome}</div></div>
      </div>
      <div class="row" style="margin-top:6px">
        <div class="col"><div class="field-label">CNPJ/CPF</div><div class="field-value mono">${formatCNPJ(d.destinatario.cnpj)}</div></div>
        <div class="col"><div class="field-label">Inscrição Estadual</div><div class="field-value mono">${d.destinatario.ie || 'ISENTO'}</div></div>
      </div>
    </div>
  </div>

  <div class="totals-grid">
    <div class="total-box">
      <div class="total-label">Volumes</div>
      <div class="total-value">${d.carga?.qVol || '0'}</div>
    </div>
    <div class="total-box">
      <div class="total-label">Peso Líquido (kg)</div>
      <div class="total-value">${d.carga?.pesoL ? Number(d.carga.pesoL).toFixed(3).replace('.',',') : '0,000'}</div>
    </div>
    <div class="total-box">
      <div class="total-label">Peso Bruto (kg)</div>
      <div class="total-value">${d.carga?.pesoB ? Number(d.carga.pesoB).toFixed(3).replace('.',',') : '0,000'}</div>
    </div>
    <div class="total-box">
      <div class="total-label">Valor dos Produtos</div>
      <div class="total-value">${formatCurrency(d.totais.vProd)}</div>
    </div>
    <div class="total-box">
      <div class="total-label">Valor Total da NF</div>
      <div class="total-value highlight">${formatCurrency(d.totais.vNF)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">Produtos e Serviços</div>
    <div class="section-body" style="padding:0">
      <table>
        <thead><tr>
          <th style="width:80px;text-align:center">Código</th>
          <th>Descrição</th>
          <th style="width:70px;text-align:right">Qtd.</th>
          <th style="width:100px;text-align:right">V. Unitário</th>
          <th style="width:100px;text-align:right">V. Total</th>
        </tr></thead>
        <tbody>${prodRows}</tbody>
      </table>
    </div>
  </div>

  <div class="footer">
    <span>Documento gerado pelo sistema DezLog &bull; ${new Date().toLocaleString('pt-BR')}</span>
    <span>Página 1/1</span>
  </div>
</div>
</body></html>`;

      const printWindow = window.open('', '', 'height=800,width=900');
      if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
      }
  };

  const handleDownloadXml = () => {
    if (!xmlContent) return;
    const blob = new Blob([xmlContent], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NFe-${parsedData?.chave || 'arquivo'}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center pr-8">
            <span className="flex items-center gap-2"><FileText className="h-5 w-5"/> Leitor de NF-e (DANFE)</span>
            <div className="flex gap-2">
                {xmlContent && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleDownloadXml} title="Baixar XML">
                        <Download className="h-4 w-4 mr-2" /> XML
                    </Button>
                    <Button variant="default" size="sm" onClick={handlePrint} title="Imprimir / Salvar PDF">
                        <Printer className="h-4 w-4 mr-2" /> Imprimir (PDF)
                    </Button>
                  </>
                )}
            </div>
          </DialogTitle>
          <DialogDescription>
            Consulte a NF-e pela chave de acesso para baixar o DANFE oficial em PDF e o XML.
          </DialogDescription>
        </DialogHeader>

        {/* Barra de consulta por chave de acesso */}
        <div className="flex items-center gap-2 border rounded-md p-3 bg-muted/30">
          <Input
            placeholder="Cole a chave de acesso (44 dígitos)..."
            value={chaveInput}
            onChange={e => setChaveInput(e.target.value)}
            className="flex-1 font-mono text-xs"
            maxLength={54}
          />
          <Button onClick={handleConsultaSefaz} disabled={isConsulting} size="sm">
            {isConsulting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
            Consultar SEFAZ
          </Button>
        </div>

        {consultaError && (
          <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{consultaError}</p>
        )}

        {consultaResult && (
          <div className="flex items-center gap-2 border rounded-md p-3 bg-green-50 dark:bg-green-900/20">
            <span className="text-sm text-green-700 dark:text-green-300 flex-1">✅ NF-e encontrada e autorizada na SEFAZ!</span>
            <Button variant="outline" size="sm" onClick={handleDownloadOfficialXml} disabled={!consultaResult.xml_base64}>
              <Download className="h-4 w-4 mr-1" /> XML Oficial
            </Button>
            <Button size="sm" onClick={handleDownloadOfficialPdf} disabled={!consultaResult.pdf_base64} className="bg-blue-600 hover:bg-blue-700">
              <FileDown className="h-4 w-4 mr-1" /> DANFE PDF
            </Button>
          </div>
        )}
        
        <ScrollArea className="flex-1 border rounded-md p-4">
          {!xmlContent || !parsedData ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Arquivo XML inválido ou não fornecido.
            </div>
          ) : (
             <div ref={printRef} className="space-y-6 text-sm">
                 <div className="header-box grid grid-cols-2 gap-4">
                      <div>
                          <h2 className="text-lg font-bold mb-1">DANFE SIMPLIFICADO</h2>
                          <p><strong>Nº:</strong> {parsedData.nNF} <strong>Série:</strong> {parsedData.serie}</p>
                          <p><strong>Natureza da Operação:</strong> {parsedData.natOp}</p>
                          <p><strong>Emissão:</strong> {new Date(parsedData.dhEmi).toLocaleString('pt-BR')}</p>
                      </div>
                  <div className="flex flex-col justify-center items-end text-right">
                           <p className="text-xs text-muted-foreground uppercase">Chave de Acesso</p>
                           <p className="font-mono font-bold tracking-tight text-md">
                               {parsedData.chave.replace(/(.{4})/g, '$1 ')}
                           </p>
                       </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 border-2 border-primary/20 bg-primary/5 p-4 rounded-lg">
                      <div className="text-center">
                          <p className="text-xs text-muted-foreground uppercase font-bold">Volumes</p>
                          <p className="text-xl font-bold">{parsedData.carga?.qVol || '0'}</p>
                      </div>
                      <div className="text-center border-x">
                          <p className="text-xs text-muted-foreground uppercase font-bold">Peso Líquido (kg)</p>
                          <p className="text-xl font-bold">{parsedData.carga?.pesoL ? Number(parsedData.carga.pesoL).toFixed(3).replace('.',',') : '0,000'}</p>
                      </div>
                      <div className="text-center">
                          <p className="text-xs text-muted-foreground uppercase font-bold">Peso Bruto (kg)</p>
                          <p className="text-xl font-bold">{parsedData.carga?.pesoB ? Number(parsedData.carga.pesoB).toFixed(3).replace('.',',') : '0,000'}</p>
                      </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                     <div className="border p-3 rounded">
                         <div className="section-title text-xs font-bold text-muted-foreground mb-2">EMITENTE</div>
                         <p className="font-bold">{parsedData.emitente.nome}</p>
                         <p>CNPJ: {parsedData.emitente.cnpj}</p>
                         <p>IE: {parsedData.emitente.ie}</p>
                     </div>
                     <div className="border p-3 rounded">
                         <div className="section-title text-xs font-bold text-muted-foreground mb-2">DESTINATÁRIO</div>
                         <p className="font-bold">{parsedData.destinatario.nome}</p>
                         <p>CNPJ: {parsedData.destinatario.cnpj}</p>
                     </div>
                 </div>

                  <div className="border p-3 rounded">
                        <div className="section-title text-xs font-bold text-muted-foreground mb-2">TOTAIS</div>
                        <div className="flex justify-between font-mono">
                             <span><strong>Valor dos Produtos:</strong> R$ {parseFloat(parsedData.totais.vProd).toFixed(2).replace('.',',')}</span>
                             <span><strong>Valor Total da Nota:</strong> R$ {parseFloat(parsedData.totais.vNF).toFixed(2).replace('.',',')}</span>
                        </div>
                  </div>

                 <div>
                      <div className="section-title text-xs font-bold text-muted-foreground mb-2">PRODUTOS E SERVIÇOS</div>
                      <table className="w-full text-left border-collapse">
                          <thead>
                              <tr className="bg-muted">
                                  <th className="p-2 border">Cód.</th>
                                  <th className="p-2 border">Descrição</th>
                                  <th className="p-2 border">Qtd</th>
                                  <th className="p-2 border">V. Unitário</th>
                                  <th className="p-2 border">V. Total</th>
                              </tr>
                          </thead>
                          <tbody>
                              {parsedData.produtos.map((p: any, i: number) => (
                                  <tr key={i} className="border-b">
                                      <td className="p-2 border">{p.cProd}</td>
                                      <td className="p-2 border">{p.xProd}</td>
                                      <td className="p-2 border">{Number(p.qCom).toFixed(2)}</td>
                                      <td className="p-2 border">{Number(p.vUnCom).toFixed(4)}</td>
                                      <td className="p-2 border">{Number(p.vProd).toFixed(2)}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                 </div>
             </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
