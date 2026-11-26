/**
 * CG Concierge — motor determinístico (gratuito, sem IA).
 * Responde só com dados verificados que recebe no contexto. Nunca diagnostica,
 * prescreve ou substitui a dentista. Testado em tests/unit/concierge.test.ts.
 */

export interface ConciergeContext {
  clinicName: string;
  authenticated: boolean;
  hours: string[];
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  services: { name: string; summary?: string | null }[];
  faq: { question: string; answer: string }[];
  nextAppointment?: { when: string; service: string; professional: string } | null;
  openSlots?: { service: string; when: string }[] | null;
}

export interface ConciergeAction {
  label: string;
  href?: string;
  handoff?: boolean;
}

export interface ConciergeReply {
  intent: string;
  text: string;
  actions: ConciergeAction[];
}

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const has = (text: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}`).test(text));

const CLINICAL = [
  "dor",
  "doendo",
  "doi ",
  "sangr",
  "incha",
  "febre",
  "pus",
  "infec",
  "remedio",
  "medicament",
  "antibiot",
  "anti inflam",
  "analgesic",
  "dipirona",
  "ibuprofeno",
  "diagnost",
  "e grave",
  "o que eu tenho",
  "quebrou o dente",
  "dente quebrado",
  "abscesso",
  "trauma",
];
const URGENT = [
  "muita dor",
  "dor forte",
  "sangrando muito",
  "nao para de sangrar",
  "inchaco no rosto",
  "dificuldade para respirar",
  "febre alta",
  "acidente",
  "trauma",
];

export function contactLine(ctx: ConciergeContext): string | null {
  const parts = [
    ctx.phone && `telefone ${ctx.phone}`,
    ctx.whatsapp && `WhatsApp ${ctx.whatsapp}`,
    ctx.email && `e-mail ${ctx.email}`,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function answer(rawQuestion: string, ctx: ConciergeContext): ConciergeReply {
  const q = normalize(rawQuestion).slice(0, 500);
  const contact = contactLine(ctx);
  const handoff: ConciergeAction = ctx.authenticated
    ? { label: "Enviar minha pergunta à equipe", handoff: true }
    : { label: "Pedir contato da equipe", href: "/#agendamento" };

  if (!q)
    return {
      intent: "empty",
      text: "Escreva sua dúvida. Posso ajudar com horários, serviços, agendamento e acesso ao portal.",
      actions: [],
    };

  // 1. Segurança: assuntos clínicos nunca são respondidos pelo assistente.
  if (
    has(
      ` ${q} `,
      CLINICAL.map((w) => w.trim()),
    )
  ) {
    const urgent = has(q, URGENT);
    return {
      intent: urgent ? "clinical_urgent" : "clinical",
      text:
        (urgent
          ? "Pelo que você descreveu, procure atendimento imediatamente. Em caso de sangramento intenso, inchaço no rosto, febre alta ou dificuldade para respirar, ligue para o SAMU (192) ou vá a um pronto-socorro. "
          : "Não posso avaliar sintomas, dar diagnósticos nem indicar medicamentos — isso precisa ser feito pela dentista. ") +
        (contact ? `Fale com a clínica: ${contact}.` : "Fale com a equipe da clínica pelo canal abaixo."),
      actions: urgent
        ? [{ label: "Ligar para o SAMU (192)", href: "tel:192" }, handoff]
        : [handoff, { label: "Agendar avaliação", href: ctx.authenticated ? "/portal/agenda" : "/#agendamento" }],
    };
  }

  if (has(q, ["atendente", "humano", "pessoa", "falar com alguem", "recepcao", "recepcionista"])) {
    return {
      intent: "human",
      text: ctx.authenticated
        ? "Posso encaminhar sua pergunta para a equipe responder pelo portal."
        : `Para falar com a equipe${contact ? `: ${contact}` : ", deixe seu contato no formulário de agendamento"}.`,
      actions: [handoff],
    };
  }

  if (has(q, ["minha consulta", "proxima consulta", "quando e minha", "meu horario", "meu agendamento"])) {
    if (!ctx.authenticated)
      return {
        intent: "my_appointment",
        text: "Para consultar sua agenda, entre na área do paciente.",
        actions: [{ label: "Entrar", href: "/entrar" }],
      };
    return ctx.nextAppointment
      ? {
          intent: "my_appointment",
          text: `Sua próxima consulta: ${ctx.nextAppointment.when}, ${ctx.nextAppointment.service} com ${ctx.nextAppointment.professional}.`,
          actions: [{ label: "Ver detalhes", href: "/portal/agenda" }],
        }
      : {
          intent: "my_appointment",
          text: "Não encontrei consultas futuras na sua agenda.",
          actions: [{ label: "Agendar", href: "/portal/agenda" }],
        };
  }

  if (has(q, ["remarc", "desmarc", "cancel", "mudar o horario", "trocar o horario", "adiar"])) {
    return ctx.authenticated
      ? {
          intent: "reschedule",
          text: "Você pode remarcar ou cancelar pelo portal, respeitando a antecedência mínima. Em cima da hora, fale com a clínica.",
          actions: [{ label: "Abrir minhas consultas", href: "/portal/agenda" }, handoff],
        }
      : {
          intent: "reschedule",
          text: `Para remarcar, entre na área do paciente${contact ? ` ou fale com a clínica: ${contact}` : ""}.`,
          actions: [{ label: "Entrar", href: "/entrar" }],
        };
  }

  if (has(q, ["vaga", "disponivel", "disponibilidade", "horarios livres", "tem horario", "encaixe"])) {
    if (!ctx.authenticated)
      return {
        intent: "availability",
        text: "Envie um pedido de agendamento com o melhor período e a equipe retorna com os horários disponíveis.",
        actions: [{ label: "Pedir agendamento", href: "/#agendamento" }],
      };
    if (ctx.openSlots && ctx.openSlots.length) {
      return {
        intent: "availability",
        text: `Próximos horários livres: ${ctx.openSlots
          .slice(0, 4)
          .map((s) => `${s.when} (${s.service})`)
          .join("; ")}.`,
        actions: [{ label: "Escolher horário", href: "/portal/agenda" }],
      };
    }
    return {
      intent: "availability",
      text: "Não encontrei horários para agendamento pelo portal nos próximos dias. Entre na lista de espera ou fale com a equipe.",
      actions: [{ label: "Lista de espera", href: "/portal/agenda" }, handoff],
    };
  }

  if (has(q, ["agend", "marcar", "consulta", "avaliacao"])) {
    return ctx.authenticated
      ? {
          intent: "booking",
          text: "Você pode agendar pelo portal, escolhendo serviço, profissional e horário.",
          actions: [{ label: "Agendar", href: "/portal/agenda" }],
        }
      : {
          intent: "booking",
          text: "Envie um pedido de agendamento: leva menos de um minuto e a equipe confirma o horário com você.",
          actions: [{ label: "Pedir agendamento", href: "/#agendamento" }],
        };
  }

  for (const f of ctx.faq) {
    const keys = normalize(f.question)
      .split(" ")
      .filter((w) => w.length > 4);
    if (keys.length && keys.filter((k) => q.includes(k)).length >= Math.min(2, keys.length))
      return { intent: "faq", text: f.answer, actions: [] };
  }

  const service = ctx.services.find((s) =>
    normalize(s.name)
      .split(" ")
      .some((w) => w.length > 4 && q.includes(w)),
  );
  if (service) {
    return {
      intent: "service",
      text: `${service.name}${service.summary ? `: ${service.summary}` : "."} A indicação depende de avaliação individual com a dentista.`,
      actions: [{ label: "Agendar avaliação", href: ctx.authenticated ? "/portal/agenda" : "/#agendamento" }],
    };
  }

  if (has(q, ["horario", "funciona", "abre", "fecha", "atende", "sabado", "domingo", "feriado"])) {
    return ctx.hours.length
      ? { intent: "hours", text: `Horário de atendimento: ${ctx.hours.join("; ")}.`, actions: [] }
      : {
          intent: "hours",
          text: `O horário de atendimento ainda não foi publicado no site.${contact ? ` Confirme com a clínica: ${contact}.` : ""}`,
          actions: [handoff],
        };
  }

  if (has(q, ["endereco", "onde fica", "localiza", "como chegar", "estaciona", "mapa"])) {
    return ctx.address
      ? { intent: "address", text: `Endereço: ${ctx.address}.`, actions: [] }
      : { intent: "address", text: "O endereço ainda não foi publicado no site.", actions: [handoff] };
  }

  if (has(q, ["telefone", "whatsapp", "contato", "email", "ligar"])) {
    return contact
      ? { intent: "contact", text: `Contato da clínica: ${contact}.`, actions: [] }
      : { intent: "contact", text: "Os canais de contato ainda não foram publicados no site.", actions: [handoff] };
  }

  if (has(q, ["portal", "login", "entrar", "acesso", "senha", "link"])) {
    return {
      intent: "portal",
      text: "O acesso ao portal é liberado pela clínica para pacientes cadastrados. Na página Área do paciente, informe o e-mail cadastrado e você receberá um link de acesso — não há senha.",
      actions: [{ label: "Área do paciente", href: "/entrar" }],
    };
  }

  if (has(q, ["lgpd", "privacidade", "meus dados", "dados pessoais", "excluir meus dados"])) {
    return {
      intent: "privacy",
      text: "Seus dados são tratados conforme a LGPD, com acesso restrito por função e registro de acessos. Você pode pedir acesso, correção ou eliminação dos dados.",
      actions: [{ label: "Política de privacidade", href: "/privacidade" }],
    };
  }

  if (has(q, ["servico", "tratamento", "procedimento", "faz ", "fazem", "oferece"])) {
    return ctx.services.length
      ? {
          intent: "services",
          text: `Serviços cadastrados: ${ctx.services.map((s) => s.name).join(", ")}.`,
          actions: [],
        }
      : { intent: "services", text: "A lista de tratamentos ainda não foi publicada no site.", actions: [handoff] };
  }

  if (
    has(q, [
      "convenio",
      "plano de saude",
      "pagamento",
      "pagar",
      "parcel",
      "preco",
      "valor",
      "quanto custa",
      "pix",
      "cartao",
    ])
  ) {
    return {
      intent: "payment",
      text: "Valores e formas de pagamento dependem da avaliação. A equipe informa os detalhes.",
      actions: [handoff],
    };
  }

  if (has(q, ["oi", "ola", "bom dia", "boa tarde", "boa noite"])) {
    return {
      intent: "greeting",
      text: `Olá! Sou a recepção digital da ${ctx.clinicName}. Posso ajudar com horários, serviços, agendamento e acesso ao portal.`,
      actions: [],
    };
  }

  return {
    intent: "fallback",
    text: "Não tenho essa informação. Posso ajudar com agendamento, remarcação, horários, serviços, endereço e acesso ao portal — ou encaminhar sua pergunta para a equipe.",
    actions: [handoff],
  };
}
