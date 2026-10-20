import { Link } from 'react-router-dom';
import { CatPhoto } from '../components/CatPhoto.jsx';
import { ButtonLink, EmptyState, ErrorState, PageHeader, Spinner } from '../components/ui.jsx';
import { gendered } from '../lib/cats.js';
import { useApi } from '../lib/useApi.js';
import { useTitle } from '../lib/useTitle.js';

const monthYear = (date) => new Date(date).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

export default function HappyEndings() {
  useTitle('Finales felices');
  const { data, error, loading, reload } = useApi('/finales-felices');

  return (
    <>
      <PageHeader title="Finales felices" emoji="💕">
        Gatitos que llegaron con miedo y hoy ronronean en su sofá. Esto es lo que conseguimos entre todos.
      </PageHeader>
      <div className="px-4">
        {loading && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data?.cats.length === 0 && (
          <EmptyState title="Muy pronto…" tone="menta" action={<ButtonLink to="/gatitos">Conoce a los gatitos</ButtonLink>}>
            Aquí aparecerán los gatitos que encuentren familia. ¿Será el tuyo el primero?
          </EmptyState>
        )}
        {data?.cats.length > 0 && (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.cats.map((cat, i) => (
              <li key={cat.id}>
                <Link
                  to={`/gatitos/${cat.slug}`}
                  className={`block rounded-[2rem] bg-nata p-3 pb-5 shadow-suave transition active:scale-[0.98] ${i % 2 ? 'md:rotate-1' : 'md:-rotate-1'}`}
                >
                  <CatPhoto cat={cat} sizes="(min-width: 768px) 33vw, 100vw" className="aspect-[4/3] w-full rounded-3xl" />
                  <div className="px-2 pt-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <h2 className="font-display text-2xl font-semibold">{cat.name}</h2>
                      {cat.adoptedAt && (
                        <span className="text-sm font-bold text-menta-oscuro">
                          {gendered('Adoptado', cat.sex)} en {monthYear(cat.adoptedAt)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-line text-cacao-suave">
                      {cat.happyEnding || `${cat.name} ya vive feliz con su nueva familia. 💕`}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
