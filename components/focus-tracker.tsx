"use client";

import { useState } from "react";
import {
  Check,
  CirclePause,
  Clock3,
  Code2,
  BookOpen,
  Play,
  RotateCcw,
} from "lucide-react";
import { useFocusTimer } from "../lib/use-focus-timer";
import { MAX_FOCUS_MINUTES, type FocusCategory } from "../lib/focus-timer";

interface FocusTrackerProps {
  onToast: (message: string) => void;
  onClose?: () => void;
  targetMinutes?: number;
}

export function formatFocusTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function FocusTracker({
  onToast,
  onClose,
  targetMinutes,
}: FocusTrackerProps) {
  const timer = useFocusTimer({ targetMinutes });
  const [category, setCategory] = useState<FocusCategory>("project");
  const [outcome, setOutcome] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const [adjustment, setAdjustment] = useState("");
  const active = timer.status !== "idle";
  const ready = timer.hydrated && !timer.busy;
  const measuredMinutes = Math.floor(timer.elapsedSeconds / 60);
  const overLimit = measuredMinutes > MAX_FOCUS_MINUTES;
  const progress = Math.min(
    1,
    timer.elapsedSeconds / (timer.targetMinutes * 60),
  );
  const radius = 91;
  const circumference = 2 * Math.PI * radius;
  const finish = async () => {
    const result = await timer.complete(
      overLimit ? Number(adjustment) : undefined,
    );
    if (!result) return;
    setOutcome("");
    setAdjustment("");
    setDiscarding(false);
    onToast(
      result.alreadyRecorded
        ? "Este bloco já estava registrado."
        : `${result.minutes} min de ${result.category === "study" ? "estudo" : "projeto"} registrados automaticamente.`,
    );
    onClose?.();
  };
  return (
    <div
      className="kh-focus-tracker"
      data-active={active}
      aria-busy={!timer.hydrated || timer.busy}
    >
      <div className="kh-focus-intro">
        <span className="kh-focus-eyebrow">
          <Clock3 size={14} />{" "}
          {active
            ? timer.status === "paused"
              ? "BLOCO EM PAUSA"
              : "FOCO EM ANDAMENTO"
            : "SEU PRÓXIMO BLOCO"}
        </span>
        <h3>
          {active
            ? timer.status === "paused"
              ? "Uma pausa também conta."
              : "Um espaço para avançar."
            : "Comece. O tempo fica por nossa conta."}
        </h3>
        <p>
          {active
            ? "Pode sair desta tela. O relógio continua medindo até você pausar ou concluir."
            : "Escolha uma intenção e inicie. O tempo é medido de verdade, sem preencher minutos depois."}
        </p>
      </div>
      <div
        className={`kh-focus-dial ${timer.status === "running" ? "is-running" : ""}`}
      >
        <svg viewBox="0 0 220 220" aria-hidden="true">
          <circle
            cx="110"
            cy="110"
            r={radius}
            className="kh-focus-dial-track"
          />
          <circle
            cx="110"
            cy="110"
            r={radius}
            className="kh-focus-dial-progress"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            transform="rotate(-90 110 110)"
          />
        </svg>
        <div className="kh-focus-dial-label">
          <span>
            {timer.status === "running"
              ? "EM FOCO"
              : timer.status === "paused"
                ? "PAUSADO"
                : "TEMPO MEDIDO"}
          </span>
          <strong
            role="timer"
            aria-live="off"
            aria-label={`Tempo medido: ${formatFocusTime(timer.elapsedSeconds)}`}
          >
            {formatFocusTime(timer.elapsedSeconds)}
          </strong>
          <small>
            {active
              ? `de ${timer.targetMinutes} min planejados`
              : `${timer.targetMinutes} minutos de intenção`}
          </small>
        </div>
      </div>
      {!active ? (
        <>
          <div
            className="kh-focus-presets"
            role="group"
            aria-label="Duração planejada do foco"
          >
            {[25, 50, 90].map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={timer.targetMinutes === minutes}
                disabled={!ready}
                onClick={() => void timer.setTargetMinutes(minutes)}
              >
                {minutes}
                <span>min</span>
              </button>
            ))}
          </div>
          <div
            className="kh-focus-categories"
            role="group"
            aria-label="Destino do foco"
          >
            <button
              type="button"
              aria-pressed={category === "project"}
              onClick={() => setCategory("project")}
              disabled={!ready}
            >
              <Code2 size={17} />
              Projeto
            </button>
            <button
              type="button"
              aria-pressed={category === "study"}
              onClick={() => setCategory("study")}
              disabled={!ready}
            >
              <BookOpen size={17} />
              Estudo
            </button>
          </div>
          <label className="kh-focus-field" htmlFor="kh-focus-intention">
            Uma intenção <span>opcional</span>
            <input
              id="kh-focus-intention"
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
              placeholder="Ex.: finalizar a próxima etapa do projeto"
              maxLength={240}
              disabled={!ready}
            />
          </label>
          <button
            type="button"
            className="kh-focus-primary"
            disabled={!ready}
            onClick={() => void timer.start(category, outcome)}
          >
            <Play size={18} fill="currentColor" />
            Iniciar foco
          </button>
        </>
      ) : (
        <>
          <div className="kh-focus-session-info">
            <span>
              {timer.category === "study" ? (
                <BookOpen size={16} />
              ) : (
                <Code2 size={16} />
              )}
              {timer.category === "study" ? "Estudo" : "Projeto"}
            </span>
            <p>{timer.outcome || "Tempo dedicado com intenção."}</p>
          </div>
          {progress >= 1 && !overLimit && (
            <p className="kh-focus-reached" role="status">
              <Check size={15} />
              Meta de tempo alcançada. Conclua quando fizer sentido.
            </p>
          )}
          {overLimit && (
            <div className="kh-focus-adjustment">
              <p>
                Este bloco ultrapassou 8 horas. Revise o tempo que deseja
                registrar; a medição não será reduzida automaticamente.
              </p>
              <label htmlFor="kh-focus-adjust">
                Minutos a registrar
                <input
                  id="kh-focus-adjust"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="480"
                  step="1"
                  value={adjustment}
                  onChange={(event) => setAdjustment(event.target.value)}
                  placeholder="De 1 a 480"
                />
              </label>
            </div>
          )}
          <div className="kh-focus-controls">
            <button
              type="button"
              className="kh-focus-secondary"
              disabled={!ready}
              onClick={() =>
                void (timer.status === "running"
                  ? timer.pause()
                  : timer.resume())
              }
            >
              {timer.status === "running" ? (
                <CirclePause size={18} />
              ) : (
                <Play size={18} />
              )}
              {timer.status === "running" ? "Pausar" : "Retomar"}
            </button>
            <button
              type="button"
              className="kh-focus-primary"
              disabled={
                !ready ||
                measuredMinutes < 1 ||
                (overLimit &&
                  (!Number.isInteger(Number(adjustment)) ||
                    Number(adjustment) < 1 ||
                    Number(adjustment) > 480))
              }
              onClick={() => void finish()}
            >
              <Check size={18} />
              Concluir bloco
            </button>
          </div>
          {measuredMinutes < 1 && (
            <p className="kh-focus-footnote">
              O primeiro minuto está em curso. Um bloco é registrado a partir de
              60 segundos medidos.
            </p>
          )}
          <p className="kh-focus-footnote">
            Ao concluir, os minutos completos entram no dia de hoje. Blocos que
            atravessam a meia-noite ficam no dia da conclusão.
          </p>
        </>
      )}
      {timer.error && (
        <p className="kh-focus-error" role="alert">
          {timer.error}
        </p>
      )}
      {(active || timer.error) &&
        (discarding ? (
          <div className="kh-focus-confirm" role="alert">
            <strong>Descartar este cronômetro?</strong>
            <p>O tempo medido não será adicionado aos seus registros.</p>
            <div>
              <button
                type="button"
                className="kh-focus-secondary"
                onClick={() => setDiscarding(false)}
                disabled={!ready}
              >
                Manter bloco
              </button>
              <button
                type="button"
                className="kh-focus-secondary"
                onClick={async () => {
                  if (await timer.reset()) {
                    setDiscarding(false);
                    setAdjustment("");
                    onToast("Cronômetro descartado.");
                  }
                }}
                disabled={!ready}
              >
                Confirmar descarte
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="kh-focus-discard"
            disabled={!ready}
            onClick={() => setDiscarding(true)}
          >
            <RotateCcw size={14} />
            Descartar cronômetro
          </button>
        ))}
    </div>
  );
}
