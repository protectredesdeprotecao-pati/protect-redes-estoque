import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Barcode,
  CheckCircle2,
  FileText,
  Minus,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { NFeRecord, PaymentMethod, Product, SaleItem } from '../../types/erp';
import { formatBRL, formatDateBR } from '../../utils/formatters';
import { ProductImage } from '../ui/ProductImage';

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string }[] = [
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'pix', label: 'PIX' },
  { id: 'credito', label: 'Crédito' },
  { id: 'debito', label: 'Débito' },
  { id: 'fiado', label: 'Fiado' },
];

function playScanBeep(success: boolean) {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = success ? 'sine' : 'sawtooth';
    osc.frequency.value = success ? 1180 : 280;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.08 : 0.18));
    window.setTimeout(() => {
      void ctx.close();
    }, 300);
  } catch {
    // Ignore audio context restriction errors
  }
}

export const VendasPage: React.FC = () => {
  const {
    products,
    categories,
    customers,
    sales,
    nfes,
    nfeConfig,
    certLoaded,
    finalizeSale,
    cancelSale,
    emitAndTransmitProductNote,
    printSaleReceipt,
    pushToast,
    setActivePage,
  } = useStore();

  const [tab, setTab] = useState<'pdv' | 'historico'>('pdv');
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [lastScanBadge, setLastScanBadge] = useState<string>('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cart state
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [clienteNome, setClienteNome] = useState('');
  const [clienteDoc, setClienteDoc] = useState('');
  const [desconto, setDesconto] = useState('0');
  const [formaPagamento, setFormaPagamento] = useState<PaymentMethod>('pix');
  const [valorRecebido, setValorRecebido] = useState('');
  const [autoEmitNote, setAutoEmitNote] = useState<boolean>(
    nfeConfig.autoEmitirNfeProduto !== false
  );
  const [autoPrint, setAutoPrint] = useState<boolean>(
    nfeConfig.autoImprimirNotinha !== false
  );
  const [isFinalizing, setIsFinalizing] = useState(false);

  // History filters
  const [histQuery, setHistQuery] = useState('');
  const [histFrom, setHistFrom] = useState('');
  const [histTo, setHistTo] = useState('');

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (catFilter && p.categoria !== catFilter) return false;
      if (!q) return true;
      return (
        p.nome.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        (p.codBarras && p.codBarras.toLowerCase().includes(q))
      );
    });
  }, [catFilter, products, query]);

  const addToCart = useCallback(
    (p: Product, qtyToAdd = 1) => {
      if (p.saldo <= 0) {
        pushToast({
          type: 'aviso',
          title: 'Produto sem estoque',
          description: `${p.nome} está esgotado.`,
        });
        return false;
      }
      let added = true;
      setCart((prev) => {
        const existing = prev.find((i) => i.produtoId === p.id);
        if (existing) {
          if (existing.quantidade >= p.saldo) {
            added = false;
            return prev;
          }
          const nextQty = Math.min(p.saldo, existing.quantidade + qtyToAdd);
          return prev.map((i) =>
            i.produtoId === p.id ? { ...i, quantidade: nextQty } : i
          );
        }
        return [
          ...prev,
          {
            produtoId: p.id,
            codigo: p.codigo,
            nome: p.nome,
            unidade: p.unidade,
            quantidade: Math.min(p.saldo, Math.max(1, qtyToAdd)),
            precoUnitario: p.venda,
            custoUnitario: p.custo,
            codBarras: p.codBarras,
            ncm: p.ncm || '56081900',
            cfop: p.cfop || '5102',
            csosn: p.csosn || '102',
          },
        ];
      });
      if (!added) {
        pushToast({
          type: 'aviso',
          title: 'Limite de estoque atingido',
          description: `${p.nome} possui apenas ${p.saldo} ${p.unidade}.`,
        });
      }
      return added;
    },
    [pushToast]
  );

  const handleBarcodeScan = useCallback(
    (rawInput: string) => {
      const clean = rawInput.trim();
      if (!clean) return;

      let qty = 1;
      let code = clean;
      const multMatch = clean.match(/^(\d+)\*(.+)$/);
      if (multMatch) {
        qty = Math.max(1, parseInt(multMatch[1], 10) || 1);
        code = multMatch[2].trim();
      }

      const codeLower = code.toLowerCase();
      const found = products.find(
        (p) =>
          (p.codBarras && p.codBarras.trim().toLowerCase() === codeLower) ||
          p.codigo.trim().toLowerCase() === codeLower
      );

      if (found) {
        const ok = addToCart(found, qty);
        playScanBeep(ok);
        if (ok) {
          setLastScanBadge(`Bipado: ${qty}x ${found.nome}`);
          window.setTimeout(() => setLastScanBadge(''), 2500);
        }
        setQuery('');
      } else {
        playScanBeep(false);
        pushToast({
          type: 'aviso',
          title: 'Código não encontrado',
          description: `Nenhum produto cadastrado com código/EAN "${code}".`,
        });
      }
    },
    [addToCart, products, pushToast]
  );

  // Captura global do leitor de código de barras USB/Bluetooth no PDV
  useEffect(() => {
    if (tab !== 'pdv') return;
    let buffer = '';
    let lastKeyAt = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName || '';
      const isSearchInput = target === searchInputRef.current;

      // Se o foco está em outro campo de texto (ex: nome do cliente, desconto), não intercepta
      if (!isSearchInput && (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')) {
        return;
      }
      // Se o foco já está no campo de busca do leitor, o onKeyDown do input cuida do Enter
      if (isSearchInput) return;

      const now = Date.now();
      if (now - lastKeyAt > 65) {
        buffer = '';
      }
      lastKeyAt = now;

      if (e.key === 'Enter') {
        if (buffer.length >= 4) {
          e.preventDefault();
          const scanned = buffer;
          buffer = '';
          handleBarcodeScan(scanned);
        } else {
          buffer = '';
        }
        return;
      }

      if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleBarcodeScan, tab]);

  const updateCartQty = (produtoId: string, delta: number) => {
    const prod = products.find((p) => p.id === produtoId);
    const max = prod?.saldo ?? 9999;
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.produtoId !== produtoId) return item;
          const nextQty = Math.min(max, item.quantidade + delta);
          return { ...item, quantidade: nextQty };
        })
        .filter((item) => item.quantidade > 0)
    );
  };

  const subtotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.precoUnitario * i.quantidade, 0),
    [cart]
  );
  const descNum = Math.max(0, parseFloat(desconto) || 0);
  const total = Math.max(0, subtotal - descNum);
  const troco =
    formaPagamento === 'dinheiro' && parseFloat(valorRecebido) > total
      ? parseFloat(valorRecebido) - total
      : 0;

  const handleFinalize = async () => {
    if (cart.length === 0 || isFinalizing) return;
    setIsFinalizing(true);
    try {
      const sale = finalizeSale({
        clienteNome,
        clienteDoc: clienteDoc.trim() || undefined,
        itens: cart,
        desconto: descNum,
        formaPagamento,
        valorRecebido:
          formaPagamento === 'dinheiro' && parseFloat(valorRecebido) > 0
            ? parseFloat(valorRecebido)
            : undefined,
        troco: formaPagamento === 'dinheiro' && troco > 0 ? troco : undefined,
      });
      if (!sale) return;

      setCart([]);
      setClienteNome('');
      setClienteDoc('');
      setDesconto('0');
      setValorRecebido('');

      let emittedNfe: NFeRecord | undefined;
      if (autoEmitNote) {
        emittedNfe = await emitAndTransmitProductNote({
          clienteNome: sale.clienteNome,
          clienteDoc: sale.clienteDoc || '',
          valor: sale.total,
          vendaId: sale.id,
          modelo: nfeConfig.modeloProdutoPadrao ?? '65',
          itensSnapshot: sale.itens,
          desconto: sale.desconto,
          formaPagamento: sale.formaPagamento,
          autoTransmit: true,
        });
      }

      if (autoPrint) {
        printSaleReceipt(sale, emittedNfe);
      }

      window.setTimeout(() => searchInputRef.current?.focus(), 120);
    } finally {
      setIsFinalizing(false);
    }
  };

  const filteredHistory = useMemo(() => {
    const q = histQuery.trim().toLowerCase();
    return sales.filter((s) => {
      if (histFrom && s.data < histFrom) return false;
      if (histTo && s.data > histTo) return false;
      if (!q) return true;
      return (
        s.clienteNome.toLowerCase().includes(q) ||
        String(s.numero).includes(q) ||
        s.vendedor.toLowerCase().includes(q)
      );
    });
  }, [histFrom, histQuery, histTo, sales]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-fit items-center gap-1 rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-1 dark:border-[#1E293B] dark:bg-[#111820]">
          <button
            type="button"
            onClick={() => setTab('pdv')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === 'pdv'
                ? 'bg-white text-[#0F172A] shadow-xs dark:bg-[#1E293B] dark:text-[#F1F5F9]'
                : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
            }`}
          >
            PDV Balcão
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
            Histórico de Vendas ({sales.length})
          </button>
        </div>

        {tab === 'pdv' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {lastScanBadge ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#10B981]/30 bg-[#ECFDF5] px-2.5 py-1 font-semibold text-[#059669] dark:bg-[#10B981]/15 dark:text-[#34D399]">
                <Barcode className="h-3.5 w-3.5" />
                {lastScanBadge}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[#64748B] dark:text-[#94A3B8]">
                <Barcode className="h-3.5 w-3.5 text-[#10B981]" />
                Leitor USB pronto · Dica: digite <code className="font-mono">2*EAN</code> para 2 unidades
              </span>
            )}
          </div>
        )}
      </div>

      {tab === 'pdv' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          {/* Visual Product Catalog Grid */}
          <div className="space-y-4 xl:col-span-2">
            <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-[#E2E8F0] bg-white p-3.5 dark:border-[#1E293B] dark:bg-[#111820]">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
                <input
                  ref={searchInputRef}
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && query.trim()) {
                      e.preventDefault();
                      handleBarcodeScan(query);
                    }
                  }}
                  placeholder="Bipar código de barras (Enter) ou buscar produto..."
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
            </div>

            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
              {filteredProducts.map((p) => {
                const out = p.saldo <= 0;
                const low = p.saldo > 0 && p.saldo <= p.minimo;
                const inCart = cart.find((c) => c.produtoId === p.id)?.quantidade ?? 0;

                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={out}
                    onClick={() => addToCart(p)}
                    className={`group flex flex-col overflow-hidden rounded-2xl border text-left transition-all duration-150 ${
                      out
                        ? 'cursor-not-allowed border-[#E2E8F0] bg-[#F8FAFC] opacity-55 dark:border-[#1E293B] dark:bg-[#0D151A]'
                        : inCart > 0
                          ? 'border-[#10B981] bg-[#ECFDF5]/50 ring-1 ring-[#10B981]/30 dark:bg-[#10B981]/10'
                          : 'border-[#E2E8F0] bg-white hover:-translate-y-0.5 hover:border-[#10B981] hover:shadow-sm dark:border-[#1E293B] dark:bg-[#111820] dark:hover:border-[#10B981]'
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
                          <ShoppingBag className="h-8 w-8" />
                        </div>
                      )}
                      {inCart > 0 && (
                        <span className="absolute top-2.5 right-2.5 rounded-lg bg-[#10B981] px-2 py-0.5 font-display text-xs font-bold tabular-nums text-[#052E16] shadow-sm">
                          {inCart} no carrinho
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between p-3.5">
                      <div>
                        <div className="text-[11px] font-medium text-[#64748B] dark:text-[#94A3B8]">
                          {p.codigo} · {p.unidade}
                        </div>
                        <div className="mt-1 line-clamp-2 font-display text-sm font-semibold leading-snug text-[#0F172A] dark:text-[#F1F5F9]">
                          {p.nome}
                        </div>
                      </div>

                      <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-[#F1F5F9] pt-2.5 dark:border-[#1E293B]">
                        <div className="font-display text-base font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
                          {formatBRL(p.venda)}
                        </div>
                        <div
                          className={`text-[11px] font-semibold tabular-nums ${
                            out
                              ? 'text-[#DC2626] dark:text-[#F87171]'
                              : low
                                ? 'text-[#D97706] dark:text-[#FBBF24]'
                                : 'text-[#64748B] dark:text-[#94A3B8]'
                          }`}
                        >
                          {out ? 'Esgotado' : `${p.saldo} disp.`}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cart */}
          <div className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] px-5 py-4 dark:border-[#1E293B]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-[#10B981]" />
                <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                  Carrinho ({cart.reduce((s, i) => s + i.quantidade, 0)})
                </h3>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs font-semibold text-[#DC2626] hover:underline dark:text-[#F87171]"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 border-b border-[#F1F5F9] px-5 py-3 sm:grid-cols-2 dark:border-[#1E293B]">
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                  Cliente (opcional)
                </label>
                <input
                  type="text"
                  list="pdv-clientes-list"
                  value={clienteNome}
                  onChange={(e) => {
                    setClienteNome(e.target.value);
                    const found = customers.find((c) => c.nome === e.target.value);
                    if (found) setClienteDoc(found.doc);
                  }}
                  placeholder="Balcão / Nome..."
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs text-[#0F172A] focus:border-[#10B981] focus:outline-none dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                />
                <datalist id="pdv-clientes-list">
                  {customers.map((c) => (
                    <option key={c.id} value={c.nome} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                  CPF / CNPJ na Nota
                </label>
                <input
                  type="text"
                  value={clienteDoc}
                  onChange={(e) => setClienteDoc(e.target.value)}
                  placeholder="Opcional (NFC-e)"
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-1.5 font-mono text-xs text-[#0F172A] focus:border-[#10B981] focus:outline-none dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                />
              </div>
            </div>

            <div className="max-h-[300px] flex-1 space-y-2 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
                  Bipe o produto com o leitor ou clique nos itens ao lado.
                </div>
              ) : (
                cart.map((item) => {
                  const prodImg = products.find((p) => p.id === item.produtoId)?.imagem;
                  return (
                    <div
                      key={item.produtoId}
                      className="flex items-center justify-between gap-2.5 rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2.5 dark:border-[#1E293B] dark:bg-[#16202A]"
                    >
                      <ProductImage src={prodImg} alt={item.nome} sizeClass="h-9 w-9" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                          {item.nome}
                        </div>
                        <div className="text-[11px] tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                          {formatBRL(item.precoUnitario)} / {item.unidade}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.produtoId, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F1F5F9] dark:border-[#263442] dark:bg-[#111820] dark:text-[#F1F5F9]"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center font-display text-xs font-bold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                          {item.quantidade}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.produtoId, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F1F5F9] dark:border-[#263442] dark:bg-[#111820] dark:text-[#F1F5F9]"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="min-w-[64px] text-right font-display text-xs font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
                        {formatBRL(item.precoUnitario * item.quantidade)}
                      </div>

                      <button
                        type="button"
                        onClick={() => updateCartQty(item.produtoId, -item.quantidade)}
                        className="text-[#94A3B8] hover:text-[#DC2626]"
                        aria-label="Remover item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="space-y-3 border-t border-[#E2E8F0] bg-[#F8FAFC] p-5 dark:border-[#1E293B] dark:bg-[#0D151A]">
              <div className="flex items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8]">
                <span>Subtotal</span>
                <span className="font-semibold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                  {formatBRL(subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-[#64748B] dark:text-[#94A3B8]">
                <span>Desconto (R$)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={desconto}
                  onChange={(e) => setDesconto(e.target.value)}
                  className="w-24 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 text-right text-xs font-semibold tabular-nums text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                />
              </div>
              <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-2.5 dark:border-[#1E293B]">
                <span className="font-display text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                  Total
                </span>
                <span className="font-display text-2xl font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
                  {formatBRL(total)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFormaPagamento(opt.id)}
                    className={`rounded-lg border py-1.5 text-xs font-semibold transition-colors ${
                      formaPagamento === opt.id
                        ? 'border-[#10B981] bg-[#10B981] text-[#052E16]'
                        : 'border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#94A3B8] dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {formaPagamento === 'dinheiro' && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs dark:border-[#263442] dark:bg-[#16202A]">
                  <span className="text-[#64748B] dark:text-[#94A3B8]">Recebido (R$):</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                    placeholder="0,00"
                    className="w-24 rounded-lg border border-[#E2E8F0] bg-white px-2 py-0.5 text-right tabular-nums text-[#0F172A] dark:border-[#334155] dark:bg-[#0D151A] dark:text-[#F1F5F9]"
                  />
                  <span className="font-semibold tabular-nums text-[#059669] dark:text-[#34D399]">
                    Troco: {formatBRL(troco)}
                  </span>
                </div>
              )}

              {/* Automação Fiscal + Impressão Caixa */}
              <div className="space-y-1.5 rounded-xl border border-[#E2E8F0] bg-white p-3 text-xs dark:border-[#263442] dark:bg-[#16202A]">
                <label className="flex items-center justify-between gap-2">
                  <span className="text-[#0F172A] dark:text-[#F1F5F9]">
                    Emitir {nfeConfig.modeloProdutoPadrao === '55' ? 'NF-e' : 'NFC-e'} sozinha{' '}
                    <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      ({certLoaded ? 'A1 ativo' : 'Salva pendente'})
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={autoEmitNote}
                    onChange={(e) => setAutoEmitNote(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#10B981]"
                  />
                </label>
                <label className="flex items-center justify-between gap-2">
                  <span className="text-[#0F172A] dark:text-[#F1F5F9]">
                    Imprimir notinha na hora ({nfeConfig.larguraCupom || '80mm'})
                  </span>
                  <input
                    type="checkbox"
                    checked={autoPrint}
                    onChange={(e) => setAutoPrint(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[#10B981]"
                  />
                </label>
              </div>

              <button
                type="button"
                disabled={cart.length === 0 || isFinalizing}
                onClick={() => void handleFinalize()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] py-3 text-sm font-bold text-[#052E16] transition-colors hover:bg-[#34D399] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isFinalizing
                  ? 'Emitindo nota e imprimindo...'
                  : 'Finalizar Venda & Imprimir Notinha'}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'historico' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 dark:border-[#1E293B] dark:bg-[#111820]">
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={histQuery}
                onChange={(e) => setHistQuery(e.target.value)}
                placeholder="Buscar cliente, número ou vendedor..."
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 pr-3 pl-10 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <input
              type="date"
              value={histFrom}
              onChange={(e) => setHistFrom(e.target.value)}
              className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs tabular-nums text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
            <input
              type="date"
              value={histTo}
              onChange={(e) => setHistTo(e.target.value)}
              className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-xs tabular-nums text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B] dark:border-[#1E293B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
                  <tr>
                    <th className="px-4 py-3">Nº</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Itens</th>
                    <th className="px-4 py-3">Pagamento</th>
                    <th className="px-4 py-3">Vendedor</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
                  {filteredHistory.map((s) => {
                    const linkedNfe = s.nfeId ? nfes.find((n) => n.id === s.nfeId) : undefined;
                    return (
                      <tr key={s.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#16202A]">
                        <td className="px-4 py-3 text-xs font-semibold tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                          #{s.numero}
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                          {formatDateBR(s.data)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                          {s.clienteNome}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
                          {s.itens.map((i) => `${i.quantidade}x ${i.codigo}`).join(', ')}
                        </td>
                        <td className="px-4 py-3 text-xs uppercase text-[#64748B] dark:text-[#94A3B8]">
                          {s.formaPagamento}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
                          {s.vendedor}
                        </td>
                        <td className="px-4 py-3 text-right font-display font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
                          {formatBRL(s.total)}
                        </td>
                        <td className="px-4 py-3">
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
                        <td className="px-4 py-3 text-right">
                          {s.status === 'concluida' && (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => printSaleReceipt(s, linkedNfe)}
                                className="rounded-lg p-1.5 text-[#0F172A] hover:bg-[#F1F5F9] dark:text-[#CBD5E1] dark:hover:bg-[#1E293B]"
                                title="Imprimir notinha térmica do caixa"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (linkedNfe) {
                                    setActivePage('nfe');
                                    return;
                                  }
                                  void emitAndTransmitProductNote({
                                    clienteNome: s.clienteNome,
                                    clienteDoc: s.clienteDoc || '',
                                    valor: s.total,
                                    vendaId: s.id,
                                    modelo: nfeConfig.modeloProdutoPadrao ?? '65',
                                    itensSnapshot: s.itens,
                                    desconto: s.desconto,
                                    formaPagamento: s.formaPagamento,
                                    autoTransmit: true,
                                  });
                                  setActivePage('nfe');
                                }}
                                className="rounded-lg p-1.5 text-[#059669] hover:bg-[#ECFDF5] dark:text-[#34D399] dark:hover:bg-[#10B981]/15"
                                title={linkedNfe ? 'Ver NF-e / NFC-e da venda' : 'Emitir NF-e / NFC-e desta venda'}
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelSale(s.id)}
                                className="rounded-lg p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] dark:text-[#F87171] dark:hover:bg-[#EF4444]/15"
                                title="Cancelar venda e estornar estoque"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
