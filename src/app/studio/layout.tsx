import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "CG Studio", template: "%s · CG Studio" },
  robots: { index: false, follow: false },
};

export default function StudioRootLayout({ children }: LayoutProps<"/studio">) {
  return children;
}
