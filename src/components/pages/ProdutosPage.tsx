import React, { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  Edit3,
  HardHat,
  Minus,
  PackagePlus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { PRODUCT_IMAGE_PRESETS } from '../../data/seedData';
import { Product } from '../../types/erp';
import { formatBRL, formatDateBR } from '../../utils/formatters';
import { ProductImage } from '../ui/ProductImage';
import { SlideOver } from '../ui/SlideOver';

const UNITS = ['Unidade', 'Metro', 'Rolo', 'Cento', 'Fardo', 'Barra', 'Par', 'Kit', 'Litro'];

interface ProductActivityEvent {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  delta: number;
  kind: 'entrada' | 'venda' | 'obra';
}

export const ProdutosPage: React.FC = () => {
  const {
    products,
    categories,
    suppliers,
    entries,
    sales,
    obras,
    saveProduct,
    deleteProduct,
    adjustStock,
    setQuickRestockProductId,
    setActivePage,
  } = useStore();

  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [healthFilter, setHealthFilter] = useState<'all' | 'low' | 'zero' | 'ok'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(() => products[0]?.id ?? null);

  // SlideOver Editor
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const [nome, setNome] = useState('');
  const [codigo, setCodigo] = useState('');
  const [categoria, setCategoria] = useState(categories[0] ?? 'Redes de Proteção');
  const [unidade, setUnidade] = useState('Unidade');
  const [custo, setCusto] = useState('0');
  const [venda, setVenda] = useState('0');
  const [saldo, setSaldo] = useState('0');
  const [minimo, setMinimo] = useState('0');
  const [fornecedorId, setFornecedorId] = useState('');
  const [codBarras, setCodBarras] = useState('');
  const [ncm, setNcm] = useState('56081900');
  const [cfop, setCfop] = useState('5102');
  const [csosn, setCsosn] = useState('102');
  const [imagem, setImagem] = useState('');

  // Outbound qty map
  const outboundByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sales) {
      if (s.status !== 'concluida') continue;
      for (const it of s.itens) {
        map.set(it.produtoId, (map.get(it.produtoId) ?? 0) + it.quantidade);
      }
    }
    for (const o of obras) {
      for (const it of o.itens) {
        map.set(it.produtoId, (map.get(it.produtoId) ?? 0) + it.quantidade);
      }
    }
    return map;
  }, [obras, sales]);

  const openNew = () => {
    setEditing(null);
    setNome('');
    setCodigo('');
    setCategoria(categories[0] ?? 'Redes de Proteção');
    setUnidade('Unidade');
    setCusto('0');
    setVenda('0');
    setSaldo('0');
    setMinimo('10');
    setFornecedorId('');
    setCodBarras('');
    setNcm('56081900');
    setCfop('5102');
    setCsosn('102');
    setImagem(PRODUCT_IMAGE_PRESETS[0].url);
    setDrawerOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setNome(p.nome);
    setCodigo(p.codigo);
    setCategoria(p.categoria);
    setUnidade(p.unidade);
    setCusto(String(p.custo));
    setVenda(String(p.venda));
    setSaldo(String(p.saldo));
    setMinimo(String(p.minimo));
    setFornecedorId(p.fornecedorId ?? '');
    setCodBarras(p.codBarras ?? '');
    setNcm(p.ncm ?? '56081900');
    setCfop(p.cfop ?? '5102');
    setCsosn(p.csosn ?? '102');
    setImagem(p.imagem ?? '');
    setDrawerOpen(true);
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImagem(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    saveProduct({
      id: editing?.id,
      nome: nome.trim(),
      codigo: codigo.trim() || `PRD-${Math.floor(1000 + Math.random() * 9000)}`,
      categoria,
      unidade,
      custo: parseFloat(custo) || 0,
      venda: parseFloat(venda) || 0,
      saldo: Math.max(0, parseFloat(saldo) || 0),
      minimo: Math.max(0, parseFloat(minimo) || 0),
      fornecedorId: fornecedorId || undefined,
      codBarras: codBarras.trim() || undefined,
      ncm: ncm.replace(/\D/g, '').slice(0, 8) || '56081900',
      cfop: cfop.replace(/\D/g, '').slice(0, 4) || '5102',
      csosn: csosn.replace(/\D/g, '').slice(0, 3) || '102',
      imagem: imagem.trim() || undefined,
    });
    setDrawerOpen(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (catFilter && p.categoria !== catFilter) return false;
      if (healthFilter === 'zero' && p.saldo > 0) return false;
      if (healthFilter === 'low' && (p.saldo <= 0 || p.saldo > p.minimo)) return false;
      if (healthFilter === 'ok' && p.saldo <= p.minimo) return false;
      if (!q) return true;
      return (
        p.nome.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        (p.codBarras && p.codBarras.includes(q))
      );
    });
  }, [catFilter, healthFilter, products, query]);

  const counts = useMemo(
    () => ({
      all: products.length,
      low: products.filter((p) => p.saldo > 0 && p.saldo <= p.minimo).length,
      zero: products.filter((p) => p.saldo <= 0).length,
      ok: products.filter((p) => p.saldo > p.minimo).length,
    }),
    [products]
  );

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedId) ?? null,
    [products, selectedId]
  );

  const productTimeline = useMemo<ProductActivityEvent[]>(() => {
    if (!selectedProduct) return [];
    const events: ProductActivityEvent[] = [];

    for (const e of entries) {
      if (e.produtoId === selectedProduct.id) {
        events.push({
          id: e.id,
          date: e.data,
          title: `Entrada ${e.nfReferencia}`,
          subtitle: e.fornecedorNome || 'Compra direta',
          delta: e.quantidade,
          kind: 'entrada',
        });
      }
    }

    for (const s of sales) {
      if (s.status !== 'concluida') continue;
      for (const it of s.itens) {
        if (it.produtoId === selectedProduct.id) {
          events.push({
            id: `${s.id}-${it.produtoId}`,
            date: s.data,
            title: `Venda #${s.numero}`,
            subtitle: s.clienteNome,
            delta: -it.quantidade,
            kind: 'venda',
          });
        }
      }
    }

    for (const o of obras) {
      for (const it of o.itens) {
        if (it.produtoId === selectedProduct.id) {
          events.push({
            id: `${o.id}-${it.produtoId}`,
            date: o.data,
            title: 'Saída Equipes',
            subtitle: o.destino,
            delta: -it.quantidade,
            kind: 'obra',
          });
        }
      }
    }

    return events.sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, obras, sales, selectedProduct]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 dark:border-[#1E293B] dark:bg-[#111820]">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produto, código ou EAN..."
              className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 pr-3 pl-10 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:border-[#10B981] focus:outline-none dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
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

          <div className="flex items-center gap-1 rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-1 dark:border-[#1E293B] dark:bg-[#0B1115]">
            {(
              [
                { id: 'all', label: `Todos (${counts.all})` },
                { id: 'low', label: `Baixo (${counts.low})` },
                { id: 'zero', label: `Zerado (${counts.zero})` },
                { id: 'ok', label: `Normal (${counts.ok})` },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setHealthFilter(f.id)}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  healthFilter === f.id
                    ? 'bg-white text-[#0F172A] shadow-xs dark:bg-[#1E293B] dark:text-[#F1F5F9]'
                    : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={openNew}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#052E16] transition-colors hover:bg-[#34D399]"
        >
          <Plus className="h-4 w-4" />
          Novo Produto
        </button>
      </div>

      {/* Split Workspace */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div
          className={`overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820] ${
            selectedProduct ? 'xl:col-span-8' : 'xl:col-span-12'
          }`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B] dark:border-[#1E293B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
                <tr>
                  <th className="px-4 py-3">Ação</th>
                  <th className="px-3 py-3">Imagem</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3 text-right">Estoque atual</th>
                  <th className="px-4 py-3 text-right">Saídas</th>
                  <th className="px-4 py-3 text-right">Venda</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-[#64748B] dark:text-[#94A3B8]"
                    >
                      Nenhum produto encontrado com os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const isZero = p.saldo <= 0;
                    const isLow = p.saldo > 0 && p.saldo <= p.minimo;
                    const isSelected = selectedProduct?.id === p.id;
                    const saidas = outboundByProduct.get(p.id) ?? 0;

                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#ECFDF5]/60 dark:bg-[#10B981]/10'
                            : 'hover:bg-[#F8FAFC] dark:hover:bg-[#16202A]'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(p.id);
                            }}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                              isSelected
                                ? 'border-[#10B981] bg-[#10B981] text-[#052E16]'
                                : 'border-[#E2E8F0] bg-white text-[#475569] hover:border-[#10B981] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#CBD5E1]'
                            }`}
                          >
                            Abrir
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <ProductImage
                            src={p.imagem}
                            alt={p.nome}
                            sizeClass="h-11 w-11"
                            roundedClass="rounded-xl"
                            hoverZoom
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                            {p.nome}
                          </div>
                          <div className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                            {p.codigo} · {p.categoria}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-display text-sm font-bold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                          {p.saldo}{' '}
                          <span className="text-xs font-normal text-[#64748B] dark:text-[#94A3B8]">
                            {p.unidade}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-semibold tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                          {saidas}
                        </td>
                        <td className="px-4 py-3 text-right font-display text-sm font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
                          {formatBRL(p.venda)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${
                              isZero
                                ? 'bg-[#FEF2F2] text-[#DC2626] dark:bg-[#EF4444]/15 dark:text-[#FCA5A5]'
                                : isLow
                                  ? 'bg-[#FFFBEB] text-[#D97706] dark:bg-[#F59E0B]/15 dark:text-[#FCD34D]'
                                  : 'bg-[#ECFDF5] text-[#059669] dark:bg-[#10B981]/15 dark:text-[#34D399]'
                            }`}
                          >
                            {isZero ? 'Esgotado' : isLow ? 'Baixo' : 'Normal'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Product Inspector */}
        {selectedProduct && (
          <aside className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white xl:col-span-4 dark:border-[#1E293B] dark:bg-[#111820]">
            <div className="flex items-start justify-between gap-3 border-b border-[#F1F5F9] p-5 dark:border-[#1E293B]">
              <div className="flex min-w-0 items-start gap-3.5">
                <ProductImage
                  src={selectedProduct.imagem}
                  alt={selectedProduct.nome}
                  sizeClass="h-16 w-16"
                  roundedClass="rounded-xl"
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                    {selectedProduct.codigo} · {selectedProduct.categoria}
                  </div>
                  <h3 className="mt-0.5 font-display text-base font-bold leading-snug text-[#0F172A] dark:text-[#F1F5F9]">
                    {selectedProduct.nome}
                  </h3>
                  <div className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Custo{' '}
                    <strong className="tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                      {formatBRL(selectedProduct.custo)}
                    </strong>{' '}
                    · Venda{' '}
                    <strong className="tabular-nums text-[#059669] dark:text-[#34D399]">
                      {formatBRL(selectedProduct.venda)}
                    </strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1 text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#0F172A] dark:hover:bg-[#1E293B] dark:hover:text-white"
                aria-label="Fechar inspetor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 divide-x divide-[#F1F5F9] border-b border-[#F1F5F9] bg-[#F8FAFC]/60 py-4 text-center dark:divide-[#1E293B] dark:border-[#1E293B] dark:bg-[#0D151A]">
              <div>
                <div className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                  Estoque atual
                </div>
                <div className="mt-1 font-display text-2xl font-bold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                  {selectedProduct.saldo}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                  Saídas (hist.)
                </div>
                <div className="mt-1 font-display text-2xl font-bold tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                  {outboundByProduct.get(selectedProduct.id) ?? 0}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                  Mínimo alerta
                </div>
                <div
                  className={`mt-1 font-display text-2xl font-bold tabular-nums ${
                    selectedProduct.saldo <= selectedProduct.minimo
                      ? 'text-[#DC2626] dark:text-[#F87171]'
                      : 'text-[#059669] dark:text-[#34D399]'
                  }`}
                >
                  {selectedProduct.minimo}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-[#F1F5F9] px-5 py-3 dark:border-[#1E293B]">
              <span className="text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                Ajuste rápido
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustStock(selectedProduct.id, -1, 'Baixa rápida')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                  title="Reduzir 1"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => adjustStock(selectedProduct.id, 1, 'Reposição rápida')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                  title="Adicionar 1"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickRestockProductId(selectedProduct.id);
                    setActivePage('entradas');
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#ECFDF5] px-2.5 py-1.5 text-xs font-semibold text-[#059669] hover:bg-[#D1FAE5] dark:bg-[#10B981]/15 dark:text-[#34D399] dark:hover:bg-[#10B981]/25"
                >
                  <PackagePlus className="h-3.5 w-3.5" />
                  Repor
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-3 text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                Histórico de Movimentações
              </div>
              {productTimeline.length === 0 ? (
                <div className="rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] p-6 text-center text-xs text-[#64748B] dark:border-[#1E293B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
                  Nenhuma movimentação registrada para este item ainda.
                </div>
              ) : (
                <div className="space-y-3">
                  {productTimeline.map((ev) => {
                    const Icon =
                      ev.kind === 'entrada'
                        ? ArrowDownToLine
                        : ev.kind === 'venda'
                          ? ShoppingCart
                          : HardHat;
                    const tone =
                      ev.kind === 'entrada'
                        ? 'bg-[#ECFDF5] text-[#059669] dark:bg-[#10B981]/15 dark:text-[#34D399]'
                        : ev.kind === 'venda'
                          ? 'bg-[#F1F5F9] text-[#0F172A] dark:bg-[#1E293B] dark:text-[#CBD5E1]'
                          : 'bg-[#FFFBEB] text-[#D97706] dark:bg-[#F59E0B]/15 dark:text-[#FBBF24]';

                    return (
                      <div key={ev.id} className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <div
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                              {ev.title}
                            </div>
                            <div className="truncate text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                              {formatDateBR(ev.date)} · {ev.subtitle}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`shrink-0 font-display text-xs font-bold tabular-nums ${
                            ev.delta > 0
                              ? 'text-[#059669] dark:text-[#34D399]'
                              : 'text-[#DC2626] dark:text-[#F87171]'
                          }`}
                        >
                          {ev.delta > 0 ? `+${ev.delta}` : ev.delta}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-[#F1F5F9] bg-[#F8FAFC] p-4 dark:border-[#1E293B] dark:bg-[#0D151A]">
              <button
                type="button"
                onClick={() => {
                  const idToDel = selectedProduct.id;
                  setSelectedId(null);
                  deleteProduct(idToDel);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#FECACA] bg-white px-3 py-2 text-xs font-semibold text-[#DC2626] hover:bg-[#FEF2F2] dark:border-[#EF4444]/30 dark:bg-[#16202A] dark:text-[#FCA5A5] dark:hover:bg-[#EF4444]/15"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </button>
              <button
                type="button"
                onClick={() => openEdit(selectedProduct)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#052E16] hover:bg-[#34D399]"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Alterar Produto
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Product Form SlideOver */}
      <SlideOver
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Alterar Produto' : 'Novo Produto'}
        subtitle="Adicione foto, valores e estoque mínimo para alertas automáticos."
        footer={
          <>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-2 text-sm font-medium text-[#475569] hover:bg-[#F8FAFC] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#CBD5E1]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-produto"
              className="rounded-xl bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#052E16] hover:bg-[#34D399]"
            >
              Salvar Produto
            </button>
          </>
        }
      >
        <form id="form-produto" onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
              Foto do Produto
            </label>
            <div className="mt-2 flex items-center gap-4">
              <ProductImage
                src={imagem}
                alt={nome || 'Prévia do produto'}
                sizeClass="h-20 w-20"
                roundedClass="rounded-xl"
              />
              <div className="flex-1 space-y-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F1F5F9] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]">
                  <Upload className="h-3.5 w-3.5 text-[#10B981]" />
                  Enviar foto do computador
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                  />
                </label>
                <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Ou escolha uma foto padrão do catálogo:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRODUCT_IMAGE_PRESETS.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setImagem(preset.url)}
                      className={`overflow-hidden rounded-lg border p-0.5 transition-all ${
                        imagem === preset.url
                          ? 'border-[#10B981] ring-2 ring-[#10B981]/30'
                          : 'border-[#E2E8F0] opacity-75 hover:opacity-100 dark:border-[#263442]'
                      }`}
                      title={preset.label}
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        referrerPolicy="no-referrer"
                        className="h-8 w-8 rounded object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                Nome *
              </label>
              <input
                required
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Rede Proteção 5x5cm Branca"
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#10B981] focus:outline-none dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                Código
              </label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="RD-5X5-BR"
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] focus:border-[#10B981] focus:outline-none dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                Categoria
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                Unidade
              </label>
              <select
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                Custo (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={custo}
                onChange={(e) => setCusto(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm tabular-nums text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                Venda (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={venda}
                onChange={(e) => setVenda(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm tabular-nums text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                Saldo Atual
              </label>
              <input
                type="number"
                min="0"
                value={saldo}
                onChange={(e) => setSaldo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm tabular-nums text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                Mínimo Alerta
              </label>
              <input
                type="number"
                min="0"
                value={minimo}
                onChange={(e) => setMinimo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm tabular-nums text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                Fornecedor Padrão
              </label>
              <select
                value={fornecedorId}
                onChange={(e) => setFornecedorId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              >
                <option value="">Nenhum</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                Código de Barras (EAN) — Pode bipar com o leitor
              </label>
              <input
                type="text"
                value={codBarras}
                onChange={(e) => setCodBarras(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
                placeholder="Bipe ou digite 789..."
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm tabular-nums text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 dark:border-[#1E293B] dark:bg-[#0D151A]">
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                NCM (NF-e / NFC-e)
              </label>
              <input
                type="text"
                value={ncm}
                onChange={(e) => setNcm(e.target.value)}
                placeholder="56081900"
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 font-mono text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                CFOP
              </label>
              <input
                type="text"
                value={cfop}
                onChange={(e) => setCfop(e.target.value)}
                placeholder="5102"
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 font-mono text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                CSOSN (Simples)
              </label>
              <input
                type="text"
                value={csosn}
                onChange={(e) => setCsosn(e.target.value)}
                placeholder="102"
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 font-mono text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>
        </form>
      </SlideOver>
    </div>
  );
};
