import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { NFSeRecord } from '../types/erp';
import { formatBRL } from './formatters';

interface ParsedXmlExtras {
  nNFSe?: string;
  dhProc?: string;
  prestNome?: string;
  prestEnd?: string;
  xTribNac?: string;
  xNBS?: string;
  tpAmb?: string;
}

function extractXmlTag(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m?.[1]?.trim();
}

function parseNfseXmlExtras(xml?: string): ParsedXmlExtras {
  if (!xml) return {};
  const emitBlock = extractXmlTag(xml, 'emit') ?? '';
  const prestNome = extractXmlTag(emitBlock, 'xNome');
  const xLgr = extractXmlTag(emitBlock, 'xLgr');
  const nro = extractXmlTag(emitBlock, 'nro');
  const xBairro = extractXmlTag(emitBlock, 'xBairro');
  const prestEnd = [xLgr, nro, xBairro].filter(Boolean).join(', ');
  return {
    nNFSe: extractXmlTag(xml, 'nNFSe'),
    dhProc: extractXmlTag(xml, 'dhProc'),
    prestNome,
    prestEnd: prestEnd || undefined,
    xTribNac: extractXmlTag(xml, 'xTribNac'),
    xNBS: extractXmlTag(xml, 'xNBS'),
    tpAmb: extractXmlTag(xml, 'tpAmb'),
  };
}

function formatCpfCnpj(doc: string): string {
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc || '-';
}

function formatDateTimeDisplay(isoOrDate: string): string {
  if (!isoOrDate) return '-';
  const m = isoOrDate.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}:\d{2}))?/);
  if (!m) return isoOrDate;
  return m[4] ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : `${m[3]}/${m[2]}/${m[1]}`;
}

