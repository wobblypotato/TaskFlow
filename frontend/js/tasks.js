let currentTasks = [];
let activeTagFilter = null;
let activeScope = 'workspace'; // 'workspace' or 'my'
let editingTaskId = null;
let activeDrawerTaskId = null;
let activeTab = 'overview';
let currentPage = 1;
let totalPages = 1;
let onlineUsers = [];
let taskViewersMap = {}; // taskId -> array of viewer names
let notifications = [];
let socketInstance = null;

const tasksGrid = document.getElementById('tasks-grid');
const searchInput = document.getElementById('search-input');
const statusFilter = document.getElementById('status-filter');
const priorityFilter = document.getElementById('priority-filter');
const sortBySelect = document.getElementById('sort-by');
const activeTagBanner = document.getElementById('active-tag-banner');
const activeTagName = document.getElementById('active-tag-name');
const clearTagBtn = document.getElementById('clear-tag-btn');
const activeFiltersBar = document.getElementById('active-filters-bar');
const activeFilterChips = document.getElementById('active-filter-chips');

const statTotal = document.getElementById('stat-total');
const statCompleted = document.getElementById('stat-completed');
const statPending = document.getElementById('stat-pending');
const statOverdue = document.getElementById('stat-overdue');
const statCompletionRate = document.getElementById('stat-completion-rate');

const taskModal = document.getElementById('task-modal');
const modalTitle = document.getElementById('modal-title');
const taskForm = document.getElementById('task-form');
const taskIdInput = document.getElementById('task-id');
const taskTitleInput = document.getElementById('task-title');
const taskDescInput = document.getElementById('task-desc');
const taskStatusInput = document.getElementById('task-status');
const taskPriorityInput = document.getElementById('task-priority');
const taskTagsInput = document.getElementById('task-tags');
const taskDueDateInput = document.getElementById('task-due-date');
const taskReminderPreset = document.getElementById('task-reminder-preset');
const taskReminderInput = document.getElementById('task-reminder');
const customReminderContainer = document.getElementById('custom-reminder-container');
const taskRepeatInput = document.getElementById('task-repeat');
const closeModalBtn = document.getElementById('modal-close-btn');
const cancelModalBtn = document.getElementById('modal-cancel-btn');
const openCreateModalBtn = document.getElementById('open-create-modal-btn');

const taskDrawerBackdrop = document.getElementById('task-drawer-backdrop');
const taskDrawer = document.getElementById('task-drawer');
const drawerCloseBtn = document.getElementById('drawer-close-btn');
const drawerViewersBar = document.getElementById('drawer-viewers-bar');
const drawerViewersText = document.getElementById('drawer-viewers-text');
const drawerPriorityBadge = document.getElementById('drawer-priority-badge');
const drawerStatusBadge = document.getElementById('drawer-status-badge');
const drawerTaskTitle = document.getElementById('drawer-task-title');
const drawerTaskDesc = document.getElementById('drawer-task-desc');
const drawerStatusSelect = document.getElementById('drawer-status-select');
const drawerPrioritySelect = document.getElementById('drawer-priority-select');
const drawerDueDate = document.getElementById('drawer-due-date');
const drawerCreator = document.getElementById('drawer-creator');
const drawerReminder = document.getElementById('drawer-reminder');
const drawerRepeat = document.getElementById('drawer-repeat');
const drawerTagsContainer = document.getElementById('drawer-tags-container');
const drawerTimestamps = document.getElementById('drawer-timestamps');
const drawerCommentsCount = document.getElementById('drawer-comments-count');
const drawerCommentsList = document.getElementById('drawer-comments-list');
const drawerCommentForm = document.getElementById('drawer-comment-form');
const drawerCommentInput = document.getElementById('drawer-comment-input');
const drawerTaskHistory = document.getElementById('drawer-task-history');
const drawerToggleCompleteBtn = document.getElementById('drawer-toggle-complete-btn');
const drawerEditBtn = document.getElementById('drawer-edit-btn');
const drawerDeleteBtn = document.getElementById('drawer-delete-btn');

const presenceToggleBtn = document.getElementById('presence-toggle-btn');
const presenceDropdown = document.getElementById('presence-dropdown');
const onlineCountText = document.getElementById('online-count-text');
const onlineUsersList = document.getElementById('online-users-list');
const notifToggleBtn = document.getElementById('notif-toggle-btn');
const notificationsDropdown = document.getElementById('notifications-dropdown');
const notifCountBadge = document.getElementById('notif-count-badge');
const notificationsList = document.getElementById('notifications-list');
const clearNotifsBtn = document.getElementById('clear-notifs-btn');

async function checkDbHealth() {
  try {
    const health = await api.get('/health');
    const dbBanner = document.getElementById('db-status-banner');
    if (dbBanner) {
      dbBanner.style.display = health?.database === 'connected' ? 'none' : 'block';
    }
  } catch {
    const dbBanner = document.getElementById('db-status-banner');
    if (dbBanner) dbBanner.style.display = 'block';
  }
}

function updateHeaderGreetingAndDate(user) {
  const now = new Date();
  const hour = now.getHours();
  const greetingTime = hour < 12 ? 'GOOD MORNING' : hour < 18 ? 'GOOD AFTERNOON' : 'GOOD EVENING';
  const displayName = user?.name ? user.name.toUpperCase() : 'MOKSH';

  const userNameEl = document.getElementById('user-name');
  const userAvatarInitial = document.getElementById('user-avatar-initial');
  const userAvatarImage = document.getElementById('user-avatar-image');
  const heroGreetingEl = document.getElementById('hero-greeting');
  const currentDateEl = document.getElementById('current-date-text');

  if (userNameEl && user?.name) userNameEl.textContent = user.name;
  setAvatarDisplay(userAvatarInitial, userAvatarImage, user?.name, user?.avatar);
  if (heroGreetingEl) heroGreetingEl.textContent = `${greetingTime}, ${displayName}`;

  if (currentDateEl) {
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    const dayNum = now.getDate();
    const monthName = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const year = now.getFullYear();
    currentDateEl.textContent = `${dayName}, ${dayNum} ${monthName} ${year}`;
  }
}

function setAvatarDisplay(initialElement, imageElement, name, avatar) {
  if (initialElement) initialElement.textContent = name?.charAt(0).toUpperCase() || 'U';
  if (!imageElement) return;

  const hasAvatar = typeof avatar === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(avatar);
  imageElement.hidden = !hasAvatar;
  if (hasAvatar) imageElement.src = avatar;
  else imageElement.removeAttribute('src');
  if (initialElement) initialElement.hidden = hasAvatar;
}

function setupProfileMenu() {
  const menuToggle = document.getElementById('profile-menu-toggle');
  const menuDropdown = document.getElementById('profile-menu-dropdown');
  const editButton = document.getElementById('edit-profile-btn');
  const modal = document.getElementById('profile-modal');
  const form = document.getElementById('profile-form');
  const nameInput = document.getElementById('profile-name');
  const emailInput = document.getElementById('profile-email');
  const passwordInput = document.getElementById('profile-password');
  const fileInput = document.getElementById('profile-avatar-file');
  const errorElement = document.getElementById('profile-error');
  const saveButton = document.getElementById('profile-save-btn');
  const closeButtons = [
    document.getElementById('profile-modal-close'),
    document.getElementById('profile-modal-cancel')
  ];
  const removeAvatarButton = document.getElementById('profile-avatar-remove');
  let selectedAvatar;

  if (!menuToggle || !menuDropdown || !modal || !form) return;

  const closeMenu = () => {
    menuDropdown.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
  };
  const closeModal = () => modal.classList.remove('active');
  const displayAvatar = (name, avatar) => {
    setAvatarDisplay(
      document.getElementById('profile-avatar-initial'),
      document.getElementById('profile-avatar-image'),
      name,
      avatar
    );
  };

  menuToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const opening = menuDropdown.hidden;
    closeAllHeaderDropdowns();
    menuDropdown.hidden = !opening;
    menuToggle.setAttribute('aria-expanded', String(opening));
  });
  menuDropdown.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', closeMenu);

  if (editButton) {
    editButton.addEventListener('click', () => {
      const user = auth.getUser() || {};
      form.reset();
      nameInput.value = user.name || '';
      emailInput.value = user.email || '';
      selectedAvatar = undefined;
      displayAvatar(user.name, user.avatar);
      if (errorElement) errorElement.hidden = true;
      closeMenu();
      modal.classList.add('active');
      nameInput.focus();
    });
  }

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
      fileInput.value = '';
      if (errorElement) {
        errorElement.textContent = 'Choose a PNG, JPEG, or WebP image no larger than 1 MB.';
        errorElement.hidden = false;
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      selectedAvatar = reader.result;
      displayAvatar(auth.getUser()?.name, selectedAvatar);
      if (errorElement) errorElement.hidden = true;
    };
    reader.onerror = () => {
      if (errorElement) {
        errorElement.textContent = 'The selected image could not be read.';
        errorElement.hidden = false;
      }
    };
    reader.readAsDataURL(file);
  });

  removeAvatarButton?.addEventListener('click', () => {
    selectedAvatar = null;
    fileInput.value = '';
    displayAvatar(nameInput.value, null);
  });

  closeButtons.forEach((button) => button?.addEventListener('click', closeModal));
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (errorElement) errorElement.hidden = true;
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    const payload = {
      name: nameInput.value.trim(),
      email: emailInput.value.trim()
    };
    if (passwordInput.value) payload.password = passwordInput.value;
    if (selectedAvatar !== undefined) payload.avatar = selectedAvatar;

    try {
      const result = await api.patch('/auth/me', payload);
      auth.setSession(auth.getToken(), result.user);
      updateHeaderGreetingAndDate(result.user);
      passwordInput.value = '';
      closeModal();
      showToast('Profile updated');
    } catch (error) {
      if (errorElement) {
        errorElement.textContent = error.message || 'Could not update profile.';
        errorElement.hidden = false;
      }
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save profile';
    }
  });
}

