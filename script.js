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
            hideHeader(); // Hide header when not authenticated
        } else {
            document.body.classList.remove("auth-locked");
            if (loginOverlay) loginOverlay.style.display = "none";
            if (currentUserLabel) currentUserLabel.textContent = `Signed in as ${currentUser}`;
            showHeader(); // Show header when authenticated
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
    { id: 1, name: 'Netflix', amount: 22.99, date: '2026-03-07', subscriptionType: 'Entertainment', color: 'rgba(229,9,20,0.15)' },
    { id: 2, name: 'Spotify', amount: 10.99, date: '2026-03-12', subscriptionType: 'Entertainment', color: 'rgba(30,215,96,0.15)' },
    { id: 3, name: 'ChatGPT Plus', amount: 26.99, date: '2026-03-05', subscriptionType: 'Productivity', color: 'rgba(255,215,0,0.12)' }
];

function showHeader(){
  const header = document.querySelector('header');
  header.classList.remove('hidden');
}
function hideHeader(){
  const header = document.querySelector('header');
  header.classList.add('hidden');

}

function switchPage(pageId, clickedButton) {
  // Hide all the pages
  const allPages = document.querySelectorAll('.app-page');
  allPages.forEach(page => {
    page.classList.add('hidden');
  });
  //Select the targeted page
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.remove('hidden');
  }
  // Update active button state
  const allButtons = document.querySelectorAll('.nav-btn');
  allButtons.forEach(btn => {
    btn.classList.remove('active');
  });
  if (clickedButton) {
    clickedButton.classList.add('active');
  }
}

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

        if (sub.subscriptionType == 'Entertainment'){ sub.icon = '🎬';}
        else if (sub.subscriptionType == 'Productivity'){ sub.icon = '📚';}
        else if (sub.subscriptionType == 'Utilities'){ sub.icon = '💡';}
        else if (sub.subscriptionType == 'Business'){ sub.icon = '💼';}
        else{ sub.icon = '❓'; }

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
            <div class="row-muted">${sub.subscriptionType || 'Subscription'}</div>
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

function renderPieChart() {
  const ctx = document.getElementById('categoryChart');
  
  // If the canvas doesn't exist yet, stop the function
  if (!ctx) return;

  new Chart(ctx, {
    type: 'doughnut', // 'pie' works too, but 'doughnut' looks more modern!
    data: {
      labels: ['Entertainment', 'Productivity', 'Utilities'],
      datasets: [{
        data: [45, 30, 120], // The actual dollar amounts
        backgroundColor: [
          '#FFD700', // Your yellow accent
          '#4ade80', // Green
          '#a1a1aa'  // Grey
        ],
        borderWidth: 0, // Removes the ugly white borders for dark mode
        hoverOffset: 4
      }]
    },
    options: {
      color: '#ffffff', // Makes the text white
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

