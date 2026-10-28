"use client";

import { useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Info } from "lucide-react";
import type { KernelState } from "@/types/kernel";
import {
  buildBackup,
  describePlan,
  MAX_FULL_BACKUP_BYTES,
  parseBackup,
  type RestorePlan,
} from "@/lib/backup";
import { readSkincareForBackup } from "@/lib/backup-storage";
import { saveBlob } from "@/lib/download";
import packageInfo from "../package.json";

/** What the backup needs from outside the workspace itself. */
export interface BackupBridge {
  githubUsername: string | null;
  restore: (plan: RestorePlan) => Promise<void>;
  connectGithub: (username: string) => Promise<boolean>;
}

function megabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export function BackupPanel({
  state,
  bridge,
  onToast,
  onClose,
}: {
  state: KernelState;
  bridge: BackupBridge;
  onToast: (text: string) => void;
  onClose: () => void;
}) {
  const [includePhotos, setIncludePhotos] = useState(true);
  const [busy, setBusy] = useState<"export" | "import" | "restore" | null>(
    null,
  );
  const [pending, setPending] = useState<RestorePlan | null>(null);
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const request = useRef(0);

  // The session's own records are exported, which is also what a person needs
  // when another tab already archived the day and the two versions disagree.
  const exportBackup = async (): Promise<boolean> => {
    setBusy("export");
    setError("");
    try {
      const skincare = await readSkincareForBackup(includePhotos);
      const built = await buildBackup({
        core: state,
        skincare,
        githubUsername: bridge.githubUsername,
        app: packageInfo.version,
      });
      saveBlob(built.blob, `kernelhub-${state.day}.json`);
      onToast(
        `Backup preparado (${megabytes(built.blob.size)}${
          skincare?.photos ? `, ${built.photos} fotos` : ""
        }).`,
      );
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível preparar o backup. Nada foi alterado.",
      );
      return false;
    } finally {
      setBusy(null);
    }
  };

  const importFile = async (selected?: File) => {
    if (!selected) return;
    const id = ++request.current;
    setPending(null);
    setError("");
    if (selected.size > MAX_FULL_BACKUP_BYTES) {
      setError("Use um backup de até 64 MB.");
      return;
    }
    setBusy("import");
    try {
      const contents = await selected.text();
      if (id !== request.current) return;
      const result = parseBackup(contents);
      if (!result.ok) setError(result.error);
      else setPending(result.plan);
    } catch {
      if (id === request.current)
        setError(
          "Não foi possível ler este arquivo. Seus registros foram mantidos.",
        );
    } finally {
      if (id === request.current) setBusy(null);
    }
  };

  const restore = async () => {
    if (!pending) return;
    setBusy("restore");
    setError("");
    try {
      await bridge.restore(pending);
      if (
        pending.githubUsername &&
        pending.githubUsername.toLowerCase() !==
          bridge.githubUsername?.toLowerCase()
      )
        void bridge.connectGithub(pending.githubUsername);
      onToast("Backup restaurado neste dispositivo.");
      setPending(null);
      onClose();
    } catch {
      setError(
        "Não foi possível restaurar agora. Seus registros atuais foram mantidos.",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="backup-panel">
      <label className="backup-option">
        <input
          type="checkbox"
          checked={includePhotos}
          onChange={(event) => setIncludePhotos(event.target.checked)}
          disabled={busy !== null}
        />
        <span>
          Incluir fotos do skincare
          <small>
            Deixam o arquivo maior. Sem elas, as fotos atuais não são alteradas
            ao restaurar.
          </small>
        </span>
      </label>
      <div className="backup-actions">
        <button
          className="secondary-button"
          disabled={busy !== null}
          onClick={() => void exportBackup()}
        >
          <ArrowDownToLine size={17} />
          Exportar backup
        </button>
        <button
          className="secondary-button"
          disabled={busy !== null}
          onClick={() => file.current?.click()}
        >
          <ArrowUpFromLine size={17} />
          Importar backup
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Arquivo de backup"
        onChange={(event) => {
          void importFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <p className="fine-print backup-scope">
        <Info size={13} />O backup inclui os registros do espaço, o armário de
        skincare com histórico e fotos e o perfil GitHub conectado. Importações
        de saúde e o cronômetro em andamento não entram: reimporte o export.xml
        e conclua o bloco antes.
      </p>
      {busy === "export" && (
        <p className="fine-print" role="status">
          Preparando o arquivo…
        </p>
      )}
      {pending && (
        <div className="inline-confirm" role="alert">
          <strong>Restaurar este backup?</strong>
          <p>
            Ele substituirá o que está listado abaixo neste dispositivo. Exporte
            os dados atuais antes, se quiser preservá-los.
          </p>
          <ul className="backup-plan">
            {describePlan(pending).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {pending.createdAt && (
            <p>
              Backup criado em{" "}
              {new Date(pending.createdAt).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
              .
            </p>
          )}
          <div>
            <button
              className="secondary-button"
              disabled={busy !== null}
              onClick={() => void exportBackup()}
            >
              Exportar o atual antes
            </button>
            <button
              className="secondary-button"
              disabled={busy === "restore"}
              onClick={() => setPending(null)}
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              disabled={busy !== null}
              onClick={() => void restore()}
            >
              Restaurar registros
            </button>
          </div>
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
