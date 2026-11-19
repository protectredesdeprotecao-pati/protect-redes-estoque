import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { NFeConfig, NFeRecord, Sale } from '../../types/erp';
import { formatBRL } from '../../utils/formatters';

export interface ReceiptPrintPayload {
  sale: Sale;
  nfe?: NFeRecord;
  config: NFeConfig;
}

function formatCnpj(v: string): string {
  const d = (v || '').replace(/\D/g, '').padStart(14, '0');
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatChaveGroups(chave: string): string {
  return (chave || '').replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
}

const PAYMENT_LABEL: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  credito: 'Cartão de Crédito',
  debito: 'Cartão de Débito',
  fiado: 'Fiado / A Prazo',
};

export const ThermalReceipt: React.FC<{ payload: ReceiptPrintPayload | null }> = ({ payload }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    const qrText = payload?.nfe?.qrCodeUrl;
    if (!qrText) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(qrText, { width: 160, margin: 1 })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [payload?.nfe?.qrCodeUrl]);

  if (!payload) return null;
  const { sale, nfe, config } = payload;
  const widthClass = config.larguraCupom === '58mm' ? 'w-[54mm]' : 'w-[74mm]';
  const cnpj = formatCnpj(config.cnpjPrestador || '23246816000103');
  const ie = config.inscricaoEstadual || '140002149114';
  const end = config.enderecoEmitente ?? {
    logradouro: 'R ANTONIO FORTUNATO',
    numero: '676',
    bairro: 'BURGO PAULISTA',
    cep: '03680000',
    uf: 'SP',
  };
  const dataHora = new Date(sale.criadoEm || Date.now()).toLocaleString('pt-BR');
  const isNfceAutorizada = Boolean(nfe && nfe.status === 'autorizada' && nfe.modelo === '65');
  const isNfeAutorizada = Boolean(nfe && nfe.status === 'autorizada');

  return (
    <div
      id="thermal-receipt-print-area"
      className={`hidden print:block ${widthClass} mx-auto bg-white p-1 font-mono text-[10px] leading-tight text-black`}
    >
      {/* Cabeçalho da Loja */}
      <div className="border-b border-dashed border-black pb-1.5 text-center">
        <div className="text-[12px] font-bold uppercase">PROTECT REDES COMERCIO E SERVICOS</div>
        <div className="text-[9px]">
          CNPJ: {cnpj} · IE: {ie}
        </div>
        <div className="text-[9px]">
          {end.logradouro}, {end.numero} · {end.bairro}
        </div>
        <div className="text-[9px]">São Paulo - {end.uf} · CEP {end.cep}</div>
      </div>

      {/* Título Fiscal / Comprovante */}
      <div className="border-b border-dashed border-black py-1.5 text-center">
        {isNfceAutorizada ? (
          <>
            <div className="text-[10px] font-bold">
              DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
            </div>
            {config.ambiente !== 'producao' && (
              <div className="mt-0.5 text-[9px] font-bold uppercase">
                *** EMITIDA EM HOMOLOGAÇÃO - SEM VALOR FISCAL ***
              </div>
            )}
          </>
        ) : isNfeAutorizada ? (
          <>
            <div className="text-[10px] font-bold">COMPROVANTE DE VENDA + NF-e AUTORIZADA</div>
            {config.ambiente !== 'producao' && (
              <div className="text-[9px] font-bold uppercase">HOMOLOGAÇÃO - SEM VALOR FISCAL</div>
            )}
          </>
        ) : (
          <>
            <div className="text-[10px] font-bold">COMPROVANTE DE VENDA #{sale.numero}</div>
            <div className="text-[9px]">
              {nfe?.status === 'rejeitada'
                ? 'Nota fiscal pendente de ajuste/reenvio'
                : 'Documento não fiscal · Caixa Balcão'}
            </div>
          </>
        )}
      </div>

      {/* Itens */}
      <div className="border-b border-dashed border-black py-1.5">
        <div className="mb-1 flex justify-between border-b border-black/40 pb-0.5 text-[9px] font-bold">
          <span>ITEM / DESCRIÇÃO</span>
          <span>QTD x UNIT = TOTAL</span>
        </div>
        {sale.itens.map((it, idx) => (
          <div key={`${it.produtoId}-${idx}`} className="mb-1">
            <div className="font-bold">
              {String(idx + 1).padStart(3, '0')} {it.codigo} {it.nome}
            </div>
            <div className="flex justify-between text-[9px]">
              <span>
                {it.quantidade} {it.unidade} x {formatBRL(it.precoUnitario)}
              </span>
              <span className="font-bold">{formatBRL(it.quantidade * it.precoUnitario)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Totais */}
      <div className="space-y-0.5 border-b border-dashed border-black py-1.5 text-[10px]">
        <div className="flex justify-between">
          <span>Qtd. total de itens</span>
          <span>{sale.itens.reduce((s, i) => s + i.quantidade, 0)}</span>
        </div>
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatBRL(sale.subtotal)}</span>
        </div>
        {sale.desconto > 0 && (
          <div className="flex justify-between">
            <span>Desconto</span>
            <span>- {formatBRL(sale.desconto)}</span>
          </div>
        )}
        <div className="flex justify-between pt-0.5 text-[12px] font-bold">
          <span>VALOR TOTAL</span>
          <span>{formatBRL(sale.total)}</span>
        </div>
        <div className="flex justify-between pt-0.5 text-[9px]">
          <span>Forma de Pagamento</span>
          <span>{PAYMENT_LABEL[sale.formaPagamento] || sale.formaPagamento}</span>
        </div>
        {sale.valorRecebido && sale.valorRecebido > 0 && (
          <>
            <div className="flex justify-between text-[9px]">
              <span>Valor Recebido</span>
              <span>{formatBRL(sale.valorRecebido)}</span>
            </div>
            <div className="flex justify-between text-[9px] font-bold">
              <span>Troco</span>
              <span>{formatBRL(sale.troco ?? 0)}</span>
            </div>
          </>
        )}
      </div>

      {/* Consumidor & Venda */}
      <div className="space-y-0.5 border-b border-dashed border-black py-1.5 text-[9px]">
        <div>
          <strong>Consumidor:</strong> {sale.clienteNome || 'Não identificado'}
        </div>
        {sale.clienteDoc && (
          <div>
            <strong>CPF/CNPJ:</strong> {sale.clienteDoc}
          </div>
        )}
        <div>
          <strong>Pedido:</strong> #{sale.numero} · <strong>Operador:</strong> {sale.vendedor}
        </div>
        <div>
          <strong>Data/Hora:</strong> {dataHora}
        </div>
      </div>

      {/* Dados Fiscais + QR Code NFC-e se disponível */}
      {nfe && (
        <div className="border-b border-dashed border-black py-1.5 text-center text-[9px]">
          <div className="font-bold">
            {nfe.modelo === '65' ? 'NFC-e' : 'NF-e'} nº {nfe.numero} · Série {config.serie || '1'}
          </div>
          {nfe.protocolo && <div>Protocolo de Autorização: {nfe.protocolo}</div>}
          <div className="mt-1 font-bold">CHAVE DE ACESSO</div>
          <div className="break-all text-[8px]">{formatChaveGroups(nfe.chave)}</div>
          {qrDataUrl && (
            <div className="mt-1.5 flex flex-col items-center">
              <img src={qrDataUrl} alt="QR Code NFC-e" className="h-28 w-28" />
              <div className="mt-0.5 text-[8px]">Consulte pela Chave ou QR Code em nfce.fazenda.sp.gov.br</div>
            </div>
          )}
        </div>
      )}

      <div className="pt-1.5 text-center text-[9px]">
        <div className="font-bold">Obrigado pela preferência!</div>
        <div>Protect Rede Estoque</div>
      </div>
    </div>
  );
};
