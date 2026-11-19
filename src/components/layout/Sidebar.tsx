import React from 'react';
import {
  ArrowDownToLine,
  BarChart3,
  Building2,
  CreditCard,
  FileSpreadsheet,
  FileText,
  HardHat,
  LayoutDashboard,
  Lock,
  LogOut,
  Moon,
  Package,
  Settings,
  ShoppingCart,
  Sun,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { PageId } from '../../types/erp';

interface NavSection {
  label: string;
  items: { id: PageId; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Principal',
    items: [
      { id: 'painel', label: 'Painel & Alertas', icon: LayoutDashboard },
      { id: 'produtos', label: 'Produtos', icon: Package },
      { id: 'fornecedores', label: 'Fornecedores', icon: Building2 },
    ],
  },
  {
    label: 'Movimentações',
    items: [
      { id: 'entradas', label: 'Entrada Material', icon: ArrowDownToLine },
      { id: 'vendas', label: 'Vendas da Loja', icon: ShoppingCart },
      { id: 'obra', label: 'Saída Equipes', icon: HardHat },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { id: 'caixa', label: 'Caixa', icon: Wallet },
      { id: 'duplicatas', label: 'Duplicatas', icon: FileSpreadsheet },
      { id: 'fiado', label: 'Vendas Fiado', icon: CreditCard },
    ],
  },
  {
    label: 'Fiscal & Pessoas',
    items: [
      { id: 'nfe', label: 'NF-e & NFS-e', icon: FileText },
      { id: 'clientes', label: 'Clientes', icon: UserCheck },
    ],
  },
  {
    label: 'Inteligência & Config',
    items: [
      { id: 'relatorios', label: 'Painéis Analíticos', icon: BarChart3 },
      { id: 'cadastros', label: 'Cadastros & Regras', icon: Settings },
      { id: 'usuarios', label: 'Operadores', icon: Users },
    ],
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const {
    activePage,
    setActivePage,
    alerts,
    activeUser,
    logout,
    theme,
    toggleTheme,
  } = useStore();
  const criticalCount = alerts.filter((a) => a.severity === 'critico').length;

  const handleNav = (id: PageId) => {
    setActivePage(id);
    onCloseMobile();
  };

  const navContent = (
    <div className="flex h-full flex-col border-r border-[#1E293B] bg-[#0D151A] text-[#E2E8F0] dark:bg-[#090E12]">
      {/* Brand */}
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-4">
        <div className="min-w-0">
          <img
            src="/src/assets/images/protect_redes_logo_3d.png"
            alt="Protect Redes"
            referrerPolicy="no-referrer"
            className="h-10 w-auto object-contain drop-shadow-[0_4px_12px_rgba(16,185,129,0.22)]"
          />
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#34D399]/90">
            Estoque & Operações
          </div>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Fechar menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                const showAlertCount = item.id === 'painel' && criticalCount > 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNav(item.id)}
                    className={`flex w-full items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-[#10B981]/15 font-semibold text-[#34D399] ring-1 ring-inset ring-[#10B981]/30'
                        : 'text-[#94A3B8] hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#34D399]' : 'text-[#64748B]'}`} />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {showAlertCount && (
                      <span className="rounded bg-[#EF4444] px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-white">
                        {criticalCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Theme Toggle & Active Operator Selector */}
      <div className="space-y-3 border-t border-white/8 p-3">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-[#CBD5E1] transition-colors hover:bg-white/10 hover:text-white"
        >
          <span className="flex items-center gap-2">
            {theme === 'dark' ? (
              <Moon className="h-3.5 w-3.5 text-[#34D399]" />
            ) : (
              <Sun className="h-3.5 w-3.5 text-[#FBBF24]" />
            )}
            <span>{theme === 'dark' ? 'Modo Escuro' : 'Modo Claro'}</span>
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[#64748B]">Alternar</span>
        </button>

        <div className="rounded-xl border border-white/10 bg-[#16202A] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#34D399]">
                <Lock className="h-3 w-3 shrink-0" />
                <span>Sessão Protegida</span>
              </div>
              <div className="mt-0.5 truncate text-xs font-bold text-[#F1F5F9]">
                {activeUser.nome}
              </div>
              <div className="truncate text-[11px] text-[#94A3B8]">{activeUser.cargo}</div>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Bloquear tela / Trocar operador"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-semibold text-[#E2E8F0] transition-colors hover:border-[#EF4444]/40 hover:bg-[#EF4444]/15 hover:text-[#FCA5A5]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 shrink-0 lg:block">
        {navContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full w-64 shadow-xl">{navContent}</aside>
        </div>
      )}
    </>
  );
};
