// Настройки репозитория (замени на свой!)
const OWNER = "ТВОЙ_GITHUB_LOGIN";
const REPO = "НАЗВАНИЕ_РЕПО";
const BRANCH = "main";

let token = null;
let user = null; // текущий юзер из users.json

// DOM элементы
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const tokenInput = document.getElementById("token");
const authSection = document.getElementById("auth");
const rolePanel = document.getElementById("role-panel");
const welcome = document.getElementById("welcome");

const adminPanel = document.getElementById("admin-panel");
const teacherPanel = document.getElementById("teacher-panel");
const studentPanel = document.getElementById("student-panel");
const alerts = document.getElementById("alerts");

function showAlert(msg) {
  alerts.innerText = msg;
  setTimeout(() => (alerts.innerText = ""), 5000);
}

// Авторизация через PAT
loginBtn.onclick = async () => {
  token = tokenInput.value.trim();
  if (!token.startsWith("ghp_") && !token.startsWith("github_pat_")) {
    showAlert("Введите корректный PAT");
    return;
  }

  // Читаем список пользователей
  try {
    const users = await readJSON("users.json");
    const ghUser = await fetch("https://api.github.com/user", {
      headers: { Authorization: `token ${token}` },
    }).then(r => r.json());

    user = users.find(u => u.github === ghUser.login);

    if (!user) {
      showAlert("Вы не зарегистрированы в системе!");
      return;
    }

    authSection.style.display = "none";
    rolePanel.style.display = "block";
    welcome.innerText = `Привет, ${user.name} (${user.role})`;

    if (user.role === "admin") {
      adminPanel.style.display = "block";
      loadAdminData();
    } else if (user.role === "teacher") {
      teacherPanel.style.display = "block";
      loadTeacherData();
    } else {
      studentPanel.style.display = "block";
      loadStudentData();
    }
  } catch (e) {
    showAlert("Ошибка: " + e.message);
  }
};

logoutBtn.onclick = () => {
  token = null;
  user = null;
  authSection.style.display = "block";
  rolePanel.style.display = "none";
};

// --- GitHub API: чтение файла ---
async function readJSON(path) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/data/${path}?ref=${BRANCH}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}` },
  });
  if (!res.ok) throw new Error("Не удалось прочитать " + path);
  const data = await res.json();
  return JSON.parse(atob(data.content));
}

// --- GitHub API: запись файла ---
async function writeJSON(path, obj, message = "update data") {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/data/${path}`;
  // Получаем sha текущей версии
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}` },
  });
  const file = await res.json();
  const sha = file.sha;

  const body = {
    message,
    content: btoa(JSON.stringify(obj, null, 2)),
    sha,
    branch: BRANCH,
  };

  const putRes = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!putRes.ok) throw new Error("Не удалось обновить " + path);
  showAlert("Файл обновлён: " + path);
}

// === Панели ===

// Админ
async function loadAdminData() {
  const groups = await readJSON("groups.json");
  const subjects = await readJSON("subjects.json");

  document.getElementById("admin-data").innerHTML =
    "<pre>" +
    JSON.stringify({ groups, subjects }, null, 2) +
    "</pre>";
}

// Преподаватель
async function loadTeacherData() {
  const grades = await readJSON("grades.json");
  const myGrades = grades.filter(g => g.teacher === user.github);

  document.getElementById("teacher-data").innerHTML =
    "<pre>" + JSON.stringify(myGrades, null, 2) + "</pre>";
}

// Ученик
async function loadStudentData() {
  const grades = await readJSON("grades.json");
  const myGrades = grades.filter(g => g.student === user.github);

  document.getElementById("student-data").innerHTML =
    "<pre>" + JSON.stringify(myGrades, null, 2) + "</pre>";
}
