import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import forge from 'node-forge';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// 1. AUTENTICAÇÃO SEGURA (scrypt + HMAC-SHA256 + Anti-Força-Bruta)
// ============================================================================

type UserRole =
  | 'Administrador'
  | 'Operador PDV'
  | 'Instalador / Equipe'
  | 'Instalador / Obra'
  | 'Financeiro';

interface StoredAuthUser {
  id: string;
  nome: string;
  login: string;
  cargo: UserRole;
  ativo: boolean;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
}

interface AuthStoreData {
  sessionSecret: string;
  users: StoredAuthUser[];
}

interface SessionTokenPayload {
  uid: string;
  login: string;
  nome: string;
  cargo: UserRole;
  iat: number;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  authUser?: SessionTokenPayload;
}

const DATA_DIR = path.resolve(__dirname, '.data');
const AUTH_STORE_PATH = path.join(DATA_DIR, 'auth.json');

function ensureAuthStore(): AuthStoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
  if (fs.existsSync(AUTH_STORE_PATH)) {
    try {
      const raw = fs.readFileSync(AUTH_STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<AuthStoreData>;
      if (parsed.sessionSecret && Array.isArray(parsed.users)) {
        return {
          sessionSecret: parsed.sessionSecret,
          users: parsed.users,
        };
      }
    } catch {
      // recreate cleanly if unreadable
    }
  }
  const initial: AuthStoreData = {
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    users: [],
  };
  fs.writeFileSync(AUTH_STORE_PATH, JSON.stringify(initial, null, 2), { mode: 0o600 });
  return initial;
}

let authStore: AuthStoreData = ensureAuthStore();

function saveAuthStore(next: AuthStoreData): void {
  authStore = next;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(AUTH_STORE_PATH, JSON.stringify(next, null, 2), { mode: 0o600 });
}

function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function signSessionToken(user: StoredAuthUser): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SessionTokenPayload = {
    uid: user.id,
    login: user.login,
    nome: user.nome,
    cargo: user.cargo,
    iat: nowSec,
    exp: nowSec + 24 * 60 * 60, // 24 horas
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', authStore.sessionSecret)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

function verifySessionToken(token: string): SessionTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const expectedSig = crypto
    .createHmac('sha256', authStore.sessionSecret)
    .update(payloadB64)
    .digest();
  let providedSig: Buffer;
  try {
    providedSig = Buffer.from(sigB64, 'base64url');
  } catch {
    return null;
  }
  if (expectedSig.length !== providedSig.length) return null;
  if (!crypto.timingSafeEqual(expectedSig, providedSig)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as SessionTokenPayload;
    if (!payload.uid || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    const dbUser = authStore.users.find((u) => u.id === payload.uid && u.ativo);
    if (!dbUser) return null;
    return {
      ...payload,
      nome: dbUser.nome,
      login: dbUser.login,
      cargo: dbUser.cargo,
    };
  } catch {
    return null;
  }
}

function extractTokenFromReq(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (authStore.users.length === 0) {
    res.status(401).json({ error: 'Configure a senha inicial do administrador primeiro.' });
    return;
  }
  const token = extractTokenFromReq(req);
  if (!token) {
    res.status(401).json({ error: 'Sessão não autenticada. Faça login.' });
    return;
  }
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sessão expirada ou inválida. Entre novamente.' });
    return;
  }
  req.authUser = payload;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser || req.authUser.cargo !== 'Administrador') {
    res.status(403).json({ error: 'Acesso restrito ao Administrador.' });
    return;
  }
  next();
}

function publicUserView(u: StoredAuthUser) {
  return {
    id: u.id,
    nome: u.nome,
    login: u.login,
    cargo: u.cargo,
    ativo: u.ativo,
  };
}

// Proteção contra força bruta (5 erros -> bloqueio de 5 minutos)
const loginAttempts = new Map<string, { count: number; blockedUntil: number; lastAttempt: number }>();

function getRateLimitKey(req: Request, login: string): string {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'local';
  return `${ip}::${login.toLowerCase()}`;
}

// ============================================================================
// 2. CERTIFICADO A1, XMLDSig (NFS-e SHA256 & NF-e/NFC-e SHA1) & mTLS
// ============================================================================

interface ActiveCertificate {
  pfxBuffer: Buffer;
  password: string;
  privateKeyPem: string;
  certPem: string;
  certBase64Clean: string;
  subject: string;
  cnpj: string;
  issuer: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  expired: boolean;
  daysRemaining: number;
}

let activeCert: ActiveCertificate | null = null;

function extractCnpjFromCert(cert: forge.pki.Certificate): string {
  const cnAttr = cert.subject.getField('CN');
  const cnValue = typeof cnAttr?.value === 'string' ? cnAttr.value : '';
  const matchCn = cnValue.match(/(\d{14})/);
  if (matchCn) return matchCn[1];

  const allAttrs = cert.subject.attributes
    .map((a) => (typeof a.value === 'string' ? a.value : ''))
    .join(' ');
  const matchAny = allAttrs.match(/(\d{14})/);
  if (matchAny) return matchAny[1];

  const san = cert.getExtension('subjectAltName') as { altNames?: Array<{ value?: string }> } | null;
  if (san?.altNames) {
    for (const alt of san.altNames) {
      if (typeof alt.value === 'string') {
        const m = alt.value.match(/(\d{14})/);
        if (m) return m[1];
      }
    }
  }
  return '';
}

