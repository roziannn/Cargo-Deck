"use client";

import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";

export function DarkModeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  return (
    <Button variant="ghost" size="sm" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">{t("Toggle theme")}</span>
    </Button>
  );
}
