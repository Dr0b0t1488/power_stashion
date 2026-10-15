let totalMinutes = 20;
let timerInterval = null;
let secondsRemaining = 0;
let statusPollInterval = null;
let tempCustomTime = ""; 

let isScheduled = false;
let scheduledStartDate = null;
let sessionStartTime = null;
let sessionTotalMinutes = 0;

const setupScreen = document.getElementById('screen_setup');
const activeScreen = document.getElementById('screen_active');
const presetButtons = document.querySelectorAll('.preset-btn:not(#btn_custom_time_open):not(#btn_schedule_open)');
const customTimeBtn = document.getElementById('btn_custom_time_open');
const scheduleBtn = document.getElementById('btn_schedule_open');
const modalInputBox = document.getElementById('modal_manual_input');

const timerDisplay = document.getElementById('timer_countdown');
const endsAtDisplay = document.getElementById('timer_ends_at');
const clockDisplay = document.getElementById('clock_display');
const clockDisplay2 = document.getElementById('clock_display2');

const modalConfirm = document.getElementById('modal_confirm');
const modalFinish = document.getElementById('modal_finish');
const modalText = document.getElementById('modal_confirm_text');
const modalConfirmBtn = document.getElementById('btn_confirm_yes');
const modalPassword = document.getElementById('modal_password');