async function initDashboard() {
  const user = auth.getUser();
  updateHeaderGreetingAndDate(user);

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      auth.logout();
    });
  }

  await checkDbHealth();

  setupNavigationTabs();
  setupHeaderDropdowns();
  setupProfileMenu();
  setupEventListeners();
  setupKeyboardShortcuts();
  setupDrawerListeners();
  setupInviteModalListeners();

  initSocketIO();

  await refreshAllData();
  await loadUserInvitations();
}

async function refreshAllData() {
  await Promise.all([
    loadDashboardStats(),
    loadTasks(),
    loadDashboardWidgets()
  ]);

  if (activeTab === 'activity') loadFullActivity();
  if (activeTab === 'team') loadTeamMembers();
}

function initSocketIO() {
  if (!window.io || !auth.getToken()) return;

  const socketUrl = (window.__APP_CONFIG__ && window.__APP_CONFIG__.SOCKET_URL !== undefined)
    ? window.__APP_CONFIG__.SOCKET_URL
    : (window.location.protocol === 'file:' ? 'http://localhost:5000' : undefined);

  const socket = window.io(socketUrl, {
    auth: { token: auth.getToken() },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000
  });
  socketInstance = socket;

  const rejoinRooms = () => {
    const wsId = currentWorkspaceInfo?._id || currentWorkspaceInfo?.id;
    if (wsId) {
      socket.emit('workspace:join', wsId);
    }
    if (activeDrawerTaskId) {
      socket.emit('task:join', activeDrawerTaskId);
    }
  };

  const setReconnectingState = () => {
    if (onlineCountText) {
      onlineCountText.textContent = 'Reconnecting...';
    }
    const presenceToggle = document.getElementById('presence-toggle-btn');
    if (presenceToggle) presenceToggle.classList.add('is-reconnecting');
  };

  const clearReconnectingState = () => {
    const presenceToggle = document.getElementById('presence-toggle-btn');
    if (presenceToggle) presenceToggle.classList.remove('is-reconnecting');
    updatePresenceUI();
  };

  socket.on('connect', () => {
    clearReconnectingState();
    rejoinRooms();
  });

  socket.io.on('reconnect', () => {
    clearReconnectingState();
    rejoinRooms();
    loadDashboardStats();
    loadTasks();
  });

  socket.on('disconnect', (reason) => {
    if (reason !== 'io client disconnect') {
      setReconnectingState();
    }
  });

  socket.on('connect_error', () => {
    setReconnectingState();
  });

  socket.io.on('reconnect_attempt', () => {
    setReconnectingState();
  });

  socket.on('presence:online-users', (users) => {
    onlineUsers = Array.isArray(users) ? users : [];
    updatePresenceUI();
  });

  socket.on('task:viewers', ({ taskId, viewers }) => {
    taskViewersMap[taskId] = viewers || [];
    if (activeDrawerTaskId === taskId) {
      updateDrawerViewers(viewers);
    }
    updateCardPresenceTag(taskId, viewers);
  });

  socket.on('task:created', async (task) => {
    const currentUser = auth.getUser();
    if (task.originatorId && task.originatorId !== currentUser?._id && task.originatorId !== currentUser?.id) {
      showToast(`Task created: "${task.title}"`);
    }
    await loadDashboardStats();
    await loadTasks();
    await loadDashboardWidgets();
  });

  socket.on('task:updated', async (task) => {
    if (activeDrawerTaskId === task._id) {
      renderTaskDrawerDetails(task);
    }
    await loadDashboardStats();
    await loadTasks();
    await loadDashboardWidgets();
  });

  socket.on('task:deleted', async (payload) => {
    if (activeDrawerTaskId === payload._id) {
      closeTaskDrawer();
      showToast('Task removed from workspace');
    }
    await loadDashboardStats();
    await loadTasks();
    await loadDashboardWidgets();
  });

  socket.on('comment:created', (comment) => {
    if (activeDrawerTaskId === comment.taskId) {
      appendCommentToDrawer(comment);
    }
  });

  socket.on('comment:deleted', ({ id, taskId }) => {
    if (activeDrawerTaskId === taskId) {
      const el = document.getElementById(`comment-${id}`);
      if (el) el.remove();
      updateDrawerCommentsCount();
    }
  });

  socket.on('task:comment-count', ({ taskId, delta }) => {
    const task = currentTasks.find((t) => t._id === taskId);
    if (task) {
      task.commentsCount = Math.max(0, (task.commentsCount || 0) + delta);
      const countEl = document.querySelector(`#task-${taskId} .task-comment-count`);
      if (countEl) countEl.innerHTML = `💬 ${task.commentsCount}`;
    }
  });

  socket.on('notification:new', (notif) => {
    const currentUser = auth.getUser();
    if (notif.originatorId && (notif.originatorId === currentUser?._id || notif.originatorId === currentUser?.id)) {
      return;
    }
    addNotification(notif);
  });

  socket.on('workspace:member-joined', () => {
    if (activeTab === 'team') loadTeamMembers();
  });

  socket.on('invitation:received', (invitation) => {
    loadUserInvitations();
    showToast(`You've been invited to ${invitation.workspaceId?.name || 'TaskFlow Workspace'}`);
  });
}

function updatePresenceUI() {
  const presenceToggle = document.getElementById('presence-toggle-btn');
  const isReconnecting = presenceToggle && presenceToggle.classList.contains('is-reconnecting');
  const count = onlineUsers.length;
  if (onlineCountText && !isReconnecting) {
    onlineCountText.textContent = `${count} online`;
  }

  if (onlineUsersList) {
    const currentUser = auth.getUser();
    if (!onlineUsers.length) {
      onlineUsersList.innerHTML = '<li class="flyout-empty">No other users online</li>';
    } else {
      onlineUsersList.innerHTML = onlineUsers
        .map((u) => {
          const isYou = u.id === currentUser?._id || u.id === currentUser?.id || u.email === currentUser?.email;
          const initial = (u.name || 'U').charAt(0).toUpperCase();
          return `
            <li class="flyout-item">
              <span class="user-avatar-initial" style="width:18px;height:18px;font-size:0.6rem;">${escapeHtml(initial)}</span>
              <div style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                <span style="color:var(--text-primary);font-weight:500;">${escapeHtml(u.name || 'Member')}</span>
                ${isYou ? '<span style="color:var(--text-muted);font-size:0.7rem;margin-left:0.25rem;">(You)</span>' : ''}
              </div>
              <span class="dot-online"></span>
            </li>
          `;
        })
        .join('');
    }
  }

  if (activeTab === 'team') loadTeamMembers();
}

function addNotification(notif) {
  notifications.unshift(notif);
  if (notifications.length > 25) notifications.pop();

  if (notifCountBadge) notifCountBadge.style.display = 'block';
  renderNotificationsList();
  showToast(notif.message);
}

