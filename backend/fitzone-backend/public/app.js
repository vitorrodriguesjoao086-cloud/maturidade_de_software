const API_BASE = "";
const state = {
  token: localStorage.getItem("fitzone_token"),
  user: JSON.parse(localStorage.getItem("fitzone_user") || "null"),
  plans: [],
  exercises: [],
  students: [],
  activePlan: null,
  exerciseGroup: "Todos",
  studentQuery: "",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("Não foi possível conectar à API. Confira se o servidor está ativo.");
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("A API retornou uma resposta inválida.");
  }
  if (!response.ok || body.success === false) {
    if (response.status === 401 && state.token) clearSession();
    throw new Error(body.error?.message || "Não foi possível concluir a solicitação.");
  }
  return body.data;
}

function clearSession() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("fitzone_token");
  localStorage.removeItem("fitzone_user");
  showAuth();
}

function toast(message, type = "success") {
  const node = document.createElement("div");
  node.className = `toast ${type === "error" ? "error" : ""}`;
  node.textContent = message;
  $("#toast-region").append(node);
  window.setTimeout(() => node.remove(), 4000);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "F";
}

function dateLabel(value) {
  if (!value) return "Sem data";
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? "Sem data" : new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(date);
}

function displayRole(role) {
  return role === "teacher" ? "Professor(a)" : "Aluno(a)";
}

function statusLabel(status) {
  return ({ active: "Ativo", draft: "Rascunho", archived: "Arquivado" })[status] || status || "Rascunho";
}

function showAuth() {
  $("#auth-screen").classList.remove("hidden");
  $("#app-screen").classList.add("hidden");
}

function showApp() {
  if (!state.user || !state.token) return showAuth();
  $("#auth-screen").classList.add("hidden");
  $("#app-screen").classList.remove("hidden");
  $("#sidebar-name").textContent = state.user.name;
  $("#sidebar-role").textContent = displayRole(state.user.role);
  $("#sidebar-avatar").textContent = initials(state.user.name);
  $("#topbar-avatar").textContent = initials(state.user.name);
  $$(".teacher-only").forEach((node) => node.classList.toggle("hidden", state.user.role !== "teacher"));
  $("#welcome-title").innerHTML = `Olá, ${escapeHtml(state.user.name.split(/\s+/)[0])} <span class="wave">✳</span>`;
  $("#welcome-subtitle").textContent = state.user.role === "teacher" ? "Acompanhe seus alunos e ajude cada um a evoluir." : "Pronto para dar o próximo passo hoje?";
  $("#today-date").textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date());
  $("#welcome-eyebrow").textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date()).toUpperCase();
  loadDashboard().catch((error) => toast(error.message, "error"));
}

async function loadDashboard() {
  const requests = [api("/plans"), api("/exercises")];
  if (state.user.role === "teacher") requests.push(api("/students"));
  const [plans, exercises, students = []] = await Promise.all(requests);
  state.plans = plans;
  state.exercises = exercises;
  state.students = students;
  renderOverview();
  renderPlans();
  renderExercises();
  if (state.user.role === "teacher") renderStudents();
}

function statCard(icon, label, value, caption) {
  return `<article class="stat-card"><div class="stat-icon">${icon}</div><div><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-caption">${caption}</div></div></article>`;
}

function renderOverview() {
  const active = state.plans.filter((plan) => plan.status === "active").length;
  const studentsCount = state.user.role === "teacher" ? state.students.length : null;
  $("#stats-grid").innerHTML = state.user.role === "teacher"
    ? [statCard("▤", "Planos criados", state.plans.length, "Na sua jornada de ensino"), statCard("♧", "Alunos ativos", studentsCount, "Pessoas acompanhadas"), statCard("✳", "Planos ativos", active, "Prontos para evoluir")].join("")
    : [statCard("▤", "Meus treinos", state.plans.length, "Planos na sua jornada"), statCard("✳", "Treinos ativos", active, "Prontos para começar"), statCard("◉", "Exercícios", state.exercises.length, "No catálogo FitZone")].join("");
  const recent = state.plans.slice(0, 4);
  $("#recent-plans").innerHTML = recent.length ? recent.map((plan) => `
    <div class="plan-row" data-plan-id="${plan.id}">
      <div class="plan-symbol">✳</div><div class="plan-row-copy"><div class="plan-row-title">${escapeHtml(plan.name)}</div><div class="plan-row-subtitle">${escapeHtml(plan.goal || plan.student_name || "Seu plano de treino")} · ${dateLabel(plan.updated_at || plan.created_at)}</div></div>
      <span class="status-pill ${escapeHtml(plan.status)}">${escapeHtml(statusLabel(plan.status))}</span>
    </div>`).join("") : `<div class="empty-state"><p>Seus treinos aparecerão aqui.</p><button class="link-button" data-action="create-plan">Criar primeiro treino →</button></div>`;
}

