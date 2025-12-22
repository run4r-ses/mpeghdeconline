export const getEl = (id) => document.getElementById(id);

export const logEl = getEl('consoleLog');
export const fileArea = document.querySelector('.file-area');
export const fileInput = getEl('fileInput');
export const fileAreaIcon = getEl('fileAreaIcon');
export const fileAreaText = document.querySelector('.file-area small');
export const fileNameDisplay = getEl('fileNameDisplay');
export const queueList = getEl('queueList');

export const statusArea = getEl('statusArea');
export const statusText = getEl('statusText');
export const progressBar = getEl('progressBar');
export const progressText = getEl('progressText');

export const downloadArea = getEl('downloadArea');
export const cancelBtn = getEl('cancelBtn');
export const dlAllBtn = getEl('dlAllBtn');
export const clearAllBtn = getEl('clearAllBtn');
export const startBtn = getEl('startBtn');

export const perfWidget = getEl('perfWidget');
export const perfPrimary = getEl('perfPrimary');

export const optionsCard = getEl('optionsCard');
export const logsCard = getEl('logsCard');
export const toggleLogs = getEl('toggleLogs');
export const sideCol = document.querySelector('.side-col');

export const config = {
    cicp: getEl('cicpSelect'),
    pcm: getEl('pcmSize'),
    rate: getEl('sampleRate'),
    loudness: getEl('targetLoudness'),
    drc: getEl('drcEffect'),
    stderr: getEl('toggleStderr')
};
