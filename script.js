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
    const PRELOAD_COUNT = 3; // 预加载前3张，确保开场流畅
    let loadedCount = 0;
    
    // 初始状态：禁用按钮
    enterBtn.style.opacity = '0.5';
    enterBtn.style.pointerEvents = 'none';
    const btnText = enterBtn.querySelector('.btn-text');
    btnText.textContent = '资源加载中...';

    // 获取前几张图片/视频
    const initialResources = Array.from(slides).slice(0, PRELOAD_COUNT);
    
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
            video.onloadedmetadata = checkLoadProgress;
            video.onerror = checkLoadProgress;
        }
    });

    function checkLoadProgress() {
        loadedCount++;
        const percent = Math.floor((loadedCount / PRELOAD_COUNT) * 100);
        btnText.textContent = `资源加载中... ${percent}%`;

        if (loadedCount >= PRELOAD_COUNT) {
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
            fadeInAudio(bgm, 0.6); // 目标音量 0.6
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