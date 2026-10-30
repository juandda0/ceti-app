/**
 * Firestore en memoria para los tests de límites, invitaciones, Bitácora y gestión
 * de clases. Cubre solo lo que usan esos módulos: doc/collection/collectionGroup,
 * where (==, !=, array-contains, in), select, orderBy(documentId), limit, startAfter, count, getAll,
 * batch y runTransaction. `FieldValue.increment` se representa con
 * `{__incremento: n}` (ver el mock de firebase-admin/firestore en cada test).
 */

type Datos = Record<string, unknown>;

export const INCREMENTO = '__incremento';

export function incremento(n: number) {
  return { [INCREMENTO]: n };
}

function aplicar(previo: Datos | undefined, nuevo: Datos, merge: boolean): Datos {
  const base: Datos = merge && previo ? { ...previo } : {};
  for (const [k, v] of Object.entries(nuevo)) {
    if (v && typeof v === 'object' && INCREMENTO in (v as Datos)) {
      base[k] = ((previo?.[k] as number | undefined) ?? 0) + ((v as Datos)[INCREMENTO] as number);
    } else {
      base[k] = v;
    }
  }
  return base;
}

function campo(d: Datos, ruta: string): unknown {
  return ruta.split('.').reduce<unknown>((o, k) => (o as Datos | undefined)?.[k], d);
}

export class FirestoreFalso {
  docs = new Map<string, Datos>();
  private autoId = 0;

  constructor(inicial: Record<string, Datos> = {}) {
    for (const [p, d] of Object.entries(inicial)) this.docs.set(p, d);
  }

  doc(ruta: string): RefFalsa {
    return new RefFalsa(this, ruta);
  }

  collection(ruta: string): ColeccionFalsa {
    return new ColeccionFalsa(this, ruta, false);
  }

  collectionGroup(id: string): ColeccionFalsa {
    return new ColeccionFalsa(this, id, true);
  }

  nuevoId(): string {
    this.autoId += 1;
    return `auto${this.autoId}`;
  }

  async getAll(...refs: RefFalsa[]) {
    return Promise.all(refs.map((r) => r.get()));
  }

  batch() {
    const ops: (() => void)[] = [];
    const b = {
      set: (r: RefFalsa, d: Datos, o?: { merge?: boolean }) => (
        ops.push(() => r.escribir(d, !!o?.merge)),
        b
      ),
      update: (r: RefFalsa, d: Datos) => (ops.push(() => r.escribir(d, true)), b),
      delete: (r: RefFalsa) => (ops.push(() => this.docs.delete(r.path)), b),
      commit: async () => ops.forEach((op) => op()),
    };
    return b;
  }

  async runTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const tx = {
      get: (r: RefFalsa) => r.get(),
      set: (r: RefFalsa, d: Datos, o?: { merge?: boolean }) => r.escribir(d, !!o?.merge),
    };
    return fn(tx);
  }

  datos(ruta: string): Datos | undefined {
    return this.docs.get(ruta);
  }
}

class SnapFalso {
  constructor(
    readonly ref: RefFalsa,
    private readonly d: Datos | undefined
  ) {}
  get exists() {
    return this.d !== undefined;
  }
  get id() {
    return this.ref.id;
  }
  data() {
    return this.d ? { ...this.d } : undefined;
  }
  get(c: string) {
    return this.d ? campo(this.d, c) : undefined;
  }
}

export class RefFalsa {
  constructor(
    private readonly db: FirestoreFalso,
    readonly path: string
  ) {}
  get id() {
    return this.path.split('/').pop()!;
  }
  get parent(): { path: string; parent: RefFalsa | null } {
    const partes = this.path.split('/');
    const col = partes.slice(0, -1).join('/');
    return {
      path: col,
      parent: partes.length > 2 ? new RefFalsa(this.db, partes.slice(0, -2).join('/')) : null,
    };
  }
  collection(nombre: string) {
    return new ColeccionFalsa(this.db, `${this.path}/${nombre}`, false);
  }
  async get() {
    return new SnapFalso(this, this.db.docs.get(this.path));
  }
  escribir(d: Datos, merge: boolean) {
    this.db.docs.set(this.path, aplicar(this.db.docs.get(this.path), d, merge));
  }
  async set(d: Datos, o?: { merge?: boolean }) {
    this.escribir(d, !!o?.merge);
  }
  async update(d: Datos) {
    if (!this.db.docs.has(this.path)) throw new Error(`NOT_FOUND ${this.path}`);
    this.escribir(d, true);
  }
  async delete() {
    this.db.docs.delete(this.path);
  }
}

