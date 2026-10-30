/**
 * Fase 8c — «Adaptaciones» en la ficha del estudiante: más tiempo (clase en
 * vivo), menos opciones, leer en voz alta y letra grande. Cualquier profe de la
 * clase las cambia; se guardan al tocar. Todos los planes: la accesibilidad no
 * se cobra. No tocan la nota ni los informes.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { Esqueleto, Pill, Seccion, Tarjeta } from '@features/dashboard/components/profe/kit';
import {
  ADAPTACIONES,
  SIN_ADAPTACIONES,
  cuantasActivas,
  type Adaptacion,
  type MapaAdaptaciones,
} from '@/functions/src/educadores/dominio';
import { adaptacionesRepository } from '../data/adaptacionesRepository';
import FilaInterruptor from './FilaInterruptor';

export default function AdaptacionesFicha({
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
  const profe = useAuthStore((s) => s.firebaseUid);
  const [a, setA] = useState<MapaAdaptaciones | null>(null);
  const primerNombre = nombre.trim().split(/\s+/)[0] || nombre;

  useEffect(() => {
    let cancelado = false;
    void adaptacionesRepository
      .de(colegioId, cursoId, uid)
      .then((x) => {
        if (!cancelado) setA(x ?? SIN_ADAPTACIONES);
      })
      .catch(() => {
        if (!cancelado) setA(SIN_ADAPTACIONES);
      });
    return () => {
      cancelado = true;
    };
  }, [colegioId, cursoId, uid]);

  const cambiar = async (k: Adaptacion, v: boolean) => {
    if (!a || !profe) return;
    const antes = a;
    const siguiente = { ...a, [k]: v };
    setA(siguiente);
    try {
      await adaptacionesRepository.guardar(colegioId, cursoId, uid, siguiente, profe);
    } catch (e) {
      setA(antes);
      showMessage(t('diferenciales.adaptaciones.errorGuardar'), e instanceof Error ? e.message : undefined, 'error');
    }
  };

  return (
    <>
      <Seccion
        texto={t('diferenciales.adaptaciones.titulo')}
        derecha={a && cuantasActivas(a) ? <Pill texto={t('diferenciales.adaptaciones.activas', { count: cuantasActivas(a) })} tono="verde" /> : null}
      />
      <Tarjeta style={st.tarjeta}>
        {!a ? (
          <Esqueleto filas={2} alto={44} />
        ) : (
          ADAPTACIONES.map((k) => (
            <FilaInterruptor
              key={k}
              titulo={t(`diferenciales.adaptaciones.${k}`)}
              ayuda={t(`diferenciales.adaptaciones.${k}Ayuda`)}
              valor={a[k]}
              onChange={(v) => void cambiar(k, v)}
            />
          ))
        )}
        <Text style={[st.nota, { color: colors.text.tertiary }]}>
          {t('diferenciales.adaptaciones.privado', { nombre: primerNombre })}
        </Text>
      </Tarjeta>
    </>
  );
}

const st = StyleSheet.create({
  tarjeta: { gap: 14 },
  nota: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
});
