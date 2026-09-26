import { ChevronDown } from 'lucide-react';
import { useSite } from '../components/Layout.jsx';
import { ButtonLink, Card, ErrorState, PageHeader, Spinner, cx } from '../components/ui.jsx';
import { useTitle } from '../lib/useTitle.js';

const STEP_TONES = ['bg-fresa-claro', 'bg-menta', 'bg-lavanda', 'bg-mantequilla', 'bg-melocoton', 'bg-cielo'];
const STEP_EMOJIS = ['🧺', '🩺', '🏠', '😻', '📝', '💌', '✨', '🐾'];

export function Faq({ items }) {
  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li key={item.q}>
          <details className="group rounded-3xl bg-nata shadow-suave">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-bold [&::-webkit-details-marker]:hidden">
              {item.q}
              <ChevronDown className="size-5 shrink-0 text-fresa transition group-open:rotate-180" aria-hidden />
            </summary>
            <p className="whitespace-pre-line px-5 pb-5 text-cacao-suave">{item.a}</p>
          </details>
        </li>
      ))}
    </ul>
  );
}

export default function HowWeWork() {
  useTitle('Cómo trabajamos');
  const { data, error, loading, reload } = useSite();
  if (loading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { about, process, adoption, faq } = data.content;

  return (
    <>
      <PageHeader title="Cómo trabajamos" emoji="🩺">
        <p className="whitespace-pre-line">{about.intro}</p>
      </PageHeader>

      <section className="px-4" aria-labelledby="proceso">
        <h2 id="proceso" className="sr-only">
          Nuestro proceso
        </h2>
        <ol className="relative grid gap-4 md:grid-cols-3">
          {process.steps.map((step, i) => (
            <li key={`${step.title}-${i}`} className="relative flex gap-4 rounded-3xl bg-nata p-5 shadow-suave md:flex-col">
              <span
                className={cx('grid size-14 shrink-0 place-items-center rounded-2xl text-2xl', STEP_TONES[i % STEP_TONES.length])}
                aria-hidden
              >
                {STEP_EMOJIS[i % STEP_EMOJIS.length]}
              </span>
              <div>
                <p className="text-sm font-bold text-fresa-oscuro">Paso {i + 1}</p>
                <h3 className="font-display text-xl font-semibold">{step.title}</h3>
                <p className="mt-1 text-cacao-suave">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 grid gap-4 px-4 md:grid-cols-2" aria-labelledby="requisitos">
        <Card>
          <h2 id="requisitos" className="font-display text-2xl font-semibold">
            Requisitos para adoptar
          </h2>
          <ul className="mt-4 grid gap-3">
            {adoption.requirements.map((req) => (
              <li key={req} className="flex gap-3">
                <span className="mt-0.5 text-fresa" aria-hidden>
                  🐾
                </span>
                <span>{req}</span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="grid gap-4">
          {adoption.delivery && (
            <Card className="bg-menta">
              <h2 className="font-display text-xl font-semibold text-menta-oscuro">¿Cómo se van a casa?</h2>
              <p className="mt-2 whitespace-pre-line">{adoption.delivery}</p>
            </Card>
          )}
          {adoption.fee && (
            <Card className="bg-mantequilla">
              <h2 className="font-display text-xl font-semibold text-mantequilla-oscuro">Cuota de adopción</h2>
              <p className="mt-2 whitespace-pre-line">{adoption.fee}</p>
            </Card>
          )}
        </div>
      </section>

      {faq.items.length > 0 && (
        <section className="mt-12 px-4" aria-labelledby="preguntas">
          <h2 id="preguntas" className="mb-4 font-display text-2xl font-semibold">
            Preguntas frecuentes
          </h2>
          <Faq items={faq.items} />
        </section>
      )}

      <section className="mt-12 px-4">
        <div className="rounded-[2rem] bg-fresa p-6 text-center text-white md:p-10">
          <h2 className="font-display text-3xl font-semibold">¿Lo tienes claro?</h2>
          <p className="mt-2 text-lg opacity-95">Rellena la solicitud y te contamos los siguientes pasos.</p>
          <ButtonLink to="/adoptar" variant="secondary" size="lg" className="mt-5">
            Quiero adoptar
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
