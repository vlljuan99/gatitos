import { client, dataDir, loggedIn, startServer } from './helpers.js';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../src/db.js';
import { CAT_VIDEOS_DIR, VIDEO_TMP_DIR } from '../src/config.js';
import { originalPath, resumeVideoJobs, videosIdle, videoSupport } from '../src/videos.js';

// Estas pruebas necesitan ffmpeg (en CI y en la imagen Docker está instalado).
const skip = videoSupport() ? false : 'ffmpeg no está instalado';

let server;
let helper;
let admin;
let phoneVideo;

/** Vídeo «de móvil»: vertical por rotación, 60 fps y con ubicación GPS. */
function makePhoneVideo() {
  const flat = path.join(dataDir, 'plano.mov');
  const file = path.join(dataDir, 'movil.mov');
  const ffmpeg = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
  ffmpeg([
    '-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=60',
    '-f', 'lavfi', '-i', 'sine=frequency=440',
    '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac',
    '-metadata', 'location=+38.6833-006.4000/', '-metadata', 'make=Gatofono', flat,
  ]);
  // El móvil graba en horizontal y marca el giro: así llega un vídeo vertical.
  ffmpeg(['-display_rotation', '90', '-i', flat, '-c', 'copy', file]);
  return fs.readFileSync(file);
}

const probe = (file) =>
  JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format_tags:stream=codec_name,width,height,r_frame_rate', '-of', 'json', file]),
  );

function videoForm(buffer, type = 'video/quicktime', name = 'movil.mov') {
  const form = new FormData();
  form.append('video', new Blob([buffer], { type }), name);
  return form;
}

before(async () => {
  server = await startServer();
  admin = await loggedIn(server.base, 'admin');
  helper = await loggedIn(server.base, 'cuidabigotes');
  if (!skip) phoneVideo = makePhoneVideo();
});
after(() => server.close());

