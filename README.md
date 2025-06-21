# ドックンバトル
Hack U 2025Tokyo チーム swk

![2025-06-21_23h44_28](https://github.com/user-attachments/assets/07e8cd89-643c-4e73-a069-5c2b48c951fb)

これは心拍数をもとに戦う新感覚バトルゲームです\
まずはデモをご覧下さい


[![デモ動画を見る](https://img.shields.io/badge/🎥-デモ動画を見る-blue)](https://drive.google.com/file/d/11CYUekB-7ZitqFYvdT-IRSokUG07rrGf/view?usp=sharing)

[![ランキングを見る](https://img.shields.io/badge/🏆-ランキングを見る-blue)](https://swkoubou.github.io/HackU_swk/ranking.html)

ESP32とBLEでchromeと接続してリアルタイムでデータをJSで受け取ります
ランキングにはfirebaseを利用しています

ESP32に書き込むファイルは[/BLE](https://github.com/swkoubou/HackU_swk/tree/main/BLE)にあります\
こちらはC++で実装してあります

# よくある質問
Q. Unityなどのゲームエンジンは使ってますか？\
A. いいえ、すべてJSで動作しています

Q. どうやって波形を表示してますか\
A. ESP32から40hzで送信されるデータをLPFに通した後にCanvasへ描画しています
