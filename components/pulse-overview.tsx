"use client";

import { SkincareSummary } from "./skincare-summary";
import { RhythmCard } from "./rhythm";

import { useId, type ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronRight,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  GitBranch,
  GitCommitHorizontal,
  GitPullRequest,
  Heart,
  Layers3,
  Moon,
  Plus,
  Radio,
  Timer,
  Waves,
  type LucideIcon,
} from "lucide-react";
import type { KernelAction, KernelState, Section, Sheet } from "@/types/kernel";
import type { HealthMetric, HealthSnapshot } from "@/lib/health";
import type { useHealth } from "@/lib/use-health";
import { useFocusTimer } from "@/lib/use-focus-timer";
import type { useGithub } from "@/lib/use-github";
import { summarizeGithubEvents } from "@/lib/github";
import { EXERCISES, HABITS, calories } from "@/lib/mock-engine";
import { nextStep, summarizeDay, weekOf } from "@/lib/metrics";

export interface PulseOverviewProps {
  state: KernelState;
  act: (action: KernelAction) => void;
  open: (sheet: Sheet) => void;
  health: ReturnType<typeof useHealth>;
  github: ReturnType<typeof useGithub>;
  onSources: () => void;
  onTimer: () => void;
  go: (section: Section) => void;
}

const NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const PREVIEW: Record<HealthMetric, { value: number; values: number[] }> = {
  sleepHours: { value: 7.7, values: [6.9, 7.1, 6.4, 7.6, 7.2, 7.4, 7.7] },
  restingHeartRate: { value: 54, values: [58, 57, 59, 56, 55, 56, 54] },
  heartRate: { value: 62, values: [61, 64, 62, 60, 63, 61, 62] },
  hrvMs: { value: 63, values: [48, 54, 49, 59, 55, 61, 63] },
  steps: { value: 8420, values: [6430, 7810, 5300, 9150, 7200, 10300, 8420] },
  activeCalories: { value: 620, values: [410, 540, 380, 690, 490, 760, 620] },
  weightKg: { value: 76.4, values: [76.8, 76.7, 76.9, 76.6, 76.7, 76.5, 76.4] },
  walkingRunningKm: { value: 5.8, values: [4.5, 5.3, 3.7, 6.2, 5.1, 7, 5.8] },
};
const METRICS: {
  id: HealthMetric;
  title: string;
  unit: string;
  icon: LucideIcon;
  tone: string;
}[] = [
  {
    id: "heartRate",
    title: "Última FC",
    unit: "bpm",
    icon: Heart,
    tone: "blue",
  },
  {
    id: "restingHeartRate",
    title: "FC em repouso",
    unit: "bpm",
    icon: Heart,
    tone: "coral",
  },
  {
    id: "hrvMs",
    title: "Variabilidade",
    unit: "ms",
    icon: Waves,
    tone: "lilac",
  },
  {
    id: "steps",
    title: "Passos",
    unit: "passos",
    icon: Footprints,
    tone: "lime",
  },
  {
    id: "activeCalories",
    title: "Energia ativa",
    unit: "kcal",
    icon: Flame,
    tone: "amber",
  },
  { id: "weightKg", title: "Peso", unit: "kg", icon: Activity, tone: "blue" },
];
function dayDate(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 12);
}
function shortDay(day: string) {
  return dayDate(day).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}
