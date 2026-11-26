/** Aviso fixo quando a página usa dados sintéticos (somente desenvolvimento). */
export function SyntheticBanner() {
  return (
    <div
      role="note"
      className="fixed bottom-4 left-1/2 z-[60] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full bg-danger px-4 py-2 text-xs font-semibold whitespace-nowrap text-ivory shadow-lg"
    >
      Dados sintéticos de desenvolvimento — não publicar
    </div>
  );
}
