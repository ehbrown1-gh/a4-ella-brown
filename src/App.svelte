<script>
    import { onMount } from "svelte";

    // -----------------------------
    // Game settings
    // -----------------------------

    const gameWidth = 500;
    const gameHeight = 500;
    const boardBackground = "lightgreen";
    const snakeColor = "purple";
    const foodColor = "red";
    const unitSize = 25;

    // Canvas
    let gameBoard;
    let ctx;

    // Game state
    let running = false;
    let xVelocity = unitSize;
    let yVelocity = 0;

    let foodX;
    let foodY;

    let score = 0;

    let snake = [
        { x: unitSize, y: 0 },
        { x: 0, y: 0 }
    ];

    let gameStatus = "Use the arrow keys to move.";

    // -----------------------------
    // Server / leaderboard state
    // -----------------------------

    let results = [];
    let name = "";
    let scoreInput = 0;
    let comment = "";

    $: scoredEntries = results
        .filter(item => Number(item.score) > 0)
        .sort((a, b) => Number(b.score) - Number(a.score));

    // -----------------------------
    // Start application
    // -----------------------------

    onMount(() => {
        ctx = gameBoard.getContext("2d");

        loadData();
        gameStart();

        window.addEventListener("keydown", changeDirection);

        return () => {
            window.removeEventListener("keydown", changeDirection);
            running = false;
        };
    });

    // -----------------------------
    // API functions
    // -----------------------------

    async function loadData() {
        try {
            const response = await fetch("/api/data");
            const data = await response.json();

            results = data;
        } catch (error) {
            console.error("Could not load data:", error);
        }
    }

    async function sendEntry(entry) {
        const response = await fetch("/api/data", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(entry)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Could not save entry.");
        }

        results = data;
    }

    async function submitScore(event) {
        event.preventDefault();

        try {
            await sendEntry({
                name,
                score: Number(scoreInput),
                comment
            });

            // Reset the form
            name = "";
            comment = "";
            scoreInput = score;

            alert("Your score was added to the leaderboard!");
        } catch (error) {
            alert(error.message);
        }
    }

    async function deleteEntry(index) {
        if (!confirm("Delete this entry?")) {
            return;
        }

        try {
            const response = await fetch("/api/data", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ index })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.error || "Could not delete entry.");
                return;
            }

            results = data;
        } catch (error) {
            alert(error.message);
        }
    }

    async function editEntry(index, item) {
        const newName = prompt("Name:", item.name);

        if (newName === null) {
            return;
        }

        const scoreValue = prompt("Score:", item.score);

        if (scoreValue === null) {
            return;
        }

        const newComment = prompt(
            "Comment:",
            item.comment || ""
        );

        if (newComment === null) {
            return;
        }

        try {
            const response = await fetch("/api/data", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    index,
                    name: newName,
                    score: Number(scoreValue),
                    comment: newComment,
                    submittedAt: item.submittedAt
                })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.error || "Could not update entry.");
                return;
            }

            results = data;
        } catch (error) {
            alert(error.message);
        }
    }

    // -----------------------------
    // Snake game
    // -----------------------------

    function gameStart() {
        running = true;
        score = 0;
        gameStatus = "Use the arrow keys to move.";

        createFood();
        clearBoard();
        drawFood();
        drawSnake();

        nextTick();
    }

    function nextTick() {
        if (!running) {
            displayGameOver();
            return;
        }

        setTimeout(() => {
            clearBoard();
            drawFood();
            moveSnake();
            drawSnake();
            checkGameOver();
            nextTick();
        }, 75);
    }

    function clearBoard() {
        if (!ctx) return;

        ctx.fillStyle = boardBackground;
        ctx.fillRect(
            0,
            0,
            gameWidth,
            gameHeight
        );
    }

    function createFood() {
        function randomFood(min, max) {
            return (
                Math.floor(
                    (Math.random() * (max - min) + min) /
                    unitSize
                ) * unitSize
            );
        }

        foodX = randomFood(0, gameWidth - unitSize);
        foodY = randomFood(0, gameHeight - unitSize);
    }

    function drawFood() {
        if (!ctx) return;

        ctx.fillStyle = foodColor;

        ctx.fillRect(
            foodX,
            foodY,
            unitSize,
            unitSize
        );
    }

    function moveSnake() {
        const head = {
            x: snake[0].x + xVelocity,
            y: snake[0].y + yVelocity
        };

        snake = [head, ...snake];

        if (
            snake[0].x === foodX &&
            snake[0].y === foodY
        ) {
            score += 1;
            createFood();
        } else {
            snake.pop();
        }
    }

    function drawSnake() {
        if (!ctx) return;

        ctx.fillStyle = snakeColor;

        snake.forEach(snakePart => {
            ctx.fillRect(
                snakePart.x,
                snakePart.y,
                unitSize,
                unitSize
            );
        });
    }

    function changeDirection(event) {
        const keyPressed = event.key;

        const goingUp = yVelocity === -unitSize;
        const goingDown = yVelocity === unitSize;
        const goingRight = xVelocity === unitSize;
        const goingLeft = xVelocity === -unitSize;

        if (
            keyPressed === "ArrowLeft" &&
            !goingRight
        ) {
            xVelocity = -unitSize;
            yVelocity = 0;
        }

        else if (
            keyPressed === "ArrowUp" &&
            !goingDown
        ) {
            xVelocity = 0;
            yVelocity = -unitSize;
        }

        else if (
            keyPressed === "ArrowRight" &&
            !goingLeft
        ) {
            xVelocity = unitSize;
            yVelocity = 0;
        }

        else if (
            keyPressed === "ArrowDown" &&
            !goingUp
        ) {
            xVelocity = 0;
            yVelocity = unitSize;
        }
    }

    function checkGameOver() {
        // Hit wall
        if (
            snake[0].x < 0 ||
            snake[0].x >= gameWidth ||
            snake[0].y < 0 ||
            snake[0].y >= gameHeight
        ) {
            running = false;
            return;
        }

        // Hit itself
        for (let i = 1; i < snake.length; i += 1) {
            if (
                snake[i].x === snake[0].x &&
                snake[i].y === snake[0].y
            ) {
                running = false;
                return;
            }
        }
    }

    function displayGameOver() {
        if (!ctx) return;

        ctx.font = "75px 'Caudex', serif";
        ctx.fillStyle = "black";
        ctx.textAlign = "center";

        ctx.fillText(
            "GAME OVER",
            gameWidth / 2,
            gameHeight / 2
        );

        gameStatus = "Game over! Press Reset Game to play again.";
        running = false;
    }

    function resetGame() {
        xVelocity = unitSize;
        yVelocity = 0;

        snake = [
            { x: unitSize, y: 0 },
            { x: 0, y: 0 }
        ];

        gameStart();
    }