function duration(hours: number) {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}
function valueText(id: HealthMetric, value: number | null) {
  return value === null
    ? "—"
    : id === "sleepHours"
      ? duration(value)
      : NUMBER.format(value);
}
function series(
  snapshot: HealthSnapshot | null,
  id: HealthMetric,
  preview: boolean,
  anchor: string,
): (number | null)[] {
  if (preview) return PREVIEW[id].values;
  if (!snapshot) return Array(7).fill(null);
  const date = dayDate(anchor);
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(date);
    current.setDate(date.getDate() - (6 - index));
    const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    return (
      snapshot.history.find((day) => day.day === key)?.metrics[id].value ?? null
    );
  });
}
function Sparkline({
  values,
  tone = "lime",
  large = false,
}: {
  values: (number | null)[];
  tone?: string;
  large?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const available = values.filter((value): value is number => value !== null);
  const low = available.length ? Math.min(...available) : 0;
  const high = available.length ? Math.max(...available) : 1;
  const span = Math.max(high - low, Math.abs(high) * 0.12, 1);
  const width = 300,
    height = large ? 112 : 46,
    pad = large ? 12 : 6;
  const points = values.map((value, index) =>
    value === null
      ? null
      : {
          x: pad + index * ((width - pad * 2) / Math.max(1, values.length - 1)),
          y: height - pad - ((value - low) / span) * (height - pad * 2),
        },
  );
  const segments: string[] = [];
  let current = "";
  points.forEach((point) => {
    if (point) current += `${current ? " L" : "M"}${point.x},${point.y}`;
    else if (current) {
      segments.push(current);
      current = "";
    }
  });
  if (current) segments.push(current);
  const last = points.at(-1);
  return (
    <svg
      className={`kp-sparkline kp-tone-${tone} ${large ? "kp-sparkline-large" : ""}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity=".22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {large &&
        [0.2, 0.6, 1].map((line) => (
          <line
            key={line}
            x1="0"
            x2={width}
            y1={(height - pad) * line}
            y2={(height - pad) * line}
            className="kp-chart-grid"
          />
        ))}
      {available.length < 2 ? (
        <path
          d={`M${pad},${height / 2} H${width - pad}`}
          className="kp-chart-empty"
        />
      ) : (
        segments.map((path, index) => (
          <g key={index}>
            {large && (
              <path
                d={`${path} L${points.filter((point) => point !== null).at(-1)?.x ?? width - pad},${height} L${points.find((point) => point !== null)?.x ?? pad},${height} Z`}
                fill={`url(#${id})`}
                stroke="none"
              />
            )}
            <path d={path} className="kp-chart-line" />
          </g>
        ))
      )}
      {last && available.length > 1 && (
        <circle
          cx={last.x}
          cy={last.y}
          r={large ? 3.5 : 2.5}
          fill="currentColor"
        />
      )}
    </svg>
  );
}
function CardTitle({
  icon: Icon,
  children,
  meta,
}: {
  icon: LucideIcon;
  children: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="kp-card-title">
      <span>
        <Icon size={17} strokeWidth={1.5} />
        {children}
      </span>
      {meta && <div className="kp-card-meta">{meta}</div>}
    </div>
  );
}
function TextAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="kp-text-action" onClick={onClick}>
      <span>{children}</span>
      <ArrowUpRight size={17} strokeWidth={1.5} />
    </button>
  );
}
function NextStepCard({
  state,
  act,
  open,
  onTimer,
}: Pick<PulseOverviewProps, "state" | "act" | "open" | "onTimer">) {
  const step = nextStep(state);
  return (
    <section className="kp-card kp-next" aria-label="Próximo passo">
      <div className="kp-next-copy">
        <span className="kp-overline">PRÓXIMO PASSO</span>
        <h2>{step.title}</h2>
        <p>{step.detail}</p>
      </div>
      <button
        className="kp-primary-button kp-next-primary"
        onClick={() => open(step.sheet)}
        aria-label={`Próximo passo: ${step.label}`}
      >
        {step.label}
        <ArrowUpRight size={17} strokeWidth={1.5} />
      </button>
      <div
        className="kp-next-quick"
        role="group"
        aria-label="Atalhos de registro"
      >
        <button
          onClick={() => act({ type: "water", amount: 250 })}
          disabled={state.waterMl >= 10000}
          aria-label="Atalho: +250 ml de água"
        >
          <Droplets size={15} strokeWidth={1.5} />
          +250 ml
        </button>
        <button onClick={() => open("nutrition")} aria-label="Atalho: refeição">
          <Flame size={15} strokeWidth={1.5} />
          Refeição
        </button>
        <button onClick={onTimer} aria-label="Atalho: foco com cronômetro">
          <Timer size={15} strokeWidth={1.5} />
          Foco
        </button>
        <button
          onClick={() => open("routine")}
          aria-label="Atalho: armário de skincare"
        >
          <Check size={15} strokeWidth={1.5} />
          Skincare
        </button>
      </div>
    </section>
  );
}
export function HealthCard({
  state,
  health,
  onSources,
}: Pick<PulseOverviewProps, "state" | "health" | "onSources">) {
  const snapshot = health.snapshot;
  const preview = !snapshot && state.mode === "demo";
  const anchor = snapshot?.latestDay ?? state.day;
  const sleepDay = snapshot?.metrics.sleepHours.day;
  const sleep =
    snapshot?.metrics.sleepHours.value ??
    (preview ? PREVIEW.sleepHours.value : null);
  const available = snapshot
    ? Object.values(snapshot.metrics).filter((metric) => metric.value !== null)
        .length
    : 0;
  const source = preview
    ? "Prévia ilustrativa"
    : snapshot
      ? `${available}/8 medidas · XML local`
      : "Aguardando uma fonte";
  return (
    <section
      className="kp-card kp-health-card"
      aria-label={
        preview ? "Panorama de saúde ilustrativo" : "Panorama de saúde"
      }
    >
      <CardTitle
        icon={Activity}
        meta={
          <span className={preview ? "kp-preview-tag" : "kp-source-tag"}>
            {preview && <span className="kp-dot" />}
            {source}
          </span>
        }
      >
        Corpo, em perspectiva
      </CardTitle>
      <div className="kp-health-lead">
        <div>
          <span className="kp-overline">
            ÚLTIMO DESCANSO {sleepDay ? `· ${shortDay(sleepDay)}` : ""}
          </span>
          <div className="kp-sleep-value">
            {sleep === null ? (
              <span className="kp-missing">—</span>
            ) : (
              duration(sleep)
            )}
          </div>
          <p>
            {sleep === null
              ? "O que não chegou permanece em aberto."
              : "Uma medida. O contexto está na sua história."}
          </p>
        </div>
        <div className="kp-health-orbit" aria-hidden="true">
          <span className="kp-orbit-ring kp-orbit-one" />
          <span className="kp-orbit-ring kp-orbit-two" />
          <Moon size={31} strokeWidth={1.1} />
          <span className="kp-orbit-point" />
        </div>
      </div>
      <div
        className="kp-sleep-chart"
        role="img"
        aria-label={
          preview
            ? "Prévia ilustrativa de sete noites de sono"
            : `Sono nos últimos sete dias do arquivo: ${series(
                snapshot,
                "sleepHours",
                preview,
                anchor,
              )
                .map((value) =>
                  value === null ? "sem registro" : duration(value),
                )
                .join(", ")}`
        }
      >
        <Sparkline
          values={series(snapshot, "sleepHours", preview, anchor)}
          tone="blue"
          large
        />
        <div className="kp-chart-caption">
          <span>
            {preview ? "7 noites · exemplo" : "7 dias · lacunas preservadas"}
          </span>
          <span>
            {snapshot
              ? `Até ${shortDay(anchor)}`
              : preview
                ? "SEM DADOS PESSOAIS"
                : "SEM AMOSTRAS"}
          </span>
        </div>
      </div>
      <div className="kp-metrics-grid">
        {METRICS.map(({ id, title, unit, icon: Icon, tone }) => {
          const reading = snapshot?.metrics[id];
          const value = reading?.value ?? (preview ? PREVIEW[id].value : null);
          const sourceText = preview
            ? "Prévia ilustrativa"
            : value === null
              ? "Sem registro"
              : `${reading?.source} · ${shortDay(reading!.day!)}`;
          return (
            <button
              className={`kp-metric kp-tone-${tone}`}
              key={id}
              onClick={onSources}
              aria-label={`${title}: ${valueText(id, value)} ${id === "sleepHours" ? "" : unit}. ${sourceText}. Ver fontes.`}
            >
              <div className="kp-metric-label">
                <Icon size={14} strokeWidth={1.5} />
                <span>{title}</span>
                <ArrowUpRight size={12} />
              </div>
              <div className="kp-metric-number">
                {valueText(id, value)}
                {value !== null && id !== "sleepHours" && <small>{unit}</small>}
              </div>
              <Sparkline
                values={series(snapshot, id, preview, anchor)}
                tone={tone}
              />
              <span className="kp-metric-source" title={sourceText}>
                {sourceText}
              </span>
            </button>
          );
        })}
      </div>
      <TextAction onClick={onSources}>
        {snapshot ? "Abrir origem e cobertura" : "Adicionar uma fonte de saúde"}
      </TextAction>
    </section>
  );
}
export function ContextCard({
  state,
  health,
  github,
  open,
  onSources,
}: Pick<
  PulseOverviewProps,
  "state" | "health" | "github" | "open" | "onSources"
>) {
  const snapshot = health.snapshot;
  const sleep = snapshot?.metrics.sleepHours;
  const resting = snapshot?.metrics.restingHeartRate;
  const previous = resting?.day
    ? snapshot!.history
        .filter(
          (day) =>
            day.day < resting.day! &&
            day.metrics.restingHeartRate.value !== null,
        )
        .slice(-7)
    : [];
  const baseline =
    previous.length >= 3
      ? previous.reduce(
          (sum, day) => sum + day.metrics.restingHeartRate.value!,
          0,
        ) / previous.length
      : null;
  const difference =
    baseline !== null && resting?.value !== null
      ? Math.round(resting!.value! - baseline)
      : null;
  const summary = summarizeDay(state);
  const preview = state.mode === "demo" && !snapshot;
  const notes = [
    sleep?.value != null
      ? {
          title:
            sleep.value >= state.targets.sleepHours
              ? "Sua meta de sono foi alcançada."
              : `${duration(state.targets.sleepHours - sleep.value)} até a meta de sono.`,
          text: `${duration(sleep.value)} no registro de ${shortDay(sleep.day!)}. Sua meta pessoal é ${duration(state.targets.sleepHours)}.`,
          meta: `${sleep.source} · comparação com sua meta`,
          tone: "blue",
        }
      : {
          title: preview
            ? "Menos lacunas. Mais contexto."
            : "Sua história começa pela fonte.",
          text: preview
            ? "Esta prévia mostra como o panorama pode reunir sinais de fontes diferentes. Nenhuma medida é sua."
            : "Importe um arquivo de saúde para reunir as medidas disponíveis. As demais continuam vazias.",
          meta: preview
            ? "Prévia ilustrativa · dados fictícios"
            : "Cobertura parcial é suficiente para começar",
          tone: "blue",
        },
    difference !== null
      ? {
          title:
            difference === 0
              ? "Repouso próximo à sua referência."
              : `${difference > 0 ? "+" : ""}${difference} bpm na FC em repouso.`,
          text: `Último valor comparado à média de ${previous.length} registros anteriores. Uma observação dos dados, sem diagnóstico.`,
          meta: `${previous.length} registros · média ${Math.round(baseline!)} bpm`,
          tone: "coral",
        }
      : {
          title: "Tendência precisa de história.",
          text: snapshot
            ? "A comparação de FC em repouso aparece após pelo menos três registros anteriores válidos."
            : "As linhas ganham significado com medidas reais ao longo dos dias.",
          meta: preview
            ? "Exemplo visual · não é análise pessoal"
            : "Sem comparação inventada",
          tone: "lilac",
        },
    {
      title: summary.focusMinutes
        ? `${summary.focusMinutes} minutos com direção.`
        : "Deixe o tempo trabalhar a seu favor.",
      text: summary.focusMinutes
        ? `${summary.studyMinutes} min de estudo e ${summary.focusMinutes - summary.studyMinutes} min de projeto registrados hoje.`
        : "Inicie um bloco de foco. O cronômetro mede o tempo; você registra o que avançou.",
      meta: github.snapshot
        ? `GitHub conectado · @${github.snapshot.username}`
        : "Foco e aprendizado · registros do app",
      tone: "lime",
    },
  ];
  return (
    <section className="kp-card kp-context-card" aria-label="Leitura do dia">
      <CardTitle icon={Layers3} meta={<span className="kp-small-dot" />}>
        Leitura do dia
      </CardTitle>
      <h2>
        O número conta.
        <br />
        <span>O contexto orienta.</span>
      </h2>
      <div className="kp-context-notes">
        {notes.map((note, index) => (
          <div
            className={`kp-context-note kp-tone-${note.tone}`}
            key={note.title}
          >
            <span className="kp-note-index">0{index + 1}</span>
            <div>
              <h3>{note.title}</h3>
              <p>{note.text}</p>
              <small>{note.meta}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="kp-context-actions">
        <button onClick={() => open("checkin")}>
          <Heart size={15} strokeWidth={1.5} />
          {state.checkin ? "Revisar meu check-in" : "Fazer meu check-in"}
          <ChevronRight size={15} />
        </button>
        <button onClick={onSources}>
          Ver minhas fontes
          <ArrowUpRight size={14} />
        </button>
      </div>
    </section>
  );
}
export function EngineeringCard({
  state,
  github,
  onSources,
}: Pick<PulseOverviewProps, "state" | "github" | "onSources">) {
  const snapshot = github.snapshot;
  const preview = !snapshot && !github.username && state.mode === "demo";
  const summary = snapshot
    ? summarizeGithubEvents(snapshot.events, dayDate(state.day))
    : null;
  const counts =
    summary?.contributions ??
    Array.from({ length: 7 }, (_, index) => {
      const date = dayDate(state.day);
      date.setDate(date.getDate() - (6 - index));
      return {
        day: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
        count: preview ? [1, 3, 0, 4, 2, 7, 3][index] : 0,
      };
    });
  const max = Math.max(1, ...counts.map((day) => day.count));
  const statistics = summary?.statisticsToday;
  const values = [
    statistics?.pushes ?? (preview ? 3 : null),
    statistics?.mergedPRs ?? (preview ? 1 : null),
    statistics?.releases ?? (preview ? 0 : null),
  ];
  const events =
    snapshot?.events.slice(0, 2) ??
    (preview
      ? [
          {
            id: "preview-event-a",
            type: "push",
            title: "Fluxo de conexão de fontes",
            repository: "kernelhub / interface",
            at: "",
            url: "",
          },
          {
            id: "preview-event-b",
            type: "pull-request",
            title: "Revisão do panorama diário",
            repository: "kernelhub / dados",
            at: "",
            url: "",
          },
        ]
      : []);
  return (
    <section
      className="kp-card kp-engineering-card"
      aria-label="Atividade de engenharia"
    >
      <CardTitle
        icon={GitBranch}
        meta={
          <span className={preview ? "kp-preview-tag" : "kp-source-tag"}>
            {preview
              ? "Prévia ilustrativa"
              : snapshot
                ? `@${snapshot.username}`
                : "SEM CONEXÃO"}
          </span>
        }
      >
        Construindo, todos os dias
      </CardTitle>
      <div className="kp-code-stats">
        {["Pushes hoje", "PRs integrados", "Releases"].map((label, index) => (
          <div key={label}>
            <strong>{values[index] === null ? "—" : values[index]}</strong>
            <span>{label}</span>
          </div>
        ))}
        <div className="kp-code-source">
          <span
            className={`kp-dot ${github.status === "live" ? "kp-dot-live" : ""}`}
          />
          <span>
            {preview
              ? "ATIVIDADE DE EXEMPLO"
              : github.status === "loading"
                ? "ATUALIZANDO"
                : github.status === "live"
                  ? "LEITURA AUTOMÁTICA"
                  : snapshot
                    ? "ÚLTIMA LEITURA SALVA"
                    : "AGUARDANDO GITHUB"}
          </span>
        </div>
      </div>
      <div
        className="kp-git-chart"
        role="img"
        aria-label={
          preview
            ? "Prévia ilustrativa de atividade em sete dias"
            : snapshot
              ? `Eventos públicos: ${counts.map((day) => `${shortDay(day.day)}: ${day.count}`).join(", ")}`
              : "Sem atividade recebida do GitHub"
        }
      >
        {counts.map((day, index) => (
          <div key={day.day} className={index === 6 ? "kp-bar-today" : ""}>
            <span>{snapshot || preview ? day.count : "—"}</span>
            <div className="kp-git-track">
              {snapshot || preview ? (
                <i
                  style={{
                    height: `${day.count ? Math.max(5, (day.count / max) * 100) : 2}%`,
                  }}
                  className={day.count ? "kp-bar-filled" : "kp-bar-zero"}
                />
              ) : (
                <i className="kp-bar-absent" />
              )}
            </div>
            <small>
              {dayDate(day.day)
                .toLocaleDateString("pt-BR", { weekday: "short" })
                .replace(".", "")}
            </small>
          </div>
        ))}
      </div>
      <div className="kp-git-legend">
        <span>
          <i />
          {preview ? "Eventos fictícios · 7 dias" : "Eventos públicos · 7 dias"}
        </span>
        <span>Pushes não são commits ou deploys.</span>
      </div>
      <div className="kp-git-events">
        {events.length ? (
          events.map((event) => (
            <div key={event.id}>
              {event.type === "pull-request" ? (
                <GitPullRequest size={16} strokeWidth={1.5} />
              ) : (
                <GitCommitHorizontal size={16} strokeWidth={1.5} />
              )}
              <span>
                <strong>{event.title}</strong>
                <small>{event.repository}</small>
              </span>
              {event.url ? (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir ${event.title} no GitHub`}
                >
                  <ArrowUpRight size={16} />
                </a>
              ) : (
                <span className="kp-event-demo">EXEMPLO</span>
              )}
            </div>
          ))
        ) : (
          <p>
            Conecte um perfil público. O app atualiza a leitura sem pedir que
            você conte suas entregas.
          </p>
        )}
      </div>
      <TextAction onClick={onSources}>
        {snapshot ? "Abrir conexão e atividade" : "Conectar GitHub"}
      </TextAction>
    </section>
  );
}
export function FocusCard({
  state,
  onTimer,
  open,
}: Pick<PulseOverviewProps, "state" | "onTimer" | "open">) {
  const timer = useFocusTimer({ targetMinutes: state.targets.focusMinutes });
  const active = timer.status !== "idle";
  const elapsed = `${String(Math.floor(timer.elapsedSeconds / 60)).padStart(2, "0")}:${String(timer.elapsedSeconds % 60).padStart(2, "0")}`;
  const summary = summarizeDay(state);
  const days = weekOf(state);
  const maximum = Math.max(
    state.targets.focusMinutes,
    ...days.map((day) => day?.focusMinutes ?? 0),
  );
  return (
    <section className="kp-card kp-focus-card" aria-label="Tempo de foco">
      <CardTitle icon={Timer} meta="HOJE">
        Foco com presença
      </CardTitle>
      <div className="kp-focus-total">
        <strong>{active ? elapsed : summary.focusMinutes}</strong>
        <span>
          {active
            ? timer.status === "paused"
              ? "em pausa"
              : "em andamento"
            : "minutos"}
          <br />
          {active ? "bloco atual" : "registrados"}
        </span>
      </div>
      <p className="kp-muted-copy">
        Seu tempo de projeto e estudo, no mesmo lugar.
      </p>
      <div
        className="kp-focus-week"
        role="img"
        aria-label={`Foco nos últimos sete dias: ${days.map((day) => (day ? `${day.day}: ${day.focusMinutes} minutos` : "sem registro")).join("; ")}`}
      >
        {days.map((day, index) => (
          <div key={index}>
            <span>{day?.focusMinutes ? `${day.focusMinutes}m` : "—"}</span>
            <div>
              <i
                style={{
                  height: `${Math.max(2, ((day?.focusMinutes ?? 0) / maximum) * 100)}%`,
                }}
                className={
                  index === 6
                    ? "kp-focus-today"
                    : day
                      ? "kp-focus-record"
                      : "kp-focus-empty"
                }
              />
            </div>
          </div>
        ))}
      </div>
      <div className="kp-focus-caption">
        <span>
          {state.mode === "demo"
            ? "Histórico de exemplo"
            : "Seus últimos 7 dias"}
        </span>
        <span>Meta {state.targets.focusMinutes} min</span>
      </div>
      <button className="kp-primary-button" onClick={onTimer}>
        <Timer size={17} strokeWidth={1.5} />
        {active ? "Abrir meu cronômetro" : "Iniciar foco"}
        <ArrowUpRight size={17} />
      </button>
      {state.focusSessions.length > 0 && (
        <div className="kp-last-focus">
          <span>ÚLTIMO BLOCO</span>
          <strong>
            {state.focusSessions.at(-1)!.outcome ||
              (state.focusSessions.at(-1)!.category === "study"
                ? "Estudo"
                : "Projeto")}
          </strong>
          <small>
            {state.focusSessions.at(-1)!.minutes} minutos concluídos
          </small>
        </div>
      )}
      <TextAction onClick={() => open("focus")}>
        Registrar bloco de foco
      </TextAction>
    </section>
  );
}
export function NutritionCard({
  state,
  act,
  open,
}: Pick<PulseOverviewProps, "state" | "act" | "open">) {
  const macros = state.nutrition;
  const kcal = calories(macros);
  const target = calories(state.targets.macros);
  return (
    <section
      className="kp-card kp-nutrition-card"
      aria-label="Nutrição e hidratação"
    >
      <CardTitle icon={Flame} meta="REGISTRO DO APP">
        Combustível diário
      </CardTitle>
      <div className="kp-nutrition-value">
        <strong>{NUMBER.format(kcal)}</strong>
        <span>
          kcal<small>de {NUMBER.format(target)}</small>
        </span>
      </div>
      <div
        className="kp-macro-track"
        role="img"
        aria-label={`Proteína ${macros.protein} gramas, carboidrato ${macros.carbs} gramas, gordura ${macros.fat} gramas`}
      >
        <i style={{ flex: macros.protein * 4 }} />
        <i style={{ flex: macros.carbs * 4 }} />
        <i style={{ flex: macros.fat * 9 }} />
      </div>
      <div className="kp-macro-legend">
        {[
          { key: "protein", title: "Proteína" },
          { key: "carbs", title: "Carbo" },
          { key: "fat", title: "Gordura" },
        ].map(({ key, title }) => (
          <div key={key}>
            <span>{title}</span>
            <strong>
              {macros[key as keyof typeof macros]}
              <small>g</small>
            </strong>
          </div>
        ))}
      </div>
      <div className="kp-water">
        <span className="kp-water-icon">
          <Droplets size={21} strokeWidth={1.5} />
        </span>
        <div>
          <span>Hidratação</span>
          <strong>
            {(state.waterMl / 1000).toLocaleString("pt-BR", {
              maximumFractionDigits: 2,
            })}
            <small>
              {" "}
              /{" "}
              {(state.targets.waterMl / 1000).toLocaleString("pt-BR", {
                maximumFractionDigits: 2,
              })}{" "}
              L
            </small>
          </strong>
        </div>
        <div className="kp-water-pills" aria-hidden="true">
          {Array.from(
            { length: Math.min(16, Math.ceil(state.targets.waterMl / 250)) },
            (_, index) => (
              <i
                key={index}
                className={
                  state.waterMl >=
                  ((index + 1) * state.targets.waterMl) /
                    Math.min(16, Math.ceil(state.targets.waterMl / 250))
                    ? "is-full"
                    : ""
                }
              />
            ),
          )}
        </div>
        <button
          onClick={() => act({ type: "water", amount: 250 })}
          disabled={state.waterMl >= 10000}
          aria-label="Adicionar 250 ml de água"
        >
          <Plus size={16} />
          250 ml
        </button>
      </div>
      <TextAction onClick={() => open("nutrition")}>
        Registrar refeição
      </TextAction>
    </section>
  );
}
export function RoutineCard({
  state,
  act,
  open,
}: Pick<PulseOverviewProps, "state" | "act" | "open">) {
  const careHabits = HABITS.filter(
    (habit) => habit.id === "supplements" || habit.id === "grooming",
  );
  const count = careHabits.filter((habit) => state.habits[habit.id]).length;
  return (
    <section className="kp-card kp-routine-card" aria-label="Rotina de cuidado">
      <CardTitle icon={Check} meta={`${count}/${careHabits.length}`}>
        O cuidado, na prática
      </CardTitle>
      <SkincareSummary onOpen={() => open("routine")} />
      <div className="kp-routine-list">
        {careHabits.map((habit) => (
          <button
            className={
              state.habits[habit.id] ? "kp-habit kp-habit-done" : "kp-habit"
            }
            key={habit.id}
            role="checkbox"
            aria-checked={state.habits[habit.id]}
            aria-label={habit.title}
            onClick={() => act({ type: "habit", id: habit.id })}
          >
            <span className="kp-habit-check">
              {state.habits[habit.id] && <Check size={13} strokeWidth={2.2} />}
            </span>
            <span>
              <strong>{habit.title}</strong>
              <small>
                {habit.period === "morning"
                  ? "Manhã"
                  : habit.period === "evening"
                    ? "Noite"
                    : "Ao longo do dia"}
              </small>
            </span>
          </button>
        ))}
      </div>
      <TextAction onClick={() => open("routine")}>
        Abrir meus cuidados
      </TextAction>
    </section>
  );
}
function SourcesButton({
  connected,
  onSources,
}: {
  connected: number;
  onSources: () => void;
}) {
  return (
    <button
      className="kp-sources-button"
      onClick={onSources}
      aria-label="Fontes e conexões"
    >
      <Radio size={17} strokeWidth={1.5} />
      <span>
        Fontes & conexões
        <small>
          {connected
            ? `${connected} fonte${connected === 1 ? "" : "s"} com dados`
            : "Reúna os sinais do seu dia"}
        </small>
      </span>
      <ArrowUpRight size={16} />
    </button>
  );
}

/** Same large title on every page, like the Apple apps: where am I, what is this for. */
export function PageHeading({
  eyebrow,
  title,
  detail,
  connected,
  onSources,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  connected: number;
  onSources: () => void;
}) {
  return (
    <header className="kp-page-heading">
      <div>
        <p className="kp-page-date">{eyebrow}</p>
        <h1>{title}</h1>
        {detail && <p className="kp-page-detail">{detail}</p>}
      </div>
      <SourcesButton connected={connected} onSources={onSources} />
    </header>
  );
}

function ChecklistRow({
  done,
  title,
  detail,
  label,
  onClick,
  trailing,
  icon: Icon,
}: {
  done: boolean;
  title: string;
  detail: string;
  label: string;
  onClick: () => void;
  trailing?: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <li className={`kp-row ${done ? "is-done" : ""}`}>
      <button className="kp-row-main" onClick={onClick} aria-label={label}>
        <span className="kp-row-dot" aria-hidden="true">
          {done ? (
            <Check size={14} strokeWidth={2.4} />
          ) : (
            <Icon size={15} strokeWidth={1.6} />
          )}
        </span>
        <span className="kp-row-text">
          <strong>{title}</strong>
          <small>{detail}</small>
        </span>
        {!trailing && <ChevronRight size={16} aria-hidden="true" />}
      </button>
      {trailing}
    </li>
  );
}

/** Everything that still needs a decision today, in one list, in the order of a day. */
function TodayChecklist({
  state,
  act,
  open,
  onTimer,
}: Pick<PulseOverviewProps, "state" | "act" | "open" | "onTimer">) {
  const timer = useFocusTimer({ targetMinutes: state.targets.focusMinutes });
  const summary = summarizeDay(state);
  const sets = EXERCISES.reduce(
    (sum, exercise) => sum + (state.exercises[exercise.id] ?? 0),
    0,
  );
  const totalSets = EXERCISES.reduce((sum, exercise) => sum + exercise.sets, 0);
  const kcal = calories(state.nutrition);
  const kcalTarget = calories(state.targets.macros);
  const habits = HABITS.filter(
    (habit) => habit.id === "supplements" || habit.id === "grooming",
  );
  const timerActive = timer.status !== "idle";
  const doneCount =
    Number(Boolean(state.checkin)) +
    Number(state.waterMl >= state.targets.waterMl) +
    Number(kcal >= kcalTarget * 0.9) +
    Number(sets === totalSets) +
    Number(summary.focusMinutes >= state.targets.focusMinutes) +
    habits.filter((habit) => state.habits[habit.id]).length;
  const total = 5 + habits.length;
  return (
    <section className="kp-card kp-checklist" aria-label="Checklist de hoje">
      <CardTitle icon={Check} meta={`${doneCount}/${total}`}>
        Para hoje
      </CardTitle>
      <ul className="kp-rows">
        <ChecklistRow
          icon={Heart}
          done={Boolean(state.checkin)}
          title="Check-in"
          detail={
            state.checkin
              ? `Energia ${state.checkin.energy}/5 · humor ${state.checkin.mood}/5`
              : "Energia, humor e descanso"
          }
          label={state.checkin ? "Revisar meu check-in" : "Fazer meu check-in"}
          onClick={() => open("checkin")}
        />
        <ChecklistRow
          icon={Droplets}
          done={state.waterMl >= state.targets.waterMl}
          title="Água"
          detail={`${(state.waterMl / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} / ${(state.targets.waterMl / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L`}
          label="Hidratação"
          onClick={() => open("nutrition")}
          trailing={
            <button
              className="kp-row-action"
              onClick={() => act({ type: "water", amount: 250 })}
              disabled={state.waterMl >= 10000}
              aria-label="Adicionar 250 ml de água"
            >
              <Plus size={15} />
              250 ml
            </button>
          }
        />
        <ChecklistRow
          icon={Flame}
          done={kcal >= kcalTarget * 0.9}
          title="Alimentação"
          detail={`${NUMBER.format(kcal)} / ${NUMBER.format(kcalTarget)} kcal`}
          label="Registrar refeição"
          onClick={() => open("nutrition")}
        />
        <ChecklistRow
          icon={Dumbbell}
          done={sets === totalSets}
          title="Treino"
          detail={`${sets}/${totalSets} séries · ${NUMBER.format(state.runKm)} km`}
          label={
            sets === totalSets ? "Revisar meu treino" : "Continuar meu treino"
          }
          onClick={() => open("workout")}
        />
        <li className="kp-row kp-row-skincare">
          <SkincareSummary onOpen={() => open("routine")} />
        </li>
        {habits.map((habit) => (
          <li
            key={habit.id}
            className={`kp-row ${state.habits[habit.id] ? "is-done" : ""}`}
          >
            <button
              className="kp-row-main"
              role="checkbox"
              aria-checked={state.habits[habit.id]}
              aria-label={habit.title}
              onClick={() => act({ type: "habit", id: habit.id })}
            >
              <span className="kp-row-dot" aria-hidden="true">
                {state.habits[habit.id] ? (
                  <Check size={14} strokeWidth={2.4} />
                ) : (
                  <Layers3 size={15} strokeWidth={1.6} />
                )}
              </span>
              <span className="kp-row-text">
                <strong>{habit.title}</strong>
                <small>
                  {habit.period === "morning"
                    ? "Manhã"
                    : habit.period === "evening"
                      ? "Noite"
                      : "Ao longo do dia"}
                </small>
              </span>
            </button>
          </li>
        ))}
        <ChecklistRow
          icon={Timer}
          done={summary.focusMinutes >= state.targets.focusMinutes}
          title="Foco"
          detail={
            timerActive
              ? `Bloco ${timer.status === "paused" ? "em pausa" : "em andamento"}`
              : `${summary.focusMinutes}/${state.targets.focusMinutes} min`
          }
          label="Registrar bloco de foco"
          onClick={() => open("focus")}
          trailing={
            <button
              className="kp-row-action kp-row-action-primary"
              onClick={onTimer}
            >
              <Timer size={15} />
              {timerActive ? "Abrir meu cronômetro" : "Iniciar foco"}
            </button>
          }
        />
      </ul>
    </section>
  );
}

/** One glance at what the sources know, with a way into the page that explains it. */
function SignalsCard({
  state,
  health,
  github,
  go,
  onSources,
}: Pick<
  PulseOverviewProps,
  "state" | "health" | "github" | "go" | "onSources"
>) {
  const snapshot = health.snapshot;
  const preview = !snapshot && state.mode === "demo";
  const sleep =
    snapshot?.metrics.sleepHours.value ??
    (preview ? PREVIEW.sleepHours.value : null);
  const resting =
    snapshot?.metrics.restingHeartRate.value ??
    (preview ? PREVIEW.restingHeartRate.value : null);
  const pushes = github.snapshot
    ? summarizeGithubEvents(github.snapshot.events, dayDate(state.day))
        .statisticsToday.pushes
    : null;
  return (
    <section className="kp-card kp-signals" aria-label="Sinais de hoje">
      <CardTitle
        icon={Activity}
        meta={
          preview ? (
            <span className="kp-preview-tag">Prévia ilustrativa</span>
          ) : undefined
        }
      >
        Sinais
      </CardTitle>
      <ul className="kp-rows">
        <li className="kp-row">
          <button
            className="kp-row-main"
            onClick={() => (snapshot || preview ? go("body") : onSources())}
          >
            <span className="kp-row-dot kp-dot-blue" aria-hidden="true">
              <Moon size={15} strokeWidth={1.6} />
            </span>
            <span className="kp-row-text">
              <strong>
                {sleep === null
                  ? "Sem dados de saúde"
                  : `${duration(sleep)} de descanso`}
              </strong>
              <small>
                {resting !== null
                  ? `FC em repouso ${Math.round(resting)} bpm`
                  : "Importe o Apple Saúde para ver sono e frequência"}
              </small>
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </li>
        <li className="kp-row">
          <button
            className="kp-row-main"
            onClick={() => (github.snapshot ? go("focus") : onSources())}
          >
            <span className="kp-row-dot kp-dot-lime" aria-hidden="true">
              <GitBranch size={15} strokeWidth={1.6} />
            </span>
            <span className="kp-row-text">
              <strong>
                {pushes === null
                  ? "GitHub não conectado"
                  : `${pushes} ${pushes === 1 ? "push" : "pushes"} hoje`}
              </strong>
              <small>
                {github.snapshot
                  ? `@${github.snapshot.username} · atividade pública`
                  : "Conecte um perfil público"}
              </small>
            </span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </li>
      </ul>
    </section>
  );
}

export function PulseOverview(props: PulseOverviewProps) {
  const { state, health, github, onSources } = props;
  const date = dayDate(state.day);
  const connected =
    Number(Boolean(health.snapshot)) + Number(Boolean(github.snapshot));
  return (
    <div className="kp-overview">
      <PageHeading
        eyebrow={date
          .toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "short",
          })
          .replaceAll(".", "")}
        title="Hoje"
        connected={connected}
        onSources={onSources}
      />
      <NextStepCard {...props} />
      <div className="kp-today-grid">
        <RhythmCard state={state} variant="today" />
        <TodayChecklist {...props} />
        <SignalsCard {...props} />
      </div>
      <footer className="kp-overview-footer">
        <span>
          <span className="kp-dot" />
          {state.mode === "demo"
            ? "Você está explorando a demonstração."
            : "Seu contexto. Suas decisões."}
        </span>
        <button onClick={() => props.open("settings")}>
          Personalizar meu espaço
          <ArrowUpRight size={14} />
        </button>
      </footer>
    </div>
  );
}
