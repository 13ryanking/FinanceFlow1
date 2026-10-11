const firebaseConfig = {
    apiKey: "AIzaSyDv2mmwJOutr4OXSPNaHdF6Aq_7imABZY4",
    authDomain: "financeflow-991b2.firebaseapp.com",
    projectId: "financeflow-991b2",
    storageBucket: "financeflow-991b2.firebasestorage.app",
    messagingSenderId: "193102453180",
    appId: "1:193102453180:web:0ba6b9f3884e342cac33b9"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ---------- State ----------
const INCOME_CAT = 'Revenue';
const DEFAULT_CATEGORIES = ['Payroll', 'Rent', 'Supplies', 'Marketing', 'Software', 'Travel', 'Taxes', 'Other'];
let categories = [...DEFAULT_CATEGORIES];
let currentUid = null;
let customList = [];
let entries = [];
let budget = null;

// ---------- Firestore ----------
function userRef() {
    return db.collection('users').doc(currentUid);
}

async function loadUserData(uid) {
    const ref = db.collection('users').doc(uid);
    const [profile, entriesSnap] = await Promise.all([
        ref.get(),
        ref.collection('entries').get()
    ]);
    const data = profile.exists ? profile.data() : {};
    entries = entriesSnap.docs.map(d => d.data());
    budget = typeof data.budget === 'number' ? data.budget : null;
    return Array.isArray(data.categories) && data.categories.length ? data.categories : null;
}

function notifyError(message) {
    return showConfirm('Something went wrong', message, 'OK');
}

// ---------- Auth ----------
let isLoginMode = true;

document.getElementById('authToggle').addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    document.getElementById('authTitle').textContent = isLoginMode ? 'Log in' : 'Sign up';
    document.getElementById('authSubmit').textContent = isLoginMode ? 'Log in' : 'Sign up';
    document.getElementById('authToggle').textContent = isLoginMode ? 'Need an account? Sign up' : 'Already have an account? Log in';

    const confirmInput = document.getElementById('authConfirm');
    document.getElementById('confirmField').style.display = isLoginMode ? 'none' : 'block';
    confirmInput.required = !isLoginMode;
    confirmInput.value = '';

    document.getElementById('authError').textContent = '';
});

document.getElementById('authForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const errorEl = document.getElementById('authError');
    errorEl.textContent = '';

    if (!isLoginMode) {
        const confirmPw = document.getElementById('authConfirm').value;
        if (password !== confirmPw) {
            errorEl.textContent = 'Passwords do not match.';
            return;
        }
    }

    const action = isLoginMode
        ? auth.signInWithEmailAndPassword(email, password)
        : auth.createUserWithEmailAndPassword(email, password);

    action.catch((err) => {
        if (!isLoginMode && cred.user && !cred.user.emailVerified) {
            return cred.user.sendEmailVerification().catch(() => {
                document.getElementById('verifyMsg').textContent =
                    'Could not send the email. Use "Resend email" below.';
                });
        }    
        errorEl.textContent = err.message;
    });
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    auth.signOut();
});

document.getElementById('verifyLogout').addEventListener('click', () => {
    auth.signOut();
});

document.getElementById('verifyResend').addEventListener('click', async () => {
    const msg = document.getElementById('verifyMsg');
    const user = auth.currentUser;
    if (!user) return;
    try {
        await user.sendEmailVerification();
        msg.textContent = 'Verification email sent again. Check your inbox and spam folder.';
    } catch (e) {
        msg.textContent = e.code === 'auth/too-many-requests'
            ? 'Too many requests. Wait a few minutes and try again.'
            : 'Could not send the email. Please try again.';
    }
});

document.getElementById('verifyDone').addEventListener('click', async () => {
    const msg = document.getElementById('verifyMsg');
    const user = auth.currentUser;
    if (!user) return;
    try {
        await user.reload();
        if (user.emailVerified) {
            await user.getIdToken(true); // refresh so Firestore sees the verified status
            enterApp(user);
        } else {
            msg.textContent = 'Not verified yet. Click the link in the email first.';
        }
    } catch (e) {
        console.error('Verification check failed', e);
        msg.textContent = 'Could not check. Please try again.';
    }
});

async function enterApp(user) {
    currentUid = user.uid;
    try {
        const saved = await loadUserData(user.uid);
        if (currentUid !== user.uid) return; // someone else logged in meanwhile

        document.getElementById('budgetInput').value = budget === null ? '' : budget;

        if (saved) {
            categories = saved;
            populateCategorySelect();
            render();
            showScreen('app');
        } else {
            openSetup();
            showScreen('setup');
        }
    } catch (e) {
        console.error('Failed to load data', e);
        document.getElementById('authError').textContent = 'Could not load your data. Check your connection and try again.';
        auth.signOut();
    }
}