// =========================================================
// ДВИЖОК АНИМАЦИИ ВОДЫ (CANVAS)
// =========================================================
let waterAnimation = {
    id: null,
    intervals: [],
    start: function(durationMs) {
        this.stop(); 
        const canvas = document.getElementById('waterCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        // Размеры новой колбы под 1024x600 (Ширина 330px, Высота 530px)
        const width = 330, height = 530;
        canvas.width = width; canvas.height = height;

        const WATER_COLOR = 'rgba(16, 227, 48, 0.85)';
        const DROP_COLOR = '#10E330';
        const START_LEVEL = height - 5;
        const END_LEVEL = 5;
        const startTime = Date.now();
        let firstDropHitTime = null;

        const DROP_RATE_MULTIPLIER = Math.max(1, Math.sqrt(durationMs / 60000));
        
        const tension = 0.025;
        const dampening = 0.025;
        const spread = 0.25;

        let springs = [];
        const numSprings = Math.round(width / 5);
        for (let i = 0; i <= numSprings; i++) {
            springs.push({ y: START_LEVEL, targetY: START_LEVEL, speed: 0 });
        }

        function splash(index, speed) {
            if (index >= 0 && index < springs.length) springs[index].speed = speed;
        }

        let drops = [];
        let particles = [];
        const DROP_RADII = [15.8, 10.5, 7.0, 4.7];

        class Drop {
            constructor(type) {
                this.type = type;
                this.r = DROP_RADII[type];
                this.x = Math.random() * (width - this.r * 2) + this.r;
                this.y = -this.r * 4;
                this.vy = 0;
                this.gravity = 0.3 + (Math.random() * 0.05);
                this.mass = this.r * 4.2;
            }
            update() { this.vy += this.gravity; this.y += this.vy; }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r, 0, Math.PI);
                let tailLength = this.r * 2 + this.vy * 0.8;
                ctx.lineTo(this.x, this.y - tailLength);
                ctx.closePath();
                ctx.fillStyle = DROP_COLOR;
                ctx.fill();
            }
        }

        class Particle {
            constructor(x, y, dropRadius, isSpill = false, dir = 1) {
                this.x = x; this.y = y; this.gravity = 0.5;
                if (isSpill) {
                    this.vx = dir * (Math.random() * 4 + 2);
                    this.vy = (Math.random() - 0.5) * 3;
                    this.r = Math.random() * 5 + 3;
                } else {
                    this.vx = (Math.random() - 0.5) * (dropRadius * 0.5);
                    this.vy = (Math.random() - 1) * (dropRadius * 0.6);
                    this.r = Math.random() * (dropRadius * 0.2) + 1.5;
                }
            }
            update() { this.vy += this.gravity; this.x += this.vx; this.y += this.vy; }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
                ctx.fillStyle = DROP_COLOR;
                ctx.fill();
            }
        }

        const self = this;
        function scheduleDrop(type) {
            let delay = 0;
            if (type === 0) delay = (Math.random() * 3000 + 2000) * DROP_RATE_MULTIPLIER;
            else if (type === 1) delay = (Math.random() * 1500 + 1000) * DROP_RATE_MULTIPLIER;
            else if (type === 2) delay = (Math.random() * 800 + 400) * DROP_RATE_MULTIPLIER;
            else if (type === 3) delay = (Math.random() * 300 + 100) * DROP_RATE_MULTIPLIER;

            let timeoutId = setTimeout(() => {
                if (Date.now() - startTime < durationMs) drops.push(new Drop(type));
                scheduleDrop(type);
            }, delay);
            self.intervals.push(timeoutId);
        }

        for (let i = 0; i < 4; i++) {
            scheduleDrop(i);
            if (i >= 2) {
                let timeoutId = setTimeout(() => drops.push(new Drop(i)), Math.random() * 500);
                self.intervals.push(timeoutId);
            }
        }

        function animate() {
            ctx.clearRect(0, 0, width, height);
            let currentWaterLevel = START_LEVEL;
            let isFull = false;

            if (firstDropHitTime) {
                const fillElapsed = Date.now() - firstDropHitTime;
                const fillTotalDuration = durationMs - (firstDropHitTime - startTime);
                let progress = 0;
                if (fillTotalDuration > 0) progress = Math.min(fillElapsed / fillTotalDuration, 1);
                else progress = 1;
                
                currentWaterLevel = START_LEVEL - (START_LEVEL - END_LEVEL) * progress;
                isFull = progress >= 1;
            }

            for (let i = drops.length - 1; i >= 0; i--) {
                let d = drops[i];
                d.update(); d.draw();
                if (d.y + d.r >= currentWaterLevel) {
                    if (!firstDropHitTime) firstDropHitTime = Date.now();
                    let springIndex = Math.round((d.x / width) * numSprings);
                    if (springIndex < 0) springIndex = 0;
                    if (springIndex > numSprings) springIndex = numSprings;
                    splash(springIndex, d.mass);

                    let particleCount = Math.floor(d.r * 0.4 + Math.random() * 2);
                    for(let p = 0; p < particleCount; p++) {
                        particles.push(new Particle(d.x, currentWaterLevel, d.r, false));
                    }
                    if (isFull) {
                        let spillCount = Math.floor(d.r * 0.8);
                        for(let p = 0; p < spillCount; p++) {
                            particles.push(new Particle(15, currentWaterLevel, d.r, true, -1));
                            particles.push(new Particle(width - 15, currentWaterLevel, d.r, true, 1));
                        }
                    }
                    drops.splice(i, 1);
                }
            }

            for (let i = particles.length - 1; i >= 0; i--) {
                let p = particles[i];
                p.update(); p.draw();
                if ((p.y > currentWaterLevel + 10 && p.x > 15 && p.x < width - 15) || p.y > height + 50) {
                    particles.splice(i, 1);
                }
            }

            for (let i = 0; i <= numSprings; i++) {
                let spring = springs[i];
                spring.targetY = currentWaterLevel;
                spring.speed += tension * (spring.targetY - spring.y);
                spring.speed -= spring.speed * dampening;
                spring.y += spring.speed;
            }

            let leftDeltas = [], rightDeltas = [];
            for (let passes = 0; passes < 8; passes++) {
                for (let i = 0; i <= numSprings; i++) {
                    if (i > 0) {
                        leftDeltas[i] = spread * (springs[i].y - springs[i - 1].y);
                        springs[i - 1].speed += leftDeltas[i];
                    }
                    if (i < numSprings) {
                        rightDeltas[i] = spread * (springs[i].y - springs[i + 1].y);
                        springs[i + 1].speed += rightDeltas[i];
                    }
                }
                for (let i = 0; i <= numSprings; i++) {
                    if (i > 0) springs[i - 1].y += leftDeltas[i];
                    if (i < numSprings) springs[i + 1].y += rightDeltas[i];
                }
            }

            ctx.beginPath();
            ctx.moveTo(0, height);
            ctx.lineTo(0, springs[0].y);
            for (let i = 1; i <= numSprings; i++) {
                ctx.lineTo((i / numSprings) * width, springs[i].y);
            }
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.fillStyle = WATER_COLOR;
            ctx.fill();

            self.id = requestAnimationFrame(animate);
        }
        animate();
    },
    stop: function() {
        if (this.id) { cancelAnimationFrame(this.id); this.id = null; }
        for (let intervalId of this.intervals) clearTimeout(intervalId);
        this.intervals = [];
        const canvas = document.getElementById('waterCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
// =========================================================
// ВИДЖЕТ ЗАМКА И ДАТЧИКА ГЕРКОНА
// =========================================================
const SVG_LOCK_CLOSED = `
<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="currentColor" fill-opacity="0.15"></rect>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    <circle cx="12" cy="16" r="1.5" fill="currentColor"></circle>
</svg>`;

const SVG_LOCK_OPEN = `
<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="currentColor" fill-opacity="0.15"></rect>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
    <circle cx="12" cy="16" r="1.5" fill="currentColor"></circle>
</svg>`;

function updateLockWidget(isClosed) {
    const wrap = document.getElementById('lock_icon_wrap');
    const title = document.getElementById('lock_title');
    const sub = document.getElementById('lock_sub');
    if (!wrap || !title || !sub) return;

    if (isClosed) {
        wrap.className = 'lock-icon-wrap closed';
        wrap.innerHTML = SVG_LOCK_CLOSED;
        title.className = 'lock-title closed';
        title.innerText = 'Замок закрыт';
        sub.innerText = 'Датчик замкнут';
    } else {
        wrap.className = 'lock-icon-wrap open';
        wrap.innerHTML = SVG_LOCK_OPEN;
        title.className = 'lock-title open';
        title.innerText = 'Замок открыт';
        sub.innerText = 'Датчик разомкнут';
    }
}

async function toggleSimReed() {
    try {
        const res = await fetch('/api/sim/reed', { method: 'POST' });
        const data = await res.json();
        if (data && data.reed_switch !== undefined) {
            updateLockWidget(Boolean(data.reed_switch));
        }
    } catch (e) {
        console.error("Ошибка переключения симуляции геркона:", e);
    }
}

async function pollReedState() {
    try {
        const res = await fetch('/api/state');
        const data = await res.json();
        if (data && data.reed_switch !== undefined) {
            updateLockWidget(Boolean(data.reed_switch));
        }
    } catch (e) {
        // Игнорируем кратковременные ошибки сети
    }
}

if (document.getElementById('screen_setup')) {
    pollReedState();
    setInterval(pollReedState, 2000);
}

// --- Работа с API Реле ---
async function setRelay(channel, state) {
    try {
        const res = await fetch('/api/relay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channel: channel, state: state })
        });
        return await res.json();
    } catch (e) {
        console.error('Ошибка управления реле:', e);
        return { status: 'error' };
    }
}

function openPasswordModal() {
    document.getElementById('pwd_input').value = '';
    document.getElementById('pwd_error').style.display = 'none';
    modalPassword.classList.add('active');
}
function pressPwdNum(num) { document.getElementById('pwd_input').value += num; }
function pressPwdBackspace() { 
    let el = document.getElementById('pwd_input'); 
    el.value = el.value.slice(0, -1); 
}
function checkPassword() {
    const pwd = document.getElementById('pwd_input').value;
    if (pwd === '1234') {
        window.location.href = '/settings';
    } else {
        document.getElementById('pwd_error').style.display = 'block';
    }
}

function updateClock() {
    const now = new Date();
    if (clockDisplay) clockDisplay.innerText = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    if (clockDisplay2) clockDisplay2.innerText = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

function clearSelections() {
    presetButtons.forEach(b => b.classList.remove('active'));
    if(customTimeBtn) { customTimeBtn.classList.remove('active'); customTimeBtn.innerText = "Указать своё"; }
    if(scheduleBtn) { scheduleBtn.classList.remove('active'); scheduleBtn.innerText = "Начать в"; }
    isScheduled = false;
}

if (presetButtons) {
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            clearSelections();
            btn.classList.add('active');
            totalMinutes = parseInt(btn.dataset.min);
        });
    });
}

