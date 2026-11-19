import React, { useMemo, useState } from 'react';
import { FileText, HardHat, Minus, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { ObraWithdrawalItem, Product } from '../../types/erp';
import { formatBRL, formatDateBR, todayISO } from '../../utils/formatters';
import { ProductImage } from '../ui/ProductImage';

export const ObraPage: React.FC = () => {
  const {
    products,
    categories,
    customers,
    obras,
    activeUser,
    registerObraWithdrawal,
    createNFSeFromObra,
    deleteObraWithdrawal,
    setActivePage,
  } = useStore();

  const [tab, setTab] = useState<'retirada' | 'historico'>('retirada');
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('');

  const [items, setItems] = useState<ObraWithdrawalItem[]>([]);
  const [destino, setDestino] = useState('');
  const [responsavel, setResponsavel] = useState(activeUser.nome.split(' ')[0]);
  const [data, setData] = useState(todayISO());
  const [observacao, setObservacao] = useState('');

  // Valor do serviço (para o cliente / NFS-e sem mostrar itens usados)
  const [clienteNome, setClienteNome] = useState('');
  const [clienteDoc, setClienteDoc] = useState('');
  const [valorServicoInput, setValorServicoInput] = useState('');
  const [formaCaixa, setFormaCaixa] = useState<'' | 'dinheiro' | 'pix' | 'credito' | 'debito'>('');
  const [gerarNfse, setGerarNfse] = useState(true);

  const [histQuery, setHistQuery] = useState('');

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (catFilter && p.categoria !== catFilter) return false;
      if (!q) return true;
      return p.nome.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
    });
  }, [catFilter, products, query]);

  const addItem = (p: Product) => {
    if (p.saldo <= 0) return;
    setItems((prev) => {
      const existing = prev.find((i) => i.produtoId === p.id);
      if (existing) {
        if (existing.quantidade >= p.saldo) return prev;
        return prev.map((i) =>
          i.produtoId === p.id ? { ...i, quantidade: i.quantidade + 1 } : i
        );
      }
      return [
        ...prev,
        {
          produtoId: p.id,
          codigo: p.codigo,
          nome: p.nome,
          unidade: p.unidade,
          quantidade: 1,
          custoUnitario: p.custo,
        },
      ];
    });
  };

  const updateQty = (produtoId: string, delta: number) => {
    const max = products.find((p) => p.id === produtoId)?.saldo ?? 9999;
    setItems((prev) =>
      prev
        .map((it) =>
          it.produtoId === produtoId
            ? { ...it, quantidade: Math.min(max, it.quantidade + delta) }
            : it
        )
        .filter((it) => it.quantidade > 0)
    );
  };

  const totalCost = items.reduce((s, i) => s + i.custoUnitario * i.quantidade, 0);
  const valorServicoNum = parseFloat(valorServicoInput) || 0;
  const lucroEstimado = valorServicoNum > 0 ? valorServicoNum - totalCost : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || !destino.trim()) return;
    const res = registerObraWithdrawal({
      destino,
      responsavel,
      data,
      observacao,
      itens: items,
      clienteNome: clienteNome.trim() || undefined,
      clienteDoc: clienteDoc.trim() || undefined,
      valorServico: valorServicoNum > 0 ? valorServicoNum : undefined,
      formaRecebimentoCaixa: valorServicoNum > 0 ? formaCaixa : '',
      gerarNfse: Boolean(gerarNfse && valorServicoNum > 0 && clienteNome.trim()),
    });
    if (res) {
      setItems([]);
      setDestino('');
      setObservacao('');
      setClienteNome('');
      setClienteDoc('');
      setValorServicoInput('');
      setFormaCaixa('');
      if (res.nfse) {
        setActivePage('nfe');
      }
    }
  };

  const filteredHistory = useMemo(() => {
    const q = histQuery.trim().toLowerCase();
    if (!q) return obras;
    return obras.filter(
      (o) =>
        o.destino.toLowerCase().includes(q) ||
        (o.clienteNome ?? '').toLowerCase().includes(q) ||
        o.responsavel.toLowerCase().includes(q) ||
        o.itens.some((i) => i.nome.toLowerCase().includes(q))
    );
  }, [histQuery, obras]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-fit items-center gap-1 rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-1 dark:border-[#1E293B] dark:bg-[#111820]">
          <button
            type="button"
            onClick={() => setTab('retirada')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'retirada'
                ? 'bg-white text-[#0F172A] shadow-xs dark:bg-[#1E293B] dark:text-[#F1F5F9]'
                : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
            }`}
          >
            Retirada para Equipes
          </button>
          <button
            type="button"
            onClick={() => setTab('historico')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'historico'
                ? 'bg-white text-[#0F172A] shadow-xs dark:bg-[#1E293B] dark:text-[#F1F5F9]'
                : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
            }`}
          >
            Histórico de Equipes ({obras.length})
          </button>
        </div>

        <div className="text-xs text-[#64748B] dark:text-[#94A3B8]">
          Materiais baixam pelo <strong className="text-[#0F172A] dark:text-[#F1F5F9]">custo interno</strong> · Na NFS-e vai só o <strong className="text-[#10B981]">valor do serviço</strong>
        </div>
      </div>

      {tab === 'retirada' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-[#E2E8F0] bg-white p-3.5 dark:border-[#1E293B] dark:bg-[#111820]">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar material para equipe de instalação..."
                  className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 pr-3 pl-10 text-sm text-[#0F172A] placeholder-[#94A3B8] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                />
              </div>
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              >
                <option value="">Todas categorias</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="rounded-2xl border border-[#E2E8F0] bg-white px-6 py-12 text-center text-xs text-[#64748B] dark:border-[#1E293B] dark:bg-[#111820] dark:text-[#94A3B8]">
                Nenhum produto disponível no estoque. Cadastre itens na aba{' '}
                <strong className="text-[#0F172A] dark:text-[#F1F5F9]">Produtos</strong> ou dê entrada em{' '}
                <strong className="text-[#0F172A] dark:text-[#F1F5F9]">Entrada Material</strong>.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
                {filteredProducts.map((p) => {
                  const out = p.saldo <= 0;
                  const inList = items.find((i) => i.produtoId === p.id)?.quantidade ?? 0;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={out}
                      onClick={() => addItem(p)}
                      className={`group flex flex-col overflow-hidden rounded-2xl border text-left transition-all ${
                        out
                          ? 'cursor-not-allowed border-[#E2E8F0] bg-[#F8FAFC] opacity-55 dark:border-[#1E293B] dark:bg-[#0D151A]'
                          : inList > 0
                            ? 'border-[#F59E0B] bg-[#FFFBEB]/40 dark:border-[#F59E0B] dark:bg-[#F59E0B]/10'
                            : 'border-[#E2E8F0] bg-white hover:-translate-y-0.5 hover:border-[#F59E0B] dark:border-[#1E293B] dark:bg-[#111820] dark:hover:border-[#F59E0B]'
                      }`}
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F1F5F9] dark:bg-[#16202A]">
                        {p.imagem ? (
                          <img
                            src={p.imagem}
                            alt={p.nome}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[#94A3B8]">
                            <HardHat className="h-7 w-7" />
                          </div>
                        )}
                        {inList > 0 && (
                          <span className="absolute top-2.5 right-2.5 rounded-lg bg-[#F59E0B] px-2 py-0.5 font-display text-xs font-bold tabular-nums text-[#0F172A]">
                            {inList} sep.
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col justify-between p-3.5">
                        <div>
                          <div className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                            {p.codigo} · {p.unidade}
                          </div>
                          <div className="mt-1 line-clamp-2 font-display text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                            {p.nome}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between border-t border-[#F1F5F9] pt-2.5 text-xs dark:border-[#1E293B]">
                          <span className="font-semibold tabular-nums text-[#475569] dark:text-[#CBD5E1]">
                            Custo {formatBRL(p.custo)}
                          </span>
                          <span
                            className={`font-semibold tabular-nums ${
                              out
                                ? 'text-[#DC2626] dark:text-[#F87171]'
                                : 'text-[#059669] dark:text-[#34D399]'
                            }`}
                          >
                            {p.saldo} disp.
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]"
          >
            <div className="flex items-center gap-2 border-b border-[#F1F5F9] px-5 py-4 dark:border-[#1E293B]">
              <HardHat className="h-4 w-4 text-[#F59E0B]" />
              <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                Lista de Saída Equipes ({items.reduce((s, i) => s + i.quantidade, 0)})
              </h3>
            </div>

            <div className="max-h-[240px] flex-1 space-y-2 overflow-y-auto p-4">
              {items.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Selecione os materiais retirados pela equipe.
                </div>
              ) : (
                items.map((it) => {
                  const prodImg = products.find((p) => p.id === it.produtoId)?.imagem;
                  return (
                    <div
                      key={it.produtoId}
                      className="flex items-center justify-between gap-2.5 rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2 dark:border-[#1E293B] dark:bg-[#16202A]"
                    >
                      <ProductImage src={prodImg} alt={it.nome} sizeClass="h-8 w-8" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                          {it.nome}
                        </div>
                        <div className="text-[11px] tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                          Custo {formatBRL(it.custoUnitario)} / {it.unidade}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateQty(it.produtoId, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#0F172A] dark:border-[#263442] dark:bg-[#111820] dark:text-[#F1F5F9]"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 text-center font-display text-xs font-bold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                          {it.quantidade}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQty(it.produtoId, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#0F172A] dark:border-[#263442] dark:bg-[#111820] dark:text-[#F1F5F9]"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateQty(it.produtoId, -it.quantidade)}
                        className="text-[#94A3B8] hover:text-[#DC2626]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-3 border-t border-[#E2E8F0] bg-[#F8FAFC] p-5 dark:border-[#1E293B] dark:bg-[#0D151A]">
              <div>
                <label className="block text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                  Local / Obra da Instalação *
                </label>
                <input
                  required
                  type="text"
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                  placeholder="Ex: Ed. Solar Ap 42 (Sacada)"
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                    Técnico / Equipe
                  </label>
                  <input
                    type="text"
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                    Data
                  </label>
                  <input
                    type="date"
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs tabular-nums text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                  />
                </div>
              </div>

              {/* Bloco de Faturamento do Serviço (sem mostrar preço dos itens na nota) */}
              <div className="space-y-2.5 rounded-xl border border-[#10B981]/25 bg-[#ECFDF5]/50 p-3 dark:border-[#10B981]/25 dark:bg-[#10B981]/10">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#059669] dark:text-[#34D399]">
                  Cobrança do Serviço (Para NFS-e)
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#CBD5E1]">
                      Cliente / Tomador
                    </label>
                    <input
                      list="obra-clientes"
                      type="text"
                      value={clienteNome}
                      onChange={(e) => {
                        setClienteNome(e.target.value);
                        const found = customers.find((c) => c.nome === e.target.value);
                        if (found) setClienteDoc(found.doc);
                      }}
                      placeholder="Nome ou condomínio"
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                    />
                    <datalist id="obra-clientes">
                      {customers.map((c) => (
                        <option key={c.id} value={c.nome} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#CBD5E1]">
                      CPF / CNPJ
                    </label>
                    <input
                      type="text"
                      value={clienteDoc}
                      onChange={(e) => setClienteDoc(e.target.value)}
                      placeholder="Para nota fiscal"
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 font-mono text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#CBD5E1]">
                      Valor Serviço Cobrado (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={valorServicoInput}
                      onChange={(e) => setValorServicoInput(e.target.value)}
                      placeholder="Ex: 1800.00"
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 font-mono text-xs font-semibold text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#34D399]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#475569] dark:text-[#CBD5E1]">
                      Entrada no Caixa
                    </label>
                    <select
                      value={formaCaixa}
                      onChange={(e) =>
                        setFormaCaixa(
                          e.target.value as '' | 'dinheiro' | 'pix' | 'credito' | 'debito'
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1.5 text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                    >
                      <option value="">Não lançar agora</option>
                      <option value="pix">PIX</option>
                      <option value="dinheiro">Dinheiro</option>
                      <option value="credito">Crédito</option>
                      <option value="debito">Débito</option>
                    </select>
                  </div>
                </div>
                <p className="text-[11px] text-[#475569] dark:text-[#94A3B8]">
                  A NFS-e sai apenas com o valor total da instalação — sem listar os materiais usados.
                </p>
                {valorServicoNum > 0 && clienteNome.trim() && (
                  <label className="flex items-center gap-2 pt-0.5 text-xs font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                    <input
                      type="checkbox"
                      checked={gerarNfse}
                      onChange={(e) => setGerarNfse(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[#10B981]"
                    />
                    Já preparar NFS-e de Serviço ao finalizar
                  </label>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                  Observações
                </label>
                <input
                  type="text"
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Opcional"
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                />
              </div>

              <div className="space-y-1 border-t border-[#E2E8F0] pt-2.5 text-xs dark:border-[#1E293B]">
                <div className="flex items-center justify-between">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Custo Interno Materiais</span>
                  <span className="font-mono font-semibold tabular-nums text-[#D97706] dark:text-[#FBBF24]">
                    {formatBRL(totalCost)}
                  </span>
                </div>
                {valorServicoNum > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[#64748B] dark:text-[#94A3B8]">Lucro Estimado</span>
                    <span
                      className={`font-mono font-bold tabular-nums ${
                        lucroEstimado >= 0
                          ? 'text-[#059669] dark:text-[#34D399]'
                          : 'text-[#DC2626] dark:text-[#F87171]'
                      }`}
                    >
                      {formatBRL(lucroEstimado)}
                    </span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={items.length === 0 || !destino.trim()}
                className="w-full rounded-xl bg-[#10B981] py-2.5 text-sm font-semibold text-[#052E16] hover:bg-[#34D399] disabled:opacity-50"
              >
                Registrar Saída Equipes
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'historico' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 dark:border-[#1E293B] dark:bg-[#111820]">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={histQuery}
                onChange={(e) => setHistQuery(e.target.value)}
                placeholder="Buscar destino, cliente, equipe ou material..."
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 pr-3 pl-10 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B] dark:border-[#1E293B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Local / Cliente</th>
                    <th className="px-4 py-3">Materiais (Controle Interno)</th>
                    <th className="px-4 py-3 text-right">Custo Mat.</th>
                    <th className="px-4 py-3 text-right">Valor Serviço</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-xs text-[#64748B] dark:text-[#94A3B8]"
                      >
                        Nenhuma saída para equipes registrada ainda.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((o) => (
                      <tr key={o.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#16202A]">
                        <td className="px-4 py-3 text-xs tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                          {formatDateBR(o.data)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                            {o.destino}
                          </div>
                          <div className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                            {o.clienteNome ? `${o.clienteNome} · ` : ''}
                            Equipe: {o.responsavel}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
                          {o.itens.map((i) => `${i.quantidade} ${i.unidade} · ${i.nome}`).join(' | ')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-semibold tabular-nums text-[#D97706] dark:text-[#FBBF24]">
                          {formatBRL(o.custoTotal)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
                          {o.valorServico ? formatBRL(o.valorServico) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {o.nfseId ? (
                              <button
                                type="button"
                                onClick={() => setActivePage('nfe')}
                                className="inline-flex items-center gap-1 rounded-md border border-[#10B981]/30 bg-[#10B981]/10 px-2.5 py-1 text-xs font-semibold text-[#059669] dark:text-[#34D399]"
                              >
                                <FileText className="h-3 w-3" />
                                Ver NFS-e
                              </button>
                            ) : o.valorServico && o.valorServico > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const created = createNFSeFromObra(o.id);
                                  if (created) setActivePage('nfe');
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                              >
                                <FileText className="h-3 w-3 text-[#10B981]" />
                                Gerar NFS-e
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => deleteObraWithdrawal(o.id)}
                              className="rounded-lg p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] dark:text-[#F87171] dark:hover:bg-[#EF4444]/15"
                              title="Estornar retirada para o estoque"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
