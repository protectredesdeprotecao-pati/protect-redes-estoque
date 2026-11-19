import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Cloud,
  Copy,
  Download,
  Edit3,
  KeyRound,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { AuthUser } from '../../types/erp';
import { authFetch } from '../../utils/authClient';
import { todayISO } from '../../utils/formatters';
import { SlideOver } from '../ui/SlideOver';

const CLOUD_STATE_SQL = `create table if not exists public.erp_cloud_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);`;

export const CadastrosPage: React.FC = () => {
  const {
    authenticatedUser,
    categories,
    addCategory,
    deleteCategory,
    alertSettings,
    updateAlertSettings,
    exportBackupJSON,
    importBackupJSON,
    resetDemoData,
    supabaseStatus,
    connectSupabase,
    disconnectSupabase,
    syncFromSupabase,
    pushToast,
  } = useStore();

  const isAdmin = authenticatedUser.cargo === 'Administrador';
  const [newCat, setNewCat] = useState('');
  const [sbUrl, setSbUrl] = useState(
    supabaseStatus.url || 'https://awjvktolzwqbzisewswy.supabase.co'
  );
  const [sbKey, setSbKey] = useState('');
  const [sbBusy, setSbBusy] = useState(false);
  const [sbError, setSbError] = useState('');
  const [showSqlHint, setShowSqlHint] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    if (supabaseStatus.url) {
      setSbUrl(supabaseStatus.url);
    }
  }, [supabaseStatus.url]);

  const handleConnectSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setSbError('');
    setSbBusy(true);
    const res = await connectSupabase(sbUrl, sbKey);
    setSbBusy(false);
    if (!res.ok) {
      setSbError(res.error || 'Não foi possível conectar ao Supabase.');
      return;
    }
    setSbKey('');
    pushToast({
      type: 'sucesso',
      title: 'Supabase conectado!',
      description: `${res.productCount ?? 0} produto(s) encontrado(s) e sincronizado(s).`,
    });
  };

  const handleAddCat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    addCategory(newCat);
    setNewCat('');
  };

  const handleDownloadBackup = () => {
    const json = exportBackupJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-protect-rede-estoque-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Categories */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 dark:border-[#1E293B] dark:bg-[#111820]">
        <h3 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
          Categorias de Produto
        </h3>
        <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
          Organize os itens do catálogo e os painéis analíticos por família de material.
        </p>

        <form onSubmit={handleAddCat} className="mt-4 flex gap-2">
          <input
            type="text"
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="Nova categoria..."
            className="flex-1 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#052E16] hover:bg-[#34D399]"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </button>
        </form>

        <div className="mt-4 divide-y divide-[#F1F5F9] rounded-xl border border-[#E2E8F0] dark:divide-[#1E293B] dark:border-[#1E293B]">
          {categories.map((cat) => (
            <div key={cat} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span className="font-medium text-[#0F172A] dark:text-[#F1F5F9]">{cat}</span>
              <button
                type="button"
                onClick={() => deleteCategory(cat)}
                className="rounded p-1 text-[#94A3B8] hover:bg-[#FEF2F2] hover:text-[#DC2626] dark:hover:bg-[#EF4444]/15 dark:hover:text-[#F87171]"
                title="Remover categoria"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Alert Rules & Backup */}
      <div className="space-y-6">
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 dark:border-[#1E293B] dark:bg-[#111820]">
          <h3 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
            Regras de Alertas em Tempo Real
          </h3>
          <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
            Configure a sensibilidade do motor de alertas para estoque, duplicatas e fiado.
          </p>

          <div className="mt-4 space-y-4">
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-[#0F172A] dark:text-[#F1F5F9]">
                Notificações Toast em tempo real
              </span>
              <input
                type="checkbox"
                checked={alertSettings.notificacoesEmTempoReal}
                onChange={(e) =>
                  updateAlertSettings({ notificacoesEmTempoReal: e.target.checked })
                }
                className="h-4 w-4 accent-[#10B981]"
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-[#0F172A] dark:text-[#F1F5F9]">
                Varredura automática periódica
              </span>
              <input
                type="checkbox"
                checked={alertSettings.monitoramentoAutomatico}
                onChange={(e) =>
                  updateAlertSettings({ monitoramentoAutomatico: e.target.checked })
                }
                className="h-4 w-4 accent-[#10B981]"
              />
            </label>
            <div className="grid grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                  Aviso Duplicata (d)
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={alertSettings.diasAvisoDuplicata}
                  onChange={(e) =>
                    updateAlertSettings({ diasAvisoDuplicata: Number(e.target.value) || 3 })
                  }
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                  Preventivo (%)
                </label>
                <input
                  type="number"
                  min={100}
                  max={250}
                  value={alertSettings.percentualPreventivoEstoque}
                  onChange={(e) =>
                    updateAlertSettings({
                      percentualPreventivoEstoque: Number(e.target.value) || 125,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                  Aviso Fiado (d)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={alertSettings.diasAlertaFiado}
                  onChange={(e) =>
                    updateAlertSettings({ diasAlertaFiado: Number(e.target.value) || 5 })
                  }
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 dark:border-[#1E293B] dark:bg-[#111820]">
          <h3 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
            Backup & Dados Locais
          </h3>
          <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
            Exporte toda a base operacional em JSON ou zere os registros locais para recomeçar.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#052E16] hover:bg-[#34D399]"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar Backup JSON
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#10B981]/40 bg-[#ECFDF5] px-4 py-2 text-xs font-semibold text-[#059669] hover:bg-[#D1FAE5] dark:border-[#10B981]/30 dark:bg-[#10B981]/15 dark:text-[#34D399] dark:hover:bg-[#10B981]/25">
              <Upload className="h-3.5 w-3.5" />
              Importar Backup JSON
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    if (typeof reader.result === 'string') {
                      importBackupJSON(reader.result);
                    }
                  };
                  reader.readAsText(file);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              type="button"
              onClick={resetDemoData}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-2 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEE2E2] dark:border-[#EF4444]/30 dark:bg-[#EF4444]/15 dark:text-[#FCA5A5]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Zerar Base Operacional
            </button>
          </div>
        </section>

        {/* Supabase Cloud Sync */}
        <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 dark:border-[#1E293B] dark:bg-[#111820]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cloud className="h-4 w-4 text-[#10B981]" />
              <h3 className="font-display text-base font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                Banco Supabase (Interligar Máquinas)
              </h3>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                supabaseStatus.configured
                  ? 'bg-[#ECFDF5] text-[#059669] dark:bg-[#10B981]/15 dark:text-[#34D399]'
                  : 'bg-[#F1F5F9] text-[#64748B] dark:bg-[#1E293B] dark:text-[#94A3B8]'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  supabaseStatus.configured ? 'bg-[#10B981]' : 'bg-[#94A3B8]'
                }`}
              />
              {supabaseStatus.configured ? 'Conectado' : 'Desconectado'}
            </span>
          </div>

          <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
            Puxa automaticamente seus produtos da tabela <code className="font-mono">produtos</code>{' '}
            do Supabase e sincroniza o saldo de estoque em tempo real entre todos os computadores.
          </p>

          {supabaseStatus.configured && (
            <div className="mt-3 rounded-xl border border-[#10B981]/25 bg-[#ECFDF5]/60 p-3 text-xs dark:border-[#10B981]/25 dark:bg-[#10B981]/10">
              <div className="font-mono text-[#065F46] dark:text-[#34D399] break-all">
                {supabaseStatus.url}
              </div>
              <div className="mt-1 text-[#64748B] dark:text-[#94A3B8]">
                Chave salva no servidor: <span className="font-mono">{supabaseStatus.maskedKey}</span>
                {supabaseStatus.lastSyncAt && (
                  <> · Última sincronização: {new Date(supabaseStatus.lastSyncAt).toLocaleTimeString('pt-BR')}</>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={supabaseStatus.syncing}
                  onClick={() => void syncFromSupabase(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-3 py-1.5 text-xs font-semibold text-[#052E16] hover:bg-[#34D399] disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${supabaseStatus.syncing ? 'animate-spin' : ''}`} />
                  {supabaseStatus.syncing ? 'Sincronizando...' : 'Sincronizar Produtos Agora'}
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => void disconnectSupabase()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-1.5 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEE2E2] dark:border-[#EF4444]/30 dark:bg-[#EF4444]/15 dark:text-[#FCA5A5]"
                  >
                    Desconectar
                  </button>
                )}
              </div>
            </div>
          )}

          {isAdmin && (
            <form onSubmit={(e) => void handleConnectSupabase(e)} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                  URL do Projeto Supabase
                </label>
                <input
                  type="url"
                  required
                  value={sbUrl}
                  onChange={(e) => setSbUrl(e.target.value)}
                  placeholder="https://awjvktolzwqbzisewswy.supabase.co"
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                  Chave API do Supabase (anon/publishable ou service_role)
                </label>
                <input
                  type="password"
                  required={!supabaseStatus.configured}
                  value={sbKey}
                  onChange={(e) => setSbKey(e.target.value)}
                  placeholder="Cole aqui sua chave do Supabase (Project Settings → API Keys)"
                  className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                />
              </div>
              {sbError && (
                <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#B91C1C] dark:border-[#EF4444]/30 dark:bg-[#EF4444]/15 dark:text-[#FCA5A5]">
                  {sbError}
                </div>
              )}
              <button
                type="submit"
                disabled={sbBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#052E16] hover:bg-[#34D399] disabled:opacity-60"
              >
                <Cloud className="h-3.5 w-3.5" />
                {sbBusy
                  ? 'Conectando...'
                  : supabaseStatus.configured
                    ? 'Atualizar Chave e Reconectar'
                    : 'Conectar e Puxar Produtos'}
              </button>
            </form>
          )}

          <div className="mt-4 border-t border-[#F1F5F9] pt-3 dark:border-[#1E293B]">
            <button
              type="button"
              onClick={() => setShowSqlHint((v) => !v)}
              className="text-xs font-semibold text-[#059669] hover:underline dark:text-[#34D399]"
            >
              {supabaseStatus.cloudStateReady
                ? '✓ Sincronização completa de Vendas/Clientes/Notas ativa'
                : 'Opcional: quer sincronizar também Vendas, Clientes e Notas entre máquinas?'}
            </button>
            {showSqlHint && !supabaseStatus.cloudStateReady && (
              <div className="mt-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs dark:border-[#263442] dark:bg-[#0D151A]">
                <p className="text-[#475569] dark:text-[#CBD5E1]">
                  Seus <strong>Produtos e Estoque</strong> já sincronizam direto na sua tabela{' '}
                  <code>produtos</code>. Para sincronizar também vendas, clientes e configurações
                  entre máquinas, cole este comando no <strong>SQL Editor</strong> do Supabase:
                </p>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-[#0F172A] p-2.5 font-mono text-[11px] text-[#E2E8F0]">
                  {CLOUD_STATE_SQL}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(CLOUD_STATE_SQL);
                    setCopiedSql(true);
                    window.setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="mt-2 inline-flex items-center gap-1 rounded-md border border-[#CBD5E1] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0F172A] hover:bg-[#F1F5F9] dark:border-[#334155] dark:bg-[#1E293B] dark:text-white"
                >
                  {copiedSql ? <Check className="h-3 w-3 text-[#10B981]" /> : <Copy className="h-3 w-3" />}
                  {copiedSql ? 'SQL Copiado!' : 'Copiar SQL'}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export const UsuariosPage: React.FC = () => {
  const { authenticatedUser, logout, pushToast } = useStore();
  const isAdmin = authenticatedUser.cargo === 'Administrador';

  const [serverUsers, setServerUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AuthUser | null>(null);

  const [nome, setNome] = useState('');
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [cargo, setCargo] = useState<AuthUser['cargo']>('Operador PDV');
  const [saving, setSaving] = useState(false);

  // Change own password state
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await authFetch('/api/auth/users');
      if (resp.ok) {
        const data = (await resp.json()) as { users?: AuthUser[] };
        setServerUsers(data.users ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const openNew = () => {
    setEditing(null);
    setNome('');
    setLogin('');
    setSenha('');
    setCargo('Operador PDV');
    setDrawerOpen(true);
  };

  const openEdit = (u: AuthUser) => {
    setEditing(u);
    setNome(u.nome);
    setLogin(u.login);
    setSenha('');
    setCargo(u.cargo);
    setDrawerOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !login.trim()) return;
    if (!editing && senha.trim().length < 6) {
      pushToast({
        type: 'aviso',
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
      });
      return;
    }

    setSaving(true);
    try {
      const resp = await authFetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing?.id,
          nome: nome.trim(),
          login: login.trim(),
          cargo,
          senha: senha.trim() || undefined,
          ativo: true,
        }),
      });
      const data = (await resp.json()) as { users?: AuthUser[]; error?: string };
      if (!resp.ok) {
        pushToast({
          type: 'erro',
          title: 'Não foi possível salvar operador',
          description: data.error,
        });
        return;
      }
      if (data.users) setServerUsers(data.users);
      setDrawerOpen(false);
      pushToast({
        type: 'sucesso',
        title: editing ? 'Operador atualizado com segurança' : 'Operador cadastrado com segurança',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    const resp = await authFetch(`/api/auth/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const data = (await resp.json()) as { users?: AuthUser[]; error?: string };
    if (!resp.ok) {
      pushToast({
        type: 'erro',
        title: 'Não foi possível remover operador',
        description: data.error,
      });
      return;
    }
    if (data.users) setServerUsers(data.users);
    pushToast({ type: 'info', title: 'Operador removido' });
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaSenha.length < 6) {
      pushToast({
        type: 'aviso',
        title: 'Nova senha muito curta',
        description: 'Use pelo menos 6 caracteres.',
      });
      return;
    }
    setChangingPass(true);
    try {
      const resp = await authFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual, novaSenha }),
      });
      const data = (await resp.json()) as { ok?: boolean; error?: string };
      if (!resp.ok) {
        pushToast({
          type: 'erro',
          title: 'Erro ao alterar senha',
          description: data.error,
        });
        return;
      }
      setSenhaAtual('');
      setNovaSenha('');
      pushToast({
        type: 'sucesso',
        title: 'Sua senha foi atualizada',
        description: 'Senha protegida com criptografia scrypt no servidor.',
      });
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 dark:border-[#1E293B] dark:bg-[#111820]">
        <div className="flex items-center gap-2.5 text-sm text-[#64748B] dark:text-[#94A3B8]">
          <ShieldCheck className="h-4 w-4 text-[#10B981]" />
          <span>
            Conectado como{' '}
            <strong className="font-semibold text-[#059669] dark:text-[#34D399]">
              {authenticatedUser.nome}
            </strong>{' '}
            ({authenticatedUser.cargo})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] dark:border-[#263442] dark:text-[#CBD5E1] dark:hover:bg-[#1E293B]"
          >
            Bloquear / Trocar Operador
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#052E16] hover:bg-[#34D399]"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo Operador
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B] dark:border-[#1E293B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
            <tr>
              <th className="px-5 py-3">Nome</th>
              <th className="px-5 py-3">Login</th>
              <th className="px-5 py-3">Cargo</th>
              <th className="px-5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-xs text-[#64748B]">
                  Carregando operadores...
                </td>
              </tr>
            ) : (
              serverUsers.map((u) => (
                <tr key={u.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#16202A]">
                  <td className="px-5 py-3 font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                    {u.nome}{' '}
                    {u.id === authenticatedUser.id && (
                      <span className="ml-2 rounded bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-semibold text-[#059669] dark:bg-[#10B981]/15 dark:text-[#34D399]">
                        Sessão atual
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                    {u.login}
                  </td>
                  <td className="px-5 py-3 text-xs text-[#64748B] dark:text-[#94A3B8]">{u.cargo}</td>
                  <td className="px-5 py-3 text-right">
                    {isAdmin ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="rounded p-1.5 text-[#64748B] hover:bg-[#F1F5F9] dark:text-[#94A3B8] dark:hover:bg-[#1E293B] dark:hover:text-white"
                          title="Editar operador"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        {u.id !== authenticatedUser.id && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteUser(u.id)}
                            className="rounded p-1.5 text-[#64748B] hover:bg-[#FEF2F2] hover:text-[#DC2626] dark:text-[#94A3B8] dark:hover:bg-[#EF4444]/15 dark:hover:text-[#F87171]"
                            title="Remover operador"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#94A3B8]">Somente Admin</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Alterar Minha Senha */}
      <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[#10B981]" />
          <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            Alterar Minha Senha
          </h3>
        </div>
        <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
          Todas as senhas são armazenadas no servidor com salt aleatório (scrypt) e proteção contra força bruta.
        </p>
        <form
          onSubmit={(e) => void handleChangeOwnPassword(e)}
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <input
            required
            type="password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            placeholder="Senha atual"
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
          />
          <input
            required
            minLength={6}
            type="password"
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            placeholder="Nova senha (mín. 6 caracteres)"
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
          />
          <button
            type="submit"
            disabled={changingPass}
            className="rounded-lg bg-[#10B981] px-4 py-2 text-xs font-bold text-[#052E16] hover:bg-[#34D399] disabled:opacity-50"
          >
            {changingPass ? 'Atualizando...' : 'Atualizar Senha'}
          </button>
        </form>
      </section>

      <SlideOver
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Editar Operador' : 'Novo Operador'}
        widthClass="max-w-md"
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
              form="form-user"
              disabled={saving}
              className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#052E16] hover:bg-[#34D399] disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        <form id="form-user" onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Nome completo *
            </label>
            <input
              required
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Login *
            </label>
            <input
              required
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Cargo
            </label>
            <select
              value={cargo}
              onChange={(e) => setCargo(e.target.value as AuthUser['cargo'])}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            >
              <option value="Administrador">Administrador</option>
              <option value="Operador PDV">Operador PDV</option>
              <option value="Instalador / Equipe">Instalador / Equipe</option>
              <option value="Financeiro">Financeiro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              {editing ? 'Nova Senha (opcional)' : 'Senha * (mínimo 6 caracteres)'}
            </label>
            <input
              required={!editing}
              minLength={editing ? undefined : 6}
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder={editing ? 'Deixe vazio para manter a atual' : 'Mínimo 6 caracteres'}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>
        </form>
      </SlideOver>
    </div>
  );
};
