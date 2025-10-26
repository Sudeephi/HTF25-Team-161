// --- STATE MANAGEMENT ---
const state = {
  currentUser: null,
  books: [],
  userLocation: null,
  locationStatus: 'Initializing...',
  isLoading: true,
  currentPage: 'home',
};

// --- MOCK API using localStorage ---
const api = (() => {
  const delay = (ms) => new Promise(res => setTimeout(res, ms));
  const USERS_KEY = 'users';
  const BOOKS_KEY = 'books';
  const CURRENT_USER_ID_KEY = 'currentUserId';

  const MOCK_USERS = [
    { id: 'u1', name: 'Ravi', email: 'ravi@example.com', rating: 4.7, location: { lat: 12.9716, lng: 77.5946 } },
    { id: 'u2', name: 'Meena', email: 'meena@example.com', rating: 4.9, location: { lat: 13.0827, lng: 80.2707 } },
  ];

  const MOCK_BOOKS = [
    { id: '1', title: 'The Alchemist', author: 'Paulo Coelho', coverImageUrl: 'https://covers.openlibrary.org/b/id/12692298-L.jpg', exchangeType: 'Swap', status: 'Available', description: 'A fable about following your dream.', owner: MOCK_USERS[0] },
    { id: '2', title: 'Clean Code', author: 'Robert C. Martin', coverImageUrl: 'https://covers.openlibrary.org/b/id/8233342-L.jpg', exchangeType: 'Sell', status: 'Available', description: 'A handbook of agile software craftsmanship.', owner: MOCK_USERS[1]},
    { id: '3', title: 'Sapiens', author: 'Yuval Noah Harari', coverImageUrl: 'https://covers.openlibrary.org/b/id/10332812-L.jpg', exchangeType: 'GiveAway', status: 'Available', description: 'A brief history of humankind.', owner: MOCK_USERS[0] }
  ];

  const db = {
    initialize: (key, data) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));
    },
    getAll: (key) => JSON.parse(localStorage.getItem(key)) || [],
    getById: (key, id) => db.getAll(key).find(item => item.id === id) || null,
    create: (key, item) => {
        const items = db.getAll(key);
        const newItem = { ...item, id: String(Date.now()) };
        items.unshift(newItem);
        localStorage.setItem(key, JSON.stringify(items));
        return newItem;
    },
    remove: (key, id) => {
        const items = db.getAll(key);
        const newItems = items.filter(item => item.id !== id);
        localStorage.setItem(key, JSON.stringify(newItems));
        return items.length !== newItems.length;
    },
    findBy: (key, predicate) => db.getAll(key).find(predicate) || null,
  };

  db.initialize(USERS_KEY, MOCK_USERS);
  db.initialize(BOOKS_KEY, MOCK_BOOKS);

  return {
    async login(email) {
      await delay(500);
      let user = db.findBy(USERS_KEY, u => u.email === email);
      if (!user) user = db.create(USERS_KEY, { name: email.split('@')[0], email, rating: 5.0 });
      localStorage.setItem(CURRENT_USER_ID_KEY, user.id);
      return user;
    },
    async signup(name, email) {
      await delay(700);
      if (db.findBy(USERS_KEY, u => u.email === email)) throw new Error('User already exists.');
      const newUser = db.create(USERS_KEY, { name, email, rating: 5.0 });
      localStorage.setItem(CURRENT_USER_ID_KEY, newUser.id);
      return newUser;
    },
    async logout() {
      await delay(200);
      localStorage.removeItem(CURRENT_USER_ID_KEY);
    },
    async getCurrentUser() {
      await delay(100);
      const userId = localStorage.getItem(CURRENT_USER_ID_KEY);
      return userId ? db.getById(USERS_KEY, userId) : null;
    },
    async getBooks() {
      await delay(600);
      return db.getAll(BOOKS_KEY);
    },
    async createBook(bookData, owner) {
      await delay(400);
      const newBook = { ...bookData, status: 'Available', owner };
      return db.create(BOOKS_KEY, newBook);
    },
    async deleteBook(bookId, userId) {
      await delay(300);
      const book = db.getById(BOOKS_KEY, bookId);
      if (!book) throw new Error('Book not found.');
      if (book.owner.id !== userId) throw new Error('Not authorized.');
      if (!db.remove(BOOKS_KEY, bookId)) throw new Error('Failed to delete.');
    },
    async getBooksByOwner(userId) {
      await delay(500);
      return db.getAll(BOOKS_KEY).filter(book => book.owner.id === userId);
    },
  };
})();

