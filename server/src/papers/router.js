import { Router } from 'express';
import { slugify } from '../cats.js';
import { today } from '../numbers.js';
import { parseId } from '../validation.js';
import { requirePapersAuth } from './access.js';
import { adoptionContract, confidentialityAgreement } from './agreements.js';
import { catFile, followUpSheet, fosterAgreement, vetReport } from './catDocs.js';
import {
  catPaperData,
  contractPaperData,
  donationsPaperData,
  inventoryPaperData,
  legalData,
  personPaperData,
  visitPaperData,
} from './data.js';
import { donationsList, inventoryList, medicationList } from './lists.js';
import { renderPdf } from './pdf.js';

// /api/papeles: los papeles de la asociación en PDF, listos para imprimir.
// Cada uno se puede sacar relleno con lo que hay en el panel o en blanco
// (/api/papeles/en-blanco/<tipo>). Los A5 admiten ?hoja=a4: dos medias
// hojas por folio para imprimir en casa y cortar.

const NOT_FOUND = 'No encontramos lo que querías imprimir';

/** Tipos de papel: tamaño, título y cómo se dibuja con o sin datos. */
const PAPERS = {
  ficha: { size: 'A4', title: 'Ficha del gato', pages: (data) => catFile(data) },
  seguimiento: { size: 'A5', title: 'Ficha de seguimiento', pages: (data) => (k) => followUpSheet(data, { k }) },
  acogida: { size: 'A5', title: 'Acuerdo de acogida', pages: (data, ctx) => fosterAgreement(data, ctx) },
  parte: { size: 'A5L', title: 'Parte de atención veterinaria', pages: (data) => vetReport(data?.visit, data?.cat) },
  contrato: { size: 'A4', title: 'Contrato de adopción', pages: (data, ctx) => adoptionContract(data, ctx) },
  confidencialidad: { size: 'A4', title: 'Compromiso de confidencialidad', pages: (data, ctx) => confidentialityAgreement(data, ctx) },
  medicacion: {
    size: 'A4',
    title: 'Inventario de medicación',
    pages: (data, ctx) => (k) => medicationList(data?.items ?? [], { ...ctx, today: data?.today ?? ctx.today, k, blank: !data }),
  },
  inventario: {
    size: 'A4',
    title: 'Inventario general',
    pages: (data, ctx) => (k) =>
      inventoryList(data?.items ?? [], { categories: data?.categories ?? {}, today: data?.today ?? ctx.today, k, blank: !data }),
  },
  donaciones: {
    size: 'A4',
    title: 'Registro de donaciones',
    pages: (data, ctx) => (k) => donationsList(data, { methods: data?.methods ?? {}, k, blank: !data }),
  },
};

async function send(req, res, type, data, name) {
  const paper = PAPERS[type];
  const legal = legalData();
  const ctx = { legal, today: today() };
  const twoUp = req.query.hoja === 'a4' && paper.size.startsWith('A5');
  const pdf = await renderPdf({ size: paper.size, pages: paper.pages(data, ctx), twoUp, title: `${paper.title} · Bigotes` });
  const file = `${[type, ...name.filter(Boolean).map((part) => slugify(String(part)))].join('-')}${twoUp ? '-a4' : ''}.pdf`;
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${file}"`);
  res.send(pdf);
}

const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));

export function papersRouter() {
  const router = Router();
  router.use(requirePapersAuth);

  router.get('/en-blanco/:type', async (req, res) => {
    if (!PAPERS[req.params.type]) return res.status(404).json({ error: NOT_FOUND });
    await send(req, res, req.params.type, null, ['en-blanco']);
  });

  router.get('/gatito/:id/:type', async (req, res) => {
    const { type } = req.params;
    if (!['ficha', 'seguimiento', 'acogida'].includes(type)) return res.status(404).json({ error: NOT_FOUND });
    const id = parseId(req.params.id, res);
    if (id === null) return;
    const cat = catPaperData(id);
    if (!cat) return res.status(404).json({ error: NOT_FOUND });
    await send(req, res, type, cat, [cat.fileNumber, cat.name]);
  });

  router.get('/parte/:visitId', async (req, res) => {
    const id = parseId(req.params.visitId, res);
    if (id === null) return;
    const data = visitPaperData(id);
    if (!data) return res.status(404).json({ error: NOT_FOUND });
    await send(req, res, 'parte', data, [data.visit.number, data.cat.name]);
  });

  router.get('/contrato/:applicationId', async (req, res) => {
    const id = parseId(req.params.applicationId, res);
    if (id === null) return;
    const data = contractPaperData(id);
    if (!data) return res.status(404).json({ error: NOT_FOUND });
    await send(req, res, 'contrato', data, [data.contract.number, data.cat?.name]);
  });

  router.get('/confidencialidad/:kind/:id', async (req, res) => {
    const { kind } = req.params;
    const id = parseId(req.params.id, res);
    if (id === null) return;
    // El de alguien del equipo solo lo saca esa persona o un bigote mayor.
    if (kind === 'equipo' && req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ error: 'Solo un bigote mayor puede hacer esto' });
    }
    const person = personPaperData(kind, id);
    if (!person) return res.status(404).json({ error: NOT_FOUND });
    await send(req, res, 'confidencialidad', person, [person.name]);
  });

  router.get('/medicacion', async (req, res) => {
    await send(req, res, 'medicacion', inventoryPaperData('medicacion'), []);
  });

  router.get('/inventario', async (req, res) => {
    await send(req, res, 'inventario', inventoryPaperData('general'), []);
  });

  // Por defecto, el año en curso. ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD para otro periodo.
  router.get('/donaciones', async (req, res) => {
    const year = new Date().getFullYear();
    const from = isDay(req.query.desde) ? req.query.desde : `${year}-01-01`;
    const to = isDay(req.query.hasta) ? req.query.hasta : `${year}-12-31`;
    await send(req, res, 'donaciones', donationsPaperData(from, to), [from.slice(0, 4) === to.slice(0, 4) ? from.slice(0, 4) : `${from}-${to}`]);
  });

  return router;
}
