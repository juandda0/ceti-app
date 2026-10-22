/**
 * Aviso arriba de la pestaña Clases: cuántos días de Piloto gratis quedan, o que
 * el último cobro no pasó. Tranquilo, sin cuenta regresiva roja: después de la
 * prueba se sigue gratis con 1 clase. No aparece si no hay prueba ni mora, ni
 * si el plan viene del colegio.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Aviso, BotonChunky } from '@features/dashboard/components/profe/kit';
import { useMiPlan } from '../hooks/useMiPlan';
import { fechaLarga } from '../data/planUi';
import { rutaPlanes } from './MuroPlan';

export default function BannerPrueba() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sub, diasPrueba, porColegio, cargando } = useMiPlan();
  if (cargando || porColegio || !sub) return null;

  if (sub.estado === 'en_mora') {
    const nombre = t(`educadores.planes.nombre.${sub.plan}`);
    return (
      <Aviso
        icono="card-outline"
        tono="naranja"
        texto={
          sub.proximoReintento
            ? t('educadores.estado.bannerMora', { fecha: fechaLarga(sub.proximoReintento) })
            : t('educadores.estado.bannerMoraSinFecha', { plan: nombre })
        }
      >
        <View style={{ alignSelf: 'flex-start' }}>
          <BotonChunky
            texto={t('educadores.estado.actualizarPago')}
            icono="refresh"
            variante="secundario"
            compacto
            onPress={() => router.push(rutaPlanes(null, sub.plan))}
          />
        </View>
      </Aviso>
    );
  }

  if (diasPrueba <= 0) return null;
  return (
    <Aviso
      icono="rocket-outline"
      tono="marca"
      texto={t('educadores.estado.bannerPrueba', { count: diasPrueba })}
    >
      <View style={{ alignSelf: 'flex-start' }}>
        <BotonChunky
          texto={t('educadores.estado.verPlanes')}
          icono="sparkles"
          variante="secundario"
          compacto
          onPress={() => router.push(rutaPlanes())}
        />
      </View>
    </Aviso>
  );
}
