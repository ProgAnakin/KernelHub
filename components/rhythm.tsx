"use client";

import { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Flame, Activity } from "lucide-react";
import type { KernelState } from "@/types/kernel";
import { calories } from "@/lib/mock-engine";
import {
  RHYTHM_TRACKS,
  rhythmGrid,
  rhythmStreak,
  summarizeDay,
  type RhythmTrack,
} from "@/lib/metrics";

const NUMBER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** A progress ring that fills from zero; the track stays visible when empty. */
function Ring({
  value,
  radius,
  tone,
}: {
  value: number;
  radius: number;
  tone: "lime" | "blue" | "coral";
}) {
  const id = useId().replace(/:/g, "");
  const reduced = useReducedMotion();
  const share = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <g className={`kr-ring kr-${tone}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" className="kr-stop-a" />
          <stop offset="100%" className="kr-stop-b" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r={radius} className="kr-track" />
      <motion.circle
        cx="60"
        cy="60"
        r={radius}
        stroke={`url(#${id})`}
        className="kr-value"
        transform="rotate(-90 60 60)"
        initial={{ pathLength: reduced ? share : 0 }}
        animate={{ pathLength: share }}
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", stiffness: 70, damping: 18, delay: 0.1 }
        }
        style={{ opacity: share > 0 ? 1 : 0 }}
      />
    </g>
  );
}

function levelLabel(level: number | null) {
  return level === null
    ? "sem registro"
    : [
        "nada",
        "até um terço da meta",
        "até dois terços",
        "quase lá",
        "meta alcançada",
      ][level];
}

/**
 * Today as three rings (focus, water, protein) next to thirteen weeks of
 * constancy. Rings show the share of personal targets; the grid keeps days
 * without a record visibly empty instead of drawing them as failures.
 */
export function RhythmCard({ state }: { state: KernelState }) {
  const [track, setTrack] = useState<RhythmTrack>("focus");
  const today = summarizeDay(state);
  const rings = [
    {
      key: "focus",
      label: "Foco",
      tone: "lime" as const,
      share: today.focusMinutes / state.targets.focusMinutes,
      text: `${today.focusMinutes}/${state.targets.focusMinutes} min`,
    },
    {
      key: "water",
      label: "Água",
      tone: "blue" as const,
      share: state.waterMl / state.targets.waterMl,
      text: `${NUMBER.format(state.waterMl / 1000)}/${NUMBER.format(state.targets.waterMl / 1000)} L`,
    },
    {
      key: "protein",
      label: "Proteína",
      tone: "coral" as const,
      share:
        state.nutrition.protein / Math.max(1, state.targets.macros.protein),
      text: `${NUMBER.format(state.nutrition.protein)}/${state.targets.macros.protein} g`,
    },
  ];
  const cells = rhythmGrid(state, track);
  const recorded = cells.filter((cell) => cell.level !== null);
  const reached = recorded.filter((cell) => cell.level === 4).length;
  const streak = rhythmStreak(cells);
  // Columns are weeks ending today, so the newest day sits bottom-right.
  const pad = (7 - (cells.length % 7)) % 7;
  const padded = [...Array(pad).fill(null), ...cells] as (
    (typeof cells)[number] | null
  )[];
  const label = RHYTHM_TRACKS.find((item) => item.id === track)!.label;
  return (
    <section
      className="kp-card kr-card"
      aria-label="Ritmo de hoje e constância"
    >
      <div className="kr-today">
        <div className="kp-card-title">
          <span>
            <Activity size={17} strokeWidth={1.5} />
            Ritmo de hoje
          </span>
          <div className="kp-card-meta">{calories(state.nutrition)} kcal</div>
        </div>
        <div className="kr-rings-row">
          <svg
            viewBox="0 0 120 120"
            className="kr-rings"
            role="img"
            aria-label={rings
              .map(
                (ring) =>
                  `${ring.label}: ${Math.round(Math.min(ring.share, 9.99) * 100)}% da meta`,
              )
              .join("; ")}
          >
            {rings.map((ring, index) => (
              <Ring
                key={ring.key}
                value={ring.share}
                radius={52 - index * 15}
                tone={ring.tone}
              />
            ))}
          </svg>
          <ul className="kr-legend">
            {rings.map((ring) => (
              <li key={ring.key} className={`kr-${ring.tone}`}>
                <i aria-hidden="true" />
                <span>{ring.label}</span>
                <strong>{ring.text}</strong>
                <small>{Math.round(Math.max(0, ring.share) * 100)}%</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="kr-history">
        <div className="kr-history-head">
          <div>
            <span className="kp-overline">CONSTÂNCIA · 13 SEMANAS</span>
            <p>
              <Flame size={14} strokeWidth={1.5} aria-hidden="true" />
              {streak
                ? `${streak} ${streak === 1 ? "dia" : "dias"} seguidos na meta`
                : "Sem sequência ativa"}
              <small>
                {" "}
                · {reached} de {recorded.length} dias registrados
              </small>
            </p>
          </div>
          <div
            className="kr-tracks"
            role="group"
            aria-label="Escolher o que acompanhar"
          >
            {RHYTHM_TRACKS.map((item) => (
              <button
                key={item.id}
                aria-pressed={track === item.id}
                onClick={() => setTrack(item.id)}
              >
                {track === item.id && (
                  <motion.span
                    layoutId="kr-track-pill"
                    className="kr-track-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div
          className={`kr-grid kr-grid-${track}`}
          role="img"
          aria-label={`${label}: ${reached} dias com meta alcançada em ${recorded.length} dias com registro nas últimas 13 semanas. Dias sem registro ficam vazios.`}
        >
          {padded.map((cell, index) =>
            cell ? (
              <i
                key={cell.day}
                data-level={cell.level ?? "none"}
                title={`${cell.day.split("-").reverse().join("/")} · ${levelLabel(cell.level)}`}
              />
            ) : (
              <i key={`pad-${index}`} data-level="pad" />
            ),
          )}
        </div>
        <div className="kr-scale" aria-hidden="true">
          <span>Sem registro</span>
          <i data-level="none" />
          <i data-level="0" />
          <i data-level="1" />
          <i data-level="2" />
          <i data-level="3" />
          <i data-level="4" />
          <span>Meta</span>
        </div>
        {state.mode === "demo" && (
          <p className="kr-note">
            Demonstração: só os últimos dias têm histórico de exemplo.
          </p>
        )}
      </div>
    </section>
  );
}
