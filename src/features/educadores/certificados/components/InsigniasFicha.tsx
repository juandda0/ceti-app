/**
 * Fase 8b — «Insignias» en la ficha del estudiante: el profe da una de las 8
 * con un motivo corto opcional y ve (y puede quitar) las que ya tiene en esta
 * clase. También lista sus certificados. Todos los planes.
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { BotonChunky, Campo, Seccion, Tarjeta } from '@features/dashboard/components/profe/kit';
import {
  ESTILO_INSIGNIA,
  INSIGNIAS,
  MAX_MOTIVO_INSIGNIA,
  armarInsignia,
  type CertificadoPublico,
  type InsigniaId,
} from '@/functions/src/educadores/dominio';
import { certificadosRepository, type InsigniaGuardada } from '../data/certificadosRepository';

export function IconoInsignia({ id, tamano = 40 }: { id: InsigniaId; tamano?: number }) {
  const e = ESTILO_INSIGNIA[id];
  return (
    <View style={[st.icono, { width: tamano, height: tamano, borderRadius: tamano / 2, backgroundColor: e.color }]}>
      <Ionicons name={e.icono as keyof typeof Ionicons.glyphMap} size={tamano * 0.5} color="#FFFFFF" />
    </View>
  );
}

export default function InsigniasFicha({
  colegioId,
  cursoId,
  uid,
  nombre,
}: {
  colegioId: string;
  cursoId: string;
  uid: string;
  nombre: string;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const profeUid = useAuthStore((s) => s.firebaseUid);
  const profeNombre = getFirebaseClients()?.auth.currentUser?.displayName ?? '';
  const [dadas, setDadas] = useState<InsigniaGuardada[]>([]);
  const [certificados, setCertificados] = useState<CertificadoPublico[]>([]);
  const [elegida, setElegida] = useState<InsigniaId | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const primerNombre = nombre.trim().split(/\s+/)[0] || nombre;

  const cargar = useCallback(async () => {
    const [i, c] = await Promise.all([
      certificadosRepository.insignias(colegioId, cursoId, uid).catch(() => []),
      certificadosRepository.deEstudiante(colegioId, cursoId, uid).catch(() => []),
    ]);
    setDadas(i);
    setCertificados(c);
  }, [colegioId, cursoId, uid]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const dar = async () => {
    if (!elegida || !profeUid) return;
    setOcupado(true);
    try {
      await certificadosRepository.darInsignia(
        colegioId,
        cursoId,
        uid,
        armarInsignia(elegida, motivo, { uid: profeUid, nombre: profeNombre || t('diferenciales.insignias.tuProfe') }, Date.now())
      );
      setElegida(null);
      setMotivo('');
      showMessage(t('diferenciales.insignias.dada', { nombre: primerNombre }), undefined, 'success');
      await cargar();
    } catch (e) {
      showMessage(t('diferenciales.insignias.error'), e instanceof Error ? e.message : undefined, 'error');
    } finally {
      setOcupado(false);
    }
  };

  const quitar = async (id: string) => {
    try {
      await certificadosRepository.quitarInsignia(colegioId, cursoId, uid, id);
      await cargar();
    } catch (e) {
      showMessage(t('diferenciales.insignias.error'), e instanceof Error ? e.message : undefined, 'error');
    }
  };

  return (
    <>
      <Seccion texto={t('diferenciales.insignias.titulo')} />
      <Tarjeta style={{ gap: 12 }}>
        <Text style={[st.nota, { color: colors.text.secondary }]}>{t('diferenciales.insignias.intro', { nombre: primerNombre })}</Text>
        <View style={st.grid}>
          {INSIGNIAS.map((id) => (
            <Bounceable
              key={id}
              onPress={() => setElegida(elegida === id ? null : id)}
              activeScale={0.94}
              accessibilityRole="button"
              accessibilityState={{ selected: elegida === id }}
              accessibilityLabel={t(`diferenciales.insignias.${id}`)}
              style={[
                st.celda,
                {
                  borderColor: elegida === id ? ESTILO_INSIGNIA[id].color : colors.materials.border,
                  backgroundColor: elegida === id ? ESTILO_INSIGNIA[id].color + '1f' : colors.materials.base,
                },
              ]}
            >
              <IconoInsignia id={id} tamano={36} />
              <Text style={[st.celdaTxt, { color: colors.text.primary }]} numberOfLines={2}>
                {t(`diferenciales.insignias.${id}`)}
              </Text>
            </Bounceable>
          ))}
        </View>
        {elegida ? (
          <>
            <Campo
              etiqueta={t('diferenciales.insignias.motivo')}
              value={motivo}
              onChangeText={setMotivo}
              maxLength={MAX_MOTIVO_INSIGNIA}
              placeholder={t('diferenciales.insignias.motivoEj')}
            />
            <BotonChunky
              texto={t('diferenciales.insignias.dar', { nombre: primerNombre })}
              icono="medal"
              cargando={ocupado}
              onPress={() => void dar()}
            />
          </>
        ) : null}
        {dadas.map((d) => (
          <View key={d.id} style={[st.dada, { borderTopColor: colors.materials.border }]}>
            <IconoInsignia id={d.insignia} tamano={32} />
            <View style={{ flex: 1 }}>
              <Text style={[st.dadaTitulo, { color: colors.text.primary }]}>{t(`diferenciales.insignias.${d.insignia}`)}</Text>
              <Text style={[st.nota, { color: colors.text.tertiary }]}>
                {[d.motivo, `${d.dadaPorNombre} · ${new Date(d.dadaAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`]
                  .filter(Boolean)
                  .join(' — ')}
              </Text>
            </View>
            <Bounceable
              onPress={() => void quitar(d.id)}
              activeScale={0.9}
              accessibilityRole="button"
              accessibilityLabel={t('diferenciales.insignias.quitar')}
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={22} color={colors.text.tertiary} />
            </Bounceable>
          </View>
        ))}
        {certificados.length ? (
          <Text style={[st.nota, { color: colors.text.secondary }]}>
            {t('diferenciales.certificados.enFicha', { count: certificados.filter((c) => !c.revocadoAt).length, codigos: certificados.map((c) => c.codigo).join(', ') })}
          </Text>
        ) : null}
      </Tarjeta>
    </>
  );
}

const st = StyleSheet.create({
  icono: { alignItems: 'center', justifyContent: 'center' },
  nota: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  celda: { width: '23%', minWidth: 76, flexGrow: 1, alignItems: 'center', gap: 6, borderWidth: 2, borderRadius: 14, padding: 8 },
  celdaTxt: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  dada: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, paddingTop: 10 },
  dadaTitulo: { fontSize: 15, fontWeight: '900' },
});