function renderPlans() {
  $("#plans-grid").innerHTML = state.plans.map((plan) => `
    <article class="workout-card" data-plan-id="${plan.id}" tabindex="0" role="button" aria-label="Abrir treino ${escapeHtml(plan.name)}">
      <div class="workout-card-top"><div class="workout-card-symbol">✳</div><span class="status-pill ${escapeHtml(plan.status)}">${escapeHtml(statusLabel(plan.status))}</span></div>
      <h3>${escapeHtml(plan.name)}</h3><p>${escapeHtml(plan.description || plan.goal || "Um plano feito para sua evolução.")}</p>
      <div class="workout-meta"><span>◎ ${escapeHtml(plan.goal || "Treino personalizado")}</span><span>·</span><span>${dateLabel(plan.updated_at || plan.created_at)}</span>${state.user.role === "teacher" && plan.student_name ? `<span>· ${escapeHtml(plan.student_name)}</span>` : ""}</div>
    </article>`).join("");
  $("#plans-empty").classList.toggle("hidden", state.plans.length > 0);
}

function renderStudents() {
  const filtered = state.students.filter((student) => {
    const query = state.studentQuery.toLowerCase();
    return !query || `${student.name} ${student.email}`.toLowerCase().includes(query);
  });
  $("#student-count").textContent = `${state.students.length} ${state.students.length === 1 ? "aluno" : "alunos"}`;
  $("#students-empty").classList.toggle("hidden", state.students.length > 0);
  $("#students-table").innerHTML = filtered.map((student) => `
    <tr><td><div class="student-name-cell"><span class="student-avatar">${initials(student.name)}</span><strong>${escapeHtml(student.name)}</strong></div></td>
    <td>${escapeHtml(student.email)}</td><td>${escapeHtml(student.phone || "—")}</td><td>${state.plans.filter((plan) => Number(plan.user_id) === Number(student.id)).length}</td>
    <td><button class="table-action" data-student-id="${student.id}">Criar treino →</button></td></tr>`).join("");
  if (!filtered.length && state.students.length) $("#students-table").innerHTML = `<tr><td colspan="5" class="text-muted">Nenhum aluno encontrado.</td></tr>`;
}

function renderExercises() {
  const groups = ["Todos", ...new Set(state.exercises.map((exercise) => exercise.muscle_group))];
  $("#exercise-filters").innerHTML = groups.map((group) => `<button class="filter-chip ${state.exerciseGroup === group ? "active" : ""}" data-group="${escapeHtml(group)}">${escapeHtml(group)}</button>`).join("");
  const filtered = state.exerciseGroup === "Todos" ? state.exercises : state.exercises.filter((exercise) => exercise.muscle_group === state.exerciseGroup);
  $("#exercise-count").textContent = `${filtered.length} ${filtered.length === 1 ? "EXERCÍCIO" : "EXERCÍCIOS"}`;
  $("#exercises-grid").innerHTML = filtered.map((exercise, index) => `
    <article class="exercise-card"><div class="exercise-card-top"><span class="exercise-group">${escapeHtml(exercise.muscle_group)}</span><span class="exercise-number">${String(index + 1).padStart(2, "0")}</span></div><h3>${escapeHtml(exercise.name)}</h3><p>${escapeHtml(exercise.description || "Movimento para sua rotina de treino.")}</p></article>`).join("");
}