function parsePfxCertificate(pfxBuffer: Buffer, password: string): ActiveCertificate {
  const derBytes = pfxBuffer.toString('binary');
  const p12Asn1 = forge.asn1.fromDer(derBytes);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  if (certBags.length === 0 || !certBags[0].cert) {
    throw new Error('Nenhum certificado X.509 encontrado dentro do arquivo .pfx.');
  }

  const shroudedBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] ?? [];
  const plainBags = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? [];
  const keyObj = shroudedBags[0]?.key ?? plainBags[0]?.key;

  if (!keyObj) {
    throw new Error('Chave privada RSA não encontrada no certificado A1.');
  }

  const cert = certBags[0].cert;
  const privateKeyPem = forge.pki.privateKeyToPem(keyObj);
  const certPem = forge.pki.certificateToPem(cert);
  const certBase64Clean = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');

  const cnField = cert.subject.getField('CN');
  const issuerCn = cert.issuer.getField('CN');
  const now = Date.now();
  const validToMs = cert.validity.notAfter.getTime();
  const daysRemaining = Math.ceil((validToMs - now) / (1000 * 60 * 60 * 24));

  return {
    pfxBuffer,
    password,
    privateKeyPem,
    certPem,
    certBase64Clean,
    subject: typeof cnField?.value === 'string' ? cnField.value : 'Titular ICP-Brasil',
    cnpj: extractCnpjFromCert(cert),
    issuer: typeof issuerCn?.value === 'string' ? issuerCn.value : 'Autoridade Certificadora',
    serialNumber: cert.serialNumber || '',
    validFrom: cert.validity.notBefore.toISOString(),
    validTo: cert.validity.notAfter.toISOString(),
    expired: validToMs < now,
    daysRemaining,
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// NFS-e Nacional usa RSA-SHA256; SEFAZ NF-e / NFC-e 4.00 usa RSA-SHA1 (MOC 7.0)
function signXmlEnveloped(
  fullXml: string,
  targetTag: 'infDPS' | 'infNFe',
  targetId: string,
  closingRootTag: '</DPS>' | '</NFe>',
  cert: ActiveCertificate,
  algorithm: 'sha256' | 'sha1' = 'sha256'
): string {
  const startIdx = fullXml.indexOf(`<${targetTag}`);
  const endTag = `</${targetTag}>`;
  const endIdx = fullXml.indexOf(endTag);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`Tag <${targetTag}> não encontrada para assinatura XMLDSig.`);
  }

  let targetSegment = fullXml.slice(startIdx, endIdx + endTag.length);
  const rootNs =
    targetTag === 'infDPS'
      ? 'http://www.sped.fazenda.gov.br/nfse'
      : 'http://www.portalfiscal.inf.br/nfe';
  if (!targetSegment.startsWith(`<${targetTag} xmlns=`)) {
    targetSegment = targetSegment.replace(`<${targetTag} `, `<${targetTag} xmlns="${rootNs}" `);
  }

  const digestValue = crypto.createHash(algorithm).update(targetSegment, 'utf8').digest('base64');
  const sigMethodUri =
    algorithm === 'sha1'
      ? 'http://www.w3.org/2000/09/xmldsig#rsa-sha1'
      : 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
  const digestMethodUri =
    algorithm === 'sha1'
      ? 'http://www.w3.org/2000/09/xmldsig#sha1'
      : 'http://www.w3.org/2001/04/xmlenc#sha256';

  const signedInfoCanonical = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod><SignatureMethod Algorithm="${sigMethodUri}"></SignatureMethod><Reference URI="#${targetId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms><DigestMethod Algorithm="${digestMethodUri}"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`;

  const signer = crypto.createSign(algorithm === 'sha1' ? 'RSA-SHA1' : 'RSA-SHA256');
  signer.update(signedInfoCanonical, 'utf8');
  const signatureValue = signer.sign(cert.privateKeyPem, 'base64');

  const signatureBlock = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfoCanonical.replace(
    ' xmlns="http://www.w3.org/2000/09/xmldsig#"',
    ''
  )}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${cert.certBase64Clean}</X509Certificate></X509Data></KeyInfo></Signature>`;

  return fullXml.replace(closingRootTag, `${signatureBlock}${closingRootTag}`);
}

interface DpsInput {
  numeroDps: string;
  serie?: string;
  data: string;
  ambiente: 'homologacao' | 'producao';
  cnpjPrestador: string;
  inscricaoMunicipal?: string;
  municipioIbge: string;
  tomadorNome: string;
  tomadorDoc: string;
  codigoNbs: string;
  codigoTributacaoNacional: string;
  codigoTributacaoMunicipal?: string;
  descricaoServico: string;
  regimeTributario: 'simples_nacional' | 'regime_regular';
  cstIbsCbs: string;
  cClassTrib: string;
  valorServico: number;
  aliquotaIss: number;
  aliquotaCbs: number;
  aliquotaIbs: number;
  valorCbs: number;
  valorIbs: number;
}

function buildDpsXml(input: DpsInput): { xml: string; infId: string } {
  const ibge = (input.municipioIbge || '3550308').replace(/\D/g, '').padStart(7, '0').slice(0, 7);
  const prestCnpj = (input.cnpjPrestador || activeCert?.cnpj || '23246816000103')
    .replace(/\D/g, '')
    .padStart(14, '0')
    .slice(0, 14);
  const parsedSerie = parseInt(input.serie || '1', 10) || 1;
  const serieNum = String(parsedSerie >= 50000 ? 1 : parsedSerie).slice(0, 5);
  const serie = serieNum.padStart(5, '0');
  const num15 = String(parseInt(input.numeroDps, 10) || 1).padStart(15, '0');
  const infId = `DPS${ibge}2${prestCnpj}${serie}${num15}`;
  const tomaDoc = (input.tomadorDoc || '').replace(/\D/g, '') || '00000000000';
  const tomaTag = tomaDoc.length > 11 ? `<CNPJ>${tomaDoc}</CNPJ>` : `<CPF>${tomaDoc}</CPF>`;
  const tpAmb = input.ambiente === 'producao' ? '1' : '2';

  const nowBr = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 19);
  const todayBr = nowBr.slice(0, 10);
  const dhEmi = input.data === todayBr ? `${nowBr}-03:00` : `${input.data}T10:00:00-03:00`;

  const opSimpNac = input.regimeTributario === 'simples_nacional' ? '3' : '1';
  const regTribXml =
    opSimpNac === '3'
      ? `<regTrib><opSimpNac>3</opSimpNac><regApTribSN>1</regApTribSN><regEspTrib>0</regEspTrib></regTrib>`
      : `<regTrib><opSimpNac>1</opSimpNac><regEspTrib>0</regEspTrib></regTrib>`;

  const tribMunXml =
    opSimpNac === '3'
      ? `<tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN></tribMun>`
      : `<tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN><pAliq>${Number(input.aliquotaIss).toFixed(2)}</pAliq></tribMun>`;

  const nbsDigits = input.codigoNbs.replace(/\D/g, '');
  const cTribDigits = input.codigoTributacaoNacional.replace(/\D/g, '').padStart(6, '0').slice(0, 6);
  const cTribMunDigits = (input.codigoTributacaoMunicipal || '').replace(/\D/g, '');
  const cTribMunFormatted = cTribMunDigits ? cTribMunDigits.padStart(3, '0').slice(0, 3) : '';
  const imRaw = (input.inscricaoMunicipal || '').replace(/\D/g, '');
  const imClean = imRaw ? (ibge === '3550308' ? imRaw.padStart(15, '0') : imRaw) : '';

  const totTribXml =
    opSimpNac === '3'
      ? `<totTrib><pTotTribSN>0.00</pTotTribSN></totTrib>`
      : `<totTrib><vTotTrib><vTotTribFed>0.00</vTotTribFed><vTotTribEst>0.00</vTotTribEst><vTotTribMun>0.00</vTotTribMun></vTotTrib></totTrib>`;

  const isHomolog = input.ambiente !== 'producao';
  const dpsVersao = isHomolog ? '1.01' : '1.00';
  const finNfseXml = isHomolog ? '<finNFSe>0</finNFSe>' : '';
  const nbsTag = nbsDigits.length === 9 ? `<cNBS>${escapeXml(nbsDigits)}</cNBS>` : '';
  const cTribMunTag = cTribMunFormatted ? `<cTribMun>${escapeXml(cTribMunFormatted)}</cTribMun>` : '';
  const cServBody = isHomolog
    ? `<cTribNac>${escapeXml(cTribDigits)}</cTribNac>${cTribMunTag}${nbsTag}<xDescServ>${escapeXml(input.descricaoServico)}</xDescServ>`
    : `<cTribNac>${escapeXml(cTribDigits)}</cTribNac>${cTribMunTag}<xDescServ>${escapeXml(input.descricaoServico)}</xDescServ>${nbsTag}`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?><DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="${dpsVersao}"><infDPS Id="${infId}"><tpAmb>${tpAmb}</tpAmb><dhEmi>${dhEmi}</dhEmi><verAplic>ProtectRedes-1.0</verAplic><serie>${serieNum}</serie><nDPS>${parseInt(input.numeroDps, 10) || 1}</nDPS><dCompet>${input.data}</dCompet><tpEmit>1</tpEmit>${finNfseXml}<cLocEmi>${ibge}</cLocEmi><prest><CNPJ>${prestCnpj}</CNPJ>${imClean ? `<IM>${escapeXml(imClean)}</IM>` : ''}${regTribXml}</prest><toma>${tomaTag}<xNome>${escapeXml(input.tomadorNome)}</xNome></toma><serv><locPrest><cLocPrestacao>${ibge}</cLocPrestacao></locPrest><cServ>${cServBody}</cServ></serv><valores><vServPrest><vServ>${Number(input.valorServico).toFixed(2)}</vServ></vServPrest><trib>${tribMunXml}${totTribXml}</trib></valores></infDPS></DPS>`;

  return { xml, infId };
}

// ============================================================================
// 3. NF-e (Mod 55) & NFC-e (Mod 65) — SEFAZ-SP 4.00 + QR Code v2
// ============================================================================

