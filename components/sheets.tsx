"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  BatteryMedium,
  BookOpen,
  Check,
  ChevronRight,
  Droplets,
  Dumbbell,
  Footprints,
  GitCommitHorizontal,
  GitPullRequest,
  Heart,
  Info,
  Layers3,
  Leaf,
  Minus,
  Moon,
  Plus,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  Trash2,
} from "lucide-react";
import type {
  KernelAction,
  KernelState,
  Sheet,
  WishlistItem,
} from "@/types/kernel";
import {
  COURSES,
  EXERCISES,
  GIT_EVENTS,
  HABITS,
  calories,
  mockTelemetry,
} from "@/lib/mock-engine";
import { money } from "@/lib/format";
import { CircleCheck, ListAction, Progress } from "./ui";
import { CheckinSheet, FocusSheet, WorkspaceSheet } from "./growth-sheets";
import { nextStep } from "@/lib/metrics";
import { SkincareCabinet } from "./skincare-cabinet";

export const SHEET_INFO: Record<
  NonNullable<Sheet>,
  { title: string; subtitle: string }
> = {
  telemetry: {
    title: "Seu corpo, em perspectiva.",
    subtitle: "Telemetria Garmin simulada · não conectado",
  },
  workout: {
    title: "Um passo mais forte.",
    subtitle: "Sua sessão de movimento de hoje",
  },
  nutrition: {
    title: "Bom combustível.",
    subtitle: "Refeições e hidratação do dia",
  },
  routine: {
    title: "O cuidado está nos detalhes.",
    subtitle: "Uma rotina simples, feita com intenção",
  },
  engineering: {
    title: "Do código ao mundo.",
    subtitle: "Atividade GitHub demonstrativa · não conectado",
  },
  learning: {
    title: "Aprender é construir.",
    subtitle: "Avance uma aula. Guarde uma ideia.",
  },
  wishlist: {
    title: "Investir com intenção.",
    subtitle: "Prioridades antes de impulsos",
  },
  quick: {
    title: "Um pequeno avanço.",
    subtitle: "O que você fez por você agora?",
  },
  checkin: {
    title: "Um momento para você.",
    subtitle: "Percepções e medidas · registro manual",
  },
  focus: {
    title: "Seu tempo, com direção.",
    subtitle: "Projetos, carreira e aprendizado",
  },
  settings: {
    title: "Seu espaço pessoal.",
    subtitle: "KernelHub · seu ritmo, suas escolhas",
  },
};

interface Props {
  sheet: Sheet;
  state: KernelState;
  act: (action: KernelAction) => void;
  open: (sheet: Sheet) => void;
  now: Date | null;
  onClose: () => void;
  onToast: (text: string) => void;
}

export function SheetContents(props: Props) {
  switch (props.sheet) {
    case "telemetry":
      return <TelemetrySheet now={props.now} />;
    case "workout":
      return <WorkoutSheet {...props} />;
    case "nutrition":
      return <NutritionSheet {...props} />;
    case "routine":
      return <RoutineSheet {...props} />;
    case "engineering":
      return <EngineeringSheet state={props.state} />;
    case "learning":
      return <LearningSheet {...props} />;
    case "wishlist":
      return <WishlistSheet {...props} />;
    case "settings":
      return <WorkspaceSheet {...props} />;
    case "checkin":
      return <CheckinSheet {...props} />;
    case "focus":
      return <FocusSheet {...props} />;
    case "quick":
      return (
        <div className="quick-actions">
          <div className="suggested-action">
            <span>PARA O SEU MOMENTO</span>
            <ListAction
              icon={Sparkles}
              title={nextStep(props.state).label}
              subtitle={nextStep(props.state).detail}
              onClick={() => props.open(nextStep(props.state).sheet)}
            />
          </div>
          <ListAction
            icon={Heart}
            title="Registrar meu check-in"
            subtitle="Energia, humor, sono e medidas"
            color="blue"
            onClick={() => props.open("checkin")}
          />
          <ListAction
            icon={Rocket}
            title="Registrar um bloco de foco"
            subtitle="Tempo e resultados de projetos ou estudo"
            color="blue"
            onClick={() => props.open("focus")}
          />
          <ListAction
            icon={Droplets}
            title="Beber um copo de água"
            subtitle="Adicionar 250 ml à hidratação"
            color="blue"
            onClick={() => {
              props.act({ type: "water", amount: 250 });
              props.onClose();
            }}
          />
          <ListAction
            icon={Dumbbell}
            title="Registrar meu treino"
            subtitle="Séries, repetições ou quilômetros"
            onClick={() => props.open("workout")}
          />
          <ListAction
            icon={Leaf}
            title="Adicionar uma refeição"
            subtitle="Proteína, carboidratos e gorduras"
            color="amber"
            onClick={() => props.open("nutrition")}
          />
          <ListAction
            icon={Sparkles}
            title="Cuidar da minha rotina"
            subtitle="Skincare, suplementos e cuidados"
            onClick={() => props.open("routine")}
          />
          <ListAction
            icon={BookOpen}
            title="Guardar um aprendizado"
            subtitle="Uma aula ou um insight"
            color="blue"
            onClick={() => props.open("learning")}
          />
          <div className="quick-footer">
            <ShieldCheck size={14} />
            Tudo é salvo apenas neste dispositivo.
            <button
              onClick={() => props.open("settings")}
              aria-label="Configurações do espaço"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      );
    default:
      return null;
  }
}

