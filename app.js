// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAlJEGcV1xCmRRMIMslfyLoYlGVWkvPd1U",
  authDomain: "canastapp-630a9.firebaseapp.com",
  projectId: "canastapp-630a9",
  storageBucket: "canastapp-630a9.firebasestorage.app",
  messagingSenderId: "849761257469",
  appId: "1:849761257469:web:9c5fa7790088683ee77b94",
  measurementId: "G-X6TYCSV5XX"
};


// ============================================================
// ESTADO LOCAL
// ============================================================
let state = {
  currentUser:       null,   // { uid, name, email }
  currentTeamId:     null,
  editingMatchId:    null,
  attendanceMatchId: null,
  reviewPayDocId:    null,
  postType:          'post',
  cache: {
    teams:  {},   // teamId → objeto equipo
    users:  {},   // uid    → objeto usuario
  }
};

// ============================================================
// UTILIDADES
// ============================================================

function genCode() { return Math.random().toString(36).substr(2,6).toUpperCase(); }

function showToast(msg, duration = 2800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), duration);
}

function showLoading(show) {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,15,0.7);display:flex;align-items:center;justify-content:center;z-index:300;backdrop-filter:blur(4px)';
    el.innerHTML = '<div style="width:36px;height:36px;border:3px solid rgba(255,107,53,0.3);border-top-color:#FF6B35;border-radius:50%;animation:spin 0.8s linear infinite"></div>';
    const s = document.createElement('style');
    s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
    document.body.appendChild(el);
  }
  el.style.display = show ? 'flex' : 'none';
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'long' });
}

function avatarInitials(name) {
  if (!name) return '?';
  const p = name.trim().split(' ');
  return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
}

