/** Fase 9 — aviso arriba de las pantallas de una clase que el profe solo ve y califica. */
import { useTranslation } from 'react-i18next';
import { Aviso } from '@features/dashboard/components/profe/kit';
import { usePermisoClase } from './usePermisoClase';

export default function AvisoSoloCalifica({ cursoId }: { cursoId: string | null | undefined }) {
  const { t } = useTranslation();
  const { soloCalifica } = usePermisoClase(cursoId);
  if (!soloCalifica) return null;
  return <Aviso icono="eye-outline" tono="azul" texto={t('permisos.aviso')} />;
}
