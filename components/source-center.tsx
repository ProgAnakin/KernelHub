"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  Database,
  GitBranch,
  Heart,
  RefreshCw,
  ShieldCheck,
  Unplug,
  UploadCloud,
} from "lucide-react";
import { HEALTH_METRICS } from "@/lib/health";
import type { useHealth } from "@/lib/use-health";
import type { useGithub } from "@/lib/use-github";

type Health = ReturnType<typeof useHealth>;
type Github = ReturnType<typeof useGithub>;
interface Props {
  health: Health;
  github: Github;
  onToast: (text: string) => void;
}
export function readingDate(value: string | null) {
  if (!value) return "Sem leitura";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SourceCenter({ health, github, onToast }: Props) {
  const [username, setUsername] = useState(github.username ?? "ProgAnakin");
  const [removing, setRemoving] = useState<"github" | "health" | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const connect = async (event: FormEvent) => {
    event.preventDefault();
    if (await github.connect(username))
      onToast(
        "GitHub conectado. A atividade pública será atualizada automaticamente.",
      );
  };
  const available = HEALTH_METRICS.filter(
    ({ id }) => health.snapshot?.metrics[id].value != null,
  ).length;
  return (
    <div className="kh-sources">
      <div className="kh-source-intro">
        <span className="kh-icon-orbit">
          <Database size={24} />
        </span>
        <div>
          <h3>Menos entrada. Mais contexto.</h3>
          <p>
            Conecte o que já acompanha você. Cada fonte preenche apenas as
            métricas que disponibiliza.
          </p>
        </div>
      </div>
      <section className="kh-connector" aria-label="Conexão GitHub">
        <div className="kh-connector-title">
          <span className="kh-provider-icon">
            <GitBranch size={21} />
          </span>
          <div>
            <h3>GitHub</h3>
            <p>Atividade pública · atualização automática</p>
          </div>
          <span className={`kh-status ${github.snapshot ? "is-live" : ""}`}>
            {github.status === "loading"
              ? "Buscando"
              : github.snapshot
                ? "Conectado"
                : "Disponível"}
          </span>
        </div>
        <form onSubmit={connect} className="kh-connect-form">
          <label htmlFor="github-username">
            Usuário público
            <input
              id="github-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              maxLength={40}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Seu usuário no GitHub"
              required
            />
          </label>
          <button
            className="primary-button"
            disabled={github.status === "loading"}
          >
            {github.status === "loading" ? (
              <RefreshCw size={16} className="kh-spin" />
            ) : (
              <GitBranch size={16} />
            )}
            {github.username ? "Atualizar conexão" : "Conectar GitHub"}
          </button>
        </form>
        <p className="kh-help">
          Sem senha ou token. O app busca eventos públicos e atualiza ao voltar
          e periodicamente enquanto estiver aberto. Repositórios privados não
          entram nesta conexão.
        </p>
        {github.error && (
          <p className="form-error" role="alert">
            {github.error}
          </p>
        )}
        {github.storageError && (
          <p className="form-error" role="status">
            O navegador não confirmou a persistência da conexão. Você pode
            continuar nesta sessão.
          </p>
        )}
        {github.snapshot && (
          <>
            <div className="kh-source-facts">
              <span>
                Perfil<strong>@{github.snapshot.profile.login}</strong>
              </span>
              <span>
                Última busca
                <strong>{readingDate(github.snapshot.syncedAt)}</strong>
              </span>
              <span>
                Cobertura
                <strong>
                  {github.snapshot.coverage.received} eventos públicos
                </strong>
              </span>
            </div>
            <div className="kh-button-row">
              <button
                className="secondary-button"
                onClick={async () => {
                  if (await github.sync())
                    onToast("Atividade pública atualizada.");
                }}
                disabled={github.status === "loading"}
              >
                <RefreshCw size={15} /> Atualizar agora
              </button>
              <button
                className="kh-text-button"
                onClick={() => setRemoving("github")}
              >
                <Unplug size={15} />
                Desconectar
              </button>
            </div>
          </>
        )}
      </section>
      <section className="kh-connector" aria-label="Importação Apple Saúde">
        <div className="kh-connector-title">
          <span className="kh-provider-icon kh-health-icon">
            <Heart size={21} />
          </span>
          <div>
            <h3>Apple Saúde</h3>
            <p>Importação local · várias métricas de uma vez</p>
          </div>
          <span className={`kh-status ${health.snapshot ? "is-live" : ""}`}>
            {health.status === "importing"
              ? "Importando"
              : health.snapshot
                ? "Arquivo importado"
                : "Disponível"}
          </span>
        </div>
        <p className="kh-help">
          Importe o export.xml do Saúde para preencher sono, frequência, HRV,
          passos, energia, peso e distância. Lacunas continuam vazias. O arquivo
          permanece neste dispositivo.
        </p>
        <input
          type="file"
          accept=".xml,application/xml,text/xml"
          ref={file}
          className="sr-only"
          aria-label="Arquivo XML do Apple Saúde"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) void health.importFile(selected);
            event.target.value = "";
          }}
        />
        <button
          className="primary-button full-width kh-import-button"
          onClick={() => file.current?.click()}
          disabled={health.status === "importing"}
        >
          {health.status === "importing" ? (
            <RefreshCw size={17} className="kh-spin" />
          ) : (
            <UploadCloud size={18} />
          )}
          {health.status === "importing"
            ? "Processando suas leituras…"
            : "Importar dados do Saúde"}
        </button>
        {health.error && (
          <p className="form-error" role="alert">
            {health.error}
          </p>
        )}
        <details className="kh-export-guide">
          <summary>
            Como obter o arquivo <ChevronRight size={15} />
          </summary>
          <p>
            No iPhone, abra Saúde → sua foto → Exportar Todos os Dados de Saúde.
            No app Arquivos, descompacte o ZIP e selecione export.xml. Esta
            versão aceita XML de até 12 MB.
          </p>
          <p>
            A importação é pontual. A sincronização contínua com o Saúde depende
            de uma ponte nativa iOS.
          </p>
        </details>
        {health.snapshot && (
          <>
            <div className="kh-source-facts">
              <span>
                Importado em
                <strong>{readingDate(health.snapshot.importedAt)}</strong>
              </span>
              <span>
                Leituras válidas
                <strong>
                  {health.snapshot.coverage.acceptedRecords.toLocaleString(
                    "pt-BR",
                  )}
                </strong>
              </span>
              <span>
                Disponibilidade
                <strong>
                  {available} de {HEALTH_METRICS.length} métricas
                </strong>
              </span>
            </div>
            <p className="kh-help">
              Fontes no arquivo: {health.snapshot.sources.join(" · ")}. Para
              totais diários, uma fonte é escolhida por métrica/dia para evitar
              somar dispositivos sobrepostos.
            </p>
            <button
              className="kh-text-button"
              onClick={() => setRemoving("health")}
            >
              <Unplug size={15} />
              Remover dados importados
            </button>
          </>
        )}
      </section>
      {removing && (
        <div className="inline-confirm" role="alert">
          <strong>
            {removing === "github"
              ? "Desconectar GitHub?"
              : "Remover as leituras importadas?"}
          </strong>
          <p>Seus registros de rotina, foco e alimentação serão preservados.</p>
          <div>
            <button
              className="secondary-button"
              onClick={() => setRemoving(null)}
            >
              Cancelar
            </button>
            <button
              className="primary-button"
              onClick={async () => {
                if (removing === "github") await github.disconnect();
                else await health.clear();
                setRemoving(null);
              }}
            >
              Confirmar remoção
            </button>
          </div>
        </div>
      )}
      <section className="kh-coverage" aria-label="Cobertura de métricas">
        <div className="kh-section-label">
          <span>O QUE SUA FONTE ENTREGA</span>
          <span>
            {available}/{HEALTH_METRICS.length}
          </span>
        </div>
        {HEALTH_METRICS.map(({ id, label }) => {
          const reading = health.snapshot?.metrics[id];
          return (
            <div className="kh-coverage-row" key={id}>
              <span
                className={reading?.value != null ? "kh-dot is-live" : "kh-dot"}
              />
              <span>
                <strong>
                  {label}
                  {id === "hrvMs" ? " · SDNN" : ""}
                </strong>
                <small>
                  {reading?.value != null
                    ? `${reading.source} · ${readingDate(reading.recordedAt)}`
                    : "Não disponibilizado pela fonte"}
                </small>
              </span>
              <b>
                {reading?.value != null
                  ? `${reading.value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${reading.unit}`
                  : "—"}
              </b>
            </div>
          );
        })}
      </section>
      <div className="kh-native-note">
        <Activity size={20} />
        <div>
          <strong>Uma base para diferentes dispositivos.</strong>
          <p>
            Garmin, Fitbit e WHOOP podem fornecer as métricas comuns pela
            integração que disponibilizarem. Conectores diretos exigem
            autorização e uma camada segura de servidor. Nenhuma credencial
            desses provedores é solicitada aqui.
          </p>
        </div>
      </div>
      <p className="fine-print kh-privacy">
        <ShieldCheck size={14} /> Saúde é processada localmente. GitHub consulta
        api.github.com. O backup de Meu espaço inclui os registros do KernelHub;
        as fontes são reconectadas ou reimportadas separadamente.
      </p>
    </div>
  );
}

