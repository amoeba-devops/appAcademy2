import { PortalHeader } from "@/components/portal/portal-header";
import { PortalFooter } from "@/components/portal/portal-footer";
import { FloatingCta } from "@/components/portal/floating-cta";
import { QueryProvider } from "@/components/providers/query-provider";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <div className="flex min-h-screen flex-col bg-white text-slate-900">
        <PortalHeader />
        <FloatingCta />
        <main className="flex-1">{children}</main>
        <PortalFooter />
      </div>
    </QueryProvider>
  );
}