let activeCustomInput = 'duration';
let customDurationVal = "";
let customEndTimeVal = "";

function setActiveCustomInput(type) {
    activeCustomInput = type;
    const durEl = document.getElementById('custom_duration');
    const endEl = document.getElementById('custom_endtime');
    if (durEl) durEl.classList.toggle('active-input', type === 'duration');
    if (endEl) endEl.classList.toggle('active-input', type === 'endtime');
}

function updateCustomCalculations() {
    const durEl = document.getElementById('custom_duration');
    const endEl = document.getElementById('custom_endtime');
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    if (activeCustomInput === 'duration') {
        let dur = parseInt(customDurationVal);
        if (durEl) durEl.value = customDurationVal ? customDurationVal + " мин" : "";
        if (!isNaN(dur) && dur > 0) {
            let targetMins = (currentMins + dur) % (24 * 60);
            let h = Math.floor(targetMins / 60);
            let m = targetMins % 60;
            let timeStr = (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
            if (endEl) endEl.value = timeStr;
            customEndTimeVal = timeStr.replace(':', '');
        } else {
            if (endEl) endEl.value = "";
        }
    } else {
        // activeCustomInput === 'endtime'
        let masked = maskTimeInput(customEndTimeVal);
        if (endEl) endEl.value = masked;
        let parsed = parseTimeStr(masked);
        if (parsed !== null) {
            let diff = parsed - currentMins;
            if (diff <= 0) diff += 24 * 60; // перенос на следующий день
            if (durEl) durEl.value = diff + " мин";
            customDurationVal = diff.toString();
        } else {
            if (durEl) durEl.value = "";
        }
    }
}

function pressCustomNum(num) {
    if (activeCustomInput === 'duration') {
        if (customDurationVal.length < 3) {
            customDurationVal += num;
            updateCustomCalculations();
        }
    } else {
        if (customEndTimeVal.length < 4) {
            customEndTimeVal += num;
            updateCustomCalculations();
        }
    }
}

function pressCustomBackspace() {
    if (activeCustomInput === 'duration') {
        if (customDurationVal.length > 0) {
            customDurationVal = customDurationVal.slice(0, -1);
            updateCustomCalculations();
        }
    } else {
        if (customEndTimeVal.length > 0) {
            customEndTimeVal = customEndTimeVal.slice(0, -1);
            updateCustomCalculations();
        }
    }
}

if (customTimeBtn) {
    customTimeBtn.addEventListener('click', () => {
        customDurationVal = "";
        customEndTimeVal = "";
        const durEl = document.getElementById('custom_duration');
        const endEl = document.getElementById('custom_endtime');
        if (durEl) durEl.value = "";
        if (endEl) endEl.value = "";
        setActiveCustomInput('duration');
        document.getElementById('modal_custom_time').classList.add('active');
    });
}

function applyCustomTime() {
    let dur = parseInt(customDurationVal);
    if (isNaN(dur) || dur <= 0) return; 
    clearSelections();
    totalMinutes = dur;
    const endEl = document.getElementById('custom_endtime');
    let endStr = endEl && endEl.value ? endEl.value : "";
    if (customTimeBtn) { 
        customTimeBtn.classList.add('active'); 
        if (endStr) {
            customTimeBtn.innerText = dur + "м (до " + endStr + ")";
        } else {
            customTimeBtn.innerText = dur + " мин";
        }
    }
    closeModal('modal_custom_time');
}

function formatDurationText(mins) {
    if (mins < 60) return mins + " мин";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    let hStr = "часов";
    if (h % 10 === 1 && h % 100 !== 11) hStr = "час";
    else if ([2, 3, 4].includes(h % 10) && ![12, 13, 14].includes(h % 100)) hStr = "часа";
    
    if (m === 0) return `${h} ${hStr}`;
    return `${h} ч ${m} мин`;
}

async function loadHistory() {
    const container = document.getElementById('history_list_container');
    if (!container) return;
    try {
        const res = await fetch('/api/history');
        const data = await res.json();
        const items = (data && data.history) ? data.history : [];
        if (items.length === 0) {
            container.innerHTML = '<div style="color: var(--c-text-grey); font-size: 15px; padding: 25px 0; text-align: center;">История пуста</div>';
            return;
        }
        container.innerHTML = items.map(item => `
            <div class="history-row" onclick="setHistory(${item.duration})">
                <span class="history-time-range">${item.time_range}</span>
                <span class="history-duration">${item.duration_str}</span>
            </div>
        `).join('');
    } catch (e) {
        console.error("Ошибка загрузки истории:", e);
        container.innerHTML = '<div style="color: var(--c-btn-red); font-size: 14px; padding: 15px 0; text-align: center;">Не удалось загрузить историю</div>';
    }
}

async function addHistoryEntry(startStr, endStr, durationMins) {
    const entry = {
        time_range: `${startStr} - ${endStr}`,
        duration: durationMins,
        duration_str: formatDurationText(durationMins),
        date: new Date().toLocaleDateString('ru-RU'),
        timestamp: Date.now()
    };
    try {
        await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
        });
    } catch (e) {
        console.error("Ошибка сохранения истории:", e);
    }
}

