// ---------- Data ----------
// Each project: { id, name, deadline, team: [names], status: 'todo'|'progress'|'done' }

let projects = [];

try {
  const saved = localStorage.getItem('basecamp-board-projects');
  if (saved) projects = JSON.parse(saved);
} catch (e) {
  console.warn('Could not load saved projects, starting fresh.', e);
}

// Seed with example data the first time, so the board isn't empty
if (projects.length === 0) {
  const today = new Date();
  const inDays = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  };
  projects = [
    { id: crypto.randomUUID(), name: 'Website Redesign', deadline: inDays(14), team: ['Asha', 'Ravi'], status: 'todo' },
    { id: crypto.randomUUID(), name: 'Mobile App Beta', deadline: inDays(3), team: ['Meera'], status: 'progress' },
    { id: crypto.randomUUID(), name: 'Client Onboarding Docs', deadline: inDays(-2), team: ['Asha', 'Karan'], status: 'progress' },
    { id: crypto.randomUUID(), name: 'Q2 Marketing Plan', deadline: inDays(30), team: ['Ravi'], status: 'done' },
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

// ---------- Rendering ----------
const statuses = ['todo', 'progress', 'done'];

function render() {
  statuses.forEach(status => {
    const list = document.getElementById(`list-${status}`);
    const items = projects.filter(p => p.status === status);
    document.getElementById(`count-${status}`).textContent = items.length;

    if (items.length === 0) {
      list.innerHTML = `<p class="empty-state">Nothing here yet.</p>`;
      return;
    }

    list.innerHTML = items.map(p => `
      <div class="card">
        <p class="card-title">${escapeHtml(p.name)}</p>
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
    `).join('');
  });
}

function moveButtons(project) {
  const order = ['todo', 'progress', 'done'];
  const labels = { todo: '← To Do', progress: '↔ In Progress', done: 'Done →' };
  return order
    .filter(s => s !== project.status)
    .map(s => `<button class="move-btn" data-id="${project.id}" data-status="${s}">${labels[s]}</button>`)
    .join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Events ----------
document.getElementById('board').addEventListener('click', (e) => {
  if (e.target.classList.contains('move-btn')) {
    const id = e.target.dataset.id;
    const newStatus = e.target.dataset.status;
    const project = projects.find(p => p.id === id);
    if (project) {
      project.status = newStatus;
      saveProjects();
      render();
    }
  }
});

const modalOverlay = document.getElementById('modalOverlay');
document.getElementById('openModalBtn').addEventListener('click', () => modalOverlay.classList.add('open'));
document.getElementById('cancelBtn').addEventListener('click', () => modalOverlay.classList.remove('open'));
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.remove('open');
});

document.getElementById('projectForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const deadline = document.getElementById('deadline').value;
  const teamRaw = document.getElementById('team').value.trim();
  const team = teamRaw ? teamRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  projects.push({
    id: crypto.randomUUID(),
    name,
    deadline,
    team,
    status: 'todo'
  });

  saveProjects();
  render();
  e.target.reset();
  modalOverlay.classList.remove('open');
});

// ---------- Init ----------
render();
