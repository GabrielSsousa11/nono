"use client";

import { useEffect, useState, useTransition } from "react";
import { searchPatients } from "./actions";

/** Busca de paciente com envio do id em um campo oculto (`name`). */
export function PatientPicker({ name = "patientId", label = "Paciente" }: { name?: string; label?: string }) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ id: string; name: string; detail: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [, start] = useTransition();
  useEffect(() => {
    if (query.trim().length < 2 || selected) return;
    const t = setTimeout(() => start(async () => setFound(await searchPatients(query))), 250);
    return () => clearTimeout(t);
  }, [query, selected]);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${name}-search`} className="text-sm font-medium text-olive">{label}</label>
      <input
        id={`${name}-search`}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setSelected(""); }}
        placeholder="Digite nome ou telefone"
        autoComplete="off"
        className="w-full border-0 border-b border-onyx/25 bg-transparent py-2.5 focus:border-olive focus:ring-0 focus:outline-none"
      />
      <input type="hidden" name={name} value={selected} />
      {!selected && found.length > 0 && (
        <ul className="flex flex-col border border-onyx/10">
          {found.map((p) => (
            <li key={p.id}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-stone" onClick={() => { setSelected(p.id); setQuery(p.name); setFound([]); }}>
                {p.name} <span className="text-mist">{p.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
