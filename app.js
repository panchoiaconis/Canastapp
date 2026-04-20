// ============================================================
// CANASTAPP - Basketball Team Management PWA
// ============================================================
// Architecture: localStorage for demo, Firebase-ready structure
// ============================================================

const DB_KEY = 'canastapp_data';
let state = {
  currentUser: null,
  currentTeamId: null,
  editingMatchId: null,
  attendanceMatchId: null,
  postType: 'post'
};

// ============================================================
// DATA LAYER (localStorage — swap with Firebase)
// ============================================================

function loadDB() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY)) || getInitialDB();
  } catch { return getInitialDB(); }
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function getInitialDB() {
  return { users: [], teams: [], members: [], matches: [], payments: [], attendance: [], posts: [], comments: [], reactions: [], pollVotes: [] };
}

let db = loadDB();

// Seed demo data if empty
function seedDemoData() {
  if (db.users.length > 0) return;
  const adminId = genId();
  const user1Id = genId();
  const user2Id = genId();
  const teamId = genId();
  const match1Id = genId();
  const match2Id = genId();
  const postId = genId();
  const pollId = genId();

  db.users.push(
    { id: adminId, name: 'Martín García', email: 'admin@demo.com', password: '123456' },
    { id: user1Id, name: 'Lucas Pérez', email: 'lucas@demo.com', password: '123456' },
    { id: user2Id, name: 'Sofía Ruiz', email: 'sofia@demo.com', password: '123456' }
  );

  const teamCode = 'DEMO01';
  db.teams.push({
    id: teamId, name: 'Los Cóndores', code: teamCode,
    minPlayers: 5, createdBy: adminId, createdAt: Date.now()
  });

  db.members.push(
    { userId: adminId, teamId, role: 'admin', status: 'approved' },
    { userId: user1Id, teamId, role: 'user', status: 'approved' },
    { userId: user2Id, teamId, role: 'user', status: 'approved' }
  );

  const now = Date.now();
  const tomorrow = now + 86400000;
  const nextWeek = now + 7 * 86400000;

  db.matches.push(
    { id: match1Id, teamId, opponent: 'Los Halcones', date: new Date(tomorrow).toISOString().split('T')[0], time: '20:00', location: 'Gimnasio Municipal Palermo', result: '', createdAt: now },
    { id: match2Id, teamId, opponent: 'Thunder FC', date: new Date(nextWeek).toISOString().split('T')[0], time: '19:30', location: 'Club Atlético San Martín', result: '', createdAt: now }
  );

  db.attendance.push(
    { matchId: match1Id, userId: adminId, status: 'yes' },
    { matchId: match1Id, userId: user1Id, status: 'maybe' }
  );

  db.payments.push(
    { id: genId(), matchId: match1Id, userId: adminId, fileUrl: null, status: 'approved' },
    { id: genId(), matchId: match1Id, userId: user1Id, status: 'review', fileUrl: 'comprobante.jpg' }
  );

  db.posts.push(
    { id: postId, teamId, type: 'post', title: '¡Arrancan los entrenamientos!', content: 'A partir de la próxima semana retomamos los martes y jueves de 20 a 22hs en el club. Confirmá asistencia por favor.', authorId: adminId, createdAt: now - 3600000 },
    { id: pollId, teamId, type: 'poll', title: '¿A qué hora preferís entrenar?', content: '', authorId: adminId, createdAt: now - 7200000, pollOptions: ['18:00', '19:00', '20:00', '21:00'] }
  );

  db.comments.push(
    { id: genId(), postId, userId: user1Id, content: '¡Genial! Los martes me quedan perfectos.', createdAt: now - 1800000 },
    { id: genId(), postId, userId: user2Id, content: 'Yo llego a los dos días, así que barbaro', createdAt: now - 900000 }
  );

  db.reactions.push(
    { id: genId(), postId, userId: adminId, emoji: '🔥' },
    { id: genId(), postId, userId: user1Id, emoji: '🔥' },
    { id: genId(), postId, userId: user2Id, emoji: '👍' }
  );

  db.pollVotes.push(
    { postId: pollId, userId: adminId, optionIndex: 2 },
    { postId: pollId, userId: user1Id, optionIndex: 2 },
    { postId: pollId, userId: user2Id, optionIndex: 3 }
  );

  saveDB(db);
}

seedDemoData();

// ============================================================
// UTILITIES
// ============================================================

function genId() { return Math.random().toString(36).substr(2, 9) + Date.now().toString(36); }

function genCode() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), duration);
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'long' });
}

function fmtDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function avatarInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

// ============================================================
// SCREEN NAVIGATION
// ============================================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

function goBack() {
  state.currentTeamId = null;
  showScreen('teams');
  renderTeamsList();
}

// ============================================================
// AUTH
// ============================================================

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
  });
  document.getElementById('auth-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('auth-register').classList.toggle('hidden', tab !== 'register');
}

function login() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass = document.getElementById('login-pass').value;
  if (!email || !pass) { showToast('Completá todos los campos'); return; }

  const user = db.users.find(u => u.email.toLowerCase() === email && u.password === pass);
  if (!user) { showToast('Email o contraseña incorrectos'); return; }

  setCurrentUser(user);
}