function TelemetrySheet({ now }: { now: Date | null }) {
  const data = mockTelemetry(now ?? new Date("2026-10-22T12:00:00Z"));
  const points = data.samples
    .map((value, i) => `${(i * 300) / 23},${100 - value}`)
    .join(" ");
  return (
    <div className="telemetry-details">
      <div className="sheet-info">
        <Info size={16} />
        <p>
          Simulação para explorar a experiência. Nenhum relógio ou serviço
          Garmin está conectado.
        </p>
      </div>
      <div className="telemetry-detail-grid">
        <div>
          <BatteryMedium size={19} />
          <strong>
            {data.bodyBattery}
            <small>%</small>
          </strong>
          <span>Body Battery</span>
        </div>
        <div>
          <Heart size={19} />
          <strong>
            {data.heartRate}
            <small>bpm</small>
          </strong>
          <span>Frequência simulada</span>
        </div>
        <div>
          <Moon size={19} />
          <strong>
            7<small>h</small>42<small>m</small>
          </strong>
          <span>Sono · score 84</span>
        </div>
      </div>
      <div className="chart-title">
        <strong>Energia ao longo do dia</strong>
        <span>EXEMPLO</span>
      </div>
      <div className="energy-chart">
        <svg
          viewBox="0 0 300 110"
          role="img"
          aria-label="Curva demonstrativa de energia ao longo de 24 horas"
        >
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#30D158" stopOpacity=".2" />
              <stop offset="1" stopColor="#30D158" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[25, 50, 75].map((y) => (
            <line
              key={y}
              x1="0"
              x2="300"
              y1={y}
              y2={y}
              stroke="#ffffff"
              strokeOpacity=".06"
              strokeDasharray="3 5"
            />
          ))}
          <polygon points={`0,110 ${points} 300,110`} fill="url(#chart-fill)" />
          <polyline
            points={points}
            fill="none"
            stroke="#65df7d"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
        <div>
          <span>00h</span>
          <span>06h</span>
          <span>12h</span>
          <span>18h</span>
          <span>24h</span>
        </div>
      </div>
      <div className="detail-note">
        <Leaf size={18} />
        <span>
          <strong>Observe seu próprio ritmo.</strong>
          <p>
            Compare sono, energia e movimento ao longo do tempo. Estes dados de
            exemplo não orientam sua saúde.
          </p>
        </span>
      </div>
    </div>
  );
}

