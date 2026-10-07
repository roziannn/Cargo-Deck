// Plain layout for printable documents: no sidebar or navigation, white paper.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-neutral-200 text-black print:bg-white">{children}</div>;
}
