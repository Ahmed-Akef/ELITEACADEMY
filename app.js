/**
 * Educational Platform Logic - MCQ & LOCK SYSTEM EDITION
 */

const db = {
    getUsers: () => {
        const saved = localStorage.getItem('edu_users');
        const defaultAdmin = [{ id: 1, name: 'Owner Admin', email: 'admin@elite.com', password: 'admin', role: 'admin', progress: {} }];
        if (!saved) return defaultAdmin;
        try {
            const parsed = JSON.parse(saved);
            return (Array.isArray(parsed) && parsed.length > 0) ? parsed : defaultAdmin;
        } catch (e) {
            return defaultAdmin;
        }
    },
    saveUsers: (u) => localStorage.setItem('edu_users', JSON.stringify(u)),
    getModules: () => {
        const saved = localStorage.getItem('edu_modules');
        const defaultModules = [
            {
                id: 1,
                title: 'Month 1: Introduction to Mastery',
                lectures: [
                    {
                        id: 101,
                        title: 'The Elite Mindset',
                        thumbnail: 'https://img.freepik.com/free-vector/gradient-techno-background_23-2148911524.jpg',
                        videos: [{ id: 1001, title: 'Session 1', url: 'https://www.youtube.com/watch?v=zOjov-2OZ0E' }],
                        pdf: '',
                        quiz: { passScore: 50, questions: [{ q: 'What is elite?', a: ['Mindset', 'Money', 'Car'], correct: 0 }] }
                    }
                ]
            }
        ];
        if (!saved) return defaultModules;
        try {
            const parsed = JSON.parse(saved);
            return (Array.isArray(parsed) && parsed.length > 0) ? parsed : defaultModules;
        } catch (e) {
            return defaultModules;
        }
    },
    saveModules: (m) => localStorage.setItem('edu_modules', JSON.stringify(m)),
    init: () => {
        // Ensure data is initialized in localStorage if empty
        if (!localStorage.getItem('edu_users')) {
            db.saveUsers(db.getUsers());
        }
        if (!localStorage.getItem('edu_modules')) {
            db.saveModules(db.getModules());
        }

        // Safety check: ensure at least one admin exists with the correct credentials
        let users = db.getUsers();
        let adminUser = users.find(u => u.email.toLowerCase() === 'admin@elite.com');

        if (!adminUser) {
            // Admin doesn't exist, add it
            users.push({ id: 1, name: 'Owner Admin', email: 'admin@elite.com', password: 'admin', role: 'admin', progress: {} });
            db.saveUsers(users);
        } else {
            // Admin exists, ensure password is 'admin' and role is 'admin' for safety
            let changed = false;
            if (adminUser.password !== 'admin') { adminUser.password = 'admin'; changed = true; }
            if (adminUser.role !== 'admin') { adminUser.role = 'admin'; changed = true; }
            if (changed) db.saveUsers(users);
        }
    },
    resetSystem: () => {
        localStorage.removeItem('edu_users');
        localStorage.removeItem('edu_modules');
        sessionStorage.clear();
        location.reload();
    }
};

// --- State Management ---
const state = {
    currentUser: JSON.parse(sessionStorage.getItem('current_user')) || null,
    activeLecture: null,
    activeVideoIndex: 0,
    playerMode: 'video',
    jitsiApi: null,
    pendingLecture: null, // Store lecture waiting for code verification
    activeQuiz: null,
    quizAnswers: []
};

// Generate random access code
function generateAccessCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// --- Formatters ---
function formatEmbed(url) {
    if (!url) return '';
    url = url.trim();
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([^"&?\/\s]{11})/;
    const match = url.match(ytRegex);
    if (match && match[1]) {
        return `https://www.youtube-nocookie.com/embed/${match[1]}?rel=0&modestbranding=1&enablejsapi=1`;
    }
    if (url.includes('drive.google.com')) {
        const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]{25,})\//) || url.match(/id=([a-zA-Z0-9_-]{25,})/);
        if (dMatch) return `https://drive.google.com/file/d/${dMatch[1]}/preview`;
    }
    if (url.includes('jit.si') || url.includes('jitsi') || url.includes('ffmuc.net')) {
        let cleanUrl = url.split('#')[0].split('?')[0];
        if (cleanUrl.includes('meet.jit.si')) {
            cleanUrl = cleanUrl.replace('meet.jit.si', 'meet.ffmuc.net');
        }
        const jitsiConfig = [
            'config.prejoinPageEnabled=false',
            'config.startWithAudioMuted=false',
            'config.startWithVideoMuted=false',
            'config.hideConferenceSubject=true',
            'config.hideConferenceTimer=true',
            'config.disableDeepLinking=true',
            'config.toolbarButtons=["microphone","chat"]',
            'interfaceConfig.TOOLBAR_BUTTONS=["microphone","chat"]',
            'interfaceConfig.SHOW_JITSI_WATERMARK=false',
            'interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false'
        ].join('&');
        return `${cleanUrl}#${jitsiConfig}`;
    }
    if (url.includes('webex.com')) {
        return url; // Webex usually needs direct navigation or specific widget
    }
    return url;
}

function formatDriveImage(url) {
    if (!url) return 'https://via.placeholder.com/600x400?text=Premium+Content';
    url = url.trim();
    if (url.includes('drive.google.com')) {
        const id = url.match(/\/d\/([a-zA-Z0-9_-]{25,})\//) || url.match(/id=([a-zA-Z0-9_-]{25,})/);
        if (id) return `https://drive.google.com/uc?export=view&id=${id[1]}`;
    }
    return url;
}

// --- Auth ---
const auth = {
    handleLogin: (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-password').value.trim();

        console.log("Attempting login for:", email);
        const users = db.getUsers();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === pass);

        if (user) {
            console.log("Login successful for:", user.name);
            state.currentUser = user;
            sessionStorage.setItem('current_user', JSON.stringify(user));
            auth.updateUI();
            router.navigate(user.role === 'admin' ? 'admin' : 'dashboard');
            showToast('Authorization Successful', 'success');
        } else {
            console.warn("Login failed. Current users in DB:", users.length);
            // Check if any admin exists at all
            const hasAdmin = users.some(u => u.role === 'admin');
            if (!hasAdmin) {
                console.error("NO ADMIN FOUND. Initializing DB...");
                db.init();
            }
            showToast('Invalid Credentials', 'danger');
        }
    },
    handleRegister: (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-password').value;
        const all = db.getUsers();
        if (all.find(x => x.email === email)) return showToast('Email already in use', 'danger');
        all.push({ id: Date.now(), name, email, password: pass, role: 'student', progress: {} });
        db.saveUsers(all); router.navigate('login'); showToast('Account Created', 'success');
    },
    logout: () => { sessionStorage.removeItem('current_user'); state.currentUser = null; auth.updateUI(); router.navigate('home'); },
    updateUI: () => {
        const u = state.currentUser;
        if (document.getElementById('user-display')) document.getElementById('user-display').textContent = u ? u.name : '';
        document.getElementById('user-display')?.classList.toggle('hidden', !u);
        document.getElementById('logout-btn')?.classList.toggle('hidden', !u);
        document.getElementById('login-nav-btn')?.classList.toggle('hidden', !!u);
        document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', u?.role !== 'admin'));
        document.querySelectorAll('.user-only').forEach(el => el.classList.toggle('hidden', !u));
    }
};

