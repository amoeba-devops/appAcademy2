import { FileText, Table2, FolderOpen, Users, Link2 } from "lucide-react";
import { type Item, type Project } from "./types";
import { ProjectRelations } from "./project-relations";
import { useTranslation } from "react-i18next";
export function documentKind(i: Item) {
  return (
    i.document_type ??
    (i.pit_kind === "NOTE"
      ? "MEMO"
      : i.pit_kind === "FILE"
        ? "FILE"
        : i.drive_mime?.includes("spreadsheet")
          ? "SHEET"
          : "DOC")
  );
}
export function ProjectOverview({
  project,
  items,
  manage,
  onManage,
  onBrowse,
}: {
  project: Project;
  items: Item[];
  manage: boolean;
  onManage: () => void;
  onBrowse: (kind: string) => void;
}) {
  const { t: tp } = useTranslation("prj");
  const kinds = [
    { key: "MEMO", icon: FileText },
    { key: "SHEET", icon: Table2 },
    { key: "DOC", icon: FileText },
    { key: "FILE", icon: FolderOpen },
  ];
  return (
    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <section className="min-w-0 rounded-xl border bg-surface p-4 lg:p-5">
        <h2 className="mb-4 font-semibold">{tp("overview.recentDocs")}</h2>
        <div className="grid min-w-0 gap-3 md:grid-cols-3">
          {kinds.map(({ key, icon: Icon }) => {
            const recent = items
              .filter((i) => i.pit_kind !== "ISSUE" && documentKind(i) === key)
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 5);
            return (
              <section
                key={key}
                className="min-w-0 rounded-xl border border-gray-100 bg-gray-50/40 p-4"
              >
                <header className="mb-4 flex items-center justify-between gap-2 text-sm">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Icon size={16} />
                    {tp(`overview.kind.${key}`)}
                  </h3>
                  <button
                    onClick={() => onBrowse(key)}
                    className="shrink-0 text-xs text-blue-600"
                  >
                    {tp("overview.viewAll")}
                  </button>
                </header>
                {recent.length ? (
                  <ul className="divide-y divide-gray-100">
                    {recent.map((i) => (
                      <li key={i.pit_id} className="py-2">
                        <button
                          className="w-full min-w-0 text-left"
                          onClick={() => onBrowse(key)}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className="min-w-0 flex-1 truncate"
                              title={i.pit_title}
                            >
                              {i.pit_title}
                            </span>
                            {(i.external_url || i.drive_file_id) &&
                              key !== "FILE" && (
                                <span className="flex shrink-0 items-center gap-1 rounded-full bg-blue-50 px-2 text-xs text-blue-600">
                                  <Link2 size={12} />
                                  {tp("overview.linked")}
                                </span>
                              )}
                          </span>
                          <span className="mt-1 block text-xs text-gray-500">
                            {i.creator_name} ·{" "}
                            {key === "FILE" && i.drive_size
                              ? `${Math.ceil(Number(i.drive_size) / 1024)}KB · `
                              : ""}
                            {new Date(i.created_at).toLocaleString()}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="min-h-44 text-sm text-gray-400">
                    {tp("overview.empty")}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </section>
      <aside className="grid min-w-0 gap-4">
        <section className="rounded-xl border bg-surface p-5">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <Users size={17} />
              {tp("overview.members")}
            </h2>
            {manage && (
              <button
                onClick={onManage}
                className="rounded-lg bg-accent-600 px-3 py-2 text-sm text-white"
              >
                {tp("overview.manageMembers")}
              </button>
            )}
          </header>
          <ul className="divide-y">
            {project.members?.map((m) => (
              <li key={m.id} className="flex min-w-0 items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p>{m.name}</p>
                  <p className="truncate text-xs text-gray-500" title={m.email}>
                    {m.email}
                  </p>
                </div>
                <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                  {m.id === project.owner_id || m.member_role === "MANAGER"
                    ? tp("overview.roleManager")
                    : tp("overview.roleMember")}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <ProjectRelations project={project.prj_id} manage={manage} />
      </aside>
    </div>
  );
}
