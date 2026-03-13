document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // MODAL LOGIC
    // ==========================================
    const addModalOverlay = document.getElementById("addModalOverlay");
    const subFormOverlay   = document.getElementById("subFormOverlay");
    const trialFormOverlay = document.getElementById("trialFormOverlay");

    function openModal() {
        addModalOverlay.classList.add("visible");
        addModalOverlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function closeModal() {
        addModalOverlay.classList.remove("visible");
        addModalOverlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    function openSubForm() {
        closeModal();
        subFormOverlay.classList.add("visible");
        subFormOverlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        document.getElementById("subForm").reset();
        document.getElementById("subFormError").textContent = "";
    }

    function closeSubForm() {
        subFormOverlay.classList.remove("visible");
        subFormOverlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    function openTrialForm() {
        closeModal();
        trialFormOverlay.classList.add("visible");
        trialFormOverlay.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
        document.getElementById("trialForm").reset();
        document.getElementById("trialFormError").textContent = "";
    }

    function closeTrialForm() {
        trialFormOverlay.classList.remove("visible");
        trialFormOverlay.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    // Wire up choice modal
    document.getElementById("addBtn")?.addEventListener("click", openModal);
    document.getElementById("openAddModalNav")?.addEventListener("click", openModal);
    document.getElementById("closeAddModal")?.addEventListener("click", closeModal);
    addModalOverlay?.addEventListener("click", (e) => { if (e.target === addModalOverlay) closeModal(); });

    // Wire up choice buttons → open the right form
    document.getElementById("chooseSubscription")?.addEventListener("click", openSubForm);
    document.getElementById("chooseTrial")?.addEventListener("click", openTrialForm);

    // Close form modals
    document.getElementById("closeSubForm")?.addEventListener("click", closeSubForm);
    document.getElementById("closeTrialForm")?.addEventListener("click", closeTrialForm);
    subFormOverlay?.addEventListener("click", (e) => { if (e.target === subFormOverlay) closeSubForm(); });
    trialFormOverlay?.addEventListener("click", (e) => { if (e.target === trialFormOverlay) closeTrialForm(); });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { closeModal(); closeSubForm(); closeTrialForm(); }
    });

    // ==========================================
    // 2. SUBSCRIPTION FORM SUBMIT
    // ==========================================
    document.getElementById("subForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name     = document.getElementById("subName").value.trim();
        const amount   = parseFloat(document.getElementById("subAmount").value);
        const category = document.getElementById("subCategory").value;
        const date     = document.getElementById("subDate").value;
        const errorEl  = document.getElementById("subFormError");

        if (!name || isNaN(amount) || !date) {
            errorEl.textContent = "Please fill in all required fields.";
            return;
        }
        if (amount < 0) {
            errorEl.textContent = "Amount must be a positive number.";
            return;
        }

        //made by ai
        const CATEGORY_COLORS = {
            Entertainment: 'rgba(229,9,20,0.15)',
            Productivity:  'rgba(255,215,0,0.12)',
            Utilities:     'rgba(96,165,250,0.15)',
            Business:      'rgba(167,139,250,0.15)',
            Other:         'rgba(255,255,255,0.08)'
        };

        const newSub = {
            id:               Date.now(),
            name,
            amount,
            date,
            subscriptionType: category,
            color:            CATEGORY_COLORS[category] || CATEGORY_COLORS.Other,
            isTrial:          false
        };

        const ok = await saveSubscription(newSub);
        if (!ok) {
            errorEl.textContent = "Failed to save. Is the server running?";
            return;
        }

        subscriptions.push(newSub);
        renderSubscriptions();
        updateAllStats();
        closeSubForm();
    });

    // ==========================================
    // FREE TRIAL FORM SUBMIT
    // ==========================================
    document.getElementById("trialForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name     = document.getElementById("trialName").value.trim();
        const endDate  = document.getElementById("trialEndDate").value;
        const cost     = document.getElementById("trialCost").value;
        const category = document.getElementById("trialCategory").value;
        const errorEl  = document.getElementById("trialFormError");

        if (!name || !endDate) {
            errorEl.textContent = "Please fill in the service name and end date.";
            return;
        }

        const newTrial = {
            id:               Date.now(),
            name,
            amount:           cost ? parseFloat(cost) : 0,
            date:             endDate,
            subscriptionType: category,
            color:            'rgba(96,165,250,0.12)',
            isTrial:          true
        };

        const ok = await saveSubscription(newTrial);
        if (!ok) {
            errorEl.textContent = "Failed to save. Is the server running?";
            return;
        }

        subscriptions.push(newTrial);
        renderSubscriptions();
        updateAllStats();
        closeTrialForm();
    });

    // ==========================================
    // LOGIN LOGIC
    // ==========================================
    
    //const VALID_USERS = { user1: "pass1", user2: "pass2" }; //replace with .env values for security
    

    let currentUser = null;

    const loginOverlay    = document.getElementById("loginOverlay");
    const loginForm       = document.getElementById("loginForm");
    const loginUsername   = document.getElementById("loginUsername");
    const loginPassword   = document.getElementById("loginPassword");
    const loginError      = document.getElementById("loginError");
    const currentUserLabel = document.getElementById("currentUserLabel");
    const logoutBtn       = document.getElementById("logoutBtn");

    const updateAuthUi = () => {
        if (!currentUser) {
            document.body.classList.add("auth-locked");
            if (loginOverlay) loginOverlay.style.display = "flex";
            if (currentUserLabel) currentUserLabel.textContent = "Not signed in";
            hideHeader();
        } else {
            document.body.classList.remove("auth-locked");
            if (loginOverlay) loginOverlay.style.display = "none";
            if (currentUserLabel) currentUserLabel.textContent = `Signed in as ${currentUser}`;
            showHeader();
        }
    };

    updateAuthUi();

    logoutBtn?.addEventListener("click", () => {
        currentUser = null;
        if (loginUsername) loginUsername.value = "";
        if (loginPassword) loginPassword.value = "";
        if (loginError) loginError.textContent = "";
        updateAuthUi();
    });

    loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = loginUsername?.value.trim();
    const password = loginPassword?.value;
    if (!username || !password) return;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            loginError.textContent = '';
            updateAuthUi();
            loadSubscriptionsFromServer();
        } else {
            loginError.textContent = 'Invalid username or password.';
        }
        } catch (err) {
        console.error(err);
        loginError.textContent = 'Error connecting to server.';
    }
    });

    // ==========================================
    // AI ADVISOR CHAT FUNCTIONS & LISTENERS
    // ==========================================
    const aiInput = document.getElementById("aiChatInput");
    const aiSendBtn = document.getElementById("aiSendBtn");
    const aiMessages = document.getElementById("aiChatMessages");

    function typeMessage(message, container, speed = 15) {
        container.textContent = ''; // clear bubble
        let i = 0;
        const interval = setInterval(() => {
            container.textContent += message[i];
            i++;
            if (i >= message.length) {
                clearInterval(interval);
            }
        }, speed);
    }

    function addMessage(text, sender) {
        if (!aiMessages) return;
        const msg = document.createElement("div");
        msg.className = `ai-message ${sender}`;
        msg.textContent = text;
        aiMessages.appendChild(msg);
        aiMessages.scrollTop = aiMessages.scrollHeight;
    }

    function sendChat() {
        const text = aiInput.value.trim();
        if (!text) return;

        addMessage(text, "user");
        aiInput.value = "";

        // Call your server AI endpoint
        fetch('/api/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: text })
        })
        .then(res => res.json())
        .then(data => {
            if (data.answer) {
                const msg = document.createElement("div");
                msg.className = "ai-message ai";
                aiMessages.appendChild(msg);
                typeMessage(data.answer, msg, 15);
            } else {
                const msg = document.createElement("div");
                msg.className = "ai-message ai";
                aiMessages.appendChild(msg);
                typeMessage("Error: No response from AI.", msg, 15);
            }
        })
        .catch(err => {
            console.error(err);
            addMessage("Error contacting AI server.", "ai");
        });
    }

    aiSendBtn?.addEventListener("click", sendChat);
    aiInput?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") sendChat();
    });

    loadSubscriptions();
});

