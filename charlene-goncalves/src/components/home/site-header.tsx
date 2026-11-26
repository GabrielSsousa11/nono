"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Monogram } from "@/components/ui/monogram";

export interface NavItem {
  href: string;
  label: string;
}

export function SiteHeader({ nav }: { nav: NavItem[] }) {
  const [scrolled, setScrolled] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => dialog.current?.close();

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-500 ease-silk ${
        scrolled ? "bg-ivory/90 shadow-[0_1px_0_rgb(32_36_32/0.08)] backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-[var(--header-h)] max-w-[88rem] items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="flex items-center gap-3 text-onyx"
          aria-label="Charlene Gonçalves Odontologia — início"
        >
          <Monogram className="size-9" />
          <span className="hidden flex-col leading-none xs:flex">
            <span className="font-display text-[1.35rem]">Charlene Gonçalves</span>
            <span className="text-[0.6875rem] tracking-[0.18em] text-mist">Odontologia</span>
          </span>
        </Link>

        <nav aria-label="Seções da página" className="hidden lg:block">
          <ul className="flex items-center gap-8 text-sm text-onyx/80">
            {nav.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="relative py-2 transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-px after:origin-left after:scale-x-0 after:bg-gold after:transition-transform after:duration-500 after:ease-silk hover:text-onyx hover:after:scale-x-100"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/entrar"
            className="hidden text-sm font-medium text-olive underline-offset-[6px] hover:underline sm:inline"
          >
            Área do paciente
          </Link>
          <a href="#agendamento" className={buttonClass("solid", "hidden min-h-11 px-5! sm:inline-flex")}>
            Agendar
          </a>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full border border-onyx/15 text-onyx lg:hidden"
            aria-label="Abrir menu"
            aria-haspopup="dialog"
            onClick={() => dialog.current?.showModal()}
          >
            <Menu aria-hidden className="size-5" />
          </button>
        </div>
      </div>

      <dialog
        ref={dialog}
        aria-label="Menu"
        className="m-0 ml-auto h-dvh max-h-none w-full max-w-sm bg-ivory p-0 text-onyx open:animate-[menu-in_.5s_var(--ease-silk)]"
        onClick={(e) => {
          if (e.target === dialog.current) close();
        }}
      >
        <div className="paper flex h-full flex-col px-6 pt-5 pb-8">
          <div className="flex items-center justify-between">
            <Monogram className="size-9" />
            <button
              type="button"
              className="grid size-11 place-items-center rounded-full border border-onyx/15"
              aria-label="Fechar menu"
              onClick={close}
            >
              <X aria-hidden className="size-5" />
            </button>
          </div>
          <nav aria-label="Menu principal" className="mt-12 flex-1">
            <ul className="flex flex-col gap-1">
              {nav.map((item) => (
                <li key={item.href}>
                  <a href={item.href} onClick={close} className="font-display block py-2 text-3xl text-onyx">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col gap-3">
            <a href="#agendamento" onClick={close} className={buttonClass("solid", "w-full")}>
              Agendar avaliação
            </a>
            <Link href="/entrar" onClick={close} className={buttonClass("outline", "w-full")}>
              Área do paciente
            </Link>
          </div>
        </div>
      </dialog>
    </header>
  );
}