export async function generateDanfsePdfBlob(params: {
  nfse: NFSeRecord;
  cnpjPrestador: string;
  inscricaoMunicipal: string;
  ambiente: 'homologacao' | 'producao';
  serie: string;
  authorizedXml?: string;
}): Promise<Blob> {
  const { nfse, cnpjPrestador, inscricaoMunicipal, ambiente, serie, authorizedXml } = params;
  const extras = parseNfseXmlExtras(authorizedXml);
  const chave = (nfse.chaveNfse || '').replace(/\D/g, '') || 'CHAVE_PENDENTE';
  const isHomolog = extras.tpAmb ? extras.tpAmb === '2' : ambiente !== 'producao';

  const qrUrl = isHomolog
    ? `https://www.producaorestrita.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${chave}`
    : `https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=${chave}`;

  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 180,
    margin: 1,
    color: { dark: '#0F172A', light: '#FFFFFF' },
  });

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 10;
  const contentW = pageW - margin * 2;
  let y = 10;

  const drawBox = (x: number, top: number, w: number, h: number, fill?: [number, number, number]) => {
    if (fill) {
      doc.setFillColor(...fill);
      doc.rect(x, top, w, h, 'FD');
    } else {
      doc.rect(x, top, w, h);
    }
  };

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.25);

  // Header Banner
  drawBox(margin, y, contentW, 18, [241, 245, 249]);
  doc.setTextColor(16, 185, 129);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('NFS-e', margin + 4, y + 7.5);
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Nota Fiscal de Serviço eletrônica', margin + 4, y + 12);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.text('DANFSe v2.0', pageW / 2, y + 7.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Documento Auxiliar da NFS-e', pageW / 2, y + 12.5, { align: 'center' });

  doc.setFontSize(7.5);
  doc.text('Município: São Paulo - SP', pageW - margin - 4, y + 7, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(isHomolog ? 180 : 5, isHomolog ? 83 : 150, isHomolog ? 9 : 105);
  doc.text(
    isHomolog ? 'Ambiente: HOMOLOGAÇÃO (Sem valor fiscal)' : 'Ambiente: PRODUÇÃO (Oficial)',
    pageW - margin - 4,
    y + 12.5,
    { align: 'right' }
  );
  y += 20;

  // Chave de Acesso + QR Code row
  drawBox(margin, y, contentW - 30, 26);
  drawBox(margin + contentW - 30, y, 30, 26);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CHAVE DE ACESSO DA NFS-e', margin + 3, y + 5);
  doc.setTextColor(15, 23, 42);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.text(chave, margin + 3, y + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'A autenticidade desta NFS-e pode ser verificada pelo QR Code ou consulta da chave no Portal Nacional.',
    margin + 3,
    y + 16,
    { maxWidth: contentW - 36 }
  );

  doc.addImage(qrDataUrl, 'PNG', margin + contentW - 27, y + 1.5, 23, 23);
  y += 28;

  // Metadata 3-col grid
  const col3 = contentW / 3;
  drawBox(margin, y, col3, 12);
  drawBox(margin + col3, y, col3, 12);
  drawBox(margin + col3 * 2, y, col3, 12);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('NÚMERO DA NFS-e', margin + 3, y + 4);
  doc.text('COMPETÊNCIA', margin + col3 + 3, y + 4);
  doc.text('DATA E HORA DA EMISSÃO', margin + col3 * 2 + 3, y + 4);

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(extras.nNFSe || String(parseInt(nfse.numeroDps, 10) || 1), margin + 3, y + 9.5);
  doc.text(formatDateTimeDisplay(nfse.data), margin + col3 + 3, y + 9.5);
  doc.text(formatDateTimeDisplay(extras.dhProc || nfse.data), margin + col3 * 2 + 3, y + 9.5);
  y += 12;

  drawBox(margin, y, col3, 12);
  drawBox(margin + col3, y, col3, 12);
  drawBox(margin + col3 * 2, y, col3, 12);
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('NÚMERO / SÉRIE DA DPS', margin + 3, y + 4);
  doc.text('EMITENTE', margin + col3 + 3, y + 4);
  doc.text('SITUAÇÃO', margin + col3 * 2 + 3, y + 4);

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`DPS ${parseInt(nfse.numeroDps, 10) || 1} · Série ${serie || '1'}`, margin + 3, y + 9.5);
  doc.text('Prestador (Via API A1)', margin + col3 + 3, y + 9.5);
  doc.setTextColor(5, 150, 105);
  doc.text('NFS-e Gerada / Autorizada', margin + col3 * 2 + 3, y + 9.5);
  y += 15;

  // PRESTADOR
  drawBox(margin, y, contentW, 24);
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentW, 5.5, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PRESTADOR / FORNECEDOR DE SERVIÇO', margin + 3, y + 4);

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('CNPJ:', margin + 3, y + 10);
  doc.text('Inscrição Municipal (CCM):', margin + 62, y + 10);
  doc.text('Município / UF:', margin + 132, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatCpfCnpj(cnpjPrestador || '23246816000103'), margin + 13, y + 10);
  doc.text(inscricaoMunicipal || '000000053254996', margin + 97, y + 10);
  doc.text('São Paulo / SP', margin + 153, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Razão Social: ${extras.prestNome || 'PROTECT REDES COMERCIO E SERVICOS LTDA'}`,
    margin + 3,
    y + 15.5
  );
  doc.text(
    `Endereço: ${extras.prestEnd || 'R JOSE TEIXEIRA DA SILVA, 104, PARQUE DAS PAINEIRAS — São Paulo/SP'} · Regime: ${
      nfse.regimeTributario === 'simples_nacional'
        ? 'Simples Nacional (ME/EPP)'
        : 'Regime Regular'
    }`,
    margin + 3,
    y + 20.5
  );
  y += 27;

  // TOMADOR
  drawBox(margin, y, contentW, 18);
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentW, 5.5, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('TOMADOR / ADQUIRENTE', margin + 3, y + 4);

  doc.setFontSize(8);
  doc.text(nfse.tomadorNome || '-', margin + 3, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`CPF / CNPJ: ${formatCpfCnpj(nfse.tomadorDoc)}`, margin + 3, y + 15.5);
  y += 21;

  // SERVIÇO PRESTADO
  const descLines = doc.splitTextToSize(nfse.descricaoServico || '-', contentW - 8);
  const tribNacText = extras.xTribNac
    ? `${nfse.codigoTributacaoNacional} / ${nfse.codigoTributacaoMunicipal || '001'} — ${extras.xTribNac}`
    : `${nfse.codigoTributacaoNacional} / ${nfse.codigoTributacaoMunicipal || '001'}`;
  const servBoxH = 26 + descLines.length * 4;
  drawBox(margin, y, contentW, servBoxH);
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentW, 5.5, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('SERVIÇO PRESTADO', margin + 3, y + 4);

  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Cód. Tributação Nacional/Municipal: `, margin + 3, y + 10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(tribNacText.slice(0, 88), margin + 50, y + 10.5);

  doc.setTextColor(100, 116, 139);
  doc.text(`Código NBS: ${nfse.codigoNbs}`, margin + 3, y + 15.5);
  doc.text('Local da Prestação: São Paulo / SP', margin + 70, y + 15.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Descrição do Serviço:', margin + 3, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.text(descLines, margin + 3, y + 25.5);
  y += servBoxH + 3;

  // TRIBUTAÇÃO E VALORES
  drawBox(margin, y, contentW, 28);
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentW, 5.5, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('TRIBUTAÇÃO & VALOR TOTAL DA NFS-e', margin + 3, y + 4);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Tipo de Tributação do ISSQN: Operação Tributável · Retenção: Não Retido', margin + 3, y + 10.5);
  doc.text(
    `Referência IBS/CBS (Reforma Tributária): CST ${nfse.cstIbsCbs} · ClassTrib ${nfse.cClassTrib}`,
    margin + 3,
    y + 15.5
  );

  doc.setFillColor(236, 253, 245);
  doc.rect(margin + 3, y + 18, contentW - 6, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(5, 150, 105);
  doc.text(`VALOR DO SERVIÇO: ${formatBRL(nfse.valorServico)}`, margin + 6, y + 23.2);
  doc.text(`VALOR LÍQUIDO DA NFS-e: ${formatBRL(nfse.valorServico)}`, pageW - margin - 6, y + 23.2, {
    align: 'right',
  });
  y += 33;

  if (isHomolog) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(217, 119, 6);
    doc.text(
      'ATENÇÃO: DOCUMENTO EMITIDO EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALIDADE JURÍDICA OU FISCAL.',
      pageW / 2,
      y,
      { align: 'center' }
    );
  }

  return doc.output('blob');
}
