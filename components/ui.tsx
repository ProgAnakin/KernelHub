"use client";

import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export const SPRING = { type: "spring" as const, stiffness: 400, damping: 30 };

export function Card({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <section className={`glass-card ${className}`} aria-label={label}>
      {children}
    </section>
  );
}

export function CardHeading({
  icon: Icon,
  label,
  color = "green",
  right,
}: {
  icon: LucideIcon;
  label: string;
  color?: string;
  right?: ReactNode;
}) {
  return (
    <div className="card-heading">
      <span className={`module-icon ${color}`}>
        <Icon size={16} strokeWidth={1.5} />
      </span>
      <span>{label}</span>
      {right && <div className="heading-right">{right}</div>}
    </div>
  );
}

export function CardLink({
  children,
  onClick,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button className="card-link" onClick={onClick} aria-label={label}>
      <span>{children}</span>
      <ArrowUpRight size={15} strokeWidth={1.5} />
    </button>
  );
}

export function Progress({
  value,
  color = "green",
  label,
}: {
  value: number;
  color?: string;
  label: string;
}) {
  const reduced = useReducedMotion();
  const percentage = Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;

  return (
    <div
      className={`progress-track ${color}`}
      role="progressbar"
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <motion.div
        initial={false}
        animate={{ width: `${percentage}%` }}
        transition={reduced ? { duration: 0 } : SPRING}
      />
    </div>
  );
}

export function CircleCheck({
  checked,
  onClick,
  label,
  disabled = false,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={`circle-check ${checked ? "checked" : ""}`}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <span>{checked && <Check size={14} strokeWidth={2} />}</span>
    </button>
  );
}

export function ListAction({
  icon: Icon,
  title,
  subtitle,
  onClick,
  color = "green",
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button className="list-action" onClick={onClick}>
      <span className={`action-icon ${color}`}>
        <Icon size={21} strokeWidth={1.5} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <ChevronRight size={17} />
    </button>
  );
}

export function BottomSheet({
  open,
  title,
  subtitle,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; y: number } | null>(null);
  const [desktop, setDesktop] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const reduced = useReducedMotion();
  const dragControls = useDragControls();

  useEffect(() => {
    const media = window.matchMedia("(min-width: 900px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);

  useEffect(() => {
    if (!open || desktop) return;
    const viewport = window.visualViewport;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const layer = layerRef.current;
        if (!layer) return;
        const height = viewport?.height ?? window.innerHeight;
        layer.style.setProperty("--sheet-viewport-height", `${height}px`);
        layer.style.setProperty(
          "--sheet-viewport-top",
          `${viewport?.offsetTop ?? 0}px`,
        );
        layer.dataset.keyboard = String(height < window.innerHeight - 120);
      });
    };
    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      layerRef.current?.style.removeProperty("--sheet-viewport-height");
      layerRef.current?.style.removeProperty("--sheet-viewport-top");
    };
  }, [open, desktop]);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = setTimeout(() => ref.current?.focus(), 30);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
      if (event.key === "Tab") {
        const controls = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]',
          ) ?? [],
        ).filter(
          (element) =>
            element.getClientRects().length > 0 &&
            getComputedStyle(element).visibility !== "hidden",
        );
        if (!controls?.length) {
          event.preventDefault();
          return;
        }
        const first = controls[0],
          last = controls[controls.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", keydown);
      previousFocus.current?.focus();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="sheet-layer" ref={layerRef} data-desktop={desktop}>
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            className="bottom-sheet"
            data-expanded={expanded}
            onFocusCapture={(event) => {
              if (
                !desktop &&
                event.target instanceof HTMLElement &&
                event.target.matches("input, textarea, select")
              )
                setExpanded(true);
            }}
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
            initial={{
              y: reduced || desktop ? 0 : "12%",
              opacity: 1,
            }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduced || desktop ? 0 : "100%", opacity: 0 }}
            transition={reduced ? { duration: 0 } : SPRING}
            drag={desktop ? false : "y"}
            dragListener={false}
            dragMomentum={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.15, bottom: 0.45 }}
          >
            <div
              className="sheet-drag-zone"
              onPointerDown={(event) => {
                if (desktop || event.button !== 0 || !event.isPrimary) return;
                gesture.current = { id: event.pointerId, y: event.clientY };
                event.currentTarget.setPointerCapture(event.pointerId);
                dragControls.start(event);
              }}
              onPointerUp={(event) => {
                const start = gesture.current;
                gesture.current = null;
                if (!start || start.id !== event.pointerId) return;
                const distance = event.clientY - start.y;
                if (distance < -45) setExpanded(true);
                else if (distance > 65) {
                  if (expanded) setExpanded(false);
                  else onClose();
                }
              }}
              onPointerCancel={() => {
                gesture.current = null;
              }}
              aria-hidden="true"
            >
              <span />
            </div>
            <header className="sheet-header">
              <div className="sheet-title-group">
                <span className="sheet-workspace-label">
                  KERNELHUB / MEU ESPAÇO
                </span>
                <h2 id="sheet-title">{title}</h2>
                {subtitle && <p>{subtitle}</p>}
              </div>
              <div className="sheet-window-actions">
                <button
                  type="button"
                  className="icon-button sheet-expand-button"
                  aria-label={expanded ? "Reduzir painel" : "Expandir painel"}
                  aria-expanded={expanded}
                  aria-controls="sheet-content"
                  onClick={() => setExpanded((value) => !value)}
                >
                  {expanded ? (
                    <ChevronDown size={20} />
                  ) : (
                    <ChevronUp size={20} />
                  )}
                </button>
                <button
                  type="button"
                  className="icon-button close-button"
                  onClick={onClose}
                  aria-label="Fechar painel"
                >
                  <span className="sheet-desktop-back">Voltar ao painel</span>
                  <X size={20} />
                </button>
              </div>
            </header>
            <div
              className="sheet-content"
              id="sheet-content"
              tabIndex={0}
              role="region"
              aria-label="Conteúdo do painel"
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