function timeSince(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), d = Math.floor(diff/86400000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m}min`;
  if (h < 24) return `hace ${h}h`;
  return `hace ${d}d`;
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
// FIREBASE AUTH
// ============================================================

auth.onAuthStateChanged(async (fbUser) => {
  showLoading(false);
  if (fbUser) {
    const profileRef = fdb.collection('users').doc(fbUser.uid);
    const snap = await profileRef.get();
    if (!snap.exists) {
      const name = fbUser.displayName || fbUser.email.split('@')[0];
      await profileRef.set({ name, email: fbUser.email, createdAt: Date.now() });
    }
    const profile = snap.exists ? snap.data() : { name: fbUser.displayName || fbUser.email.split('@')[0], email: fbUser.email };
    state.currentUser = { uid: fbUser.uid, ...profile };
    document.getElementById('header-avatar').textContent    = avatarInitials(state.currentUser.name);
    document.getElementById('header-user-name').textContent = state.currentUser.name;
    showScreen('teams');
    renderTeamsList();
    scheduleNotificationChecks();
  } else {
    state.currentUser = null;
    showScreen('auth');
  }
});

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (i===0&&tab==='login')||(i===1&&tab==='register'));
  });
  document.getElementById('auth-login').classList.toggle('hidden',    tab !== 'login');
  document.getElementById('auth-register').classList.toggle('hidden', tab !== 'register');
}

async function login() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) { showToast('Completá todos los campos'); return; }
  showLoading(true);
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch (e) {
    showLoading(false);
    showToast(friendlyAuthError(e.code));
  }
}

async function register() {
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const pass  = document.getElementById('reg-pass').value;
  if (!name || !email || !pass) { showToast('Completá todos los campos'); return; }
  if (pass.length < 6) { showToast('La contraseña debe tener al menos 6 caracteres'); return; }
  showLoading(true);
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({ displayName: name });
    await fdb.collection('users').doc(cred.user.uid).set({ name, email, createdAt: Date.now() });
  } catch (e) {
    showLoading(false);
    showToast(friendlyAuthError(e.code));
  }
}

async function loginGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  showLoading(true);
  try {
    await auth.signInWithPopup(provider);
  } catch (e) {
    showLoading(false);
    showToast('No se pudo iniciar sesión con Google');
  }
}

function logout() {
  auth.signOut();
  state.currentTeamId = null;
  state.cache = { teams:{}, users:{} };
}

function friendlyAuthError(code) {
  const map = {
    'auth/user-not-found':       'No existe una cuenta con ese email',
    'auth/wrong-password':       'Contraseña incorrecta',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese email',
    'auth/invalid-email':        'El email no es válido',
    'auth/too-many-requests':    'Demasiados intentos. Esperá unos minutos.',
  };
  return map[code] || 'Error de autenticación. Intentá de nuevo.';
}

// ============================================================
// FIRESTORE HELPERS
// ============================================================

async function getUser(uid) {
  if (state.cache.users[uid]) return state.cache.users[uid];
  const snap = await fdb.collection('users').doc(uid).get();
  const data = snap.exists ? { uid, ...snap.data() } : null;
  if (data) state.cache.users[uid] = data;
  return data;
}

async function getMyMembership(teamId) {
  const uid  = state.currentUser.uid;
  const snap = await fdb.collection('members')
    .where('userId','==',uid).where('teamId','==',teamId).limit(1).get();
  return snap.empty ? null : { docId: snap.docs[0].id, ...snap.docs[0].data() };
}

// ============================================================
// EQUIPOS
// ============================================================

async function renderTeamsList() {
  const container = document.getElementById('teams-list');
  container.innerHTML = '<div class="empty-state"><p style="color:#555">Cargando equipos...</p></div>';

  const uid  = state.currentUser.uid;
  const snap = await fdb.collection('members')
    .where('userId','==',uid)
    .where('status','==','approved')
    .get();

  if (snap.empty) {
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

  const memberships = snap.docs.map(d => d.data());
  const teamSnaps   = await Promise.all(memberships.map(m => fdb.collection('teams').doc(m.teamId).get()));

  let html = '';
  for (let i = 0; i < memberships.length; i++) {
    const m     = memberships[i];
    const tSnap = teamSnaps[i];
    if (!tSnap.exists) continue;
    const team = { id: tSnap.id, ...tSnap.data() };
    state.cache.teams[team.id] = team;

    const countSnap = await fdb.collection('members')
      .where('teamId','==',team.id).where('status','==','approved').get();
    const memberCount = countSnap.size;

    let pendingBadge = '';
    if (m.role === 'admin') {
      const pendSnap = await fdb.collection('members')
        .where('teamId','==',team.id).where('status','==','pending').get();
      if (pendSnap.size > 0) pendingBadge = ` · ${pendSnap.size} solicitud${pendSnap.size > 1 ? 'es' : ''}`;
    }

    html += `
      <div class="team-card" onclick="openTeam('${team.id}')">
        <div class="team-card-ball">🏀</div>
        <div class="team-card-info">
          <div class="team-card-name">${team.name}</div>
          <div class="team-card-meta">${memberCount} miembro${memberCount!==1?'s':''}${pendingBadge}</div>
        </div>
        <span class="team-card-role ${m.role==='admin'?'':'user-role'}">${m.role==='admin'?'Admin':'Jugador'}</span>
      </div>`;
  }
  container.innerHTML = html || '<div class="empty-state"><p>No se encontraron equipos</p></div>';
}

async function createTeam() {
  const name = document.getElementById('new-team-name').value.trim();
  const min  = parseInt(document.getElementById('new-team-min').value) || 5;
  if (!name) { showToast('Ingresá el nombre del equipo'); return; }
  showLoading(true);
  try {
    const code    = genCode();
    const uid     = state.currentUser.uid;
    const teamRef = await fdb.collection('teams').add({
      name, code, minPlayers: min, createdBy: uid, createdAt: Date.now()
    });
    await fdb.collection('members').add({
      userId: uid, teamId: teamRef.id, role: 'admin', status: 'approved', joinedAt: Date.now()
    });
    closeModal('modal-create-team');
    document.getElementById('new-team-name').value = '';
    showToast(`¡Equipo "${name}" creado! Código: ${code}`);
    renderTeamsList();
  } catch (e) {
    showLoading(false);
    showToast('Error al crear el equipo. Intentá de nuevo.');
    console.error(e);
  }
}

async function joinTeam() {
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!code) { showToast('Ingresá el código del equipo'); return; }
  showLoading(true);
  try {
    const snap = await fdb.collection('teams').where('code','==',code).limit(1).get();
    if (snap.empty) { showLoading(false); showToast('Código incorrecto, verificalo con el admin'); return; }

    const team    = { id: snap.docs[0].id, ...snap.docs[0].data() };
    const uid     = state.currentUser.uid;
    const existing = await fdb.collection('members')
      .where('userId','==',uid).where('teamId','==',team.id).limit(1).get();

    if (!existing.empty) {
      const st = existing.docs[0].data().status;
      showLoading(false);
      if (st === 'pending')  { showToast('Tu solicitud ya está pendiente de aprobación'); return; }
      if (st === 'approved') { showToast('Ya sos miembro de este equipo'); return; }
    }

    await fdb.collection('members').add({
      userId: uid, teamId: team.id, role: 'user', status: 'pending', requestedAt: Date.now()
    });
    showLoading(false);
    closeModal('modal-join-team');
    document.getElementById('join-code').value = '';
    showToast(`Solicitud enviada a "${team.name}". Esperá la aprobación.`);
  } catch (e) {
    showLoading(false);
    showToast('Error al buscar el equipo. Intentá de nuevo.');
    console.error(e);
  }
}

async function leaveTeam() {
  const uid    = state.currentUser.uid;
  const teamId = state.currentTeamId;
  const snap   = await fdb.collection('members')
    .where('userId','==',uid).where('teamId','==',teamId).limit(1).get();
  if (!snap.empty) await snap.docs[0].ref.delete();
  goBack();
  showToast('Abandonaste el equipo');
}

// ============================================================
// ABRIR EQUIPO
// ============================================================

async function openTeam(teamId) {
  state.currentTeamId = teamId;
  showLoading(true);

  let team = state.cache.teams[teamId];
  if (!team) {
    const snap = await fdb.collection('teams').doc(teamId).get();
    team = { id: snap.id, ...snap.data() };
    state.cache.teams[teamId] = team;
  }

  document.getElementById('team-name-header').textContent = team.name;
  document.getElementById('team-code-header').textContent = 'Código: ' + team.code;

  const myMember = await getMyMembership(teamId);
  const isAdmin  = myMember && myMember.role === 'admin';

  document.getElementById('btn-add-match').classList.toggle('hidden', !isAdmin);
  document.getElementById('btn-manage-requests').classList.toggle('hidden', !isAdmin);

  showLoading(false);
  showScreen('team');
  switchTab('fixture');
}

// ============================================================
// TABS
// ============================================================

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active',  c.id === 'tab-' + tab);
    c.classList.toggle('hidden',  c.id !== 'tab-' + tab);
  });
  if (tab === 'fixture')  renderFixture();
  if (tab === 'payments') renderPayments();
  if (tab === 'messages') renderPosts();
}

// ============================================================
// FIXTURE
// ============================================================

async function renderFixture() {
  const teamId   = state.currentTeamId;
  const uid      = state.currentUser.uid;
  const matchSnap = await fdb.collection('matches')
    .where('teamId','==',teamId).orderBy('date','asc').get();
  const matches  = matchSnap.docs.map(d => ({ id:d.id, ...d.data() }));

  const today    = new Date(); today.setHours(0,0,0,0);
  const upcoming = matches.filter(m => new Date(m.date+'T00:00:00') >= today);

  if (upcoming.length > 0) {
    const next = upcoming[0];
    document.getElementById('next-rival').textContent = 'vs ' + next.opponent;
    document.getElementById('next-meta').textContent  = `${fmtDate(next.date)} · ${next.time} · ${next.location}`;
    const alerts = await getMatchAlerts(next);
    document.getElementById('next-match-alerts').innerHTML = alerts.map(a =>
      `<div class="alert-pill ${a.type}">${a.icon} ${a.msg}</div>`).join('');
  } else {
    document.getElementById('next-rival').textContent = 'Sin partidos próximos';
    document.getElementById('next-meta').textContent  = 'El admin puede agregar partidos';
    document.getElementById('next-match-alerts').innerHTML = '';
  }

  const myMember = await getMyMembership(teamId);
  const isAdmin  = myMember && myMember.role === 'admin';

  const listEl = document.getElementById('matches-list');
  if (matches.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><p>${isAdmin ? 'Creá el primer partido.' : 'El admin agregará los partidos.'}</p></div>`;
    return;
  }

  const attSnaps = await Promise.all(
    matches.map(m => fdb.collection('attendance').where('matchId','==',m.id).get())
  );

  listEl.innerHTML = matches.map((m, i) => {
    const atts     = attSnaps[i].docs.map(d => d.data());
    const attYes   = atts.filter(a => a.status==='yes').length;
    const attNo    = atts.filter(a => a.status==='no').length;
    const attMaybe = atts.filter(a => a.status==='maybe').length;
    return `
      <div class="match-card">
        <div class="match-card-top">
          <div><div class="match-rival-name">vs ${m.opponent}</div></div>
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

async function getMatchAlerts(match) {
  const uid    = state.currentUser.uid;
  const teamId = state.currentTeamId;
  const team   = state.cache.teams[teamId];

  const [attSnap, paySnap, totalAttSnap] = await Promise.all([
    fdb.collection('attendance').where('matchId','==',match.id).where('userId','==',uid).limit(1).get(),
    fdb.collection('payments').where('matchId','==',match.id).where('userId','==',uid).limit(1).get(),
    fdb.collection('attendance').where('matchId','==',match.id).where('status','==','yes').get()
  ]);

  const myAtt    = attSnap.empty ? null : attSnap.docs[0].data();
  const myPay    = paySnap.empty ? null : paySnap.docs[0].data();
  const confirmed = totalAttSnap.size;

  if (myAtt && myAtt.status==='yes' && myPay && myPay.status==='approved') {
    return [{ type:'success', icon:'✓', msg:'Todo en orden' }];
  }

  const alerts = [];
  if (!myAtt) alerts.push({ type:'warning', icon:'⚠', msg:'No confirmaste asistencia' });
  if (!myPay || myPay.status==='pending') alerts.push({ type:'warning', icon:'💳', msg:'Pago sin confirmar' });
  if (team && confirmed < team.minPlayers) {
    alerts.push({ type:'danger', icon:'🚨', msg:`Solo ${confirmed}/${team.minPlayers} confirmados` });
  }
  return alerts;
}

async function editMatch(matchId, event) {
  event.stopPropagation();
  const snap = await fdb.collection('matches').doc(matchId).get();
  if (!snap.exists) return;
  const m = snap.data();
  state.editingMatchId = matchId;
  document.getElementById('add-match-title').textContent = 'Editar partido';
  document.getElementById('match-rival').value    = m.opponent;
  document.getElementById('match-date').value     = m.date;
  document.getElementById('match-time').value     = m.time;
  document.getElementById('match-location').value = m.location;
  document.getElementById('match-result').value   = m.result || '';
  showModal('modal-add-match');
}

async function saveMatch() {
  const rival    = document.getElementById('match-rival').value.trim();
  const date     = document.getElementById('match-date').value;
  const time     = document.getElementById('match-time').value;
  const location = document.getElementById('match-location').value.trim();
  const result   = document.getElementById('match-result').value.trim();
  if (!rival || !date || !time) { showToast('Completá rival, fecha y hora'); return; }

  showLoading(true);
  try {
    const data = { opponent:rival, date, time, location, result, teamId:state.currentTeamId };
    if (state.editingMatchId) {
      await fdb.collection('matches').doc(state.editingMatchId).update(data);
    } else {
      await fdb.collection('matches').add({ ...data, createdAt: Date.now() });
    }
    closeModal('modal-add-match');
    state.editingMatchId = null;
    document.getElementById('add-match-title').textContent = 'Agregar partido';
    renderFixture();
    showToast('Partido guardado');
  } catch (e) {
    showLoading(false);
    showToast('Error al guardar el partido');
    console.error(e);
  }
}

// ============================================================
// PAGOS & ASISTENCIA
// ============================================================

async function renderPayments() {
  const teamId = state.currentTeamId;
  const uid    = state.currentUser.uid;
  const list   = document.getElementById('payments-list');
  list.innerHTML = '<div class="empty-state"><p style="color:#555">Cargando...</p></div>';

  const [matchSnap, myMember] = await Promise.all([
    fdb.collection('matches').where('teamId','==',teamId).orderBy('date','asc').get(),
    getMyMembership(teamId)
  ]);
  const matches = matchSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  const isAdmin = myMember && myMember.role === 'admin';

  if (matches.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No hay partidos para mostrar</p></div>';
    return;
  }

  const [attSnaps, paySnaps] = await Promise.all([
    Promise.all(matches.map(m => fdb.collection('attendance').where('matchId','==',m.id).where('userId','==',uid).limit(1).get())),
    Promise.all(matches.map(m => fdb.collection('payments').where('matchId','==',m.id).where('userId','==',uid).limit(1).get()))
  ]);

  let reviewCounts = {};
  if (isAdmin) {
    const reviewSnaps = await Promise.all(
      matches.map(m => fdb.collection('payments').where('matchId','==',m.id).where('status','==','review').get())
    );
    matches.forEach((m,i) => { reviewCounts[m.id] = reviewSnaps[i].size; });
  }

  list.innerHTML = matches.map((m, i) => {
    const myAtt = attSnaps[i].empty ? null : attSnaps[i].docs[0].data();
    const myPay = paySnaps[i].empty ? null : paySnaps[i].docs[0].data();

    const attLabel = myAtt ? {yes:'Voy',no:'No voy',maybe:'Duda'}[myAtt.status] : 'Sin confirmar';
    const attClass = myAtt ? myAtt.status : 'pending';
    const payLabel = myPay ? {pending:'Pendiente',review:'En revisión',approved:'Aprobado',rejected:'Rechazado'}[myPay.status] : 'Sin confirmar';
    const payClass = myPay ? myPay.status : 'pending';
    const adminBadge = (isAdmin && reviewCounts[m.id] > 0)
      ? `<span class="status-badge review">⚑ ${reviewCounts[m.id]} por revisar</span>` : '';

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

async function openAttendanceModal(matchId) {
  state.attendanceMatchId = matchId;
  showLoading(true);
  const uid    = state.currentUser.uid;
  const teamId = state.currentTeamId;

  const [matchSnap, attSnap, paySnap, myMember] = await Promise.all([
    fdb.collection('matches').doc(matchId).get(),
    fdb.collection('attendance').where('matchId','==',matchId).where('userId','==',uid).limit(1).get(),
    fdb.collection('payments').where('matchId','==',matchId).where('userId','==',uid).limit(1).get(),
    getMyMembership(teamId)
  ]);

  const match   = matchSnap.data();
  const myAtt   = attSnap.empty ? null : attSnap.docs[0].data();
  const myPay   = paySnap.empty ? null : paySnap.docs[0].data();
  const isAdmin = myMember && myMember.role === 'admin';

  document.getElementById('attendance-match-info').innerHTML =
    `<strong>vs ${match.opponent}</strong>${fmtDate(match.date)} · ${match.time} · ${match.location}`;

  document.querySelectorAll('.attend-btn').forEach(b => {
    const s = b.classList.contains('yes') ? 'yes' : b.classList.contains('no') ? 'no' : 'maybe';
    b.classList.toggle('active', myAtt && myAtt.status === s);
  });

  const payEl           = document.getElementById('payment-current-status');
  const payInputSection = document.getElementById('payment-input-section');

  if (myPay) {
    const labels = { pending:'⏳ Pendiente', review:'🔍 En revisión', approved:'✅ Aprobado', rejected:'❌ Rechazado' };
    payEl.innerHTML = `
      <div class="status-badges" style="margin-bottom:12px">
        <span class="status-badge ${myPay.status}">${labels[myPay.status]}</span>
      </div>
      ${myPay.message ? `<div class="player-message-display">💬 "${myPay.message}"</div>` : ''}`;
    payInputSection.classList.toggle('hidden', myPay.status !== 'pending' && myPay.status !== 'rejected');
    if (myPay.status === 'rejected') {
      document.getElementById('payment-message').value = '';
      document.getElementById('payment-message').placeholder = 'Tu pago fue rechazado. Enviá un nuevo mensaje...';
    }
  } else {
    payEl.innerHTML = '';
    payInputSection.classList.remove('hidden');
    document.getElementById('payment-message').value = '';
    document.getElementById('payment-message').placeholder = 'Ej: Pagué por transferencia el lunes, operación #98765...';
  }

  const adminSection = document.getElementById('admin-payment-section');
  state.reviewPayDocId = null;

  if (isAdmin) {
    const reviewSnap = await fdb.collection('payments')
      .where('matchId','==',matchId).where('status','==','review').get();
    if (!reviewSnap.empty) {
      const firstPay  = reviewSnap.docs[0].data();
      const payerData = await getUser(firstPay.userId);
      const payerName = payerData ? payerData.name : 'Jugador';
      document.getElementById('admin-payment-message').innerHTML =
        `<span class="admin-msg-author">${payerName}:</span> "${firstPay.message || '(sin mensaje)'}"`;
      adminSection.classList.remove('hidden');
      state.reviewPayDocId = reviewSnap.docs[0].id;
    } else {
      adminSection.classList.add('hidden');
    }
  } else {
    adminSection.classList.add('hidden');
  }

  showLoading(false);
  showModal('modal-attendance');
}

async function setAttendance(status) {
  const matchId = state.attendanceMatchId;
  const uid     = state.currentUser.uid;

  document.querySelectorAll('.attend-btn').forEach(b => {
    const s = b.classList.contains('yes') ? 'yes' : b.classList.contains('no') ? 'no' : 'maybe';
    b.classList.toggle('active', s === status);
  });

  const snap = await fdb.collection('attendance')
    .where('matchId','==',matchId).where('userId','==',uid).limit(1).get();
  if (!snap.empty) {
    await snap.docs[0].ref.update({ status });
  } else {
    await fdb.collection('attendance').add({ matchId, userId:uid, status, createdAt: Date.now() });
  }
  showToast(status==='yes' ? '¡Confirmado! Nos vemos.' : status==='no' ? 'Marcado como ausente' : 'Marcado como duda');
}

async function submitPaymentMessage() {
  const message = document.getElementById('payment-message').value.trim();
  if (!message) { showToast('Escribí un mensaje para el administrador'); return; }

  const matchId = state.attendanceMatchId;
  const uid     = state.currentUser.uid;
  showLoading(true);

  const snap = await fdb.collection('payments')
    .where('matchId','==',matchId).where('userId','==',uid).limit(1).get();
  const data = { matchId, userId:uid, message, status:'review', updatedAt: Date.now() };
  if (!snap.empty) {
    await snap.docs[0].ref.update(data);
  } else {
    await fdb.collection('payments').add({ ...data, createdAt: Date.now() });
  }

  showLoading(false);
  showToast('Confirmación enviada. El admin la revisará.');
  openAttendanceModal(matchId);
}

async function approvePayment() {
  if (state.reviewPayDocId) {
    await fdb.collection('payments').doc(state.reviewPayDocId).update({ status:'approved', reviewedAt: Date.now() });
  }
  closeModal('modal-attendance');
  renderPayments();
  showToast('Pago aprobado ✓');
}

async function rejectPayment() {
  if (state.reviewPayDocId) {
    await fdb.collection('payments').doc(state.reviewPayDocId).update({ status:'rejected', reviewedAt: Date.now() });
  }
  closeModal('modal-attendance');
  renderPayments();
  showToast('Pago rechazado');
}

// ============================================================
// POSTS / NOVEDADES
// ============================================================

async function renderPosts() {
  const teamId = state.currentTeamId;
  const list   = document.getElementById('posts-list');
  list.innerHTML = '<div class="empty-state"><p style="color:#555">Cargando...</p></div>';

  const snap  = await fdb.collection('posts')
    .where('teamId','==',teamId).orderBy('createdAt','desc').get();
  const posts = snap.docs.map(d => ({ id:d.id, ...d.data() }));

  if (posts.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No hay publicaciones todavía. ¡Sé el primero!</p></div>';
    return;
  }

  const [commentSnaps, reactionSnaps] = await Promise.all([
    Promise.all(posts.map(p => fdb.collection('comments').where('postId','==',p.id).get())),
    Promise.all(posts.map(p => fdb.collection('reactions').where('postId','==',p.id).get()))
  ]);

  const authorIds = [...new Set(posts.map(p => p.authorId))];
  await Promise.all(authorIds.map(id => getUser(id)));

  list.innerHTML = posts.map((p, i) => {
    const author   = state.cache.users[p.authorId];
    const rGroups  = {};
    reactionSnaps[i].docs.forEach(d => { const e = d.data().emoji; rGroups[e] = (rGroups[e]||0)+1; });
    const reactionHTML = Object.entries(rGroups).map(([e,c]) => `<span class="reaction-pill">${e} ${c}</span>`).join('');
    const typeLabel = p.type==='poll' ? 'Encuesta' : 'Novedad';
    const typeClass = p.type==='poll' ? 'post-type-poll' : 'post-type-post';
    const preview   = p.type==='poll'
      ? `📊 ${(p.pollOptions||[]).length} opciones`
      : (p.content||'').substring(0,80)+((p.content||'').length>80?'...':'');
    return `
      <div class="post-card" onclick="openPostDetail('${p.id}')">
        <span class="post-card-type-badge ${typeClass}">${typeLabel}</span>
        <div class="post-card-title">${p.title}</div>
        <div class="post-card-preview">${preview}</div>
        <div class="post-card-footer">
          <span>${author ? author.name : 'Usuario'} · ${timeSince(p.createdAt)}</span>
          <div class="post-reactions">${reactionHTML}<span class="reaction-pill">💬 ${commentSnaps[i].size}</span></div>
        </div>
      </div>`;
  }).join('');
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

async function createPost() {
  const teamId = state.currentTeamId;
  const uid    = state.currentUser.uid;
  showLoading(true);
  try {
    if (state.postType === 'post') {
      const title   = document.getElementById('post-title').value.trim();
      const content = document.getElementById('post-content').value.trim();
      if (!title) { showLoading(false); showToast('Ingresá un título'); return; }
      await fdb.collection('posts').add({ teamId, type:'post', title, content, authorId:uid, createdAt:Date.now() });
      document.getElementById('post-title').value = '';
      document.getElementById('post-content').value = '';
    } else {
      const question = document.getElementById('poll-question').value.trim();
      const options  = [...document.querySelectorAll('.poll-option-input')].map(i => i.value.trim()).filter(Boolean);
      if (!question || options.length < 2) { showLoading(false); showToast('Ingresá la pregunta y al menos 2 opciones'); return; }
      await fdb.collection('posts').add({ teamId, type:'poll', title:question, content:'', authorId:uid, createdAt:Date.now(), pollOptions:options });
      document.getElementById('poll-question').value = '';
      document.querySelectorAll('.poll-option-input').forEach((el,i) => { if(i>1) el.parentElement.remove(); else el.value=''; });
    }
    closeModal('modal-new-post');
    renderPosts();
    showToast('Publicación creada');
  } catch (e) {
    showLoading(false);
    showToast('Error al publicar');
    console.error(e);
  }
}

async function openPostDetail(postId) {
  showLoading(true);
  const uid = state.currentUser.uid;

  const [postSnap, commentSnap, reactionSnap, voteSnap] = await Promise.all([
    fdb.collection('posts').doc(postId).get(),
    fdb.collection('comments').where('postId','==',postId).orderBy('createdAt','asc').get(),
    fdb.collection('reactions').where('postId','==',postId).get(),
    fdb.collection('pollVotes').where('postId','==',postId).get()
  ]);

  const post      = { id:postId, ...postSnap.data() };
  const comments  = commentSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  const reactions = reactionSnap.docs.map(d => d.data());
  const votes     = voteSnap.docs.map(d => d.data());

  const authorIds = [...new Set([post.authorId, ...comments.map(c => c.userId)])];
  await Promise.all(authorIds.map(id => getUser(id)));

  const author   = state.cache.users[post.authorId];
  const EMOJIS   = ['🔥','👍','💪','👏','😂','❤️'];
  const rGroups  = {};
  reactions.forEach(r => { rGroups[r.emoji] = (rGroups[r.emoji]||0)+1; });
  const myReactions = reactions.filter(r => r.userId===uid).map(r => r.emoji);

  document.getElementById('post-detail-title').textContent = post.title;

  let pollHTML = '';
  if (post.type === 'poll') {
    const myVote = votes.find(v => v.userId===uid);
    pollHTML = (post.pollOptions||[]).map((opt, idx) => {
      const count = votes.filter(v => v.optionIndex===idx).length;
      const pct   = votes.length > 0 ? Math.round((count/votes.length)*100) : 0;
      const voted = myVote && myVote.optionIndex===idx;
      return `
        <div class="poll-option">
          <div class="poll-option-bar-wrap" onclick="votePoll('${postId}',${idx})">
            <div class="poll-option-bar" style="width:${pct}%"></div>
            <div class="poll-option-label"><span>${voted?'✓ ':''}${opt}</span><span class="poll-option-pct">${pct}%</span></div>
          </div>
        </div>`;
    }).join('') + `<p style="font-size:0.75rem;color:#555;margin-top:6px;">${votes.length} voto${votes.length!==1?'s':''}</p>`;
  }

  const commentsHTML = comments.map(c => {
    const cu = state.cache.users[c.userId];
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
    const count   = rGroups[e] || 0;
    const reacted = myReactions.includes(e);
    return `<button class="react-btn ${reacted?'reacted':''}" onclick="toggleReaction('${postId}','${e}')">${e}${count>0?' '+count:''}</button>`;
  }).join('');

  document.getElementById('post-detail-body').innerHTML = `
    <div class="post-detail-meta">Por ${author ? author.name : 'Usuario'} · ${timeSince(post.createdAt)}</div>
    ${post.content ? `<div class="post-detail-content">${post.content}</div>` : ''}
    ${pollHTML}
    <div class="reactions-row">${reactionsHTML}</div>
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

  showLoading(false);
  showModal('modal-post-detail');
}

async function addComment(postId) {
  const input   = document.getElementById('comment-input');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  await fdb.collection('comments').add({ postId, userId:state.currentUser.uid, content, createdAt:Date.now() });
  openPostDetail(postId);
}

async function votePoll(postId, optionIndex) {
  const uid  = state.currentUser.uid;
  const snap = await fdb.collection('pollVotes')
    .where('postId','==',postId).where('userId','==',uid).limit(1).get();
  if (!snap.empty) { await snap.docs[0].ref.update({ optionIndex }); }
  else { await fdb.collection('pollVotes').add({ postId, userId:uid, optionIndex, createdAt:Date.now() }); }
  openPostDetail(postId);
}

async function toggleReaction(postId, emoji) {
  const uid  = state.currentUser.uid;
  const snap = await fdb.collection('reactions')
    .where('postId','==',postId).where('userId','==',uid).where('emoji','==',emoji).limit(1).get();
  if (!snap.empty) { await snap.docs[0].ref.delete(); }
  else { await fdb.collection('reactions').add({ postId, userId:uid, emoji, createdAt:Date.now() }); }
  openPostDetail(postId);
}

// ============================================================
// MIEMBROS & SOLICITUDES
// ============================================================

async function renderMembers() {
  const teamId   = state.currentTeamId;
  const uid      = state.currentUser.uid;
  const snap     = await fdb.collection('members')
    .where('teamId','==',teamId).where('status','==','approved').get();
  const members  = snap.docs.map(d => ({ docId:d.id, ...d.data() }));
  const myMember = members.find(m => m.userId === uid);
  const isAdmin  = myMember && myMember.role === 'admin';
  await Promise.all(members.map(m => getUser(m.userId)));

  document.getElementById('members-list').innerHTML = members.map(m => {
    const user         = state.cache.users[m.userId];
    if (!user) return '';
    const canMakeAdmin = isAdmin && m.role !== 'admin' && m.userId !== uid;
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
          <span class="role-badge ${m.role==='admin'?'role-admin':'role-user'}">${m.role==='admin'?'Admin':'Jugador'}</span>
          ${canMakeAdmin ? `<button class="make-admin-btn" onclick="makeAdmin('${m.docId}')">Hacer admin</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

async function makeAdmin(docId) {
  await fdb.collection('members').doc(docId).update({ role:'admin' });
  renderMembers();
  showToast('Rol actualizado');
}

async function renderRequests() {
  const teamId   = state.currentTeamId;
  const snap     = await fdb.collection('members')
    .where('teamId','==',teamId).where('status','==','pending').get();
  const pending  = snap.docs.map(d => ({ docId:d.id, ...d.data() }));
  const container = document.getElementById('requests-list');

  if (pending.length === 0) {
    container.innerHTML = '<p style="color:#555;text-align:center;padding:20px">No hay solicitudes pendientes</p>';
    return;
  }
  await Promise.all(pending.map(m => getUser(m.userId)));

  container.innerHTML = pending.map(m => {
    const user = state.cache.users[m.userId];
    if (!user) return '';
    return `
      <div class="request-item">
        <div class="request-name">${user.name}</div>
        <div class="request-email">${user.email}</div>
        <div class="request-actions">
          <button class="btn-success" onclick="approveRequest('${m.docId}')">✓ Aprobar</button>
          <button class="btn-danger"  onclick="rejectRequest('${m.docId}')">✗ Rechazar</button>
        </div>
      </div>`;
  }).join('');
}

async function approveRequest(docId) {
  await fdb.collection('members').doc(docId).update({ status:'approved', approvedAt:Date.now() });
  renderRequests();
  showToast('Solicitud aprobada');
}

async function rejectRequest(docId) {
  await fdb.collection('members').doc(docId).delete();
  renderRequests();
  showToast('Solicitud rechazada');
}

// ============================================================
// MODALS
// ============================================================

function showModal(id) {
  document.getElementById(id).classList.remove('hidden');
  if (id === 'modal-members')  renderMembers();
  if (id === 'modal-requests') renderRequests();
}
function closeModal(id)           { document.getElementById(id).classList.add('hidden'); }
function closeModalOutside(e, id) { if (e.target.id === id) closeModal(id); }

// ============================================================
// DROPDOWN
// ============================================================

function toggleTeamMenu() { document.getElementById('team-dropdown').classList.toggle('hidden'); }
function closeDropdowns()  { document.getElementById('team-dropdown').classList.add('hidden'); }

document.addEventListener('click', e => {
  if (!e.target.closest('#team-menu-btn') && !e.target.closest('#team-dropdown')) closeDropdowns();
});

// ============================================================
// NOTIFICACIONES (base — FCM completo en FIREBASE_GUIDE.md)
// ============================================================

function scheduleNotificationChecks() {
  if ('Notification' in window && Notification.permission === 'default') {
    setTimeout(() => {
      Notification.requestPermission().then(p => {
        if (p === 'granted') showToast('Notificaciones activadas 🔔');
      });
    }, 2000);
  }
}

// ============================================================
// PWA
// ============================================================

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  setTimeout(() => {
    const banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.innerHTML = `
      <div class="logo-ball" style="width:36px;height:36px">
        <svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="28" fill="#FF6B35"/><path d="M30 2 Q30 30 30 58M2 30 Q30 30 58 30" stroke="#1A0A02" stroke-width="2" fill="none"/></svg>
      </div>
      <p>Instalá CanastApp para acceso rápido y notificaciones</p>
      <button class="btn-sm" id="install-btn">Instalar</button>
      <button class="icon-btn" onclick="this.parentElement.remove()">✕</button>`;
    document.body.appendChild(banner);
    document.getElementById('install-btn').addEventListener('click', () => {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => { banner.remove(); deferredPrompt = null; });
    });
  }, 4000);
});
