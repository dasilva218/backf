"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Le thème suit celui du système, comme le reste de l'interface. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="system"
      position="top-center"
      richColors
      closeButton
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
