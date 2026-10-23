import { Logo } from "@/components/logo";

/** Pages accessibles sans session : connexion et inscription. */
export default function LayoutInvite({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <Logo className="text-lg" />
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