function openHistoryModal() {
    const modal = document.getElementById('modal_history');
    if (modal) {
        modal.classList.add('active');
        loadHistory();
    }
}

function setHistory(mins) {
    clearSelections();
    totalMinutes = mins; 
    let matched = false;
    presetButtons.forEach(b => {
        if(parseInt(b.dataset.min) === mins) { b.classList.add('active'); matched = true; }
    });
    if (!matched && customTimeBtn) { 
        customTimeBtn.classList.add('active'); 
        customTimeBtn.innerText = mins + " мин"; 
    }
    closeModal('modal_history');
}

const schedStart = document.getElementById('sched_start');
const schedDuration = document.getElementById('sched_duration');
const schedEnd = document.getElementById('sched_end');
let activeSchedInput = null;

function setActiveSchedInput(inputEl) {
    document.querySelectorAll('.sched-input').forEach(el => el.classList.remove('active-input'));
    activeSchedInput = inputEl;
    if (inputEl) inputEl.classList.add('active-input');
}

if (scheduleBtn) {
    scheduleBtn.addEventListener('click', () => {
        if(schedStart) schedStart.value = "";
        if(schedDuration) schedDuration.value = "";
        if(schedEnd) schedEnd.value = "";
        setActiveSchedInput(schedStart);
        document.getElementById('modal_schedule').classList.add('active');
    });
}