const router = {
    navigate: (page) => {
        if (['dashboard', 'admin'].includes(page) && !state.currentUser) page = 'login';
        state.currentPage = page;
        const content = document.getElementById('content');
        const tpl = document.getElementById(`tpl-${page}`);
        if (content && tpl) {
            content.innerHTML = tpl.innerHTML;
            if (page === 'dashboard') dashboard.init();
            if (page === 'admin') admin.init();
        }
        document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
        document.getElementById(`nav-${page}`)?.classList.add('active');
        window.scrollTo(0, 0);
    }
};

// --- Dashboard ---
const dashboard = {
    init: () => {
        const sName = document.getElementById('student-name');
        if (sName) sName.textContent = state.currentUser.name;
        const list = document.getElementById('module-list');
        if (!list) return;

        list.innerHTML = db.getModules().map(m => `
            <div class="module-card">
                <div class="module-header" onclick="dashboard.toggle(${m.id})">
                    <h3>${m.title}</h3>
                    <span id="arr-${m.id}" style="font-size:1.5rem; transition:0.3s;">▼</span>
                </div>
                <div id="body-${m.id}" class="module-contents hidden">
                    <div class="video-grid">
                        ${m.lectures.map(l => {
            const isPassed = state.currentUser.progress && state.currentUser.progress[l.id];
            // Access is NOW determined by MODULE access
            const isModuleUnlocked = state.currentUser.unlockedModules && state.currentUser.unlockedModules.includes(m.id);
            const isUnlockedAccess = isModuleUnlocked;
            const hasQuiz = l.quiz && l.quiz.questions && l.quiz.questions.length > 0;
            const needsQuiz = hasQuiz && !isPassed && state.currentUser.role !== 'admin';

            let actionBtn = '';
            if (!isUnlockedAccess && state.currentUser.role !== 'admin') {
                actionBtn = `<button class="btn btn-outline" style="width:100%" onclick="dashboard.requestAccess(${m.id}, ${l.id})">🔒 Enter Access Code</button>`;
            } else if (needsQuiz) {
                actionBtn = `<button class="btn btn-primary" style="width:100%" onclick="quiz.open(${m.id}, ${l.id})">📝 Answer Quiz</button>`;
            } else {
                actionBtn = `<button class="btn btn-primary" style="width:100%" onclick="player.open(${m.id}, ${l.id})">▶ Watch Session</button>`;
            }

            return `
                                <div class="video-card ${needsQuiz && isUnlockedAccess ? 'locked-card' : ''}">
                                    <div class="video-thumb" onclick="${((needsQuiz && isUnlockedAccess) || (!isUnlockedAccess && state.currentUser.role !== 'admin')) ? '' : `player.open(${m.id}, ${l.id})`}">
                                        <img src="${formatDriveImage(l.thumbnail)}">
                                        <div style="position:absolute; inset:0; background:rgba(0,0,0,0.4); display:flex; justify-content:center; align-items:center; opacity:0; transition:0.3s;" class="play-overlay">
                                            <div style="width:60px; height:60px; background:var(--primary); border-radius:50%; display:flex; justify-content:center; align-items:center;">▶</div>
                                        </div>
                                    </div>
                                    <div style="padding:25px;">
                                        <h4 style="font-size:1.2rem; margin-bottom:15px;">${l.title}</h4>
                                        <div style="display:flex; flex-direction:column; gap:10px;">
                                            ${actionBtn}
                                        </div>
                                    </div>
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    },
    toggle: (id) => {
        const body = document.getElementById(`body-${id}`);
        const arr = document.getElementById(`arr-${id}`);
        if (body) body.classList.toggle('hidden');
        if (arr) arr.style.transform = body.classList.contains('hidden') ? '' : 'rotate(180deg)';
    },
    requestAccess: (mid, lid) => {
        state.pendingLecture = { mid, lid };
        const mod = db.getModules().find(m => m.id === mid);
        const lec = mod.lectures.find(l => l.id === lid);

        admin.openModal(`
            <div style="text-align:center; padding:40px;">
                <div style="font-size:4rem; margin-bottom:20px;">🔐</div>
                <h2 style="margin-bottom:10px; font-size:1.8rem;">Access Code Required</h2>
                <p style="color:var(--text-dim); margin-bottom:30px;">Enter the access code to unlock this lecture</p>
                <input type="text" id="access-code-input" placeholder="Enter 8-character code" 
                    style="font-size:1.2rem; padding:15px; text-align:center; letter-spacing:3px; 
                    background:rgba(255,255,255,0.05); border:2px solid var(--primary); 
                    border-radius:12px; color:white; width:300px; text-transform:uppercase;" 
                    maxlength="8">
                <div style="margin-top:30px; display:flex; gap:15px; justify-content:center;">
                    <button class="btn btn-outline" onclick="admin.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="dashboard.verifyCode()">Unlock</button>
                </div>
            </div>
        `);
        setTimeout(() => document.getElementById('access-code-input').focus(), 100);
    },
    verifyCode: () => {
        const code = document.getElementById('access-code-input').value.trim();
        const { mid, lid } = state.pendingLecture;

        // Fetch all modules to search for the code (Module Level)
        const mods = db.getModules();
        // Determine which MODULE (Month) is being accessed
        const targetMod = mods.find(m => m.id === mid);

        // Check THIS module's codes
        let validCodeIndex = -1;
        if (targetMod && targetMod.bulkCodes) {
            validCodeIndex = targetMod.bulkCodes.findIndex(c => c.code === code && (!c.used || c.usedBy === state.currentUser.id));
        }

        if (validCodeIndex !== -1) {
            // Mark code as used if it wasn't already
            if (!targetMod.bulkCodes[validCodeIndex].used) {
                targetMod.bulkCodes[validCodeIndex].used = true;
                targetMod.bulkCodes[validCodeIndex].usedBy = state.currentUser.id;
                db.saveModules(mods);
            }

            // Save unlocked MODULE state to user profile
            const users = db.getUsers();
            const u = users.find(x => x.id === state.currentUser.id);
            if (!u.unlockedModules) u.unlockedModules = [];
            if (!u.unlockedModules.includes(mid)) {
                u.unlockedModules.push(mid);
                db.saveUsers(users);
                state.currentUser = u;
                sessionStorage.setItem('current_user', JSON.stringify(u));
            }

            admin.closeModal();
            dashboard.init(); // Refresh UI

            // After unlocking code, check if there's a quiz that needs to be answered
            const mod = db.getModules().find(m => m.id === mid);
            const lec = mod.lectures.find(l => l.id === lid);
            const isPassed = state.currentUser.progress && state.currentUser.progress[lid];
            const hasQuiz = lec.quiz && lec.quiz.questions && lec.quiz.questions.length > 0;
            const needsQuiz = hasQuiz && !isPassed && state.currentUser.role !== 'admin';

            if (needsQuiz) {
                quiz.open(mid, lid);
            } else {
                player.open(mid, lid);
            }
            showToast('Month Unlocked Successfuly', 'success');
        } else {
            alert('❌ Invalid code for this month.');
            document.getElementById('access-code-input').value = '';
            document.getElementById('access-code-input').focus();
        }
    }
};

// --- Quiz Logic ---
const quiz = {
    open: (mid, lid) => {
        const mod = db.getModules().find(m => m.id === mid);
        const lec = mod.lectures.find(l => l.id === lid);
        state.activeLecture = lec;
        state.activeQuiz = { ...lec.quiz, mid, lid };
        state.quizAnswers = new Array(lec.quiz.questions.length).fill(null);
        quiz.render(0);
        document.getElementById('global-modal').style.display = 'flex';
        document.getElementById('modal-title').textContent = `Required Exam: ${lec.title}`;
    },
    render: (qIdx) => {
        const q = state.activeQuiz.questions[qIdx];
        document.getElementById('modal-body').innerHTML = `
            <div class="quiz-container">
                <p style="color:var(--primary); font-weight:800; margin-bottom:10px;">Question ${qIdx + 1} of ${state.activeQuiz.questions.length}</p>
                
                ${q.passage ? `<div class="quiz-passage">${q.passage}</div>` : ''}
                
                ${q.image ? `
                    <div style="margin-bottom:30px; text-align:center; background:rgba(0,0,0,0.3); border-radius:20px; padding:15px; border:1px solid rgba(255,255,255,0.05); box-shadow:0 10px 40px rgba(0,0,0,0.4);">
                        <img src="${formatDriveImage(q.image)}" style="max-width:100%; max-height:500px; border-radius:15px; display:block; margin:0 auto; object-fit:contain;" alt="Question Image">
                    </div>
                ` : ''}

                <h3 class="quiz-q" style="line-height:1.4; margin-bottom:35px;">${q.q}</h3>
                <div class="quiz-options">
                    ${q.a.map((opt, i) => `
                        <div class="quiz-opt ${state.quizAnswers[qIdx] === i ? 'selected' : ''}" onclick="quiz.select(${qIdx}, ${i})" style="margin-bottom:12px;">
                            ${opt}
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top:30px; display:flex; justify-content:space-between;">
                    ${qIdx > 0 ? `<button class="btn btn-outline" onclick="quiz.render(${qIdx - 1})">Previous</button>` : '<div></div>'}
                    ${qIdx < state.activeQuiz.questions.length - 1 ?
                `<button class="btn btn-primary" onclick="quiz.render(${qIdx + 1})">Next Question</button>` :
                `<button class="btn btn-primary" onclick="quiz.submit()">Submit Final Exam</button>`
            }
                </div>
            </div>
        `;
    },
    select: (qIdx, optIdx) => {
        state.quizAnswers[qIdx] = optIdx;
        quiz.render(qIdx);
    },
    submit: () => {
        if (state.quizAnswers.includes(null)) return showToast('Please answer all questions', 'danger');
        let correctCount = 0;
        state.activeQuiz.questions.forEach((q, i) => {
            if (q.correct === state.quizAnswers[i]) correctCount++;
        });
        const score = Math.round((correctCount / state.activeQuiz.questions.length) * 100);
        const passed = score >= state.activeQuiz.passScore;

        document.getElementById('modal-body').innerHTML = `
            <div class="score-badge">
                <h2 class="${passed ? 'pass-label' : 'fail-label'}">${passed ? 'EXAM PASSED!' : 'EXAM FAILED'}</h2>
                <p style="font-size:3rem; font-weight:900; margin:20px 0;">${score}%</p>
                <p style="color:var(--text-dim); margin-bottom:30px;">Requirement: ${state.activeQuiz.passScore}%</p>
                ${passed ?
                `<button class="btn btn-primary" onclick="quiz.finish(true)">Go to Lecture</button>` :
                `<button class="btn btn-outline" onclick="quiz.open(${state.activeQuiz.mid}, ${state.activeQuiz.lid})">Try Again</button>`
            }
            </div>
        `;
    },
    finish: (passed) => {
        if (passed) {
            const users = db.getUsers();
            const u = users.find(x => x.id === state.currentUser.id);
            if (!u.progress) u.progress = {};
            u.progress[state.activeLecture.id] = true;
            db.saveUsers(users);
            state.currentUser = u;
            sessionStorage.setItem('current_user', JSON.stringify(u));
            dashboard.init();
        }
        admin.closeModal();
    },
    requestAccess: (mid, lid) => {
        state.pendingLecture = { mid, lid };
        const mod = db.getModules().find(m => m.id === mid);
        const lec = mod.lectures.find(l => l.id === lid);

        admin.openModal(`
            <div style="text-align:center; padding:40px;">
                <div style="font-size:4rem; margin-bottom:20px;">🔐</div>
                <h2 style="margin-bottom:10px; font-size:1.8rem;">Access Code Required</h2>
                <p style="color:var(--text-dim); margin-bottom:30px;">Enter the access code to unlock this lecture</p>
                <input type="text" id="access-code-input" placeholder="Enter 8-character code" 
                    style="font-size:1.2rem; padding:15px; text-align:center; letter-spacing:3px; 
                    background:rgba(255,255,255,0.05); border:2px solid var(--primary); 
                    border-radius:12px; color:white; width:300px; text-transform:uppercase;" 
                    maxlength="8">
                <div style="margin-top:30px; display:flex; gap:15px; justify-content:center;">
                    <button class="btn btn-outline" onclick="admin.closeModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="dashboard.verifyCode()">Unlock</button>
                </div>
            </div>
        `);
        setTimeout(() => document.getElementById('access-code-input').focus(), 100);
    },
    verifyCode: () => {
        const code = document.getElementById('access-code-input').value.trim();
        const { mid, lid } = state.pendingLecture;
        const mod = db.getModules().find(m => m.id === mid);
        const lec = mod.lectures.find(l => l.id === lid);
        const currentUserId = state.currentUser.id;

        // Check if code matches this student's individual code
        const studentCode = lec.studentCodes && lec.studentCodes[currentUserId];

        if (code.toUpperCase() === (studentCode || '').toUpperCase()) {
            admin.closeModal();
            player.open(mid, lid);
        } else {
            alert('❌ Invalid access code. Please contact your instructor.');
            document.getElementById('access-code-input').value = '';
            document.getElementById('access-code-input').focus();
        }
    },

};

// --- Player ---
const player = {
    open: (mid, lid, mode = 'video') => {
        const mod = db.getModules().find(m => m.id === mid);
        const lec = mod.lectures.find(l => l.id === lid);
        state.activeLecture = lec;
        state.activeVideoIndex = 0;
        state.playerMode = mode;
        player.render();
        document.getElementById('player-modal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    },
    render: () => {
        const v = state.activeLecture.videos[state.activeVideoIndex];
        let targetUrl = (state.playerMode === 'meet') ? state.activeLecture.meet : v.url;
        const isJitsi = targetUrl && (targetUrl.includes('jit.si') || targetUrl.includes('jitsi') || targetUrl.includes('ffmuc.net'));
        const isWebex = targetUrl && targetUrl.includes('webex.com');
        const embedUrl = formatEmbed(targetUrl);

        if (isWebex && state.playerMode === 'video') {
            // If professor added a webex link, we should probably handle it specially
            window.open(targetUrl, '_blank');
            showToast('Opening Webex Meeting in new tab...', 'success');
            return;
        }

        document.getElementById('player-modal').innerHTML = `
            <div class="super-player-container">
                <div class="player-sidebar">
                    <h3 style="margin-bottom:30px; font-weight:900; letter-spacing:1px; color:var(--primary);">CURRICULUM</h3>
                    <div class="playlist-items">
                        ${state.activeLecture.videos.map((vid, i) => {
            const isPartLive = vid.title.toLowerCase().includes('live');
            return `
                                <div class="playlist-item ${(i === state.activeVideoIndex && state.playerMode === 'video') ? 'active' : ''}" onclick="player.switch(${i})">
                                    <span style="${isPartLive ? 'color:#f43f5e; font-weight:900;' : 'opacity:0.6;'} margin-right:15px;">${isPartLive ? 'LIVE' : '0' + (i + 1)}</span>
                                    <strong>${vid.title}</strong>
                                </div>
                            `;
        }).join('')}
                    </div>
                </div>
                <div class="main-video-area">
                    <div class="video-frame-container" id="video-container">
                        ${isJitsi ? `
                            <div id="jitsi-api-container" style="width:100%; height:100%;"></div>
                            <div class="video-protection-overlay" style="pointer-events: auto; position:absolute; inset:0; z-index:10; background:transparent;"></div>
                        ` : isWebex ? `
                            <div style="width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; background:#000; padding:40px; text-align:center;">
                                <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Cisco_Webex_logo.svg/1200px-Cisco_Webex_logo.svg.png" style="width:120px; margin-bottom:30px; filter: drop-shadow(0 0 10px rgba(255,255,255,0.2));">
                                <h1 style="color:white; margin-bottom:15px; font-size:2.5rem;">Cisco Webex Meeting</h1>
                                <p style="color:var(--text-dim); margin-bottom:40px; max-width:500px; font-size:1.1rem;">To ensure the highest HD quality and security, Webex meetings open in a secure dedicated window.</p>
                                <button onclick="window.open('${targetUrl}', '_blank')" class="btn btn-primary" style="padding:20px 40px; font-size:1.3rem; border-radius:50px; background:linear-gradient(135deg, #00b0ea, #005eb8); box-shadow:0 15px 35px rgba(0, 176, 234, 0.4);">
                                    🚀 Join Live Session Now
                                </button>
                                <p style="margin-top:30px; color:rgba(255,255,255,0.3); font-size:0.9rem;">(Make sure to allow pop-ups if prompted)</p>
                            </div>
                        ` : `
                            <div class="video-protection-overlay"></div>
                            <iframe
                                src="${embedUrl}"
                                allow="camera; microphone; display-capture; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowfullscreen
                                referrerpolicy="no-referrer">
                            </iframe>
                        `}
                    </div>
                    <div class="player-info-bar">
                        <div style="display:flex; flex-direction:column;">
                            <span style="color:var(--primary); font-weight:800; font-size:0.75rem; text-transform:uppercase; letter-spacing:1px;">${isJitsi ? 'Live Interactive Mode' : 'Session Detail'}</span>
                            <h2 style="font-size:1.4rem; font-weight:700;">${isJitsi ? 'Interactive Live Session' : v.title}</h2>
                        </div>
                        <div style="display:flex; gap:12px; align-items:center;">
                            ${state.activeLecture.pdf ? `<a href="${state.activeLecture.pdf}" target="_blank" class="btn btn-outline btn-sm" style="background:rgba(255,255,255,0.03); border-color:rgba(255,255,255,0.1); color:white; padding:10px 15px; text-decoration:none;">📄 View PDF</a>` : ''}
                            ${isJitsi ? `
                                <button class="btn btn-outline btn-sm" onclick="player.toggleMic()" style="background:rgba(255,255,255,0.03); border-color:rgba(255,255,255,0.1); color:white; padding:10px 15px;">🎙️ Mic</button>
                                <button class="btn btn-outline btn-sm" onclick="player.toggleChat()" style="background:rgba(255,255,255,0.03); border-color:rgba(255,255,255,0.1); color:white; padding:10px 15px;">💬 Chat</button>
                                <button class="btn btn-outline btn-sm" onclick="player.toggleFullscreen()" style="background:rgba(255,255,255,0.03); border-color:rgba(255,255,255,0.1); color:white; padding:10px 15px;">📺 Fullscreen</button>
                                <div style="width:1px; height:30px; background:rgba(255,255,255,0.1); margin:0 5px;"></div>
                            ` : ''}
                            <button class="btn btn-primary btn-sm" onclick="player.close()" style="padding:10px 20px;">Exit</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (isJitsi) {
            // Use meet.ffmuc.net - students can join immediately without 5-min limit
            let domain = "meet.ffmuc.net";
            let roomName = "GeneralClass"; // Fallback
            try {
                const urlObj = new URL(targetUrl);
                const pathParts = urlObj.pathname.split('/').filter(x => x);
                if (pathParts.length > 0) roomName = pathParts[pathParts.length - 1];
            } catch (e) {
                // If it's not a full URL, try simple split
                roomName = targetUrl.split('/').filter(x => x).pop() || "GeneralClass";
            }
            roomName = roomName.split('#')[0].split('?')[0];

            const options = {
                roomName: roomName,
                width: '100%',
                height: '100%',
                parentNode: document.querySelector('#jitsi-api-container'),
                userInfo: {
                    displayName: 'Student',
                    email: '',
                    moderator: false
                },
                configOverwrite: {
                    prejoinPageEnabled: false,
                    startWithAudioMuted: false,
                    startWithVideoMuted: false,
                    toolbarButtons: [],
                    resolution: 1080,
                    constraints: {
                        video: {
                            height: { ideal: 1080, max: 1080, min: 720 },
                            width: { ideal: 1920, max: 1920, min: 1280 },
                            frameRate: { ideal: 30, max: 60 }
                        }
                    },
                    desktopSharingFrameRate: { min: 30, max: 60 },
                    p2p: { enabled: false },
                    videoQuality: {
                        preferredCodec: 'H264',
                        maxBitratesVideo: {
                            low: 1000000,
                            standard: 2000000,
                            high: 4000000,
                            full: 8000000
                        },
                        persistence: true,
                        enforcePreferredCodec: true
                    },
                    disableModeratorIndicator: true,
                    enableLayerSuspension: false,
                    api_max_full_resolution_participants: -1,
                    disableSimulcast: true,
                    channelLastN: -1,
                    adaptiveLastN: false,
                    useNewBandwidthEstimation: true,
                    videoQualityPersist: true,
                    startSilent: false
                },
                interfaceConfigOverwrite: {
                    SHOW_JITSI_WATERMARK: false,
                    SHOW_WATERMARK_FOR_GUESTS: false,
                    TOOLBAR_BUTTONS: []
                }
            };
            if (window.JitsiMeetExternalAPI) {
                if (state.jitsiApi) state.jitsiApi.dispose();
                state.jitsiApi = new JitsiMeetExternalAPI(domain, options);
            }
        }
    },
    toggleMic: () => { if (state.jitsiApi) state.jitsiApi.executeCommand('toggleAudio'); },
    toggleChat: () => { if (state.jitsiApi) state.jitsiApi.executeCommand('toggleChat'); },
    toggleFullscreen: () => {
        const v = state.activeLecture.videos[state.activeVideoIndex];
        const targetUrl = (state.playerMode === 'meet') ? state.activeLecture.meet : v.url;
        const isJitsi = targetUrl && (targetUrl.includes('jit.si') || targetUrl.includes('jitsi') || targetUrl.includes('ffmuc.net'));

        if (isJitsi) {
            // For live sessions: use browser fullscreen
            const p = document.querySelector('.super-player-container');
            if (!document.fullscreenElement) p.requestFullscreen().catch(e => console.log(e));
            else document.exitFullscreen();
        } else {
            // For regular videos: use theater mode
            const sidebar = document.querySelector('.player-sidebar');
            const btn = event.target;
            if (sidebar.style.display === 'none') {
                sidebar.style.display = 'block';
                btn.innerHTML = '📺 Fullscreen';
            } else {
                sidebar.style.display = 'none';
                btn.innerHTML = '📺 Exit Theater';
            }
        }
    },
    switch: (i) => {
        state.activeVideoIndex = i;
        state.playerMode = 'video'; // Always reset to video when switching parts
        player.render();
    },
    close: () => {
        if (state.jitsiApi) {
            state.jitsiApi.dispose();
            state.jitsiApi = null;
        }
        document.getElementById('player-modal').style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

// --- Admin ---
const admin = {
    init: () => { admin.renderModules(); admin.renderUsers(); },
    showTab: (t) => {
        document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(`admin-tab-${t}`).classList.remove('hidden');
        document.querySelectorAll('.admin-tab-link').forEach(el => el.classList.remove('active'));
        document.getElementById(`tab-link-${t}`).classList.add('active');
    },
    renderModules: () => {
        const list = document.getElementById('admin-module-list');
        if (!list) return;
        list.innerHTML = db.getModules().map(m => `
            <div class="module-card">
                <div style="padding:30px; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05);">
                    <h3 style="font-size:1.6rem;">${m.title}</h3>
                    <div style="display:flex; gap:10px;">
                        <button class="btn btn-outline btn-sm" onclick="admin.manageStudentCodes(${m.id})">🔑 Manage Month Codes</button>
                        <button class="btn btn-primary btn-sm" onclick="admin.openLectureModal(${m.id})">+ Add Lecture</button>
                        <button class="btn btn-outline btn-sm" onclick="admin.editModule(${m.id})">Edit</button>
                        <button class="btn btn-outline btn-sm" onclick="admin.deleteModule(${m.id})" style="color:var(--accent);">X</button>
                    </div>
                </div>
                <div style="padding:20px 30px 40px;">
                    ${m.lectures.map(l => `
                        <div class="lecture-manage-item">
                            <div>
                                <strong style="font-size:1.1rem; color:var(--primary);">${l.title}</strong>
                                <span style="margin-left:20px; opacity:0.6; font-size:0.8rem;">${l.videos.length} Parts | Quiz: ${l.quiz ? l.quiz.questions.length : 0} Qs</span>
                            </div>
                            <div style="display:flex; gap:12px;">
                                <button class="btn btn-primary btn-sm" style="background: linear-gradient(135deg, #6366f1, #8b5cf6); border:none; box-shadow:0 4px 15px rgba(99, 102, 241, 0.4);" onclick="admin.openQuizModal(${m.id}, ${l.id})">Manage Exam</button>
                                <button class="btn btn-outline btn-sm" style="border-radius:8px; border-color:rgba(255,255,255,0.2);" onclick="admin.openLectureModal(${m.id}, ${l.id})">Edit Details</button>
                                <button class="btn btn-outline btn-sm" onclick="admin.deleteLecture(${m.id}, ${l.id})" style="color:var(--accent); border-color:rgba(244, 63, 94, 0.3);">X</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },
    renderUsers: () => {
        const uList = document.getElementById('admin-user-list');
        if (uList) uList.innerHTML = db.getUsers().map(u => `
            <div class="lecture-manage-item">
                <div><strong>${u.name}</strong> <span style="opacity:0.5; margin-left:10px;">(${u.email})</span></div>
                <div style="background:var(--primary); padding:5px 15px; border-radius:50px; font-size:0.7rem; font-weight:900;">${u.role.toUpperCase()}</div>
            </div>
        `).join('');
    },
    openModal: (content) => {
        document.getElementById('modal-body').innerHTML = content;
        document.getElementById('global-modal').style.display = 'flex';
        // Hide title if not explicitly set (hacky but works for custom modals)
        if (content.includes('Recall Code')) document.getElementById('modal-title').style.display = 'none';
        else document.getElementById('modal-title').style.display = 'block';
    },
    openModuleModal: (mid = null) => {
        const mod = mid ? db.getModules().find(m => m.id === mid) : null;
        document.getElementById('modal-title').textContent = mid ? 'Rename Module' : 'Create Module';
        document.getElementById('modal-body').innerHTML = `
            <form onsubmit="admin.saveModule(event, ${mid})">
                <div class="form-group" style="margin-bottom:30px;"><label>Module Title</label><input type="text" id="mod-title" required value="${mod ? mod.title : ''}"></div>
                <button type="submit" class="btn btn-primary" style="width:100%;">${mid ? 'Update' : 'Create'}</button>
            </form>
        `;
        document.getElementById('global-modal').style.display = 'flex';
    },
    saveModule: (e, mid) => {
        e.preventDefault();
        const title = document.getElementById('mod-title').value;
        const all = db.getModules();
        if (mid) all.find(m => m.id === mid).title = title;
        else all.push({ id: Date.now(), title, lectures: [] });
        db.saveModules(all); admin.closeModal(); admin.renderModules();
        showToast('Success', 'success');
    },
    openLectureModal: (mid, lid = null) => {
        const isEdit = lid !== null;
        const mod = db.getModules().find(m => m.id === mid);
        const l = isEdit ? mod.lectures.find(lec => lec.id === lid) : null;
        document.getElementById('modal-title').textContent = isEdit ? 'Edit Lecture' : 'New Lecture';
        document.getElementById('modal-body').innerHTML = `
            <form onsubmit="admin.saveLecture(event, ${mid}, ${lid})">
                <!-- Header Settings (Clean Layout) -->
                <div style="margin-top:20px; margin-bottom:30px; padding:0 10px;">
                     <div style="margin-bottom:20px;">
                        <input type="text" id="l-title" required value="${isEdit ? l.title : ''}" placeholder="Lecture Title" style="font-size:1.4rem; font-weight:bold; padding:10px 0; background:transparent; border:none; border-bottom:1px solid rgba(255,255,255,0.2); color:white; width:100%; outline:none;">
                     </div>
                     <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
                         <div class="form-group">
                             <label style="font-size:0.75rem; color:var(--text-dim); margin-bottom:8px; display:block; text-transform:uppercase; letter-spacing:1px;">PDF Resources</label>
                             <input type="text" id="l-pdf" value="${isEdit ? (l.pdf || '') : ''}" placeholder="PDF Link" style="font-size:0.85rem; padding:10px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.05); border-radius:8px; color:white; width:100%;">
                        </div>
                         <div class="form-group">
                             <label style="font-size:0.75rem; color:var(--text-dim); margin-bottom:8px; display:block; text-transform:uppercase; letter-spacing:1px;">Access Control</label>
                             <button class="btn btn-outline btn-sm" onclick="admin.manageStudentCodes(${mid})" type="button" style="width:100%; padding:10px;">🔑 Manage Month Codes</button>
                        </div>
                     </div>
                     <div class="form-group" style="display:flex; align-items:center; gap:15px;">
                        <input type="file" id="l-thumb-file" accept="image/*" onchange="admin.handleImageUpload(this)" style="display:none;">
                        <button type="button" class="btn btn-sm" onclick="document.getElementById('l-thumb-file').click()" style="background:var(--primary); color:white; border:none; padding:8px 16px; border-radius:6px; font-size:0.8rem;">Change Thumbnail</button>
                        <input type="hidden" id="l-thumb" value="${isEdit ? l.thumbnail : ''}">
                        ${isEdit && l.thumbnail ? `<img src="${l.thumbnail}" style="height:40px; border-radius:4px; border:1px solid rgba(255,255,255,0.2);">` : '<span style="font-size:0.8rem; color:var(--text-dim);">No thumbnail selected</span>'}
                     </div>
                </div>

                <!-- Video Table (Distinct Card) -->
                <div style="max-height:40vh; overflow-y:auto; margin-bottom:25px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.05); border-radius:12px;">
                    <table style="width:100%; border-collapse:collapse; text-align:left;">
                        <thead style="background:rgba(255,255,255,0.02); position:sticky; top:0; z-index:10; backdrop-filter:blur(5px);">
                            <tr>
                                <th style="padding:15px; font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; color:var(--text-dim); font-weight:600; border-bottom:1px solid rgba(255,255,255,0.1);">Part Title</th>
                                <th style="padding:15px; font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; color:var(--text-dim); font-weight:600; border-bottom:1px solid rgba(255,255,255,0.1);">Video Source</th>
                                <th style="padding:15px; width:60px; border-bottom:1px solid rgba(255,255,255,0.1);"></th>
                            </tr>
                        </thead>
                        <tbody id="video-rows">
                            ${(isEdit ? l.videos : [{ title: 'Part 1', url: '' }]).map((v, idx) => `
                                <tr class="v-row" style="border-bottom:1px solid rgba(255,255,255,0.05);">
                                    <td style="padding:10px;"><input type="text" class="v-title" placeholder="Part Title" value="${v.title}" style="width:100%; background:transparent; border:none; padding:8px; color:white; font-size:0.95rem;"></td>
                                    <td style="padding:10px;"><input type="text" class="v-url" placeholder="Paste link..." value="${v.url}" style="width:100%; background:transparent; border:none; padding:8px; color:var(--text-dim); font-size:0.9rem;"></td>
                                    <td style="padding:10px; text-align:center;">
                                       ${idx > 0 ? `<button type="button" onclick="this.closest('tr').remove()" style="background:none; border:none; color:rgba(244,63,94,0.5); cursor:pointer; font-size:1.2rem;">&times;</button>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div style="display:flex; gap:10px;">
                    <button type="button" onclick="admin.addRow()" class="btn btn-outline" style="flex:1;">+ Add Part</button>
                    <button type="submit" class="btn btn-primary" style="flex:2;">Save Lecture</button>
                </div>
            </form>
        `;
        document.getElementById('global-modal').style.display = 'flex';
    },
    openQuizModal: (mid, lid) => {
        const mod = db.getModules().find(m => m.id === mid);
        const l = mod.lectures.find(lec => lec.id === lid);
        const qData = l.quiz || { passScore: 50, questions: [] };

        document.getElementById('modal-title').textContent = `Manage Exam: ${l.title}`;
        document.getElementById('modal-body').innerHTML = `
            <div style="margin-top:40px; display:flex; align-items:center; justify-content:space-between; background:rgba(99, 102, 241, 0.1); padding:15px 25px; border-radius:12px; border:1px solid rgba(99, 102, 241, 0.3); margin-bottom:25px;">
                <div>
                    <h4 style="margin:0; color:white; font-size:1.1rem;">Exam Configuration</h4>
                    <span style="font-size:0.8rem; color:var(--text-dim);">Passing Percentage</span>
                </div>
                <input type="number" id="q-pass" value="${qData.passScore}" min="0" max="100" style="width:80px; text-align:center; padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.3); color:white; font-weight:bold; font-size:1.1rem;">
            </div>

            <div style="max-height:50vh; overflow-y:auto; margin-bottom:20px; border:1px solid rgba(255,255,255,0.05); border-radius:12px;">
                <table style="width:100%; border-collapse:collapse; text-align:left;">
                    <thead style="background:rgba(255,255,255,0.02); position:sticky; top:0; z-index:10; backdrop-filter:blur(5px);">
                        <tr>
                            <th style="padding:15px; font-size:0.85rem; color:var(--text-dim); font-weight:600; border-bottom:1px solid rgba(255,255,255,0.1);">Question Details (Passage / Image / Question)</th>
                            <th style="padding:15px; font-size:0.85rem; color:var(--text-dim); font-weight:600; border-bottom:1px solid rgba(255,255,255,0.1);">Options (comma split)</th>
                            <th style="padding:15px; font-size:0.85rem; color:var(--text-dim); font-weight:600; border-bottom:1px solid rgba(255,255,255,0.1); width:80px;">Ans Index</th>
                            <th style="padding:15px; font-size:0.85rem; color:var(--text-dim); font-weight:600; border-bottom:1px solid rgba(255,255,255,0.1); width:60px;"></th>
                        </tr>
                    </thead>
                    <tbody id="q-rows">
                        ${qData.questions.map((q, i) => `
                            <tr class="adm-q-row" style="border-bottom:1px solid rgba(255,255,255,0.1);">
                                <td style="padding:10px;">
                                    <textarea class="q-passage" placeholder="Add Passage/Piece (Optional)" style="width:100%; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.1); padding:8px; color:var(--text-dim); font-size:0.8rem; margin-bottom:5px; border-radius:4px;">${q.passage || ''}</textarea>
                                    <div style="display:flex; align-items:center; gap:5px; margin-bottom:5px;">
                                        <input type="text" class="q-image" value="${q.image || ''}" placeholder="Image URL (Optional)" style="flex:1; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.1); padding:8px; color:var(--primary); font-size:0.8rem; border-radius:4px;">
                                        <input type="file" accept="image/*" onchange="admin.handleQuizImageUpload(this)" style="display:none;">
                                        <button type="button" class="btn btn-sm" onclick="this.previousElementSibling.click()" style="padding:8px 12px; background:var(--bg-input); border:1px solid var(--glass-border);">📁</button>
                                    </div>
                                    <input type="text" class="q-text" value="${q.q}" placeholder="Question text?" style="width:100%; background:transparent; border:none; padding:8px; color:white; font-weight:bold;">
                                </td>
                                <td style="padding:10px;"><input type="text" class="q-opts" value="${q.a.join(', ')}" placeholder="A, B, C" style="width:100%; background:transparent; border:none; padding:8px; color:var(--text-dim);"></td>
                                <td style="padding:10px;"><input type="number" class="q-correct" value="${q.correct}" style="width:100%; background:transparent; border:none; padding:8px; color:var(--accent); font-weight:bold; text-align:center;"></td>
                                <td style="padding:10px; text-align:center;"><button onclick="this.closest('tr').remove()" style="background:none; border:none; color:rgba(244,63,94,0.5); cursor:pointer; font-size:1.2rem; transition:0.2s;">&times;</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div style="display:flex; gap:10px;">
                <button class="btn btn-outline" style="flex:1;" onclick="admin.addQuizRow()">+ Add Row</button>
                <button class="btn btn-primary" style="flex:2;" onclick="admin.saveQuiz(${mid}, ${lid})">Save All Changes</button>
            </div>
        `;
        document.getElementById('global-modal').style.display = 'flex';
    },
    addQuizRow: () => {
        const tr = document.createElement('tr');
        tr.className = 'adm-q-row';
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        tr.innerHTML = `
            <td style="padding:10px;">
                <textarea class="q-passage" placeholder="Add Passage/Piece (Optional)" style="width:100%; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.1); padding:8px; color:var(--text-dim); font-size:0.8rem; margin-bottom:5px; border-radius:4px;"></textarea>
                <div style="display:flex; align-items:center; gap:5px; margin-bottom:5px;">
                    <input type="text" class="q-image" placeholder="Image URL (Optional)" style="flex:1; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.1); padding:8px; color:var(--primary); font-size:0.8rem; border-radius:4px;">
                    <input type="file" accept="image/*" onchange="admin.handleQuizImageUpload(this)" style="display:none;">
                    <button type="button" class="btn btn-sm" onclick="this.previousElementSibling.click()" style="padding:8px 12px; background:var(--bg-input); border:1px solid var(--glass-border);">📁</button>
                </div>
                <input type="text" class="q-text" placeholder="New Question" style="width:100%; background:transparent; border:none; padding:8px; color:white; font-weight:bold;">
            </td>
            <td style="padding:10px;"><input type="text" class="q-opts" placeholder="Option 1, Option 2" style="width:100%; background:transparent; border:none; padding:8px; color:var(--text-dim);"></td>
            <td style="padding:10px;"><input type="number" class="q-correct" value="0" style="width:100%; background:transparent; border:none; padding:8px; color:var(--accent); font-weight:bold; text-align:center;"></td>
            <td style="padding:10px; text-align:center;"><button onclick="this.closest('tr').remove()" style="background:none; border:none; color:rgba(244,63,94,0.5); cursor:pointer; font-size:1.2rem; transition:0.2s;">&times;</button></td>
        `;
        document.getElementById('q-rows').appendChild(tr);
    },
    saveQuiz: (mid, lid) => {
        const mods = db.getModules();
        const l = mods.find(m => m.id === mid).lectures.find(lec => lec.id === lid);
        const questions = [];
        document.querySelectorAll('.adm-q-row').forEach(row => {
            const q = row.querySelector('.q-text').value;
            const a = row.querySelector('.q-opts').value.split(',').map(x => x.trim());
            const correct = parseInt(row.querySelector('.q-correct').value);
            const image = row.querySelector('.q-image').value;
            const passage = row.querySelector('.q-passage').value;
            if (q && a.length > 0) questions.push({ q, a, correct, image, passage });
        });
        l.quiz = { passScore: parseInt(document.getElementById('q-pass').value), questions };
        db.saveModules(mods); showToast('Exam Saved', 'success'); admin.closeModal(); admin.renderModules();
    },
    addRow: () => {
        const tr = document.createElement('tr');
        tr.className = 'v-row';
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
        tr.innerHTML = `
            <td style="padding:8px;"><input type="text" class="v-title" placeholder="Next Part" style="width:100%; background:transparent; border:none; padding:8px; color:white;"></td>
            <td style="padding:8px;"><input type="text" class="v-url" placeholder="Video Link" style="width:100%; background:transparent; border:none; padding:8px; color:var(--text-dim);"></td>
            <td style="padding:8px; text-align:center;"><button type="button" onclick="this.closest('tr').remove()" style="background:none; border:none; color:rgba(244,63,94,0.5); cursor:pointer; font-size:1.2rem;">&times;</button></td>
        `;
        document.getElementById('video-rows').appendChild(tr);
    },
    saveLecture: (e, mid, lid) => {
        e.preventDefault();
        const mods = db.getModules();
        const m = mods.find(x => x.id === mid);
        const videos = [];
        document.querySelectorAll('.v-row').forEach(row => {
            const t = row.querySelector('.v-title').value;
            const u = row.querySelector('.v-url').value;
            if (u) videos.push({ id: Date.now() + Math.random(), title: t, url: u });
        });
        const data = {
            id: lid || Date.now(),
            title: document.getElementById('l-title').value,
            thumbnail: document.getElementById('l-thumb').value,
            pdf: document.getElementById('l-pdf').value,
            studentCodes: lid ? (m.lectures.find(x => x.id === lid).studentCodes || {}) : {},
            videos,
            quiz: lid ? m.lectures.find(x => x.id === lid).quiz : { passScore: 50, questions: [] }
        };
        if (lid) { const idx = m.lectures.findIndex(l => l.id === lid); m.lectures[idx] = data; }
        else m.lectures.push(data);
        db.saveModules(mods); admin.closeModal(); admin.renderModules();
        showToast('Lecture Saved', 'success');
    },
    deleteModule: (id) => { if (confirm('Delete?')) { db.saveModules(db.getModules().filter(m => m.id !== id)); admin.renderModules(); } },
    deleteLecture: (mid, lid) => {
        if (confirm('Delete?')) {
            const mods = db.getModules();
            const m = mods.find(x => x.id === mid);
            m.lectures = m.lectures.filter(l => l.id !== lid);
            db.saveModules(mods); admin.renderModules();
        }
    },
    editModule: (id) => admin.openModuleModal(id),
    handleImageUpload: (input) => {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('l-thumb').value = e.target.result;
                showToast('Image Loaded', 'success');
            };
            reader.readAsDataURL(input.files[0]);
        }
    },
    handleQuizImageUpload: (input) => {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const td = input.closest('td');
                const imageInput = td.querySelector('.q-image');
                imageInput.value = e.target.result;

                // Show a small preview in admin
                let preview = td.querySelector('.q-preview');
                if (!preview) {
                    preview = document.createElement('img');
                    preview.className = 'q-preview';
                    preview.style = "width:40px; height:40px; border-radius:4px; object-fit:cover; margin-left:5px; border:1px solid var(--primary);";
                    input.parentElement.appendChild(preview);
                }
                preview.src = e.target.result;

                showToast('Question Image Loaded', 'success');
            };
            reader.readAsDataURL(input.files[0]);
        }
    },
    manageStudentCodes: (mid, lid = null) => {
        try {
            const mods = db.getModules();
            const mod = mods.find(m => m.id == mid);
            if (!mod) return alert('Module not found');

            // If lid is provided (legacy call), ideally ignore or redirect, but we are moving to module level.
            // We use 'mod' object to store codes now.
            if (!mod.bulkCodes) mod.bulkCodes = [];

            const renderAuthCodes = () => {
                return mod.bulkCodes.map(c => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.03); border-radius:6px; margin-bottom:5px;">
                        <code style="color:var(--primary); font-size:1.1rem; letter-spacing:1px;">${c.code}</code>
                        <span style="font-size:0.8rem; ${c.used ? 'color:var(--accent);' : 'color:#10b981;'}">${c.used ? 'USED' : 'ACTIVE'}</span>
                    </div>
                `).join('');
            };

            admin.openModal(`
                <div style="padding:30px; max-width:800px; margin:0 auto;">
                    <h2 style="margin-bottom:10px; font-size:1.8rem;">📦 Month Access Codes</h2>
                    <p style="color:var(--text-dim); margin-bottom:30px;">Generate codes to unlock <strong>${mod.title}</strong>.</p>

                    <div style="background:rgba(255,255,255,0.05); padding:20px; border-radius:12px; margin-bottom:30px;">
                        <h4 style="margin-bottom:15px;">Generate New Codes</h4>
                        <div style="display:flex; gap:10px;">
                            <input type="number" id="bulk-qty" value="10" min="1" max="100" style="padding:10px; width:80px; border-radius:8px; border:none; text-align:center;">
                            <button class="btn btn-primary" onclick="admin.generateBulkCodes(${mid})">Generate Codes</button>
                        </div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h4 style="margin:0;">Existing Codes (${mod.bulkCodes.length})</h4>
                        <button class="btn btn-outline btn-sm" onclick="admin.downloadCodes(${mid})">⬇️ Export to File</button>
                    </div>

                    <div style="max-height:300px; overflow-y:auto; border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:10px;">
                        ${mod.bulkCodes.length ? renderAuthCodes() : '<div style="text-align:center; padding:20px; color:var(--text-dim);">No codes generated yet.</div>'}
                    </div>
                    
                    <div style="text-align:center; margin-top:20px;">
                        <button class="btn btn-primary" onclick="admin.closeModal()">Done</button>
                    </div>
                </div>
            `);
        } catch (err) {
            console.error(err);
            alert('Error opening access codes: ' + err.message);
        }
    },
    generateBulkCodes: (mid) => {
        const qty = parseInt(document.getElementById('bulk-qty').value);
        if (!qty || qty < 1) return alert('Invalid quantity');

        const mods = db.getModules();
        const mod = mods.find(m => m.id === mid);

        if (!mod.bulkCodes) mod.bulkCodes = [];
        for (let i = 0; i < qty; i++) {
            mod.bulkCodes.push({ code: generateAccessCode(), used: false, usedBy: null });
        }
        db.saveModules(mods);
        admin.manageStudentCodes(mid);
        showToast(`${qty} Codes Generated`, 'success');
    },
    downloadCodes: (mid) => {
        const mod = db.getModules().find(m => m.id === mid);
        if (!mod.bulkCodes || mod.bulkCodes.length === 0) return alert('No codes to export');

        const text = `ACCESS CODES FOR MODULE: ${mod.title}\n\n` + mod.bulkCodes.map(c => `${c.code} - ${c.used ? 'USED' : 'ACTIVE'}`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `MonthCodes_${mod.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
        a.click();
    },
    closeModal: () => document.getElementById('global-modal').style.display = 'none'
};

function showToast(m, t) {
    const toast = document.createElement('div'); toast.className = `toast toast-${t}`;
    toast.textContent = m; document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
}

window.onload = () => {
    db.init(); auth.updateUI();
    router.navigate(state.currentUser ? (state.currentUser.role === 'admin' ? 'admin' : 'dashboard') : 'home');
    document.getElementById('main-nav').classList.remove('hidden');
};
