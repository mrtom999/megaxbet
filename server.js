const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// ইন-মেমোরি ডেটাবেস স্টোরেজ
let users = {};          // { username: { password, balance } }
let deposits = [];       // ডিপোজিট রিকোয়েস্ট লিস্ট
let withdraws = [];      // উইথড্র রিকোয়েস্ট লিস্ট

// ১. সাইন আপ (Register)
app.post('/api/signup', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'ইউজারনেম এবং পাসওয়ার্ড উভয়ই দিতে হবে।' });
    }
    if (users[username]) {
        return res.status(400).json({ message: 'এই ইউজারনেমটি ইতিমধ্যে রেজিস্টার্ড!' });
    }
    
    users[username] = { password, balance: 0.00 };
    res.json({ success: true, message: 'সফলভাবে অ্যাকাউন্ট তৈরি হয়েছে!' });
});

// ২. লগইন (Login)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!users[username] || users[username].password !== password) {
        return res.status(400).json({ message: 'ভুল ইউজারনেম বা পাসওয়ার্ড!' });
    }
    res.json({ success: true, username, balance: users[username].balance });
});

// ৩. ইউজারের বর্তমান ব্যালেন্স চেক
app.get('/api/balance/:username', (req, res) => {
    const { username } = req.params;
    if (users[username]) {
        res.json({ balance: users[username].balance });
    } else {
        res.status(404).json({ message: 'ইউজার পাওয়া যায়নি' });
    }
});

// ৪. ডিপোজিট রিকোয়েস্ট পাঠানো
app.post('/api/deposit', (req, res) => {
    const { username, amount, method, trnxId } = req.body;
    if (!users[username]) {
        return res.status(400).json({ message: 'অবৈধ ইউজার!' });
    }

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

// ৫. উইথড্র রিকোয়েস্ট পাঠানো (ব্যালেন্স চেক ও সাথে সাথে কেটে নেওয়া)
app.post('/api/withdraw', (req, res) => {
    const { username, amount, method, account } = req.body;
    const reqAmount = Number(amount);

    if (!users[username]) {
        return res.status(400).json({ message: 'অবৈধ ইউজার!' });
    }
    if (users[username].balance < reqAmount) {
        return res.status(400).json({ message: 'আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই!' });
    }

    // উইথড্র রিকোয়েস্ট দেওয়ার সাথে সাথেই ইউজারের মেইন ব্যালেন্স থেকে টাকা কেটে নেওয়া হবে
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

// ৬. ইউজার হিস্টরি ফেচ করা (ডিপোজিট ও উইথড্র)
app.get('/api/user-history/:username', (req, res) => {
    const { username } = req.params;
    const userDeps = deposits.filter(d => d.username === username);
    const userWds = withdraws.filter(w => w.username === username);
    res.json({ deposits: userDeps, withdraws: userWds });
});

// ৭. অ্যাডমিনের জন্য সব রিকোয়েস্ট দেখা
app.get('/api/admin/requests', (req, res) => {
    res.json({ deposits, withdraws });
});

// ৮. অ্যাডমিন স্ট্যাটাস আপডেট (ডিপোজিট এপ্রুভ হলে ব্যালেন্স যোগ হবে, উইথড্র রিজেক্ট হলে টাকা ফেরত যাবে)
app.post('/api/admin/update-status', (req, res) => {
    const { type, id, status } = req.body;

    if (type === 'deposit') {
        const dep = deposits.find(d => d.id === id);
        if (dep && dep.status === 'Pending') {
            dep.status = status;
            if (status === 'Approved') {
                if (users[dep.username]) {
                    users[dep.username].balance += dep.amount;
                }
            }
        }
    } else if (type === 'withdraw') {
        const wd = withdraws.find(w => w.id === id);
        if (wd && wd.status === 'Pending') {
            wd.status = status;
            if (status === 'Rejected') {
                // উইথড্র বাতিল হলে কেটে নেওয়া টাকা আবার ইউজারের ব্যালেন্সে ফেরত দেওয়া হবে
                if (users[wd.username]) {
                    users[wd.username].balance += wd.amount;
                }
            }
        }
    }
    res.json({ success: true, message: 'স্ট্যাটাস আপডেট সফল হয়েছে!' });
});

// ৯. অ্যাডমিন প্যানেল ফাইল ব্রাউজারে রেন্ডার করার রাউট
app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/public/admin.html');
});

// সার্ভার পোর্ট লিসেনিং
app.listen(3000, () => {
    console.log('MegaXbet Server is running on http://localhost:3000');
});
