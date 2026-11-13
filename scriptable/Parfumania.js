// Parfumania — widget do perfume do dia (app Scriptable para iPhone).
// Gerado pelo app em Configurações → Widget do iPhone. Não compartilhe:
// a linha TOKEN é a sua chave pessoal (dá para revogar no app).
// Tamanhos: pequeno, médio, grande e tela bloqueada (retangular, em linha, circular).

const ENDPOINT = '__ENDPOINT__';
const TOKEN = '__TOKEN__';

// Cores do Parfumania
const C = {
  bgTop: new Color('#1d1914'),
  bgBottom: new Color('#0d0c0b'),
  gold: new Color('#c9a96e'),
  goldSoft: new Color('#c9a96e', 0.18),
  text: new Color('#ede8df'),
  muted: new Color('#a9a297'),
  faint: new Color('#7d776d'),
  card: new Color('#ffffff', 0.06),
};
const serif = (size) => new Font('Georgia-Bold', size);
const sans = (size, weight = 'regular') =>
  weight === 'semibold' ? Font.semiboldSystemFont(size) : weight === 'medium' ? Font.mediumSystemFont(size) : Font.systemFont(size);

const fm = FileManager.local();
const cachePath = fm.joinPath(fm.cacheDirectory(), 'parfumania-widget.json');
const imgPath = (key) => fm.joinPath(fm.cacheDirectory(), `parfumania-${key}.img`);

async function load() {
  const tz = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo');
  try {
    const req = new Request(`${ENDPOINT}?task=widget&token=${encodeURIComponent(TOKEN)}&tz=${tz}`);
    req.timeoutInterval = 15;
    const data = await req.loadJSON();
    if (data && data.pick) {
      fm.writeString(cachePath, JSON.stringify(data));
      return data;
    }
    if (data && data.error) return { error: data.error };
  } catch (e) {
    /* sem internet: usa o último resultado */
  }
  return fm.fileExists(cachePath) ? JSON.parse(fm.readString(cachePath)) : { error: 'Sem conexão. Tente de novo mais tarde.' };
}

async function image(url, key) {
  if (!url) return null;
  const path = imgPath(key);
  try {
    const img = await new Request(url).loadImage();
    fm.writeImage(path, img);
    return img;
  } catch (e) {
    return fm.fileExists(path) ? fm.readImage(path) : null;
  }
}

function weatherSymbol(w) {
  const c = w && w.code;
  if (c === undefined || c === null) return 'thermometer.medium';
  const night = w.isDay === false;
  if (c === 0) return night ? 'moon.stars.fill' : 'sun.max.fill';
  if (c <= 2) return night ? 'cloud.moon.fill' : 'cloud.sun.fill';
  if (c === 3) return 'cloud.fill';
  if (c <= 48) return 'cloud.fog.fill';
  if (c <= 57) return 'cloud.drizzle.fill';
  if (c <= 67 || (c >= 80 && c <= 82)) return 'cloud.rain.fill';
  if (c <= 86) return 'cloud.snow.fill';
  return 'cloud.bolt.rain.fill';
}

const temp = (w) => (w && typeof w.temperatureC === 'number' ? `${Math.round(w.temperatureC)}°` : '');
const deepLink = (data, id) => `${data.appUrl}#/colecao/${id}`;

function background(widget) {
  const g = new LinearGradient();
  g.colors = [C.bgTop, C.bgBottom];
  g.locations = [0, 1];
  widget.backgroundGradient = g;
}

function header(stack, data, small) {
  const row = stack.addStack();
  row.centerAlignContent();
  const brand = row.addText(small ? 'PARFUMANIA' : 'PARFUMANIA · PERFUME DO DIA');
  brand.font = sans(9, 'semibold');
  brand.textColor = C.gold;
  row.addSpacer();
  const sym = SFSymbol.named(weatherSymbol(data.weather));
  if (sym) {
    sym.applyFont(sans(11, 'medium'));
    const icon = row.addImage(sym.image);
    icon.imageSize = new Size(13, 13);
    icon.tintColor = C.gold;
    row.addSpacer(3);
  }
  const t = row.addText(temp(data.weather));
  t.font = sans(11, 'semibold');
  t.textColor = C.text;
}

function photo(stack, img, w, h) {
  const box = stack.addStack();
  box.size = new Size(w, h);
  box.cornerRadius = 12;
  box.backgroundColor = new Color('#ffffff');
  box.centerAlignContent();
  if (img) {
    const i = box.addImage(img);
    i.imageSize = new Size(w - 8, h - 8);
    i.applyFittingContentMode();
  } else {
    box.backgroundColor = C.goldSoft;
    const s = SFSymbol.named('drop.fill');
    if (s) {
      const i = box.addImage(s.image);
      i.imageSize = new Size(w / 3, w / 3);
      i.tintColor = C.gold;
    }
  }
}

function text(stack, value, font, color, lines = 1) {
  const t = stack.addText(value || '');
  t.font = font;
  t.textColor = color;
  t.lineLimit = lines;
  t.minimumScaleFactor = 0.75;
  return t;
}

