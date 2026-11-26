import { client, loggedIn, startServer } from './helpers.js';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { numberDigits, pickRandom } from '../src/routes/adminRaffles.js';
import * as clientRaffles from '../../client/src/lib/raffles.js';

// Sorteos: papeletas con números al azar sin repetir y ganador sacado en el
// panel entre los números dados.

let server;
let admin;
let helper;

before(async () => {
  server = await startServer();
  admin = await loggedIn(server.base, 'admin');
  helper = await loggedIn(server.base, 'cuidabigotes');
});
after(() => server.close());

const cesta = (overrides = {}) => ({
  title: 'Sorteo de la cesta',
  prize: 'Cesta de Navidad con décimo de lotería',
  price: '3',
  numbersPerEntry: 5,
  totalNumbers: 1000,
  drawInfo: 'en directo en Instagram el 20 de diciembre',
  design: 'cesta',
  ...overrides,
});

async function newRaffle(overrides) {
  const res = await helper.post('/api/admin/sorteos', cesta(overrides));
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.data.raffle;
}

describe('utilidades', () => {
  test('cifras de los números según cuántos hay', () => {
    assert.equal(numberDigits(1000), 3);
    assert.equal(numberDigits(200), 3);
    assert.equal(numberDigits(100), 2);
    assert.equal(numberDigits(10000), 4);
    assert.equal(clientRaffles.formatNumber(7, 3), '007');
  });

  test('pickRandom no repite y solo usa números libres', () => {
    const free = [3, 5, 8, 13, 21];
    const picked = pickRandom(free, 5);
    assert.deepEqual([...picked].sort((a, b) => a - b), free);
    assert.deepEqual(pickRandom(free, 2, () => 0), [3, 21]);
  });

  test('el texto para WhatsApp lleva los números y el sorteo', () => {
    const text = clientRaffles.ticketText(
      { title: 'Sorteo de la cesta', digits: 3, drawInfo: 'en directo el 20 de diciembre' },
      { name: 'María', entries: 3, numbers: [27, 84, 126], amount: 9 },
    );
    assert.match(text, /María/);
    assert.match(text, /027 · 084 · 126/);
    assert.match(text, /3 participaciones · 3 números · 9 €/);
    assert.match(text, /en directo el 20 de diciembre/);
  });
});

describe('papeletas', () => {
  test('hace falta sesión', async () => {
    const res = await client(server.base).get('/api/admin/sorteos');
    assert.equal(res.status, 401);
  });

  test('da 5 números por participación, sin repetir, y cobra 3 € cada una', async () => {
    const raffle = await newRaffle();
    const res = await helper.post(`/api/admin/sorteos/${raffle.id}/papeletas`, { name: 'María', phone: '600 111 222', entries: 3, paid: true });
    assert.equal(res.status, 201, JSON.stringify(res.data));
    const { ticket } = res.data;
    assert.equal(ticket.ticketNumber, 1);
    assert.equal(ticket.numbers.length, 15);
    assert.equal(new Set(ticket.numbers).size, 15);
    assert.ok(ticket.numbers.every((n) => n >= 0 && n < 1000));
    assert.equal(ticket.amount, 9);
    assert.equal(res.data.raffle.stats.sold, 15);
    assert.equal(res.data.raffle.stats.paid, 9);
  });

  test('respeta los números que pide y no deja repetirlos', async () => {
    const raffle = await newRaffle();
    const first = await helper.post(`/api/admin/sorteos/${raffle.id}/papeletas`, { name: 'Ana', entries: 1, wanted: [27, 412] });
    assert.equal(first.status, 201);
    assert.ok(first.data.ticket.numbers.includes(27) && first.data.ticket.numbers.includes(412));
    const again = await helper.post(`/api/admin/sorteos/${raffle.id}/papeletas`, { name: 'Luis', entries: 1, wanted: [412] });
    assert.equal(again.status, 409);
    assert.match(again.data.fields.wanted, /412/);
    const tooMany = await helper.post(`/api/admin/sorteos/${raffle.id}/papeletas`, { name: 'Luis', entries: 1, wanted: [1, 2, 3, 4, 5, 6] });
    assert.equal(tooMany.status, 400);
    const outside = await helper.post(`/api/admin/sorteos/${raffle.id}/papeletas`, { name: 'Luis', entries: 1, wanted: [1000] });
    assert.equal(outside.status, 400);
  });

  test('reparte todos los números y avisa cuando se acaban', async () => {
    const raffle = await newRaffle({ totalNumbers: 20, numbersPerEntry: 5 });
    const all = [];
    for (let i = 0; i < 4; i += 1) {
      const res = await helper.post(`/api/admin/sorteos/${raffle.id}/papeletas`, { name: `Persona ${i}`, entries: 1 });
      assert.equal(res.status, 201);
      all.push(...res.data.ticket.numbers);
    }
    assert.deepEqual(all.sort((a, b) => a - b), Array.from({ length: 20 }, (_, i) => i));
    const full = await helper.post(`/api/admin/sorteos/${raffle.id}/papeletas`, { name: 'Tarde', entries: 1 });
    assert.equal(full.status, 409);
    assert.match(full.data.error, /todos los números/);
  });

  test('con papeletas dadas no cambian el precio ni los números', async () => {
    const raffle = await newRaffle();
    await helper.post(`/api/admin/sorteos/${raffle.id}/papeletas`, { name: 'Ana', entries: 1 });
    const res = await helper.put(`/api/admin/sorteos/${raffle.id}`, cesta({ price: '2' }));
    assert.equal(res.status, 409);
    const ok = await helper.put(`/api/admin/sorteos/${raffle.id}`, cesta({ drawInfo: 'el 21 de diciembre' }));
    assert.equal(ok.status, 200);
    assert.equal(ok.data.raffle.drawInfo, 'el 21 de diciembre');
  });

  test('solo un bigote mayor anula papeletas, y sus números quedan libres', async () => {
    const raffle = await newRaffle();
    const { data } = await helper.post(`/api/admin/sorteos/${raffle.id}/papeletas`, { name: 'Ana', entries: 2 });
    const url = `/api/admin/sorteos/${raffle.id}/papeletas/${data.ticket.id}`;
    assert.equal((await helper.delete(url)).status, 403);
    const res = await admin.delete(url);
    assert.equal(res.status, 200);
    assert.equal(res.data.raffle.stats.sold, 0);
  });
});