function renderNotificationsList() {
  if (!notificationsList) return;
  if (!notifications.length) {
    notificationsList.innerHTML = '<div class="flyout-empty">No unread notifications</div>';
    return;
  }

  notificationsList.innerHTML = notifications
    .map((n) => `
      <div class="flyout-item" style="flex-direction:column;align-items:flex-start;gap:0.2rem;cursor:pointer;" onclick="handleNotificationClick('${n.taskId || ''}', '${n.type || ''}')">
        <div style="font-size:0.8rem;color:var(--text-primary);line-height:1.3;">${escapeHtml(n.message)}</div>
        <div style="font-family:var(--font-mono);font-size:0.68rem;color:var(--text-muted);">${formatRelativeTime(n.createdAt)}</div>
      </div>
    `)
    .join('');
}

function handleNotificationClick(taskId, notifType) {
  if (notificationsDropdown) notificationsDropdown.style.display = 'none';
  if (notifType === 'workspace:invitation' || notifType === 'workspace:member-joined') {
    switchToTab('team');
    return;
  }
  if (taskId) openTaskDrawer(taskId);
}

function setupNavigationTabs() {
  const tabs = ['overview', 'tasks', 'analytics', 'activity', 'team'];

  tabs.forEach((key) => {
    const btn = document.getElementById(`tab-${key}`);
    if (btn) {
      btn.addEventListener('click', () => switchToTab(key));
    }
  });
}

function switchToTab(key) {
  activeTab = key;
  const tabs = ['overview', 'tasks', 'analytics', 'activity', 'team'];

  tabs.forEach((t) => {
    const btn = document.getElementById(`tab-${t}`);
    const view = document.getElementById(`view-${t}`);
    const isActive = t === key;

    if (btn) {
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    }
    if (view) {
      view.style.display = isActive ? 'block' : 'none';
    }
  });

  if (key === 'activity') loadFullActivity();
  if (key === 'team') loadTeamMembers();
  if (key === 'analytics') {
    const activityPanel = document.getElementById('activity-panel');
    if (activityPanel && !activityPanel.open) {
      activityPanel.open = true;
      activityPanel.dispatchEvent(new Event('toggle'));
    }
  }
}

function setupHeaderDropdowns() {
  if (presenceToggleBtn && presenceDropdown) {
    presenceToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = presenceDropdown.style.display === 'block';
      closeAllHeaderDropdowns();
      presenceDropdown.style.display = isVisible ? 'none' : 'block';
    });
  }

  if (notifToggleBtn && notificationsDropdown) {
    notifToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = notificationsDropdown.style.display === 'block';
      closeAllHeaderDropdowns();
      notificationsDropdown.style.display = isVisible ? 'none' : 'block';
      if (!isVisible && notifCountBadge) notifCountBadge.style.display = 'none';
    });
  }

  if (clearNotifsBtn) {
    clearNotifsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifications = [];
      if (notifCountBadge) notifCountBadge.style.display = 'none';
      renderNotificationsList();
    });
  }

  document.addEventListener('click', () => closeAllHeaderDropdowns());
}

function closeAllHeaderDropdowns() {
  if (presenceDropdown) presenceDropdown.style.display = 'none';
  if (notificationsDropdown) notificationsDropdown.style.display = 'none';
  const profileDropdown = document.getElementById('profile-menu-dropdown');
  const profileToggle = document.getElementById('profile-menu-toggle');
  if (profileDropdown) profileDropdown.hidden = true;
  if (profileToggle) profileToggle.setAttribute('aria-expanded', 'false');
}

async function loadDashboardStats() {
  try {
    const scopeParam = activeScope === 'my' ? '?scope=my' : '?scope=workspace';
    const stats = await api.get(`/tasks/stats${scopeParam}`);

    if (statTotal) statTotal.textContent = stats.total ?? 0;
    if (statCompleted) statCompleted.textContent = stats.completed ?? 0;
    if (statPending) statPending.textContent = stats.pending ?? 0;
    if (statOverdue) statOverdue.textContent = stats.overdue ?? 0;
    const rate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
    if (statCompletionRate) statCompletionRate.textContent = `${rate}%`;

    const tabTasksCount = document.getElementById('tab-tasks-count');
    if (tabTasksCount) tabTasksCount.textContent = stats.total ?? 0;

    renderMetricBars('priority-chart', stats.byPriority, { high: 'var(--danger)', medium: 'var(--warning)', low: 'var(--text-muted)' });
    renderMetricBars('status-chart', stats.byStatus, { todo: 'var(--text-dim)', 'in-progress': 'var(--info)', completed: 'var(--success)' });

    renderMetricBars('dashboard-mini-status', stats.byStatus, { todo: 'var(--text-dim)', 'in-progress': 'var(--info)', completed: 'var(--success)' });
    renderMetricBars('dashboard-mini-priority', stats.byPriority, { high: 'var(--danger)', medium: 'var(--warning)', low: 'var(--text-muted)' });

    renderTrendGraphic(stats.completedByDay || []);

    renderProductivityVelocityWidget(stats);
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

function renderMetricBars(elementId, values = [], colorMap = {}) {
  const container = document.getElementById(elementId);
  if (!container) return;

  if (!values.length) {
    container.innerHTML = '<p class="chart-empty">No data</p>';
    return;
  }

  const max = Math.max(1, ...values.map((v) => v.count || 0));

  container.innerHTML = values
    .map((item) => {
      const key = String(item._id);
      const width = Math.max(4, Math.round(((item.count || 0) / max) * 100));
      const color = colorMap[key] || 'var(--text-secondary)';

      return `
        <div class="minimal-bar-row">
          <span class="minimal-bar-label">${escapeHtml(key.replace('-', ' '))}</span>
          <div class="minimal-bar-track">
            <div class="minimal-bar-fill" style="width: ${width}%; background-color: ${color};"></div>
          </div>
          <span class="minimal-bar-value">${item.count || 0}</span>
        </div>
      `;
    })
    .join('');
}

function renderTrendGraphic(completedByDay) {
  const container = document.getElementById('completion-chart');
  if (!container) return;

  const days = Array.from({ length: 7 }, (_, index) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - (6 - index));
    const key = d.toISOString().slice(0, 10);
    const count = completedByDay.find((item) => item._id === key)?.count || 0;
    return {
      name: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
      count
    };
  });

  const max = Math.max(1, ...days.map((d) => d.count));

  container.innerHTML = days
    .map((d) => {
      const height = Math.max(4, Math.round((d.count / max) * 65));
      return `
        <div class="trend-day-col" title="${d.count} tasks completed">
          <div class="trend-day-bar" style="height: ${height}px;"></div>
          <span class="trend-day-name">${d.name}</span>
        </div>
      `;
    })
    .join('');
}

function renderProductivityVelocityWidget(stats) {
  const barsContainer = document.getElementById('editorial-velocity-bars');
  const shippedStat = document.getElementById('viz-shipped-stat');
  const trackFill = document.getElementById('viz-track-fill');
  const rateText = document.getElementById('viz-completion-rate-text');
  const totalText = document.getElementById('viz-active-total-text');

  if (!barsContainer) return;

  const completedByDay = stats.completedByDay || [];
  const days = Array.from({ length: 7 }, (_, index) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - index));
    const key = d.toISOString().slice(0, 10);
    const entry = completedByDay.find((item) => item._id === key);
    const count = entry ? entry.count : 0;
    return {
      dayLabel: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
      formattedDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count
    };
  });

  const weeklyShipped = days.reduce((sum, d) => sum + d.count, 0);
  if (shippedStat) {
    shippedStat.textContent = `${weeklyShipped} shipped this week`;
  }

  const rate = stats.completionRate ?? 0;
  if (trackFill) trackFill.style.width = `${rate}%`;
  if (rateText) rateText.textContent = `${rate}% complete`;
  if (totalText) totalText.textContent = `${stats.total ?? 0} total tasks`;

  const max = Math.max(1, ...days.map((d) => d.count));

  barsContainer.innerHTML = days
    .map((d) => {
      const heightPercent = d.count > 0 ? Math.max(20, Math.round((d.count / max) * 100)) : 8;
      const opacity = d.count > 0 ? '1' : '0.25';
      return `
        <div class="viz-day-col" title="${d.count} tasks completed on ${d.formattedDate}">
          <div class="viz-day-track">
            <div class="viz-day-fill" style="height: ${heightPercent}%; opacity: ${opacity};"></div>
          </div>
          <span class="viz-day-name">${d.dayLabel}</span>
        </div>
      `;
    })
    .join('');
}

async function loadDashboardWidgets() {
  renderUpcomingDeadlinesWidget();
  await renderMiniActivityWidget();
}