async function small(data) {
  const w = new ListWidget();
  background(w);
  w.setPadding(12, 12, 12, 12);
  header(w, data, true);
  w.addSpacer(8);
  const row = w.addStack();
  photo(row, await image(data.pick.image, data.pick.id), 46, 56);
  row.addSpacer();
  w.addSpacer(8);
  text(w, data.pick.name, serif(15), C.text, 2);
  text(w, data.pick.brand, sans(10), C.muted);
  w.url = deepLink(data, data.pick.id);
  return w;
}

async function medium(data) {
  const w = new ListWidget();
  background(w);
  w.setPadding(14, 14, 14, 14);
  header(w, data, false);
  w.addSpacer(8);
  const row = w.addStack();
  photo(row, await image(data.pick.image, data.pick.id), 64, 80);
  row.addSpacer(12);
  const col = row.addStack();
  col.layoutVertically();
  text(col, (data.pick.brand || '').toUpperCase(), sans(9, 'semibold'), C.gold);
  text(col, data.pick.name, serif(18), C.text, 2);
  col.addSpacer(3);
  text(col, data.pick.reason, sans(11), C.muted, 2);
  if (data.alternatives && data.alternatives.length) {
    col.addSpacer(4);
    text(col, `Também: ${data.alternatives.map((a) => a.name).join(' · ')}`, sans(10), C.faint);
  }
  w.url = deepLink(data, data.pick.id);
  return w;
}

async function large(data) {
  const w = new ListWidget();
  background(w);
  w.setPadding(16, 16, 16, 16);
  header(w, data, false);
  if (data.weather && (data.weather.description || data.weather.place)) {
    w.addSpacer(2);
    text(w, [data.weather.description, data.weather.place].filter(Boolean).join(' · '), sans(10), C.faint);
  }
  w.addSpacer(10);
  const main = w.addStack();
  photo(main, await image(data.pick.image, data.pick.id), 92, 112);
  main.addSpacer(14);
  const col = main.addStack();
  col.layoutVertically();
  text(col, 'SUGESTÃO DE HOJE', sans(9, 'semibold'), C.gold);
  col.addSpacer(2);
  text(col, data.pick.name, serif(22), C.text, 2);
  text(col, data.pick.brand, sans(12), C.muted);
  col.addSpacer(6);
  text(col, data.pick.reason, sans(12), C.text, 2);
  w.addSpacer(14);
  if (data.alternatives && data.alternatives.length) {
    text(w, 'TAMBÉM COMBINAM', sans(9, 'semibold'), C.gold);
    w.addSpacer(6);
    for (const alt of data.alternatives) {
      const r = w.addStack();
      r.centerAlignContent();
      r.backgroundColor = C.card;
      r.cornerRadius = 10;
      r.setPadding(6, 8, 6, 8);
      photo(r, await image(alt.image, alt.id), 30, 36);
      r.addSpacer(10);
      const c = r.addStack();
      c.layoutVertically();
      text(c, alt.name, sans(12, 'semibold'), C.text);
      text(c, alt.reason, sans(10), C.muted);
      r.addSpacer();
      r.url = deepLink(data, alt.id);
      w.addSpacer(6);
    }
  }
  w.addSpacer();
  text(w, `Usos nesta semana: ${data.weekUses ?? 0}`, sans(10), C.faint);
  w.url = deepLink(data, data.pick.id);
  return w;
}

function lockScreen(data, family) {
  const w = new ListWidget();
  const name = data.pick ? data.pick.name : 'Parfumania';
  if (family === 'accessoryInline') {
    w.addText(`${temp(data.weather)} · ${name}`);
  } else if (family === 'accessoryCircular') {
    const s = SFSymbol.named(weatherSymbol(data.weather));
    if (s) w.addImage(s.image).imageSize = new Size(18, 18);
    const t = w.addText(temp(data.weather) || '—');
    t.font = sans(12, 'semibold');
    t.centerAlignText();
  } else {
    const h = w.addText(`HOJE · ${temp(data.weather)}`);
    h.font = sans(10, 'semibold');
    const n = w.addText(name);
    n.font = sans(14, 'semibold');
    n.lineLimit = 1;
    if (data.pick) {
      const r = w.addText(data.pick.reason);
      r.font = sans(10);
      r.lineLimit = 1;
    }
  }
  if (data.pick) w.url = deepLink(data, data.pick.id);
  return w;
}

function errorWidget(message) {
  const w = new ListWidget();
  background(w);
  w.setPadding(14, 14, 14, 14);
  text(w, 'PARFUMANIA', sans(9, 'semibold'), C.gold);
  w.addSpacer(6);
  text(w, message, sans(12), C.text, 4);
  return w;
}

const data = await load();
const family = config.widgetFamily || 'medium';
let widget;
if (data.error && !data.pick) widget = errorWidget(data.error);
else if (family.startsWith('accessory')) widget = lockScreen(data, family);
else if (family === 'small') widget = await small(data);
else if (family === 'large' || family === 'extraLarge') widget = await large(data);
else widget = await medium(data);

// O iPhone decide quando atualizar; pedimos a cada ~30 minutos.
widget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);

if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentMedium();
Script.complete();
