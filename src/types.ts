export interface TravelerRow {
  id: number;
  sec: string;
  estacion: string;
  operario: string;
  fecha: string;
  entradaSalida: string;
  okMerma: string;
}

export interface TravelerHeader {
  idLote: string;
  fechaEmision: string;
  folio: string;
  materiaPrima: string;
  loteProv: string;
  cantidad: string;
  operarioPrincipal: string;
  estacionPrincipal: string;
}

export interface TravelerRecord {
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

export interface AuthStatus {
  configured: boolean;
  source: 'env' | 'claimed' | 'none';
  authenticated: boolean;
  username: string | null;
}
