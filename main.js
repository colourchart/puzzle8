

const puzzleContainer = document.getElementById('puzzle-container');
const startButton = document.getElementById('start-button');
const todayImageBtn = document.getElementById('today-image-btn');
const randomImageBtn = document.getElementById('random-image-btn');
const mainShareBtn = document.getElementById('main-share-btn');
const timerDisplay = document.getElementById('timer');
const difficultySelector = document.getElementById('difficulty-selector');
const leaderboardList = document.getElementById('leaderboard-list');

const successModal = document.getElementById('success-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const saveRecordBtn = document.getElementById('save-record-btn');
const successThoughts = document.getElementById('success-thoughts');
const successNickname = document.getElementById('success-nickname');
const successCountry = document.getElementById('success-country');
const successTime = document.getElementById('success-time');

let imageSrc = null;
let puzzlePieces = [];
let gridSize = 4;
let selectedPiece = null; // Track selected piece for swapping
let isScrambling = false;
let startTime = 0;
let timerInterval = null;
let isTodayChallenge = false;

// Initialize Leaderboard
filterExpiredRecords();
updateLeaderboardUI();

function processImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            imageSrc = src;

            // Show original image
            const originalImage = document.getElementById('original-image');
            const originalContainer = document.getElementById('original-image-container');
            originalImage.src = imageSrc;
            originalContainer.style.display = 'flex';

            const maxWidth = 500;
            const maxHeight = 500;
            let newWidth = img.width;
            let newHeight = img.height;

            if (img.width > img.height) {
                if (img.width > maxWidth) {
                    newWidth = maxWidth;
                    newHeight = (img.height / img.width) * maxWidth;
                }
            } else {
                if (img.height > maxHeight) {
                    newHeight = maxHeight;
                    newWidth = (img.width / img.height) * maxHeight;
                }
            }

            puzzleContainer.style.width = `${newWidth}px`;
            puzzleContainer.style.height = `${newHeight}px`;
            startButton.style.display = 'block';
            resolve();
        };
        img.onerror = reject;
        img.src = src;
    });
}

todayImageBtn.addEventListener('click', async () => {
    todayImageBtn.disabled = true;
    todayImageBtn.textContent = 'Loading...';
    
    try {
        const response = await fetch('config.json');
        const config = await response.json();
        const todayUrl = config.todayImage;

        if (!todayUrl) throw new Error("No image configured");

        await processImage(todayUrl);
        isTodayChallenge = true;
    } catch (e) {
        console.error(e);
        alert('Failed to load Today\'s Image. Please try again later.');
    } finally {
        todayImageBtn.disabled = false;
        todayImageBtn.textContent = '📅 Today\'s Challenge';
    }
});

randomImageBtn.addEventListener('click', async () => {
    randomImageBtn.disabled = true;
    randomImageBtn.textContent = 'Loading...';
    
    const randomId = Math.floor(Math.random() * 1000);
    const randomUrl = `https://picsum.photos/500/500?random=${randomId}`;
    
    try {
        await processImage(randomUrl);
        isTodayChallenge = false;
    } catch (e) {
        alert('Failed to load Random Image.');
    } finally {
        randomImageBtn.disabled = false;
        randomImageBtn.textContent = '🎲 Random Image';
    }
});

mainShareBtn.addEventListener('click', async () => {
    const shareData = {
        title: 'Image Puzzle Game',
        text: '재미있는 이미지 퍼즐 게임입니다! 같이 도전해보세요!',
        url: window.location.href
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
            alert('게임 링크가 클립보드에 복사되었습니다!');
        }
    } catch (err) {
        console.error('Sharing failed', err);
    }
});

