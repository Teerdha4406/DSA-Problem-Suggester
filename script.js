document.addEventListener('DOMContentLoaded', () => {
    // DOM Element Selectors
    const topicButtons = document.querySelectorAll('.topic-btn');
    const difficultyRadios = document.querySelectorAll('input[name="difficulty"]');
    const suggestButton = document.getElementById('suggest-btn');
    const getSolutionButton = document.getElementById('get-solution-btn');
    const getHintButton = document.getElementById('get-hint-btn');
    const explainSolutionButton = document.getElementById('explain-solution-btn');
    const translateSolutionButton = document.getElementById('translate-solution-btn');
    const copySolutionButton = document.getElementById('copy-solution-btn');
    const selectedTopicDisplay = document.getElementById('selected-topic-display');
    const loadingIndicator = document.getElementById('loading-indicator');
    const loadingText = document.querySelector('.loading-text');
    const problemText = document.getElementById('problem-text');
    const solutionOutput = document.getElementById('solution-output');
    const solutionCode = document.getElementById('solution-code');
    const explanationOutput = document.getElementById('explanation-output');
    const explanationText = document.getElementById('explanation-text');
    const hintOutput = document.getElementById('hint-output');
    const hintText = document.getElementById('hint-text');
    const translatedCodeOutput = document.getElementById('translated-code-output');
    const translatedCode = document.getElementById('translated-code');

    // Progress Tracker Elements
    const markAsSolvedBtn = document.getElementById('mark-as-solved-btn');
    const solvedCountSpan = document.getElementById('solved-count');
    const solvedBeginnerSpan = document.getElementById('solved-beginner');
    const solvedIntermediateSpan = document.getElementById('solved-intermediate');
    const solvedAdvancedSpan = document.getElementById('solved-advanced');
    const currentStreakSpan = document.getElementById('current-streak');
    const historyList = document.getElementById('history-list');
    const clearProgressBtn = document.getElementById('clear-progress-btn');
    
    // --- REFINER AGENT ELEMENTS ---
    const userCodeInput = document.getElementById('user-code-input');
    const refineCodeBtn = document.getElementById('refine-code-btn');
    const refinerLanguageSelect = document.getElementById('refiner-language-select');
    const refinerOutputPanel = document.getElementById('refiner-output-panel');
    const refinerCritique = document.getElementById('refiner-critique');
    const refinerOptimizedCode = document.getElementById('refiner-optimized-code');
    const refinerRationale = document.getElementById('refiner-rationale');

    // Application State
    let selectedTopic = null;
    let currentProblem = null;
    let currentSolution = null;
    let currentProblemName = null;
    let progress = {
        solvedCount: 0,
        solvedBeginner: 0,
        solvedIntermediate: 0,
        solvedAdvanced: 0,
        currentStreak: 0,
        lastSolvedDate: null,
        history: []
    };

    // API Configuration
    const API_MODEL = 'gemini-2.5-flash-preview-05-20';
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${API_MODEL}:generateContent`;
    const API_KEY = "AIzaSyD1a8rWfgfyUEb9xGJMvmPho4zrhQelXVc";
    // Your API Key

    /**
     * Helper function to perform the API fetch with exponential backoff.
     */
    async function fetchWithBackoff(payload, maxRetries = 3) {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch(`${API_URL}?key=${API_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    const result = await response.json();
                    const candidate = result.candidates?.[0];
                    if (candidate && candidate.content?.parts?.[0]?.text) {
                        return candidate.content.parts[0].text;
                    } else {
                        throw new Error('No content found in the API response.');
                    }
                }

                if (attempt < maxRetries - 1) {
                    const delay = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw new Error(`API call failed with status: ${response.status}`);
                }

            } catch (error) {
                if (attempt === maxRetries - 1) {
                    throw error;
                }
            }
        }
    }

    /**
     * Disables/Enables the secondary action buttons.
     */
    function disableButtons(solutionAvailable = false) {
        getSolutionButton.disabled = !selectedTopic;
        getHintButton.disabled = !selectedTopic;
        explainSolutionButton.disabled = !solutionAvailable;
        translateSolutionButton.disabled = !solutionAvailable;
    }

    /**
     * Hides all dynamic output panels.
     */
    function hideAllOutputs() {
        solutionOutput.classList.add('hidden');
        explanationOutput.classList.add('hidden');
        hintOutput.classList.add('hidden');
        translatedCodeOutput.classList.add('hidden');
        refinerOutputPanel.classList.add('hidden');
    }

    // --- Progress Tracker Functions ---

    function saveProgress() {
        localStorage.setItem('dsaProgress', JSON.stringify(progress));
        updateUI();
    }

    function loadProgress() {
        const savedProgress = localStorage.getItem('dsaProgress');
        if (savedProgress) {
            const loaded = JSON.parse(savedProgress);
            progress = { 
                solvedCount: loaded.solvedCount || 0,
                solvedBeginner: loaded.solvedBeginner || 0,
                solvedIntermediate: loaded.solvedIntermediate || 0,
                solvedAdvanced: loaded.solvedAdvanced || 0,
                currentStreak: loaded.currentStreak || 0,
                lastSolvedDate: loaded.lastSolvedDate || null,
                history: loaded.history || []
            };
        }
        updateUI();
    }

    function updateUI() {
        solvedCountSpan.textContent = progress.solvedCount;
        currentStreakSpan.textContent = progress.currentStreak;
        
        solvedBeginnerSpan.textContent = progress.solvedBeginner;
        solvedIntermediateSpan.textContent = progress.solvedIntermediate;
        solvedAdvancedSpan.textContent = progress.solvedAdvanced;
        
        historyList.innerHTML = '';
        if (progress.history.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.textContent = 'No problems solved yet.';
            emptyItem.className = 'text-gray-500';
            historyList.appendChild(emptyItem);
        } else {
            progress.history.forEach(item => {
                const listItem = document.createElement('li');
                listItem.textContent = `[${item.date}] ${item.topic} ${item.difficulty} - ${item.name}`;
                historyList.appendChild(listItem);
            });
        }
    }

    function markProblemAsSolved() {
        const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
        const today = new Date().toDateString();
        
        const isDuplicate = progress.history.some(item => 
            item.name === currentProblemName && 
            item.difficulty === difficulty && 
            item.date === today
        );

        if (isDuplicate) {
            return;
        }
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = yesterday.toDateString();

        progress.solvedCount++;
        
        if (difficulty === 'Beginner') progress.solvedBeginner++;
        else if (difficulty === 'Intermediate') progress.solvedIntermediate++;
        else if (difficulty === 'Advanced') progress.solvedAdvanced++;

        if (progress.lastSolvedDate === today) {
        } else if (progress.lastSolvedDate === yesterdayString) {
            progress.currentStreak++;
        } else {
            progress.currentStreak = 1;
        }

        progress.lastSolvedDate = today;
        progress.history.unshift({
            date: today,
            topic: selectedTopic,
            name: currentProblemName || 'Unnamed Problem', 
            difficulty: difficulty
        });
        
        if (progress.history.length > 10) {
            progress.history.pop();
        }

        saveProgress();
        markAsSolvedBtn.classList.add('hidden');
        markAsSolvedBtn.textContent = "Mark as Solved";
    }

    function clearProgress() {
        if (confirm("Are you sure you want to clear all your progress? This cannot be undone.")) {
            localStorage.removeItem('dsaProgress');
            progress = { 
                solvedCount: 0,
                solvedBeginner: 0,
                solvedIntermediate: 0,
                solvedAdvanced: 0,
                currentStreak: 0, 
                lastSolvedDate: null, 
                history: [] 
            };
            updateUI();
        }
    }

    // --- Event Listeners ---

    // 1. Topic Selection
    topicButtons.forEach(button => {
        button.addEventListener('click', () => {
            topicButtons.forEach(btn => {
                btn.classList.remove('topic-btn-active');
                btn.classList.add('topic-btn-default');
            });
            
            button.classList.add('topic-btn-active');
            button.classList.remove('topic-btn-default');

            selectedTopic = button.dataset.topic;
            selectedTopicDisplay.textContent = `Selected Topic: ${selectedTopic}`;
            
            currentProblem = null;
            currentSolution = null;
            currentProblemName = null;
            problemText.textContent = 'Your suggested problem will appear here.';
            hideAllOutputs();
            disableButtons();
            markAsSolvedBtn.classList.add('hidden');
        });
    });

    // 2. Suggest Problem
    suggestButton.addEventListener('click', async () => {
        if (!selectedTopic) {
            problemText.innerHTML = '<span class="text-red-500">Please select a topic first.</span>';
            return;
        }

        const selectedDifficulty = document.querySelector('input[name="difficulty"]:checked').value;
        
        loadingIndicator.classList.remove('hidden');
        loadingText.textContent = 'Generating problem...';
        problemText.textContent = '';
        hideAllOutputs();
        disableButtons();
        
        try {
            const systemPrompt = "You are a programming problem generator. Your task is to provide a clear and concise programming problem based on a given topic.";
            const userQuery = `Suggest a unique ${selectedDifficulty} level programming problem on ${selectedTopic}. Structure the response exactly as follows:
            [Problem Name]
            Problem:
            [Problem description text]
            
            Input:
            [Example input text]
            
            Output:
            [Example output text]
            
            Do not add any additional text or headers.`;
            
            const payload = {
                contents: [{ parts: [{ text: userQuery }] }],
                tools: [{ "google_search": {} }],
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
            };

            const responseText = await fetchWithBackoff(payload);
            const lines = responseText.split('\n');
            currentProblemName = lines[0].trim();
            currentProblem = lines.slice(1).join('\n').trim();

            problemText.textContent = responseText;
            
            markAsSolvedBtn.classList.remove('hidden');
            
            disableButtons(false);
        } catch (error) {
            console.error('Error fetching problem:', error);
            problemText.innerHTML = '<span class="text-red-500">Failed to generate a problem. Please try again.</span>';
            disableButtons();
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    });
    
    // 3. Get Solution
    getSolutionButton.addEventListener('click', async () => {
        if (!currentProblem) return;
        
        loadingIndicator.classList.remove('hidden');
        loadingText.textContent = 'Generating Java solution...';
        hideAllOutputs();

        try {
            const systemPrompt = "You are a senior software engineer. Your task is to provide a correct, well-commented code solution in Java for a given programming problem. Only provide the code, and ensure it is formatted in a markdown code block.";
            const userQuery = `Provide a Java solution to the following programming problem:\n\n${currentProblem}`;
            
            const payload = {
                contents: [{ parts: [{ text: userQuery }] }],
                tools: [{ "google_search": {} }],
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
            };

            currentSolution = await fetchWithBackoff(payload);
            solutionCode.textContent = currentSolution;
            solutionOutput.classList.remove('hidden');
            disableButtons(true);
        } catch (error) {
            console.error('Error fetching solution:', error);
            solutionCode.textContent = 'Failed to generate a solution. Please try again.';
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    });

    // 4. Get Hint
    getHintButton.addEventListener('click', async () => {
        if (!currentProblem) return;
        
        loadingIndicator.classList.remove('hidden');
        loadingText.textContent = 'Generating hint...';
        hideAllOutputs();
        
        try {
            const systemPrompt = "You are a helpful coding assistant. Your task is to provide a subtle hint for a programming problem without giving away the complete solution. Focus on a key data structure, algorithm, or a specific step in the thought process.";
            const userQuery = `Provide a subtle hint for the following programming problem:\n\n${currentProblem}`;
            
            const payload = {
                contents: [{ parts: [{ text: userQuery }] }],
                tools: [{ "google_search": {} }],
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
            };

            hintText.textContent = await fetchWithBackoff(payload);
            hintOutput.classList.remove('hidden');
        } catch (error) {
            console.error('Error fetching hint:', error);
            hintText.textContent = 'Failed to generate a hint. Please try again.';
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    });

    // 5. Explain Solution
    explainSolutionButton.addEventListener('click', async () => {
        if (!currentProblem || !currentSolution) return;
        
        loadingIndicator.classList.remove('hidden');
        loadingText.textContent = 'Explaining solution...';
        hideAllOutputs();
        
        try {
            const systemPrompt = "You are a programming tutor. Your task is to provide a clear, step-by-step explanation of a given code solution for a programming problem. Break down the logic and how the code solves the problem. Provide the explanation in plain text without code blocks.";
            const userQuery = `Explain the following Java solution for this problem:\n\nProblem:\n${currentProblem}`;
            
            const payload = {
                contents: [{ parts: [{ text: userQuery }] }],
                tools: [{ "google_search": {} }],
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
            };

            explanationText.textContent = await fetchWithBackoff(payload);
            explanationOutput.classList.remove('hidden');
        } catch (error) {
            console.error('Error fetching explanation:', error);
            explanationText.textContent = 'Failed to generate an explanation. Please try again.';
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    });

    // 6. Translate to Python
    translateSolutionButton.addEventListener('click', async () => {
        if (!currentSolution) return;
        
        loadingIndicator.classList.remove('hidden');
        loadingText.textContent = 'Translating to Python...';
        hideAllOutputs();
        
        try {
            const systemPrompt = "You are a programming language translator. Your task is to translate a given Java code solution into a correct, well-commented Python solution. Only provide the Python code, formatted in a markdown code block.";
            const userQuery = `Translate the following Java code to Python:\n\n${currentSolution}`;
            
            const payload = {
                contents: [{ parts: [{ text: userQuery }] }],
                tools: [{ "google_search": {} }],
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
            };

            translatedCode.textContent = await fetchWithBackoff(payload);
            translatedCodeOutput.classList.remove('hidden');
        } catch (error) {
            console.error('Error fetching translated code:', error);
            translatedCode.textContent = 'Failed to translate the solution. Please try again.';
        } finally {
            loadingIndicator.classList.add('hidden');
        }
    });

    // --- Progress Tracker Event Listeners ---
    markAsSolvedBtn.addEventListener('click', markProblemAsSolved);
    clearProgressBtn.addEventListener('click', clearProgress);

    // Copy to clipboard functionality
    copySolutionButton.addEventListener('click', async () => {
        if (!currentSolution) return;

        try {
            await navigator.clipboard.writeText(currentSolution);
            copySolutionButton.textContent = 'Copied!';
            setTimeout(() => {
                copySolutionButton.textContent = 'Copy';
            }, 2000);
        } catch (error) {
            console.error('Failed to copy text:', error);
            copySolutionButton.textContent = 'Error';
        }
    });
    
    // --- REFINER AGENT EVENT LISTENERS (FIXED with Sequential Calls) ---

    userCodeInput.addEventListener('input', () => {
        refineCodeBtn.disabled = userCodeInput.value.trim().length === 0;
    });

    refineCodeBtn.addEventListener('click', async () => {
        const userCode = userCodeInput.value.trim();
        const language = refinerLanguageSelect.value;
        
        if (userCode.length === 0) return;

        refineCodeBtn.disabled = true;
        loadingIndicator.classList.remove('hidden');
        refinerOutputPanel.classList.remove('hidden');
        
        // Clear previous results
        refinerCritique.textContent = "Analyzing critique...";
        refinerOptimizedCode.textContent = "Waiting for critique...";
        refinerRationale.textContent = "Waiting for critique...";

        try {
            // --- STEP 1: Get Critique ---
            loadingText.textContent = 'Refiner Agent is analyzing critique & complexity...';
            const critiquePrompt = {
                contents: [{ parts: [{ text: `Analyze the following ${language} code and critique its time/space complexity and style. Return only the critique as plain text.\n\nUser Code:\n${userCode}` }] }],
                systemInstruction: { parts: [{ text: "You are a code critic. Return only the critique." }] },
            };
            const critiqueResponse = await fetchWithBackoff(critiquePrompt);
            refinerCritique.textContent = critiqueResponse;

            // --- STEP 2: Get Optimized Code ---
            loadingText.textContent = 'Refiner Agent is generating optimized solution...';
            const optimizerPrompt = {
                contents: [{ parts: [{ text: `Based on this ${language} code:\n\n${userCode}\n\nProvide the optimized code solution. Return only the code, formatted as a markdown code block for ${language}.` }] }],
                systemInstruction: { parts: [{ text: "You are a code optimizer. Return only the code block." }] },
            };
            const optimizedCodeResponse = await fetchWithBackoff(optimizerPrompt);
            refinerOptimizedCode.textContent = optimizedCodeResponse;

            // --- STEP 3: Get Rationale ---
            loadingText.textContent = 'Refiner Agent is explaining improvements...';
            const rationalePrompt = {
                contents: [{ parts: [{ text: `Explain why this optimized code:\n\n${optimizedCodeResponse}\n\nis better than this original code:\n\n${userCode}\n\nFocus on the complexity and rationale. Return only the explanation.` }] }],
                systemInstruction: { parts: [{ text: "You are a code tutor. Return only the rationale." }] },
            };
            const rationaleResponse = await fetchWithBackoff(rationalePrompt);
            refinerRationale.textContent = rationaleResponse;

        } catch (error) {
            console.error('Refiner API error:', error);
            refinerCritique.textContent = `Error: ${error.message}. Could not refine code.`;
            refinerOptimizedCode.textContent = "N/A";
            refinerRationale.textContent = "N/A";
        } finally {
            loadingIndicator.classList.add('hidden');
            refineCodeBtn.disabled = false;
        }
    });

    // Initial state setup
    loadProgress();
    disableButtons();
});



