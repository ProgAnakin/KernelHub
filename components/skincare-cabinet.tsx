"use client";

import { useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Clock3,
  DoorOpen,
  FlaskConical,
  Moon,
  Plus,
  RotateCcw,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import type { JournalEntry } from "@/types/kernel";
import {
  productsForPeriod,
  routineMetrics,
  type Period,
  type Product,
  type ProductSnapshot,
} from "@/lib/skincare";
import { useSkincare } from "@/lib/use-skincare";
import { SkincareHistory, SkincarePhotos } from "./skincare-history";
import { SPRING } from "./ui";

type Skin = ReturnType<typeof useSkincare>;
const KINDS: Record<Product["kind"], string> = {
  cleanser: "Limpeza",
  serum: "Sérum",
  moisturizer: "Hidratante",
  sunscreen: "Protetor solar",
  other: "Outro cuidado",
};
const PERIODS: { id: Period; label: string }[] = [
  { id: "am", label: "Manhã (AM)" },
  { id: "pm", label: "Noite (PM)" },
];
function timeLabel(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
function dayLabel(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function SkincareCabinet({
  legacyEntries = [],
}: {
  legacyEntries?: JournalEntry[];
}) {
  const [view, setView] = useState<
    "routine" | "products" | "history" | "photos"
  >("routine");
  const skin = useSkincare({
    history: view === "history" || view === "photos",
  });
  const reduced = useReducedMotion();
  const [doorsOpen, setDoorsOpen] = useState(true);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [transition, setTransition] = useState<string | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const active = productsForPeriod(skin.settings, skin.period);
  const busy = !skin.hydrated || skin.busy;
  const selectProduct = (id: string) => {
    setHighlight(id);
    const row = Array.from(
      list.current?.querySelectorAll<HTMLElement>("[data-product-id]") ?? [],
    ).find((item) => item.dataset.productId === id);
    row?.scrollIntoView({
      behavior: reduced ? "instant" : "smooth",
      block: "nearest",
    });
    row
      ?.querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true });
  };
  return (
    <section
      className={`skincare-module sk-period-${skin.period}`}
      aria-label="Armário de skincare"
      aria-busy={busy}
    >
      <div className="sk-heading">
        <span className="sk-overline">
          <FlaskConical size={14} />
          SEU ARMÁRIO
        </span>
        <time dateTime={skin.day}>{dayLabel(skin.day)}</time>
      </div>
      <div className="sk-mode" role="group" aria-label="Período do skincare">
        {PERIODS.map(({ id, label }) => (
          <button
            key={id}
            aria-pressed={skin.period === id}
            className={skin.period === id ? "selected" : ""}
            disabled={!skin.hydrated}
            onClick={() => skin.setPeriod(id)}
          >
            {id === "am" ? <Sun size={17} /> : <Moon size={17} />} {label}
          </button>
        ))}
      </div>
      <div className="sk-clock-status">
        <span>
          <Clock3 size={13} />
          {skin.manual ? "Escolha manual" : "Horário local · automático"}
        </span>
        {skin.manual && (
          <button onClick={() => skin.setPeriod("auto")}>
            Seguir horário automático <RotateCcw size={13} />
          </button>
        )}
      </div>
      <p className="sk-subtle">
        {skin.manual
          ? "Sua escolha vale até a próxima transição ou meia-noite."
          : `Manhã desde 00:00. Noite a partir de ${timeLabel(skin.settings.transitionMinute)}.`}
      </p>
      {skin.error && (
        <div className="sk-error" role="alert">
          <span>{skin.error}</span>
          <button
            className="secondary-button"
            onClick={() => void skin.refresh()}
            disabled={skin.busy}
          >
            Tentar novamente
          </button>
        </div>
      )}
      <div className="sk-tabs" role="group" aria-label="Seções do skincare">
        {[
          { id: "routine", label: "A rotina" },
          { id: "products", label: "Produtos" },
          { id: "history", label: "Histórico" },
          { id: "photos", label: "Fotos" },
        ].map((tab) => (
          <button
            key={tab.id}
            aria-pressed={view === tab.id}
            onClick={() => setView(tab.id as typeof view)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {view === "routine" && (
        <div className="sk-routine-workspace">
          <div className="sk-cabinet-column">
            <div className="sk-cabinet-stage">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  className={`sk-cabinet sk-light-${skin.period}`}
                  role="group"
                  key={skin.period}
                  initial={
                    reduced ? { opacity: 1 } : { rotateY: -80, opacity: 0 }
                  }
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={reduced ? { opacity: 1 } : { rotateY: 80, opacity: 0 }}
                  transition={reduced ? { duration: 0 } : SPRING}
                  aria-label={`Armário ${skin.period.toUpperCase()}, três prateleiras`}
                >
                  <div className="sk-cabinet-light" aria-hidden="true" />
                  {[1, 2, 3].map((shelf) => (
                    <div
                      className="sk-shelf"
                      role="group"
                      key={shelf}
                      aria-label={`Prateleira ${shelf}`}
                    >
                      <span className="sk-shelf-number" aria-hidden="true">
                        0{shelf}
                      </span>
                      <div className="sk-shelf-products">
                        {active
                          .filter((p) => p.shelf === shelf)
                          .map((product) => {
                            const status =
                              skin.today.entries[skin.period][product.id]
                                ?.status ?? "pending";
                            return (
                              <button
                                key={product.id}
                                className={`sk-bottle sk-bottle-${product.kind} sk-bottle-${status}`}
                                onClick={() => selectProduct(product.id)}
                                aria-label={`Ver ${product.name} na rotina ${skin.period.toUpperCase()}`}
                                disabled={busy || !doorsOpen}
                              >
                                <span className="sk-bottle-lid" />
                                <span className="sk-bottle-body">
                                  <span
                                    className="sk-bottle-mark"
                                    aria-hidden="true"
                                  >
                                    K
                                  </span>
                                  <strong>{product.name}</strong>
                                  <small>
                                    {product.brand || KINDS[product.kind]}
                                  </small>
                                  <span
                                    className="sk-bottle-status"
                                    aria-hidden="true"
                                  >
                                    {status === "used" ? (
                                      <Check size={11} />
                                    ) : status === "skipped" ? (
                                      <X size={11} />
                                    ) : (
                                      "·"
                                    )}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        {!active.some((p) => p.shelf === shelf) && (
                          <span className="sk-shelf-empty">
                            {shelf === 2 && !active.length
                              ? "Um espaço para seus cuidados."
                              : "Espaço livre"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="sk-door-track" aria-hidden="true">
                    <motion.div
                      className="sk-door sk-door-left"
                      animate={{ x: doorsOpen ? "-99%" : "0%" }}
                      transition={reduced ? { duration: 0 } : SPRING}
                    >
                      <span />
                    </motion.div>
                    <motion.div
                      className="sk-door sk-door-right"
                      animate={{ x: doorsOpen ? "99%" : "0%" }}
                      transition={reduced ? { duration: 0 } : SPRING}
                    >
                      <span />
                    </motion.div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="sk-cabinet-controls">
              <span>
                {skin.period === "am" ? <Sun size={14} /> : <Moon size={14} />}{" "}
                {skin.period === "am" ? "Luz da manhã" : "Luz do fim do dia"}
              </span>
              <button
                onClick={() => setDoorsOpen(!doorsOpen)}
                aria-expanded={doorsOpen}
              >
                <DoorOpen size={16} />
                {doorsOpen ? "Fechar portas" : "Abrir portas"}
              </button>
            </div>
            <div
              className="sk-metrics"
              role="group"
              aria-label="Conclusão diária por período"
            >
              {PERIODS.map(({ id, label }) => {
                const m = routineMetrics(skin.today, id);
                return (
                  <div
                    key={id}
                    className={skin.period === id ? "is-current" : ""}
                  >
                    <div>
                      <span>{label}</span>
                      <strong>{m.percent}%</strong>
                    </div>
                    <div
                      className="sk-progress"
                      role="progressbar"
                      aria-label={`Conclusão ${id.toUpperCase()}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={m.percent}
                    >
                      <i style={{ width: `${m.percent}%` }} />
                    </div>
                    <b>
                      {m.used}/{m.planned} utilizados
                    </b>
                    <small>
                      {m.planned
                        ? `${m.pending} pendentes · ${m.skipped} não usados`
                        : "Sem produtos planejados"}
                    </small>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="sk-steps-column">
            <div className="sk-section-heading">
              <div>
                <h3>Sua sequência · {skin.period.toUpperCase()}</h3>
                <p>A ordem e os checks pertencem a este período.</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setView("products")}
                aria-label="Gerenciar produtos de skincare"
              >
                <Plus size={18} />
              </button>
            </div>
            {skin.today.plans[skin.period].length ? (
              <ol className="sk-routine-list" ref={list}>
                {skin.today.plans[skin.period].map((product, index) => (
                  <RoutineStep
                    key={`${skin.day}-${skin.period}-${product.id}`}
                    skin={skin}
                    product={product}
                    index={index}
                    highlighted={highlight === product.id}
                  />
                ))}
              </ol>
            ) : (
              <div className="sk-empty">
                <FlaskConical size={27} />
                <h3>Uma rotina que começa por você.</h3>
                <p>
                  Cadastre seus produtos e escolha quando usá-los. O mesmo
                  frasco pode participar da manhã e da noite.
                </p>
                <button
                  className="primary-button"
                  onClick={() => setView("products")}
                >
                  <Plus size={16} />
                  Adicionar meus produtos
                </button>
              </div>
            )}
            <details className="sk-auto-settings">
              <summary>
                Horário automático <ChevronRight size={15} />
              </summary>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const [hour, minute] = (
                    transition ?? timeLabel(skin.settings.transitionMinute)
                  )
                    .split(":")
                    .map(Number);
                  void skin.updateTransition(hour * 60 + minute).then((ok) => {
                    if (ok) setTransition(null);
                  });
                }}
              >
                <label>
                  Trocar para a noite às
                  <input
                    type="time"
                    value={
                      transition ?? timeLabel(skin.settings.transitionMinute)
                    }
                    min="00:01"
                    max="23:59"
                    required
                    onChange={(event) => setTransition(event.target.value)}
                    disabled={busy}
                  />
                </label>
                <button className="secondary-button" disabled={busy}>
                  Salvar horário
                </button>
              </form>
              <p>
                Horário deste dispositivo. À meia-noite, o armário volta para
                AM. Uma escolha manual termina na próxima mudança automática.
              </p>
            </details>
          </div>
        </div>
      )}
      {view === "products" && <Products skin={skin} />}
      {view === "history" && (
        <SkincareHistory skin={skin} legacyEntries={legacyEntries} />
      )}
      {view === "photos" && <SkincarePhotos skin={skin} />}
      <p className="sk-local-note">
        Produtos, checks e fotos ficam neste navegador, separados do backup
        geral. O histórico de skincare não é apagado ao virar o dia.
      </p>
    </section>
  );
}

function RoutineStep({
  skin,
  product,
  index,
  highlighted,
}: {
  skin: Skin;
  product: ProductSnapshot;
  index: number;
  highlighted: boolean;
}) {
  const entry = skin.today.entries[skin.period][product.id];
  const status = entry?.status ?? "pending";
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState(entry?.reason ?? "");
  const ids = productsForPeriod(skin.settings, skin.period).map((p) => p.id);
  const position = ids.indexOf(product.id);
  const move = (delta: number) => {
    const next = [...ids];
    [next[position], next[position + delta]] = [
      next[position + delta],
      next[position],
    ];
    void skin.reorder(skin.period, next);
  };
  const suffix = `${product.name} (${skin.period.toUpperCase()})`;
  return (
    <li
      data-product-id={product.id}
      className={`sk-step ${highlighted ? "is-highlighted" : ""} sk-step-${status}`}
    >
      <div className="sk-step-heading">
        <span className="sk-step-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <h4>{product.name}</h4>
          <p>
            {product.brand ? `${product.brand} · ` : ""}
            {KINDS[product.kind]}
          </p>
        </div>
        <span className={`sk-status sk-status-${status}`}>
          {status === "used"
            ? "Usado"
            : status === "skipped"
              ? "Não usado"
              : "Pendente"}
        </span>
      </div>
      <div className="sk-step-actions">
        <button
          aria-label={`Usar ${suffix}`}
          aria-pressed={status === "used"}
          disabled={skin.busy}
          onClick={() => {
            void skin.setCheck({
              period: skin.period,
              productId: product.id,
              status: "used",
            });
            setReasonOpen(false);
          }}
        >
          <Check size={16} />
          Usado
        </button>
        <button
          aria-label={`Não usar ${suffix}`}
          aria-pressed={status === "skipped"}
          disabled={skin.busy}
          onClick={() => {
            setReason(entry?.reason ?? "");
            setReasonOpen(!reasonOpen);
          }}
        >
          <X size={16} />
          Não usei
        </button>
        {position >= 0 && (
          <div className="sk-order-buttons">
            <button
              className="icon-button"
              aria-label={`Subir ${suffix}`}
              disabled={skin.busy || position === 0}
              onClick={() => move(-1)}
            >
              <ArrowUp size={15} />
            </button>
            <button
              className="icon-button"
              aria-label={`Descer ${suffix}`}
              disabled={skin.busy || position === ids.length - 1}
              onClick={() => move(1)}
            >
              <ArrowDown size={15} />
            </button>
          </div>
        )}
      </div>
      {status === "skipped" && entry?.reason && !reasonOpen && (
        <p className="sk-reason">{entry.reason}</p>
      )}
      {reasonOpen && (
        <form
          className="sk-reason-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (
              await skin.setCheck({
                period: skin.period,
                productId: product.id,
                status: "skipped",
                reason,
              })
            )
              setReasonOpen(false);
          }}
        >
          <label>
            Motivo para não usar {product.name}
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="Opcional. O que aconteceu hoje?"
              rows={2}
            />
          </label>
          <div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setReasonOpen(false)}
            >
              Cancelar
            </button>
            <button className="primary-button" disabled={skin.busy}>
              Salvar não uso
            </button>
          </div>
        </form>
      )}
      {status !== "pending" && (
        <button
          className="sk-reset"
          aria-label={`Voltar a pendente: ${suffix}`}
          disabled={skin.busy}
          onClick={() =>
            void skin.setCheck({
              period: skin.period,
              productId: product.id,
              status: "pending",
            })
          }
        >
          <RotateCcw size={13} />
          Voltar a pendente
        </button>
      )}
      {position < 0 && (
        <p className="sk-subtle">
          Produto retirado da configuração atual. Registro preservado para este
          dia.
        </p>
      )}
    </li>
  );
}

function Products({ skin }: { skin: Skin }) {
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [removing, setRemoving] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [kind, setKind] = useState<Product["kind"]>("cleanser");
  const [shelf, setShelf] = useState<1 | 2 | 3>(1);
  const [am, setAm] = useState(true);
  const [pm, setPm] = useState(true);
  const [formError, setFormError] = useState("");
  const edit = (product: Product | null) => {
    setEditing(product);
    setName(product?.name ?? "");
    setBrand(product?.brand ?? "");
    setKind(product?.kind ?? "cleanser");
    setShelf(product?.shelf ?? 1);
    setAm(product ? product.periods.includes("am") : true);
    setPm(product ? product.periods.includes("pm") : true);
    setFormError("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!am && !pm) {
      setFormError("Escolha pelo menos um período para este produto.");
      return;
    }
    const periods: Period[] = [
      ...(am ? ["am" as const] : []),
      ...(pm ? ["pm" as const] : []),
    ];
    if (
      await skin.saveProduct({
        ...editing,
        id: editing?.id,
        name: name.trim(),
        brand: brand.trim(),
        kind,
        shelf,
        periods,
      })
    ) {
      setEditing(undefined);
      setFormError("");
    }
  };
  return (
    <div className="sk-products">
      <div className="sk-section-heading">
        <div>
          <h3>Um frasco. Dois momentos.</h3>
          <p>Cadastro único, com sequência independente para AM e PM.</p>
        </div>
        <button
          className="icon-button"
          aria-label="Adicionar produto"
          onClick={() => edit(null)}
          disabled={skin.busy}
        >
          <Plus size={18} />
        </button>
      </div>
      {editing !== undefined && (
        <form className="sk-product-form" onSubmit={submit}>
          <h4>{editing ? "Editar produto" : "Novo produto"}</h4>
          <label>
            Nome do produto
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              required
              autoComplete="off"
            />
          </label>
          <label>
            Marca (opcional)
            <input
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              maxLength={80}
              autoComplete="off"
            />
          </label>
          <div className="sk-form-grid">
            <label>
              Tipo de produto
              <select
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as Product["kind"])
                }
              >
                {Object.entries(KINDS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Prateleira
              <select
                value={shelf}
                onChange={(event) =>
                  setShelf(Number(event.target.value) as 1 | 2 | 3)
                }
              >
                {[1, 2, 3].map((number) => (
                  <option key={number} value={number}>
                    {number}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset>
            <legend>Quando faz parte da rotina?</legend>
            <label>
              <input
                type="checkbox"
                checked={am}
                onChange={(event) => setAm(event.target.checked)}
              />
              Usar na manhã (AM)
            </label>
            <label>
              <input
                type="checkbox"
                checked={pm}
                onChange={(event) => setPm(event.target.checked)}
              />
              Usar na noite (PM)
            </label>
          </fieldset>
          {formError && (
            <p className="sk-error" role="alert">
              {formError}
            </p>
          )}
          <div className="sk-form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => setEditing(undefined)}
              disabled={skin.busy}
            >
              Cancelar edição
            </button>
            <button className="primary-button" disabled={skin.busy}>
              Salvar produto
            </button>
          </div>
        </form>
      )}
      {!skin.settings.products.length && editing === undefined && (
        <div className="sk-empty">
          <FlaskConical size={28} />
          <h3>O armário ainda está vazio.</h3>
          <p>
            Adicione o que você já usa. Você escolhe a ordem; o app acompanha os
            registros.
          </p>
          <button className="primary-button" onClick={() => edit(null)}>
            <Plus size={16} />
            Adicionar primeiro produto
          </button>
        </div>
      )}
      <div className="sk-product-library">
        {skin.settings.products
          .filter((p) => !p.archived)
          .map((product) => (
            <div key={product.id}>
              <span className={`sk-library-icon sk-library-${product.kind}`}>
                <FlaskConical size={20} />
              </span>
              <div>
                <strong>{product.name}</strong>
                <small>
                  {product.brand ? `${product.brand} · ` : ""}
                  {product.periods.map((p) => p.toUpperCase()).join(" + ")} ·
                  prateleira {product.shelf}
                </small>
              </div>
              <button
                className="sk-text-button"
                onClick={() => edit(product)}
                disabled={skin.busy}
                aria-label={`Editar ${product.name}`}
              >
                Editar
              </button>
              <button
                className="icon-button"
                onClick={() => setRemoving(product.id)}
                disabled={skin.busy}
                aria-label={`Arquivar ${product.name}`}
              >
                <Trash2 size={16} />
              </button>
              {removing === product.id && (
                <div className="sk-inline-confirm" role="alert">
                  <p>
                    Arquivar {product.name}? O histórico e os registros já
                    feitos serão preservados.
                  </p>
                  <div>
                    <button
                      className="secondary-button"
                      onClick={() => setRemoving(null)}
                    >
                      Manter produto
                    </button>
                    <button
                      className="primary-button"
                      disabled={skin.busy}
                      onClick={async () => {
                        if (await skin.archiveProduct(product.id)) {
                          setRemoving(null);
                          if (editing?.id === product.id) setEditing(undefined);
                        }
                      }}
                    >
                      Confirmar arquivamento
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>
      {skin.settings.products.some((p) => p.archived) && (
        <details className="sk-archive">
          <summary>Produtos arquivados</summary>
          {skin.settings.products
            .filter((p) => p.archived)
            .map((product) => (
              <div key={product.id}>
                <strong>{product.name}</strong>
                <button
                  className="sk-text-button"
                  disabled={skin.busy}
                  onClick={() => void skin.saveProduct({ ...product })}
                  aria-label={`Restaurar ${product.name}`}
                >
                  Restaurar produto
                </button>
              </div>
            ))}
        </details>
      )}
    </div>
  );
}
