// Historia del juego: todo el texto narrativo vive aquí para poder editarlo sin tocar la lógica.
//
// Argo es un robot explorador de la Ciudadela Aurora. Los mutantes robaron los cuatro
// Núcleos Madre que alimentan la ciudad y los esparcieron por cuatro mundos. Cada nivel
// es un capítulo: Argo debe recoger los fragmentos de núcleo y cruzar el portal.

export const GAME_TITLE = 'Núcleo Perdido'

export const PROLOGUE = {
  kicker: 'Prólogo',
  title: 'La Ciudadela se está apagando',
  paragraphs: [
    'Los mutantes irrumpieron en la Ciudadela Aurora y se llevaron los cuatro Núcleos Madre, la energía que mantiene viva a toda la ciudad.',
    'Tú eres Argo, el último robot explorador en pie. Cada núcleo se rompió en fragmentos y quedó escondido en un mundo distinto.',
    'Recupera todos los fragmentos, esquiva a los mutantes y cruza el portal de cada mundo para llegar al siguiente.',
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
    text: 'El primer núcleo cayó entre las ruinas de una fortaleza. Los mutantes te ven solo frente a ellos, te oyen según el ruido que hagas (correr se oye de lejos) y se avisan entre sí. Si te pierden de vista, te buscan donde te vieron por última vez.',
    objective: 'Recupera los fragmentos de núcleo',
  },
  3: {
    kicker: 'Capítulo 2 de 4',
    title: 'La Noche Encantada',
    text: 'Una aldea sin luz, atrapada en una noche eterna. El segundo núcleo late en algún lugar entre las casas. Hay más mutantes que antes, y la oscuridad les favorece.',
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
    text: 'En lo alto de la montaña yace el último Núcleo Madre. Es el mundo más hostil. Si lo recuperas, la Ciudadela volverá a encenderse.',
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
  text: 'Los cuatro Núcleos Madre están de nuevo en su sitio. Las luces de Aurora regresan, una a una. Argo lo logró.',
}

export const GAME_OVER = {
  title: 'Los mutantes te atraparon',
  text: 'Los fragmentos que llevabas se perdieron, pero el núcleo sigue ahí fuera. Inténtalo de nuevo.',
}
