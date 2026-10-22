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
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export const SPRING = { type: "spring" as const, stiffness: 400, damping: 30 };

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? "brand-small" : ""}`}>
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <rect
          x=".5"
          y=".5"
          width="39"
          height="39"
          rx="12"
          fill="#111b12"
          stroke="#2b422c"
        />
        <path
          d="M13 11v18m15-18L17 20l11 9"
          stroke="#83e890"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        Kernel<span className="brand-light">Hub</span>
        <span className="brand-dot">.</span>
      </span>
    </div>
  );
}

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

  return (
    <div
      className={`progress-track ${color}`}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <motion.div
        initial={false}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
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
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const reduced = useReducedMotion();
  const dragControls = useDragControls();

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
        const controls = ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea, select, [tabindex="0"]',
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
        <div className="sheet-layer">
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
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
            initial={{ y: reduced ? 0 : "100%", opacity: reduced ? 0 : 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: reduced ? 0 : "100%", opacity: reduced ? 0 : 1 }}
            transition={SPRING}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 65 || info.velocity.y > 600) onClose();
            }}
          >
            <div
              className="sheet-drag-zone"
              onPointerDown={(event) => dragControls.start(event)}
              aria-hidden="true"
            >
              <span />
            </div>
            <header className="sheet-header">
              <div>
                <h2 id="sheet-title">{title}</h2>
                {subtitle && <p>{subtitle}</p>}
              </div>
              <button
                className="icon-button close-button"
                onClick={onClose}
                aria-label="Fechar painel"
              >
                <X size={20} />
              </button>
            </header>
            <div
              className="sheet-content"
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
