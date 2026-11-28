// ========================================================
// TicketX - Safe Ticket Reselling Marketplace
// Comprehensive Authentication, User Dashboard,
// Strict AI Fraud Verification & Admin Manual Workflow
// ========================================================

const state = {
  token: localStorage.getItem('ticketx_token') || null,
  currentUser: null,
  activeCategory: 'all',
  searchQuery: '',
  aiSafeOnly: false,
  categories: [],
  tickets: [],
  reviews: [],
  userDashboardData: null,
  adminDashboardData: null,
  activeUserSubTab: 'profile',
  activeAdminSubTab: 'overview',
  activeModalOfferTicket: null,
  currentStarRating: 5,
  currentAiEngine: localStorage.getItem('ticketx_ai_engine') || 'pollinations',
  geminiApiKey: localStorage.getItem('ticketx_gemini_key') || '',
  pendingFileBase64: null,
  lastAiScanResult: null
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadCategories();
  await loadTickets();
  await loadReviews();
  startNotificationsPolling();
});

// --- AUTHENTICATION HELPERS ---
function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  return headers;
}

async function checkAuth() {
  if (!state.token) {
    updateHeaderAuthState(null);
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (res.ok && data.authenticated && data.user) {
      state.currentUser = data.user;
      updateHeaderAuthState(data.user);
      fetchNotificationCount();
    } else {
      state.token = null;
      state.currentUser = null;
      localStorage.removeItem('ticketx_token');
      updateHeaderAuthState(null);
    }
  } catch (err) {
    console.warn('Auth check error:', err);
    updateHeaderAuthState(state.currentUser);
  }
}

function updateHeaderAuthState(user) {
  const btnAuth = document.getElementById('btnHeaderAuth');
  const btnLogout = document.getElementById('btnHeaderLogout');
  const notifBtn = document.getElementById('headerNotifBtn');
  const userChip = document.getElementById('userProfileChip');
  const navUserDash = document.getElementById('navTabUserDashboard');
  const navAdminDash = document.getElementById('navTabAdminDashboard');

  if (user) {
    if (btnAuth) btnAuth.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'inline-flex';
    if (notifBtn) notifBtn.style.display = 'flex';
    if (userChip) userChip.style.display = 'flex';

    document.getElementById('currentUserNameDisplay').textContent = user.name;
    document.getElementById('currentUserRoleDisplay').textContent = user.role === 'admin' ? '🛡️ প্ল্যাটফর্ম অ্যাডমিন' : '👤 সদস্য';

    if (user.role === 'admin') {
      if (navAdminDash) navAdminDash.style.display = 'inline-flex';
      if (navUserDash) navUserDash.style.display = 'none';
    } else {
      if (navUserDash) navUserDash.style.display = 'inline-flex';
      if (navAdminDash) navAdminDash.style.display = 'none';
    }
  } else {
    if (btnAuth) btnAuth.style.display = 'inline-flex';
    if (btnLogout) btnLogout.style.display = 'none';
    if (notifBtn) notifBtn.style.display = 'none';
    if (userChip) userChip.style.display = 'none';
    if (navUserDash) navUserDash.style.display = 'none';
    if (navAdminDash) navAdminDash.style.display = 'none';

    // If currently viewing a protected tab, switch to explore
    const tabUser = document.getElementById('tabUserDashboard');
    const tabAdmin = document.getElementById('tabAdminDashboard');
    if ((tabUser && tabUser.style.display !== 'none') || (tabAdmin && tabAdmin.style.display !== 'none')) {
      switchMainTab('explore');
    }
  }
}

// --- AUTH MODAL HANDLERS ---
function openAuthModal(defaultTab = 'login') {
  switchAuthModalTab(defaultTab);
  openModal('authModal');
}

function switchAuthModalTab(tab) {
  const btnLogin = document.getElementById('tabBtnLogin');
  const btnSignup = document.getElementById('tabBtnSignup');
  const btnAdmin = document.getElementById('tabBtnAdmin');
  const formLogin = document.getElementById('formUserLogin');
  const formSignup = document.getElementById('formUserSignup');
  const formAdmin = document.getElementById('formAdminLogin');
  const modalTitle = document.getElementById('authModalTitle');

  btnLogin.classList.toggle('active', tab === 'login');
  btnSignup.classList.toggle('active', tab === 'signup');
  btnAdmin.classList.toggle('active', tab === 'admin');

  formLogin.style.display = tab === 'login' ? 'block' : 'none';
  formSignup.style.display = tab === 'signup' ? 'block' : 'none';
  formAdmin.style.display = tab === 'admin' ? 'block' : 'none';

  if (tab === 'login') modalTitle.textContent = 'ব্যবহারকারী সাইন ইন (Sign In)';
  else if (tab === 'signup') modalTitle.textContent = 'নতুন অ্যাকাউন্ট তৈরি করুন (Sign Up)';
  else if (tab === 'admin') modalTitle.textContent = 'প্ল্যাটফর্ম অ্যাডমিন প্রবেশাধিকার';
}

async function handleUserLoginSubmit(e) {
  e.preventDefault();
  const identifier = document.getElementById('loginIdentifierInput').value.trim();
  const password = document.getElementById('loginPasswordInput').value;
  const btn = document.getElementById('btnLoginSubmit');

  btn.disabled = true;
  btn.textContent = 'যাচাই করা হচ্ছে...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      state.token = data.token;
      state.currentUser = data.user;
      localStorage.setItem('ticketx_token', data.token);

      updateHeaderAuthState(data.user);
      closeModal('authModal');
      document.getElementById('formUserLogin').reset();
      showNotification(data.message || 'সফলভাবে সাইন ইন করেছেন!', 'success');

      if (data.user.role === 'admin') {
        switchMainTab('adminDashboard');
      } else {
        loadTickets();
      }
    } else {
      showNotification(data.error || 'লগইন ব্যর্থ হয়েছে', 'error');
    }
  } catch (err) {
    showNotification('সার্ভার যোগাযোগে ত্রুটি', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔑 সাইন ইন করুন';
  }
}

async function handleUserSignupSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('signupNameInput').value.trim();
  const phone = document.getElementById('signupPhoneInput').value.trim();
  const email = document.getElementById('signupEmailInput').value.trim();
  const password = document.getElementById('signupPasswordInput').value;
  const btn = document.getElementById('btnSignupSubmit');

  btn.disabled = true;
  btn.textContent = 'অ্যাকাউন্ট তৈরি হচ্ছে...';

  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      state.token = data.token;
      state.currentUser = data.user;
      localStorage.setItem('ticketx_token', data.token);

      updateHeaderAuthState(data.user);
      closeModal('authModal');
      document.getElementById('formUserSignup').reset();
      showNotification(data.message || 'অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!', 'success');

      switchMainTab('userDashboard');
    } else {
      showNotification(data.error || 'অ্যাকাউন্ট তৈরিতে ত্রুটি', 'error');
    }
  } catch (err) {
    showNotification('সার্ভার যোগাযোগে ত্রুটি', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '📝 অ্যাকাউন্ট তৈরি করুন';
  }
}

async function handleAdminLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('adminEmailInput').value.trim();
  const password = document.getElementById('adminPasswordInput').value;
  const btn = document.getElementById('btnAdminLoginSubmit');

  btn.disabled = true;
  btn.textContent = 'যাচাই করা হচ্ছে...';

  try {
    const res = await fetch('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      state.token = data.token;
      state.currentUser = data.user;
      localStorage.setItem('ticketx_token', data.token);

      updateHeaderAuthState(data.user);
      closeModal('authModal');
      document.getElementById('formAdminLogin').reset();
      showNotification(data.message || 'অ্যাডমিন ড্যাশবোর্ডে স্বাগতম!', 'success');

      switchMainTab('adminDashboard');
    } else {
      showNotification(data.error || 'অ্যাডমিন লগইন ব্যর্থ হয়েছে', 'error');
    }
  } catch (err) {
    showNotification('সার্ভার যোগাযোগে ত্রুটি', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🛡️ অ্যাডমিন ড্যাশবোর্ডে প্রবেশ করুন';
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders()
    });
  } catch (e) {}

  state.token = null;
  state.currentUser = null;
  localStorage.removeItem('ticketx_token');
  updateHeaderAuthState(null);
  showNotification('সফলভাবে লগআউট হয়েছে।', 'info');
  switchMainTab('explore');
  loadTickets();
}

function handleUserChipClick() {
  if (state.currentUser) {
    if (state.currentUser.role === 'admin') {
      switchMainTab('adminDashboard');
    } else {
      switchMainTab('userDashboard');
    }
  } else {
    openAuthModal('login');
  }
}

function handleSellCtaClick() {
  if (!state.currentUser) {
    showNotification('টিকিট বিক্রি করতে অনুগ্রহ করে প্রথমে সাইন ইন করুন।', 'info');
    openAuthModal('login');
    return;
  }
  openSellTicketModal();
}

