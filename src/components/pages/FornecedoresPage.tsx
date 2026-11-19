import React, { useMemo, useState } from 'react';
import { Edit3, Plus, Search, Trash2 } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { Supplier } from '../../types/erp';
import { SlideOver } from '../ui/SlideOver';

export const FornecedoresPage: React.FC = () => {
  const { suppliers, saveSupplier, deleteSupplier } = useStore();
  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [contato, setContato] = useState('');
  const [telefone, setTelefone] = useState('');
  const [categoria, setCategoria] = useState('');
  const [endereco, setEndereco] = useState('');

  const openNew = () => {
    setEditing(null);
    setNome('');
    setCnpj('');
    setContato('');
    setTelefone('');
    setCategoria('');
    setEndereco('');
    setDrawerOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setNome(s.nome);
    setCnpj(s.cnpj);
    setContato(s.contato);
    setTelefone(s.telefone);
    setCategoria(s.categoria);
    setEndereco(s.endereco);
    setDrawerOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    saveSupplier({
      id: editing?.id,
      nome: nome.trim(),
      cnpj: cnpj.trim(),
      contato: contato.trim(),
      telefone: telefone.trim(),
      categoria: categoria.trim() || 'Geral',
      endereco: endereco.trim(),
    });
    setDrawerOpen(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.nome.toLowerCase().includes(q) ||
        s.cnpj.toLowerCase().includes(q) ||
        s.contato.toLowerCase().includes(q) ||
        s.categoria.toLowerCase().includes(q)
    );
  }, [query, suppliers]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 dark:border-[#1E293B] dark:bg-[#111820]">
        <div className="relative min-w-[240px] max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar fornecedor, CNPJ ou contato..."
            className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] py-2 pr-3 pl-9 text-sm text-[#0F172A] focus:border-[#10B981] focus:outline-none dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
          />
        </div>

        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#052E16] hover:bg-[#34D399]"
        >
          <Plus className="h-4 w-4" />
          Novo Fornecedor
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B] dark:border-[#1E293B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
              <tr>
                <th className="px-5 py-3">Fornecedor</th>
                <th className="px-5 py-3">CNPJ</th>
                <th className="px-5 py-3">Contato</th>
                <th className="px-5 py-3">Telefone</th>
                <th className="px-5 py-3">Categoria</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
                    Nenhum fornecedor encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#16202A]">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">{s.nome}</div>
                      {s.endereco && (
                        <div className="text-xs text-[#64748B] dark:text-[#94A3B8]">{s.endereco}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                      {s.cnpj || '—'}
                    </td>
                    <td className="px-5 py-3 text-[#0F172A] dark:text-[#CBD5E1]">
                      {s.contato || '—'}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                      {s.telefone || '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
                      {s.categoria}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          className="rounded-md p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-white"
                          title="Editar"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSupplier(s.id)}
                          className="rounded-md p-1.5 text-[#64748B] hover:bg-[#FEF2F2] hover:text-[#DC2626] dark:text-[#94A3B8] dark:hover:bg-[#EF4444]/15 dark:hover:text-[#F87171]"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      <SlideOver
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}
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
              form="form-fornecedor"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#052E16] hover:bg-[#34D399]"
            >
              Salvar
            </button>
          </>
        }
      >
        <form id="form-fornecedor" onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Nome / Razão Social *
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
                CNPJ
              </label>
              <input
                type="text"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
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
                placeholder="(11) 99999-9999"
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Contato
              </label>
              <input
                type="text"
                value={contato}
                onChange={(e) => setContato(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Categoria
              </label>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Redes, Ferragens..."
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
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