function WorkoutSheet({ state, act, onToast }: Props) {
  const [tab, setTab] = useState<"strength" | "run">("strength");
  const [distance, setDistance] = useState("");
  const done = EXERCISES.reduce(
    (sum, exercise) => sum + (state.exercises[exercise.id] ?? 0),
    0,
  );
  return (
    <div>
      <div
        className="segmented-control"
        role="group"
        aria-label="Tipo de treino"
      >
        <button
          aria-pressed={tab === "strength"}
          className={tab === "strength" ? "selected" : ""}
          onClick={() => setTab("strength")}
        >
          <Dumbbell size={16} />
          Academia
        </button>
        <button
          aria-pressed={tab === "run"}
          className={tab === "run" ? "selected" : ""}
          onClick={() => setTab("run")}
        >
          <Footprints size={16} />
          Corrida
        </button>
      </div>
      <p className="fine-print">
        Ficha de exemplo: exercícios, séries e cargas ainda são predefinidos. O
        registro de séries concluídas e quilômetros é salvo neste dispositivo.
      </p>
      {tab === "strength" ? (
        <>
          <div className="sheet-section-title">
            <span>SUPERIOR & CORE · TREINO A</span>
            <strong>{done}/15 séries</strong>
          </div>
          <div className="exercise-list">
            {EXERCISES.map((exercise, index) => (
              <div className="exercise-row" key={exercise.id}>
                <div>
                  <span className="exercise-number">0{index + 1}</span>
                  <span>
                    <strong>{exercise.name}</strong>
                    <small>
                      {exercise.sets} × {exercise.reps} <span>·</span>{" "}
                      {exercise.weightKg} kg
                    </small>
                  </span>
                </div>
                <div className="set-controls">
                  <button
                    className="undo-set"
                    aria-label={`Desfazer série de ${exercise.name}`}
                    disabled={!state.exercises[exercise.id]}
                    onClick={() =>
                      act({ type: "exercise", id: exercise.id, delta: -1 })
                    }
                  >
                    <Minus size={14} />
                  </button>
                  {Array.from({ length: exercise.sets }, (_, set) => (
                    <button
                      key={set}
                      className={
                        set < (state.exercises[exercise.id] ?? 0)
                          ? "completed"
                          : ""
                      }
                      aria-label={`${exercise.name}: ${set + 1} séries concluídas`}
                      aria-pressed={set < (state.exercises[exercise.id] ?? 0)}
                      onClick={() =>
                        act({
                          type: "exercise-total",
                          id: exercise.id,
                          sets: set + 1,
                        })
                      }
                    >
                      {set < (state.exercises[exercise.id] ?? 0) ? (
                        <Check size={15} />
                      ) : (
                        set + 1
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="sheet-success">
            <span>
              {done === 15 ? <Check size={17} /> : <Dumbbell size={17} />}
            </span>
            {done === 15
              ? "Treino concluído. Consistência construída."
              : "Toque no número para registrar uma série."}
          </div>
        </>
      ) : (
        <div className="run-panel">
          <span className="run-icon">
            <Footprints size={35} strokeWidth={1.5} />
          </span>
          <h3>Rodagem leve</h3>
          <p>Um quilômetro de cada vez.</p>
          <div className="run-value">
            {state.runKm.toLocaleString("pt-BR")}
            <span> / {state.targets.runKm} km</span>
          </div>
          <Progress
            value={(state.runKm / state.targets.runKm) * 100}
            label="Meta de corrida"
            color="blue"
          />
          <div className="run-buttons">
            <button
              className="secondary-button"
              aria-label="Remover 1 km"
              disabled={state.runKm === 0}
              onClick={() => act({ type: "run", delta: -1 })}
            >
              <Minus size={18} />1 km
            </button>
            <button
              className="primary-button"
              disabled={state.runKm >= 100}
              onClick={() => act({ type: "run", delta: 1 })}
            >
              <Plus size={18} />
              Registrar 1 km
            </button>
          </div>
          <form
            className="running-distance-form meal-form"
            onSubmit={(event) => {
              event.preventDefault();
              const km = Number(distance);
              if (
                !distance.trim() ||
                !Number.isFinite(km) ||
                km < 0 ||
                km > 100
              )
                return;
              act({ type: "run-total", km });
              setDistance("");
              onToast("Distância do dia atualizada.");
            }}
          >
            <label htmlFor="run-distance">
              Distância total de hoje (km)
              <input
                id="run-distance"
                type="number"
                inputMode="decimal"
                min="0"
                max="100"
                step=".1"
                required
                placeholder="Ex.: 3,6"
                value={distance}
                onChange={(event) => setDistance(event.target.value)}
              />
            </label>
            <button
              className="secondary-button full-width"
              disabled={
                !distance.trim() ||
                !Number.isFinite(Number(distance)) ||
                Number(distance) < 0 ||
                Number(distance) > 100
              }
            >
              Salvar distância total
            </button>
            <p className="fine-print">
              Substitui a distância acumulada de hoje, com precisão de 100
              metros. Use zero para corrigir um registro indevido.
            </p>
          </form>
          {state.runKm >= state.targets.runKm && (
            <p className="text-emerald">
              Meta do dia alcançada. Bom movimento.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function NutritionSheet({ state, act, onClose, onToast }: Props) {
  const [name, setName] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [mealError, setMealError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState({
    protein: "",
    carbs: "",
    fat: "",
  });
  const [pendingCorrection, setPendingCorrection] = useState<
    KernelState["nutrition"] | null
  >(null);
  const recorded = state.meals.reduce(
    (sum, meal) => ({
      protein: sum.protein + meal.macros.protein,
      carbs: sum.carbs + meal.macros.carbs,
      fat: sum.fat + meal.macros.fat,
    }),
    { protein: 0, carbs: 0, fat: 0 },
  );
  const hasPreviousTotal = calories(state.nutrition) > calories(recorded);
  const exceedsDailyLimit =
    state.nutrition.protein + Number(protein) > 10000 ||
    state.nutrition.carbs + Number(carbs) > 10000 ||
    state.nutrition.fat + Number(fat) > 10000;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const macros = {
      protein: Number(protein),
      carbs: Number(carbs),
      fat: Number(fat),
    };
    if (
      !name.trim() ||
      Object.values(macros).some(
        (value) => !Number.isFinite(value) || value < 0 || value > 500,
      )
    ) {
      setMealError(
        "Confira o nome e os nutrientes: informe de 0 a 500 g por campo.",
      );
      return;
    }
    if (state.meals.length >= 100 || exceedsDailyLimit) {
      setMealError(
        "O registro excede o limite de refeições ou nutrientes do dia. Corrija um registro antes de continuar.",
      );
      return;
    }
    act({ type: "meal", name, macros });
    onClose();
  };
  return (
    <div>
      <div className="nutrition-sheet-summary">
        <span>
          Consumido hoje
          <strong>
            {calories(state.nutrition).toLocaleString("pt-BR")}
            <small>
              {" "}
              / {calories(state.targets.macros).toLocaleString("pt-BR")} kcal
            </small>
          </strong>
        </span>
        <Leaf size={26} strokeWidth={1.5} />
      </div>
      <div className="water-adjust">
        <Droplets size={22} />
        <span>
          <strong>Hidratação</strong>
          <small>
            {state.waterMl.toLocaleString("pt-BR")} /{" "}
            {state.targets.waterMl.toLocaleString("pt-BR")} ml
          </small>
        </span>
        <button
          className="icon-button"
          aria-label="Remover 250 ml de água"
          disabled={state.waterMl === 0}
          onClick={() => act({ type: "water", amount: -250 })}
        >
          <Minus size={17} />
        </button>
        <button
          className="icon-button"
          aria-label="Adicionar 250 ml de água"
          disabled={state.waterMl >= 10000}
          onClick={() => act({ type: "water", amount: 250 })}
        >
          <Plus size={17} />
        </button>
      </div>
      <form onSubmit={submit} className="meal-form">
        <label htmlFor="meal-name">
          Nome da refeição
          <input
            id="meal-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: almoço"
            maxLength={80}
            required
            autoComplete="off"
          />
        </label>
        <div className="macro-inputs">
          <label htmlFor="protein">
            <i className="green" />
            Proteína <span>g</span>
            <input
              id="protein"
              type="number"
              inputMode="decimal"
              min="0"
              max="500"
              step="1"
              value={protein}
              onChange={(event) => setProtein(event.target.value)}
              placeholder="0"
              required
            />
          </label>
          <label htmlFor="carbs">
            <i className="blue" />
            Carbo <span>g</span>
            <input
              id="carbs"
              type="number"
              inputMode="decimal"
              min="0"
              max="500"
              step="1"
              value={carbs}
              onChange={(event) => setCarbs(event.target.value)}
              placeholder="0"
              required
            />
          </label>
          <label htmlFor="fat">
            <i className="amber" />
            Gordura <span>g</span>
            <input
              id="fat"
              type="number"
              inputMode="decimal"
              min="0"
              max="500"
              step="1"
              value={fat}
              onChange={(event) => setFat(event.target.value)}
              placeholder="0"
              required
            />
          </label>
        </div>
        <button
          className="primary-button full-width"
          type="submit"
          disabled={
            !name.trim() ||
            !(Number(protein) + Number(carbs) + Number(fat) > 0) ||
            state.meals.length >= 100 ||
            exceedsDailyLimit
          }
        >
          <Plus size={17} />
          Salvar refeição
        </button>
        {(mealError || exceedsDailyLimit) && (
          <p className="form-error" role="alert">
            {exceedsDailyLimit
              ? "A soma ultrapassa 10.000 g de um nutriente no dia. Confira os valores ou corrija o total atual."
              : mealError}
          </p>
        )}
      </form>
      {state.meals.length >= 100 && (
        <p className="fine-print" role="status">
          Você atingiu o limite de 100 refeições no dia. Remova um registro
          incorreto antes de adicionar outro.
        </p>
      )}
      <section
        className="meal-entry-list"
        aria-label="Refeições registradas hoje"
      >
        <div className="sheet-section-title">
          <span>REFEIÇÕES DE HOJE</span>
          <strong>
            {state.meals.length}{" "}
            {state.meals.length === 1 ? "registro" : "registros"}
          </strong>
        </div>
        {state.meals.length ? (
          state.meals
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((meal) => (
              <div className="meal-entry" key={meal.id}>
                <div className="meal-entry-row">
                  <span>
                    <strong>{meal.name}</strong>
                    <small>
                      {calories(meal.macros).toLocaleString("pt-BR")} kcal · P{" "}
                      {meal.macros.protein} g · C {meal.macros.carbs} g · G{" "}
                      {meal.macros.fat} g
                    </small>
                  </span>
                  <button
                    className="icon-button"
                    aria-label={`Remover refeição ${meal.name}`}
                    onClick={() => setDeleting(meal.id)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                {deleting === meal.id && (
                  <div className="inline-confirm" role="alert">
                    <p>
                      Remover “{meal.name}”? Os nutrientes dessa refeição serão
                      descontados do total de hoje.
                    </p>
                    <div>
                      <button
                        className="secondary-button"
                        onClick={() => setDeleting(null)}
                      >
                        Cancelar
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => {
                          act({ type: "meal-remove", id: meal.id });
                          setDeleting(null);
                          onToast(
                            "Refeição removida. Totais do dia ajustados.",
                          );
                        }}
                      >
                        Confirmar remoção
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
        ) : (
          <p className="fine-print">
            As refeições que você registrar aparecem aqui. Se precisar corrigir
            uma, remova o registro e adicione os valores certos.
          </p>
        )}
        {hasPreviousTotal && (
          <p className="fine-print">
            O total inclui nutrientes anteriores sem refeições individuais.
            Apenas os novos registros podem ser removidos nesta lista.
          </p>
        )}
      </section>
      {correcting ? (
        <form
          className="nutrition-correction meal-form"
          onSubmit={(event) => {
            event.preventDefault();
            const macros = {
              protein: Number(correction.protein),
              carbs: Number(correction.carbs),
              fat: Number(correction.fat),
            };
            if (
              Object.values(macros).some(
                (value) =>
                  !Number.isFinite(value) || value < 0 || value > 10000,
              )
            )
              return;
            setPendingCorrection(macros);
          }}
        >
          <p className="sheet-lead">Qual é o total correto de hoje?</p>
          <div className="macro-inputs">
            {(
              [
                { key: "protein", label: "Proteína" },
                { key: "carbs", label: "Carbo" },
                { key: "fat", label: "Gordura" },
              ] as const
            ).map((field) => (
              <label htmlFor={`correct-${field.key}`} key={field.key}>
                {field.label} <span>g</span>
                <input
                  id={`correct-${field.key}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="10000"
                  step="any"
                  required
                  value={correction[field.key]}
                  onChange={(event) => {
                    setCorrection({
                      ...correction,
                      [field.key]: event.target.value,
                    });
                    setPendingCorrection(null);
                  }}
                />
              </label>
            ))}
          </div>
          <p className="fine-print">
            A correção substitui o total de nutrientes e limpa a lista de
            refeições de hoje. O registro da alteração permanece no histórico de
            atividade. Novas refeições serão somadas ao total corrigido.
          </p>
          <div className="run-buttons">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setCorrecting(false);
                setPendingCorrection(null);
              }}
            >
              Cancelar
            </button>
            <button className="secondary-button" type="submit">
              Revisar correção
            </button>
          </div>
          {pendingCorrection && (
            <div className="inline-confirm" role="alert">
              <p>
                Substituir o total por{" "}
                {calories(pendingCorrection).toLocaleString("pt-BR")} kcal? Os{" "}
                {state.meals.length} registros individuais serão removidos da
                lista de hoje.
              </p>
              <div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setPendingCorrection(null)}
                >
                  Voltar à edição
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    act({
                      type: "nutrition-correct",
                      macros: pendingCorrection,
                    });
                    setPendingCorrection(null);
                    setCorrecting(false);
                    setDeleting(null);
                    onToast("Total de nutrientes corrigido.");
                  }}
                >
                  Confirmar novo total
                </button>
              </div>
            </div>
          )}
        </form>
      ) : (
        <button
          className="secondary-button full-width nutrition-correction-toggle"
          onClick={() => {
            setCorrection({
              protein: String(state.nutrition.protein),
              carbs: String(state.nutrition.carbs),
              fat: String(state.nutrition.fat),
            });
            setCorrecting(true);
          }}
        >
          Corrigir total do dia
        </button>
      )}
      <p className="fine-print">
        {state.mode === "demo"
          ? "Os totais iniciais são exemplos. Suas novas refeições ficam registradas neste dispositivo."
          : "Valores informados manualmente. Suas metas podem ser ajustadas em Meu espaço."}
      </p>
    </div>
  );
}

function RoutineSheet({ state, act }: Props) {
  const otherHabits = HABITS.filter(
    (habit) => habit.id === "supplements" || habit.id === "grooming",
  );
  const legacyEntries = state.journal.filter(
    (entry) =>
      entry.kind === "body" &&
      /skincare|proteção solar/i.test(`${entry.title} ${entry.detail}`),
  );
  return (
    <div>
      <SkincareCabinet legacyEntries={legacyEntries} />
      <div className="sheet-section-title">
        <span>OUTROS CUIDADOS</span>
        <strong>
          {otherHabits.filter((habit) => state.habits[habit.id]).length}/
          {otherHabits.length}
        </strong>
      </div>
      <div className="routine-sheet-list">
        {otherHabits.map((habit) => (
          <div
            key={habit.id}
            className={state.habits[habit.id] ? "is-done" : ""}
          >
            <span className={`routine-period ${habit.period}`}>
              {habit.period === "morning" ? (
                <Sun size={20} />
              ) : habit.period === "evening" ? (
                <Moon size={20} />
              ) : (
                <Sparkles size={20} />
              )}
            </span>
            <span>
              <strong>{habit.title}</strong>
              <small>{habit.subtitle}</small>
            </span>
            <CircleCheck
              checked={state.habits[habit.id]}
              onClick={() => act({ type: "habit", id: habit.id })}
              label={habit.title}
            />
          </div>
        ))}
      </div>
      <div className="detail-note">
        <Moon size={18} />
        <span>
          <strong>Feito para recomeçar.</strong>
          <p>
            O checklist renova a cada dia. Seu histórico continua guardado neste
            dispositivo.
          </p>
        </span>
      </div>
    </div>
  );
}

function EngineeringSheet({ state }: { state: KernelState }) {
  const [filter, setFilter] = useState("all");
  const filtered = (state.mode === "demo" ? GIT_EVENTS : []).filter(
    (event) => filter === "all" || event.kind === filter,
  );
  return (
    <div>
      <div className="sheet-info">
        <Info size={16} />
        <p>
          {state.mode === "demo"
            ? "Eventos fictícios de demonstração."
            : "Nenhuma conta GitHub está conectada."}{" "}
          Commits, PRs e deploys têm origens distintas.
        </p>
      </div>
      <div className="filter-pills" role="group" aria-label="Filtrar atividade">
        {[
          { id: "all", label: "Tudo" },
          { id: "commit", label: "Commits" },
          { id: "pull-request", label: "PRs" },
          { id: "deploy", label: "Deploys" },
        ].map((item) => (
          <button
            key={item.id}
            aria-pressed={filter === item.id}
            className={filter === item.id ? "selected" : ""}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="empty-state">
          <GitCommitHorizontal size={26} />
          <h3>Aguardando uma fonte real.</h3>
          <p>Conectar o GitHub requer uma integração no servidor.</p>
        </div>
      )}
      <div className="git-feed">
        {filtered.map((event) => (
          <div key={event.id}>
            <span className={`git-event-icon ${event.kind}`}>
              {event.kind === "deploy" ? (
                <Rocket size={18} />
              ) : event.kind === "pull-request" ? (
                <GitPullRequest size={18} />
              ) : (
                <GitCommitHorizontal size={18} />
              )}
            </span>
            <span>
              <strong>{event.title}</strong>
              <small>
                {event.repository} {event.hash && <code>{event.hash}</code>}
              </small>
            </span>
            <time>{event.time}</time>
          </div>
        ))}
      </div>
      <p className="fine-print">
        A integração real exigirá autorização GitHub no backend. Nenhum token é
        solicitado neste protótipo.
      </p>
    </div>
  );
}

function LearningSheet({ state, act, onToast }: Props) {
  const [courseId, setCourseId] = useState(COURSES[0].id);
  const [text, setText] = useState("");
  const [visibleInsights, setVisibleInsights] = useState(8);
  const [deletingInsight, setDeletingInsight] = useState<string | null>(null);
  const course = COURSES.find((item) => item.id === courseId)!;
  const progress = state.courseProgress[courseId] ?? 0;
  const insights = state.insights.filter(
    (insight) => insight.courseId === courseId,
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    act({ type: "insight", courseId, text });
    setText("");
  };
  return (
    <div>
      <label className="field-label" htmlFor="course-select">
        Seu curso
        <select
          id="course-select"
          value={courseId}
          onChange={(event) => {
            setCourseId(event.target.value);
            setVisibleInsights(8);
            setDeletingInsight(null);
          }}
        >
          {COURSES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      <div className="learning-progress">
        <span>
          <strong>
            {progress} de {course.lessons} aulas
          </strong>
          <small>{course.provider}</small>
        </span>
        <div>
          <button
            className="icon-button"
            aria-label="Desfazer uma aula"
            disabled={progress === 0}
            onClick={() => act({ type: "lesson", id: courseId, delta: -1 })}
          >
            <Minus size={17} />
          </button>
          <button
            className="primary-button"
            disabled={progress >= course.lessons}
            onClick={() => {
              act({ type: "lesson", id: courseId, delta: 1 });
              onToast(
                progress + 1 === course.lessons
                  ? "Curso concluído. Conhecimento construído."
                  : "Mais uma aula. Mais um passo.",
              );
            }}
          >
            <Check size={16} />
            {progress >= course.lessons ? "Concluído" : "Concluir aula"}
          </button>
        </div>
      </div>
      <Progress
        value={(progress / course.lessons) * 100}
        color="blue"
        label={`Progresso de ${course.title}`}
      />
      <form className="insight-form" onSubmit={submit}>
        <label htmlFor="insight-text">
          O que ficou dessa aula?
          <textarea
            id="insight-text"
            placeholder="Uma ideia, uma conexão, algo para aplicar…"
            value={text}
            maxLength={1000}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            required
          />
        </label>
        <div>
          <small>{text.length}/1.000</small>
          <button className="primary-button" disabled={!text.trim()}>
            <Plus size={16} />
            Guardar insight
          </button>
        </div>
      </form>
      {insights.length > 0 && (
        <div className="saved-insights">
          <span className="quiet-label">SEUS INSIGHTS · {insights.length}</span>
          {insights.slice(0, visibleInsights).map((insight) => (
            <blockquote key={insight.id}>
              <p>{insight.text}</p>
              <time>
                {new Date(insight.createdAt).toLocaleDateString("pt-BR")}
              </time>
              <button
                className="secondary-button insight-remove"
                aria-label={`Remover insight de ${new Date(insight.createdAt).toLocaleDateString("pt-BR")}: ${insight.text.slice(0, 48)}`}
                onClick={() => setDeletingInsight(insight.id)}
              >
                <Trash2 size={15} />
                Remover insight
              </button>
              {deletingInsight === insight.id && (
                <div className="inline-confirm" role="alert">
                  <p>Remover este insight? Essa ação não pode ser desfeita.</p>
                  <div>
                    <button
                      className="secondary-button"
                      onClick={() => setDeletingInsight(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => {
                        act({ type: "insight-delete", id: insight.id });
                        setDeletingInsight(null);
                        onToast("Insight removido do seu espaço.");
                      }}
                    >
                      Confirmar remoção
                    </button>
                  </div>
                </div>
              )}
            </blockquote>
          ))}
          {insights.length > visibleInsights && (
            <button
              className="secondary-button full-width"
              onClick={() => setVisibleInsights((count) => count + 8)}
            >
              Mostrar mais insights ({insights.length - visibleInsights})
            </button>
          )}
        </div>
      )}
      <p className="fine-print">
        Os cursos são modelos predefinidos. O progresso e os insights que você
        registra ficam salvos neste dispositivo.
      </p>
    </div>
  );
}

function WishlistSheet({ state, act }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<"planned" | "acquired">("planned");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [price, setPrice] = useState("");
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [category, setCategory] =
    useState<WishlistItem["category"]>("Equipamento");
  const items = state.wishlist
    .filter(
      (item) => state.acquired.includes(item.id) === (filter === "acquired"),
    )
    .sort((a, b) => a.priority - b.priority);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !Number.isFinite(Number(price)) || Number(price) < 0)
      return;
    act({
      type: "wishlist-add",
      item: { name, purpose, price: Number(price), priority, category },
    });
    setName("");
    setPrice("");
    setPurpose("");
    setAdding(false);
    setFilter("planned");
  };
  return (
    <div>
      {adding ? (
        <form className="wishlist-add-form meal-form" onSubmit={submit}>
          <label htmlFor="wish-name">
            O que você quer adquirir?
            <input
              id="wish-name"
              placeholder="Ex.: fones para correr"
              value={name}
              maxLength={80}
              required
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label htmlFor="wish-purpose">
            Qual objetivo esse item atende?
            <input
              id="wish-purpose"
              placeholder="Ex.: mais conforto nos treinos"
              value={purpose}
              maxLength={160}
              required
              onChange={(event) => setPurpose(event.target.value)}
            />
          </label>
          <div className="wishlist-add-grid">
            <label htmlFor="wish-price">
              Valor estimado (R$)
              <input
                id="wish-price"
                type="number"
                inputMode="decimal"
                min="0"
                max="1000000"
                step="0.01"
                placeholder="0,00"
                value={price}
                required
                onChange={(event) => setPrice(event.target.value)}
              />
            </label>
            <div className="field-label">
              <label htmlFor="wish-priority">Prioridade</label>
              <select
                id="wish-priority"
                value={priority}
                onChange={(event) =>
                  setPriority(Number(event.target.value) as 1 | 2 | 3)
                }
              >
                <option value="1">Alta</option>
                <option value="2">Média</option>
                <option value="3">Baixa</option>
              </select>
            </div>
          </div>
          <div className="field-label">
            <label htmlFor="wish-category">Categoria</label>
            <select
              id="wish-category"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as WishlistItem["category"])
              }
            >
              <option>Equipamento</option>
              <option>Suplemento</option>
              <option>Vestuário</option>
            </select>
          </div>
          <div className="run-buttons">
            <button
              className="secondary-button"
              type="button"
              onClick={() => setAdding(false)}
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              disabled={!name.trim() || !purpose.trim()}
            >
              <Plus size={16} />
              Guardar nos meus planos
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="segmented-control">
            <button
              aria-pressed={filter === "planned"}
              className={filter === "planned" ? "selected" : ""}
              onClick={() => setFilter("planned")}
            >
              Planejados{" "}
              <small>{state.wishlist.length - state.acquired.length}</small>
            </button>
            <button
              aria-pressed={filter === "acquired"}
              className={filter === "acquired" ? "selected" : ""}
              onClick={() => setFilter("acquired")}
            >
              Adquiridos <small>{state.acquired.length}</small>
            </button>
          </div>
          <div className="wishlist-sheet-list">
            {items.length ? (
              items.map((item) => (
                <div key={item.id}>
                  <span className={`wishlist-art art-${item.id}`}>
                    {item.id === "creatine" ? (
                      <Layers3 size={23} />
                    ) : item.id === "shoes" ? (
                      <Footprints size={23} />
                    ) : (
                      <ShoppingBag size={23} />
                    )}
                  </span>
                  <div>
                    <div>
                      <strong>{item.name}</strong>
                      <span className={`priority priority-${item.priority}`}>
                        {item.priority === 1
                          ? "Alta"
                          : item.priority === 2
                            ? "Média"
                            : "Baixa"}
                      </span>
                    </div>
                    <p>{item.purpose}</p>
                    <span>
                      {money(item.price)} <span>·</span> {item.category}
                    </span>
                    <div className="wish-row-actions">
                      <button
                        className={
                          filter === "acquired"
                            ? "acquired-button"
                            : "secondary-button"
                        }
                        onClick={() => act({ type: "acquire", id: item.id })}
                      >
                        {filter === "acquired" ? (
                          <>
                            <ArrowRight size={14} />
                            Voltar para planejados
                          </>
                        ) : (
                          <>
                            <Check size={14} />
                            Marcar como adquirido
                          </>
                        )}
                      </button>
                      <button
                        className="wishlist-remove"
                        aria-label={`Remover ${item.name}`}
                        onClick={() => setDeleting(item.id)}
                      >
                        <Trash2 size={14} />
                        Remover
                      </button>
                    </div>
                    {deleting === item.id && (
                      <div className="inline-confirm" role="alert">
                        <p>Remover “{item.name}” dos seus planos?</p>
                        <div>
                          <button
                            className="secondary-button"
                            onClick={() => setDeleting(null)}
                          >
                            Cancelar
                          </button>
                          <button
                            className="secondary-button"
                            onClick={() => {
                              act({ type: "wishlist-delete", id: item.id });
                              setDeleting(null);
                            }}
                          >
                            Confirmar remoção
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <ShoppingBag size={28} />
                <h3>
                  {filter === "planned"
                    ? "Tudo no seu tempo."
                    : "Espaço para o que importa."}
                </h3>
                <p>
                  {filter === "planned"
                    ? state.wishlist.length
                      ? "Seus itens já foram adquiridos. Planeje o próximo com intenção."
                      : "Ainda não há itens planejados. Adicione algo que ajude nos seus objetivos."
                    : "Suas aquisições concluídas aparecem aqui."}
                </p>
              </div>
            )}
          </div>
          {items.length > 0 && (
            <div className="wishlist-total">
              <span>
                {filter === "planned" ? "Total planejado" : "Total adquirido"}
              </span>
              <strong>
                {money(items.reduce((sum, item) => sum + item.price, 0))}
              </strong>
            </div>
          )}
          <button
            className="secondary-button full-width add-wish"
            disabled={state.wishlist.length >= 100}
            onClick={() => setAdding(true)}
          >
            <Plus size={16} />
            Adicionar item
          </button>
          <p className="fine-print">
            {state.mode === "demo" ? "A lista começa com exemplos. " : ""}
            Nenhuma compra é realizada pelo app.
          </p>
        </>
      )}
    </div>
  );
}
