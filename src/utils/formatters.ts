export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function offsetDaysISO(days: number): string {
  const dt = new Date();
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDateBR(iso: string): string {
  if (!iso) return '—';
  const clean = iso.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatTimeAgo(isoTimestamp: string): string {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return 'Agora';
  if (mins < 60) return `há ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `há ${days}d`;
}

export function daysDiffFromToday(isoDate: string): number {
  const today = new Date(todayISO() + 'T00:00:00');
  const target = new Date(isoDate.slice(0, 10) + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escape = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csv = [headers.map(escape).join(';'), ...rows.map((r) => r.map(escape).join(';'))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ParsedXMLNFe {
  numeroNF: string;
  dataEmissao: string;
  fornecedorNome: string;
  fornecedorCnpj: string;
  itens: {
    codigo: string;
    nome: string;
    unidade: string;
    quantidade: number;
    custoUnitario: number;
    ean: string;
  }[];
  duplicatas: {
    numero: string;
    vencimento: string;
    valor: number;
  }[];
  valorTotal: number;
}

export function parseNFeXML(xmlContent: string): ParsedXMLNFe {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Arquivo XML inválido ou corrompido.');
  }

  const getText = (parent: Element | Document, tag: string): string => {
    const el = parent.getElementsByTagName(tag)[0];
    return el?.textContent?.trim() ?? '';
  };

  const ide = doc.getElementsByTagName('ide')[0];
  const emit = doc.getElementsByTagName('emit')[0];
  if (!ide || !emit) {
    throw new Error('Estrutura de NF-e não reconhecida (tags ide/emit ausentes).');
  }

  const numeroNF = getText(ide, 'nNF') || 'S/N';
  const dhEmi = getText(ide, 'dhEmi') || getText(ide, 'dEmi');
  const dataEmissao = dhEmi ? dhEmi.slice(0, 10) : todayISO();
  const fornecedorNome = getText(emit, 'xNome') || 'Fornecedor XML';
  const fornecedorCnpj = getText(emit, 'CNPJ');

  const detElements = Array.from(doc.getElementsByTagName('det'));
  const itens = detElements.map((det) => {
    const prod = det.getElementsByTagName('prod')[0];
    return {
      codigo: prod ? getText(prod, 'cProd') : '',
      nome: prod ? getText(prod, 'xProd') : 'Item sem descrição',
      unidade: prod ? getText(prod, 'uCom') || 'Unidade' : 'Unidade',
      quantidade: prod ? parseFloat(getText(prod, 'qCom')) || 1 : 1,
      custoUnitario: prod ? parseFloat(getText(prod, 'vUnCom')) || 0 : 0,
      ean: prod ? getText(prod, 'cEAN') : '',
    };
  });

  const dupElements = Array.from(doc.getElementsByTagName('dup'));
  const duplicatas = dupElements.map((dup, idx) => ({
    numero: getText(dup, 'nDup') || `${numeroNF}-${idx + 1}`,
    vencimento: getText(dup, 'dVenc') || offsetDaysISO(30 * (idx + 1)),
    valor: parseFloat(getText(dup, 'vDup')) || 0,
  }));

  const vNF = parseFloat(getText(doc, 'vNF')) || itens.reduce((acc, i) => acc + i.quantidade * i.custoUnitario, 0);

  return {
    numeroNF,
    dataEmissao,
    fornecedorNome,
    fornecedorCnpj,
    itens,
    duplicatas,
    valorTotal: vNF,
  };
}
