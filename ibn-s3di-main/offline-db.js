/**
 * Offline Support using IndexedDB
 */

const DB_NAME = 'SchoolRadioDB';
const DB_VERSION = 1;
let offlineDb = null;

const request = indexedDB.open(DB_NAME, DB_VERSION);

request.onupgradeneeded = (event) => {
    offlineDb = event.target.result;
    if (!offlineDb.objectStoreNames.contains('radioData')) {
        offlineDb.createObjectStore('radioData', { keyPath: 'id' });
    }
};

request.onsuccess = (event) => {
    offlineDb = event.target.result;
    console.log("IndexedDB Initialized");
};

function saveRadioOffline(id, data) {
    if (!offlineDb) return;
    const transaction = offlineDb.transaction(['radioData'], 'readwrite');
    const store = transaction.objectStore('radioData');
    store.put({ id: id, data: data, timestamp: Date.now() });
}

function getRadioOffline(id, callback) {
    if (!offlineDb) { if (callback) callback(null); return; }
    const transaction = offlineDb.transaction(['radioData'], 'readonly');
    const store = transaction.objectStore('radioData');
    const request = store.get(id);
    request.onsuccess = () => {
        callback(request.result ? request.result.data : null);
    };
}

console.log("Offline Support Script Loaded");
