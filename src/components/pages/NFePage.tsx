import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Calculator,
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  Info,
  KeyRound,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { NFeRecord, NFSeRecord } from '../../types/erp';
import { authFetch } from '../../utils/authClient';
import { formatBRL, formatDateBR } from '../../utils/formatters';
import { generateDanfsePdfBlob } from '../../utils/danfsePdf';
import { SlideOver } from '../ui/SlideOver';

interface CertStatus {
  loaded: boolean;
  subject?: string;
  cnpj?: string;
  issuer?: string;
  serialNumber?: string;
  validFrom?: string;
  validTo?: string;
  expired?: boolean;
  daysRemaining?: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildNFeUnsignedXml(nfe: NFeRecord): string {
  const docClean = nfe.clienteDoc.replace(/\D/g, '') || '00000000000';
  const docTag = docClean.length > 11 ? `<CNPJ>${docClean}</CNPJ>` : `<CPF>${docClean}</CPF>`;
  return `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe${nfe.chave}" versao="4.00"><ide><cUF>35</cUF><natOp>VENDA DE MERCADORIA</natOp><mod>55</mod><serie>1</serie><nNF>${parseInt(nfe.numero, 10) || 1}</nNF><dhEmi>${nfe.data}T10:00:00-03:00</dhEmi><tpNF>1</tpNF></ide><emit><xNome>Protect Rede Estoque Ltda</xNome></emit><dest>${docTag}<xNome>${escapeXml(nfe.clienteNome)}</xNome></dest><det nItem="1"><prod><cProd>PROT-PROD-01</cProd><xProd>Redes e Materiais de Protecao — Pedido ${escapeXml(nfe.numero)}</xProd><NCM>56081900</NCM><CFOP>5102</CFOP><uCom>UN</uCom><qCom>1.0000</qCom><vUnCom>${nfe.valor.toFixed(2)}</vUnCom><vProd>${nfe.valor.toFixed(2)}</vProd></prod></det><total><ICMSTot><vProd>${nfe.valor.toFixed(2)}</vProd><vNF>${nfe.valor.toFixed(2)}</vNF></ICMSTot></total></infNFe></NFe>`;
}

function triggerXmlDownload(xmlContent: string, filename: string) {
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildNFSeDpsXmlLocal(
  nfse: NFSeRecord,
  cnpjPrestador: string,
  inscMun: string,
  munIbge: string
) {
  const tomaDoc = nfse.tomadorDoc.replace(/\D/g, '') || '00000000000';
  const tomaTag = tomaDoc.length > 11 ? `<CNPJ>${tomaDoc}</CNPJ>` : `<CPF>${tomaDoc}</CPF>`;
  const prestCnpj = (cnpjPrestador || '').replace(/\D/g, '') || '23246816000103';
  const ibge = (munIbge || '3550308').replace(/\D/g, '').padStart(7, '0').slice(0, 7);
  const imRaw = (inscMun || '').replace(/\D/g, '');
  const imClean = imRaw ? (ibge === '3550308' ? imRaw.padStart(15, '0') : imRaw) : '';
  const cTribMun = (nfse.codigoTributacaoMunicipal || '001').replace(/\D/g, '').padStart(3, '0').slice(0, 3);
  const nbsDigits = nfse.codigoNbs.replace(/\D/g, '');
  const isSn = nfse.regimeTributario === 'simples_nacional';
  return `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">
  <infDPS Id="DPS${ibge}2${prestCnpj}00001${nfse.numeroDps.padStart(15, '0')}">
    <tpAmb>2</tpAmb>
    <dhEmi>${nfse.data}T10:00:00-03:00</dhEmi>
    <verAplic>ProtectRedes-1.0</verAplic>
    <serie>1</serie>
    <nDPS>${parseInt(nfse.numeroDps, 10) || 1}</nDPS>
    <dCompet>${nfse.data}</dCompet>
    <tpEmit>1</tpEmit>
    <finNFSe>0</finNFSe>
    <cLocEmi>${ibge}</cLocEmi>
    <prest>
      <CNPJ>${prestCnpj}</CNPJ>
      ${imClean ? `<IM>${escapeXml(imClean)}</IM>` : ''}
      <regTrib>
        <opSimpNac>${isSn ? '3' : '1'}</opSimpNac>
        ${isSn ? '<regApTribSN>1</regApTribSN>' : ''}
        <regEspTrib>0</regEspTrib>
      </regTrib>
    </prest>
    <toma>
      ${tomaTag}
      <xNome>${escapeXml(nfse.tomadorNome)}</xNome>
    </toma>
    <serv>
      <locPrest>
        <cLocPrestacao>${ibge}</cLocPrestacao>
      </locPrest>
      <cServ>
        <cTribNac>${escapeXml(nfse.codigoTributacaoNacional.replace(/\D/g, '').padStart(6, '0'))}</cTribNac>
        ${cTribMun ? `<cTribMun>${escapeXml(cTribMun)}</cTribMun>` : ''}
        ${nbsDigits.length === 9 ? `<cNBS>${escapeXml(nbsDigits)}</cNBS>` : ''}
        <xDescServ>${escapeXml(nfse.descricaoServico)}</xDescServ>
      </cServ>
    </serv>
    <valores>
      <vServPrest>
        <vServ>${nfse.valorServico.toFixed(2)}</vServ>
      </vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>1</tribISSQN>
          <tpRetISSQN>1</tpRetISSQN>
          ${!isSn ? `<pAliq>${nfse.aliquotaIss.toFixed(2)}</pAliq>` : ''}
        </tribMun>
        <totTrib>
          ${isSn ? '<pTotTribSN>0.00</pTotTribSN>' : '<vTotTrib><vTotTribFed>0.00</vTotTribFed><vTotTribEst>0.00</vTotTribEst><vTotTribMun>0.00</vTotTribMun></vTotTrib>'}
        </totTrib>
      </trib>
    </valores>
  </infDPS>
</DPS>`;
}

function buildRtcJsonPayload(nfse: NFSeRecord, ibge: string) {
  return {
    id: nfse.numeroDps,
    versao: '1.0',
    dataHoraEmissao: `${nfse.data}T10:00:00-03:00`,
    municipio: Number(ibge || 3550308),
    uf: 'SP',
    regimeApuracao: nfse.regimeTributario === 'simples_nacional' ? 'SIMPLES_NACIONAL' : 'REGIME_REGULAR',
    itens: [
      {
        numero: 1,
        nbs: nfse.codigoNbs.replace(/\D/g, ''),
        codigoTributacaoNacional: nfse.codigoTributacaoNacional,
        descricao: nfse.descricaoServico,
        cst: nfse.cstIbsCbs,
        cClassTrib: nfse.cClassTrib,
        valorBaseCalculo: nfse.valorServico,
        aliquotaIssReferencia: nfse.aliquotaIss,
        aliquotaCbs: nfse.aliquotaCbs,
        aliquotaIbs: nfse.aliquotaIbs,
      },
    ],
  };
}

const SERVICE_PRESETS = [
  {
    label: 'Instalação de Redes de Proteção — Sacadas / Janelas (Garantia 5 anos)',
    nbs: '1.0106.90.00',
    cTribNac: '14.06.01',
    cTribMun: '001',
    cst: '000',
    cClassTrib: '000001',
  },
  {
    label: 'Manutenção e Reparo de Estruturas e Telas',
    nbs: '1.0106.90.00',
    cTribNac: '14.01.01',
    cTribMun: '001',
    cst: '000',
    cClassTrib: '000001',
  },
  {
    label: 'Instalação / Acabamento em Construção (Obras)',
    nbs: '1.0702.00.00',
    cTribNac: '07.02.01',
    cTribMun: '001',
    cst: '000',
    cClassTrib: '000001',
  },
];

export const NFePage: React.FC = () => {
  const {
    nfes,
    nfses,
    nfeConfig,
    customers,
    sales,
    refreshCertStatus,
    emitAndTransmitProductNote,
    transmitExistingNFe,
    emitNFSe,
    updateNFSeStatus,
    updateNFeConfig,
    printSaleReceipt,
    pushToast,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'nfe' | 'nfse'>('nfse');
  const [statusFilter, setStatusFilter] = useState('');
  const [emitOpen, setEmitOpen] = useState(false);
  const [emitServiceOpen, setEmitServiceOpen] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [rtcGuideOpen, setRtcGuideOpen] = useState(false);
  const [certModalOpen, setCertModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Certificado A1 State
  const [certStatus, setCertStatus] = useState<CertStatus>({ loaded: false });
  const [pfxFileName, setPfxFileName] = useState('');
  const [pfxBase64, setPfxBase64] = useState('');
  const [pfxPassword, setPfxPassword] = useState('');
  const [certLoading, setCertLoading] = useState(false);
  const [testingMtls, setTestingMtls] = useState(false);
  const [transmittingId, setTransmittingId] = useState<string | null>(null);
  const [downloadingDanfseId, setDownloadingDanfseId] = useState<string | null>(null);
  const [danfseModalOpen, setDanfseModalOpen] = useState(false);
  const [danfsePdfUrl, setDanfsePdfUrl] = useState('');
  const [danfseActiveNote, setDanfseActiveNote] = useState<NFSeRecord | null>(null);

  // NF-e Produto Form
  const [destNome, setDestNome] = useState('');
  const [destDoc, setDestDoc] = useState('');
  const [destCep, setDestCep] = useState('');
  const [destEnd, setDestEnd] = useState('');
  const [destBairro, setDestBairro] = useState('');
  const [destCidade, setDestCidade] = useState('São Paulo');
  const [valor, setValor] = useState('');

  // NFS-e Serviço (Reforma Tributária) Form
  const [tomadorNome, setTomadorNome] = useState('');
  const [tomadorDoc, setTomadorDoc] = useState('');
  const [municipioInc, setMunicipioInc] = useState('São Paulo / SP');
  const [codigoNbs, setCodigoNbs] = useState(SERVICE_PRESETS[0].nbs);
  const [cTribNac, setCTribNac] = useState(SERVICE_PRESETS[0].cTribNac);
  const [descricaoServico, setDescricaoServico] = useState(SERVICE_PRESETS[0].label);
  const [regimeTributario, setRegimeTributario] = useState<'simples_nacional' | 'regime_regular'>(
    nfeConfig.regimePadrao ?? 'simples_nacional'
  );
  const [cstIbsCbs, setCstIbsCbs] = useState('000');
  const [cClassTrib, setCClassTrib] = useState('000001');
  const [valorServico, setValorServico] = useState('');
  const [aliqIss, setAliqIss] = useState('2.00');
  const [aliqCbs, setAliqCbs] = useState('0.90');
  const [aliqIbs, setAliqIbs] = useState('0.10');
  const [simulatingRtc, setSimulatingRtc] = useState(false);

  // Config form
  const [serverUrl, setServerUrl] = useState(nfeConfig.serverUrl);
  const [token, setToken] = useState(nfeConfig.token);
  const [ambiente, setAmbiente] = useState(nfeConfig.ambiente);
  const [serie, setSerie] = useState(nfeConfig.serie);
  const [rtcCalculadoraUrl, setRtcCalculadoraUrl] = useState(nfeConfig.rtcCalculadoraUrl ?? '');
  const [nfseSefinUrl, setNfseSefinUrl] = useState(
    (nfeConfig.nfseSefinUrl ?? 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional').replace(
      '/API/SefinNacional',
      '/SefinNacional'
    )
  );
  const [regimePadrao, setRegimePadrao] = useState<'simples_nacional' | 'regime_regular'>(
    nfeConfig.regimePadrao ?? 'simples_nacional'
  );
  const [cnpjPrestador, setCnpjPrestador] = useState(nfeConfig.cnpjPrestador ?? '');
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState(nfeConfig.inscricaoMunicipal ?? '');
  const [inscricaoEstadual, setInscricaoEstadual] = useState(
    nfeConfig.inscricaoEstadual ?? '140002149114'
  );
  const [municipioIbge, setMunicipioIbge] = useState(nfeConfig.municipioIbge ?? '3550308');
  const [modeloProdutoPadrao, setModeloProdutoPadrao] = useState<'65' | '55'>(
    nfeConfig.modeloProdutoPadrao ?? '65'
  );
  const [cscId, setCscId] = useState(nfeConfig.cscId ?? '');
  const [cscToken, setCscToken] = useState(nfeConfig.cscToken ?? '');
  const [autoEmitirNfse, setAutoEmitirNfse] = useState(nfeConfig.autoEmitirNfse !== false);
  const [autoEmitirNfeProduto, setAutoEmitirNfeProduto] = useState(
    nfeConfig.autoEmitirNfeProduto !== false
  );
  const [autoImprimirNotinha, setAutoImprimirNotinha] = useState(
    nfeConfig.autoImprimirNotinha !== false
  );
  const [larguraCupom, setLarguraCupom] = useState<'80mm' | '58mm'>(
    nfeConfig.larguraCupom ?? '80mm'
  );
  const [endLogradouro, setEndLogradouro] = useState(
    nfeConfig.enderecoEmitente?.logradouro ?? 'R ANTONIO FORTUNATO'
  );
  const [endNumero, setEndNumero] = useState(nfeConfig.enderecoEmitente?.numero ?? '676');
  const [endBairro, setEndBairro] = useState(
    nfeConfig.enderecoEmitente?.bairro ?? 'BURGO PAULISTA'
  );
  const [endCep, setEndCep] = useState(nfeConfig.enderecoEmitente?.cep ?? '03680000');

  const fetchCertStatus = useCallback(async () => {
    try {
      const resp = await authFetch('/api/fiscal/certificado/status');
      if (!resp.ok) return;
      const data = (await resp.json()) as CertStatus;
      setCertStatus(data);
    } catch {
      // ignore if backend not reachable
    }
  }, []);

  useEffect(() => {
    void fetchCertStatus();
  }, [fetchCertStatus]);

  const handlePfxFileChange = (file: File) => {
    setPfxFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPfxBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadCert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pfxBase64 || !pfxPassword) return;
    setCertLoading(true);
    try {
      const resp = await authFetch('/api/fiscal/certificado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pfxBase64, password: pfxPassword }),
      });
      const data = (await resp.json()) as CertStatus & { error?: string };
      if (!resp.ok) {
        pushToast({
          type: 'erro',
          title: 'Falha ao validar Certificado A1',
          description: data.error || 'Verifique o arquivo .pfx e a senha.',
        });
        return;
      }
      setCertStatus(data);
      void refreshCertStatus();
      if (data.cnpj && !nfeConfig.cnpjPrestador) {
        setCnpjPrestador(data.cnpj);
        updateNFeConfig({ ...nfeConfig, cnpjPrestador: data.cnpj });
      }
      setCertModalOpen(false);
      setPfxPassword('');
      pushToast({
        type: 'sucesso',
        title: 'Certificado Digital A1 conectado',
        description: `${data.subject ?? 'e-CNPJ'} · Válido (${data.daysRemaining ?? 0}d restantes).`,
      });
    } catch {
      pushToast({ type: 'erro', title: 'Erro ao enviar certificado para o servidor' });
    } finally {
      setCertLoading(false);
    }
  };

  const handleDisconnectCert = async () => {
    await authFetch('/api/fiscal/certificado', { method: 'DELETE' });
    setCertStatus({ loaded: false });
    void refreshCertStatus();
    setPfxBase64('');
    setPfxFileName('');
    pushToast({ type: 'info', title: 'Certificado A1 desconectado da sessão' });
  };

  const handleTestMtls = async () => {
    setTestingMtls(true);
    try {
      const resp = await authFetch('/api/fiscal/testar-mtls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ambiente: nfeConfig.ambiente,
          municipioIbge: nfeConfig.municipioIbge || '3550308',
        }),
      });
      const data = (await resp.json()) as { ok?: boolean; status?: number; error?: string; endpoint?: string };
      if (data.ok) {
        pushToast({
          type: 'sucesso',
          title: `Conexão mTLS Gov OK (HTTP ${data.status})`,
          description: 'Certificado A1 aceito pelo barramento da NFS-e Nacional.',
        });
      } else {
        pushToast({
          type: 'aviso',
          title: 'Retorno do barramento Gov',
          description: data.error || `HTTP ${data.status ?? 0}`,
        });
      }
    } catch {
      pushToast({ type: 'erro', title: 'Erro ao testar conexão mTLS' });
    } finally {
      setTestingMtls(false);
    }
  };

  const handleDownloadSignedNFSeXml = async (n: NFSeRecord) => {
    const cnpj = nfeConfig.cnpjPrestador || certStatus.cnpj || '';
    const im = nfeConfig.inscricaoMunicipal || '';
    const ibge = nfeConfig.municipioIbge || '3550308';
    try {
      const resp = await authFetch('/api/fiscal/nfse/assinar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numeroDps: n.numeroDps,
          serie: nfeConfig.serie || '1',
          data: n.data,
          ambiente: nfeConfig.ambiente,
          cnpjPrestador: cnpj,
          inscricaoMunicipal: im,
          municipioIbge: ibge,
          tomadorNome: n.tomadorNome,
          tomadorDoc: n.tomadorDoc,
          codigoNbs: n.codigoNbs,
          codigoTributacaoNacional: n.codigoTributacaoNacional,
          codigoTributacaoMunicipal: n.codigoTributacaoMunicipal || '001',
          descricaoServico: n.descricaoServico,
          regimeTributario: n.regimeTributario,
          cstIbsCbs: n.cstIbsCbs,
          cClassTrib: n.cClassTrib,
          valorServico: n.valorServico,
          aliquotaIss: n.aliquotaIss,
          aliquotaCbs: n.aliquotaCbs,
          aliquotaIbs: n.aliquotaIbs,
          valorCbs: n.valorCbs,
          valorIbs: n.valorIbs,
        }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { signed: boolean; xml: string };
        triggerXmlDownload(
          data.xml,
          `DPS-NFSe-${n.numeroDps}${data.signed ? '-ASSINADA-A1' : ''}.xml`
        );
        pushToast({
          type: 'sucesso',
          title: data.signed
            ? `XML DPS #${n.numeroDps} assinado com A1`
            : `XML DPS #${n.numeroDps} gerado`,
          description: data.signed
            ? 'Assinatura digital XMLDSig aplicada com seu Certificado A1.'
            : 'Conecte seu Certificado A1 para baixar já assinado.',
        });
        return;
      }
    } catch {
      // fallback to local XML
    }
    triggerXmlDownload(buildNFSeDpsXmlLocal(n, cnpj, im, ibge), `DPS-NFSe-${n.numeroDps}.xml`);
  };

  const handleTransmitNFSeReal = async (n: NFSeRecord) => {
    if (!certStatus.loaded) {
      setCertModalOpen(true);
      pushToast({
        type: 'aviso',
        title: 'Conecte seu Certificado A1 primeiro',
        description: 'Envie o arquivo .pfx e a senha para assinar e transmitir via mTLS.',
      });
      return;
    }

    setTransmittingId(n.id);
    try {
      const resp = await authFetch('/api/fiscal/nfse/transmitir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dps: {
            numeroDps: n.numeroDps,
            serie: nfeConfig.serie || '1',
            data: n.data,
            ambiente: nfeConfig.ambiente,
            cnpjPrestador: nfeConfig.cnpjPrestador || certStatus.cnpj || '23246816000103',
            inscricaoMunicipal: nfeConfig.inscricaoMunicipal || '000000053254996',
            municipioIbge: nfeConfig.municipioIbge || '3550308',
            tomadorNome: n.tomadorNome,
            tomadorDoc: n.tomadorDoc,
            codigoNbs: n.codigoNbs,
            codigoTributacaoNacional: n.codigoTributacaoNacional,
            codigoTributacaoMunicipal: n.codigoTributacaoMunicipal || '001',
            descricaoServico: n.descricaoServico,
            regimeTributario: n.regimeTributario,
            cstIbsCbs: n.cstIbsCbs,
            cClassTrib: n.cClassTrib,
            valorServico: n.valorServico,
            aliquotaIss: n.aliquotaIss,
            aliquotaCbs: n.aliquotaCbs,
            aliquotaIbs: n.aliquotaIbs,
            valorCbs: n.valorCbs,
            valorIbs: n.valorIbs,
          },
          sefinUrl: nfeConfig.nfseSefinUrl,
          customProxyUrl: nfeConfig.serverUrl,
          token: nfeConfig.token,
        }),
      });
      const data = (await resp.json()) as {
        authorized?: boolean;
        chaveAcesso?: string;
        error?: string;
      };
      if (resp.ok && data.authorized) {
        updateNFSeStatus(n.id, 'autorizada', { chaveNfse: data.chaveAcesso });
        pushToast({
          type: 'sucesso',
          title: `NFS-e DPS #${n.numeroDps} autorizada!`,
          description: data.chaveAcesso ? `Chave: ${data.chaveAcesso}` : 'Retorno confirmado.',
        });
      } else {
        updateNFSeStatus(n.id, 'rejeitada', { motivoRejeicao: data.error });
        pushToast({
          type: 'erro',
          title: `Retorno da Sefin Nacional (DPS #${n.numeroDps})`,
          description: data.error || 'Confira credenciamento no Portal NFS-e Nacional e CNPJ.',
        });
      }
    } catch {
      pushToast({
        type: 'erro',
        title: 'Falha ao conectar com Sefin Nacional',
        description: 'Verifique a conexão do servidor ou endpoint configurado.',
      });
    } finally {
      setTransmittingId(null);
    }
  };

  const handleOpenDanfsePdf = async (n: NFSeRecord) => {
    const chave = (n.chaveNfse || '').replace(/\D/g, '');
    if (chave.length !== 50) {
      pushToast({
        type: 'aviso',
        title: 'Chave de acesso ausente',
        description: 'Transmita a nota primeiro para receber a chave oficial de 50 dígitos.',
      });
      return;
    }

    setDownloadingDanfseId(n.id);
    try {
      let pdfBlob: Blob | null = null;
      let usedOfficialXml = false;

      // 1. Tenta baixar PDF direto do ADN se o certificado A1 estiver conectado
      if (certStatus.loaded) {
        try {
          const resp = await authFetch(
            `/api/fiscal/nfse/danfse/${chave}?ambiente=${nfeConfig.ambiente}`
          );
          const ctype = resp.headers.get('content-type') || '';
          if (resp.ok && ctype.includes('pdf')) {
            pdfBlob = await resp.blob();
          }
        } catch {
          // Segue para geração local conforme NT 008/2026
        }
      }

      // 2. Conforme NT 008/2026, busca o XML oficial autorizado na Sefin e gera o DANFSe v2.0 PDF
      if (!pdfBlob) {
        let authorizedXml: string | undefined;
        if (certStatus.loaded) {
          try {
            const xmlResp = await authFetch(
              `/api/fiscal/nfse/xml-autorizado/${chave}?ambiente=${nfeConfig.ambiente}`
            );
            if (xmlResp.ok) {
              const xmlJson = (await xmlResp.json()) as { xml?: string };
              if (xmlJson.xml) {
                authorizedXml = xmlJson.xml;
                usedOfficialXml = true;
              }
            }
          } catch {
            // Segue com os dados da nota autorizada
          }
        }

        pdfBlob = await generateDanfsePdfBlob({
          nfse: n,
          cnpjPrestador: nfeConfig.cnpjPrestador || certStatus.cnpj || '23246816000103',
          inscricaoMunicipal: nfeConfig.inscricaoMunicipal || '000000053254996',
          ambiente: nfeConfig.ambiente,
          serie: nfeConfig.serie || '1',
          authorizedXml,
        });
      }

      if (danfsePdfUrl) URL.revokeObjectURL(danfsePdfUrl);
      const url = URL.createObjectURL(pdfBlob);
      setDanfsePdfUrl(url);
      setDanfseActiveNote(n);
      setDanfseModalOpen(true);

      const a = document.createElement('a');
      a.href = url;
      a.download = `DANFSe-${n.numeroDps}-${chave.slice(-8)}.pdf`;
      a.click();

      pushToast({
        type: 'sucesso',
        title: `DANFSe PDF #${n.numeroDps} pronta!`,
        description: usedOfficialXml
          ? 'PDF gerado a partir do XML oficial autorizado pela Sefin Nacional.'
          : 'PDF DANFSe v2.0 aberto na tela e salvo nos downloads.',
      });
    } catch {
      pushToast({
        type: 'erro',
        title: 'Erro ao gerar DANFSe PDF',
        description: 'Tente novamente em instantes.',
      });
    } finally {
      setDownloadingDanfseId(null);
    }
  };

  const handleDownloadAuthorizedXml = async (n: NFSeRecord) => {
    if (!certStatus.loaded) {
      setCertModalOpen(true);
      pushToast({
        type: 'aviso',
        title: 'Conecte seu Certificado A1 primeiro',
        description: 'Envie o arquivo .pfx e a senha para baixar o XML oficial autorizado.',
      });
      return;
    }
    const chave = (n.chaveNfse || '').replace(/\D/g, '');
    if (chave.length !== 50) return;

    try {
      const resp = await authFetch(
        `/api/fiscal/nfse/xml-autorizado/${chave}?ambiente=${nfeConfig.ambiente}`
      );
      const data = (await resp.json()) as { xml?: string; error?: string };
      if (resp.ok && data.xml) {
        triggerXmlDownload(data.xml, `NFSe-Autorizada-${n.numeroDps}.xml`);
        pushToast({
          type: 'sucesso',
          title: `XML oficial da NFS-e #${n.numeroDps} baixado!`,
        });
      } else {
        pushToast({
          type: 'erro',
          title: 'Erro ao consultar XML na Sefin',
          description: data.error || 'Tente novamente em instantes.',
        });
      }
    } catch {
      pushToast({ type: 'erro', title: 'Falha ao consultar XML oficial' });
    }
  };

  const handleDownloadNFeXml = async (n: NFeRecord) => {
    if (n.xmlSigned) {
      triggerXmlDownload(n.xmlSigned, `NFe-${n.numero}-ASSINADA-A1.xml`);
      pushToast({
        type: 'sucesso',
        title: `XML assinado #${n.numero} baixado`,
      });
      return;
    }
    const unsigned = buildNFeUnsignedXml(n);
    try {
      const resp = await authFetch('/api/fiscal/nfe/assinar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xmlUnsigned: unsigned, nfeKey: n.chave }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as { signed: boolean; xml: string };
        triggerXmlDownload(
          data.xml,
          `NFe-${n.numero}-${data.signed ? 'ASSINADA-A1' : 'sebrae'}.xml`
        );
        pushToast({
          type: 'sucesso',
          title: data.signed
            ? `XML NF-e #${n.numero} assinado com A1`
            : `XML NF-e #${n.numero} gerado`,
          description: data.signed
            ? 'Assinatura XMLDSig aplicada com seu A1.'
            : 'Pronto para importação no emissor Sebrae ou contador.',
        });
        return;
      }
    } catch {
      // fallback
    }
    triggerXmlDownload(unsigned, `NFe-${n.numero}-sebrae.xml`);
  };

  const nfeKpis = useMemo(
    () => ({
      autorizadas: nfes.filter((n) => n.status === 'autorizada').length,
      pendentes: nfes.filter((n) => n.status === 'pendente').length,
      rejeitadas: nfes.filter((n) => n.status === 'rejeitada').length,
      totalValor: nfes.filter((n) => n.status === 'autorizada').reduce((s, n) => s + n.valor, 0),
    }),
    [nfes]
  );

  const nfseKpis = useMemo(
    () => ({
      totalNotas: nfses.length,
      totalServicos: nfses.reduce((s, n) => s + n.valorServico, 0),
      totalCbsIbs: nfses.reduce((s, n) => s + n.valorCbs + n.valorIbs, 0),
      totalIss: nfses.reduce((s, n) => s + n.valorIss, 0),
    }),
    [nfses]
  );

  const filteredNFe = useMemo(
    () => (!statusFilter ? nfes : nfes.filter((n) => n.status === statusFilter)),
    [nfes, statusFilter]
  );

  const filteredNFSe = useMemo(
    () => (!statusFilter ? nfses : nfses.filter((n) => n.status === statusFilter)),
    [nfses, statusFilter]
  );

  const serviceCalcPreview = useMemo(() => {
    const base = parseFloat(valorServico) || 0;
    const issRate = parseFloat(aliqIss) || 0;
    const cbsRate = parseFloat(aliqCbs) || 0;
    const ibsRate = parseFloat(aliqIbs) || 0;
    return {
      base,
      valorIss: (base * issRate) / 100,
      valorCbs: (base * cbsRate) / 100,
      valorIbs: (base * ibsRate) / 100,
    };
  }, [aliqCbs, aliqIbs, aliqIss, valorServico]);

  const buscarCEP = async () => {
    const clean = destCep.replace(/\D/g, '');
    if (clean.length !== 8) return;
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = (await resp.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
      };
      if (!data.erro) {
        if (data.logradouro) setDestEnd(data.logradouro);
        if (data.bairro) setDestBairro(data.bairro);
        if (data.localidade) setDestCidade(data.localidade);
        pushToast({ type: 'info', title: 'CEP localizado via ViaCEP' });
      }
    } catch {
      // ignore network error
    }
  };

  const handleEmitNFe = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(valor) || 0;
    if (!destNome.trim() || !destDoc.trim() || num <= 0) return;
    void emitAndTransmitProductNote({
      clienteNome: destNome.trim(),
      clienteDoc: destDoc.trim(),
      valor: num,
      modelo: nfeConfig.modeloProdutoPadrao ?? '65',
      autoTransmit: nfeConfig.autoEmitirNfeProduto !== false,
    });
    setEmitOpen(false);
    setDestNome('');
    setDestDoc('');
    setValor('');
  };

  const handleSimularRtc = async () => {
    const base = parseFloat(valorServico) || 0;
    if (base <= 0) {
      pushToast({ type: 'aviso', title: 'Informe o valor do serviço para simular' });
      return;
    }
    const url = rtcCalculadoraUrl.trim();
    if (!url) {
      pushToast({
        type: 'info',
        title: 'Simulação LC 214/2025 aplicada localmente',
        description: `CBS ${formatBRL(serviceCalcPreview.valorCbs)} (${aliqCbs}%) + IBS ${formatBRL(serviceCalcPreview.valorIbs)} (${aliqIbs}%).`,
      });
      return;
    }

    setSimulatingRtc(true);
    try {
      const resp = await authFetch('/api/fiscal/rtc/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rtcBaseUrl: url,
          payload: {
            valorServico: base,
            nbs: codigoNbs.replace(/\D/g, ''),
            cst: cstIbsCbs,
            cClassTrib,
            municipio: Number(municipioIbge || 3550308),
          },
        }),
      });
      if (!resp.ok) throw new Error('Falha na API RTC');
      pushToast({
        type: 'sucesso',
        title: 'Memória de cálculo obtida da Calculadora RTC',
      });
    } catch {
      pushToast({
        type: 'aviso',
        title: 'Não foi possível alcançar o endpoint RTC',
        description: 'Mantido cálculo local de referência (CBS/IBS).',
      });
    } finally {
      setSimulatingRtc(false);
    }
  };

  const handleEmitNFSe = (e: React.FormEvent) => {
    e.preventDefault();
    const base = parseFloat(valorServico) || 0;
    if (!tomadorNome.trim() || !tomadorDoc.trim() || base <= 0) return;
    emitNFSe({
      tomadorNome: tomadorNome.trim(),
      tomadorDoc: tomadorDoc.trim(),
      municipioIncidencia: municipioInc.trim() || 'São Paulo / SP',
      codigoNbs: codigoNbs.trim(),
      codigoTributacaoNacional: cTribNac.trim(),
      codigoTributacaoMunicipal: '001',
      descricaoServico: descricaoServico.trim() || 'Instalação de redes de proteção',
      regimeTributario,
      cstIbsCbs,
      cClassTrib,
      valorServico: base,
      aliquotaIss: parseFloat(aliqIss) || 0,
      aliquotaCbs: parseFloat(aliqCbs) || 0,
      aliquotaIbs: parseFloat(aliqIbs) || 0,
      valorIss: serviceCalcPreview.valorIss,
      valorCbs: serviceCalcPreview.valorCbs,
      valorIbs: serviceCalcPreview.valorIbs,
    });
    setEmitServiceOpen(false);
    setTomadorNome('');
    setTomadorDoc('');
    setValorServico('');
  };

  const handleSaveCfg = (e: React.FormEvent) => {
    e.preventDefault();
    updateNFeConfig({
      serverUrl,
      token,
      ambiente,
      serie,
      rtcCalculadoraUrl,
      nfseSefinUrl,
      regimePadrao,
      cnpjPrestador,
      inscricaoMunicipal,
      inscricaoEstadual,
      municipioIbge,
      modeloProdutoPadrao,
      cscId,
      cscToken,
      autoEmitirNfse,
      autoEmitirNfeProduto,
      autoImprimirNotinha,
      larguraCupom,
      enderecoEmitente: {
        logradouro: endLogradouro.trim() || 'R ANTONIO FORTUNATO',
        numero: endNumero.trim() || '676',
        bairro: endBairro.trim() || 'BURGO PAULISTA',
        cep: endCep.replace(/\D/g, '').padStart(8, '0').slice(0, 8),
        uf: 'SP',
      },
    });
    setCfgOpen(false);
  };

  const copyText = (key: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  };

  return (
    <div className="space-y-5">
      {/* Certificado Digital A1 Status Bar */}
      <section
        className={`rounded-2xl border p-4 ${
          certStatus.loaded && !certStatus.expired
            ? 'border-[#10B981]/35 bg-[#ECFDF5]/60 dark:border-[#10B981]/30 dark:bg-[#0D1F18]'
            : 'border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                certStatus.loaded && !certStatus.expired
                  ? 'bg-[#10B981] text-[#052E16]'
                  : 'bg-[#F1F5F9] text-[#64748B] dark:bg-[#16202A] dark:text-[#94A3B8]'
              }`}
            >
              {certStatus.loaded ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <KeyRound className="h-5 w-5" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                  {certStatus.loaded
                    ? `Certificado A1 Ativo: ${certStatus.subject}`
                    : 'Certificado Digital A1 (.pfx) não conectado'}
                </h3>
                {certStatus.loaded && (
                  <span
                    className={`rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
                      certStatus.expired
                        ? 'bg-[#FEE2E2] text-[#DC2626] dark:bg-[#EF4444]/20 dark:text-[#FCA5A5]'
                        : 'bg-[#10B981]/20 text-[#059669] dark:text-[#34D399]'
                    }`}
                  >
                    {certStatus.expired
                      ? 'Vencido'
                      : `Válido · ${certStatus.daysRemaining ?? 0}d restantes`}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                {certStatus.loaded
                  ? `CNPJ: ${certStatus.cnpj || '—'} · Emissor: ${certStatus.issuer} · Ambiente atual: ${
                      nfeConfig.ambiente === 'producao' ? 'PRODUÇÃO' : 'HOMOLOGAÇÃO (Testes)'
                    }`
                  : 'Envie seu arquivo .pfx e senha para assinar XMLs (XMLDSig RSA-SHA256) e transmitir via mTLS direto ao governo.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {certStatus.loaded ? (
              <>
                <button
                  type="button"
                  disabled={testingMtls}
                  onClick={() => void handleTestMtls()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#10B981]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#059669] hover:bg-[#ECFDF5] dark:bg-[#16202A] dark:text-[#34D399] dark:hover:bg-[#1E293B]"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${testingMtls ? 'animate-spin' : ''}`} />
                  {testingMtls ? 'Testando mTLS...' : 'Testar Conexão Gov (mTLS)'}
                </button>
                <button
                  type="button"
                  onClick={() => setCertModalOpen(true)}
                  className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                >
                  Trocar A1
                </button>
                <button
                  type="button"
                  onClick={() => void handleDisconnectCert()}
                  className="rounded-lg p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] dark:text-[#F87171] dark:hover:bg-[#EF4444]/15"
                  title="Desconectar Certificado A1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setCertModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#052E16] hover:bg-[#34D399]"
              >
                <Upload className="h-3.5 w-3.5" />
                Conectar Certificado A1 (.pfx)
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Mode Tabs: NFS-e Serviços vs NF-e Produto */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-[#E2E8F0] bg-white p-1 dark:border-[#1E293B] dark:bg-[#111820]">
          <button
            type="button"
            onClick={() => setActiveTab('nfse')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'nfse'
                ? 'bg-[#10B981] text-[#052E16]'
                : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            NFS-e Serviços (Sem listar itens)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('nfe')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === 'nfe'
                ? 'bg-[#10B981] text-[#052E16]'
                : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            NFC-e / NF-e Produto (SEFAZ-SP)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRtcGuideOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9] dark:hover:bg-[#1E293B]"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#34D399]" />
            APIs Receita Federal (RTC)
          </button>
          <button
            type="button"
            onClick={() => setCfgOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9] dark:hover:bg-[#1E293B]"
          >
            <Settings className="h-3.5 w-3.5" />
            Configurar Empresa & Endpoints
          </button>
        </div>
      </div>

      {activeTab === 'nfse' ? (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
              <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                DPS / NFS-e Registradas
              </div>
              <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                {nfseKpis.totalNotas}
              </div>
            </div>
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
              <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                Faturamento Serviços
              </div>
              <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
                {formatBRL(nfseKpis.totalServicos)}
              </div>
            </div>
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
              <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                CBS + IBS (Reforma)
              </div>
              <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#3B82F6] dark:text-[#60A5FA]">
                {formatBRL(nfseKpis.totalCbsIbs)}
              </div>
            </div>
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
              <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                ISSQN Municipal
              </div>
              <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#D97706] dark:text-[#FBBF24]">
                {formatBRL(nfseKpis.totalIss)}
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 dark:border-[#1E293B] dark:bg-[#111820]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            >
              <option value="">Todas as NFS-e / DPS</option>
              <option value="autorizada">Autorizadas</option>
              <option value="pendente">Pendentes</option>
              <option value="rejeitada">Rejeitadas</option>
            </select>

            <button
              type="button"
              onClick={() => setEmitServiceOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#052E16] hover:bg-[#34D399]"
            >
              <Plus className="h-3.5 w-3.5" />
              Emitir NFS-e Serviço (DPS)
            </button>
          </div>

          {filteredNFSe.some((n) => n.status === 'pendente') && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#F59E0B]/30 bg-[#FFFBEB]/70 px-4 py-2.5 text-xs text-[#92400E] dark:border-[#F59E0B]/30 dark:bg-[#F59E0B]/10 dark:text-[#FCD34D]">
              <span>
                <strong>Próximo passo:</strong> clique no botão verde{' '}
                <strong>Transmitir (A1)</strong> na linha da nota pendente para enviar à Sefin
                Nacional (ou clique em <strong>XML</strong> para baixar já assinado).
              </span>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B] dark:border-[#1E293B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
                  <tr>
                    <th className="px-3 py-3">DPS / Data</th>
                    <th className="px-3 py-3">Tomador / Serviço</th>
                    <th className="hidden px-3 py-3 md:table-cell">NBS / RTC</th>
                    <th className="px-3 py-3 text-right">Valor &amp; Tributos</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
                  {filteredNFSe.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-xs text-[#64748B] dark:text-[#94A3B8]"
                      >
                        Nenhuma NFS-e de serviço registrada. Você pode gerar direto de{' '}
                        <strong className="text-[#0F172A] dark:text-[#F1F5F9]">Saída Equipes</strong>{' '}
                        (mostrando só o valor do serviço) ou clicar em{' '}
                        <strong className="text-[#0F172A] dark:text-[#F1F5F9]">
                          Emitir NFS-e Serviço (DPS)
                        </strong>
                        .
                      </td>
                    </tr>
                  ) : (
                    filteredNFSe.map((n) => (
                      <tr key={n.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#16202A]">
                        <td className="px-3 py-3 align-top font-mono text-xs">
                          <div className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                            #{n.numeroDps}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                            {formatDateBR(n.data)}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                            {n.tomadorNome}
                          </div>
                          <div className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                            {n.tomadorDoc} · {n.descricaoServico}
                          </div>
                          {n.chaveNfse && (
                            <div className="mt-0.5 font-mono text-[11px] text-[#059669] dark:text-[#34D399]">
                              Chave: {n.chaveNfse}
                            </div>
                          )}
                          {n.motivoRejeicao && (
                            <div className="mt-1 rounded bg-[#FEF2F2] px-2 py-1 text-[11px] font-medium text-[#DC2626] dark:bg-[#EF4444]/15 dark:text-[#FCA5A5]">
                              {n.motivoRejeicao}
                            </div>
                          )}
                        </td>
                        <td className="hidden px-3 py-3 align-top font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8] md:table-cell">
                          <div>NBS {n.codigoNbs}</div>
                          <div>
                            CST {n.cstIbsCbs} · Class {n.cClassTrib}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top text-right font-mono tabular-nums">
                          <div className="text-sm font-bold text-[#0F172A] dark:text-[#34D399]">
                            {formatBRL(n.valorServico)}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#3B82F6] dark:text-[#60A5FA]">
                            CBS+IBS {formatBRL(n.valorCbs + n.valorIbs)}
                          </div>
                          <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                            ISS {formatBRL(n.valorIss)}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                              n.status === 'autorizada'
                                ? 'bg-[#ECFDF5] text-[#059669] dark:bg-[#10B981]/15 dark:text-[#34D399]'
                                : n.status === 'pendente'
                                  ? 'bg-[#FFFBEB] text-[#D97706] dark:bg-[#F59E0B]/15 dark:text-[#FCD34D]'
                                  : 'bg-[#FEF2F2] text-[#DC2626] dark:bg-[#EF4444]/15 dark:text-[#FCA5A5]'
                            }`}
                          >
                            {n.status === 'autorizada'
                              ? 'Autorizada'
                              : n.status === 'pendente'
                                ? 'Pendente'
                                : 'Rejeitada'}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            {n.status !== 'autorizada' ? (
                              <button
                                type="button"
                                disabled={transmittingId === n.id}
                                onClick={() => void handleTransmitNFSeReal(n)}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#10B981] px-3 py-1.5 text-xs font-bold text-[#052E16] hover:bg-[#34D399] disabled:opacity-50"
                              >
                                <Send className="h-3 w-3" />
                                {transmittingId === n.id ? 'Enviando...' : 'Transmitir (A1)'}
                              </button>
                            ) : (
                              n.chaveNfse &&
                              n.chaveNfse.replace(/\D/g, '').length === 50 && (
                                <button
                                  type="button"
                                  disabled={downloadingDanfseId === n.id}
                                  onClick={() => void handleOpenDanfsePdf(n)}
                                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#10B981] px-3 py-1.5 text-xs font-bold text-[#052E16] hover:bg-[#34D399] disabled:opacity-50"
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  {downloadingDanfseId === n.id
                                    ? 'Baixando PDF...'
                                    : 'DANFSe PDF'}
                                </button>
                              )
                            )}
                            <div className="inline-flex items-center gap-1">
                              {n.status === 'autorizada' &&
                                n.chaveNfse &&
                                n.chaveNfse.replace(/\D/g, '').length === 50 && (
                                  <button
                                    type="button"
                                    onClick={() => void handleDownloadAuthorizedXml(n)}
                                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-[#10B981]/40 bg-[#ECFDF5] px-2 py-1 text-[11px] font-semibold text-[#059669] hover:bg-[#D1FAE5] dark:border-[#10B981]/30 dark:bg-[#10B981]/10 dark:text-[#34D399] dark:hover:bg-[#10B981]/20"
                                    title="Baixar XML oficial da NFS-e autorizada pelo governo"
                                  >
                                    <FileDown className="h-3 w-3" />
                                    XML Gov
                                  </button>
                                )}
                              <button
                                type="button"
                                onClick={() => void handleDownloadSignedNFSeXml(n)}
                                className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-[#E2E8F0] px-2 py-1 text-[11px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9] dark:hover:bg-[#1E293B]"
                                title="Baixar XML DPS (assinado com A1 se conectado)"
                              >
                                <FileDown className="h-3 w-3 text-[#10B981]" />
                                {certStatus.loaded ? 'XML A1' : 'XML'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const json = JSON.stringify(
                                    buildRtcJsonPayload(n, nfeConfig.municipioIbge || '3550308'),
                                    null,
                                    2
                                  );
                                  copyText(`json-${n.id}`, json);
                                  pushToast({
                                    type: 'info',
                                    title: 'JSON Calculadora RTC copiado',
                                  });
                                }}
                                className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-[#E2E8F0] px-2 py-1 text-[11px] font-medium text-[#64748B] hover:bg-[#F8FAFC] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#CBD5E1] dark:hover:bg-[#1E293B]"
                              >
                                {copiedKey === `json-${n.id}` ? (
                                  <Check className="h-3 w-3 text-[#10B981]" />
                                ) : (
                                  <Code2 className="h-3 w-3" />
                                )}
                                JSON
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* SEFAZ-SP NFC-e (Mod 65) & NF-e (Mod 55) */}
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#059669] dark:bg-[#10B981]/15 dark:text-[#34D399]">
                  <Info className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
                    Emissão Direta SEFAZ-SP · NFC-e (Cupom do Caixa Mod. 65) e NF-e (Mod. 55)
                  </h3>
                  <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#64748B] dark:text-[#94A3B8]">
                    Com o <strong className="text-[#0F172A] dark:text-[#F1F5F9]">Certificado A1 conectado</strong>, as vendas do PDV assinam o XML (RSA-SHA1) e transmitem automaticamente para a{' '}
                    <strong className="text-[#0F172A] dark:text-[#F1F5F9]">SEFAZ-SP via mTLS</strong>. Para cupom do consumidor (NFC-e Mod. 65), cadastre seu <strong className="text-[#0F172A] dark:text-[#F1F5F9]">ID e Código CSC</strong> em Configurar Empresa.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCfgOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9] dark:hover:bg-[#1E293B]"
              >
                <Settings className="h-3.5 w-3.5" />
                Configurar CSC / IE / Cupom
              </button>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
              <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">Autorizadas</div>
              <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#059669] dark:text-[#34D399]">
                {nfeKpis.autorizadas}
              </div>
            </div>
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
              <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">Pendentes</div>
              <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#D97706] dark:text-[#FBBF24]">
                {nfeKpis.pendentes}
              </div>
            </div>
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
              <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">Rejeitadas</div>
              <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#DC2626] dark:text-[#F87171]">
                {nfeKpis.rejeitadas}
              </div>
            </div>
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
              <div className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8]">
                Total Autorizado
              </div>
              <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                {formatBRL(nfeKpis.totalValor)}
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 dark:border-[#1E293B] dark:bg-[#111820]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            >
              <option value="">Todas as notas</option>
              <option value="autorizada">Autorizadas</option>
              <option value="pendente">Pendentes</option>
              <option value="rejeitada">Rejeitadas</option>
            </select>

            <button
              type="button"
              onClick={() => setEmitOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-semibold text-[#052E16] hover:bg-[#34D399]"
            >
              <Plus className="h-3.5 w-3.5" />
              Emitir NF-e / Gerar XML
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white dark:border-[#1E293B] dark:bg-[#111820]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold text-[#64748B] dark:border-[#1E293B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
                  <tr>
                    <th className="px-4 py-3">Nº</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Destinatário</th>
                    <th className="px-4 py-3">Chave de Acesso</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
                  {filteredNFe.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-xs text-[#64748B] dark:text-[#94A3B8]"
                      >
                        Nenhuma NF-e de produto registrada ainda.
                      </td>
                    </tr>
                  ) : (
                    filteredNFe.map((n) => {
                      const linkedSale = n.vendaId ? sales.find((s) => s.id === n.vendaId) : undefined;
                      return (
                        <tr key={n.id} className="hover:bg-[#F8FAFC] dark:hover:bg-[#16202A]">
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                            <div>#{n.numero}</div>
                            <div className="mt-0.5 text-[10px] font-bold text-[#059669] dark:text-[#34D399]">
                              {n.modelo === '65' ? 'NFC-e 65' : 'NF-e 55'}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                            {formatDateBR(n.data)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-[#0F172A] dark:text-[#F1F5F9]">
                              {n.clienteNome}
                            </div>
                            <div className="font-mono text-xs text-[#64748B] dark:text-[#94A3B8]">
                              {n.clienteDoc || 'Consumidor Final'}
                            </div>
                            {n.protocolo && (
                              <div className="mt-0.5 font-mono text-[11px] text-[#059669] dark:text-[#34D399]">
                                Protocolo: {n.protocolo}
                              </div>
                            )}
                            {n.motivoRejeicao && (
                              <div className="mt-1 rounded bg-[#FEF2F2] px-2 py-1 text-[11px] font-medium text-[#DC2626] dark:bg-[#EF4444]/15 dark:text-[#FCA5A5]">
                                {n.motivoRejeicao}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                            {n.chave}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-[#0F172A] dark:text-[#34D399]">
                            {formatBRL(n.valor)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                                n.status === 'autorizada'
                                  ? 'bg-[#ECFDF5] text-[#059669] dark:bg-[#10B981]/15 dark:text-[#34D399]'
                                  : n.status === 'pendente'
                                    ? 'bg-[#FFFBEB] text-[#D97706] dark:bg-[#F59E0B]/15 dark:text-[#FCD34D]'
                                    : 'bg-[#FEF2F2] text-[#DC2626] dark:bg-[#EF4444]/15 dark:text-[#FCA5A5]'
                              }`}
                            >
                              {n.status === 'autorizada'
                                ? 'Autorizada'
                                : n.status === 'pendente'
                                  ? 'Pendente'
                                  : 'Rejeitada'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {linkedSale && (
                                <button
                                  type="button"
                                  onClick={() => printSaleReceipt(linkedSale, n)}
                                  className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9] dark:hover:bg-[#1E293B]"
                                  title="Imprimir Notinha Térmica"
                                >
                                  <Printer className="h-3 w-3" />
                                  Notinha
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleDownloadNFeXml(n)}
                                className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#0F172A] hover:bg-[#F8FAFC] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9] dark:hover:bg-[#1E293B]"
                              >
                                <FileDown className="h-3 w-3 text-[#10B981]" />
                                {certStatus.loaded || n.xmlSigned ? 'XML A1' : 'XML'}
                              </button>
                              {n.status !== 'autorizada' && (
                                <button
                                  type="button"
                                  disabled={transmittingId === n.id}
                                  onClick={async () => {
                                    setTransmittingId(n.id);
                                    try {
                                      await transmitExistingNFe(n.id);
                                    } finally {
                                      setTransmittingId(null);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md bg-[#10B981] px-2.5 py-1 text-xs font-bold text-[#052E16] hover:bg-[#34D399] disabled:opacity-50"
                                >
                                  <Send className="h-3 w-3" />
                                  {transmittingId === n.id ? 'Enviando...' : 'Transmitir (A1)'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Certificado A1 Upload SlideOver */}
      <SlideOver
        open={certModalOpen}
        onClose={() => setCertModalOpen(false)}
        title="Conectar Certificado Digital A1 (.pfx)"
        subtitle="O arquivo e a senha ficam protegidos apenas na memória segura do servidor."
        widthClass="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCertModalOpen(false)}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B] dark:border-[#263442] dark:text-[#94A3B8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-upload-a1"
              disabled={certLoading || !pfxBase64 || !pfxPassword}
              className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#052E16] hover:bg-[#34D399] disabled:opacity-50"
            >
              {certLoading ? 'Validando A1...' : 'Validar e Conectar A1'}
            </button>
          </>
        }
      >
        <form id="form-upload-a1" onSubmit={(e) => void handleUploadCert(e)} className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-7 text-center transition-colors hover:border-[#10B981] dark:border-[#263442] dark:bg-[#0D151A]">
            <input
              type="file"
              accept=".pfx,.p12"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePfxFileChange(f);
              }}
            />
            <KeyRound className="h-7 w-7 text-[#10B981]" />
            <div className="mt-2 text-xs font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
              {pfxFileName || 'Clique para selecionar o arquivo .pfx ou .p12'}
            </div>
            <div className="mt-1 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
              Certificado e-CNPJ modelo A1 (ICP-Brasil)
            </div>
          </label>

          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Senha do Certificado A1 *
            </label>
            <input
              required
              type="password"
              value={pfxPassword}
              onChange={(e) => setPfxPassword(e.target.value)}
              placeholder="Digite a senha do seu .pfx"
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-[11px] leading-relaxed text-[#64748B] dark:border-[#1E293B] dark:bg-[#0D151A] dark:text-[#94A3B8]">
            Após conectar, o sistema extrai seu <strong>CNPJ</strong>, <strong>Razão Social</strong>{' '}
            e <strong>Validade</strong>, habilitando assinatura digital XMLDSig e conexão mTLS
            real com a Sefin Nacional (NFS-e).
          </div>
        </form>
      </SlideOver>

      {/* Emit NFS-e Serviço (DPS + Reforma Tributária) SlideOver */}
      <SlideOver
        open={emitServiceOpen}
        onClose={() => setEmitServiceOpen(false)}
        title="Emitir NFS-e Serviço (DPS Nacional)"
        subtitle="Mostra apenas o serviço e o valor cobrado — sem listar itens de estoque."
        widthClass="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEmitServiceOpen(false)}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B] dark:border-[#263442] dark:text-[#94A3B8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-emit-nfse"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#052E16] hover:bg-[#34D399]"
            >
              Gerar DPS / NFS-e
            </button>
          </>
        }
      >
        <form id="form-emit-nfse" onSubmit={handleEmitNFSe} className="space-y-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5 dark:border-[#1E293B] dark:bg-[#0D151A]">
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
              Modelo rápido de serviço (Protect Redes)
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SERVICE_PRESETS.map((preset) => (
                <button
                  key={preset.nbs}
                  type="button"
                  onClick={() => {
                    setDescricaoServico(preset.label);
                    setCodigoNbs(preset.nbs);
                    setCTribNac(preset.cTribNac);
                    setCstIbsCbs(preset.cst);
                    setCClassTrib(preset.cClassTrib);
                  }}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                    codigoNbs === preset.nbs
                      ? 'border-[#10B981] bg-[#ECFDF5] text-[#059669] dark:bg-[#10B981]/15 dark:text-[#34D399]'
                      : 'border-[#E2E8F0] bg-white text-[#64748B] hover:text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#CBD5E1]'
                  }`}
                >
                  {preset.label.split(' (')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Tomador do Serviço (Cliente / Condomínio) *
              </label>
              <input
                required
                list="nfse-clientes"
                type="text"
                value={tomadorNome}
                onChange={(e) => {
                  setTomadorNome(e.target.value);
                  const found = customers.find((c) => c.nome === e.target.value);
                  if (found) {
                    setTomadorDoc(found.doc);
                    if (found.cidade) setMunicipioInc(found.cidade);
                  }
                }}
                placeholder="Nome ou Razão Social"
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
              <datalist id="nfse-clientes">
                {customers.map((c) => (
                  <option key={c.id} value={c.nome} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                CPF / CNPJ do Tomador *
              </label>
              <input
                required
                type="text"
                value={tomadorDoc}
                onChange={(e) => setTomadorDoc(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Discriminação do Serviço *
              </label>
              <input
                required
                type="text"
                value={descricaoServico}
                onChange={(e) => setDescricaoServico(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Município Incidência
              </label>
              <input
                type="text"
                value={municipioInc}
                onChange={(e) => setMunicipioInc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Código NBS
              </label>
              <input
                type="text"
                value={codigoNbs}
                onChange={(e) => setCodigoNbs(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                cTribNac (LC 116)
              </label>
              <input
                type="text"
                value={cTribNac}
                onChange={(e) => setCTribNac(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                CST IBS/CBS
              </label>
              <select
                value={cstIbsCbs}
                onChange={(e) => setCstIbsCbs(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 font-mono text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              >
                <option value="000">000 - Integral</option>
                <option value="200">200 - Reduzida</option>
                <option value="410">410 - Não incid.</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                cClassTrib
              </label>
              <input
                type="text"
                value={cClassTrib}
                onChange={(e) => setCClassTrib(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Valor do Serviço (R$) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={valorServico}
                onChange={(e) => setValorServico(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                ISS (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={aliqIss}
                onChange={(e) => setAliqIss(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                CBS (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={aliqCbs}
                onChange={(e) => setAliqCbs(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                IBS (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={aliqIbs}
                onChange={(e) => setAliqIbs(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#10B981]/25 bg-[#ECFDF5]/60 p-3.5 dark:border-[#10B981]/25 dark:bg-[#10B981]/10">
            <div className="space-y-0.5 text-xs">
              <div className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                Apuração Reforma Tributária ({regimeTributario === 'simples_nacional' ? 'Simples Nacional' : 'Regime Regular'})
              </div>
              <div className="font-mono text-[11px] text-[#475569] dark:text-[#CBD5E1]">
                ISS: {formatBRL(serviceCalcPreview.valorIss)} · CBS:{' '}
                {formatBRL(serviceCalcPreview.valorCbs)} · IBS:{' '}
                {formatBRL(serviceCalcPreview.valorIbs)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={regimeTributario}
                onChange={(e) =>
                  setRegimeTributario(e.target.value as 'simples_nacional' | 'regime_regular')
                }
                className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              >
                <option value="simples_nacional">Simples Nacional</option>
                <option value="regime_regular">Regime Regular</option>
              </select>
              <button
                type="button"
                disabled={simulatingRtc}
                onClick={() => void handleSimularRtc()}
                className="inline-flex items-center gap-1 rounded-lg border border-[#10B981]/40 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#059669] hover:bg-[#ECFDF5] dark:bg-[#16202A] dark:text-[#34D399]"
              >
                <Calculator className="h-3 w-3" />
                {simulatingRtc ? 'Consultando...' : 'Simular RTC'}
              </button>
            </div>
          </div>
        </form>
      </SlideOver>

      {/* Emit NF-e Produto SlideOver */}
      <SlideOver
        open={emitOpen}
        onClose={() => setEmitOpen(false)}
        title="Emitir NF-e Produto / Gerar XML"
        subtitle="Preencha os dados do destinatário e valor da nota."
        footer={
          <>
            <button
              type="button"
              onClick={() => setEmitOpen(false)}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B] dark:border-[#263442] dark:text-[#94A3B8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-emit-nfe"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#052E16] hover:bg-[#34D399]"
            >
              Gerar Nota Fiscal
            </button>
          </>
        }
      >
        <form id="form-emit-nfe" onSubmit={handleEmitNFe} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Destinatário (Nome / Razão Social) *
            </label>
            <input
              required
              list="nfe-clientes"
              type="text"
              value={destNome}
              onChange={(e) => {
                setDestNome(e.target.value);
                const found = customers.find((c) => c.nome === e.target.value);
                if (found) setDestDoc(found.doc);
              }}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
            <datalist id="nfe-clientes">
              {customers.map((c) => (
                <option key={c.id} value={c.nome} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                CPF / CNPJ *
              </label>
              <input
                required
                type="text"
                value={destDoc}
                onChange={(e) => setDestDoc(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Valor Total (R$) *
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                CEP (busca automática)
              </label>
              <input
                type="text"
                value={destCep}
                onChange={(e) => setDestCep(e.target.value)}
                onBlur={() => void buscarCEP()}
                placeholder="00000-000"
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Cidade
              </label>
              <input
                type="text"
                value={destCidade}
                onChange={(e) => setDestCidade(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Endereço
              </label>
              <input
                type="text"
                value={destEnd}
                onChange={(e) => setDestEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Bairro
              </label>
              <input
                type="text"
                value={destBairro}
                onChange={(e) => setDestBairro(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>
        </form>
      </SlideOver>

      {/* Guia Técnico Receita Federal Reforma Tributária & NFS-e Nacional */}
      <SlideOver
        open={rtcGuideOpen}
        onClose={() => setRtcGuideOpen(false)}
        title="APIs Oficiais · Receita Federal & NFS-e Nacional"
        subtitle="Repositórios GitHub (Portaria COTEC nº 342 · Licença MIT) e endpoints REST"
        widthClass="max-w-2xl"
      >
        <div className="space-y-5 text-xs leading-relaxed text-[#475569] dark:text-[#CBD5E1]">
          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 dark:border-[#1E293B] dark:bg-[#0D151A]">
            <h4 className="font-display text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
              1. Repositórios Oficiais no GitHub (Reforma Tributária)
            </h4>
            <div className="mt-3 space-y-2">
              {[
                {
                  name: 'calculadora-rtc-regime-regular',
                  desc: 'API REST Java/Spring para Regime Regular + endpoints NFS-e e Dados Abertos (NBS, CST, cClassTrib).',
                  url: 'https://github.com/ReceitaFederal/calculadora-rtc-regime-regular',
                },
                {
                  name: 'calculadora-rtc-simples-nacional',
                  desc: 'API REST de apuração CBS/IBS específica para empresas optantes pelo Simples Nacional.',
                  url: 'https://github.com/ReceitaFederal/calculadora-rtc-simples-nacional',
                },
                {
                  name: 'calculadora-rtc-gerador-danfse',
                  desc: 'Serviço HTTP em Go que converte o XML da NFS-e Nacional em PDF (DANFSe).',
                  url: 'https://github.com/ReceitaFederal/calculadora-rtc-gerador-danfse',
                },
              ].map((repo) => (
                <div
                  key={repo.name}
                  className="flex items-start justify-between gap-3 rounded-lg border border-[#E2E8F0] bg-white p-3 dark:border-[#1E293B] dark:bg-[#111820]"
                >
                  <div>
                    <div className="font-mono font-semibold text-[#059669] dark:text-[#34D399]">
                      ReceitaFederal/{repo.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      {repo.desc}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(repo.name, repo.url)}
                    className="inline-flex shrink-0 items-center gap-1 rounded border border-[#E2E8F0] px-2 py-1 text-[11px] font-semibold text-[#0F172A] hover:bg-[#F8FAFC] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
                  >
                    {copiedKey === repo.name ? (
                      <Check className="h-3 w-3 text-[#10B981]" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    Copiar URL
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 dark:border-[#1E293B] dark:bg-[#0D151A]">
            <h4 className="font-display text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
              2. Principais Endpoints REST da Calculadora RTC (NFS-e)
            </h4>
            <div className="mt-2.5 space-y-1.5 font-mono text-[11px]">
              {[
                'POST /api/calculadora/base-calculo/base-calculo-unificada-nfse',
                'POST /api/calculadora/regime-geral',
                'GET  /calculadora/nfse/situacoes-classificacoes-tributarias',
                'GET  /calculadora/nfse/locais-incidencia',
                'GET  /calculadora/dados-abertos/nbs',
                'GET  /calculadora/dados-abertos/aliquota-municipio',
              ].map((route) => (
                <div
                  key={route}
                  className="flex items-center justify-between rounded bg-white px-2.5 py-1.5 text-[#0F172A] dark:bg-[#111820] dark:text-[#E2E8F0]"
                >
                  <span className="truncate">{route}</span>
                  <button
                    type="button"
                    onClick={() => copyText(route, route.replace(/^(GET|POST)\s+/, ''))}
                    className="ml-2 shrink-0 text-[#64748B] hover:text-[#10B981]"
                  >
                    {copiedKey === route ? (
                      <Check className="h-3 w-3 text-[#10B981]" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 dark:border-[#1E293B] dark:bg-[#0D151A]">
            <h4 className="font-display text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
              3. Como seu Certificado A1 transmite neste sistema
            </h4>
            <ul className="mt-2 list-disc space-y-1.5 pl-4">
              <li>
                Ao conectar seu arquivo <strong>.pfx + senha</strong>, o servidor Node deste aplicativo assina o XML da DPS com <strong>RSA-SHA256 (XMLDSig)</strong> e compacta em <strong>GZip + Base64</strong>.
              </li>
              <li>
                Ao clicar em <strong>Transmitir (A1)</strong>, o servidor faz a conexão <strong>mTLS</strong> direta com a Sefin Nacional (<code className="font-mono">POST /SefinNacional/nfse</code>) usando seu A1.
              </li>
              <li>
                <strong>Pré-requisito do município:</strong> sua empresa e sua prefeitura precisam estar habilitadas no Emissor Nacional (<code className="font-mono">nfse.gov.br</code>). Para testes, use o ambiente <strong>Homologação</strong> em Configurar Endpoints.
              </li>
              <li>
                <strong>Portal Swagger RTC:</strong>{' '}
                <span className="inline-flex items-center gap-1 font-mono text-[#059669] dark:text-[#34D399]">
                  consumo.tributos.gov.br <ExternalLink className="h-3 w-3" />
                </span>
              </li>
            </ul>
          </div>
        </div>
      </SlideOver>

      {/* Config SlideOver */}
      <SlideOver
        open={cfgOpen}
        onClose={() => setCfgOpen(false)}
        title="Integração Fiscal (Empresa, A1 & Endpoints)"
        subtitle="Configure os dados da empresa emissora e o ambiente de transmissão."
        widthClass="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCfgOpen(false)}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm text-[#64748B] dark:border-[#263442] dark:text-[#94A3B8]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-cfg-nfe"
              className="rounded-lg bg-[#10B981] px-4 py-2 text-sm font-semibold text-[#052E16] hover:bg-[#34D399]"
            >
              Salvar Configuração
            </button>
          </>
        }
      >
        <form id="form-cfg-nfe" onSubmit={handleSaveCfg} className="space-y-4">
          <div className="border-b border-[#E2E8F0] pb-2 text-xs font-bold uppercase tracking-wide text-[#059669] dark:border-[#1E293B] dark:text-[#34D399]">
            Dados do Emitente / Prestador
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                CNPJ da Empresa
              </label>
              <input
                type="text"
                value={cnpjPrestador}
                onChange={(e) => setCnpjPrestador(e.target.value)}
                placeholder="00.000.000/0001-00"
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Inscrição Municipal
              </label>
              <input
                type="text"
                value={inscricaoMunicipal}
                onChange={(e) => setInscricaoMunicipal(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Inscrição Estadual (IE)
              </label>
              <input
                type="text"
                value={inscricaoEstadual}
                onChange={(e) => setInscricaoEstadual(e.target.value)}
                placeholder="140002149114"
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Cód. Município IBGE
              </label>
              <input
                type="text"
                value={municipioIbge}
                onChange={(e) => setMunicipioIbge(e.target.value)}
                placeholder="3550308"
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Regime Padrão (RTC)
              </label>
              <select
                value={regimePadrao}
                onChange={(e) =>
                  setRegimePadrao(e.target.value as 'simples_nacional' | 'regime_regular')
                }
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-2 text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              >
                <option value="simples_nacional">Simples Nacional</option>
                <option value="regime_regular">Regime Regular</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Logradouro Emitente
              </label>
              <input
                type="text"
                value={endLogradouro}
                onChange={(e) => setEndLogradouro(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Nº
              </label>
              <input
                type="text"
                value={endNumero}
                onChange={(e) => setEndNumero(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                CEP
              </label>
              <input
                type="text"
                value={endCep}
                onChange={(e) => setEndCep(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 font-mono text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Bairro Emitente
            </label>
            <input
              type="text"
              value={endBairro}
              onChange={(e) => setEndBairro(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>

          <div className="border-b border-[#E2E8F0] pt-2 pb-2 text-xs font-bold uppercase tracking-wide text-[#059669] dark:border-[#1E293B] dark:text-[#34D399]">
            Automação Produto (NFC-e / NF-e SEFAZ-SP) & Impressora Caixa
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Modelo Padrão PDV
              </label>
              <select
                value={modeloProdutoPadrao}
                onChange={(e) => setModeloProdutoPadrao(e.target.value as '65' | '55')}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              >
                <option value="65">NFC-e (Mod. 65 · Cupom Caixa)</option>
                <option value="55">NF-e (Mod. 55 · Nota Grande)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Largura da Bobina Térmica
              </label>
              <select
                value={larguraCupom}
                onChange={(e) => setLarguraCupom(e.target.value as '80mm' | '58mm')}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              >
                <option value="80mm">80mm (Padrão Caixa)</option>
                <option value="58mm">58mm (Maquininha / Compacta)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                ID CSC (NFC-e)
              </label>
              <input
                type="text"
                value={cscId}
                onChange={(e) => setCscId(e.target.value)}
                placeholder="Ex: 000001"
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Código Token CSC (SEFAZ-SP)
              </label>
              <input
                type="text"
                value={cscToken}
                onChange={(e) => setCscToken(e.target.value)}
                placeholder="Gerado no Portal NFC-e da Fazenda SP"
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-xs text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs dark:border-[#1E293B] dark:bg-[#0D151A]">
            <label className="flex items-center justify-between gap-2">
              <span className="text-[#0F172A] dark:text-[#F1F5F9]">
                Transmitir NFS-e de Serviço sozinha (com A1)
              </span>
              <input
                type="checkbox"
                checked={autoEmitirNfse}
                onChange={(e) => setAutoEmitirNfse(e.target.checked)}
                className="h-4 w-4 accent-[#10B981]"
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-[#0F172A] dark:text-[#F1F5F9]">
                Transmitir NFC-e / NF-e de Produto sozinha no PDV (com A1)
              </span>
              <input
                type="checkbox"
                checked={autoEmitirNfeProduto}
                onChange={(e) => setAutoEmitirNfeProduto(e.target.checked)}
                className="h-4 w-4 accent-[#10B981]"
              />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="text-[#0F172A] dark:text-[#F1F5F9]">
                Abrir impressão automática da notinha ao finalizar venda
              </span>
              <input
                type="checkbox"
                checked={autoImprimirNotinha}
                onChange={(e) => setAutoImprimirNotinha(e.target.checked)}
                className="h-4 w-4 accent-[#10B981]"
              />
            </label>
          </div>

          <div className="border-b border-[#E2E8F0] pt-2 pb-2 text-xs font-bold uppercase tracking-wide text-[#059669] dark:border-[#1E293B] dark:text-[#34D399]">
            Endpoints API (Sefin Nacional, Calculadora RTC & Proxy)
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              URL da API Calculadora RTC (Receita Federal / Docker)
            </label>
            <input
              type="url"
              value={rtcCalculadoraUrl}
              onChange={(e) => setRtcCalculadoraUrl(e.target.value)}
              placeholder="https://consumo.tributos.gov.br ou http://localhost:8080"
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Endpoint Sefin Nacional (NFS-e)
            </label>
            <input
              type="url"
              value={nfseSefinUrl}
              onChange={(e) => setNfseSefinUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Endpoint Opcional Externo (Focus NFe / Nuvem Fiscal / NFePHP)
            </label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="Deixe vazio para enviar direto à Sefin Nacional com seu A1"
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
              Token de autenticação (se usar API externa)
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Ambiente
              </label>
              <select
                value={ambiente}
                onChange={(e) => {
                  const next = e.target.value as 'homologacao' | 'producao';
                  setAmbiente(next);
                  if (
                    !nfseSefinUrl ||
                    nfseSefinUrl.includes('sefin.producaorestrita.nfse.gov.br') ||
                    nfseSefinUrl.includes('sefin.nfse.gov.br')
                  ) {
                    setNfseSefinUrl(
                      next === 'producao'
                        ? 'https://sefin.nfse.gov.br/SefinNacional'
                        : 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional'
                    );
                  }
                }}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              >
                <option value="homologacao">Homologação (Testes)</option>
                <option value="producao">Produção (Valendo)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] dark:text-[#CBD5E1]">
                Série
              </label>
              <input
                type="text"
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 font-mono text-sm text-[#0F172A] dark:border-[#263442] dark:bg-[#16202A] dark:text-[#F1F5F9]"
              />
            </div>
          </div>
        </form>
      </SlideOver>

      {/* DANFSe PDF Viewer SlideOver */}
      <SlideOver
        open={danfseModalOpen}
        onClose={() => setDanfseModalOpen(false)}
        title={
          danfseActiveNote
            ? `DANFSe Oficial — DPS #${danfseActiveNote.numeroDps}`
            : 'DANFSe Oficial'
        }
        subtitle={
          danfseActiveNote
            ? `${danfseActiveNote.tomadorNome} · ${formatBRL(danfseActiveNote.valorServico)}`
            : undefined
        }
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            {danfseActiveNote?.chaveNfse ? (
              <button
                type="button"
                onClick={() => {
                  copyText('danfse-chave', danfseActiveNote.chaveNfse ?? '');
                  pushToast({ type: 'info', title: 'Chave de 50 dígitos copiada!' });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#475569] hover:bg-[#F8FAFC] dark:border-[#263442] dark:text-[#CBD5E1] dark:hover:bg-[#1E293B]"
              >
                {copiedKey === 'danfse-chave' ? (
                  <Check className="h-3.5 w-3.5 text-[#10B981]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copiar Chave
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              {danfsePdfUrl && danfseActiveNote && (
                <a
                  href={danfsePdfUrl}
                  download={`DANFSe-${danfseActiveNote.numeroDps}.pdf`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#10B981] px-4 py-2 text-xs font-bold text-[#052E16] hover:bg-[#34D399]"
                >
                  <FileDown className="h-4 w-4" />
                  Baixar PDF
                </a>
              )}
              <button
                type="button"
                onClick={() => setDanfseModalOpen(false)}
                className="rounded-lg border border-[#E2E8F0] px-3 py-2 text-xs font-semibold text-[#64748B] dark:border-[#263442] dark:text-[#CBD5E1]"
              >
                Fechar
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          {danfseActiveNote?.chaveNfse && (
            <div className="rounded-lg border border-[#10B981]/30 bg-[#ECFDF5] p-3 text-xs text-[#065F46] dark:bg-[#10B981]/10 dark:text-[#A7F3D0]">
              <p className="font-semibold">
                Nota emitida em {nfeConfig.ambiente === 'producao' ? 'Produção (Valendo)' : 'Homologação (Ambiente de Testes)'}
              </p>
              <p className="mt-1 font-mono text-[11px] break-all">
                Chave: {danfseActiveNote.chaveNfse}
              </p>
              {nfeConfig.ambiente !== 'producao' && (
                <p className="mt-1 text-[11px] opacity-90">
                  Notas de teste ficam no portal de Produção Restrita (`producaorestrita.nfse.gov.br`), sem validade jurídica até você mudar para Produção.
                </p>
              )}
            </div>
          )}
          {danfsePdfUrl ? (
            <iframe
              src={danfsePdfUrl}
              title="Visualização DANFSe PDF"
              className="h-[68vh] w-full rounded-lg border border-[#E2E8F0] bg-white dark:border-[#263442]"
            />
          ) : (
            <div className="py-12 text-center text-sm text-[#64748B]">
              Carregando DANFSe PDF...
            </div>
          )}
        </div>
      </SlideOver>
    </div>
  );
};
