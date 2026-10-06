"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type GlassToastItem = {
  id: number;
  title: string;
  description: string;
  variant?: "success" | "info" | "warning";
};

type GlassToastViewportProps = {
  toasts: GlassToastItem[];
  onDismiss: (id: number) => void;
};

const variantStyles = {
  success: {
    icon: CheckCircle2,
    iconClassName: "text-emerald-300",
    accentClassName: "from-emerald-400/60 via-emerald-300/30 to-cyan-300/50",
  },
  info: {
    icon: Info,
    iconClassName: "text-sky-300",
    accentClassName: "from-sky-400/60 via-sky-300/30 to-cyan-200/50",
  },
  warning: {
    icon: TriangleAlert,
    iconClassName: "text-amber-300",
    accentClassName: "from-amber-400/60 via-orange-300/30 to-yellow-200/50",
  },
};

export function GlassToastViewport({ toasts, onDismiss }: GlassToastViewportProps) {
  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-3">
      {toasts.map((toast) => {
        const variant = variantStyles[toast.variant ?? "success"];
        const Icon = variant.icon;

        return (
          <div
            key={toast.id}
            className="pointer-events-auto relative overflow-hidden rounded-2xl border border-white/25 bg-white/12 p-4 text-white shadow-[0_20px_60px_-25px_rgba(15,23,42,0.9)] backdrop-blur-xl transition-all duration-300"
          >
            <div className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-90", variant.accentClassName)} />
            <div className="absolute -top-10 -right-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />

            <div className="relative flex items-start gap-3">
              <div className="mt-0.5 rounded-full border border-white/20 bg-white/10 p-2">
                <Icon className={cn("h-4 w-4", variant.iconClassName)} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold tracking-[0.01em]">{toast.title}</p>
                <p className="mt-1 text-sm leading-5 text-white/75">{toast.description}</p>
              </div>

              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="rounded-full border border-white/10 bg-white/8 p-1 text-white/70 transition hover:bg-white/15 hover:text-white"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
