import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  CategoryStockChart,
  MiniSparkline,
  PaymentMixChart,
  RevenueVsCostChart,
  TopMovedProductsChart,
} from '../charts/AnalyticsCharts';
import { formatBRL, formatDateBR, formatTimeAgo, offsetDaysISO } from '../../utils/formatters';

export const PainelPage: React.FC = () => {
  const {
    products,
    sales,
    obras,
    duplicatas,
    alerts,
    lastAlertScan,
    runAlertScan,
    setAlertDrawerOpen,
    setActivePage,
    setQuickRestockProductId,
  } = useStore();

  const kpis = useMemo(() => {
    const stockCostValue = products.reduce((sum, p) => sum + p.saldo * p.custo, 0);
    const stockRetailValue = products.reduce((sum, p) => sum + p.saldo * p.venda, 0);

    const activeSales = sales.filter((s) => s.status === 'concluida');
    const totalSalesValue = activeSales.reduce((sum, s) => sum + s.total, 0);

    const lowOrZero = products.filter((p) => p.saldo <= p.minimo).length;
    const zeroCount = products.filter((p) => p.saldo <= 0).length;

    const pendingDups = duplicatas.filter((d) => d.status === 'pendente');
    const pendingDupTotal = pendingDups.reduce((sum, d) => sum + d.valor, 0);

    // 7-day sales sparkline
    const salesSeries: number[] = [];
    const equipesSeries: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const iso = offsetDaysISO(-i);
      const daySales = activeSales
        .filter((s) => s.data.slice(0, 10) === iso)
        .reduce((acc, s) => acc + s.total, 0);
      const dayEq = obras
        .filter((o) => o.data.slice(0, 10) === iso)
        .reduce((acc, o) => acc + o.custoTotal, 0);
      salesSeries.push(daySales);
      equipesSeries.push(dayEq);
    }

    const totalEquipesValue = obras.reduce((sum, o) => sum + o.custoTotal, 0);

    return {
      stockCostValue,
      stockRetailValue,
      totalSalesValue,
      salesCount: activeSales.length,
      lowOrZero,
      zeroCount,
      pendingDupTotal,
      pendingDupCount: pendingDups.length,
      salesSeries,
      equipesSeries,
      totalEquipesValue,
    };
  }, [duplicatas, obras, products, sales]);

  const recentSales = useMemo(() => sales.slice(0, 6), [sales]);
  const topAlerts = useMemo(() => alerts.slice(0, 4), [alerts]);

  return (
    <div className="space-y-6">
      {/* Executive KPI Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                Valor em Estoque (Custo)
              </div>
              <div className="mt-2 font-display text-2xl font-bold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                {formatBRL(kpis.stockCostValue)}
              </div>
            </div>
            <MiniSparkline
              values={products.slice(0, 7).map((p) => p.saldo * p.custo)}
              color="#10B981"
            />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#F1F5F9] pt-2.5 text-xs text-[#64748B] dark:border-[#1E293B] dark:text-[#94A3B8]">
            <span>Potencial venda</span>
            <strong className="font-semibold tabular-nums text-[#0F172A] dark:text-[#34D399]">
              {formatBRL(kpis.stockRetailValue)}
            </strong>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                Faturamento PDV
              </div>
              <div className="mt-2 font-display text-2xl font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
                {formatBRL(kpis.totalSalesValue)}
              </div>
            </div>
            <MiniSparkline values={kpis.salesSeries} color="#10B981" />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#F1F5F9] pt-2.5 text-xs text-[#64748B] dark:border-[#1E293B] dark:text-[#94A3B8]">
            <span>Vendas concluídas</span>
            <strong className="font-semibold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
              {kpis.salesCount} pedido(s)
            </strong>
          </div>
        </div>

        <div
          className={`flex flex-col justify-between rounded-2xl border p-5 ${
            kpis.lowOrZero > 0
              ? 'border-[#FECACA] bg-[#FFFDFD] dark:border-[#EF4444]/35 dark:bg-[#181216]'
              : 'border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                Itens Abaixo do Mínimo
              </div>
              <div
                className={`mt-2 font-display text-2xl font-bold tabular-nums ${
                  kpis.lowOrZero > 0
                    ? 'text-[#DC2626] dark:text-[#F87171]'
                    : 'text-[#059669] dark:text-[#34D399]'
                }`}
              >
                {kpis.lowOrZero}
              </div>
            </div>
            <MiniSparkline values={kpis.equipesSeries} color="#F59E0B" />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#F1F5F9] pt-2.5 text-xs text-[#64748B] dark:border-[#1E293B] dark:text-[#94A3B8]">
            <span>{kpis.zeroCount} esgotado(s)</span>
            <strong className="font-semibold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
              {products.length} cadastrados
            </strong>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                Duplicatas a Pagar
              </div>
              <div className="mt-2 font-display text-2xl font-bold tabular-nums text-[#D97706] dark:text-[#FBBF24]">
                {formatBRL(kpis.pendingDupTotal)}
              </div>
            </div>
            <MiniSparkline
              values={duplicatas.slice(0, 6).map((d) => d.valor)}
              color="#3B82F6"
            />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-[#F1F5F9] pt-2.5 text-xs text-[#64748B] dark:border-[#1E293B] dark:text-[#94A3B8]">
            <span>Títulos em aberto</span>
            <strong className="font-semibold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
              {kpis.pendingDupCount} título(s)
            </strong>
          </div>
        </div>
      </section>

      {/* Real-Time Alert Monitor Panel */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F1F5F9] px-5 py-4 dark:border-[#1E293B]">
          <div className="flex items-center gap-2.5">
            <BellRing
              className={`h-4 w-4 ${
                alerts.some((a) => a.severity === 'critico')
                  ? 'text-[#DC2626] dark:text-[#F87171]'
                  : 'text-[#10B981]'
              }`}
            />
            <div>
              <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                Alertas em Tempo Real
              </h3>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                Monitoramento contínuo de estoque mínimo, vencimentos e NF-e · Atualizado{' '}
                {formatTimeAgo(lastAlertScan)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => runAlertScan(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9] dark:hover:bg-[#1E293B]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Verificar agora
            </button>
            <button
              type="button"
              onClick={() => setAlertDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-3.5 py-1.5 text-xs font-semibold text-[#052E16] hover:bg-[#34D399]"
            >
              Central completa ({alerts.length})
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {topAlerts.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-6 text-sm text-[#059669] dark:text-[#34D399]">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>
              Nenhum alerta ativo no momento. Todos os estoques e títulos estão em dia.
            </span>
          </div>
        ) : (
          <div className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
            {topAlerts.map((alert) => {
              const isCrit = alert.severity === 'critico';
              const isWarn = alert.severity === 'aviso';
              const Icon = isCrit ? ShieldAlert : AlertTriangle;
              return (
                <div
                  key={alert.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-[#F8FAFC] dark:hover:bg-[#16202A]"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        isCrit
                          ? 'text-[#DC2626] dark:text-[#F87171]'
                          : isWarn
                            ? 'text-[#D97706] dark:text-[#FBBF24]'
                            : 'text-[#059669] dark:text-[#34D399]'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`rounded-md px-2 py-0.5 font-semibold ${
                            isCrit
                              ? 'bg-[#FEF2F2] text-[#DC2626] dark:bg-[#EF4444]/15 dark:text-[#FCA5A5]'
                              : isWarn
                                ? 'bg-[#FFFBEB] text-[#D97706] dark:bg-[#F59E0B]/15 dark:text-[#FCD34D]'
                                : 'bg-[#ECFDF5] text-[#059669] dark:bg-[#10B981]/15 dark:text-[#34D399]'
                          }`}
                        >
                          {isCrit ? 'Crítico' : isWarn ? 'Aviso' : 'Info'}
                        </span>
                        <span className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                          {alert.titulo}
                        </span>
                        <span className="text-[#94A3B8]" aria-hidden="true">
                          ·
                        </span>
                        <span className="capitalize text-[#64748B] dark:text-[#94A3B8]">
                          {alert.category}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                        {alert.mensagem}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (alert.actionType === 'restock') {
                        setQuickRestockProductId(alert.referenciaId);
                        setActivePage('entradas');
                      } else {
                        setActivePage(alert.targetPage);
                      }
                    }}
                    className="shrink-0 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:border-[#10B981] hover:bg-[#ECFDF5] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9] dark:hover:border-[#10B981] dark:hover:bg-[#10B981]/15"
                  >
                    {alert.actionLabel}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Visual Analytical Panels */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueVsCostChart sales={sales} obras={obras} />
        </div>
        <div>
          <CategoryStockChart products={products} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TopMovedProductsChart products={products} sales={sales} obras={obras} />
        <PaymentMixChart sales={sales} />
      </section>

      {/* Recent Sales */}
      <section className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]">
        <div className="flex items-center justify-between border-b border-[#F1F5F9] px-5 py-4 dark:border-[#1E293B]">
          <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            Últimas Vendas
          </h3>
          <button
            type="button"
            onClick={() => setActivePage('vendas')}
            className="text-xs font-semibold text-[#10B981] hover:underline"
          >
            Ver histórico completo
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B] dark:border-[#1E293B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
              <tr>
                <th className="px-5 py-3">Nº</th>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Pagamento</th>
                <th className="px-5 py-3 text-right">Valor</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
              {recentSales.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Nenhuma venda registrada ainda.
                  </td>
                </tr>
              ) : (
                recentSales.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#16202A]">
                    <td className="px-5 py-3 text-xs font-semibold tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                      #{s.numero}
                    </td>
                    <td className="px-5 py-3 text-xs tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                      {formatDateBR(s.data)}
                    </td>
                    <td className="px-5 py-3 font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                      {s.clienteNome}
                    </td>
                    <td className="px-5 py-3 text-xs uppercase text-[#64748B] dark:text-[#94A3B8]">
                      {s.formaPagamento}
                    </td>
                    <td className="px-5 py-3 text-right font-display text-sm font-bold tabular-nums text-[#0F172A] dark:text-[#34D399]">
                      {formatBRL(s.total)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${
                          s.status === 'cancelada'
                            ? 'bg-[#FEF2F2] text-[#DC2626] dark:bg-[#EF4444]/15 dark:text-[#FCA5A5]'
                            : s.formaPagamento === 'fiado' && !s.fiadoPago
                              ? 'bg-[#FFFBEB] text-[#D97706] dark:bg-[#F59E0B]/15 dark:text-[#FCD34D]'
                              : 'bg-[#ECFDF5] text-[#059669] dark:bg-[#10B981]/15 dark:text-[#34D399]'
                        }`}
                      >
                        {s.status === 'cancelada'
                          ? 'Cancelada'
                          : s.formaPagamento === 'fiado' && !s.fiadoPago
                            ? 'Fiado aberto'
                            : 'Concluída'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
