// Historia del juego: todo el texto narrativo vive aquí para poder editarlo sin tocar la lógica.
//
// Alba es una joven guardiana de la Ciudadela Aurora. Los mutantes robaron los cuatro
// Núcleos Madre, cristales de luz que alimentan la ciudad, y los esparcieron por cuatro
// mundos. Cada nivel es un capítulo: Alba debe recoger los fragmentos de núcleo y cruzar
// el portal.

export const GAME_TITLE = 'Núcleo Perdido'

export const PROLOGUE = {
  kicker: 'Prólogo',
  title: 'La Ciudadela se está apagando',
  paragraphs: [
    'Los mutantes irrumpieron en la Ciudadela Aurora y se llevaron los cuatro Núcleos Madre, los cristales de luz que mantienen viva a toda la ciudad.',
    'Tú eres Alba, la guardiana más joven de Aurora y la única que escapó. Cada núcleo se rompió en fragmentos y quedó escondido en un mundo distinto.',
    'Recupéralos todos, esquiva a los mutantes y cruza el portal de cada mundo para llegar al siguiente. Aurora cuenta contigo.',
  ],
}

export const CONTROLS = [
  { keys: ['↑', '↓'], label: 'Avanzar y retroceder' },
  { keys: ['←', '→'], label: 'Girar' },
  { keys: ['Shift'], label: 'Correr' },
  { keys: ['Espacio'], label: 'Saltar' },
  { keys: ['5'], label: 'Cambiar de cámara' },
  { keys: ['I'], label: 'Ver cómo piensan los mutantes' },
]

export const CHAPTERS = {
  2: {
    kicker: 'Capítulo 1 de 4',
    title: 'Murallas Antiguas',
    text: 'Tu camino empieza en las ruinas de una fortaleza, donde cayó el primer núcleo. Los mutantes te ven solo frente a ellos, te oyen según el ruido que hagas (correr se oye de lejos) y se avisan entre sí. Si te pierden de vista, te buscan donde te vieron por última vez.',
    objective: 'Recupera los fragmentos de núcleo',
  },
  3: {
    kicker: 'Capítulo 2 de 4',
    title: 'La Noche Encantada',
    text: 'Una aldea sin luz, atrapada en una noche eterna. El segundo núcleo late en algún lugar entre las casas. Alba, hay más mutantes que antes, y la oscuridad les favorece.',
    objective: 'Recupera los fragmentos de núcleo',
  },
  4: {
    kicker: 'Capítulo 3 de 4',
    title: 'Bosque de Ajedrez',
    text: 'Un bosque de piezas gigantes donde cada paso cuenta. El tercer núcleo está custodiado por un tablero que nadie ha logrado cruzar.',
    objective: 'Recupera los fragmentos de núcleo',
  },
  5: {
    kicker: 'Capítulo 4 de 4',
    title: 'Cumbre Helada',
    text: 'En lo alto de la montaña yace el último Núcleo Madre. Es el mundo más hostil, pero ya llegaste hasta aquí. Si lo recuperas, la Ciudadela volverá a encenderse.',
    objective: 'Recupera los fragmentos de núcleo',
  },
}

export const chapterFor = (level) =>
  CHAPTERS[level] || { kicker: `Nivel ${level}`, title: `Nivel ${level}`, text: '', objective: 'Recupera los fragmentos de núcleo' }

export const OBJECTIVES = {
  collect: 'Recupera los fragmentos de núcleo',
  portal: 'Núcleo completo. ¡Corre al portal!',
}

export const EPILOGUE = {
  kicker: 'Epílogo',
  title: 'La Ciudadela vuelve a encenderse',
  text: 'Los cuatro Núcleos Madre están de nuevo en su sitio. Las luces de Aurora regresan, una a una. Alba, la guardiana más joven, salvó la Ciudadela.',
}

// ── Voz de Aurora ───────────────────────────────────────────────────────────
// Aurora es el espíritu de la Ciudadela: la inteligencia que la gobierna y que sigue viva
// aunque los núcleos se hayan apagado. Solo habla en momentos clave (no narra todo el rato)
// y, además de contar la historia, enseña a Alba a sobrevivir a los mutantes.
// Cada entrada es una frase o una lista de variantes (se elige una al azar).
export const NARRATOR_NAME = 'Aurora'

export const NARRATION = {
  prologue:
    'Alba… soy Aurora, la voz de la Ciudadela. Los mutantes se llevaron los Núcleos Madre y mi luz se apaga. Eres mi última esperanza.',

  chapter2:
    'Estas ruinas guardaron el primer núcleo. Escucha bien: los mutantes te oyen cuando corres. Avanza con cuidado.',
  chapter3:
    'La aldea está a oscuras, Alba, y hay más mutantes que antes. No dejes que te rodeen.',
  chapter4:
    'Algunos mutantes custodian los fragmentos. Obsérvalos desde lejos antes de acercarte.',
  chapter5:
    'El último núcleo, Alba. Ya has llegado muy lejos. Aurora cree en ti.',

  firstFragment:
    'Lo sentí. Un fragmento de núcleo vuelve a la luz. Sigue así.',
  halfway:
    'Ya tenemos la mitad. La Ciudadela vuelve a respirar.',
  lastFragment:
    'Solo falta uno, Alba. Ya casi lo tienes.',
  coreComplete:
    'El núcleo está completo. Corre al portal antes de que te encuentren.',

  spotted:
    '¡Te han visto! Rompe su línea de visión tras un edificio y deja de correr: así dejarán de oírte.',
  gameOver: [
    'No te rindas, Alba. Aurora todavía te necesita.',
    'Respira. Ahora ya sabes cómo piensan. Inténtalo otra vez.',
    'Aún queda luz. Levántate y vuelve a intentarlo.',
  ],
  epilogue:
    'Lo lograste, Alba. Aurora vuelve a brillar, y es gracias a ti.',

  // Al reactivar la voz desde el menú
  voiceOn:
    'Aquí estoy, Alba.',
}

export const GAME_OVER = {
  title: 'Los mutantes te atraparon',
  text: 'Los fragmentos que llevabas se perdieron, pero el núcleo sigue ahí fuera. Inténtalo de nuevo.',
}
