const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public'));

let users = {};          // { username: { password, balance, turnover } }
let deposits = [];       
let withdraws = [];      

// সাইন আপ (নতুন ইউজারের টার্নওভার শুরু হবে 0 দিয়ে)
app.post('/api/signup', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'ইউজারনেম এবং পাসওয়ার্ড উভয়ই দিতে হবে।' });
    if (users[username]) return res.status(400).json({ message: 'এই ইউজারনেমটি ইতিমধ্যে রেজিস্টার্ড!' });
    
    users[username] = { password, balance: 0.00, turnover: 0.00 };
    res.json({ success: true, message: 'সফলভাবে অ্যাকাউন্ট তৈরি হয়েছে!' });
});

// লগইন
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!users[username] || users[username].password !== password) {
        return res.status(400).json({ message: 'ভুল ইউজারনেম বা পাসওয়ার্ড!' });
    }
    res.json({ success: true, username, balance: users[username].balance, turnover: users[username].turnover });
});

// ব্যালেন্স ও টার্নওভার চেক
app.get('/api/balance/:username', (req, res) => {
    const { username } = req.params;
    if (users[username]) {
        res.json({ balance: users[username].balance, turnover: users[username].turnover });
    } else {
        res.status(404).json({ message: 'ইউজার পাওয়া যায়নি' });
    }
});

// ডিপোজিট রিকোয়েস্ট
app.post('/api/deposit', (req, res) => {
    const { username, amount, method, trnxId } = req.body;
    if (!users[username]) return res.status(400).json({ message: 'অবৈধ ইউজার!' });

    const newDep = {
        id: 'DEP-' + Date.now().toString().slice(-6),
        username,
        amount: Number(amount),
        method,
        trnxId,
        status: 'Pending',
        date: new Date().toLocaleString()
    };
    deposits.push(newDep);
    res.json({ success: true, message: 'ডিপোজিট রিকোয়েস্ট সফলভাবে পাঠানো হয়েছে!' });
});

// উইথড্র রিকোয়েস্ট
app.post('/api/withdraw', (req, res) => {
    const { username, amount, method, account } = req.body;
    const reqAmount = Number(amount);

    if (!users[username]) return res.status(400).json({ message: 'অবৈধ ইউজার!' });
    if (users[username].balance < reqAmount) return res.status(400).json({ message: 'পর্যাপ্ত ব্যালেন্স নেই!' });

    users[username].balance -= reqAmount;

    const newWd = {
        id: 'WD-' + Date.now().toString().slice(-6),
        username,
        amount: reqAmount,
        method,
        account,
        status: 'Pending',
        date: new Date().toLocaleString()
    };
    withdraws.push(newWd);
    res.json({ success: true, balance: users[username].balance, message: 'উইথড্র রিকোয়েস্ট সফল হয়েছে!' });
});

// গেম খেলার সময় বাজি ধরার মাধ্যমে টার্নওভার আপডেট করার API (ঐচ্ছিক গেম বেটিং রাউট)
app.post('/api/place-bet', (req, res) => {
    const { username, betAmount } = req.body;
    const amount = Number(betAmount);

    if (!users[username]) return res.status(400).json({ message: 'ইউজার পাওয়া যায়নি' });
    if (users[username].balance < amount) return res.status(400).json({ message: 'পর্যাপ্ত ব্যালেন্স নেই' });

    // ব্যালেন্স থেকে বাজি ধরার টাকা কাটা এবং টার্নওভারে যোগ করা
    users[username].balance -= amount;
    users[username].turnover += amount;

    res.json({ success: true, balance: users[username].balance, turnover: users[username].turnover });
});

// ইউজার হিস্টরি
app.get('/api/user-history/:username', (req, res) => {
    const { username } = req.params;
    res.json({ 
        deposits: deposits.filter(d => d.username === username), 
        withdraws: withdraws.filter(w => w.username === username) 
    });
});

// ================= ADMIN API ROUTES =================

// অ্যাডমিনের জন্য ইউজার লিস্ট (টার্নওভার সহ)
app.get('/api/admin/data', (req, res) => {
    const userList = Object.keys(users).map(username => ({
        username,
        password: users[username].password,
        balance: users[username].balance,
        turnover: users[username].turnover
    }));

    res.json({ users: userList, deposits, withdraws });
});

// অ্যাডমিন স্ট্যাটাস আপডেট 
app.post('/api/admin/update-status', (req, res) => {
    const { type, id, status } = req.body;

    if (type === 'deposit') {
        const dep = deposits.find(d => d.id === id);
        if (dep && dep.status === 'Pending') {
            dep.status = status;
            if (status === 'Approved' && users[dep.username]) {
                users[dep.username].balance += dep.amount;
            }
        }
    } else if (type === 'withdraw') {
        const wd = withdraws.find(w => w.id === id);
        if (wd && wd.status === 'Pending') {
            wd.status = status;
            if (status === 'Rejected' && users[wd.username]) {
                users[wd.username].balance += wd.amount; 
            }
        }
    }
    res.json({ success: true });
});

app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/public/admin.html');
});

app.listen(3000, () => {
    console.log('MegaXbet Server running on http://localhost:3000');
});
