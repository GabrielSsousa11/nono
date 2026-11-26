import Image from "next/image";
import type { Professional as ProfessionalData } from "@/lib/content";
import { Container, PendingNotice } from "./section";

/** Apresentação da profissional — renderiza apenas dados confirmados. */
export function Professional({ data }: { data: ProfessionalData }) {
  const hasContent = data.bio.length > 0;

  if (!hasContent) {
    return (
      <Container className="py-16">
        <PendingNotice>
          A apresentação da profissional (biografia, CRO, especialidades e foto) aparece aqui quando a clínica enviar os
          dados. Em produção esta seção fica oculta.
        </PendingNotice>
      </Container>
    );
  }

  return (
    <section id="profissional" aria-labelledby="profissional-title" className="paper">
      <Container className="grid gap-14 py-28 sm:py-36 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-5">
          {data.photo ? (
            <Image
              src={data.photo.src}
              alt={data.photo.alt}
              width={data.photo.width}
              height={data.photo.height}
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="aspect-[4/5] w-full object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="stone relative grid aspect-[4/5] w-full place-items-center bg-stone text-center"
            >
              <span className="font-display px-8 text-xl text-mist">Retrato aguardando fotografia oficial</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-8 lg:col-span-6 lg:col-start-7 lg:pb-6">
          <span className="gold-rule" aria-hidden />
          <h2
            id="profissional-title"
            className="font-display text-[clamp(2.5rem,5vw,4.5rem)] leading-none tracking-[-0.02em]"
          >
            {data.name}
          </h2>
          {(data.role || data.cro) && (
            <p className="text-sm text-mist">{[data.role, data.cro].filter(Boolean).join(", ")}</p>
          )}
          <div className="flex max-w-[36rem] flex-col gap-5 text-base text-onyx/85">
            {data.bio.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {data.specialties.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Especialidades">
              {data.specialties.map((s) => (
                <li key={s} className="rounded-full border border-onyx/15 px-4 py-1.5 text-sm text-olive">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </section>
  );
}
