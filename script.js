try {
  document.addEventListener("DOMContentLoaded", () => {

    const addModalOverlay = document.getElementById("addModalOverlay");

    // Helper functions to open/close
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

    // Both "Add Subscription" buttons open the modal
    document.getElementById("addBtn").addEventListener("click", openModal);
    document.getElementById("openAddModalNav").addEventListener("click", openModal);

    // Close button inside modal
    document.getElementById("closeAddModal").addEventListener("click", closeModal);

    // Click outside the modal box to close
    addModalOverlay.addEventListener("click", (e) => {
      if (e.target === addModalOverlay) closeModal();
    });

    // Escape key closes modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    document.getElementById("chooseSubscription").addEventListener("click", () => {
      alert("User chose: Subscription");
      // TODO: show subscription form
    });

    document.getElementById("chooseTrial").addEventListener("click", () => {
      alert("User chose: Free Trial");
      // TODO: show trial form
    });


    //Linking the monthly spending variable to the HTML element
    let monthlySpending = 450.75; //Variable for monthly spending, can be updated with actual data
    const spendingDisplay = document.getElementById("monthlySpending");
    spendingDisplay.textContent = `$${monthlySpending}`;



    //Login
    const VALID_USERS = {
      user1: "pass1",
      user2: "pass2",
    };

    const sessionData = {
      user1: { subscriptions: [] },
      user2: { subscriptions: [] },
    };

    let currentUser = null;


    const loginOverlay = document.getElementById("loginOverlay");
    const loginForm = document.getElementById("loginForm");
    const loginUsername = document.getElementById("loginUsername");
    const loginPassword = document.getElementById("loginPassword");
    const loginError = document.getElementById("loginError");
    const currentUserLabel = document.getElementById("currentUserLabel");
    const subscriptionsGrid = document.querySelector(".subscriptions-grid");
    const logoutBtn = document.getElementById("logoutBtn");

    const renderUserSubscriptions = () => {
      if (!subscriptionsGrid) return;
      // Remove previously rendered user-specific cards
      subscriptionsGrid
        .querySelectorAll(".user-subscription-card")
        .forEach((el) => el.remove());

      if (!currentUser) return;
      const data = sessionData[currentUser]?.subscriptions || [];
      data.forEach((sub) => {
        const card = document.createElement("article");
        card.className = "subscription-card card-animate user-subscription-card";
        card.innerHTML = `
        <header class="subscription-header">
          <div>
            <h4 class="subscription-name">${sub.name}</h4>
            <p class="subscription-meta">${sub.category}</p>
          </div>
          <span class="badge badge-success">My Subscription</span>
        </header>
        <div class="subscription-body">
          <div class="subscription-row">
            <span class="label">Monthly cost</span>
            <span class="value">$${sub.cost.toFixed(2)}</span>
          </div>
          <div class="subscription-row">
            <span class="label">Last used</span>
            <span class="value">${sub.lastUsed || "Not set"}</span>
          </div>
          <div class="subscription-row">
            <span class="label">Emotional value</span>
            <span class="value">${sub.emotionalValue} / 10</span>
          </div>
        </div>
        <footer class="subscription-footer">
          <button class="btn btn-soft" disabled>Saved for ${currentUser}</button>
        </footer>
      `;
        subscriptionsGrid.appendChild(card);
      });
    };

    const updateAuthUi = () => {
      if (!currentUser) {
        document.body.classList.add("auth-locked");
        if (loginOverlay) loginOverlay.style.display = "flex";
        if (currentUserLabel) currentUserLabel.textContent = "Not signed in";
      } else {
        document.body.classList.remove("auth-locked");
        if (loginOverlay) loginOverlay.style.display = "none";
        if (currentUserLabel) currentUserLabel.textContent = `Signed in as ${currentUser}`;
        renderUserSubscriptions();
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

    if (!currentUser) {
      alert("Please sign in first (user1/pass1 or user2/pass2).");
      return;
    }

    const nameInput = document.getElementById("serviceName");
    const costInput = document.getElementById("monthlyCost");
    const lastUsedInput = document.getElementById("lastUsed");

    const name = nameInput?.value.trim();
    const cost = parseFloat(costInput?.value || "0");
    const lastUsed = lastUsedInput?.value || "";
    const emotionalValue = emotionalSlider ? Number(emotionalSlider.value) : 7;

    if (!name || Number.isNaN(cost)) {
      return;
    }

    const entry = {
      name,
      cost,
      lastUsed,
      emotionalValue,
      category: "Custom • Tracked",
    };

    if (!sessionData[currentUser]) {
      sessionData[currentUser] = { subscriptions: [] };
    }
    sessionData[currentUser].subscriptions.push(entry);
    renderUserSubscriptions();
  });
} catch (error) {
  console.error("Error:", error);
}

