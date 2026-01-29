document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const enterBtn = document.getElementById('enter-btn');
    const welcomeScreen = document.getElementById('welcome-screen');
    const slideshowContainer = document.getElementById('slideshow-container');
    const slideBlurBg = document.getElementById('slide-blur-bg');
    const slides = document.querySelectorAll('.slide-item');
    const bgm = document.getElementById('bgm');
    const progressBar = document.querySelector('.progress-fill');
    const endingScreen = document.getElementById('ending-screen');
    const btnText = enterBtn.querySelector('.btn-text');

    // --- Configuration ---
    const SLIDE_DURATION = 5000;
    const IS_MOBILE = window.innerWidth < 768;
    const PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, 2);

    // --- State ---
    let currentIndex = 0;
    let slideInterval;

    // --- 1. Extreme Preloader (Full Asset Loading) ---
    const assetsToLoad = [];
    
    // Collect all images and videos
    slides.forEach(slide => {
        const src = slide.getAttribute('data-src') || slide.src;
        if (src) {
            assetsToLoad.push({
                element: slide,
                src: src,
                type: slide.tagName
            });
        }
    });

    let loadedCount = 0;
    const totalAssets = assetsToLoad.length + 1; // +1 for audio

    function updateProgress() {
        loadedCount++;
        const percent = Math.floor((loadedCount / totalAssets) * 100);
        btnText.textContent = `资源加载中... ${Math.min(percent, 100)}%`;
        
        if (loadedCount >= totalAssets) {
            enableEnterButton();
        }
    }

    function enableEnterButton() {
        btnText.textContent = '开启回忆录';
        enterBtn.style.opacity = '1';
        enterBtn.style.pointerEvents = 'auto';
        enterBtn.classList.add('ready-pulse');
    }

    // Load Audio
    bgm.load();
    bgm.oncanplaythrough = () => {
        // Ensure this only counts once
        if (!bgm.dataset.loaded) {
            bgm.dataset.loaded = "true";
            updateProgress();
        }
    };
    bgm.onerror = () => {
        if (!bgm.dataset.loaded) {
            bgm.dataset.loaded = "true";
            updateProgress(); // Count even if failed
        }
    };

    // Load Visual Assets
    assetsToLoad.forEach(asset => {
        if (asset.type === 'IMG') {
            const img = new Image();
            img.onload = () => {
                asset.element.src = asset.src;
                asset.element.removeAttribute('data-src');
                updateProgress();
            };
            img.onerror = updateProgress;
            img.src = asset.src;
        } else if (asset.type === 'VIDEO') {
            asset.element.src = asset.src;
            asset.element.removeAttribute('data-src');
            asset.element.load();
            asset.element.onloadedmetadata = updateProgress;
            asset.element.onerror = updateProgress;
        }
    });

    // Failsafe timeout (8 seconds)
    setTimeout(() => {
        if (loadedCount < totalAssets) {
            console.warn('Loading timed out, forcing start.');
            loadedCount = totalAssets;
            enableEnterButton();
        }
    }, 8000);


    // --- 2. Interaction & Slideshow ---
    enterBtn.addEventListener('click', () => {
        // Play Audio
        bgm.volume = 0;
        bgm.play().then(() => fadeInAudio(bgm, 0.3)).catch(console.error);

        // Transition
        welcomeScreen.classList.add('hidden');
        setTimeout(() => {
            welcomeScreen.style.display = 'none';
            slideshowContainer.classList.add('visible');
            startSlideshow();
        }, 1500);
    });

    function startSlideshow() {
        showSlide(0);
        slideInterval = setInterval(nextSlide, SLIDE_DURATION);
    }

    function nextSlide() {
        currentIndex++;
        if (currentIndex >= slides.length) {
            endSlideshow();
            return;
        }
        showSlide(currentIndex);
    }

    function showSlide(index) {
        slides.forEach(slide => slide.classList.remove('active'));
        const currentSlide = slides[index];
        currentSlide.classList.add('active');

        // Update Background
        if (currentSlide.tagName === 'IMG') {
            slideBlurBg.style.backgroundImage = `url(${currentSlide.src})`;
        }

        // Progress Bar
        const progress = ((index + 1) / slides.length) * 100;
        progressBar.style.width = `${progress}%`;

        // Handle Video
        if (currentSlide.tagName === 'VIDEO') {
            handleVideoSlide(currentSlide);
        }
    }

    function handleVideoSlide(video) {
        clearInterval(slideInterval);
        fadeOutAudio(bgm, () => bgm.pause());
        
        video.currentTime = 0;
        video.muted = false;
        video.play().catch(console.error);
        
        video.onended = () => {
            endSlideshow();
        };
    }

    function endSlideshow() {
        clearInterval(slideInterval);
        if (!bgm.paused) fadeOutAudio(bgm, () => bgm.pause());
        
        slideshowContainer.style.opacity = 0;
        endingScreen.classList.add('visible');
        
        startFireworks();
    }

    // --- 3. Optimized Fireworks System (Object Pooling) ---
    function startFireworks() {
        const canvas = document.getElementById('fireworks');
        // Disable alpha for performance if possible, but we need trails so we keep it standard
        // Actually alpha: false is for opaque canvas. We need transparent.
        const ctx = canvas.getContext('2d', { alpha: true }); 
        
        let width, height;
        
        // Object Pools
        const fireworkPool = [];
        const particlePool = [];
        const activeFireworks = [];
        const activeParticles = [];

        // Web Audio API Context
        let audioCtx;
        
        // 初始化音频上下文 (必须在用户交互中触发)
        function initAudio() {
            if (!audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                audioCtx = new AudioContext();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
        }
        
        // 尝试在开始时就初始化 (虽然可能被拦截，但值得一试)
        try { initAudio(); } catch(e) {}
        
        // 在任何可能的点击中再次尝试唤醒
        document.addEventListener('click', initAudio, { once: true });
        document.addEventListener('touchstart', initAudio, { once: true });

        // 合成爆炸音效 (无需加载文件)
        function playExplosionSound(isBig) {
            if (!audioCtx) return;
            
            const t = audioCtx.currentTime;
            
            // 1. 核心爆炸声 (白噪音)
            const bufferSize = audioCtx.sampleRate * 2; // 2秒缓冲
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;
            
            // 滤波器 (模拟沉闷感)
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = isBig ? 400 : 800; // 大烟花更低沉
            
            // 包络 (Attack & Decay)
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(isBig ? 0.8 : 0.3, t + 0.05); // 瞬间响度
            gain.gain.exponentialRampToValueAtTime(0.01, t + (isBig ? 1.5 : 0.8)); // 衰减
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            
            noise.start(t);
            noise.stop(t + 2);
            
            // 2. 尖啸声 (可选，增加层次)
            if (Math.random() > 0.5) {
                const osc = audioCtx.createOscillator();
                const oscGain = audioCtx.createGain();
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(random(200, 400), t);
                osc.frequency.exponentialRampToValueAtTime(50, t + 0.5);
                
                oscGain.gain.setValueAtTime(0.1, t);
                oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
                
                osc.connect(oscGain);
                oscGain.connect(audioCtx.destination);
                osc.start(t);
                osc.stop(t + 0.5);
            }
        }

        function resize() {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width * PIXEL_RATIO;
            canvas.height = height * PIXEL_RATIO;
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.scale(PIXEL_RATIO, PIXEL_RATIO);
        }
        window.addEventListener('resize', resize);
        resize();

        // Helpers
        const random = (min, max) => Math.random() * (max - min) + min;
        
        // Colors
        const colors = [
            'hsl(330, 80%, 75%)', 'hsl(45, 90%, 65%)', 
            'hsl(190, 80%, 70%)', 'hsl(260, 60%, 75%)', 
            'hsl(30, 90%, 70%)', 'hsl(140, 60%, 70%)'
        ];

        // Classes with Pooling Support
        class Firework {
            constructor() {
                this.coordinates = [];
                this.coordinateCount = 2;
            }

            init(startX, tx, ty, color, isMain) {
                this.x = startX;
                this.y = height;
                this.sx = startX;
                this.sy = height;
                this.tx = tx;
                this.ty = ty;
                this.color = color;
                this.isMain = isMain;
                
                this.distanceToTarget = Math.sqrt(Math.pow(tx - startX, 2) + Math.pow(ty - this.y, 2));
                this.distanceTraveled = 0;
                
                this.coordinates.length = 0;
                for(let i=0; i<this.coordinateCount; i++) {
                    this.coordinates.push([this.x, this.y]);
                }
                
                this.angle = Math.atan2(ty - height, tx - startX);
                this.speed = isMain ? 2.5 : random(2, 4);
                this.acceleration = 1.02;
                this.brightness = random(50, 70);
                this.active = true;
            }

            update(index) {
                this.coordinates.pop();
                this.coordinates.unshift([this.x, this.y]);
                this.speed *= this.acceleration;
                
                const vx = Math.cos(this.angle) * this.speed;
                const vy = Math.sin(this.angle) * this.speed;
                
                this.distanceTraveled = Math.sqrt(Math.pow(this.sx - this.x - vx, 2) + Math.pow(this.sy - this.y - vy, 2));
                
                if (this.distanceTraveled >= this.distanceToTarget) {
                    createParticles(this.tx, this.ty, this.color, this.isMain);
                    // 爆炸时播放音效 (合成版)
                    playExplosionSound(this.isMain);
                    
                    this.active = false;
                    // Return to pool
                    activeFireworks.splice(index, 1);
                    fireworkPool.push(this);
                    
                    if (this.isMain) {
                        setTimeout(showCaptionsAndBackgroundFireworks, 2000);
                    }
                } else {
                    this.x += vx;
                    this.y += vy;
                }
            }

            draw() {
                ctx.beginPath();
                ctx.moveTo(this.coordinates[this.coordinates.length - 1][0], this.coordinates[this.coordinates.length - 1][1]);
                ctx.lineTo(this.x, this.y);
                ctx.strokeStyle = this.color;
                ctx.lineWidth = this.isMain ? 2 : 1;
                ctx.stroke();
            }
        }

        class Particle {
            constructor() {
                this.coordinates = [];
            }

            init(x, y, color, isMain) {
                this.x = x;
                this.y = y;
                this.color = color;
                this.coordinates.length = 0;
                this.coordinateCount = isMain ? 5 : 3;
                for(let i=0; i<this.coordinateCount; i++) {
                    this.coordinates.push([this.x, this.y]);
                }
                
                this.angle = random(0, Math.PI * 2);
                this.speed = isMain ? random(1, 8) : random(1, 5);
                this.friction = 0.96;
                this.gravity = 0.04;
                this.alpha = 1;
                this.decay = isMain ? random(0.005, 0.01) : random(0.015, 0.025);
                this.active = true;
            }

            update(index) {
                this.coordinates.pop();
                this.coordinates.unshift([this.x, this.y]);
                this.speed *= this.friction;
                this.x += Math.cos(this.angle) * this.speed;
                this.y += Math.sin(this.angle) * this.speed + this.gravity;
                this.alpha -= this.decay;
                
                if (this.alpha <= this.decay) {
                    this.active = false;
                    activeParticles.splice(index, 1);
                    particlePool.push(this);
                }
            }

            draw() {
                ctx.beginPath();
                ctx.moveTo(this.coordinates[this.coordinates.length - 1][0], this.coordinates[this.coordinates.length - 1][1]);
                ctx.lineTo(this.x, this.y);
                ctx.strokeStyle = this.color.replace(')', `, ${this.alpha})`).replace('hsl', 'hsla');
                ctx.stroke();
            }
        }

        // Object Factory
        function createFirework(startX, tx, ty, color, isMain) {
            let fw = fireworkPool.pop();
            if (!fw) fw = new Firework();
            fw.init(startX, tx, ty, color, isMain);
            activeFireworks.push(fw);
        }

        function createParticles(x, y, color, isMain) {
            let count = isMain ? 150 : 60;
            if (IS_MOBILE) count = isMain ? 80 : 30;
            
            while(count--) {
                let p = particlePool.pop();
                if (!p) p = new Particle();
                p.init(x, y, color, isMain);
                activeParticles.push(p);
            }
        }

        // Animation Loop
        function loop() {
            requestAnimationFrame(loop);
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(0, 0, width, height);
            
            let i = activeFireworks.length;
            while(i--) {
                activeFireworks[i].draw();
                activeFireworks[i].update(i);
            }
            
            let j = activeParticles.length;
            while(j--) {
                activeParticles[j].draw();
                activeParticles[j].update(j);
            }
        }
        loop();

        // Sequence Logic
        // 1. Launch Main Firework
        setTimeout(() => {
            const startX = width / 2;
            const targetX = width / 2;
            const targetY = height * 0.3;
            createFirework(startX, targetX, targetY, colors[1], true);
        }, 500);

        // 2. Background Loop
        function showCaptionsAndBackgroundFireworks() {
            // Show Captions
            const lines = document.querySelectorAll('.ending-line');
            lines.forEach((line, index) => {
                setTimeout(() => {
                    line.style.animation = `slideUp 2s ease forwards`;
                }, index * 2000);
            });

            setTimeout(() => {
                document.querySelector('.restart-btn').style.opacity = 1;
            }, lines.length * 2000 + 1000);

            // Background Fireworks Loop
            setInterval(() => {
                if (Math.random() > 0.6) {
                    const startX = random(width * 0.1, width * 0.9);
                    const targetX = random(width * 0.1, width * 0.9);
                    let targetY;
                    if (targetX > width * 0.3 && targetX < width * 0.7) {
                        targetY = random(height * 0.1, height * 0.4);
                    } else {
                        targetY = random(height * 0.1, height * 0.7);
                    }
                    const color = colors[Math.floor(random(0, colors.length))];
                    createFirework(startX, targetX, targetY, color, false);
                }
            }, 1800);
        }
    }

    // --- Audio Helpers ---
    function fadeInAudio(audio, targetVolume) {
        const step = 0.05;
        const interval = 200;
        const fade = setInterval(() => {
            if (audio.volume < targetVolume - step) {
                audio.volume += step;
            } else {
                audio.volume = targetVolume;
                clearInterval(fade);
            }
        }, interval);
    }

    function fadeOutAudio(audio, callback) {
        const step = 0.05;
        const interval = 200;
        const fade = setInterval(() => {
            if (audio.volume > step) {
                audio.volume -= step;
            } else {
                audio.volume = 0;
                clearInterval(fade);
                if (callback) callback();
            }
        }, interval);
    }
});