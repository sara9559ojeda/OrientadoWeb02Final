import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import ThemeToggle from '../ThemeToggle';
import '../Auth.css';
import './LandingPage.css';

const LandingScene = lazy(() => import('./LandingScene'));

const WORLDS = [
  { name: 'Murallas Antiguas', mood: 'Donde comienza la búsqueda', text: 'Entre ruinas y fortalezas duerme el primer núcleo. Aprende a escuchar el silencio antes de dar el siguiente paso.', detail: 'Ruinas · Luz del día', symbol: '◇' },
  { name: 'La Noche Encantada', mood: 'La oscuridad también escucha', text: 'Una aldea atrapada en una noche eterna. Sigue el brillo de los fragmentos y encuentra un camino entre las sombras.', detail: 'Aldea · Noche eterna', symbol: '☾' },
  { name: 'Bosque de Ajedrez', mood: 'Cada movimiento importa', text: 'Árboles, piezas gigantes y guardianes que esperan. Observa el tablero: a veces, avanzar significa tomar otro camino.', detail: 'Bosque · Estrategia', symbol: '♧' },
  { name: 'Cumbre Helada', mood: 'La última luz está más arriba', text: 'El frío guarda el último Núcleo Madre. Has llegado lejos. Un último mundo separa a la Ciudadela de volver a brillar.', detail: 'Montaña · Último núcleo', symbol: '✳' },
];

function Brand() {
  return <span className="auth-brand"><svg className="auth-brand-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z" /><path d="M3.5 7 12 11.5 20.5 7M12 11.5v10" /></svg><span className="auth-brand-name">Juego 3D</span></span>;
}

