"use client";

import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Dumbbell,
  Footprints,
  House,
  Layers3,
  Leaf,
  Plus,
  Radio,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Target,
  Timer,
  TrendingUp,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { KernelAction, KernelState, Section, Sheet } from "@/types/kernel";
import { COURSES, EXERCISES } from "@/lib/mock-engine";
import { useKernel } from "@/lib/use-kernel";
import { money } from "@/lib/format";
import { checkinSuggestions } from "@/lib/metrics";
import {
  BottomSheet,
  Card,
  CardHeading,
  CardLink,
  Progress,
  SPRING,
} from "./ui";
import { SheetContents, SHEET_INFO } from "./sheets";
import { CheckinCard, WeeklyCard } from "./growth";
import { assetPath } from "@/lib/paths";
import { useGithub } from "@/lib/use-github";
import { useHealth } from "@/lib/use-health";
import { SourceCenter, GithubActivity } from "./source-center";
import { FocusTracker } from "./focus-tracker";
import {
  ContextCard,
  EngineeringCard,
  FocusCard,
  HealthCard,
  NutritionCard,
  PageHeading,
  PulseOverview,
  RoutineCard,
} from "./pulse-overview";
import { RhythmCard } from "./rhythm";

type StateProps = {
  state: KernelState;
  open: (sheet: Sheet) => void;
  act: (action: KernelAction) => void;
};
// One page per question the user asks of the app: what now, my body, my work,
// how am I doing over time, what do I want next.
const SECTION_HASH: Record<Section, string> = {
  today: "",
  body: "corpo",
  focus: "foco",
  trends: "evolucao",
  wishlist: "colecao",
};
// Links saved before the reorganisation keep working.
const LEGACY_HASH: Record<string, Section> = {
  evoluir: "focus",
  conhecimento: "focus",
};
const NAV: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "today", label: "Hoje", icon: House },
  { id: "body", label: "Corpo", icon: Activity },
  { id: "focus", label: "Foco", icon: Target },
  { id: "trends", label: "Evolução", icon: TrendingUp },
  { id: "wishlist", label: "Coleção", icon: ShoppingBag },
];
const PAGES: Record<
  Exclude<Section, "today">,
  { eyebrow: string; title: string; detail: string }
> = {
  body: {
    eyebrow: "Saúde · alimentação · cuidados",
    title: "Corpo",
    detail: "Como você está e o que o corpo recebeu hoje.",
  },
  focus: {
    eyebrow: "Projetos · estudo · código",
    title: "Foco",
    detail: "Meça o tempo, veja o que avançou e retome o que está em curso.",
  },
  trends: {
    eyebrow: "Semanas · constância · padrões",
    title: "Evolução",
    detail: "O que se repete ao longo do tempo, sem preencher lacunas.",
  },
  wishlist: {
    eyebrow: "Aquisições planejadas",
    title: "Coleção",
    detail: "O que vale entrar na sua rotina, por prioridade.",
  },
};

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

function Page({
  section,
  connected,
  onSources,
  children,
}: {
  section: Exclude<Section, "today">;
  connected: number;
  onSources: () => void;
  children: ReactNode;
}) {
  const page = PAGES[section];
  return (
    <div className="kp-overview">
      <PageHeading
        eyebrow={page.eyebrow}
        title={page.title}
        detail={page.detail}
        connected={connected}
        onSources={onSources}
      />
      <div className={`kp-page kp-page-${section}`}>{children}</div>
    </div>
  );
}

export function Dashboard() {
  const {
    state,
    act,
    restore,
    hydrated,
    storageError,
    dayConflict,
    recoveryAvailable,
  } = useKernel();
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
  // Sections live in the URL hash: back/forward and shared links work, and a
  // static export needs no server routes.
  const navigate = (id: Section) => {
    if (id !== section) {
      const hash = SECTION_HASH[id];
      window.history.pushState(null, "", hash ? `#${hash}` : location.pathname);
    }
    setSection(id);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  useEffect(() => {
    const fromHash = () => {
      const hash = location.hash.replace(/^#/, "");
      const match = (Object.keys(SECTION_HASH) as Section[]).find(
        (key) => SECTION_HASH[key] === hash,
      );
      setSection(match ?? LEGACY_HASH[hash] ?? "today");
    };
    fromHash();
    window.addEventListener("popstate", fromHash);
    return () => window.removeEventListener("popstate", fromHash);
  }, []);
  const props: StateProps = { state, open, act: notifyAct };
  const sourceCount =
    Number(Boolean(github.snapshot)) + Number(Boolean(health.snapshot));
  const title = section === "today" ? "Hoje" : PAGES[section].title;
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
  const pulse = {
    ...props,
    health,
    github,
    onSources: () => openOverlay("sources"),
    onTimer: () => openOverlay("timer"),
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
                {section === id && (
                  <motion.span
                    layoutId="kh-nav-indicator"
                    className="kh-nav-indicator"
                    transition={SPRING}
                  />
                )}
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
            <span className="kh-version">KERNELHUB / 0.5 · LOCAL FIRST</span>
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
              {title}
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
            {section === "today" && <PulseOverview {...pulse} go={navigate} />}
            {section !== "today" && (
              <Page
                section={section}
                connected={sourceCount}
                onSources={pulse.onSources}
              >
                {section === "body" && (
                  <>
                    <HealthCard {...pulse} />
                    <CheckinCard state={state} open={open} />
                    <WorkoutCard {...props} />
                    <NutritionCard {...pulse} />
                    <RoutineCard {...pulse} />
                  </>
                )}
                {section === "focus" && (
                  <>
                    <FocusCard {...pulse} />
                    <KnowledgeCard {...props} />
                    <EngineeringCard {...pulse} />
                  </>
                )}
                {section === "trends" && (
                  <>
                    <RhythmCard state={state} variant="history" />
                    <WeeklyCard state={state} />
                    <ContextCard {...pulse} />
                    <ActivityJournal state={state} />
                  </>
                )}
                {section === "wishlist" && <WishlistCard {...props} />}
              </Page>
            )}
            <footer className="kh-footer">
              <span>
                <ShieldCheck size={13} />
                Dados locais. Seu ritmo.
              </span>
              <div>
                <button onClick={() => navigate("wishlist")}>Coleção</button>
                <button onClick={() => openOverlay("sources")}>Fontes</button>
                <button onClick={() => open("settings")}>Meu espaço</button>
              </div>
            </footer>
          </main>
        </div>
        <nav className="kh-bottom-nav" aria-label="Navegação do iPhone">
          {NAV.slice(0, 2).map(({ id, label, icon: Icon }) => (
            <TabButton
              key={id}
              active={section === id}
              label={label}
              icon={Icon}
              onClick={() => navigate(id)}
            />
          ))}
          <button
            className="kh-quick-button"
            aria-label="Registro rápido"
            onClick={() => open("quick")}
          >
            <Plus size={28} strokeWidth={1.5} />
          </button>
          {NAV.slice(2, 4).map(({ id, label, icon: Icon }) => (
            <TabButton
              key={id}
              active={section === id}
              label={label}
              icon={Icon}
              onClick={() => navigate(id)}
            />
          ))}
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
                suggestions={checkinSuggestions(health.snapshot, state.day)}
                backup={{
                  githubUsername: github.username,
                  restore,
                  connectGithub: github.connect,
                }}
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

function TabButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? "is-active" : ""}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <Icon size={22} strokeWidth={1.5} />
      <span>{label}</span>
      {active && (
        <motion.span
          layoutId="kh-tab-glow"
          className="kh-tab-glow"
          transition={SPRING}
        />
      )}
    </button>
  );
}
