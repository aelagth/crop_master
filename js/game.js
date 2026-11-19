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
    let answerNames = [];
    let questions = [];
    let zoomLevel = 1.95; // 1.5 * 1.3 = 1.95
    let timerInterval;
    let activeRound;
    const QUESTION_TIME_LIMIT = 15;
    const IMAGE_LOAD_TIMEOUT_MS = 15000;
    const OPTION_COUNT = 4;
    let imageLoadTimeout;
    let blurHideTimeout;
    let blurBounds = { left: 0, top: 0, width: 0, height: 0 };

    function loadGameData() {
        if (typeof gameData === 'undefined' || !Array.isArray(gameData) || gameData.length === 0) {
            allQuestions = [];
            answerNames = [];
            alert('게임 데이터를 찾을 수 없습니다. 데이터 생성기에서 데이터셋을 생성하고, 오프라인 버전을 다시 만들어주세요.');
            startBtn.disabled = true;
            startBtn.textContent = '데이터 없음';
            return;
        }

        allQuestions = gameData.flatMap(question => {
            const text = question?.texts?.text;
            const name = typeof text === 'string' ? text.trim().replace(/\s+/g, ' ') : '';
            return name ? [{ ...question, texts: { ...question.texts, text: name } }] : [];
        });
        answerNames = [...new Set(allQuestions.map(question => question.texts.text))];
        startBtn.disabled = answerNames.length < OPTION_COUNT;
        startBtn.textContent = startBtn.disabled ? `서로 다른 정답 ${OPTION_COUNT}종 필요` : '게임 시작';
    }

    function startGame() {
        if (answerNames.length < OPTION_COUNT || startArea.classList.contains('hidden')) {
            return;
        }

        const selectedCount = document.querySelector('input[name="question-count"]:checked').value;
        
        score = 0;
        scoreEl.textContent = score;
        finalScoreEl.textContent = score;
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
        const { image_path: imagePath, texts: { text: correctAnswer } } = questions[currentQuestionIndex];
        const round = { correctAnswer, phase: 'loading' };
        activeRound = round;
        questionNumberEl.textContent = currentQuestionIndex + 1;
        timeLeftEl.textContent = '–';
        timerEl.classList.remove('warning');
        quizImageEl.classList.add('hidden');
        nextBtn.classList.add('hidden');
        showFeedback('이미지 불러오는 중…', '#333');

        const options = generateOptions(correctAnswer);
        options.forEach(optionText => {
            const button = document.createElement('button');
            button.innerText = optionText;
            button.classList.add('option-btn');
            button.addEventListener('click', () => selectAnswer(round, optionText));
            optionsContainer.insertBefore(button, feedbackOverlay);
        });
        setOptionsDisabled(true);

        if (typeof imagePath !== 'string' || !imagePath.trim()) {
            imageLoadFailed(round);
            return;
        }

        quizImageEl.src = imagePath;
        blurImageEl.src = imagePath;
        imageLoadTimeout = setTimeout(() => imageLoadFailed(round), IMAGE_LOAD_TIMEOUT_MS);
        Promise.all([quizImageEl.decode(), blurImageEl.decode()]).then(() => {
            if (activeRound !== round || round.phase !== 'loading') {
                return;
            }
            clearTimeout(imageLoadTimeout);
            feedbackOverlay.classList.add('hidden');
            quizImageEl.classList.remove('hidden');
            syncBlurToImageBounds();
            startImageRevealSequence();
            startTimer(round);
            setOptionsDisabled(false);
        }, () => imageLoadFailed(round));
    }

    function imageLoadFailed(round) {
        if (activeRound !== round || round.phase !== 'loading') {
            return;
        }
        finishQuestion(round);
        showFeedback('이미지를 불러오지 못했습니다.', '#F44336');
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

    function startTimer(round) {
        round.deadline = performance.now() + QUESTION_TIME_LIMIT * 1000;
        round.phase = 'active';
        timeLeftEl.textContent = QUESTION_TIME_LIMIT;
        timerInterval = setInterval(() => {
            if (activeRound !== round || round.phase !== 'active') {
                return;
            }
            const remainingTime = getRemainingTimeSeconds(round);
            updateTimerDisplay(remainingTime);
            if (remainingTime === 0) {
                timeUp(round);
            }
        }, 1000);
    }

    function getRemainingTimeSeconds(round) {
        return Math.max(0, Math.ceil((round.deadline - performance.now()) / 1000));
    }

    function updateTimerDisplay(remainingTime) {
        timeLeftEl.textContent = remainingTime;
        timerEl.classList.toggle('warning', remainingTime <= 5);
    }

    function setOptionsDisabled(disabled) {
        optionsContainer.querySelectorAll('.option-btn').forEach(button => {
            button.disabled = disabled;
            button.classList.toggle('disabled', disabled);
        });
    }

    function finishQuestion(round) {
        round.phase = 'finished';
        clearInterval(timerInterval);
        clearTimeout(imageLoadTimeout);
        setOptionsDisabled(true);
        nextBtn.classList.remove('hidden');
    }

    function showFeedback(message, color) {
        feedbackEl.textContent = message;
        feedbackEl.style.color = color;
        feedbackOverlay.classList.remove('hidden');
    }

    function timeUp(round) {
        finishQuestion(round);
        showFeedback(`시간 초과! 정답은 ${round.correctAnswer} 입니다.`, '#F44336');
    }

    function generateOptions(correctAnswer) {
        const wrongAnswers = answerNames.filter(answer => answer !== correctAnswer);
        const distractors = shuffleArray(wrongAnswers).slice(0, OPTION_COUNT - 1);
        return shuffleArray([correctAnswer, ...distractors]);
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

    function selectAnswer(round, selectedAnswer) {
        if (activeRound !== round || round.phase !== 'active') {
            return;
        }

        const remainingTime = getRemainingTimeSeconds(round);
        updateTimerDisplay(remainingTime);
        if (remainingTime === 0) {
            timeUp(round);
            return;
        }

        finishQuestion(round);
        if (selectedAnswer === round.correctAnswer) {
            const earnedScore = calculateScoreByTime(remainingTime);
            score += earnedScore;
            scoreEl.textContent = score;
            showFeedback(`정답입니다! (+${earnedScore}점)`, '#4CAF50');
        } else {
            showFeedback(`오답! 정답은 ${round.correctAnswer} 입니다.`, '#F44336');
        }
    }

    function resetState() {
        activeRound = undefined;
        clearInterval(timerInterval);
        clearTimeout(blurHideTimeout);
        clearTimeout(imageLoadTimeout);
        feedbackEl.textContent = '';
        feedbackOverlay.classList.add('hidden');
        applyImageTransform(1, 'center center');
        blurImageEl.classList.remove('reveal');
        blurImageEl.classList.add('hidden');
        
        // 더 효율적인 방식으로 option-btn 제거
        optionsContainer.querySelectorAll('.option-btn').forEach(btn => btn.remove());
    }

    function showNextQuestion() {
        if (activeRound?.phase !== 'finished') {
            return;
        }
        currentQuestionIndex++;
        if (currentQuestionIndex < questions.length) {
            showQuestion();
        } else {
            showGameOver();
        }
    }

    function showGameOver() {
        resetState();
        quizArea.classList.add('hidden');
        gameOverArea.classList.remove('hidden');
        finalScoreEl.textContent = score;
    }

    function shuffleArray(array) {
        for (let index = array.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
        }
        return array;
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
