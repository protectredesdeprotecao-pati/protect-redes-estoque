import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCheck,
  Clock,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { AlertCategory, AlertSeverity, RealTimeAlert } from '../../types/erp';
import { formatTimeAgo } from '../../utils/formatters';

export const AlertCenterDrawer: React.FC = () => {
  const {
    alertDrawerOpen,
    setAlertDrawerOpen,
    alerts,
    alertLogs,
    alertSettings,
    lastAlertScan,
    runAlertScan,
    dismissAlert,
    restoreDismissedAlerts,
    markAllAlertsRead,
    updateAlertSettings,
    setActivePage,
    setQuickRestockProductId,
  } = useStore();

  const [tab, setTab] = useState<'ativos' | 'historico' | 'regras'>('ativos');
  const [severityFilter, setSeverityFilter] = useState<'all' | AlertSeverity>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AlertCategory>('all');

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
      return true;
    });
  }, [alerts, categoryFilter, severityFilter]);

  const counts = useMemo(() => {
    return {
      critico: alerts.filter((a) => a.severity === 'critico').length,
      aviso: alerts.filter((a) => a.severity === 'aviso').length,
      info: alerts.filter((a) => a.severity === 'info').length,
    };
  }, [alerts]);

  if (!alertDrawerOpen) return null;

  const handleResolveAction = (alert: RealTimeAlert) => {
    if (alert.actionType === 'restock') {
      setQuickRestockProductId(alert.referenciaId);
      setActivePage('entradas');
    } else {
      setActivePage(alert.targetPage);
    }
    setAlertDrawerOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-[1px]"
        onClick={() => setAlertDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Central de Alertas em Tempo Real"
        className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-[#E2E8F0] bg-[#F8FAFC] shadow-2xl dark:border-[#1E293B] dark:bg-[#0B1115]"
      >
        {/* Header */}
        <div className="border-b border-[#E2E8F0] bg-[#0D151A] px-6 py-4 text-white dark:border-[#1E293B] dark:bg-[#090E12]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#34D399]" />
                <h3 className="font-display text-base font-semibold">
                  Central de Alertas em Tempo Real
                </h3>
              </div>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Última verificação: {formatTimeAgo(lastAlertScan)} · {alerts.length} alerta(s) ativo(s)
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => runAlertScan(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/15"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Verificar
              </button>
              <button
                type="button"
                onClick={() => setAlertDrawerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] hover:bg-white/10 hover:text-white"
                aria-label="Fechar central de alertas"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Summary bar */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[11px] text-[#94A3B8]">Críticos</div>
              <div className="font-display text-lg font-bold tabular-nums text-[#FCA5A5]">
                {counts.critico}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[11px] text-[#94A3B8]">Avisos</div>
              <div className="font-display text-lg font-bold tabular-nums text-[#FCD34D]">
                {counts.aviso}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="text-[11px] text-[#94A3B8]">Informativos</div>
              <div className="font-display text-lg font-bold tabular-nums text-[#34D399]">
                {counts.info}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-white px-6 py-2.5 dark:border-[#1E293B] dark:bg-[#111820]">
          <div className="flex items-center gap-1 rounded-lg bg-[#F1F5F9] p-1 dark:bg-[#0B1115]">
            <button
              type="button"
              onClick={() => setTab('ativos')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === 'ativos'
                  ? 'bg-white text-[#0F172A] shadow-xs dark:bg-[#1E293B] dark:text-[#F1F5F9]'
                  : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
              }`}
            >
              Ativos ({alerts.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('historico');
                markAllAlertsRead();
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === 'historico'
                  ? 'bg-white text-[#0F172A] shadow-xs dark:bg-[#1E293B] dark:text-[#F1F5F9]'
                  : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
              }`}
            >
              Eventos ({alertLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('regras')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === 'regras'
                  ? 'bg-white text-[#0F172A] shadow-xs dark:bg-[#1E293B] dark:text-[#F1F5F9]'
                  : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
              }`}
            >
              <SlidersHorizontal className="h-3 w-3" />
              Regras
            </button>
          </div>

          {tab === 'ativos' && (
            <button
              type="button"
              onClick={restoreDismissedAlerts}
              className="text-xs font-medium text-[#10B981] hover:underline"
            >
              Restaurar ocultos
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'ativos' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value as 'all' | AlertSeverity)}
                  className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                >
                  <option value="all">Todas severidades</option>
                  <option value="critico">Somente Críticos</option>
                  <option value="aviso">Somente Avisos</option>
                  <option value="info">Informativos</option>
                </select>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as 'all' | AlertCategory)}
                  className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                >
                  <option value="all">Todas áreas</option>
                  <option value="estoque">Estoque</option>
                  <option value="financeiro">Financeiro / Duplicatas</option>
                  <option value="fiscal">Fiscal / NF-e</option>
                  <option value="operacional">Vendas Fiado</option>
                </select>
              </div>

              {filteredAlerts.length === 0 ? (
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-10 text-center dark:border-[#1E293B] dark:bg-[#111820]">
                  <CheckCheck className="mx-auto h-8 w-8 text-[#10B981]" />
                  <h4 className="mt-3 font-display text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                    Operação sob controle
                  </h4>
                  <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Nenhum alerta ativo para os filtros selecionados.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredAlerts.map((alert) => {
                    const isCrit = alert.severity === 'critico';
                    const isWarn = alert.severity === 'aviso';
                    const badgeClass = isCrit
                      ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA] dark:bg-[#EF4444]/15 dark:text-[#FCA5A5] dark:border-[#EF4444]/30'
                      : isWarn
                        ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A] dark:bg-[#F59E0B]/15 dark:text-[#FCD34D] dark:border-[#F59E0B]/30'
                        : 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0] dark:bg-[#10B981]/15 dark:text-[#34D399] dark:border-[#10B981]/30';
                    const Icon = isCrit ? ShieldAlert : AlertTriangle;

                    return (
                      <div
                        key={alert.id}
                        className="rounded-xl border border-[#E2E8F0] bg-white p-4 transition-colors hover:border-[#CBD5E1] dark:border-[#1E293B] dark:bg-[#111820] dark:hover:border-[#334155]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div
                              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${badgeClass}`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
                                <span
                                  className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${badgeClass}`}
                                >
                                  {isCrit ? 'Crítico' : isWarn ? 'Aviso' : 'Info'}
                                </span>
                                <span className="capitalize">{alert.category}</span>
                                <span aria-hidden="true">·</span>
                                <span>{formatTimeAgo(alert.timestamp)}</span>
                              </div>
                              <h4 className="mt-1 text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                                {alert.titulo}
                              </h4>
                              <p className="mt-0.5 text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                                {alert.mensagem}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => dismissAlert(alert.id)}
                            className="shrink-0 rounded p-1 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A] dark:hover:bg-[#1E293B] dark:hover:text-white"
                            title="Silenciar alerta"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-end gap-2 border-t border-[#F1F5F9] pt-2.5 dark:border-[#1E293B]">
                          <button
                            type="button"
                            onClick={() => handleResolveAction(alert)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-3 py-1.5 text-xs font-semibold text-[#052E16] transition-colors hover:bg-[#34D399]"
                          >
                            {alert.actionLabel}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'historico' && (
            <div className="space-y-2.5">
              {alertLogs.length === 0 ? (
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-10 text-center text-xs text-[#64748B] dark:border-[#1E293B] dark:bg-[#111820] dark:text-[#94A3B8]">
                  Nenhum evento registrado nesta sessão.
                </div>
              ) : (
                alertLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 rounded-xl border border-[#E2E8F0] bg-white p-3.5 dark:border-[#1E293B] dark:bg-[#111820]"
                  >
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#64748B] dark:text-[#94A3B8]" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                          {log.titulo}
                        </span>
                        <span className="font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                          {formatTimeAgo(log.timestamp)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">{log.mensagem}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'regras' && (
            <div className="space-y-4 rounded-xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
              <div>
                <h4 className="font-display text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                  Parâmetros de Monitoramento Automático
                </h4>
                <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Ajuste os gatilhos que disparam alertas em tempo real no painel e no PDV.
                </p>
              </div>

              <div className="space-y-4 pt-2">
                <label className="flex items-center justify-between gap-4 border-b border-[#F1F5F9] pb-3 dark:border-[#1E293B]">
                  <div>
                    <div className="text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                      Notificações Toast em Tempo Real
                    </div>
                    <div className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      Exibir aviso imediato quando uma venda ou saída cruzar o estoque mínimo.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={alertSettings.notificacoesEmTempoReal}
                    onChange={(e) =>
                      updateAlertSettings({ notificacoesEmTempoReal: e.target.checked })
                    }
                    className="h-4 w-4 accent-[#10B981]"
                  />
                </label>

                <label className="flex items-center justify-between gap-4 border-b border-[#F1F5F9] pb-3 dark:border-[#1E293B]">
                  <div>
                    <div className="text-sm font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                      Varredura Contínua em Segundo Plano
                    </div>
                    <div className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                      Reavaliar prazos de duplicatas e saldos automaticamente a cada 30s.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={alertSettings.monitoramentoAutomatico}
                    onChange={(e) =>
                      updateAlertSettings({ monitoramentoAutomatico: e.target.checked })
                    }
                    className="h-4 w-4 accent-[#10B981]"
                  />
                </label>

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#CBD5E1]">
                    Antecedência de aviso para duplicatas (dias)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={alertSettings.diasAvisoDuplicata}
                    onChange={(e) =>
                      updateAlertSettings({
                        diasAvisoDuplicata: Math.max(1, Number(e.target.value) || 3),
                      })
                    }
                    className="mt-1.5 w-32 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#CBD5E1]">
                    Zona preventiva de estoque (% acima do mínimo)
                  </label>
                  <input
                    type="number"
                    min={100}
                    max={250}
                    step={5}
                    value={alertSettings.percentualPreventivoEstoque}
                    onChange={(e) =>
                      updateAlertSettings({
                        percentualPreventivoEstoque: Math.max(100, Number(e.target.value) || 125),
                      })
                    }
                    className="mt-1.5 w-32 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                  />
                  <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Ex.: 125% alerta preventivamente quando o saldo atingir 1,25× o mínimo.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] dark:text-[#CBD5E1]">
                    Dias para alertar vendas Fiado em aberto
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={alertSettings.diasAlertaFiado}
                    onChange={(e) =>
                      updateAlertSettings({
                        diasAlertaFiado: Math.max(1, Number(e.target.value) || 5),
                      })
                    }
                    className="mt-1.5 w-32 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
