import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';

dotenv.config();

interface TravelerRow {
  id: number;
  sec: string;
  estacion: string;
  operario: string;
  fecha: string;
  entradaSalida: string;
  okMerma: string;
}

interface TravelerRecord {
  id: string;
  idLote: string;
  fechaEmision: string;
  folio: string;
  materiaPrima: string;
  loteProv: string;
  cantidad: string;
  operarioPrincipal: string;
  estacionPrincipal: string;
  rows: TravelerRow[];
  createdAt: string;
}

interface AdminCredential {
  username: string;
  salt: string;
  hash: string;
  createdAt: string;
}

interface StoreData {
  admin: AdminCredential | null;
  travelers: TravelerRecord[];
}

interface TokenPayload {
  sub: string;
  iat: number;
  exp: number;
  jti: string;
}

interface AuthenticatedRequest extends Request {
  authUser?: string;
}

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 horas

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

const SEED_TRAVELERS: TravelerRecord[] = [
  {
    id: 'lot-seed-001',
    idLote: 'LOT-2026-041',
    fechaEmision: '2026-11-26',
    folio: 'F-0891',
    materiaPrima: 'Acero Inoxidable 304 (2mm)',
    loteProv: 'PROV-AC-992',
    cantidad: '150 pzas',
    operarioPrincipal: 'Carlos Méndez',
    estacionPrincipal: 'Corte Láser · Doblado CNC',
    createdAt: '2026-11-26T08:30:00.000Z',
    rows: [
      {
        id: 1,
        sec: '01',
        estacion: 'Corte Láser',
        operario: 'Carlos Méndez',
        fecha: '2026-11-26',
        entradaSalida: '08:00 / 10:15',
        okMerma: '150 / 0',
      },
      {
        id: 2,
        sec: '02',
        estacion: 'Doblado CNC',
        operario: 'Laura Gómez',
        fecha: '2026-11-26',
        entradaSalida: '10:30 / 12:45',
        okMerma: '148 / 2',
      },
    ],
  },
  {
    id: 'lot-seed-002',
    idLote: 'LOT-2026-042',
    fechaEmision: '2026-11-26',
    folio: 'F-0892',
    materiaPrima: 'Aluminio 6061 T6',
    loteProv: 'PROV-AL-314',
    cantidad: '80 pzas',
    operarioPrincipal: 'Elena Torres',
    estacionPrincipal: 'Maquinado CNC · Inspección Final',
    createdAt: '2026-11-26T11:15:00.000Z',
    rows: [
      {
        id: 1,
        sec: '01',
        estacion: 'Maquinado CNC',
        operario: 'Elena Torres',
        fecha: '2026-11-26',
        entradaSalida: '09:00 / 11:30',
        okMerma: '79 / 1',
      },
      {
        id: 2,
        sec: '02',
        estacion: 'Inspección Final',
        operario: 'Miguel Ángel Ruiz',
        fecha: '2026-11-26',
        entradaSalida: '11:45 / 12:20',
        okMerma: '79 / 0',
      },
    ],
  },
  {
    id: 'lot-seed-003',
    idLote: 'LOT-2026-043',
    fechaEmision: '2026-11-25',
    folio: 'F-0887',
    materiaPrima: 'Policarbonato Industrial 6mm',
    loteProv: 'PROV-PC-108',
    cantidad: '220 pzas',
    operarioPrincipal: 'Jorge Navarro',
    estacionPrincipal: 'Termoformado · Acabado',
    createdAt: '2026-11-25T16:40:00.000Z',
    rows: [
      {
        id: 1,
        sec: '01',
        estacion: 'Termoformado',
        operario: 'Jorge Navarro',
        fecha: '2026-11-25',
        entradaSalida: '13:00 / 15:20',
        okMerma: '216 / 4',
      },
      {
        id: 2,
        sec: '02',
        estacion: 'Acabado',
        operario: 'Sofía Castro',
        fecha: '2026-11-25',
        entradaSalida: '15:35 / 17:10',
        okMerma: '215 / 1',
      },
    ],
  },
];

function ensureStore(): StoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORE_FILE)) {
    const initial: StoreData = {
      admin: null,
      travelers: SEED_TRAVELERS,
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    return {
      admin: parsed.admin ?? null,
      travelers: Array.isArray(parsed.travelers) ? parsed.travelers : [],
    };
  } catch {
    return { admin: null, travelers: [] };
  }
}