// ==========================================
// SUBSCRIPTION DATA
// ==========================================
let subscriptions = [];

// ==========================================
// API FUNCTIONS
// ==========================================
async function loadSubscriptions() {
    try {
        const res = await fetch('/api/subscriptions');
        subscriptions = await res.json();
    } catch (err) {
        console.warn('Could not load from server:', err);
        subscriptions = [];
    }
    renderSubscriptions();
    updateAllStats();
}
    // NOTE: I removed the stray "Add logic" that was crashing the page here.
    // We will build a proper Add Form handler for the tracker below!

      if (window.location.hash === '#ai-advisor') {
    // Replace this with your actual function that shows the AI chatbox
    if (typeof openAiAdvisor === 'function') {
      openAiAdvisor();
    } else {
      // Fallback: manually show the chatbox element
      const aiTab = document.getElementById('ai-advisor-tab');
      const aiContent = document.getElementById('ai-advisor-content');
      if (aiTab) aiTab.classList.add('active'); // or whatever your tab uses
      if (aiContent) aiContent.style.display = 'block'; // or your show method
    }
  }

async function saveSubscription(sub) {
    try {
        const res = await fetch('/api/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub)
        });
        return res.ok;
    } catch (err) {
        console.error('Failed to save:', err);
        return false;
    }
}

