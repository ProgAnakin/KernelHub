"use client";

import {
  BatteryMedium,
  Brain,
  Check,
  Clock3,
  Heart,
  Moon,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import type { KernelState, Sheet } from "@/types/kernel";
import { nextStep, summarizeDay, weekOf } from "@/lib/metrics";
import { Card, CardHeading, CardLink, Progress } from "./ui";

interface Props {
  state: KernelState;
  open: (sheet: Sheet) => void;
}
export function TodayBrief({ state }: { state: KernelState }) {
  const step = nextStep(state),
    summary = summarizeDay(state);
  return (
    <div className="today-brief" aria-label="Direção para hoje">
      <div className="brief-symbol">
        <Sparkles size={18} strokeWidth={1.5} />
      </div>
      <div>
        <span>UM PRÓXIMO PASSO</span>
        <strong>{step.title}</strong>
        <p>{step.detail}</p>
      </div>
      <span className="brief-count">
        <Check size={12} />
        {summary.habitCount}/5 cuidados
      </span>
    </div>
  );
}

export function CheckinCard({ state, open }: Props) {
  const checkin = state.checkin;
  return (
    <Card className="checkin-card" label="Bem-estar e medidas">
      <CardHeading
        icon={Brain}
        label="Como você está?"
        color="blue"
        right={
          <span className="quiet-label">
            {checkin ? "REGISTRADO" : "CHECK-IN"}
          </span>
        }
      />
      <div className="checkin-summary">
        <div className="wellbeing-symbol">
          <Heart size={25} strokeWidth={1.5} />
        </div>
        <h3>
          {checkin ? "Um momento de atenção." : "O dia começa por dentro."}
        </h3>
        <p>
          {checkin
            ? "Sua percepção também é um dado."
            : "Energia, humor e descanso. Sem julgamentos."}
        </p>
      </div>
      <div className="feeling-metrics">
        <div>
          <BatteryMedium size={15} />
          <strong>
            {checkin?.energy ?? "—"}
            <small>/5</small>
          </strong>
          <span>Energia</span>
        </div>
        <div>
          <Sparkles size={15} />
          <strong>
            {checkin?.mood ?? "—"}
            <small>/5</small>
          </strong>
          <span>Humor</span>
        </div>
        <div>
          <Moon size={15} />
          <strong>
            {checkin ? checkin.sleepHours.toLocaleString("pt-BR") : "—"}
            <small>h</small>
          </strong>
          <span>Descanso · meta {state.targets.sleepHours}h</span>
        </div>
      </div>
      {checkin && (
        <div className="body-measures">
          <span>
            Peso
            <strong>
              {checkin.weightKg?.toLocaleString("pt-BR") ?? "—"}
              <small> kg</small>
            </strong>
          </span>
          <span>
            Passos
            <strong>{checkin.steps?.toLocaleString("pt-BR") ?? "—"}</strong>
          </span>
          <span>
            Estresse
            <strong>
              {checkin.stress}
              <small>/5</small>
            </strong>
          </span>
        </div>
      )}
      <CardLink onClick={() => open("checkin")}>
        {checkin ? "Revisar meu check-in" : "Fazer meu check-in"}
      </CardLink>
    </Card>
  );
}

export function FocusCard({ state, open }: Props) {
  const summary = summarizeDay(state),
    last = state.focusSessions.at(-1);
  return (
    <Card className="focus-card" label="Foco e carreira">
      <CardHeading
        icon={Target}
        label="Foco & direção"
        color="blue"
        right={<span className="quiet-label">PROJETOS + ESTUDO</span>}
      />
      <div className="focus-value">
        <strong>{summary.focusMinutes}</strong>
        <span>/ {state.targets.focusMinutes} min</span>
        <Clock3 size={22} strokeWidth={1.5} />
      </div>
      <p className="card-description">Tempo para o que você quer construir.</p>
      <div className="focus-breakdown">
        <span>
          <i />
          {summary.focusMinutes - summary.studyMinutes} min de projeto
        </span>
        <span>
          <i />
          {summary.studyMinutes} min de estudo
        </span>
      </div>
      <Progress
        value={(summary.focusMinutes / state.targets.focusMinutes) * 100}
        label="Meta pessoal de foco"
        color="blue"
      />
      <div className="focus-outcome">
        <span>ÚLTIMO AVANÇO</span>
        <p>
          {last?.outcome ||
            (last
              ? "Um bloco de atenção concluído."
              : "Qual pequeno resultado você quer criar hoje?")}
        </p>
      </div>
      <CardLink onClick={() => open("focus")}>Registrar bloco de foco</CardLink>
    </Card>
  );
}

export function WeeklyCard({ state }: { state: KernelState }) {
  const week = weekOf(state),
    logged = week.filter((day) => day?.checkin),
    total = week.reduce((sum, day) => sum + (day?.focusMinutes ?? 0), 0);
  const sleep = logged.length
    ? logged.reduce((sum, day) => sum + (day!.checkin?.sleepHours ?? 0), 0) /
      logged.length
    : null;
  const weights = week.flatMap((day) =>
    day?.checkin?.weightKg != null ? [day.checkin.weightKg] : [],
  );
  const change =
    weights.length > 1
      ? Math.round((weights.at(-1)! - weights[0]) * 10) / 10
      : null;
  const [year, month, date] = state.day.split("-").map(Number);
  return (
    <Card className="weekly-card" label="Panorama dos últimos sete dias">
      <CardHeading
        icon={TrendingUp}
        label="Evolução em perspectiva"
        right={
          <span className="quiet-label">
            7 DIAS {state.mode === "demo" ? "· DEMO" : "· LOCAL"}
          </span>
        }
      />
      <p className="card-description">
        Observe padrões. Respeite o seu contexto.
      </p>
      <div
        className="week-chart"
        role="img"
        aria-label={`Foco nos últimos sete dias: ${week.map((day) => (day ? `${day.day}: ${day.focusMinutes} minutos` : "sem registro")).join("; ")}`}
      >
        {week.map((day, index) => {
          const label = new Date(year, month - 1, date - (6 - index), 12)
            .toLocaleDateString("pt-BR", { weekday: "short" })
            .replace(".", "");
          return (
            <div key={index} className={index === 6 ? "is-today" : ""}>
              <span>{day?.focusMinutes ? `${day.focusMinutes}m` : "—"}</span>
              <div className="week-bar-track">
                <div
                  style={{
                    height: `${Math.min(100, ((day?.focusMinutes ?? 0) / Math.max(state.targets.focusMinutes, ...week.map((item) => item?.focusMinutes ?? 0))) * 100)}%`,
                  }}
                />
              </div>
              <small>{label}</small>
            </div>
          );
        })}
      </div>
      <div className="weekly-stat-grid">
        <div>
          <span>Foco acumulado</span>
          <strong>
            {total}
            <small>min</small>
          </strong>
        </div>
        <div>
          <span>Sono registrado</span>
          <strong>
            {sleep === null
              ? "—"
              : sleep.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
            <small>h / noite</small>
          </strong>
        </div>
        <div>
          <span>
            {change === null ? "Peso registrado" : "Variação de peso"}
          </span>
          <strong>
            {change === null
              ? (weights.at(-1)?.toLocaleString("pt-BR") ?? "—")
              : `${change > 0 ? "+" : ""}${change.toLocaleString("pt-BR")}`}
            <small>kg</small>
          </strong>
        </div>
      </div>
      <p className="week-context">
        {state.mode === "demo"
          ? "Histórico de exemplo. Seu espaço pessoal começa sem registros fictícios."
          : `${logged.length} check-in${logged.length !== 1 ? "s" : ""} no período. Dias sem registro ficam vazios; médias usam apenas valores informados.`}
      </p>
    </Card>
  );
}
