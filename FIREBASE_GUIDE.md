# CanastApp — Guía de Deploy con Firebase

## Stack recomendado para producción

```
Frontend: HTML/CSS/JS (este código) o React/Vue
Backend:  Firebase (Auth + Firestore + Storage + Cloud Messaging)
Hosting:  Firebase Hosting (gratis hasta límites generosos)
```

---

## 1. Crear proyecto Firebase

1. Ir a https://console.firebase.google.com
2. Crear nuevo proyecto "canastapp"
3. Habilitar:
   - **Authentication** → Email/Password + Google
   - **Firestore Database** → Modo producción
   - **Storage** → Para comprobantes de pago
   - **Cloud Messaging** → Para push notifications

---

## 2. Instalar Firebase SDK

```html
<!-- En index.html, antes de cerrar </body> -->
<script src="https://www.gstatic.com/firebasejs/10.x.x/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.x.x/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.x.x/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.x.x/firebase-storage-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.x.x/firebase-messaging-compat.js"></script>
```

---

## 3. Reemplazar la capa de datos (app.js)

Actualmente `app.js` usa `localStorage` como base de datos. Para pasar a Firebase:

### Autenticación
```javascript
// LOGIN
firebase.auth().signInWithEmailAndPassword(email, pass)
  .then(cred => setCurrentUser(cred.user))
  .catch(err => showToast(err.message));

// GOOGLE
const provider = new firebase.auth.GoogleAuthProvider();
firebase.auth().signInWithPopup(provider)
  .then(cred => setCurrentUser(cred.user));

// ESTADO AUTH
firebase.auth().onAuthStateChanged(user => {
  if (user) setCurrentUser(user);
  else showScreen('auth');
});
```

### Firestore (reemplaza loadDB/saveDB)
```javascript
const db = firebase.firestore();

// Crear equipo
async function createTeam() {
  const ref = await db.collection('teams').add({ name, code, minPlayers, createdBy: uid });
  await db.collection('members').add({ userId: uid, teamId: ref.id, role: 'admin', status: 'approved' });
}

// Escuchar en tiempo real
db.collection('matches').where('teamId', '==', teamId)
  .onSnapshot(snap => {
    const matches = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMatches(matches);
  });
```

### Storage (comprobantes)
```javascript
async function uploadFile(file, matchId, userId) {
  const ref = firebase.storage().ref(`payments/${matchId}/${userId}/${file.name}`);
  await ref.put(file);
  const url = await ref.getDownloadURL();
  await db.collection('payments').add({ matchId, userId, fileUrl: url, status: 'review' });
}
```

---

## 4. Push Notifications con FCM

### En sw.js (ya configurado, agregar):
```javascript
importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-messaging-compat.js');
firebase.initializeApp({ /* tu config */ });
const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icon-192.png'
  });
});
```

### Cloud Functions para notificaciones automáticas:
```javascript
// functions/index.js
exports.checkMatchReminders = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const h12Later = new Date(now.toDate().getTime() + 12 * 3600 * 1000);
    
    const matches = await db.collection('matches')
      .where('date', '<=', h12Later)
      .where('date', '>', now.toDate())
      .get();
    
    for (const match of matches.docs) {
      // Notificar usuarios sin asistencia confirmada
      // Notificar admins con pagos pendientes
      // Verificar quórum mínimo
    }
  });
```

---

## 5. Reglas de seguridad Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Solo miembros aprobados ven el equipo
    match /teams/{teamId} {
      allow read: if isTeamMember(teamId);
      allow create: if request.auth != null;
      allow update: if isTeamAdmin(teamId);
    }
    
    match /matches/{matchId} {
      allow read: if isTeamMemberByMatch(matchId);
      allow write: if isTeamAdminByMatch(matchId);
    }
    
    match /payments/{payId} {
      allow read: if request.auth.uid == resource.data.userId || isTeamAdmin(...);
      allow create: if request.auth.uid == request.resource.data.userId;
      allow update: if isTeamAdmin(...); // solo admin aprueba/rechaza
    }
    
    function isTeamMember(teamId) {
      return exists(/databases/$(database)/documents/members/$(request.auth.uid + '_' + teamId));
    }
    function isTeamAdmin(teamId) {
      return get(/databases/$(database)/documents/members/$(request.auth.uid + '_' + teamId)).data.role == 'admin';
    }
  }
}
```

---

## 6. Deploy

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

---

## Estructura de archivos del proyecto

```
canastapp/
├── index.html          # App principal (HTML)
├── style.css           # Estilos
├── app.js              # Lógica de la app
├── sw.js               # Service Worker (PWA + Push)
├── manifest.json       # Manifiesto PWA
├── icon-192.png        # Ícono app (generar con https://realfavicongenerator.net)
├── icon-512.png        # Ícono app grande
└── FIREBASE_GUIDE.md   # Este archivo
```

---

## Usuarios de prueba (demo local)

| Email | Contraseña | Rol |
|-------|-----------|-----|
| admin@demo.com | 123456 | Admin de "Los Cóndores" |
| lucas@demo.com | 123456 | Jugador |
| sofia@demo.com | 123456 | Jugadora |

Código del equipo demo: **DEMO01**

---

## Funcionalidades implementadas ✅

- [x] Autenticación (email + Google simulado)
- [x] Crear/unirse a equipos con código único
- [x] Roles Admin/Usuario
- [x] Fixture completo con CRUD (solo admin)
- [x] Confirmación de asistencia (Voy/No voy/Duda)
- [x] Subida de comprobantes (simulada)
- [x] Aprobación/rechazo de pagos (admin)
- [x] Publicaciones y encuestas
- [x] Comentarios en publicaciones
- [x] Reacciones con emoji
- [x] Votación en encuestas
- [x] Alertas de partido próximo
- [x] Notificaciones push (Web Notifications API)
- [x] PWA instalable (manifest + service worker)
- [x] Offline support básico
- [x] Aprobación de solicitudes de ingreso
- [x] Asignación de roles admin

## Pendiente para producción

- [ ] Conectar Firebase Auth real
- [ ] Conectar Firestore (reemplazar localStorage)
- [ ] Subida real a Firebase Storage
- [ ] Cloud Functions para notificaciones automáticas
- [ ] FCM tokens por dispositivo
- [ ] Íconos reales (PNG)
- [ ] Dominio personalizado
