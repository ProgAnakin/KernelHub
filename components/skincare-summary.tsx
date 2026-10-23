"use client";

import { ChevronRight, Moon, Sun } from "lucide-react";
import { routineMetrics } from "@/lib/skincare";
import { useSkincare } from "@/lib/use-skincare";

export function SkincareSummary({ onOpen }: { onOpen: () => void }) {
  const skin = useSkincare({ history: false });
  return (
    <button
      className="sk-summary"
      onClick={onOpen}
      aria-label="Abrir armário de skincare"
    >
      <span className="sk-summary-icon">
        {skin.period === "am" ? <Sun size={19} /> : <Moon size={19} />}
      </span>
      <span>
        <strong>Seu armário de skincare</strong>
        <small>
          {!skin.hydrated
            ? "Carregando seus cuidados…"
            : skin.error
              ? "Verificar registros locais"
              : ["am", "pm"]
                  .map((period) => {
                    const metrics = routineMetrics(
                      skin.today,
                      period as "am" | "pm",
                    );
                    return `${period.toUpperCase()} ${metrics.used}/${metrics.planned}`;
                  })
                  .join(" · ")}
        </small>
      </span>
      <ChevronRight size={16} />
    </button>
  );
}
