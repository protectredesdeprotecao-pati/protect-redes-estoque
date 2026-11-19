import {
  AlertSettings,
  Duplicata,
  NFeRecord,
  NFSeRecord,
  Product,
  RealTimeAlert,
  Sale,
} from '../types/erp';
import { daysDiffFromToday, formatBRL, formatDateBR } from './formatters';

export function evaluateRealTimeAlerts(params: {
  products: Product[];
  duplicatas: Duplicata[];
  nfes: NFeRecord[];
  nfses?: NFSeRecord[];
  sales: Sale[];
  settings: AlertSettings;
}): RealTimeAlert[] {
  const { products, duplicatas, nfes, nfses = [], sales, settings } = params;
  const alerts: RealTimeAlert[] = [];
  const nowIso = new Date().toISOString();

  // 1. Estoque zerado e estoque baixo / preventivo
  for (const p of products) {
    if (p.saldo <= 0) {
      alerts.push({
        id: `stock-zero-${p.id}`,
        category: 'estoque',
        severity: 'critico',
        titulo: 'Estoque Esgotado',
        mensagem: `${p.nome} (${p.codigo}) está com saldo zerado. Mínimo configurado: ${p.minimo} ${p.unidade}.`,
        referenciaId: p.id,
        referenciaNome: p.nome,
        timestamp: p.updatedAt || nowIso,
        targetPage: 'produtos',
        actionLabel: 'Repor estoque',
        actionType: 'restock',
      });
    } else if (p.minimo > 0 && p.saldo <= p.minimo) {
      alerts.push({
        id: `stock-low-${p.id}`,
        category: 'estoque',
        severity: 'critico',
        titulo: 'Estoque Abaixo do Mínimo',
        mensagem: `${p.nome}: saldo de ${p.saldo} ${p.unidade} (mínimo ${p.minimo}). Reposição urgente recomendada.`,
        referenciaId: p.id,
        referenciaNome: p.nome,
        timestamp: p.updatedAt || nowIso,
        targetPage: 'produtos',
        actionLabel: 'Repor estoque',
        actionType: 'restock',
      });
    } else if (
      p.minimo > 0 &&
      settings.percentualPreventivoEstoque > 100 &&
      p.saldo <= Math.ceil(p.minimo * (settings.percentualPreventivoEstoque / 100))
    ) {
      alerts.push({
        id: `stock-warn-${p.id}`,
        category: 'estoque',
        severity: 'aviso',
        titulo: 'Estoque em Zona de Atenção',
        mensagem: `${p.nome} atingiu ${p.saldo} ${p.unidade}, próximo ao mínimo de ${p.minimo}.`,
        referenciaId: p.id,
        referenciaNome: p.nome,
        timestamp: p.updatedAt || nowIso,
        targetPage: 'produtos',
        actionLabel: 'Planejar compra',
        actionType: 'restock',
      });
    }
  }

  // 2. Duplicatas vencidas e próximas do vencimento
  for (const d of duplicatas) {
    if (d.status === 'paga') continue;
    const diff = daysDiffFromToday(d.vencimento);
    if (diff < 0) {
      alerts.push({
        id: `dup-overdue-${d.id}`,
        category: 'financeiro',
        severity: 'critico',
        titulo: 'Duplicata Vencida',
        mensagem: `${d.fornecedorNome} (NF ${d.nf || 'S/N'}) venceu há ${Math.abs(diff)} dia(s) · ${formatBRL(d.valor)}.`,
        referenciaId: d.id,
        referenciaNome: d.fornecedorNome,
        timestamp: nowIso,
        targetPage: 'duplicatas',
        actionLabel: 'Pagar agora',
        actionType: 'pay_duplicata',
      });
    } else if (diff === 0) {
      alerts.push({
        id: `dup-today-${d.id}`,
        category: 'financeiro',
        severity: 'critico',
        titulo: 'Duplicata Vence Hoje',
        mensagem: `${d.fornecedorNome} · ${d.descricao || 'NF ' + d.nf} no valor de ${formatBRL(d.valor)} vence hoje.`,
        referenciaId: d.id,
        referenciaNome: d.fornecedorNome,
        timestamp: nowIso,
        targetPage: 'duplicatas',
        actionLabel: 'Registrar pago',
        actionType: 'pay_duplicata',
      });
    } else if (diff <= settings.diasAvisoDuplicata) {
      alerts.push({
        id: `dup-soon-${d.id}`,
        category: 'financeiro',
        severity: 'aviso',
        titulo: `Duplicata Vence em ${diff}d`,
        mensagem: `${d.fornecedorNome} · Vencimento ${formatDateBR(d.vencimento)} · ${formatBRL(d.valor)}.`,
        referenciaId: d.id,
        referenciaNome: d.fornecedorNome,
        timestamp: nowIso,
        targetPage: 'duplicatas',
        actionLabel: 'Ver duplicata',
        actionType: 'pay_duplicata',
      });
    }
  }

  // 3. NF-e / NFS-e Rejeitadas ou Pendentes
  for (const nf of nfes) {
    if (nf.status === 'rejeitada') {
      alerts.push({
        id: `nfe-rej-${nf.id}`,
        category: 'fiscal',
        severity: 'critico',
        titulo: `NF-e #${nf.numero} Rejeitada`,
        mensagem: `${nf.clienteNome} · ${nf.motivoRejeicao || 'Verificar rejeição na SEFAZ.'}`,
        referenciaId: nf.id,
        referenciaNome: nf.clienteNome,
        timestamp: nowIso,
        targetPage: 'nfe',
        actionLabel: 'Revisar NF-e',
        actionType: 'open_nfe',
      });
    } else if (nf.status === 'pendente') {
      alerts.push({
        id: `nfe-pend-${nf.id}`,
        category: 'fiscal',
        severity: 'info',
        titulo: `NF-e #${nf.numero} Aguardando Transmissão`,
        mensagem: `${nf.clienteNome} · Valor ${formatBRL(nf.valor)} pendente de envio SEFAZ.`,
        referenciaId: nf.id,
        referenciaNome: nf.clienteNome,
        timestamp: nowIso,
        targetPage: 'nfe',
        actionLabel: 'Abrir NF-e',
        actionType: 'open_nfe',
      });
    }
  }

  for (const nfs of nfses) {
    if (nfs.status === 'rejeitada') {
      alerts.push({
        id: `nfse-rej-${nfs.id}`,
        category: 'fiscal',
        severity: 'critico',
        titulo: `NFS-e DPS #${nfs.numeroDps} Rejeitada`,
        mensagem: `${nfs.tomadorNome} · ${nfs.motivoRejeicao || 'Verificar rejeição Sefin Nacional.'}`,
        referenciaId: nfs.id,
        referenciaNome: nfs.tomadorNome,
        timestamp: nowIso,
        targetPage: 'nfe',
        actionLabel: 'Revisar NFS-e',
        actionType: 'open_nfe',
      });
    } else if (nfs.status === 'pendente') {
      alerts.push({
        id: `nfse-pend-${nfs.id}`,
        category: 'fiscal',
        severity: 'info',
        titulo: `NFS-e DPS #${nfs.numeroDps} Aguardando Envio`,
        mensagem: `${nfs.tomadorNome} · Serviço ${formatBRL(nfs.valorServico)} pronto para Sefin Nacional.`,
        referenciaId: nfs.id,
        referenciaNome: nfs.tomadorNome,
        timestamp: nowIso,
        targetPage: 'nfe',
        actionLabel: 'Abrir NFS-e',
        actionType: 'open_nfe',
      });
    }
  }

  // 4. Vendas Fiado em aberto há mais de X dias
  for (const s of sales) {
    if (s.status === 'concluida' && s.formaPagamento === 'fiado' && !s.fiadoPago) {
      const idadeDias = Math.abs(daysDiffFromToday(s.data));
      if (idadeDias >= settings.diasAlertaFiado) {
        alerts.push({
          id: `fiado-open-${s.id}`,
          category: 'operacional',
          severity: 'aviso',
          titulo: 'Fiado em Aberto',
          mensagem: `${s.clienteNome || 'Cliente'} possui compra #${s.numero} de ${formatBRL(s.total)} em aberto há ${idadeDias} dia(s).`,
          referenciaId: s.id,
          referenciaNome: s.clienteNome || 'Cliente',
          timestamp: s.criadoEm,
          targetPage: 'fiado',
          actionLabel: 'Receber fiado',
          actionType: 'open_fiado',
        });
      }
    }
  }

  const severityWeight: Record<RealTimeAlert['severity'], number> = {
    critico: 0,
    aviso: 1,
    info: 2,
  };

  return alerts.sort((a, b) => severityWeight[a.severity] - severityWeight[b.severity]);
}
