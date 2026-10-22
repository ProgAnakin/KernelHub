"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  Activity,
  BatteryMedium,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  GitBranch,
  GitCommitHorizontal,
  Heart,
  House,
  Layers3,
  Leaf,
  Moon,
  Plus,
  Rocket,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ComponentProps } from "react";
import type { KernelAction, KernelState, Section, Sheet } from "@/types/kernel";
import {
  COURSES,
  EXERCISES,
  GIT_EVENTS,
  HABITS,
  calories,
  mockContributions,
  mockTelemetry,
} from "@/lib/mock-engine";
import { useKernel } from "@/lib/use-kernel";
import { money } from "@/lib/format";
import {
  BottomSheet,
  Brand,
  Card,
  CardHeading,
  CardLink,
  CircleCheck,
  Progress,
  SPRING,
} from "./ui";
import { SheetContents, SHEET_INFO } from "./sheets";
import { CheckinCard, FocusCard, TodayBrief, WeeklyCard } from "./growth";
import { assetPath } from "@/lib/paths";

type StateProps = {
  state: KernelState;
  open: (sheet: Sheet) => void;
  act: (action: KernelAction) => void;
};
const formatter = new Intl.NumberFormat("pt-BR");
const NAV: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "today", label: "Visão geral", icon: House },
  { id: "body", label: "Corpo & rotina", icon: Activity },
  { id: "build", label: "Engenharia", icon: Code2 },
  { id: "learn", label: "Conhecimento", icon: BookOpen },
  { id: "wishlist", label: "Wishlist", icon: ShoppingBag },
];

function TelemetryCard({
  open,
  state,
}: {
  open: (sheet: Sheet) => void;
  state: KernelState;
}) {
  const now = useVisibleNow(state.mode === "demo", 12000);
  if (state.mode === "personal")
    return (
      <Card className="telemetry-card" label="Biometria pessoal">
        <CardHeading
          icon={Activity}
          label="Corpo & energia"
          color="blue"
          right={<span className="quiet-label">SEM CONEXÃO</span>}
        />
        <div className="disconnected-state">
          <Activity size={32} strokeWidth={1.5} />
          <h3>Uma base de dados real.</h3>
          <p>
            Seu Garmin ainda não está conectado. Até lá, acompanhe sono, peso e
            passos no check-in manual.
          </p>
        </div>
        <CardLink onClick={() => open("checkin")}>
          Registrar minhas medidas
        </CardLink>
      </Card>
    );
  const telemetry = now
    ? mockTelemetry(now)
    : { bodyBattery: 76, heartRate: 60, sleepScore: 84 };
  return (
    <Card className="telemetry-card" label="Biometria demonstrativa">
      <CardHeading
        icon={Activity}
        label="Corpo & energia"
        color="blue"
        right={
          <span className="source-label">
            GARMIN <span>DEMO</span>
          </span>
        }
      />
      <div className="telemetry-main">
        <div className="energy-ring">
          <svg viewBox="0 0 180 180" aria-hidden="true">
            <defs>
              <linearGradient id="ring-gradient" x1="0" y1="1" x2="1" y2="0">
                <stop offset="0%" stopColor="#30D158" />
                <stop offset="100%" stopColor="#b6f48b" />
              </linearGradient>
            </defs>
            <circle cx="90" cy="90" r="73" className="ring-track" />
            <circle
              cx="90"
              cy="90"
              r="73"
              className="ring-value"
              stroke="url(#ring-gradient)"
              strokeDasharray={`${(2 * Math.PI * 73 * telemetry.bodyBattery) / 100} ${2 * Math.PI * 73}`}
            />
            <circle cx="90" cy="90" r="60" className="ring-inner" />
          </svg>
          <div className="ring-center">
            <BatteryMedium size={19} strokeWidth={1.5} />
            <strong>
              {telemetry.bodyBattery}
              <span>%</span>
            </strong>
            <small>Body Battery</small>
          </div>
        </div>
        <div className="energy-caption">
          <span className="status-dot" />
          Boa energia
          <span>
            Um bom ritmo
            <br />
            para o seu dia.
          </span>
        </div>
      </div>
      <div className="biometric-stats">
        <div>
          <span>
            <Heart size={13} /> Frequência
          </span>
          <strong>
            {telemetry.heartRate}
            <small>bpm</small>
          </strong>
          <span className="tiny-trend">Em repouso</span>
        </div>
        <div>
          <span>
            <Moon size={13} /> Sono
          </span>
          <strong>
            7<small>h</small>42<small>m</small>
          </strong>
          <span className="tiny-trend">
            Score {telemetry.sleepScore}{" "}
            <span className="text-emerald">· Bom</span>
          </span>
        </div>
      </div>
      <CardLink onClick={() => open("telemetry")}>
        Ver minha recuperação
      </CardLink>
    </Card>
  );
}