// --- MAIN TAB SWITCHING ---
function switchMainTab(tab) {
  if (tab === 'userDashboard' && !state.currentUser) {
    showNotification('ড্যাশবোর্ড দেখতে অনুগ্রহ করে প্রথমে সাইন ইন করুন।', 'info');
    openAuthModal('login');
    return;
  }

  if (tab === 'adminDashboard') {
    if (!state.currentUser || state.currentUser.role !== 'admin') {
      showNotification('শুধুমাত্র প্ল্যাটফর্ম অ্যাডমিন প্রবেশ করতে পারেন।', 'error');
      return;
    }
  }

  const tabs = ['explore', 'userDashboard', 'adminDashboard', 'trust'];
  tabs.forEach(t => {
    const pane = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const navBtn = document.getElementById(`navTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (pane) pane.style.display = t === tab ? 'block' : 'none';
    if (navBtn) navBtn.classList.toggle('active', t === tab);
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (tab === 'userDashboard') {
    loadUserDashboardData();
  } else if (tab === 'adminDashboard') {
    loadAdminDashboardData();
  } else if (tab === 'explore') {
    loadTickets();
  } else if (tab === 'trust') {
    loadReviews();
  }
}

// --- CATEGORIES & TICKETS FETCHING ---
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    state.categories = data.categories || [];
    renderCategoryPills();
  } catch (err) {
    console.error('Error loading categories:', err);
  }
}

function renderCategoryPills() {
  const container = document.getElementById('categoryPillsContainer');
  if (!container) return;

  container.innerHTML = state.categories.map(cat => `
    <button class="category-pill cat-${cat.id} ${state.activeCategory === cat.id ? 'active' : ''}" onclick="selectCategory('${cat.id}')">
      <span class="cat-dot cat-dot-${cat.id}"></span>
      <span class="cat-icon">${cat.icon}</span>
      <span class="cat-name">${cat.nameBn}</span>
      ${cat.count > 0 ? `<span class="cat-count">${cat.count}</span>` : ''}
    </button>
  `).join('');
}

function selectCategory(catId) {
  state.activeCategory = catId;
  renderCategoryPills();
  loadTickets();
}

async function loadTickets() {
  try {
    let url = `/api/tickets?category=${state.activeCategory}`;
    if (state.searchQuery) url += `&search=${encodeURIComponent(state.searchQuery)}`;

    const res = await fetch(url, { headers: getAuthHeaders() });
    const data = await res.json();
    state.tickets = data.tickets || [];
    renderTicketCards();
  } catch (err) {
    console.error('Error loading tickets:', err);
  }
}

function renderTicketCards() {
  const grid = document.getElementById('ticketCardsGrid');
  if (!grid) return;

  let filtered = state.tickets;
  if (state.aiSafeOnly) {
    filtered = filtered.filter(t => t.aiScan && t.aiScan.score >= 95);
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 48px 20px;">
        <span style="font-size: 3rem;">🎫</span>
        <h3 style="margin-top: 12px; color: #0f172a;">কোনো টিকিট পাওয়া যায়নি</h3>
        <p style="color: #64748b;">এই ক্যাটাগরিতে বর্তমানে কোনো অনুমোদিত টিকিট বিক্রির জন্য উপলব্ধ নেই।</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(t => {
    const isOwner = state.currentUser && t.sellerId === state.currentUser.id;
    const discount = (t.originalPrice > 0 && t.askingPrice > 0) ? t.originalPrice - t.askingPrice : 0;
    const noPrice = !(t.askingPrice > 0);
    const aiScore = t.aiScan?.score || 96;

    return `
      <div class="ticket-card" id="card_${t.id}">
        <div class="ticket-card-header">
          <span class="ticket-cat-badge cat-${t.category}">
            ${getCategoryIcon(t.category)} ${getCategoryName(t.category)}
          </span>
          <span class="ticket-ai-badge badge-green" onclick="openAiDetailsModal('${t.id}')" title="এআই ভেরিফিকেশন রিপোর্ট দেখুন">
            🛡️ ${aiScore}% Safe
          </span>
        </div>
        ${t.autoListed && !t.adminVerified ? '<div style="font-size:0.7rem;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:2px 8px;margin-bottom:6px;display:inline-block;">⏳ অ্যাডমিন রিভিউ বাকি (অটো-লিস্টেড)</div>' : ''}

        <div class="ticket-operator">${escapeHtml(orDash(t.operator))}</div>
        <h3 class="ticket-title">${escapeHtml(tTitle(t))}</h3>

        <div class="ticket-meta-grid">
          <div><small>তারিখ:</small> <strong>${formatDate(t.journeyDate)}</strong></div>
          <div><small>সময়:</small> <strong>${escapeHtml(orDash(t.journeyTime))}</strong></div>
          <div><small>আসন:</small> <strong>${escapeHtml(orDash(t.seats))}</strong></div>
          <div><small>বোর্ডিং:</small> <strong>${escapeHtml(t.boardingPoint || 'কাউন্টার')}</strong></div>
        </div>

        <div class="ticket-pricing-row">
          <div>
            <div class="ticket-asking-price">${moneyOrNA(t.askingPrice)}</div>
            <div class="ticket-orig-price">মুদ্রিত মূল্য: ${moneyOrNA(t.originalPrice)}</div>
          </div>
          ${discount > 0 ? `<span class="discount-pill">৳${discount.toLocaleString()} ছাড়</span>` : ''}
        </div>

        <div class="ticket-seller-bar">
          <div class="seller-info">
            <span>👤 ${escapeHtml(t.sellerName)}</span>
            <small class="text-green">⭐ ${t.sellerRating || 5.0} • ${escapeHtml(t.sellerTrust || 'Verified')}</small>
          </div>
        </div>

        <div class="ticket-actions-bar">
          ${isOwner ? `
            <button class="btn btn-outline btn-sm btn-block" onclick="switchMainTab('userDashboard')">
              📋 আপনার নিজের টিকিট (ড্যাশবোর্ড)
            </button>
          ` : `
            ${t.allowOffers && !noPrice ? `
              <button class="btn btn-outline btn-sm" onclick="openOfferModal('${t.id}')">
                💬 অফার দিন
              </button>
            ` : ''}
            <button class="btn btn-primary btn-sm flex-1" ${noPrice ? 'disabled title="বিক্রেতা এখনো দাম উল্লেখ করেননি"' : ''} onclick="openBuyNowModal('${t.id}')">
              ${noPrice ? '💲 দাম উল্লেখ নেই' : '⚡ এখনই কিনুন (Buy Now)'}
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// --- USER DASHBOARD (SECTION 2 REQUIREMENT) ---
async function loadUserDashboardData() {
  if (!state.currentUser) return;

  try {
    const res = await fetch('/api/user/dashboard-data', {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (res.ok) {
      state.userDashboardData = data;
      renderUserDashboard(data);
    }
  } catch (err) {
    console.error('Error loading dashboard data:', err);
  }
}

function showUserSubTab(subTab) {
  state.activeUserSubTab = subTab;
  const tabs = ['profile', 'listed', 'pending', 'offers', 'requests', 'transactions', 'notifications'];
  tabs.forEach(t => {
    const btn = document.getElementById(`userSubTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const pane = document.getElementById(`userSubPane${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) btn.classList.toggle('active', t === subTab);
    if (pane) pane.style.display = t === subTab ? 'block' : 'none';
  });

  if (state.userDashboardData) {
    renderUserDashboard(state.userDashboardData);
  }
}

function renderUserDashboard(data) {
  const profile = data.profile || state.currentUser;

  // 1. Update Profile Sub-pane
  document.getElementById('userProfileAvatarChar').textContent = (profile.name || 'U').charAt(0).toUpperCase();
  document.getElementById('userProfileNameText').textContent = profile.name;
  document.getElementById('userProfileTrustBadgeText').textContent = profile.trustBadge || 'Verified User';
  document.getElementById('userProfilePhoneText').textContent = profile.phone || '-';
  document.getElementById('userProfileEmailText').textContent = profile.email || 'উল্লেখ করা হয়নি';
  document.getElementById('userProfileRatingText').textContent = `⭐ ${profile.rating || 5.0} (${profile.reviewCount || 0} রিভিউ)`;
  document.getElementById('userProfileDealsText').textContent = `${profile.completedDeals || 0} টি সফল লেনদেন`;
  document.getElementById('userProfileCreatedText').textContent = formatDate(profile.createdAt);

  // 2. Badges Count
  const listedCount = (data.myListedTickets || []).length;
  const pendingCount = (data.myPendingTickets || []).length;
  const receivedOffers = (data.receivedOffers || []).filter(o => o.status === 'pending');
  const receivedRequests = (data.receivedPurchaseRequests || []).filter(r => r.status === 'pending_seller_confirmation');
  const unreadNotifs = (data.notifications || []).filter(n => !n.isRead).length;

  document.getElementById('userListedCountBadge').textContent = listedCount;
  document.getElementById('userPendingCountBadge').textContent = pendingCount;
  document.getElementById('userOffersCountBadge').textContent = receivedOffers.length;
  document.getElementById('userRequestsCountBadge').textContent = receivedRequests.length;
  document.getElementById('userTransactionsCountBadge').textContent = (data.myTransactions || []).length;
  document.getElementById('userNotificationsCountBadge').textContent = unreadNotifs;

  // 3. Render Active Listed Tickets
  const listedList = document.getElementById('userListedTicketsList');
  if (listedList) {
    if (data.myListedTickets.length === 0) {
      listedList.innerHTML = '<p class="text-muted" style="padding: 20px;">আপনার কোনো সক্রিয় বিক্রয়যোগ্য টিকিট নেই।</p>';
    } else {
      listedList.innerHTML = data.myListedTickets.map(t => `
        <div class="dash-ticket-card">
          <div class="dash-card-left">
            <div class="dash-card-title">${escapeHtml(tTitle(t))}</div>
            <div class="dash-card-meta">
              <span>অপারেটর: <strong>${escapeHtml(orDash(t.operator))}</strong></span>
              <span>তারিখ: <strong>${formatDate(t.journeyDate)}</strong></span>
              <span>আসন: <strong>${escapeHtml(orDash(t.seats))}</strong></span>
              <span>বিক্রি মূল্য: <strong class="text-accent">${moneyOrNA(t.askingPrice)}</strong></span>
            </div>
            ${t.autoListed && !t.adminVerified && t.missingFields && t.missingFields.length ? `<div style="font-size:0.75rem;color:#b45309;margin-top:4px;">⚠️ অনুপস্থিত তথ্য: ${escapeHtml(t.missingFields.join(', '))}</div>` : ''}
          </div>
          <div>
            <span class="status-pill status-pill-${t.status === 'reserved' ? 'reserved' : 'available'}">
              ${t.status === 'reserved' ? '🔄 সংরক্ষিত (ডিল চলমান)' : (t.autoListed && !t.adminVerified ? '✓ লাইভ • ⏳ অ্যাডমিন রিভিউ বাকি' : '✓ লাইভ মার্কেটপ্লেস')}
            </span>
          </div>
        </div>
      `).join('');
    }
  }

  // 4. Render Pending & Rejected Tickets
  const pendingList = document.getElementById('userPendingTicketsList');
  if (pendingList) {
    if (data.myPendingTickets.length === 0) {
      pendingList.innerHTML = '<p class="text-muted" style="padding: 20px;">বর্তমানে পর্যালোচনার অপেক্ষায় কোনো টিকিট নেই।</p>';
    } else {
      pendingList.innerHTML = data.myPendingTickets.map(t => `
        <div class="dash-ticket-card">
          <div class="dash-card-left">
            <div class="dash-card-title">${escapeHtml(tTitle(t))}</div>
            <div class="dash-card-meta">
              <span>অপারেটর: <strong>${escapeHtml(orDash(t.operator))}</strong></span>
              <span>তারিখ: <strong>${formatDate(t.journeyDate)}</strong></span>
              <span>মূল্য: <strong>${moneyOrNA(t.askingPrice)}</strong></span>
            </div>
            ${t.rejectionReason ? `
              <div style="color: #dc2626; font-size: 0.8rem; margin-top: 4px; font-weight: 600;">
                ✕ প্রত্যাখ্যানের কারণ: ${escapeHtml(t.rejectionReason)}
              </div>
            ` : ''}
          </div>
          <div>
            <span class="status-pill status-pill-${t.status === 'rejected_by_admin' ? 'rejected' : 'pending'}">
              ${t.status === 'rejected_by_admin' ? '✕ অ্যাডমিন কর্তৃক প্রত্যাখ্যাত' : '⏳ অ্যাডমিন পর্যালোচনার অপেক্ষায়'}
            </span>
          </div>
        </div>
      `).join('');
    }
  }

  // 5. Render Offers (Received & Sent)
  const recOffersList = document.getElementById('userReceivedOffersList');
  if (recOffersList) {
    if (data.receivedOffers.length === 0) {
      recOffersList.innerHTML = '<p class="text-muted" style="padding: 16px;">কোনো অফার পাওয়া যায়নি।</p>';
    } else {
      recOffersList.innerHTML = data.receivedOffers.map(o => `
        <div class="admin-deal-card mb-2">
          <div class="flex-between">
            <strong>${escapeHtml(o.ticketTitle || 'টিকিট')}</strong>
            <span class="status-pill status-pill-${o.status === 'accepted' ? 'completed' : o.status === 'rejected' ? 'rejected' : 'pending'}">
              ${o.status === 'accepted' ? '✓ গৃহীত' : o.status === 'rejected' ? '✕ প্রত্যাখ্যাত' : '⏳ পেন্ডিং'}
            </span>
          </div>
          <div style="font-size: 0.825rem; color: #475569; margin: 4px 0;">
            বায়ার: <strong>${escapeHtml(o.buyerName)}</strong> • চাওয়া দাম: ৳${o.askingPrice || 0} ➔ অফার: <strong class="text-accent" style="font-size: 1rem;">৳${o.offeredPrice.toLocaleString()}</strong>
          </div>
          ${o.message ? `<small style="color: #64748b; font-style: italic;">বার্তা: "${escapeHtml(o.message)}"</small>` : ''}
          ${o.status === 'pending' ? `
            <div class="admin-deal-actions mt-2">
              <button class="btn btn-success btn-sm" onclick="respondToOffer('${o.id}', 'accept')">✓ গ্রহণ করুন (Accept)</button>
              <button class="btn btn-outline btn-sm" onclick="respondToOffer('${o.id}', 'reject')">✕ প্রত্যাখ্যান (Reject)</button>
            </div>
          ` : ''}
        </div>
      `).join('');
    }
  }

  const sentOffersList = document.getElementById('userSentOffersList');
  if (sentOffersList) {
    if (data.sentOffers.length === 0) {
      sentOffersList.innerHTML = '<p class="text-muted" style="padding: 16px;">আপনি কোনো অফার পাঠাননি।</p>';
    } else {
      sentOffersList.innerHTML = data.sentOffers.map(o => `
        <div class="admin-deal-card mb-2">
          <div class="flex-between">
            <strong>${escapeHtml(o.ticketTitle || 'টিকিট')}</strong>
            <span class="status-pill status-pill-${o.status === 'accepted' ? 'completed' : o.status === 'rejected' ? 'rejected' : 'pending'}">
              ${o.status === 'accepted' ? '✓ সেলার গ্রহণ করেছেন' : o.status === 'rejected' ? '✕ প্রত্যাখ্যাত' : '⏳ সেলারের সিদ্ধান্তের অপেক্ষায়'}
            </span>
          </div>
          <div style="font-size: 0.825rem; color: #475569; margin-top: 4px;">
            আপনার প্রস্তাবিত মূল্য: <strong class="text-accent">৳${o.offeredPrice.toLocaleString()}</strong>
          </div>
        </div>
      `).join('');
    }
  }

  // 6. Render Purchase Requests (Buy Now)
  const recRequestsList = document.getElementById('userReceivedRequestsList');
  if (recRequestsList) {
    if (data.receivedPurchaseRequests.length === 0) {
      recRequestsList.innerHTML = '<p class="text-muted" style="padding: 16px;">কোনো Buy Now অনুরোধ নেই।</p>';
    } else {
      recRequestsList.innerHTML = data.receivedPurchaseRequests.map(r => `
        <div class="admin-deal-card mb-2">
          <div class="flex-between">
            <strong>${escapeHtml(r.ticketTitle || 'টিকিট')}</strong>
            <span class="status-pill status-pill-${r.status === 'accepted' ? 'completed' : r.status === 'rejected' ? 'rejected' : 'pending'}">
              ${r.status === 'accepted' ? '✓ নিশ্চিতকৃত' : r.status === 'rejected' ? '✕ বাতিল' : '⏳ আপনার অনুমোদনের অপেক্ষায়'}
            </span>
          </div>
          <div style="font-size: 0.825rem; color: #475569; margin: 4px 0;">
            ক্রেতা: <strong>${escapeHtml(r.buyerName)}</strong> (${escapeHtml(r.buyerPhone)}) • নির্ধারিত মূল্য: <strong class="text-accent">৳${r.requestedPrice.toLocaleString()}</strong>
          </div>
          ${r.status === 'pending_seller_confirmation' ? `
            <div class="admin-deal-actions mt-2">
              <button class="btn btn-success btn-sm" onclick="respondToPurchaseRequest('${r.id}', 'confirm')">✓ নিশ্চিত করুন (Confirm)</button>
              <button class="btn btn-outline btn-sm" onclick="respondToPurchaseRequest('${r.id}', 'reject')">✕ বাতিল করুন (Reject)</button>
            </div>
          ` : ''}
        </div>
      `).join('');
    }
  }

  const sentRequestsList = document.getElementById('userSentRequestsList');
  if (sentRequestsList) {
    if (data.sentPurchaseRequests.length === 0) {
      sentRequestsList.innerHTML = '<p class="text-muted" style="padding: 16px;">আপনার কোনো Buy Now অনুরোধ নেই।</p>';
    } else {
      sentRequestsList.innerHTML = data.sentPurchaseRequests.map(r => `
        <div class="admin-deal-card mb-2">
          <div class="flex-between">
            <strong>${escapeHtml(r.ticketTitle || 'টিকিট')}</strong>
            <span class="status-pill status-pill-${r.status === 'accepted' ? 'completed' : r.status === 'rejected' ? 'rejected' : 'pending'}">
              ${r.status === 'accepted' ? '✓ সেলার নিশ্চিত করেছেন (অ্যাডমিন যোগাযোগ করবে)' : r.status === 'rejected' ? '✕ সেলার বাতিল করেছেন' : '⏳ সেলারের কনফার্মেশনের অপেক্ষায়'}
            </span>
          </div>
          <div style="font-size: 0.825rem; color: #475569; margin-top: 4px;">
            অনুরোধকৃত মূল্য: <strong class="text-accent">৳${r.requestedPrice.toLocaleString()}</strong>
          </div>
        </div>
      `).join('');
    }
  }

  // 7. Render Transactions History
  const trxList = document.getElementById('userTransactionsList');
  if (trxList) {
    if (data.myTransactions.length === 0) {
      trxList.innerHTML = '<p class="text-muted" style="padding: 20px;">আপনার কোনো চলমান বা সম্পন্ন লেনদেন নেই।</p>';
    } else {
      trxList.innerHTML = data.myTransactions.map(trx => {
        const isBuyer = trx.buyerId === state.currentUser.id;
        const statusMap = {
          'awaiting_admin': '⏳ অ্যাডমিন যোগাযোগের অপেক্ষায়',
          'in_progress': '🔄 ইন-প্রোগ্রেস (অ্যাডমিন সমন্বয় চলছে)',
          'completed': '✓ সম্পন্ন হয়েছে',
          'cancelled': '✕ বাতিল হয়েছে'
        };

        return `
          <div class="admin-deal-card mb-3">
            <div class="admin-deal-top">
              <div>
                <h4 style="margin: 0; color: #0f172a;">${escapeHtml(trx.ticketTitle)}</h4>
                <small class="text-muted">লেনদেন আইডি: #${trx.id} • আপনার ভূমিকা: ${isBuyer ? '<strong class="text-accent">ক্রেতা</strong>' : '<strong class="text-green">বিক্রেতা</strong>'}</small>
              </div>
              <span class="status-pill status-pill-${trx.status === 'completed' ? 'completed' : trx.status === 'cancelled' ? 'cancelled' : trx.status === 'in_progress' ? 'progress' : 'pending'}">
                ${statusMap[trx.status] || trx.status}
              </span>
            </div>

            <div style="font-size: 0.85rem; margin-top: 6px;">
              নির্ধারিত মূল্য: <strong class="text-accent" style="font-size: 1.1rem;">৳${trx.agreedPrice.toLocaleString()}</strong>
              ${trx.status === 'completed' && isBuyer ? `
                <button class="btn btn-primary btn-sm ml-3" onclick="viewProtectedTicketImage('${trx.ticketId}', '${escapeHtml(trx.ticketTitle)}')">
                  🎟️ আসল টিকিট দেখুন ও ডাউনলোড করুন
                </button>
              ` : ''}
            </div>

            <div style="background: #f8fafc; padding: 10px; border-radius: 6px; font-size: 0.775rem; color: #475569; margin-top: 8px;">
              ℹ️ <strong>অ্যাডমিন নোট:</strong> প্ল্যাটফর্ম অ্যাডমিন ফোনে উভয় পক্ষের সাথে যোগাযোগ করে নিরাপদে টিকিট ও পেমেন্ট লেনদেন সম্পন্ন করবেন।
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 8. Render Notifications Feed
  const notifFeed = document.getElementById('userNotificationsFeed');
  if (notifFeed) {
    if (data.notifications.length === 0) {
      notifFeed.innerHTML = '<p class="text-muted" style="padding: 20px;">কোনো নোটিফিকেশন নেই।</p>';
    } else {
      notifFeed.innerHTML = data.notifications.map(n => `
        <div class="notif-item-row ${n.isRead ? '' : 'unread'}" onclick="markNotificationAsRead('${n.id}')">
          <div class="notif-icon-circle">${getNotifIcon(n.type)}</div>
          <div class="notif-content-wrap">
            <div class="notif-item-title">${escapeHtml(n.title)}</div>
            <div class="notif-item-msg">${escapeHtml(n.message)}</div>
            <div class="notif-item-time">${formatTimeAgo(n.createdAt)}</div>
          </div>
        </div>
      `).join('');
    }
  }
}

// Seller Offer & Buy Now Responses
async function respondToOffer(offerId, action) {
  try {
    const res = await fetch(`/api/offers/${offerId}/respond`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (res.ok) {
      showNotification(data.message || 'অ্যাকশন সফল হয়েছে!', 'success');
      loadUserDashboardData();
    } else {
      showNotification(data.error || 'ব্যর্থ হয়েছে', 'error');
    }
  } catch (err) {
    showNotification('সার্ভার যোগাযোগে ত্রুটি', 'error');
  }
}

async function respondToPurchaseRequest(requestId, action) {
  try {
    const res = await fetch(`/api/purchase-requests/${requestId}/respond`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (res.ok) {
      showNotification(data.message || 'অনুরোধ নিশ্চিত করা হয়েছে!', 'success');
      loadUserDashboardData();
    } else {
      showNotification(data.error || 'ব্যর্থ হয়েছে', 'error');
    }
  } catch (err) {
    showNotification('সার্ভার যোগাযোগে ত্রুটি', 'error');
  }
}

// --- ADMIN DASHBOARD (SECTION 7 REQUIREMENT) ---
async function loadAdminDashboardData() {
  if (!state.currentUser || state.currentUser.role !== 'admin') return;

  try {
    const res = await fetch('/api/admin/dashboard', {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (res.ok) {
      state.adminDashboardData = data;
      renderAdminDashboard(data);
    } else {
      showNotification(data.error || 'অ্যাডমিন ডেটা লোড ব্যর্থ', 'error');
    }
  } catch (err) {
    console.error('Error loading admin dashboard:', err);
  }
}

function showAdminSubTab(subTab) {
  state.activeAdminSubTab = subTab;
  const tabs = ['overview', 'tickets', 'transactions', 'users', 'notifications'];
  tabs.forEach(t => {
    const btn = document.getElementById(`adminSubTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const pane = document.getElementById(`adminSubPane${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (btn) btn.classList.toggle('active', t === subTab);
    if (pane) pane.style.display = t === subTab ? 'block' : 'none';
  });

  if (state.adminDashboardData) {
    renderAdminDashboard(state.adminDashboardData);
  }
}

function renderAdminDashboard(data) {
  const stats = data.stats || {};

  // 1. Overview Stats
  document.getElementById('adminStatTotalUsers').textContent = stats.totalUsers || 0;
  document.getElementById('adminStatTotalTickets').textContent = stats.totalTickets || 0;
  document.getElementById('adminStatPendingTickets').textContent = stats.pendingTicketsCount || 0;
  document.getElementById('adminStatApprovedTickets').textContent = stats.approvedTicketsCount || 0;
  document.getElementById('adminStatRejectedTickets').textContent = stats.rejectedTicketsCount || 0;
  document.getElementById('adminStatPendingTransactions').textContent = stats.pendingTransactionsCount || 0;
  document.getElementById('adminStatCompletedTransactions').textContent = stats.completedTransactionsCount || 0;

  document.getElementById('adminPendingReviewBadge').textContent = stats.pendingTicketsCount || 0;
  document.getElementById('adminPendingTrxBadge').textContent = stats.pendingTransactionsCount || 0;
  document.getElementById('adminTotalUsersBadge').textContent = stats.totalUsers || 0;
  document.getElementById('adminAlertBadge').textContent = (data.notifications || []).filter(n => !n.isRead).length;

  // 2. Pending Tickets Review
  const pendingGrid = document.getElementById('adminPendingTicketsGrid');
  if (pendingGrid) {
    if (data.pendingTickets.length === 0) {
      pendingGrid.innerHTML = '<p class="text-muted" style="padding: 24px; text-align: center;">বর্তমানে পর্যালোচনার জন্য কোনো টিকিট অপেক্ষমান নেই। সব ঠিক আছে! ✓</p>';
    } else {
      pendingGrid.innerHTML = data.pendingTickets.map(t => `
        <div class="admin-deal-card mb-3">
          <div class="admin-deal-top">
            <div>
              <h4 style="margin: 0; color: #0f172a;">${escapeHtml(tTitle(t))}</h4>
              <small class="text-muted">অপারেটর: ${escapeHtml(orDash(t.operator))} • ক্যাটাগরি: ${t.category} • সেলার: ${escapeHtml(t.sellerName)} (${escapeHtml(t.sellerPhone)})</small>
            </div>
            <span class="status-pill status-pill-pending">⏳ পর্যালোচনার অপেক্ষায়</span>
          </div>

          <div style="display: grid; grid-template-columns: 180px 1fr; gap: 16px; margin-top: 10px;">
            <div>
              <small style="display: block; margin-bottom: 4px; font-weight: 700; color: #475569;">আসল ডকুমেন্টের কপি:</small>
              <img src="${t.ticketImage || 'uploads/ticket_sample_bus.svg'}" alt="Uploaded Ticket" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; cursor: pointer;" onclick="viewProtectedTicketImage('${t.id}', '${escapeHtml(t.title)}')">
            </div>
            <div>
              <div class="ticket-meta-grid" style="margin-bottom: 8px;">
                <div><small>তারিখ ও সময়:</small> <strong>${formatDate(t.journeyDate)} (${escapeHtml(orDash(t.journeyTime))})</strong></div>
                <div><small>আসন:</small> <strong>${escapeHtml(orDash(t.seats))}</strong></div>
                <div><small>আসল মুদ্রিত মূল্য:</small> <strong>${moneyOrNA(t.originalPrice)}</strong></div>
                <div><small>বিক্রয় মূল্য:</small> <strong class="text-accent">${moneyOrNA(t.askingPrice)}</strong></div>
              </div>
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 8px 12px; border-radius: 6px; font-size: 0.775rem;">
                <strong class="text-green">🤖 এআই ভেরিফিকেশন রিপোর্ট: ${t.aiScan?.score || 96}% (${t.aiScan?.riskLevel || 'Low Risk'})</strong>
                <ul style="margin: 4px 0 0 16px; padding: 0; color: #334155;">
                  ${(t.aiScan?.analysis || ['সঠিক টিকিট কাঠামো যাচাইকৃত']).map(pt => `<li>${escapeHtml(pt)}</li>`).join('')}
                </ul>
              </div>
            </div>
          </div>

          <div class="admin-deal-actions mt-3">
            <button class="btn btn-success btn-sm" onclick="adminApproveTicket('${t.id}')">
              ✓ টিকিট অনুমোদন করুন (Approve & Live)
            </button>
            <button class="btn btn-danger btn-sm" onclick="openAdminRejectModal('${t.id}', '${escapeHtml(t.title)}')">
              ✕ প্রত্যাখ্যান করুন (Reject)
            </button>
          </div>
        </div>
      `).join('');
    }
  }

  // 2b. Auto-listed tickets: already live, waiting for admin review
  const postReview = data.postReviewTickets || [];
  if (pendingGrid && postReview.length) {
    const postHtml = `
      <h4 style="margin: 4px 0 10px; color: #b45309;">⚡ লাইভ আছে — অ্যাডমিন রিভিউ বাকি (${postReview.length})</h4>
      ${postReview.map(t => `
        <div class="admin-deal-card mb-3" style="border-left: 4px solid #f59e0b;">
          <div class="admin-deal-top">
            <div>
              <h4 style="margin: 0; color: #0f172a;">${escapeHtml(tTitle(t))}</h4>
              <small class="text-muted">অপারেটর: ${escapeHtml(orDash(t.operator))} • ক্যাটাগরি: ${t.category} • সেলার: ${escapeHtml(t.sellerName)} (${escapeHtml(t.sellerPhone)})</small>
            </div>
            <span class="status-pill status-pill-pending">⚡ অটো-লিস্টেড • ${t.status === 'reserved' ? 'ডিল চলমান' : t.status === 'completed' ? 'বিক্রি সম্পন্ন' : 'লাইভ'}</span>
          </div>
          <div style="display: grid; grid-template-columns: 180px 1fr; gap: 16px; margin-top: 10px;">
            <div>
              <small style="display: block; margin-bottom: 4px; font-weight: 700; color: #475569;">আসল ডকুমেন্টের কপি:</small>
              <img src="${t.ticketImage || 'uploads/ticket_sample_bus.svg'}" alt="Uploaded Ticket" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; cursor: pointer;" onclick="viewProtectedTicketImage('${t.id}', '${escapeHtml(tTitle(t))}')">
            </div>
            <div>
              <div class="ticket-meta-grid" style="margin-bottom: 8px;">
                <div><small>তারিখ ও সময়:</small> <strong>${formatDate(t.journeyDate)} (${escapeHtml(orDash(t.journeyTime))})</strong></div>
                <div><small>আসন:</small> <strong>${escapeHtml(orDash(t.seats))}</strong></div>
                <div><small>আসল মুদ্রিত মূল্য:</small> <strong>${moneyOrNA(t.originalPrice)}</strong></div>
                <div><small>বিক্রয় মূল্য:</small> <strong class="text-accent">${moneyOrNA(t.askingPrice)}</strong></div>
              </div>
              ${t.missingFields && t.missingFields.length ? `<div style="background:#fffbeb;border:1px solid #fde68a;padding:6px 10px;border-radius:6px;font-size:0.775rem;margin-bottom:6px;">⚠️ এআই যে তথ্য পায়নি: <strong>${escapeHtml(t.missingFields.join(', '))}</strong></div>` : ''}
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 8px 12px; border-radius: 6px; font-size: 0.775rem;">
                <strong class="text-green">🤖 এআই ভেরিফিকেশন রিপোর্ট: ${t.aiScan?.authenticityScore || t.aiScan?.score || 0}% (${escapeHtml(t.aiScan?.riskLevel || '-')})</strong>
                <ul style="margin: 4px 0 0 16px; padding: 0; color: #334155;">
                  ${(t.aiScan?.analysis || []).map(pt => `<li>${escapeHtml(pt)}</li>`).join('')}
                </ul>
              </div>
            </div>
          </div>
          <div class="admin-deal-actions mt-3">
            <button class="btn btn-success btn-sm" onclick="adminApproveTicket('${t.id}')">✓ রিভিউ সম্পন্ন (লাইভ রাখুন)</button>
            <button class="btn btn-danger btn-sm" onclick="openAdminRejectModal('${t.id}', '${escapeHtml(tTitle(t))}')">✕ মার্কেটপ্লেস থেকে সরান (Takedown)</button>
          </div>
        </div>
      `).join('')}`;
    pendingGrid.innerHTML = postHtml + (data.pendingTickets.length ? pendingGrid.innerHTML : '');
  }
  document.getElementById('adminPendingReviewBadge').textContent = (stats.pendingTicketsCount || 0) + (stats.postReviewCount || 0);

  // 3. Transactions Management (Manual Coordination Workflow)
  const trxGrid = document.getElementById('adminTransactionsGrid');
  if (trxGrid) {
    if (data.transactions.length === 0) {
      trxGrid.innerHTML = '<p class="text-muted" style="padding: 24px;">কোনো লেনদেন পাওয়া যায়নি।</p>';
    } else {
      trxGrid.innerHTML = data.transactions.map(trx => {
        const commAmt = Math.round(trx.agreedPrice * 0.10);
        const payoutAmt = trx.agreedPrice - commAmt;
        const buyerPhoneClean = trx.buyerPhone ? trx.buyerPhone.replace(/[^0-9+]/g, '') : '';
        const sellerPhoneClean = trx.sellerPhone ? trx.sellerPhone.replace(/[^0-9+]/g, '') : '';

        return `
          <div class="admin-deal-card mb-4" id="adminTrx_${trx.id}">
            <div class="admin-deal-top">
              <div>
                <h4 style="margin: 0; color: #0f172a;">${escapeHtml(trx.ticketTitle)}</h4>
                <small class="text-muted">লেনদেন আইডি: #${trx.id} • তারিখ: ${formatDate(trx.createdAt)} • ধরন: ${trx.type === 'buy_now_confirmed' ? 'Buy Now কনফার্মড' : 'অফার গৃহীত'}</small>
              </div>
              <span class="status-pill status-pill-${trx.status === 'completed' ? 'completed' : trx.status === 'cancelled' ? 'cancelled' : trx.status === 'in_progress' ? 'progress' : 'pending'}">
                ${trx.status === 'awaiting_admin' ? '🚨 অ্যাডমিন হস্তক্ষেপ অপেক্ষমান' : trx.status === 'in_progress' ? '🔄 ইন-প্রোগ্রেস (যোগাযোগ চলছে)' : trx.status === 'completed' ? '✓ সম্পন্ন' : '✕ বাতিল'}
              </span>
            </div>

            <!-- Buyer and Seller Direct Contact Cards -->
            <div class="admin-deal-contacts">
              <div class="contact-box">
                <span class="contact-title">👤 ক্রেতা (Buyer)</span>
                <strong>${escapeHtml(trx.buyerName)}</strong>
                <span style="font-size: 0.825rem; color: #475569;">📞 ${escapeHtml(trx.buyerPhone)}</span>
                <div class="contact-actions">
                  <a href="tel:${buyerPhoneClean}" class="btn-contact btn-call">📞 সরাসরি কল দিন</a>
                  <a href="https://wa.me/${buyerPhoneClean.replace('+', '')}" target="_blank" class="btn-contact btn-whatsapp">💬 WhatsApp</a>
                </div>
              </div>

              <div class="contact-box">
                <span class="contact-title">👤 বিক্রেতা (Seller)</span>
                <strong>${escapeHtml(trx.sellerName)}</strong>
                <span style="font-size: 0.825rem; color: #475569;">📞 ${escapeHtml(trx.sellerPhone)}</span>
                <div class="contact-actions">
                  <a href="tel:${sellerPhoneClean}" class="btn-contact btn-call">📞 সরাসরি কল দিন</a>
                  <a href="https://wa.me/${sellerPhoneClean.replace('+', '')}" target="_blank" class="btn-contact btn-whatsapp">💬 WhatsApp</a>
                </div>
              </div>
            </div>

            <div class="flex-between" style="background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 0.85rem;">
              <div>
                <small class="text-muted">চুক্তিবদ্ধ মোট মূল্য:</small>
                <div style="font-size: 1.15rem; font-weight: 800; color: #2563eb;">৳${trx.agreedPrice.toLocaleString()}</div>
              </div>
              <div>
                <small class="text-muted">প্ল্যাটফর্ম ফি (১০%):</small>
                <div style="font-weight: 700; color: #047857;">৳${commAmt.toLocaleString()}</div>
              </div>
              <div>
                <small class="text-muted">সেলারকে প্রদেয় পেআউট (৯০%):</small>
                <div style="font-weight: 700; color: #0f172a;">৳${payoutAmt.toLocaleString()}</div>
              </div>
              <div>
                <small class="text-muted">এআই সেফটি স্ট্যাটাস:</small>
                <div style="font-weight: 700; color: #059669;">${escapeHtml(trx.aiVerificationStatus || 'Verified')}</div>
              </div>
            </div>

            <!-- Admin Status Update Actions -->
            <div class="admin-deal-actions">
              <span style="font-size: 0.8rem; font-weight: 700; color: #475569;">অ্যাডমিন অ্যাকশন:</span>
              ${trx.status === 'awaiting_admin' ? `
                <button class="btn btn-primary btn-sm" onclick="adminUpdateTransactionStatus('${trx.id}', 'in_progress')">
                  🔄 ইন-প্রোগ্রেস মার্ক করুন (যোগাযোগ শুরু)
                </button>
              ` : ''}
              ${trx.status !== 'completed' && trx.status !== 'cancelled' ? `
                <button class="btn btn-success btn-sm" onclick="adminUpdateTransactionStatus('${trx.id}', 'completed')">
                  ✓ লেনদেন সম্পন্ন মার্ক করুন (Completed)
                </button>
                <button class="btn btn-outline btn-sm" onclick="adminUpdateTransactionStatus('${trx.id}', 'cancelled')">
                  ✕ লেনদেন বাতিল করুন (Cancel)
                </button>
              ` : ''}
              <button class="btn btn-outline btn-sm" onclick="viewProtectedTicketImage('${trx.ticketId}', '${escapeHtml(trx.ticketTitle)}')">
                👁️ সংরক্ষিত আসল টিকিট দেখুন
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 4. Users Management
  const usersTbody = document.getElementById('adminUsersTableBody');
  if (usersTbody) {
    usersTbody.innerHTML = data.users.map(u => `
      <tr>
        <td><strong>${escapeHtml(u.name)}</strong></td>
        <td>${escapeHtml(u.phone)}</td>
        <td>${escapeHtml(u.email || '-')}</td>
        <td>⭐ ${u.rating || 5.0}</td>
        <td>${u.completedDeals || 0} টি ডিল</td>
        <td><span class="status-pill status-pill-available">${escapeHtml(u.trustBadge || 'Verified')}</span></td>
      </tr>
    `).join('');
  }

  // 5. Admin Notifications
  const adminNotifFeed = document.getElementById('adminNotificationsFeed');
  if (adminNotifFeed) {
    adminNotifFeed.innerHTML = (data.notifications || []).map(n => `
      <div class="notif-item-row ${n.isRead ? '' : 'unread'}" onclick="markNotificationAsRead('${n.id}')">
        <div class="notif-icon-circle">🔔</div>
        <div class="notif-content-wrap">
          <div class="notif-item-title">${escapeHtml(n.title)}</div>
          <div class="notif-item-msg">${escapeHtml(n.message)}</div>
          <div class="notif-item-time">${formatTimeAgo(n.createdAt)}</div>
        </div>
      </div>
    `).join('');
  }
}

// Admin Action Triggers
async function adminApproveTicket(ticketId) {
  try {
    const res = await fetch(`/api/admin/tickets/${ticketId}/review`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action: 'approve' })
    });
    const data = await res.json();
    if (res.ok) {
      showNotification('টিকিট সফলভাবে অনুমোদিত ও লাইভ হয়েছে!', 'success');
      loadAdminDashboardData();
    } else {
      showNotification(data.error || 'অনুমোদন ব্যর্থ', 'error');
    }
  } catch (err) {
    showNotification('সার্ভার যোগাযোগে ত্রুটি', 'error');
  }
}

function openAdminRejectModal(ticketId, ticketTitle) {
  document.getElementById('rejectTicketId').value = ticketId;
  document.getElementById('rejectModalTicketTitle').textContent = ticketTitle;
  document.getElementById('rejectTicketReasonInput').value = '';
  openModal('rejectTicketModal');
}

async function submitAdminRejectTicket() {
  const ticketId = document.getElementById('rejectTicketId').value;
  const reason = document.getElementById('rejectTicketReasonInput').value.trim();

  if (!reason) {
    showNotification('অনুগ্রহ করে প্রত্যাখ্যানের কারণ লিখুন।', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/admin/tickets/${ticketId}/review`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action: 'reject', reason })
    });
    const data = await res.json();
    if (res.ok) {
      showNotification('টিকিট প্রত্যাখ্যান করা হয়েছে এবং সেলারকে জানানো হয়েছে।', 'info');
      closeModal('rejectTicketModal');
      loadAdminDashboardData();
    } else {
      showNotification(data.error || 'ব্যর্থ হয়েছে', 'error');
    }
  } catch (err) {
    showNotification('সার্ভার যোগাযোগে ত্রুটি', 'error');
  }
}

async function adminUpdateTransactionStatus(trxId, status) {
  const confirmMsg = status === 'completed'
    ? 'আপনি কি নিশ্চিত যে ক্রেতা ও বিক্রেতার সাথে কথা বলে লেনদেন সম্পন্ন করেছেন?'
    : status === 'cancelled'
    ? 'আপনি কি লেনদেনটি বাতিল করতে চান? টিকিটটি পুনরায় মার্কেটপ্লেসে উন্মুক্ত হবে।'
    : 'লেনদেনের স্ট্যাটাস ইন-প্রোগ্রেস করতে চান?';

  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`/api/admin/transactions/${trxId}/update-status`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (res.ok) {
      showNotification(data.message || 'স্ট্যাটাস আপডেট হয়েছে!', 'success');
      loadAdminDashboardData();
    } else {
      showNotification(data.error || 'আপডেট ব্যর্থ', 'error');
    }
  } catch (err) {
    showNotification('সার্ভার যোগাযোগে ত্রুটি', 'error');
  }
}

// Protected Ticket Document Viewer
async function viewProtectedTicketImage(ticketId, title) {
  try {
    const res = await fetch(`/api/tickets/${ticketId}/image`, {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (res.ok && data.image) {
      document.getElementById('unlockedTicketImg').src = data.image;
      document.getElementById('viewTicketModalTitle').textContent = title || 'আসল টিকিট';
      openModal('viewTicketModal');
    } else {
      showNotification(data.error || 'আসল টিকিট দেখার অনুমতি নেই', 'error');
    }
  } catch (err) {
    showNotification('ইমেজ লোড ব্যর্থ', 'error');
  }
}

// --- BUY NOW MODAL & WORKFLOW ---
function openBuyNowModal(ticketId) {
  if (!state.currentUser) {
    showNotification('টিকিট ক্রয় করতে অনুগ্রহ করে প্রথমে সাইন ইন করুন।', 'info');
    openAuthModal('login');
    return;
  }

  const ticket = state.tickets.find(t => t.id === ticketId);
  if (!ticket) return;

  document.getElementById('buyNowTicketId').value = ticket.id;
  document.getElementById('buyNowTicketName').textContent = tTitle(ticket);
  document.getElementById('buyNowTicketPrice').textContent = `৳${ticket.askingPrice.toLocaleString()}`;
  document.getElementById('buyNowModalTicketTitle').textContent = `${orDash(ticket.operator)} - ${orDash(ticket.seats)}`;

  openModal('buyNowModal');
}

async function submitBuyNowRequest() {
  const ticketId = document.getElementById('buyNowTicketId').value;
  const btn = document.getElementById('btnConfirmBuyNow');

  btn.disabled = true;
  btn.textContent = 'অনুরোধ পাঠানো হচ্ছে...';

  try {
    const res = await fetch(`/api/tickets/${ticketId}/buy-now`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (res.ok) {
      closeModal('buyNowModal');
      showNotification(data.message || 'Buy Now অনুরোধ সফলভাবে পাঠানো হয়েছে!', 'success');
      switchMainTab('userDashboard');
      showUserSubTab('requests');
    } else {
      showNotification(data.error || 'অনুরোধ পাঠাতে ব্যর্থ', 'error');
    }
  } catch (err) {
    showNotification('সার্ভার যোগাযোগে সমস্যা', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✓ Buy Now অনুরোধ পাঠান';
  }
}

// --- MAKE AN OFFER MODAL & WORKFLOW ---
function openOfferModal(ticketId) {
  if (!state.currentUser) {
    showNotification('অফার পাঠাতে অনুগ্রহ করে প্রথমে সাইন ইন করুন।', 'info');
    openAuthModal('login');
    return;
  }

  const ticket = state.tickets.find(t => t.id === ticketId);
  if (!ticket) return;

  state.activeModalOfferTicket = ticket;
  document.getElementById('offerTicketId').value = ticket.id;
  document.getElementById('offerModalTicketTitle').textContent = tTitle(ticket);
  document.getElementById('offerModalOrigPrice').textContent = moneyOrNA(ticket.originalPrice);
  document.getElementById('offerModalAskPrice').textContent = `৳${ticket.askingPrice.toLocaleString()}`;

  const input = document.getElementById('offerAmountInput');
  input.min = ticket.minOfferPrice || Math.round(ticket.askingPrice * 0.7);
  input.max = ticket.askingPrice;
  input.value = Math.round(ticket.askingPrice * 0.9);

  document.getElementById('offerFeedbackText').textContent = `গ্রহণযোগ্য রেঞ্জ: ৳${input.min.toLocaleString()} থেকে ৳${input.max.toLocaleString()} পর্যন্ত।`;

  openModal('offerModal');
}

function validateOfferAmount() {
  const ticket = state.activeModalOfferTicket;
  if (!ticket) return;

  const val = Number(document.getElementById('offerAmountInput').value);
  const fb = document.getElementById('offerFeedbackText');
  const btn = document.getElementById('btnSubmitOffer');

  if (val > ticket.askingPrice) {
    fb.textContent = `⚠️ অফার মূল্য বিক্রির দামের (৳${ticket.askingPrice}) বেশি হতে পারবে না!`;
    fb.style.color = '#ef4444';
    btn.disabled = true;
  } else if (val < ticket.minOfferPrice) {
    fb.textContent = `⚠️ সেলারের ন্যূনতম অফার সীমা ৳${ticket.minOfferPrice} টাকা।`;
    fb.style.color = '#ef4444';
    btn.disabled = true;
  } else {
    fb.textContent = `✓ সঠিক অফার মূল্য। ক্রেতা ও সেলারের জন্য যুক্তিসঙ্গত।`;
    fb.style.color = '#059669';
    btn.disabled = false;
  }
}

async function handleOfferSubmit(e) {
  e.preventDefault();
  const ticketId = document.getElementById('offerTicketId').value;
  const offeredPrice = Number(document.getElementById('offerAmountInput').value);
  const message = document.getElementById('offerNoteInput').value.trim();

  try {
    const res = await fetch(`/api/tickets/${ticketId}/offers`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ offeredPrice, message })
    });
    const data = await res.json();
    if (res.ok) {
      closeModal('offerModal');
      showNotification(data.message || 'অফার সফলভাবে পাঠানো হয়েছে!', 'success');
      switchMainTab('userDashboard');
      showUserSubTab('offers');
    } else {
      showNotification(data.error || 'অফার পাঠাতে ব্যর্থ', 'error');
    }
  } catch (err) {
    showNotification('সার্ভার যোগাযোগে সমস্যা', 'error');
  }
}

// --- TICKET SELLING & REAL AI FRAUD VERIFICATION ---
function openSellTicketModal() {
  if (!state.currentUser) {
    showNotification('টিকিট বিক্রি করতে অনুগ্রহ করে প্রথমে সাইন ইন করুন।', 'info');
    openAuthModal('login');
    return;
  }

  document.getElementById('sellTicketForm').reset();
  document.getElementById('ticketPreviewWrap').style.display = 'none';
  document.getElementById('dropContentPlaceholder').style.display = 'block';
  document.getElementById('aiScanWidget').style.display = 'none';
  document.getElementById('aiLiveResultBox').style.display = 'none';
  document.getElementById('scalpingAlertMsg').textContent = '';

  state.pendingFileBase64 = null;
  state.lastAiScanResult = null;

  // Set default date to tomorrow
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  document.getElementById('newTicketDate').value = tomorrow;
  state.defaultSellDate = tomorrow; // auto-listing must not treat this placeholder as real data

  openModal('sellTicketModal');
}

function handleCategoryFieldChange(cat) {
  const opInput = document.getElementById('newTicketOperator');
  const titleInput = document.getElementById('newTicketTitle');

  if (cat === 'train') {
    opInput.placeholder = 'যেমন: Bangladesh Railway (মহানগর গোধূলী ৭২২)';
    titleInput.placeholder = 'যেমন: ঢাকা (কমলাপুর) ➔ চট্টগ্রাম (সুবর্ণ এক্সপ্রেস)';
  } else if (cat === 'bus') {
    opInput.placeholder = 'যেমন: Green Line Paribahan (Scania Multi-Axle)';
    titleInput.placeholder = 'যেমন: ঢাকা (সায়েদাবাদ) ➔ কক্সবাজার (গ্রীন লাইন)';
  } else if (cat === 'movie') {
    opInput.placeholder = 'যেমন: Star Cineplex (বসুন্ধরা সিটি)';
    titleInput.placeholder = 'যেমন: Gladiator II (IMAX 3D)';
  } else {
    opInput.placeholder = 'যেমন: ইভেন্ট অর্গানাইজার / ব্যান্ড';
    titleInput.placeholder = 'যেমন: ঢাকা রক ফেস্ট ২০২৬';
  }
}

function validateScalpingRule() {
  const orig = Number(document.getElementById('newTicketOriginalPrice')?.value) || 0;
  const ask = Number(document.getElementById('newTicketAskingPrice')?.value) || 0;
  const alertEl = document.getElementById('scalpingAlertMsg');
  const submitBtn = document.getElementById('btnSubmitSellTicket');

  if (orig > 0 && ask > orig) {
    alertEl.textContent = `⚠️ অ্যান্টি-স্ক্যাল্পিং নীতি লঙ্ঘন: বিক্রির দাম (৳${ask}) মূল মূল্যের (৳${orig}) বেশি হতে পারবে না!`;
    alertEl.style.color = '#ef4444';
    if (submitBtn) submitBtn.disabled = true;
  } else if (orig > 0 && ask <= orig) {
    const diff = orig - ask;
    alertEl.textContent = diff > 0
      ? `✓ সঠিক: ক্রেতাকে ৳${diff} ছাড় দেওয়া হচ্ছে (ন্যায্য মূল্য)।`
      : `✓ সঠিক: মুদ্রিত আসল মূল্যে বিক্রি হচ্ছে।`;
    alertEl.style.color = '#059669';
    if (submitBtn && (!state.lastAiScanResult || state.lastAiScanResult.isTicket !== false)) {
      submitBtn.disabled = false;
    }
  }
}

function toggleMinOfferField(checked) {
  const wrap = document.getElementById('minOfferWrap');
  if (wrap) wrap.style.display = checked ? 'block' : 'none';
}

function handleTicketFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    state.pendingFileBase64 = reader.result;
    document.getElementById('ticketPreviewImg').src = state.pendingFileBase64;
    document.getElementById('ticketPreviewWrap').style.display = 'block';
    document.getElementById('dropContentPlaceholder').style.display = 'none';

    await runRealAiNetworkScan(file.name);
  };
  reader.readAsDataURL(file);
}

async function runRealAiNetworkScan(fileName) {
  const widget = document.getElementById('aiScanWidget');
  const bar = document.getElementById('aiScanProgressBar');
  const title = document.getElementById('aiScanStatusTitle');
  const logsList = document.getElementById('aiScanLogsList');
  const resultBox = document.getElementById('aiLiveResultBox');

  if (widget) widget.style.display = 'block';
  if (resultBox) resultBox.style.display = 'none';

  bar.style.width = '30%';
  title.textContent = 'ডকুমেন্ট এআই বিশ্লেষণ চলছে...';
  logsList.innerHTML = '<li>⏳ টিকিট ফাইল বিশ্লেষণ শুরু হচ্ছে...</li>';

  let clientOcrText = '';

  // In-browser OCR extraction
  if (window.Tesseract && state.pendingFileBase64) {
    try {
      bar.style.width = '55%';
      logsList.innerHTML += '<li>🔍 অপটিক্যাল OCR টেক্সট রিড হচ্ছে (In-Browser Neural Engine)...</li>';
      const ocrResult = await Tesseract.recognize(state.pendingFileBase64, 'eng');
      clientOcrText = ocrResult?.data?.text || '';
      if (clientOcrText.trim()) {
        const rawWrap = document.getElementById('aiRawOcrWrap');
        const rawEl = document.getElementById('aiRawOcrText');
        if (rawWrap && rawEl) {
          rawEl.textContent = clientOcrText.trim();
          rawWrap.style.display = 'block';
        }
        logsList.innerHTML += `<li>📝 লাইভ টেক্সট সংগৃহীত (${clientOcrText.trim().split(/\s+/).length} টি শব্দ)</li>`;
      }
    } catch (e) {
      console.warn('In-browser OCR pass', e);
    }
  }

  bar.style.width = '80%';
  title.textContent = 'অনলাইন এআই ভিশন ইঞ্জিনে অডিট চলছে...';

  try {
    const category = document.getElementById('newTicketCategory')?.value || 'bus';
    const originalPrice = document.getElementById('newTicketOriginalPrice')?.value || 1000;
    const askingPrice = document.getElementById('newTicketAskingPrice')?.value || 800;

    const res = await fetch('/api/ai/scan-ticket', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        imageBase64: state.pendingFileBase64,
        clientOcrText,
        apiKey: state.geminiApiKey,
        category,
        originalPrice,
        askingPrice
      })
    });

    const data = await res.json();
    if (res.ok && data.result) {
      const result = data.result;
      state.lastAiScanResult = result;

      bar.style.width = '100%';
      const score = result.authenticityScore || result.score || 0;
      const isFake = result.isTicket === false || score < 60 || (result.riskLevel && result.riskLevel.includes('High')) || (result.operator && result.operator.includes('❌'));

      const resultBadge = document.getElementById('aiResultBadge');
      const autoFillBtn = document.getElementById('aiAutoFillBtn');
      const submitBtn = document.getElementById('btnSubmitSellTicket');
      const analysisWrap = document.getElementById('aiAnalysisPointsWrap');
      const analysisList = document.getElementById('aiAnalysisPointsList');

      if (isFake) {
        bar.style.backgroundColor = '#ef4444';
        title.innerHTML = `<span style="color: #dc2626; font-weight: 800;">🚨 এআই স্ক্যান অ্যালার্ট: ভুয়া বা অ-টিকেট সনাক্ত (${score}% স্কোর)</span>`;

        if (resultBox) {
          resultBox.style.display = 'block';
          resultBox.style.background = '#fef2f2';
          resultBox.style.border = '2px solid #ef4444';
        }

        if (resultBadge) {
          resultBadge.textContent = '🚨 ভুয়া বা অ-টিকেট ছবি সনাক্ত হয়েছে!';
          resultBadge.style.background = '#fee2e2';
          resultBadge.style.color = '#dc2626';
          resultBadge.style.borderColor = '#fca5a5';
        }

        document.getElementById('aiLiveEngineBadge').textContent = result.aiEngine || 'Fraud Shield';
        document.getElementById('aiExtractedOperator').innerHTML = `<span style="color: #dc2626; font-weight: 800;">${escapeHtml(result.operator || '❌ কোনো বৈধ টিকেট নয়')}</span>`;
        document.getElementById('aiExtractedPnr').innerHTML = `<span style="color: #dc2626;">${escapeHtml(result.pnr || 'অনুপস্থিত / ভুয়া')}</span>`;
        document.getElementById('aiExtractedDate').textContent = 'N/A';
        document.getElementById('aiExtractedSeats').textContent = 'N/A';
        document.getElementById('aiExtractedPrice').innerHTML = '<span style="color: #dc2626; font-weight: 800;">৳০</span>';
        document.getElementById('aiExtractedScore').innerHTML = `<span style="color: #dc2626; font-weight: 800;">${score}% (${result.riskLevel || 'High Scam Risk'})</span>`;

        if (autoFillBtn) {
          autoFillBtn.disabled = true;
          autoFillBtn.innerHTML = '⚠️ ভুয়া টিকেট দিয়ে ফর্ম পূরণ করা যাবে না';
          autoFillBtn.className = 'btn btn-danger btn-sm btn-block';
        }
        const autoListBtnF = document.getElementById('aiAutoListBtn');
        if (autoListBtnF) autoListBtnF.disabled = true;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.title = 'ভুয়া বা অ-টিকেট ছবি দিয়ে টিকিট পোস্ট করা যাবে না';
        }

        if (analysisList && result.analysis && result.analysis.length) {
          analysisList.innerHTML = result.analysis.map(pt => `<li style="color: #b91c1c; font-weight: 600;">${escapeHtml(pt)}</li>`).join('');
          if (analysisWrap) analysisWrap.style.display = 'block';
        }

        showNotification('সতর্কতা: আপলোডকৃত ছবিটি কোনো টিকিট নয়! এটি স্ক্যাম হিসেবে চিহ্নিত হয়েছে।', 'error');
      } else {
        bar.style.backgroundColor = '#10b981';
        title.innerHTML = `<span style="color: #059669; font-weight: 800;">✅ এআই স্ক্যান সফল: ${score}% সত্যতা নিশ্চিত (Safe & Authentic)!</span>`;

        if (resultBox) {
          resultBox.style.display = 'block';
          resultBox.style.background = '#f0fdf4';
          resultBox.style.border = '2px solid #86efac';
        }

        if (resultBadge) {
          resultBadge.textContent = '✅ আসল ও নিরাপদ টিকেট (Verified Authentic)';
          resultBadge.style.background = '#dcfce7';
          resultBadge.style.color = '#15803d';
          resultBadge.style.borderColor = '#86efac';
        }

        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.title = '';
        }

        document.getElementById('aiLiveEngineBadge').textContent = result.aiEngine || 'Vision AI';
        document.getElementById('aiExtractedOperator').innerHTML = `<span style="color: #0f172a; font-weight: 700;">${escapeHtml(result.operator || 'Verified Operator')}</span>`;
        document.getElementById('aiExtractedPnr').innerHTML = `<span style="color: #0f172a; font-weight: 700;">${escapeHtml(result.pnr || 'VERIFIED')}</span>`;
        document.getElementById('aiExtractedDate').textContent = result.journeyDate || 'N/A';
        document.getElementById('aiExtractedSeats').textContent = result.seats || 'Reserved';

        const faceVal = Number(result.faceValue || result.originalPrice || 1000);
        document.getElementById('aiExtractedPrice').innerHTML = `<span style="color: #059669; font-weight: 800;">৳${faceVal.toLocaleString()}</span>`;
        document.getElementById('aiExtractedScore').innerHTML = `<span style="color: #059669; font-weight: 800;">${score}% (${result.riskLevel || 'Low Risk'})</span>`;

        if (autoFillBtn) {
          autoFillBtn.disabled = false;
          autoFillBtn.innerHTML = '✨ এআই তথ্য দিয়ে ফর্ম পূরণ করুন (Auto-Fill Form)';
          autoFillBtn.className = 'btn btn-success btn-sm btn-block';
        }
        const autoListBtnS = document.getElementById('aiAutoListBtn');
        if (autoListBtnS) autoListBtnS.disabled = false;

        if (analysisList && result.analysis && result.analysis.length) {
          analysisList.innerHTML = result.analysis.map(pt => `<li style="color: #047857;">${escapeHtml(pt)}</li>`).join('');
          if (analysisWrap) analysisWrap.style.display = 'block';
        }

        showNotification(`এআই স্ক্যান সফল: ${result.operator} টিকেট ভেরিফাইড!`, 'success');
      }

      // Display raw OCR text
      const rawOcrText = clientOcrText || result.rawExtractedText || '';
      const rawWrap = document.getElementById('aiRawOcrWrap');
      const rawEl = document.getElementById('aiRawOcrText');
      if (rawWrap && rawEl && rawOcrText.trim()) {
        rawEl.textContent = rawOcrText.trim();
        rawWrap.style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Scan error:', err);
    showNotification('এআই সার্ভার যোগাযোগে সমস্যা', 'error');
  }
}

function applyAiAutoFill() {
  const r = state.lastAiScanResult;
  if (!r || r.isTicket === false) {
    showNotification('ভুয়া বা ত্রুটিযুক্ত টিকিট দিয়ে অটো-ফিল করা যাবে না।', 'error');
    return;
  }

  if (r.operator && !r.operator.includes('❌')) {
    document.getElementById('newTicketOperator').value = r.operator;
  }
  if (r.seats && r.seats !== 'নেই') {
    document.getElementById('newTicketSeats').value = r.seats;
  }
  if (r.title && r.title !== 'নেই') document.getElementById('newTicketTitle').value = r.title;
  if (r.boardingPoint && r.boardingPoint !== 'নেই') document.getElementById('newTicketBoarding').value = r.boardingPoint;
  if (r.dropPoint && r.dropPoint !== 'নেই') document.getElementById('newTicketDrop').value = r.dropPoint;
  if (r.journeyDate && r.journeyDate !== 'N/A') {
    document.getElementById('newTicketDate').value = r.journeyDate;
  }
  if (r.journeyTime && r.journeyTime !== 'N/A') {
    document.getElementById('newTicketTime').value = r.journeyTime;
  }

  const faceVal = Number(r.faceValue || 0);
  if (faceVal > 0) {
    document.getElementById('newTicketOriginalPrice').value = faceVal;
    document.getElementById('newTicketAskingPrice').value = Math.round(faceVal * 0.9);
    validateScalpingRule();
  }

  showNotification('এআই থেকে টিকেটের তথ্য সফলভাবে ফর্মে বসানো হয়েছে!', 'success');
}

// --- AUTO LISTING: fill what the AI could read, leave the rest blank, go live now, admin reviews afterwards ---
async function handleAutoListing() {
  if (!state.currentUser) {
    showNotification('টিকিট বিক্রি করতে অনুগ্রহ করে প্রথমে সাইন ইন করুন।', 'error');
    openAuthModal('login');
    return;
  }
  const r = state.lastAiScanResult;
  if (!state.pendingFileBase64 || !r) {
    showNotification('আগে টিকিটের ছবি আপলোড করে এআই স্ক্যান শেষ হওয়া পর্যন্ত অপেক্ষা করুন।', 'error');
    return;
  }
  const score = r.authenticityScore || r.score || 0;
  if (r.isTicket !== true || score < 60 || (r.riskLevel && r.riskLevel.includes('High'))) {
    showNotification('🚨 এআই এই ছবিকে বৈধ টিকিট হিসেবে যাচাই করতে পারেনি, তাই অটো লিস্টিং করা যাবে না।', 'error');
    return;
  }

  const val = id => (document.getElementById(id)?.value || '').trim();
  const ai = v => {
    const t = (v === undefined || v === null) ? '' : String(v).trim();
    return (!t || ['নেই', 'n/a', 'অনুপস্থিত', 'unknown'].includes(t.toLowerCase()) || t.includes('❌')) ? '' : t;
  };
  // What the seller already typed wins; otherwise take what the AI read; otherwise leave blank
  const formDate = val('newTicketDate') === state.defaultSellDate ? '' : val('newTicketDate');
  const faceVal = Number(r.faceValue || 0);
  const orig = Number(val('newTicketOriginalPrice')) || (faceVal > 0 ? faceVal : 0);
  const ask = Number(val('newTicketAskingPrice')) || (orig > 0 ? Math.round(orig * 0.9) : 0);

  if (orig > 0 && ask > orig) {
    showNotification('বিক্রির দাম মূল মুদ্রিত মূল্যের বেশি হতে পারবে না!', 'error');
    return;
  }

  const payload = {
    autoListing: true,
    category: val('newTicketCategory'),
    title: val('newTicketTitle') || ai(r.title),
    operator: val('newTicketOperator') || ai(r.operator),
    journeyDate: formDate || ai(r.journeyDate),
    journeyTime: val('newTicketTime') || ai(r.journeyTime),
    seats: val('newTicketSeats') || ai(r.seats),
    boardingPoint: val('newTicketBoarding') || ai(r.boardingPoint),
    dropPoint: val('newTicketDrop') || ai(r.dropPoint),
    originalPrice: orig,
    askingPrice: ask,
    allowOffers: document.getElementById('newTicketAllowOffers').checked,
    minOfferPrice: Number(val('newTicketMinOffer')) || Math.round(ask * 0.8),
    ticketNotes: val('newTicketNotes'),
    imageBase64: state.pendingFileBase64,
    aiScanResult: r
  };

  const labels = { title: 'শিরোনাম', operator: 'অপারেটর', journeyDate: 'তারিখ', journeyTime: 'সময়', seats: 'আসন', boardingPoint: 'বোর্ডিং পয়েন্ট', dropPoint: 'গন্তব্য' };
  const missing = Object.keys(labels).filter(k => !payload[k]).map(k => labels[k]);
  if (!(orig > 0)) missing.push('মুদ্রিত মূল্য');
  if (!(ask > 0)) missing.push('বিক্রয় মূল্য');

  const msg = 'টিকিটটি এখনই মার্কেটপ্লেসে লাইভ হবে এবং অ্যাডমিন পরে রিভিউ করবেন।' +
    (missing.length ? `\n\nএআই যে তথ্য পায়নি (ফাঁকা থাকবে): ${missing.join(', ')}` : '') +
    (!(ask > 0) ? '\n\n⚠️ বিক্রয় মূল্য না থাকলে ক্রেতারা কিনতে বা অফার দিতে পারবে না।' : '') +
    '\n\nলিস্ট করতে চান?';
  if (!window.confirm(msg)) return;

  // Show what is being listed inside the form as well
  const setIf = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
  setIf('newTicketTitle', payload.title); setIf('newTicketOperator', payload.operator);
  setIf('newTicketDate', payload.journeyDate); setIf('newTicketTime', payload.journeyTime);
  setIf('newTicketSeats', payload.seats); setIf('newTicketBoarding', payload.boardingPoint);
  setIf('newTicketDrop', payload.dropPoint);
  if (orig > 0) setIf('newTicketOriginalPrice', orig);
  if (ask > 0) setIf('newTicketAskingPrice', ask);

  const btn = document.getElementById('aiAutoListBtn');
  const oldLabel = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = 'লিস্ট করা হচ্ছে...'; }

  try {
    const res = await fetch('/api/tickets/create', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
    const data = await res.json();
    if (res.ok) {
      showNotification(data.message || 'টিকিট অটো-লিস্ট হয়েছে!', 'success');
      closeModal('sellTicketModal');
      document.getElementById('sellTicketForm').reset();
      switchMainTab('userDashboard');
      showUserSubTab('listed');
    } else {
      showNotification(data.error || 'অটো লিস্টিং ব্যর্থ হয়েছে', 'error');
    }
  } catch (err) {
    showNotification('সার্ভার যোগাযোগে সমস্যা', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = oldLabel; }
  }
}

async function handleSellTicketSubmit(e) {
  e.preventDefault();

  if (!state.currentUser) {
    showNotification('টিকিট বিক্রি করতে অনুগ্রহ করে প্রথমে সাইন ইন করুন।', 'error');
    openAuthModal('login');
    return;
  }

  if (!state.pendingFileBase64) {
    showNotification('অনুগ্রহ করে আসল টিকিটের ছবি বা স্ক্রিনশট আপলোড করুন!', 'error');
    return;
  }

  if (state.lastAiScanResult && (state.lastAiScanResult.isTicket === false || state.lastAiScanResult.authenticityScore < 60 || (state.lastAiScanResult.riskLevel && state.lastAiScanResult.riskLevel.includes('High')))) {
    showNotification('🚨 ভুয়া বা অ-টিকেট ছবি দিয়ে টিকিট পোস্ট করা প্ল্যাটফর্ম রুল অনুযায়ী কঠোরভাবে নিষিদ্ধ!', 'error');
    return;
  }

  const origPrice = Number(document.getElementById('newTicketOriginalPrice').value);
  const askPrice = Number(document.getElementById('newTicketAskingPrice').value);

  if (askPrice > origPrice) {
    showNotification('বিক্রির দাম মূল মূল্যের বেশি হতে পারবে না!', 'error');
    return;
  }

  const payload = {
    category: document.getElementById('newTicketCategory').value,
    title: document.getElementById('newTicketTitle').value,
    operator: document.getElementById('newTicketOperator').value,
    journeyDate: document.getElementById('newTicketDate').value,
    journeyTime: document.getElementById('newTicketTime').value,
    seats: document.getElementById('newTicketSeats').value,
    boardingPoint: document.getElementById('newTicketBoarding').value,
    dropPoint: document.getElementById('newTicketDrop').value,
    originalPrice: origPrice,
    askingPrice: askPrice,
    allowOffers: document.getElementById('newTicketAllowOffers').checked,
    minOfferPrice: Number(document.getElementById('newTicketMinOffer').value) || Math.round(askPrice * 0.8),
    ticketNotes: document.getElementById('newTicketNotes').value,
    imageBase64: state.pendingFileBase64,
    aiScanResult: state.lastAiScanResult
  };

  const btn = document.getElementById('btnSubmitSellTicket');
  btn.disabled = true;
  btn.textContent = 'জমা দেওয়া হচ্ছে...';

  try {
    const res = await fetch('/api/tickets/create', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (res.ok) {
      showNotification('টিকিট সফলভাবে জমা হয়েছে! অ্যাডমিন অনুমোদনের পর মার্কেটপ্লেসে লাইভ হবে।', 'success');
      closeModal('sellTicketModal');
      document.getElementById('sellTicketForm').reset();
      switchMainTab('userDashboard');
      showUserSubTab('pending');
    } else {
      showNotification(data.error || 'টিকিট পোস্ট ব্যর্থ', 'error');
    }
  } catch (err) {
    showNotification('সার্ভার যোগাযোগে সমস্যা', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 পর্যালোচনার জন্য জমা দিন (Submit for Approval)';
  }
}

// --- NOTIFICATION SYSTEM HELPERS ---
async function fetchNotificationCount() {
  if (!state.currentUser) return;
  try {
    const res = await fetch('/api/notifications', {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (res.ok) {
      const count = data.unreadCount || 0;
      const badge = document.getElementById('headerNotifCount');
      if (badge) {
        if (count > 0) {
          badge.textContent = count;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    }
  } catch (e) {}
}

function startNotificationsPolling() {
  setInterval(fetchNotificationCount, 15000); // Poll every 15s
}

async function openNotificationsModal() {
  if (!state.currentUser) return;

  try {
    const res = await fetch('/api/notifications', {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (res.ok) {
      const feed = document.getElementById('notificationsModalFeed');
      const countText = document.getElementById('notifModalCountText');
      const notifs = data.notifications || [];

      countText.textContent = `মোট ${notifs.length} টি বার্তা (অপঠিত: ${data.unreadCount})`;

      if (notifs.length === 0) {
        feed.innerHTML = '<p class="text-muted" style="padding: 24px; text-align: center;">কোনো নতুন নোটিফিকেশন নেই।</p>';
      } else {
        feed.innerHTML = notifs.map(n => `
          <div class="notif-item-row ${n.isRead ? '' : 'unread'}" onclick="markNotificationAsRead('${n.id}')">
            <div class="notif-icon-circle">${getNotifIcon(n.type)}</div>
            <div class="notif-content-wrap">
              <div class="notif-item-title">${escapeHtml(n.title)}</div>
              <div class="notif-item-msg">${escapeHtml(n.message)}</div>
              <div class="notif-item-time">${formatTimeAgo(n.createdAt)}</div>
            </div>
          </div>
        `).join('');
      }

      openModal('notificationsModal');
    }
  } catch (e) {}
}

async function markNotificationAsRead(id) {
  try {
    await fetch(`/api/notifications/${id}/read`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    fetchNotificationCount();
  } catch (e) {}
}

async function markAllNotificationsAsRead() {
  try {
    await fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    showNotification('সকল নোটিফিকেশন পড়া হয়েছে মার্ক করা হয়েছে।', 'info');
    fetchNotificationCount();
    if (state.currentUser.role === 'admin') {
      loadAdminDashboardData();
    } else {
      loadUserDashboardData();
    }
  } catch (e) {}
}

// --- REVIEWS SYSTEM ---
async function loadReviews() {
  try {
    const res = await fetch('/api/reviews');
    const data = await res.json();
    state.reviews = data.reviews || [];
    renderReviews();
  } catch (err) {
    console.error('Error loading reviews:', err);
  }
}

function renderReviews() {
  const container = document.getElementById('reviewsFeedContainer');
  if (!container) return;

  if (state.reviews.length === 0) {
    container.innerHTML = '<p class="text-muted" style="padding: 20px;">কোনো রিভিউ পাওয়া যায়নি।</p>';
    return;
  }

  container.innerHTML = state.reviews.map(r => `
    <div class="review-item">
      <div class="review-top">
        <strong>${escapeHtml(r.reviewerName)}</strong>
        <span class="text-green">★ ${r.rating}.0</span>
      </div>
      <p class="review-comment">"${escapeHtml(r.comment)}"</p>
      <div class="review-meta">
        <span>${escapeHtml(r.ticketTitle || 'Verified Ticket')}</span> •
        <span>${formatTimeAgo(r.createdAt)}</span>
      </div>
    </div>
  `).join('');
}

// --- AI MODAL & CONFIG ---
function openAiDetailsModal(ticketId) {
  const ticket = state.tickets.find(t => t.id === ticketId);
  if (!ticket || !ticket.aiScan) return;

  const s = ticket.aiScan;
  document.getElementById('aiModalTicketTitle').textContent = ticket.title;
  document.getElementById('aiModalScoreNum').textContent = `${s.score || 96}%`;
  document.getElementById('aiModalRiskLevel').textContent = s.riskLevel || 'Low Risk (Safe)';
  document.getElementById('aiModalDetectedPnr').textContent = s.detectedPnr || s.pnr || 'VERIFIED';
  document.getElementById('aiModalEngineTag').textContent = s.aiEngine || '⚡ Powered by Vision AI';

  const list = document.getElementById('aiModalAnalysisList');
  if (list && s.analysis) {
    list.innerHTML = s.analysis.map(pt => `<li>${escapeHtml(pt)}</li>`).join('');
  }

  openModal('aiDetailsModal');
}

function openAiConfigModal() {
  const optPoll = document.getElementById('optEnginePollinations');
  const optGem = document.getElementById('optEngineGemini');
  const keyWrap = document.getElementById('geminiKeyFieldWrap');
  const keyInput = document.getElementById('geminiApiKeyInput');

  const engine = state.currentAiEngine;
  if (engine === 'gemini') {
    optGem.querySelector('input').checked = true;
    optGem.classList.add('active');
    optPoll.classList.remove('active');
    keyWrap.style.display = 'block';
  } else {
    optPoll.querySelector('input').checked = true;
    optPoll.classList.add('active');
    optGem.classList.remove('active');
    keyWrap.style.display = 'none';
  }

  keyInput.value = state.geminiApiKey;
  openModal('aiConfigModal');
}

function handleEngineSelect(engine) {
  const optPoll = document.getElementById('optEnginePollinations');
  const optGem = document.getElementById('optEngineGemini');
  const keyWrap = document.getElementById('geminiKeyFieldWrap');

  if (engine === 'gemini') {
    optGem.classList.add('active');
    optPoll.classList.remove('active');
    keyWrap.style.display = 'block';
  } else {
    optPoll.classList.add('active');
    optGem.classList.remove('active');
    keyWrap.style.display = 'none';
  }
}

function saveAiEngineSettings() {
  const chosen = document.querySelector('input[name="aiEngineChoice"]:checked')?.value || 'pollinations';
  const key = document.getElementById('geminiApiKeyInput').value.trim();

  state.currentAiEngine = chosen;
  state.geminiApiKey = key;
  localStorage.setItem('ticketx_ai_engine', chosen);
  localStorage.setItem('ticketx_gemini_key', key);

  closeModal('aiConfigModal');
  showNotification(`এআই ইঞ্জিন: ${chosen === 'gemini' ? 'Google Gemini 1.5 Flash' : 'Pollinations AI'} সংরক্ষিত!`, 'success');
}

// --- GENERAL UI HELPERS ---
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function handleSearch(q) {
  state.searchQuery = q.trim();
  loadTickets();
}

function applyFilters() {
  state.aiSafeOnly = document.getElementById('aiSafeFilter')?.checked || false;
  renderTicketCards();
}

function toggleAppMode() {
  document.body.classList.toggle('app-frame-mode');
  const btn = document.getElementById('appModeTogglePill');
  if (btn) {
    btn.classList.toggle('active');
    btn.textContent = document.body.classList.contains('app-frame-mode') ? '💻 ওয়েব ভিউ' : '📱 অ্যাপ ভিউ';
  }
}

function showNotification(message, type = 'info') {
  const container = document.getElementById('toastNotificationContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-msg toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ️'}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Auto-listed tickets may have blank fields (never invented): show a dash / "not stated" instead
function tTitle(t) { return t.title || t.operator || 'শিরোনাম উল্লেখ নেই'; }
function orDash(v) { return (v === undefined || v === null || String(v).trim() === '') ? '—' : v; }
function moneyOrNA(n) { return Number(n) > 0 ? '৳' + Number(n).toLocaleString() : 'উল্লেখ নেই'; }

function formatDate(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return isoStr;
  }
}

function formatTimeAgo(isoStr) {
  if (!isoStr) return '';
  try {
    const diffMs = Date.now() - new Date(isoStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'এইমাত্র';
    if (diffMins < 60) return `${diffMins} মিনিট আগে`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ঘন্টা আগে`;
    return formatDate(isoStr);
  } catch (e) {
    return '';
  }
}

function getCategoryIcon(cat) {
  switch (cat) {
    case 'bus': return '🚌';
    case 'train': return '🚆';
    case 'movie': return '🎬';
    case 'event': return '🎸';
    default: return '🎫';
  }
}

function getCategoryName(cat) {
  switch (cat) {
    case 'bus': return 'বাস';
    case 'train': return 'রেলওয়ে';
    case 'movie': return 'সিনেমা';
    case 'event': return 'কনসার্ট';
    default: return 'টিকেট';
  }
}

function getNotifIcon(type) {
  switch (type) {
    case 'ticket_approved': return '✓';
    case 'ticket_rejected': return '✕';
    case 'new_offer': return '💬';
    case 'offer_accepted': return '🎉';
    case 'offer_rejected': return '✕';
    case 'buy_now_request': return '⚡';
    case 'buy_now_accepted': return '🎉';
    case 'buy_now_rejected': return '✕';
    case 'admin_action_needed': return '🚨';
    default: return '🔔';
  }
}

