const deck = document.getElementById('webslides');
const reading = new URLSearchParams(location.search).has('notes');
document.body.classList.toggle('notes-mode', reading);
for (const diagram of deck.querySelectorAll('.diagram')) {
  const wrapper = document.createElement('div');
  wrapper.className = 'diagram-wrap';
  diagram.replaceWith(wrapper);
  wrapper.append(diagram);
}
if (!reading) {
  window.ws = new WebSlides({ loop: false, navigateOnScroll: false });
  function fit() {
    if (innerWidth <= 800) return;
    const content = deck.querySelector('section.current > .slide-content');
    if (!content) return;
    const scale = Math.min((innerWidth - 80) / 1180, (innerHeight - 160) / content.offsetHeight, 1.4);
    content.style.setProperty('--slide-scale', String(scale));
  }
  deck.addEventListener('ws:slide-change', fit);
  window.addEventListener('resize', fit);
  document.fonts.ready.then(fit);
  fit();
}
