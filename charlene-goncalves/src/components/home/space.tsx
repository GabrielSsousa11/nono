import Image from "next/image";
import type { Photo } from "@/lib/content";
import { Container, PendingNotice, SectionHeading } from "./section";

/** Conheça o espaço — somente fotografias autênticas fornecidas pela clínica. */
export function Space({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) {
    return (
      <Container className="py-16">
        <PendingNotice>
          “Conheça o espaço” exibe somente fotografias reais da clínica. Nenhum banco de imagens é usado. Em produção a
          seção fica oculta até o envio das fotos.
        </PendingNotice>
      </Container>
    );
  }

  const [lead, ...rest] = photos;
  return (
    <section id="espaco" aria-labelledby="espaco-title" className="paper">
      <Container className="py-28 sm:py-36">
        <SectionHeading id="espaco-title" title="Conheça o espaço" />
        <div className="mt-16 grid gap-4 md:grid-cols-12">
          <Image
            src={lead.src}
            alt={lead.alt}
            width={lead.width}
            height={lead.height}
            sizes="(min-width: 768px) 66vw, 100vw"
            className="aspect-[4/3] w-full object-cover md:col-span-8"
          />
          <div className="grid gap-4 md:col-span-4">
            {rest.slice(0, 2).map((p) => (
              <Image
                key={p.src}
                src={p.src}
                alt={p.alt}
                width={p.width}
                height={p.height}
                sizes="(min-width: 768px) 33vw, 100vw"
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
