// ===== TABS =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ===== UPLOAD MODE =====
const dropZone    = document.getElementById('dropZone');
const fileInput   = document.getElementById('fileInput');
const browseBtn   = document.getElementById('browseBtn');
const playerCard  = document.getElementById('playerCard');
const audioPlayer = document.getElementById('audioPlayer');
const transcript  = document.getElementById('transcript');
const correctBtn  = document.getElementById('correctBtn');
const procPanel   = document.getElementById('procPanel');
const procSteps   = document.getElementById('procSteps');
const procFill    = document.getElementById('procFill');
const procWave    = document.getElementById('procWave');

// ===== CORRECTIONS =====
const DEFAULT_CORRECTIONS = {
  'بتدى':    'ابتدا',
  'نابولزي': 'نابلسي',
  'نابولزية':'نابلسية',
  'المينيو': 'المنيو',
  'هتي':     'هاتي',
  'كونافانابولسي': 'كنافة نابلسي'
};

let corrections = { ...DEFAULT_CORRECTIONS };
let corrActive  = false;
let segmentsData = [];

fetch('/static/corrections.json')
  .then(r => r.json())
  .then(data => { corrections = { ...DEFAULT_CORRECTIONS, ...data }; })
  .catch(() => {});

correctBtn.addEventListener('click', () => {
  corrActive = !corrActive;
  correctBtn.classList.toggle('active', corrActive);
  correctBtn.textContent = corrActive ? '✦ إلغاء التصحيح' : '✦ تصحيح';

  if (corrActive) {
    transcript.innerHTML = '';
    segmentsData.forEach(seg => {
      const span = document.createElement('span');
      span.className = 'transcript-segment';
      span.dataset.start = seg.start;
      span.dataset.end   = seg.end;
      let html = seg.text + ' ';
      Object.entries(corrections).forEach(([wrong, right]) => {
        html = html.split(wrong).join(`<span class="corrected-word">${right}</span>`);
      });
      span.innerHTML = html;
      transcript.appendChild(span);
    });
  } else {
    renderSegments(segmentsData);
  }
});

browseBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) processUpload(fileInput.files[0]);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) processUpload(e.dataTransfer.files[0]);
});

let highlightListener = null;

const PROC_STEPS = [
  { icon: '⚡', text: 'Loading audio file' },
  { icon: '🎵', text: 'Extracting mel spectrogram' },
  { icon: '🔊', text: 'Detecting voice activity' },
  { icon: '🧠', text: 'Neural network inference — large-v2' },
  { icon: '✍️', text: 'Decoding transcript output' },
];

function buildProcWave() {
  procWave.innerHTML = '';
  for (let i = 0; i < 40; i++) {
    const b = document.createElement('div');
    b.className = 'proc-wave-bar';
    b.style.setProperty('--spd', (0.3 + Math.random() * 1).toFixed(2) + 's');
    b.style.setProperty('--h',   (6 + Math.random() * 28).toFixed(0) + 'px');
    procWave.appendChild(b);
  }
}

function showProcStep(index) {
  if (index >= PROC_STEPS.length) return;
  const s = PROC_STEPS[index];
  const prev = procSteps.querySelector('.active');
  if (prev) {
    prev.classList.remove('active');
    prev.classList.add('done');
    prev.insertAdjacentHTML('beforeend', '<span class="check">✓</span>');
  }
  const el = document.createElement('div');
  el.className = 'proc-step active';
  el.style.animationDelay = '0s';
  el.innerHTML = `<span class="step-icon">${s.icon}</span>${s.text}`;
  procSteps.appendChild(el);
  procFill.style.width = ((index + 1) / PROC_STEPS.length * 88) + '%';
}

async function processUpload(file) {
  playerCard.classList.add('hidden');
  transcript.innerHTML = '';
  procPanel.classList.remove('hidden');
  procSteps.innerHTML = '';
  procFill.style.width = '0%';
  buildProcWave();

  audioPlayer.src = URL.createObjectURL(file);

  let stepIdx = 0;
  showProcStep(stepIdx++);
  const stepTimings = [2000, 4000, 8000, 14000];
  const timers = stepTimings.map((t, i) =>
    setTimeout(() => showProcStep(stepIdx + i), t)
  );

  const formData = new FormData();
  formData.append('audio', file);

  try {
    const res  = await fetch('/process', { method: 'POST', body: formData });
    const data = await res.json();
    timers.forEach(clearTimeout);
    await pollHD(data.filename);
    procFill.style.width = '100%';
    await new Promise(r => setTimeout(r, 600));
    procPanel.classList.add('hidden');
    playerCard.classList.remove('hidden');
    if (corrActive) correctBtn.click();
    setupHighlight();
  } catch {
    timers.forEach(clearTimeout);
    procPanel.classList.add('hidden');
    playerCard.classList.remove('hidden');
    transcript.innerHTML = '<p style="color:#ff6666;padding:12px">Error. Please try again.</p>';
  }
}

function renderSegments(segments) {
  segmentsData = segments;
  transcript.innerHTML = '';
  segments.forEach((seg, si) => {
    const words = seg.words && seg.words.length > 0 ? seg.words : null;
    if (words) {
      words.forEach((w, wi) => {
        const span = document.createElement('span');
        span.className = 'transcript-word';
        span.dataset.start = w.start;
        span.dataset.end   = w.end;
        span.textContent   = w.word;
        span.style.animation = `chunkIn 0.4s ease ${(si * 0.3 + wi * 0.04).toFixed(2)}s both`;
        transcript.appendChild(span);
      });
    } else {
      const span = document.createElement('span');
      span.className = 'transcript-word';
      span.dataset.start = seg.start;
      span.dataset.end   = seg.end;
      span.textContent   = seg.text + ' ';
      span.style.animation = `chunkIn 0.45s ease ${(si * 0.05).toFixed(2)}s both`;
      transcript.appendChild(span);
    }
  });
}

