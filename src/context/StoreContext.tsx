import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertEventLog,
  AlertSettings,
  AppUser,
  AuthUser,
  CashMovement,
  Customer,
  Duplicata,
  NFeConfig,
  NFeRecord,
  NFSeRecord,
  ObraWithdrawal,
  ObraWithdrawalItem,
  PageId,
  PaymentMethod,
  Product,
  RealTimeAlert,
  Sale,
  SaleItem,
  StockEntry,
  Supplier,
  ToastMessage,
} from '../types/erp';
import {
  DEFAULT_ALERT_SETTINGS,
  DEFAULT_NFE_CONFIG,
  SEED_CASH,
  SEED_CATEGORIES,
  SEED_CUSTOMERS,
  SEED_DUPLICATAS,
  SEED_ENTRIES,
  SEED_NFES,
  SEED_NFSES,
  SEED_OBRA,
  SEED_PRODUCTS,
  SEED_SALES,
  SEED_SUPPLIERS,
  SEED_USERS,
} from '../data/seedData';
import { ReceiptPrintPayload } from '../components/print/ThermalReceipt';
import { evaluateRealTimeAlerts } from '../utils/alertEngine';
import { authFetch } from '../utils/authClient';
import { formatBRL, ParsedXMLNFe, todayISO } from '../utils/formatters';

const STORAGE_KEY = 'protect_redes_erp_v3';

export interface SupabaseStatus {
  configured: boolean;
  url: string;
  maskedKey: string;
  cloudStateReady: boolean;
  syncing: boolean;
  lastSyncAt?: string;
}

const LEGACY_DEMO_IDS = new Set([
  'prod-1', 'prod-2', 'prod-3', 'prod-4', 'prod-5', 'prod-6', 'prod-7', 'prod-8', 'prod-9', 'prod-10',
  'forn-1', 'forn-2', 'forn-3',
  'cli-1', 'cli-2', 'cli-3', 'cli-4',
  'sale-1', 'sale-2', 'sale-3', 'sale-4', 'sale-5',
  'obra-1', 'obra-2', 'obra-3',
  'ent-1', 'ent-2',
  'cx-1', 'cx-2', 'cx-3', 'cx-4', 'cx-5',
  'dup-1', 'dup-2', 'dup-3', 'dup-4', 'dup-5',
  'nfe-1', 'nfe-2', 'nfe-3',
  'usr-1', 'usr-2', 'usr-3',
]);

interface PersistedState {
  categories: string[];
  products: Product[];
  suppliers: Supplier[];
  customers: Customer[];
  entries: StockEntry[];
  sales: Sale[];
  obras: ObraWithdrawal[];
  cash: CashMovement[];
  duplicatas: Duplicata[];
  nfes: NFeRecord[];
  nfses: NFSeRecord[];
  nfeConfig: NFeConfig;
  users: AppUser[];
  activeUserId: string;
  alertSettings: AlertSettings;
  dismissedAlertIds: string[];
  theme?: 'dark' | 'light';
  cleanedDemoSeed?: boolean;
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      const stripDemo = !parsed.cleanedDemoSeed;
      const keepNonDemo = <T extends { id: string }>(arr: T[] | undefined, fallback: T[]): T[] => {
        const list = arr ?? fallback;
        return stripDemo ? list.filter((item) => !LEGACY_DEMO_IDS.has(item.id)) : list;
      };

      const cleanedUsers = keepNonDemo(parsed.users, SEED_USERS);
      const users = cleanedUsers.length > 0 ? cleanedUsers : SEED_USERS;
      const activeUserId = users.some((u) => u.id === parsed.activeUserId)
        ? (parsed.activeUserId as string)
        : users[0].id;

