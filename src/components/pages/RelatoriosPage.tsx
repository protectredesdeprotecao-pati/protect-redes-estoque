import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  CategoryStockChart,
  MiniSparkline,
  PaymentMixChart,
  RevenueVsCostChart,
  TopMovedProductsChart,
} from '../charts/AnalyticsCharts';
import { exportToCSV, formatBRL, offsetDaysISO, todayISO } from '../../utils/formatters';
import { ProductImage } from '../ui/ProductImage';

export const RelatoriosPage: React.FC = () => {
  const { products, sales, obras } = useStore();

  const analytics = useMemo(() => {
    const activeSales = sales.filter((s) => s.status === 'concluida');
    const receitaBruta = activeSales.reduce((s, v) => s + v.total, 0);
    const cmvLoja = activeSales.reduce(
      (s, v) => s + v.itens.reduce((acc, it) => acc + it.custoUnitario * it.quantidade, 0),
      0
    );
    const lucroBrutoLoja = receitaBruta - cmvLoja;
    const margemMedia = receitaBruta > 0 ? (lucroBrutoLoja / receitaBruta) * 100 : 0;
    const custoEquipes = obras.reduce((s, o) => s + o.custoTotal, 0);

    const sales7d: number[] = [];
    const equipes7d: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const iso = offsetDaysISO(-i);
      sales7d.push(
        activeSales.filter((s) => s.data.slice(0, 10) === iso).reduce((a, s) => a + s.total, 0)
      );
      equipes7d.push(
        obras.filter((o) => o.data.slice(0, 10) === iso).reduce((a, o) => a + o.custoTotal, 0)
      );
    }

    const sortedProducts = [...products]
      .map((p) => ({
        ...p,
        valorEstoque: p.saldo * p.custo,
      }))
      .sort((a, b) => b.valorEstoque - a.valorEstoque);

    const totalValor = sortedProducts.reduce((s, p) => s + p.valorEstoque, 0);
    let cumulative = 0;
    const abc = sortedProducts.map((p) => {
      cumulative += p.valorEstoque;
      const pctAcum = totalValor > 0 ? (cumulative / totalValor) * 100 : 100;
      const classe: 'A' | 'B' | 'C' = pctAcum <= 80 ? 'A' : pctAcum <= 95 ? 'B' : 'C';
      return { ...p, pctAcum, classe };
    });

    return {
      receitaBruta,
      cmvLoja,
      lucroBrutoLoja,
      margemMedia,
      custoEquipes,
      sales7d,
      equipes7d,
      abc,
    };
  }, [obras, products, sales]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
          <div>
            <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
              Receita Bruta (Loja)
            </div>
            <div className="mt-2 font-display text-2xl font-bold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
              {formatBRL(analytics.receitaBruta)}
            </div>
          </div>
          <MiniSparkline values={analytics.sales7d} color="#10B981" />
        </div>

        <div className="flex items-start justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
          <div>
            <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
              Lucro Bruto Estimado (PDV)
            </div>
            <div className="mt-2 font-display text-2xl font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
              {formatBRL(analytics.lucroBrutoLoja)}
            </div>
            <div className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
              Margem média:{' '}
              <strong className="font-semibold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                {analytics.margemMedia.toFixed(1)}%
              </strong>
            </div>
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
          <div>
            <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
              CMV das Vendas
            </div>
            <div className="mt-2 font-display text-2xl font-bold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
              {formatBRL(analytics.cmvLoja)}
            </div>
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
          <div>
            <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
              Material Aplicado (Equipes)
            </div>
            <div className="mt-2 font-display text-2xl font-bold tabular-nums text-[#D97706] dark:text-[#FBBF24]">
              {formatBRL(analytics.custoEquipes)}
            </div>
          </div>
          <MiniSparkline values={analytics.equipes7d} color="#F59E0B" />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <RevenueVsCostChart sales={sales} obras={obras} />
        <TopMovedProductsChart products={products} sales={sales} obras={obras} />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <CategoryStockChart products={products} />
        <PaymentMixChart sales={sales} />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F1F5F9] px-5 py-4 dark:border-[#1E293B]">
          <div>
            <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
              Curva ABC de Valor em Estoque
            </h3>
            <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
              Classe A concentra até 80% do capital imobilizado · Classe B até 95% · Classe C demais itens
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              exportToCSV(
                `curva-abc-protect-rede-estoque-${todayISO()}.csv`,
                ['Classe', 'Código', 'Produto', 'Saldo', 'Custo Unit.', 'Valor Total', '% Acumulado'],
                analytics.abc.map((p) => [
                  p.classe,
                  p.codigo,
                  p.nome,
                  p.saldo,
                  p.custo.toFixed(2),
                  p.valorEstoque.toFixed(2),
                  `${p.pctAcum.toFixed(1)}%`,
                ])
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9] dark:hover:bg-[#1E293B]"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar Curva ABC (CSV)
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B] dark:border-[#1E293B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
              <tr>
                <th className="px-5 py-2.5">Classe</th>
                <th className="px-3 py-2.5">Foto</th>
                <th className="px-5 py-2.5">Produto</th>
                <th className="px-5 py-2.5 text-right">Saldo</th>
                <th className="px-5 py-2.5 text-right">Valor em Estoque</th>
                <th className="px-5 py-2.5 text-right">% Acumulado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
              {analytics.abc.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Nenhum produto cadastrado para análise da Curva ABC.
                  </td>
                </tr>
              ) : (
                analytics.abc.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#16202A]">
                    <td className="px-5 py-2.5">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 font-display text-xs font-bold ${
                          p.classe === 'A'
                            ? 'bg-[#ECFDF5] text-[#059669] dark:bg-[#10B981]/15 dark:text-[#34D399]'
                            : p.classe === 'B'
                              ? 'bg-[#FFFBEB] text-[#D97706] dark:bg-[#F59E0B]/15 dark:text-[#FCD34D]'
                              : 'bg-[#F1F5F9] text-[#64748B] dark:bg-[#1E293B] dark:text-[#94A3B8]'
                        }`}
                      >
                        {p.classe}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <ProductImage src={p.imagem} alt={p.nome} sizeClass="h-9 w-9" />
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">{p.nome}</div>
                      <div className="text-xs text-[#64748B] dark:text-[#94A3B8]">{p.codigo}</div>
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs font-semibold tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                      {p.saldo} {p.unidade}
                    </td>
                    <td className="px-5 py-2.5 text-right font-display font-bold tabular-nums text-[#0F172A] dark:text-[#34D399]">
                      {formatBRL(p.valorEstoque)}
                    </td>
                    <td className="px-5 py-2.5 text-right text-xs font-semibold tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                      {p.pctAcum.toFixed(1)}%
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
