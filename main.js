
const imageLoader = document.getElementById('image-loader');
const puzzleContainer = document.getElementById('puzzle-container');
const startButton = document.getElementById('start-button');

let imageSrc = null;
let puzzlePieces = [];
const gridSize = 3;

imageLoader.addEventListener('change', (e) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        imageSrc = event.target.result;
    };
    reader.readAsDataURL(e.target.files[0]);
});

startButton.addEventListener('click', () => {
    if (!imageSrc) {
        alert('Please select an image first!');
        return;
    }
    createPuzzle();
});

function createPuzzle() {
    puzzleContainer.innerHTML = '';
    puzzlePieces = [];
    const pieceSize = puzzleContainer.clientWidth / gridSize;
    
    let piecesData = [];

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            const piece = document.createElement('div');
            piece.classList.add('puzzle-piece');
            piece.style.width = `${pieceSize}px`;
            piece.style.height = `${pieceSize}px`;
            piece.style.backgroundImage = `url(${imageSrc})`;
            
            const backgroundPosX = -j * pieceSize;
            const backgroundPosY = -i * pieceSize;
            piece.style.backgroundPosition = `${backgroundPosX}px ${backgroundPosY}px`;

            const initialTop = i * pieceSize;
            const initialLeft = j * pieceSize;
            
            piecesData.push({
                element: piece,
                initialTop: initialTop,
                initialLeft: initialLeft,
                correctPos: { top: initialTop, left: initialLeft }
            });

            piece.draggable = true;
            addDragListeners(piece);
        }
    }
    
    shuffleAndPlacePieces(piecesData, pieceSize);
}

function shuffleAndPlacePieces(piecesData, pieceSize) {
    const positions = [];
    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            positions.push({ top: i * pieceSize, left: j * pieceSize });
        }
    }

    piecesData.forEach(pieceData => {
        const randomIndex = Math.floor(Math.random() * positions.length);
        const randomPosition = positions.splice(randomIndex, 1)[0];
        
        pieceData.element.style.top = `${randomPosition.top}px`;
        pieceData.element.style.left = `${randomPosition.left}px`;
        
        puzzleContainer.appendChild(pieceData.element);
        puzzlePieces.push(pieceData);
    });
}


let draggedPiece = null;

function addDragListeners(piece) {
    piece.addEventListener('dragstart', (e) => {
        draggedPiece = findPieceDataByElement(e.target);
        setTimeout(() => {
            e.target.style.opacity = '0.5';
        }, 0);
    });

    piece.addEventListener('dragend', (e) => {
        e.target.style.opacity = '1';
        checkCompletion();
    });

    piece.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    piece.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetPiece = findPieceDataByElement(e.target);
        if (draggedPiece && targetPiece && draggedPiece !== targetPiece) {
            swapPieces(draggedPiece, targetPiece);
        }
    });
}

function findPieceDataByElement(element) {
    return puzzlePieces.find(p => p.element === element);
}

function swapPieces(pieceA, pieceB) {
    const tempTop = pieceA.element.style.top;
    const tempLeft = pieceA.element.style.left;

    pieceA.element.style.top = pieceB.element.style.top;
    pieceA.element.style.left = pieceB.element.style.left;

    pieceB.element.style.top = tempTop;
    pieceB.element.style.left = tempLeft;
}

function checkCompletion() {
    let isComplete = true;
    for (const pieceData of puzzlePieces) {
        const currentTop = parseFloat(pieceData.element.style.top);
        const currentLeft = parseFloat(pieceData.element.style.left);
        
        if (Math.abs(currentTop - pieceData.correctPos.top) > 1 || Math.abs(currentLeft - pieceData.correctPos.left) > 1) {
            isComplete = false;
            break;
        }
    }

    if (isComplete) {
        setTimeout(() => alert('성공'), 100);
    }
}
