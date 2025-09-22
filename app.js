// ВАЖНО: заменить конфиг Firebase ниже на свой из Firebase Console
const firebaseConfig = {
  apiKey: "REPLACE_APIKEY",
  authDomain: "REPLACE_PROJECT.firebaseapp.com",
  projectId: "REPLACE_PROJECT",
  // storageBucket, messagingSenderId, appId — по необходимости
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const adminPanel = document.getElementById('admin-panel');
const teacherPanel = document.getElementById('teacher-panel');
const studentPanel = document.getElementById('student-panel');
const alerts = document.getElementById('alerts');

loginBtn.addEventListener('click', async () => {
  const provider = new firebase.auth.GithubAuthProvider();
  provider.addScope('user:email');
  try {
    await auth.signInWithPopup(provider);
  } catch (e) {
    showAlert('Ошибка входа: '+ e.message);
  }
});

logoutBtn.addEventListener('click', () => auth.signOut());

auth.onAuthStateChanged(async user => {
  if (user) {
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    // ensure user doc exists
    const userDocRef = db.collection('users').doc(user.uid);
    const udoc = await userDocRef.get();
    if (!udoc.exists) {
      // new user — default role=student (админ назначит роль)
      await userDocRef.set({
        displayName: user.displayName || user.email,
        email: user.email,
        role: 'student',
        githubLogin: user.providerData[0]?.displayName || user.email.split('@')[0],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    const profile = (await userDocRef.get()).data();
    routeByRole(profile.role, user.uid);
  } else {
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    adminPanel.style.display = teacherPanel.style.display = studentPanel.style.display = 'none';
  }
});

function showAlert(text){
  alerts.innerText = text;
  setTimeout(()=>alerts.innerText='',5000);
}

async function routeByRole(role, uid){
  adminPanel.style.display = teacherPanel.style.display = studentPanel.style.display = 'none';
  if (role === 'admin') {
    adminPanel.style.display = 'block';
    await loadAdminLists();
  } else if (role === 'teacher') {
    teacherPanel.style.display = 'block';
    await loadTeacherView(uid);
  } else {
    studentPanel.style.display = 'block';
    await loadStudentView(uid);
  }
}

/* --- Admin helpers --- */
async function loadAdminLists(){
  const lists = document.getElementById('admin-lists');
  lists.innerHTML = '<h3>Группы</h3>';
  const groupsSnap = await db.collection('groups').get();
  groupsSnap.forEach(doc => {
    const d = doc.data();
    const el = document.createElement('div');
    el.className = 'group-item';
    el.innerText = `${d.name} — ${d.year} (${d.studentIds?.length||0} учеников)`;
    lists.appendChild(el);
  });
  // Кнопки создания можно реализовать дальше (модальные формы)
}

/* --- Teacher view --- */
async function loadTeacherView(uid){
  const cont = document.getElementById('teacher-subjects');
  cont.innerHTML = '<h3>Ваши предметы</h3>';
  const subjectsSnap = await db.collection('subjects').where('teacherId','==',uid).get();
  subjectsSnap.forEach(s => {
    const data = s.data();
    const el = document.createElement('div');
    el.className = 'subject-item';
    el.innerHTML = `<strong>${data.name}</strong><div>Группы: ${ (data.groupIds||[]).join(', ')}</div>
      <button data-sub="${s.id}">Открыть журнал</button>`;
    el.querySelector('button').onclick = () => openJournalForSubject(s.id, data);
    cont.appendChild(el);
  });
}

async function openJournalForSubject(subjectId, data){
  // простой интерфейс: список учеников из групп и возможность добавить оценку
  const students = [];
  for(const gid of (data.groupIds||[])){
    const gdoc = await db.collection('groups').doc(gid).get();
    if (!gdoc.exists) continue;
    const gdata = gdoc.data();
    for(const sid of (gdata.studentIds||[])){
      students.push({id:sid, groupId:gid});
    }
  }
  const modal = document.createElement('div');
  modal.className = 'subject-modal';
  modal.innerHTML = `<h3>Журнал: ${data.name}</h3>`;
  for(const s of students){
    const u = await db.collection('users').doc(s.id).get();
    const uname = u.data().displayName;
    const row = document.createElement('div');
    row.className = 'grade-item';
    row.innerHTML = `<div>${uname} (${s.groupId})</div>
      <input placeholder="оценка" id="g-${s.id}" />
      <button data-sid="${s.id}">Поставить</button>`;
    row.querySelector('button').onclick = async (e) => {
      const val = document.getElementById('g-'+s.id).value;
      if (!val) { showAlert('Введите оценку'); return; }
      await db.collection('grades').add({
        studentId: s.id,
        subjectId,
        groupId: s.groupId,
        value: val,
        createdBy: auth.currentUser.uid,
        date: firebase.firestore.FieldValue.serverTimestamp()
      });
      showAlert('Оценка сохранена');
    };
    modal.appendChild(row);
  }
  document.body.appendChild(modal);
}

/* --- Student view --- */
async function loadStudentView(uid){
  const cont = document.getElementById('student-grades');
  cont.innerHTML = '<h3>Ваши оценки</h3>';
  const gradesSnap = await db.collection('grades').where('studentId','==',uid).get();
  gradesSnap.forEach(g => {
    const d = g.data();
    const el = document.createElement('div');
    el.className = 'grade-item';
    el.innerText = `${d.subjectId} — ${d.value} (${new Date(d.date?.toMillis?.()||Date.now()).toLocaleString()})`;
    cont.appendChild(el);
  });
}