if(schedStart) schedStart.addEventListener('click', () => setActiveSchedInput(schedStart));
if(schedDuration) schedDuration.addEventListener('click', () => setActiveSchedInput(schedDuration));
if(schedEnd) schedEnd.addEventListener('click', () => setActiveSchedInput(schedEnd));

function maskTimeInput(val) {
    let v = val.replace(/\D/g, ''); 
    if (v.length > 4) v = v.slice(0, 4); 
    if (v.length >= 3) return v.slice(0, 2) + ':' + v.slice(2);
    return v;
}
function parseTimeStr(str) {
    if (!str || str.length < 4) return null;
    let pts = str.split(':');
    if (pts.length !== 2) return null;
    let h = parseInt(pts[0]), m = parseInt(pts[1]);
    if (isNaN(h) || isNaN(m) || h > 23 || m > 59) return null;
    return h * 60 + m;
}
function formatTimeNum(mins) {
    mins = mins % (24 * 60); 
    if (mins < 0) mins += 24 * 60;
    let h = Math.floor(mins / 60); let m = mins % 60;
    return (h < 10 ? '0'+h : h) + ':' + (m < 10 ? '0'+m : m);
}

function recalcFromStartOrDuration() {
    if(!schedStart || !schedDuration || !schedEnd) return;
    let st = parseTimeStr(schedStart.value); let dur = parseInt(schedDuration.value);
    if (st !== null && !isNaN(dur)) schedEnd.value = formatTimeNum(st + dur);
}
function recalcFromEnd() {
    if(!schedStart || !schedDuration || !schedEnd) return;
    let st = parseTimeStr(schedStart.value); let en = parseTimeStr(schedEnd.value);
    if (st !== null && en !== null) { let dur = en - st; if (dur < 0) dur += (24 * 60); schedDuration.value = dur; }
}
function pressSchedNum(num) {
    if (!activeSchedInput) return;
    if (activeSchedInput === schedDuration && activeSchedInput.value.length >= 4) return;
    if (activeSchedInput !== schedDuration && activeSchedInput.value.replace(':', '').length >= 4) return;
    let rawValue = activeSchedInput.value.replace(':', '') + num;
    if (activeSchedInput === schedDuration) { activeSchedInput.value = rawValue; recalcFromStartOrDuration(); }
    else { activeSchedInput.value = maskTimeInput(rawValue); if (activeSchedInput === schedStart) recalcFromStartOrDuration(); if (activeSchedInput === schedEnd) recalcFromEnd(); }
}
function pressSchedBackspace() {
    if (!activeSchedInput) return;
    let rawValue = activeSchedInput.value.replace(':', '');
    if (rawValue.length > 0) {
        rawValue = rawValue.slice(0, -1);
        if (activeSchedInput === schedDuration) { activeSchedInput.value = rawValue; recalcFromStartOrDuration(); }
        else { activeSchedInput.value = maskTimeInput(rawValue); if (activeSchedInput === schedStart) recalcFromStartOrDuration(); if (activeSchedInput === schedEnd) recalcFromEnd(); }
    }
}
function applySchedule() {
    if(!schedStart || !schedDuration) return;
    let st = parseTimeStr(schedStart.value); let dur = parseInt(schedDuration.value);
    if (st === null || isNaN(dur) || dur <= 0) return; 
    clearSelections(); isScheduled = true; totalMinutes = dur;
    let now = new Date(); scheduledStartDate = new Date();
    scheduledStartDate.setHours(Math.floor(st / 60), st % 60, 0, 0);
    if (scheduledStartDate < now) scheduledStartDate.setDate(scheduledStartDate.getDate() + 1);
    if (scheduleBtn) { scheduleBtn.classList.add('active'); scheduleBtn.innerText = schedStart.value; }
    closeModal('modal_schedule');
}