function renderUpcomingDeadlinesWidget() {
  const container = document.getElementById('dashboard-deadlines-list');
  const countPill = document.getElementById('deadlines-count-pill');
  if (!container) return;

  const now = new Date();
  const upcomingTasks = currentTasks
    .filter((t) => t.dueDate && t.status !== 'completed')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  const unscheduledTasks = currentTasks
    .filter((t) => !t.dueDate && t.status !== 'completed');

  if (countPill) {
    if (upcomingTasks.length > 0) {
      countPill.textContent = `${upcomingTasks.length} due`;
      countPill.style.display = 'inline-block';
    } else {
      countPill.style.display = 'none';
    }
  }

  if (!upcomingTasks.length) {
    container.innerHTML = `
      <div class="deadlines-empty-editorial">
        <div class="deadlines-empty-status">
          <span class="dot-online" style="background-color: var(--success); width: 6px; height: 6px;"></span>
          <span class="empty-status-title">All Deadlines Cleared</span>
        </div>
        <p class="empty-status-sub">No pending tasks with impending due dates.</p>
        ${unscheduledTasks.length > 0 ? `
          <div class="unscheduled-focus-row">
            <span class="unscheduled-pill">${unscheduledTasks.length} unscheduled pending task${unscheduledTasks.length === 1 ? '' : 's'}</span>
            <button type="button" class="btn-text-action" onclick="focusUnscheduledTasks()">Focus on pending →</button>
          </div>
        ` : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = upcomingTasks
    .map((task) => {
      const due = new Date(task.dueDate);
      const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

      let dueText = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      let isUrgent = false;

      if (diffDays < 0) {
        dueText = `Overdue (${Math.abs(diffDays)}d)`;
        isUrgent = true;
      } else if (diffDays === 0) {
        dueText = 'Due Today';
        isUrgent = true;
      } else if (diffDays === 1) {
        dueText = 'Tomorrow';
      }

      const priorityColor =
        task.priority === 'high' ? 'var(--danger)' : task.priority === 'medium' ? 'var(--warning)' : 'var(--text-dim)';

      return `
        <div class="upcoming-item" onclick="openTaskDrawer('${task._id}')">
          <div style="display:flex;align-items:center;gap:0.5rem;overflow:hidden;">
            <span class="dot-online" style="background-color:${priorityColor};"></span>
            <span class="upcoming-item-title">${escapeHtml(task.title)}</span>
          </div>
          <span class="upcoming-item-due ${isUrgent ? 'urgent' : ''}">${dueText}</span>
        </div>
      `;
    })
    .join('') + `
      <div class="deadlines-footer-meta">
        <span>●</span>
        <span>${upcomingTasks.length} scheduled</span>
        <span>·</span>
        <span>${unscheduledTasks.length} unscheduled</span>
      </div>
    `;
}

function focusUnscheduledTasks() {
  switchToTab('tasks');
  if (statusFilter) statusFilter.value = 'all';
  if (priorityFilter) priorityFilter.value = 'all';
  const unscheduled = currentTasks.filter((t) => !t.dueDate && t.status !== 'completed');
  renderTasksList(unscheduled);
  showToast(`Filtered to ${unscheduled.length} unscheduled tasks`);
}

async function renderMiniActivityWidget() {
  const container = document.getElementById('dashboard-activity-list');
  if (!container) return;

  try {
    const activities = await api.get('/tasks/activity?limit=4');
    if (!activities || !activities.length) {
      container.innerHTML = '<p class="chart-empty">No recent activity</p>';
      return;
    }

    container.innerHTML = activities
      .map((entry) => {
        const timeAgo = formatRelativeTime(entry.createdAt);
        const actor = entry.userId?.name || 'Someone';
        const taskTitle = entry.taskId?.title || 'a task';
        const verb = formatActionVerb(entry.action);

        return `
          <div class="timeline-entry">
            <span class="timeline-dot"></span>
            <div class="timeline-time">${timeAgo}</div>
            <div class="timeline-desc">
              <strong>${escapeHtml(actor)}</strong> ${verb} "${escapeHtml(taskTitle)}"
            </div>
          </div>
        `;
      })
      .join('');
  } catch {
    container.innerHTML = '<p class="chart-empty">Could not load activity</p>';
  }
}

async function loadTasks() {
  try {
    const params = new URLSearchParams();

    const searchVal = searchInput?.value.trim();
    if (searchVal) params.append('search', searchVal);

    const statusVal = statusFilter?.value;
    if (statusVal && statusVal !== 'all') params.append('status', statusVal);

    const priorityVal = priorityFilter?.value;
    if (priorityVal && priorityVal !== 'all') params.append('priority', priorityVal);

    if (activeTagFilter) params.append('tag', activeTagFilter);

    const [sortBy, sortOrder] = (sortBySelect?.value || 'createdAt-desc').split('-');
    if (sortBy) params.append('sortBy', sortBy);
    if (sortOrder) params.append('sortOrder', sortOrder);

    if (activeScope) params.append('scope', activeScope);

    params.set('page', '1');
    params.set('limit', '25');

    const result = await api.get(`/tasks?${params.toString()}`);
    currentPage = result.pagination.page;
    totalPages = result.pagination.totalPages;
    currentTasks = result.tasks;

    renderTasks(currentTasks);
    renderActiveFilterChips();
    updateLoadMore();
  } catch (err) {
    showToast(err.message || 'Failed to load tasks', 'error');
  }
}

function setTaskScope(scope) {
  activeScope = scope;
  const workspaceBtn = document.getElementById('scope-workspace-btn');
  const myBtn = document.getElementById('scope-my-btn');
  if (workspaceBtn && myBtn) {
    workspaceBtn.classList.toggle('active', scope === 'workspace');
    myBtn.classList.toggle('active', scope === 'my');
  }
  loadTasks();
  loadDashboardStats();
}

function renderActiveFilterChips() {
  if (!activeFiltersBar || !activeFilterChips) return;

  const chips = [];
  if (searchInput?.value.trim()) {
    chips.push({ label: `Search: "${searchInput.value.trim()}"`, onRemove: () => { searchInput.value = ''; loadTasks(); } });
  }
  if (statusFilter?.value && statusFilter.value !== 'all') {
    chips.push({ label: `Status: ${statusFilter.value}`, onRemove: () => { statusFilter.value = 'all'; loadTasks(); } });
  }
  if (priorityFilter?.value && priorityFilter.value !== 'all') {
    chips.push({ label: `Priority: ${priorityFilter.value}`, onRemove: () => { priorityFilter.value = 'all'; loadTasks(); } });
  }
  if (activeTagFilter) {
    chips.push({ label: `#${activeTagFilter}`, onRemove: () => { activeTagFilter = null; if (activeTagBanner) activeTagBanner.style.display = 'none'; loadTasks(); } });
  }
  if (activeScope === 'my') {
    chips.push({ label: 'Scope: My Tasks', onRemove: () => setTaskScope('workspace') });
  }

  if (chips.length > 0) {
    activeFiltersBar.style.display = 'flex';
    activeFilterChips.innerHTML = chips
      .map((chip, idx) => `
        <span style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.15rem 0.45rem;border:1px solid var(--border-muted);border-radius:var(--radius-xs);color:var(--text-secondary);font-family:var(--font-mono);">
          <span>${escapeHtml(chip.label)}</span>
          <button type="button" data-chip-idx="${idx}" class="filter-chip-remove" style="color:var(--text-muted);cursor:pointer;">✕</button>
        </span>
      `)
      .join('');

    activeFilterChips.querySelectorAll('.filter-chip-remove').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.currentTarget.dataset.chipIdx);
        if (chips[idx]?.onRemove) chips[idx].onRemove();
      });
    });
  } else {
    activeFiltersBar.style.display = 'none';
    activeFilterChips.innerHTML = '';
  }
}

function clearAllFilters() {
  if (searchInput) searchInput.value = '';
  if (statusFilter) statusFilter.value = 'all';
  if (priorityFilter) priorityFilter.value = 'all';
  activeTagFilter = null;
  if (activeTagBanner) activeTagBanner.style.display = 'none';
  setTaskScope('workspace');
}

function updateLoadMore() {
  let button = document.getElementById('load-more-tasks');
  if (!button) {
    button = document.createElement('button');
    button.id = 'load-more-tasks';
    button.className = 'btn-secondary-action';
    button.style.margin = '2rem auto 0 auto';
    button.style.display = 'block';
    button.textContent = 'Load More Tasks';
    button.addEventListener('click', loadMoreTasks);
    tasksGrid?.after(button);
  }
  button.hidden = currentPage >= totalPages || !currentTasks.length;
}

