import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryProvider } from '@/components/providers/query-provider';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { AdminHeader } from '@/components/admin/admin-header';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <TooltipProvider>
        {/* Amoeba Web Style Guide v2.0 — Admin scope (§3, §13) */}
        <div data-admin-scope className="min-h-screen flex bg-gray-50 font-body">
          <AdminSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <AdminHeader />
            {/* Basic-A-1 content: p-6 inner, max-w 1440, min-w 320 (§1.3, §2.1) */}
            <main className="flex-1 overflow-auto">
              <div className="amb-content p-6">{children}</div>
            </main>
          </div>
        </div>
      </TooltipProvider>
    </QueryProvider>
  );
}
