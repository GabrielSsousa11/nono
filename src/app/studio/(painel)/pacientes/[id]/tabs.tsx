"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PatientTabs({ base, tabs }: { base: string; tabs: [string, string][] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Seções do paciente" className="-mx-1 overflow-x-auto px-1">
      <ul className="flex gap-2">
        {tabs.map(([href, label]) => {
          const full = base + href;
          const active = pathname === full;
          return (
            <li key={href}>
              <Link
                href={full}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm whitespace-nowrap ${active ? "border-olive bg-olive text-ivory" : "border-onyx/15 text-onyx hover:border-onyx/40"}`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
