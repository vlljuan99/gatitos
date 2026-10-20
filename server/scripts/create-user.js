// Alta de una persona del equipo desde la terminal (útil para la primera
// cuenta de administración). Imprime una contraseña temporal una sola vez.
//
//   npm run create-user -- --email ana@ejemplo.es --name Ana --role admin
//   docker exec -w /app/server bigotes-app npm run create-user -- --email … --name … --role admin
import { parseArgs } from 'node:util';
import { runMigrations, db } from '../src/db.js';
import { createUser, ROLES, temporaryPassword } from '../src/auth.js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    role: { type: 'string', default: 'cuidabigotes' },
  },
});

if (!values.email || !values.name || !ROLES[values.role]) {
  console.error('Uso: npm run create-user -- --email <email> --name <nombre> --role <admin|cuidabigotes>');
  process.exit(1);
}

runMigrations();
if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(values.email.trim().toLowerCase())) {
  console.error(`Ya existe alguien con el email ${values.email}`);
  process.exit(1);
}

const password = temporaryPassword();
const user = createUser({ email: values.email, name: values.name, role: values.role, password });
console.log(`✅ ${user.name} (${ROLES[user.role]}) creado.`);
console.log(`   Email: ${user.email}`);
console.log(`   Contraseña temporal: ${password}`);
console.log('   Pídele que la cambie en «Mi cuenta» al entrar.');
