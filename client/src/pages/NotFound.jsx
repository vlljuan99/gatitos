import { ButtonLink, EmptyState } from '../components/ui.jsx';
import { useTitle } from '../lib/useTitle.js';

export default function NotFound() {
  useTitle('Página no encontrada');
  return (
    <div className="py-10">
      <EmptyState
        title="Miau… esta página no existe"
        tone="cielo"
        action={
          <div className="grid gap-3">
            <ButtonLink to="/">Volver al inicio</ButtonLink>
            <ButtonLink to="/gatitos" variant="secondary">
              Ver gatitos
            </ButtonLink>
          </div>
        }
      >
        Puede que algún gatito haya jugado con el enlace. 🧶
      </EmptyState>
    </div>
  );
}
