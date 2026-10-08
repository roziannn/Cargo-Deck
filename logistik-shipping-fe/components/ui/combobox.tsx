"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
  /** Second line under the label. */
  description?: React.ReactNode;
  /** Extra text to match when searching; a plain-text description is searched automatically. */
  searchText?: string;
  disabled?: boolean;
};

type ComboboxProps = {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Show a clear button when something is selected. */
  clearable?: boolean;
  /** Let the user keep what they typed when it is not in the list; the value is then the typed text. */
  allowCustom?: boolean;
  className?: string;
  id?: string;
};

/** A dropdown with search, like select2: type to filter the options, pick with the mouse or the keyboard. */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Pilih...",
  searchPlaceholder = "Cari...",
  emptyText = "Tidak ada hasil",
  disabled,
  clearable,
  allowCustom,
  className,
  id,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const selected = options.find((o) => o.value === value);
  const shown = selected?.label ?? (allowCustom ? value : "");
  const typed = search.trim();
  const canUseTyped = allowCustom && typed !== "" && !options.some((o) => o.label.toLowerCase() === typed.toLowerCase());

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <div className={cn("relative", className)}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-xs outline-none transition-colors",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
              clearable && shown && "pr-14",
            )}
          >
            <span className={cn("truncate", !shown && "text-muted-foreground")}>{shown || placeholder}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        {clearable && shown && !disabled && (
          <button
            type="button"
            aria-label="Hapus pilihan"
            onClick={() => pick("")}
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-56 p-0">
        <Command filter={(value, search) => (value.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {canUseTyped && (
                <CommandItem value={`__custom__${typed}`} onSelect={() => pick(typed)} forceMount>
                  Gunakan &ldquo;{typed}&rdquo;
                </CommandItem>
              )}
              {options.map((o) => (
                <CommandItem key={o.value} value={`${o.label} ${o.searchText ?? (typeof o.description === "string" ? o.description : "")} ${o.value}`} disabled={o.disabled} onSelect={() => pick(o.value)}>
                  <Check className={cn("h-4 w-4", o.value === value ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0">
                    <div className="truncate">{o.label}</div>
                    {o.description && <div className="truncate text-xs text-muted-foreground">{o.description}</div>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