function register() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const pass = document.getElementById('reg-pass').value;
  if (!name || !email || !pass) { showToast('Completá todos los campos'); return; }
  if (pass.length < 6) { showToast('La contraseña debe tener al menos 6 caracteres'); return; }
  if (db.users.find(u => u.email.toLowerCase() === email)) { showToast('Ya existe una cuenta con ese email'); return; }

  const user = { id: genId(), name, email, password: pass };
  db.users.push(user);
  saveDB(db);
  setCurrentUser(user);
}

function loginGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  
  firebase.auth()
    .signInWithPopup(provider)
    .then((result) => {
      const user = result.user;
      
      // Crear objeto de usuario
      const newUser = {
        id: user.uid,
        name: user.displayName || 'Usuario',
        email: user.email,
        avatar: user.photoURL
      };
      
      // Guardar en localStorage (o Firestore si migraste)
      const existingUser = db.users.find(u => u.email === user.email);
      if (!existingUser) {
        db.users.push(newUser);
        saveDB(db);
      }
      
      setCurrentUser(newUser);
      showToast('¡Bienvenido ' + user.displayName + '!');
    })
    .catch((error) => {
      console.error("Google Login Error:", error);
      console.error("Código:", error.code);
      console.error("Mensaje:", error.message);
      
      // Mensajes de error específicos
      if (error.code === 'auth/popup-blocked') {
        showToast('El popup fue bloqueado. Habilita popups en el navegador.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        showToast('Cancelaste el login con Google');
      } else if (error.code === 'auth/network-request-failed') {
        showToast('Error de conexión. Verifica tu internet.');
      } else {
        showToast('Error: ' + error.message);
      }
    });
}

function setCurrentUser(user) {
  state.currentUser = user;
  document.getElementById('header-avatar').textContent = avatarInitials(user.name);
  document.getElementById('header-user-name').textContent = user.name;
  showScreen('teams');
  renderTeamsList();
  scheduleNotificationChecks();
}

function logout() {
  state.currentUser = null;
  state.currentTeamId = null;
  showScreen('auth');
}

// ============================================================
// TEAMS
// ============================================================