export function GithubActivity({
  github,
  onSources,
}: {
  github: Github;
  onSources: () => void;
}) {
  const [filter, setFilter] = useState("all");
  const snapshot = github.snapshot;
  if (!snapshot)
    return (
      <div className="kh-activity-empty">
        <GitBranch size={36} />
        <h3>Seu trabalho já deixa sinais.</h3>
        <p>
          Conecte um perfil público para acompanhar atividade sem preencher
          contadores.
        </p>
        <button className="primary-button" onClick={onSources}>
          Conectar GitHub <ArrowUpRight size={16} />
        </button>
      </div>
    );
  const events = snapshot.events.filter(
    (event) => filter === "all" || event.type === filter,
  );
  return (
    <div className="kh-activity">
      <div className="kh-activity-heading">
        <GitBranch size={22} />
        <div>
          <h3>@{snapshot.username}</h3>
          <p>Atualizado em {readingDate(snapshot.syncedAt)}</p>
        </div>
        <button
          className="icon-button"
          aria-label="Atualizar atividade GitHub"
          onClick={() => void github.sync()}
          disabled={github.status === "loading"}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      <div className="kh-live-counts">
        {[
          { label: "Pushes hoje", value: snapshot.statisticsToday.pushes },
          {
            label: "Commits conhecidos",
            value: snapshot.statisticsToday.commits,
          },
          {
            label: "PRs integrados",
            value: snapshot.statisticsToday.mergedPRs,
          },
          {
            label: "Deploys confirmados",
            value: snapshot.statisticsToday.deployments,
          },
        ].map((stat) => (
          <div key={stat.label}>
            <strong>{stat.value ?? "—"}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
      <p className="kh-help">
        Pushes, commits, PRs e deploys são eventos diferentes. Campo vazio
        significa que a fonte não forneceu informação suficiente.
      </p>
      <div className="filter-pills" role="group" aria-label="Filtrar atividade">
        {[
          { id: "all", label: "Tudo" },
          { id: "push", label: "Pushes" },
          { id: "pull-request", label: "PRs" },
          { id: "release", label: "Releases" },
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
      <div className="kh-activity-list">
        {events.slice(0, 30).map((event) => (
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            key={event.id}
          >
            <span className="kh-activity-symbol">
              <GitBranch size={17} />
            </span>
            <span>
              <strong>{event.title}</strong>
              <small>
                {event.repository} · {readingDate(event.at)}
              </small>
            </span>
            <ArrowUpRight size={15} />
          </a>
        ))}
      </div>
      {!events.length && (
        <p className="kh-help">
          Nenhum evento público deste tipo no período disponível.
        </p>
      )}
      <p className="fine-print">
        Janela de até 100 eventos públicos. O feed pode ter atraso e não
        representa todo o histórico de contribuições.
      </p>
    </div>
  );
}
