import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Sale } from '../../types/erp';
import { daysDiffFromToday, formatBRL, formatDateBR } from '../../utils/formatters';
import { SlideOver } from '../ui/SlideOver';

export const FiadoPage: React.FC = () => {
  const { sales, settleFiadoSale } = useStore();
  const [filter, setFilter] = useState<'abertos' | 'quitados' | 'todos'>('abertos');
  const [settleTarget, setSettleTarget] = useState<Sale | null>(null);
  const [forma, setForma] = useState<'pix' | 'dinheiro' | 'credito' | 'debito'>('pix');

  const fiadoSales = useMemo(
    () => sales.filter((s) => s.status === 'concluida' && s.formaPagamento === 'fiado'),
    [sales]
  );

  const kpis = useMemo(() => {
    const abertos = fiadoSales.filter((s) => !s.fiadoPago);
    const quitados = fiadoSales.filter((s) => s.fiadoPago);
    return {
      abertoValor: abertos.reduce((sum, s) => sum + s.total, 0),
      abertoCount: abertos.length,
      quitadoValor: quitados.reduce((sum, s) => sum + s.total, 0),
    };
  }, [fiadoSales]);

  const filtered = useMemo(() => {
    if (filter === 'abertos') return fiadoSales.filter((s) => !s.fiadoPago);
    if (filter === 'quitados') return fiadoSales.filter((s) => s.fiadoPago);
    return fiadoSales;
  }, [fiadoSales, filter]);

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleTarget) return;
    settleFiadoSale(settleTarget.id, forma);
    setSettleTarget(null);
  };

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
          <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
            Total a Receber (Fiado)
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#D97706] dark:text-[#FBBF24]">
            {formatBRL(kpis.abertoValor)}
          </div>
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
          <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
            Vendas em Aberto
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
            {kpis.abertoCount}
          </div>
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
          <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">Já Recebidos</div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
            {formatBRL(kpis.quitadoValor)}
          </div>
        </div>
      </section>

      <div className="flex w-fit items-center gap-1 rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-1 dark:border-[#1E293B] dark:bg-[#111820]">
        {(
          [
            { id: 'abertos', label: 'Em Aberto' },
            { id: 'quitados', label: 'Quitados' },
            { id: 'todos', label: 'Todos' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilter(t.id)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filter === t.id
                ? 'bg-white text-[#0F172A] shadow-xs dark:bg-[#1E293B] dark:text-[#F1F5F9]'
                : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B] dark:border-[#1E293B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
              <tr>
                <th className="px-5 py-3">Venda</th>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Idade</th>
                <th className="px-5 py-3 text-right">Valor</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
                    Nenhuma venda fiado nesta visualização.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const age = Math.abs(daysDiffFromToday(s.data));
                  return (
                    <tr key={s.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#16202A]">
                      <td className="px-5 py-3 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                        #{s.numero}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                        {formatDateBR(s.data)}
                      </td>
                      <td className="px-5 py-3 font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                        {s.clienteNome}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                        {s.fiadoPago ? '—' : `${age} dia(s)`}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums text-[#059669] dark:text-[#34D399]">
                        {formatBRL(s.total)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                            s.fiadoPago
                              ? 'bg-[#ECFDF5] text-[#059669] dark:bg-[#10B981]/15 dark:text-[#34D399]'
                              : 'bg-[#FFFBEB] text-[#D97706] dark:bg-[#F59E0B]/15 dark:text-[#FCD34D]'
                          }`}
                        >
                          {s.fiadoPago
                            ? `Recebido (${formatDateBR(s.fiadoPagoEm || '')})`
                            : 'Em aberto'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {!s.fiadoPago && (
                          <button
                            type="button"
                            onClick={() => setSettleTarget(s)}
                            className="inline-flex items-center gap-1 rounded-md bg-[#10B981] px-3 py-1 text-xs font-semibold text-[#052E16] hover:bg-[#34D399]"
                          >
                            <Check className="h-3 w-3" />
                            Receber
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SlideOver
        open={Boolean(settleTarget)}
        onClose={() => setSettleTarget(null)}
        title="Receber Venda Fiado"
        subtitle={
          settleTarget
            ? `${settleTarget.clienteNome} · ${formatBRL(settleTarget.total)}`
            : undefined
        }
        widthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setSettleTarget(null)}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B] dark:border-[#263442] dark:text-[#CBD5E1]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-fiado"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#052E16] hover:bg-[#34D399]"
            >
              Confirmar Recebimento
            </button>
          </>
        }
      >
        <form id="form-fiado" onSubmit={handleConfirm} className="space-y-4">
          <p className="text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
            Ao confirmar, o valor será creditado automaticamente nas entradas do Caixa.
          </p>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Forma de Recebimento
            </label>
            <select
              value={forma}
              onChange={(e) =>
                setForma(e.target.value as 'pix' | 'dinheiro' | 'credito' | 'debito')
              }
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            >
              <option value="pix">PIX</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="credito">Cartão de Crédito</option>
              <option value="debito">Cartão de Débito</option>
            </select>
          </div>
        </form>
      </SlideOver>
    </div>
  );
};
