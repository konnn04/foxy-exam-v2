import { Head } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';

interface Props {
  version: string;
  sections: { title: string; body: string }[];
}

/** The policy a candidate agrees to at every login before any biometric processing. Public on purpose: it is linked from the client. */
export default function BiometricPolicy({ version, sections }: Props) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Head title="Chính sách dữ liệu sinh trắc học" />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
        <header className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold">Chính sách xử lý dữ liệu sinh trắc học</h1>
            <p className="text-sm text-muted-foreground">Phiên bản {version} · áp dụng cho thí sinh dùng FoxyExam</p>
          </div>
        </header>
        {sections.map((s, i) => (
          <section key={s.title} className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-1.5 font-semibold">
              {i + 1}. {s.title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </section>
        ))}
      </main>
    </div>
  );
}
