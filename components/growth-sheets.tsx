"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Clock3,
  Minus,
  Plus,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import type {
  KernelAction,
  KernelState,
  PersonalTargets,
  Rating,
} from "@/types/kernel";
import {
  checkinSchema,
  parseStoredState,
  targetsSchema,
  MAX_BACKUP_BYTES,
} from "@/lib/state";
import { summarizeDay } from "@/lib/metrics";
import { readRecovery } from "@/lib/storage";

interface Props {
  state: KernelState;
  act: (action: KernelAction) => void;
  onClose: () => void;
  onToast: (text: string) => void;
}
const RATING_LABELS = {
  energy: ["Muito baixa", "Baixa", "Regular", "Boa", "Muito boa"],
  mood: ["Muito difícil", "Difícil", "Neutro", "Bem", "Muito bem"],
  stress: ["Muito baixo", "Baixo", "Moderado", "Alto", "Muito alto"],
};

export function CheckinSheet({ state, act, onClose, onToast }: Props) {
  const [energy, setEnergy] = useState<Rating>(state.checkin?.energy ?? 3),
    [mood, setMood] = useState<Rating>(state.checkin?.mood ?? 3),
    [stress, setStress] = useState<Rating>(state.checkin?.stress ?? 2);
  const [sleep, setSleep] = useState(
      state.checkin?.sleepHours.toString() ?? "",
    ),
    [weight, setWeight] = useState(state.checkin?.weightKg?.toString() ?? ""),
    [steps, setSteps] = useState(state.checkin?.steps?.toString() ?? "");
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = checkinSchema.safeParse({
      energy,
      mood,
      stress,
      sleepHours: Number(sleep),
      weightKg: weight === "" ? null : Number(weight),
      steps: steps === "" ? null : Number(steps),
    });
    if (!result.success) {
      setError("Confira os valores de sono, peso e passos.");
      return;
    }
    act({ type: "checkin", value: result.data });
    onToast("Check-in salvo. Você se deu um momento.");
    onClose();
  };
  return (
    <form className="checkin-form" onSubmit={submit}>
      <p className="sheet-lead">
        Como você se percebe agora? Não existe resposta certa.
      </p>
      {(
        [
          {
            id: "energy",
            label: "Energia percebida",
            value: energy,
            set: setEnergy,
          },
          { id: "mood", label: "Humor", value: mood, set: setMood },
          {
            id: "stress",
            label: "Estresse percebido",
            value: stress,
            set: setStress,
          },
        ] as const
      ).map((item) => (
        <fieldset className="rating-field" key={item.id}>
          <legend>
            {item.label} <span>{RATING_LABELS[item.id][item.value - 1]}</span>
          </legend>
          <div>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={item.value === value}
                aria-label={`${item.label}: ${value}, ${RATING_LABELS[item.id][value - 1]}`}
                className={item.value === value ? "selected" : ""}
                onClick={() => item.set(value as Rating)}
              >
                {value}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="metric-input-grid">
        <label htmlFor="sleep-hours">
          Sono de ontem (h)
          <input
            id="sleep-hours"
            type="number"
            inputMode="decimal"
            min="0"
            max="24"
            step=".1"
            placeholder="Ex.: 7,5"
            required
            value={sleep}
            onChange={(event) => setSleep(event.target.value)}
          />
        </label>
        <label htmlFor="weight-kg">
          Peso (kg) <small>opcional</small>
          <input
            id="weight-kg"
            type="number"
            inputMode="decimal"
            min="20"
            max="350"
            step=".1"
            placeholder="Sem registro"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
          />
        </label>
      </div>
      <label className="field-label" htmlFor="daily-steps">
        Passos de hoje <small>opcional · registro manual</small>
        <input
          id="daily-steps"
          type="number"
          inputMode="numeric"
          min="0"
          max="100000"
          step="1"
          placeholder="Sem registro"
          value={steps}
          onChange={(event) => setSteps(event.target.value)}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary-button full-width sticky-submit">
        <Check size={17} />
        Salvar meu check-in
      </button>
      <p className="fine-print">
        Percepções pessoais e medidas informadas por você. Não são um
        diagnóstico. Salvar novamente atualiza o check-in de hoje.
      </p>
    </form>
  );
}

export function FocusSheet({ state, act, onToast }: Props) {
  const [category, setCategory] = useState<"project" | "study">("project"),
    [minutes, setMinutes] = useState("25"),
    [outcome, setOutcome] = useState("");
  const total = summarizeDay(state).focusMinutes;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(minutes);
    if (
      !Number.isInteger(value) ||
      value < 1 ||
      value > 480 ||
      total + value > 1440
    )
      return;
    act({ type: "focus-add", minutes: value, category, outcome });
    setOutcome("");
    onToast("Bloco registrado. Seu tempo teve direção.");
  };
  return (
    <div>
      <p className="sheet-lead">
        Registre um período de atenção que você já concluiu.
      </p>
      <div
        className="segmented-control"
        role="group"
        aria-label="Destino do foco"
      >
        <button
          type="button"
          aria-pressed={category === "project"}
          className={category === "project" ? "selected" : ""}
          onClick={() => setCategory("project")}
        >
          Projeto & carreira
        </button>
        <button
          type="button"
          aria-pressed={category === "study"}
          className={category === "study" ? "selected" : ""}
          onClick={() => setCategory("study")}
        >
          Estudo
        </button>
      </div>
      <form className="focus-form" onSubmit={submit}>
        <label className="field-label" htmlFor="focus-minutes">
          Tempo dedicado (minutos)
          <input
            id="focus-minutes"
            type="number"
            inputMode="numeric"
            min="1"
            max={Math.min(480, 1440 - total)}
            step="1"
            required
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
          />
        </label>
        <div
          className="duration-presets"
          role="group"
          aria-label="Duração do bloco"
        >
          {[15, 25, 50, 90].map((value) => (
            <button
              key={value}
              type="button"
              disabled={total + value > 1440}
              aria-pressed={Number(minutes) === value}
              className={Number(minutes) === value ? "selected" : ""}
              onClick={() => setMinutes(String(value))}
            >
              {value} min
            </button>
          ))}
        </div>
        <label className="field-label" htmlFor="focus-outcome">
          O que avançou? <small>opcional</small>
          <textarea
            id="focus-outcome"
            rows={2}
            maxLength={240}
            placeholder="Ex.: implementei o fluxo de autenticação"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
          />
        </label>
        <button
          className="primary-button full-width"
          disabled={
            state.focusSessions.length >= 50 ||
            total + Number(minutes) > 1440 ||
            Number(minutes) < 1
          }
        >
          <Plus size={17} />
          Registrar bloco concluído
        </button>
      </form>
      <div className="sheet-section-title">
        <span>SEU FOCO DE HOJE</span>
        <strong>
          {total} / {state.targets.focusMinutes} min
        </strong>
      </div>
      {state.focusSessions.length ? (
        <div className="focus-session-list">
          {state.focusSessions
            .slice()
            .reverse()
            .map((session) => (
              <div key={session.id}>
                <Clock3 size={17} />
                <span>
                  <strong>
                    {session.minutes} min ·{" "}
                    {session.category === "study" ? "Estudo" : "Projeto"}
                  </strong>
                  <small>
                    {session.outcome || "Tempo dedicado com intenção"}
                  </small>
                </span>
                <button
                  className="icon-button"
                  aria-label={`Remover bloco de ${session.minutes} minutos`}
                  onClick={() => act({ type: "focus-remove", id: session.id })}
                >
                  <Minus size={16} />
                </button>
              </div>
            ))}
        </div>
      ) : (
        <p className="fine-print">
          Os blocos concluídos aparecerão aqui. Tempo de projeto e estudo são
          contabilizados separadamente.
        </p>
      )}
    </div>
  );
}

function downloadJson(value: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([value], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function WorkspaceSheet({ state, act, onToast, onClose }: Props) {
  const [tab, setTab] = useState<"targets" | "data">("targets"),
    [targets, setTargets] = useState<PersonalTargets>(
      structuredClone(state.targets),
    ),
    [pending, setPending] = useState<KernelState | null>(null),
    [error, setError] = useState(""),
    [confirmPersonal, setConfirmPersonal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRequest = useRef(0);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    let active = true;
    void readRecovery()
      .then((raw) => {
        if (active) setRecovery(Boolean(raw));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const submitTargets = (event: FormEvent) => {
    event.preventDefault();
    const result = targetsSchema.safeParse(targets);
    if (!result.success) {
      setError("Confira as metas. Informe ao menos um macronutriente.");
      return;
    }
    act({ type: "targets", value: result.data });
    setError("");
    onToast("Metas atualizadas para o seu ritmo.");
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    const request = ++importRequest.current;
    setPending(null);
    setError("");
    if (file.size > MAX_BACKUP_BYTES) {
      setError("Use um backup JSON de até 2 MB.");
      return;
    }
    let contents: string;
    try {
      contents = await file.text();
    } catch {
      if (request !== importRequest.current) return;
      setError(
        "Não foi possível ler este arquivo. Seus registros foram mantidos.",
      );
      return;
    }
    if (request !== importRequest.current) return;
    const result = parseStoredState(contents);
    if (!result) {
      setError(
        "Este arquivo não é um backup válido do KernelHub. Seus dados atuais foram mantidos.",
      );
      return;
    }
    setPending(result);
  };
  return (
    <div>
      <div
        className="segmented-control"
        role="group"
        aria-label="Configurações pessoais"
      >
        <button
          aria-pressed={tab === "targets"}
          className={tab === "targets" ? "selected" : ""}
          onClick={() => setTab("targets")}
        >
          Minhas metas
        </button>
        <button
          aria-pressed={tab === "data"}
          className={tab === "data" ? "selected" : ""}
          onClick={() => setTab("data")}
        >
          Dados & privacidade
        </button>
      </div>
      {tab === "targets" ? (
        <form onSubmit={submitTargets} className="targets-form">
          <p className="sheet-lead">
            Escolha metas que façam sentido para a sua rotina. Os valores
            iniciais são exemplos.
          </p>
          <div className="metric-input-grid">
            {(
              [
                {
                  key: "waterMl",
                  label: "Água (ml)",
                  min: 250,
                  max: 10000,
                  step: 50,
                },
                {
                  key: "focusMinutes",
                  label: "Foco (min)",
                  min: 15,
                  max: 720,
                  step: 1,
                },
                {
                  key: "sleepHours",
                  label: "Sono (horas)",
                  min: 1,
                  max: 16,
                  step: 0.5,
                },
                {
                  key: "runKm",
                  label: "Corrida (km)",
                  min: 0.5,
                  max: 100,
                  step: 0.5,
                },
              ] as const
            ).map((field) => (
              <label htmlFor={`target-${field.key}`} key={field.key}>
                {field.label}
                <input
                  id={`target-${field.key}`}
                  type="number"
                  inputMode="decimal"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  required
                  value={targets[field.key]}
                  onChange={(event) =>
                    setTargets({
                      ...targets,
                      [field.key]: Number(event.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <div className="metric-input-grid macro-target-grid">
            {(
              [
                { key: "protein", label: "Proteína (g)", max: 500 },
                { key: "carbs", label: "Carbo (g)", max: 1000 },
                { key: "fat", label: "Gordura (g)", max: 300 },
              ] as const
            ).map((field) => (
              <label htmlFor={`target-${field.key}`} key={field.key}>
                {field.label}
                <input
                  id={`target-${field.key}`}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max={field.max}
                  step="1"
                  required
                  value={targets.macros[field.key]}
                  onChange={(event) =>
                    setTargets({
                      ...targets,
                      macros: {
                        ...targets.macros,
                        [field.key]: Number(event.target.value),
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
          <button className="primary-button full-width">
            <Check size={17} />
            Salvar minhas metas
          </button>
          <p className="fine-print">
            Metas não são prescrições. O app organiza o que você escolheu
            acompanhar.
          </p>
        </form>
      ) : (
        <div>
          <div className="privacy-status">
            <ShieldCheck size={23} />
            <div>
              <strong>Seus registros ficam com você.</strong>
              <p>
                Armazenados neste navegador. Sem conta, anúncios ou
                sincronização automática.
              </p>
            </div>
          </div>
          <div className="backup-actions">
            <button
              className="secondary-button"
              onClick={() => {
                downloadJson(
                  JSON.stringify(state, null, 2),
                  `kernelhub-${state.day}.json`,
                );
                onToast("Backup preparado para download.");
              }}
            >
              <ArrowDownToLine size={17} />
              Exportar backup
            </button>
            <button
              className="secondary-button"
              onClick={() => fileRef.current?.click()}
            >
              <ArrowUpFromLine size={17} />
              Importar backup
            </button>
          </div>
          {recovery && (
            <button
              className="secondary-button full-width"
              onClick={async () => {
                try {
                  const raw = await readRecovery();
                  if (raw) downloadJson(raw, "kernelhub-recuperacao.json");
                } catch {
                  onToast("O navegador bloqueou o arquivo de recuperação.");
                }
              }}
            >
              Exportar arquivo de recuperação
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Arquivo de backup"
            onChange={(event) => {
              void importFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {pending && (
            <div className="inline-confirm" role="alert">
              <strong>Restaurar este backup?</strong>
              <p>
                Ele substituirá os registros deste dispositivo. Exporte os dados
                atuais antes, se quiser preservá-los.
              </p>
              <div>
                <button
                  className="secondary-button"
                  onClick={() => setPending(null)}
                >
                  Cancelar
                </button>
                <button
                  className="primary-button"
                  onClick={() => {
                    act({ type: "restore", state: pending });
                    setPending(null);
                    onToast("Backup restaurado neste dispositivo.");
                    onClose();
                  }}
                >
                  Restaurar registros
                </button>
              </div>
            </div>
          )}
          <div className="settings-install">
            <Smartphone size={22} />
            <div>
              <strong>Adicionar à Tela de Início</strong>
              <p>
                No Safari do iPhone: Compartilhar → Adicionar à Tela de Início.
                A primeira visita online prepara o modo offline.
              </p>
            </div>
          </div>
          {state.mode === "demo" && (
            <div className="personal-start">
              <strong>Pronto para começar o seu espaço?</strong>
              <p>
                Comece com os registros do KernelHub vazios. Armário de
                skincare, fotos, GitHub e importação de saúde têm armazenamento
                próprio e não são apagados.
              </p>
              {confirmPersonal ? (
                <div className="inline-confirm" role="alert">
                  <p>
                    Os dados demonstrativos e os registros feitos neste modo
                    serão substituídos. Exporte um backup antes de continuar, se
                    precisar.
                  </p>
                  <div>
                    <button
                      className="secondary-button"
                      onClick={() => setConfirmPersonal(false)}
                    >
                      Cancelar
                    </button>
                    <button
                      className="primary-button"
                      onClick={() => {
                        act({ type: "start-personal" });
                        onToast(
                          "Seu espaço está pronto para o primeiro avanço.",
                        );
                        onClose();
                      }}
                    >
                      Começar sem exemplos
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="primary-button full-width"
                  onClick={() => setConfirmPersonal(true)}
                >
                  Criar meu espaço pessoal
                </button>
              )}
            </div>
          )}
          <p className="fine-print">
            Apagar os dados do navegador remove seus registros; guarde um backup
            fora do dispositivo.
          </p>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
