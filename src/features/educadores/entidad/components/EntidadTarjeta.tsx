/**
 * Pestaña Colegio (Fase 6): la entidad del profe. Sin entidad, la invitación a
 * crearla; con entidad, su plan y los accesos (panel, profes, escala,
 * biblioteca, facturación) según sea admin o profe, y salir de la entidad.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { licenciaVigente, planEntidadDe } from '@/functions/src/educadores/dominio';
import { BotonChunky, Esqueleto, Pill, Tarjeta, paletaTono, type Tono } from '@features/dashboard/components/profe/kit';
import { entidadRepository } from '../data/entidadRepository';
import { refrescarClaimsProfe, type MiEntidad } from '../hooks/useMiEntidad';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function fechaCorta(ms: number): string {
  return new Date(ms).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Acceso({ icono, titulo, texto, tono, ruta }: { icono: IconName; titulo: string; texto: string; tono: Tono; ruta: string }) {
  const colors = useThemeColors();
  const router = useRouter();
  const p = paletaTono(colors, tono);
  return (
    <Bounceable
      onPress={() => router.push(ruta as Href)}
      activeScale={0.97}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${texto}`}
      style={[st.acceso, { backgroundColor: colors.materials.base, borderColor: colors.materials.border }]}
    >
      <View style={[st.accesoIcono, { backgroundColor: p.fondo }]}>
        <Ionicons name={icono} size={20} color={p.tinta} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[st.accesoTitulo, { color: colors.text.primary }]} numberOfLines={1}>
          {titulo}
        </Text>
        <Text style={[st.accesoTexto, { color: colors.text.tertiary }]} numberOfLines={2}>
          {texto}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.text.quaternary} />
    </Bounceable>
  );
}

/** `mi` viene de la pestaña, que también decide qué mostrar con o sin entidad. */
export default function EntidadTarjeta({ mi }: { mi: MiEntidad }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const uid = useAuthStore((s) => s.firebaseUid);
  const { vista, cargando, soyAdmin, conLicencia } = mi;

  if (cargando) return <Esqueleto filas={1} alto={120} />;
  if (!vista) return null;

  if (!vista.entidad) {
    return (
      <Tarjeta style={st.tarjeta}>
        <Pill tono="morado" icono="business" texto={t('entidad.nueva.pill')} />
        <Text style={[st.titulo, { color: colors.text.primary }]}>{t('entidad.nueva.titulo')}</Text>
        <Text style={[st.texto, { color: colors.text.secondary }]}>{t('entidad.nueva.texto')}</Text>
        <BotonChunky
          texto={t('entidad.nueva.cta')}
          icono="business"
          variante="secundario"
          onPress={() => router.push('/(staff)/entidad/crear' as Href)}
        />
      </Tarjeta>
    );
  }

  const licencia = licenciaVigente(vista.licencia, Date.now());
  const plan = planEntidadDe(licencia);
  const soloYo = vista.profes.length <= 1;

  const salir = () =>
    confirmAction({
      title: t('entidad.salir.titulo'),
      body: t('entidad.salir.texto', { entidad: vista.entidad?.nombre ?? '' }),
      confirmLabel: t('entidad.salir.confirmar'),
      cancelLabel: t('entidad.cancelar'),
      destructive: true,
      onConfirm: () => {
        void entidadRepository
          .sacar(uid, null)
          .then(async () => {
            await refrescarClaimsProfe();
            showMessage(t('entidad.salir.listo'), undefined, 'success');
          })
          .catch((e) => showMessage(t('entidad.error'), e instanceof Error ? e.message : String(e), 'error'));
      },
    });

  return (
    <View style={{ gap: 10 }}>
      <Tarjeta style={st.tarjeta}>
        <View style={st.fila}>
          <Pill tono="morado" icono="business" texto={t(`entidad.tipo.${vista.entidad.tipo}`)} />
          {soyAdmin ? <Pill tono="naranja" texto={t('entidad.rol.admin')} /> : <Pill tono="azul" texto={t('entidad.rol.profe')} />}
        </View>
        <Text style={[st.titulo, { color: colors.text.primary }]}>{vista.entidad.nombre}</Text>
        <Text style={[st.texto, { color: colors.text.secondary }]}>
          {licencia && plan
            ? t('entidad.licencia.vigente', { plan: t(`entidad.plan.${plan}`), fecha: fechaCorta(licencia.hasta) })
            : t('entidad.licencia.sin')}
          {' · '}
          {t('entidad.profes', { count: vista.profes.length })}
        </Text>
      </Tarjeta>

      {soyAdmin && conLicencia ? (
        <Acceso icono="stats-chart" tono="naranja" titulo={t('entidad.acceso.panel')} texto={t('entidad.acceso.panelTexto')} ruta="/(staff)/entidad" />
      ) : null}
      {soyAdmin ? (
        <Acceso icono="people" tono="azul" titulo={t('entidad.acceso.profes')} texto={t('entidad.acceso.profesTexto')} ruta="/(staff)/entidad/profes" />
      ) : null}
      <Acceso
        icono="ribbon"
        tono="verde"
        titulo={t('entidad.acceso.escala')}
        texto={t(soyAdmin ? 'entidad.acceso.escalaAdmin' : 'entidad.acceso.escalaProfe')}
        ruta="/(staff)/entidad/evaluacion"
      />
      {conLicencia ? (
        <Acceso icono="library" tono="morado" titulo={t('entidad.acceso.biblioteca')} texto={t('entidad.acceso.bibliotecaTexto')} ruta="/(staff)/entidad/biblioteca" />
      ) : null}
      {soyAdmin ? (
        <Acceso icono="link" tono="azul" titulo={t('conexiones.titulo')} texto={t('conexiones.acceso')} ruta="/(staff)/entidad/conexiones" />
      ) : null}
      {soyAdmin ? (
        <Acceso icono="receipt" tono="neutro" titulo={t('entidad.acceso.facturacion')} texto={t('entidad.acceso.facturacionTexto')} ruta="/(staff)/entidad/facturacion" />
      ) : null}
      {!soloYo ? (
        <BotonChunky texto={t('entidad.salir.boton')} icono="exit-outline" variante="secundario" compacto onPress={salir} />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  tarjeta: { gap: 10 },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  titulo: { fontSize: 20, lineHeight: 25, fontWeight: '900' },
  texto: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  acceso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: 18,
    padding: 12,
  },
  accesoIcono: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  accesoTitulo: { fontSize: 16, fontWeight: '900' },
  accesoTexto: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
});
