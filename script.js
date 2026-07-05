// ---------- Data ----------
// project: { id, name, deadline, team:[names], status, priority: 'high'|'medium'|'low',
//            subtasks: [{id, text, done}] }

let projects = [];
let editingId = null;           // null = creating new, otherwise editing this project id
let draftSubtasks = [];         // subtasks being built in the modal before save
let searchTerm = '';
let priorityFilter = 'all';

try {
  const saved = localStorage.getItem('basecamp-board-projects');
  if (saved) projects = JSON.parse(saved);
} catch (e) {
  console.warn('Could not load saved projects, starting fresh.', e);
}

if (projects.length === 0) {
  const today = new Date();
  const inDays = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  };
  projects = [
    {
      id: crypto.randomUUID(), name: 'Website Redesign', deadline: inDays(14),
      team: ['Asha', 'Ravi'], status: 'todo', priority: 'medium',
      subtasks: [
        { id: crypto.randomUUID(), text: 'Wireframes', done: true },
        { id: crypto.randomUUID(), text: 'Homepage build', done: false },
        { id: crypto.randomUUID(), text: 'QA pass', done: false }
      ]
    },
    {
      id: crypto.randomUUID(), name: 'Mobile App Beta', deadline: inDays(3),
      team: ['Meera'], status: 'progress', priority: 'high',
      subtasks: [
        { id: crypto.randomUUID(), text: 'Fix login bug', done: true },
        { id: crypto.randomUUID(), text: 'Push to TestFlight', done: false }
      ]
    },
    {
      id: crypto.randomUUID(), name: 'Client Onboarding Docs', deadline: inDays(-2),
      team: ['Asha', 'Karan'], status: 'progress', priority: 'low', subtasks: []
    },
    {
      id: crypto.randomUUID(), name: 'Q2 Marketing Plan', deadline: inDays(30),
      team: ['Ravi'], status: 'done', priority: 'medium',
      subtasks: [{ id: crypto.randomUUID(), text: 'Final review', done: true }]
    },
  ];
}

function saveProjects() {
  try {
    localStorage.setItem('basecamp-board-projects', JSON.stringify(projects));
  } catch (e) {
    console.warn('Could not save projects (storage unavailable in this preview).', e);
  }
}

// ---------- Helpers ----------
function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function deadlineChip(dateStr) {
  const diff = daysUntil(dateStr);
  let cls = 'deadline-safe';
  let label = `${diff}d left`;
  if (diff < 0) {
    cls = 'deadline-late';
    label = `${Math.abs(diff)}d overdue`;
  } else if (diff <= 7) {
    cls = 'deadline-soon';
  }
  return `<span class="deadline-chip ${cls}">${label}</span>`;
}

function initials(name) {
  return name.trim().split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function matchesFilters(p) {
  const term = searchTerm.trim().toLowerCase();
  const nameMatch = !term ||
    p.name.toLowerCase().includes(term) ||
    p.team.some(t => t.toLowerCase().includes(term));
  const priorityMatch = priorityFilter === 'all' || p.priority === priorityFilter;
  return nameMatch && priorityMatch;
}

// ---------- Rendering ----------
const statuses = ['todo', 'progress', 'done'];

function render() {
  statuses.forEach(status => {
    const list = document.getElementById(`list-${status}`);
    const items = projects.filter(p => p.status === status && matchesFilters(p));
    document.getElementById(`count-${status}`).textContent = items.length;

    if (items.length === 0) {
      list.innerHTML = `<p class="empty-state">Nothing here.</p>`;
      return;
    }

    list.innerHTML = items.map(p => renderCard(p)).join('');
  });
}

function renderCard(p) {
  const total = p.subtasks.length;
  const done = p.subtasks.filter(s => s.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const subtaskHtml = total ? `
    <ul class="subtask-list">
      ${p.subtasks.map(s => `
        <li class="${s.done ? 'done' : ''}">
          <input type="checkbox" data-project="${p.id}" data-subtask="${s.id}" class="subtask-check" ${s.done ? 'checked' : ''}>
          <span>${escapeHtml(s.text)}</span>
        </li>
      `).join('')}
    </ul>
  ` : '';

  return `
    <div class="card" draggable="true" data-id="${p.id}">
      <div class="card-top">
        <span class="priority-badge priority-${p.priority}">${p.priority}</span>
        <div class="card-icons">
          <button class="icon-btn edit-btn" data-id="${p.id}" title="Edit">✎</button>
          <button class="icon-btn delete-btn" data-id="${p.id}" title="Delete">🗑</button>
        </div>
      </div>
      <p class="card-title">${escapeHtml(p.name)}</p>
      ${total ? `
        <div class="progress-wrap">
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <span class="progress-label">${done}/${total}</span>
        </div>
      ` : ''}
      ${subtaskHtml}
      <div class="card-footer">
        <div class="team-chips">
          ${p.team.map(name => `<span class="avatar" title="${escapeHtml(name)}">${initials(name)}</span>`).join('')}
        </div>
        ${deadlineChip(p.deadline)}
      </div>
      <div class="card-move">
        ${moveButtons(p)}
      </div>
    </div>
  `;
}

function moveButtons(project) {
  const order = ['todo', 'progress', 'done'];
  const labels = { todo: '← To Do', progress: '↔ In Progress', done: 'Done →' };
  return order
    .filter(s => s !== project.status)
    .map(s => `<button class="move-btn" data-id="${project.id}" data-status="${s}">${labels[s]}</button>`)
    .join('');
}

// ---------- Board click events (move / delete / edit / subtask check) ----------
document.getElementById('board').addEventListener('click', (e) => {
  const moveBtn = e.target.closest('.move-btn');
  if (moveBtn) {
    const project = projects.find(p => p.id === moveBtn.dataset.id);
    if (project) { project.status = moveBtn.dataset.status; saveProjects(); render(); }
    return;
  }

  const deleteBtn = e.target.closest('.delete-btn');
  if (deleteBtn) {
    if (confirm('Delete this project?')) {
      projects = projects.filter(p => p.id !== deleteBtn.dataset.id);
      saveProjects();
      render();
    }
    return;
  }

  const editBtn = e.target.closest('.edit-btn');
  if (editBtn) {
    openEditModal(editBtn.dataset.id);
    return;
  }
});

document.getElementById('board').addEventListener('change', (e) => {
  if (e.target.classList.contains('subtask-check')) {
    const project = projects.find(p => p.id === e.target.dataset.project);
    const subtask = project?.subtasks.find(s => s.id === e.target.dataset.subtask);
    if (subtask) {
      subtask.done = e.target.checked;
      saveProjects();
      render();
    }
  }
});

// ---------- Drag and drop ----------
document.getElementById('board').addEventListener('dragstart', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  card.classList.add('dragging');
  e.dataTransfer.setData('text/plain', card.dataset.id);
});

document.getElementById('board').addEventListener('dragend', (e) => {
  const card = e.target.closest('.card');
  if (card) card.classList.remove('dragging');
});

document.querySelectorAll('.column').forEach(column => {
  column.addEventListener('dragover', (e) => {
    e.preventDefault();
    column.classList.add('drag-over');
  });
  column.addEventListener('dragleave', () => column.classList.remove('drag-over'));
  column.addEventListener('drop', (e) => {
    e.preventDefault();
    column.classList.remove('drag-over');
    const id = e.dataTransfer.getData('text/plain');
    const project = projects.find(p => p.id === id);
    if (project) {
      project.status = column.dataset.status;
      saveProjects();
      render();
    }
  });
});

// ---------- Search & filter ----------
document.getElementById('searchInput').addEventListener('input', (e) => {
  searchTerm = e.target.value;
  render();
});
document.getElementById('priorityFilter').addEventListener('change', (e) => {
  priorityFilter = e.target.value;
  render();
});

// ---------- Theme toggle ----------
const themeToggle = document.getElementById('themeToggle');
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'light' ? '☀️' : '🌙';
}
let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('basecamp-board-theme') || 'dark'; } catch (e) {}
applyTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  try { localStorage.setItem('basecamp-board-theme', next); } catch (e) {}
});

