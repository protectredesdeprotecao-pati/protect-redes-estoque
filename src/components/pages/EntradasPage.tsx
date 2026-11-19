import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Search, Upload } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import {
  formatBRL,
  formatDateBR,
  ParsedXMLNFe,
  parseNFeXML,
  todayISO,
} from '../../utils/formatters';

export const EntradasPage: React.FC = () => {
  const {
    products,
    suppliers,
    entries,
    registerManualEntry,
    importXMLNFe,
    quickRestockProductId,
    setQuickRestockProductId,
    pushToast,
  } = useStore();

  const [tab, setTab] = useState<'manual' | 'xml' | 'historico'>('manual');

  const [produtoId, setProdutoId] = useState(products[0]?.id ?? '');
  const [quantidade, setQuantidade] = useState('10');
  const [custoUnitario, setCustoUnitario] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [data, setData] = useState(todayISO());
  const [nfReferencia, setNfReferencia] = useState('');
  const [observacao, setObservacao] = useState('');

  useEffect(() => {
    if (quickRestockProductId) {
      setTab('manual');
      setProdutoId(quickRestockProductId);
      const found = products.find((p) => p.id === quickRestockProductId);
      if (found) {
        setCustoUnitario(String(found.custo));
        setFornecedorId(found.fornecedorId ?? '');
        const suggested = Math.max(10, found.minimo * 2 - found.saldo);
        setQuantidade(String(suggested));
      }
      setQuickRestockProductId(null);
    }
  }, [products, quickRestockProductId, setQuickRestockProductId]);

  const selectedProduct = products.find((p) => p.id === produtoId);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!produtoId) return;
    const qty = parseFloat(quantidade) || 0;
    if (qty <= 0) return;
    registerManualEntry({
      produtoId,
      quantidade: qty,
      custoUnitario: parseFloat(custoUnitario) || selectedProduct?.custo || 0,
      fornecedorId: fornecedorId || undefined,
      data,
      nfReferencia,
      observacao,
    });
    setNfReferencia('');
    setObservacao('');
  };

  const [xmlPreview, setXmlPreview] = useState<ParsedXMLNFe | null>(null);
  const [xmlError, setXmlError] = useState('');

  const handleXMLFile = async (file: File) => {
    try {
      const content = await file.text();
      const parsed = parseNFeXML(content);
      setXmlPreview(parsed);
      setXmlError('');
    } catch (err) {
      setXmlPreview(null);
      setXmlError(err instanceof Error ? err.message : 'Erro ao ler XML');
    }
  };

  const handleConfirmXML = () => {
    if (!xmlPreview) return;
    importXMLNFe(xmlPreview);
    setXmlPreview(null);
  };

  const [histQuery, setHistQuery] = useState('');
  const [histFrom, setHistFrom] = useState('');
  const [histTo, setHistTo] = useState('');

  const filteredHistory = useMemo(() => {
    const q = histQuery.trim().toLowerCase();
    return entries.filter((e) => {
      if (histFrom && e.data < histFrom) return false;
      if (histTo && e.data > histTo) return false;
      if (!q) return true;
      return (
        e.produtoNome.toLowerCase().includes(q) ||
        (e.fornecedorNome && e.fornecedorNome.toLowerCase().includes(q)) ||
        e.nfReferencia.toLowerCase().includes(q)
      );
    });
  }, [entries, histFrom, histQuery, histTo]);

  return (
    <div className="space-y-5">
      <div className="flex w-fit items-center gap-1 rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-1 dark:border-[#1E293B] dark:bg-[#111820]">
        {(
          [
            { id: 'manual', label: 'Entrada Manual' },
            { id: 'xml', label: 'Importar XML NF-e' },
            { id: 'historico', label: `Histórico (${entries.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id
                ? 'bg-white text-[#0F172A] shadow-xs dark:bg-[#1E293B] dark:text-[#F1F5F9]'
                : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'manual' && (
        <div className="max-w-3xl rounded-2xl border border-[#E2E8F0] bg-white p-6 dark:border-[#1E293B] dark:bg-[#111820]">
          <div className="border-b border-[#F1F5F9] pb-4 dark:border-[#1E293B]">
            <h3 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
              Registrar Entrada de Material
            </h3>
            <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
              Atualiza o saldo e recalcula automaticamente os alertas de estoque mínimo em tempo real.
            </p>
          </div>

          <form onSubmit={handleManualSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                  Produto *
                </label>
                <select
                  required
                  value={produtoId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setProdutoId(id);
                    const found = products.find((p) => p.id === id);
                    if (found) setCustoUnitario(String(found.custo));
                  }}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                >
                  <option value="">Selecione...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (Saldo: {p.saldo} {p.unidade})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                  Quantidade *
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                  Custo Unitário (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={custoUnitario}
                  onChange={(e) => setCustoUnitario(e.target.value)}
                  placeholder={selectedProduct ? String(selectedProduct.custo) : '0.00'}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                  Fornecedor
                </label>
                <select
                  value={fornecedorId}
                  onChange={(e) => setFornecedorId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                >
                  <option value="">Compra direta / Outro</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                  Data
                </label>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                  Nota Fiscal / Referência
                </label>
                <input
                  type="text"
                  value={nfReferencia}
                  onChange={(e) => setNfReferencia(e.target.value)}
                  placeholder="Ex: NF 004950"
                  className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Observação
              </label>
              <input
                type="text"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Lote, conferente, etc."
                className="mt-1 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-[#10B981] px-5 py-2.5 text-sm font-semibold text-[#052E16] hover:bg-[#34D399]"
              >
                <CheckCircle2 className="h-4 w-4" />
                Registrar Entrada no Estoque
              </button>
            </div>
          </form>
        </div>
      )}

      {tab === 'xml' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 dark:border-[#1E293B] dark:bg-[#111820]">
            <div>
              <h3 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                Importar XML de Nota Fiscal Eletrônica
              </h3>
              <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                Lê itens e duplicatas da NF-e do fornecedor e lança estoque + contas a pagar de uma só vez.
              </p>
            </div>

            <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-6 py-10 text-center transition-colors hover:border-[#10B981] hover:bg-[#ECFDF5]/40 dark:border-[#263442] dark:bg-[#0D151A] dark:hover:border-[#10B981] dark:hover:bg-[#10B981]/5">
              <input
                type="file"
                accept=".xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleXMLFile(file);
                }}
              />
              <Upload className="h-8 w-8 text-[#10B981]" />
              <div className="mt-3 text-sm font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                Clique para selecionar o arquivo .xml da NF-e
              </div>
              <div className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                Suporta padrão SEFAZ NFe / nfeProc
              </div>
            </label>

            {xmlError && (
              <div className="mt-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#B91C1C] dark:border-[#EF4444]/30 dark:bg-[#EF4444]/15 dark:text-[#FCA5A5]">
                {xmlError}
              </div>
            )}
          </div>

          {xmlPreview && (
            <div className="rounded-2xl border border-[#10B981]/40 bg-white p-6 dark:bg-[#111820]">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F1F5F9] pb-4 dark:border-[#1E293B]">
                <div>
                  <h4 className="font-display text-sm font-bold text-[#059669] dark:text-[#34D399]">
                    Prévia NF-e #{xmlPreview.numeroNF} · {xmlPreview.fornecedorNome}
                  </h4>
                  <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                    Emissão {formatDateBR(xmlPreview.dataEmissao)} · CNPJ{' '}
                    {xmlPreview.fornecedorCnpj || '—'} · Total{' '}
                    <strong className="font-mono tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                      {formatBRL(xmlPreview.valorTotal)}
                    </strong>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setXmlPreview(null)}
                    className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#64748B] dark:border-[#263442] dark:text-[#94A3B8]"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmXML}
                    className="rounded-lg bg-[#10B981] px-4 py-1.5 text-xs font-semibold text-[#052E16] hover:bg-[#34D399]"
                  >
                    Confirmar Importação
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <div className="mb-2 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                    Itens da Nota ({xmlPreview.itens.length})
                  </div>
                  <div className="overflow-hidden rounded-lg border border-[#E2E8F0] dark:border-[#1E293B]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFC] text-[#64748B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
                        <tr>
                          <th className="px-3 py-2">Código</th>
                          <th className="px-3 py-2">Descrição</th>
                          <th className="px-3 py-2 text-right">Qtd</th>
                          <th className="px-3 py-2 text-right">Custo Unit.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
                        {xmlPreview.itens.map((it, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 font-mono text-[#64748B] dark:text-[#94A3B8]">
                              {it.codigo}
                            </td>
                            <td className="px-3 py-2 font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                              {it.nome}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                              {it.quantidade} {it.unidade}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                              {formatBRL(it.custoUnitario)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
                    Duplicatas Geradas ({xmlPreview.duplicatas.length})
                  </div>
                  <div className="space-y-2">
                    {xmlPreview.duplicatas.length === 0 ? (
                      <div className="rounded-lg border border-[#E2E8F0] p-3 text-xs text-[#64748B] dark:border-[#1E293B] dark:text-[#94A3B8]">
                        Nenhuma duplicata informada no XML.
                      </div>
                    ) : (
                      xmlPreview.duplicatas.map((d, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs dark:border-[#1E293B] dark:bg-[#16202A]"
                        >
                          <div>
                            <div className="font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                              Parc. {d.numero}
                            </div>
                            <div className="text-[#64748B] dark:text-[#94A3B8]">
                              Venc. {formatDateBR(d.vencimento)}
                            </div>
                          </div>
                          <div className="font-mono font-semibold tabular-nums text-[#059669] dark:text-[#34D399]">
                            {formatBRL(d.valor)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'historico' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 dark:border-[#1E293B] dark:bg-[#111820]">
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={histQuery}
                onChange={(e) => setHistQuery(e.target.value)}
                placeholder="Buscar produto, fornecedor ou NF..."
                className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 pr-3 pl-9 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <input
              type="date"
              value={histFrom}
              onChange={(e) => setHistFrom(e.target.value)}
              className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
            <input
              type="date"
              value={histTo}
              onChange={(e) => setHistTo(e.target.value)}
              className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B] dark:border-[#1E293B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
                  <tr>
                    <th className="px-5 py-3">Data</th>
                    <th className="px-5 py-3">Produto</th>
                    <th className="px-5 py-3 text-right">Qtd</th>
                    <th className="px-5 py-3 text-right">Custo Unit.</th>
                    <th className="px-5 py-3">Fornecedor</th>
                    <th className="px-5 py-3">Referência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-10 text-center text-sm text-[#64748B] dark:text-[#94A3B8]"
                      >
                        Nenhuma entrada registrada neste filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((e) => (
                      <tr key={e.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#16202A]">
                        <td className="px-5 py-3 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                          {formatDateBR(e.data)}
                        </td>
                        <td className="px-5 py-3 font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                          {e.produtoNome}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums text-[#059669] dark:text-[#34D399]">
                          +{e.quantidade}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-xs tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                          {formatBRL(e.custoUnitario)}
                        </td>
                        <td className="px-5 py-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
                          {e.fornecedorNome || '—'}
                        </td>
                        <td className="px-5 py-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
                          {e.nfReferencia} · {e.origem.toUpperCase()}
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
