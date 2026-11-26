"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PortalNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Portal do paciente" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <ul className="flex gap-1.5 pb-1">
        {items.map((i) => {
          const active = i.href === "/portal" ? pathname === "/portal" : pathname.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm whitespace-nowrap ${active ? "bg-olive text-ivory" : "text-onyx hover:bg-stone"}`}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
