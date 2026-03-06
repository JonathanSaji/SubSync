// script.js
const VALID_USERS = {
  user1: "pass1",
  user2: "pass2",
};

const sessionData = {
  user1: { subscriptions: [] },
  user2: { subscriptions: [] },
};

let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
  const navWrapper = document.querySelector(".nav-wrapper");
  const navLinks = document.querySelectorAll(".nav-link");
  const openAddModalNav = document.getElementById("openAddModalNav");
  const heroAddSubscription = document.getElementById("heroAddSubscription");
  const addSubscriptionTop = document.getElementById("addSubscriptionTop");
  const addModalOverlay = document.getElementById("addModalOverlay");
  const closeAddModalBtn = document.getElementById("closeAddModal");
  const addSubscriptionForm = document.getElementById("addSubscriptionForm");
  const emotionalSlider = document.getElementById("emotionalValue");
  const emotionalDisplay = document.getElementById("emotionalValueDisplay");
  const openDashboardCta = document.getElementById("openDashboardCta");
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const chatWindow = document.getElementById("chatWindow");
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

  /* Sticky nav scroll state */
  const handleScroll = () => {
    const threshold = 12;
    if (window.scrollY > threshold) {
      navWrapper.classList.add("scrolled");
    } else {
      navWrapper.classList.remove("scrolled");
    }
  };
  window.addEventListener("scroll", handleScroll);
  handleScroll();

  /* Smooth scrolling for nav links */
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      if (href && href.startsWith("#")) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });
  });

  if (openDashboardCta) {
    openDashboardCta.addEventListener("click", () => {
      const dashboard = document.getElementById("dashboard");
      if (dashboard) {
        dashboard.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  /* Modal open/close */
  const openModal = () => {
    if (!addModalOverlay) return;
    addModalOverlay.classList.add("visible");
    addModalOverlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // small delay to focus first input after animation
    setTimeout(() => {
      const firstInput = addSubscriptionForm?.querySelector("input");
      if (firstInput) firstInput.focus();
    }, 200);
  };

  const closeModal = () => {
    if (!addModalOverlay) return;
    addModalOverlay.classList.remove("visible");
    addModalOverlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  openAddModalNav?.addEventListener("click", openModal);
  heroAddSubscription?.addEventListener("click", openModal);
  addSubscriptionTop?.addEventListener("click", openModal);

  closeAddModalBtn?.addEventListener("click", closeModal);

  addModalOverlay?.addEventListener("click", (e) => {
    if (e.target === addModalOverlay) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  });

  /* Modal form behavior (now saves per-user in memory) */
  emotionalSlider?.addEventListener("input", () => {
    emotionalDisplay.textContent = `${emotionalSlider.value} / 10`;
  });

  addSubscriptionForm?.addEventListener("submit", (e) => {
    e.preventDefault();
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

    closeModal();
  });

  /* AI chat behavior (UI only) */
  const appendMessage = (text, type) => {
    if (!chatWindow) return;
    const message = document.createElement("div");
    message.classList.add("chat-message", type);

    if (type === "ai") {
      const avatar = document.createElement("div");
      avatar.classList.add("chat-avatar");
      avatar.textContent = "SG";
      message.appendChild(avatar);
    }

    const bubble = document.createElement("div");
    bubble.classList.add("chat-bubble");
    bubble.textContent = text;
    message.appendChild(bubble);

    chatWindow.appendChild(message);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  };

  const createAiReply = (userText) => {
    const lowercase = userText.toLowerCase();
    if (lowercase.includes("netflix")) {
      return "You mentioned Netflix. If you rarely watch it and have other similar services, consider pausing it for a few months first. If you don’t miss it, cancelling can save you a helpful amount each year.";
    }
    if (lowercase.includes("spotify") || lowercase.includes("music")) {
      return "If you listen to music daily, a music subscription usually has high emotional value. As long as it fits your budget, keeping it can be worthwhile.";
    }
    if (lowercase.includes("amazon") || lowercase.includes("prime")) {
      return "Prime can be useful if you often order items or watch their shows. Check your last few months of orders and viewing—if you rarely use either, you might switch to occasional shipping without the monthly fee.";
    }
    if (lowercase.includes("tv") || lowercase.includes("cable")) {
      return "TV packages are often one of the highest monthly costs. If you watch only a few channels, consider moving to a smaller package or a streaming alternative that focuses on what you enjoy most.";
    }
    return "Think about three things: how often you use it, how it makes your day better, and its yearly cost. If you rarely use it and wouldn’t miss it much, it may be a good candidate to pause or cancel.";
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    const text = chatInput?.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    chatInput.value = "";
    chatInput.focus();

    // Slight delay for realism
    setTimeout(() => {
      appendMessage(createAiReply(text), "ai");
    }, 550);
  };

  chatForm?.addEventListener("submit", handleChatSubmit);

  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm?.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  });

  /* Intersection-based fade-in animations */
  const fadeInElements = document.querySelectorAll(".fade-in");
  const cardElements = document.querySelectorAll(".card-animate");

  const observerOptions = {
    root: null,
    rootMargin: "0px 0px -20% 0px",
    threshold: 0.1,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const target = entry.target;
        if (target.classList.contains("fade-in")) {
          target.classList.add("visible");
        } else if (target.classList.contains("card-animate")) {
          // stagger card animation slightly
          const index = [...cardElements].indexOf(target);
          target.style.transitionDelay = `${index * 60}ms`;
          target.style.opacity = "1";
          target.style.transform = "translateY(0)";
        }
        observer.unobserve(target);
      }
    });
  }, observerOptions);

  fadeInElements.forEach((el) => observer.observe(el));
  cardElements.forEach((el) => observer.observe(el));
});