async function loadMoreTasks() {
  const button = document.getElementById('load-more-tasks');
  if (currentPage >= totalPages) return;
  button.disabled = true;
  button.textContent = 'Loading…';
  try {
    const params = new URLSearchParams({ page: String(currentPage + 1), limit: '25' });
    if (searchInput?.value.trim()) params.set('search', searchInput.value.trim());
    if (statusFilter?.value && statusFilter.value !== 'all') params.set('status', statusFilter.value);
    if (priorityFilter?.value && priorityFilter.value !== 'all') params.set('priority', priorityFilter.value);
    if (activeTagFilter) params.set('tag', activeTagFilter);
    const [sortBy, sortOrder] = (sortBySelect?.value || 'createdAt-desc').split('-');
    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);
    if (activeScope) params.set('scope', activeScope);

    const result = await api.get(`/tasks?${params}`);
    currentPage = result.pagination.page;
    totalPages = result.pagination.totalPages;
    currentTasks = currentTasks.concat(result.tasks);
    renderTasks(currentTasks);
    updateLoadMore();
  } catch (err) {
    showToast(err.message || 'Could not load more tasks', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Load More Tasks';
  }
}

function renderTasks(tasks) {
  if (!tasksGrid) return;

  if (!tasks || tasks.length === 0) {
    tasksGrid.innerHTML = `
      <div style="padding: 4rem 1rem; text-align: center;">
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1rem;">No tasks found in this view.</p>
        <button type="button" class="btn-primary-action" onclick="openTaskModal()">Create New Task</button>
      </div>
    `;
    return;
  }

  const now = new Date();

  tasksGrid.innerHTML = tasks
    .map((task, index) => {
      const isCompleted = task.status === 'completed';
      const isOverdue = task.dueDate && new Date(task.dueDate) < now && !isCompleted;
      const indexStr = String(index + 1).padStart(2, '0');

      let dueDateFormatted = '';
      if (task.dueDate) {
        const d = new Date(task.dueDate);
        dueDateFormatted = d.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric'
        }).toUpperCase();
      }

      const commentsCount = task.commentsCount || 0;
      const viewers = taskViewersMap[task._id] || [];
      const viewersHtml = viewers.length
        ? `<span class="task-presence-pill"><span class="dot-online"></span> ${viewers.length} viewing</span>`
        : '';

      return `
        <div class="task-row ${isCompleted ? 'is-completed' : ''}" id="task-${task._id}" onclick="openTaskDrawer('${task._id}')">
          <span class="task-index">${indexStr}</span>

          <button 
            type="button" 
            class="task-check-circle ${isCompleted ? 'checked' : ''}" 
            onclick="event.stopPropagation(); toggleTaskStatus('${task._id}', '${task.status}')"
            title="${isCompleted ? 'Mark incomplete' : 'Mark complete'}"
            aria-label="${isCompleted ? 'Mark incomplete' : 'Mark complete'}"
          >
            ${isCompleted ? '✓' : ''}
          </button>

          <div class="task-main-col">
            <div class="task-title-line">
              <span class="task-name">${escapeHtml(task.title)}</span>
              ${task.recurringInterval ? `<span class="tag-badge" style="color:var(--text-muted);">↻ ${escapeHtml(task.recurringInterval)}</span>` : ''}
              ${task.reminderAt ? `<span class="tag-badge" style="color:var(--text-muted);">⏰</span>` : ''}
            </div>
            ${task.description ? `<span class="task-desc-line">${escapeHtml(task.description)}</span>` : ''}
          </div>

          <div class="task-meta-col">
            <span class="tag-badge priority-badge-${task.priority}">${task.priority.toUpperCase()}</span>
            <span class="status-badge">${escapeHtml(task.status.replace('-', ' '))}</span>
            ${task.dueDate ? `<span class="date-badge ${isOverdue ? 'is-overdue' : ''}">${isOverdue ? '!' : ''} ${dueDateFormatted}</span>` : ''}
            ${commentsCount > 0 ? `<span class="task-comment-count">💬 ${commentsCount}</span>` : ''}
            ${viewersHtml}

            <div class="task-row-actions" onclick="event.stopPropagation()">
              <button type="button" class="row-action-btn" onclick="editTask('${task._id}')" title="Edit task">✎</button>
              <button type="button" class="row-action-btn delete-btn" onclick="deleteTask('${task._id}')" title="Delete task">✕</button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

function updateCardPresenceTag(taskId, viewers) {
  const row = document.getElementById(`task-${taskId}`);
  if (!row) return;
  const metaCol = row.querySelector('.task-meta-col');
  if (!metaCol) return;

  const existingPill = metaCol.querySelector('.task-presence-pill');
  if (existingPill) existingPill.remove();

  if (viewers && viewers.length) {
    const pill = document.createElement('span');
    pill.className = 'task-presence-pill';
    pill.innerHTML = `<span class="dot-online"></span> ${viewers.length} viewing`;
    metaCol.appendChild(pill);
  }
}

function filterByTag(tag) {
  activeTagFilter = tag;
  if (activeTagBanner && activeTagName) {
    activeTagName.textContent = `#${tag}`;
    activeTagBanner.style.display = 'inline-flex';
  }
  loadTasks();
}

async function openTaskDrawer(taskId) {
  activeDrawerTaskId = taskId;

  if (socketInstance) socketInstance.emit('task:join', taskId);

  if (taskDrawerBackdrop) taskDrawerBackdrop.style.display = 'flex';

  try {
    const task = await api.get(`/tasks/${taskId}`);
    renderTaskDrawerDetails(task);

    await Promise.all([
      loadTaskComments(taskId),
      loadTaskHistory(taskId)
    ]);
  } catch {
    showToast('Failed to load task details', 'error');
    closeTaskDrawer();
  }
}

function closeTaskDrawer() {
  if (activeDrawerTaskId && socketInstance) {
    socketInstance.emit('task:leave', activeDrawerTaskId);
  }
  activeDrawerTaskId = null;
  if (taskDrawerBackdrop) taskDrawerBackdrop.style.display = 'none';
}

