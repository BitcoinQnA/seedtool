let videoStream;

function startQRScanner(targetElementId, callback) {
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
        z-index: 1000;
    `;

    const video = document.createElement('video');
    video.style.cssText = `
        width: 100%;
        max-width: 400px;
        height: auto;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.cssText = `
        margin-top: 10px;
        padding: 5px 10px;
    `;
    closeButton.onclick = () => {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
        }
        document.body.removeChild(popup);
    };

    popup.appendChild(video);
    popup.appendChild(closeButton);
    document.body.appendChild(popup);

    const canvasElement = document.createElement('canvas');
    const canvas = canvasElement.getContext('2d');

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(function(stream) {
            videoStream = stream;
            video.srcObject = stream;
            video.setAttribute('playsinline', true);
            video.play();
            requestAnimationFrame(tick);
        });

    function tick() {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvasElement.height = video.videoHeight;
            canvasElement.width = video.videoWidth;
            canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
            const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });
            if (code) {
                videoStream.getTracks().forEach(track => track.stop());
                if (targetElementId) {
                    document.getElementById(targetElementId).value = code.data;
                }
                if (callback && typeof callback === 'function') {
                    callback(code.data);
                }
                document.body.removeChild(popup);
                return;
            }
        }
        requestAnimationFrame(tick);
    }
}

document.getElementById('mnemonicXorQrIcon').addEventListener('click', function() {
    startQRScanner('mnemonicXor');
});

document.getElementById('mnemonicInputQrIcon').addEventListener('click', function() {
    startQRScanner(null, function(result) {
        const words = result.split(' ');
        const inputs = document.querySelectorAll('.inputMnemonic-word');
        words.forEach((word, index) => {
            if (inputs[index]) {
                inputs[index].value = word;
            }
        });
        mnemonicInputSeedLoad();
    });
});