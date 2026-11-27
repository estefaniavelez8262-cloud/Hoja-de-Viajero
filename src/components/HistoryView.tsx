import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Calendar,
  Eye,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  Lock,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { AuthStatus, TravelerRecord } from '../types';

interface HistoryViewProps {
  token: string | null;
  authUser: string | null;
  onAuthenticated: (token: string, username: string) => void;
  onAuthExpired: () => void;
  onLoadRecord: (record: TravelerRecord) => void;
}

export function HistoryView({
  token,
  authUser,
  onAuthenticated,
  onAuthExpired,
  onLoadRecord,
}: HistoryViewProps) {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Formularios de acceso / configuración inicial
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Datos de historiales
  const [records, setRecords] = useState<TravelerRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEstacion, setFilterEstacion] = useState('');
  const [filterOperario, setFilterOperario] = useState('');
  const [filterFecha, setFilterFecha] = useState('');

  // Detalle y confirmación de borrado
  const [selectedRecord, setSelectedRecord] = useState<TravelerRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAuthStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch('/api/auth/status', { headers });
      if (!res.ok) {
        throw new Error('No se pudo verificar el estado de acceso.');
      }
      const data = (await res.json()) as AuthStatus;
      setAuthStatus(data);
    } catch {
      setAuthError('Error de conexión al verificar el acceso.');
    } finally {
      setStatusLoading(false);
    }
  }, [token]);

  const fetchRecords = useCallback(async () => {
    if (!token) {
      return;
    }
    setRecordsLoading(true);
    setRecordsError(null);
    try {
      const res = await fetch('/api/travelers', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        onAuthExpired();
        return;
      }
      if (!res.ok) {
        throw new Error('No se pudieron cargar los historiales.');
      }
      const data = (await res.json()) as { travelers: TravelerRecord[] };
      setRecords(Array.isArray(data.travelers) ? data.travelers : []);
    } catch (err) {
      setRecordsError(
        err instanceof Error ? err.message : 'Ocurrió un error al consultar los historiales.'
      );
    } finally {
      setRecordsLoading(false);
    }
  }, [token, onAuthExpired]);

  useEffect(() => {
    fetchAuthStatus();
  }, [fetchAuthStatus]);

  useEffect(() => {
    if (token) {
      fetchRecords();
    } else {
      setRecords([]);
    }
  }, [token, fetchRecords]);

  const handleSetupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (password !== confirmPassword) {
      setAuthError('Las contraseñas no coinciden.');
      return;
    }

    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = (await res.json()) as { token?: string; username?: string; error?: string };
      if (!res.ok || !data.token || !data.username) {
        setAuthError(data.error || 'No se pudo configurar el acceso.');
        return;
      }
      setPassword('');
      setConfirmPassword('');
      onAuthenticated(data.token, data.username);
    } catch {
      setAuthError('Error de red al guardar las credenciales.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = (await res.json()) as { token?: string; username?: string; error?: string };
      if (!res.ok || !data.token || !data.username) {
        setAuthError(data.error || 'Usuario o contraseña incorrectos.');
        return;
      }
      setPassword('');
      onAuthenticated(data.token, data.username);
    } catch {
      setAuthError('Error de red al iniciar sesión.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!token) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/travelers/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        onAuthExpired();
        return;
      }
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        if (selectedRecord?.id === id) {
          setSelectedRecord(null);
        }
      }
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const uniqueEstaciones = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.estacionPrincipal) {
        r.estacionPrincipal.split('·').forEach((part) => {
          const clean = part.trim();
          if (clean) set.add(clean);
        });
      }
      r.rows.forEach((row) => {
        if (row.estacion.trim()) set.add(row.estacion.trim());
      });
    });
    return Array.from(set).sort();
  }, [records]);

  const uniqueOperarios = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.operarioPrincipal) {
        r.operarioPrincipal.split(',').forEach((part) => {
          const clean = part.trim();
          if (clean) set.add(clean);
        });
      }
      r.rows.forEach((row) => {
        if (row.operario.trim()) set.add(row.operario.trim());
      });
    });
    return Array.from(set).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((rec) => {
      const rowEstaciones = rec.rows.map((r) => r.estacion).join(' ');
      const rowOperarios = rec.rows.map((r) => r.operario).join(' ');
      const allEstaciones = `${rec.estacionPrincipal} ${rowEstaciones}`.toLowerCase();
      const allOperarios = `${rec.operarioPrincipal} ${rowOperarios}`.toLowerCase();

      if (q) {
        const matchesQuery =
          rec.idLote.toLowerCase().includes(q) ||
          rec.folio.toLowerCase().includes(q) ||
          rec.materiaPrima.toLowerCase().includes(q) ||
          allOperarios.includes(q) ||
          allEstaciones.includes(q) ||
          rec.fechaEmision.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      if (filterEstacion && !allEstaciones.includes(filterEstacion.toLowerCase())) {
        return false;
      }

      if (filterOperario && !allOperarios.includes(filterOperario.toLowerCase())) {
        return false;
      }

      if (filterFecha) {
        const matchesFecha =
          rec.fechaEmision === filterFecha ||
          rec.rows.some((row) => row.fecha === filterFecha);
        if (!matchesFecha) return false;
      }

      return true;
    });
  }, [records, searchQuery, filterEstacion, filterOperario, filterFecha]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() || filterEstacion || filterOperario || filterFecha
  );

  // Pantalla de carga de estado
  if (statusLoading && !authStatus) {
    return (
      <div className="mx-auto max-w-md py-16">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-100" />
          <div className="mt-6 h-10 w-full animate-pulse rounded-lg bg-slate-100" />
          <div className="mt-3 h-10 w-full animate-pulse rounded-lg bg-slate-100" />
        </div>
      </div>
    );
  }

  // Pantalla de configuración inicial (si no hay credenciales en .env ni reclamadas)
  if (authStatus && !authStatus.configured && !token) {
    return (
      <div className="mx-auto max-w-md py-10">
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                Configurar acceso a Historiales
              </h2>
              <p className="text-xs text-slate-500">
                Define el usuario y contraseña para proteger los registros de producción.
              </p>
            </div>
          </div>

          <form onSubmit={handleSetupSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="setup-user"
                className="block text-xs font-semibold text-slate-700"
              >
                Usuario
              </label>
              <div className="relative mt-1.5">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="setup-user"
                  type="text"
                  required
                  minLength={3}
                  maxLength={40}
                  autoComplete="username"
                  placeholder="Ej. supervisor"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-700/15"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="setup-password"
                className="block text-xs font-semibold text-slate-700"
              >
                Contraseña
              </label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="setup-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  maxLength={128}
                  autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-700/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="setup-confirm"
                className="block text-xs font-semibold text-slate-700"
              >
                Confirmar contraseña
              </label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="setup-confirm"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  maxLength={128}
                  autoComplete="new-password"
                  placeholder="Repite la contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-700/15"
                />
              </div>
            </div>

            {authError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-800 disabled:opacity-60"
            >
              {authSubmitting ? 'Guardando credenciales...' : 'Guardar y ver historiales'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Pantalla de inicio de sesión (cuando ya existen credenciales configuradas)
  if (!token) {
    return (
      <div className="mx-auto max-w-md py-10">
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                Acceso a Historiales
              </h2>
              <p className="text-xs text-slate-500">
                Ingresa tu usuario y contraseña para consultar los lotes registrados.
              </p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="login-user"
                className="block text-xs font-semibold text-slate-700"
              >
                Usuario
              </label>
              <div className="relative mt-1.5">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-user"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="Tu usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-700/15"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-700"
              >
                Contraseña
              </label>
              <div className="relative mt-1.5">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-10 text-sm text-slate-900 focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-700/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full rounded-lg bg-purple-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-800 disabled:opacity-60"
            >
              {authSubmitting ? 'Verificando...' : 'Ingresar a Historiales'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Vista autenticada de Historiales de Producción
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Encabezado de sección + resumen numérico */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Historiales de Producción
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Sesión iniciada como <span className="font-semibold text-slate-700">{authUser}</span>
            <span aria-hidden="true"> · </span>
            Consulta por ID del lote, operario, fecha y estación
          </p>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Lotes registrados</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-slate-900">
            {records.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Operarios activos</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-slate-900">
            {uniqueOperarios.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Estaciones</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-slate-900">
            {uniqueEstaciones.length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Última fecha</p>
          <p className="font-mono-tabular mt-1.5 text-2xl font-bold text-slate-900">
            {records[0]?.fechaEmision || '—'}
          </p>
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar ID del lote, folio o materia..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-purple-700 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            aria-label="Filtrar por operario"
            value={filterOperario}
            onChange={(e) => setFilterOperario(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-purple-700 focus:bg-white focus:outline-none"
          >
            <option value="">Todos los operarios</option>
            {uniqueOperarios.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por estación"
            value={filterEstacion}
            onChange={(e) => setFilterEstacion(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-purple-700 focus:bg-white focus:outline-none"
          >
            <option value="">Todas las estaciones</option>
            {uniqueEstaciones.map((est) => (
              <option key={est} value={est}>
                {est}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                aria-label="Filtrar por fecha"
                value={filterFecha}
                onChange={(e) => setFilterFecha(e.target.value)}
                className="font-mono-tabular w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-purple-700 focus:bg-white focus:outline-none"
              />
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterEstacion('');
                  setFilterOperario('');
                  setFilterFecha('');
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabla principal de historiales */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {recordsLoading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-11 w-full animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        ) : recordsError ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-rose-700">{recordsError}</p>
            <button
              type="button"
              onClick={fetchRecords}
              className="mt-3 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reintentar
            </button>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-10 text-center">
            <FileSpreadsheet className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-900">
              {hasActiveFilters
                ? 'No hay registros que coincidan con los filtros'
                : 'Aún no hay hojas de viajero guardadas'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {hasActiveFilters
                ? 'Prueba ajustando el ID del lote, operario, fecha o estación.'
                : 'Llena la Hoja Actual y presiona "Guardar en Historial" para registrarla.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">ID del lote</th>
                  <th className="px-4 py-3">Operario</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Estación</th>
                  <th className="px-4 py-3">Materia Prima / Cant.</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredRecords.map((rec) => (
                  <tr
                    key={rec.id}
                    className="transition-colors hover:bg-purple-50/35"
                  >
                    <td className="px-4 py-3.5 align-top">
                      <div className="font-mono-tabular font-semibold text-purple-800">
                        {rec.idLote}
                      </div>
                      <div className="font-mono-tabular mt-0.5 text-xs text-slate-500">
                        Folio {rec.folio || 'S/F'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-top font-medium text-slate-900">
                      {rec.operarioPrincipal || 'Sin asignar'}
                    </td>
                    <td className="font-mono-tabular px-4 py-3.5 align-top text-slate-700 whitespace-nowrap">
                      {rec.fechaEmision || '—'}
                    </td>
                    <td className="px-4 py-3.5 align-top text-slate-800">
                      <div>{rec.estacionPrincipal || 'Sin estación'}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {rec.rows.length} {rec.rows.length === 1 ? 'registro' : 'registros'} de estación
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-top text-slate-700">
                      <div>{rec.materiaPrima || '—'}</div>
                      {rec.cantidad && (
                        <div className="font-mono-tabular mt-0.5 text-xs text-slate-500">
                          Cant: {rec.cantidad}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(rec)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          Ver detalle
                        </button>
                        <button
                          type="button"
                          onClick={() => onLoadRecord(rec)}
                          className="rounded-md bg-purple-50 px-2.5 py-1.5 text-xs font-medium text-purple-800 transition-colors hover:bg-purple-100"
                        >
                          Cargar
                        </button>
                        {confirmDeleteId === rec.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={deletingId === rec.id}
                              onClick={() => handleDeleteRecord(rec.id)}
                              className="rounded-md bg-rose-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(rec.id)}
                            title="Eliminar registro"
                            aria-label={`Eliminar lote ${rec.idLote}`}
                            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de detalle del lote seleccionado */}
      {selectedRecord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 id="detail-modal-title" className="text-base font-bold text-slate-900">
                  Lote <span className="font-mono-tabular text-purple-800">{selectedRecord.idLote}</span>
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedRecord.operarioPrincipal}
                  <span aria-hidden="true"> · </span>
                  {selectedRecord.fechaEmision}
                  <span aria-hidden="true"> · </span>
                  {selectedRecord.estacionPrincipal}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onLoadRecord(selectedRecord);
                    setSelectedRecord(null);
                  }}
                  className="rounded-lg bg-purple-700 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-purple-800"
                >
                  Cargar en Hoja Actual
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRecord(null)}
                  aria-label="Cerrar detalle"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-6">
              <div className="border-2 border-purple-700 p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <span className="text-xs font-medium text-slate-500">ID del Lote</span>
                    <p className="font-mono-tabular font-semibold text-slate-900">
                      {selectedRecord.idLote}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500">Fecha</span>
                    <p className="font-mono-tabular font-semibold text-slate-900">
                      {selectedRecord.fechaEmision || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500">Folio</span>
                    <p className="font-mono-tabular font-semibold text-slate-900">
                      {selectedRecord.folio || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500">Operario</span>
                    <p className="font-semibold text-slate-900">
                      {selectedRecord.operarioPrincipal || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500">Estación</span>
                    <p className="font-semibold text-slate-900">
                      {selectedRecord.estacionPrincipal || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500">Cantidad</span>
                    <p className="font-mono-tabular font-semibold text-slate-900">
                      {selectedRecord.cantidad || '—'}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-xs font-medium text-slate-500">Materia Prima</span>
                    <p className="font-semibold text-slate-900">
                      {selectedRecord.materiaPrima || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-slate-500">Lote Prov.</span>
                    <p className="font-mono-tabular font-semibold text-slate-900">
                      {selectedRecord.loteProv || '—'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto border-2 border-dashed border-purple-700">
                <table className="w-full min-w-[600px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-dashed border-purple-700 bg-purple-50/40">
                      <th className="border-r-2 border-dashed border-purple-700 px-3 py-2.5 text-center font-semibold">
                        Sec
                      </th>
                      <th className="border-r-2 border-dashed border-purple-700 px-3 py-2.5 text-center font-semibold">
                        Estación
                      </th>
                      <th className="border-r-2 border-dashed border-purple-700 px-3 py-2.5 text-center font-semibold">
                        Operario
                      </th>
                      <th className="border-r-2 border-dashed border-purple-700 px-3 py-2.5 text-center font-semibold">
                        Fecha
                      </th>
                      <th className="border-r-2 border-dashed border-purple-700 px-3 py-2.5 text-center font-semibold">
                        Entrada / Salida
                      </th>
                      <th className="px-3 py-2.5 text-center font-semibold">Ok / merma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRecord.rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-xs text-slate-500">
                          Sin movimientos de estación registrados.
                        </td>
                      </tr>
                    ) : (
                      selectedRecord.rows.map((r, idx) => (
                        <tr key={`${r.id}-${idx}`} className="border-b border-slate-200/80 last:border-b-0">
                          <td className="font-mono-tabular border-r-2 border-dashed border-purple-700 px-3 py-2.5 text-center">
                            {r.sec || '—'}
                          </td>
                          <td className="border-r-2 border-dashed border-purple-700 px-3 py-2.5">
                            {r.estacion || '—'}
                          </td>
                          <td className="border-r-2 border-dashed border-purple-700 px-3 py-2.5">
                            {r.operario || '—'}
                          </td>
                          <td className="font-mono-tabular border-r-2 border-dashed border-purple-700 px-3 py-2.5 text-center">
                            {r.fecha || '—'}
                          </td>
                          <td className="font-mono-tabular border-r-2 border-dashed border-purple-700 px-3 py-2.5 text-center">
                            {r.entradaSalida || '—'}
                          </td>
                          <td className="font-mono-tabular px-3 py-2.5 text-center">
                            {r.okMerma || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
