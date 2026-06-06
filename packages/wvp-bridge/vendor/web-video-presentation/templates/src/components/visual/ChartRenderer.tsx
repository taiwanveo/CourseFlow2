import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./ChartRenderer.css";

function looksLikeNarrationLeak(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.length > 48) return true;
  return /第一步|假設|百分之|口播|看完成率|資料顯示/i.test(t);
}

function safeSubtitle(subtitle?: string): string | undefined {
  if (!subtitle?.trim()) return undefined;
  return looksLikeNarrationLeak(subtitle) ? undefined : subtitle.trim();
}

export type ChartConfigProp = {
  kind: "chart";
  chartType: "bar" | "line" | "area" | "pie" | "kpi";
  title: string;
  subtitle?: string;
  xKey: string;
  yKey: string;
  data: Record<string, string | number>[];
  unit?: string;
  colorRole?: "sequential" | "categorical" | "highlight";
};

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function palette(role: ChartConfigProp["colorRole"]): string[] {
  const accent = cssVar("--accent", "#6366f1");
  const glow = cssVar("--accent-glow", "rgba(99,102,241,0.55)");
  const soft = cssVar("--accent-soft", "rgba(99,102,241,0.14)");
  const t2 = cssVar("--text-2", "#ccc");
  const mute = cssVar("--text-mute", "#888");
  const s3 = cssVar("--surface-3", "#444");
  if (role === "sequential") return [accent, glow, t2, mute];
  if (role === "highlight") return [accent, soft, mute, s3];
  return [accent, t2, glow, s3, mute];
}

export function ChartRenderer({ config }: { config: ChartConfigProp }) {
  const colors = palette(config.colorRole);
  const axis = cssVar("--text-mute", "#888");
  const grid = cssVar("--rule", "rgba(255,255,255,0.08)");
  const subtitle = safeSubtitle(config.subtitle);
  const textColor = cssVar("--text", "#eee");
  const formatLabel = (value: number | string): string => {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return String(value);
    if (config.unit === "%") return `${n}%`;
    if (config.unit === "萬") return `${n}萬`;
    return config.unit ? `${n}${config.unit}` : String(n);
  };

  if (config.chartType === "kpi") {
    const row = config.data[0] ?? {};
    const val = row[config.yKey] ?? row.value ?? "—";
    return (
      <div className="vf-chart vf-kpi">
        <div className="vf-kpi-value hero-num">{String(val)}{config.unit ?? ""}</div>
        <div className="vf-kpi-title serif-cn">{config.title}</div>
        {subtitle ? <p className="vf-sub">{subtitle}</p> : null}
      </div>
    );
  }

  const tooltipStyle = {
    background: cssVar("--surface-2", "#1a1a2e"),
    border: `1px solid ${cssVar("--rule", "#333")}`,
    borderRadius: 8,
    color: cssVar("--text", "#eee"),
    fontSize: 12,
  };

  const inner = () => {
    if (config.chartType === "pie") {
      return (
        <PieChart>
          <Pie
            data={config.data}
            dataKey={config.yKey}
            nameKey={config.xKey}
            cx="50%"
            cy="50%"
            outerRadius="72%"
            isAnimationActive
            animationDuration={800}
          >
            {config.data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      );
    }
    if (config.chartType === "line") {
      return (
        <LineChart data={config.data} margin={{ top: 28, right: 16, left: 4, bottom: 0 }}>
          <CartesianGrid stroke={grid} strokeDasharray="4 4" />
          <XAxis dataKey={config.xKey} tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} unit={config.unit} width={44} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey={config.yKey} stroke={colors[0]} strokeWidth={2.5} dot={{ r: 5, fill: colors[0] }} isAnimationActive animationDuration={900}>
            <LabelList
              dataKey={config.yKey}
              position="top"
              offset={14}
              formatter={(value) => formatLabel(value as number)}
              style={{ fill: textColor, fontSize: 14, fontWeight: 600 }}
            />
          </Line>
        </LineChart>
      );
    }
    if (config.chartType === "area") {
      return (
        <AreaChart data={config.data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={grid} strokeDasharray="4 4" />
          <XAxis dataKey={config.xKey} tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey={config.yKey} stroke={colors[0]} fill={colors[0]} fillOpacity={0.25} isAnimationActive animationDuration={900} />
        </AreaChart>
      );
    }
    return (
      <BarChart data={config.data} margin={{ top: 28, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid stroke={grid} strokeDasharray="4 4" />
        <XAxis dataKey={config.xKey} tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} unit={config.unit} width={44} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey={config.yKey} radius={[4, 4, 0, 0]} isAnimationActive animationDuration={900}>
          {config.data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
          <LabelList
            dataKey={config.yKey}
            position="top"
            offset={14}
            formatter={(value) => formatLabel(value as number)}
            style={{ fill: textColor, fontSize: 14, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    );
  };

  return (
    <div className="vf-chart">
      <h3 className="vf-title serif-cn">{config.title}</h3>
      {subtitle ? <p className="vf-sub">{subtitle}</p> : null}
      <div className="vf-chart-box">
        <ResponsiveContainer width="100%" height={260}>
          {inner()}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
