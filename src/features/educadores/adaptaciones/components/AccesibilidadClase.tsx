/**
 * Fase 8c — en Gestionar → Clase: «Leer en voz alta» para toda la clase. Sin
 * tocarlo, viene encendido en 1° a 3° y apagado en los demás grados.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { Esqueleto, Seccion, Tarjeta } from '@features/dashboard/components/profe/kit';
import { vozDeClase } from '@/functions/src/educadores/dominio';
import { adaptacionesRepository } from '../data/adaptacionesRepository';
import FilaInterruptor from './FilaInterruptor';

export default function AccesibilidadClase({
  colegioId,
  cursoId,
  grado,
}: {
  colegioId: string;
  cursoId: string;
  grado: string | null | undefined;
}) {
  const { t } = useTranslation();
  const profe = useAuthStore((s) => s.firebaseUid);
  const [voz, setVoz] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelado = false;
    void adaptacionesRepository
      .clase(colegioId, cursoId)
      .then((c) => {
        if (!cancelado) setVoz(vozDeClase(c, grado));
      })
      .catch(() => {
        if (!cancelado) setVoz(vozDeClase(null, grado));
      });
    return () => {
      cancelado = true;
    };
  }, [colegioId, cursoId, grado]);

  const cambiar = async (v: boolean) => {
    if (!profe) return;
    setVoz(v);
    try {
      await adaptacionesRepository.guardarClase(colegioId, cursoId, v, profe);
    } catch (e) {
      setVoz(!v);
      showMessage(t('diferenciales.adaptaciones.errorGuardar'), e instanceof Error ? e.message : undefined, 'error');
    }
  };

  return (
    <>
      <Seccion texto={t('diferenciales.adaptaciones.claseTitulo')} />
      <Tarjeta style={{ gap: 12 }}>
        {voz === null ? (
          <Esqueleto filas={1} alto={44} />
        ) : (
          <FilaInterruptor
            titulo={t('diferenciales.adaptaciones.leerEnVozAlta')}
            ayuda={t('diferenciales.adaptaciones.claseAyuda')}
            valor={voz}
            onChange={(v) => void cambiar(v)}
          />
        )}
      </Tarjeta>
    </>
  );
}