auth.onAuthStateChanged((user) => {
    if (!user) {
        currentUid = null;
        entries = [];
        budget = null;
        categories = [...DEFAULT_CATEGORIES];
        showScreen('auth');
        return;
    }

    currentUid = user.uid;

    if (!user.emailVerified) {
        document.getElementById('verifyText').textContent =
            `We sent a verification link to ${user.email}. Click it, then come back here. Check your spam folder if it doesn't arrive.`;
        document.getElementById('verifyMsg').textContent = '';
        showScreen('verify');
        return;
    }

    enterApp(user);
});

// ---------- Categories ----------
function populateCategorySelect() {
    const sel = document.getElementById('fCat');
    sel.innerHTML = '';
    categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
    });
}

function showScreen(name) {
    document.getElementById('authScreen').style.display = name === 'auth' ? 'block' : 'none';
    document.getElementById('verifyScreen').style.display = name === 'verify' ? 'block' : 'none';
    document.getElementById('setupScreen').style.display = name === 'setup' ? 'block' : 'none';
    document.getElementById('appContent').style.display = name === 'app' ? 'block' : 'none';
}

function renderCustomChips() {
    const box = document.getElementById('customChips');
    box.innerHTML = '';
    customList.forEach((c, i) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = c;
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'chip-x';
        x.textContent = '✕';
        x.onclick = () => { customList.splice(i, 1); renderCustomChips(); };
        chip.appendChild(x);
        box.appendChild(chip);
    });
}

function openSetup() {
    customList = [];
    renderCustomChips();
    document.querySelector('input[name="catMode"][value="default"]').checked = true;
    document.getElementById('customBox').style.display = 'none';
    document.getElementById('setupError').textContent = '';
    const preview = document.getElementById('defaultPreview');
    preview.innerHTML = '';
    DEFAULT_CATEGORIES.forEach(c => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = c;
        preview.appendChild(chip);
    });
}

document.querySelectorAll('input[name="catMode"]').forEach(r => {
    r.addEventListener('change', () => {
        const isCustom = document.querySelector('input[name="catMode"]:checked').value === 'custom';
        document.getElementById('customBox').style.display = isCustom ? 'block' : 'none';
        document.getElementById('setupError').textContent = '';
    });
});

function addCustomCategory() {
    const input = document.getElementById('customInput');
    const errorEl = document.getElementById('setupError');
    const name = input.value.trim();
    errorEl.textContent = '';

    if (!name) return;
    if (customList.length >= 12) { errorEl.textContent = 'Maximum of 12 categories.'; return; }
    if (name.toLowerCase() === INCOME_CAT.toLowerCase()) { errorEl.textContent = `"${INCOME_CAT}" is reserved for income.`; return; }
    if (customList.some(c => c.toLowerCase() === name.toLowerCase())) { errorEl.textContent = 'That category already exists.'; return; }

    customList.push(name);
    input.value = '';
    renderCustomChips();
    input.focus();
}

document.getElementById('customAddBtn').addEventListener('click', addCustomCategory);
document.getElementById('customInput').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); addCustomCategory(); }
});

document.getElementById('setupSave').addEventListener('click', async () => {
    const isCustom = document.querySelector('input[name="catMode"]:checked').value === 'custom';
    const errorEl = document.getElementById('setupError');

    if (isCustom && customList.length === 0) {
        errorEl.textContent = 'Add at least one category, or choose the defaults.';
        return;
    }

    const newCats = isCustom ? [...customList] : [...DEFAULT_CATEGORIES];

    try {
        await userRef().set({ categories: newCats }, { merge: true });
    } catch (e) {
        console.error('Failed to save categories', e);
        errorEl.textContent = 'Could not save. Please try again.';
        return;
    }

    categories = newCats;
    populateCategorySelect();
    render();
    showScreen('app');
});

// ---------- Helpers ----------
function fmt(n) {
    const s = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + '£' + s;
}

function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showConfirm(title, message, okLabel) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('confirmOverlay');
        const okBtn = document.getElementById('confirmOk');
        const cancelBtn = document.getElementById('confirmCancel');

        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        okBtn.textContent = okLabel || 'Confirm';
        overlay.classList.add('show');

        function close(result) {
            overlay.classList.remove('show');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            overlay.onclick = null;
            resolve(result);
        }

        okBtn.onclick = () => close(true);
        cancelBtn.onclick = () => close(false);
        overlay.onclick = (ev) => { if (ev.target === overlay) close(false); };
    });
}

