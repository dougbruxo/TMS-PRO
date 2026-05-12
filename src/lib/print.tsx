
"use client";

import type { Quote, LabelData, Manifest, Payslip, CompanyProfile, Invoice, LabelPrintingSettings } from './types';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { Payslip as PayslipComponent } from '@/components/Payslip';
import { BonusReport } from '@/components/BonusReport';
import { LoadingManifestDocument } from '@/components/LoadingManifestDocument';
import ReactDOMServer from 'react-dom/server';

interface PrintLabelsProps extends LabelData {
  companyProfile: CompanyProfile | null;
  printingSettings: LabelPrintingSettings;
}

export const printLabels = async ({ labelData, companyProfile, printingSettings }: { labelData: LabelData, companyProfile: CompanyProfile | null, printingSettings: LabelPrintingSettings }) => {
    const logoUrl = companyProfile?.logoUrl || "https://uploads.onecompiler.io/43rqwtabp/43s3ube24/logo_DezLog_transparente.png";
    const qrUrl = printingSettings.qrCodeUrl || companyProfile?.website || 'https://dezlog.com.br';
    const displayUrl = qrUrl.replace(/^https?:\/\//, '');

    const printWindow = window.open('', '_blank', 'height=600,width=800');
    if (!printWindow) {
        alert('Por favor, habilite pop-ups para imprimir as etiquetas.');
        return;
    }

    let qrCodeDataUrl = '';
    try {
        qrCodeDataUrl = await QRCode.toDataURL(qrUrl, { width: 70, margin: 1, errorCorrectionLevel: 'H' });
    } catch (e) {
        console.error("Failed to generate QR Code", e);
        printWindow.document.body.innerHTML = `Erro ao gerar QR Code: ${(e as Error).message}`;
        return;
    }

    const colorFilter = {
        light: 'brightness(1.1) contrast(0.9)',
        normal: 'none',
        dark: 'brightness(0.9) contrast(1.1)',
    }[printingSettings.colorLevel];

    const fontSizes = {
        small: '10px',
        medium: '12px',
        large: '14px',
    };
    const baseFontSize = fontSizes[printingSettings.fontSize];

    const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Imprimindo Etiquetas...</title>
            <style>
                @page { size: 150mm 100mm; margin: 0; }
                body { margin: 0; font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white; color: black; }
                .label-container { width: 150mm; height: 100mm; padding: 7mm; box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden; background-color: white; color: black; page-break-after: always; filter: ${colorFilter}; }
                .label-container:last-child { page-break-after: avoid; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
                .logo { max-height: 40px; width: auto; }
                .volume-info { text-align: right; }
                .volume-text { font-size: calc(${baseFontSize} * 1); font-weight: bold; margin: 0; }
                .volume-number { font-size: calc(${baseFontSize} * 3); font-weight: bold; line-height: 1; margin: 0; }
                .body { flex-grow: 1; margin: 8px 0; }
                .section { margin-bottom: 8px; }
                .section-title { font-size: calc(${baseFontSize} * 0.85); font-weight: bold; color: #555; margin: 0; }
                .name { font-size: calc(${baseFontSize} * 1.15); font-weight: bold; line-height: 1.2; margin: 0; }
                .address { font-size: ${baseFontSize}; margin: 2px 0 0 0; }
                .address-prefix { font-weight: bold; }
                .footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #ccc; padding-top: 4px; margin-top: auto; }
                .qr-code { text-align: center; }
                .qr-code img { width: 70px; height: 70px; }
                .qr-code p { font-size: calc(${baseFontSize} * 0.85); font-weight: bold; margin: 2px 0 0 0; width: 70px; line-height: 1.1; }
                .barcode-info { text-align: right; }
                .nf-details { display: flex; align-items: baseline; justify-content: flex-end; gap: 16px; margin-bottom: 4px; }
                .nf-text { font-size: calc(${baseFontSize} * 1.8); font-weight: bold; margin: 0; }
                .nf-number { font-size: calc(${baseFontSize} * 2.5); }
                .quote-text { font-size: calc(${baseFontSize} * 1.6); font-weight: bold; margin: 0; }
                .barcode-img { height: 80px; margin-left: auto; display: block; }
                #loading-indicator { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 20px; font-weight: bold; }
                @media print { #loading-indicator { display: none; } }
            </style>
        </head>
        <body>
            <div id="loading-indicator">A gerar etiquetas...</div>
        </body>
        </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();

    const body = printWindow.document.body;
    body.innerHTML = ''; // Clear loading indicator

    for (let i = 1; i <= labelData.totalVolumes; i++) {
        const barcodeValue = `${labelData.nf}-${i}`;
        
        const labelContainer = printWindow.document.createElement('div');
        labelContainer.className = 'label-container';
        labelContainer.innerHTML = `
            <div class="header">
                <img src="${logoUrl}" alt="Logo da Empresa" class="logo">
                <div class="volume-info">
                    <p class="volume-text">VOLUME:</p>
                    <p class="volume-number">${i}/${labelData.totalVolumes}</p>
                </div>
            </div>
            <div class="body">
                <div class="section">
                    <p class="section-title">REMETENTE</p>
                    <p class="name">${labelData.remetenteName}</p>
                    <p class="address"><span class="address-prefix">ORIGEM:</span> ${labelData.origem}</p>
                </div>
                <div class="section">
                    <p class="section-title">DESTINATÁRIO</p>
                    <p class="name">${labelData.destinatarioName}</p>
                    <p class="address"><span class="address-prefix">ENTREGA:</span> ${labelData.entrega}</p>
                </div>
            </div>
            <div class="footer">
                <div class="qr-code">
                    <img src="${qrCodeDataUrl}" alt="QR Code">
                    <p>${displayUrl}</p>
                </div>
                <div class="barcode-info">
                    <div class="nf-details">
                        <p class="nf-text">NF: <span class="nf-number">${labelData.nf}</span></p>
                        <p class="quote-text">COTAÇÃO: ${labelData.quoteCode}</p>
                    </div>
                    <svg id="barcode-${i}" class="barcode-img"></svg>
                </div>
            </div>
            <p style="font-size: calc(${baseFontSize} * 0.85); font-weight: bold; margin-top: 4px; text-align: right;">${companyProfile?.razaoSocial || 'Sua Empresa'}</p>
        `;
        body.appendChild(labelContainer);

        const barcodeElement = printWindow.document.querySelector(`#barcode-${i}`);
        if (barcodeElement) {
            JsBarcode(barcodeElement as HTMLElement, barcodeValue, {
                format: "CODE128",
                displayValue: true,
                text: barcodeValue,
                fontOptions: "bold",
                fontSize: 22,
                height: 80,
                margin: 0,
                textMargin: 2
            });
        }
    }

    setTimeout(() => {
        printWindow.print();
        // The window can be closed after printing, but some browsers might close it too soon.
        // setTimeout(() => printWindow.close(), 2000); 
    }, 1000);
};

export interface PalletLabelItem {
    id: string;
    title: string;
    subtitle: string;
    footer: string;
    barcodeValue: string;
}

export const printPalletLabels = async (labels: PalletLabelItem[], logoUrl?: string) => {
    if (!labels || labels.length === 0) return;

    const printWindow = window.open('', '_blank', 'height=600,width=800');
    if (!printWindow) {
        alert('Por favor, habilite pop-ups para imprimir as etiquetas.');
        return;
    }

    const finalLogoUrl = logoUrl || "https://uploads.onecompiler.io/43rqwtabp/43s3ube24/logo_DezLog_transparente.png";

    const html = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Etiquetas de Palete</title>
            <style>
                @page { size: 150mm 100mm; margin: 0; }
                body { margin: 0; font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white; color: black; }
                .label-container { width: 150mm; height: 100mm; padding: 8mm; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; background-color: white; color: black; page-break-after: always; border: 1px solid #eee; }
                .label-container:last-child { page-break-after: avoid; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; padding-bottom: 6px; }
                .logo { max-height: 36px; width: auto; }
                .label-id { font-size: 11px; font-weight: bold; color: #555; font-family: monospace; }
                .body { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 6mm 0; }
                .title { font-size: 22px; font-weight: bold; margin: 0 0 6px 0; line-height: 1.2; }
                .subtitle { font-size: 18px; font-weight: 600; color: #333; margin: 0 0 4px 0; }
                .footer-text { font-size: 12px; color: #666; margin: 8px 0 0 0; }
                .barcode-area { text-align: center; border-top: 2px solid #333; padding-top: 6px; }
                .barcode-area svg { max-width: 100%; height: 70px; }
                .volume-badge { font-size: 14px; font-weight: bold; background: #333; color: white; padding: 2px 10px; border-radius: 4px; }
                #loading-indicator { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 20px; font-weight: bold; }
                @media print { #loading-indicator { display: none; } .label-container { border: none; } }
            </style>
        </head>
        <body>
            <div id="loading-indicator">A gerar etiquetas de palete...</div>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();

    const body = printWindow.document.body;
    body.innerHTML = '';

    labels.forEach((label, index) => {
        const labelContainer = printWindow.document.createElement('div');
        labelContainer.className = 'label-container';
        labelContainer.innerHTML = `
            <div class="header">
                <img src="${finalLogoUrl}" alt="Logo" class="logo">
                <div>
                    <span class="volume-badge">${index + 1}/${labels.length}</span>
                </div>
                <span class="label-id">${label.id}</span>
            </div>
            <div class="body">
                <p class="title">${label.title}</p>
                <p class="subtitle">${label.subtitle}</p>
                <p class="footer-text">${label.footer}</p>
            </div>
            <div class="barcode-area">
                <svg id="pallet-barcode-${index}"></svg>
            </div>
        `;
        body.appendChild(labelContainer);

        const barcodeElement = printWindow.document.querySelector(`#pallet-barcode-${index}`);
        if (barcodeElement) {
            try {
                JsBarcode(barcodeElement as HTMLElement, label.barcodeValue, {
                    format: "CODE128",
                    displayValue: true,
                    text: label.barcodeValue,
                    fontOptions: "bold",
                    fontSize: 18,
                    height: 60,
                    margin: 0,
                    textMargin: 2,
                    width: 2,
                });
            } catch(e) {
                console.error('Failed to generate barcode for', label.barcodeValue, e);
            }
        }
    });

    setTimeout(() => {
        printWindow.print();
    }, 1000);
};

export const printInvoice = (item: Quote | Invoice, amountType: 'total' | 'partial' = 'total') => {
    const url = `/financial/billing/invoice/${item.id}?amountType=${amountType}`;
    
    const printWindow = window.open(url, '_blank', 'height=800,width=800');
    if (printWindow) {
      printWindow.focus();
    }
};

export const printQuote = async (quote: Quote) => {
    const url = `/quotes/${quote.id}/print`;
    const printWindow = window.open(url, '_blank', 'height=800,width=800');
    if(printWindow) {
        printWindow.focus();
    }
};

export const printLoadingManifest = async (manifest: Manifest, companyProfile: CompanyProfile | null) => {
    const htmlContent = ReactDOMServer.renderToStaticMarkup(
        <LoadingManifestDocument manifest={manifest} companyProfile={companyProfile} />
    );

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Romaneio - ${manifest.manifestCode}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
            body { font-family: 'Poppins', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          </style>
        </head>
        <body>${htmlContent}</body>
      </html>
    `;

    const printWindow = window.open('', '', 'height=800,width=800');
    if (printWindow) {
        printWindow.document.title = `Romaneio ${manifest.manifestCode}`;
        printWindow.document.write(fullHtml);
        printWindow.document.close();
        printWindow.onload = () => { setTimeout(() => { printWindow.print(); }, 1000); };
    }
};


export const generateWhatsAppLink = (item: Quote | Invoice) => {
    const isInvoice = 'invoiceCode' in item;
    const code = isInvoice ? item.invoiceCode : item.quoteCode;
    const totalValue = isInvoice ? item.totalValue : ((item as Quote).valorFinal || 0) + ((item as Quote).icmsValor || 0);

    const message = `Olá, segue a fatura referente à cobrança ${code}, no valor de ${totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.\n\nPara visualizar, acesse: ${window.location.origin}/financial/billing/invoice/${item.id}`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
};

export const printPayslip = (payslip: Payslip, companyProfile: CompanyProfile | null) => {
    const payslipHtml = ReactDOMServer.renderToStaticMarkup(
      <>
        <div className="payslip-page">
            <PayslipComponent payslip={payslip} companyProfile={companyProfile} />
        </div>
        <div className="payslip-page">
            <PayslipComponent payslip={payslip} companyProfile={companyProfile} isCompanyCopy />
        </div>
        {payslip.bonus?.eligibleQuotes && payslip.bonus.eligibleQuotes.length > 0 && (
            <div className="bonus-report-page">
                <BonusReport payslip={payslip} companyProfile={companyProfile} />
            </div>
        )}
      </>
    );

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
          <meta charset="UTF-8">
          <title>Holerite - ${payslip.talentName} - ${payslip.referenceMonth}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
              @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
              @page { size: A4 portrait; margin: 0; }
              body { font-family: 'Poppins', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
              .payslip-page { height: 14.85cm; padding: 1cm; page-break-after: always; display: flex; flex-direction: column; justify-content: center; }
              .bonus-report-page { min-height: 29.7cm; width: 100%; page-break-before: always; }
          </style>
      </head>
      <body>
        <div class="print-container">
          ${payslipHtml}
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '', 'height=800,width=800');
    if (printWindow) {
        printWindow.document.write(fullHtml);
        printWindow.document.close();
        printWindow.onload = () => { setTimeout(() => { printWindow.print(); }, 1000); };
    }
};

    