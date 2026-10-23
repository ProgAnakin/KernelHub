"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  CalendarDays,
  Camera,
  Check,
  Clock3,
  ImagePlus,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
} from "lucide-react";
import {
  isSkincareDay,
  skincareDay,
  skincareConsistency,
  skincareHistory,
  type CheckStatus,
  type DayLog,
  type Period,
} from "@/lib/skincare";
import type { useSkincare } from "@/lib/use-skincare";
import type { SkincarePhoto } from "@/lib/skincare-storage";
import type { JournalEntry } from "@/types/kernel";

type Skin = ReturnType<typeof useSkincare>;
type HistoryRow = ReturnType<typeof skincareHistory>[number];
const STATUS: Record<CheckStatus, string> = {
  pending: "Pendente",
  used: "Usado",
  skipped: "Não usado",
};
const PERIOD: Record<Period, string> = { am: "Manhã · AM", pm: "Noite · PM" };
const PAGE_SIZE = 30;

function dayLabel(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 12).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function rowKey(row: HistoryRow) {
  return `${row.day}:${row.period}:${row.product.id}`;
}
function combinedLogs(skin: Skin): DayLog[] {
  return [
    ...skin.history.filter((log) => log.day !== skin.today.day),
    skin.today,
  ];
}
function HistoryRows({
  rows,
  skin,
  limit = PAGE_SIZE,
}: {
  rows: HistoryRow[];
  skin: Skin;
  limit?: number;
}) {
  const [visible, setVisible] = useState(limit);
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState<CheckStatus>("pending");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const formId = useId();
  if (!rows.length)
    return (
      <div className="skh-empty">
        <CalendarDays size={25} />
        <strong>Nenhum registro neste recorte.</strong>
        <p>
          Os produtos planejados aparecem como pendentes até você registrar uma
          decisão.
        </p>
      </div>
    );
  return (
    <>
      <div className="skh-history-list">
        {rows.slice(0, visible).map((row) => {
          const key = rowKey(row);
          return (
            <article className="skh-history-row" key={key}>
              <div className="skh-history-title">
                <span className={`skh-period-icon ${row.period}`}>
                  {row.period === "am" ? <Sun size={17} /> : <Moon size={17} />}
                </span>
                <div>
                  <strong>{row.product.name}</strong>
                  <small>{row.product.brand || "Produto do seu armário"}</small>
                </div>
                <span className={`skh-status ${row.status}`}>
                  {STATUS[row.status]}
                </span>
              </div>
              <div className="skh-history-meta">
                <time dateTime={row.day}>{dayLabel(row.day)}</time>
                <span>{PERIOD[row.period]}</span>
              </div>
              {row.reason && <p className="skh-reason">Motivo: {row.reason}</p>}
              {editing === key ? (
                <form
                  className="skh-correction"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setError("");
                    if (
                      await skin.setCheck({
                        day: row.day,
                        period: row.period,
                        productId: row.product.id,
                        status,
                        reason,
                      })
                    )
                      setEditing(null);
                    else
                      setError(
                        "A correção não foi salva. Os registros anteriores foram mantidos.",
                      );
                  }}
                >
                  <label htmlFor={`${formId}-status`}>
                    Status de {row.product.name}
                    <select
                      id={`${formId}-status`}
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value as CheckStatus)
                      }
                    >
                      {Object.entries(STATUS).map(([value, label]) => (
                        <option value={value} key={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {status === "skipped" && (
                    <label htmlFor={`${formId}-reason`}>
                      Motivo do não uso <small>opcional</small>
                      <textarea
                        id={`${formId}-reason`}
                        value={reason}
                        maxLength={500}
                        rows={2}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </label>
                  )}
                  <div className="skh-button-row">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setEditing(null)}
                      disabled={skin.busy}
                    >
                      Cancelar
                    </button>
                    <button className="primary-button" disabled={skin.busy}>
                      <Check size={15} />
                      Salvar correção
                    </button>
                  </div>
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                </form>
              ) : (
                <button
                  className="skh-link"
                  disabled={!skin.hydrated || skin.busy}
                  onClick={() => {
                    setEditing(key);
                    setStatus(row.status);
                    setReason(row.reason);
                    setError("");
                  }}
                  aria-label={`Corrigir ${row.product.name}, ${PERIOD[row.period]}, ${dayLabel(row.day)}`}
                >
                  Corrigir registro
                </button>
              )}
            </article>
          );
        })}
      </div>
      {rows.length > visible && (
        <button
          className="secondary-button full-width"
          onClick={() => setVisible((count) => count + PAGE_SIZE)}
        >
          Mostrar mais registros ({rows.length - visible})
        </button>
      )}
      <p className="skh-footnote">
        {Math.min(visible, rows.length)} de {rows.length} registros. Uma
        correção atualiza o mesmo produto, data e período.
      </p>
    </>
  );
}

