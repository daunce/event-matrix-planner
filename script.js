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

    // Hardcoded current date for consistency in example, but using new Date() is preferred for live app
    // const MOCK_CURRENT_DATE = new Date('2025-05-20T00:00:00'); // Tuesday, May 20, 2025

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
        // Enable if at least one event is selected (to show "Today" vs that one event)
        produceMatrixBtn.disabled = selectedEventIds.size < 1;
    }

    // --- Matrix Generation and Display ---
    function generateAndDisplayMatrix() {
        // Require at least one actual event to be selected to show with "Today"
        if (selectedEventIds.size < 1) {
            clearMatrix();
            showMessage('Please select at least one race to generate the schedule.', 'info');
            return;
        }

        const currentDate = new Date(); // Use actual current date
        // const currentDate = MOCK_CURRENT_DATE; // For testing with a fixed date
        currentDate.setHours(0, 0, 0, 0); // Normalize to start of day

        const todayEvent = {
            id: 'today',
            name: 'Today',
            dateObj: currentDate,
            isToday: true // Custom flag
        };

        let selectedEventsFromState = Array.from(selectedEventIds)
            .map(id => allEvents.find(event => event.id === id))
            .filter(event => event); // Ensure event exists

        // Combine "Today" with selected events, then sort
        let matrixEvents = [todayEvent, ...selectedEventsFromState].sort((a, b) => a.dateObj - b.dateObj);

        currentMatrixData = []; // Reset for CSV
        const headerRowForCsv = ['x', ...matrixEvents.map(e => e.name)];
        currentMatrixData.push(headerRowForCsv);

        const table = document.createElement('table');
        table.id = 'matrixTable';
        table.className = 'w-full border-collapse text-sm sm:text-base';
        const thead = table.createTHead();
        const headerHtmlRow = thead.insertRow();
        const firstTh = document.createElement('th');
        firstTh.textContent = 'Race'; // Or 'Date'
        headerHtmlRow.appendChild(firstTh);

        matrixEvents.forEach((event, colIndex) => {
            const th = document.createElement('th');
            const eventNameSpan = document.createElement('span');
            eventNameSpan.textContent = event.name;
            if (event.isToday) {
                eventNameSpan.classList.add('today-header');
            }

            th.appendChild(eventNameSpan);

            if (!event.isToday) { // Add date and remove button only for actual events
                const eventDateSpan = document.createElement('span');
                eventDateSpan.className = 'event-date-in-matrix';
                eventDateSpan.textContent = `(${event.dateObj.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit' })})`;
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
        matrixEvents.forEach((event1, rowIndex) => {
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
                eventDateSpan.textContent = `(${event1.dateObj.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit' })})`;
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

            matrixEvents.forEach((event2, colIndex) => {
                const cell = row.insertCell();
                cell.dataset.rowIndex = rowIndex; // For easier identification
                cell.dataset.colIndex = colIndex;

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
        highlightSequentialCells(table, matrixEvents); // Call highlighting function
        exportSection.classList.remove('hidden');
        matrixPrompt.classList.add('hidden');
    }

    function highlightSequentialCells(table, sortedMatrixEvents) {
        // Filter out "Today" event for sequential highlighting logic, if it exists
        const actualEvents = sortedMatrixEvents.filter(event => !event.isToday);
        const eventIdsInOrder = actualEvents.map(e => e.id);
        const eventIdToIndexMap = new Map();
        sortedMatrixEvents.forEach((event, index) => {
            eventIdToIndexMap.set(event.id, index);
        });


        for (let i = 0; i < actualEvents.length - 1; i++) {
            const event1Id = actualEvents[i].id;
            const event2Id = actualEvents[i+1].id;

            // Get the original indices in the full matrixEvents array (including "Today")
            const index1 = eventIdToIndexMap.get(event1Id);
            const index2 = eventIdToIndexMap.get(event2Id);

            if (index1 !== undefined && index2 !== undefined) {
                // Highlight cell (row index1, col index2) and (row index2, col index1)
                // Table indices are 1-based for rows/cols in querySelector, and headers take up a slot
                const cell1 = table.querySelector(`tbody tr:nth-child(${index1 + 1}) td:nth-child(${index2 + 1})`);
                const cell2 = table.querySelector(`tbody tr:nth-child(${index2 + 1}) td:nth-child(${index1 + 1})`);

                if (cell1) cell1.classList.add('highlight-sequential');
                if (cell2) cell2.classList.add('highlight-sequential');
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
        if (selectedEventIds.size < 1) { // If no events left, clear matrix
            clearMatrix();
        } else {
            generateAndDisplayMatrix();
        }
    }

    function calculateWeeksBetween(date1, date2) {
        const diffTime = date2.getTime() - date1.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        // Use Math.round for whole numbers of weeks.
        // Abs is important as the matrix is symmetrical for differences.
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
