/**
 * Precio que vería hoy el profe por un plan individual (con la tarifa fundador
 * si quedan cupos). Pregunta al servidor (`cotizarPlan`) y, mientras responde o
 * si falla, usa el precio de lista: nunca deja la tarjeta sin precio.
 */
import { useEffect, useState } from 'react';
import {
  PLANES_INDIVIDUALES,
  precioPlan,
  PRECIOS_COP,
  type Ciclo,
  type PlanIndividual,
} from '@/functions/src/educadores/dominio';
import { suscripcionRepository } from '../data/suscripcionRepository';

export interface Cotizacion {
  /** Precio final a cobrar (IVA incluido). */
  montoCop: number;
  /** Precio de lista del ciclo (para tacharlo si hay tarifa fundador). */
  listaCop: number;
  fundador: boolean;
  cuposFundador: number;
  /** Todavía no respondió el servidor (se muestra el precio de lista). */
  cargando: boolean;
}

function deLista(plan: PlanIndividual, ciclo: Ciclo, cargando: boolean): Cotizacion {
  return {
    montoCop: precioPlan(plan, ciclo),
    listaCop: PRECIOS_COP[plan][ciclo],
    fundador: false,
    cuposFundador: 0,
    cargando,
  };
}

async function consultar(plan: PlanIndividual, ciclo: Ciclo): Promise<Cotizacion> {
  try {
    // Sin desestructurar: /dev/profe reemplaza los métodos del objeto.
    const r = await suscripcionRepository.cotizar(plan, ciclo);
    if (!r || typeof r.montoCop !== 'number' || !(r.montoCop > 0))
      return deLista(plan, ciclo, false);
    return {
      montoCop: r.montoCop,
      listaCop: PRECIOS_COP[plan][ciclo],
      fundador: r.fundador === true,
      cuposFundador: typeof r.cuposFundador === 'number' ? Math.max(0, r.cuposFundador) : 0,
      cargando: false,
    };
  } catch {
    return deLista(plan, ciclo, false);
  }
}

/** Cotización de Piloto y Comandante para el ciclo elegido. */
export function useCotizaciones(ciclo: Ciclo): Record<PlanIndividual, Cotizacion> {
  const [estado, setEstado] = useState<Record<PlanIndividual, Cotizacion>>(() => ({
    piloto: deLista('piloto', ciclo, true),
    comandante: deLista('comandante', ciclo, true),
  }));

  useEffect(() => {
    let vigente = true;
    setEstado({
      piloto: deLista('piloto', ciclo, true),
      comandante: deLista('comandante', ciclo, true),
    });
    for (const plan of PLANES_INDIVIDUALES) {
      void consultar(plan, ciclo).then((c) => {
        if (vigente) setEstado((prev) => ({ ...prev, [plan]: c }));
      });
    }
    return () => {
      vigente = false;
    };
  }, [ciclo]);

  return estado;
}

/** Cotización de un solo plan (pantalla de pago). */
export function useCotizacion(plan: PlanIndividual, ciclo: Ciclo): Cotizacion {
  const [estado, setEstado] = useState<Cotizacion>(() => deLista(plan, ciclo, true));

  useEffect(() => {
    let vigente = true;
    setEstado(deLista(plan, ciclo, true));
    void consultar(plan, ciclo).then((c) => {
      if (vigente) setEstado(c);
    });
    return () => {
      vigente = false;
    };
  }, [plan, ciclo]);

  return estado;
}
