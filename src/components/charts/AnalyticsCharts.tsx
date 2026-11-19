import React, { useMemo, useState } from 'react';
import { BarChart2, TrendingUp } from 'lucide-react';
import { ObraWithdrawal, Product, Sale } from '../../types/erp';
import { formatBRL, formatDateBR, offsetDaysISO } from '../../utils/formatters';
import { ProductImage } from '../ui/ProductImage';

interface MiniSparklineProps {
  values: number[];
  color?: string;
  height?: number;
}

export const MiniSparkline: React.FC<MiniSparklineProps> = ({
  values,
  color = '#10B981',
  height = 34,
}) => {
  const gradId = useMemo(() => `spark-${Math.random().toString(36).slice(2, 8)}`, []);
  const pts = values.length > 1 ? values : [0, values[0] ?? 0];
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const w = 112;
  const h = height;
  const pad = 3;

  const coords = pts.map((v, i) => ({
    x: (i / (pts.length - 1)) * w,
    y: pad + (h - pad * 2) - ((v - min) / span) * (h - pad * 2),
  }));

  const linePath = coords.reduce((acc, pt, idx, arr) => {
    if (idx === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    const prev = arr[idx - 1];
    const cx = ((prev.x + pt.x) / 2).toFixed(1);
    return `${acc} C ${cx} ${prev.y.toFixed(1)}, ${cx} ${pt.y.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;
  const last = coords[coords.length - 1];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-28 overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r="2.4" fill={color} />
    </svg>
  );
};

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  return points.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    const prev = arr[i - 1];
    const cpX = ((prev.x + pt.x) / 2).toFixed(1);
    return `${acc} C ${cpX} ${prev.y.toFixed(1)}, ${cpX} ${pt.y.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');
}

interface RevenueVsCostChartProps {
  sales: Sale[];
  obras: ObraWithdrawal[];
}

export const RevenueVsCostChart: React.FC<RevenueVsCostChartProps> = ({ sales, obras }) => {
  const [days, setDays] = useState<7 | 15 | 30>(15);
  const [chartType, setChartType] = useState<'area' | 'bars'>('area');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const series = useMemo(() => {
    const map = new Map<string, { date: string; receita: number; custoEquipes: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const iso = offsetDaysISO(-i);
      map.set(iso, { date: iso, receita: 0, custoEquipes: 0 });
    }
    for (const s of sales) {
      if (s.status !== 'concluida') continue;
      const bucket = map.get(s.data.slice(0, 10));
      if (bucket) bucket.receita += s.total;
    }
    for (const o of obras) {
      const bucket = map.get(o.data.slice(0, 10));
      if (bucket) bucket.custoEquipes += o.custoTotal;
    }
    return Array.from(map.values());
  }, [days, obras, sales]);

  const totalReceita = series.reduce((a, b) => a + b.receita, 0);
  const totalEquipes = series.reduce((a, b) => a + b.custoEquipes, 0);
  const rawMax = Math.max(500, ...series.map((d) => Math.max(d.receita, d.custoEquipes)));
  const maxVal = Math.ceil(rawMax / 250) * 250;

  const width = 680;
  const height = 240;
  const padL = 52;
  const padR = 16;
  const padT = 16;
  const padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const getX = (idx: number) => {
    if (chartType === 'bars') {
      const step = plotW / Math.max(series.length, 1);
      return padL + step * idx + step / 2;
    }
    return series.length <= 1 ? padL : padL + (idx / (series.length - 1)) * plotW;
  };
  const getY = (val: number) => padT + plotH - (val / maxVal) * plotH;

  const receitaPts = series.map((d, i) => ({ x: getX(i), y: getY(d.receita) }));
  const equipesPts = series.map((d, i) => ({ x: getX(i), y: getY(d.custoEquipes) }));

  const receitaPath = buildSmoothPath(receitaPts);
  const equipesPath = buildSmoothPath(equipesPts);
  const receitaArea =
    receitaPts.length > 0
      ? `${receitaPath} L ${receitaPts[receitaPts.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${receitaPts[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : '';

  const hovered = hoveredIdx !== null ? series[hoveredIdx] : null;
  const slotW = plotW / Math.max(series.length, 1);
  const barW = Math.max(3, Math.min(14, slotW * 0.34));

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#F1F5F9] pb-4 dark:border-[#1E293B]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
              Receita Loja vs. Saída Equipes
            </h3>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-[#64748B] dark:text-[#94A3B8]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#10B981]" />
              Vendas ({days}d):{' '}
              <strong className="font-display tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                {formatBRL(totalReceita)}
              </strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
              Saída Equipes ({days}d):{' '}
              <strong className="font-display tabular-nums text-[#D97706] dark:text-[#FBBF24]">
                {formatBRL(totalEquipes)}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 dark:border-[#1E293B] dark:bg-[#0B1115]">
            <button
              type="button"
              onClick={() => setChartType('area')}
              title="Visualização em curva"
              className={`rounded-md p-1.5 transition-colors ${
                chartType === 'area'
                  ? 'bg-white text-[#0F172A] shadow-xs dark:bg-[#1E293B] dark:text-[#34D399]'
                  : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType('bars')}
              title="Visualização em colunas"
              className={`rounded-md p-1.5 transition-colors ${
                chartType === 'bars'
                  ? 'bg-white text-[#0F172A] shadow-xs dark:bg-[#1E293B] dark:text-[#34D399]'
                  : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8]'
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-0.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 dark:border-[#1E293B] dark:bg-[#0B1115]">
            {([7, 15, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  days === d
                    ? 'bg-white text-[#0F172A] shadow-xs dark:bg-[#1E293B] dark:text-[#F1F5F9]'
                    : 'text-[#64748B] hover:text-[#0F172A] dark:text-[#94A3B8] dark:hover:text-white'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        {hovered && hoveredIdx !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[180px] rounded-xl border border-[#334155] bg-[#0F172A] px-3 py-2 text-xs text-white shadow-xl"
            style={{
              left: `${Math.min(Math.max((getX(hoveredIdx) / width) * 100, 12), 68)}%`,
            }}
          >
            <div className="font-semibold text-[#CBD5E1]">{formatDateBR(hovered.date)}</div>
            <div className="mt-1 space-y-0.5 tabular-nums">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#34D399]">Vendas Loja</span>
                <span className="font-bold">{formatBRL(hovered.receita)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#FBBF24]">Saída Equipes</span>
                <span className="font-bold">{formatBRL(hovered.custoEquipes)}</span>
              </div>
            </div>
          </div>
        )}

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-60 w-full overflow-visible"
          role="img"
          aria-label="Gráfico de Receita Loja versus Saída Equipes"
        >
          <defs>
            <linearGradient id="receitaGradPro" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = padT + plotH - t * plotH;
            const val = maxVal * t;
            return (
              <g key={t}>
                <line
                  x1={padL}
                  y1={y}
                  x2={width - padR}
                  y2={y}
                  className="stroke-[#E2E8F0] dark:stroke-[#1E293B]"
                  strokeDasharray={t === 0 ? undefined : '4 4'}
                />
                <text
                  x={padL - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-[#64748B] text-[10px] font-medium tabular-nums dark:fill-[#64748B]"
                >
                  {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val)}
                </text>
              </g>
            );
          })}

          {chartType === 'area' ? (
            <>
              {receitaArea && <path d={receitaArea} fill="url(#receitaGradPro)" />}
              {receitaPath && (
                <path
                  d={receitaPath}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              )}
              {equipesPath && (
                <path
                  d={equipesPath}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                />
              )}
            </>
          ) : (
            series.map((d, i) => {
              const cx = getX(i);
              const hRec = Math.max(0, (d.receita / maxVal) * plotH);
              const hEq = Math.max(0, (d.custoEquipes / maxVal) * plotH);
              return (
                <g key={d.date}>
                  <rect
                    x={cx - barW - 1}
                    y={padT + plotH - hRec}
                    width={barW}
                    height={hRec}
                    rx="3"
                    fill="#10B981"
                    opacity={hoveredIdx === null || hoveredIdx === i ? 0.95 : 0.4}
                  />
                  <rect
                    x={cx + 1}
                    y={padT + plotH - hEq}
                    width={barW}
                    height={hEq}
                    rx="3"
                    fill="#F59E0B"
                    opacity={hoveredIdx === null || hoveredIdx === i ? 0.9 : 0.4}
                  />
                </g>
              );
            })
          )}

          {series.map((d, i) => {
            const x = getX(i);
            const showLabel =
              days === 7 || i === 0 || i === series.length - 1 || i % Math.ceil(days / 6) === 0;
            return (
              <g key={d.date}>
                {showLabel && (
                  <text
                    x={x}
                    y={height - 6}
                    textAnchor="middle"
                    className="fill-[#64748B] text-[10px] font-medium tabular-nums"
                  >
                    {d.date.slice(8, 10)}/{d.date.slice(5, 7)}
                  </text>
                )}
                {hoveredIdx === i && (
                  <>
                    <line
                      x1={x}
                      y1={padT}
                      x2={x}
                      y2={padT + plotH}
                      className="stroke-[#CBD5E1] dark:stroke-[#334155]"
                      strokeWidth="1"
                    />
                    {chartType === 'area' && (
                      <>
                        <circle
                          cx={x}
                          cy={getY(d.receita)}
                          r="4.5"
                          fill="#10B981"
                          stroke="#0B1115"
                          strokeWidth="2"
                        />
                        <circle
                          cx={x}
                          cy={getY(d.custoEquipes)}
                          r="4"
                          fill="#F59E0B"
                          stroke="#0B1115"
                          strokeWidth="2"
                        />
                      </>
                    )}
                  </>
                )}
                <rect
                  x={x - slotW / 2}
                  y={padT}
                  width={slotW}
                  height={plotH}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

interface CategoryStockChartProps {
  products: Product[];
}

const CAT_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#64748B'];

export const CategoryStockChart: React.FC<CategoryStockChartProps> = ({ products }) => {
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);

  const breakdown = useMemo(() => {
    const map = new Map<string, { category: string; valorCusto: number; valorVenda: number; skus: number }>();
    for (const p of products) {
      const curr = map.get(p.categoria) ?? {
        category: p.categoria,
        valorCusto: 0,
        valorVenda: 0,
        skus: 0,
      };
      curr.valorCusto += p.saldo * p.custo;
      curr.valorVenda += p.saldo * p.venda;
      curr.skus += 1;
      map.set(p.categoria, curr);
    }
    return Array.from(map.values()).sort((a, b) => b.valorCusto - a.valorCusto);
  }, [products]);

  const totalCost = breakdown.reduce((s, b) => s + b.valorCusto, 0);

  // Donut Geometry
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let offsetAccum = 0;

  const segments = breakdown.map((item, idx) => {
    const fraction = totalCost > 0 ? item.valorCusto / totalCost : 0;
    const dash = fraction * circumference;
    const gap = Math.min(3, circumference * 0.015);
    const segment = {
      ...item,
      pct: fraction * 100,
      color: CAT_COLORS[idx % CAT_COLORS.length],
      dashArray: `${Math.max(0, dash - (breakdown.length > 1 ? gap : 0))} ${circumference}`,
      dashOffset: -offsetAccum,
    };
    offsetAccum += dash;
    return segment;
  });

  const activeSeg = segments.find((s) => s.category === hoveredCat) ?? null;

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
      <div className="border-b border-[#F1F5F9] pb-4 dark:border-[#1E293B]">
        <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
          Capital por Categoria
        </h3>
        <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
          Distribuição do estoque a preço de custo
        </p>
      </div>

      {breakdown.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
          Sem produtos cadastrados.
        </div>
      ) : (
        <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
          <div className="relative h-40 w-40 shrink-0">
            <svg viewBox="0 0 144 144" className="h-full w-full -rotate-90">
              <circle
                cx="72"
                cy="72"
                r={radius}
                fill="none"
                strokeWidth="16"
                className="stroke-[#F1F5F9] dark:stroke-[#1E293B]"
              />
              {segments.map((seg) => (
                <circle
                  key={seg.category}
                  cx="72"
                  cy="72"
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={hoveredCat === seg.category ? 19 : 16}
                  strokeDasharray={seg.dashArray}
                  strokeDashoffset={seg.dashOffset}
                  strokeLinecap="butt"
                  className="cursor-pointer transition-all duration-200"
                  opacity={hoveredCat && hoveredCat !== seg.category ? 0.35 : 1}
                  onMouseEnter={() => setHoveredCat(seg.category)}
                  onMouseLeave={() => setHoveredCat(null)}
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
              <span className="max-w-[96px] truncate text-[10px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-[#94A3B8]">
                {activeSeg ? activeSeg.category : 'Total Custo'}
              </span>
              <span className="mt-0.5 font-display text-sm font-bold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                {formatBRL(activeSeg ? activeSeg.valorCusto : totalCost)}
              </span>
              {activeSeg && (
                <span className="text-[10px] font-semibold tabular-nums text-[#10B981]">
                  {activeSeg.pct.toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          <div className="w-full min-w-0 flex-1 space-y-2">
            {segments.map((seg) => (
              <div
                key={seg.category}
                onMouseEnter={() => setHoveredCat(seg.category)}
                onMouseLeave={() => setHoveredCat(null)}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                  hoveredCat === seg.category
                    ? 'bg-[#F8FAFC] dark:bg-[#16202A]'
                    : 'hover:bg-[#F8FAFC] dark:hover:bg-[#16202A]'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="truncate font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                    {seg.category}
                  </span>
                </div>
                <div className="shrink-0 font-semibold tabular-nums text-[#0F172A] dark:text-[#CBD5E1]">
                  {seg.pct.toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

interface TopMovedProductsChartProps {
  products: Product[];
  sales: Sale[];
  obras: ObraWithdrawal[];
}

export const TopMovedProductsChart: React.FC<TopMovedProductsChartProps> = ({
  products,
  sales,
  obras,
}) => {
  const productImgMap = useMemo(
    () => new Map(products.map((p) => [p.id, p.imagem])),
    [products]
  );

  const topItems = useMemo(() => {
    const map = new Map<
      string,
      { id: string; nome: string; unidade: string; qtdVenda: number; qtdEquipe: number; receita: number }
    >();
    for (const s of sales) {
      if (s.status !== 'concluida') continue;
      for (const it of s.itens) {
        const curr = map.get(it.produtoId) ?? {
          id: it.produtoId,
          nome: it.nome,
          unidade: it.unidade,
          qtdVenda: 0,
          qtdEquipe: 0,
          receita: 0,
        };
        curr.qtdVenda += it.quantidade;
        curr.receita += it.quantidade * it.precoUnitario;
        map.set(it.produtoId, curr);
      }
    }
    for (const o of obras) {
      for (const it of o.itens) {
        const curr = map.get(it.produtoId) ?? {
          id: it.produtoId,
          nome: it.nome,
          unidade: it.unidade,
          qtdVenda: 0,
          qtdEquipe: 0,
          receita: 0,
        };
        curr.qtdEquipe += it.quantidade;
        map.set(it.produtoId, curr);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.qtdVenda + b.qtdEquipe - (a.qtdVenda + a.qtdEquipe))
      .slice(0, 6);
  }, [obras, sales]);

  const maxTotal = Math.max(1, ...topItems.map((i) => i.qtdVenda + i.qtdEquipe));

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-4 dark:border-[#1E293B]">
        <div>
          <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
            Produtos de Maior Giro
          </h3>
          <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
            Volume movimentado em Loja e Saída Equipes
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#10B981]" /> Loja
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#F59E0B]" /> Equipes
          </span>
        </div>
      </div>

      {topItems.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
          Registre vendas ou saídas de equipes para visualizar o giro.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {topItems.map((item) => {
            const total = item.qtdVenda + item.qtdEquipe;
            const vendaPct = (item.qtdVenda / maxTotal) * 100;
            const eqPct = (item.qtdEquipe / maxTotal) * 100;
            return (
              <div key={item.id} className="flex items-center gap-3">
                <ProductImage
                  src={productImgMap.get(item.id)}
                  alt={item.nome}
                  sizeClass="h-9 w-9"
                  roundedClass="rounded-lg"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                      {item.nome}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-[#64748B] dark:text-[#94A3B8]">
                      {total} {item.unidade}
                    </span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#F1F5F9] dark:bg-[#1E293B]">
                    <div
                      className="h-full bg-[#10B981]"
                      style={{ width: `${vendaPct}%` }}
                      title={`Loja: ${item.qtdVenda}`}
                    />
                    <div
                      className="h-full bg-[#F59E0B]"
                      style={{ width: `${eqPct}%` }}
                      title={`Equipes: ${item.qtdEquipe}`}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface PaymentMixChartProps {
  sales: Sale[];
}

export const PaymentMixChart: React.FC<PaymentMixChartProps> = ({ sales }) => {
  const mix = useMemo(() => {
    const labels: Record<string, string> = {
      pix: 'PIX',
      dinheiro: 'Dinheiro',
      credito: 'Crédito',
      debito: 'Débito',
      fiado: 'Fiado',
    };
    const colors: Record<string, string> = {
      pix: '#10B981',
      dinheiro: '#3B82F6',
      credito: '#8B5CF6',
      debito: '#64748B',
      fiado: '#F59E0B',
    };
    const map = new Map<string, number>();
    for (const s of sales) {
      if (s.status !== 'concluida') continue;
      map.set(s.formaPagamento, (map.get(s.formaPagamento) ?? 0) + s.total);
    }
    const total = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return {
      total,
      items: Array.from(map.entries())
        .map(([key, val]) => ({
          key,
          label: labels[key] ?? key,
          val,
          pct: total > 0 ? (val / total) * 100 : 0,
          color: colors[key] ?? '#64748B',
        }))
        .sort((a, b) => b.val - a.val),
    };
  }, [sales]);

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 dark:border-[#1E293B] dark:bg-[#111820]">
      <div className="border-b border-[#F1F5F9] pb-4 dark:border-[#1E293B]">
        <h3 className="font-display text-sm font-bold text-[#0F172A] dark:text-[#F1F5F9]">
          Receita por Meio de Pagamento
        </h3>
        <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
          Faturamento acumulado:{' '}
          <strong className="font-display tabular-nums text-[#0F172A] dark:text-[#34D399]">
            {formatBRL(mix.total)}
          </strong>
        </p>
      </div>

      {mix.items.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#64748B] dark:text-[#94A3B8]">
          Sem vendas registradas.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#F1F5F9] dark:bg-[#1E293B]">
            {mix.items.map((item) => (
              <div
                key={item.key}
                style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                title={`${item.label}: ${formatBRL(item.val)} (${item.pct.toFixed(1)}%)`}
              />
            ))}
          </div>

          <div className="divide-y divide-[#F1F5F9] dark:divide-[#1E293B]">
            {mix.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between py-2.5 text-xs">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
                    {item.label}
                  </span>
                </div>
                <div className="font-semibold tabular-nums text-[#0F172A] dark:text-[#F1F5F9]">
                  {formatBRL(item.val)}{' '}
                  <span className="font-normal text-[#64748B] dark:text-[#94A3B8]">
                    ({item.pct.toFixed(0)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