describe('vídeos', { skip }, () => {
  test('se preparan en segundo plano, sin ubicación y listos para cualquier móvil', async () => {
    const cat = (await helper.post('/api/admin/gatitos', { name: 'Peliculera', status: 'disponible' })).data.cat;
    assert.match(JSON.stringify(probe(path.join(dataDir, 'movil.mov'))), /38\.6833/, 'el original lleva GPS');

    const res = await helper.post(`/api/admin/gatitos/${cat.id}/videos`, videoForm(phoneVideo));
    assert.equal(res.status, 202, JSON.stringify(res.data));
    assert.equal(res.data.cat.videos.length, 1);
    assert.equal(res.data.cat.videos[0].status, 'procesando');
    assert.equal(res.data.cat.videos[0].url, null);

    // Mientras se prepara no sale en la web.
    const pending = await client(server.base).get('/api/gatitos/peliculera');
    assert.deepEqual(pending.data.cat.videos, []);

    await videosIdle();
    const [video] = (await helper.get(`/api/admin/gatitos/${cat.id}`)).data.cat.videos;
    assert.equal(video.status, 'listo', video.error);
    assert.deepEqual([video.width, video.height], [720, 1280], 'girado y reducido a 720p');
    assert.ok(video.duration > 1.5 && video.duration < 3, `duración ${video.duration}`);

    const file = path.join(CAT_VIDEOS_DIR, path.basename(video.url));
    const info = probe(file);
    assert.equal(info.streams[0].codec_name, 'h264');
    assert.equal(info.streams[0].r_frame_rate, '30/1');
    assert.doesNotMatch(JSON.stringify(info.format.tags ?? {}), /38\.6833|Gatofono/, 'sin ubicación ni móvil');
    assert.equal(fs.existsSync(originalPath(path.basename(video.url, '.mp4'))), false, 'el original se borra');

    // Se sirve con rangos (Safari no reproduce vídeos sin ellos) y la portada existe.
    const partial = await fetch(server.base + video.url, { headers: { range: 'bytes=0-99' } });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get('content-type'), 'video/mp4');
    assert.equal((await fetch(server.base + video.poster)).status, 200);

    const detail = await client(server.base).get('/api/gatitos/peliculera');
    assert.equal(detail.data.cat.videos.length, 1);
    assert.equal(detail.data.cat.videos[0].status, undefined, 'la web no ve datos internos');
    const list = await client(server.base).get('/api/gatitos');
    assert.equal(list.data.cats.find((c) => c.id === cat.id).videos.length, 1);

    const removed = await helper.delete(`/api/admin/gatitos/${cat.id}/videos/${video.id}`);
    assert.deepEqual(removed.data.cat.videos, []);
    assert.equal(fs.existsSync(file), false);
  });

  test('un fichero que no es vídeo acaba en error y no se publica', async () => {
    const cat = (await helper.post('/api/admin/gatitos', { name: 'Falsa', status: 'disponible' })).data.cat;
    const notVideo = await helper.post(`/api/admin/gatitos/${cat.id}/videos`, videoForm(Buffer.from('hola'), 'text/plain', 'nota.txt'));
    assert.equal(notVideo.status, 400);
    assert.match(notVideo.data.error, /vídeo/);

    // Con tipo de vídeo pero contenido falso: se acepta y falla al prepararlo.
    const disguised = await helper.post(`/api/admin/gatitos/${cat.id}/videos`, videoForm(Buffer.from('#EXTM3U\nfile:///etc/passwd\n'), 'video/mp4', 'x.mp4'));
    assert.equal(disguised.status, 202);
    await videosIdle();
    const [video] = (await helper.get(`/api/admin/gatitos/${cat.id}`)).data.cat.videos;
    assert.equal(video.status, 'error');
    assert.match(video.error, /No he podido leer/);
    assert.deepEqual((await client(server.base).get('/api/gatitos/falsa')).data.cat.videos, []);
    assert.deepEqual(fs.readdirSync(VIDEO_TMP_DIR), [], 'no quedan restos');
  });

  test('borrar el gatito borra sus vídeos', async () => {
    const cat = (await admin.post('/api/admin/gatitos', { name: 'Efímera' })).data.cat;
    await admin.post(`/api/admin/gatitos/${cat.id}/videos`, videoForm(phoneVideo));
    await videosIdle();
    const [video] = (await admin.get(`/api/admin/gatitos/${cat.id}`)).data.cat.videos;
    const file = path.join(CAT_VIDEOS_DIR, path.basename(video.url));
    assert.ok(fs.existsSync(file));
    assert.equal((await admin.delete(`/api/admin/gatitos/${cat.id}`)).status, 200);
    assert.equal(fs.existsSync(file), false);
    assert.equal(fs.existsSync(file.replace('.mp4', '-poster.webp')), false);
  });

  test('al arrancar se retoman los vídeos a medias y se limpian restos', async () => {
    const cat = (await helper.post('/api/admin/gatitos', { name: 'Reinicio' })).data.cat;
    const insert = db.prepare("INSERT INTO cat_videos (cat_id, file_key, status) VALUES (?, ?, 'procesando')");
    // Uno con su original (se prepara) y otro sin él (se marca como error).
    fs.writeFileSync(originalPath('con-original'), phoneVideo);
    const withOriginal = insert.run(cat.id, 'con-original').lastInsertRowid;
    const lost = insert.run(cat.id, 'sin-original').lastInsertRowid;
    fs.writeFileSync(path.join(VIDEO_TMP_DIR, 'subida-cortada.original'), 'a medias');

    assert.equal(await resumeVideoJobs(), 2);
    assert.equal(fs.existsSync(path.join(VIDEO_TMP_DIR, 'subida-cortada.original')), false);
    await videosIdle();
    const status = (id) => db.prepare('SELECT status FROM cat_videos WHERE id = ?').get(id).status;
    assert.equal(status(withOriginal), 'listo');
    assert.equal(status(lost), 'error');
  });
});
