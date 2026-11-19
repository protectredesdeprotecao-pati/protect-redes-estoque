export type PageId =
  | 'painel'
  | 'produtos'
  | 'fornecedores'
  | 'entradas'
  | 'vendas'
  | 'obra'
  | 'caixa'
  | 'duplicatas'
  | 'nfe'
  | 'clientes'
  | 'relatorios'
  | 'fiado'
  | 'cadastros'
  | 'usuarios';

export type PaymentMethod = 'dinheiro' | 'pix' | 'credito' | 'debito' | 'fiado';

export interface Product {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  unidade: string;
  custo: number;
  venda: number;
  saldo: number;
  minimo: number;
  fornecedorId?: string;
  codBarras?: string;
  ncm?: string;
  cfop?: string;
  csosn?: string;
  imagem?: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  nome: string;
  cnpj: string;
  contato: string;
  telefone: string;
  categoria: string;
  endereco: string;
}

export interface Customer {
  id: string;
  nome: string;
  doc: string;
  telefone: string;
  cidade: string;
  endereco?: string;
}

export interface StockEntry {
  id: string;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  custoUnitario: number;
  fornecedorId?: string;
  fornecedorNome?: string;
  data: string;
  nfReferencia: string;
  observacao?: string;
  origem: 'manual' | 'xml';
  criadoEm: string;
}

export interface SaleItem {
  produtoId: string;
  codigo: string;
  nome: string;
  unidade: string;
  quantidade: number;
  precoUnitario: number;
  custoUnitario: number;
  codBarras?: string;
  ncm?: string;
  cfop?: string;
  csosn?: string;
}

export interface Sale {
  id: string;
  numero: number;
  data: string;
  criadoEm: string;
  clienteNome: string;
  clienteDoc?: string;
  clienteId?: string;
  itens: SaleItem[];
  subtotal: number;
  desconto: number;
  total: number;
  formaPagamento: PaymentMethod;
  valorRecebido?: number;
  troco?: number;
  vendedor: string;
  status: 'concluida' | 'cancelada';
  fiadoPago?: boolean;
  fiadoPagoEm?: string;
  nfeId?: string;
}

export interface ObraWithdrawalItem {
  produtoId: string;
  codigo: string;
  nome: string;
  unidade: string;
  quantidade: number;
  custoUnitario: number;
}

export interface ObraWithdrawal {
  id: string;
  data: string;
  criadoEm: string;
  destino: string;
  responsavel: string;
  observacao?: string;
  itens: ObraWithdrawalItem[];
  custoTotal: number;
  clienteNome?: string;
  clienteDoc?: string;
  valorServico?: number;
  nfseId?: string;
}

export interface CashMovement {
  id: string;
  data: string;
  criadoEm: string;
  descricao: string;
  clienteOuOrigem: string;
  formaPagamento: string;
  tipo: 'entrada' | 'saida';
  valor: number;
  origemRef?: string;
}

export interface Duplicata {
  id: string;
  fornecedorId?: string;
  fornecedorNome: string;
  nf: string;
  descricao: string;
  valor: number;
  vencimento: string;
  formaPagamento: 'boleto' | 'pix' | 'transferencia' | 'dinheiro';
  status: 'pendente' | 'paga';
  dataPagamento?: string;
}

export interface NFeRecord {
  id: string;
  numero: string;
  modelo?: '55' | '65';
  data: string;
  clienteNome: string;
  clienteDoc: string;
  valor: number;
  desconto?: number;
  formaPagamento?: PaymentMethod;
  itensSnapshot?: SaleItem[];
  status: 'autorizada' | 'pendente' | 'rejeitada';
  chave: string;
  protocolo?: string;
  qrCodeUrl?: string;
  xmlSigned?: string;
  vendaId?: string;
  motivoRejeicao?: string;
}

export interface NFSeRecord {
  id: string;
  numeroDps: string;
  data: string;
  tomadorNome: string;
  tomadorDoc: string;
  municipioIncidencia: string;
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
  valorIss: number;
  valorCbs: number;
  valorIbs: number;
  status: 'autorizada' | 'pendente' | 'rejeitada';
  chaveNfse?: string;
  motivoRejeicao?: string;
}

export interface NFeConfig {
  serverUrl: string;
  token: string;
  ambiente: 'homologacao' | 'producao';
  serie: string;
  rtcCalculadoraUrl?: string;
  nfseSefinUrl?: string;
  regimePadrao?: 'simples_nacional' | 'regime_regular';
  municipioIbge?: string;
  cnpjPrestador?: string;
  inscricaoMunicipal?: string;
  inscricaoEstadual?: string;
  modeloProdutoPadrao?: '65' | '55';
  cscId?: string;
  cscToken?: string;
  autoEmitirNfse?: boolean;
  autoEmitirNfeProduto?: boolean;
  autoImprimirNotinha?: boolean;
  larguraCupom?: '80mm' | '58mm';
  enderecoEmitente?: {
    logradouro: string;
    numero: string;
    bairro: string;
    cep: string;
    uf: string;
  };
}

export interface AppUser {
  id: string;
  nome: string;
  login: string;
  senha: string;
  cargo: 'Administrador' | 'Operador PDV' | 'Instalador / Equipe' | 'Instalador / Obra' | 'Financeiro';
  ativo: boolean;
}

export interface AuthUser {
  id: string;
  nome: string;
  login: string;
  cargo: AppUser['cargo'];
  ativo: boolean;
}

export type AlertSeverity = 'critico' | 'aviso' | 'info';
export type AlertCategory = 'estoque' | 'financeiro' | 'fiscal' | 'operacional';

export interface RealTimeAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  titulo: string;
  mensagem: string;
  referenciaId: string;
  referenciaNome: string;
  timestamp: string;
  targetPage: PageId;
  actionLabel: string;
  actionType: 'restock' | 'pay_duplicata' | 'open_nfe' | 'open_fiado';
}

export interface AlertEventLog {
  id: string;
  alertId: string;
  severity: AlertSeverity;
  titulo: string;
  mensagem: string;
  timestamp: string;
  lido: boolean;
}

export interface AlertSettings {
  diasAvisoDuplicata: number;
  percentualPreventivoEstoque: number; // e.g., 125% of minimum triggers preventive warning
  diasAlertaFiado: number;
  notificacoesEmTempoReal: boolean;
  monitoramentoAutomatico: boolean;
}

export interface ToastMessage {
  id: string;
  type: 'sucesso' | 'erro' | 'aviso' | 'info';
  title: string;
  description?: string;
}
