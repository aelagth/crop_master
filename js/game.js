document.addEventListener('DOMContentLoaded', () => {
    const startArea = document.getElementById('start-area');
    const startBtn = document.getElementById('start-btn');
    const quizArea = document.getElementById('quiz-area');
    const scoreEl = document.getElementById('score');
    const questionNumberEl = document.getElementById('question-number');
    const totalQuestionsEl = document.getElementById('total-questions');
    const timerEl = document.getElementById('timer');
    const timeLeftEl = document.getElementById('time-left');
    const imageContainer = document.querySelector('.image-stage');
    const quizImageEl = document.getElementById('quiz-image');
    const blurImageEl = document.getElementById('quiz-image-blur');
    const optionsContainer = document.getElementById('options-container');
    const feedbackEl = document.getElementById('feedback');
    const nextBtn = document.getElementById('next-btn');
    const gameOverArea = document.getElementById('game-over-area');
    const finalScoreEl = document.getElementById('final-score');
    const restartBtn = document.getElementById('restart-btn');
    const feedbackOverlay = document.getElementById('feedback-overlay');

    let score = 0;
    let currentQuestionIndex = 0;
    let allQuestions = [];
    let questions = [];
    let zoomLevel = 1.95; // 1.5 * 1.3 = 1.95
    let timerInterval;
    let timeLeft = 15;
    let questionStartedAt = 0;
    const QUESTION_TIME_LIMIT = 15;
    let blurHideTimeout;
    let blurBounds = { left: 0, top: 0, width: 0, height: 0 };

    function loadGameData() {
        if (typeof gameData !== 'undefined' && gameData.length > 0) {
            allQuestions = gameData.filter(item => item.texts && item.texts.text && item.texts.text.trim() !== '');
            if (allQuestions.length < 4) {
                startBtn.textContent = '데이터 부족 (4개 이상 필요)';
                startBtn.disabled = true;
            } else {
                startBtn.disabled = false;
                startBtn.textContent = '게임 시작';
            }
        } else {
            alert('게임 데이터를 찾을 수 없습니다. 데이터 생성기에서 데이터셋을 생성하고, 오프라인 버전을 다시 만들어주세요.');
            startBtn.disabled = true;
            startBtn.textContent = '데이터 없음';
        }
    }

    function startGame() {
        const selectedCount = document.querySelector('input[name="question-count"]:checked').value;
        
        score = 0;
        currentQuestionIndex = 0;
        questions = shuffleArray([...allQuestions]);

        if (selectedCount !== 'all') {
            questions = questions.slice(0, parseInt(selectedCount, 10));
        }
        
        totalQuestionsEl.textContent = questions.length;
        
        startArea.classList.add('hidden');
        quizArea.classList.remove('hidden');
        gameOverArea.classList.add('hidden');
        
        showQuestion();
    }

    function showQuestion() {
        startArea.classList.add('hidden');
        gameOverArea.classList.add('hidden');
        quizArea.classList.remove('hidden');

        resetState();
        startTimer();
        const currentQuestion = questions[currentQuestionIndex];
        questionNumberEl.textContent = currentQuestionIndex + 1;
        quizImageEl.src = currentQuestion.image_path;
        blurImageEl.src = currentQuestion.image_path;
        syncBlurToImageBounds();
        startImageRevealSequence();

        const correctAnswer = currentQuestion.texts.text;
        const options = generateOptions(correctAnswer);

        options.forEach(optionText => {
            const button = document.createElement('button');
            button.innerText = optionText;
            button.classList.add('option-btn');
            button.addEventListener('click', () => selectAnswer(button, correctAnswer));
            optionsContainer.insertBefore(button, feedbackOverlay);
        });
    }

    function syncBlurToImageBounds() {
        const imageNaturalWidth = quizImageEl.naturalWidth;
        const imageNaturalHeight = quizImageEl.naturalHeight;

        if (!imageNaturalWidth || !imageNaturalHeight) {
            blurImageEl.style.removeProperty('--blur-left');
            blurImageEl.style.removeProperty('--blur-top');
            blurImageEl.style.removeProperty('--blur-width');
            blurImageEl.style.removeProperty('--blur-height');
            blurBounds = { left: 0, top: 0, width: imageContainer.clientWidth, height: imageContainer.clientHeight };
            return;
        }

        const stageWidth = imageContainer.clientWidth;
        const stageHeight = imageContainer.clientHeight;
        const imageRatio = imageNaturalWidth / imageNaturalHeight;
        const stageRatio = stageWidth / stageHeight;

        let renderWidth;
        let renderHeight;
        let offsetLeft;
        let offsetTop;

        if (imageRatio > stageRatio) {
            renderWidth = stageWidth;
            renderHeight = stageWidth / imageRatio;
            offsetLeft = 0;
            offsetTop = (stageHeight - renderHeight) / 2;
        } else {
            renderHeight = stageHeight;
            renderWidth = stageHeight * imageRatio;
            offsetTop = 0;
            offsetLeft = (stageWidth - renderWidth) / 2;
        }

        blurImageEl.style.setProperty('--blur-left', `${offsetLeft}px`);
        blurImageEl.style.setProperty('--blur-top', `${offsetTop}px`);
        blurImageEl.style.setProperty('--blur-width', `${renderWidth}px`);
        blurImageEl.style.setProperty('--blur-height', `${renderHeight}px`);

        blurBounds = {
            left: offsetLeft,
            top: offsetTop,
            width: renderWidth,
            height: renderHeight
        };
    }

    function startImageRevealSequence() {
        clearTimeout(blurHideTimeout);

        blurImageEl.classList.remove('reveal');
        blurImageEl.classList.remove('hidden');

        // DOM reflow를 강제로 발생시켜 애니메이션 재시작
        void blurImageEl.offsetWidth;
        blurImageEl.classList.add('reveal');

        blurHideTimeout = setTimeout(() => {
            blurImageEl.classList.add('hidden');
        }, 12000);
    }

    function startTimer() {
        questionStartedAt = Date.now();
        timeLeft = QUESTION_TIME_LIMIT;
        timeLeftEl.textContent = timeLeft;
        timerEl.classList.remove('warning');
        timerInterval = setInterval(() => {
            timeLeft = getRemainingTimeSeconds();
            timeLeftEl.textContent = timeLeft;
            if (timeLeft <= 5) {
                timerEl.classList.add('warning');
            }
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timeUp();
            }
        }, 1000);
    }

    function getRemainingTimeSeconds() {
        const elapsedSeconds = Math.floor((Date.now() - questionStartedAt) / 1000);
        return Math.max(QUESTION_TIME_LIMIT - elapsedSeconds, 0);
    }

    function timeUp() {
        Array.from(optionsContainer.children).forEach(button => {
            if (button.classList.contains('option-btn')) {
                button.classList.add('disabled');
            }
        });
        const correctAnswer = questions[currentQuestionIndex].texts.text;
        feedbackEl.textContent = `시간 초과! 정답은 ${correctAnswer} 입니다.`;
        feedbackEl.style.color = '#F44336';
        feedbackOverlay.classList.remove('hidden');
    }

    function generateOptions(correctAnswer) {
        const options = [correctAnswer];
        const allAnswers = allQuestions.map(q => q.texts.text);
        const wrongAnswers = [...new Set(allAnswers.filter(answer => answer !== correctAnswer))];
        const shuffledWrongAnswers = shuffleArray(wrongAnswers);

        for (let i = 0; i < 3; i++) {
            if (shuffledWrongAnswers[i] && options.length < 4) {
                options.push(shuffledWrongAnswers[i]);
            }
        }
        while(options.length < 4 && options.length < allAnswers.length) {
            const randomAnswer = allAnswers[Math.floor(Math.random() * allAnswers.length)];
            if(!options.includes(randomAnswer)) {
                options.push(randomAnswer);
            }
        }
        return shuffleArray(options);
    }


    function calculateScoreByTime(remainingTime) {
        if (remainingTime >= 11) {
            return 3;
        }

        if (remainingTime >= 6) {
            return 2;
        }

        return 1;
    }

    function selectAnswer(selectedBtn, correctAnswer) {
        clearInterval(timerInterval);
        const selectedAnswer = selectedBtn.innerText;
        const remainingTime = getRemainingTimeSeconds();
        timeLeft = remainingTime;
        timeLeftEl.textContent = remainingTime;
        
        Array.from(optionsContainer.children).forEach(button => {
            if (button.classList.contains('option-btn')) {
                button.classList.add('disabled');
            }
        });

        if (selectedAnswer === correctAnswer) {
            const earnedScore = calculateScoreByTime(remainingTime);
            score += earnedScore;
            scoreEl.textContent = score;
            feedbackEl.textContent = `정답입니다! (+${earnedScore}점)`;
            feedbackEl.style.color = '#4CAF50';
        } else {
            feedbackEl.textContent = `오답! 정답은 ${correctAnswer} 입니다.`;
            feedbackEl.style.color = '#F44336';
        }

        feedbackOverlay.classList.remove('hidden');
    }

    function resetState() {
        clearInterval(timerInterval);
        clearTimeout(blurHideTimeout);
        feedbackEl.textContent = '';
        feedbackOverlay.classList.add('hidden');
        applyImageTransform(1, 'center center');
        blurImageEl.classList.remove('reveal');
        blurImageEl.classList.add('hidden');
        
        // 더 효율적인 방식으로 option-btn 제거
        optionsContainer.querySelectorAll('.option-btn').forEach(btn => btn.remove());
    }

    function showNextQuestion() {
        currentQuestionIndex++;
        if (currentQuestionIndex < questions.length) {
            showQuestion();
        } else {
            showGameOver();
        }
    }

    function showGameOver() {
        quizArea.classList.add('hidden');
        gameOverArea.classList.remove('hidden');
        finalScoreEl.textContent = score;
    }

    function shuffleArray(array) {
        return array.sort(() => Math.random() - 0.5);
    }

    function applyImageTransform(scale, originOrPoint) {
        quizImageEl.style.transform = `scale(${scale})`;
        blurImageEl.style.transform = `scale(${scale})`;

        if (!originOrPoint) {
            return;
        }

        if (typeof originOrPoint === 'string') {
            quizImageEl.style.transformOrigin = originOrPoint;
            blurImageEl.style.transformOrigin = originOrPoint;
            return;
        }

        const pointX = originOrPoint.x;
        const pointY = originOrPoint.y;
        quizImageEl.style.transformOrigin = `${pointX}px ${pointY}px`;

        const blurOriginX = pointX - blurBounds.left;
        const blurOriginY = pointY - blurBounds.top;
        blurImageEl.style.transformOrigin = `${blurOriginX}px ${blurOriginY}px`;
    }

    imageContainer.addEventListener('mouseenter', () => {
        applyImageTransform(zoomLevel);
    });

    imageContainer.addEventListener('mouseleave', () => {
        applyImageTransform(1, 'center center');
    });

    imageContainer.addEventListener('mousemove', (e) => {
        const rect = imageContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        applyImageTransform(zoomLevel, { x, y });
    });

    imageContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        zoomLevel += e.deltaY * -0.01;
        zoomLevel = Math.min(Math.max(1.2, zoomLevel), 5.0);
        applyImageTransform(zoomLevel);
    });
    imageContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            applyImageTransform(zoomLevel);
        }
    });

    imageContainer.addEventListener('touchend', () => {
        applyImageTransform(1, 'center center');
    });

    imageContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            const rect = imageContainer.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const y = e.touches[0].clientY - rect.top;
            applyImageTransform(zoomLevel, { x, y });
        }
    });

    quizImageEl.addEventListener('load', syncBlurToImageBounds);
    window.addEventListener('resize', syncBlurToImageBounds);

    startBtn.addEventListener('click', startGame);
    nextBtn.addEventListener('click', showNextQuestion);
    restartBtn.addEventListener('click', () => {
        gameOverArea.classList.add('hidden');
        quizArea.classList.add('hidden');
        startArea.classList.remove('hidden');
        loadGameData();
    });

    loadGameData();
});
