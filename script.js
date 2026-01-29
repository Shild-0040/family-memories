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
        
        // 音乐淡出
        if (!bgm.paused) {
            fadeOutAudio(bgm, () => bgm.pause());
        }
        
        // 显示结尾页
        slideshowContainer.style.opacity = 0;
        endingScreen.classList.add('visible');
        
        // 启动烟花特效
        startFireworks();
        // 字幕显示逻辑由 startFireworks 内部控制
    }

    // 5. 烟花特效系统 (唯美慢动作版)
    function startFireworks() {
        const canvas = document.getElementById('fireworks');
        const ctx = canvas.getContext('2d');
        let width, height;
        let fireworks = []; // 升空的烟花弹
        let particles = []; // 爆炸的火花
        
        // 高级配色方案 (单色纯色)
        const colors = [
            'hsl(330, 80%, 75%)', // 柔粉
            'hsl(45, 90%, 65%)',  // 鎏金
            'hsl(190, 80%, 70%)', // 冰蓝
            'hsl(260, 60%, 75%)', // 浅紫
            'hsl(30, 90%, 70%)',  // 暖橙
            'hsl(140, 60%, 70%)'  // 清绿
        ];

        function resize() {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resize);
        resize();

        function random(min, max) {
            return Math.random() * (max - min) + min;
        }

        // 烟花弹类
        class Firework {
            constructor(startX, tx, ty, color, isMain = false) {
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
                
                this.coordinates = [];
                this.coordinateCount = 3;
                while(this.coordinateCount--) {
                    this.coordinates.push([this.x, this.y]);
                }
                
                this.angle = Math.atan2(ty - height, tx - startX);
                // 速度调整：主烟花更慢更优雅
                this.speed = isMain ? 2.5 : random(2, 4); 
                this.acceleration = 1.02; // 极轻微加速，接近匀速
                this.brightness = random(50, 70);
            }

            update(index) {
                this.coordinates.pop();
                this.coordinates.unshift([this.x, this.y]);
                
                this.speed *= this.acceleration;
                
                const vx = Math.cos(this.angle) * this.speed;
                const vy = Math.sin(this.angle) * this.speed;
                
                this.distanceTraveled = Math.sqrt(Math.pow(this.sx - this.x - vx, 2) + Math.pow(this.sy - this.y - vy, 2));
                
                if(this.distanceTraveled >= this.distanceToTarget) {
                    // 到达目标，引爆
                    createParticles(this.tx, this.ty, this.color, this.isMain);
                    fireworks.splice(index, 1);
                    
                    // 如果是主烟花爆炸，触发后续流程
                    if (this.isMain) {
                        setTimeout(showCaptionsAndBackgroundFireworks, 2000); // 等待粒子散去再出字幕
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
                ctx.lineWidth = this.isMain ? 2 : 1.5;
                ctx.stroke();
            }
        }

        // 粒子类
        class Particle {
            constructor(x, y, color, isMain) {
                this.x = x;
                this.y = y;
                this.color = color;
                this.coordinates = [];
                this.coordinateCount = 6;
                while(this.coordinateCount--) {
                    this.coordinates.push([this.x, this.y]);
                }
                
                this.angle = random(0, Math.PI * 2);
                // 爆炸速度：主烟花大而缓，背景烟花小而精致
                this.speed = isMain ? random(1, 8) : random(1, 5);
                
                this.friction = 0.96; // 摩擦力大一点，减速更明显
                this.gravity = 0.04;  // 重力很小，营造悬浮感
                
                this.alpha = 1;
                // 消失极慢
                this.decay = isMain ? random(0.005, 0.01) : random(0.01, 0.02);
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
                // 使用传入的颜色，不混色
                ctx.strokeStyle = this.color.replace(')', `, ${this.alpha})`).replace('hsl', 'hsla');
                ctx.stroke();
            }
        }

        function createParticles(x, y, color, isMain) {
            let particleCount = isMain ? 180 : 80;
            while(particleCount--) {
                particles.push(new Particle(x, y, color, isMain));
            }
        }

        // 循环渲染
        function loop() {
            requestAnimationFrame(loop);
            
            // 极淡的拖尾，让画面更干净
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; 
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

        // 流程控制 1：发射主烟花
        // 延迟 500ms 启动，确保转场完成
        setTimeout(() => {
            const startX = width / 2;
            const targetX = width / 2;
            const targetY = height * 0.3; // 屏幕中上部
            // 主烟花使用鎏金色
            fireworks.push(new Firework(startX, targetX, targetY, colors[1], true));
        }, 500);

        // 流程控制 2：显示字幕 + 启动背景烟花
        function showCaptionsAndBackgroundFireworks() {
            // 1. 显示字幕
            const lines = document.querySelectorAll('.ending-line');
            lines.forEach((line, index) => {
                setTimeout(() => {
                    line.style.animation = `slideUp 2s ease forwards`; // 更慢的浮现
                }, index * 2000); 
            });

            // 显示按钮
            setTimeout(() => {
                document.querySelector('.restart-btn').style.opacity = 1;
            }, lines.length * 2000 + 1000);

            // 2. 启动背景烟花 (随机、舒缓)
            setInterval(() => {
                if (Math.random() > 0.6) { // 低频
                    const startX = random(width * 0.1, width * 0.9);
                    const targetX = random(width * 0.1, width * 0.9);
                    // 避开字幕区域 (中间偏下)，尽量在两边或上方
                    let targetY;
                    if (targetX > width * 0.3 && targetX < width * 0.7) {
                        targetY = random(height * 0.1, height * 0.4); // 中间就飞高点
                    } else {
                        targetY = random(height * 0.1, height * 0.7); // 两边随意
                    }
                    
                    const color = colors[Math.floor(Math.random() * colors.length)];
                    fireworks.push(new Firework(startX, targetX, targetY, color, false));
                }
            }, 1800);
        }
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