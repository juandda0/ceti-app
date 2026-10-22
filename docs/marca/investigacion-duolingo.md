# Investigación: cómo diseña y anima Duolingo sus personajes

> Base de conocimiento para el sistema de personajes de Ceti (ver [personajes.md](personajes.md)). Recopilada el 2026-10-20.
> **[OFICIAL]** = fuente de Duolingo (blog, guía de marca, case studies con Rive o LottieFiles). **[NO VERIFICADO]** = fuente secundaria.
> La guía pública design.duolingo.com hoy redirige al blog; sus reglas salen de copias indexadas de esas páginas.

## 1. Reglas de ilustración

### Lenguaje de formas
- **Tres formas base [OFICIAL]:** rectángulo redondeado (la más usada), círculo y triángulo redondeado. Todo tiene esquinas redondeadas; lo puntiagudo está "fuera de marca". ([guía](https://design.duolingo.com/illustration))
- **Simplicidad:** la menor cantidad de formas posible, y cada una con peso visual.
- **Ritmo:** variar el tamaño de las formas; formas repetidas del mismo peso se ven predecibles.
- **Perspectiva plana:** sin profundidad real. La sombra bajo el personaje es una **píldora**, nunca un óvalo ("los óvalos implican perspectiva").
- **Por qué este estilo [OFICIAL]:** velocidad, claridad y humor, con "el mínimo de detalles para transmitir la idea". Exageración y ritmo para que sea reconocible y gracioso. ([Shape language, 2020](https://blog.duolingo.com/shape-language-duolingos-art-style/))
- **2019, rediseño interno liderado por Greg Hartman:** formas geométricas y perspectiva plana para que fuera fácil de animar y de combinar, "sin importar quién lo dibujó". ([Design Week](https://www.designweek.co.uk/issues/2-6-january-2019/duolingo-owl-receives-makeover-as-app-becomes-more-gamified))

### Construcción de personajes [OFICIAL]
- Cabeza y cuerpo son 1–2 formas básicas cada uno. Repetir formas dentro del personaje le da cohesión.
- Pocas formas → silueta limpia, fácil de posar y de escalar en tamaño y en producción.
- El hombro (unión del brazo) siempre queda escondido detrás del torso.
- Duo es "básicamente un nugget de pollo con cara": pocas formas, ojos grandes. Sus 4 rasgos heredados por el elenco: construcción geométrica simple, cuerpo con alas, ojos grandes y expresivos, silueta distintiva con **pies separados del cuerpo**. ([Building character](https://blog.duolingo.com/building-character/))
- Se diseña primero la **silueta**, en pose de 3/4, con meses de iteración. ([Reshaping Duo](https://blog.duolingo.com/reshaping-duo/))

### Ojos y expresión [OFICIAL]
- Estilos de ojo: redondo, con gafas, almendra, lineal y de punto. **El ojo de punto es solo para personajes que siempre aparecen pequeños.**
- Las pupilas **nunca van centradas** ("se ve espeluznante"). Brillo: un circulito arriba a la izquierda de la pupila.
- El ojo lejano es un poco más pequeño (perspectiva).
- Palancas de emoción: agrandar o achicar la pupila, lágrima brillante, bajar el párpado.
- Con moderación: a Lily se le bajó la apertura de ojos porque se veía "extrañamente feliz".

### Color y sombreado
- Rellenos planos, **sin degradados**. Sombra = un tono más oscuro del mismo color superpuesto (p. ej. "Wing Overlay" #43C000 sobre el verde de Duo).
- **Sin contornos [NO VERIFICADO]:** no hay regla escrita, pero el arte se construye forma sobre forma, sin línea. Solo aparecen líneas donde dos formas del mismo color se superponen (versión 3D de Zari).
- Los colores de la marca salen de la mascota (Feather Green #58CC02). Duo solo va sobre fondos seleccionados porque su verde "vibra"; el elenco humano admite más fondos.

## 2. Personalidad en el diseño

- **Brief del elenco [OFICIAL]:** diverso, divertido, complementario a Duo; humanos modernos con personalidades muy peculiares. ~18 meses de iteración.
- **La forma comunica:** círculos = suave y amigable, pero también "barrigón o perezoso". Brazos cuadrados = fuerte pero rígido. (Rediseño de Vikram.)
- **Nunca en blanco:** "posar a un personaje le da personalidad"; usarlo quieto e inexpresivo lo vuelve "sin vida".
- **Biografías:** opuestos emparejados para generar tensión (Zari extrovertida ↔ Lily introvertida); nombres fáciles de pronunciar en cualquier idioma; cada bio cierra con un **dato curioso** (Lily solo escucha bandas que no conoces). Se definen pasiones, motivaciones, metas y obstáculos: "si desarrollas bien un personaje, puedes ponerlo en cualquier situación".
- **Voz de Duo dentro de la app:** fan número uno del usuario, insistente, emotivo, un poco torpe. Nunca amenazante, enojado ni cruel. El Duo "desquiciado" vive en redes, no en la app. En el widget, Duo se ve cada vez más angustiado cerca de la medianoche si no has hecho la lección.

## 3. Animación

- **En las lecciones [OFICIAL]:** los personajes aparecen en casi todos los ejercicios y "dicen" la frase. Cada uno tiene su propia animación de acierto; hay animaciones extra por rachas de aciertos y una de cierre al final de la lección.
- **Máquina de estados:** el cuerpo cambia de pose y, en paralelo y en otra capa, la boca. El reposo incluye asentir, parpadear y mover las cejas. Al final pasa a un estado que reacciona al acierto o al error. ([Visemes](https://blog.duolingo.com/world-character-visemes))
- **"Actor modular" (Lily en Video Call):** ojos, cejas y boca en capas separadas. 8 reposos de cabeza × 8 de cuerpo = 64 combinaciones, para que el loop nunca se sienta repetido. ([Rive](https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life))
- **"El timing lo es todo":** varias pasadas de animación en bruto antes de refinar ritmo y energía. En los hitos de racha, Duo se transforma en ave fénix de fuego. ([Streak milestones](https://blog.duolingo.com/streak-milestone-design-animation))
- **Principios de su equipo de motion [NO VERIFICADO]:** emoción, encontrar un ritmo (hay un pulso aunque no haya sonido), jugar con las expectativas, intención, ir al grano.
- **No publicado:** fps, duraciones, curvas, cadencia de parpadeo. Lo completamos con los principios de Disney (skill `motion-design`).

## 4. Herramientas: Lottie y Rive

- **Lottie [OFICIAL]:** Duolingo usa miles de Lottie para celebraciones y recompensas (p. ej. racha de 365 días). ([LottieFiles](https://lottiefiles.com/case-studies/duolingo))
- **Rive para los personajes [OFICIAL]:** lo eligieron por la máquina de estados. Animar labios a mano para 10 personajes × 40+ idiomas era imposible, así que la boca va por fonemas (20+ formas de boca por personaje) sincronizados con el audio. El archivo de Lily pesa menos de 1 MB.
- **Conviven:** no hubo migración total de Lottie a Rive.
- **Flujo:** boceto → timing en After Effects → reconstrucción en Rive → documentación de estados y entradas para ingeniería. Entrega semanal del .riv.

## 5. Qué aplicamos a Ceti

1. **Formas:** construir a Ceti con pocas formas redondeadas (rectángulo redondeado, círculo, triángulo redondeado); nada puntiagudo. Silueta reconocible en negro.
2. **Ojos:** pasar del ojo de punto a ojos grandes con pupila descentrada y brillo arriba a la izquierda. El de punto es para personajes pequeños.
3. **Color:** relleno plano y sombra con un tono más oscuro del mismo color. **Decisión abierta: contorno o sin contorno** (Duolingo no usa; el logo de Ceti sí). Ver pendiente.
4. **Pose:** nunca quieta ni inexpresiva; siempre en pose de 3/4 con actitud.
5. **Capas:** ojos, cejas, boca, aletas y cola en capas separadas con nombre, para animar por partes y poder migrar a Rive.
6. **Biografía:** pasiones, metas, obstáculos, opuesto con quien hace tensión y un dato curioso.

## Pendiente

- Decidir si Ceti mantiene el contorno del logo o pasa a forma sobre forma, como Duolingo.
- Decidir Lottie (lo que ya usa la app) o Rive (estados combinados, lip-sync). Rive no se puede producir en Linux sin el editor de escritorio.