function saveStore(store: StoreData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${STORE_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmpFile, STORE_FILE);
}

function sha256Digest(value: string): Buffer {
  return crypto.createHash('sha256').update(value, 'utf8').digest();
}

function timingSafeTextEqual(a: string, b: string): boolean {
  return crypto.timingSafeEqual(sha256Digest(a), sha256Digest(b));
}

function hashPassword(password: string, saltHex: string): string {
  return crypto.scryptSync(password, saltHex, 64).toString('hex');
}

function verifyScryptPassword(password: string, saltHex: string, expectedHashHex: string): boolean {
  const derived = crypto.scryptSync(password, saltHex, 64);
  const expected = Buffer.from(expectedHashHex, 'hex');
  if (derived.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, expected);
}

function getEnvCredentials(): { username: string; password: string } | null {
  const username = process.env.HISTORY_ADMIN_USER?.trim() ?? '';
  const password = process.env.HISTORY_ADMIN_PASSWORD ?? '';
  if (username.length > 0 && password.length > 0) {
    return { username, password };
  }
  return null;
}

function signToken(username: string): string {
  const now = Date.now();
  const payload: TokenPayload = {
    sub: username,
    iat: now,
    exp: now + TOKEN_TTL_MS,
    jti: crypto.randomBytes(16).toString('hex'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifyToken(token: string, store: StoreData): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) {
    return null;
  }
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encodedPayload)
    .digest('base64url');
  if (!timingSafeTextEqual(providedSig, expectedSig)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as TokenPayload;
    if (!payload || typeof payload.sub !== 'string' || typeof payload.exp !== 'number') {
      return null;
    }
    if (Date.now() > payload.exp) {
      return null;
    }
    const envCreds = getEnvCredentials();
    if (envCreds) {
      return timingSafeTextEqual(payload.sub, envCreds.username) ? payload.sub : null;
    }
    if (store.admin && timingSafeTextEqual(payload.sub, store.admin.username)) {
      return payload.sub;
    }
    return null;
  } catch {
    return null;
  }
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match?.[1] ?? null;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const store = ensureStore();
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Autenticación requerida para ver los historiales.' });
    return;
  }
  const username = verifyToken(token, store);
  if (!username) {
    res.status(401).json({ error: 'Sesión inválida o expirada.' });
    return;
  }
  req.authUser = username;
  next();
}

