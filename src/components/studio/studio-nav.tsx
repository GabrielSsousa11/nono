"use client";

import { Inbox, LayoutGrid, Menu, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { Monogram } from "@/components/ui/monogram";

export interface StudioNavItem {
  href: string;
  label: string;
  icon: "overview" | "team" | "requests";
}

const ICONS = { overview: LayoutGrid, team: Users, requests: Inbox };

function NavList({ items, onNavigate }: { items: StudioNavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = item.href === "/studio" ? pathname === "/studio" : pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-full px-4 text-sm transition-colors ${
                active ? "bg-ivory/12 text-ivory" : "text-champagne hover:bg-ivory/6 hover:text-ivory"
              }`}
            >
              <Icon aria-hidden className="size-4" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Navegação do CG Studio: barra lateral no desktop, diálogo no mobile. */
export function StudioNav({ items, footer }: { items: StudioNavItem[]; footer: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();
  return (
    <>
      <aside className="stone on-dark sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-olive-deep px-4 py-6 lg:flex">
        <Link href="/studio" className="mb-10 flex items-center gap-3 px-3 text-ivory">
          <Monogram className="size-8" />
          <span className="font-display text-xl">CG Studio</span>
        </Link>
        <nav aria-label="CG Studio" className="flex-1">
          <NavList items={items} />
        </nav>
        {footer}
      </aside>

      <div className="on-dark sticky top-0 z-40 flex h-14 items-center justify-between bg-olive-deep px-4 text-ivory lg:hidden">
        <Link href="/studio" className="flex items-center gap-2">
          <Monogram className="size-7" />
          <span className="font-display text-lg">CG Studio</span>
        </Link>
        <button
          type="button"
          aria-label="Abrir menu do Studio"
          aria-haspopup="dialog"
          className="grid size-11 place-items-center"
          onClick={() => dialog.current?.showModal()}
        >
          <Menu aria-hidden className="size-5" />
        </button>
      </div>
      <dialog
        ref={dialog}
        aria-label="Menu do Studio"
        className="on-dark m-0 h-dvh max-h-none w-72 bg-olive-deep p-0 text-ivory"
        onClick={(e) => e.target === dialog.current && close()}
      >
        <div className="flex h-full flex-col px-4 py-5">
          <button
            type="button"
            aria-label="Fechar menu"
            className="mb-6 grid size-11 place-items-center self-end"
            onClick={close}
          >
            <X aria-hidden className="size-5" />
          </button>
          <nav aria-label="CG Studio" className="flex-1">
            <NavList items={items} onNavigate={close} />
          </nav>
          {footer}
        </div>
      </dialog>
    </>
  );
}
