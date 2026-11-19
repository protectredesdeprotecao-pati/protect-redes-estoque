import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  BarChart3,
  LayoutDashboard,
  Package,
  ShoppingCart,
} from 'lucide-react';
import { AlertCenterDrawer } from './components/alerts/AlertCenterDrawer';
import { LoginScreen } from './components/auth/LoginScreen';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { CaixaPage } from './components/pages/CaixaPage';
import { ClientesPage } from './components/pages/ClientesPage';
import { CadastrosPage, UsuariosPage } from './components/pages/ConfigPage';
import { DuplicatasPage } from './components/pages/DuplicatasPage';
import { EntradasPage } from './components/pages/EntradasPage';
import { FiadoPage } from './components/pages/FiadoPage';
import { FornecedoresPage } from './components/pages/FornecedoresPage';
import { NFePage } from './components/pages/NFePage';
import { ObraPage } from './components/pages/ObraPage';
import { PainelPage } from './components/pages/PainelPage';
import { ProdutosPage } from './components/pages/ProdutosPage';
import { RelatoriosPage } from './components/pages/RelatoriosPage';
import { VendasPage } from './components/pages/VendasPage';
import { ThermalReceipt } from './components/print/ThermalReceipt';
import { ToastStack } from './components/ui/ToastStack';
import { StoreProvider, useStore } from './context/StoreContext';
import { AuthUser, PageId } from './types/erp';
import {
  AUTH_UNAUTHORIZED_EVENT,
  clearAuthToken,
  getAuthToken,
} from './utils/authClient';

const MOBILE_TABS: { id: PageId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'painel', label: 'Painel', icon: LayoutDashboard },
  { id: 'produtos', label: 'Produtos', icon: Package },
  { id: 'vendas', label: 'PDV', icon: ShoppingCart },
  { id: 'entradas', label: 'Entradas', icon: ArrowDownToLine },
  { id: 'relatorios', label: 'Analytics', icon: BarChart3 },
];

const AppShell: React.FC = () => {
  const { activePage, setActivePage, receiptToPrint } = useStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderPage = () => {
    switch (activePage) {
      case 'painel':
        return <PainelPage />;
      case 'produtos':
        return <ProdutosPage />;
      case 'fornecedores':
        return <FornecedoresPage />;
      case 'entradas':
        return <EntradasPage />;
      case 'vendas':
        return <VendasPage />;
      case 'obra':
        return <ObraPage />;
      case 'caixa':
        return <CaixaPage />;
      case 'duplicatas':
        return <DuplicatasPage />;
      case 'nfe':
        return <NFePage />;
      case 'clientes':
        return <ClientesPage />;
      case 'relatorios':
        return <RelatoriosPage />;
      case 'fiado':
        return <FiadoPage />;
      case 'cadastros':
        return <CadastrosPage />;
      case 'usuarios':
        return <UsuariosPage />;
      default:
        return <PainelPage />;
    }
  };

  return (
    <>
      <div className="no-print flex min-h-screen bg-[#F4F7F6] text-[#0F172A] transition-colors dark:bg-[#0B1115] dark:text-[#F1F5F9]">
        <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
          <Topbar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

          <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 pb-24 lg:px-7 lg:pb-8">
            {renderPage()}
          </main>
        </div>

        {/* Compact Mobile Bottom Navigation */}
        <nav
          aria-label="Navegação rápida móvel"
          className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-around border-t border-[#E2E8F0] bg-white px-2 lg:hidden dark:border-[#1E293B] dark:bg-[#111820]"
        >
          {MOBILE_TABS.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActivePage(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-1 text-[10px] font-semibold ${
                  active
                    ? 'text-[#0B3A2C] dark:text-[#34D399]'
                    : 'text-[#64748B] dark:text-[#94A3B8]'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-[#10B981]' : ''}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <AlertCenterDrawer />
        <ToastStack />
      </div>

      {/* Área exclusiva para impressão térmica (80mm / 58mm) */}
      <ThermalReceipt payload={receiptToPrint} />
    </>
  );
};

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const token = getAuthToken();
      const resp = await fetch('/api/auth/status', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) {
        setAuthUser(null);
        return;
      }
      const data = (await resp.json()) as {
        needsSetup?: boolean;
        authenticated?: boolean;
        user?: AuthUser | null;
      };
      setNeedsSetup(Boolean(data.needsSetup));
      if (data.authenticated && data.user) {
        setAuthUser(data.user);
      } else {
        clearAuthToken();
        setAuthUser(null);
      }
    } catch {
      setAuthUser(null);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    const onUnauthorized = () => {
      setAuthUser(null);
      void checkSession();
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
  }, [checkSession]);

  const handleLogout = useCallback(() => {
    clearAuthToken();
    setAuthUser(null);
    setNeedsSetup(false);
  }, []);

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090E12] text-sm font-medium text-[#94A3B8]">
        Verificando segurança da sessão...
      </div>
    );
  }

  if (!authUser) {
    return (
      <LoginScreen
        needsSetup={needsSetup}
        onAuthenticated={(user) => {
          setNeedsSetup(false);
          setAuthUser(user);
        }}
      />
    );
  }

  return (
    <StoreProvider authenticatedUser={authUser} onLogout={handleLogout}>
      <AppShell />
    </StoreProvider>
  );
}