function sanitizeText(value: unknown, maxLen = 120): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, maxLen);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  // Inicializar almacenamiento en el arranque
  ensureStore();

  // Estado de configuración y sesión
  app.get('/api/auth/status', (req: Request, res: Response) => {
    const store = ensureStore();
    const envCreds = getEnvCredentials();
    const source = envCreds ? 'env' : store.admin ? 'claimed' : 'none';
    const configured = source !== 'none';
    const token = extractBearerToken(req);
    const verifiedUser = token ? verifyToken(token, store) : null;

    res.json({
      configured,
      source,
      authenticated: Boolean(verifiedUser),
      username: verifiedUser,
    });
  });

  // Registro único de usuario y contraseña inicial cuando no hay credenciales configuradas
  app.post('/api/auth/setup', (req: Request, res: Response) => {
    const store = ensureStore();
    const envCreds = getEnvCredentials();
    if (envCreds || store.admin) {
      res.status(409).json({
        error: 'El usuario y la contraseña ya fueron configurados previamente.',
      });
      return;
    }

    const username = sanitizeText(req.body?.username, 40);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username)) {
      res.status(400).json({
        error: 'El usuario debe tener entre 3 y 40 caracteres (letras, números, . _ -).',
      });
      return;
    }
    if (password.length < 6 || password.length > 128) {
      res.status(400).json({
        error: 'La contraseña debe tener entre 6 y 128 caracteres.',
      });
      return;
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);

    store.admin = {
      username,
      salt,
      hash,
      createdAt: new Date().toISOString(),
    };
    saveStore(store);

    const token = signToken(username);
    res.status(201).json({ token, username });
  });

  // Inicio de sesión con usuario y contraseña
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const store = ensureStore();
    const envCreds = getEnvCredentials();

    if (!envCreds && !store.admin) {
      res.status(409).json({
        error: 'Aún no se ha configurado un usuario y contraseña para historiales.',
      });
      return;
    }

    const username = sanitizeText(req.body?.username, 40);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      res.status(400).json({ error: 'Ingresa tu usuario y contraseña.' });
      return;
    }

    let valid = false;
    let activeUsername = '';

    if (envCreds) {
      const userMatch = timingSafeTextEqual(username, envCreds.username);
      const passMatch = timingSafeTextEqual(password, envCreds.password);
      valid = userMatch && passMatch;
      activeUsername = envCreds.username;
    } else if (store.admin) {
      const userMatch = timingSafeTextEqual(username, store.admin.username);
      const passMatch = verifyScryptPassword(password, store.admin.salt, store.admin.hash);
      valid = userMatch && passMatch;
      activeUsername = store.admin.username;
    }

    if (!valid) {
      res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
      return;
    }

    const token = signToken(activeUsername);
    res.json({ token, username: activeUsername });
  });

  // Obtener historiales (protegido)
  app.get('/api/travelers', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const store = ensureStore();
    const sorted = [...store.travelers].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json({ travelers: sorted });
  });

  // Guardar nueva hoja de viajero en el historial
  app.post('/api/travelers', (req: Request, res: Response) => {
    const idLote = sanitizeText(req.body?.idLote, 80);
    const fechaEmision = sanitizeText(req.body?.fechaEmision, 40);
    const folio = sanitizeText(req.body?.folio, 60);
    const materiaPrima = sanitizeText(req.body?.materiaPrima, 120);
    const loteProv = sanitizeText(req.body?.loteProv, 80);
    const cantidad = sanitizeText(req.body?.cantidad, 60);
    const operarioInput = sanitizeText(req.body?.operarioPrincipal, 80);
    const estacionInput = sanitizeText(req.body?.estacionPrincipal, 120);

    const rawRows: unknown[] = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 100) : [];
    const cleanedRows: TravelerRow[] = rawRows
      .map((item, idx) => {
        const obj = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
        return {
          id: idx + 1,
          sec: sanitizeText(obj.sec, 20),
          estacion: sanitizeText(obj.estacion, 80),
          operario: sanitizeText(obj.operario, 80),
          fecha: sanitizeText(obj.fecha, 40),
          entradaSalida: sanitizeText(obj.entradaSalida, 40),
          okMerma: sanitizeText(obj.okMerma, 40),
        };
      })
      .filter(
        (r) =>
          r.sec || r.estacion || r.operario || r.fecha || r.entradaSalida || r.okMerma
      );

    if (!idLote) {
      res.status(400).json({
        error: 'El campo "ID del Lote" es obligatorio para guardar en el historial.',
      });
      return;
    }

    const uniqueOperarios = Array.from(
      new Set(cleanedRows.map((r) => r.operario).filter(Boolean))
    );
    const uniqueEstaciones = Array.from(
      new Set(cleanedRows.map((r) => r.estacion).filter(Boolean))
    );
    const firstRowFecha = cleanedRows.find((r) => r.fecha)?.fecha ?? '';

    const record: TravelerRecord = {
      id: crypto.randomUUID(),
      idLote,
      fechaEmision: fechaEmision || firstRowFecha || new Date().toISOString().slice(0, 10),
      folio: folio || 'S/F',
      materiaPrima,
      loteProv,
      cantidad,
      operarioPrincipal: operarioInput || uniqueOperarios.join(', ') || 'Sin asignar',
      estacionPrincipal: estacionInput || uniqueEstaciones.join(' · ') || 'Sin estación',
      rows: cleanedRows,
      createdAt: new Date().toISOString(),
    };

    const store = ensureStore();
    store.travelers.unshift(record);
    saveStore(store);

    res.status(201).json({ traveler: record });
  });

  // Eliminar un registro del historial (protegido)
  app.delete('/api/travelers/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const targetId = sanitizeText(req.params.id, 80);
    const store = ensureStore();
    const initialLen = store.travelers.length;
    store.travelers = store.travelers.filter((t) => t.id !== targetId);

    if (store.travelers.length === initialLen) {
      res.status(404).json({ error: 'Registro no encontrado.' });
      return;
    }
    saveStore(store);
    res.json({ deleted: true });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*splat', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
