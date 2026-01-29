document.addEventListener('DOMContentLoaded', () => {
    const enterBtn = document.getElementById('enter-btn');
    const welcomeScreen = document.getElementById('welcome-screen');
    const slideshowContainer = document.getElementById('slideshow-container');
    const slideBlurBg = document.getElementById('slide-blur-bg');
    const slides = document.querySelectorAll('.slide-item');
    const bgm = document.getElementById('bgm');
    const progressBar = document.querySelector('.progress-fill');
    const endingScreen = document.getElementById('ending-screen');
    
    let currentIndex = 0;
    let slideInterval;
    const SLIDE_DURATION = 5000; // 每张图片停留5秒

    // 智能预加载函数
    function preloadNextImage(index) {
        // 预加载下两张
        for (let i = 1; i <= 2; i++) {
            const nextIndex = (index + i) % slides.length;
            const nextSlide = slides[nextIndex];
            
            if (nextSlide.tagName === 'IMG' && nextSlide.hasAttribute('data-src')) {
                nextSlide.src = nextSlide.getAttribute('data-src');
                nextSlide.removeAttribute('data-src');
            } else if (nextSlide.tagName === 'VIDEO' && nextSlide.hasAttribute('data-src')) {
                // 视频在接近时才加载
                if (i === 1) { 
                    nextSlide.src = nextSlide.getAttribute('data-src');
                    nextSlide.removeAttribute('data-src');
                    nextSlide.load();
                }
            }
        }
    }

    // 1. 资源预加载逻辑
    const PRELOAD_COUNT = 5; // 增加预加载数量到5张，提升流畅度
    let loadedCount = 0;
    
    // 初始状态：禁用按钮
    enterBtn.style.opacity = '0.5';
    enterBtn.style.pointerEvents = 'none';
    const btnText = enterBtn.querySelector('.btn-text');
    btnText.textContent = '资源加载中...';

    // 预加载音频
    bgm.load();
    bgm.oncanplaythrough = checkLoadProgress;
    bgm.onerror = checkLoadProgress; // 即使失败也算完成

    // 容错机制：设置一个 8 秒的超时定时器
    // 如果网络太慢导致资源一直在加载，8秒后强制显示开启按钮，不让用户干等
    setTimeout(() => {
        if (loadedCount < TOTAL_RESOURCES) {
            console.log('Loading timed out, forcing start.');
            // 强制设置为完成状态
            loadedCount = TOTAL_RESOURCES;
            checkLoadProgress();
        }
    }, 8000);

    // 获取前几张图片/视频
    const initialResources = Array.from(slides).slice(0, PRELOAD_COUNT);
    
    // 总共需要加载的资源数 = 图片数 + 音频
    const TOTAL_RESOURCES = initialResources.length + 1;

    initialResources.forEach(slide => {
        const src = slide.getAttribute('src') || slide.getAttribute('data-src');
        if (!src) {
            checkLoadProgress();
            return;
        }

        if (slide.tagName === 'IMG') {
            const img = new Image();
            img.src = src;
            img.onload = checkLoadProgress;
            img.onerror = checkLoadProgress; // 即使失败也继续，避免卡死
        } else if (slide.tagName === 'VIDEO') {
            const video = document.createElement('video');
            video.src = src;
            video.preload = 'metadata'; // 仅加载元数据，避免卡顿
            video.onloadedmetadata = checkLoadProgress;
            video.onerror = checkLoadProgress;
        }
    });

    function checkLoadProgress() {
        loadedCount++;
        const percent = Math.floor((loadedCount / TOTAL_RESOURCES) * 100);
        btnText.textContent = `资源加载中... ${Math.min(percent, 99)}%`; // 避免直接跳到100

        if (loadedCount >= TOTAL_RESOURCES) {
            // 加载完成
            btnText.textContent = '开启回忆录';
            enterBtn.style.opacity = '1';
            enterBtn.style.pointerEvents = 'auto';
            enterBtn.classList.add('ready-pulse'); // 添加呼吸效果提示可点击
        }
    }

    // 2. 开始按钮点击事件
    enterBtn.addEventListener('click', () => {
        // 立即开始预加载前几张
        preloadNextImage(0);

        // 淡入音乐
        bgm.volume = 0;
        bgm.play().then(() => {
            fadeInAudio(bgm, 0.3); // 目标音量降低至 0.3 (30%)
        }).catch(e => console.log(e));

        // 隐藏欢迎页
        welcomeScreen.classList.add('hidden');
        
        // 显示幻灯片容器
        setTimeout(() => {
            welcomeScreen.style.display = 'none';
            slideshowContainer.classList.add('visible');
            startSlideshow();
        }, 1500);
    });

    // 2. 幻灯片核心逻辑
    function startSlideshow() {
        // 初始化第一张
        showSlide(0);

        // 设置定时器
        slideInterval = setInterval(nextSlide, SLIDE_DURATION);
    }



    function showSlide(index) {
        // 预加载后续图片
        preloadNextImage(index);

        // 移除所有激活状态
        slides.forEach(slide => slide.classList.remove('active'));
        
        // 激活当前张
        const currentSlide = slides[index];
        
        // 确保当前图片已加载 (如果还没被预加载)
        if (currentSlide.tagName === 'IMG' && currentSlide.hasAttribute('data-src')) {
            currentSlide.src = currentSlide.getAttribute('data-src');
            currentSlide.removeAttribute('data-src');
        }

        currentSlide.classList.add('active');

        // 更新模糊背景 (同步显示当前图片/视频的截图)
        if (currentSlide.tagName === 'IMG') {
            slideBlurBg.style.backgroundImage = `url(${currentSlide.src})`;
        } else if (currentSlide.tagName === 'VIDEO') {
            // 视频的话，尝试用第一帧或者保持上一张图
            // 简单起见，可以保持不动，或者如果有封面图可以使用封面
        }

        // 更新进度条
        const progress = ((index + 1) / slides.length) * 100;
        progressBar.style.width = `${progress}%`;

        // 特殊处理：如果是视频
        if (currentSlide.tagName === 'VIDEO') {
            handleVideoSlide(currentSlide);
        }
    }

    function nextSlide() {
        currentIndex++;
        
        // 检查是否结束
        if (currentIndex >= slides.length) {
            endSlideshow();
            return;
        }

        showSlide(currentIndex);
    }

    // 3. 视频播放处理
    function handleVideoSlide(video) {
        clearInterval(slideInterval); // 暂停自动轮播
        
        // 确保视频源已加载
        if (video.hasAttribute('data-src')) {
            video.src = video.getAttribute('data-src');
            video.removeAttribute('data-src');
        }

        // 音乐淡出
        fadeOutAudio(bgm, () => {
            bgm.pause();
        });

        // 播放视频
        video.currentTime = 0;
        video.muted = false; // 开启视频声音
        video.play().catch(e => console.log("Video play failed:", e));

        // 视频结束后
        video.onended = () => {
            // 视频是最后一个，直接结束
            endSlideshow(); 
        };
    }

    // 4. 结束逻辑
    function endSlideshow() {
        clearInterval(slideInterval);
        
        // 如果最后不是视频（或者有其他情况），确保音乐淡出
        if (!bgm.paused) {
            fadeOutAudio(bgm, () => bgm.pause());
        }
        
        // 显示结尾页
        slideshowContainer.style.opacity = 0;
        endingScreen.classList.add('visible');
        
        // 启动烟花特效
        startFireworks();

        // 延迟显示文字，等待大烟花绽放
        setTimeout(() => {
            // 逐行显示寄语
            const lines = document.querySelectorAll('.ending-line');
            lines.forEach((line, index) => {
                setTimeout(() => {
                    line.style.animation = `slideUp 1.5s ease forwards`;
                }, index * 1500); // 每句间隔1.5秒
            });

            // 显示重温按钮
            setTimeout(() => {
                document.querySelector('.restart-btn').style.opacity = 1;
            }, lines.length * 1500 + 1000);
        }, 3000); // 延迟3秒，让大烟花先放一会儿
    }

    // 5. 烟花特效系统 (终极金色流星版)
    function startFireworks() {
        const canvas = document.getElementById('fireworks');
        const ctx = canvas.getContext('2d');
        let width, height;
        let fireworks = []; // 升空的烟花弹
        let particles = []; // 爆炸的火花

        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resize);
        resize();

        // 随机数辅助
        function random(min, max) {
            return Math.random() * (max - min) + min;
        }

        // 烟花弹类 (负责升空)
        class Firework {
            constructor(tx, ty, isBig = false) {
                this.x = width / 2; // 默认发射点：底部中心
                
                // 如果是小烟花，发射点随机一点
                if (!isBig) {
                    this.x = random(width * 0.1, width * 0.9);
                }
                
                this.y = height; // 从屏幕底部发出
                this.sx = this.x;
                this.sy = height;
                this.tx = tx; // 目标位置 x
                this.ty = ty; // 目标位置 y
                
                this.distanceToTarget = Math.sqrt(Math.pow(tx - this.x, 2) + Math.pow(ty - this.y, 2));
                this.distanceTraveled = 0;
                
                // 轨迹坐标集合 (用于画拖尾)
                this.coordinates = [];
                this.coordinateCount = 3;
                while(this.coordinateCount--) {
                    this.coordinates.push([this.x, this.y]);
                }
                
                this.angle = Math.atan2(ty - height, tx - this.x);
                this.speed = 2; // 初始速度
                this.acceleration = 1.05; // 加速度
                this.brightness = random(50, 80);
                this.isBig = isBig;
            }

            update(index) {
                this.coordinates.pop();
                this.coordinates.unshift([this.x, this.y]);
                
                // 模拟加速升空
                this.speed *= this.acceleration;
                
                const vx = Math.cos(this.angle) * this.speed;
                const vy = Math.sin(this.angle) * this.speed;
                
                this.distanceTraveled = Math.sqrt(Math.pow(this.sx - this.x - vx, 2) + Math.pow(this.sy - this.y - vy, 2));
                
                // 到达目标点，引爆
                if(this.distanceTraveled >= this.distanceToTarget) {
                    createParticles(this.tx, this.ty, this.isBig);
                    fireworks.splice(index, 1);
                } else {
                    this.x += vx;
                    this.y += vy;
                }
            }

            draw() {
                ctx.beginPath();
                // 画出流星拖尾
                ctx.moveTo(this.coordinates[this.coordinates.length - 1][0], this.coordinates[this.coordinates.length - 1][1]);
                ctx.lineTo(this.x, this.y);
                ctx.strokeStyle = 'hsl(45, 100%, ' + this.brightness + '%)'; // 金色
                ctx.lineWidth = this.isBig ? 2 : 1;
                ctx.stroke();
            }
        }

        // 爆炸粒子类
        class Particle {
            constructor(x, y, isBig) {
                this.x = x;
                this.y = y;
                this.coordinates = [];
                this.coordinateCount = 5;
                while(this.coordinateCount--) {
                    this.coordinates.push([this.x, this.y]);
                }
                
                // 随机爆炸方向
                this.angle = random(0, Math.PI * 2);
                this.speed = random(1, 10);
                
                this.friction = 0.95; // 摩擦力
                this.gravity = 1; // 重力
                
                // 金色系配色 (40-50是金色/橙色区间)
                this.hue = random(40, 50); 
                this.brightness = random(50, 80);
                this.alpha = 1;
                this.decay = random(0.015, 0.03); // 消失速度
                
                if (isBig) {
                    this.speed = random(5, 15); // 大烟花炸得更开
                    this.decay = random(0.01, 0.02); // 消失得更慢
                }
            }

            update(index) {
                this.coordinates.pop();
                this.coordinates.unshift([this.x, this.y]);
                
                this.speed *= this.friction;
                this.x += Math.cos(this.angle) * this.speed;
                this.y += Math.sin(this.angle) * this.speed + this.gravity;
                
                this.alpha -= this.decay;
                
                if(this.alpha <= this.decay) {
                    particles.splice(index, 1);
                }
            }

            draw() {
                ctx.beginPath();
                ctx.moveTo(this.coordinates[this.coordinates.length - 1][0], this.coordinates[this.coordinates.length - 1][1]);
                ctx.lineTo(this.x, this.y);
                // 金色光效
                ctx.strokeStyle = 'hsla(' + this.hue + ', 100%, ' + this.brightness + '%, ' + this.alpha + ')';
                ctx.stroke();
            }
        }

        function createParticles(x, y, isBig) {
            let particleCount = isBig ? 150 : 50; // 粒子数量
            while(particleCount--) {
                particles.push(new Particle(x, y, isBig));
            }
        }

        // 主循环
        function loop() {
            requestAnimationFrame(loop);
            
            // 制造拖尾效果 (用半透明黑色覆盖)
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, width, height);
            ctx.globalCompositeOperation = 'lighter';
            
            let i = fireworks.length;
            while(i--) {
                fireworks[i].draw();
                fireworks[i].update(i);
            }
            
            let j = particles.length;
            while(j--) {
                particles[j].draw();
                particles[j].update(j);
            }
        }

        loop();

        // 逻辑：阶段一 - 盛大开场 (5个大烟花)
        let bigFireworksCount = 0;
        const bigInterval = setInterval(() => {
            // 目标：屏幕中心区域
            const targetX = width / 2 + random(-100, 100);
            const targetY = height * 0.3 + random(-50, 50);
            fireworks.push(new Firework(targetX, targetY, true));
            
            bigFireworksCount++;
            if (bigFireworksCount >= 5) clearInterval(bigInterval);
        }, 1200); // 发射间隔

        // 逻辑：阶段二 - 零散背景 (稀疏)
        setInterval(() => {
            // 降低频率，只要一点点氛围
            if (Math.random() > 0.7) { 
                const targetX = random(width * 0.1, width * 0.9);
                const targetY = random(height * 0.1, height * 0.6);
                fireworks.push(new Firework(targetX, targetY, false));
            }
        }, 1500);
    }

    // 辅助：音乐淡入
    function fadeInAudio(audio, targetVolume) {
        const step = 0.05;
        const interval = 200; // 每200ms增加音量
        
        const fade = setInterval(() => {
            if (audio.volume < targetVolume - step) {
                audio.volume += step;
            } else {
                audio.volume = targetVolume;
                clearInterval(fade);
            }
        }, interval);
    }

    // 辅助：音乐淡出
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