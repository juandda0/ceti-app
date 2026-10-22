import {
  CHIPS_CANTIDAD,
  DISPOSICIONES,
  limitarCantidad,
  N_MAX,
  N_MIN,
  PANTALLAS_PROFE,
  SEGUNDOS_REFRESCO,
  type AjustesSalon,
} from '@features/salon/salon';

type Props = {
  ajustes: AjustesSalon;
  cambiar: (parcial: Partial<AjustesSalon>) => void;
  pantallaCompleta: boolean;
  alternarPantallaCompleta: () => void;
};

function Chip({
  texto,
  activo = false,
  deshabilitado = false,
  redondo = false,
  titulo,
  onPress,
}: {
  texto: string;
  activo?: boolean;
  deshabilitado?: boolean;
  redondo?: boolean;
  titulo?: string;
  onPress: () => void;
}) {
  const clases = ['salon-chip'];
  if (activo) clases.push('salon-chip--activo');
  if (redondo) clases.push('salon-chip--redondo');
  return (
    <button
      type="button"
      className={clases.join(' ')}
      disabled={deshabilitado}
      aria-pressed={activo}
      title={titulo}
      onClick={onPress}
    >
      {texto}
    </button>
  );
}

export function BarraControles({
  ajustes,
  cambiar,
  pantallaCompleta,
  alternarPantallaCompleta,
}: Props) {
  const conProfe = ajustes.disposicion !== 'estudiantes';
  const fijarCantidad = (n: number) => cambiar({ n: limitarCantidad(n) });

  return (
    <div className="salon-barra">
      <div className="salon-titulo">
        <strong>Salón demo · emulador</strong>
        <a href="/dev/entrar" target="_blank" rel="noopener noreferrer">
          Cuentas
        </a>
      </div>

      <div className="salon-grupo">
        <span className="salon-grupo-nombre">Estudiantes</span>
        <Chip
          texto="−"
          redondo
          titulo="Uno menos"
          deshabilitado={ajustes.n <= N_MIN}
          onPress={() => fijarCantidad(ajustes.n - 1)}
        />
        <span className="salon-cantidad">{ajustes.n}</span>
        <Chip
          texto="+"
          redondo
          titulo="Uno más"
          deshabilitado={ajustes.n >= N_MAX}
          onPress={() => fijarCantidad(ajustes.n + 1)}
        />
        {CHIPS_CANTIDAD.map((n) => (
          <Chip
            key={n}
            texto={String(n)}
            activo={ajustes.n === n}
            onPress={() => fijarCantidad(n)}
          />
        ))}
      </div>

      <div className="salon-grupo">
        <span className="salon-grupo-nombre">Disposición</span>
        {DISPOSICIONES.map((d) => (
          <Chip
            key={d.id}
            texto={d.etiqueta}
            activo={ajustes.disposicion === d.id}
            onPress={() => cambiar({ disposicion: d.id })}
          />
        ))}
      </div>

      <div className="salon-grupo">
        <span className="salon-grupo-nombre">Pantalla del profe</span>
        {PANTALLAS_PROFE.map((p) => (
          <Chip
            key={p.id}
            texto={p.etiqueta}
            activo={ajustes.profe === p.id}
            deshabilitado={!conProfe}
            onPress={() => cambiar({ profe: p.id })}
          />
        ))}
      </div>

      <label className="salon-interruptor">
        <input
          type="checkbox"
          checked={ajustes.refresco}
          disabled={!conProfe}
          onChange={(e) => cambiar({ refresco: e.currentTarget.checked })}
        />
        Actualizar tablero cada {SEGUNDOS_REFRESCO} s
      </label>

      <div className="salon-espacio" />

      <div className="salon-grupo">
        <Chip
          texto={ajustes.hosts === 'loopback' ? 'Hosts 127.0.0.x' : 'Hosts *.localhost'}
          titulo="Cambia el esquema de orígenes (127.0.0.x sirve en Safari)"
          onPress={() =>
            cambiar({ hosts: ajustes.hosts === 'loopback' ? 'subdominios' : 'loopback' })
          }
        />
        <Chip
          texto={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
          activo={pantallaCompleta}
          onPress={alternarPantallaCompleta}
        />
        <Chip
          texto="Modo presentación"
          titulo="Oculta esta barra (Esc para salir)"
          onPress={() => cambiar({ presentacion: true })}
        />
      </div>
    </div>
  );
}
