document.addEventListener('DOMContentLoaded', () => {
    const startArea = document.getElementById('start-area');
    const startBtn = document.getElementById('start-btn');
    const quizArea = document.getElementById('quiz-area');
    const scoreEl = document.getElementById('score');
    const questionNumberEl = document.getElementById('question-number');
    const totalQuestionsEl = document.getElementById('total-questions');
    const timerEl = document.getElementById('timer');
    const timeLeftEl = document.getElementById('time-left');
    const imageContainer = document.querySelector('.image-container');
    const quizImageEl = document.getElementById('quiz-image');
    const imageOverlay = document.getElementById('image-overlay');
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
    let zoomLevel = 1.95;
    let timerInterval;
    let timeLeft = 25; // 타이머 25초로 변경

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

    function startTimer() {
        timeLeft = 25;
        timeLeftEl.textContent = timeLeft;
        timerEl.classList.remove('warning');
        
        // 오버레이 초기화 및 애니메이션 시작
        imageOverlay.style.transition = 'height 25s linear';
        imageOverlay.style.height = '50%';
        // 강제 리플로우 후 애니메이션 시작
        setTimeout(() => {
            imageOverlay.style.height = '0%';
        }, 100);

        timerInterval = setInterval(() => {
            timeLeft--;
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

    function selectAnswer(selectedBtn, correctAnswer) {
        clearInterval(timerInterval);
        imageOverlay.style.height = imageOverlay.offsetHeight + 'px'; // 애니메이션 정지

        const selectedAnswer = selectedBtn.innerText;
        
        Array.from(optionsContainer.children).forEach(button => {
            if (button.classList.contains('option-btn')) {
                button.classList.add('disabled');
            }
        });

        if (selectedAnswer === correctAnswer) {
            let points = 0;
            if (timeLeft >= 17) {
                points = 3;
            } else if (timeLeft >= 8) {
                points = 2;
            } else {
                points = 1;
            }
            score += points;
            scoreEl.textContent = score;
            feedbackEl.textContent = `정답입니다! (+${points}점)`;
            feedbackEl.style.color = '#4CAF50';
        } else {
            feedbackEl.textContent = `오답! 정답은 ${correctAnswer} 입니다.`;
            feedbackEl.style.color = '#F44336';
        }

        feedbackOverlay.classList.remove('hidden');
    }

    function resetState() {
        clearInterval(timerInterval);
        feedbackEl.textContent = '';
        feedbackOverlay.classList.add('hidden');
        quizImageEl.style.transform = 'scale(1)';
        quizImageEl.style.transformOrigin = 'center center';
        imageOverlay.style.transition = 'none'; // 애니메이션 초기화
        imageOverlay.style.height = '50%';
        
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

    imageContainer.addEventListener('mouseenter', () => {
        quizImageEl.style.transform = `scale(${zoomLevel})`;
    });

    imageContainer.addEventListener('mouseleave', () => {
        quizImageEl.style.transform = 'scale(1)';
        quizImageEl.style.transformOrigin = 'center center';
    });

    imageContainer.addEventListener('mousemove', (e) => {
        const rect = imageContainer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const xPercent = (x / rect.width) * 100;
        const yPercent = (y / rect.height) * 100;
        quizImageEl.style.transformOrigin = `${xPercent}% ${yPercent}%`;
    });

    imageContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        zoomLevel += e.deltaY * -0.01;
        zoomLevel = Math.min(Math.max(1.2, zoomLevel), 5.0);
        quizImageEl.style.transform = `scale(${zoomLevel})`;
    });
    imageContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            quizImageEl.style.transform = `scale(${zoomLevel})`;
        }
    });

    imageContainer.addEventListener('touchend', () => {
        quizImageEl.style.transform = 'scale(1)';
        quizImageEl.style.transformOrigin = 'center center';
    });

    imageContainer.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            const rect = imageContainer.getBoundingClientRect();
            const x = e.touches[0].clientX - rect.left;
            const y = e.touches[0].clientY - rect.top;
            const xPercent = (x / rect.width) * 100;
            const yPercent = (y / rect.height) * 100;
            quizImageEl.style.transformOrigin = `${xPercent}% ${yPercent}%`;
        }
    });

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