// ---------- Render ----------
function render() {
    let income = 0, expense = 0;
    const catTotals = {};

    entries.forEach(e => {
        if (e.type === 'income') {
            income += e.amount;
        } else {
            expense += e.amount;
            catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
        }
    });

    document.getElementById('sumIncome').textContent = fmt(income);
    document.getElementById('sumExpense').textContent = fmt(expense);

    const warnEl = document.getElementById('budgetWarn');
    if (budget !== null && expense > budget) {
        warnEl.textContent = `Over budget by ${fmt(expense - budget)}`;
    } else {
        warnEl.textContent = '';
    }

    const net = income - expense;
    const netEl = document.getElementById('sumNet');
    netEl.textContent = (net < 0 ? '-' : '') + fmt(Math.abs(net));
    netEl.style.color = net >= 0 ? 'var(--green)' : 'var(--rust)';

    const barsEl = document.getElementById('bars');
    const catArr = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    if (catArr.length === 0) {
        barsEl.innerHTML = '<div class="empty">No costs logged yet.</div>';
    } else {
        const max = catArr[0][1];
        barsEl.innerHTML = catArr.map(([cat, amt]) => `
            <div class="bar-row">
                <div class="bar-label">${escapeHtml(cat)}</div>
                <div class="bar-track"><div class="bar-fill" style="width:${(amt / max * 100).toFixed(1)}%"></div></div>
                <div class="bar-amt">${fmt(amt)}</div>
            </div>`).join('');
    }

    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    const listEl = document.getElementById('txList');
    if (sorted.length === 0) {
        listEl.innerHTML = '<div class="empty" style="padding:14px 0;">Nothing logged yet — add your first entry above.</div>';
    } else {
        listEl.innerHTML = sorted.map(e => `
            <div class="tx-row">
                <div class="tx-date">${e.date.slice(5)}</div>
                <div class="tx-desc">${escapeHtml(e.desc)}</div>
                <div class="tx-cat">${escapeHtml(e.category)}</div>
                <div class="tx-amt ${e.type}">${e.type === 'income' ? '+' : '−'}${fmt(e.amount)}</div>
                <button class="tx-del" data-id="${e.id}" title="Delete">✕</button>
            
                </div>`).join('');

        listEl.querySelectorAll('.tx-del').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = Number(btn.dataset.id);
                const entry = entries.find(e => e.id === id);
                const ok = await showConfirm(
                    'Delete transaction?',
                    `"${entry.desc}" (${fmt(entry.amount)}) will be removed. This can't be undone.`,
                    'Delete'
                );
                if (!ok) return;

                try {
                    await userRef().collection('entries').doc(String(id)).delete();
                } catch (e) {
                    console.error('Failed to delete', e);
                    notifyError('The transaction could not be deleted. Please try again.');
                    return;
                }

                entries = entries.filter(e => e.id !== id);
                render();
            });
        });
    }
}

// ---------- Add entry ----------
document.getElementById('entryForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const dateEl = document.getElementById('fDate');
    const descEl = document.getElementById('fDesc');
    const typeEl = document.getElementById('fType');
    const catEl = document.getElementById('fCat');
    const amtEl = document.getElementById('fAmt');
    const amount = parseFloat(amtEl.value);

    if (!dateEl.value || !descEl.value || isNaN(amount) || amount <= 0) return;

    const entry = {
        id: Date.now(),
        date: dateEl.value,
        desc: descEl.value,
        type: typeEl.value,
        category: typeEl.value === 'income' ? INCOME_CAT : catEl.value,
        amount: amount
    };

    try {
        await userRef().collection('entries').doc(String(entry.id)).set(entry);
    } catch (e) {
        console.error('Failed to save entry', e);
        notifyError('The transaction could not be saved. Please try again.');
        return;
    }

    entries.push(entry);
    render();
    descEl.value = '';
    amtEl.value = '';
    descEl.focus();
});

// ---------- Budget ----------
const budgetEl = document.getElementById('budgetInput');

budgetEl.addEventListener('input', () => {
    const v = parseFloat(budgetEl.value);
    budget = (isNaN(v) || v <= 0) ? null : v;
    render();
});

budgetEl.addEventListener('change', async () => {
    try {
        await userRef().set({ budget: budget }, { merge: true });
    } catch (e) {
        console.error('Failed to save budget', e);
        notifyError('Your budget could not be saved. Please try again.');
    }
});

// ---------- Export ----------
function csvCell(value) {
    let s = String(value);
    // stop spreadsheets treating text as a formula (e.g. a description starting with "=")
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
}

document.getElementById('exportBtn').addEventListener('click', () => {
    if (entries.length === 0) {
        showConfirm('Nothing to export', 'Add a transaction first, then try again.', 'OK');
        return;
    }

    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    const rows = [['Date', 'Description', 'Type', 'Category', 'Amount (GBP)']];

    sorted.forEach(e => {
        rows.push([
            e.date,
            e.desc,
            e.type === 'income' ? 'Revenue' : 'Cost',
            e.category,
            e.amount.toFixed(2)
        ]);
    });

    const csv = rows.map(r => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `financeflow-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
});

// ---------- Init ----------
document.getElementById('fDate').valueAsDate = new Date();
render();