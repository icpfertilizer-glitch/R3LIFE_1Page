document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('menu-grid');
  const emptyState = document.getElementById('empty-state');

  async function loadMenus() {
    try {
      const res = await fetch('/api/menus');
      const menus = await res.json();

      if (menus.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
      }

      grid.style.display = 'grid';
      emptyState.style.display = 'none';
      grid.innerHTML = menus.map(menu => `
        <a class="menu-item" href="${escapeHtml(menu.url)}" target="_blank" rel="noopener noreferrer">
          <div class="menu-item-image">
            ${menu.image
              ? `<img src="${escapeHtml(menu.image)}" alt="${escapeHtml(menu.name)}" loading="lazy">`
              : `<svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>`
            }
          </div>
          <div class="menu-item-name">${escapeHtml(menu.name)}</div>
        </a>
      `).join('');
    } catch (err) {
      console.error('Failed to load menus:', err);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  loadMenus();
});
