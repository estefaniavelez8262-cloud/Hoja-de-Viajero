import { useCallback, useState } from 'react';
import {
  CheckCircle2,
  Grid3X3,
  Lock,
  LogOut,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { HistoryView } from './components/HistoryView';
import type { TravelerHeader, TravelerRecord, TravelerRow } from './types';

type ActiveTab = 'sheet' | 'history';

const createEmptyHeader = (): TravelerHeader => ({
  idLote: '',
  fechaEmision: new Date().toISOString().slice(0, 10),
  folio: '',
  materiaPrima: '',
  loteProv: '',
  cantidad: '',
  operarioPrincipal: '',
  estacionPrincipal: '',
});

const createEmptyRows = (count: number, startId = 1): TravelerRow[] =>
  Array.from({ length: count }, (_, idx) => ({
    id: startId + idx,
    sec: '',
    estacion: '',
    operario: '',
    fecha: '',
    entradaSalida: '',
    okMerma: '',
  }));

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('sheet');

  // Estado de la Hoja Actual
  const [header, setHeader] = useState<TravelerHeader>(() => createEmptyHeader());
  const [rows, setRows] = useState<TravelerRow[]>(() => createEmptyRows(8));
  const [showGrid, setShowGrid] = useState(false);

  // Guardado en historial
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Sesión en memoria (sin almacenar tokens en localStorage/sessionStorage)
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<string | null>(null);

  const handleHeaderChange = (field: keyof TravelerHeader, value: string) => {
    setHeader((prev) => ({ ...prev, [field]: value }));
    if (saveFeedback) setSaveFeedback(null);
  };

  const handleRowChange = (id: number, field: keyof Omit<TravelerRow, 'id'>, value: string) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
    if (saveFeedback) setSaveFeedback(null);
  };

  const handleAddRow = () => {
    setRows((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((r) => r.id)) + 1 : 1;
      return [...prev, ...createEmptyRows(1, nextId)];
    });
  };

  const handleRemoveRow = (id: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((row) => row.id !== id) : prev));
  };

  const handleResetSheet = () => {
    setHeader(createEmptyHeader());
    setRows(createEmptyRows(8));
    setSaveFeedback(null);
  };

  const handleSaveToHistory = async () => {
    if (!header.idLote.trim()) {
      setSaveFeedback({
        type: 'error',
        message: 'Ingresa el ID del lote antes de guardar en el historial.',
      });
      return;
    }

    setSaving(true);
    setSaveFeedback(null);
    try {
      const res = await fetch('/api/travelers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...header,
          rows,
        }),
      });
      const data = (await res.json()) as { traveler?: TravelerRecord; error?: string };
      if (!res.ok) {
        setSaveFeedback({
          type: 'error',
          message: data.error || 'No se pudo guardar el registro.',
        });
        return;
      }
      setSaveFeedback({
        type: 'success',
        message: `Lote ${data.traveler?.idLote ?? header.idLote} guardado en Historiales.`,
      });
    } catch {
      setSaveFeedback({
        type: 'error',
        message: 'Error de conexión al guardar en el historial.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAuthenticated = useCallback((token: string, username: string) => {
    setAuthToken(token);
    setAuthUser(username);
  }, []);

  const handleLogout = useCallback(() => {
    setAuthToken(null);
    setAuthUser(null);
  }, []);

  const handleLoadRecord = useCallback((record: TravelerRecord) => {
    setHeader({
      idLote: record.idLote,
      fechaEmision: record.fechaEmision,
      folio: record.folio,
      materiaPrima: record.materiaPrima,
      loteProv: record.loteProv,
      cantidad: record.cantidad,
      operarioPrincipal: record.operarioPrincipal,
      estacionPrincipal: record.estacionPrincipal,
    });
    const loadedRows =
      record.rows.length > 0
        ? record.rows.map((r, idx) => ({ ...r, id: idx + 1 }))
        : createEmptyRows(6);
    setRows(loadedRows);
    setSaveFeedback(null);
    setActiveTab('sheet');
  }, []);

  // Valores mostrados en las tarjetas de resumen superior (sincronizados con filas si el encabezado está vacío)
  const displayOperario =
    header.operarioPrincipal ||
    Array.from(new Set(rows.map((r) => r.operario.trim()).filter(Boolean))).join(', ') ||
    'Sin asignar';
  const displayEstacion =
    header.estacionPrincipal ||
    Array.from(new Set(rows.map((r) => r.estacion.trim()).filter(Boolean))).join(' · ') ||
    'Sin estación';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 print:bg-white">
      {/* Barra de navegación superior (3 zonas, 1 fila) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Zona 1: Marca */}
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Hoja de Viajero de Producción
          </span>

          {/* Zona 2: Pestañas principales */}
          <nav
            aria-label="Navegación principal"
            className="flex items-center gap-1 rounded-lg bg-slate-100 p-1"
          >
            <button
              type="button"
              onClick={() => setActiveTab('sheet')}
              className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'sheet'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hoja Actual
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {!authToken && <Lock className="h-3 w-3 text-purple-700" />}
              Historiales
            </button>
          </nav>

          {/* Zona 3: Acción contextual única */}
          <div className="flex items-center shrink-0">
            {activeTab === 'sheet' ? (
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveToHistory}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-purple-800 disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Guardando...' : 'Guardar en Historial'}
              </button>
            ) : authToken ? (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                Cerrar sesión
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('sheet')}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Volver a la hoja
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="px-4 py-6 sm:px-6 sm:py-8 print:p-0">
        {activeTab === 'history' ? (
          <HistoryView
            token={authToken}
            authUser={authUser}
            onAuthenticated={handleAuthenticated}
            onAuthExpired={handleLogout}
            onLoadRecord={handleLoadRecord}
          />
        ) : (
          <div className="mx-auto max-w-5xl space-y-5 print:max-w-none print:space-y-0">
            {/* Resumen ejecutivo de los 4 campos clave + herramientas de la hoja */}
            <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center print:hidden">
              <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                <div>
                  <span className="block text-[11px] font-medium text-slate-500">ID del lote</span>
                  <span className="font-mono-tabular block truncate text-sm font-bold text-purple-800">
                    {header.idLote || 'Sin asignar'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-slate-500">Operario</span>
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {displayOperario}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-slate-500">Fecha</span>
                  <span className="font-mono-tabular block truncate text-sm font-semibold text-slate-900">
                    {header.fechaEmision || '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-medium text-slate-500">Estación</span>
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {displayEstacion}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 sm:border-t-0 sm:border-l sm:pl-4 sm:pt-0">
                <button
                  type="button"
                  onClick={() => setShowGrid((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    showGrid
                      ? 'border-purple-200 bg-purple-50 text-purple-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                  {showGrid ? 'Cuadrícula' : 'Limpia'}
                </button>

                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Fila
                </button>

                <button
                  type="button"
                  onClick={handleResetSheet}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Limpiar
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir
                </button>
              </div>
            </div>

            {/* Notificación al guardar */}
            {saveFeedback && (
              <div
                role="status"
                className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm print:hidden ${
                  saveFeedback.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-rose-200 bg-rose-50 text-rose-900'
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  {saveFeedback.type === 'success' && (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  )}
                  <span>{saveFeedback.message}</span>
                </div>
                {saveFeedback.type === 'success' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100/60 whitespace-nowrap shrink-0"
                  >
                    Ver en Historiales
                  </button>
                )}
              </div>
            )}

            {/* Hoja de viajero principal */}
            <main
              className={`rounded-xl border border-slate-200 bg-white p-5 sm:p-10 shadow-sm print:rounded-none print:border-0 print:p-4 print:shadow-none ${
                showGrid ? 'notebook-grid print:bg-none' : ''
              }`}
            >
              {/* Encabezado con pestaña centrada + contenedor morado sólido */}
              <section aria-label="Datos generales del lote">
                <div className="flex justify-center">
                  <div className="border-2 border-b-0 border-purple-700 bg-white px-7 py-2 sm:px-10">
                    <h1 className="text-center text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                      Hoja de viajero de Producción
                    </h1>
                  </div>
                </div>

                <div className="border-2 border-purple-700 bg-white/90 p-4 sm:p-6">
                  <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label
                        htmlFor="id-lote"
                        className="block text-xs font-semibold text-purple-900"
                      >
                        ID del lote
                      </label>
                      <input
                        id="id-lote"
                        type="text"
                        placeholder="Ej. LOT-2026-044"
                        value={header.idLote}
                        onChange={(e) => handleHeaderChange('idLote', e.target.value)}
                        className="font-mono-tabular mt-1 w-full border-b border-slate-300 bg-transparent py-1 text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-purple-700 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="operario-principal"
                        className="block text-xs font-semibold text-purple-900"
                      >
                        Operario
                      </label>
                      <input
                        id="operario-principal"
                        type="text"
                        placeholder="Responsable del lote"
                        value={header.operarioPrincipal}
                        onChange={(e) => handleHeaderChange('operarioPrincipal', e.target.value)}
                        className="mt-1 w-full border-b border-slate-300 bg-transparent py-1 text-sm font-medium text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-purple-700 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="fecha-emision"
                        className="block text-xs font-semibold text-purple-900"
                      >
                        Fecha
                      </label>
                      <input
                        id="fecha-emision"
                        type="date"
                        value={header.fechaEmision}
                        onChange={(e) => handleHeaderChange('fechaEmision', e.target.value)}
                        className="font-mono-tabular mt-1 w-full border-b border-slate-300 bg-transparent py-1 text-sm font-medium text-slate-900 focus:border-purple-700 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="estacion-principal"
                        className="block text-xs font-semibold text-purple-900"
                      >
                        Estación
                      </label>
                      <input
                        id="estacion-principal"
                        type="text"
                        placeholder="Ej. Corte CNC"
                        value={header.estacionPrincipal}
                        onChange={(e) => handleHeaderChange('estacionPrincipal', e.target.value)}
                        className="mt-1 w-full border-b border-slate-300 bg-transparent py-1 text-sm font-medium text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:border-purple-700 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="folio"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Folio
                      </label>
                      <input
                        id="folio"
                        type="text"
                        placeholder="Ej. F-0895"
                        value={header.folio}
                        onChange={(e) => handleHeaderChange('folio', e.target.value)}
                        className="font-mono-tabular mt-1 w-full border-b border-slate-300 bg-transparent py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-700 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="materia-prima"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Materia Prima
                      </label>
                      <input
                        id="materia-prima"
                        type="text"
                        placeholder="Material / aleación"
                        value={header.materiaPrima}
                        onChange={(e) => handleHeaderChange('materiaPrima', e.target.value)}
                        className="mt-1 w-full border-b border-slate-300 bg-transparent py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-700 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="lote-prov"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Lote Prov.
                      </label>
                      <input
                        id="lote-prov"
                        type="text"
                        placeholder="Lote de proveedor"
                        value={header.loteProv}
                        onChange={(e) => handleHeaderChange('loteProv', e.target.value)}
                        className="font-mono-tabular mt-1 w-full border-b border-slate-300 bg-transparent py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-700 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="cantidad"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Cantidad
                      </label>
                      <input
                        id="cantidad"
                        type="text"
                        placeholder="Ej. 100 pzas"
                        value={header.cantidad}
                        onChange={(e) => handleHeaderChange('cantidad', e.target.value)}
                        className="font-mono-tabular mt-1 w-full border-b border-slate-300 bg-transparent py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-700 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Tabla de seguimiento con borde punteado morado */}
              <section aria-label="Seguimiento por estación" className="mt-6 overflow-x-auto">
                <div className="min-w-[680px] border-2 border-dashed border-purple-700 bg-white/80">
                  <table className="w-full table-fixed border-collapse">
                    <thead>
                      <tr className="border-b-2 border-dashed border-purple-700 bg-purple-50/40">
                        <th className="w-[10%] border-r-2 border-dashed border-purple-700 px-2 py-3 text-center text-sm font-semibold text-slate-900">
                          Sec
                        </th>
                        <th className="w-[19%] border-r-2 border-dashed border-purple-700 px-3 py-3 text-center text-sm font-semibold text-slate-900">
                          Estación
                        </th>
                        <th className="w-[19%] border-r-2 border-dashed border-purple-700 px-3 py-3 text-center text-sm font-semibold text-slate-900">
                          Operario
                        </th>
                        <th className="w-[15%] border-r-2 border-dashed border-purple-700 px-3 py-3 text-center text-sm font-semibold text-slate-900">
                          Fecha
                        </th>
                        <th className="w-[20%] border-r-2 border-dashed border-purple-700 px-3 py-3 text-center text-sm font-semibold text-slate-900">
                          Entrada / Salida
                        </th>
                        <th className="w-[17%] px-3 py-3 text-center text-sm font-semibold text-slate-900">
                          Ok / merma
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr
                          key={row.id}
                          className="group h-11 border-b border-slate-200/75 transition-colors hover:bg-purple-50/20 last:border-b-0"
                        >
                          <td className="border-r-2 border-dashed border-purple-700 p-0">
                            <input
                              type="text"
                              aria-label={`Secuencia fila ${index + 1}`}
                              placeholder={`0${index + 1}`.slice(-2)}
                              value={row.sec}
                              onChange={(e) => handleRowChange(row.id, 'sec', e.target.value)}
                              className="font-mono-tabular h-11 w-full bg-transparent px-2 text-center text-sm text-slate-900 placeholder:text-slate-300 focus:bg-purple-50/50 focus:outline-none"
                            />
                          </td>
                          <td className="border-r-2 border-dashed border-purple-700 p-0">
                            <input
                              type="text"
                              aria-label={`Estación fila ${index + 1}`}
                              value={row.estacion}
                              onChange={(e) => handleRowChange(row.id, 'estacion', e.target.value)}
                              className="h-11 w-full bg-transparent px-2.5 text-sm text-slate-900 focus:bg-purple-50/50 focus:outline-none"
                            />
                          </td>
                          <td className="border-r-2 border-dashed border-purple-700 p-0">
                            <input
                              type="text"
                              aria-label={`Operario fila ${index + 1}`}
                              value={row.operario}
                              onChange={(e) => handleRowChange(row.id, 'operario', e.target.value)}
                              className="h-11 w-full bg-transparent px-2.5 text-sm text-slate-900 focus:bg-purple-50/50 focus:outline-none"
                            />
                          </td>
                          <td className="border-r-2 border-dashed border-purple-700 p-0">
                            <input
                              type="text"
                              aria-label={`Fecha fila ${index + 1}`}
                              placeholder="AAAA-MM-DD"
                              value={row.fecha}
                              onChange={(e) => handleRowChange(row.id, 'fecha', e.target.value)}
                              className="font-mono-tabular h-11 w-full bg-transparent px-2 text-center text-sm text-slate-900 placeholder:text-slate-300 focus:bg-purple-50/50 focus:outline-none"
                            />
                          </td>
                          <td className="border-r-2 border-dashed border-purple-700 p-0">
                            <input
                              type="text"
                              aria-label={`Entrada / Salida fila ${index + 1}`}
                              placeholder="08:00 / 10:00"
                              value={row.entradaSalida}
                              onChange={(e) =>
                                handleRowChange(row.id, 'entradaSalida', e.target.value)
                              }
                              className="font-mono-tabular h-11 w-full bg-transparent px-2 text-center text-sm text-slate-900 placeholder:text-slate-300 focus:bg-purple-50/50 focus:outline-none"
                            />
                          </td>
                          <td className="relative p-0">
                            <input
                              type="text"
                              aria-label={`Ok / merma fila ${index + 1}`}
                              placeholder="100 / 0"
                              value={row.okMerma}
                              onChange={(e) => handleRowChange(row.id, 'okMerma', e.target.value)}
                              className="font-mono-tabular h-11 w-full bg-transparent px-2 pr-8 text-center text-sm text-slate-900 placeholder:text-slate-300 focus:bg-purple-50/50 focus:outline-none"
                            />
                            {rows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(row.id)}
                                title="Eliminar fila"
                                aria-label={`Eliminar fila ${index + 1}`}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100 print:hidden"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