function WorkoutCard({ state, open }: StateProps) {
  const done = EXERCISES.reduce(
    (sum, exercise) => sum + (state.exercises[exercise.id] ?? 0),
    0,
  );
  const total = EXERCISES.reduce((sum, exercise) => sum + exercise.sets, 0);
  return (
    <Card className="workout-card" label="Treino de hoje">
      <CardHeading
        icon={Dumbbell}
        label="Movimento"
        right={
          <span className={`mini-pill ${done === total ? "green" : ""}`}>
            {done === total
              ? "Concluído"
              : done > 0
                ? "Em andamento"
                : "Planejado"}
          </span>
        }
      />
      <div className="workout-art" aria-hidden="true">
        <svg viewBox="0 0 320 110">
          <defs>
            <linearGradient
              id="lift"
              gradientUnits="userSpaceOnUse"
              x1="-100"
              y1="-50"
              x2="100"
              y2="50"
            >
              <stop stopColor="#79af6c" stopOpacity=".45" />
              <stop offset="1" stopColor="#233821" stopOpacity=".15" />
            </linearGradient>
          </defs>
          <g
            transform="translate(160 55) rotate(-25)"
            fill="none"
            stroke="url(#lift)"
            strokeLinecap="round"
          >
            <path d="M-42 0H42" strokeWidth="13" />
            <rect
              x="-68"
              y="-33"
              width="24"
              height="66"
              rx="7"
              strokeWidth="3"
            />
            <rect
              x="-86"
              y="-23"
              width="18"
              height="46"
              rx="5"
              strokeWidth="3"
            />
            <rect
              x="44"
              y="-33"
              width="24"
              height="66"
              rx="7"
              strokeWidth="3"
            />
            <rect
              x="68"
              y="-23"
              width="18"
              height="46"
              rx="5"
              strokeWidth="3"
            />
            <path d="M-98 0h12M86 0h12" strokeWidth="6" />
          </g>
          <path d="M10 90h300" stroke="#ffffff" strokeOpacity=".025" />
        </svg>
        <span>TREINO A</span>
      </div>
      <h3>Superior & core</h3>
      <p className="card-description">
        5 exercícios <span>·</span> ~45 minutos
      </p>
      <div className="progress-label">
        <span>
          {done} de {total} séries
        </span>
        <span>{Math.round((done / total) * 100)}%</span>
      </div>
      <Progress value={(done / total) * 100} label="Séries do treino" />
      <CardLink onClick={() => open("workout")}>
        {done === total
          ? "Revisar meu treino"
          : done > 0
            ? "Continuar meu treino"
            : "Começar meu treino"}
      </CardLink>
    </Card>
  );
}

function NutritionCard({ state, open, act }: StateProps) {
  const kcal = calories(state.nutrition),
    target = calories(state.targets.macros);
  return (
    <Card className="nutrition-card" label="Nutrição e hidratação">
      <CardHeading
        icon={Leaf}
        label="Nutrição"
        color="amber"
        right={<span className="quiet-label">HOJE</span>}
      />
      <div className="calorie-total">
        <strong>{formatter.format(kcal)}</strong>
        <span> / {formatter.format(target)} kcal</span>
      </div>
      <p className="card-description">Energia para a sua evolução.</p>
      <div
        className="macro-bar"
        role="img"
        aria-label={`${kcal} de ${target} quilocalorias`}
      >
        <span
          style={{ flex: state.nutrition.protein * 4 }}
          className="protein"
        />
        <span style={{ flex: state.nutrition.carbs * 4 }} className="carbs" />
        <span style={{ flex: state.nutrition.fat * 9 }} className="fat" />
        <span
          style={{ flex: Math.max(0, target - kcal) }}
          className="remaining"
        />
      </div>
      <div className="macro-legend">
        {(
          [
            { key: "protein", label: "Proteína", color: "green" },
            { key: "carbs", label: "Carbo", color: "blue" },
            { key: "fat", label: "Gordura", color: "amber" },
          ] as const
        ).map((macro) => (
          <div key={macro.key}>
            <span>
              <i className={macro.color} />
              {macro.label}
            </span>
            <strong>
              {state.nutrition[macro.key]}
              <small> / {state.targets.macros[macro.key]}g</small>
            </strong>
          </div>
        ))}
      </div>
      <div className="hydration">
        <Droplets size={19} strokeWidth={1.5} />
        <div>
          <span>Hidratação</span>
          <strong>
            {(state.waterMl / 1000).toLocaleString("pt-BR")}{" "}
            <small>
              / {(state.targets.waterMl / 1000).toLocaleString("pt-BR")} L
            </small>
          </strong>
        </div>
        <button
          aria-label="Adicionar 250 ml de água"
          onClick={() => act({ type: "water", amount: 250 })}
          disabled={state.waterMl >= 10000}
        >
          <Plus size={17} />
          250 ml
        </button>
      </div>
      <CardLink onClick={() => open("nutrition")}>Registrar refeição</CardLink>
    </Card>
  );
}