startButton.addEventListener('click', () => {
    if (!imageSrc) return;
    gridSize = parseInt(difficultySelector.value);
    createPuzzle();
});

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsedTime = (Date.now() - startTime) / 1000;
        timerDisplay.textContent = `Time: ${elapsedTime.toFixed(1)}s`;
    }, 100);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function createPuzzle() {
    puzzleContainer.innerHTML = '';
    puzzlePieces = [];
    selectedPiece = null; // Reset selection

    const pieceWidth = puzzleContainer.clientWidth / gridSize;
    const pieceHeight = puzzleContainer.clientHeight / gridSize;
    
    // No emptyPos needed for Swap Puzzle

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            // Fill ALL cells
            const piece = document.createElement('div');
            piece.classList.add('puzzle-piece');
            piece.style.width = `${pieceWidth}px`;
            piece.style.height = `${pieceHeight}px`;
            piece.style.backgroundImage = `url(${imageSrc})`;
            piece.style.backgroundSize = `${puzzleContainer.clientWidth}px ${puzzleContainer.clientHeight}px`;
            
            const backgroundPosX = -j * pieceWidth;
            const backgroundPosY = -i * pieceHeight;
            piece.style.backgroundPosition = `${backgroundPosX}px ${backgroundPosY}px`;

            // Initial Position (Solved State)
            piece.style.top = `${i * pieceHeight}px`;
            piece.style.left = `${j * pieceWidth}px`;

            // Store metadata
            const pieceData = {
                element: piece,
                currentRow: i,
                currentCol: j,
                correctRow: i,
                correctCol: j
            };
            
            puzzlePieces.push(pieceData);
            puzzleContainer.appendChild(piece);

            // Add click listener for Swapping
            piece.addEventListener('click', () => {
                handlePieceClick(pieceData, pieceWidth, pieceHeight);
            });
        }
    }
    
    // Scramble the puzzle
    scramblePuzzle(pieceWidth, pieceHeight);
}

function handlePieceClick(pieceData, pieceWidth, pieceHeight) {
    if (isScrambling) return;

    if (!selectedPiece) {
        // Select first piece
        selectedPiece = pieceData;
        pieceData.element.classList.add('selected');
    } else if (selectedPiece === pieceData) {
        // Deselect if clicking same piece
        selectedPiece.element.classList.remove('selected');
        selectedPiece = null;
    } else {
        // Swap with second piece
        swapPieces(selectedPiece, pieceData, pieceWidth, pieceHeight);
        selectedPiece.element.classList.remove('selected');
        selectedPiece = null;
        checkCompletion();
    }
}

function swapPieces(pieceA, pieceB, pieceWidth, pieceHeight) {
    // Swap logical positions
    const tempRow = pieceA.currentRow;
    const tempCol = pieceA.currentCol;

    pieceA.currentRow = pieceB.currentRow;
    pieceA.currentCol = pieceB.currentCol;

    pieceB.currentRow = tempRow;
    pieceB.currentCol = tempCol;

    // Swap visual positions
    pieceA.element.style.top = `${pieceA.currentRow * pieceHeight}px`;
    pieceA.element.style.left = `${pieceA.currentCol * pieceWidth}px`;

    pieceB.element.style.top = `${pieceB.currentRow * pieceHeight}px`;
    pieceB.element.style.left = `${pieceB.currentCol * pieceWidth}px`;
}

function scramblePuzzle(pieceWidth, pieceHeight) {
    isScrambling = true;
    let moves = 0;
    const maxMoves = gridSize * gridSize * 2; // Swaps needed
    const interval = setInterval(() => {
        // Randomly select two distinct pieces
        const idx1 = Math.floor(Math.random() * puzzlePieces.length);
        let idx2 = Math.floor(Math.random() * puzzlePieces.length);
        while (idx1 === idx2) {
            idx2 = Math.floor(Math.random() * puzzlePieces.length);
        }

        swapPieces(puzzlePieces[idx1], puzzlePieces[idx2], pieceWidth, pieceHeight);

        moves++;
        if (moves >= maxMoves) {
            clearInterval(interval);
            isScrambling = false;
            startTimer();
        }
    }, 50); // Slower interval for visual swap clarity
}

