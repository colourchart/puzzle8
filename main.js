import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Initialize Firebase
let db;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
} catch (e) {
    console.error("Firebase Initialization Error. Check firebase-config.js", e);
}

const puzzleContainer = document.getElementById('puzzle-container');
const startButton = document.getElementById('start-button');
const todayImageBtn = document.getElementById('today-image-btn');
const randomImageBtn = document.getElementById('random-image-btn');
const mainShareBtn = document.getElementById('main-share-btn');
const toggleRefBtn = document.getElementById('toggle-ref-btn');
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
let selectedPiece = null;
let isScrambling = false;
let startTime = 0;
let timerInterval = null;
let isTodayChallenge = false;

// Initialize Leaderboard
updateLeaderboardUI();

const partnershipLink = document.getElementById('partnership-link');
const partnershipModal = document.getElementById('partnership-modal');
const closePartnershipBtn = document.getElementById('close-partnership-btn');

partnershipLink.addEventListener('click', (e) => {
    e.preventDefault();
    partnershipModal.style.display = 'flex';
});

closePartnershipBtn.addEventListener('click', () => {
    partnershipModal.style.display = 'none';
});

toggleRefBtn.addEventListener('click', () => {
    const originalContainer = document.getElementById('original-image-container');
    if (originalContainer.style.display === 'none' || originalContainer.style.opacity === '0') {
        originalContainer.style.display = 'flex';
        originalContainer.style.opacity = '1';
        toggleRefBtn.textContent = '🙈 Hide Ref';
    } else {
        originalContainer.style.display = 'none';
        originalContainer.style.opacity = '0';
        toggleRefBtn.textContent = '👁️ View Ref';
    }
});

function processImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            imageSrc = src;
            const originalImage = document.getElementById('original-image');
            const originalContainer = document.getElementById('original-image-container');
            originalImage.src = imageSrc;
            originalContainer.style.display = 'flex';
            toggleRefBtn.style.display = 'block'; // Show toggle button
            toggleRefBtn.textContent = '🙈 Hide Ref';

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
        // Generate a seed based on today's date (YYYY-MM-DD)
        // This ensures everyone gets the same image for the 24h period
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const dateSeed = `${year}-${month}-${day}`;
        
        // Use the seed to get a consistent daily image
        // Adding 'grayscale' or 'blur' could make it more "complex", 
        // but let's stick to sharp color images for clarity.
        const todayUrl = `https://picsum.photos/seed/${dateSeed}/500/500`;

        await processImage(todayUrl);
        isTodayChallenge = true;
    } catch (e) {
        console.error(e);
        alert('Failed to load Today\'s Image.');
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
        title: 'World Puzzle Battle',
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
    } catch (err) { console.error('Sharing failed', err); }
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

    // Show original image again for new game
    const originalContainer = document.getElementById('original-image-container');
    if (originalContainer) {
        originalContainer.style.display = 'flex';
        originalContainer.style.opacity = '1';
    }
    toggleRefBtn.style.display = 'block';
    toggleRefBtn.textContent = '🙈 Hide Ref';

    const pieceWidth = puzzleContainer.clientWidth / gridSize;
    const pieceHeight = puzzleContainer.clientHeight / gridSize;

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const piece = document.createElement('div');
            piece.classList.add('puzzle-piece');
            piece.style.width = `${pieceWidth}px`;
            piece.style.height = `${pieceHeight}px`;
            piece.style.backgroundImage = `url(${imageSrc})`;
            piece.style.backgroundSize = `${puzzleContainer.clientWidth}px ${puzzleContainer.clientHeight}px`;
            const backgroundPosX = -j * pieceWidth;
            const backgroundPosY = -i * pieceHeight;
            piece.style.backgroundPosition = `${backgroundPosX}px ${backgroundPosY}px`;
            piece.style.top = `${i * pieceHeight}px`;
            piece.style.left = `${j * pieceWidth}px`;

            const pieceData = {
                element: piece,
                currentRow: i,
                currentCol: j,
                correctRow: i,
                correctCol: j
            };
            puzzlePieces.push(pieceData);
            puzzleContainer.appendChild(piece);
            piece.addEventListener('click', () => {
                handlePieceClick(pieceData, pieceWidth, pieceHeight);
            });
        }
    }
    scramblePuzzle(pieceWidth, pieceHeight);
}

function handlePieceClick(pieceData, pieceWidth, pieceHeight) {
    if (isScrambling) return;
    if (!selectedPiece) {
        selectedPiece = pieceData;
        pieceData.element.classList.add('selected');
    } else if (selectedPiece === pieceData) {
        selectedPiece.element.classList.remove('selected');
        selectedPiece = null;
    } else {
        swapPieces(selectedPiece, pieceData, pieceWidth, pieceHeight);
        selectedPiece.element.classList.remove('selected');
        selectedPiece = null;
        checkCompletion();
    }
}

