"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { Field, inputClass } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { requestBooking } from "./actions";
import {
  bookingRequestSchema,
  maskPhone,
  periodOptions,
  type BookingActionState,
  type BookingRequest,
  type BookingRequestInput,
} from "./schema";

interface BookingFormProps {
  services: string[];
}

export function BookingForm({ services }: BookingFormProps) {
  const [state, setState] = useState<BookingActionState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const statusRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors },
  } = useForm<BookingRequestInput, unknown, BookingRequest>({
    resolver: zodResolver(bookingRequestSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      email: "",
      serviceInterest: "",
      preferredPeriod: "any",
      message: "",
      website: "",
    },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await requestBooking(data);
      setState(result);
      if (result.status === "invalid") {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof BookingRequestInput, { message });
        }
      }
      if (result.status === "success") reset();
    });
  });

  // Move o foco para a mensagem de resultado (leitores de tela anunciam o desfecho).
  useEffect(() => {
    if (state.status !== "idle" && state.status !== "invalid") statusRef.current?.focus();
  }, [state]);

  if (state.status === "success") {
    return (
      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        className="flex flex-col items-start gap-5 border-t border-gold/60 pt-8 outline-none"
      >
        <span className="grid size-12 place-items-center rounded-full bg-olive text-ivory">
          <Check aria-hidden className="size-5" />
        </span>
        <h3 className="font-display text-2xl text-onyx">Pedido recebido.</h3>
        <p className="max-w-md text-mist">
          A equipe da clínica vai entrar em contato pelo telefone informado para confirmar dia e horário. Seu pedido
          ainda não é uma consulta marcada.
        </p>
        <button type="button" className={buttonClass("ghost")} onClick={() => setState({ status: "idle" })}>
          Fazer outro pedido
        </button>
      </div>
    );
  }

  const serverMessage =
    state.status === "error" || state.status === "rate_limited" || state.status === "unavailable"
      ? state.message
      : null;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 sm:grid-cols-2" aria-describedby="booking-note">
      <Field label="Nome completo" error={errors.fullName?.message} className="sm:col-span-2">
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            autoComplete="name"
            className={inputClass}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            {...register("fullName")}
          />
        )}
      </Field>

      <Field label="Telefone ou WhatsApp" error={errors.phone?.message}>
        {({ id, describedBy, invalid }) => (
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <input
                id={id}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(00) 00000-0000"
                className={inputClass}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                name={field.name}
                ref={field.ref}
                value={field.value}
                onBlur={field.onBlur}
                onChange={(e) => field.onChange(maskPhone(e.target.value))}
              />
            )}
          />
        )}
      </Field>

      <Field label="E-mail" optional error={errors.email?.message}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            type="email"
            autoComplete="email"
            className={inputClass}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            {...register("email")}
          />
        )}
      </Field>

      <Field label="Motivo da consulta" optional>
        {({ id, describedBy }) => (
          <select
            id={id}
            className={`${inputClass} cursor-pointer`}
            aria-describedby={describedBy}
            {...register("serviceInterest")}
          >
            <option value="">Ainda não sei / prefiro conversar</option>
            {services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium text-olive">Melhor período</legend>
        <div className="flex flex-wrap gap-2">
          {periodOptions.map((p) => (
            <label key={p.value} className="cursor-pointer">
              <input type="radio" value={p.value} className="peer sr-only" {...register("preferredPeriod")} />
              <span className="inline-flex min-h-10 items-center rounded-full border border-onyx/20 px-4 text-sm text-onyx transition-colors duration-300 peer-checked:border-olive peer-checked:bg-olive peer-checked:text-ivory peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold-ink hover:border-onyx/50">
                {p.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Mensagem"
        optional
        hint="Não inclua informações de saúde aqui. Elas serão tratadas na consulta, com sigilo."
        error={errors.message?.message}
        className="sm:col-span-2"
      >
        {({ id, describedBy, invalid }) => (
          <textarea
            id={id}
            rows={3}
            maxLength={600}
            className={`${inputClass} resize-none`}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            {...register("message")}
          />
        )}
      </Field>

      {/* Honeypot: oculto de pessoas e de leitores de tela. */}
      <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Não preencha
          <input tabIndex={-1} autoComplete="off" {...register("website")} />
        </label>
      </div>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-onyx">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 accent-olive"
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? "consent-error" : undefined}
            {...register("consent")}
          />
          <span>
            Concordo com o uso destes dados para que a clínica entre em contato sobre o agendamento, conforme a{" "}
            <Link href="/privacidade" className="underline decoration-gold underline-offset-4 hover:decoration-onyx">
              política de privacidade
            </Link>
            .
          </span>
        </label>
        {errors.consent && (
          <p id="consent-error" role="alert" className="text-xs font-medium text-danger">
            {errors.consent.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p id="booking-note" className="max-w-sm text-xs text-mist">
          Este é um pedido de agendamento. A consulta é confirmada pela equipe da clínica.
        </p>
        <button type="submit" className={buttonClass("solid", "w-full sm:w-auto")} disabled={pending}>
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {pending ? "Enviando pedido" : "Enviar pedido de agendamento"}
        </button>
      </div>

      <div ref={statusRef} tabIndex={-1} aria-live="polite" className="outline-none sm:col-span-2">
        {serverMessage && (
          <p className="border-l-2 border-danger pl-4 text-sm text-danger" role="alert">
            {serverMessage}
          </p>
        )}
      </div>
    </form>
  );
}
