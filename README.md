# 손으로 도마뱀 구조하기 (Lizard Rescue)

웹캠으로 손과 손가락 움직임을 인식해서 화면 속 반려 도마뱀을 잡아 집에 넣어주는 손 추적 게임입니다.

- 엄지+검지 핀치로 도마뱀을 잡고, 문에 정확히 놓으면 성공
- 너무 세게/급하게 잡으면 감점, 다른 손가락으로 살살 문지르면 애정도 상승
- 덩치 큰 위험한 도마뱀은 새총으로 구슬을 쏘아 쫓아내야 함

빌드 툴/의존성 없이 순수 HTML/CSS/JS + [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) `HandLandmarker`로 만들었습니다.

## 로컬 실행

```
node server.js
```

이후 http://localhost:5500 에서 접속하세요 (카메라 접근에는 https 또는 localhost가 필요합니다).

## 플레이

https://mastabeejay.github.io/lizard-rescue-game/
