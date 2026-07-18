from flask import Flask, render_template, request, jsonify, url_for
import os
import json
import signal
import subprocess
import tempfile
import threading
from werkzeug.utils import secure_filename
from faster_whisper import WhisperModel

PORT = int(os.environ.get('PORT', 5004))

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join('static', 'audio')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Model to load. Defaults to a local folder (models/large-v2) — download it
# once with `python scripts/download_model.py`. You can also point WHISPER_MODEL
# at any faster-whisper model name (e.g. "small", "medium") to auto-download a
# lighter one, or at another local path. CPU/int8 by default; override with
# WHISPER_DEVICE ("cuda") and WHISPER_COMPUTE ("float16").
_MODEL   = os.environ.get("WHISPER_MODEL", "models/large-v2")
_DEVICE  = os.environ.get("WHISPER_DEVICE", "cpu")
_COMPUTE = os.environ.get("WHISPER_COMPUTE", "int8")
print(f"Loading model ({_MODEL})... please wait")
model = WhisperModel(_MODEL, device=_DEVICE, compute_type=_COMPUTE)
print("Model ready!")

PROMPT      = "شكراً لاتصالك. Thank you for calling. اضغط 1. Press 1. يعني okay fine."
LIVE_PROMPT = "okay يعني that's fine والموضوع is good وكمان right"


def get_duration(path):
    try:
        r = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', path],
            capture_output=True, text=True
        )
        return float(json.loads(r.stdout)['format']['duration'])
    except Exception:
        return 0


def make_seg(s, offset=0):
    words = []
    if s.words:
        words = [{'start': round(w.start + offset, 2),
                  'end':   round(w.end   + offset, 2),
                  'word':  w.word} for w in s.words]
    return {'start': round(s.start + offset, 2),
            'end':   round(s.end   + offset, 2),
            'text':  s.text.strip(),
            'words': words}


def transcribe_tail(path, tail_start):
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        tmp_path = tmp.name
    subprocess.run(
        ['ffmpeg', '-i', path, '-ss', str(max(0, tail_start)),
         '-acodec', 'pcm_s16le', '-ar', '16000', tmp_path, '-y', '-loglevel', 'quiet'],
        check=True
    )
    try:
        segs, _ = model.transcribe(tmp_path, initial_prompt=PROMPT, word_timestamps=True)
        return [make_seg(s, tail_start) for s in segs if s.text.strip()]
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

hd_results = {}
hd_lock    = threading.Lock()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/process', methods=['POST'])
def process():
    audio_file = request.files['audio']
    filename   = secure_filename(audio_file.filename)
    audio_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    audio_file.save(audio_path)

    with hd_lock:
        hd_results[filename] = None  # mark as processing

    def run():
        try:
            segs, _ = model.transcribe(
                audio_path,
                word_timestamps=True,
                initial_prompt=PROMPT
            )
            segments = [make_seg(s) for s in segs if s.text.strip()]
            duration = get_duration(audio_path)
            last_end = segments[-1]['end'] if segments else 0
            if duration - last_end > 5:
                tail_offset = max(0, last_end - 1)
                tail = transcribe_tail(audio_path, tail_offset)
                extra = [s for s in tail if s['start'] > last_end]
                segments.extend(extra)
        except Exception:
            segments = []
        with hd_lock:
            hd_results[filename] = segments

    threading.Thread(target=run, daemon=True).start()

    return jsonify({
        'filename': filename,
        'audio_url': url_for('static', filename='audio/' + filename)
    })


@app.route('/process_hd/<filename>')
def process_hd(filename):
    with hd_lock:
        result = hd_results.get(filename, 'not_found')
    if result == 'not_found':
        return jsonify({'status': 'not_found'})
    if result is None:
        return jsonify({'status': 'processing'})
    return jsonify({'status': 'ready', 'segments': result})


@app.route('/transcribe_chunk', methods=['POST'])
def transcribe_chunk():
    chunk = request.files['audio']
    ext   = os.path.splitext(chunk.filename)[1] or '.webm'

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        chunk.save(tmp.name)
        tmp_path = tmp.name

    try:
        prior  = request.form.get('context', '').strip()
        prompt = (prior[-300:] + ' ' if prior else '') + LIVE_PROMPT
        segs, _ = model.transcribe(tmp_path, language=None, task='transcribe', initial_prompt=prompt, vad_filter=False)
        text = ' '.join(s.text.strip() for s in segs)
        return jsonify({'text': text})
    except Exception as e:
        return jsonify({'text': '', 'error': str(e)})
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=False, port=PORT, threaded=True)
