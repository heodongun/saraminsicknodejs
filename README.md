# 생명인식 신호등 (AI-Powered Traffic Light System)

AI 기반 사람 감지를 통한 스마트 신호등 시스템입니다. TensorFlow.js와 COCO-SSD 모델을 사용하여 실시간으로 사람을 감지하고, 신호등 제어를 자동화합니다.

## 주요 기능

- **AI 사람 감지**: COCO-SSD 모델을 사용한 실시간 사람 감지
- **스마트 신호등 제어**: 사람 감지 여부에 따른 자동 신호등 전환
- **실시간 통신**: Socket.IO를 통한 실시간 상태 업데이트
- **ESP 연동**: ESP32/8266 장치와 연동 가능한 API 제공
- **웹 인터페이스**: 실시간 모니터링을 위한 웹 대시보드

## 신호등 동작 로직

1. **초록불 (10초)**: 기본 상태, 타이머 카운트다운
2. **노란불**: 초록불 종료 시 사람이 감지된 경우, 사람이 사라질 때까지 유지
3. **빨간불 (10초)**: 초록불 종료 시 사람이 없거나, 노란불에서 사람이 사라진 경우

## 기술 스택

- **Backend**: Node.js, Express
- **AI/ML**: TensorFlow.js, COCO-SSD
- **실시간 통신**: Socket.IO
- **이미지 처리**: Canvas, Multer
- **Hardware**: ESP32/8266 지원

## 필수 요구사항

- Node.js v16.x ~ v20.x (⚠️ v21 이상은 TensorFlow 호환성 문제 발생)
- npm 또는 yarn
- Python 3.x (TensorFlow 네이티브 모듈 빌드용)
- C++ 컴파일러 (Mac: Xcode Command Line Tools)

## 설치 방법

### 1. 프로젝트 클론

```bash
git clone <repository-url>
cd saraminsicknodejs-master
```

⚠️ **중요**: 프로젝트 경로에 **한글이나 공백이 없는 경로**에 클론하세요.
- ❌ 나쁜 예: `/Users/name/[한글 폴더]/project`
- ✅ 좋은 예: `/Users/name/projects/traffic-light`

### 2. Node.js 버전 확인 및 설정

```bash
# 현재 Node.js 버전 확인
node --version

# v21 이상인 경우 v20 설치 (nvm 사용 시)
nvm install 20
nvm use 20
```

### 3. 의존성 설치

```bash
npm install
```

### 문제 해결

#### TensorFlow 설치 오류 발생 시

**방법 1: Docker 사용 (권장)**
```bash
# Dockerfile 생성 후
docker build -t traffic-light .
docker run -p 3000:3000 traffic-light
```

**방법 2: 경로 이동**
```bash
# 프로젝트를 영문 경로로 이동
mv "/Users/name/[한글 경로]/project" "/Users/name/traffic-light"
cd /Users/name/traffic-light
npm install
```

**방법 3: Node.js 버전 다운그레이드**
```bash
# nvm으로 Node.js 20.x 설치
nvm install 20.18.0
nvm use 20.18.0
npm install
```

## 실행 방법

### 개발 모드
```bash
npm start
```

### 서버 접속
```
http://localhost:3000
```

## API 엔드포인트

### 1. 사람 감지 API
```http
POST /api/detect
Content-Type: multipart/form-data

Body: image (파일)
```

**응답 예시**:
```json
{
  "success": true,
  "detected": true,
  "count": 2,
  "currentLight": "yellow",
  "timeLeft": 0
}
```

### 2. 신호등 상태 조회
```http
GET /api/traffic_light_status
```

**응답 예시**:
```json
{
  "traffic_light_color": "green",
  "time_left": 7,
  "person_detected": false
}
```

### 3. ESP 장치용 API
```http
GET /esp
```

**응답 예시**:
```json
{
  "signal": "G"  // "R", "Y", "G"
}
```

## Socket.IO 이벤트

### 클라이언트 → 서버
- `reset_signal`: 신호등 초기화

### 서버 → 클라이언트
- `light_change`: 신호등 상태 변경 `{ color, timeLeft }`
- `countdown`: 카운트다운 업데이트 (초 단위)

## 프로젝트 구조

```
saraminsicknodejs-master/
├── server.js           # 메인 서버 파일
├── package.json        # 프로젝트 설정
├── public/            # 정적 파일 (HTML, CSS, JS)
├── uploads/           # 업로드된 이미지 임시 저장
└── README.md          # 프로젝트 문서
```

## ESP32/8266 연동 예시

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* serverUrl = "http://192.168.1.100:3000/esp";

void loop() {
  HTTPClient http;
  http.begin(serverUrl);
  int httpCode = http.GET();

  if (httpCode == 200) {
    String payload = http.getString();
    // JSON 파싱하여 신호등 제어
    // "R" -> 빨간불, "Y" -> 노란불, "G" -> 초록불
  }

  http.end();
  delay(1000);
}
```

## 환경 변수

```bash
PORT=3000  # 서버 포트 (기본값: 3000)
```

## 라이선스

ISC

## 기여

버그 리포트 및 기능 제안은 이슈로 등록해주세요.

## 문제 해결

### Q: TensorFlow 설치가 실패합니다
A: Node.js 버전을 v20.x로 다운그레이드하거나, 프로젝트 경로를 영문으로 변경하세요.

### Q: 모델 로딩이 느립니다
A: COCO-SSD 모델은 처음 로딩 시 시간이 걸립니다 (약 10-30초). 이는 정상입니다.

### Q: 사람이 감지되지 않습니다
A: 이미지 품질, 조명, 거리 등을 확인하세요. COCO-SSD 모델의 정확도는 환경에 따라 달라질 수 있습니다.