function renderTaskDrawerDetails(task) {
  if (!task) return;

  if (drawerTaskTitle) drawerTaskTitle.textContent = task.title.toUpperCase();
  if (drawerTaskDesc) {
    drawerTaskDesc.textContent = task.description || 'No description provided.';
    drawerTaskDesc.style.color = task.description ? 'var(--text-secondary)' : 'var(--text-muted)';
  }

  if (drawerPriorityBadge) {
    drawerPriorityBadge.className = `tag-badge priority-badge-${task.priority}`;
    drawerPriorityBadge.textContent = task.priority.toUpperCase();
  }
  if (drawerStatusBadge) {
    drawerStatusBadge.className = 'tag-badge';
    drawerStatusBadge.textContent = task.status.replace('-', ' ').toUpperCase();
  }

  if (drawerStatusSelect) drawerStatusSelect.value = task.status;
  if (drawerPrioritySelect) drawerPrioritySelect.value = task.priority;

  if (drawerDueDate) {
    drawerDueDate.textContent = task.dueDate
      ? new Date(task.dueDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
      : 'No deadline';
  }

  if (drawerCreator) {
    const currentUser = auth.getUser();
    const isYou = task.userId?._id === currentUser?._id || task.userId === currentUser?._id;
    drawerCreator.textContent = isYou ? 'You' : (task.userId?.name || 'Workspace Member');
  }

  if (drawerReminder) {
    drawerReminder.textContent = task.reminderAt
      ? new Date(task.reminderAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'None';
  }

  if (drawerRepeat) {
    drawerRepeat.textContent = task.recurringInterval ? `Repeats ${task.recurringInterval}` : 'Does not repeat';
  }

  if (drawerTagsContainer) {
    drawerTagsContainer.innerHTML = (task.tags || []).length
      ? task.tags.map((t) => `<span class="tag-badge">#${escapeHtml(t)}</span>`).join('')
      : '<span style="color:var(--text-muted);font-size:0.75rem;">None</span>';
  }

  if (drawerTimestamps) {
    const createdStr = new Date(task.createdAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    drawerTimestamps.textContent = `Created on ${createdStr}`;
  }

  if (drawerToggleCompleteBtn) {
    drawerToggleCompleteBtn.textContent = task.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete';
  }

  const viewers = taskViewersMap[task._id] || [];
  updateDrawerViewers(viewers);
}

function updateDrawerViewers(viewers) {
  if (!drawerViewersBar || !drawerViewersText) return;
  const currentUser = auth.getUser();

  if (!viewers || !viewers.length) {
    drawerViewersBar.style.display = 'none';
    return;
  }

  const names = viewers.map((v) => (v.id === currentUser?._id || v.id === currentUser?.id ? 'You' : v.name));
  drawerViewersBar.style.display = 'flex';
  drawerViewersText.textContent = `${names.join(', ')} currently viewing this task`;
}

async function loadTaskComments(taskId) {
  if (!drawerCommentsList) return;
  try {
    const comments = await api.get(`/tasks/${taskId}/comments`);
    renderCommentsList(comments);
  } catch {
    drawerCommentsList.innerHTML = '<p class="chart-empty">Could not load comments</p>';
  }
}

function renderCommentsList(comments) {
  if (!drawerCommentsList) return;
  const count = comments.length;
  if (drawerCommentsCount) drawerCommentsCount.textContent = count;

  if (!count) {
    drawerCommentsList.innerHTML = '<p class="chart-empty">No comments yet</p>';
    return;
  }

  const currentUser = auth.getUser();

  drawerCommentsList.innerHTML = comments
    .map((c) => {
      const isAuthor = c.userId?._id === currentUser?._id || c.userId === currentUser?._id || c.userId?.email === currentUser?.email;
      const timeStr = formatRelativeTime(c.createdAt);

      return `
        <div class="comment-bubble" id="comment-${c._id}">
          <div class="comment-bubble-head">
            <span class="comment-bubble-author">
              ${escapeHtml(c.userId?.name || 'Member')} ${isAuthor ? '<span style="color:var(--text-muted);font-size:0.7rem;">(You)</span>' : ''}
            </span>
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <span class="comment-bubble-time">${timeStr}</span>
              ${isAuthor ? `<button type="button" onclick="deleteComment('${c._id}')" style="color:var(--text-muted);cursor:pointer;font-size:0.7rem;">✕</button>` : ''}
            </div>
          </div>
          <div class="comment-bubble-body">${escapeHtml(c.content)}</div>
        </div>
      `;
    })
    .join('');
}

function appendCommentToDrawer(comment) {
  if (!drawerCommentsList) return;
  const emptyP = drawerCommentsList.querySelector('.chart-empty');
  if (emptyP) emptyP.remove();

  const currentUser = auth.getUser();
  const isAuthor = comment.userId?._id === currentUser?._id || comment.userId === currentUser?._id;

  const div = document.createElement('div');
  div.className = 'comment-bubble';
  div.id = `comment-${comment._id}`;
  div.innerHTML = `
    <div class="comment-bubble-head">
      <span class="comment-bubble-author">
        ${escapeHtml(comment.userId?.name || 'Member')} ${isAuthor ? '<span style="color:var(--text-muted);font-size:0.7rem;">(You)</span>' : ''}
      </span>
      <div style="display:flex;align-items:center;gap:0.5rem;">
        <span class="comment-bubble-time">Just now</span>
        ${isAuthor ? `<button type="button" onclick="deleteComment('${comment._id}')" style="color:var(--text-muted);cursor:pointer;font-size:0.7rem;">✕</button>` : ''}
      </div>
    </div>
    <div class="comment-bubble-body">${escapeHtml(comment.content)}</div>
  `;

  drawerCommentsList.appendChild(div);
  updateDrawerCommentsCount();
}

function updateDrawerCommentsCount() {
  if (!drawerCommentsList || !drawerCommentsCount) return;
  drawerCommentsCount.textContent = drawerCommentsList.querySelectorAll('.comment-bubble').length;
}

async function deleteComment(commentId) {
  try {
      await api.delete(`/comments/${commentId}`);
    const el = document.getElementById(`comment-${commentId}`);
    if (el) el.remove();
    updateDrawerCommentsCount();
    showToast('Comment deleted');
  } catch (err) {
    showToast(err.message || 'Could not delete comment', 'error');
  }
}

async function loadTaskHistory(taskId) {
  if (!drawerTaskHistory) return;
  try {
    const activities = await api.get(`/tasks/activity?taskId=${taskId}&limit=6`);
    if (!activities || !activities.length) {
      drawerTaskHistory.innerHTML = '<p class="chart-empty">No history recorded</p>';
      return;
    }

    drawerTaskHistory.innerHTML = activities
      .map((entry) => {
        const timeAgo = formatRelativeTime(entry.createdAt);
        const actionVerb = formatActionVerb(entry.action);
        const actor = entry.userId?.name || 'User';

        return `
          <div class="timeline-entry">
            <span class="timeline-dot"></span>
            <div class="timeline-time">${timeAgo}</div>
            <div class="timeline-desc"><strong>${escapeHtml(actor)}</strong> ${actionVerb}</div>
          </div>
        `;
      })
      .join('');
  } catch {
    drawerTaskHistory.innerHTML = '<p class="chart-empty">Could not load history</p>';
  }
}

function setupDrawerListeners() {
  if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeTaskDrawer);

  if (taskDrawerBackdrop) {
    taskDrawerBackdrop.addEventListener('click', (e) => {
      if (e.target === taskDrawerBackdrop) closeTaskDrawer();
    });
  }

  if (drawerStatusSelect) {
    drawerStatusSelect.addEventListener('change', async (e) => {
      if (!activeDrawerTaskId) return;
      try {
        await api.patch(`/tasks/${activeDrawerTaskId}`, { status: e.target.value });
        showToast(`Status updated to ${e.target.value}`);
      } catch (err) {
        showToast(err.message || 'Failed to update status', 'error');
      }
    });
  }

  if (drawerPrioritySelect) {
    drawerPrioritySelect.addEventListener('change', async (e) => {
      if (!activeDrawerTaskId) return;
      try {
        await api.patch(`/tasks/${activeDrawerTaskId}`, { priority: e.target.value });
        showToast(`Priority set to ${e.target.value}`);
      } catch (err) {
        showToast(err.message || 'Failed to update priority', 'error');
      }
    });
  }

  if (drawerToggleCompleteBtn) {
    drawerToggleCompleteBtn.addEventListener('click', async () => {
      if (!activeDrawerTaskId) return;
      const currentTask = currentTasks.find((t) => t._id === activeDrawerTaskId);
      const newStatus = currentTask?.status === 'completed' ? 'todo' : 'completed';
      try {
        await api.patch(`/tasks/${activeDrawerTaskId}`, { status: newStatus });
        showToast(newStatus === 'completed' ? 'Task marked complete' : 'Task restored to todo');
      } catch (err) {
        showToast(err.message || 'Could not update task', 'error');
      }
    });
  }

  if (drawerEditBtn) {
    drawerEditBtn.addEventListener('click', () => {
      if (!activeDrawerTaskId) return;
      const task = currentTasks.find((t) => t._id === activeDrawerTaskId);
      if (task) {
        closeTaskDrawer();
        openTaskModal(task);
      }
    });
  }

  if (drawerDeleteBtn) {
    drawerDeleteBtn.addEventListener('click', () => {
      if (!activeDrawerTaskId) return;
      deleteTask(activeDrawerTaskId);
    });
  }

  if (drawerCommentForm) {
    drawerCommentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeDrawerTaskId) return;
      const text = drawerCommentInput.value.trim();
      if (!text) return;

      const submitBtn = drawerCommentForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        await api.post(`/tasks/${activeDrawerTaskId}/comments`, { content: text });
        drawerCommentInput.value = '';
      } catch (err) {
        showToast(err.message || 'Failed to post comment', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
}

async function loadFullActivity() {
  const container = document.getElementById('full-activity-timeline');
  if (!container) return;

  try {
    const activities = await api.get('/tasks/activity?limit=50');
    if (!activities || !activities.length) {
      container.innerHTML = '<p class="chart-empty">No activity records found</p>';
      return;
    }

    container.innerHTML = activities
      .map((entry) => {
        const timeAgo = formatRelativeTime(entry.createdAt);
        const actionVerb = formatActionVerb(entry.action);
        const actor = entry.userId?.name || 'Someone';
        const taskTitle = entry.taskId?.title || 'a task';

        return `
          <div class="timeline-entry">
            <span class="timeline-dot"></span>
            <div class="timeline-time">${timeAgo} • ${new Date(entry.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
            <div class="timeline-desc">
              <strong>${escapeHtml(actor)}</strong> ${actionVerb} <strong>"${escapeHtml(taskTitle)}"</strong>
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    container.innerHTML = `<p class="chart-empty">${escapeHtml(err.message)}</p>`;
  }
}

function formatActionVerb(action) {
  switch (action) {
    case 'TASK_CREATED': return 'created';
    case 'TASK_COMPLETED': return 'completed';
    case 'TASK_DELETED': return 'deleted';
    case 'STATUS_CHANGED': return 'updated status of';
    case 'PRIORITY_CHANGED': return 'changed priority of';
    case 'COMMENT_ADDED': return 'commented on';
    default: return 'updated';
  }
}


let currentWorkspaceInfo = null;

const openInviteModalBtn = document.getElementById('open-invite-modal-btn');
const inviteModal = document.getElementById('invite-modal');
const inviteForm = document.getElementById('invite-form');
const inviteEmailInput = document.getElementById('invite-email');
const inviteRoleInput = document.getElementById('invite-role');
const inviteError = document.getElementById('invite-error');
const inviteSubmitBtn = document.getElementById('invite-submit-btn');
const inviteModalCloseBtn = document.getElementById('invite-modal-close-btn');
const inviteCancelBtn = document.getElementById('invite-cancel-btn');

function setupInviteModalListeners() {
  if (openInviteModalBtn) {
    openInviteModalBtn.addEventListener('click', () => {
      openInviteModal();
    });
  }

  if (inviteModalCloseBtn) {
    inviteModalCloseBtn.addEventListener('click', closeInviteModal);
  }

  if (inviteCancelBtn) {
    inviteCancelBtn.addEventListener('click', closeInviteModal);
  }

  if (inviteModal) {
    inviteModal.addEventListener('click', (e) => {
      if (e.target === inviteModal) closeInviteModal();
    });
  }

  if (inviteForm) {
    inviteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!inviteEmailInput) return;

      const email = inviteEmailInput.value.trim();
      const role = inviteRoleInput?.value || 'member';

      if (!email) return;

      if (inviteError) {
        inviteError.style.display = 'none';
        inviteError.textContent = '';
      }

      if (inviteSubmitBtn) {
        inviteSubmitBtn.disabled = true;
        inviteSubmitBtn.textContent = 'Sending...';
      }

      try {
        await api.post('/workspaces/current/invitations', { email, role });
        showToast(`Invitation sent to ${email}`);
        closeInviteModal();
        await loadWorkspaceInvitations();
      } catch (err) {
        if (inviteError) {
          inviteError.textContent = err.message || 'Failed to send invitation';
          inviteError.style.display = 'block';
        } else {
          showToast(err.message || 'Failed to send invitation', 'error');
        }
      } finally {
        if (inviteSubmitBtn) {
          inviteSubmitBtn.disabled = false;
          inviteSubmitBtn.textContent = 'Send Invitation';
        }
      }
    });
  }
}

function openInviteModal() {
  if (!inviteModal) return;
  if (inviteForm) inviteForm.reset();
  if (inviteError) {
    inviteError.style.display = 'none';
    inviteError.textContent = '';
  }
  inviteModal.style.display = 'flex';
  if (inviteEmailInput) inviteEmailInput.focus();
}

function closeInviteModal() {
  if (!inviteModal) return;
  inviteModal.style.display = 'none';
}

async function loadUserInvitations() {
  const container = document.getElementById('user-invitations-container');
  const list = document.getElementById('user-invitations-list');
  if (!container || !list) return;

  try {
    const invitations = await api.get('/workspaces/invitations/my');
    if (!invitations || !invitations.length) {
      container.style.display = 'none';
      list.innerHTML = '';
      return;
    }

    container.style.display = 'block';
    list.innerHTML = invitations
      .map((inv) => {
        const workspaceName = escapeHtml(inv.workspaceId?.name || 'TaskFlow Workspace');
        const inviterName = escapeHtml(inv.invitedBy?.name || 'Workspace Admin');
        const inviterEmail = escapeHtml(inv.invitedBy?.email || '');
        const role = escapeHtml(inv.role || 'member');

        return `
          <div class="invitation-card" id="invitation-${inv._id}">
            <div>
              <div style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">${workspaceName}</div>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.25rem;">
                Invited by <strong style="color: var(--text-primary);">${inviterName}</strong> (${inviterEmail}) as <span class="role-badge ${role}">${role}</span>
              </div>
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <button type="button" class="btn-primary-action" onclick="handleAcceptInvitation('${inv._id}')" style="padding: 0.35rem 0.8rem; font-size: 0.75rem;">Accept</button>
              <button type="button" class="btn-secondary-action" onclick="handleDeclineInvitation('${inv._id}')" style="padding: 0.35rem 0.8rem; font-size: 0.75rem;">Decline</button>
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    container.style.display = 'none';
  }
}

async function handleAcceptInvitation(id) {
  try {
    const res = await api.post(`/workspaces/invitations/${id}/accept`, {});
    showToast('Invitation accepted! Welcome to the workspace.');
    if (socket && res.workspaceId) {
      socket.emit('workspace:join', res.workspaceId);
    }
    await loadUserInvitations();
    await loadTeamMembers();
    await loadTasks();
    await loadDashboardStats();
  } catch (err) {
    showToast(err.message || 'Failed to accept invitation', 'error');
  }
}

async function handleDeclineInvitation(id) {
  try {
    await api.post(`/workspaces/invitations/${id}/decline`, {});
    showToast('Invitation declined');
    await loadUserInvitations();
  } catch (err) {
    showToast(err.message || 'Failed to decline invitation', 'error');
  }
}

async function loadWorkspaceInvitations() {
  const section = document.getElementById('workspace-invitations-section');
  const list = document.getElementById('workspace-invitations-list');
  if (!section || !list) return;

  if (!currentWorkspaceInfo || (currentWorkspaceInfo.role !== 'owner' && currentWorkspaceInfo.role !== 'admin')) {
    section.style.display = 'none';
    return;
  }

  try {
    const invites = await api.get('/workspaces/current/invitations');
    if (!invites || !invites.length) {
      section.style.display = 'none';
      list.innerHTML = '';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = invites
      .map((inv) => {
        const email = escapeHtml(inv.email);
        const role = escapeHtml(inv.role || 'member');
        const invitedDate = new Date(inv.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

        return `
          <div class="team-row" style="grid-template-columns: 36px 1fr 110px 120px 80px;" id="ws-invite-${inv._id}">
            <span class="user-avatar-initial" style="background-color: rgba(255,255,255,0.06); color: var(--text-muted); font-size: 0.75rem;">✉</span>
            <div>
              <div class="team-user-name">${email}</div>
              <div class="team-user-email">Pending invitation</div>
            </div>
            <div>
              <span class="role-badge ${role}">${role}</span>
            </div>
            <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted);">${invitedDate}</span>
            <div style="text-align: right;">
              <button type="button" class="btn-danger-action" onclick="handleCancelWorkspaceInvitation('${inv._id}')" style="padding: 0.25rem 0.5rem; font-size: 0.7rem;">Revoke</button>
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    section.style.display = 'none';
  }
}

async function handleCancelWorkspaceInvitation(id) {
  try {
    await api.delete(`/workspaces/invitations/${id}`);
    showToast('Invitation revoked');
    await loadWorkspaceInvitations();
  } catch (err) {
    showToast(err.message || 'Failed to revoke invitation', 'error');
  }
}

async function loadTeamMembers() {
  const container = document.getElementById('team-grid-container');
  if (!container) return;

  try {
    const data = await api.get('/workspaces/current/members');
    if (!data || !data.members) {
      container.innerHTML = '<p class="chart-empty">No members registered yet</p>';
      return;
    }

    currentWorkspaceInfo = data.workspace;

    if (openInviteModalBtn) {
      const canInvite = data.workspace?.role === 'owner' || data.workspace?.role === 'admin';
      openInviteModalBtn.style.display = canInvite ? 'inline-flex' : 'none';
    }

    loadUserInvitations();
    loadWorkspaceInvitations();

    const members = data.members;
    if (!members.length) {
      container.innerHTML = '<p class="chart-empty">No members registered yet</p>';
      return;
    }

    const currentUser = auth.getUser();

    container.innerHTML = members
      .map((u) => {
        const isOnline = onlineUsers.some((online) => online.id === String(u.userId) || online.email === u.email);
        const isYou = String(u.userId) === currentUser?._id || String(u.userId) === currentUser?.id || u.email === currentUser?.email;
        const initial = (u.name || 'U').charAt(0).toUpperCase();
        const role = u.role || 'member';
        const joinedDate = new Date(u.joinedAt || u.createdAt || Date.now()).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

        return `
          <div class="team-row">
            <span class="user-avatar-initial">${escapeHtml(initial)}</span>
            <div>
              <div class="team-user-name">
                ${escapeHtml(u.name || 'Member')}
                ${isYou ? '<span style="color:var(--text-muted);font-size:0.7rem;">(You)</span>' : ''}
              </div>
              <div class="team-user-email">${escapeHtml(u.email || '')}</div>
            </div>
            <div>
              <span class="role-badge ${escapeHtml(role)}">${escapeHtml(role)}</span>
            </div>
            <span class="team-user-status ${isOnline ? 'online' : 'offline'}">
              <span class="${isOnline ? 'dot-online' : 'dot-offline'}"></span>
              ${isOnline ? 'Online' : 'Offline'}
            </span>
            <span class="team-joined-date">${joinedDate}</span>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    container.innerHTML = `<p class="chart-empty">${escapeHtml(err.message)}</p>`;
  }
}

window.handleAcceptInvitation = handleAcceptInvitation;
window.handleDeclineInvitation = handleDeclineInvitation;
window.handleCancelWorkspaceInvitation = handleCancelWorkspaceInvitation;

function openTaskModal(task = null) {
  if (!taskModal) return;

  editingTaskId = task ? task._id : null;
  modalTitle.textContent = task ? 'Edit Task' : 'Create New Task';

  if (task) {
    taskIdInput.value = task._id;
    taskTitleInput.value = task.title;
    taskDescInput.value = task.description || '';
    taskStatusInput.value = task.status || 'todo';
    taskPriorityInput.value = task.priority || 'medium';
    taskTagsInput.value = (task.tags || []).join(', ');

    if (task.dueDate) {
      taskDueDateInput.value = new Date(task.dueDate).toISOString().split('T')[0];
    } else {
      taskDueDateInput.value = '';
    }

    if (task.reminderAt) {
      if (taskReminderPreset) taskReminderPreset.value = 'custom';
      if (customReminderContainer) customReminderContainer.style.display = 'block';
      if (taskReminderInput) taskReminderInput.value = new Date(task.reminderAt).toISOString().slice(0, 16);
    } else {
      if (taskReminderPreset) taskReminderPreset.value = 'none';
      if (customReminderContainer) customReminderContainer.style.display = 'none';
      if (taskReminderInput) taskReminderInput.value = '';
    }

    if (taskRepeatInput) taskRepeatInput.value = task.recurringInterval || '';
  } else {
    taskForm.reset();
    taskIdInput.value = '';
    taskStatusInput.value = 'todo';
    taskPriorityInput.value = 'medium';
    if (taskDueDateInput) taskDueDateInput.value = '';
    if (taskReminderPreset) taskReminderPreset.value = 'none';
    if (customReminderContainer) customReminderContainer.style.display = 'none';
    if (taskReminderInput) taskReminderInput.value = '';
    if (taskRepeatInput) taskRepeatInput.value = '';
  }

  taskModal.classList.add('active');
  setTimeout(() => taskTitleInput.focus(), 50);
}

function closeTaskModal() {
  if (taskModal) {
    taskModal.classList.remove('active');
    editingTaskId = null;
    taskForm.reset();
  }
}

function handleReminderPresetChange(preset) {
  if (!customReminderContainer || !taskReminderInput) return;

  const now = new Date();
  const dueDateVal = taskDueDateInput?.value;
  let targetDate = null;

  if (preset === 'none') {
    customReminderContainer.style.display = 'none';
    taskReminderInput.value = '';
    return;
  }

  if (preset === 'custom') {
    customReminderContainer.style.display = 'block';
    return;
  }

  if (preset === '10m') {
    targetDate = dueDateVal ? new Date(new Date(dueDateVal).getTime() - 10 * 60 * 1000) : new Date(now.getTime() + 10 * 60 * 1000);
  } else if (preset === '1h') {
    targetDate = dueDateVal ? new Date(new Date(dueDateVal).getTime() - 60 * 60 * 1000) : new Date(now.getTime() + 60 * 60 * 1000);
  } else if (preset === 'tomorrow') {
    targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
    targetDate.setHours(9, 0, 0, 0);
  }

  if (targetDate) {
    customReminderContainer.style.display = 'block';
    const tzOffset = targetDate.getTimezoneOffset() * 60000;
    taskReminderInput.value = new Date(targetDate.getTime() - tzOffset).toISOString().slice(0, 16);
  }
}

async function handleTaskFormSubmit(e) {
  e.preventDefault();

  const submitBtn = taskForm.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  const title = taskTitleInput.value.trim();
  const description = taskDescInput.value.trim();
  const status = taskStatusInput.value;
  const priority = taskPriorityInput.value;
  const rawTags = taskTagsInput.value;
  const dueDate = taskDueDateInput.value || null;

  let reminderAt = null;
  if (taskReminderPreset?.value !== 'none' && taskReminderInput?.value) {
    reminderAt = new Date(taskReminderInput.value).toISOString();
  }

  const payload = {
    title,
    description,
    status,
    priority,
    tags: rawTags ? rawTags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    dueDate,
    reminderAt,
    recurringInterval: taskRepeatInput?.value || null
  };

  try {
    if (editingTaskId) {
      await api.patch(`/tasks/${editingTaskId}`, payload);
      showToast('Task updated');
    } else {
      await api.post('/tasks', payload);
      showToast('Task created');
    }

    closeTaskModal();
    await refreshAllData();
  } catch (err) {
    showToast(err.message || 'Failed to save task', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

async function toggleTaskStatus(taskId, currentStatus) {
  const newStatus = currentStatus === 'completed' ? 'todo' : 'completed';
  try {
    await api.patch(`/tasks/${taskId}`, { status: newStatus });
    showToast(newStatus === 'completed' ? 'Task completed' : 'Task restored');
    await refreshAllData();
  } catch (err) {
    showToast(err.message || 'Failed to update task', 'error');
  }
}

function editTask(taskId) {
  const task = currentTasks.find((t) => t._id === taskId);
  if (task) openTaskModal(task);
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task?')) return;

  try {
    await api.delete(`/tasks/${taskId}`);
    if (activeDrawerTaskId === taskId) closeTaskDrawer();
    showToast('Task deleted');
    await refreshAllData();
  } catch (err) {
    showToast(err.message || 'Failed to delete task', 'error');
  }
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const isInputActive = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

    if (e.key === 'Escape') {
      if (taskModal?.classList.contains('active')) {
        closeTaskModal();
        return;
      }
      if (activeDrawerTaskId) {
        closeTaskDrawer();
        return;
      }
      closeAllHeaderDropdowns();
    }

    if (isInputActive) return;

    if (e.key === '/') {
      e.preventDefault();
      searchInput?.focus();
    }

    if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'n') {
      e.preventDefault();
      openTaskModal();
    }
  });
}

function setupEventListeners() {
  document.getElementById('activity-panel')?.addEventListener('toggle', async (event) => {
    if (!event.currentTarget.open || event.currentTarget.dataset.loaded) return;
    const list = document.getElementById('activity-list');
    try {
      const entries = await api.get('/tasks/activity?limit=25');
      list.innerHTML = entries.length
        ? entries
            .map(
              (entry) =>
                `<li><span><strong>${escapeHtml(entry.userId?.name || 'User')}</strong> ${formatActionVerb(entry.action)} "${escapeHtml(
                  entry.taskId?.title || 'task'
                )}"</span> <time style="color:var(--text-muted);font-family:var(--font-mono);font-size:0.7rem;">${formatRelativeTime(entry.createdAt)}</time></li>`
            )
            .join('')
        : '<li class="chart-empty">No activity records</li>';
      event.currentTarget.dataset.loaded = 'true';
    } catch (error) {
      list.innerHTML = `<li class="chart-empty">${escapeHtml(error.message)}</li>`;
    }
  });

  let searchTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => loadTasks(), 250);
    });
  }

  if (statusFilter) statusFilter.addEventListener('change', () => loadTasks());
  if (priorityFilter) priorityFilter.addEventListener('change', () => loadTasks());
  if (sortBySelect) sortBySelect.addEventListener('change', () => loadTasks());

  if (clearTagBtn) {
    clearTagBtn.addEventListener('click', () => {
      activeTagFilter = null;
      if (activeTagBanner) activeTagBanner.style.display = 'none';
      loadTasks();
    });
  }

  if (openCreateModalBtn) openCreateModalBtn.addEventListener('click', () => openTaskModal());
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeTaskModal);
  if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeTaskModal);

  if (taskModal) {
    taskModal.addEventListener('click', (e) => {
      if (e.target === taskModal) closeTaskModal();
    });
  }

  if (taskForm) taskForm.addEventListener('submit', handleTaskFormSubmit);
}

function formatRelativeTime(dateInput) {
  if (!dateInput) return 'Recently';
  const now = new Date();
  const date = new Date(dateInput);
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