</script>

<svelte:head>
    <link
        href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&display=swap"
        rel="stylesheet"
    />

    <link
        href="https://unpkg.com/nes.css@2.3.0/css/nes.min.css"
        rel="stylesheet"
    />
</svelte:head>

<header>
    <h1>Eat the Apple</h1>
</header>

<main class="page-layout">

    <!-- GAME -->
    <div class="nes-container with-title is-centered card" id="game-box">

        <canvas
            bind:this={gameBoard}
            width="500"
            height="500"
            id="game-board"
        ></canvas>

        <div id="score-text">
            {score}
        </div>

        <p id="game-status">
            {gameStatus}
        </p>

        <button
            type="button"
            class="nes-btn is-warning reset-button"
            on:click={resetGame}
        >
            Reset Game
        </button>
    </div>


    <!-- SUBMIT SCORE -->
    <div class="nes-container with-title is-centered card">

        <h2>Submit Your Score</h2>

        <form on:submit={submitScore}>

            <label for="game-name">
                Name
            </label>

            <input
                type="text"
                id="game-name"
                maxlength="40"
                placeholder="ex. epicgamer01"
                bind:value={name}
                required
            />

            <label for="score-input">
                Score
            </label>

            <input
                type="number"
                id="score-input"
                min="0"
                step="1"
                bind:value={scoreInput}
                required
            />

            <label for="score-comment">
                Comment
            </label>

            <textarea
                id="score-comment"
                maxlength="300"
                placeholder="How did you do? What game should I make next?"
                bind:value={comment}
            ></textarea>

            <button
                type="submit"
                class="nes-btn is-warning"
            >
                Add Score
            </button>

        </form>
    </div>


    <!-- LEADERBOARD -->
    <div class="nes-container with-title is-centered card results-card">

        <h2>High Scores</h2>

        <ol class="leaderboard">

            {#if scoredEntries.length === 0}

                <li>
                    No scores yet. Be the first!
                </li>

            {:else}

                {#each scoredEntries.slice(0, 10) as item}

                    <li>
                        <strong>{item.name}</strong>
                        — {item.score} points
                    </li>

                {/each}

            {/if}

        </ol>

    </div>


    <!-- SERVER DATA -->
    <div class="nes-container with-title is-centered card">

        <h2>Server Data</h2>

        <div class="table-wrapper">

            <table>

                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Score</th>
                        <th>Comment</th>
                        <th>Submitted</th>
                        <th>Score Level</th>
                        <th>Actions</th>
                    </tr>
                </thead>

                <tbody>

                    {#each results as item, index}

                        <tr>

                            <td>{item.name}</td>

                            <td>{item.score}</td>

                            <td>{item.comment || ""}</td>

                            <td>
                                {new Date(
                                    item.submittedAt
                                ).toLocaleString()}
                            </td>

                            <td>
                                {item.scoreLevel}
                            </td>

                            <td class="actions">

                                <button
                                    type="button"
                                    class="edit-button"
                                    on:click={() =>
                                        editEntry(index, item)
                                    }
                                >
                                    Edit
                                </button>

                                <button
                                    type="button"
                                    class="delete-button"
                                    on:click={() =>
                                        deleteEntry(index)
                                    }
                                >
                                    Delete
                                </button>

                            </td>

                        </tr>

                    {/each}

                </tbody>

            </table>

        </div>

    </div>

</main>

<style>
    main {
        background: #f4f1e8;
        text-align: center;
        padding: 1em;
        max-width: 240px;
        margin: 0 auto;
    }

    h1 {
        font-size: 4em;
        font-weight: 100;
        margin: 0;
        font-family: "Pixelify Sans", sans-serif;
        text-align: center;
    }

    @media (min-width: 640px) {
        main {
            max-width: none;
        }
    }

    * {
        box-sizing: border-box;
    }

    :global(body) {
        margin: 0;
        background: #f4f1e8;
        color: #211b16;
        font-family: "Caudex", Georgia, serif;
    }

    header {
        text-align: center;
        padding: 24px 16px 8px;
    }

    h2 {
        margin-top: 0;
        font-family: "Pixelify Sans", sans-serif;
    }

    .page-layout {
        width: min(1200px, 94%);
        margin: 0 auto 40px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        align-items: start;
    }

    .card {
        background: white;
        padding: 20px;
    }

    #game-box {
        text-align: center;
    }

    #game-board {
        display: block;
        width: 100%;
        max-width: 500px;
        height: auto;
        margin: 0 auto;
        border: 12px solid saddlebrown;
        border-radius: 15px;
    }

    #score-text {
        font-family: "Caudex", sans-serif;
        font-size: 65px;
        line-height: 1;
        margin: 12px 0;
    }

    #game-status {
        min-height: 24px;
    }

    button,
    input,
    textarea {
        font: inherit;
    }

    button {
        border-radius: 10px;
        padding: 10px 16px;
        font-family: "Pixelify Sans", sans-serif;
    }

    .reset-button,
    form button {
        font-size: 20px;
    }

    form {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    form label {
        font-weight: 700;
        margin-top: 5px;
        font-size: 20px;
        text-align: left;
    }

    input,
    textarea {
        width: 100%;
        border: 2px solid #211b16;
        border-radius: 8px;
        padding: 10px;
        background: #fffdf7;
    }

    textarea {
        min-height: 90px;
        resize: vertical;
    }

    .results-card {
        grid-column: 1 / -1;
    }

    .leaderboard {
        margin: 0;
        padding-left: 28px;
        display: grid;
        gap: 8px;
        font-size: 18px;
    }

    .table-wrapper {
        overflow-x: auto;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        min-width: 760px;
    }

    th,
    td {
        border: 1px solid #211b16;
        padding: 10px;
        text-align: left;
        vertical-align: top;
    }

    th {
        font-family: "Pixelify Sans", sans-serif;
    }

    .actions {
        white-space: nowrap;
    }

    .edit-button,
    .delete-button {
        padding: 6px 10px;
        margin-right: 4px;
    }

    .edit-button {
        background: #eee;
    }

    .delete-button {
        background: #f3d2d2;
    }

    @media (max-width: 800px) {
        .page-layout {
            grid-template-columns: 1fr;
        }

        .results-card {
            grid-column: auto;
        }

        h1 {
            font-size: 38px;
        }
    }
</style>