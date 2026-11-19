import React from 'react';
import { Bell, Lock, Menu, Moon, Plus, ShoppingCart, Sun } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { PageId } from '../../types/erp';

const PAGE_TITLES: Record<PageId, { title: string; section: string }> = {
  painel: { section: 'Principal', title: 'Painel & Central de Alertas' },
  produtos: { section: 'Principal', title: 'Catálogo de Produtos' },
  fornecedores: { section: 'Principal', title: 'Fornecedores' },
  entradas: { section: 'Movimentações', title: 'Entrada de Material' },
  vendas: { section: 'Movimentações', title: 'Vendas da Loja (PDV)' },
  obra: { section: 'Movimentações', title: 'Saída Equipes' },
  caixa: { section: 'Financeiro', title: 'Fluxo de Caixa' },
  duplicatas: { section: 'Financeiro', title: 'Duplicatas a Pagar' },
  fiado: { section: 'Financeiro', title: 'Vendas Fiado' },
  nfe: { section: 'Fiscal', title: 'Notas Fiscais (NF-e Produto & NFS-e Serviço)' },
  clientes: { section: 'Pessoas', title: 'Clientes' },
  relatorios: { section: 'Inteligência', title: 'Painéis Analíticos' },
  cadastros: { section: 'Configuração', title: 'Categorias & Regras de Alerta' },
  usuarios: { section: 'Configuração', title: 'Operadores do Sistema' },
};

interface TopbarProps {
  onOpenMobileMenu: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ onOpenMobileMenu }) => {
  const {
    activePage,
    setActivePage,
    alerts,
    unreadAlertCount,
    setAlertDrawerOpen,
    theme,
    toggleTheme,
    logout,
  } = useStore();

  const meta = PAGE_TITLES[activePage];
  const hasCritical = alerts.some((a) => a.severity === 'critico');

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-[#E2E8F0] bg-white/95 px-4 backdrop-blur-sm lg:px-7 dark:border-[#1E293B] dark:bg-[#0D151A]/95">
      {/* Left: Breadcrumb */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC] lg:hidden dark:border-[#1E293B] dark:text-[#F1F5F9] dark:hover:bg-[#16202A]"
          aria-label="Abrir menu"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="hidden whitespace-nowrap text-[#64748B] sm:inline dark:text-[#94A3B8]">
            {meta.section}
          </span>
          <span className="hidden text-[#CBD5E1] sm:inline dark:text-[#334155]" aria-hidden="true">
            /
          </span>
          <h2 className="truncate font-display text-base font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            {meta.title}
          </h2>
        </div>
      </div>

      {/* Right: Lock + Theme Toggle + Real-time Alert Trigger + Primary Action */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={logout}
          title="Bloquear tela / Trocar operador"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-xs font-semibold text-[#64748B] transition-colors hover:bg-[#FEF2F2] hover:text-[#DC2626] dark:border-[#1E293B] dark:bg-[#111820] dark:text-[#94A3B8] dark:hover:bg-[#EF4444]/15 dark:hover:text-[#FCA5A5]"
        >
          <Lock className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Bloquear</span>
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          aria-label={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] dark:border-[#1E293B] dark:bg-[#111820] dark:text-[#94A3B8] dark:hover:bg-[#16202A] dark:hover:text-[#F1F5F9]"
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-[#FBBF24]" /> : <Moon className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => setAlertDrawerOpen(true)}
          className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            hasCritical
              ? 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FEE2E2] dark:border-[#EF4444]/30 dark:bg-[#EF4444]/10 dark:text-[#FCA5A5] dark:hover:bg-[#EF4444]/20'
              : 'border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8FAFC] dark:border-[#1E293B] dark:bg-[#111820] dark:text-[#F1F5F9] dark:hover:bg-[#16202A]'
          }`}
          aria-label="Abrir central de alertas em tempo real"
        >
          <Bell className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Alertas</span>
          <span
            className={`rounded-md px-1.5 py-0.5 font-display text-[11px] font-bold tabular-nums ${
              hasCritical
                ? 'bg-[#DC2626] text-white'
                : alerts.length > 0
                  ? 'bg-[#D97706] text-white'
                  : 'bg-[#F1F5F9] text-[#64748B] dark:bg-[#1E293B] dark:text-[#94A3B8]'
            }`}
          >
            {alerts.length > 0 ? alerts.length : unreadAlertCount}
          </span>
        </button>

        {activePage !== 'vendas' ? (
          <button
            type="button"
            onClick={() => setActivePage('vendas')}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#10B981] px-3.5 py-1.5 text-xs font-semibold text-[#052E16] transition-colors hover:bg-[#34D399]"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>Abrir PDV</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setActivePage('entradas')}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#10B981] px-3.5 py-1.5 text-xs font-semibold text-[#052E16] transition-colors hover:bg-[#34D399]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nova Entrada</span>
          </button>
        )}
      </div>
    </header>
  );
};