function swapPieces(pieceA, pieceB, pieceWidth, pieceHeight) {
    const tempRow = pieceA.currentRow;
    const tempCol = pieceA.currentCol;
    pieceA.currentRow = pieceB.currentRow;
    pieceA.currentCol = pieceB.currentCol;
    pieceB.currentRow = tempRow;
    pieceB.currentCol = tempCol;
    pieceA.element.style.top = `${pieceA.currentRow * pieceHeight}px`;
    pieceA.element.style.left = `${pieceA.currentCol * pieceWidth}px`;
    pieceB.element.style.top = `${pieceB.currentRow * pieceHeight}px`;
    pieceB.element.style.left = `${pieceB.currentCol * pieceWidth}px`;
}

function scramblePuzzle(pieceWidth, pieceHeight) {
    isScrambling = true;
    let moves = 0;
    const maxMoves = gridSize * gridSize * 2;
    const interval = setInterval(() => {
        const idx1 = Math.floor(Math.random() * puzzlePieces.length);
        let idx2 = Math.floor(Math.random() * puzzlePieces.length);
        while (idx1 === idx2) idx2 = Math.floor(Math.random() * puzzlePieces.length);
        swapPieces(puzzlePieces[idx1], puzzlePieces[idx2], pieceWidth, pieceHeight);
        moves++;
        if (moves >= maxMoves) {
            clearInterval(interval);
            isScrambling = false;
            startTimer();
        }
    }, 50);
}

async function checkCompletion() {
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
        
        // Hide original image and toggle button on completion
        const originalContainer = document.getElementById('original-image-container');
        if (originalContainer) originalContainer.style.display = 'none';
        toggleRefBtn.style.display = 'none';

        // Check if user reached Top 3
        const finalTimeStr = timerDisplay.textContent.replace('Time: ', '').replace('s', '');
        const finalTime = parseFloat(finalTimeStr);
        const difficultyText = difficultySelector.options[difficultySelector.selectedIndex].text;
        
        // Async Rank Check
        const rank = await getPotentialRank(finalTime, difficultyText, isTodayChallenge);
        if (rank <= 3) showBoardCrown(rank);
        
        showSuccessModal();
    }
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
        title: 'World Puzzle Battle',
        text: `[퍼즐 게임] ${difficultyText} 난이도를 ${finalTime}만에 완성했습니다! 여러분도 도전해보세요!`, 
        url: window.location.href
    };
    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
            alert('결과가 클립보드에 복사되었습니다!');
        }
    } catch (err) { console.error('Sharing failed', err); }
});

saveRecordBtn.addEventListener('click', async () => {
    if (!db) {
        alert('데이터베이스 연결 실패. firebase-config.js를 확인하세요.');
        return;
    }
    const finalTimeStr = timerDisplay.textContent.replace('Time: ', '').replace('s', '');
    const finalTime = parseFloat(finalTimeStr);
    const comment = successThoughts.value;
    const nickname = successNickname.value || 'Anonymous';
    const country = successCountry.value || '🌍';
    const difficultyText = difficultySelector.options[difficultySelector.selectedIndex].text;

    saveRecordBtn.disabled = true;
    saveRecordBtn.textContent = '저장 중...';

    await saveToLeaderboard(finalTime, comment, difficultyText, isTodayChallenge, nickname, country);
    
    saveRecordBtn.disabled = false;
    saveRecordBtn.textContent = '기록 저장 & 닫기';
    successModal.style.display = 'none';
    successThoughts.value = '';
    successNickname.value = '';
});

// --- Firebase Leaderboard Logic ---

// ... (previous imports and code)

function calculateScore(time, difficulty, isToday) {
    let weight = 1;
    if (difficulty.includes('Normal')) weight = 5;
    if (difficulty.includes('Hard')) weight = 15;

    // Base Score = (Weight * 1000) / Time
    // Using 10000 to get distinct integer scores
    let score = (weight * 10000) / time;
    
    // Today's Challenge Bonus: 50%
    if (isToday) score *= 1.5;

    return Math.floor(score);
}

