// Arquetipos de enemigo: cada modelo tiene su propia "personalidad" de IA y su propia marcha.
//
// strideSpeed = velocidad (m/s) a la que avanza el cuerpo cuando el clip de animación se reproduce a 1×.
//   Así la animación se acelera o frena según lo que de verdad se mueve el enemigo, y los pies no
//   "patinan" (antes todos reproducían el clip a 1× aunque avanzaran muy poco).
// patrol / investigate / chase / flank = velocidades por estado (m/s).
// fov = campo de visión en grados; sight = alcance de la vista; proximity = distancia a la que siempre
//   te nota (aunque estés a su espalda); hearing = multiplicador de lo bien que oye el ruido del jugador.

export const ARCHETYPES = {
  enemyFastRun: {
    id: 'hunter',
    label: 'Cazador',
    gait: 'run',
    strideSpeed: 18,
    patrol: 9, investigate: 12, chase: 15, flank: 15,
    fov: 100, sight: 140, proximity: 10, hearing: 1.0,
    patrolRadius: 26,
    shouts: true, // da la alarma al verte
    description: 'Veloz. Da la alarma al verte.',
  },
  enemyMutantWalking: {
    id: 'brute',
    label: 'Bruto',
    gait: 'walk',
    strideSpeed: 3.6,
    patrol: 2.4, investigate: 4.2, chase: 5.6, flank: 5.6,
    fov: 90, sight: 90, proximity: 12, hearing: 1.6,
    patrolRadius: 10,
    shouts: false,
    description: 'Lento pero oye muy bien.',
  },
  enemyWalk: {
    id: 'stalker',
    label: 'Acechador',
    gait: 'walk',
    strideSpeed: 4.9,
    patrol: 3.2, investigate: 5.5, chase: 7.4, flank: 7.4,
    fov: 120, sight: 130, proximity: 10, hearing: 1.0,
    patrolRadius: 18,
    shouts: false,
    flanker: true, // prefiere cortarte el paso
    description: 'Intenta cortarte el paso.',
  },
  enemyWalking: {
    id: 'wanderer',
    label: 'Errante',
    gait: 'walk',
    strideSpeed: 3.0,
    patrol: 2.2, investigate: 4.0, chase: 4.8, flank: 4.8,
    fov: 140, sight: 100, proximity: 10, hearing: 1.2,
    patrolRadius: 34,
    shouts: false,
    description: 'Recorre zonas amplias.',
  },
  enemyWheelbarrowWalk: {
    id: 'guard',
    label: 'Guardián',
    gait: 'walk',
    strideSpeed: 4.0,
    patrol: 2.6, investigate: 4.4, chase: 6.2, flank: 6.2,
    fov: 110, sight: 110, proximity: 10, hearing: 1.2,
    patrolRadius: 12,
    shouts: true,
    guardsFragment: true, // patrulla alrededor de un fragmento de núcleo
    description: 'Protege un fragmento.',
  },
}

// Arquetipo por defecto si llega un modelo desconocido
export const DEFAULT_ARCHETYPE = ARCHETYPES.enemyWalk

export const archetypeFor = (modelName) => ARCHETYPES[modelName] || DEFAULT_ARCHETYPE

// Qué tipos aparecen en cada nivel (el primero del nivel 2 es siempre uno lento, para aprender las reglas)
export const LEVEL_ROSTER = {
  2: ['enemyMutantWalking', 'enemyWheelbarrowWalk', 'enemyWalk'],
  3: ['enemyWalk', 'enemyWheelbarrowWalk', 'enemyMutantWalking', 'enemyWalking', 'enemyFastRun'],
  4: ['enemyWalk', 'enemyWheelbarrowWalk', 'enemyFastRun', 'enemyWalking', 'enemyMutantWalking'],
  5: ['enemyFastRun', 'enemyWalk', 'enemyWheelbarrowWalk', 'enemyFastRun', 'enemyMutantWalking'],
}
