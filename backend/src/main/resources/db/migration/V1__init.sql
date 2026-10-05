-- Ceti B2B2C. Reemplaza Firestore: la autorización que vivía en firestore.rules
-- ahora la hace el backend; aquí quedan las invariantes de datos (enums, rangos,
-- unicidad) como segunda barrera.

create table users (
  id           text primary key,
  provider     text not null,
  provider_sub text not null,
  email        text,
  display_name text not null,
  photo_url    text,
  profile      jsonb,
  -- Rol/tenant: antes custom claims de Firebase Auth. Solo el backend los escribe (R2).
  role         text check (role in ('admin', 'profesor', 'estudiante')),
  colegio_id   text,
  curso_id     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (provider, provider_sub)
);
create index users_email_idx on users (lower(email));

create table colegios (
  id                   text primary key,
  nombre               text not null,
  sedes_enabled        boolean not null default false,
  plan                 text,
  plan_max_estudiantes integer,
  created_by           text,
  created_at           timestamptz not null default now()
);

create table cursos (
  colegio_id    text not null references colegios (id) on delete cascade,
  id            text not null,
  nombre        text not null,
  grado         text not null check (grado ~ '^([1-9]|1[01])$'),
  profesor_uids text[] not null default '{}',
  -- El código de unión vive en el curso: unique sustituye a la colección classCodes.
  codigo        text unique,
  created_by    text,
  created_at    timestamptz not null default now(),
  primary key (colegio_id, id)
);
create index cursos_profesor_idx on cursos using gin (profesor_uids);

-- Roster: solo email + nombre del menor (R4).
create table estudiantes (
  colegio_id       text not null,
  curso_id         text not null,
  uid              text not null,
  email            text not null,
  nombre           text not null,
  estado           text not null check (estado in ('pendiente_atestacion', 'activo', 'suprimido')),
  atestado         boolean not null default false,
  politica_version text,
  atestado_por     text,
  atestado_at      timestamptz,
  joined_at        timestamptz not null default now(),
  primary key (colegio_id, curso_id, uid),
  foreign key (colegio_id, curso_id) references cursos (colegio_id, id) on delete cascade
);

create table progress (
  colegio_id text not null,
  curso_id   text not null,
  uid        text not null,
  world_id   text not null,
  data       jsonb not null,
  primary key (colegio_id, curso_id, uid, world_id),
  foreign key (colegio_id, curso_id, uid) references estudiantes (colegio_id, curso_id, uid) on delete cascade
);

-- Config de clase (D-ORQ): ausencia de fila = defaults.
create table curso_config (
  colegio_id text not null,
  curso_id   text not null,
  data       jsonb not null,
  primary key (colegio_id, curso_id),
  foreign key (colegio_id, curso_id) references cursos (colegio_id, id) on delete cascade
);

-- Contenido copy-on-write por curso (banco_*, microteoria_*, eligeCamino_*).
create table curso_contenido (
  colegio_id text not null,
  curso_id   text not null,
  doc_id     text not null,
  data       jsonb not null,
  primary key (colegio_id, curso_id, doc_id),
  foreign key (colegio_id, curso_id) references cursos (colegio_id, id) on delete cascade
);

create table asignaciones (
  id         text primary key,
  colegio_id text not null references colegios (id) on delete cascade,
  curso_id   text not null,
  target_uid text,
  data       jsonb not null
);
create index asignaciones_curso_idx on asignaciones (colegio_id, curso_id);

-- Datos personales de la cuenta (metas, operaciones, diario, presupuestos).
-- Solo su dueño los lee o escribe (CA5).
create table user_docs (
  user_id   text not null references users (id) on delete cascade,
  coleccion text not null check (coleccion in ('goals', 'deposits', 'movimientos', 'presupuestos')),
  doc_id    text not null,
  data      jsonb not null,
  primary key (user_id, coleccion, doc_id)
);

-- Cupos diarios de IA por usuario.
create table ia_usage (
  user_id text not null references users (id) on delete cascade,
  kind    text not null,
  day     date not null,
  count   integer not null,
  primary key (user_id, kind, day)
);
