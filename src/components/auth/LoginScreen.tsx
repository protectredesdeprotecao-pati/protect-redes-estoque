import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { AuthUser } from '../../types/erp';
import { setAuthToken } from '../../utils/authClient';

interface LoginScreenProps {
  needsSetup: boolean;
  onAuthenticated: (user: AuthUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ needsSetup, onAuthenticated }) => {
  const [nome, setNome] = useState('Administrador');
  const [login, setLogin] = useState('admin');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (needsSetup) {
      if (senha.length < 6) {
        setError('A senha precisa ter no mínimo 6 caracteres.');
        return;
      }
      if (senha !== confirmarSenha) {
        setError('As duas senhas não conferem.');
        return;
      }
      setLoading(true);
      try {
        const resp = await fetch('/api/auth/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: nome.trim() || 'Administrador', login: login.trim(), senha }),
        });
        const data = (await resp.json()) as { token?: string; user?: AuthUser; error?: string };
        if (!resp.ok || !data.token || !data.user) {
          setError(data.error || 'Não foi possível criar o acesso.');
          return;
        }
        setAuthToken(data.token, remember);
        onAuthenticated(data.user);
      } catch {
        setError('Erro ao conectar ao servidor.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!login.trim() || !senha) {
      setError('Informe usuário e senha.');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: login.trim(), senha }),
      });
      const data = (await resp.json()) as { token?: string; user?: AuthUser; error?: string };
      if (!resp.ok || !data.token || !data.user) {
        setError(data.error || 'Usuário ou senha inválidos.');
        return;
      }
      setAuthToken(data.token, remember);
      onAuthenticated(data.user);
    } catch {
      setError('Erro ao conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090E12] px-4 py-10 text-[#F1F5F9]">
      <div className="w-full max-w-md rounded-2xl border border-[#1E293B] bg-[#0D151A] p-7 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <img
            src="/src/assets/images/protect_redes_logo_3d.png"
            alt="Protect Redes"
            referrerPolicy="no-referrer"
            className="h-12 w-auto object-contain drop-shadow-[0_4px_14px_rgba(16,185,129,0.28)]"
          />
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-1 text-xs font-semibold text-[#34D399]">
            <ShieldCheck className="h-3.5 w-3.5" />
            {needsSetup ? 'Primeiro Acesso · Segurança Ativada' : 'Sistema Protegido por Senha'}
          </div>
          <h1 className="mt-3 font-display text-xl font-bold text-white">
            {needsSetup ? 'Crie sua Senha de Administrador' : 'Entrar no Protect Redes'}
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-[#94A3B8]">
            {needsSetup
              ? 'Defina a senha principal para proteger estoque, caixa, certificado A1 e notas fiscais contra invasores.'
              : 'Digite seu usuário e senha para liberar o caixa, estoque e emissão automática de notas.'}
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          {needsSetup && (
            <div>
              <label className="block text-xs font-semibold text-[#CBD5E1]">Seu Nome</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#263442] bg-[#16202A] px-3.5 py-2.5 text-sm text-white placeholder-[#64748B] focus:border-[#10B981] focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#CBD5E1]">Usuário (Login)</label>
            <input
              type="text"
              required
              autoFocus
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="admin"
              className="mt-1 w-full rounded-xl border border-[#263442] bg-[#16202A] px-3.5 py-2.5 font-mono text-sm text-white placeholder-[#64748B] focus:border-[#10B981] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#CBD5E1]">
              {needsSetup ? 'Nova Senha (mínimo 6 caracteres)' : 'Senha'}
            </label>
            <div className="relative mt-1">
              <input
                type={showPass ? 'text' : 'password'}
                required
                autoComplete={needsSetup ? 'new-password' : 'current-password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#263442] bg-[#16202A] py-2.5 pr-10 pl-3.5 text-sm text-white placeholder-[#64748B] focus:border-[#10B981] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-[#94A3B8] hover:text-white"
                tabIndex={-1}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {needsSetup && (
            <div>
              <label className="block text-xs font-semibold text-[#CBD5E1]">Confirmar Senha</label>
              <input
                type={showPass ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                placeholder="Repita a senha"
                className="mt-1 w-full rounded-xl border border-[#263442] bg-[#16202A] px-3.5 py-2.5 text-sm text-white placeholder-[#64748B] focus:border-[#10B981] focus:outline-none"
              />
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-xs text-[#94A3B8]">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-3.5 w-3.5 accent-[#10B981]"
            />
            Manter conectado neste computador do caixa (24h)
          </label>

          {error && (
            <div className="rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/15 px-3.5 py-2.5 text-xs font-medium text-[#FCA5A5]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] py-3 text-sm font-bold text-[#052E16] transition-colors hover:bg-[#34D399] disabled:opacity-50"
          >
            {needsSetup ? <KeyRound className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {loading
              ? 'Verificando...'
              : needsSetup
                ? 'Salvar Senha e Entrar'
                : 'Entrar com Segurança'}
          </button>
        </form>

        <div className="mt-5 border-t border-white/8 pt-4 text-center text-[11px] text-[#64748B]">
          Criptografia de senha no servidor · Bloqueio automático após 5 erros · Token HMAC-SHA256
        </div>
      </div>
    </div>
  );
};
