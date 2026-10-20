/**
 * The title of the spine under the pointer (or the keyboard), written the right way up under the
 * shelf, for readers who find sideways titles hard. Used by the books page's shelf and the home
 * page's. The line is aria-hidden: each spine already carries its title as its label.
 */
export function spineName(shelf: Element | null, line: HTMLElement | null) {
  if (!shelf || !line) return;
  const show = (spine: HTMLElement) => {
    const ar = spine.dataset.lang === 'ar';
    line.textContent = spine.getAttribute('aria-label') ?? '';
    line.lang = spine.dataset.lang ?? 'en';
    line.dir = ar ? 'rtl' : 'ltr';
    line.classList.toggle('is-ar', ar);
    line.classList.add('is-on');
  };
  const hide = () => line.classList.remove('is-on');

  shelf.querySelectorAll<HTMLElement>('.spine').forEach((spine) => {
    spine.addEventListener('pointerenter', () => show(spine));
    spine.addEventListener('focus', () => show(spine));
    spine.addEventListener('blur', hide);
  });
  shelf.addEventListener('pointerleave', hide);
}