async function saveToLeaderboard(time, comment, difficulty, isToday, nickname, country) {
    const difficultyValue = {
        'Hard (8x8 - 64pcs)': 3,
        'Normal (6x6 - 36pcs)': 2,
        'Easy (4x4 - 16pcs)': 1
    };

    const score = calculateScore(time, difficulty, isToday);

    try {
        await addDoc(collection(db, "leaderboard"), {
            time: time,
            score: score, // Save score
            comment: comment,
            difficulty: difficulty,
            difficultyVal: difficultyValue[difficulty] || 0,
            isToday: isToday || false,
            timestamp: Date.now(),
            nickname: nickname,
            country: country
        });
        await updateLeaderboardUI();
    } catch (e) {
        console.error("Error adding document: ", e);
        alert("기록 저장 실패: " + e.message);
    }
}

async function updateLeaderboardUI() {
    if (!db) return;
    leaderboardList.innerHTML = '<li>Loading...</li>';

    try {
        // Fetch more records to sort client-side
        const q = query(collection(db, "leaderboard"), orderBy("time", "asc"), limit(100));
        
        const querySnapshot = await getDocs(q);
        let records = [];
        querySnapshot.forEach((doc) => {
            let data = doc.data();
            // Always recalculate score to apply latest weight adjustments dynamically
            data.score = calculateScore(data.time, data.difficulty, data.isToday);
            records.push(data);
        });

        // Client-side filtering (Expiration)
        const now = Date.now();
        const MS_IN_DAY = 24 * 60 * 60 * 1000;
        const MS_IN_5_DAYS = 5 * MS_IN_DAY;

        records = records.filter(record => {
            const age = now - record.timestamp;
            if (record.difficulty && record.difficulty.includes('Hard')) {
                return age < MS_IN_5_DAYS; 
            }
            return age < MS_IN_DAY; 
        });

        // Sort by Score (Descending)
        records.sort((a, b) => b.score - a.score);

        // Take Top 3
        records = records.slice(0, 3);

        renderLeaderboard(records);

    } catch (e) {
        console.error("Error fetching leaderboard: ", e);
        leaderboardList.innerHTML = '<li>Error loading records.</li>';
    }
}

async function getPotentialRank(time, difficulty, isToday) {
    if (!db) return 999;
    
    try {
        const q = query(collection(db, "leaderboard"), orderBy("time", "asc"), limit(100));
        const querySnapshot = await getDocs(q);
        let records = [];
        querySnapshot.forEach((doc) => {
            let data = doc.data();
            // Always recalculate score
            data.score = calculateScore(data.time, data.difficulty, data.isToday);
            records.push(data);
        });

        const currentScore = calculateScore(time, difficulty, isToday);
        const currentRecord = {
            score: currentScore,
            timestamp: Date.now() // Needed for filter if strictly applied, but rank check implies active
        };

        // Filter
        const now = Date.now();
        const MS_IN_DAY = 24 * 60 * 60 * 1000;
        const MS_IN_5_DAYS = 5 * MS_IN_DAY;

        records = records.filter(record => {
            const age = now - record.timestamp;
            if (record.difficulty && record.difficulty.includes('Hard')) {
                return age < MS_IN_5_DAYS; 
            }
            return age < MS_IN_DAY; 
        });

        const tempRecords = [...records, currentRecord];
        // Sort by Score
        tempRecords.sort((a, b) => b.score - a.score);

        return tempRecords.findIndex(r => r === currentRecord) + 1;

    } catch(e) {
        console.error(e);
        return 999;
    }
}

function renderLeaderboard(records) {
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
            todayBadge = '<span class="badge-today">TODAY (+50%)</span>';
        }
        
        const countryHtml = record.country ? `<span style="margin-right: 4px;">${record.country}</span>` : '';
        const nicknameHtml = record.nickname ? `<span class="record-nickname">${countryHtml}${record.nickname}</span>` : '';

        const linkify = (text) => {
            const urlPattern = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
            return text.replace(urlPattern, '<a href="$1" target="_blank" style="color: #007bff; text-decoration: underline;">링크</a>');
        };
        const commentHtml = record.comment ? `<span class="record-comment">${linkify(record.comment)}</span>` : '';

        // Determine difficulty short name
        let diffShort = 'Easy';
        if (record.difficulty.includes('Normal')) diffShort = 'Normal';
        if (record.difficulty.includes('Hard')) diffShort = 'Hard';

        li.innerHTML = `
            <div class="record-header">
                <div style="display: flex; align-items: center;">
                    ${crownHtml}
                    ${nicknameHtml}
                </div>
                <div>
                    ${todayBadge}
                    <span class="record-difficulty" style="font-weight:bold; color:#555;">${record.score?.toLocaleString()} pts</span>
                </div>
            </div>
            <div class="record-info">
                <span class="record-time" style="font-size: 0.85rem; color: #888;">${diffShort} / ${record.time.toFixed(1)}s</span>
                ${commentHtml}
            </div>
        `;
        leaderboardList.appendChild(li);
    });
}