export default function LandingPage({ onEnter }) {
  const pageRef = useRef(null);
  const journeyRef = useRef(null);
  const chapterRefs = useRef([]);
  const motionRef = useRef({ progress: 0, world: 0, pointerX: 0, pointerY: 0, active: true });
  const [activeWorld, setActiveWorld] = useState(0);
  const [sceneAvailable, setSceneAvailable] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    const page = pageRef.current;
    const journey = journeyRef.current;
    const sections = [...page.querySelectorAll('[data-reveal]')];
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { root: page, threshold: 0.12 });
    sections.forEach(section => revealObserver.observe(section));

    let frame = 0;
    const updateScroll = () => {
      frame = 0;
      const viewport = page.clientHeight;
      const bounds = journey.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, -bounds.top / Math.max(1, journey.offsetHeight - viewport)));
      motionRef.current.progress = progress;
      motionRef.current.active = bounds.bottom > 0 && bounds.top < viewport;
      let current = 0;
      chapterRefs.current.forEach((chapter, index) => {
        if (chapter.getBoundingClientRect().top < viewport * 0.65) current = index;
      });
      motionRef.current.world = current;
      setActiveWorld(current);
      page.style.setProperty('--landing-progress', String(page.scrollTop / Math.max(1, page.scrollHeight - viewport)));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(updateScroll); };
    const onPointer = event => {
      if (event.pointerType === 'touch') return;
      motionRef.current.pointerX = event.clientX / page.clientWidth * 2 - 1;
      motionRef.current.pointerY = event.clientY / page.clientHeight * 2 - 1;
    };
    const resetPointer = () => {
      motionRef.current.pointerX = 0;
      motionRef.current.pointerY = 0;
    };
    page.addEventListener('scroll', onScroll, { passive: true });
    page.addEventListener('pointermove', onPointer, { passive: true });
    page.addEventListener('pointerleave', resetPointer);
    window.addEventListener('resize', onScroll);
    updateScroll();
    return () => {
      cancelAnimationFrame(frame);
      revealObserver.disconnect();
      page.removeEventListener('scroll', onScroll);
      page.removeEventListener('pointermove', onPointer);
      page.removeEventListener('pointerleave', resetPointer);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const scrollTo = id => {
    const target = pageRef.current.querySelector(`#${id}`);
    target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  };

  return (
    <div className="landing-page" ref={pageRef}>
      <a className="landing-skip" href="#landing-story">Saltar al contenido</a>
      <div className="landing-scroll-progress" aria-hidden="true" />
      <header className="landing-header">
        <button className="landing-brand-button" onClick={() => scrollTo('landing-top')} aria-label="Juego 3D, volver al inicio"><Brand /></button>
        <nav className="landing-nav" aria-label="Navegación principal">
          <button onClick={() => scrollTo('landing-story')}>La historia</button>
          <button onClick={() => scrollTo('landing-worlds')}>Los mundos</button>
          <button onClick={() => scrollTo('landing-how')}>Cómo jugar</button>
        </nav>
        <div className="landing-header-actions"><ThemeToggle /><button className="landing-login" onClick={onEnter}>Iniciar sesión <span aria-hidden="true">↗</span></button></div>
      </header>

      <main>
        <div className="landing-journey" ref={journeyRef}>
          <div className={`landing-visual ${sceneReady ? 'is-ready' : ''}`} aria-hidden="true">
            <div className="landing-scene-frame">
              <div className="landing-orbit-fallback"><span /><span /><i /></div>
              {sceneAvailable && <Suspense fallback={null}><LandingScene motionRef={motionRef} onReady={() => setSceneReady(true)} onUnavailable={() => { setSceneAvailable(false); setSceneReady(false); }} /></Suspense>}
              <div className="landing-object-label"><span className="landing-status-dot" /> NÚCLEO MADRE <span>0{activeWorld + 1} / 04</span></div>
              <span className="landing-orbit-note">FRAGMENTOS DE UNA MISMA LUZ</span>
            </div>
          </div>

          <section className="landing-hero landing-container" id="landing-top" aria-labelledby="landing-title">
            <div className="landing-hero-copy">
              <p className="landing-eyebrow"><span /> UNA AVENTURA EN TRES DIMENSIONES</p>
              <h1 id="landing-title">La luz de Aurora<br />está en <em>tus manos.</em></h1>
              <p className="landing-lead">Cuatro mundos. Una ciudad que se apaga.<br />Y tú, la última esperanza de volver a encenderla.</p>
              <div className="landing-hero-actions"><button className="landing-button landing-button-primary" onClick={onEnter}>Comenzar la aventura <span aria-hidden="true">↗</span></button><button className="landing-text-button" onClick={() => scrollTo('landing-worlds')}>Explorar los mundos <span aria-hidden="true">↓</span></button></div>
              <p className="landing-small-note">Directo en tu navegador. El viaje empieza aquí.</p>
            </div>
            <div className="landing-hero-bottom"><button className="landing-scroll-cue" onClick={() => scrollTo('landing-story')}><span aria-hidden="true">↓</span> DESLIZA PARA DESCUBRIR</button><span>EXPLORA. ESCUCHA. RECUPERA.</span></div>
          </section>

          <section className="landing-story landing-container" id="landing-story" aria-labelledby="landing-story-title">
            <div data-reveal><p className="landing-eyebrow">EL COMIENZO DE TODO</p><h2 id="landing-story-title">Una ciudad sin luz.<br /><span>Una guardiana que<br />no se rinde.</span></h2><p>Los mutantes robaron los Núcleos Madre de la Ciudadela Aurora. Sus fragmentos quedaron dispersos en cuatro mundos.</p><p>Eres Alba. Sigue la voz de Aurora, recupera cada fragmento y devuelve la luz a casa.</p><div className="landing-story-signature"><span aria-hidden="true">✧</span><span>«Alba… eres mi última esperanza.»<small>AURORA, LA VOZ DE LA CIUDADELA</small></span></div></div>
          </section>

          <section className="landing-worlds landing-container" id="landing-worlds" aria-labelledby="landing-worlds-title">
            <div className="landing-worlds-intro" data-reveal><p className="landing-eyebrow">EL MAPA DE TU AVENTURA</p><h2 id="landing-worlds-title">Cuatro mundos.<br /><em>Un mismo destino.</em></h2><p>El núcleo se transforma con tu recorrido.<br />Sigue bajando para descubrir cada capítulo.</p></div>
            <nav className="landing-world-tabs" aria-label="Explorar capítulos">{WORLDS.map((world, index) => <button key={world.name} className={activeWorld === index ? 'is-active' : ''} onClick={() => scrollTo(`landing-world-${index}`)} aria-label={`Explorar ${world.name}`} aria-current={activeWorld === index ? 'step' : undefined}>0{index + 1}<span>{world.name}</span></button>)}</nav>
            {WORLDS.map((world, index) => <article className="landing-chapter" id={`landing-world-${index}`} key={world.name} ref={element => { chapterRefs.current[index] = element; }} aria-labelledby={`landing-chapter-title-${index}`}><div className="landing-chapter-copy" data-reveal><div className="landing-chapter-index"><span>CAPÍTULO 0{index + 1}</span><span aria-hidden="true">{world.symbol}</span></div><h3 id={`landing-chapter-title-${index}`}>{world.name}</h3><p className="landing-chapter-mood">{world.mood}</p><p>{world.text}</p><span className="landing-chapter-detail">{world.detail}</span></div></article>)}
          </section>
        </div>

        <section className="landing-how landing-container" id="landing-how" aria-labelledby="landing-how-title">
          <div className="landing-section-heading" data-reveal><p className="landing-eyebrow">MENOS PRISA. MÁS INSTINTO.</p><h2 id="landing-how-title">No basta con correr.<br /><em>Hay que saber escuchar.</em></h2><p>Los mutantes ven, oyen y se avisan entre sí.<br />Tu mejor herramienta es la forma en que te mueves.</p></div>
          <div className="landing-mechanics">
            <article data-reveal><div className="landing-key-art" aria-hidden="true"><kbd>↑</kbd><div><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></div></div><span className="landing-step">01 / EXPLORA</span><h3>Encuentra tu camino.</h3><p>Usa las flechas para moverte. Cambia de perspectiva con la tecla 5 y descubre lo que esconde cada mundo.</p></article>
            <article data-reveal><div className="landing-sound-art" aria-hidden="true">{[14, 26, 42, 58, 34, 50, 24, 14].map((height, index) => <i key={index} style={{ '--bar-height': `${height}px`, '--bar-delay': `${index * 0.12}s` }} />)}</div><span className="landing-step">02 / ESCUCHA</span><h3>El silencio es tu aliado.</h3><p>Shift para correr, espacio para saltar. Pero ten cuidado: cuanto más ruido haces, más fácil es encontrarte.</p></article>
            <article data-reveal><div className="landing-fragment-art" aria-hidden="true"><span>◇</span><span>◇</span><span>◇</span></div><span className="landing-step">03 / RECUPERA</span><h3>Devuelve la luz.</h3><p>Reúne todos los fragmentos de un núcleo. Cuando el portal aparezca, crúzalo y continúa la búsqueda.</p></article>
          </div>
        </section>

        <section className="landing-finale" aria-labelledby="landing-finale-title"><div className="landing-container" data-reveal><span className="landing-finale-star" aria-hidden="true">✧</span><p className="landing-eyebrow">LA CIUDADELA TE ESPERA</p><h2 id="landing-finale-title">Las grandes historias<br />empiezan con<br /><em>un primer paso.</em></h2><button className="landing-button landing-button-primary" onClick={onEnter}>Entrar a Aurora <span aria-hidden="true">↗</span></button><p>Inicia sesión y conviértete en su próxima guardiana.</p></div></section>
      </main>

      <footer className="landing-footer landing-container"><Brand /><p>Programación Multimedia e Ingeniería Web</p><button className="landing-text-button" onClick={() => scrollTo('landing-top')}>Volver arriba <span aria-hidden="true">↑</span></button></footer>
    </div>
  );
}
