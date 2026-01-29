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
    const SLIDE_DURATION = 3000;
    const IS_MOBILE = window.innerWidth < 768;
    const PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, 2);

    // --- State ---
    let currentIndex = 0;
    let slideInterval;

    // --- 1. Extreme Preloader (Full Asset Loading - Strict Mode) ---
    // 策略：全量预加载。必须等待所有图片、视频、音频全部就绪才解锁。
    // 用户明确要求：宁愿等久一点，也要保证播放流畅。
    
    let loadedCount = 0;
    let isEnterEnabled = false;
    const assetsToLoad = [];

    // 1. 收集所有资源
    slides.forEach((slide, index) => {
        const src = slide.getAttribute('data-src') || slide.src;
        if (!src) return;

        assetsToLoad.push({
            element: slide,
            src: src,
            type: slide.tagName,
            index: index
        });
    });

    // 总资源数 = 所有视觉资源 + 背景音乐
    const totalAssets = assetsToLoad.length + 1; 

    // 更新加载进度
    function updateProgress() {
        loadedCount++;
        const percent = Math.floor((loadedCount / totalAssets) * 100);
        
        if (!isEnterEnabled) {
            btnText.textContent = `记忆恢复中... ${Math.min(percent, 99)}%`;
        }
        
        if (loadedCount >= totalAssets) {
            enableEnterButton();
        }
    }

    function enableEnterButton() {
        if (isEnterEnabled) return;
        isEnterEnabled = true;
        btnText.textContent = '开启回忆录';
        enterBtn.style.opacity = '1';
        enterBtn.style.pointerEvents = 'auto';
        enterBtn.classList.add('ready-pulse');
        console.log('All assets loaded. Ready to start.');
    }

    // 2. 加载音频
    bgm.load();
    // 兼容处理：有些浏览器 cached 状态下可能不触发 canplaythrough
    if (bgm.readyState >= 4) {
        updateProgress();
    } else {
        bgm.oncanplaythrough = () => {
            if (!bgm.dataset.loaded) {
                bgm.dataset.loaded = "true";
                updateProgress();
            }
        };
        bgm.onerror = () => {
            if (!bgm.dataset.loaded) {
                bgm.dataset.loaded = "true";
                console.warn('Audio load failed, skipping.');
                updateProgress(); 
            }
        };
    }

    // 3. 加载视觉资源 (并行加载)
    assetsToLoad.forEach(asset => {
        if (asset.type === 'IMG') {
            const img = new Image();
            
            const handleImageLoad = () => {
                asset.element.src = asset.src;
                asset.element.removeAttribute('data-src');
                updateProgress();
            };

            img.onload = () => {
                // 尝试解码，防止图片虽然加载但渲染黑屏
                if ('decode' in img) {
                    img.decode().then(handleImageLoad).catch((err) => {
                        console.warn('Image decode error, falling back:', err);
                        handleImageLoad();
                    });
                } else {
                    handleImageLoad();
                }
            };
            
            img.onerror = () => {
                console.warn(`Image load failed: ${asset.src}`);
                // 失败时使用占位或者直接算作完成，避免死锁
                updateProgress(); 
            };
            img.src = asset.src;
        } else if (asset.type === 'VIDEO') {
            asset.element.src = asset.src;
            asset.element.removeAttribute('data-src');
            asset.element.preload = 'auto'; // 强制预加载视频数据
            asset.element.load();
            
            // 视频只要加载了足够当前播放的数据就算成功
            const onVideoLoaded = () => {
                if (!asset.element.dataset.loaded) {
                    asset.element.dataset.loaded = "true";
                    updateProgress();
                }
            };
            
            // 兼容多种事件，确保能捕获完成状态
            asset.element.onloadeddata = onVideoLoaded;
            asset.element.oncanplay = onVideoLoaded;
            asset.element.onerror = () => {
                if (!asset.element.dataset.loaded) {
                    asset.element.dataset.loaded = "true";
                    console.warn(`Video load failed: ${asset.src}`);
                    updateProgress();
                }
            };
        }
    });

    // 容错机制：20秒超时
    // 如果网络实在太差，20秒后强制允许进入，防止用户流失
    setTimeout(() => {
        if (!isEnterEnabled) {
            console.warn('Loading timeout (20s). Forcing enable.');
            // 强制设为完成
            loadedCount = totalAssets;
            enableEnterButton();
        }
    }, 20000);


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
        resetTimer();
    }

    // 重置/启动定时器
    function resetTimer() {
        if (slideInterval) clearInterval(slideInterval);
        slideInterval = setInterval(nextSlide, SLIDE_DURATION);
    }

    // 手动切换逻辑：点击屏幕切换下一张
    slideshowContainer.addEventListener('click', handleUserSwitch);
    slideshowContainer.addEventListener('touchend', (e) => {
        handleUserSwitch(e);
    });

    function handleUserSwitch(e) {
        // 如果正在播放视频，不要切换
        const currentSlide = slides[currentIndex];
        if (currentSlide.tagName === 'VIDEO' && !currentSlide.ended) {
            return; 
        }
        
        // 排除按钮点击
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
        
        // 手动切换时，重置自动播放定时器（重新计时）
        resetTimer();
        nextSlide();
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
        clearInterval(slideInterval); // 视频播放时暂停自动轮播
        fadeOutAudio(bgm, () => bgm.pause());
        
        video.currentTime = 0;
        video.muted = false;
        // 强制隐藏控件
        video.removeAttribute('controls');
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        
        video.play().catch(console.error);
        
        // 双重保险检测结束
        let isEnded = false;
        const triggerEnd = () => {
            if (isEnded) return;
            isEnded = true;
            endSlideshow();
        };

        video.onended = triggerEnd;
        
        // 兜底机制：有些浏览器 onended 不准，用 timeupdate 辅助
        video.ontimeupdate = () => {
            // 关键修复：确保 duration 是有效数字，且视频确实播放了一段时间 (比如 > 1秒)
            // 防止刚开始加载时 duration 可能为 NaN 或很小，导致误判
            if (video.duration && !isNaN(video.duration) && video.duration > 1) {
                // 只有当播放进度真的接近尾声时才触发
                if (video.currentTime >= video.duration - 0.5) {
                    triggerEnd();
                }
            }
        };
    }

    function endSlideshow() {
        // clearInterval(slideInterval);
        if (!bgm.paused) fadeOutAudio(bgm, () => bgm.pause());
        
        slideshowContainer.style.opacity = 0;
        slideshowContainer.style.pointerEvents = 'none'; // 禁用点击，防止触发切换
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
                    // 双重保险：动画结束后强制设置状态，防止部分浏览器动画失效
                    setTimeout(() => {
                        line.style.opacity = '1';
                        line.style.transform = 'translateY(0)';
                    }, 2100);
                }, index * 2000);
            });

            setTimeout(() => {
                document.querySelector('.restart-btn').style.opacity = 1;
            }, lines.length * 2000 + 1000);

            // 2. 启动背景烟花 (随机、舒缓)
            setInterval(() => {
                if (Math.random() > 0.5) { // 提高生成概率 (原 0.6)
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
            }, 1200); // 频率提高50% (原 1800ms -> 1200ms)
        }
        // 3. 交互式烟花 (点击哪里炸哪里)
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            // 计算点击位置相对于 Canvas 的坐标，并考虑缩放
            const x = (e.clientX - rect.left);
            const y = (e.clientY - rect.top);
            
            // 从底部随机位置发射，飞向点击点
            const startX = random(width * 0.2, width * 0.8);
            const color = colors[Math.floor(random(0, colors.length))];
            
            // 交互产生的烟花，稍微大一点，颜色随机
            createFirework(startX, x, y, color, false);
        });

        // 手机端触摸支持 (修复：确保 Canvas 能接收到触摸事件，并添加节流优化)
        let isTouching = false;
        canvas.addEventListener('touchstart', (e) => {
            if (e.cancelable) {
               e.preventDefault(); 
            }
            
            if (isTouching) return;
            isTouching = true;
            
            requestAnimationFrame(() => {
                const rect = canvas.getBoundingClientRect();
                // 支持多点触控，每个手指都能触发
                for (let i = 0; i < e.touches.length; i++) {
                    const touch = e.touches[i];
                    const x = (touch.clientX - rect.left);
                    const y = (touch.clientY - rect.top);
                    
                    const startX = random(width * 0.2, width * 0.8);
                    const color = colors[Math.floor(random(0, colors.length))];
                    createFirework(startX, x, y, color, false);
                }
                isTouching = false;
            });
        }, { passive: false }); // 关键：设置为非被动监听器，允许 preventDefault
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