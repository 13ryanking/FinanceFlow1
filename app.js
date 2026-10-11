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

let isLoginMode = true;

document.getElementById('authToggle').addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    document.getElementById('authTitle').textContent = isLoginMode ? 'Log in' : 'Sign up';
    document.getElementById('authSubmit').textContent = isLoginMode ? 'Log in' : 'Sign up';
    document.getElementById('authToggle').textContent = isLoginMode ? 'Need an account? Sign up' : 'Already have an account? Log in';
    document.getElementById('authError').textContent = '';
});

document.getElementById('authForm').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const errorEl = document.getElementById('authError');
    errorEl.textContent = '';

    const action = isLoginMode
        ? auth.signInWithEmailAndPassword(email, password)
        : auth.createUserWithEmailAndPassword(email, password);

    action.catch((err) => {
        errorEl.textContent = err.message;
    });
});

document.getElementById('logoutBtn').addEventListener('click', () => {
    auth.signOut();
});

auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('appContent').style.display = 'block';
    } else {
        document.getElementById('authScreen').style.display = 'block';
        document.getElementById('appContent').style.display = 'none';
    }
});

const CATEGORIES = ['Payroll', 'Rent', 'Supplies', 'Marketing', 'Software', 'Travel', 'Taxes', 'Other'];
        const INCOME_CAT = 'Revenue';
        let entries = [];

        function load() {
            try {
                const raw = localStorage.getItem('financeflow_data');
                if (raw) entries = JSON.parse(raw);
            } catch (e) {
                console.warn('load failed', e);
            }
        }

        function save() {
            try {
                localStorage.setItem('financeflow_data', JSON.stringify(entries));
            } catch (e) {
                console.warn('save failed', e);
            }
        }

        function fmt(n) {
            const s = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return (n < 0 ? '-' : '') + '£' + s;
        }

        function escapeHtml(s) {
            return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }

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
                        <div class="bar-label">${cat}</div>
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
                        <div class="tx-cat">${e.category}</div>
                        <div class="tx-amt ${e.type}">${e.type === 'income' ? '+' : '−'}${fmt(e.amount)}</div>
                        <button class="tx-del" data-id="${e.id}" title="Delete">✕</button>
                    </div>`).join('');

                listEl.querySelectorAll('.tx-del').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const id = Number(btn.dataset.id);
                        const entry = entries.find(e => e.id === id);
                        const ok = confirm(`Delete "${entry.desc}" (${fmt(entry.amount)})? This can't be undone.`);
                        if (!ok) return;

                        entries = entries.filter(e => e.id !== id);
                        save();
                        render();
                    });
                });
            }
        }

        document.getElementById('entryForm').addEventListener('submit', (ev) => {
            ev.preventDefault();
            const dateEl = document.getElementById('fDate');
            const descEl = document.getElementById('fDesc');
            const typeEl = document.getElementById('fType');
            const catEl = document.getElementById('fCat');
            const amtEl = document.getElementById('fAmt');
            const amount = parseFloat(amtEl.value);

            if (!dateEl.value || !descEl.value || isNaN(amount) || amount <= 0) return;

            entries.push({
                id: Date.now(),
                date: dateEl.value,
                desc: descEl.value,
                type: typeEl.value,
                category: typeEl.value === 'income' ? INCOME_CAT : catEl.value,
                amount: amount
            });

            save();
            render();
            descEl.value = '';
            amtEl.value = '';
            descEl.focus();
        });

        document.getElementById('fDate').valueAsDate = new Date();
        load();
        render();