// Builds the tour <section>s from chapters.json. Cards are real HTML so they stay readable,
// selectable and screen-reader friendly; the active one is chosen from scroll progress.
export function buildChapters(container, chapters) {
  container.innerHTML = '';
  const cards = chapters.map((ch, i) => {
    const sec = document.createElement('section');
    sec.className = `chapter chapter--${ch.kind || 'stop'}`;
    sec.id = `chapter-${ch.id}`;
    sec.setAttribute('aria-labelledby', `chapter-title-${ch.id}`);
    const isHero = ch.kind === 'hero', isOutro = ch.kind === 'outro';
    sec.innerHTML = `
      <article class="card">
        <p class="card-kicker">${isHero || isOutro ? '' : `<span class="card-num">${String(i).padStart(2, '0')}</span>`}${ch.kicker}</p>
        <${isHero ? 'h1' : 'h2'} id="chapter-title-${ch.id}" class="card-title">${ch.title}</${isHero ? 'h1' : 'h2'}>
        <p class="card-body">${ch.body}</p>
        ${isHero ? '<p class="card-cta"><span class="scroll-hint" aria-hidden="true">Scroll to begin ↓</span><button type="button" class="btn" data-action="explore">Skip to the map</button></p>' : ''}
        ${!isHero && !isOutro && ch.locationIds.length ? `<button type="button" class="btn btn-ghost btn-small" data-action="focus" data-loc="${ch.locationIds[0]}">Open on map →</button>` : ''}
        ${isOutro ? '<p class="card-cta"><button type="button" class="btn" data-action="explore">Explore the map</button></p>' : ''}
      </article>`;
    container.appendChild(sec);
    return sec.querySelector('.card');
  });

  let active = -1;
  return {
    setActive(i) {
      if (i === active) return false;
      cards[active]?.classList.remove('is-active');
      cards[i]?.classList.add('is-active');
      active = i;
      return true;
    },
    get active() { return active; },
  };
}