function checkCompletion() {
    if (isScrambling) return;

    let isComplete = true;
    for (const piece of puzzlePieces) {
        if (piece.currentRow !== piece.correctRow || piece.currentCol !== piece.correctCol) {
            isComplete = false;
            break;
        }
    }

    if (isComplete) {
        stopTimer();
        
        // Check if user reached Top 3
        const finalTimeStr = timerDisplay.textContent.replace('Time: ', '').replace('s', '');
        const finalTime = parseFloat(finalTimeStr);
        const difficultyText = difficultySelector.options[difficultySelector.selectedIndex].text;
        const rank = getPotentialRank(finalTime, difficultyText, isTodayChallenge);
        
        if (rank <= 3) {
            showBoardCrown(rank);
        }
        
        showSuccessModal();
    }
}

function getPotentialRank(time, difficulty, isToday) {
    filterExpiredRecords();
    let records = JSON.parse(localStorage.getItem('puzzleLeaderboard')) || [];
    
    // Updated difficulty mapping for rank calculation
    const difficultyValue = {
        'Hard (8x8 - 64pcs)': 3,
        'Normal (6x6 - 36pcs)': 2,
        'Easy (4x4 - 16pcs)': 1
    };

    const currentRecord = {
        time: time,
        difficultyVal: difficultyValue[difficulty] || 0,
        isToday: isToday || false
    };

    const tempRecords = [...records, currentRecord];
    tempRecords.sort((a, b) => {
        const aToday = a.isToday ? 1 : 0;
        const bToday = b.isToday ? 1 : 0;
        if (bToday !== aToday) return bToday - aToday;
        if (b.difficultyVal !== a.difficultyVal) return b.difficultyVal - a.difficultyVal;
        return a.time - b.time;
    });

    return tempRecords.findIndex(r => r === currentRecord) + 1;
}

function showBoardCrown(rank) {
    const crownDiv = document.createElement('div');
    crownDiv.classList.add('success-board-crown');
    
    const pieceWidth = puzzleContainer.clientWidth / gridSize;
    const pieceHeight = puzzleContainer.clientHeight / gridSize;
    
    crownDiv.style.width = `${pieceWidth}px`;
    crownDiv.style.height = `${pieceHeight}px`;
    crownDiv.style.left = `${(gridSize - 1) * pieceWidth}px`;
    crownDiv.style.top = `${(gridSize - 1) * pieceHeight}px`;

    let crownColor = '';
    if (rank === 1) crownColor = '#FFD700'; 
    else if (rank === 2) crownColor = '#C0C0C0'; 
    else if (rank === 3) crownColor = '#CD7F32'; 

    crownDiv.innerHTML = `<span style="color: ${crownColor}">♛</span>`;
    puzzleContainer.appendChild(crownDiv);
}

function showSuccessModal() {
    const finalTime = timerDisplay.textContent.replace('Time: ', '');
    successTime.textContent = `소요 시간: ${finalTime}`;
    successModal.style.display = 'flex';
}

closeModalBtn.addEventListener('click', () => {
    successModal.style.display = 'none';
    successThoughts.value = ''; 
    successNickname.value = '';
});

const shareBtn = document.getElementById('share-btn');
shareBtn.addEventListener('click', async () => {
    const finalTime = timerDisplay.textContent.replace('Time: ', '');
    const difficultyText = difficultySelector.options[difficultySelector.selectedIndex].text;
    const shareData = {
        title: 'Image Puzzle Game',
        text: `[퍼즐 게임] ${difficultyText} 난이도를 ${finalTime}만에 완성했습니다! 여러분도 도전해보세요!`,
        url: window.location.href
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            // Fallback: Copy to clipboard
            await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
            alert('결과가 클립보드에 복사되었습니다!');
        }
    } catch (err) {
        console.error('Sharing failed', err);
    }
});

saveRecordBtn.addEventListener('click', () => {
    const finalTimeStr = timerDisplay.textContent.replace('Time: ', '').replace('s', '');
    const finalTime = parseFloat(finalTimeStr);
    const comment = successThoughts.value;
    const nickname = successNickname.value || 'Anonymous';
    const country = successCountry.value || '🌍';
    const difficultyText = difficultySelector.options[difficultySelector.selectedIndex].text;

    saveToLeaderboard(finalTime, comment, difficultyText, isTodayChallenge, nickname, country);
    
    successModal.style.display = 'none';
    successThoughts.value = '';
    successNickname.value = '';
});

