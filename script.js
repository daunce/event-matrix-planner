// script.js
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const stateFiltersContainer = document.getElementById('stateFilters');
    const typeFiltersContainer = document.getElementById('typeFilters');
    const eventsContainer = document.getElementById('eventsContainer');
    const noEventsMessage = document.getElementById('noEventsMessage');
    const produceMatrixBtn = document.getElementById('produceMatrixBtn');
    const clearSelectionsBtn = document.getElementById('clearSelectionsBtn');
    const matrixContainer = document.getElementById('matrixContainer');
    const matrixPrompt = document.getElementById('matrixPrompt');
    const exportSection = document.getElementById('exportSection');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const messageArea = document.getElementById('messageArea');

    // Application State
    let allEvents = [];
    let selectedEventIds = new Set();
    let currentMatrixData = []; // For CSV export
    let activeStateFilter = 'All';
    let activeTypeFilter = 'All';

    // --- Initialization ---
    async function initializeApp() {
        try {
            const response = await fetch('events.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allEvents = await response.json();
            allEvents.forEach(event => event.dateObj = new Date(event.date));
            allEvents.sort((a, b) => a.dateObj - b.dateObj);

            populateStateFilters();
            populateTypeFilters();
            renderEvents();
            setupEventListeners();
        } catch (error) {
            console.error("Failed to load events:", error);
            showMessage(`Error loading events: ${error.message}`, 'error');
            noEventsMessage.textContent = "Could not load event data. Please try again later.";
            noEventsMessage.classList.remove('hidden');
        }
    }

    // --- Filter Population ---
    function populateStateFilters() {
        const states = ['All', ...new Set(allEvents.map(event => event.state))].sort((a, b) => {
            if (a === 'All') return -1;
            if (b === 'All') return 1;
            return a.localeCompare(b);
        });
        states.forEach(state => {
            const button = createFilterButton(state, 'state', state === activeStateFilter);
            button.addEventListener('click', () => {
                activeStateFilter = state;
                document.querySelectorAll('#stateFilters .state-button').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                renderEvents();
                clearMatrix();
            });
            stateFiltersContainer.appendChild(button);
        });
    }

    function populateTypeFilters() {
        const types = ['All', ...new Set(allEvents.map(event => event.type))].sort((a, b) => {
            if (a === 'All') return -1;
            if (b === 'All') return 1;
            return a.localeCompare(b);
        });
        types.forEach(type => {
            const button = createFilterButton(type, 'type', type === activeTypeFilter);
            button.addEventListener('click', () => {
                activeTypeFilter = type;
                document.querySelectorAll('#typeFilters .filter-button').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                renderEvents();
                clearMatrix();
            });
            typeFiltersContainer.appendChild(button);
        });
    }

    function createFilterButton(text, typeClass, isActive) {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = `px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-200 transition duration-150 ease-in-out ${typeClass}-button`;
        if (isActive) {
            button.classList.add('active');
        }
        return button;
    }

    // --- Event Rendering ---
    function renderEvents() {
        eventsContainer.innerHTML = '';
        const filteredEvents = allEvents.filter(event =>
            (activeStateFilter === 'All' || event.state === activeStateFilter) &&
            (activeTypeFilter === 'All' || event.type === activeTypeFilter)
        );

        if (filteredEvents.length === 0) {
            noEventsMessage.classList.remove('hidden');
        } else {
            noEventsMessage.classList.add('hidden');
            filteredEvents.forEach(event => {
                const button = document.createElement('button');
                button.className = 'event-button text-left p-3 border border-gray-300 rounded-lg hover:shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-400 flex flex-col items-start';
                button.dataset.eventId = event.id;

                const displayDate = event.dateObj.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
                let logoHtml = '';
                if (event.logoUrl) {
                    logoHtml = `<img src="${event.logoUrl}" alt="${event.brand || 'Event'} Logo" class="max-h-5 mb-1 inline-block object-contain" onerror="this.style.display='none'">`;
                }

                const eventInfoDiv = document.createElement('div');
                const eventNameSpan = document.createElement('span');
                eventNameSpan.className = 'font-semibold block';
                eventNameSpan.textContent = event.name;

                const eventDateSpan = document.createElement('span');
                eventDateSpan.className = 'text-sm text-gray-600';
                eventDateSpan.textContent = displayDate;

                if (logoHtml) {
                    const logoElement = document.createElement('div');
                    logoElement.innerHTML = logoHtml;
                    button.appendChild(logoElement);
                }
                eventInfoDiv.appendChild(eventNameSpan);
                eventInfoDiv.appendChild(eventDateSpan);
                button.appendChild(eventInfoDiv);

                if (selectedEventIds.has(event.id)) {
                    button.classList.add('selected');
                }
                button.addEventListener('click', () => toggleEventSelection(event.id, button));
                eventsContainer.appendChild(button);
            });
        }
        updateProduceMatrixButtonState();
    }

    // --- Event Selection Logic ---
    function toggleEventSelection(eventId, buttonElement) {
        if (selectedEventIds.has(eventId)) {
            selectedEventIds.delete(eventId);
            buttonElement.classList.remove('selected');
        } else {
            selectedEventIds.add(eventId);
            buttonElement.classList.add('selected');
        }
        updateProduceMatrixButtonState();
        if (matrixContainer.querySelector('table')) {
            generateAndDisplayMatrix();
        }
    }

    function updateProduceMatrixButtonState() {
        produceMatrixBtn.disabled = selectedEventIds.size < 1;
    }

    // --- Matrix Generation and Display ---
    function generateAndDisplayMatrix() {
        if (selectedEventIds.size < 1) {
            clearMatrix();
            showMessage('Please select at least one race to generate the schedule.', 'info');
            return;
        }

        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        const todayEvent = {
            id: 'today',
            name: 'Today',
            dateObj: currentDate,
            isToday: true
        };

        let selectedEventsFromState = Array.from(selectedEventIds)
            .map(id => allEvents.find(event => event.id === id))
            .filter(event => event);

        let matrixEvents = [todayEvent, ...selectedEventsFromState].sort((a, b) => a.dateObj - b.dateObj);

        currentMatrixData = [];
        const headerRowForCsv = ['x', ...matrixEvents.map(e => e.name)];
        currentMatrixData.push(headerRowForCsv);

        const table = document.createElement('table');
        table.id = 'matrixTable';
        table.className = 'w-full border-collapse text-sm sm:text-base';
        const thead = table.createTHead();
        const headerHtmlRow = thead.insertRow();
        const firstTh = document.createElement('th');
        firstTh.textContent = 'Race';
        headerHtmlRow.appendChild(firstTh);

        matrixEvents.forEach((event) => {
            const th = document.createElement('th');
            const eventNameSpan = document.createElement('span');
            eventNameSpan.textContent = event.name;
            if (event.isToday) {
                eventNameSpan.classList.add('today-header');
            }
            th.appendChild(eventNameSpan);

            if (!event.isToday) {
                const eventDateSpan = document.createElement('span');
                eventDateSpan.className = 'event-date-in-matrix';
                // UPDATED DATE FORMAT HERE: DD/MM/YY
                eventDateSpan.textContent = `(${event.dateObj.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: '2-digit' })})`;
                th.appendChild(eventDateSpan);

                const removeBtn = document.createElement('span');
                removeBtn.textContent = 'x';
                removeBtn.className = 'remove-event-btn';
                removeBtn.title = `Remove ${event.name} from matrix`;
                removeBtn.dataset.eventIdToRemove = event.id;
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    removeEventFromMatrix(event.id);
                };
                th.appendChild(removeBtn);
            }
            headerHtmlRow.appendChild(th);
        });

        const tbody = table.createTBody();
        matrixEvents.forEach((event1) => {
            const row = tbody.insertRow();
            const rowDataForCsv = [event1.name];

            const thRowHeader = document.createElement('th');
            thRowHeader.scope = 'row';
            const eventNameSpan = document.createElement('span');
            eventNameSpan.textContent = event1.name;
            if (event1.isToday) {
                eventNameSpan.classList.add('today-header');
            }
            thRowHeader.appendChild(eventNameSpan);

            if (!event1.isToday) {
                const eventDateSpan = document.createElement('span');
                eventDateSpan.className = 'event-date-in-matrix';
                // UPDATED DATE FORMAT HERE: DD/MM/YY
                eventDateSpan.textContent = `(${event1.dateObj.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: '2-digit' })})`;
                thRowHeader.appendChild(eventDateSpan);

                const removeBtn = document.createElement('span');
                removeBtn.textContent = 'x';
                removeBtn.className = 'remove-event-btn';
                removeBtn.title = `Remove ${event1.name} from matrix`;
                removeBtn.dataset.eventIdToRemove = event1.id;
                removeBtn.onclick = (e) => {
                    e.stopPropagation();
                    removeEventFromMatrix(event1.id);
                };
                thRowHeader.appendChild(removeBtn);
            }
            row.appendChild(thRowHeader);

            matrixEvents.forEach((event2) => {
                const cell = row.insertCell();
                if (event1.id === event2.id) {
                    cell.textContent = '0';
                    rowDataForCsv.push('0');
                } else {
                    const weeksDiff = calculateWeeksBetween(event1.dateObj, event2.dateObj);
                    cell.textContent = weeksDiff;
                    rowDataForCsv.push(weeksDiff.toString());
                }
            });
            currentMatrixData.push(rowDataForCsv);
        });

        matrixContainer.innerHTML = '';
        matrixContainer.appendChild(table);
        highlightSequentialCells(table, matrixEvents);
        exportSection.classList.remove('hidden');
        matrixPrompt.classList.add('hidden');
    }

    function highlightSequentialCells(table, sortedMatrixEvents) {
        // actualEvents are the user-selected races, sorted by date.
        const actualEvents = sortedMatrixEvents.filter(event => !event.isToday);
        
        // Create a map of event IDs to their final index in the sortedMatrixEvents array (which includes "Today")
        // This map is crucial for finding the correct row/column in the displayed table.
        const eventIdToFullMatrixIndexMap = new Map();
        sortedMatrixEvents.forEach((event, index) => {
            eventIdToFullMatrixIndexMap.set(event.id, index);
        });

        // Iterate through the sequence of actual selected races
        for (let i = 0; i < actualEvents.length - 1; i++) {
            const currentRace = actualEvents[i];    // This is Race_i
            const nextRace = actualEvents[i+1]; // This is Race_{i+1}

            // Get their indices in the full matrix (which includes "Today")
            // These indices correspond to the 0-based row/column in the `matrixEvents` array
            const rowIndexForNextRace = eventIdToFullMatrixIndexMap.get(nextRace.id);
            const colIndexForCurrentRace = eventIdToFullMatrixIndexMap.get(currentRace.id);

            if (rowIndexForNextRace !== undefined && colIndexForCurrentRace !== undefined) {
                // Table cell indices are 1-based for querySelector (because of the header row/column in the HTML table structure)
                // The first `td` in a `tr` corresponds to the first data column (after the row header `th`)
                // So, `td:nth-child(${colIndexForCurrentRace + 1})` targets the correct data cell.
                // `tr:nth-child(${rowIndexForNextRace + 1})` targets the correct row in `tbody`.
                const cellToHighlight = table.querySelector(`tbody tr:nth-child(${rowIndexForNextRace + 1}) td:nth-child(${colIndexForCurrentRace + 1})`);
                
                if (cellToHighlight) {
                    cellToHighlight.classList.add('highlight-sequential');
                }
            }
        }
    }


    function removeEventFromMatrix(eventIdToRemove) {
        selectedEventIds.delete(eventIdToRemove);
        const eventButton = eventsContainer.querySelector(`.event-button[data-event-id="${eventIdToRemove}"]`);
        if (eventButton) {
            eventButton.classList.remove('selected');
        }
        updateProduceMatrixButtonState();
        if (selectedEventIds.size < 1) {
            clearMatrix();
        } else {
            generateAndDisplayMatrix();
        }
    }

    function calculateWeeksBetween(date1, date2) {
        const diffTime = date2.getTime() - date1.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return Math.abs(Math.round(diffDays / 7));
    }

    function clearMatrix() {
        matrixContainer.innerHTML = '';
        matrixContainer.appendChild(matrixPrompt);
        matrixPrompt.classList.remove('hidden');
        exportSection.classList.add('hidden');
        currentMatrixData = [];
    }

    function setupEventListeners() {
        produceMatrixBtn.addEventListener('click', generateAndDisplayMatrix);

        clearSelectionsBtn.addEventListener('click', () => {
            selectedEventIds.clear();
            document.querySelectorAll('.event-button.selected').forEach(btn => btn.classList.remove('selected'));
            updateProduceMatrixButtonState();
            clearMatrix();
            showMessage('All selections cleared.', 'success');
        });

        exportCsvBtn.addEventListener('click', exportMatrixToCsv);
    }

    function exportMatrixToCsv() {
        if (currentMatrixData.length === 0) {
            showMessage('No matrix data to export.', 'warn');
            return;
        }
        let csvContent = "data:text/csv;charset=utf-8,";
        currentMatrixData.forEach(rowArray => {
            let row = rowArray.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",");
            csvContent += row + "\r\n";
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "race_schedule_matrix.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showMessage('Matrix exported to CSV.', 'success');
    }

    function showMessage(message, type = 'info') {
        messageArea.textContent = message;
        messageArea.classList.remove('hidden', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500');
        switch (type) {
            case 'success': messageArea.classList.add('bg-green-500'); break;
            case 'warn': messageArea.classList.add('bg-yellow-500'); break;
            case 'error': messageArea.classList.add('bg-red-500'); break;
            default: messageArea.classList.add('bg-blue-500'); break;
        }
        messageArea.classList.remove('hidden');
        setTimeout(() => { messageArea.classList.add('hidden'); }, 3000);
    }

    initializeApp();
});