// --- GEOLOCATION HELPERS ---
const geo = {
    haversine: (lat1, lon1, lat2, lon2) => {
        const toRad = (x) => (x * Math.PI) / 180;
        const R = 6371; // Earth's radius in km
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },
    formatDistance: (distKm) => {
        if (distKm < 1) return `${Math.round(distKm * 1000)}m away`;
        return `${distKm.toFixed(1)}km away`;
    },
    getUserLocation: () => {
        const defaultLocation = { lat: 34.0522, lng: -118.2437 }; // Fallback
        if (!navigator.geolocation) {
            state.userLocation = defaultLocation;
            state.locationStatus = 'Location unavailable';
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => {
                state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                state.locationStatus = 'Location found';
            },
            () => {
                state.userLocation = defaultLocation;
                state.locationStatus = 'Location blocked';
            },
            { timeout: 8000 }
        );
    }
};

// --- DOM-MANIPULATION & RENDERING ---
const render = {
  header: () => {
    const header = document.getElementById('header');
    header.innerHTML = `
      <a href="#" class="flex gap-3 items-center">
        <div class="w-11 h-11 rounded-lg bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center text-white font-bold text-xl">B</div>
        <div>
          <h1 class="text-lg font-bold text-zinc-900">Decentralized Book Exchange</h1>
          <p class="text-xs text-muted">Find, swap, or give away books near you</p>
        </div>
      </a>
      <div id="auth-links" class="flex items-center gap-3"></div>
    `;
    const authLinks = document.getElementById('auth-links');
    if (state.currentUser) {
      authLinks.innerHTML = `
        <a href="#profile" class="text-sm text-muted hidden sm:inline hover:text-accent transition-colors">Welcome, ${state.currentUser.name}!</a>
        <button id="logout-btn" class="bg-accent text-white px-3.5 py-2 rounded-lg cursor-pointer shadow-md hover:bg-accent-hover transition-colors">Logout</button>
      `;
      const logoutBtn = document.getElementById('logout-btn');
      logoutBtn.addEventListener('click', async () => {
        await api.logout();
        state.currentUser = null;
        router.navigate('');
      });
    } else {
      authLinks.innerHTML = `
        <a href="#login" class="bg-white text-accent border border-orange-200 px-3.5 py-2 rounded-lg cursor-pointer shadow-sm hover:bg-orange-50 transition-colors">Login</a>
        <a href="#signup" class="bg-accent text-white px-3.5 py-2 rounded-lg cursor-pointer shadow-md hover:bg-accent-hover transition-colors">Sign Up</a>
      `;
    }
  },

  page: (pageId) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`${pageId}-page`);
    if (target) target.classList.remove('hidden');
    if (pageId === 'home') render.homePage();
    if (pageId === 'login') render.loginPage();
    if (pageId === 'signup') render.signupPage();
    if (pageId === 'profile') render.profilePage();
  },

  homePage: async () => {
    const page = document.getElementById('home-page');
    page.innerHTML = `
      <div class="flex gap-3 flex-wrap items-center mb-5">
        <input id="search-query" type="text" placeholder="Search by title or author..." class="flex-grow min-w-[180px] p-2.5 border border-orange-200 rounded-lg bg-white"/>
        <select id="exchange-type" class="min-w-[180px] p-2.5 border border-orange-200 rounded-lg bg-white">
          ${['All', 'Swap', 'GiveAway', 'Sell'].map(et => `<option value="${et}">${et}</option>`).join('')}
        </select>
        ${state.currentUser ? '<button id="list-book-btn" class="bg-accent text-white px-3.5 py-2.5 rounded-lg cursor-pointer shadow-md hover:bg-accent-hover">List a New Book</button>' : ''}
        <div class="text-xs text-muted ml-auto hidden sm:block">${state.locationStatus}</div>
      </div>
      <div id="book-list" class="flex flex-col gap-3">Loading books...</div>
    `;

    if (state.currentUser) {
        const btn = document.getElementById('list-book-btn');
        if (btn) btn.addEventListener('click', () => render.addBookModal());
    }
    
    const searchInput = document.getElementById('search-query');
    const exchangeSelect = document.getElementById('exchange-type');

    searchInput.addEventListener('input', () => render.bookList(searchInput.value, exchangeSelect.value));
    exchangeSelect.addEventListener('change', () => render.bookList(searchInput.value, exchangeSelect.value));
    
    state.books = await api.getBooks();
    render.bookList();
  },

  bookList: (query = '', type = 'All') => {
    const container = document.getElementById('book-list');
    const filtered = state.books.filter(b => 
        (type === 'All' || b.exchangeType === type) &&
        (!query || b.title.toLowerCase().includes(query.toLowerCase()) || b.author.toLowerCase().includes(query.toLowerCase()))
    );
    
    if (filtered.length === 0) {
      container.innerHTML = `<div class="text-sm text-muted p-3">No books found.</div>`;
      return;
    }
    container.innerHTML = filtered.map(book => `
      <div class="bg-card rounded-xl shadow-lg p-3 flex gap-3 items-start">
        ${book.coverImageUrl ? `<img src="${book.coverImageUrl}" alt="${book.title}" class="w-20 h-[110px] object-cover rounded-md flex-shrink-0 bg-orange-100" />` : `<div class="w-20 h-[110px] bg-orange-100 rounded-md flex-shrink-0 flex items-center justify-center text-accent/50 text-xs font-semibold">${book.title.split(' ').slice(0, 2).map(t => t[0]).join('').toUpperCase()}</div>`}
        <div class="flex-1">
          <h3 class="font-bold text-zinc-800">${book.title}</h3>
          <p class="text-muted text-sm mt-1">${book.author} &bull; <span class="font-medium text-amber-700">${book.exchangeType}</span></p>
          <p class="text-muted text-sm mt-1">Owner: ${book.owner.name} &middot; Rating: ${book.owner.rating} ★</p>
          ${(state.userLocation && book.owner.location) ? `<p class="text-xs text-muted mt-2">${geo.formatDistance(geo.haversine(state.userLocation.lat, state.userLocation.lng, book.owner.location.lat, book.owner.location.lng))}</p>` : ''}
          <div class="flex gap-2 mt-2.5">
            <button class="view-details-btn bg-white border border-orange-200 px-3 py-1.5 text-xs rounded-md" data-book-id="${book.id}">View details</button>
            ${state.currentUser?.id === book.owner.id ? `<button class="delete-btn bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 text-xs rounded-md" data-book-id="${book.id}">Delete</button>` : ''}
          </div>
        </div>
      </div>
    `).join('');
    
    // Use e.currentTarget or the element itself to safely read dataset
    document.querySelectorAll('.view-details-btn').forEach(btn => btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.bookId;
      render.bookDetailsModal(id);
    }));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.bookId;
      handleDeleteBook(id);
    }));
  },
  
  loginPage: () => {
    const page = document.getElementById('login-page');
    page.innerHTML = `
      <div class="max-w-md mx-auto mt-10">
        <form id="login-form" class="bg-card p-8 rounded-xl shadow-lg">
          <h2 class="text-2xl font-bold text-center text-zinc-800 mb-6">Login</h2>
          <p class="form-error text-red-500 text-sm text-center mb-4 hidden"></p>
          <div class="mb-4"><label class="block text-sm font-medium text-muted mb-2">Email</label><input name="email" type="email" class="w-full px-4 py-2 border border-orange-200 rounded-lg bg-white" required/></div>
          <button type="submit" class="w-full bg-accent text-white py-2.5 rounded-lg shadow-md hover:bg-accent-hover">Login</button>
          <p class="text-center text-sm text-muted mt-6">Don't have an account? <a href="#signup" class="font-medium text-accent hover:underline">Sign up</a></p>
        </form>
      </div>`;
    const form = document.getElementById('login-form');
    const errorEl = form.querySelector('.form-error');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = e.target.email.value;
      try {
        state.currentUser = await api.login(email);
        router.navigate('');
      } catch (err) {
        errorEl.textContent = 'Failed to login.';
        errorEl.classList.remove('hidden');
      }
    });
  },
  
  signupPage: () => {
    const page = document.getElementById('signup-page');
    page.innerHTML = `
      <div class="max-w-md mx-auto mt-10">
        <form id="signup-form" class="bg-card p-8 rounded-xl shadow-lg">
          <h2 class="text-2xl font-bold text-center text-zinc-800 mb-6">Create Account</h2>
          <p class="form-error text-red-500 text-sm text-center mb-4 hidden"></p>
          <div class="mb-4"><label class="block text-sm font-medium text-muted mb-2">Full Name</label><input name="name" type="text" class="w-full px-4 py-2 border border-orange-200 rounded-lg bg-white" required/></div>
          <div class="mb-4"><label class="block text-sm font-medium text-muted mb-2">Email</label><input name="email" type="email" class="w-full px-4 py-2 border border-orange-200 rounded-lg bg-white" required/></div>
          <button type="submit" class="w-full bg-accent text-white py-2.5 rounded-lg shadow-md hover:bg-accent-hover">Sign Up</button>
          <p class="text-center text-sm text-muted mt-6">Already have an account? <a href="#login" class="font-medium text-accent hover:underline">Login</a></p>
        </form>
      </div>`;
    const form = document.getElementById('signup-form');
    const errorEl = form.querySelector('.form-error');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { name, email } = e.target;
      try {
        state.currentUser = await api.signup(name.value, email.value);
        router.navigate('');
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
      }
    });
  },
  
  profilePage: async () => {
    if (!state.currentUser) return router.navigate('login');
    const page = document.getElementById('profile-page');
    page.innerHTML = `
      <div class="bg-card p-6 rounded-xl shadow-lg mb-6">
          <h1 class="text-2xl font-bold text-zinc-800">${state.currentUser.name}</h1>
          <p class="text-muted">${state.currentUser.email}</p>
          <p class="text-muted mt-1">Rating: ${state.currentUser.rating} ★</p>
      </div>
      <h2 class="text-xl font-bold text-zinc-800 mb-4">My Listed Books</h2>
      <div id="user-book-list" class="flex flex-col gap-3">Loading your books...</div>`;
    
    const userBooks = await api.getBooksByOwner(state.currentUser.id);
    const container = document.getElementById('user-book-list');
    
    if (userBooks.length === 0) {
      container.innerHTML = `<div class="text-sm text-muted p-3 bg-card rounded-xl shadow-lg">You haven't listed any books yet.</div>`;
      return;
    }

    // Temporarily set global books to user books to render cards
    const originalBooks = state.books;
    state.books = userBooks;
    // Reuse bookList rendering and then copy its HTML
    render.bookList();
    container.innerHTML = document.getElementById('book-list').innerHTML;
    // Re-attach event listeners in user's list
    container.querySelectorAll('.view-details-btn').forEach(btn => btn.addEventListener('click', (e) => {
      render.bookDetailsModal(e.currentTarget.dataset.bookId);
    }));
    container.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e) => {
      handleDeleteBook(e.currentTarget.dataset.bookId);
    }));
    state.books = originalBooks;
  },

  modal: (content) => {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay" role="dialog" aria-modal="true">
        <div class="modal-content">${content}</div>
      </div>`;
    modalContainer.classList.remove('hidden');
    // small timeout for transition
    setTimeout(() => modalContainer.classList.add('visible'), 10);
    const overlay = modalContainer.querySelector('.modal-overlay');
    overlay.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) render.closeModal();
    });
  },

  closeModal: () => {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.classList.remove('visible');
    setTimeout(() => {
      modalContainer.classList.add('hidden');
      modalContainer.innerHTML = '';
    }, 200);
  },
  
  bookDetailsModal: (bookId) => {
    const book = state.books.find(b => b.id === bookId);
    if (!book) return;
    const distanceText = (state.userLocation && book.owner.location) ? geo.formatDistance(geo.haversine(state.userLocation.lat, state.userLocation.lng, book.owner.location.lat, book.owner.location.lng)) : '';
    render.modal(`
      <div>
        <div class="flex justify-between items-start">
            <h2 class="text-xl font-bold text-zinc-800 pr-4">${book.title}</h2>
            <button id="close-modal-btn" class="text-muted hover:text-zinc-800 text-2xl leading-none" aria-label="Close">&times;</button>
        </div>
        <p class="text-sm text-muted mt-2">${book.author} &bull; ${book.exchangeType}</p>
        <p class="mt-4 text-zinc-700">${book.description || 'No description provided.'}</p>
        <div class="mt-4 pt-4 border-t border-orange-100">
            <strong>Owner:</strong> ${book.owner.name} (${book.owner.rating} ★)
            ${distanceText ? `<div class="text-sm text-muted">${distanceText}</div>` : ''}
        </div>
        <div class="mt-5 flex gap-2 justify-end items-center">
            ${state.currentUser?.id === book.owner.id ? `<button id="modal-delete-btn" class="bg-red-600 text-white px-4 py-2 text-sm rounded-lg hover:bg-red-700 mr-auto">Delete</button>` : ''}
            <button id="contact-owner-btn" class="bg-accent text-white px-4 py-2 text-sm rounded-lg hover:bg-accent-hover">Contact Owner</button>
        </div>
      </div>
    `);
    const closeBtn = document.getElementById('close-modal-btn');
    if (closeBtn) closeBtn.addEventListener('click', render.closeModal);
    const contactBtn = document.getElementById('contact-owner-btn');
    if (contactBtn) contactBtn.addEventListener('click', () => alert(`Contacting ${book.owner.name}...`));
    const modalDeleteBtn = document.getElementById('modal-delete-btn');
    if (modalDeleteBtn) modalDeleteBtn.addEventListener('click', () => handleDeleteBook(book.id, true));
  },
  
  addBookModal: () => {
    render.modal(`
      <form id="add-book-form">
        <h2 class="text-xl font-bold mb-4">List a New Book</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input name="title" class="w-full p-2.5 border border-orange-200 rounded-lg bg-white" required placeholder="Title"/>
            <input name="author" class="w-full p-2.5 border border-orange-200 rounded-lg bg-white" required placeholder="Author"/>
        </div>
        <div class="mb-4"><input name="coverImageUrl" class="w-full p-2.5 border border-orange-200 rounded-lg bg-white" placeholder="Cover Image URL (Optional)"/></div>
        <div class="mb-4"><select name="exchangeType" class="w-full p-2.5 border border-orange-200 rounded-lg bg-white">${['Swap', 'GiveAway', 'Sell'].map(e => `<option value="${e}">${e}</option>`).join('')}</select></div>
        <div class="mb-4"><textarea name="description" class="w-full p-2.5 border border-orange-200 rounded-lg bg-white min-h-[80px]" placeholder="Description"></textarea></div>
        <div class="flex justify-end gap-3 mt-5">
            <button type="button" id="cancel-add-book" class="bg-gray-100 text-gray-700 px-4 py-2 text-sm rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" class="bg-accent text-white px-4 py-2 text-sm rounded-lg hover:bg-accent-hover">Add Book</button>
        </div>
      </form>
    `);
    const cancelBtn = document.getElementById('cancel-add-book');
    if (cancelBtn) cancelBtn.addEventListener('click', render.closeModal);
    const addForm = document.getElementById('add-book-form');
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { title, author, coverImageUrl, exchangeType, description } = e.target;
        const newBook = { title: title.value.trim(), author: author.value.trim(), coverImageUrl: coverImageUrl.value.trim(), exchangeType: exchangeType.value, description: description.value.trim() };
        const ownerWithLocation = { ...state.currentUser, location: state.userLocation || state.currentUser.location || null };
        await api.createBook(newBook, ownerWithLocation);
        render.closeModal();
        state.books = await api.getBooks();
        render.bookList();
    });
  },
};

// --- EVENT HANDLERS ---
async function handleDeleteBook(bookId, fromModal = false) {
    if (!state.currentUser) {
      alert('You must be logged in to delete a listing.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this listing?')) return;
    try {
        await api.deleteBook(bookId, state.currentUser.id);
        state.books = state.books.filter(b => b.id !== bookId);
        if (fromModal) render.closeModal();
        
        if (state.currentPage === 'profile') {
            render.profilePage();
        } else {
            render.bookList();
        }
    } catch (error) {
        alert(error.message || 'Could not delete the book.');
    }
}

// --- ROUTER ---
const router = {
  handle: async () => {
    state.isLoading = true;
    render.header();
    
    const hash = window.location.hash.replace('#', '');
    const validRoutes = ['login', 'signup', 'profile'];
    
    if (validRoutes.includes(hash) && (hash !== 'profile' || state.currentUser)) {
      state.currentPage = hash;
      render.page(hash);
    } else {
      state.currentPage = 'home';
      render.page('home');
    }
    state.isLoading = false;
  },
  navigate: (path) => {
    window.location.hash = path;
    // call handler to force immediate navigation in single-page context
    router.handle();
  }
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  render.page('loading-spinner');
  state.currentUser = await api.getCurrentUser();
  geo.getUserLocation();
  await router.handle();
  window.addEventListener('hashchange', router.handle);
});