function saveToLeaderboard(time, comment, difficulty, isToday, nickname, country) {
    filterExpiredRecords(); 
    let records = JSON.parse(localStorage.getItem('puzzleLeaderboard')) || [];
    
    const difficultyValue = {
        'Hard (8x8 - 64pcs)': 3,
        'Normal (6x6 - 36pcs)': 2,
        'Easy (4x4 - 16pcs)': 1
    };

    records.push({
        time: time,
        comment: comment,
        difficulty: difficulty,
        difficultyVal: difficultyValue[difficulty] || 0,
        isToday: isToday || false,
        timestamp: Date.now(),
        nickname: nickname,
        country: country
    });

    records.sort((a, b) => {
        const aToday = a.isToday ? 1 : 0;
        const bToday = b.isToday ? 1 : 0;

        if (bToday !== aToday) return bToday - aToday; 
        if (b.difficultyVal !== a.difficultyVal) return b.difficultyVal - a.difficultyVal; 
        return a.time - b.time;
    });

    if (records.length > 5) records = records.slice(0, 5);

    localStorage.setItem('puzzleLeaderboard', JSON.stringify(records));
    updateLeaderboardUI();
}

function filterExpiredRecords() {
    let records = JSON.parse(localStorage.getItem('puzzleLeaderboard')) || [];
    const now = Date.now();
    const MS_IN_DAY = 24 * 60 * 60 * 1000;
    const MS_IN_5_DAYS = 5 * MS_IN_DAY;

    const filteredRecords = records.filter(record => {
        const age = now - record.timestamp;
        if (record.difficulty && record.difficulty.includes('Hard')) {
            return age < MS_IN_5_DAYS; 
        }
        return age < MS_IN_DAY; 
    });

    if (records.length !== filteredRecords.length) {
        localStorage.setItem('puzzleLeaderboard', JSON.stringify(filteredRecords));
    }
}

function updateLeaderboardUI() {
    filterExpiredRecords(); 
    const records = JSON.parse(localStorage.getItem('puzzleLeaderboard')) || [];
    leaderboardList.innerHTML = '';

    if (records.length === 0) {
        leaderboardList.innerHTML = '<li>No records yet.</li>';
        return;
    }

    records.forEach((record, index) => {
        const li = document.createElement('li');
        
        let crownHtml = '';
        if (index === 0) crownHtml = '<span class="crown gold">♛</span>';
        else if (index === 1) crownHtml = '<span class="crown silver">♛</span>';
        else if (index === 2) crownHtml = '<span class="crown bronze">♛</span>';
        else crownHtml = `<span class="rank-num">${index + 1}</span>`;

        let todayBadge = '';
        if (record.isToday) {
            todayBadge = '<span class="badge-today">TODAY</span>';
        }
        
        const countryHtml = record.country ? `<span style="margin-right: 4px;">${record.country}</span>` : '';
        const nicknameHtml = record.nickname ? `<span class="record-nickname">${countryHtml}${record.nickname}</span>` : '';

        // Linkify comment
        const linkify = (text) => {
            const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
            return text.replace(urlPattern, '<a href="$1" target="_blank" style="color: #007bff; text-decoration: underline;">링크</a>');
        };
        const commentHtml = record.comment ? `<span class="record-comment">${linkify(record.comment)}</span>` : '';

        li.innerHTML = `
            <div class="record-header">
                <div style="display: flex; align-items: center;">
                    ${crownHtml}
                    ${nicknameHtml}
                </div>
                <div>
                    ${todayBadge}
                    <span class="record-difficulty">${record.difficulty}</span>
                </div>
            </div>
            <div class="record-info">
                <span class="record-time">${record.time.toFixed(1)}s</span>
                ${commentHtml}
            </div>
        `;
        leaderboardList.appendChild(li);
    });
}