export function SkincareHistory({
  skin,
  legacyEntries = [],
}: {
  skin: Skin;
  legacyEntries?: JournalEntry[];
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [period, setPeriod] = useState<Period | "">("");
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState<CheckStatus | "">("");
  const [legacyVisible, setLegacyVisible] = useState(30);
  const id = useId();
  const logs = useMemo(() => combinedLogs(skin), [skin.history, skin.today]);
  const consistency = useMemo(() => skincareConsistency(logs), [logs]);
  const products = useMemo(() => {
    const all = new Map<string, string>();
    for (const log of logs)
      for (const mode of ["am", "pm"] as const)
        for (const product of log.plans[mode])
          all.set(product.id, product.name);
    return [...all].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [logs]);
  const invalidDate = Boolean(
    (from && !isSkincareDay(from)) || (to && !isSkincareDay(to)),
  );
  const invalidRange = Boolean(from && to && from > to);
  const filterError = invalidDate
    ? "Informe datas válidas com ano de quatro dígitos."
    : invalidRange
      ? "A data inicial deve ser anterior ou igual à data final."
      : "";
  const rows = useMemo(
    () =>
      filterError
        ? []
        : skincareHistory(logs, {
            from: from || undefined,
            to: to || undefined,
            period: period || undefined,
            productId: productId || undefined,
            status: status || undefined,
          }),
    [logs, from, to, period, productId, status, filterError],
  );
  const legacy = legacyEntries.filter((entry) => {
    if (
      filterError ||
      productId ||
      status ||
      !/skincare|proteção solar/i.test(entry.title)
    )
      return false;
    const day = skincareDay(new Date(entry.createdAt));
    const entryPeriod = /manhã|solar/i.test(entry.title)
      ? "am"
      : /noite/i.test(entry.title)
        ? "pm"
        : null;
    return (
      (!from || day >= from) &&
      (!to || day <= to) &&
      (!period || period === entryPeriod)
    );
  });
  return (
    <section className="skh-history" aria-label="Histórico de skincare">
      <div className="skh-intro">
        <Clock3 size={20} />
        <div>
          <h3>Consistência com contexto.</h3>
          <p>
            Manhã e noite têm registros próprios. Pendente não significa que
            você deixou de usar.
          </p>
        </div>
      </div>
      <div
        className="skh-consistency"
        role="group"
        aria-label="Consistência das rotinas"
      >
        {(["am", "pm", "both"] as const).map((key) => (
          <div key={key}>
            <span>
              {key === "both" ? "Dias planejados completos" : PERIOD[key]}
            </span>
            <strong>
              {consistency[key].completedDays}
              <small>/{consistency[key].plannedDays} dias</small>
            </strong>
            <p>
              {consistency[key].plannedDays
                ? `${consistency[key].percent}% dos dias planejados`
                : "Sem dias planejados"}
            </p>
          </div>
        ))}
      </div>
      <p className="skh-footnote">
        O denominador inclui somente dias com planejamento salvo. Dias sem
        registro não viram faltas nem conclusões.
      </p>
      <div
        className="skh-filters"
        role="group"
        aria-label="Filtrar histórico de skincare"
      >
        <label htmlFor={`${id}-from`}>
          De
          <input
            id={`${id}-from`}
            type="date"
            max={skin.day}
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label htmlFor={`${id}-to`}>
          Até
          <input
            id={`${id}-to`}
            type="date"
            max={skin.day}
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
        <label htmlFor={`${id}-period`}>
          Período
          <select
            id={`${id}-period`}
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period | "")}
          >
            <option value="">AM e PM</option>
            <option value="am">Manhã · AM</option>
            <option value="pm">Noite · PM</option>
          </select>
        </label>
        <label htmlFor={`${id}-product`}>
          Produto
          <select
            id={`${id}-product`}
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            <option value="">Todos os produtos</option>
            {products.map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-status`}>
          Status
          <select
            id={`${id}-status`}
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as CheckStatus | "")
            }
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="skh-clear-filters"
          onClick={() => {
            setFrom("");
            setTo("");
            setPeriod("");
            setProductId("");
            setStatus("");
          }}
        >
          Limpar filtros
        </button>
      </div>
      {filterError ? (
        <p className="form-error" role="alert">
          {filterError}
        </p>
      ) : (
        <HistoryRows
          key={`${from}/${to}/${period}/${productId}/${status}`}
          rows={rows}
          skin={skin}
        />
      )}
      {legacy.length > 0 && (
        <details className="skh-legacy">
          <summary>Registros anteriores do checklist ({legacy.length})</summary>
          <p>
            Estes registros agregados foram preservados. Eles não identificam
            produtos e não entram nas métricas do armário.
          </p>
          {legacy.slice(0, legacyVisible).map((entry) => (
            <div key={entry.id}>
              <strong>{entry.title}</strong>
              <span>{entry.detail}</span>
              <time dateTime={entry.createdAt}>
                {new Date(entry.createdAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
          ))}
          {legacy.length > legacyVisible && (
            <button
              className="skh-link"
              onClick={() => setLegacyVisible((count) => count + 30)}
            >
              Mostrar registros anteriores ({legacy.length - legacyVisible})
            </button>
          )}
        </details>
      )}
    </section>
  );
}

/** Re-encoding removes file metadata; original bytes never enter the photo store. */
async function normalisePhoto(file: File): Promise<Blob> {
  if (!file.size || file.size > 5 * 1024 * 1024)
    throw new Error("Escolha uma foto JPEG, PNG ou WebP de até 5 MB.");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png =
    bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!(
    (file.type === "image/jpeg" && jpeg) ||
    (file.type === "image/png" && png) ||
    (file.type === "image/webp" && webp)
  ))
    throw new Error(
      "Formato não suportado. Use uma foto JPEG, PNG ou WebP; SVG e HEIC precisam ser convertidos primeiro.",
    );
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => {
        img.src = "";
        reject(
          new Error("A foto demorou demais para abrir. Tente outra imagem."),
        );
      }, 10000);
      img.onload = () => {
        clearTimeout(timer);
        resolve(img);
      };
      img.onerror = () => {
        clearTimeout(timer);
        reject(
          new Error(
            "Não foi possível abrir esta foto. O arquivo anterior foi preservado.",
          ),
        );
      };
      img.decoding = "async";
      img.src = url;
    });
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 50_000_000
    )
      throw new Error(
        "A imagem excede o limite de 50 megapixels. Escolha uma versão menor.",
      );
    const scale = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Este navegador não conseguiu preparar a foto.");
    context.fillStyle = "#111410";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (result) =>
          result
            ? resolve(result)
            : reject(new Error("A foto não pôde ser preparada.")),
        "image/jpeg",
        0.85,
      ),
    );
    if (blob.size > 5 * 1024 * 1024)
      throw new Error(
        "A foto preparada ainda é muito grande. Escolha uma versão menor.",
      );
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
function PhotoImage({
  photo,
  getPhoto,
}: {
  photo: SkincarePhoto;
  getPhoto: Skin["getPhoto"];
}) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    setSrc("");
    setError(false);
    void getPhoto(photo.id)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setError(true);
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.id, getPhoto]);
  return src ? (
    <img
      src={src}
      width={320}
      height={320}
      loading="lazy"
      decoding="async"
      onError={() => {
        setSrc("");
        setError(true);
      }}
      alt={`Acompanhamento de skincare em ${dayLabel(photo.day)}${photo.note ? `: ${photo.note}` : ""}`}
    />
  ) : (
    <div className="skh-photo-placeholder">
      <Camera size={24} />
      <span>
        {error ? "Foto indisponível neste dispositivo" : "Abrindo foto…"}
      </span>
    </div>
  );
}
export function SkincarePhotos({ skin }: { skin: Skin }) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [date, setDate] = useState(skin.day);
  const [dateTouched, setDateTouched] = useState(false);
  const currentDay = useRef(skin.day);
  currentDay.current = skin.day;
  const uploading = useRef(false);
  useEffect(() => {
    if (!dateTouched) setDate(skin.day);
  }, [skin.day, dateTouched]);
  const [note, setNote] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [visible, setVisible] = useState(12);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const logs = useMemo(() => combinedLogs(skin), [skin.history, skin.today]);
  const firstPhoto = skin.photos.find((photo) => photo.id === first);
  const lastPhoto = skin.photos.find((photo) => photo.id === last);
  const range =
    firstPhoto &&
    lastPhoto &&
    first !== last &&
    isSkincareDay(firstPhoto.day) &&
    isSkincareDay(lastPhoto.day)
      ? [firstPhoto.day, lastPhoto.day].sort()
      : null;
  const rows = useMemo(
    () =>
      range ? skincareHistory(logs, { from: range[0], to: range[1] }) : [],
    [logs, range?.[0], range?.[1]],
  );
  const photoGroups = useMemo(() => {
    const groups = new Map<string, SkincarePhoto[]>();
    for (const photo of skin.photos.slice(0, visible)) {
      const items = groups.get(photo.day) ?? [];
      items.push(photo);
      groups.set(photo.day, items);
    }
    return [...groups].sort((a, b) => b[0].localeCompare(a[0]));
  }, [skin.photos, visible]);
  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (uploading.current) return;
    const selectedFile = file;
    const selectedDate = date;
    const selectedNote = note.trim();
    setError("");
    setSaved(false);
    if (!selectedFile) {
      setError("Escolha uma foto antes de salvar.");
      return;
    }
    if (!isSkincareDay(selectedDate) || selectedDate > currentDay.current) {
      setError("Escolha a data da foto, até o dia de hoje.");
      return;
    }
    uploading.current = true;
    setPreparing(true);
    try {
      const prepared = await normalisePhoto(selectedFile);
      if (await skin.addPhoto(prepared, selectedDate, selectedNote)) {
        setFile(null);
        setNote("");
        setDateTouched(false);
        setDate(currentDay.current);
        if (fileInput.current) fileInput.current.value = "";
        setSaved(true);
      } else
        setError(
          "A foto não foi salva. Verifique o armazenamento e tente novamente.",
        );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível preparar a foto.",
      );
    } finally {
      uploading.current = false;
      setPreparing(false);
    }
  };
  const busy = skin.busy || preparing;
  return (
    <section
      className="skh-photos"
      aria-label="Fotos de acompanhamento de skincare"
    >
      <div className="skh-intro">
        <Camera size={21} />
        <div>
          <h3>Sua evolução, por data.</h3>
          <p>
            Guarde fotos e consulte o que foi usado entre elas, sem análises
            clínicas automáticas.
          </p>
        </div>
      </div>
      <form
        className="skh-photo-form"
        onSubmit={(event) => void upload(event)}
        aria-busy={preparing}
      >
        <label htmlFor={`${id}-file`}>
          Foto de acompanhamento
          <input
            id={`${id}-file`}
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError("");
              setSaved(false);
            }}
          />
        </label>
        <div className="skh-photo-fields">
          <label htmlFor={`${id}-date`}>
            Data da foto
            <input
              id={`${id}-date`}
              type="date"
              value={date}
              max={skin.day}
              required
              disabled={busy}
              onChange={(event) => {
                setDateTouched(true);
                setDate(event.target.value);
              }}
            />
          </label>
          <label htmlFor={`${id}-note`}>
            Nota <small>opcional</small>
            <input
              id={`${id}-note`}
              value={note}
              maxLength={500}
              disabled={busy}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ex.: mesma luz, sem filtro"
            />
          </label>
        </div>
        <button
          className="primary-button full-width"
          disabled={busy || !skin.hydrated}
        >
          <ImagePlus size={17} />
          {preparing ? "Preparando foto…" : "Salvar foto"}
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="skh-saved" role="status">
            <Check size={16} />
            Foto salva neste dispositivo.
          </p>
        )}
      </form>
      <p className="skh-footnote skh-privacy">
        <ShieldCheck size={14} />
        Fotos locais, redimensionadas até 1600 px e regravadas sem os metadados
        do arquivo original. Limite de entrada: 5 MB. Elas não entram no backup
        geral do KernelHub.
      </p>
      {!skin.photos.length && (
        <div className="skh-empty">
          <Camera size={28} />
          <strong>Seu primeiro ponto de comparação.</strong>
          <p>
            Adicione uma foto com data. O acompanhamento fica neste dispositivo.
          </p>
        </div>
      )}
      <div className="skh-photo-groups">
        {photoGroups.map(([day, photos]) => (
          <section key={day} aria-label={`Fotos de ${dayLabel(day)}`}>
            <h4>
              <CalendarDays size={15} />
              <time dateTime={day}>{dayLabel(day)}</time>
            </h4>
            <div className="skh-photo-grid">
              {photos.map((photo) => (
                <article className="skh-photo" key={photo.id}>
                  <PhotoImage photo={photo} getPhoto={skin.getPhoto} />
                  <div>
                    {photo.note && <p>{photo.note}</p>}
                    <button
                      className="skh-photo-remove"
                      disabled={busy}
                      onClick={() => setRemoving(photo.id)}
                      aria-label={`Remover foto de ${dayLabel(photo.day)}${photo.note ? `: ${photo.note}` : ""}`}
                    >
                      <Trash2 size={15} />
                      Remover
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      {skin.photos.length > visible && (
        <button
          className="secondary-button full-width"
          onClick={() => setVisible((count) => count + 12)}
        >
          Mostrar mais fotos ({skin.photos.length - visible})
        </button>
      )}
      {removing && (
        <div className="inline-confirm" role="alert">
          <strong>Remover esta foto?</strong>
          <p>
            A imagem será excluída deste dispositivo. Os registros de produtos e
            rotinas serão preservados.
          </p>
          <div>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              disabled={busy}
              onClick={async () => {
                if (await skin.removePhoto(removing)) {
                  if (first === removing) setFirst("");
                  if (last === removing) setLast("");
                  setRemoving(null);
                } else
                  setError("Não foi possível remover a foto. Tente novamente.");
              }}
            >
              Confirmar remoção da foto
            </button>
          </div>
        </div>
      )}
      {skin.photos.length >= 2 && (
        <div className="skh-photo-comparison">
          <h3>O que aconteceu entre as fotos?</h3>
          <p>Selecione dois registros. O intervalo inclui as duas datas.</p>
          <div className="skh-photo-fields">
            <label htmlFor={`${id}-first`}>
              Primeira foto
              <select
                id={`${id}-first`}
                value={first}
                onChange={(event) => setFirst(event.target.value)}
              >
                <option value="">Escolher uma foto</option>
                {skin.photos.map((photo) => (
                  <option key={photo.id} value={photo.id}>
                    {dayLabel(photo.day)} ·{" "}
                    {photo.note ||
                      new Date(photo.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${id}-last`}>
              Segunda foto
              <select
                id={`${id}-last`}
                value={last}
                onChange={(event) => setLast(event.target.value)}
              >
                <option value="">Escolher outra foto</option>
                {skin.photos.map((photo) => (
                  <option key={photo.id} value={photo.id}>
                    {dayLabel(photo.day)} ·{" "}
                    {photo.note ||
                      new Date(photo.createdAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {first && last && first === last && (
            <p className="skh-footnote">
              Escolha duas fotos diferentes para consultar o intervalo.
            </p>
          )}
          {range && (
            <div
              className="skh-range-results"
              role="region"
              aria-label="Rotinas entre fotos"
            >
              <div className="skh-range-heading">
                <CalendarDays size={17} />
                <strong>
                  {dayLabel(range[0])} — {dayLabel(range[1])}
                </strong>
              </div>
              <div className="skh-range-summary">
                {(["am", "pm"] as const).map((mode) => {
                  const planned = rows.filter((row) => row.period === mode);
                  return (
                    <span key={mode}>
                      <strong>{PERIOD[mode]}</strong>
                      {planned.filter((row) => row.status === "used").length}/
                      {planned.length} usados ·{" "}
                      {planned.filter((row) => row.status === "skipped").length}{" "}
                      não usados ·{" "}
                      {planned.filter((row) => row.status === "pending").length}{" "}
                      pendentes
                    </span>
                  );
                })}
              </div>
              <HistoryRows
                key={`${range[0]}/${range[1]}`}
                rows={rows}
                skin={skin}
              />
              <p className="skh-footnote">
                Esta consulta mostra os registros salvos. Não atribui mudanças
                na pele a um produto.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
