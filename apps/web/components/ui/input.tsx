import * as React from "react";

import { cn } from "@/lib/utils";

const champ =
  "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(champ, "h-9 py-1", className)}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(champ, "min-h-16 py-2", className)}
      {...props}
    />
  );
}

/**
 * `<select>` natif plutôt que Radix Select : il alimente `FormData` sans
 * champ caché, donc fonctionne tel quel avec les Server Actions, et garde le
 * sélecteur du système sur mobile.
 */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(champ, "h-9 py-1 pr-8", className)}
      {...props}
    />
  );
}

export { Input, Textarea, Select };
