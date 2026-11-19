import React, { useMemo, useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { exportToCSV, formatBRL, formatDateBR, todayISO } from '../../utils/formatters';
import { SlideOver } from '../ui/SlideOver';

export const CaixaPage: React.FC = () => {
  const { cash, addManualCashMovement } = useStore();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tipoFilter, setTipoFilter] = useState<'all' | 'entrada' | 'saida'>('all');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tipo, setTipo] = useState<'entrada' | 'saida'>('saida');
  const [descricao, setDescricao] = useState('');
  const [origem, setOrigem] = useState('');
  const [forma, setForma] = useState('dinheiro');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(todayISO());

  const filtered = useMemo(() => {
    return cash.filter((c) => {
      if (from && c.data < from) return false;
      if (to && c.data > to) return false;
      if (tipoFilter !== 'all' && c.tipo !== tipoFilter) return false;
      return true;
    });
  }, [cash, from, tipoFilter, to]);

  const totals = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    for (const c of filtered) {
      if (c.tipo === 'entrada') entradas += c.valor;
      else saidas += c.valor;
    }
    return { entradas, saidas, saldo: entradas - saidas };
  }, [filtered]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(valor) || 0;
    if (!descricao.trim() || num <= 0) return;
    addManualCashMovement({
      data,
      descricao: descricao.trim(),
      clienteOuOrigem: origem.trim() || 'Caixa Loja',
      formaPagamento: forma,
      tipo,
      valor: num,
    });
    setDrawerOpen(false);
    setDescricao('');
    setOrigem('');
    setValor('');
  };

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
          <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
            Total Entradas
          </div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
            {formatBRL(totals.entradas)}
          </div>
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
          <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">Total Saídas</div>
          <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#DC2626] dark:text-[#F87171]">
            {formatBRL(totals.saidas)}
          </div>
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
          <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
            Saldo do Período
          </div>
          <div
            className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
              totals.saldo >= 0
                ? 'text-[#0F172A] dark:text-[#F1F5F9]'
                : 'text-[#DC2626] dark:text-[#F87171]'
            }`}
          >
            {formatBRL(totals.saldo)}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 dark:border-[#1E293B] dark:bg-[#111820]">
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 font-mono text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 font-mono text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
          />
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value as 'all' | 'entrada' | 'saida')}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
          >
            <option value="all">Todos lançamentos</option>
            <option value="entrada">Somente Entradas</option>
            <option value="saida">Somente Saídas</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportToCSV(
                `caixa-protect-rede-estoque-${todayISO()}.csv`,
                ['Data', 'Descrição', 'Cliente/Origem', 'Pagamento', 'Tipo', 'Valor'],
                filtered.map((c) => [
                  c.data,
                  c.descricao,
                  c.clienteOuOrigem,
                  c.formaPagamento,
                  c.tipo,
                  c.valor.toFixed(2),
                ])
              )
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-3.5 py-2 text-xs font-semibold text-[#052E16] hover:bg-[#34D399]"
          >
            <Plus className="h-3.5 w-3.5" />
            Lançamento Manual
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B] dark:border-[#1E293B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
              <tr>
                <th className="px-5 py-3">Data</th>
                <th className="px-5 py-3">Descrição</th>
                <th className="px-5 py-3">Cliente / Origem</th>
                <th className="px-5 py-3">Forma</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#16202A]">
                  <td className="px-5 py-3 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {formatDateBR(c.data)}
                  </td>
                  <td className="px-5 py-3 font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                    {c.descricao}
                  </td>
                  <td className="px-5 py-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {c.clienteOuOrigem}
                  </td>
                  <td className="px-5 py-3 text-xs uppercase text-[#64748B] dark:text-[#94A3B8]">
                    {c.formaPagamento}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                        c.tipo === 'entrada'
                          ? 'bg-[#ECFDF5] text-[#059669] dark:bg-[#10B981]/15 dark:text-[#34D399]'
                          : 'bg-[#FEF2F2] text-[#DC2626] dark:bg-[#EF4444]/15 dark:text-[#FCA5A5]'
                      }`}
                    >
                      {c.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                    </span>
                  </td>
                  <td
                    className={`px-5 py-3 text-right font-mono font-semibold tabular-nums ${
                      c.tipo === 'entrada'
                        ? 'text-[#059669] dark:text-[#34D399]'
                        : 'text-[#DC2626] dark:text-[#F87171]'
                    }`}
                  >
                    {c.tipo === 'entrada' ? '+' : '-'} {formatBRL(c.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SlideOver
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Movimento Manual de Caixa"
        subtitle="Registre suprimento ou sangria diretamente no fluxo de caixa."
        footer={
          <>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#64748B] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#CBD5E1]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-caixa"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#052E16] hover:bg-[#34D399]"
            >
              Confirmar
            </button>
          </>
        }
      >
        <form id="form-caixa" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTipo('entrada')}
              className={`rounded-lg border py-2 text-xs font-semibold ${
                tipo === 'entrada'
                  ? 'border-[#10B981] bg-[#ECFDF5] text-[#059669] dark:bg-[#10B981]/15 dark:text-[#34D399]'
                  : 'border-[#E2E8F0] text-[#64748B] dark:border-[#263442] dark:text-[#94A3B8]'
              }`}
            >
              Suprimento (Entrada)
            </button>
            <button
              type="button"
              onClick={() => setTipo('saida')}
              className={`rounded-lg border py-2 text-xs font-semibold ${
                tipo === 'saida'
                  ? 'border-[#DC2626] bg-[#FEF2F2] text-[#DC2626] dark:border-[#EF4444] dark:bg-[#EF4444]/15 dark:text-[#FCA5A5]'
                  : 'border-[#E2E8F0] text-[#64748B] dark:border-[#263442] dark:text-[#94A3B8]'
              }`}
            >
              Sangria / Despesa (Saída)
            </button>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Descrição *
            </label>
            <input
              required
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Frete, Troco inicial, Almoço equipe..."
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
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
                Data
              </label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Origem / Destino
              </label>
              <input
                type="text"
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Pagamento
              </label>
              <select
                value={forma}
                onChange={(e) => setForma(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>
          </div>
        </form>
      </SlideOver>
    </div>
  );
};
