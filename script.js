document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const enterBtn = document.getElementById('enter-btn');
    // JS 双重保险：强制显示按钮，防止 CSS 动画失效
    setTimeout(() => {
        if (getComputedStyle(enterBtn).opacity === '0') {
            enterBtn.style.opacity = '1';
        }
    }, 1000);

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

    // --- 1. Balanced Preloader (Standard Mode) ---
    // 策略：回退到标准的预加载逻辑。
    // "极低内存模式"虽然省内存，但会导致网络差时图片来不及加载而黑屏。
    // 我们改回：预加载关键资源 -> 进入 -> 后台加载剩余资源。这是最成熟的方案。
    
    let loadedCount = 0;
    let isEnterEnabled = false;
    const assetsToLoad = [];
    const CRITICAL_COUNT = 3; 

    // 1. 收集资源
    slides.forEach((slide, index) => {
        const src = slide.getAttribute('data-src') || slide.src;
        if (!src) return;

        assetsToLoad.push({
            element: slide,
            src: src,
            type: slide.tagName,
            index: index,
            isCritical: index < CRITICAL_COUNT
        });
    });

    const criticalTotal = Math.min(assetsToLoad.length, CRITICAL_COUNT) + 1;

    // 更新加载进度
    function updateProgress(isCriticalAsset) {
        if (isEnterEnabled) return; 

        if (isCriticalAsset) {
            loadedCount++;
            const percent = Math.floor((loadedCount / criticalTotal) * 100);
            btnText.textContent = `记忆恢复中... ${Math.min(percent, 99)}%`;
            
            if (loadedCount >= criticalTotal) {
                enableEnterButton();
                // 关键资源好了，立马开始加载剩下的！
                loadRemainingAssets();
            }
        }
    }

    function enableEnterButton() {
        if (isEnterEnabled) return;
        isEnterEnabled = true;
        btnText.textContent = '开启回忆录';
        enterBtn.style.opacity = '1';
        enterBtn.style.pointerEvents = 'auto';
        enterBtn.classList.add('ready-pulse');
        console.log('Critical assets loaded. Ready to start.');
    }

    // 2. 加载音频
    bgm.load();
    if (bgm.readyState >= 4) {
        updateProgress(true);
    } else {
        bgm.oncanplaythrough = () => {
            if (!bgm.dataset.loaded) {
                bgm.dataset.loaded = "true";
                updateProgress(true);
            }
        };
        bgm.onerror = () => {
            if (!bgm.dataset.loaded) {
                bgm.dataset.loaded = "true";
                console.warn('Audio load failed, skipping.');
                updateProgress(true); 
            }
        };
    }

    // 3. 加载关键资源
    assetsToLoad.forEach(asset => {
        if (asset.isCritical) {
            loadSingleAsset(asset, true);
        }
    });
    
    // 4. 加载剩余资源 (关键修复：恢复后台加载)
    function loadRemainingAssets() {
        console.log('Loading remaining assets in background...');
        assetsToLoad.forEach(asset => {
            if (!asset.isCritical) {
                // 错峰加载，避免卡顿
                setTimeout(() => {
                    loadSingleAsset(asset, false);
                }, 100 * (asset.index - CRITICAL_COUNT));
            }
        });
    }

    // 通用加载函数
    function loadSingleAsset(asset, isCritical) {
        if (asset.element.dataset.loaded) return; 

        if (asset.type === 'IMG') {
            const img = new Image();
            
            const handleImageLoad = () => {
                asset.element.src = asset.src;
                asset.element.removeAttribute('data-src');
                asset.element.dataset.loaded = "true";
                // 移除 display hack，直接显示
                if (isCritical) updateProgress(true);
            };

            img.onload = handleImageLoad;
            
            img.onerror = () => {
                console.warn(`Image load failed: ${asset.src}`);
                if (isCritical) updateProgress(true);
            };
            img.src = asset.src;
        } else if (asset.type === 'VIDEO') {
            asset.element.src = asset.src;
            asset.element.removeAttribute('data-src');
            // 恢复预加载
            asset.element.preload = isCritical ? 'auto' : 'metadata'; 
            
            const onVideoLoaded = () => {
                if (!asset.element.dataset.loaded) {
                    asset.element.dataset.loaded = "true";
                    if (isCritical) updateProgress(true);
                }
            };
            
            asset.element.onloadeddata = onVideoLoaded;
            asset.element.oncanplay = onVideoLoaded;
            asset.element.onerror = () => {
                if (!asset.element.dataset.loaded) {
                    asset.element.dataset.loaded = "true";
                    if (isCritical) updateProgress(true);
                }
            };
            
            if (isCritical) asset.element.load();
        }
    }

    // 容错机制：5秒后如果还没好，显示“重试”按钮 (Safe Mode)
    setTimeout(() => {
        if (!isEnterEnabled) {
            console.warn('Loading slow. Enabling Safe Mode.');
            btnText.textContent = '点我开启 (安全模式)';
            enterBtn.style.opacity = '1';
            enterBtn.style.pointerEvents = 'auto';
            enterBtn.classList.add('ready-pulse');
            isEnterEnabled = true;
            
            // 安全模式下，点击直接开始，不等待后续资源
            enterBtn.onclick = () => {
                welcomeScreen.style.display = 'none';
                slideshowContainer.classList.add('visible');
                // 强制显示第一张
                slides[0].classList.add('active');
                slides[0].style.opacity = 1;
                startSlideshow();
                bgm.play().catch(() => {});
            };
        }
    }, 5000);


    // --- 2. Interaction & Slideshow ---
    enterBtn.addEventListener('click', () => {
        // Play Audio (Strong Force)
        // 核心修复：直接在点击事件回调中调用 play，这是浏览器最信任的时刻
        bgm.muted = false; // 确保不静音
        bgm.volume = 0;
        
        const playPromise = bgm.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                fadeInAudio(bgm, 0.3);
            }).catch(error => {
                console.warn('Initial BGM play failed, waiting for user interaction:', error);
                // 如果失败，添加全局一次性点击救场
                addGlobalAudioUnlock();
            });
        }

        // Transition
        welcomeScreen.classList.add('hidden');
        setTimeout(() => {
            welcomeScreen.style.display = 'none';
            slideshowContainer.classList.add('visible');
            startSlideshow();
        }, 1500);
    });

    // 全局音频解锁（救场机制）
    function addGlobalAudioUnlock() {
        const unlock = () => {
            if (bgm.paused) {
                bgm.play().then(() => {
                    fadeInAudio(bgm, 0.3);
                    // 成功播放后移除监听
                    document.removeEventListener('click', unlock);
                    document.removeEventListener('touchstart', unlock);
                }).catch(console.error);
            }
        };
        document.addEventListener('click', unlock);
        document.addEventListener('touchstart', unlock);
    }

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

        // 视频预热：如果下一张是视频，提前触发 load
        // 这里的逻辑是：如果是倒数第二张（index === slides.length - 2），且最后一张是视频
        if (index === slides.length - 2) {
            const nextSlide = slides[index + 1];
            if (nextSlide.tagName === 'VIDEO') {
                // 此时用户已经有过交互（点击），所以 load/play 权限通常是有的
                nextSlide.load(); 
                // 甚至可以尝试静音播放一帧然后暂停，确保解码器就绪
                // nextSlide.play().then(() => nextSlide.pause()).catch(() => {});
            }
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
        // 尝试开启声音
        video.muted = false;
        
        // 强制隐藏控件
        video.removeAttribute('controls');
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('x5-playsinline', '');
        
        // 健壮的播放逻辑
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn('Auto-play was prevented. Falling back to muted play.', error);
                video.muted = true;
                video.play().catch(e => console.error('Even muted play failed:', e));
            });
        }
        
        // 双重保险检测结束
        let isEnded = false;
        const triggerEnd = () => {
            if (isEnded) return;
            isEnded = true;
            console.log('Video ended. Triggering slideshow end.');
            endSlideshow();
        };

        video.onended = triggerEnd;
        
        // 兜底机制 1：timeupdate
        video.ontimeupdate = () => {
            if (video.duration && !isNaN(video.duration) && video.duration > 1) {
                if (video.currentTime >= video.duration - 0.5) {
                    triggerEnd();
                }
            }
        };

        // 兜底机制 2：绝对定时器 (终极保险)
        // 如果能获取到时长，设置一个定时器强制结束
        if (video.duration && !isNaN(video.duration) && video.duration !== Infinity) {
            const timeoutMs = (video.duration * 1000) + 1000; // 视频时长 + 1秒冗余
            console.log(`Setting safety timeout: ${timeoutMs}ms`);
            setTimeout(triggerEnd, timeoutMs);
        } else {
            // 如果一开始没获取到，等 metadata 加载完了再设
            video.onloadedmetadata = () => {
                if (video.duration && !isNaN(video.duration) && video.duration !== Infinity) {
                    const timeoutMs = (video.duration * 1000) + 1000;
                    console.log(`Setting safety timeout (delayed): ${timeoutMs}ms`);
                    setTimeout(triggerEnd, timeoutMs);
                }
            };
        }
    }

    function endSlideshow() {
        // 1. 停止并销毁视频 (核心修复：彻底杀死原生播放器)
        slides.forEach(slide => {
            if (slide.tagName === 'VIDEO') {
                try {
                    slide.pause();
                    slide.src = ""; // 清空源
                    slide.load();   // 重置
                    slide.remove(); // 直接从 DOM 移除
                } catch(e) {
                    console.error('Error destroying video:', e);
                }
            }
        });

        // 2. 音频处理
        bgm.pause();
        bgm.currentTime = 0; 
        bgm.volume = 0;
        bgm.play().then(() => fadeInAudio(bgm, 0.5)).catch(console.error);
        
        // 3. 界面切换 (立即隐藏，不要等待动画)
        // 这里的优先级最高，防止被卡住
        slideshowContainer.style.display = 'none'; 
        slideshowContainer.style.opacity = 0;
        slideshowContainer.style.pointerEvents = 'none';

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
            // 极限优化：根据设备性能动态调整粒子数量
            // 电脑：主烟花150，小烟花60
            // 手机：主烟花60，小烟花20 (大幅减少以防卡顿)
            let count = isMain ? 150 : 60;
            if (IS_MOBILE) count = isMain ? 60 : 20;
            
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