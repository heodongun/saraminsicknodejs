document.addEventListener('DOMContentLoaded', function() {
    // DOM 요소 참조
    const redLight = document.getElementById('red-light');
    const yellowLight = document.getElementById('yellow-light');
    const greenLight = document.getElementById('green-light');
    const countdown = document.getElementById('countdown');
    const startWebcamBtn = document.getElementById('start-webcam');
    const resetSignalBtn = document.getElementById('reset-signal');
    const statusText = document.getElementById('status-text');
    const personCount = document.getElementById('person-count');
    const webcamElement = document.getElementById('webcam');
    const captureCanvas = document.getElementById('capture-canvas');
    const detectionStatus = document.getElementById('detection-status');
    const serverStatus = document.getElementById('server-status');

    // 캔버스 컨텍스트
    const ctx = captureCanvas.getContext('2d');
    
    // 변수 초기화
    let webcamActive = false;
    let detectionInterval;
    let currentLight = 'green';
    
    // 서버 연결
    const socket = io();
    
    // 서버 연결 확인
    socket.on('connect', function() {
        serverStatus.textContent = '서버 연결됨 - AI 모델 준비 완료';
    });
    
    socket.on('disconnect', function() {
        serverStatus.textContent = '서버 연결 끊김';
    });
    
    // 서버로부터 신호등 상태 변경 이벤트 수신
    socket.on('light_change', function(data) {
        updateTrafficLightUI(data.color);
        if (data.timeLeft !== undefined) {
            countdown.textContent = data.timeLeft;
        }
    });
    
    // 서버로부터 카운트다운 업데이트 이벤트 수신
    socket.on('countdown', function(timeLeft) {
        countdown.textContent = timeLeft;
    });

    // 웹캠 시작/중지 토글 함수
    startWebcamBtn.addEventListener('click', toggleWebcam);

    async function toggleWebcam() {
        if (webcamActive) {
            // 웹캠 중지
            if (webcamElement.srcObject) {
                const tracks = webcamElement.srcObject.getTracks();
                tracks.forEach(track => track.stop());
                webcamElement.srcObject = null;
            }
            clearInterval(detectionInterval);
            webcamActive = false;
            startWebcamBtn.textContent = '웹캠 시작';
            startWebcamBtn.classList.remove('active');
            detectionStatus.textContent = '웹캠이 꺼져 있습니다';
        } else {
            // 웹캠 시작
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 360 }
                });
                webcamElement.srcObject = stream;
                
                // 비디오 크기에 맞게 캔버스 크기 설정
                webcamElement.onloadedmetadata = () => {
                    captureCanvas.width = webcamElement.videoWidth;
                    captureCanvas.height = webcamElement.videoHeight;
                    
                    // 비디오가 로드되면 감지 시작
                    webcamActive = true;
                    startWebcamBtn.textContent = '웹캠 중지';
                    startWebcamBtn.classList.add('active');
                    detectionStatus.textContent = '서버에 이미지 전송 중...';
                    
                    // 서버로 이미지 전송 시작
                    startSendingImages();
                };
            } catch (error) {
                console.error('웹캠 액세스 오류:', error);
                detectionStatus.textContent = '웹캠 액세스 오류: ' + error.message;
            }
        }
    }

    // 이미지 캡처 및 서버로 전송 시작
    function startSendingImages() {
        // 이전 인터벌 중지
        if (detectionInterval) {
            clearInterval(detectionInterval);
        }
        
        // 일정 간격으로 이미지 캡처 및 전송
        detectionInterval = setInterval(captureAndSendImage, 1000);
    }

    // 이미지 캡처 및 서버로 전송
    async function captureAndSendImage() {
        if (!webcamActive || !webcamElement.srcObject) return;

        try {
            // 비디오 프레임을 캔버스에 그리기
            ctx.drawImage(webcamElement, 0, 0, captureCanvas.width, captureCanvas.height);
            
            // 캔버스에서 이미지 데이터 가져오기
            captureCanvas.toBlob(async function(blob) {
                // FormData 생성
                const formData = new FormData();
                formData.append('image', blob, 'webcam.jpg');
                
                // 서버로 이미지 전송
                const response = await fetch('/api/detect', {
                    method: 'POST',
                    body: formData
                });
                
                // 응답 처리
                if (response.ok) {
                    const result = await response.json();
                    
                    // 감지 상태 업데이트
                    if (result.detected) {
                        detectionStatus.textContent = `사람 감지됨: ${result.count}명`;
                        personCount.textContent = result.count;
                    } else {
                        detectionStatus.textContent = '사람이 감지되지 않음';
                        personCount.textContent = '0';
                    }
                    
                    // 신호등 상태 업데이트 (서버에서 socket.io를 통해 처리됨)
                    currentLight = result.currentLight;
                } else {
                    console.error('이미지 전송 오류:', response.statusText);
                    detectionStatus.textContent = '서버 통신 오류';
                }
            }, 'image/jpeg', 0.8);
        } catch (error) {
            console.error('이미지 캡처 오류:', error);
            detectionStatus.textContent = '이미지 캡처 오류 발생';
        }
    }

    // 신호등 UI 업데이트 함수
    function updateTrafficLightUI(color) {
        // 모든 불 비활성화
        redLight.classList.remove('active');
        yellowLight.classList.remove('active');
        greenLight.classList.remove('active');

        // 지정된 색상의 불 활성화
        switch(color) {
            case 'red':
                redLight.classList.add('active');
                statusText.textContent = "빨간불 - 정지";
                break;
            case 'yellow':
                yellowLight.classList.add('active');
                statusText.textContent = "노란불 - 주의";
                break;
            case 'green':
                greenLight.classList.add('active');
                statusText.textContent = "녹색불 - 보행 가능";
                break;
        }
    }

    // 신호 초기화 버튼 이벤트
    resetSignalBtn.addEventListener('click', function() {
        socket.emit('reset_signal');
    });

    // 초기 상태 가져오기
    fetch('/api/traffic_light_status')
        .then(response => response.json())
        .then(data => {
            updateTrafficLightUI(data.traffic_light_color);
            countdown.textContent = data.time_left;
            currentLight = data.traffic_light_color;
        })
        .catch(error => console.error('초기 상태 가져오기 오류:', error));
});