function renderTeamsList() {
  const container = document.getElementById('teams-list');
  const myTeams = db.members
    .filter(m => m.userId === state.currentUser.id && m.status === 'approved')
    .map(m => ({ ...m, team: db.teams.find(t => t.id === m.teamId) }))
    .filter(m => m.team);

  if (myTeams.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 60 60" fill="none" width="60" height="60">
          <circle cx="30" cy="30" r="28" stroke="#555" stroke-width="2"/>
          <path d="M30 2 Q30 30 30 58M2 30 Q30 30 58 30" stroke="#555" stroke-width="1.5" fill="none"/>
        </svg>
        <h3>Todavía no tenés equipos</h3>
        <p>Creá uno nuevo o unite usando un código de equipo</p>
      </div>`;
    return;
  }

  container.innerHTML = myTeams.map(m => {
    const memberCount = db.members.filter(x => x.teamId === m.teamId && x.status === 'approved').length;
    const pendingCount = db.members.filter(x => x.teamId === m.teamId && x.status === 'pending').length;
    return `
      <div class="team-card" onclick="openTeam('${m.teamId}')">
        <div class="team-card-ball">🏀</div>
        <div class="team-card-info">
          <div class="team-card-name">${m.team.name}</div>
          <div class="team-card-meta">${memberCount} miembros${pendingCount > 0 ? ` · ${pendingCount} pendiente${pendingCount > 1 ? 's' : ''}` : ''}</div>
        </div>
        <span class="team-card-role ${m.role === 'admin' ? '' : 'user-role'}">${m.role === 'admin' ? 'Admin' : 'Jugador'}</span>
      </div>`;
  }).join('');
}

function createTeam() {
  const name = document.getElementById('new-team-name').value.trim();
  const min = parseInt(document.getElementById('new-team-min').value) || 5;
  if (!name) { showToast('Ingresá el nombre del equipo'); return; }

  const team = { id: genId(), name, code: genCode(), minPlayers: min, createdBy: state.currentUser.id, createdAt: Date.now() };
  db.teams.push(team);
  db.members.push({ userId: state.currentUser.id, teamId: team.id, role: 'admin', status: 'approved' });
  saveDB(db);
  closeModal('modal-create-team');
  document.getElementById('new-team-name').value = '';
  renderTeamsList();
  showToast(`¡Equipo "${name}" creado! Código: ${team.code}`);
}

function joinTeam() {
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!code) { showToast('Ingresá el código del equipo'); return; }

  const team = db.teams.find(t => t.code === code);
  if (!team) { showToast('Código incorrecto, verificalo con el admin'); return; }

  const existing = db.members.find(m => m.userId === state.currentUser.id && m.teamId === team.id);
  if (existing) {
    if (existing.status === 'pending') { showToast('Tu solicitud ya está pendiente de aprobación'); return; }
    if (existing.status === 'approved') { showToast('Ya sos miembro de este equipo'); return; }
  }

  db.members.push({ userId: state.currentUser.id, teamId: team.id, role: 'user', status: 'pending' });
  saveDB(db);
  closeModal('modal-join-team');
  document.getElementById('join-code').value = '';
  showToast(`Solicitud enviada a "${team.name}". Esperá la aprobación.`);
}

function leaveTeam() {
  if (!state.currentTeamId) return;
  const idx = db.members.findIndex(m => m.userId === state.currentUser.id && m.teamId === state.currentTeamId);
  if (idx > -1) { db.members.splice(idx, 1); saveDB(db); }
  goBack();
  showToast('Abandonaste el equipo');
}

// ============================================================
// OPEN TEAM
// ============================================================

function openTeam(teamId) {
  state.currentTeamId = teamId;
  const team = db.teams.find(t => t.id === teamId);
  if (!team) return;

  document.getElementById('team-name-header').textContent = team.name;
  document.getElementById('team-code-header').textContent = 'Código: ' + team.code;

  const myMember = db.members.find(m => m.userId === state.currentUser.id && m.teamId === teamId);
  const isAdmin = myMember && myMember.role === 'admin';

  document.getElementById('btn-add-match').classList.toggle('hidden', !isAdmin);
  document.getElementById('btn-manage-requests').classList.toggle('hidden', !isAdmin);

  showScreen('team');
  switchTab('fixture');
}

// ============================================================
// TABS
// ============================================================

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === 'tab-' + tab);
    c.classList.toggle('hidden', c.id !== 'tab-' + tab);
  });

  if (tab === 'fixture') renderFixture();
  if (tab === 'payments') renderPayments();
  if (tab === 'messages') renderPosts();
}

// ============================================================
// FIXTURE
// ============================================================

function renderFixture() {
  const teamId = state.currentTeamId;
  const matches = db.matches.filter(m => m.teamId === teamId).sort((a, b) => new Date(a.date) - new Date(b.date));

  // Next match card
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = matches.filter(m => new Date(m.date + 'T00:00:00') >= today);
  const nextCard = document.getElementById('next-match-card');

  if (upcoming.length > 0) {
    const next = upcoming[0];
    document.getElementById('next-rival').textContent = 'vs ' + next.opponent;
    document.getElementById('next-meta').textContent = `${fmtDate(next.date)} · ${next.time} · ${next.location}`;

    // Alerts
    const alerts = getMatchAlerts(next);
    document.getElementById('next-match-alerts').innerHTML = alerts.map(a =>
      `<div class="alert-pill ${a.type}">${a.icon} ${a.msg}</div>`
    ).join('');
    nextCard.style.display = '';
  } else {
    document.getElementById('next-rival').textContent = 'Sin partidos próximos';
    document.getElementById('next-meta').textContent = 'Agendá un partido nuevo';
    document.getElementById('next-match-alerts').innerHTML = '';
  }

  // Match list
  const myMember = db.members.find(m => m.userId === state.currentUser.id && m.teamId === teamId);
  const isAdmin = myMember && myMember.role === 'admin';

  const listEl = document.getElementById('matches-list');
  if (matches.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><p>No hay partidos aún. ${isAdmin ? 'Creá el primero.' : 'El admin agregará los partidos.'}</p></div>`;
    return;
  }

  listEl.innerHTML = matches.map(m => {
    const attYes = db.attendance.filter(a => a.matchId === m.id && a.status === 'yes').length;
    const attNo = db.attendance.filter(a => a.matchId === m.id && a.status === 'no').length;
    const attMaybe = db.attendance.filter(a => a.matchId === m.id && a.status === 'maybe').length;
    const isPast = new Date(m.date + 'T23:59:59') < new Date();

    return `
      <div class="match-card">
        <div class="match-card-top">
          <div>
            <div class="match-rival-name">vs ${m.opponent}</div>
          </div>
          ${m.result ? `<div class="match-result-badge">${m.result}</div>` : ''}
        </div>
        <div class="match-card-meta">
          <span class="match-meta-item">📅 ${fmtDate(m.date)}</span>
          <span class="match-meta-item">🕐 ${m.time}</span>
          <span class="match-meta-item">📍 ${m.location}</span>
        </div>
        <div class="match-card-footer">
          <div class="attendance-summary">
            <span class="att-count yes">✓ ${attYes}</span>
            <span class="att-count maybe">? ${attMaybe}</span>
            <span class="att-count no">✗ ${attNo}</span>
          </div>
          ${isAdmin ? `<button class="admin-edit-btn" onclick="editMatch('${m.id}',event)">Editar</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

function getMatchAlerts(match) {
  const alerts = [];
  const teamId = state.currentTeamId;
  const team = db.teams.find(t => t.id === teamId);
  const userId = state.currentUser.id;

  const myAtt = db.attendance.find(a => a.matchId === match.id && a.userId === userId);
  const myPay = db.payments.find(p => p.matchId === match.id && p.userId === userId);

  if (!myAtt) alerts.push({ type: 'warning', icon: '⚠', msg: 'No confirmaste asistencia' });
  if (!myPay || myPay.status === 'pending') alerts.push({ type: 'warning', icon: '💳', msg: 'Pago sin confirmar' });

  const confirmed = db.attendance.filter(a => a.matchId === match.id && a.status === 'yes').length;
  if (team && confirmed < team.minPlayers) {
    alerts.push({ type: 'danger', icon: '🚨', msg: `Solo ${confirmed}/${team.minPlayers} confirmados` });
  }

  if (myAtt && myAtt.status === 'yes' && myPay && myPay.status === 'approved') {
    alerts.length = 0;
    alerts.push({ type: 'success', icon: '✓', msg: 'Todo en orden' });
  }

  return alerts;
}

function editMatch(matchId, event) {
  event.stopPropagation();
  const match = db.matches.find(m => m.id === matchId);
  if (!match) return;
  state.editingMatchId = matchId;
  document.getElementById('add-match-title').textContent = 'Editar partido';
  document.getElementById('match-rival').value = match.opponent;
  document.getElementById('match-date').value = match.date;
  document.getElementById('match-time').value = match.time;
  document.getElementById('match-location').value = match.location;
  document.getElementById('match-result').value = match.result || '';
  showModal('modal-add-match');
}

function saveMatch() {
  const rival = document.getElementById('match-rival').value.trim();
  const date = document.getElementById('match-date').value;
  const time = document.getElementById('match-time').value;
  const location = document.getElementById('match-location').value.trim();
  const result = document.getElementById('match-result').value.trim();

  if (!rival || !date || !time) { showToast('Completá rival, fecha y hora'); return; }

  if (state.editingMatchId) {
    const match = db.matches.find(m => m.id === state.editingMatchId);
    if (match) { match.opponent = rival; match.date = date; match.time = time; match.location = location; match.result = result; }
  } else {
    db.matches.push({ id: genId(), teamId: state.currentTeamId, opponent: rival, date, time, location, result, createdAt: Date.now() });
  }

  saveDB(db);
  closeModal('modal-add-match');
  state.editingMatchId = null;
  document.getElementById('add-match-title').textContent = 'Agregar partido';
  renderFixture();
  showToast('Partido guardado');
}

// ============================================================
// PAYMENTS & ATTENDANCE
// ============================================================

function renderPayments() {
  const teamId = state.currentTeamId;
  const matches = db.matches.filter(m => m.teamId === teamId).sort((a, b) => new Date(a.date) - new Date(b.date));
  const userId = state.currentUser.id;
  const myMember = db.members.find(m => m.userId === userId && m.teamId === teamId);
  const isAdmin = myMember && myMember.role === 'admin';

  const list = document.getElementById('payments-list');
  if (matches.length === 0) {
    list.innerHTML = `<div class="empty-state"><p>No hay partidos para mostrar</p></div>`;
    return;
  }

  list.innerHTML = matches.map(m => {
    const myAtt = db.attendance.find(a => a.matchId === m.id && a.userId === userId);
    const myPay = db.payments.find(p => p.matchId === m.id && p.userId === userId);

    const attLabel = myAtt ? { yes: 'Voy', no: 'No voy', maybe: 'Duda' }[myAtt.status] : 'Sin confirmar';
    const attClass = myAtt ? myAtt.status : 'pending';
    const payLabel = myPay ? { pending: 'Pendiente', review: 'En revisión', approved: 'Aprobado', rejected: 'Rechazado' }[myPay.status] : 'Sin confirmar';
    const payClass = myPay ? myPay.status : 'pending';

    // Admin: count pending reviews
    let adminBadge = '';
    if (isAdmin) {
      const pendingReviews = db.payments.filter(p => p.matchId === m.id && p.status === 'review').length;
      if (pendingReviews > 0) {
        adminBadge = `<span class="status-badge review">⚑ ${pendingReviews} por revisar</span>`;
      }
    }

    return `
      <div class="payment-card" onclick="openAttendanceModal('${m.id}')">
        <div class="payment-card-header">
          <div>
            <div class="payment-card-rival">vs ${m.opponent}</div>
            <div class="payment-card-date">${fmtDate(m.date)} · ${m.time}</div>
          </div>
        </div>
        <div class="status-badges">
          <span class="status-badge ${attClass}">👤 ${attLabel}</span>
          <span class="status-badge ${payClass}">💳 ${payLabel}</span>
          ${adminBadge}
        </div>
      </div>`;
  }).join('');
}

function openAttendanceModal(matchId) {
  state.attendanceMatchId = matchId;
  const match = db.matches.find(m => m.id === matchId);
  if (!match) return;

  const userId = state.currentUser.id;
  const myAtt = db.attendance.find(a => a.matchId === matchId && a.userId === userId);
  const myPay = db.payments.find(p => p.matchId === matchId && p.userId === userId);

  document.getElementById('attendance-match-info').innerHTML = `<strong>vs ${match.opponent}</strong>${fmtDate(match.date)} · ${match.time} · ${match.location}`;

  // Update attend buttons
  document.querySelectorAll('.attend-btn').forEach(b => {
    const status = b.classList.contains('yes') ? 'yes' : b.classList.contains('no') ? 'no' : 'maybe';
    b.classList.toggle('active', myAtt && myAtt.status === status);
  });

  // Payment status
  const payEl = document.getElementById('payment-current-status');
  const payInputSection = document.getElementById('payment-input-section');

  if (myPay) {
    const labels = { pending: '⏳ Pendiente', review: '🔍 En revisión', approved: '✅ Aprobado', rejected: '❌ Rechazado' };
    payEl.innerHTML = `
      <div class="status-badges" style="margin-bottom:12px">
        <span class="status-badge ${myPay.status}">${labels[myPay.status]}</span>
      </div>
      ${myPay.message ? `<div class="player-message-display">💬 "${myPay.message}"</div>` : ''}`;
    // Hide input if already sent (unless rejected — let them re-send)
    payInputSection.classList.toggle('hidden', myPay.status !== 'pending' && myPay.status !== 'rejected');
    if (myPay.status === 'rejected') {
      document.getElementById('payment-message').value = '';
      document.getElementById('payment-message').placeholder = 'Tu pago fue rechazado. Enviá un nuevo mensaje...';
    }
  } else {
    payEl.innerHTML = '';
    payInputSection.classList.remove('hidden');
    document.getElementById('payment-message').value = '';
  }

  // Admin section
  const teamId = state.currentTeamId;
  const myMember = db.members.find(m => m.userId === userId && m.teamId === teamId);
  const isAdmin = myMember && myMember.role === 'admin';
  const adminSection = document.getElementById('admin-payment-section');

  if (isAdmin && myPay && myPay.status === 'review') {
    adminSection.classList.remove('hidden');
    // Show the player's message
    const msgEl = document.getElementById('admin-payment-message');
    if (myPay.message) {
      const player = db.users.find(u => u.id === myPay.userId);
      msgEl.innerHTML = `<span class="admin-msg-author">${player ? player.name : 'Jugador'}:</span> "${myPay.message}"`;
    } else {
      msgEl.innerHTML = '';
    }
  } else {
    adminSection.classList.add('hidden');
  }

  showModal('modal-attendance');
}

function setAttendance(status) {
  const matchId = state.attendanceMatchId;
  const userId = state.currentUser.id;
  const existing = db.attendance.find(a => a.matchId === matchId && a.userId === userId);

  if (existing) { existing.status = status; }
  else { db.attendance.push({ matchId, userId, status }); }
  saveDB(db);

  document.querySelectorAll('.attend-btn').forEach(b => {
    const s = b.classList.contains('yes') ? 'yes' : b.classList.contains('no') ? 'no' : 'maybe';
    b.classList.toggle('active', s === status);
  });

  showToast(status === 'yes' ? '¡Confirmado! Nos vemos.' : status === 'no' ? 'Marcado como ausente' : 'Marcado como duda');
}

function submitPaymentMessage() {
  const message = document.getElementById('payment-message').value.trim();
  if (!message) { showToast('Escribí un mensaje para el administrador'); return; }

  const matchId = state.attendanceMatchId;
  const userId = state.currentUser.id;
  const existing = db.payments.find(p => p.matchId === matchId && p.userId === userId);

  const payData = { id: genId(), matchId, userId, message, status: 'review' };
  if (existing) { Object.assign(existing, payData); }
  else { db.payments.push(payData); }

  saveDB(db);
  showToast('Confirmación enviada. El admin la revisará.');
  // Refresh modal state
  openAttendanceModal(matchId);
}

function approvePayment() {
  const matchId = state.attendanceMatchId;
  const pay = db.payments.find(p => p.matchId === matchId && p.status === 'review');
  if (pay) { pay.status = 'approved'; saveDB(db); }
  closeModal('modal-attendance');
  renderPayments();
  showToast('Pago aprobado ✓');
}

function rejectPayment() {
  const matchId = state.attendanceMatchId;
  const pay = db.payments.find(p => p.matchId === matchId && p.status === 'review');
  if (pay) { pay.status = 'rejected'; saveDB(db); }
  closeModal('modal-attendance');
  renderPayments();
  showToast('Pago rechazado');
}

// ============================================================
// POSTS / MESSAGES
// ============================================================

function renderPosts() {
  const teamId = state.currentTeamId;
  const posts = db.posts.filter(p => p.teamId === teamId).sort((a, b) => b.createdAt - a.createdAt);

  const list = document.getElementById('posts-list');
  if (posts.length === 0) {
    list.innerHTML = `<div class="empty-state"><p>No hay publicaciones todavía. ¡Sé el primero!</p></div>`;
    return;
  }

  list.innerHTML = posts.map(p => {
    const author = db.users.find(u => u.id === p.authorId);
    const commentsCount = db.comments.filter(c => c.postId === p.id).length;
    const reactions = db.reactions.filter(r => r.postId === p.id);
    const reactionGroups = {};
    reactions.forEach(r => { reactionGroups[r.emoji] = (reactionGroups[r.emoji] || 0) + 1; });

    const reactionHTML = Object.entries(reactionGroups).map(([emoji, count]) => `<span class="reaction-pill">${emoji} ${count}</span>`).join('');

    const typeLabel = p.type === 'poll' ? 'Encuesta' : 'Novedad';
    const typeClass = p.type === 'poll' ? 'post-type-poll' : 'post-type-post';

    const preview = p.type === 'poll'
      ? `📊 ${(p.pollOptions || []).length} opciones`
      : (p.content || '').substring(0, 80) + ((p.content || '').length > 80 ? '...' : '');

    return `
      <div class="post-card" onclick="openPostDetail('${p.id}')">
        <span class="post-card-type-badge ${typeClass}">${typeLabel}</span>
        <div class="post-card-title">${p.title}</div>
        <div class="post-card-preview">${preview}</div>
        <div class="post-card-footer">
          <span>${author ? author.name : 'Usuario'} · ${timeSince(p.createdAt)}</span>
          <div class="post-reactions">
            ${reactionHTML}
            <span class="reaction-pill">💬 ${commentsCount}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

function timeSince(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m}min`;
  if (h < 24) return `hace ${h}h`;
  return `hace ${d}d`;
}

function selectPostType(type) {
  state.postType = type;
  document.querySelectorAll('.post-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  document.getElementById('post-form').classList.toggle('hidden', type !== 'post');
  document.getElementById('poll-form').classList.toggle('hidden', type !== 'poll');
}

function addPollOption() {
  const container = document.getElementById('poll-options-container');
  const idx = container.children.length + 1;
  const div = document.createElement('div');
  div.className = 'field-group';
  div.innerHTML = `<label>Opción ${idx}</label><input type="text" class="poll-option-input" placeholder="Opción ${idx}">`;
  container.appendChild(div);
}

function createPost() {
  const teamId = state.currentTeamId;
  const userId = state.currentUser.id;

  if (state.postType === 'post') {
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    if (!title) { showToast('Ingresá un título'); return; }
    db.posts.push({ id: genId(), teamId, type: 'post', title, content, authorId: userId, createdAt: Date.now() });
    document.getElementById('post-title').value = '';
    document.getElementById('post-content').value = '';
  } else {
    const question = document.getElementById('poll-question').value.trim();
    const options = [...document.querySelectorAll('.poll-option-input')].map(i => i.value.trim()).filter(Boolean);
    if (!question || options.length < 2) { showToast('Ingresá la pregunta y al menos 2 opciones'); return; }
    db.posts.push({ id: genId(), teamId, type: 'poll', title: question, content: '', authorId: userId, createdAt: Date.now(), pollOptions: options });
    document.getElementById('poll-question').value = '';
    document.querySelectorAll('.poll-option-input').forEach((el, i) => { if (i > 1) el.parentElement.remove(); else el.value = ''; });
  }

  saveDB(db);
  closeModal('modal-new-post');
  renderPosts();
  showToast('Publicación creada');
}

function openPostDetail(postId) {
  const post = db.posts.find(p => p.id === postId);
  if (!post) return;
  const author = db.users.find(u => u.id === post.authorId);
  const comments = db.comments.filter(c => c.postId === postId).sort((a, b) => a.createdAt - b.createdAt);
  const reactions = db.reactions.filter(r => r.postId === postId);

  const EMOJIS = ['🔥', '👍', '💪', '👏', '😂', '❤️'];
  const myReactions = reactions.filter(r => r.userId === state.currentUser.id).map(r => r.emoji);
  const reactionGroups = {};
  reactions.forEach(r => { reactionGroups[r.emoji] = (reactionGroups[r.emoji] || 0) + 1; });

  document.getElementById('post-detail-title').textContent = post.title;

  let pollHTML = '';
  if (post.type === 'poll') {
    const totalVotes = db.pollVotes.filter(v => v.postId === postId).length;
    pollHTML = (post.pollOptions || []).map((opt, idx) => {
      const votes = db.pollVotes.filter(v => v.postId === postId && v.optionIndex === idx).length;
      const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
      const myVote = db.pollVotes.find(v => v.postId === postId && v.userId === state.currentUser.id);
      const voted = myVote && myVote.optionIndex === idx;
      return `
        <div class="poll-option">
          <div class="poll-option-bar-wrap" onclick="votePoll('${postId}', ${idx})">
            <div class="poll-option-bar" style="width:${pct}%"></div>
            <div class="poll-option-label">
              <span>${voted ? '✓ ' : ''}${opt}</span>
              <span class="poll-option-pct">${pct}%</span>
            </div>
          </div>
        </div>`;
    }).join('') + `<p style="font-size:0.75rem;color:#555;margin-top:6px;">${totalVotes} voto${totalVotes !== 1 ? 's' : ''}</p>`;
  }

  const commentsHTML = comments.map(c => {
    const cu = db.users.find(u => u.id === c.userId);
    return `
      <div class="comment-item">
        <div class="comment-avatar">${cu ? avatarInitials(cu.name) : '?'}</div>
        <div class="comment-body">
          <div class="comment-author">${cu ? cu.name : 'Usuario'}</div>
          <div class="comment-text">${c.content}</div>
        </div>
      </div>`;
  }).join('');

  const reactionsHTML = EMOJIS.map(e => {
    const count = reactionGroups[e] || 0;
    const reacted = myReactions.includes(e);
    return `<button class="react-btn ${reacted ? 'reacted' : ''}" onclick="toggleReaction('${postId}','${e}')">${e}${count > 0 ? ' ' + count : ''}</button>`;
  }).join('');

  document.getElementById('post-detail-body').innerHTML = `
    <div class="post-detail-meta">Por ${author ? author.name : 'Usuario'} · ${timeSince(post.createdAt)}</div>
    ${post.content ? `<div class="post-detail-content">${post.content}</div>` : ''}
    ${pollHTML}
    <div class="reactions-row" id="reactions-row-${postId}">${reactionsHTML}</div>
    <div class="comments-section">
      <h4>Comentarios (${comments.length})</h4>
      <div id="comments-container">${commentsHTML || '<p style="color:#555;font-size:0.85rem">Aún no hay comentarios.</p>'}</div>
      <div class="comment-input-row">
        <input type="text" id="comment-input" placeholder="Escribí un comentario..." onkeydown="if(event.key==='Enter')addComment('${postId}')">
        <button class="comment-send-btn" onclick="addComment('${postId}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>`;

  showModal('modal-post-detail');
}

function addComment(postId) {
  const input = document.getElementById('comment-input');
  const content = input.value.trim();
  if (!content) return;
  db.comments.push({ id: genId(), postId, userId: state.currentUser.id, content, createdAt: Date.now() });
  saveDB(db);
  input.value = '';
  openPostDetail(postId); // re-render
}

function votePoll(postId, optionIndex) {
  const existing = db.pollVotes.find(v => v.postId === postId && v.userId === state.currentUser.id);
  if (existing) { existing.optionIndex = optionIndex; }
  else { db.pollVotes.push({ postId, userId: state.currentUser.id, optionIndex }); }
  saveDB(db);
  openPostDetail(postId);
}

function toggleReaction(postId, emoji) {
  const userId = state.currentUser.id;
  const existing = db.reactions.findIndex(r => r.postId === postId && r.userId === userId && r.emoji === emoji);
  if (existing > -1) { db.reactions.splice(existing, 1); }
  else { db.reactions.push({ id: genId(), postId, userId, emoji }); }
  saveDB(db);
  openPostDetail(postId);
}

// ============================================================
// MEMBERS & REQUESTS
// ============================================================

function renderMembers() {
  const teamId = state.currentTeamId;
  const members = db.members.filter(m => m.teamId === teamId && m.status === 'approved');
  const userId = state.currentUser.id;
  const myMember = db.members.find(m => m.userId === userId && m.teamId === teamId);
  const isAdmin = myMember && myMember.role === 'admin';

  document.getElementById('members-list').innerHTML = members.map(m => {
    const user = db.users.find(u => u.id === m.userId);
    if (!user) return '';
    const canMakeAdmin = isAdmin && m.role !== 'admin' && m.userId !== userId;
    return `
      <div class="member-item">
        <div class="member-item-left">
          <div class="user-avatar" style="width:36px;height:36px;font-size:0.75rem">${avatarInitials(user.name)}</div>
          <div>
            <div class="member-name">${user.name}</div>
            <div class="member-email">${user.email}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="role-badge ${m.role === 'admin' ? 'role-admin' : 'role-user'}">${m.role === 'admin' ? 'Admin' : 'Jugador'}</span>
          ${canMakeAdmin ? `<button class="make-admin-btn" onclick="makeAdmin('${m.userId}')">Hacer admin</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

function makeAdmin(userId) {
  const teamId = state.currentTeamId;
  const member = db.members.find(m => m.userId === userId && m.teamId === teamId);
  if (member) { member.role = 'admin'; saveDB(db); renderMembers(); showToast('Rol actualizado'); }
}

function renderRequests() {
  const teamId = state.currentTeamId;
  const pending = db.members.filter(m => m.teamId === teamId && m.status === 'pending');
  const container = document.getElementById('requests-list');

  if (pending.length === 0) {
    container.innerHTML = '<p style="color:#555;text-align:center;padding:20px">No hay solicitudes pendientes</p>';
    return;
  }

  container.innerHTML = pending.map(m => {
    const user = db.users.find(u => u.id === m.userId);
    if (!user) return '';
    return `
      <div class="request-item">
        <div class="request-name">${user.name}</div>
        <div class="request-email">${user.email}</div>
        <div class="request-actions">
          <button class="btn-success" onclick="approveRequest('${m.userId}')">✓ Aprobar</button>
          <button class="btn-danger" onclick="rejectRequest('${m.userId}')">✗ Rechazar</button>
        </div>
      </div>`;
  }).join('');
}

function approveRequest(userId) {
  const teamId = state.currentTeamId;
  const member = db.members.find(m => m.userId === userId && m.teamId === teamId);
  if (member) { member.status = 'approved'; saveDB(db); renderRequests(); showToast('Solicitud aprobada'); }
}

function rejectRequest(userId) {
  const teamId = state.currentTeamId;
  const idx = db.members.findIndex(m => m.userId === userId && m.teamId === teamId);
  if (idx > -1) { db.members.splice(idx, 1); saveDB(db); renderRequests(); showToast('Solicitud rechazada'); }
}

// ============================================================
// MODALS
// ============================================================

function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
  if (id === 'modal-members') renderMembers();
  if (id === 'modal-requests') renderRequests();
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function closeModalOutside(event, id) {
  if (event.target.id === id) closeModal(id);
}

// ============================================================
// DROPDOWN
// ============================================================

function toggleTeamMenu() {
  document.getElementById('team-dropdown').classList.toggle('hidden');
}

function closeDropdowns() {
  document.getElementById('team-dropdown').classList.add('hidden');
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#team-menu-btn') && !e.target.closest('#team-dropdown')) {
    closeDropdowns();
  }
});

// ============================================================
// PUSH NOTIFICATIONS (Web Push API)
// ============================================================

function scheduleNotificationChecks() {
  // Request permission
  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => {
      Notification.requestPermission().then(p => {
        if (p === 'granted') showToast('Notificaciones activadas 🔔');
      });
    }, 2000);
  }

  // Check every hour (in real app: use Service Worker + Firebase Cloud Messaging)
  checkNotifications();
  setInterval(checkNotifications, 60 * 60 * 1000);
}

function checkNotifications() {
  if (!state.currentUser) return;
  const userId = state.currentUser.id;
  const now = Date.now();
  const h12 = 12 * 3600 * 1000;
  const h10 = 10 * 3600 * 1000;

  const myTeams = db.members.filter(m => m.userId === userId && m.status === 'approved').map(m => m.teamId);

  myTeams.forEach(teamId => {
    const team = db.teams.find(t => t.id === teamId);
    const myMember = db.members.find(m => m.userId === userId && m.teamId === teamId);
    const isAdmin = myMember && myMember.role === 'admin';
    const matches = db.matches.filter(m => m.teamId === teamId);

    matches.forEach(match => {
      const matchTime = new Date(match.date + 'T' + match.time).getTime();
      const timeUntil = matchTime - now;

      // 12h before
      if (timeUntil > 0 && timeUntil <= h12) {
        const myAtt = db.attendance.find(a => a.matchId === match.id && a.userId === userId);
        const myPay = db.payments.find(p => p.matchId === match.id && p.userId === userId);

        if (!myAtt) {
          sendLocalNotif(`¡Faltan 12hs! vs ${match.opponent}`, 'No olvidés confirmar tu asistencia');
        }
        if (!myPay || myPay.status === 'pending') {
          sendLocalNotif(`💳 Pago pendiente`, `Subí el comprobante para el partido vs ${match.opponent}`);
        }

        if (isAdmin) {
          const pendingPays = db.payments.filter(p => p.matchId === match.id && p.status === 'review').length;
          if (pendingPays > 0) {
            sendLocalNotif(`📋 ${pendingPays} comprobante${pendingPays > 1 ? 's' : ''} para revisar`, `Partido vs ${match.opponent}`);
          }
        }
      }

      // 10h before — quorum check
      if (timeUntil > 0 && timeUntil <= h10) {
        const confirmed = db.attendance.filter(a => a.matchId === match.id && a.status === 'yes').length;
        if (team && confirmed < team.minPlayers) {
          sendLocalNotif(`🚨 ¡Faltan jugadores!`, `Solo ${confirmed}/${team.minPlayers} confirmados para vs ${match.opponent}`);
        }
      }
    });
  });
}

function sendLocalNotif(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: 'icon-192.png' });
  } else {
    // Fallback: in-app banner
    showNotifBanner(title + ' — ' + body);
  }
}

function showNotifBanner(msg) {
  const banner = document.getElementById('notif-banner');
  document.getElementById('notif-text').textContent = msg;
  banner.classList.remove('hidden');
  setTimeout(() => banner.classList.add('hidden'), 6000);
}

// ============================================================
// PWA / SERVICE WORKER
// ============================================================

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// PWA Install prompt
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  // Show custom install banner after 3 seconds
  setTimeout(() => {
    const banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.innerHTML = `
      <div class="logo-ball" style="width:36px;height:36px">
        <svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="28" fill="#FF6B35"/><path d="M30 2 Q30 30 30 58M2 30 Q30 30 58 30" stroke="#1A0A02" stroke-width="2" fill="none"/></svg>
      </div>
      <p>Instalá CanastApp en tu celular para acceso rápido y notificaciones</p>
      <button class="btn-sm" id="install-btn">Instalar</button>
      <button class="icon-btn" onclick="this.parentElement.remove()">✕</button>`;
    document.body.appendChild(banner);

    document.getElementById('install-btn').addEventListener('click', () => {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => { banner.remove(); deferredPrompt = null; });
    });
  }, 3000);
});

// ============================================================
// INIT
// ============================================================

// Demo login hints
window.addEventListener('DOMContentLoaded', () => {
  const hint = document.createElement('div');
  hint.style.cssText = 'position:fixed;bottom:8px;left:50%;transform:translateX(-50%);font-size:0.7rem;color:#444;text-align:center;z-index:1000;white-space:nowrap;';
  hint.textContent = 'Demo: admin@demo.com / 123456';
  document.body.appendChild(hint);
  setTimeout(() => hint.remove(), 8000);
});
