/**
 * Offline Support using IndexedDB
 * Handled by Agent 9 (QA Tester)
 */

const DB_NAME = 'SchoolRadioDB';
const DB_VERSION = 1;
let db;

const request = indexedDB.open(DB_NAME, DB_VERSION);

request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains('radioData')) {
        db.createObjectStore('radioData', { keyPath: 'id' });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log("IndexedDB Initialized");
};

function saveRadioOffline(id, data) {
    const transaction = db.transaction(['radioData'], 'readwrite');
    const store = transaction.objectStore('radioData');
    store.put({ id: id, data: data, timestamp: Date.now() });
}

function getRadioOffline(id, callback) {
    const transaction = db.transaction(['radioData'], 'readonly');
    const store = transaction.objectStore('radioData');
    const request = store.get(id);
    request.onsuccess = () => {
        callback(request.result ? request.result.data : null);
    };
}

console.log("Offline Support Script Loaded");