function navigate(view) {
  const allowed = ["overview", "plans", "students", "exercises"];
  if (!allowed.includes(view) || (view === "students" && state.user.role !== "teacher")) return;
  $$(".view-section").forEach((section) => section.classList.toggle("hidden", section.id !== `view-${view}`));
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  const labels = { overview: "Visão geral", plans: "Meus treinos", students: "Alunos", exercises: "Exercícios" };
  $("#breadcrumb-current").textContent = labels[view];
  $("#sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setAuthMode(register) {
  $("#login-form").classList.toggle("hidden", register);
  $("#register-form").classList.toggle("hidden", !register);
  $("#auth-title").textContent = register ? "Crie sua conta" : "Entre na sua conta";
  $("#auth-eyebrow").textContent = register ? "VAMOS COMEÇAR SUA JORNADA" : "BOM TER VOCÊ DE VOLTA";
  $("#auth-subtitle").textContent = register ? "Sua próxima fase começa com um primeiro passo." : "Acesse seus treinos e continue evoluindo.";
  $("#auth-switch-copy").textContent = register ? "Já tem uma conta?" : "Ainda não tem uma conta?";
  $("#auth-switch").textContent = register ? "Entrar" : "Criar conta";
}

function persistSession(data) {
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem("fitzone_token", state.token);
  localStorage.setItem("fitzone_user", JSON.stringify(state.user));
  showApp();
}

async function logout(notify = true) {
  try {
    if (state.token) await api("/auth/logout", { method: "POST", body: "{}" });
  } catch (error) {
    if (notify) toast(error.message, "error");
  }
  clearSession();
  if (notify) toast("Você saiu da sua conta.");
}

function openPlanDialog(studentId = "") {
  const form = $("#plan-form");
  form.reset();
  form.elements.id.value = "";
  $("#plan-dialog-title").textContent = "Criar treino";
  if (state.user.role === "teacher") {
    $("#plan-student-field").classList.remove("hidden");
    $("#plan-student").innerHTML = state.students.map((student) => `<option value="${student.id}" ${String(student.id) === String(studentId) ? "selected" : ""}>${escapeHtml(student.name)}</option>`).join("");
    if (!state.students.length) {
      toast("Cadastre um aluno antes de criar um treino.", "error");
      return;
    }
  }
  $("#plan-dialog").showModal();
}

async function openPlan(planId) {
  try {
    const plan = await api(`/plans/${planId}`);
    state.activePlan = plan;
    renderPlanDetail(plan);
    $("#detail-dialog").showModal();
  } catch (error) {
    toast(error.message, "error");
  }
}

function renderPlanDetail(plan) {
  const canEdit = true;
  const exerciseRows = (plan.exercises || []).map((exercise) => `
    <div class="detail-exercise"><div class="plan-symbol">◉</div><div class="detail-exercise-copy"><strong>${escapeHtml(exercise.name)}</strong><span>${escapeHtml(exercise.muscle_group)} · Dia ${exercise.day} · ${exercise.sets ? `${exercise.sets} séries` : "Séries a definir"}${exercise.repetitions ? ` · ${escapeHtml(exercise.repetitions)} repetições` : ""}${exercise.rest_seconds ? ` · ${exercise.rest_seconds}s descanso` : ""}</span></div>
    ${canEdit ? `<button class="remove-exercise" data-remove-exercise="${exercise.id}" title="Remover exercício" aria-label="Remover ${escapeHtml(exercise.name)}">×</button>` : ""}</div>`).join("");
  const selectOptions = state.exercises.map((exercise) => `<option value="${exercise.id}">${escapeHtml(exercise.name)} · ${escapeHtml(exercise.muscle_group)}</option>`).join("");
  $("#plan-detail").innerHTML = `
    <div class="detail-content"><div class="detail-top"><div><span class="eyebrow">SEU PLANO DE TREINO</span><h2 class="detail-title">${escapeHtml(plan.name)}</h2><p class="detail-description">${escapeHtml(plan.description || plan.goal || "Um plano feito para sua evolução.")}</p></div>
      <div class="detail-actions"><button class="small-button" data-edit-plan="${plan.id}">Editar plano</button><button class="icon-button modal-close" data-close-dialog aria-label="Fechar">×</button></div></div>
      <div class="detail-meta"><span>◎ ${escapeHtml(plan.goal || "Objetivo não definido")}</span><span class="status-pill ${escapeHtml(plan.status)}">${escapeHtml(statusLabel(plan.status))}</span>${plan.student_name ? `<span>Aluno: ${escapeHtml(plan.student_name)}</span>` : ""}</div>
      <div class="detail-section-heading"><h3>Exercícios do treino</h3><span class="section-date">${(plan.exercises || []).length} MOVIMENTOS</span></div>
      ${exerciseRows || `<p class="detail-description">Nenhum exercício adicionado ainda. Escolha alguns movimentos para montar seu treino.</p>`}
      <form id="add-exercise-form" class="exercise-form"><h4>Adicionar exercício</h4><div class="exercise-form-grid">
        <label>Exercício<select name="exercise_id" required>${selectOptions}</select></label><label>Dia<input name="day" type="number" min="1" max="7" value="1"></label><label>Séries<input name="sets" type="number" min="1" placeholder="3"></label><label>Repetições<input name="repetitions" placeholder="8-12"></label>
      </div><button class="button button-primary" type="submit">Adicionar ao treino <span>→</span></button></form>
    </div>`;
}

function editPlan(plan) {
  const form = $("#plan-form");
  form.reset();
  form.elements.id.value = plan.id;
  form.elements.name.value = plan.name;
  form.elements.goal.value = plan.goal || "";
  form.elements.description.value = plan.description || "";
  form.elements.status.value = plan.status || "draft";
  $("#plan-student-field").classList.add("hidden");
  $("#plan-dialog-title").textContent = "Editar treino";
  $("#detail-dialog").close();
  $("#plan-dialog").showModal();
}

$("#auth-switch").addEventListener("click", () => setAuthMode($("#register-form").classList.contains("hidden")));
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const button = $("button[type=submit]", event.currentTarget);
  button.disabled = true;
  try {
    const data = await api("/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    persistSession(data);
  } catch (error) {
    toast(error.message, "error");
  } finally {
    button.disabled = false;
  }
});
$("#register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const button = $("button[type=submit]", event.currentTarget);
  button.disabled = true;
  try {
    await api("/auth/register", { method: "POST", body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password"), role: form.get("role") }) });
    const data = await api("/auth/login", { method: "POST", body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
    persistSession(data);
    toast("Conta criada. Vamos começar sua jornada!");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    button.disabled = false;
  }
});
$("#logout-button").addEventListener("click", () => logout());
$("#menu-toggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
$("#create-plan-button").addEventListener("click", () => openPlanDialog());
$("#create-plan-button-secondary").addEventListener("click", () => openPlanDialog());
$("#student-search").addEventListener("input", (event) => { state.studentQuery = event.target.value; renderStudents(); });

document.addEventListener("click", async (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    event.preventDefault();
    navigate(viewButton.dataset.view);
  }
  const createButton = event.target.closest('[data-action="create-plan"]');
  if (createButton) openPlanDialog();
  const card = event.target.closest("[data-plan-id]");
  if (card && !event.target.closest("button")) openPlan(card.dataset.planId);
  const group = event.target.closest("[data-group]");
  if (group) {
    state.exerciseGroup = group.dataset.group;
    renderExercises();
  }
  const studentButton = event.target.closest("[data-student-id]");
  if (studentButton) {
    const studentId = studentButton.dataset.studentId;
    openPlanDialog(studentId);
  }
  const editButton = event.target.closest("[data-edit-plan]");
  if (editButton && state.activePlan) editPlan(state.activePlan);
  const removeButton = event.target.closest("[data-remove-exercise]");
  if (removeButton && state.activePlan) {
    try {
      const updated = await api(`/plans/${state.activePlan.id}/exercises/${removeButton.dataset.removeExercise}`, { method: "DELETE" });
      state.activePlan = updated;
      renderPlanDetail(updated);
      state.plans = await api("/plans");
      renderPlans();
      renderOverview();
      toast("Exercício removido do treino.");
    } catch (error) { toast(error.message, "error"); }
  }
  if (event.target.closest("[data-close-dialog]")) {
    $("#plan-dialog").close();
    $("#detail-dialog").close();
  }
});

$("#plan-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const id = form.get("id");
  const payload = {
    name: form.get("name"),
    goal: form.get("goal"),
    description: form.get("description"),
    status: form.get("status"),
  };
  if (state.user.role === "teacher" && !id) payload.user_id = Number(form.get("user_id"));
  try {
    if (id) await api(`/plans/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await api("/plans", { method: "POST", body: JSON.stringify(payload) });
    $("#plan-dialog").close();
    await loadDashboard();
    toast(id ? "Treino atualizado com sucesso." : "Treino criado com sucesso.");
  } catch (error) { toast(error.message, "error"); }
});

document.addEventListener("submit", async (event) => {
  if (event.target.id !== "add-exercise-form" || !state.activePlan) return;
  event.preventDefault();
  const data = new FormData(event.target);
  const payload = {
    exercise_id: Number(data.get("exercise_id")),
    day: Number(data.get("day") || 1),
    sets: data.get("sets") ? Number(data.get("sets")) : null,
    repetitions: data.get("repetitions") || null,
    position: (state.activePlan.exercises || []).length + 1,
  };
  try {
    const updated = await api(`/plans/${state.activePlan.id}/exercises`, { method: "POST", body: JSON.stringify(payload) });
    state.activePlan = updated;
    renderPlanDetail(updated);
    state.plans = await api("/plans");
    renderPlans();
    renderOverview();
    toast("Exercício adicionado ao treino.");
  } catch (error) { toast(error.message, "error"); }
});

document.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".workout-card")) {
    event.preventDefault();
    openPlan(event.target.dataset.planId);
  }
});

async function initialize() {
  $("#copyright-year").textContent = new Date().getFullYear();
  if (!state.token || !state.user) return showAuth();
  try {
    state.user = await api("/me");
    localStorage.setItem("fitzone_user", JSON.stringify(state.user));
    showApp();
  } catch {
    state.token = null;
    state.user = null;
    localStorage.removeItem("fitzone_token");
    localStorage.removeItem("fitzone_user");
    showAuth();
  }
}

initialize();