async function pollHD(filename) {
  while (true) {
    await new Promise(r => setTimeout(r, 4000));
    try {
      const res  = await fetch('/process_hd/' + filename);
      const data = await res.json();
      if (data.status === 'ready') {
        renderSegments(data.segments);
        break;
      }
      if (data.status === 'not_found') break;
    } catch { break; }
  }
}

function setupHighlight() {
  if (highlightListener) audioPlayer.removeEventListener('timeupdate', highlightListener);

  highlightListener = () => {
    const t = audioPlayer.currentTime;
    let active = null;
    document.querySelectorAll('.transcript-word, .transcript-segment').forEach(span => {
      const start = parseFloat(span.dataset.start);
      const end   = parseFloat(span.dataset.end);
      if (t >= start && t <= end) {
        span.classList.add('highlight');
        active = span;
      } else {
        span.classList.remove('highlight');
      }
    });
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  audioPlayer.addEventListener('timeupdate', highlightListener);
}

// ===== LIVE RECORDING MODE =====
const recordBtn    = document.getElementById('recordBtn');
const recordLabel  = document.getElementById('recordLabel');
const waveform     = document.getElementById('waveform');
const liveTranscript = document.getElementById('liveTranscript');

const BAR_COUNT = 28;
for (let i = 0; i < BAR_COUNT; i++) {
  const bar = document.createElement('div');
  bar.className = 'wave-bar';
  bar.style.setProperty('--spd', (0.4 + Math.random() * 1.2).toFixed(2) + 's');
  waveform.appendChild(bar);
}

let isRecording    = false;
let mediaStream    = null;
let audioCtx       = null;
let analyser       = null;
let animFrameId    = null;
let currentRecorder = null;

recordBtn.addEventListener('click', () => {
  if (!isRecording) startRecording();
  else              stopRecording();
});

async function startRecording() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    alert('Microphone access was denied.');
    return;
  }

  audioCtx  = new AudioContext();
  analyser  = audioCtx.createAnalyser();
  analyser.fftSize = 64;
  audioCtx.createMediaStreamSource(mediaStream).connect(analyser);

  isRecording = true;
  recordBtn.classList.add('recording');
  recordLabel.textContent = '● Recording…';
  recordLabel.classList.add('active');
  waveform.classList.add('live');

  const placeholder = liveTranscript.querySelector('.placeholder');
  if (placeholder) placeholder.remove();

  drawBars();
  startChunk();
}

function startChunk() {
  if (!isRecording) return;

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
                 : MediaRecorder.isTypeSupported('audio/webm')              ? 'audio/webm'
                 :                                                             'audio/mp4';

  currentRecorder = new MediaRecorder(mediaStream, { mimeType });
  const chunks = [];

  currentRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  currentRecorder.onstop = async () => {
    showLiveStatus('processing');
    await sendChunk(new Blob(chunks, { type: mimeType }), mimeType);
    if (isRecording) {
      showLiveStatus('recording');
      startChunk();
    }
  };

  currentRecorder.start();
  setTimeout(() => {
    if (currentRecorder?.state === 'recording') currentRecorder.stop();
  }, 8000);
}

async function sendChunk(blob, mimeType) {
  if (blob.size < 500) return;
  const ext = mimeType.includes('webm') ? '.webm' : '.mp4';
  const formData = new FormData();
  formData.append('audio', blob, 'chunk' + ext);
  formData.append('context', liveTranscript.innerText.slice(-300));
  try {
    const res  = await fetch('/transcribe_chunk', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.text?.trim()) appendLiveText(data.text.trim());
  } catch {}
}

function showLiveStatus(state) {
  if (state === 'processing') {
    recordLabel.textContent = '⟳ Processing…';
    recordLabel.style.color = '#00d4ff';
  } else {
    recordLabel.textContent = '● Recording…';
    recordLabel.style.color = '';
  }
}

function appendLiveText(text) {
  const span = document.createElement('span');
  span.className = 'live-chunk';
  span.textContent = text + ' ';
  liveTranscript.appendChild(span);
  liveTranscript.scrollTop = liveTranscript.scrollHeight;
}

function stopRecording() {
  isRecording = false;

  recordBtn.classList.remove('recording');
  recordLabel.textContent = 'Tap to Record';
  recordLabel.classList.remove('active');
  waveform.classList.remove('live');
  cancelAnimationFrame(animFrameId);
  document.querySelectorAll('.wave-bar').forEach(bar => { bar.style.height = ''; });

  if (currentRecorder?.state === 'recording') {
    const originalOnStop = currentRecorder.onstop;
    currentRecorder.onstop = () => {
      originalOnStop();
      mediaStream?.getTracks().forEach(t => t.stop());
      audioCtx?.close();
    };
    currentRecorder.stop();
  } else {
    mediaStream?.getTracks().forEach(t => t.stop());
    audioCtx?.close();
  }
}

function drawBars() {
  const bars      = document.querySelectorAll('.wave-bar');
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  bars.forEach((bar, i) => {
    const v = dataArray[i] ?? 0;
    bar.style.height = Math.max(5, (v / 255) * 58) + 'px';
  });

  animFrameId = requestAnimationFrame(drawBars);
}
