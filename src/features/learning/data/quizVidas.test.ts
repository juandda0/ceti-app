import {
  VIDAS_POR_MUNDO,
  estadoIntento,
  nuevoIntento,
  precision,
  preguntaActual,
  registrarRespuesta,
  siguiente,
  type IntentoQuiz,
} from '@features/learning/data/quizVidas';

/** Responde la pregunta actual y pasa a la siguiente. */
const responder = (i: IntentoQuiz, correcta: boolean) => siguiente(registrarRespuesta(i, correcta));

describe('quizVidas', () => {
  it('cada intento empieza con 3 vidas y las preguntas en orden', () => {
    const i = nuevoIntento(4);
    expect(VIDAS_POR_MUNDO).toBe(3);
    expect(i.vidas).toBe(3);
    expect(i.cola).toEqual([0, 1, 2, 3]);
    expect(preguntaActual(i)).toBe(0);
    expect(estadoIntento(i)).toBe('jugando');
  });

  it('contestar todo bien completa el mundo sin perder vidas', () => {
    let i = nuevoIntento(3);
    for (let n = 0; n < 3; n++) i = responder(i, true);
    expect(estadoIntento(i)).toBe('completado');
    expect(i.vidas).toBe(3);
    expect(precision(i)).toBe(100);
  });

  it('un error cuesta una vida y la pregunta vuelve al final', () => {
    let i = nuevoIntento(3);
    i = registrarRespuesta(i, false);
    expect(i.vidas).toBe(2);
    expect(i.cola).toEqual([0, 1, 2, 0]);
    i = siguiente(i);
    i = responder(i, true); // 1
    i = responder(i, true); // 2
    expect(preguntaActual(i)).toBe(0);
    expect(estadoIntento(i)).toBe('jugando');
    i = registrarRespuesta(i, true);
    expect(estadoIntento(i)).toBe('completado');
    expect(i.errores).toBe(1);
    expect(precision(i)).toBe(75);
  });

  it('hay que contestar bien todas: la misma pregunta puede repetirse varias veces', () => {
    let i = nuevoIntento(2);
    i = responder(i, true); // 0
    i = responder(i, false); // 1 → vuelve
    i = responder(i, false); // 1 otra vez → vuelve
    expect(preguntaActual(i)).toBe(1);
    expect(i.vidas).toBe(1);
    i = registrarRespuesta(i, true);
    expect(estadoIntento(i)).toBe('completado');
  });

  it('al tercer error el intento se pierde', () => {
    let i = nuevoIntento(10);
    i = responder(i, false);
    i = responder(i, false);
    i = registrarRespuesta(i, false);
    expect(i.vidas).toBe(0);
    expect(estadoIntento(i)).toBe('perdido');
    // Un intento perdido ya no cambia.
    expect(registrarRespuesta(i, true)).toBe(i);
  });

  it('empezar de nuevo devuelve las 3 vidas y vuelve a la primera pregunta', () => {
    const i = nuevoIntento(5);
    expect(i).toEqual(nuevoIntento(5));
    expect(preguntaActual(i)).toBe(0);
  });
});