// --- Управление UI Ошибок и Статуса ---
function showNormalStatus(text = "") {
    const normal = document.getElementById('status_text_normal');
    const err = document.getElementById('status_text_error');
    if (normal && err) {
        normal.innerText = text;
        normal.classList.remove('hidden');
        err.classList.add('hidden');
    }
}
function showErrorInStatus() {
    const normal = document.getElementById('status_text_normal');
    const err = document.getElementById('status_text_error');
    if (normal && err) {
        normal.classList.add('hidden');
        err.classList.remove('hidden');
    }
}

// --- Логика Таймера ---
function showConfirmModal(text, callback, isError = false, errorMsg = "") { 
    if (modalText) modalText.innerText = text; 
    
    const iconEl = document.getElementById('modal_confirm_error_icon');
    const msgEl = document.getElementById('modal_confirm_error_msg');
    
    if (iconEl) {
        if (isError) iconEl.classList.remove('hidden');
        else iconEl.classList.add('hidden');
    }
    
    if (msgEl) {
        if (isError && errorMsg) {
            msgEl.innerText = errorMsg;
            msgEl.classList.remove('hidden');
        } else {
            msgEl.innerText = "";
            msgEl.classList.add('hidden');
        }
    }

    if (modalConfirm) modalConfirm.classList.add('active'); 
    if (modalConfirmBtn) modalConfirmBtn.onclick = callback; 
}

function closeModal(id) { 
    const el = document.getElementById(id);
    if (el) el.classList.remove('active'); 
}

async function askToStart() { 
    if (totalMinutes <= 0) return; 

    try {
        const res = await fetch('/api/state');
        const data = await res.json();
        const isOk = (data && data.status === 'ok' && data.connected);
        if (!isOk) {
            const msg = (data && data.message) ? data.message : "Модуль не отвечает";
            showConfirmModal("Запустить таймер?", startTimer, true, msg);
        } else {
            showConfirmModal("Запустить таймер?", startTimer, false);
        }
    } catch (e) {
        showConfirmModal("Запустить таймер?", startTimer, true, "Сервер недоступен");
    }
}

function askToStop() { 
    showConfirmModal("Остановить зарядку?", stopTimerManually, false); 
}

async function startTimer() {
    closeModal('modal_confirm');
    if (setupScreen) setupScreen.classList.add('hidden');
    if (activeScreen) activeScreen.classList.remove('hidden');
    
    if (isScheduled && scheduledStartDate > new Date()) {
        const updateWaitText = () => {
            let diffMs = scheduledStartDate - new Date();
            if (diffMs <= 0) return;
            let diffMins = Math.ceil(diffMs / 60000); 
            showNormalStatus("До старта:\n" + diffMins + " мин");
        };

        updateWaitText(); 
        if (timerDisplay) timerDisplay.innerText = "--:--";
        if (endsAtDisplay) endsAtDisplay.innerText = "--:--";
        
        timerInterval = setInterval(async () => {
            if (new Date() >= scheduledStartDate) {
                clearInterval(timerInterval);
                isScheduled = false; 
                await beginActiveCharge();
            } else {
                updateWaitText(); 
            }
        }, 1000);
    } else {
        await beginActiveCharge();
    }
}

