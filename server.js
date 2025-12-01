const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const tf = require('@tensorflow/tfjs-node');
const cocoSsd = require('@tensorflow-models/coco-ssd');
const { createCanvas, Image } = require('canvas');

// 업로드 설정
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function(req, file, cb) {
        cb(null, 'frame-' + Date.now() + '.jpg');
    }
});
const upload = multer({ storage: storage });

// Express 앱 설정
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// uploads 디렉토리 생성
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// 전역 변수
let model = null;
let currentLight = 'green';
let timeLeft = 10;
let personDetected = false;
let timer;

// 모델 로딩
async function loadModel() {
    try {
        console.log('AI 모델 로딩 중...');
        model = await cocoSsd.load();
        console.log('AI 모델 로드 완료!');
    } catch (error) {
        console.error('AI 모델 로드 실패:', error);
    }
}

// 이미지에서 사람 감지
async function detectPeople(imagePath) {
    if (!model) {
        console.log('모델이 아직 로드되지 않았습니다.');
        return { detected: false, count: 0 };
    }

    try {
        // 이미지 로드
        const img = new Image();
        img.src = fs.readFileSync(imagePath);
        
        // Canvas 생성
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, img.width, img.height);
        
        // 모델을 사용하여 객체 감지
        const tensor = tf.browser.fromPixels(canvas);
        const predictions = await model.detect(tensor);
        
        // 사람 객체만 필터링
        const persons = predictions.filter(pred => pred.class === 'person');
        
        // 메모리 정리
        tensor.dispose();

        // 임시 파일 삭제
        fs.unlinkSync(imagePath);
        
        return {
            detected: persons.length > 0,
            count: persons.length,
            predictions: persons
        };
    } catch (error) {
        console.error('사람 감지 오류:', error);
        return { detected: false, count: 0 };
    }
}

// API 라우트: 이미지 업로드 및 감지
app.post('/api/detect', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '이미지가 업로드되지 않았습니다' });
    }
    
    try {
        const result = await detectPeople(req.file.path);
        
        // 기존 감지 상태 저장
        const previouslyDetected = personDetected;
        
        // 감지 결과 업데이트
        personDetected = result.detected;
        
        // 노란불 상태에서 사람이 더 이상 감지되지 않으면 빨간불로 변경
        if (currentLight === 'yellow' && !personDetected && previouslyDetected) {
            changeLight('red');
            timeLeft = 10;
            
            // 상태 변경 알림
            io.emit('light_change', { 
                color: currentLight, 
                timeLeft: timeLeft 
            });
        }
        
        return res.json({
            success: true,
            ...result,
            currentLight: currentLight,
            timeLeft: timeLeft
        });
    } catch (error) {
        console.error('감지 처리 오류:', error);
        return res.status(500).json({ error: '감지 처리 중 오류가 발생했습니다' });
    }
});


app.get("/esp", (req, res) => {
    if(currentLight === 'red') {
        return res.status(200).json({
            signal:"R"
        })
    }
    else if(currentLight === 'yellow'){
        return res.status(200).json({
            signal:"Y"
        })
    }
    else{
        return res.status(200).json({
            signal:"G"
        })
    }
})

// API 엔드포인트: 현재 신호등 상태 반환
app.get('/api/traffic_light_status', (req, res) => {
    res.json({
        traffic_light_color: currentLight,
        time_left: timeLeft,
        person_detected: personDetected
    });
});

// 신호등 색상 변경 함수
function changeLight(color) {
    currentLight = color;
    console.log(`신호등 상태 변경: ${color}`);
}

// 카운트다운 함수
function startCountdown() {
    clearInterval(timer);
    
    timer = setInterval(() => {
        // 초록불 상태
        if (currentLight === 'green') {
            if (timeLeft > 0) {
                timeLeft--;
                io.emit('countdown', timeLeft);
            } else {
                // 타이머가 0초가 되었을 때
                if (personDetected) {
                    // 사람이 감지된 경우 노란불로 변경
                    changeLight('yellow');
                } else {
                    // 사람이 감지되지 않은 경우 빨간불로 변경
                    changeLight('red');
                    timeLeft = 10;
                }
                
                // 상태 변경 알림
                io.emit('light_change', { 
                    color: currentLight, 
                    timeLeft: timeLeft 
                });
            }
        }
        // 노란불 상태
        else if (currentLight === 'yellow') {
            // 노란불에서는 타이머를 0으로 유지
            // 사람이 사라지면 빨간불로 바뀌는 것은 감지 로직에서 처리
            io.emit('countdown', 0);
        }
        // 빨간불 상태
        else if (currentLight === 'red') {
            if (timeLeft > 0) {
                timeLeft--;
                io.emit('countdown', timeLeft);
            } else {
                // 타이머가 0이 되면 초록불로 변경
                changeLight('green');
                timeLeft = 10;
                
                // 상태 변경 알림
                io.emit('light_change', { 
                    color: currentLight, 
                    timeLeft: timeLeft 
                });
            }
        }
    }, 1000);
}

// 소켓 연결 처리
io.on('connection', (socket) => {
    console.log('클라이언트 연결됨');
    
    // 현재 상태를 새로 연결된 클라이언트에게 전송
    socket.emit('light_change', { 
        color: currentLight, 
        timeLeft: timeLeft 
    });
    
    // 신호등 초기화 처리
    socket.on('reset_signal', () => {
        clearInterval(timer);
        changeLight('green');
        timeLeft = 10;
        
        io.emit('light_change', { 
            color: currentLight, 
            timeLeft: timeLeft 
        });
        
        startCountdown();
    });
    
    // 클라이언트 연결 종료 처리
    socket.on('disconnect', () => {
        console.log('클라이언트 연결 종료');
    });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);
    
    // 서버 시작 시 AI 모델 로드
    await loadModel();
    
    // 서버 시작 시 카운트다운 시작
    startCountdown();
});