async function deleteSubscription(id) {
    try {
        const res = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
        return res.ok;
    } catch (err) {
        console.error('Failed to delete:', err);
        return false;
    }
}

// ==========================================
// HELPERS
// ==========================================
function showHeader() {
    document.querySelector('header')?.classList.remove('hidden');
}
function hideHeader() {
    document.querySelector('header')?.classList.add('hidden');
}

function switchPage(pageId, clickedButton) {
    document.querySelectorAll('.app-page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId)?.classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    clickedButton?.classList.add('active');
}

function updateAllStats(){
    const total = subscriptions
        .filter(s => !s.isTrial)
        .reduce((sum, s) => sum + s.amount, 0);
    document.querySelectorAll('#monthlySpending').forEach(el => {
        el.textContent = `$${total.toFixed(2)}`;
    });
    const yearlySpending = total * 12;
    document.querySelectorAll('#yearlySpending').forEach(el => {
        el.textContent = `$${yearlySpending.toFixed(2)}`;
    });

    const count = subscriptions.length;
    document.querySelectorAll('#subscriptionCount').forEach(el => {
        el.textContent = `Across ${count} services`;
    });

    // Calculate renewing soon (within 7 days, not overdue)
    const renewingSoonCount = subscriptions.filter(sub => {
        const daysRemaining = Math.ceil((new Date(sub.date) - new Date()) / (1000 * 60 * 60 * 24));
        return daysRemaining >= 0 && daysRemaining <= 7;
    }).length;
    document.querySelectorAll('#renewingSoon').forEach(el => {
        el.textContent = renewingSoonCount;
    });



    // Find most expensive subscription (non-trial)
    const mostExpensive = subscriptions
        .filter(s => !s.isTrial)
        .reduce((max, s) => s.amount > max.amount ? s : max, { amount: 0, name: 'None' });
    document.querySelectorAll('#mostExpensive').forEach(el => {
        el.textContent = mostExpensive.name === 'None' ? 'None' : `$${mostExpensive.amount.toFixed(2)}`;
    });
    document.querySelectorAll('#mostExpensiveSub').forEach(el => {
        el.textContent = mostExpensive.name === 'None' ? 'None' : `${mostExpensive.name}`;
    });

    // Calculate total amount per subscription type (non-trial)
    const categoryTotals = subscriptions
        .filter(s => !s.isTrial)
        .reduce((acc, s) => {
            const type = s.subscriptionType || 'Other';
            acc[type] = (acc[type] || 0) + s.amount;
            return acc;
        }, {});

    // Calculate number of subscriptions per type (non-trial)
    const categoryCounts = subscriptions
        .filter(s => !s.isTrial)
        .reduce((acc, s) => {
            const type = s.subscriptionType || 'Other';
            acc[type] = (acc[type] || 0) + 1;  // Count subscriptions instead of summing amounts
            return acc;
        }, {});

    // Find the category with the highest number of subscriptions
    const topCategory = Object.entries(categoryCounts).reduce((max, [type, count]) => 
        count > max.count ? { type, count } : max, 
        { type: 'None', count: 0 }
    );

    // Update the top category stat (now showing count of subscriptions)
    document.querySelectorAll('#topCategoryValue').forEach(el => {
        el.textContent = topCategory.type === 'None' ? 'None' : topCategory.count + " subscriptions";
    });
    document.querySelectorAll('#topCategorySub').forEach(el => {
        el.textContent = topCategory.type === 'None' ? 'None' : topCategory.type;
    });
    
    renderServiceSpendByService();
    renderPieChart();
}

function calculateTime(dateString){
    return Math.ceil((new Date(dateString) - new Date()) / (1000 * 60 * 60 * 24));
}


// ==========================================
// RENDER TABLE
// ==========================================
function renderSubscriptions() {
    const container = document.getElementById('subs-container');
    if (!container) return;

    container.innerHTML = '';

    subscriptions.forEach(sub => {
        // Calculate days remaining until next renewal.
        // For non-trial subs, if the stored date is already overdue,
        // virtually roll the renewal forward by months until it is no longer overdue.
        let daysRemaining = calculateTime(sub.date);

        if (!sub.isTrial && daysRemaining < 0) {
            let d = new Date(sub.date);
            if (!isNaN(d)) {
                const now = new Date();
                for (let i = 0; i < 48; i++) { // safety cap
                    const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
                    if (diff >= 0) {
                        daysRemaining = diff;
                        break;
                    }
                    d.setMonth(d.getMonth() + 1);
                }
            }
        }

        let daysRemainingDisplay = daysRemaining + " days";
        if (daysRemaining === 0){
            daysRemainingDisplay = "Today";
        }

        let statusClass = 'status-ok';
        let statusText  = 'Active';

        //code for when trial/sub status
        if (sub.isTrial) {
            if (daysRemaining < 0)      { statusClass = 'status-cancel'; statusText = 'Expired'; }
            else if (daysRemaining <= 5) { statusClass = 'status-soon';   statusText = 'Ends Soon'; }
            else                         { statusClass = 'status-ok';     statusText = 'Trial'; }
        } else {
            if (daysRemaining === 0)    { statusClass = 'status-cancel'; statusText = 'Due'; }
            else if (daysRemaining < 0) { statusClass = 'status-cancel'; statusText = 'Overdue'; }
            else if (daysRemaining <= 7) { statusClass = 'status-soon';   statusText = 'Soon'; }
        }

        const ICONS = { Entertainment: '🎬', Productivity: '📚', Utilities: '💡', Business: '💼' };
        //checking which button was clicked
        sub.icon = ICONS[sub.subscriptionType] || (sub.isTrial ? '⏳' : '❓');

        const trialBadge = sub.isTrial
            ? `<span style="font-size:0.68rem;background:rgba(96,165,250,0.18);color:#93c5fd;padding:2px 7px;border-radius:999px;margin-left:6px;font-weight:600;">TRIAL</span>`
            : '';

        const amountDisplay = sub.isTrial && sub.amount === 0
            ? '<span style="color:var(--text-muted);font-size:0.8rem;">Free</span>'
            : `$${sub.amount.toFixed(2)}`;

        const item = document.createElement('div');
        item.className = 'table-row';
        item.innerHTML = `
            <div class="row-name">
                <div class="row-icon" style="background:${sub.color}">${sub.icon}</div>
                ${sub.name}${trialBadge}
            </div>
            <div>${amountDisplay}</div>
            <div class="row-muted">${sub.subscriptionType || 'Other'}</div>
            <div class="row-muted">${daysRemainingDisplay}</div>
            <div><span class="tag ${statusClass}">${statusText}</span></div>
            <div>
                <button onclick="deleteSub(${sub.id})"
                    style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1rem;transition:color 0.2s;"
                    onmouseover="this.style.color='#ef4444'"
                    onmouseout="this.style.color='var(--text-muted)'">✕</button>
            </div>
        `;
        container.appendChild(item);
    });
}

async function deleteSub(id) {
    if (confirm("Remove this subscription?")) {
        const ok = await deleteSubscription(id);
        if (!ok) {
            alert("Failed to delete. Is the server running?");
            return;
        }
        subscriptions = subscriptions.filter(s => s.id !== id);
        renderSubscriptions();
        updateAllStats();
    }
}

function renderServiceSpendByService() {
    const listEl = document.getElementById('serviceSpendList');
    const previewEl = document.getElementById('insightsTopServices');
    if (!listEl) return;

    listEl.innerHTML = '';
    if (previewEl) previewEl.innerHTML = '';

    const paidSubs = subscriptions.filter(s => !s.isTrial);

    if (!paidSubs.length) {
        listEl.innerHTML = '<div class="service-spend-empty">No paid subscriptions yet.</div>';
        if (previewEl) {
            previewEl.innerHTML = '<div class="data-item"><span class="data-name">No services yet</span><span class="data-amount">$0.00</span></div>';
        }
        return;
    }

    const totalsByName = paidSubs.reduce((acc, sub) => {
        const key = sub.name || 'Unnamed';
        acc[key] = (acc[key] || 0) + (sub.amount || 0);
        return acc;
    }, {});

    const entries = Object.entries(totalsByName);
    entries.sort((a, b) => b[1] - a[1]);

    const maxAmount = entries[0] ? entries[0][1] || 1 : 1;

    entries.forEach(([name, amount]) => {
        const percentage = Math.max(6, (amount / maxAmount) * 100);
        const row = document.createElement('div');
        row.className = 'service-spend-row';
        row.innerHTML = `
            <div class="service-spend-label">${name}</div>
            <div class="service-spend-bar">
                <div class="service-spend-bar-fill" style="width:${percentage}%;"></div>
            </div>
            <div class="service-spend-amount">$${amount.toFixed(2)}</div>
        `;
        listEl.appendChild(row);
    });

    if (previewEl) {
        const topPreview = entries.slice(0, 3);
        topPreview.forEach(([name, amount]) => {
            const item = document.createElement('div');
            item.className = 'data-item';
            item.innerHTML = `
                <span class="data-name">${name}</span>
                <span class="data-amount">$${amount.toFixed(2)}</span>
            `;
            previewEl.appendChild(item);
        });
    }
}

// ==========================================
// PIE CHART: SPEND BY CATEGORY
// ==========================================

let categoryChartInstance = null;

function renderPieChart() {
    const canvas = document.getElementById('categoryChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const ctx = canvas.getContext('2d');

    const paidSubs = subscriptions.filter(s => !s.isTrial);
    const categoryTotals = paidSubs.reduce((acc, sub) => {
        const type = sub.subscriptionType || 'Other';
        acc[type] = (acc[type] || 0) + (sub.amount || 0);
        return acc;
    }, {});

    let labels = Object.keys(categoryTotals);
    let data = Object.values(categoryTotals);

    if (!labels.length) {
        labels = ['No data'];
        data = [1];
    }

    const COLOR_MAP = {
        Entertainment: '#e59f3b',
        Productivity:  '#22c55e',
        Utilities:     '#38bdf8',
        Business:      '#a855f7',
        Other:         '#6b7280'
    };

    const backgroundColors = labels.map(label => COLOR_MAP[label] || COLOR_MAP.Other);

    if (categoryChartInstance) {
        categoryChartInstance.data.labels = labels;
        categoryChartInstance.data.datasets[0].data = data;
        categoryChartInstance.data.datasets[0].backgroundColor = backgroundColors;
        categoryChartInstance.update();
    } else {
        categoryChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: backgroundColors,
                    borderWidth: 0,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            color: '#e5e7eb',
                            boxWidth: 10,
                            boxHeight: 10,
                            padding: 12
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const v = ctx.parsed;
                                return ` $${v.toFixed(2)}`;
                            }
                        }
                    }
                },
                cutout: '62%'
            }
        });
    }

    const total = paidSubs.reduce((sum, s) => sum + (s.amount || 0), 0);

    const centerEl = document.getElementById('categoryChartCenter');
    if (centerEl) {
        centerEl.textContent = `$${total.toFixed(2)}`;
    }
}
