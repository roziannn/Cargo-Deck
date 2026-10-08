import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

/** An arrow that sits in running text, in place of the "→" character. */
export function Arrow({ className }: { className?: string }) {
  return <ArrowRight aria-hidden="true" className={cn("mx-1 inline-block h-3.5 w-3.5 shrink-0 align-[-2px] text-muted-foreground", className)} />;
}

/** "origin → destination" with a proper arrow icon; stays inline so it truncates with its parent. */
export function RouteText({ from, to }: { from: string; to: string }) {
  return (
    <>
      {from}
      <Arrow />
      {to}
    </>
  );
}
