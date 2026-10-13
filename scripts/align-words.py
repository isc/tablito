"""Mots d'un audio, horodatés, par Vosk (Kaldi) : cf. scripts/tts-takes.mjs.

Usage : align-words.py <grammaire JSON>  < PCM s16le mono 16 kHz
Sortie : [{"text", "start", "end"}, ...] en JSON (secondes).

La grammaire est une liste de phrases que la reconnaissance a le droit
d'entendre (format Vosk) ; une phrase unique, le texte attendu, en fait un
alignement forcé.

Le modèle (vosk-model-small-fr-0.22, ~40 Mo) est téléchargé au premier appel
dans ~/.cache/vosk.
"""

import json
import sys

from vosk import KaldiRecognizer, Model, SetLogLevel

SetLogLevel(-1)
model = Model(model_name="vosk-model-small-fr-0.22")
recognizer = KaldiRecognizer(model, 16000, sys.argv[1])
recognizer.SetWords(True)
recognizer.AcceptWaveform(sys.stdin.buffer.read())
result = json.loads(recognizer.FinalResult()).get("result", [])
json.dump([{"text": w["word"], "start": w["start"], "end": w["end"]} for w in result], sys.stdout, ensure_ascii=False)
