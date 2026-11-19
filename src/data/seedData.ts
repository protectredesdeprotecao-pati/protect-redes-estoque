import {
  AlertSettings,
  AppUser,
  CashMovement,
  Customer,
  Duplicata,
  NFeConfig,
  NFeRecord,
  NFSeRecord,
  ObraWithdrawal,
  Product,
  Sale,
  StockEntry,
  Supplier,
} from '../types/erp';

export const SEED_CATEGORIES: string[] = [
  'Redes de Proteção',
  'Fixação e Ganchos',
  'Cordas e Cabos',
  'Estruturas e Perfis',
  'Ferramentas e Insumos',
];

export const PRODUCT_IMAGE_PRESETS = [
  { label: 'Rede Branca 5x5', url: '/src/assets/images/prod_rede_branca_1794937728981.jpg' },
  { label: 'Rede Preta 5x5', url: '/src/assets/images/prod_rede_preta_1794937729533.jpg' },
  { label: 'Rede Areia 3x3', url: '/src/assets/images/prod_rede_areia_1794937729919.jpg' },
  { label: 'Ganchos e Buchas', url: '/src/assets/images/prod_ganchos_buchas_1794937729772.jpg' },
  { label: 'Corda Trançada', url: '/src/assets/images/prod_corda_rolo_1794937731080.jpg' },
  { label: 'Perfil e Broca', url: '/src/assets/images/prod_perfil_ferramenta_1794937731463.jpg' },
];

export const SEED_SUPPLIERS: Supplier[] = [];

export const SEED_PRODUCTS: Product[] = [];

export const SEED_CUSTOMERS: Customer[] = [];

export const SEED_SALES: Sale[] = [];

export const SEED_OBRA: ObraWithdrawal[] = [];

export const SEED_ENTRIES: StockEntry[] = [];

export const SEED_CASH: CashMovement[] = [];

export const SEED_DUPLICATAS: Duplicata[] = [];

export const SEED_NFES: NFeRecord[] = [];

export const SEED_NFSES: NFSeRecord[] = [];

export const SEED_USERS: AppUser[] = [
  {
    id: 'usr-admin',
    nome: 'Administrador',
    login: 'admin',
    senha: '••••••',
    cargo: 'Administrador',
    ativo: true,
  },
];

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  diasAvisoDuplicata: 3,
  percentualPreventivoEstoque: 125,
  diasAlertaFiado: 5,
  notificacoesEmTempoReal: true,
  monitoramentoAutomatico: true,
};

export const DEFAULT_NFE_CONFIG: NFeConfig = {
  serverUrl: '',
  token: '',
  ambiente: 'homologacao',
  serie: '1',
  rtcCalculadoraUrl: '',
  nfseSefinUrl: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional',
  regimePadrao: 'simples_nacional',
  municipioIbge: '3550308',
  cnpjPrestador: '23246816000103',
  inscricaoMunicipal: '000000053254996',
  inscricaoEstadual: '140002149114',
  modeloProdutoPadrao: '65',
  cscId: '',
  cscToken: '',
  autoEmitirNfse: true,
  autoEmitirNfeProduto: true,
  autoImprimirNotinha: true,
  larguraCupom: '80mm',
  enderecoEmitente: {
    logradouro: 'R ANTONIO FORTUNATO',
    numero: '676',
    bairro: 'BURGO PAULISTA',
    cep: '03680000',
    uf: 'SP',
  },
};
