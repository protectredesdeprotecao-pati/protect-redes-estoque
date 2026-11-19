import React, { useMemo, useState } from 'react';
import { Check, Plus, Search, Trash2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Duplicata } from '../../types/erp';
import { daysDiffFromToday, formatBRL, formatDateBR, todayISO } from '../../utils/formatters';
import { SlideOver } from '../ui/SlideOver';

export const DuplicatasPage: React.FC = () => {
  const { duplicatas, suppliers, saveDuplicata, payDuplicata, deleteDuplicata } = useStore();

  const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'vencida' | 'paga'>('all');
  const [query, setQuery] = useState('');

  const [newOpen, setNewOpen] = useState(false);
  const [fornecedorId, setFornecedorId] = useState(suppliers[0]?.id ?? '');
  const [nf, setNf] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState(todayISO());
  const [descricao, setDescricao] = useState('');
  const [forma, setForma] = useState<Duplicata['formaPagamento']>('boleto');

  const [payTarget, setPayTarget] = useState<Duplicata | null>(null);
  const [payDate, setPayDate] = useState(todayISO());
  const [payForma, setPayForma] = useState<Duplicata['formaPagamento']>('boleto');

  const kpis = useMemo(() => {
    let emAberto = 0;
    let vencidas = 0;
    let vencidasCount = 0;
    let pagas = 0;
    for (const d of duplicatas) {
      if (d.status === 'paga') {
        pagas += d.valor;
      } else {
        emAberto += d.valor;
        if (daysDiffFromToday(d.vencimento) < 0) {
          vencidas += d.valor;
          vencidasCount += 1;
        }
      }
    }
    return { emAberto, vencidas, vencidasCount, pagas };
  }, [duplicatas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return duplicatas.filter((d) => {
      const diff = daysDiffFromToday(d.vencimento);
      const isOverdue = d.status === 'pendente' && diff < 0;
      if (statusFilter === 'pendente' && d.status !== 'pendente') return false;
      if (statusFilter === 'vencida' && !isOverdue) return false;
      if (statusFilter === 'paga' && d.status !== 'paga') return false;
      if (!q) return true;
      return (
        d.fornecedorNome.toLowerCase().includes(q) ||
        d.nf.toLowerCase().includes(q) ||
        d.descricao.toLowerCase().includes(q)
      );
    });
  }, [duplicatas, query, statusFilter]);

  const handleSaveNew = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(valor) || 0;
    if (num <= 0) return;
    const forn = suppliers.find((s) => s.id === fornecedorId);
    saveDuplicata({
      fornecedorId: forn?.id,
      fornecedorNome: forn?.nome ?? 'Fornecedor Diverso',
      nf: nf.trim(),
      descricao: descricao.trim() || `NF ${nf.trim() || 'Avulsa'}`,
      valor: num,
      vencimento,
      formaPagamento: forma,
    });
    setNewOpen(false);
    setNf('');
    setValor('');
    setDescricao('');
  };

  const handleConfirmPay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    payDuplicata(payTarget.id, payDate, payForma);
    setPayTarget(null);
  };

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
          <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
            Total a Pagar
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
            {formatBRL(kpis.emAberto)}
          </div>
        </div>
        <div
          className={`rounded-2xl border p-5 ${
            kpis.vencidasCount > 0
              ? 'border-[#FECACA] bg-[#FFFDFD] dark:border-[#EF4444]/35 dark:bg-[#181216]'
              : 'border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]'
          }`}
        >
          <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
            Vencidas ({kpis.vencidasCount})
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#DC2626] dark:text-[#F87171]">
            {formatBRL(kpis.vencidas)}
          </div>
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
          <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">Total Pago</div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
            {formatBRL(kpis.pagas)}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 dark:border-[#1E293B] dark:bg-[#111820]">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar fornecedor ou NF..."
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 pr-3 pl-9 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-1 dark:border-[#1E293B] dark:bg-[#0B1115]">
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'pendente', label: 'Pendentes' },
                { id: 'vencida', label: 'Vencidas' },
                { id: 'paga', label: 'Pagas' },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatusFilter(s.id)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === s.id
                    ? 'bg-white text-[#0F172A] shadow-xs dark:bg-[#1E293B] dark:text-[#F1F5F9]'
                    : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#052E16] hover:bg-[#34D399]"
        >
          <Plus className="h-4 w-4" />
          Nova Duplicata
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B] dark:border-[#1E293B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
              <tr>
                <th className="px-4 py-3">Fornecedor</th>
                <th className="px-4 py-3">NF</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
              {filtered.map((d) => {
                const diff = daysDiffFromToday(d.vencimento);
                const isOverdue = d.status === 'pendente' && diff < 0;
                const isToday = d.status === 'pendente' && diff === 0;

                return (
                  <tr key={d.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#16202A]">
                    <td className="px-4 py-3 font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                      {d.fornecedorNome}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                      {d.nf || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
                      {d.descricao}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                      {formatDateBR(d.vencimento)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                      {formatBRL(d.valor)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                          d.status === 'paga'
                            ? 'bg-[#ECFDF5] text-[#059669] dark:bg-[#10B981]/15 dark:text-[#34D399]'
                            : isOverdue
                              ? 'bg-[#FEF2F2] text-[#DC2626] dark:bg-[#EF4444]/15 dark:text-[#FCA5A5]'
                              : isToday
                                ? 'bg-[#FFFBEB] text-[#D97706] dark:bg-[#F59E0B]/15 dark:text-[#FCD34D]'
                                : 'bg-[#F1F5F9] text-[#64748B] dark:bg-[#1E293B] dark:text-[#94A3B8]'
                        }`}
                      >
                        {d.status === 'paga'
                          ? `Paga (${formatDateBR(d.dataPagamento || '')})`
                          : isOverdue
                            ? `Vencida (${Math.abs(diff)}d)`
                            : isToday
                              ? 'Vence hoje'
                              : `Em ${diff}d`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {d.status === 'pendente' && (
                          <button
                            type="button"
                            onClick={() => {
                              setPayTarget(d);
                              setPayForma(d.formaPagamento);
                              setPayDate(todayISO());
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-[#10B981] px-2.5 py-1 text-xs font-semibold text-[#052E16] hover:bg-[#34D399]"
                          >
                            <Check className="h-3 w-3" />
                            Pagar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteDuplicata(d.id)}
                          className="rounded p-1.5 text-[#64748B] hover:bg-[#FEF2F2] hover:text-[#DC2626] dark:text-[#94A3B8] dark:hover:bg-[#EF4444]/15 dark:hover:text-[#F87171]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <SlideOver
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Nova Duplicata a Pagar"
        footer={
          <>
            <button
              type="button"
              onClick={() => setNewOpen(false)}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B] dark:border-[#263442] dark:text-[#CBD5E1]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-dup"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#052E16] hover:bg-[#34D399]"
            >
              Salvar Duplicata
            </button>
          </>
        }
      >
        <form id="form-dup" onSubmit={handleSaveNew} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Fornecedor *
              </label>
              <select
                value={fornecedorId}
                onChange={(e) => setFornecedorId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Número NF
              </label>
              <input
                type="text"
                value={nf}
                onChange={(e) => setNf(e.target.value)}
                placeholder="00123"
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Valor (R$) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Vencimento *
              </label>
              <input
                required
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Descrição
            </label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Compra de redes — boleto 1/3"
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Forma de pagamento
            </label>
            <select
              value={forma}
              onChange={(e) => setForma(e.target.value as Duplicata['formaPagamento'])}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            >
              <option value="boleto">Boleto</option>
              <option value="pix">PIX</option>
              <option value="transferencia">Transferência</option>
              <option value="dinheiro">Dinheiro</option>
            </select>
          </div>
        </form>
      </SlideOver>

      <SlideOver
        open={Boolean(payTarget)}
        onClose={() => setPayTarget(null)}
        title="Registrar Pagamento"
        subtitle={
          payTarget
            ? `${payTarget.fornecedorNome} · ${formatBRL(payTarget.valor)}`
            : undefined
        }
        widthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPayTarget(null)}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B] dark:border-[#263442] dark:text-[#CBD5E1]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-pagar-dup"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#052E16] hover:bg-[#34D399]"
            >
              Confirmar Pago
            </button>
          </>
        }
      >
        <form id="form-pagar-dup" onSubmit={handleConfirmPay} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Data do Pagamento
            </label>
            <input
              required
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Forma de Pagamento
            </label>
            <select
              value={payForma}
              onChange={(e) => setPayForma(e.target.value as Duplicata['formaPagamento'])}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            >
              <option value="boleto">Boleto</option>
              <option value="pix">PIX</option>
              <option value="transferencia">Transferência</option>
              <option value="dinheiro">Dinheiro</option>
            </select>
          </div>
        </form>
      </SlideOver>
    </div>
  );
};