function calcMod11DV(key43: string): string {
  let weight = 2;
  let sum = 0;
  for (let i = key43.length - 1; i >= 0; i -= 1) {
    sum += Number(key43[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const mod = sum % 11;
  const dv = mod < 2 ? 0 : 11 - mod;
  return String(dv);
}

function mapFormaPagamentoNFe(forma?: string): string {
  switch (forma) {
    case 'dinheiro':
      return '01';
    case 'credito':
      return '03';
    case 'debito':
      return '04';
    case 'pix':
      return '17';
    default:
      return '99';
  }
}

interface NFeProductEmitInput {
  modelo: '55' | '65';
  numero: string;
  serie?: string;
  data: string;
  ambiente: 'homologacao' | 'producao';
  cnpjEmitente: string;
  ieEmitente: string;
  razaoSocialEmitente?: string;
  enderecoEmitente?: {
    logradouro?: string;
    numero?: string;
    bairro?: string;
    cep?: string;
    uf?: string;
    municipioIbge?: string;
    municipioNome?: string;
  };
  destinatarioNome?: string;
  destinatarioDoc?: string;
  itens: Array<{
    codigo: string;
    nome: string;
    unidade: string;
    quantidade: number;
    precoUnitario: number;
    codBarras?: string;
    ncm?: string;
    cfop?: string;
    csosn?: string;
  }>;
  desconto?: number;
  total: number;
  formaPagamento?: string;
  cscId?: string;
  cscToken?: string;
}

function buildNFeOrNFCeXml(input: NFeProductEmitInput): {
  xmlUnsigned: string;
  chave: string;
  qrCodeUrl?: string;
} {
  const cUF = '35'; // São Paulo
  const nowBr = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const yy = String(nowBr.getUTCFullYear()).slice(-2);
  const mm = String(nowBr.getUTCMonth() + 1).padStart(2, '0');
  const aamm = `${yy}${mm}`;
  const cnpj = (input.cnpjEmitente || activeCert?.cnpj || '23246816000103')
    .replace(/\D/g, '')
    .padStart(14, '0')
    .slice(0, 14);
  const mod = input.modelo === '55' ? '55' : '65';
  const serieNum = Math.max(1, parseInt(input.serie || '1', 10) || 1);
  const serie3 = String(serieNum).padStart(3, '0').slice(-3);
  const nNFNum = Math.max(1, parseInt(input.numero || '1', 10) || 1);
  const nNF9 = String(nNFNum).padStart(9, '0').slice(-9);
  const tpEmis = '1';
  const cNF = String(Math.floor(10000000 + Math.random() * 89999999));

  const key43 = `${cUF}${aamm}${cnpj}${mod}${serie3}${nNF9}${tpEmis}${cNF}`;
  const cDV = calcMod11DV(key43);
  const chave = `${key43}${cDV}`;

  const tpAmb = input.ambiente === 'producao' ? '1' : '2';
  const dhEmi = `${nowBr.toISOString().slice(0, 19)}-03:00`;
  const ieClean = (input.ieEmitente || '140002149114').replace(/\D/g, '');
  const munIbge = (input.enderecoEmitente?.municipioIbge || '3550308').replace(/\D/g, '').padStart(7, '0');
  const xMun = input.enderecoEmitente?.municipioNome || 'Sao Paulo';
  const xLgr = input.enderecoEmitente?.logradouro || 'R ANTONIO FORTUNATO';
  const nro = input.enderecoEmitente?.numero || '676';
  const xBairro = input.enderecoEmitente?.bairro || 'BURGO PAULISTA';
  const cep = (input.enderecoEmitente?.cep || '03680000').replace(/\D/g, '').padStart(8, '0');
  const xNomeEmit =
    input.ambiente === 'homologacao'
      ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
      : input.razaoSocialEmitente || 'PROTECT REDES COMERCIO E SERVICOS LTDA';

  const docClean = (input.destinatarioDoc || '').replace(/\D/g, '');
  let destXml = '';
  if (docClean.length === 11 || docClean.length === 14) {
    const idTag = docClean.length === 14 ? `<CNPJ>${docClean}</CNPJ>` : `<CPF>${docClean}</CPF>`;
    const destName =
      input.ambiente === 'homologacao'
        ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
        : escapeXml(input.destinatarioNome?.trim() || 'CONSUMIDOR FINAL');
    destXml = `<dest>${idTag}<xNome>${destName}</xNome><indIEDest>9</indIEDest></dest>`;
  } else if (mod === '55') {
    destXml = `<dest><CPF>00000000000</CPF><xNome>${escapeXml(
      input.ambiente === 'homologacao'
        ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
        : input.destinatarioNome?.trim() || 'CONSUMIDOR FINAL'
    )}</xNome><indIEDest>9</indIEDest></dest>`;
  }

  const itemsList =
    input.itens && input.itens.length > 0
      ? input.itens
      : [
          {
            codigo: 'PROT-01',
            nome: 'Redes e Materiais de Protecao',
            unidade: 'UN',
            quantidade: 1,
            precoUnitario: input.total,
          },
        ];

  const vProdTotal = itemsList.reduce((s, it) => s + it.precoUnitario * it.quantidade, 0);
  const vDescTotal = Math.max(0, Number(input.desconto || 0));
  const vNFTotal = Math.max(0.01, vProdTotal - vDescTotal);

  const detXml = itemsList
    .map((it, idx) => {
      const qCom = Math.max(0.0001, Number(it.quantidade || 1));
      const vUn = Math.max(0.01, Number(it.precoUnitario || 0));
      const vProd = Number((qCom * vUn).toFixed(2));
      const ean = it.codBarras && /^\d{8,14}$/.test(it.codBarras) ? it.codBarras : 'SEM GTIN';
      const ncm = (it.ncm || '56081900').replace(/\D/g, '').padStart(8, '0').slice(0, 8);
      const cfop = (it.cfop || '5102').replace(/\D/g, '').padStart(4, '0').slice(0, 4);
      const csosn = (it.csosn || '102').replace(/\D/g, '').slice(0, 3) || '102';
      const xProd =
        idx === 0 && input.ambiente === 'homologacao' && mod === '65'
          ? 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
          : escapeXml(it.nome.slice(0, 120));
      const uCom = escapeXml((it.unidade || 'UN').slice(0, 6).toUpperCase());

      return `<det nItem="${idx + 1}"><prod><cProd>${escapeXml(
        it.codigo || `ITEM${idx + 1}`
      )}</cProd><cEAN>${ean}</cEAN><xProd>${xProd}</xProd><NCM>${ncm}</NCM><CFOP>${cfop}</CFOP><uCom>${uCom}</uCom><qCom>${qCom.toFixed(
        4
      )}</qCom><vUnCom>${vUn.toFixed(4)}</vUnCom><vProd>${vProd.toFixed(
        2
      )}</vProd><cEANTrib>${ean}</cEANTrib><uTrib>${uCom}</uTrib><qTrib>${qCom.toFixed(
        4
      )}</qTrib><vUnTrib>${vUn.toFixed(
        4
      )}</vUnTrib><indTot>1</indTot></prod><imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>${csosn}</CSOSN></ICMSSN102></ICMS><PIS><PISOutr><CST>49</CST><vBC>0.00</vBC><pPIS>0.00</pPIS><vPIS>0.00</vPIS></PISOutr></PIS><COFINS><COFINSOutr><CST>49</CST><vBC>0.00</vBC><pCOFINS>0.00</pCOFINS><vCOFINS>0.00</vCOFINS></COFINSOutr></COFINS></imposto></det>`;
    })
    .join('');

  const tpImp = mod === '65' ? '4' : '1';
  const tPag = mapFormaPagamentoNFe(input.formaPagamento);

  let infNFeSuplXml = '';
  let qrCodeUrl: string | undefined;

  if (mod === '65') {
    const idToken = String(parseInt((input.cscId || '1').replace(/\D/g, ''), 10) || 1);
    const cscSecret = (input.cscToken || '').trim();
    const baseQr =
      input.ambiente === 'producao'
        ? 'https://www.nfce.fazenda.sp.gov.br/qrcode'
        : 'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode';
    const urlChave =
      input.ambiente === 'producao'
        ? 'https://www.nfce.fazenda.sp.gov.br/consulta'
        : 'https://www.homologacao.nfce.fazenda.sp.gov.br/consulta';

    const strToHash = `${chave}|2|${tpAmb}|${idToken}${cscSecret}`;
    const cHashQRCode = crypto.createHash('sha1').update(strToHash, 'utf8').digest('hex').toUpperCase();
    qrCodeUrl = `${baseQr}?p=${chave}|2|${tpAmb}|${idToken}|${cHashQRCode}`;
    infNFeSuplXml = `<infNFeSupl><qrCode><![CDATA[${qrCodeUrl}]]></qrCode><urlChave>${urlChave}</urlChave></infNFeSupl>`;
  }

  const xmlUnsigned = `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe${chave}" versao="4.00"><ide><cUF>${cUF}</cUF><cNF>${cNF}</cNF><natOp>VENDA DE MERCADORIA</natOp><mod>${mod}</mod><serie>${serieNum}</serie><nNF>${nNFNum}</nNF><dhEmi>${dhEmi}</dhEmi><tpNF>1</tpNF><idDest>1</idDest><cMunFG>${munIbge}</cMunFG><tpImp>${tpImp}</tpImp><tpEmis>${tpEmis}</tpEmis><cDV>${cDV}</cDV><tpAmb>${tpAmb}</tpAmb><finNFe>1</finNFe><indFinal>1</indFinal><indPres>1</indPres><procEmi>0</procEmi><verProc>ProtectRedes-1.0</verProc></ide><emit><CNPJ>${cnpj}</CNPJ><xNome>${escapeXml(
    xNomeEmit
  )}</xNome><xFant>PROTECT REDES</xFant><enderEmit><xLgr>${escapeXml(xLgr)}</xLgr><nro>${escapeXml(
    nro
  )}</nro><xBairro>${escapeXml(xBairro)}</xBairro><cMun>${munIbge}</cMun><xMun>${escapeXml(
    xMun
  )}</xMun><UF>SP</UF><CEP>${cep}</CEP><cPais>1058</cPais><xPais>BRASIL</xPais></enderEmit><IE>${ieClean}</IE><CRT>1</CRT></emit>${destXml}${detXml}<total><ICMSTot><vBC>0.00</vBC><vICMS>0.00</vICMS><vICMSDeson>0.00</vICMSDeson><vFCP>0.00</vFCP><vBCST>0.00</vBCST><vST>0.00</vST><vFCPST>0.00</vFCPST><vFCPSTRet>0.00</vFCPSTRet><vProd>${vProdTotal.toFixed(
    2
  )}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>${vDescTotal.toFixed(
    2
  )}</vDesc><vII>0.00</vII><vIPI>0.00</vIPI><vIPIDevol>0.00</vIPIDevol><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${vNFTotal.toFixed(
    2
  )}</vNF></ICMSTot></total><transp><modFrete>9</modFrete></transp><pag><detPag><tPag>${tPag}</tPag><vPag>${vNFTotal.toFixed(
    2
  )}</vPag></detPag></pag></infNFe>${infNFeSuplXml}</NFe>`;

  return { xmlUnsigned, chave, qrCodeUrl };
}

function httpsMtlsBufferRequest(
  targetUrl: string,
  method: 'GET' | 'POST',
  cert: ActiveCertificate,
  bodyString?: string,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method,
        pfx: cert.pfxBuffer,
        passphrase: cert.password,
        rejectUnauthorized: true,
        timeout: 22000,
        headers: {
          Accept: 'application/json',
          ...(bodyString
            ? {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(bodyString, 'utf8'),
              }
            : {}),
          ...extraHeaders,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 500,
            buffer: Buffer.concat(chunks),
            contentType: String(res.headers['content-type'] || ''),
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('Tempo limite excedido ao conectar ao servidor fiscal do governo.'));
    });
    req.on('error', (err) => reject(err));
    if (bodyString) req.write(bodyString);
    req.end();
  });
}