      return {
        categories: parsed.categories ?? SEED_CATEGORIES,
        products: keepNonDemo(parsed.products, SEED_PRODUCTS),
        suppliers: keepNonDemo(parsed.suppliers, SEED_SUPPLIERS),
        customers: keepNonDemo(parsed.customers, SEED_CUSTOMERS),
        entries: keepNonDemo(parsed.entries, SEED_ENTRIES),
        sales: keepNonDemo(parsed.sales, SEED_SALES),
        obras: keepNonDemo(parsed.obras, SEED_OBRA),
        cash: keepNonDemo(parsed.cash, SEED_CASH),
        duplicatas: keepNonDemo(parsed.duplicatas, SEED_DUPLICATAS),
        nfes: keepNonDemo(parsed.nfes, SEED_NFES),
        nfses: parsed.nfses ?? SEED_NFSES,
        nfeConfig: {
          ...DEFAULT_NFE_CONFIG,
          ...(parsed.nfeConfig ?? {}),
          cnpjPrestador: parsed.nfeConfig?.cnpjPrestador || DEFAULT_NFE_CONFIG.cnpjPrestador,
          inscricaoMunicipal:
            !parsed.nfeConfig?.inscricaoMunicipal ||
            parsed.nfeConfig.inscricaoMunicipal === '53254996'
              ? DEFAULT_NFE_CONFIG.inscricaoMunicipal
              : parsed.nfeConfig.inscricaoMunicipal,
          inscricaoEstadual:
            parsed.nfeConfig?.inscricaoEstadual || DEFAULT_NFE_CONFIG.inscricaoEstadual,
          serie:
            !parsed.nfeConfig?.serie || parsed.nfeConfig.serie === '70000'
              ? DEFAULT_NFE_CONFIG.serie
              : parsed.nfeConfig.serie,
          nfseSefinUrl: (
            parsed.nfeConfig?.nfseSefinUrl ?? DEFAULT_NFE_CONFIG.nfseSefinUrl ?? ''
          ).replace('/API/SefinNacional', '/SefinNacional'),
          enderecoEmitente: {
            ...DEFAULT_NFE_CONFIG.enderecoEmitente!,
            ...(parsed.nfeConfig?.enderecoEmitente ?? {}),
          },
        },
        users,
        activeUserId,
        alertSettings: parsed.alertSettings ?? DEFAULT_ALERT_SETTINGS,
        dismissedAlertIds: stripDemo ? [] : (parsed.dismissedAlertIds ?? []),
        theme: parsed.theme ?? 'dark',
        cleanedDemoSeed: true,
      };
    }
  } catch {
    // Fallback to clean empty state if storage is unreadable
  }
  return {
    categories: SEED_CATEGORIES,
    products: SEED_PRODUCTS,
    suppliers: SEED_SUPPLIERS,
    customers: SEED_CUSTOMERS,
    entries: SEED_ENTRIES,
    sales: SEED_SALES,
    obras: SEED_OBRA,
    cash: SEED_CASH,
    duplicatas: SEED_DUPLICATAS,
    nfes: SEED_NFES,
    nfses: SEED_NFSES,
    nfeConfig: DEFAULT_NFE_CONFIG,
    users: SEED_USERS,
    activeUserId: SEED_USERS[0].id,
    alertSettings: DEFAULT_ALERT_SETTINGS,
    dismissedAlertIds: [],
    theme: 'dark',
    cleanedDemoSeed: true,
  };
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface StoreContextValue {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  alertDrawerOpen: boolean;
  setAlertDrawerOpen: (open: boolean) => void;
  quickRestockProductId: string | null;
  setQuickRestockProductId: (id: string | null) => void;

  // Data
  categories: string[];
  products: Product[];
  suppliers: Supplier[];
  customers: Customer[];
  entries: StockEntry[];
  sales: Sale[];
  obras: ObraWithdrawal[];
  cash: CashMovement[];
  duplicatas: Duplicata[];
  nfes: NFeRecord[];
  nfses: NFSeRecord[];
  nfeConfig: NFeConfig;
  users: AppUser[];
  // Auth & Print & Fiscal Cert
  activeUser: AppUser;
  authenticatedUser: AuthUser;
  logout: () => void;
  certLoaded: boolean;
  refreshCertStatus: () => Promise<boolean>;
  receiptToPrint: ReceiptPrintPayload | null;
  printSaleReceipt: (sale: Sale, nfe?: NFeRecord) => void;

  // Real-time Alerts & Toasts
  alertSettings: AlertSettings;
  alerts: RealTimeAlert[];
  unreadAlertCount: number;
  alertLogs: AlertEventLog[];
  lastAlertScan: string;
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  dismissAlert: (alertId: string) => void;
  restoreDismissedAlerts: () => void;
  markAllAlertsRead: () => void;
  runAlertScan: (manual?: boolean) => void;
  updateAlertSettings: (patch: Partial<AlertSettings>) => void;

  // Products
  saveProduct: (product: Omit<Product, 'id' | 'updatedAt'> & { id?: string }) => void;
  deleteProduct: (id: string) => void;
  adjustStock: (productId: string, delta: number, reason?: string) => void;

  // Suppliers
  saveSupplier: (supplier: Omit<Supplier, 'id'> & { id?: string }) => void;
  deleteSupplier: (id: string) => void;

  // Customers
  saveCustomer: (customer: Omit<Customer, 'id'> & { id?: string }) => void;
  deleteCustomer: (id: string) => void;

  // Entries
  registerManualEntry: (payload: {
    produtoId: string;
    quantidade: number;
    custoUnitario: number;
    fornecedorId?: string;
    data: string;
    nfReferencia: string;
    observacao?: string;
  }) => void;
  importXMLNFe: (parsed: ParsedXMLNFe) => { addedEntries: number; addedDuplicatas: number };

  // Sales (PDV)
  finalizeSale: (payload: {
    clienteNome: string;
    clienteDoc?: string;
    itens: SaleItem[];
    desconto: number;
    formaPagamento: PaymentMethod;
    valorRecebido?: number;
    troco?: number;
  }) => Sale | null;
  cancelSale: (saleId: string) => void;
  settleFiadoSale: (saleId: string, formaPagamento: 'dinheiro' | 'pix' | 'credito' | 'debito') => void;

  // Obra Withdrawals
  registerObraWithdrawal: (payload: {
    destino: string;
    responsavel: string;
    data: string;
    observacao?: string;
    itens: ObraWithdrawalItem[];
    clienteNome?: string;
    clienteDoc?: string;
    valorServico?: number;
    formaRecebimentoCaixa?: '' | 'dinheiro' | 'pix' | 'credito' | 'debito';
    gerarNfse?: boolean;
  }) => { withdrawal: ObraWithdrawal; nfse?: NFSeRecord } | null;
  createNFSeFromObra: (obraId: string) => NFSeRecord | null;
  deleteObraWithdrawal: (id: string) => void;

  // Cash
  addManualCashMovement: (payload: {
    data: string;
    descricao: string;
    clienteOuOrigem: string;
    formaPagamento: string;
    tipo: 'entrada' | 'saida';
    valor: number;
  }) => void;

  // Duplicatas
  saveDuplicata: (payload: Omit<Duplicata, 'id' | 'status'>) => void;
  payDuplicata: (id: string, dataPagamento: string, formaPagamento: Duplicata['formaPagamento']) => void;
  deleteDuplicata: (id: string) => void;

  // NF-e & NFS-e
  emitNFe: (payload: {
    clienteNome: string;
    clienteDoc: string;
    valor: number;
    vendaId?: string;
    modelo?: '55' | '65';
    itensSnapshot?: SaleItem[];
    desconto?: number;
    formaPagamento?: PaymentMethod;
  }) => NFeRecord;
  emitAndTransmitProductNote: (payload: {
    clienteNome: string;
    clienteDoc: string;
    valor: number;
    vendaId?: string;
    modelo?: '55' | '65';
    itensSnapshot?: SaleItem[];
    desconto?: number;
    formaPagamento?: PaymentMethod;
    autoTransmit?: boolean;
  }) => Promise<NFeRecord>;
  transmitExistingNFe: (id: string) => Promise<NFeRecord | null>;
  retryNFe: (id: string) => void;
  emitNFSe: (
    payload: Omit<NFSeRecord, 'id' | 'numeroDps' | 'data' | 'status' | 'chaveNfse'>
  ) => NFSeRecord;
  transmitNFSeAuto: (record: NFSeRecord) => Promise<boolean>;
  retryNFSe: (id: string) => void;
  updateNFSeStatus: (
    id: string,
    status: NFSeRecord['status'],
    extra?: { chaveNfse?: string; motivoRejeicao?: string }
  ) => void;
  updateNFeConfig: (cfg: NFeConfig) => void;

  // Categories, Users & Backup
  addCategory: (name: string) => void;
  deleteCategory: (name: string) => void;
  saveUser: (user: Omit<AppUser, 'id'> & { id?: string }) => void;
  deleteUser: (id: string) => void;
  switchActiveUser: (id: string) => void;
  exportBackupJSON: () => string;
  importBackupJSON: (rawJson: string) => boolean;
  resetDemoData: () => void;

  // Supabase Cloud Sync
  supabaseStatus: SupabaseStatus;
  connectSupabase: (
    url: string,
    apiKey: string
  ) => Promise<{ ok: boolean; error?: string; productCount?: number }>;
  disconnectSupabase: () => Promise<void>;
  syncFromSupabase: (silent?: boolean) => Promise<boolean>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

interface StoreProviderProps {
  children: React.ReactNode;
  authenticatedUser: AuthUser;
  onLogout: () => void;
}

export const StoreProvider: React.FC<StoreProviderProps> = ({
  children,
  authenticatedUser,
  onLogout,
}) => {
  const [state, setState] = useState<PersistedState>(loadInitialState);
  const [activePage, setActivePage] = useState<PageId>('painel');
  const [alertDrawerOpen, setAlertDrawerOpen] = useState(false);
  const [quickRestockProductId, setQuickRestockProductId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertEventLog[]>([]);
  const [lastAlertScan, setLastAlertScan] = useState<string>(() => new Date().toISOString());
  const [certLoaded, setCertLoaded] = useState(false);
  const [receiptToPrint, setReceiptToPrint] = useState<ReceiptPrintPayload | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus>({
    configured: false,
    url: '',
    maskedKey: '',
    cloudStateReady: false,
    syncing: false,
  });

  const supabaseStatusRef = useRef(supabaseStatus);
  supabaseStatusRef.current = supabaseStatus;
  const suppliersRef = useRef(state.suppliers);
  suppliersRef.current = state.suppliers;
  const prevProductsRef = useRef<Product[]>(state.products);
  const isApplyingRemoteProductsRef = useRef(false);
  const isApplyingRemoteStateRef = useRef(false);
  const lastRemoteSyncMsRef = useRef(0);

  const theme: 'dark' | 'light' = state.theme ?? 'dark';

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setState((prev) => ({
      ...prev,
      theme: (prev.theme ?? 'dark') === 'dark' ? 'light' : 'dark',
    }));
  }, []);

  // Persist changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
  }, [state]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = uid('toast');
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      window.setTimeout(() => {
        dismissToast(id);
      }, 4500);
    },
    [dismissToast]
  );

  // Evaluate all active alerts from live state
  const rawAlerts = useMemo(
    () =>
      evaluateRealTimeAlerts({
        products: state.products,
        duplicatas: state.duplicatas,
        nfes: state.nfes,
        nfses: state.nfses,
        sales: state.sales,
        settings: state.alertSettings,
      }),
    [state.products, state.duplicatas, state.nfes, state.nfses, state.sales, state.alertSettings]
  );

  const alerts = useMemo(
    () => rawAlerts.filter((a) => !state.dismissedAlertIds.includes(a.id)),
    [rawAlerts, state.dismissedAlertIds]
  );

  // Detect newly triggered alerts in real time
  const knownAlertIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const currentIds = new Set(alerts.map((a) => a.id));
    if (knownAlertIdsRef.current === null) {
      knownAlertIdsRef.current = currentIds;
      setAlertLogs(
        alerts.map((a) => ({
          id: uid('alog'),
          alertId: a.id,
          severity: a.severity,
          titulo: a.titulo,
          mensagem: a.mensagem,
          timestamp: a.timestamp,
          lido: false,
        }))
      );
      return;
    }

    const newlyFired = alerts.filter((a) => !knownAlertIdsRef.current!.has(a.id));
    if (newlyFired.length > 0) {
      const nowIso = new Date().toISOString();
      setLastAlertScan(nowIso);
      setAlertLogs((prev) => [
        ...newlyFired.map((a) => ({
          id: uid('alog'),
          alertId: a.id,
          severity: a.severity,
          titulo: a.titulo,
          mensagem: a.mensagem,
          timestamp: nowIso,
          lido: false,
        })),
        ...prev.slice(0, 49),
      ]);

      if (state.alertSettings.notificacoesEmTempoReal) {
        const first = newlyFired[0];
        pushToast({
          type: first.severity === 'critico' ? 'erro' : 'aviso',
          title: `Alerta em tempo real: ${first.titulo}`,
          description: first.mensagem,
        });
      }
    }
    knownAlertIdsRef.current = currentIds;
  }, [alerts, pushToast, state.alertSettings.notificacoesEmTempoReal]);

  // Periodic automatic scan heartbeat
  useEffect(() => {
    if (!state.alertSettings.monitoramentoAutomatico) return;
    const timer = window.setInterval(() => {
      setLastAlertScan(new Date().toISOString());
    }, 30000);
    return () => window.clearInterval(timer);
  }, [state.alertSettings.monitoramentoAutomatico]);

  const runAlertScan = useCallback(
    (manual = false) => {
      setLastAlertScan(new Date().toISOString());
      if (manual) {
        pushToast({
          type: alerts.some((a) => a.severity === 'critico') ? 'aviso' : 'sucesso',
          title: 'Varredura concluída',
          description:
            alerts.length > 0
              ? `${alerts.length} alerta(s) ativo(s) monitorado(s) no momento.`
              : 'Nenhum alerta crítico ou pendente detectado.',
        });
      }
    },
    [alerts, pushToast]
  );

  const dismissAlert = useCallback((alertId: string) => {
    setState((prev) => ({
      ...prev,
      dismissedAlertIds: prev.dismissedAlertIds.includes(alertId)
        ? prev.dismissedAlertIds
        : [...prev.dismissedAlertIds, alertId],
    }));
    setAlertLogs((prev) => prev.map((l) => (l.alertId === alertId ? { ...l, lido: true } : l)));
  }, []);

  const restoreDismissedAlerts = useCallback(() => {
    setState((prev) => ({ ...prev, dismissedAlertIds: [] }));
    pushToast({ type: 'info', title: 'Alertas restaurados', description: 'Todos os alertas ativos voltaram à lista.' });
  }, [pushToast]);

  const markAllAlertsRead = useCallback(() => {
    setAlertLogs((prev) => prev.map((l) => ({ ...l, lido: true })));
  }, []);

  const updateAlertSettings = useCallback(
    (patch: Partial<AlertSettings>) => {
      setState((prev) => ({
        ...prev,
        alertSettings: { ...prev.alertSettings, ...patch },
      }));
      pushToast({ type: 'sucesso', title: 'Regras de alerta atualizadas' });
    },
    [pushToast]
  );

  const activeUser: AppUser = useMemo(
    () => ({
      id: authenticatedUser.id,
      nome: authenticatedUser.nome,
      login: authenticatedUser.login,
      senha: '••••••',
      cargo: authenticatedUser.cargo,
      ativo: authenticatedUser.ativo,
    }),
    [authenticatedUser]
  );

  const refreshCertStatus = useCallback(async () => {
    try {
      const resp = await authFetch('/api/fiscal/certificado/status');
      if (!resp.ok) {
        setCertLoaded(false);
        return false;
      }
      const data = (await resp.json()) as { loaded?: boolean; expired?: boolean };
      const ok = Boolean(data.loaded && !data.expired);
      setCertLoaded(ok);
      return ok;
    } catch {
      setCertLoaded(false);
      return false;
    }
  }, []);

  useEffect(() => {
    void refreshCertStatus();
  }, [refreshCertStatus]);

  // Supabase sync helpers
  const syncFromSupabase = useCallback(
    async (silent = false): Promise<boolean> => {
      setSupabaseStatus((prev) => ({ ...prev, syncing: true }));
      try {
        const prodResp = await authFetch('/api/supabase/produtos');
        if (!prodResp.ok) {
          if (!silent) {
            const errData = (await prodResp.json().catch(() => ({}))) as { error?: string };
            pushToast({
              type: 'erro',
              title: 'Falha ao sincronizar com Supabase',
              description: errData.error || 'Verifique a conexão nas configurações.',
            });
          }
          setSupabaseStatus((prev) => ({ ...prev, syncing: false }));
          return false;
        }

        const prodData = (await prodResp.json()) as {
          products?: Array<Product & { fornecedorNome?: string }>;
        };
        const remoteProducts = Array.isArray(prodData.products) ? prodData.products : [];

        let remoteCloudState: Partial<PersistedState> | null = null;
        let cloudStateReady = supabaseStatusRef.current.cloudStateReady;
        try {
          const stateResp = await authFetch('/api/supabase/state');
          if (stateResp.ok) {
            const stateJson = (await stateResp.json()) as {
              tableMissing?: boolean;
              state?: Partial<PersistedState> | null;
            };
            cloudStateReady = !stateJson.tableMissing;
            if (!stateJson.tableMissing && stateJson.state && typeof stateJson.state === 'object') {
              remoteCloudState = stateJson.state;
            }
          }
        } catch {
          // Optional cloud state table
        }

        isApplyingRemoteProductsRef.current = true;
        if (remoteCloudState) {
          isApplyingRemoteStateRef.current = true;
        }

        setState((prev) => {
          const existingById = new Map(prev.products.map((p) => [p.id, p]));
          const baseSuppliers = Array.isArray(remoteCloudState?.suppliers)
            ? remoteCloudState.suppliers
            : prev.suppliers;
          const supplierByName = new Map(
            baseSuppliers.map((s) => [s.nome.trim().toLowerCase(), s.id])
          );

          const mergedProducts: Product[] = remoteProducts.map((rp) => {
            const existing = existingById.get(rp.id);
            const matchedSupplierId = rp.fornecedorNome
              ? supplierByName.get(rp.fornecedorNome.trim().toLowerCase())
              : undefined;
            return {
              id: rp.id,
              codigo: rp.codigo,
              nome: rp.nome,
              categoria: rp.categoria,
              unidade: rp.unidade,
              custo: rp.custo,
              venda: rp.venda,
              saldo: rp.saldo,
              minimo: rp.minimo,
              codBarras: rp.codBarras || existing?.codBarras || '',
              ncm: rp.ncm || existing?.ncm || '56081900',
              cfop: rp.cfop || existing?.cfop || '5102',
              csosn: existing?.csosn || rp.csosn || '102',
              fornecedorId: existing?.fornecedorId || matchedSupplierId,
              imagem: rp.imagem || existing?.imagem,
              updatedAt: rp.updatedAt || new Date().toISOString(),
            };
          });

          const baseCategories = Array.isArray(remoteCloudState?.categories)
            ? remoteCloudState.categories
            : prev.categories;
          const catSet = new Set(baseCategories);
          for (const mp of mergedProducts) {
            if (mp.categoria && !catSet.has(mp.categoria)) {
              catSet.add(mp.categoria);
            }
          }

          prevProductsRef.current = mergedProducts;

          return {
            ...prev,
            ...(remoteCloudState
              ? {
                  suppliers: Array.isArray(remoteCloudState.suppliers)
                    ? remoteCloudState.suppliers
                    : prev.suppliers,
                  customers: Array.isArray(remoteCloudState.customers)
                    ? remoteCloudState.customers
                    : prev.customers,
                  entries: Array.isArray(remoteCloudState.entries)
                    ? remoteCloudState.entries
                    : prev.entries,
                  sales: Array.isArray(remoteCloudState.sales)
                    ? remoteCloudState.sales
                    : prev.sales,
                  obras: Array.isArray(remoteCloudState.obras)
                    ? remoteCloudState.obras
                    : prev.obras,
                  cash: Array.isArray(remoteCloudState.cash)
                    ? remoteCloudState.cash
                    : prev.cash,
                  duplicatas: Array.isArray(remoteCloudState.duplicatas)
                    ? remoteCloudState.duplicatas
                    : prev.duplicatas,
                  nfes: Array.isArray(remoteCloudState.nfes)
                    ? remoteCloudState.nfes
                    : prev.nfes,
                  nfses: Array.isArray(remoteCloudState.nfses)
                    ? remoteCloudState.nfses
                    : prev.nfses,
                  nfeConfig: remoteCloudState.nfeConfig
                    ? {
                        ...DEFAULT_NFE_CONFIG,
                        ...prev.nfeConfig,
                        ...remoteCloudState.nfeConfig,
                        enderecoEmitente: {
                          ...DEFAULT_NFE_CONFIG.enderecoEmitente!,
                          ...(prev.nfeConfig.enderecoEmitente ?? {}),
                          ...(remoteCloudState.nfeConfig.enderecoEmitente ?? {}),
                        },
                      }
                    : prev.nfeConfig,
                  alertSettings: remoteCloudState.alertSettings ?? prev.alertSettings,
                }
              : {}),
            categories: Array.from(catSet),
            products: mergedProducts,
            cleanedDemoSeed: true,
          };
        });

        const nowSync = new Date().toISOString();
        lastRemoteSyncMsRef.current = Date.now();
        setSupabaseStatus((prev) => ({
          ...prev,
          configured: true,
          cloudStateReady,
          syncing: false,
          lastSyncAt: nowSync,
        }));

        if (!silent) {
          pushToast({
            type: 'sucesso',
            title: 'Supabase sincronizado!',
            description: `${remoteProducts.length} produto(s) carregado(s) do seu banco na nuvem.`,
          });
        }
        return true;
      } catch {
        setSupabaseStatus((prev) => ({ ...prev, syncing: false }));
        return false;
      }
    },
    [pushToast]
  );

  const connectSupabase = useCallback(
    async (
      url: string,
      apiKey: string
    ): Promise<{ ok: boolean; error?: string; productCount?: number }> => {
      try {
        const resp = await authFetch('/api/supabase/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, apiKey }),
        });
        const data = (await resp.json()) as {
          ok?: boolean;
          error?: string;
          url?: string;
          maskedKey?: string;
          cloudStateReady?: boolean;
          productCount?: number;
        };
        if (!resp.ok || !data.ok) {
          return { ok: false, error: data.error || 'Falha ao conectar no Supabase.' };
        }
        setSupabaseStatus({
          configured: true,
          url: data.url || url,
          maskedKey: data.maskedKey || '••••••',
          cloudStateReady: Boolean(data.cloudStateReady),
          syncing: false,
        });
        await syncFromSupabase(false);
        return { ok: true, productCount: data.productCount };
      } catch {
        return { ok: false, error: 'Erro de rede ao conectar ao servidor.' };
      }
    },
    [syncFromSupabase]
  );

  const disconnectSupabase = useCallback(async () => {
    await authFetch('/api/supabase/config', { method: 'DELETE' });
    setSupabaseStatus({
      configured: false,
      url: '',
      maskedKey: '',
      cloudStateReady: false,
      syncing: false,
    });
    pushToast({ type: 'info', title: 'Conexão com Supabase desconectada' });
  }, [pushToast]);

  // Check Supabase on startup and pull products automatically if connected
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const resp = await authFetch('/api/supabase/status');
        if (!resp.ok || !active) return;
        const data = (await resp.json()) as {
          configured?: boolean;
          url?: string;
          maskedKey?: string;
          cloudStateReady?: boolean;
        };
        if (!active) return;
        if (data.configured) {
          setSupabaseStatus({
            configured: true,
            url: data.url || '',
            maskedKey: data.maskedKey || '',
            cloudStateReady: Boolean(data.cloudStateReady),
            syncing: false,
          });
          await syncFromSupabase(true);
        }
      } catch {
        // Ignore startup check failure
      }
    })();
    return () => {
      active = false;
    };
  }, [syncFromSupabase]);

  // Refresh products when returning focus to this browser tab (multi-machine freshness)
  useEffect(() => {
    const onFocus = () => {
      if (!supabaseStatusRef.current.configured || supabaseStatusRef.current.syncing) return;
      if (Date.now() - lastRemoteSyncMsRef.current < 10000) return;
      void syncFromSupabase(true);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [syncFromSupabase]);

  // Auto-push any local product/stock change (cadastro, edição, venda, entrada, saída equipe) to Supabase
  useEffect(() => {
    if (isApplyingRemoteProductsRef.current) {
      isApplyingRemoteProductsRef.current = false;
      prevProductsRef.current = state.products;
      return;
    }
    if (!supabaseStatusRef.current.configured) {
      prevProductsRef.current = state.products;
      return;
    }

    const prevMap = new Map(prevProductsRef.current.map((p) => [p.id, p]));
    const nextIds = new Set(state.products.map((p) => p.id));

    const changed: Array<Product & { fornecedorNome?: string }> = [];
    for (const p of state.products) {
      const old = prevMap.get(p.id);
      if (
        !old ||
        old.updatedAt !== p.updatedAt ||
        old.saldo !== p.saldo ||
        old.venda !== p.venda ||
        old.custo !== p.custo ||
        old.nome !== p.nome ||
        old.codigo !== p.codigo ||
        old.codBarras !== p.codBarras ||
        old.ncm !== p.ncm ||
        old.cfop !== p.cfop ||
        old.categoria !== p.categoria ||
        old.minimo !== p.minimo ||
        old.unidade !== p.unidade
      ) {
        const fornName = p.fornecedorId
          ? suppliersRef.current.find((s) => s.id === p.fornecedorId)?.nome
          : undefined;
        changed.push({ ...p, fornecedorNome: fornName });
      }
    }

    const deletedIds: string[] = [];
    for (const old of prevProductsRef.current) {
      if (!nextIds.has(old.id)) {
        deletedIds.push(old.id);
      }
    }

    prevProductsRef.current = state.products;

    if (changed.length > 0) {
      lastRemoteSyncMsRef.current = Date.now();
      void authFetch('/api/supabase/produtos/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: changed }),
      });
    }
    for (const delId of deletedIds) {
      lastRemoteSyncMsRef.current = Date.now();
      void authFetch(`/api/supabase/produtos/${encodeURIComponent(delId)}`, {
        method: 'DELETE',
      });
    }
  }, [state.products]);

  // Debounced sync of full ERP state when optional erp_cloud_state table is enabled
  useEffect(() => {
    if (isApplyingRemoteStateRef.current) {
      isApplyingRemoteStateRef.current = false;
      return;
    }
    if (!supabaseStatus.configured || !supabaseStatus.cloudStateReady) return;
    const timer = window.setTimeout(() => {
      const { products: _omitProducts, users: _omitUsers, ...restState } = state;
      void authFetch('/api/supabase/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: restState }),
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    state,
    supabaseStatus.cloudStateReady,
    supabaseStatus.configured,
  ]);

  const printSaleReceipt = useCallback(
    (sale: Sale, nfe?: NFeRecord) => {
      const linkedNfe =
        nfe || (sale.nfeId ? state.nfes.find((item) => item.id === sale.nfeId) : undefined);
      setReceiptToPrint({
        sale,
        nfe: linkedNfe,
        config: state.nfeConfig,
      });
      window.setTimeout(() => {
        window.print();
      }, 260);
    },
    [state.nfeConfig, state.nfes]
  );

  const unreadAlertCount = useMemo(() => {
    const activeIds = new Set(alerts.map((a) => a.id));
    const unreadLogs = alertLogs.filter((l) => activeIds.has(l.alertId) && !l.lido).length;
    return unreadLogs > 0 ? unreadLogs : alerts.filter((a) => a.severity === 'critico').length;
  }, [alerts, alertLogs]);

  // Products
  const saveProduct = useCallback(
    (product: Omit<Product, 'id' | 'updatedAt'> & { id?: string }) => {
      const nowIso = new Date().toISOString();
      setState((prev) => {
        if (product.id) {
          return {
            ...prev,
            products: prev.products.map((p) =>
              p.id === product.id ? { ...p, ...product, id: p.id, updatedAt: nowIso } : p
            ),
          };
        }
        const novo: Product = {
          ...product,
          id: uid('prod'),
          updatedAt: nowIso,
        };
        return { ...prev, products: [novo, ...prev.products] };
      });
      pushToast({
        type: 'sucesso',
        title: product.id ? 'Produto atualizado' : 'Produto cadastrado',
        description: product.nome,
      });
    },
    [pushToast]
  );

  const deleteProduct = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== id),
      }));
      pushToast({ type: 'info', title: 'Produto removido do catálogo' });
    },
    [pushToast]
  );

  const adjustStock = useCallback(
    (productId: string, delta: number, reason = 'Ajuste rápido') => {
      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) =>
          p.id === productId
            ? { ...p, saldo: Math.max(0, p.saldo + delta), updatedAt: new Date().toISOString() }
            : p
        ),
      }));
      pushToast({
        type: 'sucesso',
        title: reason,
        description: `${delta > 0 ? '+' : ''}${delta} unidade(s) no saldo.`,
      });
    },
    [pushToast]
  );

  // Suppliers
  const saveSupplier = useCallback(
    (supplier: Omit<Supplier, 'id'> & { id?: string }) => {
      setState((prev) => {
        if (supplier.id) {
          return {
            ...prev,
            suppliers: prev.suppliers.map((s) => (s.id === supplier.id ? { ...s, ...supplier, id: s.id } : s)),
          };
        }
        return { ...prev, suppliers: [{ ...supplier, id: uid('forn') }, ...prev.suppliers] };
      });
      pushToast({ type: 'sucesso', title: supplier.id ? 'Fornecedor atualizado' : 'Fornecedor cadastrado' });
    },
    [pushToast]
  );

  const deleteSupplier = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, suppliers: prev.suppliers.filter((s) => s.id !== id) }));
      pushToast({ type: 'info', title: 'Fornecedor removido' });
    },
    [pushToast]
  );

  // Customers
  const saveCustomer = useCallback(
    (customer: Omit<Customer, 'id'> & { id?: string }) => {
      setState((prev) => {
        if (customer.id) {
          return {
            ...prev,
            customers: prev.customers.map((c) => (c.id === customer.id ? { ...c, ...customer, id: c.id } : c)),
          };
        }
        return { ...prev, customers: [{ ...customer, id: uid('cli') }, ...prev.customers] };
      });
      pushToast({ type: 'sucesso', title: customer.id ? 'Cliente atualizado' : 'Cliente cadastrado' });
    },
    [pushToast]
  );

  const deleteCustomer = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, customers: prev.customers.filter((c) => c.id !== id) }));
      pushToast({ type: 'info', title: 'Cliente removido' });
    },
    [pushToast]
  );

  // Manual Entry
  const registerManualEntry = useCallback(
    (payload: {
      produtoId: string;
      quantidade: number;
      custoUnitario: number;
      fornecedorId?: string;
      data: string;
      nfReferencia: string;
      observacao?: string;
    }) => {
      setState((prev) => {
        const prod = prev.products.find((p) => p.id === payload.produtoId);
        if (!prod) return prev;
        const forn = prev.suppliers.find((s) => s.id === payload.fornecedorId);
        const nowIso = new Date().toISOString();
        const entry: StockEntry = {
          id: uid('ent'),
          produtoId: prod.id,
          produtoNome: prod.nome,
          quantidade: payload.quantidade,
          custoUnitario: payload.custoUnitario > 0 ? payload.custoUnitario : prod.custo,
          fornecedorId: forn?.id,
          fornecedorNome: forn?.nome ?? 'Compra direta',
          data: payload.data || todayISO(),
          nfReferencia: payload.nfReferencia || 'Sem NF',
          observacao: payload.observacao,
          origem: 'manual',
          criadoEm: nowIso,
        };
        return {
          ...prev,
          entries: [entry, ...prev.entries],
          products: prev.products.map((p) =>
            p.id === prod.id
              ? {
                  ...p,
                  saldo: p.saldo + payload.quantidade,
                  custo: payload.custoUnitario > 0 ? payload.custoUnitario : p.custo,
                  updatedAt: nowIso,
                }
              : p
          ),
        };
      });
      pushToast({
        type: 'sucesso',
        title: 'Entrada registrada no estoque',
        description: `+${payload.quantidade} unidade(s) adicionada(s).`,
      });
    },
    [pushToast]
  );

  // Import XML NF-e
  const importXMLNFe = useCallback(
    (parsed: ParsedXMLNFe) => {
      let addedEntries = 0;
      let addedDuplicatas = 0;

      setState((prev) => {
        const nowIso = new Date().toISOString();
        const nextProducts = [...prev.products];
        const nextEntries = [...prev.entries];
        const nextSuppliers = [...prev.suppliers];
        const nextDuplicatas = [...prev.duplicatas];

        let supplier = nextSuppliers.find(
          (s) =>
            (parsed.fornecedorCnpj && s.cnpj.replace(/\D/g, '') === parsed.fornecedorCnpj.replace(/\D/g, '')) ||
            s.nome.toLowerCase() === parsed.fornecedorNome.toLowerCase()
        );

        if (!supplier) {
          supplier = {
            id: uid('forn'),
            nome: parsed.fornecedorNome,
            cnpj: parsed.fornecedorCnpj || 'Não informado',
            contato: 'Importado XML',
            telefone: '—',
            categoria: prev.categories[0] || 'Geral',
            endereco: 'Importado via NF-e',
          };
          nextSuppliers.unshift(supplier);
        }

        for (const item of parsed.itens) {
          let prodIdx = nextProducts.findIndex(
            (p) =>
              (item.codigo && p.codigo.toLowerCase() === item.codigo.toLowerCase()) ||
              (item.ean && item.ean !== 'SEM GTIN' && p.codBarras === item.ean) ||
              p.nome.toLowerCase() === item.nome.toLowerCase()
          );

          if (prodIdx === -1) {
            const newProd: Product = {
              id: uid('prod'),
              codigo: item.codigo || `XML-${Math.floor(1000 + Math.random() * 9000)}`,
              nome: item.nome,
              categoria: prev.categories[0] || 'Redes de Proteção',
              unidade: item.unidade || 'Unidade',
              custo: item.custoUnitario,
              venda: Number((item.custoUnitario * 1.9).toFixed(2)),
              saldo: item.quantidade,
              minimo: 5,
              fornecedorId: supplier.id,
              codBarras: item.ean !== 'SEM GTIN' ? item.ean : '',
              updatedAt: nowIso,
            };
            nextProducts.unshift(newProd);
            prodIdx = 0;
          } else {
            nextProducts[prodIdx] = {
              ...nextProducts[prodIdx],
              saldo: nextProducts[prodIdx].saldo + item.quantidade,
              custo: item.custoUnitario > 0 ? item.custoUnitario : nextProducts[prodIdx].custo,
              updatedAt: nowIso,
            };
          }

          const targetProd = nextProducts[prodIdx];
          nextEntries.unshift({
            id: uid('ent'),
            produtoId: targetProd.id,
            produtoNome: targetProd.nome,
            quantidade: item.quantidade,
            custoUnitario: item.custoUnitario,
            fornecedorId: supplier.id,
            fornecedorNome: supplier.nome,
            data: parsed.dataEmissao || todayISO(),
            nfReferencia: `NF ${parsed.numeroNF}`,
            observacao: 'Importação automática XML NF-e',
            origem: 'xml',
            criadoEm: nowIso,
          });
          addedEntries += 1;
        }

        for (const dup of parsed.duplicatas) {
          nextDuplicatas.unshift({
            id: uid('dup'),
            fornecedorId: supplier.id,
            fornecedorNome: supplier.nome,
            nf: parsed.numeroNF,
            descricao: `NF ${parsed.numeroNF} · Parc. ${dup.numero}`,
            valor: dup.valor,
            vencimento: dup.vencimento,
            formaPagamento: 'boleto',
            status: 'pendente',
          });
          addedDuplicatas += 1;
        }

        return {
          ...prev,
          products: nextProducts,
          entries: nextEntries,
          suppliers: nextSuppliers,
          duplicatas: nextDuplicatas,
        };
      });

      pushToast({
        type: 'sucesso',
        title: `XML NF ${parsed.numeroNF} importado`,
        description: `${addedEntries} item(ns) no estoque e ${addedDuplicatas} duplicata(s) lançada(s).`,
      });
      return { addedEntries, addedDuplicatas };
    },
    [pushToast]
  );

  // Sales (PDV)
  const finalizeSale = useCallback(
    (payload: {
      clienteNome: string;
      clienteDoc?: string;
      itens: SaleItem[];
      desconto: number;
      formaPagamento: PaymentMethod;
      valorRecebido?: number;
      troco?: number;
    }) => {
      if (payload.itens.length === 0) return null;
      const subtotal = payload.itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
      const total = Math.max(0, subtotal - (payload.desconto || 0));
      const nowIso = new Date().toISOString();
      const today = todayISO();
      const nextNum =
        state.sales.reduce((max, s) => (s.numero > max ? s.numero : max), 1040) + 1;
      const matchedCustomer = state.customers.find(
        (c) => c.nome.toLowerCase() === payload.clienteNome.trim().toLowerCase()
      );

      const sale: Sale = {
        id: uid('sale'),
        numero: nextNum,
        data: today,
        criadoEm: nowIso,
        clienteNome: payload.clienteNome.trim() || 'Balcão — Cliente Avulso',
        clienteDoc: payload.clienteDoc?.trim() || matchedCustomer?.doc || undefined,
        clienteId: matchedCustomer?.id,
        itens: payload.itens,
        subtotal,
        desconto: payload.desconto || 0,
        total,
        formaPagamento: payload.formaPagamento,
        valorRecebido: payload.valorRecebido,
        troco: payload.troco,
        vendedor: activeUser.nome.split(' ')[0],
        status: 'concluida',
        fiadoPago: payload.formaPagamento === 'fiado' ? false : undefined,
      };

      setState((prev) => {
        const qtyMap = new Map<string, number>();
        for (const item of payload.itens) {
          qtyMap.set(item.produtoId, (qtyMap.get(item.produtoId) ?? 0) + item.quantidade);
        }

        const nextProducts = prev.products.map((p) => {
          const sold = qtyMap.get(p.id);
          if (!sold) return p;
          return {
            ...p,
            saldo: Math.max(0, p.saldo - sold),
            updatedAt: nowIso,
          };
        });

        const nextCash = [...prev.cash];
        if (payload.formaPagamento !== 'fiado') {
          nextCash.unshift({
            id: uid('cx'),
            data: today,
            criadoEm: nowIso,
            descricao: `Venda PDV #${nextNum}`,
            clienteOuOrigem: sale.clienteNome,
            formaPagamento: payload.formaPagamento,
            tipo: 'entrada',
            valor: total,
            origemRef: sale.id,
          });
        }

        return {
          ...prev,
          sales: [sale, ...prev.sales],
          products: nextProducts,
          cash: nextCash,
        };
      });

      pushToast({
        type: 'sucesso',
        title: `Venda #${nextNum} finalizada`,
        description: `${formatBRL(total)} · ${payload.formaPagamento.toUpperCase()}`,
      });
      return sale;
    },
    [activeUser.nome, pushToast, state.customers, state.sales]
  );

  const cancelSale = useCallback(
    (saleId: string) => {
      setState((prev) => {
        const target = prev.sales.find((s) => s.id === saleId);
        if (!target || target.status === 'cancelada') return prev;
        const nowIso = new Date().toISOString();
        const restoreMap = new Map<string, number>();
        for (const it of target.itens) {
          restoreMap.set(it.produtoId, (restoreMap.get(it.produtoId) ?? 0) + it.quantidade);
        }

        return {
          ...prev,
          sales: prev.sales.map((s) => (s.id === saleId ? { ...s, status: 'cancelada' } : s)),
          products: prev.products.map((p) => {
            const addBack = restoreMap.get(p.id);
            return addBack ? { ...p, saldo: p.saldo + addBack, updatedAt: nowIso } : p;
          }),
          cash: prev.cash.filter((c) => c.origemRef !== saleId),
        };
      });
      pushToast({ type: 'info', title: 'Venda cancelada e estoque estornado' });
    },
    [pushToast]
  );

  const settleFiadoSale = useCallback(
    (saleId: string, formaPagamento: 'dinheiro' | 'pix' | 'credito' | 'debito') => {
      setState((prev) => {
        const target = prev.sales.find((s) => s.id === saleId);
        if (!target || target.fiadoPago) return prev;
        const nowIso = new Date().toISOString();
        const today = todayISO();
        return {
          ...prev,
          sales: prev.sales.map((s) =>
            s.id === saleId ? { ...s, fiadoPago: true, fiadoPagoEm: today } : s
          ),
          cash: [
            {
              id: uid('cx'),
              data: today,
              criadoEm: nowIso,
              descricao: `Recebimento Fiado #${target.numero}`,
              clienteOuOrigem: target.clienteNome,
              formaPagamento,
              tipo: 'entrada',
              valor: target.total,
              origemRef: target.id,
            },
            ...prev.cash,
          ],
        };
      });
      pushToast({ type: 'sucesso', title: 'Fiado quitado e lançado no Caixa' });
    },
    [pushToast]
  );

  // NF-e & NFS-e status helpers (usados também pela Saída de Equipes)
  const updateNFSeStatus = useCallback(
    (
      id: string,
      status: NFSeRecord['status'],
      extra?: { chaveNfse?: string; motivoRejeicao?: string }
    ) => {
      setState((prev) => ({
        ...prev,
        nfses: prev.nfses.map((n) =>
          n.id === id
            ? {
                ...n,
                status,
                chaveNfse: extra?.chaveNfse || n.chaveNfse,
                motivoRejeicao: extra?.motivoRejeicao,
              }
            : n
        ),
      }));
    },
    []
  );

  const transmitNFSeAuto = useCallback(
    async (record: NFSeRecord): Promise<boolean> => {
      const hasCert = await refreshCertStatus();
      if (!hasCert) return false;

      try {
        const resp = await authFetch('/api/fiscal/nfse/transmitir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dps: {
              numeroDps: record.numeroDps,
              serie: state.nfeConfig.serie || '1',
              data: record.data,
              ambiente: state.nfeConfig.ambiente,
              cnpjPrestador: state.nfeConfig.cnpjPrestador || '23246816000103',
              inscricaoMunicipal: state.nfeConfig.inscricaoMunicipal || '000000053254996',
              municipioIbge: state.nfeConfig.municipioIbge || '3550308',
              tomadorNome: record.tomadorNome,
              tomadorDoc: record.tomadorDoc,
              codigoNbs: record.codigoNbs,
              codigoTributacaoNacional: record.codigoTributacaoNacional,
              codigoTributacaoMunicipal: record.codigoTributacaoMunicipal || '001',
              descricaoServico: record.descricaoServico,
              regimeTributario: record.regimeTributario,
              cstIbsCbs: record.cstIbsCbs,
              cClassTrib: record.cClassTrib,
              valorServico: record.valorServico,
              aliquotaIss: record.aliquotaIss,
              aliquotaCbs: record.aliquotaCbs,
              aliquotaIbs: record.aliquotaIbs,
              valorCbs: record.valorCbs,
              valorIbs: record.valorIbs,
            },
            sefinUrl: state.nfeConfig.nfseSefinUrl,
            customProxyUrl: state.nfeConfig.serverUrl,
            token: state.nfeConfig.token,
          }),
        });
        const data = (await resp.json()) as {
          authorized?: boolean;
          chaveAcesso?: string;
          error?: string;
        };
        if (resp.ok && data.authorized) {
          updateNFSeStatus(record.id, 'autorizada', { chaveNfse: data.chaveAcesso });
          pushToast({
            type: 'sucesso',
            title: `NFS-e #${record.numeroDps} autorizada automaticamente!`,
            description: data.chaveAcesso ? `Chave: ${data.chaveAcesso}` : 'Transmitida à Sefin Nacional.',
          });
          return true;
        }
        updateNFSeStatus(record.id, 'rejeitada', { motivoRejeicao: data.error });
        pushToast({
          type: 'aviso',
          title: `NFS-e #${record.numeroDps} não autorizada`,
          description: data.error || 'Confira os dados do cliente na aba NF-e & NFS-e.',
        });
        return false;
      } catch {
        return false;
      }
    },
    [pushToast, refreshCertStatus, state.nfeConfig, updateNFSeStatus]
  );

  // Obra Withdrawal
  const registerObraWithdrawal = useCallback(
    (payload: {
      destino: string;
      responsavel: string;
      data: string;
      observacao?: string;
      itens: ObraWithdrawalItem[];
      clienteNome?: string;
      clienteDoc?: string;
      valorServico?: number;
      formaRecebimentoCaixa?: '' | 'dinheiro' | 'pix' | 'credito' | 'debito';
      gerarNfse?: boolean;
    }) => {
      if (payload.itens.length === 0 || !payload.destino.trim()) return null;
      const nowIso = new Date().toISOString();
      const custoTotal = payload.itens.reduce((s, i) => s + i.custoUnitario * i.quantidade, 0);
      const valorServico = payload.valorServico && payload.valorServico > 0 ? payload.valorServico : undefined;
      const withdrawalId = uid('obra');

      let createdNfse: NFSeRecord | undefined;
      if (payload.gerarNfse && valorServico && payload.clienteNome?.trim()) {
        const nextDps = String(
          state.nfses.reduce((m, n) => Math.max(m, parseInt(n.numeroDps, 10) || 0), 2) + 1
        ).padStart(6, '0');
        const issRate = 2.0;
        const cbsRate = 0.9;
        const ibsRate = 0.1;
        createdNfse = {
          id: uid('nfse'),
          numeroDps: nextDps,
          data: payload.data || todayISO(),
          tomadorNome: payload.clienteNome.trim(),
          tomadorDoc: (payload.clienteDoc || '').trim() || 'Não informado',
          municipioIncidencia: 'São Paulo / SP',
          codigoNbs: '1.0106.90.00',
          codigoTributacaoNacional: '14.06.01',
          codigoTributacaoMunicipal: '001',
          descricaoServico: `Instalação de Redes de Proteção — ${payload.destino.trim()}`,
          regimeTributario: state.nfeConfig.regimePadrao ?? 'simples_nacional',
          cstIbsCbs: '000',
          cClassTrib: '000001',
          valorServico,
          aliquotaIss: issRate,
          aliquotaCbs: cbsRate,
          aliquotaIbs: ibsRate,
          valorIss: (valorServico * issRate) / 100,
          valorCbs: (valorServico * cbsRate) / 100,
          valorIbs: (valorServico * ibsRate) / 100,
          status: 'pendente',
        };
      }

      const withdrawal: ObraWithdrawal = {
        id: withdrawalId,
        data: payload.data || todayISO(),
        criadoEm: nowIso,
        destino: payload.destino.trim(),
        responsavel: payload.responsavel.trim() || activeUser.nome.split(' ')[0],
        observacao: payload.observacao,
        itens: payload.itens,
        custoTotal,
        clienteNome: payload.clienteNome?.trim() || undefined,
        clienteDoc: payload.clienteDoc?.trim() || undefined,
        valorServico,
        nfseId: createdNfse?.id,
      };

      setState((prev) => {
        const qtyMap = new Map<string, number>();
        for (const it of payload.itens) {
          qtyMap.set(it.produtoId, (qtyMap.get(it.produtoId) ?? 0) + it.quantidade);
        }

        const nextCash = [...prev.cash];
        if (valorServico && payload.formaRecebimentoCaixa) {
          nextCash.unshift({
            id: uid('cx'),
            data: payload.data || todayISO(),
            criadoEm: nowIso,
            descricao: `Serviço Equipe · ${payload.destino.trim()}`,
            clienteOuOrigem: payload.clienteNome?.trim() || payload.destino.trim(),
            formaPagamento: payload.formaRecebimentoCaixa,
            tipo: 'entrada',
            valor: valorServico,
            origemRef: withdrawalId,
          });
        }

        return {
          ...prev,
          obras: [withdrawal, ...prev.obras],
          nfses: createdNfse ? [createdNfse, ...prev.nfses] : prev.nfses,
          cash: nextCash,
          products: prev.products.map((p) => {
            const qty = qtyMap.get(p.id);
            return qty ? { ...p, saldo: Math.max(0, p.saldo - qty), updatedAt: nowIso } : p;
          }),
        };
      });

      pushToast({
        type: 'sucesso',
        title: createdNfse
          ? `Saída registrada + NFS-e #${createdNfse.numeroDps} gerada`
          : 'Saída para equipes registrada',
        description: valorServico
          ? `Serviço ${formatBRL(valorServico)} · Custo materiais ${formatBRL(custoTotal)}`
          : `${payload.destino} · Custo ${formatBRL(custoTotal)}`,
      });
      if (createdNfse && state.nfeConfig.autoEmitirNfse !== false) {
        void transmitNFSeAuto(createdNfse);
      }
      return { withdrawal, nfse: createdNfse };
    },
    [
      activeUser.nome,
      pushToast,
      state.nfeConfig.autoEmitirNfse,
      state.nfeConfig.regimePadrao,
      state.nfses,
      transmitNFSeAuto,
    ]
  );

  const createNFSeFromObra = useCallback(
    (obraId: string) => {
      const target = state.obras.find((o) => o.id === obraId);
      if (!target || !target.valorServico || target.valorServico <= 0) return null;
      const nextDps = String(
        state.nfses.reduce((m, n) => Math.max(m, parseInt(n.numeroDps, 10) || 0), 2) + 1
      ).padStart(6, '0');
      const issRate = 2.0;
      const cbsRate = 0.9;
      const ibsRate = 0.1;
      const valorServico = target.valorServico;
      const record: NFSeRecord = {
        id: uid('nfse'),
        numeroDps: nextDps,
        data: todayISO(),
        tomadorNome: target.clienteNome || target.destino,
        tomadorDoc: target.clienteDoc || 'Não informado',
        municipioIncidencia: 'São Paulo / SP',
        codigoNbs: '1.0106.90.00',
        codigoTributacaoNacional: '14.06.01',
        codigoTributacaoMunicipal: '001',
        descricaoServico: `Instalação de Redes de Proteção — ${target.destino}`,
        regimeTributario: state.nfeConfig.regimePadrao ?? 'simples_nacional',
        cstIbsCbs: '000',
        cClassTrib: '000001',
        valorServico,
        aliquotaIss: issRate,
        aliquotaCbs: cbsRate,
        aliquotaIbs: ibsRate,
        valorIss: (valorServico * issRate) / 100,
        valorCbs: (valorServico * cbsRate) / 100,
        valorIbs: (valorServico * ibsRate) / 100,
        status: 'pendente',
      };
      setState((prev) => ({
        ...prev,
        nfses: [record, ...prev.nfses],
        obras: prev.obras.map((o) => (o.id === obraId ? { ...o, nfseId: record.id } : o)),
      }));
      pushToast({
        type: 'sucesso',
        title: `NFS-e DPS #${nextDps} criada`,
        description: `Valor do serviço ${formatBRL(valorServico)} (materiais ocultos da nota).`,
      });
      if (state.nfeConfig.autoEmitirNfse !== false) {
        void transmitNFSeAuto(record);
      }
      return record;
    },
    [
      pushToast,
      state.nfeConfig.autoEmitirNfse,
      state.nfeConfig.regimePadrao,
      state.nfses,
      state.obras,
      transmitNFSeAuto,
    ]
  );

  const deleteObraWithdrawal = useCallback(
    (id: string) => {
      setState((prev) => {
        const target = prev.obras.find((o) => o.id === id);
        if (!target) return prev;
        const nowIso = new Date().toISOString();
        const restore = new Map<string, number>();
        for (const it of target.itens) {
          restore.set(it.produtoId, (restore.get(it.produtoId) ?? 0) + it.quantidade);
        }
        return {
          ...prev,
          obras: prev.obras.filter((o) => o.id !== id),
          cash: prev.cash.filter((c) => c.origemRef !== id),
          products: prev.products.map((p) => {
            const qty = restore.get(p.id);
            return qty ? { ...p, saldo: p.saldo + qty, updatedAt: nowIso } : p;
          }),
        };
      });
      pushToast({ type: 'info', title: 'Saída de equipes estornada ao estoque' });
    },
    [pushToast]
  );

  // Cash
  const addManualCashMovement = useCallback(
    (payload: {
      data: string;
      descricao: string;
      clienteOuOrigem: string;
      formaPagamento: string;
      tipo: 'entrada' | 'saida';
      valor: number;
    }) => {
      setState((prev) => ({
        ...prev,
        cash: [
          {
            id: uid('cx'),
            ...payload,
            criadoEm: new Date().toISOString(),
          },
          ...prev.cash,
        ],
      }));
      pushToast({
        type: 'sucesso',
        title: payload.tipo === 'entrada' ? 'Suprimento registrado' : 'Sangria registrada',
        description: formatBRL(payload.valor),
      });
    },
    [pushToast]
  );

  // Duplicatas
  const saveDuplicata = useCallback(
    (payload: Omit<Duplicata, 'id' | 'status'>) => {
      setState((prev) => ({
        ...prev,
        duplicatas: [{ ...payload, id: uid('dup'), status: 'pendente' }, ...prev.duplicatas],
      }));
      pushToast({ type: 'sucesso', title: 'Duplicata cadastrada' });
    },
    [pushToast]
  );

  const payDuplicata = useCallback(
    (id: string, dataPagamento: string, formaPagamento: Duplicata['formaPagamento']) => {
      setState((prev) => {
        const target = prev.duplicatas.find((d) => d.id === id);
        if (!target || target.status === 'paga') return prev;
        return {
          ...prev,
          duplicatas: prev.duplicatas.map((d) =>
            d.id === id ? { ...d, status: 'paga', dataPagamento, formaPagamento } : d
          ),
          cash: [
            {
              id: uid('cx'),
              data: dataPagamento,
              criadoEm: new Date().toISOString(),
              descricao: `Pgto Duplicata · ${target.nf ? 'NF ' + target.nf : target.descricao}`,
              clienteOuOrigem: target.fornecedorNome,
              formaPagamento,
              tipo: 'saida',
              valor: target.valor,
              origemRef: id,
            },
            ...prev.cash,
          ],
        };
      });
      pushToast({ type: 'sucesso', title: 'Duplicata quitada e lançada no Caixa' });
    },
    [pushToast]
  );

  const deleteDuplicata = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, duplicatas: prev.duplicatas.filter((d) => d.id !== id) }));
      pushToast({ type: 'info', title: 'Duplicata removida' });
    },
    [pushToast]
  );

  // NF-e Produto (transmissão automática real A1)

  const emitNFe = useCallback(
    (payload: {
      clienteNome: string;
      clienteDoc: string;
      valor: number;
      vendaId?: string;
      modelo?: '55' | '65';
      itensSnapshot?: SaleItem[];
      desconto?: number;
      formaPagamento?: PaymentMethod;
    }) => {
      const nextNum = String(
        state.nfes.reduce((m, n) => Math.max(m, parseInt(n.numero, 10) || 0), 0) + 1
      ).padStart(6, '0');
      const modelo = payload.modelo ?? state.nfeConfig.modeloProdutoPadrao ?? '65';
      const record: NFeRecord = {
        id: uid('nfe'),
        numero: nextNum,
        modelo,
        data: todayISO(),
        clienteNome: payload.clienteNome,
        clienteDoc: payload.clienteDoc,
        valor: payload.valor,
        desconto: payload.desconto,
        formaPagamento: payload.formaPagamento,
        itensSnapshot: payload.itensSnapshot,
        status: 'pendente',
        chave: `35${todayISO().slice(2, 7).replace('-', '')}${
          state.nfeConfig.cnpjPrestador || '23246816000103'
        }${modelo}001${nextNum.padStart(9, '0')}1000000010`.slice(0, 44),
        vendaId: payload.vendaId,
      };
      setState((prev) => ({
        ...prev,
        nfes: [record, ...prev.nfes],
        sales: payload.vendaId
          ? prev.sales.map((s) => (s.id === payload.vendaId ? { ...s, nfeId: record.id } : s))
          : prev.sales,
      }));
      return record;
    },
    [state.nfeConfig.cnpjPrestador, state.nfeConfig.modeloProdutoPadrao, state.nfes]
  );

  const transmitExistingNFe = useCallback(
    async (id: string): Promise<NFeRecord | null> => {
      const target = state.nfes.find((n) => n.id === id);
      if (!target) return null;
      const hasCert = await refreshCertStatus();
      if (!hasCert) {
        pushToast({
          type: 'aviso',
          title: 'Conecte seu Certificado A1 primeiro',
          description: 'Vá em NF-e & NFS-e para conectar o arquivo .pfx e transmitir à SEFAZ-SP.',
        });
        return target;
      }

      const modelo = target.modelo ?? state.nfeConfig.modeloProdutoPadrao ?? '65';
      try {
        const resp = await authFetch('/api/fiscal/nfe/emitir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelo,
            numero: target.numero,
            serie: state.nfeConfig.serie || '1',
            data: target.data,
            ambiente: state.nfeConfig.ambiente,
            cnpjEmitente: state.nfeConfig.cnpjPrestador || '23246816000103',
            ieEmitente: state.nfeConfig.inscricaoEstadual || '140002149114',
            enderecoEmitente: state.nfeConfig.enderecoEmitente,
            destinatarioNome: target.clienteNome,
            destinatarioDoc: target.clienteDoc,
            itens: target.itensSnapshot || [],
            desconto: target.desconto || 0,
            total: target.valor,
            formaPagamento: target.formaPagamento || 'pix',
            cscId: state.nfeConfig.cscId || '',
            cscToken: state.nfeConfig.cscToken || '',
          }),
        });
        const data = (await resp.json()) as {
          authorized?: boolean;
          chave?: string;
          protocolo?: string;
          qrCodeUrl?: string;
          xmlSigned?: string;
          error?: string;
        };

        const updatedRecord: NFeRecord = {
          ...target,
          status: resp.ok && data.authorized ? 'autorizada' : 'rejeitada',
          chave: data.chave || target.chave,
          protocolo: data.protocolo || target.protocolo,
          qrCodeUrl: data.qrCodeUrl || target.qrCodeUrl,
          xmlSigned: data.xmlSigned || target.xmlSigned,
          motivoRejeicao: resp.ok && data.authorized ? undefined : data.error,
        };

        setState((prev) => ({
          ...prev,
          nfes: prev.nfes.map((n) => (n.id === id ? updatedRecord : n)),
        }));

        if (resp.ok && data.authorized) {
          pushToast({
            type: 'sucesso',
            title: `${modelo === '65' ? 'NFC-e' : 'NF-e'} #${target.numero} autorizada na SEFAZ-SP!`,
            description: data.protocolo ? `Protocolo ${data.protocolo}` : undefined,
          });
        } else {
          pushToast({
            type: 'aviso',
            title: `${modelo === '65' ? 'NFC-e' : 'NF-e'} #${target.numero} não autorizada`,
            description: data.error || 'Confira os dados fiscais e CSC.',
          });
        }
        return updatedRecord;
      } catch {
        return target;
      }
    },
    [pushToast, refreshCertStatus, state.nfeConfig, state.nfes]
  );

  const emitAndTransmitProductNote = useCallback(
    async (payload: {
      clienteNome: string;
      clienteDoc: string;
      valor: number;
      vendaId?: string;
      modelo?: '55' | '65';
      itensSnapshot?: SaleItem[];
      desconto?: number;
      formaPagamento?: PaymentMethod;
      autoTransmit?: boolean;
    }): Promise<NFeRecord> => {
      const record = emitNFe(payload);
      if (payload.autoTransmit === false) {
        return record;
      }
      const hasCert = await refreshCertStatus();
      if (!hasCert) {
        pushToast({
          type: 'info',
          title: `Nota de produto #${record.numero} salva como pendente`,
          description: 'Conecte o Certificado A1 para transmitir automaticamente à SEFAZ-SP.',
        });
        return record;
      }

      const modelo = record.modelo ?? state.nfeConfig.modeloProdutoPadrao ?? '65';
      try {
        const resp = await authFetch('/api/fiscal/nfe/emitir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelo,
            numero: record.numero,
            serie: state.nfeConfig.serie || '1',
            data: record.data,
            ambiente: state.nfeConfig.ambiente,
            cnpjEmitente: state.nfeConfig.cnpjPrestador || '23246816000103',
            ieEmitente: state.nfeConfig.inscricaoEstadual || '140002149114',
            enderecoEmitente: state.nfeConfig.enderecoEmitente,
            destinatarioNome: record.clienteNome,
            destinatarioDoc: record.clienteDoc,
            itens: record.itensSnapshot || [],
            desconto: record.desconto || 0,
            total: record.valor,
            formaPagamento: record.formaPagamento || 'pix',
            cscId: state.nfeConfig.cscId || '',
            cscToken: state.nfeConfig.cscToken || '',
          }),
        });
        const data = (await resp.json()) as {
          authorized?: boolean;
          chave?: string;
          protocolo?: string;
          qrCodeUrl?: string;
          xmlSigned?: string;
          error?: string;
        };

        const finalRecord: NFeRecord = {
          ...record,
          status: resp.ok && data.authorized ? 'autorizada' : 'rejeitada',
          chave: data.chave || record.chave,
          protocolo: data.protocolo,
          qrCodeUrl: data.qrCodeUrl,
          xmlSigned: data.xmlSigned,
          motivoRejeicao: resp.ok && data.authorized ? undefined : data.error,
        };

        setState((prev) => ({
          ...prev,
          nfes: prev.nfes.map((n) => (n.id === record.id ? finalRecord : n)),
        }));

        if (resp.ok && data.authorized) {
          pushToast({
            type: 'sucesso',
            title: `${modelo === '65' ? 'NFC-e' : 'NF-e'} #${record.numero} autorizada sozinha!`,
            description: data.protocolo ? `Protocolo ${data.protocolo}` : undefined,
          });
        } else {
          pushToast({
            type: 'aviso',
            title: `Nota #${record.numero} aguardando ajuste fiscal`,
            description: data.error || 'Confira o Código CSC (NFC-e) ou dados do cliente.',
          });
        }
        return finalRecord;
      } catch {
        return record;
      }
    },
    [emitNFe, pushToast, refreshCertStatus, state.nfeConfig]
  );

  const retryNFe = useCallback(
    (id: string) => {
      void transmitExistingNFe(id);
    },
    [transmitExistingNFe]
  );

  const emitNFSe = useCallback(
    (payload: Omit<NFSeRecord, 'id' | 'numeroDps' | 'data' | 'status' | 'chaveNfse'>) => {
      const nextDps = String(
        state.nfses.reduce((m, n) => Math.max(m, parseInt(n.numeroDps, 10) || 0), 2) + 1
      ).padStart(6, '0');
      const record: NFSeRecord = {
        ...payload,
        id: uid('nfse'),
        numeroDps: nextDps,
        data: todayISO(),
        status: 'pendente',
      };
      setState((prev) => ({ ...prev, nfses: [record, ...prev.nfses] }));

      if (state.nfeConfig.autoEmitirNfse !== false) {
        void transmitNFSeAuto(record);
      } else {
        pushToast({
          type: 'info',
          title: `DPS #${nextDps} gerada`,
          description: 'Clique em Transmitir (A1) para enviar à Sefin Nacional.',
        });
      }
      return record;
    },
    [pushToast, state.nfeConfig.autoEmitirNfse, state.nfses, transmitNFSeAuto]
  );

  const retryNFSe = useCallback(
    (id: string) => {
      const target = state.nfses.find((n) => n.id === id);
      if (target) {
        void transmitNFSeAuto(target);
      }
    },
    [state.nfses, transmitNFSeAuto]
  );

  const updateNFeConfig = useCallback(
    (cfg: NFeConfig) => {
      setState((prev) => ({ ...prev, nfeConfig: cfg }));
      pushToast({ type: 'sucesso', title: 'Configuração fiscal salva' });
    },
    [pushToast]
  );

  // Categories & Users
  const addCategory = useCallback(
    (name: string) => {
      const clean = name.trim();
      if (!clean) return;
      setState((prev) => {
        if (prev.categories.some((c) => c.toLowerCase() === clean.toLowerCase())) return prev;
        return { ...prev, categories: [...prev.categories, clean] };
      });
      pushToast({ type: 'sucesso', title: 'Categoria adicionada', description: clean });
    },
    [pushToast]
  );

  const deleteCategory = useCallback(
    (name: string) => {
      setState((prev) => ({ ...prev, categories: prev.categories.filter((c) => c !== name) }));
      pushToast({ type: 'info', title: 'Categoria removida' });
    },
    [pushToast]
  );

  const saveUser = useCallback(
    (user: Omit<AppUser, 'id'> & { id?: string }) => {
      setState((prev) => {
        if (user.id) {
          return {
            ...prev,
            users: prev.users.map((u) => (u.id === user.id ? { ...u, ...user, id: u.id } : u)),
          };
        }
        return { ...prev, users: [...prev.users, { ...user, id: uid('usr') }] };
      });
      pushToast({ type: 'sucesso', title: user.id ? 'Usuário atualizado' : 'Usuário cadastrado' });
    },
    [pushToast]
  );

  const deleteUser = useCallback(
    (id: string) => {
      setState((prev) => {
        if (prev.users.length <= 1) return prev;
        const remaining = prev.users.filter((u) => u.id !== id);
        return {
          ...prev,
          users: remaining,
          activeUserId: prev.activeUserId === id ? remaining[0].id : prev.activeUserId,
        };
      });
      pushToast({ type: 'info', title: 'Usuário removido' });
    },
    [pushToast]
  );

  const switchActiveUser = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, activeUserId: id }));
      const found = state.users.find((u) => u.id === id);
      if (found) {
        pushToast({ type: 'info', title: `Operador ativo: ${found.nome}` });
      }
    },
    [pushToast, state.users]
  );

  const exportBackupJSON = useCallback(() => {
    return JSON.stringify(state, null, 2);
  }, [state]);

  const importBackupJSON = useCallback(
    (rawJson: string): boolean => {
      try {
        const parsed = JSON.parse(rawJson) as Partial<PersistedState> | Product[];
        const nowIso = new Date().toISOString();

        if (Array.isArray(parsed)) {
          const validProducts = parsed
            .filter((p) => p && typeof p === 'object' && typeof p.nome === 'string')
            .map((p, idx) => ({
              id: p.id || uid(`prod-${idx}`),
              codigo: p.codigo || `PRD-${idx + 1}`,
              nome: p.nome,
              categoria: p.categoria || 'Redes de Proteção',
              unidade: p.unidade || 'Unidade',
              custo: Number(p.custo) || 0,
              venda: Number(p.venda) || 0,
              saldo: Number(p.saldo) || 0,
              minimo: Number(p.minimo) || 5,
              fornecedorId: p.fornecedorId,
              codBarras: p.codBarras,
              ncm: p.ncm || '56081900',
              cfop: p.cfop || '5102',
              csosn: p.csosn || '102',
              imagem: p.imagem,
              updatedAt: p.updatedAt || nowIso,
            }));

          if (validProducts.length === 0) {
            pushToast({ type: 'erro', title: 'Nenhum produto válido encontrado no JSON' });
            return false;
          }

          setState((prev) => ({
            ...prev,
            products: validProducts,
          }));
          pushToast({
            type: 'sucesso',
            title: `${validProducts.length} produto(s) importado(s)!`,
          });
          return true;
        }

        if (!parsed || typeof parsed !== 'object') {
          pushToast({ type: 'erro', title: 'Arquivo JSON inválido' });
          return false;
        }

        const nextProducts = (parsed.products ?? state.products).map((p) => ({
          ...p,
          ncm: p.ncm || '56081900',
          cfop: p.cfop || '5102',
          csosn: p.csosn || '102',
          updatedAt: p.updatedAt || nowIso,
        }));

        const nextState: PersistedState = {
          categories: Array.isArray(parsed.categories) ? parsed.categories : state.categories,
          products: nextProducts,
          suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : state.suppliers,
          customers: Array.isArray(parsed.customers) ? parsed.customers : state.customers,
          entries: Array.isArray(parsed.entries) ? parsed.entries : state.entries,
          sales: Array.isArray(parsed.sales) ? parsed.sales : state.sales,
          obras: Array.isArray(parsed.obras) ? parsed.obras : state.obras,
          cash: Array.isArray(parsed.cash) ? parsed.cash : state.cash,
          duplicatas: Array.isArray(parsed.duplicatas) ? parsed.duplicatas : state.duplicatas,
          nfes: Array.isArray(parsed.nfes) ? parsed.nfes : state.nfes,
          nfses: Array.isArray(parsed.nfses) ? parsed.nfses : state.nfses,
          nfeConfig: {
            ...DEFAULT_NFE_CONFIG,
            ...state.nfeConfig,
            ...(parsed.nfeConfig ?? {}),
            enderecoEmitente: {
              ...DEFAULT_NFE_CONFIG.enderecoEmitente!,
              ...(state.nfeConfig.enderecoEmitente ?? {}),
              ...(parsed.nfeConfig?.enderecoEmitente ?? {}),
            },
          },
          users: state.users,
          activeUserId: state.activeUserId,
          alertSettings: parsed.alertSettings ?? state.alertSettings,
          dismissedAlertIds: Array.isArray(parsed.dismissedAlertIds)
            ? parsed.dismissedAlertIds
            : [],
          theme: parsed.theme ?? state.theme,
          cleanedDemoSeed: true,
        };

        setState(nextState);
        knownAlertIdsRef.current = null;
        pushToast({
          type: 'sucesso',
          title: 'Backup restaurado com sucesso!',
          description: `${nextState.products.length} produtos, ${nextState.customers.length} clientes e ${nextState.sales.length} vendas carregados.`,
        });
        return true;
      } catch {
        pushToast({
          type: 'erro',
          title: 'Falha ao ler arquivo de backup',
          description: 'Selecione um arquivo .json exportado pelo sistema.',
        });
        return false;
      }
    },
    [pushToast, state]
  );

  const resetDemoData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    const fresh = loadInitialState();
    setState(fresh);
    knownAlertIdsRef.current = null;
    pushToast({ type: 'info', title: 'Base operacional zerada' });
  }, [pushToast]);

  return (
    <StoreContext.Provider
      value={{
        theme,
        toggleTheme,
        activePage,
        setActivePage,
        alertDrawerOpen,
        setAlertDrawerOpen,
        quickRestockProductId,
        setQuickRestockProductId,
        categories: state.categories,
        products: state.products,
        suppliers: state.suppliers,
        customers: state.customers,
        entries: state.entries,
        sales: state.sales,
        obras: state.obras,
        cash: state.cash,
        duplicatas: state.duplicatas,
        nfes: state.nfes,
        nfses: state.nfses,
        nfeConfig: state.nfeConfig,
        users: state.users,
        activeUser,
        authenticatedUser,
        logout: onLogout,
        certLoaded,
        refreshCertStatus,
        receiptToPrint,
        printSaleReceipt,
        alertSettings: state.alertSettings,
        alerts,
        unreadAlertCount,
        alertLogs,
        lastAlertScan,
        toasts,
        pushToast,
        dismissToast,
        dismissAlert,
        restoreDismissedAlerts,
        markAllAlertsRead,
        runAlertScan,
        updateAlertSettings,
        saveProduct,
        deleteProduct,
        adjustStock,
        saveSupplier,
        deleteSupplier,
        saveCustomer,
        deleteCustomer,
        registerManualEntry,
        importXMLNFe,
        finalizeSale,
        cancelSale,
        settleFiadoSale,
        registerObraWithdrawal,
        createNFSeFromObra,
        deleteObraWithdrawal,
        addManualCashMovement,
        saveDuplicata,
        payDuplicata,
        deleteDuplicata,
        emitNFe,
        emitAndTransmitProductNote,
        transmitExistingNFe,
        retryNFe,
        emitNFSe,
        transmitNFSeAuto,
        retryNFSe,
        updateNFSeStatus,
        updateNFeConfig,
        addCategory,
        deleteCategory,
        saveUser,
        deleteUser,
        switchActiveUser,
        exportBackupJSON,
        importBackupJSON,
        resetDemoData,
        supabaseStatus,
        connectSupabase,
        disconnectSupabase,
        syncFromSupabase,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore deve ser usado dentro de StoreProvider');
  return ctx;
}