function RoutineCard({ state, open, act }: StateProps) {
  const done = HABITS.filter((habit) => state.habits[habit.id]).length;
  return (
    <Card className="routine-card" label="Rotina de cuidado">
      <CardHeading
        icon={Sparkles}
        label="Pequenos cuidados"
        right={
          <span className="count-label">
            {done}
            <span>/{HABITS.length}</span>
          </span>
        }
      />
      <p className="card-description routine-intro">
        O básico bem feito, todos os dias.
      </p>
      <div className="habit-list">
        {HABITS.map((habit) => (
          <div
            className={`habit-row ${state.habits[habit.id] ? "is-done" : ""}`}
            key={habit.id}
          >
            <span className="habit-symbol">
              {habit.period === "morning" ? (
                <Sun size={17} />
              ) : habit.period === "evening" ? (
                <Moon size={17} />
              ) : habit.id === "supplements" ? (
                <Layers3 size={17} />
              ) : (
                <Sparkles size={17} />
              )}
            </span>
            <span>{habit.title}</span>
            <CircleCheck
              checked={state.habits[habit.id]}
              label={habit.title}
              onClick={() => act({ type: "habit", id: habit.id })}
            />
          </div>
        ))}
      </div>
      <CardLink onClick={() => open("routine")}>Minha rotina completa</CardLink>
    </Card>
  );
}

function EngineeringCard({
  open,
  now,
  state,
}: {
  open: (sheet: Sheet) => void;
  now: Date | null;
  state: KernelState;
}) {
  if (state.mode === "personal")
    return (
      <Card className="engineering-card" label="Engenharia pessoal">
        <CardHeading
          icon={Code2}
          label="O que você está construindo"
          right={<GitBranch size={18} />}
        />
        <div className="disconnected-state">
          <Code2 size={28} strokeWidth={1.5} />
          <h3>Código com contexto.</h3>
          <p>
            GitHub ainda não está conectado. Registre blocos de projeto e
            resultados no módulo de foco. Commits, PRs e deploys só aparecerão
            com uma fonte real.
          </p>
        </div>
        <CardLink onClick={() => open("focus")}>
          Registrar avanço de projeto
        </CardLink>
      </Card>
    );
  const events = GIT_EVENTS;
  return (
    <Card className="engineering-card" label="Engenharia demonstrativa">
      <CardHeading
        icon={Code2}
        label="O que você está construindo"
        right={<GitBranch size={18} className="muted-icon" />}
      />
      <div className="engineering-stats">
        <div>
          <strong>
            {events.filter((event) => event.kind === "commit").length}
            <span>commits</span>
          </strong>
        </div>
        <div>
          <strong>
            {events.filter((event) => event.kind === "pull-request").length}
            <span>PR fechado</span>
          </strong>
        </div>
        <div>
          <strong className="text-emerald">
            {events.filter((event) => event.kind === "deploy").length}
            <span>deploys</span>
          </strong>
        </div>
        <span className="streak">
          <Flame size={13} />
          12 dias
        </span>
      </div>
      <div className="contribution-wrap">
        <span className="contribution-caption">
          UM POUCO DE CÓDIGO, TODOS OS DIAS
        </span>
        <div
          className="contribution-grid"
          role="img"
          aria-label="Histórico demonstrativo de contribuições em 13 semanas"
        >
          {mockContributions(now ?? new Date(2026, 9, 22, 12)).map(
            (level, i) => (
              <span key={i} className={`level-${level}`} />
            ),
          )}
        </div>
        <div className="contribution-axis">
          <span>AGO</span>
          <span>SET</span>
          <span>OUT</span>
          <span>
            menos <i />
            <i />
            <i />
            <i /> mais
          </span>
        </div>
      </div>
      <div className="latest-commit">
        <GitCommitHorizontal size={16} />
        <span>feat: anel de energia e telemetria</span>
        <code>a82f3c1</code>
      </div>
      <CardLink onClick={() => open("engineering")}>
        Explorar atividade <span className="inline-demo">DEMO</span>
      </CardLink>
    </Card>
  );
}

