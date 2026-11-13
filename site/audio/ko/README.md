# Korean lesson recordings

These synthetic Korean recordings were generated for Hangul Snap using [MyShell.ai MeloTTS Korean](https://huggingface.co/myshell-ai/MeloTTS-Korean) with its [ONNX conversion](https://huggingface.co/gnyong/melotts-kr-onnx). See [the included MIT license](./MeloTTS-LICENSE.txt).

- `names.mp3` contains the 14 jamo names, and `words.mp3` contains the 24 distinct words from the basic lessons. The playback ranges are in `src/speech.ts`.
- `어묵.mp3` is the app's pronunciation clip for 어묵. These are synthetic lesson clips. Official dictionary definitions retain their own attribution.
- For other words the player uses a Korean device voice when available and shows a pronunciation hint when playback is unavailable.