// ---------- Modal: open / close ----------
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const submitBtn = document.getElementById('submitBtn');
const form = document.getElementById('projectForm');

function resetForm() {
  form.reset();
  draftSubtasks = [];
  renderSubtaskEditor();
  document.getElementById('priority').value = 'medium';
}

function openCreateModal() {
  editingId = null;
  resetForm();
  modalTitle.textContent = 'New Project';
  submitBtn.textContent = 'Add Project';
  modalOverlay.classList.add('open');
}

function openEditModal(id) {
  const p = projects.find(pr => pr.id === id);
  if (!p) return;
  editingId = id;
  modalTitle.textContent = 'Edit Project';
  submitBtn.textContent = 'Save Changes';
  document.getElementById('name').value = p.name;
  document.getElementById('deadline').value = p.deadline;
  document.getElementById('team').value = p.team.join(', ');
  document.getElementById('priority').value = p.priority;
  draftSubtasks = p.subtasks.map(s => ({ ...s }));
  renderSubtaskEditor();
  modalOverlay.classList.add('open');
}

document.getElementById('openModalBtn').addEventListener('click', openCreateModal);
document.getElementById('cancelBtn').addEventListener('click', () => modalOverlay.classList.remove('open'));
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.remove('open');
});

// ---------- Subtask editor (inside modal) ----------
function renderSubtaskEditor() {
  const list = document.getElementById('subtaskEditorList');
  list.innerHTML = draftSubtasks.map(s => `
    <li>
      <span>${escapeHtml(s.text)}</span>
      <button type="button" data-id="${s.id}" class="remove-subtask">✕</button>
    </li>
  `).join('');
}

document.getElementById('addSubtaskBtn').addEventListener('click', () => {
  const input = document.getElementById('subtaskInput');
  const text = input.value.trim();
  if (!text) return;
  draftSubtasks.push({ id: crypto.randomUUID(), text, done: false });
  input.value = '';
  renderSubtaskEditor();
});

document.getElementById('subtaskEditorList').addEventListener('click', (e) => {
  if (e.target.classList.contains('remove-subtask')) {
    draftSubtasks = draftSubtasks.filter(s => s.id !== e.target.dataset.id);
    renderSubtaskEditor();
  }
});

// ---------- Form submit (create or update) ----------
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const deadline = document.getElementById('deadline').value;
  const teamRaw = document.getElementById('team').value.trim();
  const team = teamRaw ? teamRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
  const priority = document.getElementById('priority').value;

  if (editingId) {
    const p = projects.find(pr => pr.id === editingId);
    if (p) {
      p.name = name; p.deadline = deadline; p.team = team;
      p.priority = priority; p.subtasks = draftSubtasks;
    }
  } else {
    projects.push({
      id: crypto.randomUUID(), name, deadline, team, priority,
      status: 'todo', subtasks: draftSubtasks
    });
  }

  saveProjects();
  render();
  modalOverlay.classList.remove('open');
});

// ---------- Init ----------
render();