function KnowledgeCard({ state, open }: StateProps) {
  const course = COURSES[0],
    done = state.courseProgress[course.id] ?? 0;
  return (
    <Card className="knowledge-card" label="Conhecimento">
      <CardHeading
        icon={BookOpen}
        label="Mente em movimento"
        color="blue"
        right={
          <span className="mini-pill blue">
            {done === course.lessons
              ? "Concluído"
              : done > 0
                ? "Em curso"
                : "Para começar"}
          </span>
        }
      />
      <div className="course-cover" aria-hidden="true">
        <div className="architecture-symbol">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <span>CONTINUE CURIOSO.</span>
        <div className="cover-code">&lt;/&gt;</div>
      </div>
      <span className="course-provider">
        {course.provider} <span>·</span> ENGENHARIA
      </span>
      <h3>{course.title}</h3>
      <div className="progress-label">
        <span>
          {done} de {course.lessons} aulas
        </span>
        <span>{Math.round((done / course.lessons) * 100)}%</span>
      </div>
      <Progress
        value={(done / course.lessons) * 100}
        label="Progresso em arquitetura de software"
        color="blue"
      />
      <CardLink onClick={() => open("learning")}>Continuar aprendendo</CardLink>
    </Card>
  );
}

function WishlistCard({ state, open }: StateProps) {
  const planned = state.wishlist.filter(
    (item) => !state.acquired.includes(item.id),
  );
  return (
    <Card className="wishlist-card" label="Próximas aquisições">
      <CardHeading
        icon={ShoppingBag}
        label="Investir em você"
        right={<span className="quiet-label">{planned.length} PLANEJADOS</span>}
      />
      <div className="wishlist-preview">
        {state.wishlist.length === 0 && (
          <div className="empty-state">
            <ShoppingBag size={25} />
            <h3>Um recurso. Um objetivo.</h3>
            <p>Planeje a próxima aquisição com intenção.</p>
          </div>
        )}
        {state.wishlist
          .slice()
          .sort(
            (a, b) =>
              Number(state.acquired.includes(a.id)) -
                Number(state.acquired.includes(b.id)) ||
              a.priority - b.priority,
          )
          .slice(0, 3)
          .map((item) => (
            <div className="wishlist-preview-row" key={item.id}>
              <span className={`wishlist-art art-${item.id}`}>
                {item.id === "creatine" ? (
                  <Layers3 size={23} />
                ) : item.id === "shoes" ? (
                  <Footprints size={24} />
                ) : (
                  <ShoppingBag size={22} />
                )}
              </span>
              <span>
                <strong>{item.name}</strong>
                <small>
                  {state.acquired.includes(item.id)
                    ? "Adquirido"
                    : item.priority === 1
                      ? "Prioridade alta"
                      : item.category}
                </small>
              </span>
              <span
                className={
                  state.acquired.includes(item.id)
                    ? "acquired-check"
                    : "wishlist-price"
                }
              >
                {state.acquired.includes(item.id) ? (
                  <Check size={17} />
                ) : (
                  money(item.price)
                )}
              </span>
            </div>
          ))}
      </div>
      <CardLink onClick={() => open("wishlist")}>
        Organizar minha wishlist
      </CardLink>
    </Card>
  );
}