async function beginActiveCharge() {
    // Очищаем текст статуса, чтобы вода была на первом плане
    showNormalStatus("");
    
    // Фиксируем начало сессии для истории
    sessionStartTime = new Date();
    sessionTotalMinutes = totalMinutes;

    // Включаем реле канала 1
    await setRelay(0, true); 

    const el1 = document.getElementById('power_ch1');
    const el2 = document.getElementById('power_ch2');
    if (el1) el1.innerText = "0.0 Вт";
    if (el2) el2.innerText = "0.0 Вт";

    const fetchChargePower = async () => {
        try {
            let res = await fetch('/api/state');
            let data = await res.json();
            if (data.status === 'ok' && data.connected && data.power) {
                const p1El = document.getElementById('power_ch1');
                const p2El = document.getElementById('power_ch2');
                if (p1El) p1El.innerText = (data.power[0] !== undefined ? data.power[0] : 0.0) + " Вт";
                if (p2El) p2El.innerText = (data.power[1] !== undefined ? data.power[1] : 0.0) + " Вт";
                showNormalStatus("");
            } else {
                showErrorInStatus();
            }
        } catch (e) {
            console.error("Ошибка опроса мощности:", e);
            showErrorInStatus();
        }
    };

    fetchChargePower();
    statusPollInterval = setInterval(fetchChargePower, 2000);

    const now = new Date();
    const endTime = new Date(now.getTime() + totalMinutes * 60000);
    if (endsAtDisplay) endsAtDisplay.innerText = endTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    secondsRemaining = totalMinutes * 60; 
    updateTimerVisuals();
    
    // ЗАПУСК АНИМАЦИИ ВОДЫ
    waterAnimation.start(totalMinutes * 60000);
    
    timerInterval = setInterval(() => {
        secondsRemaining--; 
        updateTimerVisuals();
        if (secondsRemaining <= 0) finishTimer();
    }, 1000);
}

function stopTimerManually() { 
    closeModal('modal_confirm'); 
    clearInterval(timerInterval); 
    if (statusPollInterval) clearInterval(statusPollInterval);
    setRelay(0, false); 
    waterAnimation.stop(); 
    const el1 = document.getElementById('power_ch1');
    const el2 = document.getElementById('power_ch2');
    if (el1) el1.innerText = "0.0 Вт";
    if (el2) el2.innerText = "0.0 Вт";

    if (sessionStartTime) {
        const now = new Date();
        const elapsedSec = Math.floor((now.getTime() - sessionStartTime.getTime()) / 1000);
        const elapsedMins = Math.round(elapsedSec / 60);
        if (elapsedMins >= 1) {
            const formatTime = (d) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            addHistoryEntry(formatTime(sessionStartTime), formatTime(now), elapsedMins);
        }
        sessionStartTime = null;
    }

    resetToMain(); 
}

function finishTimer() { 
    clearInterval(timerInterval); 
    if (statusPollInterval) clearInterval(statusPollInterval);
    setRelay(0, false); 
    waterAnimation.stop(); 
    const el1 = document.getElementById('power_ch1');
    const el2 = document.getElementById('power_ch2');
    if (el1) el1.innerText = "0.0 Вт";
    if (el2) el2.innerText = "0.0 Вт";

    if (sessionStartTime) {
        const now = new Date();
        const formatTime = (d) => d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        addHistoryEntry(formatTime(sessionStartTime), formatTime(now), sessionTotalMinutes);
        sessionStartTime = null;
    }

    if (modalFinish) modalFinish.classList.add('active'); 
}

function closeFinishModal() { 
    if (modalFinish) modalFinish.classList.remove('active'); 
    resetToMain(); 
}

function resetToMain() { 
    if (activeScreen) activeScreen.classList.add('hidden');
    if (setupScreen) setupScreen.classList.remove('hidden');
}

function updateTimerVisuals() {
    const m = Math.floor(secondsRemaining / 60); 
    const s = secondsRemaining % 60;
    const sString = s < 10 ? '0' + s : s; 
    if (timerDisplay) timerDisplay.innerText = m + ":" + sString; 
}

