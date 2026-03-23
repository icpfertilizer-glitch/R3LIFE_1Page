document.addEventListener('DOMContentLoaded', () => {
  const mainContent = document.getElementById('main-content');
  const emptyState = document.getElementById('empty-state');

  async function loadMenus() {
    try {
      const [menusRes, catsRes] = await Promise.all([
        fetch('/api/menus'),
        fetch('/api/categories')
      ]);
      const menus = await menusRes.json();
      const categories = await catsRes.json();

      if (menus.length === 0) {
        emptyState.style.display = 'block';
        return;
      }

      emptyState.style.display = 'none';

      // Group menus by category
      const grouped = {};
      const uncategorized = [];

      menus.forEach(menu => {
        if (menu.category_id) {
          if (!grouped[menu.category_id]) grouped[menu.category_id] = [];
          grouped[menu.category_id].push(menu);
        } else {
          uncategorized.push(menu);
        }
      });

      let html = '';

      // Render each category group (in category sort order)
      categories.forEach(cat => {
        const items = grouped[cat.id];
        if (!items || items.length === 0) return;
        html += renderCategorySection(cat.name, items);
      });

      // Render uncategorized menus
      if (uncategorized.length > 0) {
        const label = categories.length > 0 ? 'อื่นๆ' : '';
        html += renderCategorySection(label, uncategorized);
      }

      // Insert before empty-state
      const existing = mainContent.querySelectorAll('.category-section');
      existing.forEach(el => el.remove());
      emptyState.insertAdjacentHTML('beforebegin', html);
    } catch (err) {
      console.error('Failed to load menus:', err);
    }
  }

  function renderCategorySection(title, items) {
    return `
      <section class="category-section">
        ${title ? `<h2 class="category-title">${escapeHtml(title)}</h2>` : ''}
        <div class="menu-grid">
          ${items.map(menu => `
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
          `).join('')}
        </div>
      </section>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  loadMenus();
});