function DailyFocus({ state }: Pick<StateProps, "state">) {
  const habits = HABITS.filter((habit) => state.habits[habit.id]).length;
  const completed =
    habits +
    Number(state.waterMl >= state.targets.waterMl) +
    Number(
      EXERCISES.every(
        (exercise) => state.exercises[exercise.id] === exercise.sets,
      ) || state.runKm >= state.targets.runKm,
    );
  return (
    <div className="daily-focus">
      <div className="mini-ring">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r="20" className="ring-track" />
          <circle
            cx="24"
            cy="24"
            r="20"
            className="focus-ring"
            strokeDasharray={`${(completed / 7) * 125.66} 125.66`}
          />
        </svg>
        <span>
          {completed}
          <small>/7</small>
        </span>
      </div>
      <div>
        <span>SEU RITMO, SUA EVOLUÇÃO</span>
        <strong>
          {completed === 7
            ? "O essencial está feito."
            : "Cada pequeno passo conta."}
        </strong>
        <small>
          {completed === 7
            ? "Reserve um tempo para descansar."
            : `${7 - completed} cuidados para completar o dia`}
        </small>
      </div>
    </div>
  );
}

function ActivityJournal({ state }: { state: KernelState }) {
  return (
    <Card className="journal-card">
      <CardHeading
        icon={Activity}
        label="Sua linha do tempo"
        right={<span className="quiet-label">LOCAL</span>}
      />
      {state.journal.length ? (
        <div className="journal-list">
          {state.journal.slice(0, 8).map((entry) => (
            <div key={entry.id}>
              <span className={`journal-dot ${entry.kind}`} />
              <span>
                <strong>{entry.title}</strong>
                <small>{entry.detail}</small>
              </span>
              <time dateTime={entry.createdAt}>
                {new Date(entry.createdAt).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })}{" "}
                ·{" "}
                {new Date(entry.createdAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Leaf size={26} />
          <h3>O próximo passo é seu.</h3>
          <p>
            Registre um cuidado ou uma aula.
            <br />
            Sua evolução aparece por aqui.
          </p>
        </div>
      )}
    </Card>
  );
}

// Refresh only the consumer, align ticks to the displayed unit and sleep while hidden.
function useVisibleNow(enabled: boolean, intervalMs: number) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      if (document.visibilityState === "hidden") return;
      setNow(new Date());
      timer = setTimeout(refresh, intervalMs - (Date.now() % intervalMs));
    };
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [enabled, intervalMs]);
  return now;
}

function LiveClock() {
  const now = useVisibleNow(true, 60000);
  const time =
    now?.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }) ?? "––:––";
  return <span className="live-clock">{time}</span>;
}

function LiveSheetContents(props: ComponentProps<typeof SheetContents>) {
  const now = useVisibleNow(props.sheet === "telemetry", 12000);
  return <SheetContents {...props} now={now ?? props.now} />;
}

