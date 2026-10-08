"use client";

import { Check, Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LANGS } from "@/lib/i18n/locale";
import { useI18n } from "@/lib/i18n/provider";

/** Switches the interface between Bahasa Indonesia and English; the choice is kept in a cookie. */
export function LanguageToggle() {
  const { lang, setLang, t } = useI18n();
  const current = LANGS.find((l) => l.value === lang) ?? LANGS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5" aria-label={t("Language")}>
          <Languages className="h-4 w-4" />
          <span className="text-xs font-semibold">{current.short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGS.map((l) => (
          <DropdownMenuItem key={l.value} onClick={() => setLang(l.value)} className="gap-2">
            <Check className={lang === l.value ? "h-4 w-4" : "h-4 w-4 opacity-0"} />
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