describe('sorteo', () => {
  test('el ganador sale de los números pagados y luego los suplentes', async () => {
    const raffle = await newRaffle({ totalNumbers: 1000 });
    const paid = await helper.post(`/api/admin/sorteos/${raffle.id}/papeletas`, { name: 'Pagada', entries: 1, paid: true });
    await helper.post(`/api/admin/sorteos/${raffle.id}/papeletas`, { name: 'Debe', entries: 1, paid: false });

    const first = await helper.post(`/api/admin/sorteos/${raffle.id}/sortear`, {});
    assert.equal(first.status, 201, JSON.stringify(first.data));
    const winner = first.data.raffle.draws[0];
    assert.equal(winner.position, 1);
    assert.equal(winner.winnerName, 'Pagada');
    assert.ok(paid.data.ticket.numbers.includes(winner.number));
    assert.equal(winner.poolSize, 5);
    assert.equal(first.data.raffle.closed, true);

    // Ya no se dan ni se anulan papeletas.
    const late = await helper.post(`/api/admin/sorteos/${raffle.id}/papeletas`, { name: 'Tarde', entries: 1 });
    assert.equal(late.status, 409);
    const cancel = await admin.delete(`/api/admin/sorteos/${raffle.id}/papeletas/${paid.data.ticket.id}`);
    assert.equal(cancel.status, 409);

    // Suplente: nunca repite un número ya sacado.
    const second = await helper.post(`/api/admin/sorteos/${raffle.id}/sortear`, { includeUnpaid: true });
    assert.equal(second.status, 201);
    const [a, b] = second.data.raffle.draws;
    assert.equal(b.position, 2);
    assert.notEqual(a.number, b.number);
    assert.equal(b.poolSize, 9);
  });

  test('sin números pagados no se puede sortear', async () => {
    const raffle = await newRaffle();
    await helper.post(`/api/admin/sorteos/${raffle.id}/papeletas`, { name: 'Debe', entries: 1, paid: false });
    const res = await helper.post(`/api/admin/sorteos/${raffle.id}/sortear`, {});
    assert.equal(res.status, 409);
  });

  test('solo un bigote mayor borra un sorteo', async () => {
    const raffle = await newRaffle();
    assert.equal((await helper.delete(`/api/admin/sorteos/${raffle.id}`)).status, 403);
    assert.equal((await admin.delete(`/api/admin/sorteos/${raffle.id}`)).status, 200);
    assert.equal((await admin.get(`/api/admin/sorteos/${raffle.id}`)).status, 404);
  });
});