export function Dashboard() {
  const { state, act, hydrated, storageError, dayConflict, recoveryAvailable } =
    useKernel();
  const [section, setSection] = useState<Section>("today");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const updateNetwork = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker
        .register(assetPath("/sw.js"), { scope: assetPath("/") })
        .catch(() => setToast("Não foi possível ativar o modo offline."));
    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
    };
  }, []);

  useEffect(() => {
    // The persistence hook rolls the day on midnight and on returning to the app.
    // Dates and contribution labels do not need a dashboard-wide live timer.
    setNow(new Date());
  }, [state.day]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const notifyAct = (action: KernelAction) => {
    if (!hydrated) return;
    act(action);
    if (action.type === "water")
      setToast(
        action.amount > 0
          ? "+250 ml. Um cuidado a mais."
          : "Registro de água ajustado.",
      );
    if (action.type === "meal")
      setToast("Refeição registrada. Bom combustível.");
    if (action.type === "insight") setToast("Insight salvo no seu espaço.");
  };
  const navigate = (id: Section) => {
    setSection(id);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const props: StateProps = { state, open: setSheet, act: notifyAct };
  const pageInfo: Record<
    Section,
    { eyebrow: string; title: string; accent: string; description: string }
  > = {
    today: {
      eyebrow: "SEU SISTEMA PESSOAL",
      title: "Um pouco melhor.",
      accent: "Todos os dias.",
      description: "Cuide de você. Construa o que importa.",
    },
    body: {
      eyebrow: "CORPO & ROTINA",
      title: "Sua melhor base.",
      accent: "É você.",
      description: "Energia, movimento e os cuidados que sustentam tudo.",
    },
    build: {
      eyebrow: "ENGENHARIA & EVOLUÇÃO",
      title: "Menos intenção.",
      accent: "Mais construção.",
      description: "Do primeiro insight ao próximo deploy.",
    },
    learn: {
      eyebrow: "CONHECIMENTO",
      title: "Continue curioso.",
      accent: "Vá mais fundo.",
      description: "Aprender, aplicar, registrar. Repetir.",
    },
    wishlist: {
      eyebrow: "AQUISIÇÕES COM INTENÇÃO",
      title: "O que faz sentido.",
      accent: "No seu tempo.",
      description: "Recursos para os seus objetivos, com prioridade.",
    },
  };
  const info = pageInfo[section];
  const date = now?.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="app-background"
        aria-busy={!hydrated}
        inert={sheet !== null || !hydrated}
      >
        <aside className="sidebar">
          <Brand />
          <div className="sidebar-label">WORKSPACE PESSOAL</div>
          <nav aria-label="Navegação principal">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={section === id ? "active" : ""}
                onClick={() => navigate(id)}
                aria-current={section === id ? "page" : undefined}
              >
                <Icon size={19} strokeWidth={1.5} />
                <span>{label}</span>
                {section === id && <span className="nav-current" />}
              </button>
            ))}
          </nav>
          <div className="sidebar-note">
            <div className="note-orbit">
              <Leaf size={21} />
            </div>
            <strong>Consistência &gt; intensidade.</strong>
            <p>
              Seu próximo nível começa
              <br />
              no que você faz hoje.
            </p>
          </div>
          <div className="sidebar-bottom">
            <button onClick={() => setSheet("settings")}>
              <Settings2 size={18} strokeWidth={1.5} />
              Seu espaço
              <ChevronRight size={15} />
            </button>
            <div>
              <span className="status-dot" />
              Seus dados ficam neste dispositivo
            </div>
            <span className="version">KERNELHUB / V.03</span>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="mobile-brand">
              <Brand small />
            </div>
            <div className="desktop-breadcrumb">
              Meu espaço <ChevronRight size={12} />
              <span>{NAV.find((item) => item.id === section)?.label}</span>
            </div>
            <div className="live-status">
              <LiveClock />
              <span className="header-separator" />
              <span
                className="battery-status"
                role="img"
                aria-label={
                  state.mode === "demo"
                    ? "Body Battery demonstrativa: 76 por cento"
                    : "Body Battery: sem conexão"
                }
              >
                <BatteryMedium size={16} />
                {state.mode === "demo" ? (
                  <>
                    76<span>%</span>
                  </>
                ) : (
                  "—"
                )}
              </span>
              <span className="deploy-status">
                <Rocket size={13} />
                {state.mode === "demo" ? 2 : "—"}
                <span>deploys</span>
              </span>
            </div>
            <div className="profile" aria-hidden="true">
              K<span />
            </div>
          </header>
          <main id="main-content">
            <div className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span />
                  {info.eyebrow}
                </div>
                <h1>
                  {info.title}
                  <br />
                  <span>{info.accent}</span>
                </h1>
                <p>{info.description}</p>
              </div>
              <div className="hero-side">
                <span className="today-date">
                  <span className="date-line" />
                  {date ?? "Seu dia começa aqui"}
                </span>
                <DailyFocus state={state} />
              </div>
            </div>
            <div className="section-heading">
              <h2>
                {section === "today"
                  ? "Hoje, em equilíbrio"
                  : NAV.find((item) => item.id === section)?.label}
              </h2>
              <span className="demo-indicator">
                <span />
                {state.mode === "demo"
                  ? "Dados de demonstração"
                  : "Seu espaço · dados locais"}
              </span>
            </div>
            {!online && (
              <div className="inline-notice">
                <WifiOff size={15} />
                Você está offline. Os registros continuam neste dispositivo.
              </div>
            )}
            {recoveryAvailable && (
              <div className="inline-notice warning">
                <ShieldCheck size={15} />
                Um registro antigo incompatível foi preservado. Exporte o
                arquivo de recuperação em Meu espaço.
              </div>
            )}
            {storageError && (
              <div className="inline-notice warning" role="status">
                <ShieldCheck size={15} />
                {dayConflict
                  ? "Há registros pendentes de outro dia e outra aba já avançou. Exporte esta sessão em Meu espaço antes de escolher qual backup restaurar. Os dados gravados foram mantidos."
                  : "O navegador bloqueou o armazenamento. Os registros desta sessão podem se perder."}
              </div>
            )}
            {section === "today" && <TodayBrief state={state} />}
            <AnimatePresence mode="wait">
              <motion.div
                key={section}
                className={`dashboard-grid view-${section}`}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                {(section === "today" || section === "body") && (
                  <>
                    <TelemetryCard open={setSheet} state={state} />
                    <WorkoutCard {...props} />
                    <NutritionCard {...props} />
                    <RoutineCard {...props} />
                    <CheckinCard {...props} />
                  </>
                )}
                {(section === "today" ||
                  section === "build" ||
                  section === "learn") && <FocusCard {...props} />}
                {(section === "today" || section === "build") && (
                  <EngineeringCard open={setSheet} now={now} state={state} />
                )}
                {(section === "today" ||
                  section === "body" ||
                  section === "build") && <WeeklyCard state={state} />}
                {(section === "today" ||
                  section === "build" ||
                  section === "learn") && <KnowledgeCard {...props} />}
                {(section === "today" || section === "wishlist") && (
                  <WishlistCard {...props} />
                )}
                {section !== "today" && <ActivityJournal state={state} />}
                {section === "learn" && (
                  <Card className="insights-card">
                    <CardHeading
                      icon={Sparkles}
                      label="Ideias que ficam"
                      color="blue"
                    />
                    {state.insights.length ? (
                      state.insights.slice(0, 5).map((insight) => (
                        <blockquote
                          className="insight-preview"
                          key={insight.id}
                        >
                          <p>{insight.text}</p>
                          <cite>
                            {
                              COURSES.find(
                                (course) => course.id === insight.courseId,
                              )?.title
                            }
                          </cite>
                        </blockquote>
                      ))
                    ) : (
                      <div className="empty-state">
                        <BookOpen size={26} />
                        <h3>De consumir a compreender.</h3>
                        <p>
                          Registre uma ideia com suas palavras.
                          <br />O aprendizado passa a ser seu.
                        </p>
                      </div>
                    )}
                    <CardLink onClick={() => setSheet("learning")}>
                      Registrar um insight
                    </CardLink>
                  </Card>
                )}
              </motion.div>
            </AnimatePresence>
            <footer className="dashboard-footer">
              <span>
                <span className="footer-dot" /> Feito de pequenos avanços.
              </span>
              <button
                className="footer-settings"
                onClick={() => setSheet("settings")}
              >
                <Settings2 size={13} />
                Meu espaço
              </button>
            </footer>
          </main>
        </div>
        <nav className="bottom-nav" aria-label="Navegação do iPhone">
          <button
            className={section === "today" ? "active" : ""}
            aria-current={section === "today" ? "page" : undefined}
            onClick={() => navigate("today")}
          >
            <House size={21} strokeWidth={1.5} />
            <span>Hoje</span>
          </button>
          <button
            className={section === "body" ? "active" : ""}
            aria-current={section === "body" ? "page" : undefined}
            onClick={() => navigate("body")}
          >
            <Activity size={21} strokeWidth={1.5} />
            <span>Corpo</span>
          </button>
          <button
            className="quick-add"
            onClick={() => setSheet("quick")}
            aria-label="Registro rápido"
          >
            <Plus size={25} strokeWidth={1.5} />
          </button>
          <button
            className={
              section === "build" || section === "learn" ? "active" : ""
            }
            aria-current={
              section === "build" || section === "learn" ? "page" : undefined
            }
            onClick={() => navigate("build")}
          >
            <Code2 size={21} strokeWidth={1.5} />
            <span>Evoluir</span>
          </button>
          <button
            className={section === "wishlist" ? "active" : ""}
            aria-current={section === "wishlist" ? "page" : undefined}
            onClick={() => navigate("wishlist")}
          >
            <ShoppingBag size={21} strokeWidth={1.5} />
            <span>Coleção</span>
          </button>
        </nav>
        <button
          className="desktop-quick"
          aria-label="Registro rápido"
          onClick={() => setSheet("quick")}
        >
          <Plus size={18} />
          Registro rápido<span>+</span>
        </button>
      </div>
      <BottomSheet
        open={sheet !== null}
        title={sheet ? SHEET_INFO[sheet].title : ""}
        subtitle={sheet ? SHEET_INFO[sheet].subtitle : ""}
        onClose={() => setSheet(null)}
      >
        <LiveSheetContents
          sheet={sheet}
          state={state}
          act={notifyAct}
          open={setSheet}
          now={now}
          onClose={() => setSheet(null)}
          onToast={setToast}
        />
      </BottomSheet>
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={SPRING}
          >
            <span>
              <Check size={14} />
            </span>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
