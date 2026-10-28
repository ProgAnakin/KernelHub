"use client";

import { SkincareSummary } from "./skincare-summary";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  Activity,
  BookOpen,
  Check,
  ChevronRight,
  Code2,
  Droplets,
  Dumbbell,
  Footprints,
  House,
  Layers3,
  Leaf,
  Moon,
  Plus,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  WifiOff,
  Radio,
  ArrowUpRight,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { KernelAction, KernelState, Section, Sheet } from "@/types/kernel";
import { COURSES, EXERCISES, HABITS, calories } from "@/lib/mock-engine";
import { useKernel } from "@/lib/use-kernel";
import { money } from "@/lib/format";
import {
  BottomSheet,
  Card,
  CardHeading,
  CardLink,
  CircleCheck,
  Progress,
  SPRING,
} from "./ui";
import { SheetContents, SHEET_INFO } from "./sheets";
import { CheckinCard, FocusCard, WeeklyCard } from "./growth";
import { assetPath } from "@/lib/paths";
import { useGithub } from "@/lib/use-github";
import { useHealth } from "@/lib/use-health";
import { SourceCenter, GithubActivity } from "./source-center";
import { FocusTracker } from "./focus-tracker";
import { PulseOverview } from "./pulse-overview";

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
  const careHabits = HABITS.filter(
    (habit) => habit.id === "supplements" || habit.id === "grooming",
  );
  const done = careHabits.filter((habit) => state.habits[habit.id]).length;
  return (
    <Card className="routine-card" label="Rotina de cuidado">
      <CardHeading
        icon={Sparkles}
        label="Pequenos cuidados"
        right={
          <span className="count-label">
            {done}
            <span>/{careHabits.length}</span>
          </span>
        }
      />
      <p className="card-description routine-intro">
        O básico bem feito, todos os dias.
      </p>
      <SkincareSummary onOpen={() => open("routine")} />
      <div className="habit-list">
        {careHabits.map((habit) => (
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

export function Dashboard() {
  const { state, act, hydrated, storageError, dayConflict, recoveryAvailable } =
    useKernel();
  const github = useGithub();
  const health = useHealth();
  const [section, setSection] = useState<Section>("today");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [overlay, setOverlay] = useState<
    "sources" | "timer" | "activity" | null
  >(null);
  const [now, setNow] = useState<Date | null>(null);
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const modalOpen = sheet !== null || overlay !== null;

  useEffect(() => {
    setOnline(navigator.onLine);
    const updateNetwork = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker
        .register(assetPath("/sw.js"), {
          scope: assetPath("/"),
          updateViaCache: "none",
        })
        .catch(() => setToast("Não foi possível ativar o modo offline."));
    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
    };
  }, []);
  useEffect(() => {
    setNow(new Date());
  }, [state.day]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const openOverlay = (value: "sources" | "timer" | "activity") => {
    setSheet(null);
    setOverlay(value);
  };
  const close = () => {
    setSheet(null);
    setOverlay(null);
  };
  const open = (value: Sheet) => {
    setOverlay(null);
    setSheet(value);
  };
  const notifyAct = (action: KernelAction) => {
    if (!hydrated) return;
    act(action);
    if (action.type === "water")
      setToast(
        action.amount > 0
          ? `+${action.amount} ml. Hidratação registrada.`
          : "Registro de água ajustado.",
      );
    if (action.type === "meal") setToast("Refeição registrada.");
    if (action.type === "insight") setToast("Insight salvo no seu espaço.");
  };
  const navigate = (id: Section) => {
    setSection(id);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const props: StateProps = { state, open, act: notifyAct };
  const sourceCount =
    Number(Boolean(github.snapshot)) + Number(Boolean(health.snapshot));
  const titles: Record<
    Section,
    { label: string; title: string; detail: string }
  > = {
    today: {
      label: "OVERVIEW",
      title: "Hoje",
      detail: "Sinais, contexto e próximos passos.",
    },
    body: {
      label: "BODY / DAILY",
      title: "Sua melhor base.",
      detail: "Corpo, movimento e cuidados em um só ritmo.",
    },
    build: {
      label: "BUILD / LEARN",
      title: "Faça o tempo contar.",
      detail: "Trabalho, aprendizado e o que avançou de verdade.",
    },
    learn: {
      label: "KNOWLEDGE",
      title: "Conhecimento em prática.",
      detail: "Retome, entenda, aplique.",
    },
    wishlist: {
      label: "COLLECTION",
      title: "Escolhas com direção.",
      detail: "O que vale entrar na sua rotina.",
    },
  };
  const info = titles[section];
  const date = now
    ?.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    })
    .replaceAll(".", "");
  const overlayInfo =
    overlay === "sources"
      ? {
          title: "Suas fontes.",
          subtitle: "Dados disponíveis, sem preencher lacunas.",
        }
      : overlay === "timer"
        ? {
            title: "Entre no foco.",
            subtitle: "O tempo é acompanhado por você.",
          }
        : {
            title: "Seu trabalho em movimento.",
            subtitle: "Atividade pública do GitHub",
          };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className="app-background kh"
        aria-busy={!hydrated}
        inert={modalOpen || !hydrated}
      >
        <aside className="kh-sidebar">
          <button
            className="kh-logo"
            onClick={() => navigate("today")}
            aria-label="KernelHub, início"
          >
            <span className="kh-logomark">
              K<span />
            </span>
            KernelHub<span className="kh-brand-dot">.</span>
          </button>
          <span className="kh-nav-label">PERSONAL OPERATING SYSTEM</span>
          <nav aria-label="Navegação principal">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={section === id ? "is-active" : ""}
                aria-current={section === id ? "page" : undefined}
                onClick={() => navigate(id)}
              >
                <Icon size={19} strokeWidth={1.5} />
                <span>{label}</span>
                {section === id && <span className="kh-nav-indicator" />}
              </button>
            ))}
          </nav>
          <div className="kh-sidebar-bottom">
            <div className="kh-source-mini">
              <span className={sourceCount ? "kh-dot is-live" : "kh-dot"} />
              <span>
                {sourceCount
                  ? `${sourceCount} fonte${sourceCount > 1 ? "s" : ""} disponível${sourceCount > 1 ? "s" : ""}`
                  : "Seu próximo sinal está aqui"}
              </span>
            </div>
            <button
              className="kh-source-link"
              onClick={() => openOverlay("sources")}
            >
              <Radio size={18} />
              Central de fontes
              <ArrowUpRight size={16} />
            </button>
            <button onClick={() => open("settings")}>
              <Settings2 size={17} />
              Seu espaço
            </button>
            <span className="kh-version">KERNELHUB / 0.4 · LOCAL FIRST</span>
          </div>
        </aside>
        <div className="kh-workspace">
          <header className="kh-topbar">
            <div className="kh-mobile-brand">
              <span className="kh-logomark">
                K<span />
              </span>
              <strong>
                KernelHub<span>.</span>
              </strong>
            </div>
            <div className="kh-breadcrumb">
              <span>Meu espaço</span>
              <ChevronRight size={13} />
              {info.title}
            </div>
            <div className="kh-top-context">
              <LiveClock />
              <span className="kh-top-divider" />
              <span className="kh-top-date">{date ?? "Seu dia"}</span>
              <span
                className={`kh-online-dot ${online ? "is-online" : ""}`}
                role="img"
                aria-label={online ? "Online" : "Offline"}
              />
            </div>
          </header>
          <main className="kh-main" id="main-content">
            {!online && (
              <div className="inline-notice">
                <WifiOff size={15} />
                Você está offline. Os registros continuam neste dispositivo. As
                fontes mostram a última atualização salva.
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
            {section === "today" ? (
              <PulseOverview
                {...props}
                health={health}
                github={github}
                onSources={() => openOverlay("sources")}
                onTimer={() => openOverlay("timer")}
              />
            ) : (
              <>
                <div className="kh-page-heading">
                  <div>
                    <span className="kh-eyebrow">{info.label}</span>
                    <h1>{info.title}</h1>
                    <p>{info.detail}</p>
                  </div>
                  <button
                    className="kh-round-action"
                    aria-label="Abrir central de fontes"
                    onClick={() => openOverlay("sources")}
                  >
                    <Radio size={19} />
                  </button>
                </div>
                <div
                  className="kh-section-tabs"
                  role="group"
                  aria-label="Áreas do sistema"
                >
                  {[
                    { id: "body", label: "Corpo" },
                    { id: "build", label: "Evoluir" },
                    { id: "wishlist", label: "Coleção" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id as Section)}
                      aria-pressed={section === item.id}
                      className={section === item.id ? "is-active" : ""}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className={`dashboard-grid kh-detail view-${section}`}>
                  {section === "body" && (
                    <>
                      <div className="kh-body-source glass-card">
                        <div className="kh-section-label">
                          <span>SAÚDE / DISPONIBILIDADE</span>
                          <Radio size={17} />
                        </div>
                        <h2>
                          {health.snapshot
                            ? `${Object.values(health.snapshot.metrics).filter((item) => item.value !== null).length} métricas recebidas.`
                            : "Cada fonte, seus sinais."}
                        </h2>
                        <p>
                          {health.snapshot
                            ? `Leituras de ${health.snapshot.sources.join(", ")}. Valores sem amostra permanecem vazios.`
                            : "Sono, frequência, passos e energia são preenchidos a partir do que sua fonte entregar."}
                        </p>
                        <button
                          className="kh-text-button"
                          onClick={() => openOverlay("sources")}
                        >
                          Ver fontes e leituras <ArrowUpRight size={15} />
                        </button>
                      </div>
                      <CheckinCard state={state} open={open} />
                      <WorkoutCard {...props} />
                      <NutritionCard {...props} />
                      <RoutineCard {...props} />
                      <WeeklyCard state={state} />
                    </>
                  )}
                  {(section === "build" || section === "learn") && (
                    <>
                      <div className="glass-card kh-github-detail">
                        <GithubActivity
                          github={github}
                          onSources={() => openOverlay("sources")}
                        />
                      </div>
                      <div className="glass-card kh-start-focus">
                        <span className="kh-eyebrow">TEMPO EM MOVIMENTO</span>
                        <Timer size={30} />
                        <h2>Um bloco. Uma direção.</h2>
                        <p>
                          Inicie o cronômetro. O tempo continua sendo medido
                          enquanto você trabalha ou estuda fora do app.
                        </p>
                        <button
                          className="primary-button"
                          onClick={() => openOverlay("timer")}
                        >
                          Iniciar foco <ArrowUpRight size={16} />
                        </button>
                      </div>
                      <FocusCard state={state} open={open} />
                      <KnowledgeCard {...props} />
                      <WeeklyCard state={state} />
                      <ActivityJournal state={state} />
                    </>
                  )}
                  {section === "wishlist" && (
                    <>
                      <WishlistCard {...props} />
                      <ActivityJournal state={state} />
                    </>
                  )}
                </div>
              </>
            )}
            <footer className="kh-footer">
              <span>
                <ShieldCheck size={13} />
                Dados locais. Seu ritmo.
              </span>
              <div>
                <button onClick={() => open("wishlist")}>Coleção</button>
                <button onClick={() => openOverlay("sources")}>Fontes</button>
                <button onClick={() => open("settings")}>Meu espaço</button>
              </div>
            </footer>
          </main>
        </div>
        <nav className="kh-bottom-nav" aria-label="Navegação do iPhone">
          <button
            className={section === "today" ? "is-active" : ""}
            onClick={() => navigate("today")}
            aria-current={section === "today" ? "page" : undefined}
          >
            <House size={22} strokeWidth={1.5} />
            <span>Hoje</span>
          </button>
          <button
            className={section === "body" ? "is-active" : ""}
            onClick={() => navigate("body")}
            aria-current={section === "body" ? "page" : undefined}
          >
            <Activity size={22} strokeWidth={1.5} />
            <span>Corpo</span>
          </button>
          <button
            className="kh-quick-button"
            aria-label="Registro rápido"
            onClick={() => open("quick")}
          >
            <Plus size={28} strokeWidth={1.5} />
          </button>
          <button
            className={
              section === "build" || section === "learn" ? "is-active" : ""
            }
            onClick={() => navigate("build")}
            aria-current={
              section === "build" || section === "learn" ? "page" : undefined
            }
          >
            <Code2 size={22} strokeWidth={1.5} />
            <span>Evoluir</span>
          </button>
          <button onClick={() => openOverlay("sources")}>
            <Radio size={22} strokeWidth={1.5} />
            <span>Fontes</span>
          </button>
        </nav>
      </div>
      <BottomSheet
        open={modalOpen}
        title={
          overlay ? overlayInfo.title : sheet ? SHEET_INFO[sheet].title : ""
        }
        subtitle={
          overlay
            ? overlayInfo.subtitle
            : sheet
              ? SHEET_INFO[sheet].subtitle
              : ""
        }
        onClose={close}
      >
        <div className="kh-sheet" key={overlay ?? sheet}>
          {overlay === "sources" ? (
            <SourceCenter health={health} github={github} onToast={setToast} />
          ) : overlay === "timer" ? (
            <FocusTracker
              onToast={setToast}
              targetMinutes={state.targets.focusMinutes}
            />
          ) : overlay === "activity" ? (
            <GithubActivity
              github={github}
              onSources={() => openOverlay("sources")}
            />
          ) : (
            <>
              <SheetContents
                sheet={sheet}
                state={state}
                act={notifyAct}
                open={open}
                onClose={close}
                onToast={setToast}
              />
              {sheet === "quick" && (
                <button
                  className="primary-button full-width kh-timer-quick"
                  onClick={() => openOverlay("timer")}
                >
                  <Timer size={18} />
                  Iniciar foco com cronômetro
                </button>
              )}
            </>
          )}
        </div>
      </BottomSheet>
      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast kh-toast"
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
