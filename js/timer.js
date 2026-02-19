/* ============================================
   CHRONOPULSE - TIMER LOGIC
   Edit HTML only - Keep logic untouched
   ============================================ */

// Audio Engine (Web Audio API - Offline Capable)
const AudioEngine = {
    ctx: null,
    isMuted: false,
    intervalId: null,

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },

    playAlarm() {
        this.init();
        if (this.isMuted) return;

        this.intervalId = setInterval(() => {
            this.beep(800, 0.1);
            setTimeout(() => this.beep(600, 0.1), 150);
            setTimeout(() => this.beep(800, 0.1), 300);
        }, 1000);
    },

    beep(freq, duration) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    stopAlarm() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    },

    toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }
};

// Timer Logic
const Timer = {
    totalSeconds: 0,
    remainingSeconds: 0,
    intervalId: null,
    isRunning: false,
    isPaused: false,

    // DOM Elements
    display: document.getElementById('timer-display'),
    circle: document.getElementById('progress-circle'),
    status: document.getElementById('status-label'),
    inputSection: document.getElementById('input-section'),
    activeControls: document.getElementById('active-controls'),
    alarmOverlay: document.getElementById('alarm-overlay'),
    
    // Inputs
    inputHrs: document.getElementById('input-hrs'),
    inputMin: document.getElementById('input-min'),
    inputSec: document.getElementById('input-sec'),

    // Circle Props
    circumference: 2 * Math.PI * 120,

    init() {
        this.circle.style.strokeDasharray = `${this.circumference} ${this.circumference}`;
        this.circle.style.strokeDashoffset = 0;
        this.updateDisplay(0);
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('start-btn').addEventListener('click', () => this.start());
        document.getElementById('pause-btn').addEventListener('click', () => {
            if (this.isRunning) this.pause();
            else this.start();
        });
        document.getElementById('reset-btn').addEventListener('click', () => this.reset());
        document.getElementById('dismiss-btn').addEventListener('click', () => this.dismissAlarm());
        
        // Sound toggle
        const soundBtn = document.getElementById('sound-toggle');
        soundBtn.addEventListener('click', () => {
            const isMuted = AudioEngine.toggleMute();
            soundBtn.classList.toggle('muted', isMuted);
        });
    },

    start() {
        if (this.isRunning && !this.isPaused) return;

        AudioEngine.init();

        if (!this.isPaused) {
            const h = parseInt(this.inputHrs.value) || 0;
            const m = parseInt(this.inputMin.value) || 0;
            const s = parseInt(this.inputSec.value) || 0;
            this.totalSeconds = (h * 3600) + (m * 60) + s;
            
            if (this.totalSeconds <= 0) {
                this.shakeInputs();
                return;
            }
            this.remainingSeconds = this.totalSeconds;
        }

        this.isRunning = true;
        this.isPaused = false;
        this.updateUIState('running');
        this.intervalId = setInterval(() => this.tick(), 1000);
    },

    tick() {
        this.remainingSeconds--;
        this.updateDisplay(this.remainingSeconds);
        this.updateProgress();

        if (this.remainingSeconds <= 0) {
            this.complete();
        }
    },

    pause() {
        if (!this.isRunning) return;
        clearInterval(this.intervalId);
        this.isPaused = true;
        this.isRunning = false;
        this.updateUIState('paused');
    },

    reset() {
        clearInterval(this.intervalId);
        this.isRunning = false;
        this.isPaused = false;
        this.remainingSeconds = 0;
        this.totalSeconds = 0;
        this.updateDisplay(0);
        this.updateProgress();
        this.updateUIState('idle');
        AudioEngine.stopAlarm();
    },

    complete() {
        clearInterval(this.intervalId);
        this.isRunning = false;
        this.updateDisplay(0);
        this.updateProgress();
        this.triggerAlarm();
    },

    triggerAlarm() {
        this.alarmOverlay.classList.add('show');
        AudioEngine.playAlarm();
        
        if (Notification.permission === "granted") {
            new Notification("ChronoPulse", { body: "Timer Complete!" });
        }
    },

    dismissAlarm() {
        this.alarmOverlay.classList.remove('show');
        AudioEngine.stopAlarm();
        this.reset();
    },

    updateDisplay(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        
        const strH = h.toString().padStart(2, '0');
        const strM = m.toString().padStart(2, '0');
        const strS = s.toString().padStart(2, '0');
        
        this.display.textContent = `${strH}:${strM}:${strS}`;
        document.title = `(${strH}:${strM}:${strS}) ChronoPulse`;
    },

    updateProgress() {
        if (this.totalSeconds === 0) {
            this.circle.style.strokeDashoffset = 0;
            return;
        }
        const offset = this.circumference - (this.remainingSeconds / this.totalSeconds) * this.circumference;
        this.circle.style.strokeDashoffset = offset;
    },

    updateUIState(state) {
        if (state === 'running') {
            this.inputSection.classList.add('hidden');
            this.activeControls.classList.add('show');
            this.status.textContent = "Running";
            this.status.className = "status-text status-running";
            this.display.style.color = "#67e8f9";
        } else if (state === 'paused') {
            this.status.textContent = "Paused";
            this.status.className = "status-text status-paused";
            this.display.style.color = "white";
            document.getElementById('pause-btn').textContent = "RESUME";
        } else if (state === 'idle') {
            this.inputSection.classList.remove('hidden');
            this.activeControls.classList.remove('show');
            this.status.textContent = "Ready";
            this.status.className = "status-text";
            this.display.style.color = "white";
            document.getElementById('pause-btn').textContent = "PAUSE";
        }
    },

    shakeInputs() {
        const panel = document.getElementById('controls-panel');
        panel.animate([
            { transform: 'translateX(0)' },
            { transform: 'translateX(-10px)' },
            { transform: 'translateX(10px)' },
            { transform: 'translateX(0)' }
        ], { duration: 300 });
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    Timer.init();
    
    // Request notification permission
    if ("Notification" in window) {
        Notification.requestPermission();
    }
});
      