type Filtro = (d: Datos) => boolean;

class ColeccionFalsa {
  constructor(
    private readonly db: FirestoreFalso,
    private readonly ruta: string,
    private readonly grupo: boolean,
    private readonly filtros: Filtro[] = [],
    private readonly tope = Infinity,
    private readonly despuesDe: string | null = null
  ) {}

  private con(cambios: { filtro?: Filtro; tope?: number; despuesDe?: string }) {
    return new ColeccionFalsa(
      this.db,
      this.ruta,
      this.grupo,
      cambios.filtro ? [...this.filtros, cambios.filtro] : this.filtros,
      cambios.tope ?? this.tope,
      cambios.despuesDe ?? this.despuesDe
    );
  }

  doc(id?: string) {
    return new RefFalsa(this.db, `${this.ruta}/${id ?? this.db.nuevoId()}`);
  }
  async add(d: Datos) {
    const ref = this.doc();
    ref.escribir(d, false);
    return ref;
  }
  where(c: string, op: string, v: unknown) {
    const filtro: Filtro = (d) => {
      const x = campo(d, c);
      if (op === '==') return x === v;
      if (op === '!=') return x !== undefined && x !== v;
      if (op === 'array-contains') return Array.isArray(x) && x.includes(v);
      if (op === 'in') return Array.isArray(v) && v.includes(x);
      throw new Error(`op no soportada: ${op}`);
    };
    return this.con({ filtro });
  }
  select() {
    return this;
  }
  orderBy() {
    return this;
  }
  limit(n: number) {
    return this.con({ tope: n });
  }
  startAfter(snap: { ref: RefFalsa }) {
    return this.con({ despuesDe: snap.ref.path });
  }
  private coincidencias(): [string, Datos][] {
    const prof = this.ruta.split('/').length + 1;
    return [...this.db.docs.entries()]
      .filter(([p]) => {
        const partes = p.split('/');
        if (this.grupo) return partes.length % 2 === 0 && partes[partes.length - 2] === this.ruta;
        return p.startsWith(`${this.ruta}/`) && partes.length === prof;
      })
      .filter(([, d]) => this.filtros.every((f) => f(d)))
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .filter(([p]) => this.despuesDe === null || p > this.despuesDe)
      .slice(0, this.tope);
  }
  async get() {
    const docs = this.coincidencias().map(([p, d]) => new SnapFalso(new RefFalsa(this.db, p), d));
    return { docs, size: docs.length, empty: docs.length === 0 };
  }
  count() {
    return { get: async () => ({ data: () => ({ count: this.coincidencias().length }) }) };
  }
}

// Solo se registra cuando este archivo es la suite (los demás tests lo importan).
const esLaSuite = expect.getState().testPath?.endsWith('firestoreFalso.test.ts') ?? false;

if (esLaSuite)
  test('el Firestore falso filtra, cuenta y aplica incrementos', async () => {
    const db = new FirestoreFalso({
      'c/1': { a: 1, xs: ['u'] },
      'c/2': { a: 2 },
      'c/1/sub/x': { a: 1 },
    });
    expect(
      (await db.collection('c').where('xs', 'array-contains', 'u').count().get()).data().count
    ).toBe(1);
    expect((await db.collectionGroup('sub').get()).size).toBe(1);
    await db.doc('c/2').set({ n: incremento(2) }, { merge: true });
    await db.doc('c/2').set({ n: incremento(1) }, { merge: true });
    expect(db.datos('c/2')).toEqual({ a: 2, n: 3 });
  });
