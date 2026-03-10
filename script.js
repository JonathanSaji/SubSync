document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // 1. MODAL LOGIC
    // ==========================================
    const addModalOverlay = document.getElementById("addModalOverlay");

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

    // Safely add event listeners if the elements exist
    document.getElementById("addBtn")?.addEventListener("click", openModal);
    document.getElementById("openAddModalNav")?.addEventListener("click", openModal);
    document.getElementById("closeAddModal")?.addEventListener("click", closeModal);

    addModalOverlay?.addEventListener("click", (e) => {
        if (e.target === addModalOverlay) closeModal();
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
    });

    // ==========================================
    // 2. DASHBOARD SPENDING LOGIC
    // ==========================================
    let monthlySpending = 450.75; 
    const spendingDisplay = document.getElementById("monthly-spending");
    if (spendingDisplay) {
        spendingDisplay.textContent = `$${monthlySpending}`;
    }

    // ==========================================
    // 3. LOGIN LOGIC
    // ==========================================
    const VALID_USERS = { user1: "pass1", user2: "pass2" };
    let currentUser = null;

    const loginOverlay = document.getElementById("loginOverlay");
    const loginForm = document.getElementById("loginForm");
    const loginUsername = document.getElementById("loginUsername");
    const loginPassword = document.getElementById("loginPassword");
    const loginError = document.getElementById("loginError");
    const currentUserLabel = document.getElementById("currentUserLabel");
    const logoutBtn = document.getElementById("logoutBtn");

    const updateAuthUi = () => {
        if (!currentUser) {
            document.body.classList.add("auth-locked");
            if (loginOverlay) loginOverlay.style.display = "flex";
            if (currentUserLabel) currentUserLabel.textContent = "Not signed in";
        } else {
            document.body.classList.remove("auth-locked");
            if (loginOverlay) loginOverlay.style.display = "none";
            if (currentUserLabel) currentUserLabel.textContent = `Signed in as ${currentUser}`;
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

    loginForm?.addEventListener("submit", (e) => {
        e.preventDefault();
        const username = loginUsername?.value.trim();
        const password = loginPassword?.value;
        if (!username || !password) return;

        if (VALID_USERS[username] && VALID_USERS[username] === password) {
            currentUser = username;
            if (loginError) loginError.textContent = "";
            updateAuthUi();
        } else {
            if (loginError) loginError.textContent = "Invalid username or password.";
        }
    });

    renderSubscriptions();
    // NOTE: I removed the stray "Add logic" that was crashing the page here.
    // We will build a proper Add Form handler for the tracker below!
});

// ==========================================
// 4. SUBSCRIPTION TRACKER LOGIC (Our New Code)
// ==========================================
let subscriptions = [
    { id: 1, name: 'Netflix', amount: 22.99, date: '2026-03-07', icon: '🎬', color: 'rgba(229,9,20,0.15)' },
    { id: 2, name: 'Spotify', amount: 10.99, date: '2026-03-12', icon: '🎵', color: 'rgba(30,215,96,0.15)' },
    { id: 3, name: 'ChatGPT Plus', amount: 26.99, date: '2026-03-05', icon: '🤖', color: 'rgba(255,215,0,0.12)' }
];

function renderSubscriptions() {
    const container = document.getElementById('subs-container');
    if (!container) return; 
    
    container.innerHTML = ''; 
    
    subscriptions.forEach(sub => {
        // Calculate days until renewal
        const daysRemaining = Math.ceil((new Date(sub.date) - new Date()) / (1000 * 60 * 60 * 24));
        
        // Match the logic to your new CSS tag classes
        let statusClass = 'tag-ok';
        let statusText = 'Active';
        
        if (daysRemaining < 0) {
            statusClass = 'tag-cancel';
            statusText = 'Overdue';
        } else if (daysRemaining <= 7) { // Anything within 7 days is "Soon"
            statusClass = 'tag-soon';
            statusText = 'Soon';
        }

        // Create the row wrapper
        const item = document.createElement('div');
        item.className = 'table-row';
        
        // Build the 6 grid columns using your specific classes
        item.innerHTML = `
            <div class="row-name">
                <div class="row-icon" style="background:${sub.color}">${sub.icon}</div>
                ${sub.name}
            </div>
            <div>$${sub.amount.toFixed(2)}</div>
            <div class="row-muted">${sub.category || 'Subscription'}</div>
            <div class="row-muted">${sub.date}</div>
            <div><span class="tag ${statusClass}">${statusText}</span></div>
            <div>
                <button onclick="deleteSub(${sub.id})" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size: 1.1rem; transition: color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='var(--text-muted)'">✕</button>
            </div>
        `;
        
        container.appendChild(item);
    });
}

function deleteSub(id) {
    if (confirm("Remove this subscription?")) {
        subscriptions = subscriptions.filter(s => s.id !== id);
        renderSubscriptions();
    }
}

// Initial render for the tracker
renderSubscriptions();