async function httpsMtlsRequest(
  targetUrl: string,
  method: 'GET' | 'POST',
  cert: ActiveCertificate,
  bodyString?: string,
  extraHeaders?: Record<string, string>
): Promise<{ status: number; body: string }> {
  const res = await httpsMtlsBufferRequest(targetUrl, method, cert, bodyString, extraHeaders);
  return { status: res.status, body: res.buffer.toString('utf8') };
}

function extractXmlTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '8mb' }));

  // Cabeçalhos de segurança globais
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // ==========================================================================
  // ROTAS DE AUTENTICAÇÃO E USUÁRIOS (PROTEÇÃO CONTRA INVASORES)
  // ==========================================================================

  app.get('/api/auth/status', (req, res) => {
    const needsSetup = authStore.users.length === 0;
    const token = extractTokenFromReq(req);
    const payload = token ? verifySessionToken(token) : null;
    res.json({
      needsSetup,
      authenticated: Boolean(payload),
      user: payload
        ? {
            id: payload.uid,
            nome: payload.nome,
            login: payload.login,
            cargo: payload.cargo,
            ativo: true,
          }
        : null,
    });
  });

  app.post('/api/auth/setup', (req, res) => {
    if (authStore.users.length > 0) {
      res.status(403).json({ error: 'O administrador inicial já foi configurado. Faça login.' });
      return;
    }
    const { nome, login, senha } = req.body as {
      nome?: string;
      login?: string;
      senha?: string;
    };
    const cleanLogin = (login || 'admin').trim().toLowerCase();
    const cleanNome = (nome || 'Administrador').trim();
    if (!cleanLogin || !senha || senha.length < 6) {
      res.status(400).json({ error: 'Informe um usuário e uma senha com pelo menos 6 caracteres.' });
      return;
    }

    const { salt, hash } = hashPassword(senha);
    const adminUser: StoredAuthUser = {
      id: 'usr-admin',
      nome: cleanNome,
      login: cleanLogin,
      cargo: 'Administrador',
      ativo: true,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    };
    saveAuthStore({
      sessionSecret: authStore.sessionSecret,
      users: [adminUser],
    });
    const token = signSessionToken(adminUser);
    res.json({ token, user: publicUserView(adminUser) });
  });

  app.post('/api/auth/login', (req, res) => {
    if (authStore.users.length === 0) {
      res.status(400).json({ error: 'Crie a senha do administrador primeiro.' });
      return;
    }
    const { login, senha } = req.body as { login?: string; senha?: string };
    const cleanLogin = (login || '').trim().toLowerCase();
    if (!cleanLogin || typeof senha !== 'string' || !senha) {
      res.status(400).json({ error: 'Informe usuário e senha.' });
      return;
    }

    const rateKey = getRateLimitKey(req, cleanLogin);
    const attempt = loginAttempts.get(rateKey);
    const now = Date.now();
    if (attempt && attempt.blockedUntil > now) {
      const waitSec = Math.ceil((attempt.blockedUntil - now) / 1000);
      res.status(429).json({
        error: `Muitas tentativas incorretas. Aguarde ${waitSec}s para tentar novamente.`,
      });
      return;
    }

    const user = authStore.users.find((u) => u.login.toLowerCase() === cleanLogin && u.ativo);
    const valid = user ? verifyPassword(senha, user.passwordSalt, user.passwordHash) : false;

    if (!valid || !user) {
      const prevCount = attempt && now - attempt.lastAttempt < 10 * 60 * 1000 ? attempt.count : 0;
      const nextCount = prevCount + 1;
      const blockedUntil = nextCount >= 5 ? now + 5 * 60 * 1000 : 0;
      loginAttempts.set(rateKey, { count: nextCount, blockedUntil, lastAttempt: now });
      res.status(401).json({
        error:
          nextCount >= 5
            ? 'Acesso bloqueado por 5 minutos após 5 tentativas incorretas.'
            : `Usuário ou senha incorretos (${5 - nextCount} tentativa(s) restante(s)).`,
      });
      return;
    }

    loginAttempts.delete(rateKey);
    const token = signSessionToken(user);
    res.json({ token, user: publicUserView(user) });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({
      user: {
        id: req.authUser!.uid,
        nome: req.authUser!.nome,
        login: req.authUser!.login,
        cargo: req.authUser!.cargo,
        ativo: true,
      },
    });
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
    const { senhaAtual, novaSenha } = req.body as { senhaAtual?: string; novaSenha?: string };
    if (!senhaAtual || !novaSenha || novaSenha.length < 6) {
      res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
      return;
    }
    const idx = authStore.users.findIndex((u) => u.id === req.authUser!.uid);
    if (idx === -1) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const current = authStore.users[idx];
    if (!verifyPassword(senhaAtual, current.passwordSalt, current.passwordHash)) {
      res.status(400).json({ error: 'Senha atual incorreta.' });
      return;
    }
    const { salt, hash } = hashPassword(novaSenha);
    const updatedUsers = [...authStore.users];
    updatedUsers[idx] = { ...current, passwordSalt: salt, passwordHash: hash };
    saveAuthStore({ ...authStore, users: updatedUsers });
    res.json({ ok: true });
  });

  app.get('/api/auth/users', requireAuth, (_req, res) => {
    res.json({ users: authStore.users.map(publicUserView) });
  });

  app.post('/api/auth/users', requireAuth, requireAdmin, (req, res) => {
    const { id, nome, login, cargo, senha, ativo } = req.body as {
      id?: string;
      nome?: string;
      login?: string;
      cargo?: UserRole;
      senha?: string;
      ativo?: boolean;
    };
    const cleanNome = (nome || '').trim();
    const cleanLogin = (login || '').trim().toLowerCase();
    if (!cleanNome || !cleanLogin) {
      res.status(400).json({ error: 'Nome e login são obrigatórios.' });
      return;
    }

    const conflict = authStore.users.find(
      (u) => u.login.toLowerCase() === cleanLogin && u.id !== id
    );
    if (conflict) {
      res.status(400).json({ error: 'Já existe um operador com este login.' });
      return;
    }

    if (id) {
      const idx = authStore.users.findIndex((u) => u.id === id);
      if (idx === -1) {
        res.status(404).json({ error: 'Operador não encontrado.' });
        return;
      }
      const existing = authStore.users[idx];
      let passwordSalt = existing.passwordSalt;
      let passwordHash = existing.passwordHash;
      if (senha && senha.trim().length > 0) {
        if (senha.trim().length < 6) {
          res.status(400).json({ error: 'A senha precisa ter no mínimo 6 caracteres.' });
          return;
        }
        const hashed = hashPassword(senha.trim());
        passwordSalt = hashed.salt;
        passwordHash = hashed.hash;
      }
      const updated: StoredAuthUser = {
        ...existing,
        nome: cleanNome,
        login: cleanLogin,
        cargo: cargo || existing.cargo,
        ativo: ativo !== undefined ? ativo : existing.ativo,
        passwordSalt,
        passwordHash,
      };
      const nextUsers = [...authStore.users];
      nextUsers[idx] = updated;
      saveAuthStore({ ...authStore, users: nextUsers });
      res.json({ user: publicUserView(updated), users: nextUsers.map(publicUserView) });
      return;
    }

    if (!senha || senha.trim().length < 6) {
      res.status(400).json({ error: 'Informe uma senha com pelo menos 6 caracteres.' });
      return;
    }
    const { salt, hash } = hashPassword(senha.trim());
    const created: StoredAuthUser = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nome: cleanNome,
      login: cleanLogin,
      cargo: cargo || 'Operador PDV',
      ativo: true,
      passwordSalt: salt,
      passwordHash: hash,
      createdAt: new Date().toISOString(),
    };
    const nextUsers = [...authStore.users, created];
    saveAuthStore({ ...authStore, users: nextUsers });
    res.json({ user: publicUserView(created), users: nextUsers.map(publicUserView) });
  });

  app.delete('/api/auth/users/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const targetId = String(req.params.id || '');
    if (targetId === req.authUser!.uid) {
      res.status(400).json({ error: 'Você não pode excluir o próprio usuário conectado.' });
      return;
    }
    const remaining = authStore.users.filter((u) => u.id !== targetId);
    if (!remaining.some((u) => u.cargo === 'Administrador' && u.ativo)) {
      res.status(400).json({ error: 'Deve existir ao menos um Administrador ativo.' });
      return;
    }
    saveAuthStore({ ...authStore, users: remaining });
    res.json({ users: remaining.map(publicUserView) });
  });

  // ==========================================================================
  // CONEXÃO SUPABASE (INTERLIGAR PRODUTOS, ESTOQUE E MÁQUINAS)
  // ==========================================================================

  interface SupabaseStoredConfig {
    url: string;
    apiKey: string;
    updatedAt: string;
  }

  const SUPABASE_CONFIG_PATH = path.join(DATA_DIR, 'supabase.json');

  function loadSupabaseConfig(): SupabaseStoredConfig | null {
    if (fs.existsSync(SUPABASE_CONFIG_PATH)) {
      try {
        const raw = fs.readFileSync(SUPABASE_CONFIG_PATH, 'utf8');
        const parsed = JSON.parse(raw) as Partial<SupabaseStoredConfig>;
        if (parsed.url && parsed.apiKey) {
          return {
            url: String(parsed.url).trim().replace(/\/$/, ''),
            apiKey: String(parsed.apiKey).trim(),
            updatedAt: parsed.updatedAt || new Date().toISOString(),
          };
        }
      } catch {
        // fall back to env vars
      }
    }
    const envUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
    const envKey = (process.env.SUPABASE_KEY || '').trim();
    if (envUrl && envKey) {
      return { url: envUrl, apiKey: envKey, updatedAt: new Date().toISOString() };
    }
    return null;
  }

  function saveSupabaseConfig(cfg: SupabaseStoredConfig): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    }
    fs.writeFileSync(SUPABASE_CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  }

  function maskApiKey(key: string): string {
    if (!key) return '';
    if (key.length <= 12) return '••••••';
    return `${key.slice(0, 6)}••••••${key.slice(-4)}`;
  }

  async function supabaseRestFetch(
    cfg: SupabaseStoredConfig,
    restPath: string,
    init: RequestInit = {}
  ): Promise<globalThis.Response> {
    const headers = new Headers(init.headers);
    headers.set('apikey', cfg.apiKey);
    // Chaves antigas (eyJ...) usam Authorization: Bearer; chaves novas (sb_secret_ / sb_publishable_) usam apenas apikey
    if (cfg.apiKey.startsWith('eyJ')) {
      headers.set('Authorization', `Bearer ${cfg.apiKey}`);
    }
    if (!headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(`${cfg.url}/rest/v1/${restPath.replace(/^\//, '')}`, {
      ...init,
      headers,
    });
  }

  interface SupabaseProdutoRow {
    id: string;
    nome?: string | null;
    codigo?: string | null;
    categoria?: string | null;
    codigo_barras?: string | null;
    custo?: number | string | null;
    venda?: number | string | null;
    unidade?: string | null;
    minimo?: number | string | null;
    saldo?: number | string | null;
    fornecedor?: string | null;
    foto?: string | null;
    foto_url?: string | null;
    observacao?: string | null;
    ncm?: string | null;
    cfop?: string | null;
    criado_em?: string | null;
  }

  function cleanEmptyText(val: unknown): string {
    if (typeof val !== 'string') return '';
    const trimmed = val.trim();
    if (!trimmed || trimmed.toUpperCase() === 'EMPTY' || trimmed.toUpperCase() === 'NULL') return '';
    return trimmed;
  }

  function mapSupabaseProdutoToErp(row: SupabaseProdutoRow) {
    return {
      id: String(row.id),
      codigo: cleanEmptyText(row.codigo) || String(row.id),
      nome: cleanEmptyText(row.nome) || 'Produto sem nome',
      categoria: cleanEmptyText(row.categoria) || 'Geral',
      unidade: cleanEmptyText(row.unidade) || 'un',
      custo: Number(row.custo) || 0,
      venda: Number(row.venda) || 0,
      saldo: Number(row.saldo) || 0,
      minimo: Number(row.minimo) || 0,
      codBarras: cleanEmptyText(row.codigo_barras),
      ncm: cleanEmptyText(row.ncm) || '56081900',
      cfop: cleanEmptyText(row.cfop) || '5102',
      csosn: '102',
      fornecedorNome: cleanEmptyText(row.fornecedor) || undefined,
      imagem: cleanEmptyText(row.foto_url) || cleanEmptyText(row.foto) || undefined,
      updatedAt: row.criado_em || new Date().toISOString(),
    };
  }

  function mapErpProdutoToSupabase(prod: {
    id: string;
    codigo: string;
    nome: string;
    categoria: string;
    unidade: string;
    custo: number;
    venda: number;
    saldo: number;
    minimo: number;
    codBarras?: string;
    ncm?: string;
    cfop?: string;
    fornecedorNome?: string;
    imagem?: string;
  }) {
    const payload: Record<string, unknown> = {
      id: prod.id,
      nome: prod.nome,
      codigo: prod.codigo || '',
      categoria: prod.categoria || 'Geral',
      codigo_barras: prod.codBarras || '',
      custo: Number(prod.custo) || 0,
      venda: Number(prod.venda) || 0,
      unidade: prod.unidade || 'un',
      minimo: Math.round(Number(prod.minimo) || 0),
      saldo: Number(prod.saldo) || 0,
      ncm: prod.ncm || '',
      cfop: prod.cfop || '5102',
    };
    if (prod.fornecedorNome !== undefined) {
      payload.fornecedor = prod.fornecedorNome;
    }
    if (prod.imagem !== undefined) {
      payload.foto_url = prod.imagem;
    }
    return payload;
  }

  async function checkCloudStateTable(cfg: SupabaseStoredConfig): Promise<boolean> {
    try {
      const resp = await supabaseRestFetch(cfg, 'erp_cloud_state?select=id&limit=1');
      return resp.ok;
    } catch {
      return false;
    }
  }

  app.get('/api/supabase/status', requireAuth, async (_req, res) => {
    const cfg = loadSupabaseConfig();
    if (!cfg) {
      res.json({ configured: false, url: '', maskedKey: '', cloudStateReady: false });
      return;
    }
    const cloudStateReady = await checkCloudStateTable(cfg);
    res.json({
      configured: true,
      url: cfg.url,
      maskedKey: maskApiKey(cfg.apiKey),
      cloudStateReady,
    });
  });

  app.post('/api/supabase/config', requireAuth, requireAdmin, async (req, res) => {
    const { url, apiKey } = req.body as { url?: string; apiKey?: string };
    const cleanUrl = (url || '').trim().replace(/\/$/, '');
    const cleanKey = (apiKey || '').trim();
    if (!cleanUrl || !cleanUrl.startsWith('http')) {
      res.status(400).json({ error: 'Informe a URL do projeto Supabase (ex.: https://xxxx.supabase.co).' });
      return;
    }
    if (!cleanKey || cleanKey.length < 16) {
      res.status(400).json({ error: 'Informe a chave API do Supabase válida.' });
      return;
    }

    const candidate: SupabaseStoredConfig = {
      url: cleanUrl,
      apiKey: cleanKey,
      updatedAt: new Date().toISOString(),
    };

    try {
      const testResp = await supabaseRestFetch(candidate, 'produtos?select=id&limit=1000');
      if (!testResp.ok) {
        const errBody = await testResp.text();
        const hint =
          testResp.status === 401 || testResp.status === 403
            ? 'Chave recusada ou bloqueada por política RLS no Supabase. Tente usar a chave service_role (secret) ou confira a chave anon.'
            : `Supabase respondeu HTTP ${testResp.status}: ${errBody.slice(0, 180)}`;
        res.status(400).json({ error: hint });
        return;
      }
      const rows = (await testResp.json()) as Array<{ id: string }>;
      saveSupabaseConfig(candidate);
      const cloudStateReady = await checkCloudStateTable(candidate);
      res.json({
        ok: true,
        configured: true,
        url: candidate.url,
        maskedKey: maskApiKey(candidate.apiKey),
        cloudStateReady,
        productCount: Array.isArray(rows) ? rows.length : 0,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Não foi possível alcançar o endereço do Supabase.',
      });
    }
  });

  app.delete('/api/supabase/config', requireAuth, requireAdmin, (_req, res) => {
    if (fs.existsSync(SUPABASE_CONFIG_PATH)) {
      fs.unlinkSync(SUPABASE_CONFIG_PATH);
    }
    res.json({ ok: true, configured: false });
  });

  app.get('/api/supabase/produtos', requireAuth, async (_req, res) => {
    const cfg = loadSupabaseConfig();
    if (!cfg) {
      res.status(400).json({ error: 'Supabase não configurado.' });
      return;
    }
    try {
      const resp = await supabaseRestFetch(cfg, 'produtos?select=*&order=nome.asc&limit=2000');
      if (!resp.ok) {
        const text = await resp.text();
        res.status(resp.status).json({ error: `Erro ao ler produtos no Supabase: ${text.slice(0, 200)}` });
        return;
      }
      const rows = (await resp.json()) as SupabaseProdutoRow[];
      res.json({
        products: rows.map(mapSupabaseProdutoToErp),
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Falha de rede ao ler produtos do Supabase.',
      });
    }
  });

  app.post('/api/supabase/produtos/upsert', requireAuth, async (req, res) => {
    const cfg = loadSupabaseConfig();
    if (!cfg) {
      res.status(400).json({ error: 'Supabase não configurado.' });
      return;
    }
    const { products } = req.body as {
      products?: Array<{
        id: string;
        codigo: string;
        nome: string;
        categoria: string;
        unidade: string;
        custo: number;
        venda: number;
        saldo: number;
        minimo: number;
        codBarras?: string;
        ncm?: string;
        cfop?: string;
        fornecedorNome?: string;
        imagem?: string;
      }>;
    };
    if (!Array.isArray(products) || products.length === 0) {
      res.json({ ok: true, count: 0 });
      return;
    }
    try {
      const mapped = products.map(mapErpProdutoToSupabase);
      const resp = await supabaseRestFetch(cfg, 'produtos?on_conflict=id', {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(mapped),
      });
      if (!resp.ok) {
        const text = await resp.text();
        res.status(resp.status).json({ error: `Erro ao salvar produtos no Supabase: ${text.slice(0, 200)}` });
        return;
      }
      res.json({ ok: true, count: mapped.length });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Falha ao sincronizar produtos com o Supabase.',
      });
    }
  });

  app.delete('/api/supabase/produtos/:id', requireAuth, async (req, res) => {
    const cfg = loadSupabaseConfig();
    if (!cfg) {
      res.status(400).json({ error: 'Supabase não configurado.' });
      return;
    }
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }
    try {
      const resp = await supabaseRestFetch(cfg, `produtos?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!resp.ok) {
        const text = await resp.text();
        res.status(resp.status).json({ error: `Erro ao excluir no Supabase: ${text.slice(0, 200)}` });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Falha ao excluir produto no Supabase.',
      });
    }
  });

  app.get('/api/supabase/state', requireAuth, async (_req, res) => {
    const cfg = loadSupabaseConfig();
    if (!cfg) {
      res.status(400).json({ error: 'Supabase não configurado.' });
      return;
    }
    try {
      const resp = await supabaseRestFetch(cfg, 'erp_cloud_state?id=eq.main&select=data,updated_at');
      if (resp.status === 404) {
        res.json({ tableMissing: true, state: null });
        return;
      }
      if (!resp.ok) {
        const text = await resp.text();
        if (text.includes('PGRST205') || text.includes('erp_cloud_state')) {
          res.json({ tableMissing: true, state: null });
          return;
        }
        res.status(resp.status).json({ error: text.slice(0, 200) });
        return;
      }
      const rows = (await resp.json()) as Array<{ data?: unknown; updated_at?: string }>;
      res.json({
        tableMissing: false,
        state: rows[0]?.data ?? null,
        updatedAt: rows[0]?.updated_at ?? null,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Falha ao ler estado na nuvem Supabase.',
      });
    }
  });

  app.post('/api/supabase/state', requireAuth, async (req, res) => {
    const cfg = loadSupabaseConfig();
    if (!cfg) {
      res.status(400).json({ error: 'Supabase não configurado.' });
      return;
    }
    try {
      const resp = await supabaseRestFetch(cfg, 'erp_cloud_state?on_conflict=id', {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          id: 'main',
          data: req.body?.state ?? {},
          updated_at: new Date().toISOString(),
        }),
      });
      if (resp.status === 404) {
        res.json({ ok: false, tableMissing: true });
        return;
      }
      if (!resp.ok) {
        const text = await resp.text();
        if (text.includes('PGRST205') || text.includes('erp_cloud_state')) {
          res.json({ ok: false, tableMissing: true });
          return;
        }
        res.status(resp.status).json({ error: text.slice(0, 200) });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Falha ao gravar estado na nuvem Supabase.',
      });
    }
  });

  // ==========================================================================
  // ROTAS FISCAIS PROTEGIDAS POR AUTENTICAÇÃO
  // ==========================================================================

  // 1. Certificado A1 Status
  app.get('/api/fiscal/certificado/status', requireAuth, (_req, res) => {
    if (!activeCert) {
      res.json({ loaded: false });
      return;
    }
    res.json({
      loaded: true,
      subject: activeCert.subject,
      cnpj: activeCert.cnpj,
      issuer: activeCert.issuer,
      serialNumber: activeCert.serialNumber,
      validFrom: activeCert.validFrom,
      validTo: activeCert.validTo,
      expired: activeCert.expired,
      daysRemaining: activeCert.daysRemaining,
    });
  });

  // 2. Carregar e Validar Certificado A1 (.pfx + senha) — Apenas Administrador
  app.post('/api/fiscal/certificado', requireAuth, requireAdmin, (req, res) => {
    try {
      const { pfxBase64, password } = req.body as { pfxBase64?: string; password?: string };
      if (!pfxBase64 || typeof password !== 'string') {
        res.status(400).json({ error: 'Informe o arquivo .pfx e a senha do Certificado A1.' });
        return;
      }

      const cleanBase64 = pfxBase64.includes(',') ? pfxBase64.split(',')[1] : pfxBase64;
      const pfxBuffer = Buffer.from(cleanBase64, 'base64');
      if (pfxBuffer.length < 100) {
        res.status(400).json({ error: 'Arquivo .pfx inválido ou corrompido.' });
        return;
      }

      const parsed = parsePfxCertificate(pfxBuffer, password);
      activeCert = parsed;

      res.json({
        loaded: true,
        subject: parsed.subject,
        cnpj: parsed.cnpj,
        issuer: parsed.issuer,
        serialNumber: parsed.serialNumber,
        validFrom: parsed.validFrom,
        validTo: parsed.validTo,
        expired: parsed.expired,
        daysRemaining: parsed.daysRemaining,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao ler certificado .pfx';
      const friendly =
        msg.toLowerCase().includes('mac') || msg.toLowerCase().includes('password')
          ? 'Senha do Certificado A1 incorreta ou arquivo .pfx inválido.'
          : msg;
      res.status(400).json({ error: friendly });
    }
  });

  // 3. Desconectar Certificado A1 — Apenas Administrador
  app.delete('/api/fiscal/certificado', requireAuth, requireAdmin, (_req, res) => {
    activeCert = null;
    res.json({ loaded: false });
  });

  // 4. Testar Conexão mTLS real com Sefin Nacional / ADN
  app.post('/api/fiscal/testar-mtls', requireAuth, async (req, res) => {
    if (!activeCert) {
      res.status(400).json({ error: 'Carregue seu Certificado Digital A1 (.pfx) primeiro.' });
      return;
    }
    const { ambiente = 'homologacao', municipioIbge = '3550308' } = req.body as {
      ambiente?: 'homologacao' | 'producao';
      municipioIbge?: string;
    };
    const ibge = municipioIbge.replace(/\D/g, '') || '3550308';
    const baseAdn =
      ambiente === 'producao'
        ? 'https://adn.nfse.gov.br'
        : 'https://adn.producaorestrita.nfse.gov.br';
    const testUrl = `${baseAdn}/parametrizacao/${ibge}/convenio`;

    try {
      const result = await httpsMtlsRequest(testUrl, 'GET', activeCert);
      res.json({
        ok: result.status >= 200 && result.status < 500,
        status: result.status,
        endpoint: testUrl,
        preview: result.body.slice(0, 600),
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        endpoint: testUrl,
        error: err instanceof Error ? err.message : 'Falha na conexão mTLS com o Portal Nacional.',
      });
    }
  });

  // 5. Gerar & Assinar XML DPS (NFS-e Serviço)
  app.post('/api/fiscal/nfse/assinar', requireAuth, (req, res) => {
    try {
      const input = req.body as DpsInput;
      const { xml, infId } = buildDpsXml(input);
      if (!activeCert) {
        res.json({ signed: false, xml, infId });
        return;
      }
      const xmlSigned = signXmlEnveloped(xml, 'infDPS', infId, '</DPS>', activeCert, 'sha256');
      const gz = zlib.gzipSync(Buffer.from(xmlSigned, 'utf8')).toString('base64');
      res.json({
        signed: true,
        xml: xmlSigned,
        dpsXmlGZipB64: gz,
        infId,
        certCnpj: activeCert.cnpj,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Erro ao gerar/assinar XML DPS.',
      });
    }
  });

  // 6. Transmitir NFS-e Serviço de verdade para Sefin Nacional (mTLS com A1)
  app.post('/api/fiscal/nfse/transmitir', requireAuth, async (req, res) => {
    if (!activeCert) {
      res.status(400).json({
        error: 'Certificado Digital A1 não carregado. Conecte o arquivo .pfx para transmitir.',
      });
      return;
    }
    if (activeCert.expired) {
      res.status(400).json({
        error: 'Seu Certificado Digital A1 está vencido. Renove ou carregue um certificado válido.',
      });
      return;
    }

    try {
      const { dps, sefinUrl, customProxyUrl, token } = req.body as {
        dps: DpsInput;
        sefinUrl?: string;
        customProxyUrl?: string;
        token?: string;
      };

      const { xml, infId } = buildDpsXml(dps);
      const xmlSigned = signXmlEnveloped(xml, 'infDPS', infId, '</DPS>', activeCert, 'sha256');
      const dpsXmlGZipB64 = zlib.gzipSync(Buffer.from(xmlSigned, 'utf8')).toString('base64');

      const defaultSefin =
        dps.ambiente === 'producao'
          ? 'https://sefin.nfse.gov.br/SefinNacional/nfse'
          : 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse';

      const normalizedSefin = sefinUrl
        ?.trim()
        .replace('/API/SefinNacional', '/SefinNacional')
        .replace(/\/$/, '');

      const targetUrl = customProxyUrl?.trim()
        ? customProxyUrl.trim()
        : normalizedSefin
          ? `${normalizedSefin}/nfse`
          : defaultSefin;

      const payloadJson = JSON.stringify({ dpsXmlGZipB64 });
      const headers: Record<string, string> = {};
      if (token?.trim()) headers.Authorization = `Bearer ${token.trim()}`;

      const result = await httpsMtlsRequest(targetUrl, 'POST', activeCert, payloadJson, headers);
      let parsedBody: Record<string, unknown> | null = null;
      try {
        parsedBody = JSON.parse(result.body) as Record<string, unknown>;
      } catch {
        parsedBody = null;
      }

      if (result.status >= 200 && result.status < 300) {
        res.json({
          authorized: true,
          status: result.status,
          endpoint: targetUrl,
          chaveAcesso:
            (parsedBody?.chaveAcesso as string | undefined) ||
            (parsedBody?.idDps as string | undefined) ||
            '',
          response: parsedBody ?? result.body,
          xmlSigned,
        });
      } else {
        const errosArr = (parsedBody?.erros ?? parsedBody?.Erros) as
          | Array<{
              Codigo?: string;
              codigo?: string;
              Descricao?: string;
              descricao?: string;
              Complemento?: string;
              complemento?: string;
            }>
          | undefined;
        let extractedError = '';
        if (Array.isArray(errosArr) && errosArr.length > 0) {
          extractedError = errosArr
            .map((e) => {
              const code = e.Codigo || e.codigo || '';
              const desc = e.Descricao || e.descricao || '';
              const comp = e.Complemento || e.complemento || '';
              return [code, desc, comp].filter(Boolean).join(' - ');
            })
            .join(' | ');
        } else if (parsedBody?.errors && typeof parsedBody.errors === 'object') {
          extractedError = Object.entries(parsedBody.errors as Record<string, unknown>)
            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
            .join(' | ');
        } else {
          extractedError =
            (parsedBody?.mensagem as string | undefined) ||
            (parsedBody?.erro as string | undefined) ||
            (parsedBody?.detail as string | undefined) ||
            (parsedBody?.title as string | undefined) ||
            (result.body && !result.body.trim().startsWith('<')
              ? result.body.slice(0, 400)
              : '') ||
            `Sefin Nacional retornou HTTP ${result.status}.`;
        }

        res.status(422).json({
          authorized: false,
          status: result.status,
          endpoint: targetUrl,
          error: `Sefin HTTP ${result.status}: ${extractedError}`,
          details: parsedBody ?? result.body.slice(0, 800),
          xmlSigned,
        });
      }
    } catch (err) {
      res.status(502).json({
        authorized: false,
        error: err instanceof Error ? err.message : 'Erro de comunicação mTLS com a Sefin Nacional.',
      });
    }
  });

  // 6b. Baixar DANFSe PDF oficial do ADN
  app.get('/api/fiscal/nfse/danfse/:chave', requireAuth, async (req, res) => {
    if (!activeCert) {
      res.status(400).json({
        error: 'Certificado Digital A1 não carregado. Conecte seu .pfx para baixar o DANFSe PDF oficial.',
      });
      return;
    }
    const chave = String(req.params.chave || '').replace(/\D/g, '');
    if (chave.length !== 50) {
      res.status(400).json({ error: 'Chave de acesso NFS-e inválida (precisa ter 50 dígitos).' });
      return;
    }
    const ambiente = req.query.ambiente === 'producao' ? 'producao' : 'homologacao';
    const baseAdn =
      ambiente === 'producao'
        ? 'https://adn.nfse.gov.br'
        : 'https://adn.producaorestrita.nfse.gov.br';
    const danfseUrl = `${baseAdn}/danfse/${chave}`;

    try {
      const result = await httpsMtlsBufferRequest(danfseUrl, 'GET', activeCert, undefined, {
        Accept: 'application/pdf, application/json',
      });
      if (result.status >= 200 && result.status < 300 && result.buffer.length > 100) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="DANFSe-${chave}.pdf"`);
        res.send(result.buffer);
        return;
      }
      const txt = result.buffer.toString('utf8').slice(0, 500);
      res.status(422).json({
        error: `ADN retornou HTTP ${result.status} ao buscar DANFSe. ${txt}`,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Erro ao consultar DANFSe no ADN.',
      });
    }
  });

  // 6c. Baixar XML oficial autorizado da NFS-e na Sefin Nacional
  app.get('/api/fiscal/nfse/xml-autorizado/:chave', requireAuth, async (req, res) => {
    if (!activeCert) {
      res.status(400).json({
        error: 'Certificado Digital A1 não carregado. Conecte seu .pfx para consultar o XML oficial.',
      });
      return;
    }
    const chave = String(req.params.chave || '').replace(/\D/g, '');
    if (chave.length !== 50) {
      res.status(400).json({ error: 'Chave de acesso NFS-e inválida.' });
      return;
    }
    const ambiente = req.query.ambiente === 'producao' ? 'producao' : 'homologacao';
    const baseSefin =
      ambiente === 'producao'
        ? 'https://sefin.nfse.gov.br/SefinNacional'
        : 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional';
    const url = `${baseSefin}/nfse/${chave}`;

    try {
      const result = await httpsMtlsRequest(url, 'GET', activeCert);
      if (result.status >= 200 && result.status < 300) {
        const parsed = JSON.parse(result.body) as { nfseXmlGZipB64?: string };
        if (parsed.nfseXmlGZipB64) {
          const xml = zlib.gunzipSync(Buffer.from(parsed.nfseXmlGZipB64, 'base64')).toString('utf8');
          res.json({ xml, chave });
          return;
        }
      }
      res.status(422).json({ error: `Sefin HTTP ${result.status}: ${result.body.slice(0, 400)}` });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Erro ao consultar XML oficial da NFS-e.',
      });
    }
  });

  // 7. Assinar XML NF-e Produto (Modelo 55/65) com Certificado A1 (RSA-SHA1 padrão SEFAZ)
  app.post('/api/fiscal/nfe/assinar', requireAuth, (req, res) => {
    try {
      const { xmlUnsigned, nfeKey } = req.body as { xmlUnsigned?: string; nfeKey?: string };
      if (!xmlUnsigned || !nfeKey) {
        res.status(400).json({ error: 'XML e chave da NF-e são obrigatórios.' });
        return;
      }
      if (!activeCert) {
        res.json({ signed: false, xml: xmlUnsigned });
        return;
      }
      const xmlSigned = signXmlEnveloped(
        xmlUnsigned,
        'infNFe',
        `NFe${nfeKey}`,
        '</NFe>',
        activeCert,
        'sha1'
      );
      res.json({ signed: true, xml: xmlSigned, certCnpj: activeCert.cnpj });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Falha ao assinar NF-e com A1.',
      });
    }
  });

  // 7b. Emitir & Transmitir NF-e (Mod 55) ou NFC-e (Mod 65) direto para SEFAZ-SP via SOAP 1.2 + mTLS
  app.post('/api/fiscal/nfe/emitir', requireAuth, async (req, res) => {
    const input = req.body as NFeProductEmitInput;
    try {
      const { xmlUnsigned, chave, qrCodeUrl } = buildNFeOrNFCeXml(input);

      if (!activeCert) {
        res.status(400).json({
          authorized: false,
          chave,
          qrCodeUrl,
          error: 'Certificado Digital A1 não conectado. Conecte o .pfx em NF-e & NFS-e.',
        });
        return;
      }
      if (activeCert.expired) {
        res.status(400).json({
          authorized: false,
          chave,
          qrCodeUrl,
          error: 'Seu Certificado Digital A1 está vencido.',
        });
        return;
      }

      const xmlSigned = signXmlEnveloped(
        xmlUnsigned,
        'infNFe',
        `NFe${chave}`,
        '</NFe>',
        activeCert,
        'sha1'
      );

      if (input.modelo === '65' && (!input.cscId?.trim() || !input.cscToken?.trim())) {
        res.status(400).json({
          authorized: false,
          chave,
          qrCodeUrl,
          xmlSigned,
          error:
            'Para transmitir NFC-e (cupom do caixa) na SEFAZ-SP, informe o ID e Código CSC em NF-e & NFS-e > Configurar Empresa (ou selecione NF-e Mod 55).',
        });
        return;
      }

      const nfeInner = xmlSigned.replace(/^<\?xml[^>]*\?>\s*/i, '');
      const idLote = String(Date.now()).slice(-15);
      const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${idLote}</idLote><indSinc>1</indSinc>${nfeInner}</enviNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`;

      const sefazUrl =
        input.modelo === '65'
          ? input.ambiente === 'producao'
            ? 'https://nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx'
            : 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx'
          : input.ambiente === 'producao'
            ? 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx'
            : 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx';

      const result = await httpsMtlsRequest(sefazUrl, 'POST', activeCert, soapEnvelope, {
        Accept: 'application/soap+xml, text/xml',
        'Content-Type':
          'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote"',
      });

      const protBlock = extractXmlTag(result.body, 'protNFe');
      const infProt = protBlock ? extractXmlTag(protBlock, 'infProt') : '';
      const cStat = extractXmlTag(infProt || result.body, 'cStat');
      const xMotivo = extractXmlTag(infProt || result.body, 'xMotivo');
      const nProt = extractXmlTag(infProt, 'nProt');

      if (result.status >= 200 && result.status < 300 && (cStat === '100' || cStat === '150')) {
        res.json({
          authorized: true,
          cStat,
          xMotivo,
          protocolo: nProt,
          chave,
          qrCodeUrl,
          xmlSigned,
          endpoint: sefazUrl,
        });
      } else {
        res.status(422).json({
          authorized: false,
          cStat,
          xMotivo,
          chave,
          qrCodeUrl,
          xmlSigned,
          endpoint: sefazUrl,
          error: cStat
            ? `SEFAZ-SP (${cStat}): ${xMotivo || 'Rejeição na validação.'}`
            : `SEFAZ HTTP ${result.status}: ${result.body.slice(0, 350)}`,
        });
      }
    } catch (err) {
      res.status(502).json({
        authorized: false,
        error: err instanceof Error ? err.message : 'Erro mTLS ao comunicar com a SEFAZ-SP.',
      });
    }
  });

  // 8. Proxy para Calculadora RTC da Receita Federal
  app.post('/api/fiscal/rtc/simular', requireAuth, async (req, res) => {
    const { rtcBaseUrl, payload } = req.body as {
      rtcBaseUrl?: string;
      payload?: Record<string, unknown>;
    };
    if (!rtcBaseUrl?.trim()) {
      res.status(400).json({ error: 'Informe a URL da API Calculadora RTC.' });
      return;
    }
    const endpoint = `${rtcBaseUrl.trim().replace(/\/$/, '')}/api/calculadora/base-calculo/base-calculo-unificada-nfse`;
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
      });
      const text = await resp.text();
      res.status(resp.status).send(text);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Falha ao consultar API Calculadora RTC.',
      });
    }
  });

  // Mount Vite middleware in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Protect Rede Estoque servidor seguro ativo na porta ${PORT}`);
  });
}

void startServer();
