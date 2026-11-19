import React, { useMemo, useState } from 'react';
import { Edit3, Plus, Search, Trash2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Customer } from '../../types/erp';
import { formatBRL } from '../../utils/formatters';
import { SlideOver } from '../ui/SlideOver';

export const ClientesPage: React.FC = () => {
  const { customers, sales, saveCustomer, deleteCustomer } = useStore();
  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const [nome, setNome] = useState('');
  const [doc, setDoc] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cidade, setCidade] = useState('');
  const [endereco, setEndereco] = useState('');

  const openNew = () => {
    setEditing(null);
    setNome('');
    setDoc('');
    setTelefone('');
    setCidade('São Paulo');
    setEndereco('');
    setDrawerOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setNome(c.nome);
    setDoc(c.doc);
    setTelefone(c.telefone);
    setCidade(c.cidade);
    setEndereco(c.endereco ?? '');
    setDrawerOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    saveCustomer({
      id: editing?.id,
      nome: nome.trim(),
      doc: doc.trim(),
      telefone: telefone.trim(),
      cidade: cidade.trim(),
      endereco: endereco.trim() || undefined,
    });
    setDrawerOpen(false);
  };

  const customerTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sales) {
      if (s.status !== 'concluida') continue;
      map.set(s.clienteNome.toLowerCase(), (map.get(s.clienteNome.toLowerCase()) ?? 0) + s.total);
    }
    return map;
  }, [sales]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.doc.toLowerCase().includes(q) ||
        c.cidade.toLowerCase().includes(q)
    );
  }, [customers, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 dark:border-[#1E293B] dark:bg-[#111820]">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente, CPF/CNPJ ou cidade..."
            className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 pr-3 pl-9 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
          />
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#052E16] hover:bg-[#34D399]"
        >
          <Plus className="h-4 w-4" />
          Novo Cliente
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B] dark:border-[#1E293B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
              <tr>
                <th className="px-5 py-3">Nome / Razão Social</th>
                <th className="px-5 py-3">CPF / CNPJ</th>
                <th className="px-5 py-3">Telefone</th>
                <th className="px-5 py-3">Cidade</th>
                <th className="px-5 py-3 text-right">Total Compras</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#16202A]">
                  <td className="px-5 py-3">
                    <div className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">{c.nome}</div>
                    {c.endereco && (
                      <div className="text-xs text-[#64748B] dark:text-[#94A3B8]">{c.endereco}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {c.doc || '—'}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {c.telefone || '—'}
                  </td>
                  <td className="px-5 py-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {c.cidade || '—'}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums text-[#059669] dark:text-[#34D399]">
                    {formatBRL(customerTotals.get(c.nome.toLowerCase()) ?? 0)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="rounded p-1.5 text-[#64748B] hover:bg-[#F1F5F9] dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-white"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCustomer(c.id)}
                        className="rounded p-1.5 text-[#64748B] hover:bg-[#FEF2F2] hover:text-[#DC2626] dark:text-[#94A3B8] dark:hover:bg-[#EF4444]/15 dark:hover:text-[#F87171]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
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
        title={editing ? 'Editar Cliente' : 'Novo Cliente'}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B] dark:border-[#263442] dark:text-[#CBD5E1]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-cliente"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#052E16] hover:bg-[#34D399]"
            >
              Salvar Cliente
            </button>
          </>
        }
      >
        <form id="form-cliente" onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Nome *
            </label>
            <input
              required
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                CPF / CNPJ
              </label>
              <input
                type="text"
                value={doc}
                onChange={(e) => setDoc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Telefone
              </label>
              <input
                type="text"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Cidade
            </label>
            <input
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Endereço
            </label>
            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>
        </form>
      </SlideOver>
    </div>
  );
};
