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
    let currentMatrixData = [];
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
            // Pre-parse dates and sort events by date
            allEvents.forEach(event => event.dateObj = new Date(event.date));
            allEvents.sort((a, b) => a.dateObj - b.dateObj); // Sort events chronologically

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
            if (a === 'All') return -1; // Keep 'All' first
            if (b === 'All') return 1;
            return a.localeCompare(b); // Sort other states alphabetically
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
            if (a === 'All') return -1; // Keep 'All' first
            if (b === 'All') return 1;
            return a.localeCompare(b); // Sort other types alphabetically
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
        eventsContainer.innerHTML = ''; // Clear previous events
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
                button.className = 'event-button text-left p-3 border border-gray-300 rounded-lg hover:shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-400';
                button.dataset.eventId = event.id;

                // Format date as DD/MM/YYYY for display
                const displayDate = event.dateObj.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });

                // Add brand icon/text
                let iconHtml = '';
                if (event.brand) {
                    let brandText = '';
                    switch (event.brand) {
                        case '2XU':
                            brandText = '[2XU]';
                            break;
                        case 'IM':
                            brandText = '[M•]'; // M-dot style for Ironman
                            break;
                        case 'IM703':
                            brandText = '[70.3]';
                            break;
                    }
                    if (brandText) {
                        // Using a simple span for the icon text. For actual logos, you might use <img> or inline SVGs.
                        iconHtml = `<span class="brand-icon mr-2 text-xs font-semibold text-indigo-600">${brandText}</span>`;
                    }
                }

                button.innerHTML = `
                    <span class="font-semibold block">${iconHtml}${event.name}</span>
                    <span class="text-sm text-gray-600">${displayDate}</span>
                `;

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
        if (matrixContainer.querySelector('table')) { // If matrix is visible, update it
            generateAndDisplayMatrix();
        }
    }

    function updateProduceMatrixButtonState() {
        produceMatrixBtn.disabled = selectedEventIds.size < 2;
    }

    // --- Matrix Generation and Display ---
    function generateAndDisplayMatrix() {
        if (selectedEventIds.size < 2) {
            clearMatrix();
            if (selectedEventIds.size > 0 && selectedEventIds.size < 2) {
                 showMessage('Please select at least two events to generate the matrix.', 'info');
            }
            return;
        }

        const selectedEventsFromState = Array.from(selectedEventIds)
                                           .map(id => allEvents.find(event => event.id === id))
                                           .filter(event => event); // Ensure event exists

        // Sort selected events by their date for matrix display
        const selectedEvents = selectedEventsFromState.sort((a, b) => a.dateObj - b.dateObj);

        currentMatrixData = [];
        const headerRowForCsv = ['x', ...selectedEvents.map(e => e.name)]; // For CSV
        currentMatrixData.push(headerRowForCsv);


        const table = document.createElement('table');
        table.id = 'matrixTable';
        table.className = 'w-full border-collapse text-sm sm:text-base';

        // Create table header
        const thead = table.createTHead();
        const headerHtmlRow = thead.insertRow();
        // First cell is 'x' or empty
        const firstTh = document.createElement('th');
        firstTh.textContent = 'Event'; // Or leave empty: '';
        headerHtmlRow.appendChild(firstTh);

        selectedEvents.forEach(event => {
            const th = document.createElement('th');
            const eventNameSpan = document.createElement('span');
            eventNameSpan.textContent = event.name;
            const removeBtn = document.createElement('span');
            removeBtn.textContent = 'x';
            removeBtn.className = 'remove-event-btn';
            removeBtn.title = `Remove ${event.name} from matrix`;
            removeBtn.dataset.eventIdToRemove = event.id;
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeEventFromMatrix(event.id);
            };
            th.appendChild(eventNameSpan);
            th.appendChild(removeBtn);
            headerHtmlRow.appendChild(th);
        });

        // Create table body
        const tbody = table.createTBody();
        selectedEvents.forEach(event1 => {
            const row = tbody.insertRow();
            const rowDataForCsv = [event1.name]; // For CSV

            const thRowHeader = document.createElement('th');
            thRowHeader.scope = 'row';
            const eventNameSpan = document.createElement('span');
            eventNameSpan.textContent = event1.name;
            const removeBtn = document.createElement('span');
            removeBtn.textContent = 'x';
            removeBtn.className = 'remove-event-btn';
            removeBtn.title = `Remove ${event1.name} from matrix`;
            removeBtn.dataset.eventIdToRemove = event1.id;
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                removeEventFromMatrix(event1.id);
            };
            thRowHeader.appendChild(eventNameSpan);
            thRowHeader.appendChild(removeBtn);
            row.appendChild(thRowHeader);

            selectedEvents.forEach(event2 => {
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
            currentMatrixData.push(rowDataForCsv); // Add row data for CSV
        });

        matrixContainer.innerHTML = '';
        matrixContainer.appendChild(table);
        exportSection.classList.remove('hidden');
        matrixPrompt.classList.add('hidden');
    }

    function removeEventFromMatrix(eventIdToRemove) {
        selectedEventIds.delete(eventIdToRemove);
        const eventButton = eventsContainer.querySelector(`.event-button[data-event-id="${eventIdToRemove}"]`);
        if (eventButton) {
            eventButton.classList.remove('selected');
        }
        updateProduceMatrixButtonState();
        generateAndDisplayMatrix();
    }


    function calculateWeeksBetween(date1, date2) {
        const diffTime = date2.getTime() - date1.getTime(); // Keep positive or negative for ordering if needed, but abs for display
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        // Use Math.round for weeks to get the nearest whole week.
        // Abs is used because the order in matrix (event1 vs event2) determines if it's past or future,
        // but the matrix is symmetrical in terms of absolute difference.
        return Math.abs(Math.round(diffDays / 7));
    }

    function clearMatrix() {
        matrixContainer.innerHTML = '';
        matrixContainer.appendChild(matrixPrompt);
        matrixPrompt.classList.remove('hidden');
        exportSection.classList.add('hidden');
        currentMatrixData = [];
    }

    // --- Event Listeners Setup ---
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

    // --- CSV Export ---
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
        link.setAttribute("download", "event_matrix.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showMessage('Matrix exported to CSV.', 'success');
    }

    // --- Utility Functions ---
    function showMessage(message, type = 'info') { // type can be 'info', 'success', 'warn', 'error'
        messageArea.textContent = message;
        messageArea.classList.remove('hidden', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500');

        switch (type) {
            case 'success':
                messageArea.classList.add('bg-green-500');
                break;
            case 'warn':
                messageArea.classList.add('bg-yellow-500');
                break;
            case 'error':
                messageArea.classList.add('bg-red-500');
                break;
            case 'info':
            default:
                messageArea.classList.add('bg-blue-500');
                break;
        }
        messageArea.classList.remove('hidden');

        setTimeout(() => {
            messageArea.classList.add('hidden');
        }, 3000);
    }

    // --- Start the application ---
    initializeApp();
});