// --- Страница настроек ---
if (document.getElementById('screen_settings')) {
    const btn_relay1 = document.getElementById('relay1_toggle');
    const btn_relay2 = document.getElementById('relay2_toggle');

    let channelStates = [false, false];
    let channelCooldowns = [0, 0];
    let channelCooldownTimers = [null, null];

    function updateToggleButton(ch) {
        const btn = ch === 0 ? btn_relay1 : btn_relay2;
        if (!btn) return;

        const isCurrentlyOn = channelStates[ch];
        const nextAction = isCurrentlyOn ? 'ВЫКЛЮЧИТЬ' : 'ВКЛЮЧИТЬ';

        btn.className = 'btn-relay ' + (isCurrentlyOn ? 'off' : 'on');

        const cd = channelCooldowns[ch];
        if (cd > 0) {
            btn.disabled = true;
            btn.innerText = `${nextAction} (${cd}с)`;
            btn.classList.add('cooldown');
        } else {
            btn.disabled = false;
            btn.innerText = nextAction;
            btn.classList.remove('cooldown');
        }
    }

    function startCooldown(ch) {
        channelCooldowns[ch] = 3;
        updateToggleButton(ch);

        if (channelCooldownTimers[ch]) clearInterval(channelCooldownTimers[ch]);
        channelCooldownTimers[ch] = setInterval(() => {
            channelCooldowns[ch]--;
            if (channelCooldowns[ch] <= 0) {
                clearInterval(channelCooldownTimers[ch]);
                channelCooldowns[ch] = 0;
            }
            updateToggleButton(ch);
        }, 1000);
    }

    async function handleToggleRelay(ch) {
        if (channelCooldowns[ch] > 0) return;
        const targetState = !channelStates[ch];
        channelStates[ch] = targetState;
        startCooldown(ch);
        await setRelay(ch, targetState);
        fetchState();
    }

    if (btn_relay1) btn_relay1.onclick = () => handleToggleRelay(0);
    if (btn_relay2) btn_relay2.onclick = () => handleToggleRelay(1);

    async function fetchState() {
        try {
            const res = await fetch('/api/state');
            const data = await res.json();
            
            const r1 = document.getElementById('relay1_state');
            const r2 = document.getElementById('relay2_state');
            const p1 = document.getElementById('p1');
            const p2 = document.getElementById('p2');
            const conn = document.getElementById('conn');
            const err = document.getElementById('err');

            if (data.status === 'ok' && data.connected) {
                channelStates[0] = Boolean(data.relays && data.relays[0]);
                channelStates[1] = Boolean(data.relays && data.relays[1]);

                if (r1) r1.innerText = channelStates[0] ? 'ВКЛ' : 'ВЫКЛ';
                if (r2) r2.innerText = channelStates[1] ? 'ВКЛ' : 'ВЫКЛ';
                if (p1 && data.power) p1.innerText = data.power[0] + ' Вт';
                if (p2 && data.power) p2.innerText = data.power[1] + ' Вт';

                if (conn) { conn.innerText = 'LINK OK'; conn.style.color = 'var(--c-btn-green)'; }
                if (err) { err.innerText = 'Ошибок нет'; err.classList.remove('err-pill'); }
            } else {
                channelStates[0] = Boolean(data.relays && data.relays[0]);
                channelStates[1] = Boolean(data.relays && data.relays[1]);

                if (r1) r1.innerText = channelStates[0] ? 'ВКЛ' : 'ВЫКЛ';
                if (r2) r2.innerText = channelStates[1] ? 'ВКЛ' : 'ВЫКЛ';
                if (p1) p1.innerText = '0.0 Вт';
                if (p2) p2.innerText = '0.0 Вт';

                if (conn) { conn.innerText = 'NO LINK'; conn.style.color = 'var(--c-btn-red)'; }
                if (err) { err.innerText = data.message || 'Модуль не подключен'; err.classList.add('err-pill'); }
            }
        } catch (e) {
            const conn = document.getElementById('conn');
            const err = document.getElementById('err');
            const p1 = document.getElementById('p1');
            const p2 = document.getElementById('p2');
            if (conn) { conn.innerText = 'NO LINK'; conn.style.color = 'var(--c-btn-red)'; }
            if (err) { err.innerText = 'Сервер недоступен'; err.classList.add('err-pill'); }
            if (p1) p1.innerText = '0.0 Вт';
            if (p2) p2.innerText = '0.0 Вт';
        }

        const reedPill = document.getElementById('reed_state_pill');
        if (reedPill) {
            if (data && data.reed_switch) {
                reedPill.innerText = 'ЗАМКНУТ (Закрыт)';
                reedPill.style.color = 'var(--c-btn-green)';
            } else {
                reedPill.innerText = 'РАЗОМКНУТ (Открыт)';
                reedPill.style.color = 'var(--c-btn-red)';
            }
        }

        updateToggleButton(0);
        updateToggleButton(1);
        
        const now = new Date();
        const updatedEl = document.getElementById('updated');
        if(updatedEl) updatedEl.innerText = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second:'2-digit' });
    }

    fetchState();
    setInterval(fetchState, 3000);
}