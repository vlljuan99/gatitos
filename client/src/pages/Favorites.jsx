import { Link } from 'react-router-dom';
import { HeartOff, Sparkles } from 'lucide-react';
import { CatPhoto } from '../components/CatPhoto.jsx';
import { ButtonLink, EmptyState, ErrorState, PageHeader, Spinner, Tag } from '../components/ui.jsx';
import { ageText, objectPronoun, statusLabel } from '../lib/cats.js';
import { useFavorites } from '../lib/favorites.js';
import { useApi } from '../lib/useApi.js';
import { useTitle } from '../lib/useTitle.js';

export default function Favorites() {
  useTitle('Tus favoritos');
  const { slugs, remove } = useFavorites();
  const { data, error, loading, reload } = useApi('/gatitos');
  const bySlug = new Map((data?.cats ?? []).map((cat) => [cat.slug, cat]));
  const cats = slugs.map((slug) => bySlug.get(slug)).filter(Boolean);
  const gone = data ? slugs.filter((slug) => !bySlug.has(slug)) : [];

  return (
    <>
      <PageHeader title="Tus favoritos" emoji="💕">
        Los gatitos que te han encantado. Se guardan solo en este móvil o navegador.
      </PageHeader>
      <div className="px-4">
        {loading && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data && slugs.length === 0 && (
          <EmptyState
            title="Todavía no hay ninguno"
            action={
              <ButtonLink to="/match">
                <Sparkles className="size-5" /> Probar el modo match
              </ButtonLink>
            }
          >
            Dale «Me encanta» a los gatitos que te roben el corazón y aparecerán aquí.
          </EmptyState>
        )}
        {cats.length > 0 && (
          <ul className="grid gap-3 md:grid-cols-2">
            {cats.map((cat) => (
              <li key={cat.slug} className="flex gap-3 rounded-3xl bg-nata p-3 shadow-suave">
                <Link to={`/gatitos/${cat.slug}`} className="shrink-0">
                  <CatPhoto cat={cat} sizes="112px" className="size-28 rounded-2xl" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/gatitos/${cat.slug}`} className="min-w-0">
                      <h2 className="truncate font-display text-xl font-semibold">{cat.name}</h2>
                      <p className="text-sm text-cacao-suave">{ageText(cat.birthDate)}</p>
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(cat.slug)}
                      className="grid size-10 shrink-0 place-items-center rounded-full text-cacao-suave hover:bg-cacao/5"
                      aria-label={`Quitar a ${cat.name} de favoritos`}
                    >
                      <HeartOff className="size-5" />
                    </button>
                  </div>
                  <div className="mt-auto pt-2">
                    {cat.status === 'reservado' ? (
                      <Tag tone="mantequilla">{statusLabel('reservado', cat.sex)} 💛</Tag>
                    ) : (
                      <ButtonLink to={`/adoptar?gatito=${cat.slug}`} size="sm">
                        Quiero conocer{objectPronoun(cat.sex)}
                      </ButtonLink>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {gone.length > 0 && (
          <div className="mt-6 rounded-3xl bg-menta p-4 text-menta-oscuro">
            <p className="font-bold">
              {gone.length === 1 ? 'Uno de tus favoritos ya no está en adopción' : `${gone.length} de tus favoritos ya no están en adopción`}
              : ¡seguramente {gone.length === 1 ? 'ha encontrado' : 'han encontrado'} familia! 💕
            </p>
            <button type="button" className="mt-2 font-bold underline" onClick={() => gone.forEach(remove)}>
              Quitar de la lista
            </button>
          </div>
        )}
      </div>
    </>
  );
}
